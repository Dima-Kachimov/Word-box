// Хмари: фонові (просто пливуть і відкидають тінь) та грозові (дощ/сніг,
// намокання землі, рідкісні удари блискавки). Використовує SUB/BW/BH зі
// світу лише для перетворення тайл↔піксель — самих клітинок не читає, крім
// weatherTick(), де грозова хмара справді змінює землю під собою.

import { rnd } from '../world/noise';
import { LodSprite } from '../render/sprite';
import { world } from '../world/state';
import { SUB, K, SEA } from '../world/constants';
import { isCold } from '../world/generate';
import { clock } from './clock';
import { rainAt, snowAt, steamAt } from './particles';
import { strike } from './events';
import { C_ICE, C_FIRE, C_BURNT, C_LAVA } from '../world/constants';

export interface CloudSprite { c: LodSprite; s: LodSprite; }

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

/** Мультяшна хмара: пухкі кружала з м'яким контуром, світлий верх, тінь знизу. */
function makeCloud(w: number, h: number, storm: boolean): CloudSprite {
  const blobs: { x: number; y: number; r: number }[] = [];
  const n = 4 + ((rnd() * 4) | 0);
  for (let k = 0; k < n; k++) blobs.push({ x: w * (0.18 + 0.64 * rnd()), y: h * (0.45 + 0.2 * rnd()), r: h * (0.3 + 0.22 * rnd()) });
  // рівненьке "дно" хмари
  blobs.push({ x: w * 0.5, y: h * 0.66, r: h * 0.3 });
  const ry = 1 / Math.sqrt(1.2);
  const shape = (g: CanvasRenderingContext2D) => {
    g.beginPath();
    for (const b of blobs) { g.moveTo(b.x + b.r, b.y); g.ellipse(b.x, b.y, b.r, b.r * ry, 0, 0, Math.PI * 2); }
    g.ellipse(w * 0.5, h * 0.7, w * 0.36, h * 0.2, 0, 0, Math.PI * 2);
  };
  const ink = storm ? '#3c4254' : '#8ea2c4';
  const c = new LodSprite(w, h, 3, g => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, storm ? '#a4acbe' : '#ffffff');
    gr.addColorStop(0.55, storm ? '#838ba0' : '#f4f8ff');
    gr.addColorStop(1, storm ? '#555c70' : '#d2ddf0');
    g.lineJoin = 'round';
    shape(g); g.strokeStyle = ink; g.lineWidth = 1.8; g.stroke();
    g.fillStyle = gr; g.fill();
    g.save(); shape(g); g.clip();
    // відблиски на верхівках кружал
    g.fillStyle = storm ? 'rgba(210,216,230,0.45)' : 'rgba(255,255,255,0.9)';
    for (const b of blobs) { g.beginPath(); g.ellipse(b.x - b.r * 0.25, b.y - b.r * 0.45, b.r * 0.45, b.r * 0.22, -0.3, 0, Math.PI * 2); g.fill(); }
    // тінь по низу
    g.fillStyle = storm ? 'rgba(30,34,50,0.35)' : 'rgba(120,145,190,0.25)';
    g.beginPath(); g.ellipse(w * 0.5, h * 1.02, w * 0.5, h * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }, 6);
  const s = new LodSprite(w, h, 3, g => { shape(g); g.fillStyle = '#10142a'; g.fill(); }, 3);
  return { c, s };
}

export function spawnAmbientCloud(initial?: boolean): void {
  const w = ((22 + rnd() * 22) * K) | 0, h = ((10 + rnd() * 8) * K) | 0;
  let x: number, y: number;
  if (initial) { x = rnd() * world.BW; y = rnd() * world.BH; }
  else if (Math.abs(clock.wx) >= Math.abs(clock.wy)) { x = clock.wx > 0 ? -w - 10 : world.BW + 10; y = rnd() * world.BH; }
  else { y = clock.wy > 0 ? -h - 20 : world.BH + 10; x = rnd() * world.BW; }
  clouds.push({ x, y, w, h, sp: makeCloud(w, h, false), storm: false, spd: 0.1 + rnd() * 0.1, life: Infinity, age: 0, alpha: 0.62 });
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
  if (ambient < Math.round(4 * world.popK) && rnd() < 0.01) spawnAmbientCloud(false);
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
  if (clouds.filter(c => c.storm).length < Math.round(2 * world.popK) && rnd() < 0.003) spawnStorm(rnd() * world.W, rnd() * world.H);
}
