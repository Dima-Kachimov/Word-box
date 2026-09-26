// Жителі: народження, смерть, пересування і "мозок" за завданнями.
// На відміну від тварин (миттєві інстинкти), житель має професію й виконує
// ланцюжок завдань: піти → попрацювати → віднести здобуте в місто. Воїни під
// час війни йдуть на вороже місто, б'ються й палять будинки.

import { rnd } from '../world/noise';
import { world, tileAt } from '../world/state';
import { SUB, SEA, HILL, C_TREE, C_FIRE, C_LAVA, C_NONE, B_JUNGLE, B_SWAMP } from '../world/constants';
import { clock } from '../sim/clock';
import { burst, smokeAt, emberAt } from '../sim/particles';
import { markDirty } from '../render/buffer';
import { animals, kill } from '../creatures/animal';
import type { Animal } from '../creatures/types';
import { RACES, personName } from './races';
import { units, arrows, forNear, civState } from './state';
import type { Unit, City, Job, Task } from './types';
import { T_FARM, bldType, buildable } from './buildings';
import { deliver, completePlan, foundCity, cityAt } from './cities';
import { atWar, noteLoss } from './diplomacy';

/** Скільки жителів може бути у світі (масштабується з розміром світу). */
export function unitCap(): number { return Math.round(900 * Math.min(world.popK, 1.8)); }

export function spawnUnit(city: City, job: Job, x: number, y: number, adult = true): Unit | null {
  if (units.length >= unitCap()) return null;
  const r = RACES[city.race];
  const u: Unit = {
    id: civState.nextUnit++, name: personName(r), race: city.race, city, job,
    x, y, tx: x, ty: y, dir: rnd() < 0.5 ? 1 : -1, t: rnd() * 10, task: 'idle', next: 'idle', timer: (rnd() * 40) | 0,
    carry: null, carryN: 0, cell: -1, foe: null, prey: null,
    hp: r.hp, maxHp: r.hp, age: adult ? 2000 + rnd() * 6000 : 0, life: r.life * (0.7 + rnd() * 0.6),
    cd: 0, stuck: 0, inside: false, kills: 0
  };
  units.push(u);
  return u;
}

export const DEATH_TXT: Record<string, string> = {
  old: 'Помер від старості', war: 'Загинув у бою', burn: 'Згорів', drown: 'Потонув',
  starve: 'Помер з голоду', crush: 'Загинув від стихії', beast: 'Загинув від звіра'
};

export function killUnit(u: Unit, how: string): void {
  if (u.dead) return;
  u.dead = true; u.how = how;
  const bx = u.x * SUB, by = u.y * SUB;
  if (how === 'burn') { smokeAt(bx, by - 2); emberAt(bx, by); }
  else if (how === 'war') burst('debris', bx, by - 1, 6, 0.6, ['#c83a2a', '#e8dcc0'], 16);
  else burst('dust', bx, by - 1, 6, 0.5, ['#c2ad86'], 16);
  if (how === 'war') noteLoss(u.city.kingdom);
}

// ---------------------------------------------------------------- пересування
const STEER = [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, 2.6, -2.6];

function walkable(i: number): boolean {
  return i >= 0 && world.hgt[i] >= SEA - 0.004 && world.cover[i] !== C_LAVA;
}

/** Крок до (tx,ty). Повертає true, коли дійшов. */
function stepTo(u: Unit, tx: number, ty: number, mul = 1, near = 0.35): boolean {
  const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
  if (d < near) return true;
  const sp = Math.min(d, RACES[u.race].speed * mul);
  const base = Math.atan2(dy, dx);
  for (const off of STEER) {
    const an = base + off, vx = Math.cos(an) * sp, vy = Math.sin(an) * sp;
    if (walkable(tileAt(u.x + vx * 6, u.y + vy * 6)) && walkable(tileAt(u.x + vx, u.y + vy))) {
      u.x += vx; u.y += vy;
      if (Math.abs(vx) > 0.002) u.dir = vx > 0 ? 1 : -1;
      u.t += 0.18 * mul;
      if (off !== 0) u.stuck += 0.3; else if (u.stuck > 0) u.stuck -= 0.05;
      // стежки: там, де часто ходять, трава витоптується — з'являються дороги
      if ((civState.frame + u.id) % 9 === 0) {
        const i = tileAt(u.x, u.y);
        if (i >= 0 && world.cover[i] === C_NONE) world.grazed[i] = Math.min(900, world.grazed[i] + 40);
      }
      return false;
    }
  }
  u.stuck += 1;
  return false;
}

function goTo(u: Unit, x: number, y: number, next: Task): void {
  u.tx = x; u.ty = y; u.task = 'walk'; u.next = next; u.stuck = 0;
}

/** Найближча клітинка з умовою — спіраль від (x,y) до радіуса R. */
export function findCell(x: number, y: number, R: number, pred: (i: number) => boolean): number {
  const cx = Math.floor(x), cy = Math.floor(y), a0 = rnd() * 6.283;
  if (pred(tileAt(cx, cy))) return tileAt(cx, cy);
  for (let r = 1; r <= R; r++) {
    const n = Math.ceil(6.283 * r);
    for (let k = 0; k < n; k++) {
      const an = a0 + k / n * 6.283;
      const i = tileAt(cx + Math.round(Math.cos(an) * r), cy + Math.round(Math.sin(an) * r));
      if (i >= 0 && pred(i)) return i;
    }
  }
  return -1;
}

const cellX = (i: number) => i % world.W + 0.5;
const cellY = (i: number) => ((i / world.W) | 0) + 0.5;

function inTerritory(c: City, i: number, extra: number): boolean {
  const dx = cellX(i) - c.cx, dy = cellY(i) - c.cy;
  return dx * dx + dy * dy <= (c.radius + extra) ** 2;
}

/** Випадкова точка біля центру міста (для прогулянок і патруля). */
function nearCenter(c: City, r: number): [number, number] {
  const an = rnd() * 6.283, d = Math.sqrt(rnd()) * r;
  return [c.cx + 0.5 + Math.cos(an) * d, c.cy + 0.5 + Math.sin(an) * d];
}

// ---------------------------------------------------------------- рішення за професією
function decide(u: Unit): void {
  const c = u.city;
  u.cell = -1; u.foe = null; u.prey = null;
  switch (u.job) {
    case 'farmer': {
      const farms = c.cells.filter(i => world.bld[i] && bldType(world.bld[i]) === T_FARM);
      if (farms.length) { const i = farms[(rnd() * farms.length) | 0]; u.cell = i; goTo(u, cellX(i), cellY(i), 'work'); u.timer = 110; return; }
      break;
    }
    case 'woodcutter': {
      const i = findCell(u.x, u.y, 12, j => world.cover[j] === C_TREE && !world.bld[j] && inTerritory(c, j, 8));
      if (i >= 0) { u.cell = i; goTo(u, cellX(i), cellY(i) + 0.35, 'work'); u.timer = 90; return; }
      break;
    }
    case 'miner': {
      const i = findCell(c.cx, c.cy, Math.min(22, c.radius + 10), j => world.hgt[j] >= HILL && world.hgt[j] < 0.95 && !world.bld[j]);
      if (i >= 0) { u.cell = i; goTo(u, cellX(i), cellY(i), 'work'); u.timer = 120; return; }
      u.job = 'woodcutter';
      break;
    }
    case 'hunter': {
      let best: Animal | null = null, bd = (c.radius + 10) ** 2;
      for (const a of animals) {
        if (a.dead || a.S.kind !== 'land' || a.S.eats || a.S.brave) continue;
        const d = (a.x - c.cx) ** 2 + (a.y - c.cy) ** 2;
        if (d < bd) { bd = d; best = a; }
      }
      if (best) { u.prey = best; u.task = 'hunt'; u.timer = 900; return; }
      u.job = 'farmer';
      break;
    }
    case 'builder': {
      const p = c.plans.find(q => !q.by || q.by.dead || q.by.city !== c || q.by.cell !== q.cell || q.by === u);
      if (p) { p.by = u; u.cell = p.cell; goTo(u, cellX(p.cell), cellY(p.cell) + 0.4, 'build'); u.timer = 100; return; }
      break;
    }
    case 'warrior': {
      const tg = c.target;
      if (tg && tg.alive && atWar(c.kingdom, tg.kingdom)) {
        const [x, y] = nearCenter(tg, Math.min(3, tg.radius));
        goTo(u, x, y, 'raid'); u.task = 'march'; return;
      }
      const [x, y] = nearCenter(c, c.radius * 0.9);
      goTo(u, x, y, 'patrol'); u.timer = 60 + rnd() * 120; return;
    }
    case 'king': {
      const [x, y] = nearCenter(c, 2.5);
      goTo(u, x, y, 'patrol'); u.timer = 120 + rnd() * 200; return;
    }
  }
  // нема роботи — прогулянка містом
  const [x, y] = nearCenter(c, Math.max(2, c.radius * 0.6));
  goTo(u, x, y, 'patrol'); u.timer = 40 + rnd() * 100;
}


// ---------------------------------------------------------------- бій
function isFoe(u: Unit, o: Unit): boolean {
  return !o.dead && o.city.kingdom !== u.city.kingdom && atWar(u.city.kingdom, o.city.kingdom);
}

function nearestFoe(u: Unit, r: number): Unit | null {
  let best: Unit | null = null, bd = r * r;
  forNear(u.x, u.y, r, o => {
    if (!isFoe(u, o)) return;
    const d = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  });
  return best;
}

function strike(u: Unit, foe: Unit): void {
  const r = RACES[u.race];
  const mul = u.job === 'warrior' ? 1.4 : u.job === 'king' ? 1.2 : 0.55;
  foe.hp -= r.atk * mul * (0.6 + rnd() * 0.8);
  u.cd = 40 + ((rnd() * 20) | 0);
  if (r.range > 1.5) arrows.push({ x0: u.x, y0: u.y - 0.4, x1: foe.x, y1: foe.y - 0.3, t: 0 });
  else burst('spark', foe.x * SUB, foe.y * SUB - 2, 3, 0.5, ['#ffffff', '#ffe45c'], 8);
  if (foe.hp <= 0) { killUnit(foe, 'war'); u.kills++; }
}

/** Бій із foe: підійти на дальність атаки й бити. Повертає false, коли бій скінчився. */
function fight(u: Unit, foe: Unit): boolean {
  if (foe.dead || foe.inside) return false;
  const range = RACES[u.race].range, d = Math.hypot(foe.x - u.x, foe.y - u.y);
  if (d > 9) return false;
  if (d > range) stepTo(u, foe.x, foe.y, 1.1, range * 0.9);
  else if (u.cd <= 0) strike(u, foe);
  if (foe.x !== u.x) u.dir = foe.x > u.x ? 1 : -1;
  return true;
}

// ---------------------------------------------------------------- щокадрове оновлення жителя
function update(u: Unit): void {
  const c = u.city, r = RACES[u.race];
  u.age++;
  if (u.cd > 0) u.cd--;
  if (u.age > u.life) { killUnit(u, 'old'); return; }
  if (!c.alive) { const nc = cityAt(u.x, u.y, 30); if (nc && nc.kingdom === c.kingdom) u.city = nc; else { killUnit(u, 'starve'); return; } }

  // небезпеки клітинки: вогонь, лава, вода
  const i = tileAt(u.x, u.y);
  if (i >= 0 && !u.inside) {
    const cv = world.cover[i];
    if (cv === C_LAVA) { killUnit(u, 'burn'); return; }
    if (cv === C_FIRE) { u.hp -= 0.06; if (u.hp <= 0) { killUnit(u, 'burn'); return; } }
    if (world.hgt[i] < SEA - 0.015) { u.hp -= 0.05; if (u.hp <= 0) { killUnit(u, 'drown'); return; } }
    else if (u.hp < u.maxHp && (civState.frame & 31) === 0) u.hp = Math.min(u.maxHp, u.hp + 0.4);
  }

  // ніч: мирні жителі ховаються по хатах (і світяться вікна)
  const night = clock.dark > 0.5, danger = c.kingdom && warNear(u);
  if (u.inside) {
    if (!night || danger) { u.inside = false; u.task = 'idle'; }
    return;
  }
  if (night && u.job !== 'warrior' && !danger && u.task !== 'home' && u.task !== 'settle' && u.task !== 'fight') {
    const homes = c.cells.filter(j => world.bld[j] && bldType(world.bld[j]) !== T_FARM);
    const h = homes.length ? homes[(rnd() * homes.length) | 0] : tileAt(c.cx, c.cy);
    u.tx = cellX(h); u.ty = cellY(h) + 0.3; u.task = 'home';
  }

  // самозахист: ворог поруч
  if (u.task !== 'fight' && u.task !== 'settle' && (civState.frame + u.id) % 12 === 0) {
    const foe = nearestFoe(u, u.job === 'warrior' ? 6 : 3.5);
    if (foe) {
      const brave = u.job === 'warrior' || u.job === 'king' || rnd() < r.aggr * 0.6;
      if (brave) { u.foe = foe; u.task = 'fight'; }
      else { u.task = 'flee'; u.tx = c.cx + 0.5; u.ty = c.cy + 0.5; u.timer = 90; }
    }
  }

  switch (u.task) {
    case 'idle':
      if (--u.timer <= 0) decide(u);
      break;
    case 'patrol':
      if (--u.timer <= 0) { u.task = 'idle'; u.timer = 0; }
      break;
    case 'walk':
    case 'march':
      if (stepTo(u, u.tx, u.ty, u.task === 'march' ? 1.15 : 1)) { u.task = u.next; if (u.task === 'patrol' && u.timer <= 0) u.timer = 60; }
      else if (u.stuck > 60) { u.task = 'idle'; u.timer = 30; if (u.job === 'warrior' && c.target) c.target = null; }
      break;
    case 'home':
      if (stepTo(u, u.tx, u.ty)) u.inside = true;
      else if (u.stuck > 40) u.inside = true;
      break;
    case 'flee':
      stepTo(u, u.tx, u.ty, 1.2);
      if (--u.timer <= 0) u.task = 'idle';
      break;
    case 'fight':
      if (!u.foe || !fight(u, u.foe)) { u.foe = null; u.task = 'idle'; u.timer = 10; }
      break;
    case 'work': {
      if (--u.timer > 0) { u.t += 0.05; break; }
      const j = u.cell;
      if (u.job === 'farmer') {
        const bonus = world.wet[j] > 0 ? 1.4 : 1;
        const b = world.biome[j];
        c.food += 3 * bonus * (b === B_JUNGLE || b === B_SWAMP ? 1.2 : 1);
        u.task = 'idle'; u.timer = 10;
      } else if (u.job === 'woodcutter') {
        if (world.cover[j] === C_TREE) {
          world.cover[j] = C_NONE; markDirty();
          burst('debris', cellX(j) * SUB, cellY(j) * SUB - 3, 6, 0.6, ['#3e9a3e', '#7cd35a', '#7a4e2a'], 18);
          // ельфи садять ліс замість зрубаного
          if (u.race === 1) { const k = findCell(cellX(j), cellY(j), 4, q => world.cover[q] === C_NONE && !world.bld[q] && world.hgt[q] >= SEA + 0.02 && world.hgt[q] < HILL); if (k >= 0) world.cover[k] = C_TREE; }
          u.carry = 'wood'; u.carryN = 2;
          u.tx = c.cx + 0.5; u.ty = c.cy + 0.9; u.task = 'carry';
        } else { u.task = 'idle'; u.timer = 5; }
      } else if (u.job === 'miner') {
        u.carry = 'stone'; u.carryN = u.race === 2 ? 3 : 2;
        u.tx = c.cx + 0.5; u.ty = c.cy + 0.9; u.task = 'carry';
      } else { u.task = 'idle'; }
      break;
    }
    case 'carry':
      if (stepTo(u, u.tx, u.ty, 0.9, 0.8)) { deliver(c, u.carry!, u.carryN); u.carry = null; u.carryN = 0; u.task = 'idle'; u.timer = 8; }
      else if (u.stuck > 80) { deliver(c, u.carry!, u.carryN); u.carry = null; u.task = 'idle'; }
      break;
    case 'hunt': {
      const a = u.prey as Animal | null;
      if (!a || a.dead || --u.timer <= 0) { u.task = 'idle'; u.timer = 20; break; }
      if (stepTo(u, a.x, a.y, 1.25, 0.7)) {
        kill(a, 'eaten');
        u.carry = 'food'; u.carryN = a.S.w > 12 ? 8 : 4;
        u.tx = c.cx + 0.5; u.ty = c.cy + 0.9; u.task = 'carry';
      }
      break;
    }
    case 'build':
      const plan = c.plans.find(q => q.cell === u.cell);
      if (!plan) { u.task = 'idle'; break; }
      if (--u.timer > 0) {
        u.t += 0.12;
        if (u.timer % 25 === 0) burst('dust', cellX(u.cell) * SUB, cellY(u.cell) * SUB - 1, 3, 0.4, ['#d8c8a0'], 12);
        break;
      }
      completePlan(c, plan);
      u.task = 'idle'; u.timer = 10;
      break;
    case 'raid': {
      // у ворожому місті: бій з будь-ким поруч, інакше підпал будинків
      const tg = c.target;
      if (!tg || !tg.alive || !atWar(c.kingdom, tg.kingdom)) { u.task = 'idle'; break; }
      const foe = nearestFoe(u, 7);
      if (foe) { u.foe = foe; u.task = 'fight'; break; }
      if (--u.timer <= 0) {
        u.timer = 50 + rnd() * 60;
        const j = findCell(u.x, u.y, 3, q => !!world.bld[q] && world.owner[q] === tg.id + 1);
        if (j >= 0 && rnd() < 0.3) { world.cover[j] = C_FIRE; world.timer[j] = 30; markDirty(); }
        const [x, y] = nearCenter(tg, 2);
        goTo(u, x, y, 'raid'); u.task = 'march';
      }
      break;
    }
    case 'settle': {
      const s = u.settle!;
      if (stepTo(u, s.x, s.y, 1, 0.6) || u.stuck > 150) settleArrive(u);
      break;
    }
  }
}

function warNear(u: Unit): boolean {
  return (civState.frame + u.id) % 20 === 0 && !!nearestFoe(u, 6);
}

/** Поселенець дійшов (або застряг) — засновує місто або приєднується до вже заснованого. */
function settleArrive(u: Unit): void {
  const s = u.settle!;
  u.settle = undefined; u.task = 'idle';
  const here = tileAt(s.x, s.y);
  const existing = here >= 0 && world.owner[here] ? cityAt(s.x, s.y, 3) : null;
  if (existing && existing.kingdom === u.city.kingdom) { u.city = existing; return; }
  const spot = tileAt(u.x, u.y);
  if (spot >= 0 && buildable(spot, 32000, u.race === 2) && !cityAt(u.x, u.y, 10)) {
    const nc = foundCity(u.city.kingdom, spot % world.W, (spot / world.W) | 0, u.race);
    if (nc) {
      u.city = nc;
      // інші поселенці з тією ж ціллю тепер ідуть сюди
      for (const o of units) if (o !== u && o.task === 'settle' && o.settle && o.settle.x === s.x && o.settle.y === s.y) { o.settle = { x: nc.cx + 0.5, y: nc.cy + 0.5 }; o.city = nc; }
    }
  }
}

/** Відправляє групу жителів заснувати нове місто. */
export function sendSettlers(from: City, x: number, y: number, n: number): number {
  let sent = 0;
  for (const u of units) {
    if (sent >= n) break;
    if (u.dead || u.city !== from || u.job === 'king' || u.task === 'settle' || u.inside) continue;
    if (u.job === 'builder' && sent === 0) continue;
    u.task = 'settle'; u.settle = { x, y }; u.stuck = 0; u.carry = null;
    if (sent === 0) u.job = 'builder';
    sent++;
  }
  return sent;
}

/** Оновлює всіх жителів (щокадру) і прибирає загиблих. */
export function updateUnits(): void {
  for (const u of units) if (!u.dead) update(u);
  for (let k = arrows.length - 1; k >= 0; k--) { arrows[k].t += 0.12; if (arrows[k].t >= 1) arrows.splice(k, 1); }
  let w = 0;
  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    if (u.dead) { if (civState.selUnit === u && (civState.frame % 240) === 0) civState.selUnit = null; if (civState.selUnit !== u) continue; }
    units[w++] = u;
  }
  units.length = w;
}

/** Шкода жителям у радіусі (метеорит, блискавка, смерч). */
export function hurtUnitsAt(x: number, y: number, r: number, how: string): void {
  for (const u of units) {
    if (u.dead) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d < r) killUnit(u, how);
  }
}

export { isFoe };
