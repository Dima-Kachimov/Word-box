// Малювання дерев, вогню й дрібного декору просто у піксельний буфер
// текстури ландшафту (на відміну від тварин, які малюються окремими
// спрайтами поверх буфера в кожному кадрі — рослинність "запікається" в
// буфер разом із самим рельєфом). Кольори — сирі RGB-трійки (як і в
// оригіналі), бо пишуться напряму в ImageData, а не через canvas-заливку.

import { world } from '../world/state';
import { SUB, B_DESERT, B_TUNDRA, B_TEMP, B_SAVANNA, B_JUNGLE, B_SWAMP, GRASS } from '../world/constants';

type RGB = [number, number, number];

export const SPR: Record<string, string[]> = {
  leafy: ['..ll..', '.llmm.', 'llmmmd', 'lmmmdd', '.mmddd', '..dd..', '..tt..', '..tt..'],
  round: ['......', '.lll..', 'llmmm.', 'lmmmmd', '.mmmd.', '..td..', '..t...', '......'],
  pine: ['..l...', '..lm..', '.lmm..', '.lmmd.', 'lmmmd.', 'lmmmdd', '..t...', '..t...'],
  cactus: ['..gl..', '..gl..', 'g.gl..', 'gggl.g', '..glgg', '..gl..', '..gl..', '..gl..'],
  acacia: ['......', '......', 'lllmmm', 'mmmmdd', '.t..t.', '..tt..', '..t...', '..t...'],
  palm: ['.l..l.', 'llmmll', 'm.mm.d', 'm..t.d', '...t..', '..t...', '..t...', '..t...'],
  willow: ['..dd..', '.dmmd.', 'dmmmmd', 'dmddmd', 'd.dd.d', 'd.t..d', '..t...', '..t...']
};

type VegPalette = Record<string, RGB>;

export const PAL: Record<string, VegPalette & { snowy?: VegPalette }> = {
  leafy: { l: [104, 184, 72], m: [52, 128, 52], d: [30, 88, 40], t: [96, 64, 38] },
  pine: { l: [72, 142, 82], m: [36, 100, 58], d: [22, 66, 42], t: [88, 58, 34] },
  tpine: { l: [236, 244, 248], m: [40, 92, 66], d: [26, 62, 46], t: [80, 56, 36] },
  cactus: { g: [64, 148, 72], l: [112, 192, 102] },
  acacia: { l: [150, 170, 70], m: [110, 136, 52], d: [80, 100, 40], t: [100, 72, 44] },
  palm: { l: [124, 212, 84], m: [46, 152, 52], d: [24, 98, 38], t: [110, 78, 44] },
  jungle: { l: [96, 200, 70], m: [34, 128, 44], d: [18, 84, 32], t: [96, 64, 38] },
  willow: { l: [100, 130, 70], m: [74, 104, 56], d: [46, 72, 42], t: [72, 58, 40] }
};
for (const k in PAL) PAL[k].snowy = Object.assign({}, PAL[k], { l: [240, 246, 250] as RGB });

export const FIRE_SPR: string[][] = [
  ['...y..', '..yy..', '..yoy.', '.yooy.', '.oyyo.', 'oryyro', 'orrrro', '.rrrr.'],
  ['..y...', '..yy.y', '.yoyy.', '.yooo.', 'oyyyo.', 'oryyro', 'orrrro', '.rrrr.'],
  ['....y.', '.y.yy.', '.yoy..', 'yooy..', 'oyyoo.', 'oryyro', 'orrrro', '.rrrr.']
];
export const FIRE_PAL: VegPalette = { y: [255, 238, 120], o: [255, 150, 40], r: [212, 58, 24] };

let data: Uint8ClampedArray;
let BW: number, BH: number;

/** Прив'язує модуль до актуального піксельного буфера світу (викликається при кожному setupTileBuffer). */
export function bindBufferData(d: Uint8ClampedArray, bw: number, bh: number): void {
  data = d; BW = bw; BH = bh;
}

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const q = (y * BW + x) * 4; data[q] = c[0]; data[q + 1] = c[1]; data[q + 2] = c[2];
}
function darkenPx(x: number, y: number, f: number): void {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const q = (y * BW + x) * 4; data[q] *= f; data[q + 1] *= f; data[q + 2] *= f;
}
function tintPx(x: number, y: number, c: RGB, t: number): void {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const q = (y * BW + x) * 4;
  data[q] += (c[0] - data[q]) * t;
  data[q + 1] += (c[1] - data[q + 1]) * t;
  data[q + 2] += (c[2] - data[q + 2]) * t;
}
function drawSprite(bx: number, by: number, spr: string[], pal: VegPalette, flip: boolean): void {
  for (let ry = 0; ry < spr.length; ry++) {
    const row = spr[ry], w = row.length;
    for (let rx = 0; rx < w; rx++) {
      const ch = row[flip ? w - 1 - rx : rx];
      if (ch !== '.') setPx(bx + rx, by + ry, pal[ch]);
    }
  }
}

export function drawTree(x: number, y: number, i: number): void {
  const b = world.biome[i], v = world.vari[i], h = world.hgt[i];
  let spr: string[], palKey: string;
  if (b === B_DESERT) { spr = SPR.cactus; palKey = 'cactus'; }
  else if (b === B_TUNDRA) { spr = SPR.pine; palKey = 'tpine'; }
  else if (b === B_SAVANNA) { spr = SPR.acacia; palKey = 'acacia'; }
  else if (b === B_JUNGLE) { spr = v < 0.5 ? SPR.palm : SPR.leafy; palKey = v < 0.5 ? 'palm' : 'jungle'; }
  else if (b === B_SWAMP) { spr = SPR.willow; palKey = 'willow'; }
  else {
    const pine = h > GRASS - 0.03 ? v < 0.8 : v < 0.22;
    spr = pine ? SPR.pine : (v > 0.6 ? SPR.round : SPR.leafy);
    palKey = pine ? 'pine' : 'leafy';
  }
  const pal = world.snow[i] > 60 ? PAL[palKey].snowy! : PAL[palKey];
  const bx = x * SUB, by = y * SUB - 2;
  for (let sy = 5; sy < 8; sy++) for (let sx = 1; sx < 5; sx++) darkenPx(bx + sx + 1, by + sy + 1, 0.72);
  drawSprite(bx, by, spr, pal, v > 0.5);
}

const GLOW: RGB = [255, 120, 40];

export function drawFire(x: number, y: number, i: number, frame: number): void {
  const bx = x * SUB, by = y * SUB - 2;
  for (let sy = -2; sy < 9; sy++) for (let sx = -3; sx < 9; sx++) tintPx(bx + sx, by + sy, GLOW, 0.18);
  const f = (frame + ((world.vari[i] * 3) | 0)) % 3;
  drawSprite(bx, by, FIRE_SPR[f], FIRE_PAL, world.vari[i] > 0.5);
}

export function drawDeco(x: number, y: number, i: number): void {
  const v = world.vari[i], b = world.biome[i], bx = x * SUB, by = y * SUB;
  const sx = bx + (((v * 37) | 0) % (SUB - 2)), sy = by + (((v * 91) | 0) % (SUB - 2));
  if (b === B_TEMP && v > 0.95) setPx(sx, sy, v > 0.983 ? [240, 80, 80] : v > 0.967 ? [250, 230, 90] : [245, 245, 245]);
  else if (b === B_DESERT && v > 0.93) { setPx(sx, sy, [150, 130, 110]); setPx(sx + 1, sy, [120, 104, 90]); }
  else if (b === B_SWAMP && v > 0.68) { setPx(sx, sy, [58, 92, 92]); setPx(sx + 1, sy, [58, 92, 92]); setPx(sx, sy + 1, [50, 82, 84]); setPx(sx + 1, sy + 1, [96, 136, 134]); }
  else if (b === B_SAVANNA && v > 0.95) { setPx(sx, sy, [150, 120, 60]); setPx(sx + 1, sy, [130, 100, 50]); }
  else if (b === B_JUNGLE && v > 0.965) setPx(sx, sy, [255, 120, 200]);
}
