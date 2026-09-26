// Головний прохід рендера видимого canvas: буфер ландшафту → тіні хмар →
// ударні хвилі → тварини (земля) → смерчі → частинки → метеори → тварини
// (небо) → хмари → ніч/тепле світло → блискавки → спалах → курсор.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SUB, K } from '../world/constants';
import { view } from './context';
import { camera } from './camera';
import { lights, worldImage, composeWorld, isHiDetail } from './buffer';
import { drawVegetationHi } from './vegetation';
import { clock } from '../sim/clock';
import { particles } from '../sim/particles';
import { clouds } from '../sim/clouds';
import { tornados, meteors, bolts, waves } from '../sim/events';
import type { Tornado, Meteor } from '../sim/events';
import { INK, TAU } from './cartoon';
import { drawAnimals, drawFireflies } from '../creatures/render';
import { uiState } from '../ui/state';
import { shotCd } from '../sim/tools';

const glowSpr: HTMLCanvasElement = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.35, 'rgba(255,110,30,0.45)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return c;
})();

export function render(): void {
  const ctx = view.ctx, canvas = view.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgb(24,62,138)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shx = clock.shake ? (rnd() - 0.5) * clock.shake : 0, shy = clock.shake ? (rnd() - 0.5) * clock.shake : 0;
  clock.shake *= 0.86; if (clock.shake < 0.3) clock.shake = 0;
  const ox = Math.round(camera.camX + shx), oy = Math.round(camera.camY + shy), z = camera.zoom;
  const mw = Math.round(world.BW * z), mh = Math.round(world.BH * z);
  // Мультяшна графіка — усе малюється зі згладжуванням.
  ctx.imageSmoothingEnabled = true;
  const hi = isHiDetail();
  if (hi !== worldImage.hi) composeWorld(hi);
  ctx.drawImage(worldImage.canvas, ox, oy, mw, mh);
  if (hi) drawVegetationHi(ctx, ox, oy, z, clock.frame, performance.now());

  // тіні хмар
  for (const cl of clouds) {
    ctx.globalAlpha = cl.alpha * 0.28;
    cl.sp.s.blit(ctx, ox + (cl.x + 10 * K) * z, oy + (cl.y + 16 * K) * z, z);
  }
  ctx.globalAlpha = 1;

  // ударні хвилі
  for (const w of waves) {
    const a = w.life / w.max;
    ctx.strokeStyle = `rgba(255,236,200,${0.8 * a})`;
    ctx.lineWidth = Math.max(1, z * 1.2);
    ctx.beginPath(); ctx.arc(ox + w.x * z, oy + w.y * z, w.r * z, 0, Math.PI * 2); ctx.stroke();
  }

  drawAnimals(ox, oy, z, 'ground');

  // смерчі
  for (const t of tornados) drawTornado(ctx, t, ox, oy, z);
  ctx.globalAlpha = 1;

  drawParticles(ctx, ox, oy, z);

  // метеори
  for (const m of meteors) drawMeteor(ctx, m, ox, oy, z);

  drawAnimals(ox, oy, z, 'sky');

  // хмари
  for (const cl of clouds) {
    ctx.globalAlpha = cl.alpha;
    cl.sp.c.blit(ctx, ox + cl.x * z, oy + cl.y * z, z);
  }
  ctx.globalAlpha = 1;

  // сутінки/тепле світло
  if (clock.warm > 0.01) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255,120,50,${clock.warm})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (clock.dark > 0.01) {
    ctx.fillStyle = `rgba(8,14,46,${clock.dark})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    const ga = Math.min(0.9, clock.dark * 1.5);
    const step = lights.length > 1500 ? 2 : 1;
    for (let k = 0; k < lights.length; k += 3 * step) {
      const s = lights[k + 2], size = (s > 1 ? 16 : 11) * z;
      ctx.globalAlpha = ga * Math.min(1, s);
      ctx.drawImage(glowSpr, ox + lights[k] * z - size / 2, oy + lights[k + 1] * z - size / 2, size, size);
    }
    for (const m of meteors) { ctx.globalAlpha = ga; ctx.drawImage(glowSpr, ox + (m.x - 12) * z, oy + (m.y - 12) * z, 24 * z, 24 * z); }
    drawFireflies(ox, oy, z, clock.dark);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // блискавки
  for (const b of bolts) {
    const a = b.life / 10;
    for (const [pts, wmul] of [[b.pts, 1], [b.br, 0.6]] as const) {
      ctx.beginPath();
      pts.forEach((p, k) => k ? ctx.lineTo(ox + p[0] * z, oy + p[1] * z) : ctx.moveTo(ox + p[0] * z, oy + p[1] * z));
      ctx.strokeStyle = `rgba(160,185,255,${0.5 * a})`; ctx.lineWidth = 3.2 * z * wmul; ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = Math.max(1, 1.1 * z * wmul); ctx.stroke();
    }
  }
  if (clock.flash > 0.01) { ctx.fillStyle = `rgba(235,240,255,${clock.flash})`; ctx.fillRect(0, 0, canvas.width, canvas.height); clock.flash *= 0.8; }

  if (uiState.cursor) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = Math.max(1, camera.dpr);
    ctx.beginPath();
    ctx.arc(uiState.cursor.x, uiState.cursor.y, shotCd(uiState.tool) ? 6 * camera.dpr : (uiState.brushR + 0.5) * SUB * z, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** Смерч: вигнута воронка з контуром, закручені смуги й пилова хмарка біля землі. */
function drawTornado(ctx: CanvasRenderingContext2D, t: Tornado, ox: number, oy: number, z: number): void {
  const a = Math.min(1, t.life / 60, (t.max - t.life) / 30);
  if (a <= 0) return;
  const bx = t.x * SUB, by = t.y * SUB, N = 14;
  ctx.globalAlpha = 0.28 * a; ctx.fillStyle = '#1a1020';
  ctx.beginPath(); ctx.ellipse(ox + bx * z, oy + (by + 0.5 * K) * z, 5 * K * z, 1.6 * K * z, 0, 0, TAU); ctx.fill();
  const cx: number[] = [], cy: number[] = [], hw: number[] = [];
  for (let k = 0; k <= N; k++) {
    cx.push(ox + (bx + Math.sin(t.ph + k * 0.45) * k * 0.35 * K) * z);
    cy.push(oy + (by - k * 2.2 * K) * z);
    hw.push((1 + k * 0.5 + (k * k) * 0.012) * K * z);
  }
  ctx.globalAlpha = 0.92 * a;
  ctx.beginPath();
  ctx.moveTo(cx[0] - hw[0], cy[0]);
  for (let k = 1; k <= N; k++) ctx.lineTo(cx[k] - hw[k], cy[k]);
  ctx.ellipse(cx[N], cy[N], hw[N], hw[N] * 0.3, 0, Math.PI, 0, false);
  for (let k = N; k >= 0; k--) ctx.lineTo(cx[k] + hw[k], cy[k]);
  ctx.closePath();
  const gr = ctx.createLinearGradient(cx[N] - hw[N], 0, cx[N] + hw[N], 0);
  gr.addColorStop(0, '#9ea6b4'); gr.addColorStop(0.35, '#eef1f5'); gr.addColorStop(1, '#8a92a2');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, 0.9 * z); ctx.stroke();
  ctx.fillStyle = gr; ctx.fill();
  // закручені смуги
  ctx.strokeStyle = 'rgba(90,98,116,0.7)'; ctx.lineWidth = Math.max(1, 0.5 * z); ctx.lineCap = 'round';
  for (let k = 2; k < N; k += 2) {
    const ph = (t.ph * 3 + k * 0.7) % TAU;
    ctx.beginPath();
    ctx.ellipse(cx[k], cy[k], hw[k] * 0.92, hw[k] * 0.28, 0, ph * 0.3, ph * 0.3 + Math.PI * 0.8);
    ctx.stroke();
  }
  // пил біля основи
  ctx.fillStyle = '#b8a888'; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, 0.6 * z);
  for (let k = 0; k < 4; k++) {
    const ang = t.ph * 2 + k * 1.6, r = (1.2 + (k % 2) * 0.5) * K * z;
    const px = cx[0] + Math.cos(ang) * 3.2 * K * z, py = cy[0] + Math.sin(ang) * 0.8 * K * z;
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.stroke(); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Метеорит: палаючий хвіст-крапля і камінь з контуром. */
function drawMeteor(ctx: CanvasRenderingContext2D, m: Meteor, ox: number, oy: number, zc: number): void {
  // позиції — у масштабі камери, а розмір — не менший за "читабельний" на
  // екрані, щоб метеорит і мішень було видно навіть на всьому великому світі
  const z = Math.max(zc, 1.4 * camera.dpr);
  const dx = m.ex - m.sx, dy = m.ey - m.sy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const hx = ox + m.x * zc, hy = oy + m.y * zc, len = 26 * K * z, r = 2 * K * z;
  // мішень у точці падіння — видно, куди летить метеорит
  const tx0 = ox + m.ex * zc, ty0 = oy + m.ey * zc, pulse = 1 + 0.15 * Math.sin(m.t * 40);
  ctx.globalAlpha = 0.85; ctx.lineWidth = Math.max(2, 0.7 * z);
  for (const [col, w] of [[INK, ctx.lineWidth * 2.2], ['#ff5a3c', ctx.lineWidth]] as const) {
    ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.ellipse(tx0, ty0, 5 * K * z * pulse, 2.6 * K * z * pulse, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(tx0, ty0, 2 * K * z * pulse, 1 * K * z * pulse, 0, 0, TAU); ctx.stroke();
  }
  ctx.lineWidth = Math.max(2, 0.7 * z);
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.8;
  ctx.drawImage(glowSpr, hx - 7 * K * z, hy - 7 * K * z, 14 * K * z, 14 * K * z);
  ctx.globalAlpha = 1;
  const tx = hx - ux * len, ty = hy - uy * len, nx = -uy, ny = ux;
  const trail = (w: number) => {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(hx - ux * len * 0.3 + nx * w * 1.2, hy - uy * len * 0.3 + ny * w * 1.2, hx + nx * w, hy + ny * w);
    ctx.arc(hx, hy, w, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    ctx.quadraticCurveTo(hx - ux * len * 0.3 - nx * w * 1.2, hy - uy * len * 0.3 - ny * w * 1.2, tx, ty);
  };
  const g1 = ctx.createLinearGradient(tx, ty, hx, hy);
  g1.addColorStop(0, 'rgba(255,90,20,0)'); g1.addColorStop(0.5, 'rgba(255,110,30,0.85)'); g1.addColorStop(1, '#ffb347');
  trail(r * 1.9); ctx.fillStyle = g1; ctx.fill();
  const g2 = ctx.createLinearGradient(tx, ty, hx, hy);
  g2.addColorStop(0.3, 'rgba(255,230,120,0)'); g2.addColorStop(1, '#fff3b0');
  trail(r * 1.15); ctx.fillStyle = g2; ctx.fill();
  const gr = ctx.createRadialGradient(hx - r * 0.35, hy - r * 0.4, 0, hx, hy, r * 1.1);
  gr.addColorStop(0, '#8a6a58'); gr.addColorStop(0.6, '#5a4238'); gr.addColorStop(1, '#2e201a');
  ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU);
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.5, 0.8 * z); ctx.stroke();
  ctx.fillStyle = gr; ctx.fill();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath(); ctx.arc(hx + ux * r * 0.35, hy + uy * r * 0.35, r * 0.35, 0, TAU); ctx.fill();
}

/** Частинки: дощ — косі риски одним шляхом, решта — кружечки. */
function drawParticles(ctx: CanvasRenderingContext2D, ox: number, oy: number, z: number): void {
  const dot = (sx: number, sy: number, r: number) => {
    if (r < 0.9) ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill(); }
  };
  // дощ і сніг — пакетом
  ctx.beginPath();
  let rain = false;
  for (const p of particles) {
    if (p.kind !== 'rain') continue;
    const sx = ox + p.x * z, sy = oy + p.y * z;
    ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 1.4 * z, sy - p.vy * 1.4 * z);
    rain = true;
  }
  if (rain) {
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#a8dcff'; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, z * 0.55); ctx.stroke();
  }
  ctx.globalAlpha = 0.95; ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const sr = Math.max(0.8, z * 0.6);
  let snow = false;
  for (const p of particles) {
    if (p.kind !== 'snow') continue;
    const sx = ox + p.x * z, sy = oy + p.y * z;
    ctx.moveTo(sx + sr, sy); ctx.arc(sx, sy, sr, 0, TAU);
    snow = true;
  }
  if (snow) ctx.fill();
  for (const p of particles) {
    const a = p.life / p.max, sx = ox + p.x * z, sy = oy + p.y * z;
    switch (p.kind) {
      case 'rain': case 'snow': break;
      case 'splash': {
        ctx.globalAlpha = a; ctx.strokeStyle = '#e4f4ff'; ctx.lineWidth = Math.max(1, z * 0.4);
        ctx.beginPath(); ctx.ellipse(sx, sy, (1 + (1 - a) * 1.6) * z, (0.5 + (1 - a) * 0.6) * z, 0, 0, TAU); ctx.stroke();
        break;
      }
      case 'smoke': ctx.globalAlpha = 0.42 * a; ctx.fillStyle = '#6a6e74'; dot(sx, sy, z * (0.9 + (1 - a) * 1.6)); break;
      case 'steam': ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#eef3f7'; dot(sx, sy, z * (0.8 + (1 - a) * 1.6)); break;
      case 'ember': ctx.globalAlpha = a; ctx.fillStyle = a > 0.5 ? '#ffd24a' : '#ff6a1e'; dot(sx, sy, Math.max(0.6, z * 0.45)); break;
      case 'spark': ctx.globalAlpha = a; ctx.fillStyle = p.c || '#fff'; dot(sx, sy, Math.max(0.6, z * 0.45)); break;
      case 'dust': ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#c2ad86'; dot(sx, sy, z * 0.6); break;
      default: ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fillStyle = p.c || '#fff'; dot(sx, sy, Math.max(0.6, z * 0.55));
    }
  }
  ctx.globalAlpha = 1;
}
