// Збереження/завантаження світу через localStorage. Зберігається рельєф і
// всі шари клітинок, тварини (спрощено — без сімейних/зграйних звʼязків,
// які відновлюються заново з часом) та базові налаштування.
//
// Формат навмисно простий (одна версія, один слот) — це відправна точка;
// план розвитку до багатослотового/хмарного збереження описаний у CLAUDE.md.

import { world } from '../world/state';
import { allocateGrid, calcBiome } from '../world/generate';
import { markDirty } from '../render/buffer';
import { clock } from '../sim/clock';
import { animals, spawnAnimal, creatureState } from '../creatures/animal';
import type { AnimalState } from '../creatures/types';
import { audioState, setSoundOn } from '../audio/engine';

const STORAGE_KEY = 'godsim-save-v1';
const VERSION = 1;

function bufToB64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
  clock: { tod: number; dayCycle: boolean; windA: number; windS: number };
  soundOn: boolean;
  animals: SavedAnimal[];
}

function serialize(): SaveData {
  return {
    version: VERSION,
    W: world.W, H: world.H, seed: world.seed,
    hgt: bufToB64(world.hgt.buffer),
    cover: bufToB64(world.cover.buffer),
    timer: bufToB64(world.timer.buffer),
    wet: bufToB64(world.wet.buffer),
    vari: bufToB64(world.vari.buffer),
    temp: bufToB64(world.temp.buffer),
    moist: bufToB64(world.moist.buffer),
    snow: bufToB64(world.snow.buffer),
    grazed: bufToB64(world.grazed.buffer),
    clock: { tod: clock.tod, dayCycle: clock.dayCycle, windA: clock.windA, windS: clock.windS },
    soundOn: audioState.soundOn,
    animals: animals.filter(a => !a.dead).map(a => ({
      k: a.S.key, x: a.x, y: a.y, dir: a.dir, pal: a.pal,
      hunger: a.hunger, thirst: a.thirst, stam: a.stam, age: a.age, life: a.life, baby: a.baby
    }))
  };
}

function apply(save: SaveData): void {
  allocateGrid(save.W, save.H);
  world.seed = save.seed;
  world.hgt.set(new Float32Array(b64ToBytes(save.hgt).buffer));
  world.cover.set(b64ToBytes(save.cover));
  world.timer.set(new Int16Array(b64ToBytes(save.timer).buffer));
  world.wet.set(b64ToBytes(save.wet));
  world.vari.set(new Float32Array(b64ToBytes(save.vari).buffer));
  world.temp.set(new Float32Array(b64ToBytes(save.temp).buffer));
  world.moist.set(new Float32Array(b64ToBytes(save.moist).buffer));
  world.snow.set(new Uint16Array(b64ToBytes(save.snow).buffer));
  world.grazed.set(new Uint16Array(b64ToBytes(save.grazed).buffer));
  for (let i = 0; i < world.N; i++) world.biome[i] = calcBiome(i);

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

export function saveToLocalStorage(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
}

export function loadFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const save = JSON.parse(raw) as SaveData;
    if (save.version !== VERSION) return false;
    apply(save);
    return true;
  } catch {
    return false;
  }
}
