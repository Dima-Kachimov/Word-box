// Збереження/завантаження світу через localStorage. Зберігається рельєф і
// всі шари клітинок, тварини (спрощено — без сімейних/зграйних звʼязків,
// які відновлюються заново з часом) та базові налаштування.
//
// Формат навмисно простий (один слот) — це відправна точка; план розвитку до
// багатослотового/хмарного збереження описаний у CLAUDE.md. Версія 2 додала
// цивілізації (будівлі й території в сітці + королівства/міста/жителі);
// збереження версії 1 теж відкриваються — просто без народів.

import { world } from '../world/state';
import { allocateGrid, calcBiome } from '../world/generate';
import { markDirty } from '../render/buffer';
import { clock } from '../sim/clock';
import { animals, spawnAnimal, creatureState } from '../creatures/animal';
import type { AnimalState } from '../creatures/types';
import { audioState, setSoundOn } from '../audio/engine';
import { units, cities, kingdoms, civState, resetCiv } from '../civ/state';
import type { Unit, City, Kingdom, Job } from '../civ/types';
import type { RaceId } from '../civ/races';

const STORAGE_KEY = 'godsim-save-v1';
const VERSION = 2;

function bufToB64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Дробовий шар 0..1 → цілі 0..max. */
function quant<T extends Uint8Array | Uint16Array>(src: Float32Array, max: number, Arr: { new(n: number): T }): T {
  const out = new Arr(src.length);
  for (let i = 0; i < src.length; i++) out[i] = Math.round(Math.max(0, Math.min(1, src[i])) * max);
  return out;
}
function dequant(dst: Float32Array, src: Uint8Array | Uint16Array, max: number): void {
  for (let i = 0; i < dst.length; i++) dst[i] = src[i] / max;
}

interface SavedAnimal {
  k: string; x: number; y: number; dir: 1 | -1; pal: number;
  hunger: number; thirst: number; stam: number; age: number; life: number; baby: number;
}

interface SaveData {
  version: number;
  W: number; H: number; seed: number;
  hgt: string; cover: string; timer: string; wet: string; vari: string;
  temp: string; moist: string; snow: string; grazed: string;
  /** Квантовані версії дробових шарів (v2): висота 16 біт, решта 8 біт — у кілька разів менше місця. */
  hgtQ?: string; variQ?: string; tempQ?: string; moistQ?: string;
  clock: { tod: number; dayCycle: boolean; windA: number; windS: number };
  soundOn: boolean;
  animals: SavedAnimal[];
  civ?: SavedCiv;
}

interface SavedCiv {
  bld: string; owner: string;
  next: [number, number, number]; frame: number;
  kingdoms: { id: number; name: string; race: number; color: string; capital: number; king: number; founded: number; alive: boolean; rel: [number, number, boolean, boolean, number, number][] }[];
  cities: { id: number; name: string; race: number; k: number; cx: number; cy: number; food: number; wood: number; stone: number; cells: number[]; level: number; radius: number; loyalty: number; founded: number; alive: boolean }[];
  units: { name: string; race: number; city: number; job: string; x: number; y: number; hp: number; maxHp: number; age: number; life: number; kills: number }[];
}

function serializeCiv(): SavedCiv {
  const alive = units.filter(u => !u.dead);
  return {
    bld: bufToB64(world.bld.buffer), owner: bufToB64(world.owner.buffer),
    next: [civState.nextUnit, civState.nextCity, civState.nextKingdom], frame: civState.frame,
    kingdoms: kingdoms.map(k => ({
      id: k.id, name: k.name, race: k.race, color: k.color, capital: k.capital ? k.capital.id : -1,
      king: k.king ? alive.indexOf(k.king) : -1, founded: k.founded, alive: k.alive,
      rel: [...k.rel].map(([id, r]) => [id, r.opinion, r.war, r.ally, r.since, r.losses] as [number, number, boolean, boolean, number, number])
    })),
    cities: cities.map(c => ({
      id: c.id, name: c.name, race: c.race, k: c.kingdom.id, cx: c.cx, cy: c.cy, food: c.food, wood: c.wood, stone: c.stone,
      cells: c.cells, level: c.level, radius: c.radius, loyalty: c.loyalty, founded: c.founded, alive: c.alive
    })),
    units: alive.map(u => ({ name: u.name, race: u.race, city: u.city.id, job: u.job, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, age: u.age, life: u.life, kills: u.kills }))
  };
}

function applyCiv(s: SavedCiv | undefined): void {
  resetCiv();
  if (!s) return;
  world.bld.set(b64ToBytes(s.bld));
  world.owner.set(new Int16Array(b64ToBytes(s.owner).buffer));
  [civState.nextUnit, civState.nextCity, civState.nextKingdom] = s.next;
  civState.frame = s.frame;
  const kById = new Map<number, Kingdom>();
  for (const sk of s.kingdoms) {
    const k: Kingdom = { id: sk.id, name: sk.name, race: sk.race as RaceId, color: sk.color, capital: null, king: null, rel: new Map(), founded: sk.founded, alive: sk.alive };
    kingdoms.push(k); kById.set(k.id, k);
  }
  for (const sk of s.kingdoms) for (const [id, opinion, war, ally, since, losses] of sk.rel) {
    const a = kById.get(sk.id)!, b = kById.get(id);
    if (!b || a.rel.has(id)) continue;
    const r = { opinion, war, ally, since, losses };
    a.rel.set(id, r); b.rel.set(a.id, r);
  }
  for (const sc of s.cities) {
    const c: City = {
      id: sc.id, name: sc.name, race: sc.race as RaceId, kingdom: kById.get(sc.k)!, cx: sc.cx, cy: sc.cy,
      food: sc.food, wood: sc.wood, stone: sc.stone, cells: sc.cells, pop: 0, cap: 0, level: sc.level, best: sc.level, radius: sc.radius,
      plans: [], loyalty: sc.loyalty, target: null, siege: 0, founded: sc.founded, alive: sc.alive
    };
    cities[c.id] = c;
  }
  for (const sk of s.kingdoms) if (sk.capital >= 0) kById.get(sk.id)!.capital = cities[sk.capital] || null;
  s.units.forEach((su, n) => {
    const city = cities[su.city];
    if (!city) return;
    const u: Unit = {
      id: civState.nextUnit++, name: su.name, race: su.race as RaceId, city, job: su.job as Job, x: su.x, y: su.y, tx: su.x, ty: su.y,
      dir: 1, t: 0, task: 'idle', next: 'idle', timer: n % 40, carry: null, carryN: 0, cell: -1, foe: null, prey: null,
      hp: su.hp, maxHp: su.maxHp, age: su.age, life: su.life, cd: 0, stuck: 0, inside: false, kills: su.kills
    };
    units.push(u);
    for (const sk of s.kingdoms) if (sk.king === n) kById.get(sk.id)!.king = u;
  });
}

function serialize(): SaveData {
  return {
    version: VERSION,
    W: world.W, H: world.H, seed: world.seed,
    hgt: '', hgtQ: bufToB64(quant(world.hgt, 65535, Uint16Array).buffer),
    cover: bufToB64(world.cover.buffer),
    timer: bufToB64(world.timer.buffer),
    wet: bufToB64(world.wet.buffer),
    vari: '', variQ: bufToB64(quant(world.vari, 255, Uint8Array).buffer),
    temp: '', tempQ: bufToB64(quant(world.temp, 255, Uint8Array).buffer),
    moist: '', moistQ: bufToB64(quant(world.moist, 255, Uint8Array).buffer),
    snow: bufToB64(world.snow.buffer),
    grazed: bufToB64(world.grazed.buffer),
    clock: { tod: clock.tod, dayCycle: clock.dayCycle, windA: clock.windA, windS: clock.windS },
    soundOn: audioState.soundOn,
    animals: animals.filter(a => !a.dead).map(a => ({
      k: a.S.key, x: a.x, y: a.y, dir: a.dir, pal: a.pal,
      hunger: a.hunger, thirst: a.thirst, stam: a.stam, age: a.age, life: a.life, baby: a.baby
    })),
    civ: serializeCiv()
  };
}

function apply(save: SaveData): void {
  allocateGrid(save.W, save.H);
  world.seed = save.seed;
  if (save.hgtQ) dequant(world.hgt, new Uint16Array(b64ToBytes(save.hgtQ).buffer), 65535);
  else world.hgt.set(new Float32Array(b64ToBytes(save.hgt).buffer));
  world.cover.set(b64ToBytes(save.cover));
  world.timer.set(new Int16Array(b64ToBytes(save.timer).buffer));
  world.wet.set(b64ToBytes(save.wet));
  if (save.variQ) {
    dequant(world.vari, b64ToBytes(save.variQ!), 255);
    dequant(world.temp, b64ToBytes(save.tempQ!), 255);
    dequant(world.moist, b64ToBytes(save.moistQ!), 255);
  } else {
    world.vari.set(new Float32Array(b64ToBytes(save.vari).buffer));
    world.temp.set(new Float32Array(b64ToBytes(save.temp).buffer));
    world.moist.set(new Float32Array(b64ToBytes(save.moist).buffer));
  }
  world.snow.set(new Uint16Array(b64ToBytes(save.snow).buffer));
  world.grazed.set(new Uint16Array(b64ToBytes(save.grazed).buffer));
  for (let i = 0; i < world.N; i++) world.biome[i] = calcBiome(i);
  applyCiv(save.civ);

  clock.tod = save.clock.tod; clock.dayCycle = save.clock.dayCycle;
  clock.windA = save.clock.windA; clock.windS = save.clock.windS;
  setSoundOn(save.soundOn);

  animals.length = 0;
  creatureState.selected = null;
  for (const sa of save.animals) {
    spawnAnimal(sa.k, sa.x, sa.y, {
      dir: sa.dir, pal: sa.pal, hunger: sa.hunger, thirst: sa.thirst, stam: sa.stam,
      age: sa.age, life: sa.life, baby: sa.baby, state: 'wander' as AnimalState
    });
  }
  markDirty();
}

// Великий світ у сирому JSON важить кілька мегабайт — більше за ліміт
// localStorage (~5 МБ). Тож рядок стискається gzip-ом (CompressionStream),
// а вже потім кладеться як base64 з префіксом "gz:". Масиви клітинок здебільшого
// нулі (сніг, вогонь, будівлі), тож стискаються в рази.
const GZ = 'gz:';

async function pipe(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

async function pack(json: string): Promise<string> {
  if (typeof CompressionStream === 'undefined') return json;
  const gz = await pipe(new TextEncoder().encode(json), new CompressionStream('gzip'));
  return GZ + bufToB64(gz.buffer);
}

async function unpack(raw: string): Promise<string> {
  if (!raw.startsWith(GZ)) return raw;
  const bytes = await pipe(b64ToBytes(raw.slice(GZ.length)), new DecompressionStream('gzip'));
  return new TextDecoder().decode(bytes);
}

/** Зберігає світ. false — не вмістилось або сховище недоступне. */
export async function saveToLocalStorage(): Promise<boolean> {
  try {
    localStorage.setItem(STORAGE_KEY, await pack(JSON.stringify(serialize())));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
}

export async function loadFromLocalStorage(): Promise<boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const save = JSON.parse(await unpack(raw)) as SaveData;
    if (save.version !== VERSION && save.version !== 1) return false;
    apply(save);
    return true;
  } catch {
    return false;
  }
}
