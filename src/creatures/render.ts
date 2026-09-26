// Малювання істот на видимому canvas (не на текстурному буфері світу) —
// самі тварини рендеряться як окремі спрайти поверх буфера ландшафту.

import { world, tileAt } from '../world/state';
import { SUB, C_ICE } from '../world/constants';
import { view } from '../render/context';
import { camera } from '../render/camera';
import { animals, creatureState } from './animal';
import type { Animal } from './types';
import { EMO, EMO_W, EMO_H } from './emotes';
import { ART_SCALE } from './species';

export const STATE_TXT: Record<string, string> = {
  wander: 'Гуляє', eat: 'Їсть', toFood: 'Шукає їжу', drink: 'П\'є воду', toWater: 'Йде до води', sleep: 'Спить',
  rest: 'Відпочиває', flee: 'Тікає!', stalk: 'Підкрадається до', chase: 'Женеться за', feast: 'Їсть здобич', lurk: 'Чатує в засідці',
  tossed: 'Летить у смерчі!', mate: 'Залицяється', follow: 'Йде за мамою', dive: 'Пікірує на', climb: 'Набирає висоту', circle: 'Кружляє'
};

export const glowG: HTMLCanvasElement = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(230,255,140,1)'); gr.addColorStop(0.35, 'rgba(170,255,80,0.35)'); gr.addColorStop(1, 'rgba(120,255,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return c;
})();

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, alpha: number): void {
  ctx.globalAlpha = alpha; ctx.fillStyle = '#1a1020';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

export function emoteOf(a: Animal): string | null {
  if (a.emoT > 0 && a.emo) return a.emo;
  switch (a.state) {
    case 'flee': return 'alarm';
    case 'chase': case 'dive': return 'angry';
    case 'sleep': return 'zzz';
    case 'rest': return a.S.eats ? 'zzz' : null;
    case 'drink': return 'drop';
    case 'eat': return 'leaf';
    case 'feast': return 'meat';
    case 'mate': return 'heart';
  }
  return null;
}

export function drawAnimals(ox: number, oy: number, z: number, pass: 'ground' | 'sky'): void {
  const ctx = view.ctx, cw = view.canvas.width, ch = view.canvas.height, showEmo = camera.zoom > camera.fitZ * 1.25;
  const fc = creatureState.fc;
  for (const a of animals) {
    const S = a.S;
    if (S.key === 'firefly') continue;
    if ((pass === 'sky') !== (S.kind === 'sky')) continue;
    const bx = a.x * SUB, by = a.y * SUB, sx0 = ox + bx * z, sy0 = oy + by * z;
    if (sx0 < -100 || sy0 < -100 || sx0 > cw + 100 || sy0 > ch + 100 + (S.alt || 0) * z) continue;
    const moving = S.kind === 'sky' || Math.abs(a.vx) + Math.abs(a.vy) > 0.001 || a.state === 'tossed';
    let f = moving ? Math.floor(a.t) % 2 : 0;
    if (S.key === 'eagle') f = a.state === 'dive' ? 1 : Math.floor(a.t) % 4 === 0 ? 1 : 0;
    const scale = a.baby > 0 ? 0.6 : 1, w = S.w * scale, h = S.h * scale;
    const dx = bx - w / 2;
    let dy = by - h + 0.6;
    if (S.hop && moving) dy -= Math.abs(Math.sin(a.t * 1.6)) * 2;
    if ((a.state === 'eat' || a.state === 'drink' || a.state === 'feast') && (fc >> 3) % 2) dy += 0.6;
    if (S.kind === 'sea') {
      const i = tileAt(a.x, a.y);
      if (i >= 0 && world.cover[i] === C_ICE) continue;
      if (a.jump) { dy -= Math.sin(a.jump * Math.PI) * 10; ctx.globalAlpha = 1; }
      else ctx.globalAlpha = S.key === 'whale' ? 0.82 : 0.7;
    } else if (S.kind === 'sky') {
      const alt = a.alt !== undefined ? a.alt : S.alt!;
      shadow(ctx, ox + (bx + 2) * z, oy + (by + 2) * z, w * 0.4 * z, w * 0.14 * z, 0.18);
      dy -= alt;
    } else {
      shadow(ctx, ox + bx * z, oy + (by + 0.2) * z, w * 0.42 * z, Math.max(w * 0.12, 1) * z, 0.26);
    }
    if (a.z) dy -= a.z;
    const flip = a.state === 'tossed' ? (Math.floor(a.t) % 2) === 1 : a.dir < 0;
    const lying = S.lie && (a.state === 'sleep' || a.state === 'rest' || a.state === 'lurk');
    const img = lying ? S.lie![a.pal] : S.imgs[a.pal][f];
    img.blit(ctx, ox + dx * z, oy + dy * z, ART_SCALE * scale * z, flip);
    ctx.globalAlpha = 1;
    if (a === creatureState.selected) {
      ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = Math.max(1.5, z * 0.6);
      ctx.beginPath(); ctx.ellipse(ox + bx * z, oy + (by + 0.3) * z, (w * 0.6 + 1) * z, (w * 0.18 + 1.2) * z, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (showEmo || a === creatureState.selected) {
      const e = emoteOf(a);
      if (e) {
        const ex = bx - EMO_W / 2 + a.dir * w * 0.2, ey = dy - EMO_H - 0.5 - ((fc >> 4) % 2) * 0.6;
        EMO[e].blit(ctx, ox + ex * z, oy + ey * z, z);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawFireflies(ox: number, oy: number, z: number, dark: number): void {
  const ctx = view.ctx;
  for (const a of animals) {
    if (a.S.key !== 'firefly') continue;
    const b = 0.5 + 0.5 * Math.sin(a.t * 1.3 + a.phase);
    if (b < 0.15) continue;
    const sx = ox + a.x * SUB * z, sy = oy + (a.y * SUB - 4) * z;
    ctx.globalAlpha = b * Math.min(1, dark * 1.8);
    ctx.drawImage(glowG, sx - 4 * z, sy - 4 * z, 8 * z, 8 * z);
    ctx.fillStyle = '#f4ffb0';
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(1, z * 0.6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
