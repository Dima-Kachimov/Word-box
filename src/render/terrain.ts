// Мультяшний рельєф. Кожен субпіксель рахується з БІЛІНІЙНО інтерпольованої
// висоти між центрами клітинок, тож береги й межі біомів виходять плавними
// кривими, а не "сходинками" з квадратів. Колір суші теж інтерполюється між
// сусідніми клітинками — біоми перетікають один в одний градієнтом.
//
// Шар статичний: перемальовується лише прямокутник, де змінилась висота
// (world/state.heightDirty) — інструменти, метеорит, застигла лава. Усе, що
// змінюється щотіку (сніг, згарище, вогонь, лава), живе в render/effects.ts.

import { world, heightDirty } from '../world/state';
import { SUB, SEA, DEEP, HILL } from '../world/constants';
import { terrainColor, col } from './palette';

export const terrainLayer = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  img: null as unknown as ImageData
};

/** Множник освітлення схилу для кожної клітинки (м'яка "тінь гір"). */
let shadeF = new Float32Array(0);
/** Наскільки вода в клітинці "тропічно-бірюзова" (від температури), 0..~0.3. */
let warm = new Float32Array(0);

export function setupTerrain(): void {
  const c = document.createElement('canvas');
  c.width = world.BW; c.height = world.BH;
  const ctx = c.getContext('2d')!;
  terrainLayer.canvas = c;
  terrainLayer.ctx = ctx;
  terrainLayer.img = ctx.createImageData(world.BW, world.BH);
  shadeF = new Float32Array(world.N);
  warm = new Float32Array(world.N);
  heightDirty.x0 = 0; heightDirty.y0 = 0; heightDirty.x1 = world.W - 1; heightDirty.y1 = world.H - 1;
}

function h(x: number, y: number): number {
  const { W, H, hgt } = world;
  x = x < 0 ? 0 : x >= W ? W - 1 : x;
  y = y < 0 ? 0 : y >= H ? H - 1 : y;
  return hgt[y * W + x];
}

function computeCell(x: number, y: number): void {
  const i = y * world.W + x;
  // схил рахуємо по ширшому "хресту", щоб дрібна нерівність не давала рябизни
  const slope = (h(x + 1, y + 1) - h(x - 1, y - 1)) * 0.6 + (h(x + 2, y + 2) - h(x - 2, y - 2)) * 0.2;
  shadeF[i] = 1 + Math.max(-0.14, Math.min(0.14, slope * 3.5));
  warm[i] = Math.max(0, Math.min(1, (world.temp[i] - 0.58) * 3)) * 0.3;
}

const SURF = SEA - 0.006;
const SHALLOW = SEA - 0.03;

function renderPixels(cx0: number, cy0: number, cx1: number, cy1: number): void {
  const { W, H, BW, hgt, biome } = world;
  const data = terrainLayer.img.data;
  const px0 = cx0 * SUB, py0 = cy0 * SUB, px1 = (cx1 + 1) * SUB, py1 = (cy1 + 1) * SUB;
  for (let py = py0; py < py1; py++) {
    const fy = (py + 0.5) / SUB - 0.5;
    let y0 = Math.floor(fy);
    const ty = fy - y0;
    let y1 = y0 + 1;
    if (y0 < 0) y0 = 0;
    if (y1 >= H) y1 = H - 1;
    const r0 = y0 * W, r1 = y1 * W;
    for (let px = px0; px < px1; px++) {
      const fx = (px + 0.5) / SUB - 0.5;
      let x0 = Math.floor(fx);
      const tx = fx - x0;
      let x1 = x0 + 1;
      if (x0 < 0) x0 = 0;
      if (x1 >= W) x1 = W - 1;
      const a = r0 + x0, b = r0 + x1, c = r1 + x0, d = r1 + x1;
      const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty;
      const hv = hgt[a] * wa + hgt[b] * wb + hgt[c] * wc + hgt[d] * wd;
      let R: number, G: number, B: number;
      if (hv < SEA) {
        terrainColor(hv, 0);
        R = col[0]; G = col[1]; B = col[2];
        if (hv >= DEEP - 0.03) {
          const tw = warm[a] * wa + warm[b] * wb + warm[c] * wc + warm[d] * wd;
          R += (56 - R) * tw; G += (196 - G) * tw; B += (206 - B) * tw;
        }
        if (hv > SHALLOW) {
          const t = (hv - SHALLOW) / (SEA - SHALLOW) * 0.45;
          R += (150 - R) * t; G += (218 - G) * t; B += (248 - B) * t;
        }
        if (hv > SURF) {
          const t = Math.min(1, (hv - SURF) / (SEA - SURF) * 1.6) * 0.85;
          R += (240 - R) * t; G += (252 - G) * t; B += (255 - B) * t;
        }
      } else {
        // Смуги висот (пісок/трава/пагорби/скелі/сніг) беруться з
        // інтерпольованої висоти — межі між ними плавні криві. Палітра біома
        // змішується за вагами сусідніх клітинок — біоми перетікають градієнтом.
        const ba = biome[a], bb = biome[b], bc = biome[c], bd = biome[d];
        if (ba === bb && ba === bc && ba === bd) {
          terrainColor(hv, ba);
          R = col[0]; G = col[1]; B = col[2];
        } else {
          terrainColor(hv, ba); R = col[0] * wa; G = col[1] * wa; B = col[2] * wa;
          terrainColor(hv, bb); R += col[0] * wb; G += col[1] * wb; B += col[2] * wb;
          terrainColor(hv, bc); R += col[0] * wc; G += col[1] * wc; B += col[2] * wc;
          terrainColor(hv, bd); R += col[0] * wd; G += col[1] * wd; B += col[2] * wd;
        }
        const f = shadeF[a] * wa + shadeF[b] * wb + shadeF[c] * wc + shadeF[d] * wd;
        R *= f; G *= f; B *= f;
        if (hv > HILL && hv < HILL + 0.007) { R *= 0.84; G *= 0.84; B *= 0.86; }
        if (hv < SEA + 0.008) {
          const t = 1 - (hv - SEA) / 0.008;
          R *= 1 - 0.3 * t; G *= 1 - 0.36 * t; B *= 1 - 0.42 * t;
        }
      }
      const q = (py * BW + px) * 4;
      data[q] = R; data[q + 1] = G; data[q + 2] = B; data[q + 3] = 255;
    }
  }
}

/** Перемальовує змінену з минулого разу область рельєфу (якщо така є). */
export function updateTerrain(): void {
  if (heightDirty.x1 < heightDirty.x0) return;
  const { W, H } = world;
  const cx0 = Math.max(0, heightDirty.x0 - 1), cy0 = Math.max(0, heightDirty.y0 - 1);
  const cx1 = Math.min(W - 1, heightDirty.x1 + 1), cy1 = Math.min(H - 1, heightDirty.y1 + 1);
  for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) computeCell(x, y);
  const px0 = Math.max(0, cx0 - 1), py0 = Math.max(0, cy0 - 1);
  const px1 = Math.min(W - 1, cx1 + 1), py1 = Math.min(H - 1, cy1 + 1);
  renderPixels(px0, py0, px1, py1);
  terrainLayer.ctx.putImageData(terrainLayer.img, 0, 0, px0 * SUB, py0 * SUB, (px1 - px0 + 1) * SUB, (py1 - py0 + 1) * SUB);
  heightDirty.x0 = 0; heightDirty.y0 = 0; heightDirty.x1 = -1; heightDirty.y1 = -1;
}
