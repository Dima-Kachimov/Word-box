// Міста: заснування, економіка (їжа/дерево/камінь), будівництво й
// перебудова (хатина → будинок → вежа, ратуша → замок), народжуваність,
// розподіл професій, територія, рівні (село → містечко → місто → мегаполіс),
// поселенці, облога й захоплення. Тікає раз на секунду (civTick у index.ts).

import { rnd } from '../world/noise';
import { world, tileAt } from '../world/state';
import { SEA, HILL, C_NONE, C_FIRE, C_BURNT } from '../world/constants';
import { markDirty } from '../render/buffer';
import { RACES, cityName, realmName, KINGDOM_COLORS, type RaceId } from './races';
import { units, cities, kingdoms, civState, forNear, logEvent, markBordersCity } from './state';
import type { City, Kingdom, Job, Res, Unit, Plan } from './types';
import {
  T_HALL, T_CASTLE, T_HUT, T_HOUSE, T_TOWER, T_FARM, CAPACITY, COST, bldType, buildable, farmable, placeBuilding
} from './buildings';
import { spawnUnit, findCell, sendSettlers, killUnit } from './units';
import { atWar, captureCity, isWarring } from './diplomacy';

export const LEVEL_NAMES = ['Село', 'Містечко', 'Місто', 'Мегаполіс'];
const LEVEL_POP = [0, 16, 40, 90];

// ---------------------------------------------------------------- заснування
function uniqueCityName(race: RaceId): string {
  const used = new Set(cities.map(c => c.name));
  let n = cityName(RACES[race]);
  for (let k = 0; k < 12 && used.has(n); k++) n = cityName(RACES[race]);
  return used.has(n) ? n + ' ' + ['II', 'III', 'IV', 'V'][(rnd() * 4) | 0] : n;
}
export function newKingdom(race: RaceId, name: string): Kingdom {
  const used = new Set(kingdoms.filter(k => k.alive).map(k => k.color));
  const free = KINGDOM_COLORS.filter(c => !used.has(c));
  const k: Kingdom = {
    id: civState.nextKingdom++, name, race,
    color: (free.length ? free : KINGDOM_COLORS)[(rnd() * (free.length || KINGDOM_COLORS.length)) | 0],
    capital: null, king: null, rel: new Map(), founded: civState.frame, alive: true
  };
  kingdoms.push(k);
  return k;
}

export function foundCity(kingdom: Kingdom, x: number, y: number, race: RaceId): City | null {
  const i = y * world.W + x;
  if (!buildable(i, civState.nextCity, race === 2)) return null;
  const c: City = {
    id: civState.nextCity++, name: uniqueCityName(race), race, kingdom,
    cx: x, cy: y, food: 14, wood: 6, stone: 0, cells: [], pop: 0, cap: 0, level: 0, best: 0, radius: 4,
    plans: [], loyalty: 100, target: null, siege: 0, founded: civState.frame, alive: true
  };
  cities.push(c);
  placeBuilding(i, race, T_HALL, c.id);
  c.cells.push(i);
  if (!kingdom.capital) kingdom.capital = c;
  claimTerritory(c);
  markDirty();
  markBordersCity(c);
  return c;
}

/** Нове королівство з першим містом і групою засновників (інструмент гравця, стартові народи). */
export function spawnCivilization(race: RaceId, x: number, y: number): City | null {
  const i = findCell(x, y, 8, j => buildable(j, 32000, race === 2) && !cityAt(j % world.W, (j / world.W) | 0, 9));
  if (i < 0) return null;
  const k = newKingdom(race, '');
  const c = foundCity(k, i % world.W, (i / world.W) | 0, race);
  if (!c) { k.alive = false; return null; }
  k.name = realmName(RACES[race], c.name);
  const jobs: Job[] = ['king', 'builder', 'farmer', 'woodcutter', 'woodcutter', 'farmer', 'hunter'];
  for (const j of jobs) {
    const u = spawnUnit(c, j, c.cx + 0.5 + (rnd() - 0.5) * 2, c.cy + 0.5 + (rnd() - 0.5) * 2);
    if (u && j === 'king') k.king = u;
  }
  logEvent('👑', `Засновано ${k.name} (${RACES[race].name})`, k.color);
  return c;
}

/** Місто, чия територія/центр найближчі до (x,y) у межах r клітинок. */
export function cityAt(x: number, y: number, r: number): City | null {
  let best: City | null = null, bd = r * r;
  for (const c of cities) {
    if (!c.alive) continue;
    const d = (c.cx + 0.5 - x) ** 2 + (c.cy + 0.5 - y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// ---------------------------------------------------------------- економіка
export function deliver(c: City, res: Res, n: number): void {
  c[res] += n;
}

function claimTerritory(c: City): void {
  const R = Math.ceil(c.radius), own = c.id + 1;
  let changed = false;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > c.radius * c.radius) continue;
    const i = tileAt(c.cx + dx, c.cy + dy);
    if (i < 0 || world.owner[i] || world.hgt[i] < SEA) continue;
    world.owner[i] = own; changed = true;
  }
  if (changed) markBordersCity(c);
}

/** Будівельник закінчив роботу: ставимо/перебудовуємо будівлю з плану. */
export function completePlan(c: City, p: Plan): void {
  const k = c.plans.indexOf(p);
  if (k < 0) return;
  c.plans.splice(k, 1);
  const i = p.cell;
  if (p.type === T_HOUSE || p.type === T_TOWER || p.type === T_CASTLE) {
    if (!world.bld[i] || world.owner[i] !== c.id + 1) return;
  } else if (!buildable(i, c.id, c.race === 2)) {
    c.wood += COST[p.type][0]; c.stone += COST[p.type][1];
    return;
  } else c.cells.push(i);
  placeBuilding(i, c.race, p.type, c.id);
  markDirty();
}

function countType(c: City, t: number): number {
  let n = 0;
  for (const i of c.cells) if (world.bld[i] && bldType(world.bld[i]) === t) n++;
  return n;
}

function afford(c: City, t: number): boolean {
  return c.wood >= COST[t][0] && c.stone >= COST[t][1];
}

function makePlan(c: City, cell: number, type: number): void {
  c.wood -= COST[type][0]; c.stone -= COST[type][1];
  c.plans.push({ cell, type, by: null });
}

/** Вільна клітинка для нової будівлі — кільцями від центру, з "вулицями". */
function freeSpot(c: City, farm: boolean): number {
  const hills = c.race === 2;
  // компактна забудова: будинки тісніше до центру, поля — довкола
  const minR = farm ? 2.5 + Math.sqrt(c.cells.length) * 0.5 : 1;
  const maxR = Math.max(minR + 2, Math.min(c.radius - 0.5, (farm ? 5 : 2.5) + Math.sqrt(c.cells.length) * 1.1));
  for (let tries = 0; tries < 60; tries++) {
    const an = rnd() * 6.283, d = minR + Math.pow(rnd(), 1.4) * (maxR - minR) * (tries < 30 ? 1 : 1.3);
    const x = Math.round(c.cx + Math.cos(an) * d), y = Math.round(c.cy + Math.sin(an) * d);
    const i = tileAt(x, y);
    if (i < 0 || !buildable(i, c.id, hills)) continue;
    if (farm ? !farmable(i) : world.hgt[i] >= HILL && !hills) continue;
    // вулиці: не забудовуємо кожну клітинку щільно — лишаються проходи
    if (!farm && (x - c.cx) % 3 === 0 && (y - c.cy) % 2 === 0 && d > 1.5) continue;
    return i;
  }
  return -1;
}

function planBuilding(c: City): void {
  // скільки будов одночасно — залежить від розміру міста
  if (c.plans.length >= 1 + Math.floor(c.pop / 14)) return;
  const busy = (i: number) => c.plans.some(p => p.cell === i);
  const hall = c.cells.find(i => world.bld[i] && (bldType(world.bld[i]) === T_HALL || bldType(world.bld[i]) === T_CASTLE));
  if (hall === undefined) {
    const i = tileAt(c.cx, c.cy);
    if (i >= 0 && buildable(i, c.id, c.race === 2) && !busy(i)) { c.plans.push({ cell: i, type: T_HALL, by: null }); return; }
  }
  const farms = countType(c, T_FARM);
  if (c.food < c.pop * 4 && farms < Math.ceil(c.pop / 5) && afford(c, T_FARM)) {
    const i = freeSpot(c, true);
    if (i >= 0 && !busy(i)) { makePlan(c, i, T_FARM); return; }
  }
  if (hall !== undefined && c.level >= 1 && bldType(world.bld[hall]) === T_HALL && !busy(hall) && afford(c, T_CASTLE)) { makePlan(c, hall, T_CASTLE); return; }
  if (c.pop >= c.cap - 2) {
    if (c.level >= 2) {
      const h = c.cells.find(i => world.bld[i] && bldType(world.bld[i]) === T_HOUSE && !busy(i));
      if (h !== undefined && afford(c, T_TOWER) && (c.level >= 3 || rnd() < 0.3)) { makePlan(c, h, T_TOWER); return; }
    }
    if (c.level >= 1) {
      const h = c.cells.find(i => world.bld[i] && bldType(world.bld[i]) === T_HUT && !busy(i));
      if (h !== undefined && afford(c, T_HOUSE)) { makePlan(c, h, T_HOUSE); return; }
    }
    if (afford(c, T_HUT)) {
      const i = freeSpot(c, false);
      if (i >= 0 && !busy(i)) makePlan(c, i, T_HUT);
    }
  }
}

/** Перевіряє будівлі: згорілі/залиті/зруйновані прибираються зі списку міста. */
function checkBuildings(c: City): void {
  let w = 0, lost = 0;
  for (const i of c.cells) {
    const cv = world.cover[i];
    const alive = world.bld[i] && world.owner[i] === c.id + 1 && world.hgt[i] >= SEA && (cv === C_NONE || cv === C_FIRE);
    if (alive) { c.cells[w++] = i; continue; }
    if (world.bld[i] && world.owner[i] === c.id + 1) { world.bld[i] = 0; lost++; }
  }
  c.cells.length = w;
  if (lost) markDirty();
}

// ---------------------------------------------------------------- жителі міста
function membersOf(c: City): Unit[] {
  return units.filter(u => !u.dead && u.city === c);
}

/** Розподіл професій під потреби міста. */
function assignJobs(c: City, mem: Unit[]): void {
  const r = RACES[c.race];
  const workers = mem.filter(u => u.job !== 'king' && u.task !== 'settle');
  const n = workers.length;
  if (!n) return;
  const war = isWarring(c.kingdom);
  const want: Record<Job, number> = { farmer: 0, woodcutter: 0, miner: 0, hunter: 0, builder: 0, warrior: 0, king: 0 };
  want.warrior = n >= 6 ? Math.round(n * (war ? 0.28 + r.aggr * 0.2 : 0.06 + r.aggr * 0.08)) : 0;
  want.builder = n >= 3 ? Math.max(1, Math.min(c.plans.length, 1 + Math.floor(n / 12))) : 0;
  want.hunter = Math.round(n * (c.race === 3 ? 0.14 : 0.07));
  want.miner = c.level >= 1 || c.race === 2 ? Math.round(n * (c.race === 2 ? 0.2 : 0.1)) : 0;
  const foodNeed = c.food < c.pop * 5 ? 0.3 : 0.18;
  want.farmer = Math.max(1, Math.round(n * foodNeed));
  want.woodcutter = Math.max(1, n - want.warrior - want.builder - want.hunter - want.miner - want.farmer);
  const have: Record<Job, number> = { farmer: 0, woodcutter: 0, miner: 0, hunter: 0, builder: 0, warrior: 0, king: 0 };
  for (const u of workers) have[u.job]++;
  const short = (Object.keys(want) as Job[]).filter(j => have[j] < want[j]);
  if (!short.length) return;
  for (const u of workers) {
    if (have[u.job] <= want[u.job]) continue;
    if (u.task !== 'idle' && u.task !== 'patrol' && !(u.job === 'warrior' && !war)) continue;
    const j = short.find(s => have[s] < want[s]);
    if (!j) break;
    have[u.job]--; have[j]++;
    u.job = j; u.task = 'idle'; u.timer = 0;
  }
}

function succession(k: Kingdom): void {
  if (k.king && !k.king.dead) return;
  const cap = k.capital;
  if (!cap) return;
  const cands = units.filter(u => !u.dead && u.city.kingdom === k && u.task !== 'settle');
  if (!cands.length) { k.king = null; return; }
  cands.sort((a, b) => (b.city === cap ? 1 : 0) - (a.city === cap ? 1 : 0) || b.age - a.age);
  const heir = cands[0];
  const old = k.king;
  heir.job = 'king'; heir.task = 'idle';
  if (old && heir.name === old.name) heir.name += ' II';
  if (heir.city !== cap) heir.city = cap;
  k.king = heir;
  if (old) logEvent('👑', `${k.name}: помер король ${old.name}. Новий король — ${heir.name}`, k.color);
}

// ---------------------------------------------------------------- тік міста
function cityTick(c: City, slow: boolean): void {
  const r = RACES[c.race];
  checkBuildings(c);
  const mem = membersOf(c);
  c.pop = mem.length;
  c.cap = 0;
  for (const i of c.cells) c.cap += CAPACITY[bldType(world.bld[i])];
  let lvl = 0;
  for (let l = 3; l > 0; l--) if (c.pop >= LEVEL_POP[l]) { lvl = l; break; }
  if (lvl > c.best) {
    c.best = lvl;
    logEvent(lvl === 3 ? '🏙' : '🏘', `${c.name} тепер ${LEVEL_NAMES[lvl].toLowerCase()} (${c.kingdom.name})`, c.kingdom.color);
  }
  c.level = lvl;
  const newR = Math.min(24, 4 + Math.sqrt(c.cells.length) * 1.25 + c.level * 1.2);
  if (newR > c.radius + 0.4 || slow) { c.radius = Math.max(c.radius, newR); claimTerritory(c); }

  // їжа: жителі їдять; голод убиває найслабших
  c.food -= c.pop * 0.045;
  if (c.food < 0) {
    c.food = 0;
    if (mem.length && rnd() < 0.08) { const u = mem[(rnd() * mem.length) | 0]; if (u.job !== 'king') killUnit(u, 'starve'); }
  }
  // народжуваність
  if (c.pop > 0 && c.pop < c.cap && c.food > c.pop * 1.2 + 3 && rnd() < 0.24 * r.fert) {
    const homes = c.cells.filter(i => bldType(world.bld[i]) !== T_FARM);
    const h = homes[(rnd() * homes.length) | 0];
    if (h !== undefined && spawnUnit(c, 'farmer', h % world.W + 0.5, ((h / world.W) | 0) + 0.8, false)) c.food -= 3;
  }
  assignJobs(c, mem);
  planBuilding(c);

  // поселенці: велике місто відправляє групу заснувати нове
  const growCapital = c.kingdom.capital === c && c.level < 3 && c.pop >= 20;
  if (slow && c.pop >= 18 && !growCapital && c.food > 20 && !isWarring(c.kingdom) && rnd() < 0.15) {
    const own = cities.filter(o => o.alive && o.kingdom === c.kingdom).length;
    if (own < 2 + c.pop / 25) {
      const spot = settleSpot(c);
      if (spot) {
        const n = sendSettlers(c, spot.x + 0.5, spot.y + 0.5, 4 + ((rnd() * 3) | 0));
        if (n) logEvent('🚶', `Поселенці з ${c.name} вирушили засновувати нове місто`, c.kingdom.color);
      }
    }
  }

  // облога: вороги в центрі без захисників → місто захоплено
  let attackers = 0, defenders = 0, by: Kingdom | null = null;
  forNear(c.cx + 0.5, c.cy + 0.5, 3.5, u => {
    if (u.city.kingdom === c.kingdom) defenders++;
    else if (u.job === 'warrior' && atWar(u.city.kingdom, c.kingdom)) { attackers++; by = u.city.kingdom; }
  });
  if (attackers && !defenders) {
    c.siege += 60;
    if (c.siege >= 360 && by) captureCity(c, by);
  } else c.siege = Math.max(0, c.siege - 30);

  if (c.loyalty < 100) c.loyalty = Math.min(100, c.loyalty + 0.3);
  if (!c.pop && !c.cells.length) abandon(c);
  else if (!c.pop && rnd() < 0.02) abandon(c);
}

function settleSpot(c: City): { x: number; y: number } | null {
  const r = RACES[c.race];
  let best: { x: number; y: number } | null = null, bs = -1e9;
  for (let k = 0; k < 40; k++) {
    const an = rnd() * 6.283, d = 14 + rnd() * 22;
    const x = Math.round(c.cx + Math.cos(an) * d), y = Math.round(c.cy + Math.sin(an) * d);
    const i = tileAt(x, y);
    if (i < 0 || world.owner[i] || !buildable(i, 32000, c.race === 2)) continue;
    if (cityAt(x + 0.5, y + 0.5, 11)) continue;
    let s = r.biomes.includes(world.biome[i]) ? 3 : 0;
    if (r.hills && world.hgt[i] > 0.6) s += 2;
    s -= Math.abs(d - 20) * 0.08 + rnd();
    if (s > bs) { bs = s; best = { x, y }; }
  }
  return best;
}

/** Місто покинуте: будівлі стають руїнами, територія звільняється. */
export function abandon(c: City): void {
  if (!c.alive) return;
  c.alive = false;
  for (const i of c.cells) if (world.bld[i]) { world.bld[i] = 0; world.cover[i] = C_BURNT; world.timer[i] = 400; }
  c.cells.length = 0;
  for (let i = 0; i < world.N; i++) if (world.owner[i] === c.id + 1) world.owner[i] = 0;
  markBordersCity(c);
  markDirty();
  logEvent('🏚', `${c.name} спорожніло й перетворилось на руїни`, '#7a6152');
  const k = c.kingdom;
  if (k.capital === c) k.capital = cities.find(o => o.alive && o.kingdom === k) || null;
}

/** Один тік усіх міст і королівств (раз на ~секунду). */
export function citiesTick(): void {
  const slow = civState.frame % 240 < 60;
  for (const c of cities) if (c.alive) cityTick(c, slow);
  for (const k of kingdoms) {
    if (!k.alive) continue;
    if (!k.capital || !k.capital.alive || k.capital.kingdom !== k) k.capital = pickCapital(k);
    succession(k);
  }
}

export function pickCapital(k: Kingdom): City | null {
  let best: City | null = null;
  for (const c of cities) if (c.alive && c.kingdom === k && (!best || c.pop > best.pop)) best = c;
  return best;
}
