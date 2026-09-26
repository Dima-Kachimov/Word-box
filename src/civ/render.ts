// Малювання цивілізацій поверх світу: території королівств (м'яка заливка
// кольором + яскравіший кордон), жителі, стріли, прапори й підписи міст,
// світло у вікнах уночі. Будівлі малює render/vegetation.ts (як дерева).

import { world } from '../world/state';
import { SUB } from '../world/constants';
import { camera } from '../render/camera';
import { INK } from '../render/cartoon';
import { units, cities, arrows, civState, cityById } from './state';
import { personSprite, drawFlag, PW, PH, P_SCALE } from './art';
import { bldType, T_FARM, T_CASTLE } from './buildings';
import { LEVEL_NAMES } from './cities';
import { markCells, markAll } from '../render/dirty';
import type { Job } from './types';

// ---------------------------------------------------------------- території
const terr = { canvas: null as HTMLCanvasElement | null, img: null as ImageData | null };

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Пікселів території на клітинку: кордон — тонка лінія в 1/3 клітинки. */
const TS = 3;

/** Королівство клітинки (id) або −1. */
function kingdomAt(i: number): number {
  const o = world.owner[i];
  if (!o) return -1;
  const city = cityById(o - 1);
  return city && city.alive ? city.kingdom.id : -1;
}

/** Перемальовує прямокутник клітинок (включно) у полотні територій. */
function rebuildTerritory(x0: number, y0: number, x1: number, y1: number): void {
  const { W, H } = world;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1);
  if (x1 < x0 || y1 < y0) return;
  const d = terr.img!.data, RW = W * TS;
  const kCol = new Map<number, [number, number, number]>();
  const colOf = (k: number, i: number) => {
    let col = kCol.get(k);
    if (!col) { col = hexRgb(cityById(world.owner[i] - 1)!.kingdom.color); kCol.set(k, col); }
    return col;
  };
  const put = (px: number, py: number, col: [number, number, number], a: number) => {
    const q = (py * RW + px) * 4;
    d[q] = col[0]; d[q + 1] = col[1]; d[q + 2] = col[2]; d[q + 3] = a;
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x, k = kingdomAt(i);
    if (k < 0) {
      for (let sy = 0; sy < TS; sy++) for (let sx = 0; sx < TS; sx++) d[(((y * TS + sy) * RW) + x * TS + sx) * 4 + 3] = 0;
      continue;
    }
    const col = colOf(k, i);
    for (let sy = 0; sy < TS; sy++) for (let sx = 0; sx < TS; sx++) put(x * TS + sx, y * TS + sy, col, 30);
    // кордон — лише по краю, що межує з чужою/нічиєю землею
    if (x === 0 || kingdomAt(i - 1) !== k) for (let q = 0; q < TS; q++) put(x * TS, y * TS + q, col, 215);
    if (x === W - 1 || kingdomAt(i + 1) !== k) for (let q = 0; q < TS; q++) put(x * TS + TS - 1, y * TS + q, col, 215);
    if (y === 0 || kingdomAt(i - W) !== k) for (let q = 0; q < TS; q++) put(x * TS + q, y * TS, col, 215);
    if (y === H - 1 || kingdomAt(i + W) !== k) for (let q = 0; q < TS; q++) put(x * TS + q, y * TS + TS - 1, col, 215);
  }
  terr.canvas!.getContext('2d')!.putImageData(terr.img!, 0, 0, x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
  markCells(x0, y0, x1, y1);
}

/** Оновлює полотно територій, якщо кордони змінились (викликається раз на тік до зведення). */
export function updateTerritory(): void {
  const { W, H } = world;
  let c = terr.canvas;
  const b = civState.borders;
  if (!c || c.width !== W * TS || c.height !== H * TS) {
    c = terr.canvas = document.createElement('canvas');
    c.width = W * TS; c.height = H * TS;
    terr.img = c.getContext('2d')!.createImageData(W * TS, H * TS);
    b.all = true; civState.bordersDirty = true;
  }
  if (!civState.bordersDirty) return;
  if (b.all) { rebuildTerritory(0, 0, W - 1, H - 1); markAll(); }
  else rebuildTerritory(b.x0, b.y0, b.x1, b.y1);
  civState.bordersDirty = false;
  b.all = false; b.x0 = 0; b.y0 = 0; b.x1 = -1; b.y1 = -1;
}

/** Кладе території (прямокутник клітинок) у зведене зображення світу — між рельєфом і будівлями. */
export function composeTerritory(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number): void {
  if (!terr.canvas) return;
  // рівно 2× без згладжування — тонкі лінії кордонів лишаються чіткими, без швів між плитками
  g.imageSmoothingEnabled = false;
  g.drawImage(terr.canvas, x0 * TS, y0 * TS, w * TS, h * TS, x0 * SUB, y0 * SUB, w * SUB, h * SUB);
  g.imageSmoothingEnabled = true;
}

// ---------------------------------------------------------------- жителі
const CARRY_COL: Record<string, string> = { wood: '#8a5a32', stone: '#9a9aa6', food: '#d84a3a' };

export function drawUnits(ctx: CanvasRenderingContext2D, ox: number, oy: number, z: number): void {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const s = P_SCALE * z, tiny = PW * s < 5;
  for (const u of units) {
    if (u.dead || u.inside) continue;
    const bx = u.x * SUB, by = u.y * SUB, sx = ox + bx * z, sy = oy + by * z;
    if (sx < -30 || sy < -30 || sx > cw + 30 || sy > ch + 60) continue;
    const col = u.city.kingdom.color;
    if (tiny) {
      const r = Math.max(1.2, z * 1.4);
      ctx.fillStyle = INK; ctx.fillRect(sx - r - 0.6, sy - r * 2 - 0.6, r * 2 + 1.2, r * 2 + 1.2);
      ctx.fillStyle = col; ctx.fillRect(sx - r, sy - r * 2, r * 2, r * 2);
      continue;
    }
    const moving = u.task === 'walk' || u.task === 'march' || u.task === 'carry' || u.task === 'hunt' || u.task === 'flee' || u.task === 'home' || u.task === 'settle' || u.task === 'fight';
    const pose = (moving ? Math.floor(u.t) % 2 : 0) as 0 | 1;
    const job: Job = u.job;
    const w = PW * s, h = PH * s;
    let dy = sy - h + 0.4 * z;
    if (u.task === 'work' || u.task === 'build') dy -= Math.abs(Math.sin(u.t * 3)) * z * 0.6;
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#1a1020';
    ctx.beginPath(); ctx.ellipse(sx, sy + 0.2 * z, w * 0.3, w * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    personSprite(u.race, col, job, pose).blit(ctx, sx - w / 2, dy, s, u.dir < 0);
    if (u.carry) {
      ctx.fillStyle = CARRY_COL[u.carry]; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, z * 0.25);
      ctx.beginPath(); ctx.ellipse(sx - u.dir * w * 0.25, dy + h * 0.45, w * 0.22, w * 0.16, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    if (u.hp < u.maxHp * 0.99 && z > 1.5) {
      const bw = w * 0.9, f = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = INK; ctx.fillRect(sx - bw / 2 - 1, dy - 3 * z / 2 - 1, bw + 2, z * 0.8 + 2);
      ctx.fillStyle = f > 0.5 ? '#7ad05a' : f > 0.25 ? '#ffd23c' : '#e8443a';
      ctx.fillRect(sx - bw / 2, dy - 3 * z / 2, bw * f, z * 0.8);
    }
    if (u === civState.selUnit) {
      ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = Math.max(1.5, z * 0.5);
      ctx.beginPath(); ctx.ellipse(sx, sy + 0.2 * z, w * 0.55, w * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // стріли ельфів
  ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = Math.max(1, z * 0.3); ctx.lineCap = 'round';
  ctx.beginPath();
  for (const a of arrows) {
    const x = a.x0 + (a.x1 - a.x0) * a.t, y = a.y0 + (a.y1 - a.y0) * a.t - Math.sin(a.t * Math.PI) * 0.8;
    const L = Math.hypot(a.x1 - a.x0, a.y1 - a.y0) || 1, ux = (a.x1 - a.x0) / L, uy = (a.y1 - a.y0) / L;
    ctx.moveTo(ox + x * SUB * z, oy + y * SUB * z);
    ctx.lineTo(ox + (x - ux * 0.5) * SUB * z, oy + (y - uy * 0.5) * SUB * z);
  }
  ctx.stroke();
}

// ---------------------------------------------------------------- прапори й підписи
export function drawCityLabels(ctx: CanvasRenderingContext2D, ox: number, oy: number, z: number, time: number): void {
  const dpr = camera.dpr, cell = SUB * z;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const c of cities) {
    if (!c.alive) continue;
    const hx = ox + (c.cx + 0.5) * cell, hy = oy + (c.cy + 1) * cell;
    if (hx < -200 || hy < -100 || hx > ctx.canvas.width + 200 || hy > ctx.canvas.height + 200) continue;
    const hall = c.cells.find(i => world.bld[i] && (bldType(world.bld[i]) === 0 || bldType(world.bld[i]) === T_CASTLE));
    // прапор над ратушею/замком — зблизька
    if (hall !== undefined && cell >= 7) {
      const castle = bldType(world.bld[hall]) === T_CASTLE;
      const top = (c.cy * SUB + SUB - 0.4 - 10.4 + (castle ? -2.0 : 0.2)) * z;
      drawFlag(ctx, hx, oy + top, z * 0.9, c.kingdom.color, Math.sin(time / 300 + c.id) * 0.4);
    }
    // підпис: здалеку лише столиці й великі міста, дрібнішим шрифтом
    const capital = c.kingdom.capital === c;
    if (!c.pop) continue;
    if (cell < 3 && c.level < 2 && !capital) continue;
    const far = Math.min(1, Math.max(0.62, cell / 7));
    const fs = Math.round((9 + c.level * 1.3 + (capital ? 1 : 0)) * dpr * far);
    ctx.font = `800 ${fs}px Nunito, system-ui, sans-serif`;
    const txt = (capital ? '👑 ' : '') + c.name + '  ' + c.pop;
    const tw = ctx.measureText(txt).width, ph = fs * 1.5;
    const ly = hy - Math.max(c.radius * cell * 0.25, 16 * dpr) - (cell >= 7 ? 12 * z : 0);
    ctx.fillStyle = c.kingdom.color; ctx.strokeStyle = INK; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); roundRect(ctx, hx - tw / 2 - 7 * dpr, ly - ph / 2, tw + 14 * dpr, ph, ph / 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = INK; ctx.strokeText(txt, hx, ly + dpr * 0.5);
    ctx.fillStyle = '#ffffff'; ctx.fillText(txt, hx, ly + dpr * 0.5);
    if (cell >= 4 && c.level > 0) {
      ctx.font = `700 ${Math.round(fs * 0.72)}px Nunito, system-ui, sans-serif`;
      ctx.lineWidth = 2.5 * dpr; ctx.strokeText(LEVEL_NAMES[c.level], hx, ly + ph * 0.85);
      ctx.fillStyle = '#fff6d8'; ctx.fillText(LEVEL_NAMES[c.level], hx, ly + ph * 0.85);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Нічне світло у вікнах (у режимі 'lighter', викликається зі scene). */
export function drawCivLights(ctx: CanvasRenderingContext2D, glow: HTMLCanvasElement, ox: number, oy: number, z: number, ga: number): void {
  const cw = ctx.canvas.width, ch = ctx.canvas.height, size = 9 * z;
  ctx.globalAlpha = ga * 0.7;
  for (const c of cities) {
    if (!c.alive) continue;
    for (const i of c.cells) {
      const b = world.bld[i];
      if (!b || bldType(b) === T_FARM) continue;
      const x = ox + ((i % world.W) + 0.5) * SUB * z, y = oy + (((i / world.W) | 0) + 0.6) * SUB * z;
      if (x < -size || y < -size || x > cw + size || y > ch + size) continue;
      ctx.drawImage(glow, x - size / 2, y - size / 2, size, size);
    }
  }
}
