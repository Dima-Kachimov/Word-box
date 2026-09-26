// Головний прохід рендера видимого canvas: буфер ландшафту → тіні хмар →
// ударні хвилі → тварини (земля) → смерчі → частинки → метеори → тварини
// (небо) → хмари → ніч/тепле світло → блискавки → спалах → курсор.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SUB, K } from '../world/constants';
import { view } from './context';
import { camera } from './camera';
import { tileBuffer, lights } from './buffer';
import { clock } from '../sim/clock';
import { particles } from '../sim/particles';
import { clouds } from '../sim/clouds';
import { tornados, meteors, bolts, waves } from '../sim/events';
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
  ctx.fillStyle = 'rgb(18,44,102)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const shx = clock.shake ? (rnd() - 0.5) * clock.shake : 0, shy = clock.shake ? (rnd() - 0.5) * clock.shake : 0;
  clock.shake *= 0.86; if (clock.shake < 0.3) clock.shake = 0;
  const ox = Math.round(camera.camX + shx), oy = Math.round(camera.camY + shy), z = camera.zoom;
  // Рельєф масштабується зі згладжуванням — м'які переходи кольору замість
  // чітких квадратів (менш "ретро-піксельний", ближче до мультяшного вигляду
  // WorldBox). Персонажі/UI-спрайти нижче навмисно лишаються різкими.
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tileBuffer.canvas, ox, oy, Math.round(world.BW * z), Math.round(world.BH * z));
  ctx.imageSmoothingEnabled = false;

  // тіні хмар
  for (const cl of clouds) {
    ctx.globalAlpha = cl.alpha * 0.28;
    ctx.drawImage(cl.sp.s, ox + (cl.x + 10 * K) * z, oy + (cl.y + 16 * K) * z, cl.w * z, cl.h * z);
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
  for (const t of tornados) {
    const a = Math.min(1, t.life / 60, (t.max - t.life) / 30);
    const bx = t.x * SUB, by = t.y * SUB;
    ctx.globalAlpha = 0.28 * a; ctx.fillStyle = '#000';
    ctx.fillRect(ox + (bx - 4 * K) * z, oy + (by - K) * z, 8 * K * z, 3 * K * z);
    for (let k = 0; k < 14; k++) {
      const w = (2 + k * 0.85) * K, sway = Math.sin(t.ph + k * 0.45) * k * 0.35 * K, yy = by - k * 2.2 * K;
      ctx.globalAlpha = 0.85 * a;
      ctx.fillStyle = k % 2 ? '#c6ccd4' : '#e9ecf0';
      ctx.fillRect(Math.round(ox + (bx - w / 2 + sway) * z), Math.round(oy + (yy - 2.2 * K) * z), Math.ceil(w * z), Math.ceil(2.3 * K * z));
    }
  }
  ctx.globalAlpha = 1;

  // частинки
  for (const p of particles) {
    const a = p.life / p.max, sx = ox + p.x * z, sy = oy + p.y * z;
    switch (p.kind) {
      case 'rain': ctx.globalAlpha = 0.85; ctx.fillStyle = '#9fd4ff'; ctx.fillRect(sx, sy, Math.max(1, z * 0.6), z * 2.6); break;
      case 'splash': ctx.globalAlpha = a; ctx.fillStyle = '#d8eeff'; ctx.fillRect(sx - z, sy, Math.max(1, z * 0.7), Math.max(1, z * 0.7)); ctx.fillRect(sx + z, sy, Math.max(1, z * 0.7), Math.max(1, z * 0.7)); break;
      case 'snow': ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, Math.max(1, z * 0.9), Math.max(1, z * 0.9)); break;
      case 'smoke': { ctx.globalAlpha = 0.42 * a; ctx.fillStyle = '#666a6e'; const s = z * (1.5 + (1 - a) * 2.5); ctx.fillRect(sx, sy, s, s); break; }
      case 'steam': { ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#eef3f7'; const s = z * (1.2 + (1 - a) * 2.5); ctx.fillRect(sx, sy, s, s); break; }
      case 'ember': ctx.globalAlpha = a; ctx.fillStyle = a > 0.5 ? '#ffd24a' : '#ff6a1e'; ctx.fillRect(sx, sy, Math.max(1, z * 0.8), Math.max(1, z * 0.8)); break;
      case 'spark': ctx.globalAlpha = a; ctx.fillStyle = p.c || '#fff'; ctx.fillRect(sx, sy, Math.max(1, z * 0.8), Math.max(1, z * 0.8)); break;
      case 'dust': ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#c2ad86'; ctx.fillRect(sx, sy, z, z); break;
      default: ctx.globalAlpha = Math.min(1, a * 1.4); ctx.fillStyle = p.c || '#fff'; ctx.fillRect(sx, sy, z, z);
    }
  }
  ctx.globalAlpha = 1;

  // метеори
  for (const m of meteors) {
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(glowSpr, ox + (m.x - 6 * K) * z, oy + (m.y - 6 * K) * z, 12 * K * z, 12 * K * z);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#4a3a34'; ctx.fillRect(ox + (m.x - 1.5 * K) * z, oy + (m.y - 1.5 * K) * z, 3 * K * z, 3 * K * z);
    ctx.fillStyle = '#ffb347'; ctx.fillRect(ox + (m.x - 1.5 * K) * z, oy + (m.y + 0.5 * K) * z, 3 * K * z, K * z);
  }

  drawAnimals(ox, oy, z, 'sky');

  // хмари
  for (const cl of clouds) {
    ctx.globalAlpha = cl.alpha;
    ctx.drawImage(cl.sp.c, ox + cl.x * z, oy + cl.y * z, cl.w * z, cl.h * z);
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
    ctx.imageSmoothingEnabled = true;
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
    ctx.imageSmoothingEnabled = false;
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
