// Хмари: фонові (просто пливуть і відкидають тінь) та грозові (дощ/сніг,
// намокання землі, рідкісні удари блискавки). Використовує SUB/BW/BH зі
// світу лише для перетворення тайл↔піксель — самих клітинок не читає, крім
// weatherTick(), де грозова хмара справді змінює землю під собою.

import { rnd, lerp } from '../world/noise';
import { world } from '../world/state';
import { SUB, K, SEA } from '../world/constants';
import { isCold } from '../world/generate';
import { clock } from './clock';
import { rainAt, snowAt, steamAt } from './particles';
import { strike } from './events';
import { C_ICE, C_FIRE, C_BURNT, C_LAVA } from '../world/constants';

export interface CloudSprite { c: HTMLCanvasElement; s: HTMLCanvasElement; }

export interface Cloud {
  x: number; y: number; w: number; h: number;
  sp: CloudSprite;
  storm: boolean;
  spd: number;
  life: number;
  age: number;
  alpha: number;
}

export const clouds: Cloud[] = [];

function makeCloud(w: number, h: number, storm: boolean): CloudSprite {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const s = document.createElement('canvas'); s.width = w; s.height = h;
  const g = c.getContext('2d')!, gs = s.getContext('2d')!;
  const im = g.createImageData(w, h), ims = gs.createImageData(w, h);
  const blobs: { x: number; y: number; r: number }[] = [];
  const n = 4 + ((rnd() * 4) | 0);
  for (let k = 0; k < n; k++) blobs.push({ x: w * (0.18 + 0.64 * rnd()), y: h * (0.45 + 0.2 * rnd()), r: h * (0.3 + 0.22 * rnd()) });
  const inside = (x: number, y: number) => blobs.some(b => (x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) * 1.2 < b.r * b.r);
  const top = storm ? [150, 156, 170] : [252, 253, 255];
  const bot = storm ? [88, 94, 110] : [204, 212, 226];
  const hi = storm ? [182, 188, 200] : [255, 255, 255];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const t = y / h, q = (y * w + x) * 4;
    let cc = [lerp(top[0], bot[0], t), lerp(top[1], bot[1], t), lerp(top[2], bot[2], t)];
    if (!inside(x + 0.5, y - 0.5)) cc = hi;
    else if (!inside(x + 0.5, y + 1.5)) cc = [cc[0] * 0.88, cc[1] * 0.88, cc[2] * 0.9];
    im.data[q] = cc[0]; im.data[q + 1] = cc[1]; im.data[q + 2] = cc[2]; im.data[q + 3] = 255;
    ims.data[q + 3] = 255;
  }
  g.putImageData(im, 0, 0); gs.putImageData(ims, 0, 0);
  return { c, s };
}

export function spawnAmbientCloud(initial?: boolean): void {
  const w = ((22 + rnd() * 22) * K) | 0, h = ((10 + rnd() * 8) * K) | 0;
  let x: number, y: number;
  if (initial) { x = rnd() * world.BW; y = rnd() * world.BH; }
  else if (Math.abs(clock.wx) >= Math.abs(clock.wy)) { x = clock.wx > 0 ? -w - 10 : world.BW + 10; y = rnd() * world.BH; }
  else { y = clock.wy > 0 ? -h - 20 : world.BH + 10; x = rnd() * world.BW; }
  clouds.push({ x, y, w, h, sp: makeCloud(w, h, false), storm: false, spd: 0.1 + rnd() * 0.1, life: Infinity, age: 0, alpha: 0.55 });
}

export function spawnStorm(tx: number, ty: number): void {
  if (clouds.filter(c => c.storm).length >= 6) return;
  const w = ((34 + rnd() * 14) * K) | 0, h = ((15 + rnd() * 6) * K) | 0;
  clouds.push({
    x: tx * SUB - w / 2, y: ty * SUB - h / 2 - 6 * K, w, h,
    sp: makeCloud(w, h, true), storm: true, spd: 0.06, life: 1500, age: 0, alpha: 0
  });
}

interface StormArea { cx: number; cy: number; rx: number; ry: number; }

function stormArea(cl: Cloud): StormArea {
  return { cx: (cl.x + cl.w / 2) / SUB, cy: (cl.y + cl.h / 2 + 6 * K) / SUB, rx: cl.w * 0.42 / SUB, ry: cl.h * 0.6 / SUB };
}

export function updateClouds(): void {
  let ambient = 0;
  for (let k = clouds.length - 1; k >= 0; k--) {
    const cl = clouds[k];
    cl.x += clock.wx * cl.spd * clock.windS * 1.4 * K;
    cl.y += clock.wy * cl.spd * clock.windS * 0.9 * K;
    cl.age++;
    if (cl.storm) {
      cl.alpha = 0.9 * Math.min(1, cl.age / 60, (cl.life - cl.age) / 60);
      if (cl.age >= cl.life) { clouds.splice(k, 1); continue; }
      if (cl.alpha > 0.4) {
        const a = stormArea(cl);
        for (let n = 0; n < 3; n++) {
          const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
          const tx = a.cx + Math.cos(ang) * a.rx * rr, ty = a.cy + Math.sin(ang) * a.ry * rr;
          const ix = tx | 0, iy = ty | 0;
          if (ix < 0 || iy < 0 || ix >= world.W || iy >= world.H) continue;
          isCold(iy * world.W + ix) ? snowAt(tx * SUB, ty * SUB) : rainAt(tx * SUB, ty * SUB);
        }
        if (rnd() < 0.003) {
          const ang = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
          strike(a.cx + Math.cos(ang) * a.rx * rr, a.cy + Math.sin(ang) * a.ry * rr, true);
        }
      }
    } else {
      ambient++;
      if (cl.x < -80 || cl.y < -80 || cl.x > world.BW + 80 || cl.y > world.BH + 80) { clouds.splice(k, 1); ambient--; }
    }
  }
  if (ambient < 4 && rnd() < 0.01) spawnAmbientCloud(false);
}

export function weatherTick(): void {
  for (const cl of clouds) {
    if (!cl.storm || cl.alpha < 0.4) continue;
    const a = stormArea(cl);
    for (let ty = Math.floor(a.cy - a.ry); ty <= Math.ceil(a.cy + a.ry); ty++) {
      for (let tx = Math.floor(a.cx - a.rx); tx <= Math.ceil(a.cx + a.rx); tx++) {
        if (tx < 0 || ty < 0 || tx >= world.W || ty >= world.H) continue;
        const ex = (tx - a.cx) / a.rx, ey = (ty - a.cy) / a.ry;
        if (ex * ex + ey * ey > 1) continue;
        const i = ty * world.W + tx;
        if (isCold(i)) {
          if (world.hgt[i] < SEA) { if (world.cover[i] !== C_ICE && rnd() < 0.03) { world.cover[i] = C_ICE; world.timer[i] = 400; } }
          else { world.snow[i] = Math.min(900, world.snow[i] + 12); if (world.cover[i] === C_FIRE) { world.cover[i] = C_BURNT; world.timer[i] = 60; } }
        } else {
          if (world.hgt[i] >= SEA) world.wet[i] = 100;
          if (world.cover[i] === C_FIRE) { world.cover[i] = C_BURNT; world.timer[i] = 60; }
          if (world.cover[i] === C_LAVA) { world.timer[i] -= 3; if (rnd() < 0.05) steamAt(tx * SUB + 2, ty * SUB); }
          if (world.snow[i] > 0) world.snow[i] = Math.max(0, world.snow[i] - 6);
        }
      }
    }
  }
  if (clouds.filter(c => c.storm).length < 2 && rnd() < 0.003) spawnStorm(rnd() * world.W, rnd() * world.H);
}
