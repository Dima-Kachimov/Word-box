// Життєвий цикл істот: народження (spawn*), заселення світу (populate),
// спавн інструментом гравця (spawnFromTool), смерть (kill) та вибір тварини
// по кліку (pickAnimal). Сам "мозок" (AI-стани) — у creatures/ai.ts.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SUB, SEA } from '../world/constants';
import { SPECIES } from './species';
import type { Animal, Goal } from './types';
import { canBe, tileAt } from './habitat';
import { burst, smokeAt, emberAt } from '../sim/particles';
import { SFX } from '../audio/sfx';
import { cool } from '../util/cooldown';
import { visibleTile, toTile, type Point } from '../render/camera';
import { showToast } from '../ui/toast';

export const animals: Animal[] = [];
export const predators: Animal[] = [];

export const creatureState = {
  fc: 0,
  aid: 1,
  voiceCd: 60,
  selected: null as Animal | null
};

export function spawnAnimal(k: string, x: number, y: number, extra?: Partial<Animal>): Animal | null {
  if (animals.length >= 600) return null;
  const S = SPECIES[k];
  const a: Animal = {
    S, x, y, vx: 0, vy: 0, dir: rnd() < 0.5 ? -1 : 1, t: rnd() * 10, timer: 0,
    think: (rnd() * 30) | 0, state: 'wander', z: 0, vz: 0,
    pal: (rnd() * S.pals) | 0, hunger: rnd() * 0.35, thirst: rnd() * 0.35,
    stam: S.stam || 100, phase: rnd() * 6.28, id: creatureState.aid++,
    hx: x, hy: y, baby: 0, jump: 0, age: (S.adult || 0) + rnd() * 20000,
    life: 32000 + rnd() * 50000, mateCd: rnd() * 1500, stuck: 0, emoT: 0, wa: rnd() * 6.28
  };
  if (extra) Object.assign(a, extra);
  if (a.pal >= S.pals) a.pal = 0;
  animals.push(a);
  return a;
}

export function randomTile(pred: (i: number) => boolean): Goal | null {
  for (let k = 0; k < 300; k++) {
    const x = (rnd() * world.W) | 0, y = (rnd() * world.H) | 0, i = y * world.W + x;
    if (pred(i)) return { x: x + 0.5, y: y + 0.5 };
  }
  return null;
}

export function spawnFlock(k: string, n: number, x: number, y: number, vx: number, vy: number): void {
  const L = Math.hypot(vx, vy) || 1, hx = vx / L, hy = vy / L, px = -hy, py = hx;
  for (let q = 0; q < n; q++) {
    const row = Math.ceil(q / 2), side = q % 2 ? 1 : -1;
    spawnAnimal(k, x - hx * row * 1.6 + px * side * row * 1.3, y - hy * row * 1.6 + py * side * row * 1.3, { vx, vy });
  }
}

export function spawnFlockEdge(k: string, n: number): void {
  const side = (rnd() * 4) | 0;
  let x: number, y: number;
  if (side === 0) { x = -3; y = rnd() * world.H; } else if (side === 1) { x = world.W + 3; y = rnd() * world.H; }
  else if (side === 2) { x = rnd() * world.W; y = -3; } else { x = rnd() * world.W; y = world.H + 3; }
  const tx = world.W * (0.25 + rnd() * 0.5), ty = world.H * (0.25 + rnd() * 0.5), d = Math.hypot(tx - x, ty - y), s = SPECIES[k].speed;
  spawnFlock(k, n, x, y, (tx - x) / d * s, (ty - y) / d * s);
}

export function spawnGroup(k: string, x: number, y: number, n: number): Animal | null {
  const S = SPECIES[k];
  const lead = spawnAnimal(k, x, y);
  if (!lead) return null;
  for (let m = 1; m < n; m++) {
    const nx = x + (rnd() - 0.5) * 3, ny = y + (rnd() - 0.5) * 3;
    if (S.school) spawnAnimal(k, x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2, { lead, ox: (rnd() - 0.5) * 3, oy: (rnd() - 0.5) * 3, pal: lead.pal });
    else if (canBe(S, tileAt(nx, ny))) spawnAnimal(k, nx, ny, { lead });
  }
  return lead;
}

export function populate(): void {
  animals.length = 0;
  creatureState.selected = null;
  for (const k in SPECIES) {
    const S = SPECIES[k];
    if (S.kind === 'sky' || !S.init) continue;
    for (let g = 0; g < S.init; g++) {
      const p = randomTile(i => canBe(S, i) && (S.kind !== 'land' || world.hgt[i] >= SEA || !!S.lurker) && (!S.biomes || S.biomes.includes(world.biome[i])));
      if (!p) break;
      spawnGroup(k, p.x, p.y, S.group || 1);
    }
  }
  spawnFlockEdge('bird', 6);
  spawnFlockEdge('gull', 3);
  const p = randomTile(i => world.hgt[i] >= SEA);
  if (p) spawnAnimal('eagle', p.x, p.y, { cx: p.x, cy: p.y, hunger: 0.3 });
}

export function spawnFromTool(k: string, x: number, y: number): void {
  const S = SPECIES[k];
  if (S.kind === 'sky') {
    if (k === 'bird' || k === 'gull') {
      const an = rnd() * Math.PI * 2;
      spawnFlock(k, 5, x, y, Math.cos(an) * S.speed, Math.sin(an) * S.speed);
    } else if (k === 'eagle') spawnAnimal(k, x, y, { cx: x, cy: y, hunger: 0.4 });
    else for (let q = 0; q < 3; q++) spawnAnimal(k, x + rnd() - 0.5, y + rnd() - 0.5, { hx: x, hy: y });
  } else {
    if (!canBe(S, tileAt(x, y))) {
      if (cool('nohab', 1200)) showToast('Тут цей звір не виживе', 1400);
      return;
    }
    if (S.school) spawnGroup(k, x, y, 5); else spawnAnimal(k, x, y);
  }
  SFX.pop();
  if (S.voice && cool('spawnvoice', 700)) (SFX[S.voice] as (v: number) => void)(0.8);
}

export const DEATH: Record<string, string> = {
  burn: 'Згорів', drown: 'Потонув', eaten: 'Його з\'їли', starve: 'Помер з голоду чи спраги',
  old: 'Помер від старості', poof: 'Зник'
};

export function kill(a: Animal, how: string): void {
  if (a.dead) return;
  a.dead = true; a.how = how;
  const bx = a.x * SUB, by = a.y * SUB, vis = visibleTile(a.x, a.y);
  if (how === 'burn') { for (let q = 0; q < 4; q++) smokeAt(bx, by - 2); emberAt(bx, by); }
  else if (how === 'drown') { burst('debris', bx, by, 8, 0.7, ['#dff2ff', '#9fd4ff'], 18); if (vis && cool('drown', 200)) SFX.splash(0.1); }
  else if (how === 'eaten') { burst('debris', bx, by - 1, 8, 0.6, ['#9a3a2a', '#c8b8a0'], 18); if (vis && cool('eat', 200)) SFX.poof(); }
  else burst('dust', bx, by - 1, 8, 0.6, ['#c2ad86'], 18);
}

export function pickAnimal(p: Point): Animal | null {
  const t = toTile(p);
  let best: Animal | null = null, bd = 2.5;
  for (const a of animals) {
    if (a.dead || a.S.key === 'firefly') continue;
    const ay = a.S.kind === 'sky' ? a.y - (a.alt !== undefined ? a.alt : (a.S.alt || 0)) / SUB : a.y - a.S.h / SUB / 2;
    const d = Math.hypot(a.x - t.x, ay - t.y);
    if (d < bd) { bd = d; best = a; }
  }
  creatureState.selected = best;
  if (best) {
    if (best.S.voice && cool('inspv', 600)) (SFX[best.S.voice] as (v: number) => void)(0.7);
    else SFX.click();
  }
  return best;
}
