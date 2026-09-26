// Одноразові природні події: удар блискавки, метеорит, смерч — і їхнє
// поетапне оновлення (updateEntities). Ці ефекти б'ють по рельєфу, тваринах
// і викликають частинки/звук, тому імпортують майже всі домени.

import { rnd, lerp } from '../world/noise';
import { world } from '../world/state';
import { SUB, K, SEA, C_TREE, C_FIRE, C_BURNT, C_NONE, C_LAVA } from '../world/constants';
import { isVeg, setH } from '../world/generate';
import { clock } from './clock';
import { camera } from '../render/camera';
import { markDirty } from '../render/buffer';
import { burst, smokeAt, steamAt, addP } from './particles';
import { SFX } from '../audio/sfx';
import { animals, kill } from '../creatures/animal';

export interface Bolt { pts: [number, number][]; br: [number, number][]; life: number; }
export interface Meteor { sx: number; sy: number; ex: number; ey: number; x: number; y: number; t: number; tx: number; ty: number; }
export interface Tornado { x: number; y: number; vx: number; vy: number; life: number; max: number; ph: number; age?: number; lastFrame?: number; }
export interface Wave { x: number; y: number; r: number; life: number; max: number; }

export const bolts: Bolt[] = [];
export const meteors: Meteor[] = [];
export const tornados: Tornado[] = [];
export const waves: Wave[] = [];

const LEAVES = ['#3e9a3e', '#7cd35a', '#7a4e2a', '#22662e'];

/** Удар блискавки: візуальна дуга, підпал і забиває тварин під точкою удару. */
export function strike(tx: number, ty: number, natural: boolean): void {
  const bx = tx * SUB + 2, by = ty * SUB + 2;
  const pts: [number, number][] = [], sx = bx + (rnd() - 0.5) * 20 * K, sy = by - 110 * K, segs = 12;
  for (let s = 0; s <= segs; s++) {
    const t = s / segs;
    pts.push([lerp(sx, bx, t) + (s > 0 && s < segs ? (rnd() - 0.5) * 9 * K : 0), lerp(sy, by, t)]);
  }
  const br: [number, number][] = [pts[5]];
  let bxx = pts[5][0], byy = pts[5][1];
  for (let s = 0; s < 4; s++) { bxx += (3 + rnd() * 4) * K; byy += (5 + rnd() * 4) * K; br.push([bxx, byy]); }
  bolts.push({ pts, br, life: 10 });
  clock.flash = Math.max(clock.flash, natural ? 0.3 : 0.45);
  SFX.thunder(natural ? 0.2 + rnd() * 0.6 : 0);
  for (const a of animals) if (!a.dead && a.S.kind !== 'sky' && Math.hypot(a.x - tx, a.y - ty) < 1.1) kill(a, 'burn');
  burst('spark', bx, by, 12, 1.2, ['#fffbe0', '#ffe45c', '#bcd4ff'], 14);
  const cx = Math.floor(tx), cy = Math.floor(ty);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
    const i = y * world.W + x;
    if (world.hgt[i] < SEA) continue;
    world.snow[i] = 0;
    if (world.wet[i] === 0 && isVeg(world.hgt[i])) {
      if (world.cover[i] === C_TREE) { world.cover[i] = C_FIRE; world.timer[i] = 35; }
      else if (world.cover[i] === C_NONE && dx === 0 && dy === 0) { world.cover[i] = C_FIRE; world.timer[i] = 14; }
    }
  }
  markDirty();
}

export function launchMeteor(tx: number, ty: number): void {
  SFX.whoosh();
  const ex = tx * SUB, ey = ty * SUB;
  meteors.push({ sx: ex + 70 * K, sy: ey - 130 * K, ex, ey, x: ex + 70 * K, y: ey - 130 * K, t: 0, tx: Math.floor(tx), ty: Math.floor(ty) });
}

function impact(cx: number, cy: number): void {
  const ci = Math.max(0, Math.min(cy, world.H - 1)) * world.W + Math.max(0, Math.min(cx, world.W - 1));
  const inWater = world.hgt[ci] < SEA;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = cx + dx, y = cy + dy;
    if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
    const i = y * world.W + x, d = Math.hypot(dx, dy);
    if (d < 3.6) {
      setH(i, world.hgt[i] - 0.13 * (1 - d / 3.6) - 0.02);
      world.snow[i] = 0; world.wet[i] = 0;
      if (world.hgt[i] >= SEA) { world.cover[i] = d < 1.3 ? C_LAVA : C_BURNT; world.timer[i] = d < 1.3 ? 30 : 200; }
      else world.cover[i] = C_NONE;
    } else if (d < 5) {
      setH(i, world.hgt[i] + 0.035 * (1 - (d - 3.6) / 1.4));
      world.snow[i] = 0;
      if (world.cover[i] === C_TREE && rnd() < 0.6) { world.cover[i] = C_FIRE; world.timer[i] = 30; }
    } else if (d < 7.5 && world.cover[i] === C_TREE && rnd() < 0.3) { world.cover[i] = C_FIRE; world.timer[i] = 30; }
  }
  const bx = cx * SUB + SUB / 2, by = cy * SUB + SUB / 2;
  clock.shake = 14 * camera.dpr;
  clock.flash = Math.max(clock.flash, 0.4);
  SFX.boom(); if (inWater) SFX.splash(0.45);
  for (const a of animals) {
    if (a.dead) continue;
    const dx = a.x - (cx + 0.5), dy = a.y - (cy + 0.5), d = Math.hypot(dx, dy) || 0.01;
    if (a.S.kind === 'sky') { if (d < 3 && a.S.key !== 'firefly') kill(a, 'burn'); continue; }
    if (d < 3.8) kill(a, 'burn');
    else if (d < 8 && a.S.kind !== 'sea') { a.state = 'tossed'; a.z = 1; a.vz = 1.2 + rnd(); a.vx = dx / d * 0.15; a.vy = dy / d * 0.15; }
  }
  waves.push({ x: bx, y: by, r: 2, life: 28, max: 28 });
  if (inWater) {
    burst('debris', bx, by, 70, 2.2, ['#dff2ff', '#9fd4ff', '#ffffff'], 40);
    for (let k = 0; k < 20; k++) steamAt(bx + (rnd() - 0.5) * 16, by + (rnd() - 0.5) * 16);
  } else {
    burst('debris', bx, by, 70, 2.2, ['#5a4034', '#ff8a1e', '#8a7a70', '#ffd24a', '#3a2a26'], 45);
    for (let k = 0; k < 25; k++) smokeAt(bx + (rnd() - 0.5) * 18, by + (rnd() - 0.5) * 18);
  }
  markDirty();
}

export function spawnTornado(tx: number, ty: number): void {
  if (tornados.length >= 4) return;
  tornados.push({ x: tx, y: ty, vx: clock.wx * 0.03, vy: clock.wy * 0.03, life: 900, max: 900, ph: 0 });
}

/** Просуває метеорити/смерчі/блискавки/ударні хвилі на один кадр. */
export function updateEntities(frame: number): void {
  for (let k = meteors.length - 1; k >= 0; k--) {
    const m = meteors[k];
    m.t += 0.028;
    const e = Math.min(1, m.t * m.t);
    m.x = lerp(m.sx, m.ex, e); m.y = lerp(m.sy, m.ey, e);
    for (let n = 0; n < 3; n++) addP('ember', m.x + (rnd() - 0.5) * 3, m.y + (rnd() - 0.5) * 3, (rnd() - 0.5) * 0.3 + 0.3, -0.3 - rnd() * 0.3, 14 + rnd() * 10);
    if (rnd() < 0.5) smokeAt(m.x, m.y);
    if (m.t >= 1) { impact(m.tx, m.ty); meteors.splice(k, 1); }
  }
  for (let k = tornados.length - 1; k >= 0; k--) {
    const t = tornados[k];
    t.ph += 0.25;
    t.vx += (rnd() - 0.5) * 0.01 + clock.wx * 0.0006; t.vy += (rnd() - 0.5) * 0.01 + clock.wy * 0.0006;
    const sp = Math.hypot(t.vx, t.vy);
    if (sp > 0.06) { t.vx *= 0.06 / sp; t.vy *= 0.06 / sp; }
    t.x += t.vx; t.y += t.vy;
    if (t.x < 2 || t.x > world.W - 2) t.vx *= -1;
    if (t.y < 2 || t.y > world.H - 2) t.vy *= -1;
    t.x = Math.max(1, Math.min(t.x, world.W - 2)); t.y = Math.max(1, Math.min(t.y, world.H - 2));
    const bx = t.x * SUB, by = t.y * SUB;
    for (let n = 0; n < 2; n++) {
      const a = rnd() * Math.PI * 2;
      addP('dust', bx + Math.cos(a) * 3, by + Math.sin(a) * 2, -Math.sin(a) * 0.8, Math.cos(a) * 0.5 - 0.3, 20 + rnd() * 10);
    }
    if (frame !== t.lastFrame && (t.age = (t.age || 0) + 1) % 3 === 0) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 3) continue;
        const x = Math.floor(t.x) + dx, y = Math.floor(t.y) + dy;
        if (x < 0 || y < 0 || x >= world.W || y >= world.H) continue;
        const i = y * world.W + x;
        if (world.cover[i] === C_TREE && rnd() < 0.25) {
          world.cover[i] = C_NONE;
          for (let n = 0; n < 4; n++) { const a2 = rnd() * Math.PI * 2; addP('leaf', x * SUB + 2, y * SUB + 2, Math.cos(a2) * 1.2, Math.sin(a2) * 0.8, 40 + rnd() * 20, { c: LEAVES[(rnd() * 4) | 0], drag: 0.96 }); }
        } else if (world.cover[i] === C_FIRE && rnd() < 0.15) {
          const j = Math.max(0, Math.min(y + ((rnd() * 5) | 0) - 2, world.H - 1)) * world.W + Math.max(0, Math.min(x + ((rnd() * 5) | 0) - 2, world.W - 1));
          if (world.cover[j] === C_TREE) { world.cover[j] = C_FIRE; world.timer[j] = 30; }
        }
        if (world.snow[i] > 0) world.snow[i] = Math.max(0, world.snow[i] - 40);
        if (world.hgt[i] < SEA && rnd() < 0.1) addP('debris', x * SUB + 2, y * SUB + 2, (rnd() - 0.5) * 1.5, -rnd() * 1.5, 20, { c: '#dff2ff', drag: 0.94 });
      }
      markDirty();
    }
    t.lastFrame = frame;
    if (--t.life <= 0) tornados.splice(k, 1);
  }
  for (let k = bolts.length - 1; k >= 0; k--) if (--bolts[k].life <= 0) bolts.splice(k, 1);
  for (let k = waves.length - 1; k >= 0; k--) { waves[k].r += 1.3 * K; if (--waves[k].life <= 0) waves.splice(k, 1); }
}
