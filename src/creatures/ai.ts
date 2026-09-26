// "Мозок" істот: керування, стани (wander/eat/flee/stalk/chase/mate/...),
// хижацтво, розмноження, польоти. Найбільший і найважливіший для "відчуття
// живого світу" файл — перенесений з оригіналу максимально дослівно.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import {
  SUB, K, SEA, DEEP, GRASS, B_TEMP, B_SAVANNA, B_JUNGLE, B_SWAMP,
  C_FIRE, C_LAVA, C_ICE, C_TREE, C_NONE
} from '../world/constants';
import { isVeg } from '../world/generate';
import { clock } from '../sim/clock';
import { addP, burst } from '../sim/particles';
import { SFX } from '../audio/sfx';
import { cool } from '../util/cooldown';
import { visibleTile } from '../render/camera';
import type { Animal, Goal } from './types';
import { animals, predators, creatureState, spawnFlockEdge, spawnAnimal, randomTile, kill } from './animal';
import { canBe, passable, nearWater, foodAt, foodAround, findNear, tileAt } from './habitat';
import { tornados } from '../sim/events';
import { SPECIES, F_GRASS, F_BROWSE, F_FISH } from './species';

const STEER = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3];

export function steer(a: Animal, dx: number, dy: number, speed: number): void {
  if (Math.abs(dx) + Math.abs(dy) < 1e-6) { a.vx = a.vy = 0; return; }
  const base = Math.atan2(dy, dx);
  for (const off of STEER) {
    const an = base + off, vx = Math.cos(an) * speed, vy = Math.sin(an) * speed;
    if (passable(a.S, tileAt(a.x + vx * 8, a.y + vy * 8)) && passable(a.S, tileAt(a.x + vx, a.y + vy))) { a.vx = vx; a.vy = vy; return; }
  }
  a.vx = a.vy = 0; a.stuck++;
}

export function findPrey(a: Animal, range: number): Animal | null {
  let best: Animal | null = null, bs = 1e9;
  for (const b of animals) {
    if (b.dead || b.state === 'tossed' || !a.S.eats!.includes(b.S.key)) continue;
    if (b.S.brave && b.baby <= 0) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d > range) continue;
    const score = d - (b.baby > 0 ? 3 : 0) - (b.state === 'sleep' ? 2 : 0);
    if (score < bs) { bs = score; best = b; }
  }
  return best;
}

export function findMate(a: Animal): Animal | null {
  let cnt = 0, best: Animal | null = null, bd = 400;
  for (const b of animals) {
    if (b.S !== a.S || b.dead) continue;
    cnt++;
    if (b === a || b.baby > 0 || b.age < a.S.adult || (b.mateCd || 0) > 0 || b.state === 'mate' || b.state === 'flee' || b.hunger > 0.55) continue;
    const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  return cnt < a.S.cap * world.popK ? best : null;
}

export function breed(a: Animal, p: Animal): void {
  a.mateCd = p.mateCd = 2600 + rnd() * 1400;
  a.hunger += 0.15; p.hunger += 0.15;
  a.emo = p.emo = 'heart'; a.emoT = p.emoT = 120;
  const n = a.S.litter || 1;
  for (let q = 0; q < n; q++) {
    const b = spawnAnimal(a.S.key, a.x + (rnd() - 0.5) * 0.6, a.y + (rnd() - 0.5) * 0.6, {
      baby: a.S.adult, mom: a, lead: a.lead || a, age: 0, hunger: 0.1, thirst: 0.1, emo: 'heart', emoT: 120
    });
    if (b) b.life = 32000 + rnd() * 50000;
  }
  if (visibleTile(a.x, a.y) && cool('breed', 400)) SFX.pop();
}

export function catchPrey(a: Animal, tg: Animal): void {
  kill(tg, 'eaten');
  a.hunger = 0; a.target = null;
  if (a.S.kind === 'sea') { a.state = 'wander'; a.timer = 0; return; }
  a.state = 'feast'; a.timer = 160; a.vx = a.vy = 0;
  if (a.S.pack) for (const b of predators) {
    if (b !== a && b.S === a.S && !b.dead && Math.hypot(b.x - a.x, b.y - a.y) < 6 && (b.state === 'chase' || b.state === 'stalk')) {
      b.state = 'feast'; b.timer = 140; b.target = null; b.vx = b.vy = 0; b.hunger = Math.max(0, b.hunger - 0.6);
    }
  }
  if (visibleTile(a.x, a.y) && a.S.voice && cool('catch', 900)) (SFX[a.S.voice] as (v: number) => void)(0.9);
}

export function startFlee(a: Animal, fx: number, fy: number): void {
  const l = Math.hypot(fx, fy) || 1;
  a.state = 'flee'; a.fleeT = 90 + ((rnd() * 40) | 0); a.fx = fx / l; a.fy = fy / l; a.partner = null;
}

export function perceive(a: Animal): void {
  const S = a.S;
  if (a.state === 'flee' || a.state === 'tossed') return;
  let fx = 0, fy = 0, threat = false;
  if (S.kind !== 'sea') for (let k = 0; k < 8; k++) {
    const an = k * Math.PI / 4, cx = Math.cos(an), cy = Math.sin(an), j = tileAt(a.x + cx * 2.5, a.y + cy * 2.5);
    if (j >= 0 && (world.cover[j] === C_FIRE || world.cover[j] === C_LAVA)) { fx -= cx; fy -= cy; threat = true; }
  }
  if (S.preyOf && !(S.brave && a.baby <= 0)) {
    for (const p of predators) {
      if (p.dead || !S.preyOf.has(p.S.key)) continue;
      const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 0.1;
      let r = (p.state === 'chase' || p.state === 'dive') ? S.vision : p.state === 'stalk' ? 2.5 : 3.5;
      if (p.state === 'feast' || p.state === 'rest' || p.state === 'sleep' || p.state === 'lurk') r = 1.6;
      if (a.state === 'sleep') r = Math.min(r, 2.5);
      if (d < r) { fx += dx / d * (r - d + 1); fy += dy / d * (r - d + 1); threat = true; }
    }
  }
  if (threat) {
    startFlee(a, fx, fy);
    if (S.herd || S.school) for (const b of animals) {
      if (b !== a && b.S === S && !b.dead && b.state !== 'flee' && b.state !== 'tossed' && Math.abs(b.x - a.x) < 5 && Math.abs(b.y - a.y) < 5) startFlee(b, fx, fy);
    }
  }
}

export function wanderMove(a: Animal): void {
  const S = a.S;
  if (a.lead && a.lead.dead) a.lead = a.lead.lead && !a.lead.lead.dead ? a.lead.lead : null;
  if (--a.timer <= 0) {
    a.timer = 60 + ((rnd() * 150) | 0);
    const L = a.lead;
    if (L && Math.hypot(L.x - a.x, L.y - a.y) > 3) { a.wa = Math.atan2(L.y - a.y, L.x - a.x); a.idle = false; }
    else { a.idle = rnd() < (S.kind === 'sea' ? 0.1 : 0.4); a.wa = rnd() * Math.PI * 2; }
  }
  if (a.idle) { a.vx = a.vy = 0; return; }
  steer(a, Math.cos(a.wa), Math.sin(a.wa), S.speed);
  if (!a.vx && !a.vy) a.timer = 0;
}

export function brain(a: Animal): void {
  const S = a.S, night = clock.dark > 0.35, i = tileAt(a.x, a.y);
  if (S.thirsty && a.thirst > 0.95 && a.state !== 'drink' && a.state !== 'toWater' && a.state !== 'flee' && a.state !== 'feast') { a.state = 'wander'; a.think = 0; a.target = null; a.partner = null; }
  if (a.hunger > 1.0 && (a.state === 'rest' || a.state === 'sleep' || a.state === 'mate')) { a.state = 'wander'; a.think = 0; a.partner = null; }
  switch (a.state) {
    case 'flee': {
      if (--a.fleeT! <= 0) { a.state = 'wander'; a.timer = 0; break; }
      const sp = a.stam > 0 ? S.run : S.speed * 1.3;
      if (a.stam > 0) a.stam--;
      steer(a, a.fx!, a.fy!, sp);
      return;
    }
    case 'eat': {
      a.vx = a.vy = 0; a.hunger = Math.max(0, a.hunger - 0.008);
      if (creatureState.fc % 14 === 0) addP('debris', a.x * SUB + a.dir * S.w * 0.4, a.y * SUB - 1, (rnd() - 0.5) * 0.4, -0.3 - rnd() * 0.3, 16, { c: S.food === F_FISH ? '#9fd4ff' : '#7ac05a', drag: 0.94 });
      if (--a.timer <= 0 || a.hunger <= 0.02) {
        if (i >= 0 && (S.food === F_GRASS || S.food === F_BROWSE)) {
          if (S.key === 'elephant' && world.cover[i] === C_TREE && rnd() < 0.3) world.cover[i] = C_NONE;
          world.grazed[i] = 260;
        }
        a.state = 'wander'; a.timer = 0;
      }
      return;
    }
    case 'drink': {
      a.vx = a.vy = 0; a.thirst = Math.max(0, a.thirst - 0.015);
      if (creatureState.fc % 20 === 0) addP('splash', a.x * SUB + a.dir * S.w * 0.5, a.y * SUB, 0, 0, 8);
      if (--a.timer <= 0) { a.state = 'wander'; a.timer = 0; }
      return;
    }
    case 'feast': {
      a.vx = a.vy = 0;
      if (creatureState.fc % 16 === 0) addP('debris', a.x * SUB + a.dir * S.w * 0.4, a.y * SUB - 1, (rnd() - 0.5) * 0.5, -0.3, 14, { c: '#9a3a2a', drag: 0.93 });
      if (--a.timer <= 0) { a.state = 'rest'; a.timer = 240; }
      return;
    }
    case 'rest': {
      a.vx = a.vy = 0;
      if (--a.timer > 0 && a.hunger < 0.8 && a.thirst < 0.8) return;
      a.state = 'wander'; a.timer = 0; break;
    }
    case 'sleep': {
      a.vx = a.vy = 0;
      if (night && a.hunger < 0.85 && a.thirst < 0.85) return;
      a.state = 'wander'; a.timer = 0; break;
    }
    case 'mate': {
      const p = a.partner;
      if (!p || p.dead || p.state === 'flee' || p.partner !== a) { a.state = 'wander'; a.partner = null; break; }
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
      if (d < 1.1) { breed(a, p); a.state = p.state = 'wander'; a.timer = p.timer = 0; a.partner = p.partner = null; break; }
      steer(a, dx, dy, S.speed);
      if (a.stuck > 90) { a.state = 'wander'; a.stuck = 0; a.partner = null; }
      return;
    }
    case 'stalk': case 'chase': {
      const tg = a.target;
      if (!tg || tg.dead || tg.state === 'tossed') { a.target = null; a.state = 'wander'; a.timer = 0; break; }
      const dx = tg.x - a.x, dy = tg.y - a.y, d = Math.hypot(dx, dy);
      if (d > S.vision * 2.5) { a.target = null; a.state = 'wander'; break; }
      if (a.state === 'stalk') {
        if (d < S.pounce!) a.state = 'chase';
        else { steer(a, dx, dy, S.speed * 1.3); return; }
      }
      if (d < 0.8) { catchPrey(a, tg); return; }
      if (a.stam <= 0) { a.target = null; a.state = 'rest'; a.timer = 220; return; }
      a.stam--;
      steer(a, dx + tg.vx * 10, dy + tg.vy * 10, S.run);
      return;
    }
    case 'lurk': {
      a.vx = a.vy = 0;
      if (a.hunger < 0.3 || a.hunger > 0.9) { a.state = 'wander'; break; }
      if ((creatureState.fc + a.id) % 10 === 0) { const tg = findPrey(a, S.pounce!); if (tg) { a.target = tg; a.state = 'chase'; a.stam = S.stam; } }
      return;
    }
    case 'follow': {
      const m = a.mom;
      if (!m || m.dead || a.baby <= 0) { a.state = 'wander'; a.mom = null; break; }
      if (m.state === 'flee') { a.state = 'flee'; a.fleeT = m.fleeT; a.fx = m.fx; a.fy = m.fy; return; }
      const gx = m.x - m.dir * 1.2, gy = m.y + 0.3, dx = gx - a.x, dy = gy - a.y, d = Math.hypot(dx, dy);
      if ((m.state === 'sleep' || m.state === 'rest') && d < 1.5) { a.state = 'sleep'; return; }
      if (d < 0.6) { a.vx = a.vy = 0; } else steer(a, dx, dy, d > 3 ? S.run : S.speed * 1.1);
      a.hunger = Math.min(a.hunger, 0.3); a.thirst = Math.min(a.thirst, 0.3);
      if (--a.think > 0) return;
      a.think = 40; break;
    }
    case 'toFood': case 'toWater': {
      const g = a.goal as Goal, dx = g.x - a.x, dy = g.y - a.y, d = Math.hypot(dx, dy);
      if (a.state === 'toWater' && nearWater(i)) {
        if (S.lurker) { a.state = 'lurk'; return; }
        a.state = 'drink'; a.timer = 80; return;
      }
      if (a.state === 'toFood' && d < 0.7) { if (foodAt(S, i)) { a.state = 'eat'; a.timer = 90; } else { a.state = 'wander'; a.timer = 0; } return; }
      if (a.stuck > 80) { a.stuck = 0; a.state = 'wander'; a.timer = 0; a.waterMem = null; break; }
      steer(a, dx, dy, S.speed * 1.15);
      if (--a.think > 0) return;
      a.think = 40; break;
    }
  }
  if (a.state === 'wander' && --a.think > 0) { wanderMove(a); return; }
  a.think = 25 + ((rnd() * 20) | 0);
  if (S.diurnal && night && a.hunger < 0.85 && a.thirst < 0.85) { a.state = 'sleep'; a.vx = a.vy = 0; return; }
  if (S.nocturnal && !night && a.hunger < 0.55 && a.thirst < 0.6 && rnd() < 0.35) { a.state = 'rest'; a.timer = 360; a.vx = a.vy = 0; return; }
  if (a.baby > 0 && a.mom && !a.mom.dead) { a.state = 'follow'; return; }
  if (S.thirsty && a.thirst > 0.6) {
    if (nearWater(i)) { a.state = 'drink'; a.timer = 80; return; }
    const w = (a.waterMem && rnd() < 0.7) ? a.waterMem : findNear(a, j => world.hgt[j] < SEA && world.cover[j] !== C_ICE, 24);
    if (w) { a.state = 'toWater'; a.goal = { x: w.x, y: w.y }; a.waterMem = w; a.stuck = 0; return; }
    a.thirst = Math.max(0, a.thirst - 0.25);
  }
  if (S.eats && a.hunger > 0.45) {
    if (S.lurker && a.hunger < 0.85) {
      if (nearWater(i) || world.hgt[i] < SEA) { a.state = 'lurk'; return; }
      const w = findNear(a, j => world.hgt[j] < SEA && world.hgt[j] > DEEP + 0.04, 15);
      if (w) { a.state = 'toWater'; a.goal = w; a.stuck = 0; return; }
    } else {
      let tg: Animal | null = null;
      if (S.pack) for (const b of predators) if (b !== a && b.S === S && b.target && !b.target.dead && Math.hypot(b.x - a.x, b.y - a.y) < 8) { tg = b.target; break; }
      if (!tg) tg = findPrey(a, S.vision);
      if (!tg) {
        const far = findPrey(a, 45);
        if (far) { a.state = 'toFood'; a.prowl = true; a.goal = { x: far.x, y: far.y }; a.stuck = 0; return; }
      }
      if (tg) {
        a.target = tg; a.state = 'stalk'; a.stam = Math.max(a.stam, S.stam * 0.6);
        if (S.pack) for (const b of predators) if (b !== a && b.S === S && !b.target && (b.state === 'wander' || b.state === 'rest') && Math.hypot(b.x - a.x, b.y - a.y) < 8) { b.target = tg; b.state = 'stalk'; }
        return;
      }
    }
  }
  if (S.food && a.hunger > 0.45) {
    if (foodAt(S, i)) { a.state = 'eat'; a.timer = 90; a.vx = a.vy = 0; return; }
    const f = findNear(a, j => foodAt(S, j), 20);
    if (f) { a.state = 'toFood'; a.prowl = false; a.goal = f; a.stuck = 0; return; }
  }
  if (a.baby <= 0 && a.age > S.adult && a.mateCd <= 0 && a.hunger < 0.4 && a.thirst < 0.55 && !night && rnd() < 0.5 && (!S.food || S.eats || foodAround(a) >= 5)) {
    const m = findMate(a);
    if (m) { a.state = 'mate'; a.partner = m; m.state = 'mate'; m.partner = a; a.stuck = m.stuck = 0; return; }
  }
  if (!a.lead && S.herd && rnd() < 0.3) {
    for (const b of animals) if (b !== a && b.S === S && !b.dead && b.lead !== a && Math.abs(b.x - a.x) < 6 && Math.abs(b.y - a.y) < 6) { a.lead = b.lead || b; break; }
  }
  a.state = 'wander';
  wanderMove(a);
}

export function seaBrain(a: Animal): void {
  const S = a.S;
  if (a.state === 'flee') {
    if (--a.fleeT! <= 0) a.state = 'wander';
    else { steer(a, a.fx!, a.fy!, a.stam-- > 0 ? S.run : S.speed); return; }
  }
  if (S.eats) {
    if (a.state === 'chase') {
      const tg = a.target;
      if (!tg || tg.dead) { a.state = 'wander'; a.target = null; }
      else {
        const dx = tg.x - a.x, dy = tg.y - a.y, d = Math.hypot(dx, dy);
        if (d < 0.8) { catchPrey(a, tg); return; }
        if (a.stam-- <= 0 || d > S.vision * 1.8) { a.state = 'wander'; a.target = null; a.stam = 0; }
        else { steer(a, dx, dy, S.run); return; }
      }
    } else if (a.hunger > 0.5 && (creatureState.fc + a.id) % 30 === 0) {
      const tg = findPrey(a, S.vision);
      if (tg) { a.target = tg; a.state = 'chase'; a.stam = S.stam; return; }
      const far = findPrey(a, 45);
      if (far) { a.wa = Math.atan2(far.y - a.y, far.x - a.x); a.idle = false; a.timer = 90; }
    }
  }
  if (S.school && a.lead) {
    if (a.lead.dead) a.lead = null;
    else {
      const L = a.lead, dx = L.x + (a.ox || 0) - a.x, dy = L.y + (a.oy || 0) - a.y, d = Math.hypot(dx, dy);
      steer(a, dx + L.vx * 20, dy + L.vy * 20, Math.min(S.run, S.speed * (0.8 + d)));
      return;
    }
  }
  wanderMove(a);
}

function move(a: Animal): void {
  if (!a.vx && !a.vy) return;
  const nx = a.x + a.vx, ny = a.y + a.vy, j = tileAt(nx, ny);
  if (passable(a.S, j)) { a.x = nx; a.y = ny; a.stuck = 0; }
  else { a.vx = a.vy = 0; a.stuck++; }
  if (a.vx > 0.0005) a.dir = 1; else if (a.vx < -0.0005) a.dir = -1;
  a.t += (Math.abs(a.vx) + Math.abs(a.vy)) * 9;
}

function splashAt(a: Animal): void {
  burst('debris', a.x * SUB, a.y * SUB, 6, 0.6, ['#dff2ff', '#ffffff'], 16);
  if (visibleTile(a.x, a.y) && cool('dsplash', 200)) SFX.splash(0.08);
}

function updateWalker(a: Animal): void {
  const S = a.S;
  if (a.state === 'tossed') {
    a.x = Math.min(Math.max(a.x + a.vx, 0), world.W - 0.01);
    a.y = Math.min(Math.max(a.y + a.vy, 0), world.H - 0.01);
    a.z += a.vz; a.vz -= 0.06 * K; a.t += 0.6;
    if (a.z <= 0) {
      a.z = 0; a.vx = a.vy = 0; a.state = 'wander'; a.timer = 30;
      const i = tileAt(a.x, a.y);
      if (!canBe(S, i)) kill(a, i >= 0 && world.hgt[i] < SEA ? 'drown' : 'burn');
      else if (visibleTile(a.x, a.y) && cool('thud', 150)) SFX.rumble();
    }
    return;
  }
  const i = tileAt(a.x, a.y);
  if (i < 0) { a.dead = true; return; }
  const c = world.cover[i];
  if (S.kind !== 'sea' && (c === C_FIRE || c === C_LAVA)) return kill(a, 'burn');
  if (!canBe(S, i)) {
    if (S.kind === 'land' && world.hgt[i] < SEA) return kill(a, 'drown');
    if (S.kind === 'sea') return kill(a, 'poof');
  }
  if (S.kind !== 'sea') for (const t of tornados) {
    const dx = a.x - t.x, dy = a.y - t.y;
    if (dx * dx + dy * dy < 2.2) { a.state = 'tossed'; a.z = 1; a.vz = (1.5 + rnd()) * K; a.vx = (rnd() - 0.5) * 0.25; a.vy = (rnd() - 0.5) * 0.25; return; }
  }
  a.age++;
  if (a.baby > 0) a.baby--;
  if ((a.mateCd || 0) > 0) a.mateCd!--;
  if (a.emoT > 0) a.emoT--;
  if (a.stam < S.stam && a.state !== 'chase' && a.state !== 'flee') a.stam += 0.4;
  const hr = S.hr || 0;
  a.hunger += a.state === 'sleep' ? hr * 0.4 : hr;
  if (S.thirsty) a.thirst += a.state === 'sleep' ? 0.00012 : 0.00032;
  if (a.hunger > 1.25 || a.thirst > 1.25) return kill(a, 'starve');
  if (a.age > a.life) return kill(a, 'old');
  if ((a.id + creatureState.fc) % 10 === 0) perceive(a);
  if (S.kind === 'land') brain(a); else seaBrain(a);
  move(a);
  const sp = Math.abs(a.vx) + Math.abs(a.vy);
  if (S.key === 'whale' && rnd() < 0.004) {
    for (let q = 0; q < 12; q++) addP('debris', a.x * SUB + a.dir * S.w * 0.3, a.y * SUB - S.h, (rnd() - 0.5) * 0.4, -0.6 - rnd() * 0.8, 34, { c: '#eaf6ff', drag: 0.96 });
  }
  if (S.key === 'dolphin') {
    if (!a.jump && sp > 0.005 && rnd() < 0.006) { a.jump = 0.001; splashAt(a); }
    if (a.jump) { a.jump += 0.03; if (a.jump >= 1) { a.jump = 0; splashAt(a); } }
  }
  if (S.key === 'shark' && sp > 0.005 && creatureState.fc % 5 === 0) addP('splash', a.x * SUB - a.dir * S.w * 0.5, a.y * SUB, 0, 0, 10);
}

function updateFlyer(a: Animal): void {
  const S = a.S;
  a.t += S.key === 'eagle' ? 0.05 : S.key === 'butterfly' ? 0.35 : 0.22;
  if (S.key === 'eagle') {
    if (a.alt === undefined) a.alt = S.alt;
    a.hunger = (a.hunger || 0) + 0.00028;
    if (a.state === 'dive') {
      const tg = a.target;
      if (!tg || tg.dead) a.state = 'climb';
      else {
        const dx = tg.x - a.x, dy = tg.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        a.x += dx / d * Math.min(0.09, d); a.y += dy / d * Math.min(0.09, d);
        a.dir = dx >= 0 ? 1 : -1; a.t += 0.2;
        a.alt = S.alt! * Math.min(1, d / 6);
        if (d < 0.5) { kill(tg, 'eaten'); a.hunger = 0; a.state = 'climb'; a.target = null; }
      }
    } else if (a.state === 'climb') {
      a.alt = Math.min(S.alt!, a.alt! + 0.35); a.t += 0.15;
      if (a.alt >= S.alt!) { a.state = 'circle'; a.cx = a.x - Math.cos(a.phase) * 7; a.cy = a.y - Math.sin(a.phase) * 5; }
    } else {
      a.phase += 0.01; a.cx! += clock.wx * 0.003; a.cy! += clock.wy * 0.003;
      const nx = a.cx! + Math.cos(a.phase) * 7, ny = a.cy! + Math.sin(a.phase) * 5;
      a.dir = nx >= a.x ? 1 : -1; a.x = nx; a.y = ny;
      if (a.hunger > 0.5 && (creatureState.fc + a.id) % 30 === 0) {
        const tg = findPrey(a, 12);
        if (tg) { a.target = tg; a.state = 'dive'; if (visibleTile(a.x, a.y) && cool('screech', 1500)) SFX.screech(0.8); }
      }
      if (a.cx! < -10 || a.cx! > world.W + 10 || a.cy! < -10 || a.cy! > world.H + 10) a.dead = true;
    }
  } else if (S.key === 'butterfly' || S.key === 'bat' || S.key === 'firefly') {
    a.vx += (rnd() - 0.5) * S.speed * 0.4 + (a.hx - a.x) * 0.0006;
    a.vy += (rnd() - 0.5) * S.speed * 0.4 + (a.hy - a.y) * 0.0006;
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > S.speed) { a.vx *= S.speed / sp; a.vy *= S.speed / sp; }
    a.x += a.vx; a.y += a.vy;
    if (Math.abs(a.vx) > 0.002) a.dir = a.vx > 0 ? 1 : -1;
    if (a.auto && ((S.night && clock.dark < 0.12) || (S.day && clock.dark > 0.3))) a.dead = true;
  } else {
    a.x += a.vx; a.y += a.vy + Math.sin(a.t * 0.4 + a.phase) * 0.004;
    a.dir = a.vx >= 0 ? 1 : -1;
    if (a.x < -12 || a.x > world.W + 12 || a.y < -12 || a.y > world.H + 12) a.dead = true;
  }
}

function manageAnimals(): void {
  const cnt: Record<string, number> = {};
  for (const a of animals) cnt[a.S.key] = (cnt[a.S.key] || 0) + 1;
  const c = (k: string) => cnt[k] || 0;
  if (clock.dark < 0.25) {
    if (c('bird') < 12 && rnd() < 0.25) spawnFlockEdge('bird', 5 + ((rnd() * 3) | 0));
    if (c('gull') < 6 && rnd() < 0.15) spawnFlockEdge('gull', 3 + ((rnd() * 2) | 0));
    if (c('eagle') < 1 && rnd() < 0.1) { const p = randomTile(i => world.hgt[i] >= SEA); if (p) spawnAnimal('eagle', p.x, p.y, { cx: p.x, cy: p.y }); }
    if (c('butterfly') < 10 && rnd() < 0.5) {
      const p = randomTile(i => isVeg(world.hgt[i]) && (world.biome[i] === B_TEMP || world.biome[i] === B_JUNGLE || world.biome[i] === B_SAVANNA));
      if (p) spawnAnimal('butterfly', p.x, p.y, { hx: p.x, hy: p.y, auto: true });
    }
  }
  if (clock.dark > 0.35) {
    if (c('bat') < 12 && rnd() < 0.4) { const p = randomTile(i => world.hgt[i] >= GRASS); if (p) for (let q = 0; q < 3; q++) spawnAnimal('bat', p.x + rnd() * 2, p.y + rnd() * 2, { hx: p.x, hy: p.y, auto: true }); }
    if (c('firefly') < 40 * world.popK && rnd() < 0.8) {
      const p = randomTile(i => world.cover[i] === C_TREE && (world.biome[i] === B_TEMP || world.biome[i] === B_SWAMP || world.biome[i] === B_JUNGLE));
      if (p) for (let q = 0; q < 4; q++) spawnAnimal('firefly', p.x + rnd() * 3 - 1.5, p.y + rnd() * 3 - 1.5, { hx: p.x, hy: p.y, auto: true });
    }
  }
  if (((creatureState.fc / 60) | 0) % 6 === 0) {
    for (const k in SPECIES) {
      const S = SPECIES[k];
      if (S.kind !== 'sea' && S.kind !== 'beach') continue;
      const n = c(k);
      if (n < 2 || n >= S.cap * world.popK || rnd() > (S.breed || 0)) continue;
      const pool = animals.filter(a => a.S === S && !a.dead);
      const par = pool[(rnd() * pool.length) | 0];
      if (!par || (S.eats && par.hunger > 0.6)) continue;
      const nx = par.x + (rnd() - 0.5) * 2, ny = par.y + (rnd() - 0.5) * 2;
      if (!canBe(S, tileAt(nx, ny))) continue;
      if (S.school) {
        const L = par.lead || par;
        for (let q = 0; q < 3; q++) spawnAnimal(k, nx + rnd() - 0.5, ny + rnd() - 0.5, { lead: L, ox: (rnd() - 0.5) * 3, oy: (rnd() - 0.5) * 3, pal: L.pal });
      } else spawnAnimal(k, nx, ny, { baby: 1500, age: 0 });
    }
  }
}

export function updateAnimals(): void {
  creatureState.fc++;
  predators.length = 0;
  for (const a of animals) if (a.S.eats && !a.dead) predators.push(a);
  for (const a of animals) {
    if (a.dead) continue;
    if (a.S.kind === 'sky') updateFlyer(a); else updateWalker(a);
  }
  for (let k = animals.length - 1; k >= 0; k--) if (animals[k].dead) animals.splice(k, 1);
  if (creatureState.fc % 10 === 0) animals.sort((p, q) => p.y - q.y);
  if (creatureState.fc % 60 === 0) manageAnimals();
}
