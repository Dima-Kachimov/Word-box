// Текстурний буфер світу: растеризує рельєф+вода+сніг+рослинність у власний
// офскрін-canvas (BW×BH пікселів), який потім просто масштабовано
// малюється на видимий canvas у render/scene.ts. Перебудовується лише коли
// щось справді змінилось (dirty), а не щокадру.

import { lerp, clamp } from '../world/noise';
import { world } from '../world/state';
import { SUB, SEA, DEEP, C_NONE, C_FIRE, C_LAVA, C_BASALT, C_BURNT, C_TREE, C_ICE } from '../world/constants';
import { isVeg } from '../world/generate';
import { terrainColor, col } from './palette';
import { drawTree, drawFire, drawDeco, bindBufferData } from './vegetation';
import { camera } from './camera';
import { view } from './context';

export const tileBuffer = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  img: null as unknown as ImageData,
  data: null as unknown as Uint8ClampedArray
};

/** Трійки [x,y,сила] у пікселях буфера для клітинок, що світяться вночі (вогонь/лава). */
export const lights: number[] = [];
export const weatherStats = { visFire: 0, visLava: 0 };
export const viewBounds = { x0: 0, y0: 0, x1: 0, y1: 0 };

let dirty = true;
export function markDirty(): void { dirty = true; }
export function isDirty(): boolean { return dirty; }
export function clearDirty(): void { dirty = false; }

export function setupTileBuffer(): void {
  const c = document.createElement('canvas');
  c.width = world.BW; c.height = world.BH;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(world.BW, world.BH);
  tileBuffer.canvas = c;
  tileBuffer.ctx = ctx;
  tileBuffer.img = img;
  tileBuffer.data = img.data;
  bindBufferData(img.data, world.BW, world.BH);
  markDirty();
}

const FOAM: [number, number, number] = [196, 230, 250];
const ICE: [number, number, number] = [206, 235, 248];

function hAt(x: number, y: number): number {
  const { W, H, hgt } = world;
  x = x < 0 ? 0 : x >= W ? W - 1 : x;
  y = y < 0 ? 0 : y >= H ? H - 1 : y;
  return hgt[y * W + x];
}

/** Растеризує весь світ у tileBuffer. Викликається лише коли dirty===true. */
export function renderBuffer(frame: number): void {
  const W = world.W, H = world.H;
  const data = tileBuffer.data;
  lights.length = 0; weatherStats.visFire = 0; weatherStats.visLava = 0;
  viewBounds.x0 = -camera.camX / camera.zoom / SUB;
  viewBounds.y0 = -camera.camY / camera.zoom / SUB;
  viewBounds.x1 = (view.canvas.width - camera.camX) / camera.zoom / SUB;
  viewBounds.y1 = (view.canvas.height - camera.camY) / camera.zoom / SUB;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x, h = world.hgt[i], c = world.cover[i], water = h < SEA, b = world.biome[i];
      terrainColor(h, b);
      let r = col[0], g = col[1], bl = col[2];
      let lava = false, snowA = 0, sr = 0, sg = 0, sb = 0;
      if (water) {
        if (h >= DEEP - 0.03) {
          const tw = clamp((world.temp[i] - 0.58) * 3, 0, 1) * 0.32;
          r = lerp(r, 56, tw); g = lerp(g, 196, tw); bl = lerp(bl, 206, tw);
        }
        if (c === C_ICE) { r = ICE[0]; g = ICE[1]; bl = ICE[2]; }
        else if (hAt(x - 1, y) >= SEA || hAt(x + 1, y) >= SEA || hAt(x, y - 1) >= SEA || hAt(x, y + 1) >= SEA) {
          const t = 0.42 + (((frame >> 1) + ((world.vari[i] * 4) | 0)) % 4 === 0 ? 0.22 : 0);
          r = lerp(r, FOAM[0], t); g = lerp(g, FOAM[1], t); bl = lerp(bl, FOAM[2], t);
        }
      } else {
        let f = 1 + clamp((hAt(x + 1, y + 1) - hAt(x - 1, y - 1)) * 5, -0.32, 0.32);
        if (c === C_BURNT) { r = lerp(r, 56, 0.78); g = lerp(g, 46, 0.78); bl = lerp(bl, 40, 0.78); }
        else if (c === C_FIRE) { r = 92; g = 40; bl = 22; f = 1; }
        else if (c === C_LAVA) { lava = true; }
        else if (c === C_BASALT) { r = 64; g = 58; bl = 60; }
        if (world.wet[i] > 0) f *= 0.85;
        if (world.grazed[i] > 0 && c === C_NONE) { const gt = Math.min(0.5, world.grazed[i] / 260); r = lerp(r, 150, gt); g = lerp(g, 126, gt); bl = lerp(bl, 84, gt); }
        r *= f; g *= f; bl *= f;
        if (world.snow[i] > 0 && c !== C_FIRE && c !== C_LAVA) {
          snowA = Math.min(1, world.snow[i] / 260) * 290;
          sr = 236 * f; sg = 243 * f; sb = 250 * f;
        }
      }
      const amp = water ? 0.00022 : 0.0007;
      const bx = x * SUB, by = y * SUB;
      for (let sy = 0; sy < SUB; sy++) {
        let p = (by + sy) * world.BW + bx;
        for (let sx = 0; sx < SUB; sx++, p++) {
          const n = world.noise[p], q = p * 4;
          let RR: number, GG: number, BB: number;
          if (lava) {
            if (n < 34) { RR = 72; GG = 22; BB = 12; }
            else {
              const v = ((n + frame * 9 + sx * 31 + sy * 17) & 255) / 255, v2 = v * v;
              RR = lerp(215, 255, v); GG = lerp(56, 212, v2); BB = lerp(18, 72, v2);
            }
          } else {
            const k = 1 + (n - 128) * amp;
            RR = r * k; GG = g * k; BB = bl * k;
            if (water && c !== C_ICE && ((n + frame * 5 + (by + sy) * 3) & 255) < 2) { RR += 45; GG += 45; BB += 40; }
            else if (c === C_BASALT && n > 247 && world.timer[i] > 500) { RR = 232; GG = 84; BB = 30; }
            else if (snowA > 0 && n < snowA) { const k2 = 1 + (n - 128) * 0.0002; RR = sr * k2; GG = sg * k2; BB = sb * k2; }
          }
          data[q] = RR; data[q + 1] = GG; data[q + 2] = BB; data[q + 3] = 255;
        }
      }
      if (lava && world.vari[i] < 0.4) lights.push(x * SUB + SUB / 2, y * SUB + SUB / 2, 0.8);
      if (lava && x >= viewBounds.x0 && x <= viewBounds.x1 && y >= viewBounds.y0 && y <= viewBounds.y1) weatherStats.visLava++;
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = world.cover[i];
    if (c === C_TREE) drawTree(x, y, i);
    else if (c === C_FIRE) {
      drawFire(x, y, i, frame);
      lights.push(x * SUB + SUB / 2, y * SUB, 1.2);
      if (x >= viewBounds.x0 && x <= viewBounds.x1 && y >= viewBounds.y0 && y <= viewBounds.y1) weatherStats.visFire++;
    } else if (c === C_NONE && isVeg(world.hgt[i]) && world.snow[i] < 40) drawDeco(x, y, i);
  }
  tileBuffer.ctx.putImageData(tileBuffer.img, 0, 0);
}
