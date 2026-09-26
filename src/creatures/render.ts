// Малювання істот на видимому canvas (не на текстурному буфері світу) —
// самі тварини рендеряться як окремі спрайти поверх буфера ландшафту.

import { world, tileAt } from '../world/state';
import { SUB, C_ICE } from '../world/constants';
import { view } from '../render/context';
import { camera } from '../render/camera';
import { animals, creatureState } from './animal';
import type { Animal } from './types';
import { EMO } from './emotes';

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
    let dy = by - h + 1;
    if (S.hop && moving) dy -= Math.abs(Math.sin(a.t * 1.6)) * 2;
    if ((a.state === 'eat' || a.state === 'drink' || a.state === 'feast') && (fc >> 3) % 2) dy += 1;
    if (S.kind === 'sea') {
      const i = tileAt(a.x, a.y);
      if (i >= 0 && world.cover[i] === C_ICE) continue;
      if (a.jump) { dy -= Math.sin(a.jump * Math.PI) * 10; ctx.globalAlpha = 1; }
      else ctx.globalAlpha = S.key === 'whale' ? 0.82 : 0.66;
    } else if (S.kind === 'sky') {
      const alt = a.alt !== undefined ? a.alt : S.alt!;
      ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(ox + (dx + 2) * z), Math.round(oy + (by + 2) * z), Math.max(1, Math.round((w - 1) * z)), Math.max(1, Math.round(z * 1.5)));
      dy -= alt; ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.fillRect(Math.round(ox + (dx + 1) * z), Math.round(oy + by * z), Math.max(1, Math.round((w - 2) * z)), Math.max(1, Math.round(z * 1.5)));
      ctx.globalAlpha = 1;
    }
    if (a.z) dy -= a.z;
    const flip = a.state === 'tossed' ? (Math.floor(a.t) % 2) : (a.dir < 0 ? 1 : 0);
    const lying = S.lie && (a.state === 'sleep' || a.state === 'rest' || a.state === 'lurk');
    const img = lying ? S.lie![a.pal][flip] : S.imgs[a.pal][f][flip];
    ctx.drawImage(img, Math.round(ox + dx * z), Math.round(oy + dy * z), Math.max(1, Math.round(w * z)), Math.max(1, Math.round(h * z)));
    ctx.globalAlpha = 1;
    if (a === creatureState.selected) {
      ctx.strokeStyle = '#ffe45c'; ctx.lineWidth = Math.max(1, z * 0.6);
      ctx.beginPath(); ctx.ellipse(ox + bx * z, oy + (by + 0.5) * z, (w * 0.6 + 1) * z, 2.5 * z, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (showEmo || a === creatureState.selected) {
      const e = emoteOf(a);
      if (e) {
        const img2 = EMO[e], ew = img2.width, eh = img2.height;
        const ex = bx - ew / 2, ey = dy - eh - 2 - ((fc >> 4) % 2);
        ctx.globalAlpha = 0.55; ctx.fillStyle = '#000';
        ctx.fillRect(Math.round(ox + (ex - 1) * z), Math.round(oy + (ey - 1) * z), Math.round((ew + 2) * z), Math.round((eh + 2) * z));
        ctx.globalAlpha = 1;
        ctx.drawImage(img2, Math.round(ox + ex * z), Math.round(oy + ey * z), Math.round(ew * z), Math.round(eh * z));
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
    ctx.fillRect(sx - z * 0.5, sy - z * 0.5, Math.max(1, z), Math.max(1, z));
  }
  ctx.globalAlpha = 1;
}
