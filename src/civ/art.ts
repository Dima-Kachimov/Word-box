// Мультяшні малюнки цивілізацій: жителі (раса + одяг кольору королівства +
// інструмент професії) і будівлі кожної раси. Будівлі малюються в коробці
// дерев (9×11 одиниць, основа на y≈10.4) — їх запікає render/vegetation.ts.

import { Painter, volume, blob, shade, tint, INK, TAU } from '../render/cartoon';
import { LodSprite } from '../render/sprite';
import { RACES, type RaceId } from './races';
import { T_HALL, T_CASTLE, T_HUT, T_HOUSE, T_TOWER, T_FARM } from './buildings';
import type { Job } from './types';

// ---------------------------------------------------------------- жителі
/** Коробка жителя в одиницях малюнка. */
export const PW = 6, PH = 9;
/** Світових пікселів на одиницю малюнка жителя. */
export const P_SCALE = 0.62;

function person(g: CanvasRenderingContext2D, race: RaceId, cloth: string, job: Job, pose: 0 | 1): void {
  const r = RACES[race], p = new Painter(0.36);
  const dwarf = race === 2, orc = race === 3, elf = race === 1;
  const top = dwarf ? 2.6 : 1.6, bodyY = dwarf ? 6.0 : 5.6;
  const sw = pose === 1 ? 0.55 : -0.55;
  // ноги
  const pants = shade(cloth, 0.55);
  p.line([2.5, bodyY + 1.2, 2.5 - sw, 8.6], 0.8, pants).line([3.5, bodyY + 1.2, 3.5 + sw, 8.6], 0.8, pants);
  // плащ короля
  if (job === 'king') p.shape(g2 => { g2.moveTo(1.6, bodyY - 1.4); g2.lineTo(0.6, 8.2); g2.lineTo(3.0, 8.0); g2.closePath(); }, '#c8243a');
  // інструмент за спиною/у руці
  const tool = (fn: () => void) => fn();
  if (job === 'woodcutter') tool(() => { p.line([4.6, bodyY + 1.4, 5.4, bodyY - 1.8], 0.35, '#8a5a32'); p.poly([5.0, bodyY - 2.2, 6.0, bodyY - 1.6, 5.3, bodyY - 0.9], '#b8c0c8'); });
  if (job === 'miner') tool(() => { p.line([4.6, bodyY + 1.4, 5.3, bodyY - 1.8], 0.35, '#8a5a32'); p.shape(g2 => { g2.moveTo(4.2, bodyY - 1.9); g2.quadraticCurveTo(5.3, bodyY - 2.6, 6.2, bodyY - 1.5); g2.lineTo(5.3, bodyY - 1.8); g2.closePath(); }, '#9aa2aa'); });
  if (job === 'builder') tool(() => { p.line([4.6, bodyY + 1.0, 5.2, bodyY - 1.2], 0.35, '#8a5a32'); p.ell(5.25, bodyY - 1.4, 0.7, 0.4, '#6a6e74', { rot: -0.3 }); });
  if (job === 'hunter') tool(() => { p.line([4.8, bodyY + 1.6, 5.1, bodyY - 2.6], 0.3, '#8a5a32'); p.poly([4.7, bodyY - 2.6, 5.5, bodyY - 2.6, 5.1, bodyY - 3.5], '#d0d4d8'); });
  if (job === 'warrior') {
    if (!elf) tool(() => { p.line([4.9, bodyY + 1.8, 4.9, bodyY - 3.2], 0.35, '#8a5a32'); p.poly([4.5, bodyY - 3.1, 5.3, bodyY - 3.1, 4.9, bodyY - 4.3], '#e0e4e8'); });
  }
  // тулуб
  p.ell(3, bodyY, dwarf ? 1.9 : 1.55, dwarf ? 1.9 : 1.9, volume(cloth, 3, bodyY, 2, 0.35, 0.75));
  // голова
  const skin = r.skin, headR = dwarf ? 1.45 : 1.35, hy = top + headR;
  if (elf) p.poly([3.9, hy - 0.2, 5.4, hy - 1.3, 4.2, hy + 0.5], skin);
  p.circ(3.2, hy, headR, volume(skin, 3.2, hy, headR, 0.3, 0.8), { sep: true });
  p.render(g);
  // волосся / шапка
  g.fillStyle = r.hair;
  if (job === 'warrior') {
    g.fillStyle = '#9aa4ae';
    g.beginPath(); g.arc(3.2, hy - 0.1, headR + 0.12, Math.PI, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.28; g.stroke();
  } else if (job === 'farmer') {
    g.fillStyle = '#f2d06a';
    g.beginPath(); g.ellipse(3.2, hy - 0.7, 2.1, 0.5, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(3.2, hy - 1.0, 1.1, 0.7, 0, Math.PI, TAU); g.fill();
    g.strokeStyle = INK; g.lineWidth = 0.22; g.beginPath(); g.ellipse(3.2, hy - 0.7, 2.1, 0.5, 0, 0, TAU); g.stroke();
  } else if (job === 'miner') {
    g.fillStyle = '#e8b830';
    g.beginPath(); g.arc(3.2, hy - 0.1, headR + 0.1, Math.PI, TAU); g.fill();
    blob(g, 4.2, hy - 0.7, 0.35, 0.3, '#fff6b0');
  } else {
    g.beginPath(); g.arc(3.2, hy - 0.2, headR * 0.95, Math.PI * 1.05, TAU - 0.1); g.fill();
    if (elf) { g.beginPath(); g.ellipse(2.2, hy + 0.3, 0.7, 1.4, 0.2, 0, TAU); g.fill(); }
  }
  if (job === 'king') {
    g.fillStyle = '#ffd23c'; g.strokeStyle = INK; g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(2.0, hy - 1.0); g.lineTo(2.2, hy - 2.3); g.lineTo(2.8, hy - 1.6); g.lineTo(3.2, hy - 2.6); g.lineTo(3.6, hy - 1.6); g.lineTo(4.2, hy - 2.3); g.lineTo(4.4, hy - 1.0); g.closePath();
    g.fill(); g.stroke();
  }
  // борода гнома
  if (dwarf) { g.fillStyle = r.hair; g.beginPath(); g.moveTo(2.6, hy + 0.3); g.quadraticCurveTo(4.8, hy + 0.4, 4.2, hy + 2.9); g.quadraticCurveTo(3.0, hy + 2.0, 2.6, hy + 0.3); g.fill(); }
  // око
  blob(g, 3.9, hy - 0.05, 0.28, 0.32, INK);
  // ікла орка
  if (orc) { g.fillStyle = '#fbfbf0'; g.beginPath(); g.moveTo(3.9, hy + 0.7); g.lineTo(4.15, hy + 0.1); g.lineTo(4.35, hy + 0.7); g.fill(); }
  // лук ельфа-воїна
  if (elf && job === 'warrior') {
    g.strokeStyle = '#8a5a32'; g.lineWidth = 0.35; g.beginPath(); g.arc(4.0, bodyY - 0.4, 2.0, -1.2, 1.2); g.stroke();
    g.strokeStyle = '#f4efe0'; g.lineWidth = 0.15; g.beginPath(); g.moveTo(4.72, bodyY - 2.26); g.lineTo(4.72, bodyY + 1.46); g.stroke();
  }
}

const personCache = new Map<string, LodSprite>();
export function personSprite(race: RaceId, cloth: string, job: Job, pose: 0 | 1): LodSprite {
  const key = race + cloth + job + pose;
  let s = personCache.get(key);
  if (!s) { s = new LodSprite(PW, PH, 1.2, g => person(g, race, cloth, job, pose)); personCache.set(key, s); }
  return s;
}

// ---------------------------------------------------------------- будівлі
const GROUND = 10.4;

function shadowB(g: CanvasRenderingContext2D, w: number): void {
  blob(g, 4.5, GROUND - 0.1, w, 0.9, 'rgba(20,20,10,0.3)');
}

function door(p: Painter, x: number, w: number, h: number, c = '#6a4428'): void {
  p.shape(g => { g.moveTo(x - w / 2, GROUND); g.lineTo(x - w / 2, GROUND - h + w / 2); g.arc(x, GROUND - h + w / 2, w / 2, Math.PI, TAU); g.lineTo(x + w / 2, GROUND); g.closePath(); }, c, { sep: true });
}
function windows(g: CanvasRenderingContext2D, pts: [number, number][], s = 0.55): void {
  for (const [x, y] of pts) {
    g.fillStyle = '#ffe9a0'; g.strokeStyle = INK; g.lineWidth = 0.2;
    g.beginPath(); g.rect(x - s / 2, y - s / 2, s, s); g.fill(); g.stroke();
  }
}

/** Дах за стилем раси над прямокутником x0..x1 на висоті y. */
function roof(p: Painter, race: RaceId, x0: number, x1: number, y: number, h: number): void {
  const r = RACES[race], f = volume(r.roof, (x0 + x1) / 2, y - h / 2, (x1 - x0) / 2, 0.3, 0.75);
  if (race === 0) p.poly([x0 - 0.6, y, (x0 + x1) / 2, y - h, x1 + 0.6, y], f, { sep: true });
  else if (race === 1) p.shape(g => g.ellipse((x0 + x1) / 2, y, (x1 - x0) / 2 + 0.7, h * 0.9, 0, Math.PI, TAU), f, { sep: true });
  else if (race === 2) p.poly([x0 - 0.5, y, x0 + 0.6, y - h * 0.7, x1 - 0.6, y - h * 0.7, x1 + 0.5, y], f, { sep: true });
  else p.poly([x0 - 0.8, y + 0.2, (x0 + x1) / 2, y - h * 1.1, x1 + 0.8, y + 0.2], f, { sep: true });
}

function walls(p: Painter, race: RaceId, x0: number, x1: number, y: number): void {
  const r = RACES[race];
  p.poly([x0, GROUND, x0, y, x1, y, x1, GROUND], volume(r.wall, (x0 + x1) / 2, (y + GROUND) / 2, (x1 - x0), 0.25, 0.8));
}

function tent(p: Painter, race: RaceId, x0: number, x1: number, top: number): void {
  const r = RACES[race];
  p.poly([x0, GROUND, (x0 + x1) / 2, top, x1, GROUND], volume(r.wall, (x0 + x1) / 2, (top + GROUND) / 2, x1 - x0, 0.3, 0.75));
}

function tentDetails(g: CanvasRenderingContext2D, x0: number, x1: number, top: number): void {
  const cx = (x0 + x1) / 2;
  g.strokeStyle = '#5a3a1e'; g.lineWidth = 0.3;
  for (const t of [0.35, 0.65]) { g.beginPath(); g.moveTo(cx + (x0 - cx) * t, top + (GROUND - top) * t); g.lineTo(cx + (x1 - cx) * t, top + (GROUND - top) * t); g.stroke(); }
  g.strokeStyle = '#f4efe0'; g.lineWidth = 0.35;
  g.beginPath(); g.moveTo(cx - 0.6, top - 1.0); g.lineTo(cx, top + 0.2); g.lineTo(cx + 0.6, top - 1.0); g.stroke();
  g.fillStyle = '#3a2418'; g.beginPath(); g.moveTo(cx - 0.8, GROUND); g.lineTo(cx, GROUND - 2.4); g.lineTo(cx + 0.8, GROUND); g.fill();
}

function timber(g: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  g.strokeStyle = '#8a5a32'; g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(x0, y + 0.4); g.lineTo(x1, y + 0.4); g.moveTo(x0 + 0.3, y); g.lineTo(x0 + 0.3, GROUND); g.moveTo(x1 - 0.3, y); g.lineTo(x1 - 0.3, GROUND); g.stroke();
}
function stoneLines(g: CanvasRenderingContext2D, x0: number, x1: number, y: number): void {
  g.strokeStyle = 'rgba(60,60,70,0.45)'; g.lineWidth = 0.18;
  for (let yy = y + 1; yy < GROUND; yy += 1) { g.beginPath(); g.moveTo(x0 + 0.1, yy); g.lineTo(x1 - 0.1, yy); g.stroke(); }
}

function crenel(p: Painter, x0: number, x1: number, y: number, col: string): void {
  for (let x = x0; x < x1 - 0.3; x += 1.0) p.poly([x, y, x, y - 0.8, x + 0.6, y - 0.8, x + 0.6, y], col, { outline: false });
}

export function drawBuilding(g: CanvasRenderingContext2D, race: RaceId, type: number): void {
  const r = RACES[race];
  if (type === T_FARM) { drawFarm(g, race); return; }
  const p = new Painter(0.38);
  switch (type) {
    case T_HUT:
      shadowB(g, 3.2);
      if (race === 3) { tent(p, race, 1.6, 7.4, 5.2); p.render(g); tentDetails(g, 1.6, 7.4, 5.2); return; }
      walls(p, race, 2.0, 7.0, 7.4); roof(p, race, 2.0, 7.0, 7.4, 2.8); door(p, 4.5, 1.2, 1.9);
      p.render(g);
      if (race === 0) timber(g, 2.0, 7.0, 7.4);
      if (race === 2) stoneLines(g, 2.0, 7.0, 7.4);
      windows(g, [[5.9, 8.6]]);
      return;
    case T_HOUSE:
      shadowB(g, 3.8);
      if (race === 3) { tent(p, race, 0.8, 8.2, 3.6); p.render(g); tentDetails(g, 0.8, 8.2, 3.6); return; }
      walls(p, race, 1.2, 7.8, 6.2);
      p.poly([6.0, 5.4, 6.0, 3.2, 6.9, 3.2, 6.9, 5.4], '#8a6a5a');
      roof(p, race, 1.2, 7.8, 6.2, 3.4); door(p, 3.2, 1.3, 2.2);
      p.render(g);
      if (race === 0) timber(g, 1.2, 7.8, 6.2);
      if (race === 2) stoneLines(g, 1.2, 7.8, 6.2);
      windows(g, [[5.6, 8.4], [6.9, 8.4], [5.6, 7.2]]);
      return;
    case T_TOWER:
      shadowB(g, 3.4);
      if (race === 3) {
        p.line([2.2, GROUND, 3.0, 3.6], 0.6, '#6a4424').line([6.8, GROUND, 6.0, 3.6], 0.6, '#6a4424');
        p.poly([1.6, 4.2, 7.4, 4.2, 7.0, 1.8, 2.0, 1.8], '#8a5a32'); p.poly([2.4, 1.8, 4.5, -0.6, 6.6, 1.8], '#6a4424');
        p.render(g);
        g.strokeStyle = '#f4efe0'; g.lineWidth = 0.3;
        for (const x of [2.2, 3.6, 5.0, 6.4]) { g.beginPath(); g.moveTo(x, 4.2); g.lineTo(x, 5.2); g.stroke(); }
        return;
      }
      walls(p, race, 2.2, 6.8, 2.8);
      roof(p, race, 2.2, 6.8, 2.8, race === 2 ? 1.6 : 3.2);
      door(p, 4.5, 1.2, 1.9);
      p.render(g);
      if (race === 2) stoneLines(g, 2.2, 6.8, 2.8);
      if (race === 0) timber(g, 2.2, 6.8, 2.8);
      windows(g, [[3.4, 4.4], [5.6, 4.4], [3.4, 6.2], [5.6, 6.2], [3.4, 8.0], [5.6, 8.0]], 0.6);
      return;
    case T_HALL:
      shadowB(g, 4.2);
      if (race === 3) { tent(p, race, 0.2, 8.8, 2.8); p.line([4.5, 2.8, 4.5, 0.4], 0.3, '#5a3a1e'); p.render(g); tentDetails(g, 0.2, 8.8, 2.8); blob(g, 4.5, 5.6, 0.8, 0.7, '#f4efe0'); blob(g, 4.2, 5.5, 0.18, 0.18, INK); blob(g, 4.8, 5.5, 0.18, 0.18, INK); return; }
      walls(p, race, 0.6, 8.4, 6.0);
      roof(p, race, 0.6, 8.4, 6.0, 3.0);
      p.line([4.5, 3.4, 4.5, 0.2], 0.3, '#5a3a1e');
      door(p, 4.5, 1.8, 2.6, '#5a3a1e');
      p.render(g);
      if (race === 0) timber(g, 0.6, 8.4, 6.0);
      if (race === 2) stoneLines(g, 0.6, 8.4, 6.0);
      windows(g, [[2.0, 7.8], [7.0, 7.8]], 0.7);
      return;
    case T_CASTLE: {
      shadowB(g, 4.6);
      const stone = race === 2 ? r.wall : race === 3 ? '#8a7a6a' : '#b8b4ae';
      const f = volume(stone, 4.5, 6, 6, 0.25, 0.78);
      p.poly([0.2, GROUND, 0.2, 3.6, 2.4, 3.6, 2.4, GROUND], f);
      p.poly([6.6, GROUND, 6.6, 3.6, 8.8, 3.6, 8.8, GROUND], f);
      p.poly([1.8, GROUND, 1.8, 5.4, 7.2, 5.4, 7.2, GROUND], f);
      p.poly([3.4, 5.4, 3.4, 1.8, 5.6, 1.8, 5.6, 5.4], f, { sep: true });
      roof(p, race, 3.4, 5.6, 1.8, 2.0);
      p.poly([0.0, 3.6, 1.3, 1.6, 2.6, 3.6], volume(r.roof, 1.3, 2.6, 1.5), { sep: true });
      p.poly([6.4, 3.6, 7.7, 1.6, 9.0, 3.6], volume(r.roof, 7.7, 2.6, 1.5), { sep: true });
      p.line([4.5, -0.2, 4.5, -2.0], 0.28, '#5a3a1e');
      door(p, 4.5, 1.9, 2.8, '#4a2e1a');
      p.render(g);
      stoneLines(g, 1.8, 7.2, 5.4);
      const cr = new Painter(0.2); crenel(cr, 1.8, 3.4, 5.4, stone); crenel(cr, 5.6, 7.2, 5.4, stone); cr.render(g);
      windows(g, [[1.3, 5.2], [7.7, 5.2], [4.5, 3.4]], 0.6);
      return;
    }
  }
}

function drawFarm(g: CanvasRenderingContext2D, race: RaceId): void {
  const soil = race === 3 ? '#8a6a44' : '#9a7048';
  g.fillStyle = shade(soil, 0.8);
  g.beginPath(); g.ellipse(4.5, 8.9, 4.4, 2.2, 0, 0, TAU); g.fill();
  g.fillStyle = soil;
  g.beginPath(); g.ellipse(4.5, 8.7, 4.2, 2.0, 0, 0, TAU); g.fill();
  const crop = race === 1 ? '#7cd35a' : race === 2 ? '#d8b040' : race === 3 ? '#a8a040' : '#e8c440';
  g.strokeStyle = shade(soil, 0.65); g.lineWidth = 0.25;
  for (let y = 7.2; y <= 10.2; y += 0.9) {
    const w = Math.sqrt(Math.max(0, 1 - ((y - 8.7) / 2) ** 2)) * 4.0;
    g.beginPath(); g.moveTo(4.5 - w, y); g.lineTo(4.5 + w, y); g.stroke();
    for (let x = 4.5 - w + 0.5; x < 4.5 + w - 0.3; x += 0.9) {
      g.fillStyle = shade(crop, 0.8); g.beginPath(); g.ellipse(x, y - 0.35, 0.32, 0.5, 0, 0, TAU); g.fill();
      g.fillStyle = tint(crop, 0.25); g.beginPath(); g.ellipse(x - 0.08, y - 0.5, 0.18, 0.28, 0, 0, TAU); g.fill();
    }
  }
}

/** Прапор королівства (малюється щокадру над ратушею/замком, бо колір свій у кожного). */
export function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, wave: number): void {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + 1.6 * s, y - 0.4 * s + wave * s, x + 3.2 * s, y + 0.1 * s);
  ctx.lineTo(x + 3.2 * s, y + 1.9 * s);
  ctx.quadraticCurveTo(x + 1.6 * s, y + 1.5 * s + wave * s, x, y + 1.9 * s);
  ctx.closePath();
  ctx.fillStyle = color; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, 0.3 * s);
  ctx.fill(); ctx.stroke();
}
