// Мультяшна рослинність: дерева 9 видів (+засніжені), анімований вогонь і
// дрібний декор (квіти, камінці, латаття). Малюються векторно через Painter
// і растеризуються в атласи кількох роздільностей (LOD).
//
// Два режими показу:
//  • здалеку — усе "запечено" в шар vegLayer розміром зі світ (1 одиниця
//    спрайта = 1 піксель світу), оновлюється інкрементально: перемальовуються
//    лише плитки, де щось виросло/згоріло/засніжилось;
//  • зблизька (клітинка ≥ HI_CELL пікселів екрана) — видимі дерева малюються
//    щокадру з атласу потрібної роздільності, тож вони чіткі на будь-якому
//    наближенні.

import { world } from '../world/state';
import {
  SUB, SEA, GRASS, B_TEMP, B_DESERT, B_TUNDRA, B_SAVANNA, B_JUNGLE, B_SWAMP,
  C_NONE, C_TREE, C_FIRE
} from '../world/constants';
import { isVeg } from '../world/generate';
import { Painter, volume, tint, shade, blob, TAU } from './cartoon';

// ---------------------------------------------------------------- розміри
/** Коробка спрайта в одиницях (1 одиниця = 1 піксель світу). */
const TW = 9, TH = 11, PAD = 1;
const SLOT_W = TW + PAD * 2, SLOT_H = TH + PAD * 2;
/** Точка "основи" дерева всередині коробки (без PAD). */
const BASE_X = 4.5, BASE_Y = 10.4;
/** Від якого розміру клітинки на екрані (фіз. пікселі) перемикаємось на покадрові спрайти. */
export const HI_CELL = 11;

const KINDS = ['leafy', 'round', 'pine', 'tpine', 'cactus', 'acacia', 'palm', 'jungle', 'willow'] as const;
type Kind = typeof KINDS[number];
const DECOS = ['flowerR', 'flowerY', 'flowerW', 'pebble', 'lily', 'bush', 'flowerP'] as const;
type Deco = typeof DECOS[number];

// Порядок слотів у атласі: дерева (kind × snowy × flip), вогонь (3 кадри × flip), декор.
const TREE_SLOTS = KINDS.length * 4;
const FIRE_SLOT0 = TREE_SLOTS;
const DECO_SLOT0 = FIRE_SLOT0 + 6;
const SLOTS = DECO_SLOT0 + DECOS.length;
const COLS = 10;

// ---------------------------------------------------------------- малюнки дерев
const SNOW = '#f6fafd';

function shadow(g: CanvasRenderingContext2D): void {
  blob(g, BASE_X, BASE_Y - 0.1, 3.2, 0.95, 'rgba(20,30,10,0.28)');
}

function snowCap(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  g.fillStyle = SNOW;
  g.beginPath();
  g.ellipse(cx, cy - r * 0.35, r * 0.82, r * 0.55, 0, Math.PI, TAU);
  g.quadraticCurveTo(cx + r * 0.5, cy - r * 0.05, cx + r * 0.25, cy - r * 0.2);
  g.quadraticCurveTo(cx, cy + r * 0.05, cx - r * 0.3, cy - r * 0.18);
  g.quadraticCurveTo(cx - r * 0.6, cy - r * 0.05, cx - r * 0.82, cy - r * 0.35);
  g.fill();
}

function highlight(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: string): void {
  blob(g, x, y, r, r * 0.62, tint(base, 0.45), -0.5);
}

const TRUNK = '#8a5a34';

const TREE_ART: Record<Kind, (g: CanvasRenderingContext2D, snowy: boolean) => void> = {
  leafy(g, snowy) {
    shadow(g);
    const c = '#5cb847', p = new Painter();
    p.line([BASE_X, BASE_Y, BASE_X, 6.4], 1.3, TRUNK);
    const f = volume(c, 4.5, 4.6, 4.2);
    p.circ(2.8, 5.7, 2.3, f).circ(6.2, 5.7, 2.3, f).circ(4.5, 3.5, 2.9, f).circ(4.5, 6.3, 2.2, f);
    p.render(g);
    highlight(g, 3.4, 2.8, 0.9, c);
    highlight(g, 6.4, 4.9, 0.55, c);
    if (snowy) { snowCap(g, 4.5, 3.2, 2.7); snowCap(g, 2.6, 5.4, 1.9); snowCap(g, 6.4, 5.4, 1.9); }
  },
  round(g, snowy) {
    shadow(g);
    const c = '#6cc24a', p = new Painter();
    p.line([BASE_X, BASE_Y, BASE_X, 7.4], 1.3, TRUNK);
    const f = volume(c, 4.5, 4.7, 3.8);
    p.circ(2.1, 5.9, 1.5, f).circ(6.9, 5.9, 1.5, f).circ(4.5, 4.7, 3.5, f);
    p.render(g);
    highlight(g, 3.3, 3.2, 1.0, c);
    blob(g, 5.6, 6.2, 0.35, 0.35, '#e8403a');
    blob(g, 3.2, 6.0, 0.35, 0.35, '#e8403a');
    if (snowy) snowCap(g, 4.5, 3.4, 3.2);
  },
  pine(g, snowy) { pine(g, '#2f8a4a', snowy); },
  tpine(g) { pine(g, '#2c7a50', true); },
  cactus(g, snowy) {
    blob(g, BASE_X, BASE_Y - 0.1, 2.2, 0.7, 'rgba(20,30,10,0.25)');
    const c = '#4fae54', p = new Painter();
    p.line([3.6, 7.3, 2.0, 7.3, 2.0, 4.9], 1.35, c);
    p.line([5.4, 6.4, 7.0, 6.4, 7.0, 4.3], 1.35, c);
    p.line([BASE_X, BASE_Y - 0.3, BASE_X, 3.2], 2.5, volume(c, 4.5, 6.5, 4, 0.3, 0.8));
    p.render(g);
    g.strokeStyle = tint(c, 0.4); g.lineWidth = 0.35; g.lineCap = 'round';
    g.beginPath(); g.moveTo(4.05, 9.4); g.lineTo(4.05, 3.8); g.stroke();
    const f = new Painter(0.28);
    for (let k = 0; k < 5; k++) f.circ(4.5 + Math.cos(k * 1.256) * 0.62, 2.35 + Math.sin(k * 1.256) * 0.62, 0.45, '#ff7aa8', { outline: false });
    f.circ(4.5, 2.35, 0.35, '#ffd84a', { outline: false });
    f.render(g);
    if (snowy) snowCap(g, 4.5, 3.4, 1.4);
  },
  acacia(g, snowy) {
    shadow(g);
    const c = '#9bb043', p = new Painter();
    p.line([BASE_X, BASE_Y, 4.3, 7.2, 2.8, 4.6], 1.1, '#7a5230');
    p.line([4.3, 7.2, 6.1, 4.6], 0.9, '#7a5230');
    const f = volume(c, 4.5, 3.4, 4.4, 0.3, 0.75);
    p.ell(4.5, 3.9, 4.3, 1.4, f).ell(3.0, 3.1, 1.8, 1.05, f).ell(6.1, 3.1, 1.8, 1.05, f).ell(4.5, 2.6, 1.6, 0.9, f);
    p.render(g);
    highlight(g, 3.0, 2.6, 0.7, c);
    if (snowy) { snowCap(g, 3.0, 3.0, 1.6); snowCap(g, 6.1, 3.0, 1.6); }
  },
  palm(g, snowy) {
    blob(g, BASE_X + 0.8, BASE_Y - 0.1, 2.8, 0.8, 'rgba(20,30,10,0.25)');
    const p = new Painter();
    p.line([BASE_X, BASE_Y, 4.9, 8.3, 5.3, 6.2, 5.5, 4.2], 1.25, '#b0834a');
    p.render(g);
    g.strokeStyle = '#7a5530'; g.lineWidth = 0.28;
    for (const [x, y] of [[4.6, 9.5], [4.9, 8.2], [5.2, 6.9], [5.4, 5.6]]) {
      g.beginPath(); g.moveTo(x - 0.55, y); g.lineTo(x + 0.55, y - 0.15); g.stroke();
    }
    const fr = new Painter(), leaf = '#58c24a', tx = 5.5, ty = 3.9;
    for (const a of [-2.75, -2.1, -1.35, -0.75, -0.1, 0.55]) {
      const cx = tx + Math.cos(a) * 2.2, cy = ty + Math.sin(a) * 1.5 + (Math.abs(a + 1.4) > 1 ? 0.6 : 0);
      fr.ell(cx, cy, 2.5, 0.72, volume(leaf, cx, cy, 2.5, 0.3, 0.75), { rot: a });
    }
    fr.circ(5.0, 4.4, 0.6, '#6a4424').circ(6.0, 4.5, 0.6, '#6a4424');
    fr.render(g);
    if (snowy) snowCap(g, tx, ty - 0.3, 1.7);
  },
  jungle(g, snowy) {
    shadow(g);
    const c = '#2fa04a', p = new Painter();
    p.line([BASE_X, BASE_Y, BASE_X, 7.6], 1.4, '#6a4428');
    const f = volume(c, 4.5, 4.8, 4.4, 0.35, 0.65);
    p.circ(2.6, 5.5, 2.4, f).circ(6.4, 5.5, 2.4, f).circ(4.5, 3.3, 3.0, f).circ(4.5, 6.1, 2.6, f);
    p.render(g);
    blob(g, 3.2, 2.8, 0.9, 0.6, '#7ad65a', -0.4);
    blob(g, 6.3, 4.6, 0.7, 0.45, '#7ad65a', -0.4);
    blob(g, 2.3, 5.2, 0.55, 0.4, '#7ad65a', -0.4);
    g.strokeStyle = '#1f6a2a'; g.lineWidth = 0.35; g.lineCap = 'round';
    for (const [x, y0, y1] of [[1.6, 6.8, 9.2], [7.3, 6.6, 8.8], [3.4, 7.9, 9.6]]) {
      g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x - 0.3, (y0 + y1) / 2, x + 0.1, y1); g.stroke();
    }
    blob(g, 7.3, 8.9, 0.4, 0.4, '#ff6fb0');
    if (snowy) snowCap(g, 4.5, 3.0, 2.8);
  },
  willow(g, snowy) {
    shadow(g);
    const c = '#8fa865', p = new Painter();
    p.line([BASE_X, BASE_Y, BASE_X, 6.4], 1.3, '#6a5238');
    const f = volume(c, 4.5, 4.4, 3.8, 0.3, 0.75);
    p.circ(4.5, 4.4, 3.3, f);
    p.shape(g2 => {
      g2.moveTo(1.2, 4.6); g2.quadraticCurveTo(0.9, 8.4, 1.8, 9.2); g2.lineTo(2.6, 7.6); g2.lineTo(3.4, 9.3);
      g2.lineTo(4.1, 7.8); g2.lineTo(5.0, 9.4); g2.lineTo(5.7, 7.8); g2.lineTo(6.5, 9.2); g2.lineTo(7.2, 7.4);
      g2.quadraticCurveTo(8.1, 8.2, 7.8, 4.6); g2.closePath();
    }, f);
    p.render(g);
    g.strokeStyle = tint(c, 0.35); g.lineWidth = 0.3; g.lineCap = 'round';
    for (let x = 2.0; x < 7.5; x += 1.1) { g.beginPath(); g.moveTo(x, 5.0); g.lineTo(x + 0.1, 7.6); g.stroke(); }
    highlight(g, 3.4, 2.7, 0.9, c);
    if (snowy) snowCap(g, 4.5, 3.0, 2.8);
  }
};

function pine(g: CanvasRenderingContext2D, c: string, snowy: boolean): void {
  shadow(g);
  const p = new Painter();
  p.line([BASE_X, BASE_Y, BASE_X, 8.4], 1.2, TRUNK);
  const f = volume(c, 4.5, 5.2, 5.2, 0.3, 0.7);
  p.poly([0.8, 9.0, 8.2, 9.0, 4.5, 4.4], f);
  p.poly([1.5, 6.9, 7.5, 6.9, 4.5, 2.5], f);
  p.poly([2.4, 4.7, 6.6, 4.7, 4.5, 0.6], f);
  p.render(g);
  if (snowy) {
    g.fillStyle = SNOW;
    for (const [top, bot, half] of [[0.6, 4.7, 2.1], [2.5, 6.9, 3.0], [4.4, 9.0, 3.7]]) {
      const cut = top + (bot - top) * 0.5, w = half * 0.5;
      g.beginPath();
      g.moveTo(4.5, top);
      g.lineTo(4.5 + w, cut);
      g.quadraticCurveTo(4.5 + w * 0.5, cut - 0.5, 4.5 + w * 0.1, cut + 0.1);
      g.quadraticCurveTo(4.5 - w * 0.4, cut - 0.45, 4.5 - w, cut);
      g.closePath(); g.fill();
    }
  } else {
    g.strokeStyle = shade(c, 0.7); g.lineWidth = 0.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(3.2, 8.2); g.lineTo(4.0, 7.6); g.moveTo(5.8, 6.2); g.lineTo(5.0, 5.7); g.stroke();
  }
}

// ---------------------------------------------------------------- вогонь
function flamePath(g: CanvasRenderingContext2D, cx: number, by: number, w: number, h: number, sway: number): void {
  g.moveTo(cx - w / 2, by);
  g.bezierCurveTo(cx - w / 2 - 0.3, by - h * 0.45, cx + sway - w * 0.2, by - h * 0.72, cx + sway, by - h);
  g.bezierCurveTo(cx + sway + w * 0.25, by - h * 0.68, cx + w / 2 + 0.3, by - h * 0.45, cx + w / 2, by);
  g.quadraticCurveTo(cx, by + w * 0.32, cx - w / 2, by);
}
const FLAME_SHAPES = [[0.7, 9.2, 6.6], [-0.6, 8.4, 5.8], [0.2, 9.8, 7.2]];

function drawFire(g: CanvasRenderingContext2D, fr: number): void {
  const [sway, h1, h2] = FLAME_SHAPES[fr];
  blob(g, BASE_X, BASE_Y - 0.1, 3.4, 1.0, 'rgba(60,10,0,0.35)');
  const p = new Painter(0.38, '#7a1c08');
  p.shape(g2 => flamePath(g2, BASE_X, BASE_Y - 0.4, 6.4, h1, sway), g2 => {
    const gr = g2.createLinearGradient(0, BASE_Y, 0, BASE_Y - h1);
    gr.addColorStop(0, '#d8341a'); gr.addColorStop(1, '#ff7a24');
    return gr;
  });
  p.shape(g2 => flamePath(g2, BASE_X + 0.2, BASE_Y - 0.4, 4.4, h2, -sway * 0.7), '#ffa22e', { outline: false });
  p.shape(g2 => flamePath(g2, BASE_X, BASE_Y - 0.5, 2.4, h2 * 0.6, sway * 0.5), '#ffe36a', { outline: false });
  p.render(g);
  blob(g, BASE_X - 2.6 + fr, BASE_Y - h1 * 0.9, 0.35, 0.35, '#ffd24a');
}

// ---------------------------------------------------------------- декор
function drawDeco(g: CanvasRenderingContext2D, d: Deco): void {
  const cx = 2, cy = 2, p = new Painter(0.26);
  if (d === 'flowerR' || d === 'flowerY' || d === 'flowerW' || d === 'flowerP') {
    const petal = d === 'flowerR' ? '#f0463e' : d === 'flowerY' ? '#ffd23a' : d === 'flowerP' ? '#ff7ac8' : '#fbfbf6';
    for (let k = 0; k < 5; k++) p.circ(cx + Math.cos(k * 1.2566 - 1.57) * 0.75, cy + Math.sin(k * 1.2566 - 1.57) * 0.75, 0.62, petal);
    p.circ(cx, cy, 0.48, d === 'flowerY' ? '#f08a24' : '#ffd23a', { sep: true });
  } else if (d === 'pebble') {
    p.ell(1.4, 2.4, 1.05, 0.72, volume('#a09486', 1.4, 2.4, 1.1));
    p.ell(2.8, 2.0, 0.8, 0.6, volume('#8e8479', 2.8, 2.0, 0.9), { sep: true });
  } else if (d === 'lily') {
    p.shape(g2 => { g2.moveTo(cx, cy); g2.arc(cx, cy, 1.45, -0.35, TAU - 0.95); g2.closePath(); }, volume('#4f9a5a', cx, cy, 1.5));
    p.circ(cx + 0.55, cy - 0.5, 0.42, '#ff9ac8', { sep: true });
  } else if (d === 'bush') {
    for (const a of [-2.4, -1.9, -1.57, -1.2, -0.75]) p.line([cx, cy + 1.2, cx + Math.cos(a) * 1.7, cy + 1.2 + Math.sin(a) * 1.7], 0.35, '#b08a3e');
  }
  p.render(g);
}

// ---------------------------------------------------------------- атласи
const LODS = [1, 3, 6, 12];
const atlases: HTMLCanvasElement[] = [];

function slotXY(slot: number): [number, number] {
  return [(slot % COLS) * SLOT_W, Math.floor(slot / COLS) * SLOT_H];
}

function buildAtlas(R: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = COLS * SLOT_W * R;
  c.height = Math.ceil(SLOTS / COLS) * SLOT_H * R;
  const g = c.getContext('2d')!;
  const draw = (slot: number, flip: boolean, fn: (g: CanvasRenderingContext2D) => void) => {
    const [sx, sy] = slotXY(slot);
    g.save();
    g.setTransform(R, 0, 0, R, sx * R, sy * R);
    if (flip) { g.translate(SLOT_W, 0); g.scale(-1, 1); }
    g.translate(PAD, PAD);
    fn(g);
    g.restore();
  };
  KINDS.forEach((k, ki) => {
    for (let s = 0; s < 2; s++) for (let f = 0; f < 2; f++) draw(ki * 4 + s * 2 + f, f === 1, gg => TREE_ART[k](gg, s === 1));
  });
  for (let fr = 0; fr < 3; fr++) for (let f = 0; f < 2; f++) draw(FIRE_SLOT0 + fr * 2 + f, f === 1, gg => drawFire(gg, fr));
  DECOS.forEach((d, di) => draw(DECO_SLOT0 + di, false, gg => drawDeco(gg, d)));
  return c;
}

// ---------------------------------------------------------------- що де росте
function treeKind(i: number): Kind {
  const b = world.biome[i], v = world.vari[i], h = world.hgt[i];
  if (b === B_DESERT) return 'cactus';
  if (b === B_TUNDRA) return 'tpine';
  if (b === B_SAVANNA) return 'acacia';
  if (b === B_JUNGLE) return v < 0.5 ? 'palm' : 'jungle';
  if (b === B_SWAMP) return 'willow';
  const isPine = h > GRASS - 0.03 ? v < 0.8 : v < 0.22;
  return isPine ? 'pine' : (v > 0.6 ? 'round' : 'leafy');
}

function decoAt(i: number): Deco | null {
  const b = world.biome[i], v = world.vari[i];
  if (b === B_TEMP && v > 0.95) return v > 0.983 ? 'flowerR' : v > 0.967 ? 'flowerY' : 'flowerW';
  if (b === B_DESERT && v > 0.93) return 'pebble';
  if (b === B_SWAMP && v > 0.68) return 'lily';
  if (b === B_SAVANNA && v > 0.95) return 'bush';
  if (b === B_JUNGLE && v > 0.965) return 'flowerP';
  return null;
}

/** Слот атласу для статичної рослинності клітинки (0 — нічого). Вогонь сюди не входить. */
function vegSlot(i: number): number {
  const c = world.cover[i];
  if (c === C_TREE) {
    const k = KINDS.indexOf(treeKind(i));
    return 1 + k * 4 + (world.snow[i] > 60 ? 2 : 0) + (world.vari[i] > 0.5 ? 1 : 0);
  }
  if (c === C_NONE && world.hgt[i] >= SEA && isVeg(world.hgt[i]) && world.snow[i] < 40) {
    const d = decoAt(i);
    if (d) return 1 + DECO_SLOT0 + DECOS.indexOf(d);
  }
  return 0;
}

/** Де в пікселях світу малювати спрайт клітинки (лівий верхній кут слота). */
function spritePos(x: number, y: number, slot: number, i: number): [number, number] {
  const v = world.vari[i];
  if (slot >= DECO_SLOT0) {
    const sx = x * SUB + (((v * 37) | 0) % (SUB - 2)), sy = y * SUB + (((v * 91) | 0) % (SUB - 2));
    return [sx + 0.5 - 2 - PAD, sy + 0.5 - 2 - PAD];
  }
  const jitter = (((v * 1300) | 0) % 100 / 100 - 0.5) * 1.6;
  return [x * SUB + SUB / 2 + jitter - BASE_X - PAD, y * SUB + SUB - 0.4 - BASE_Y - PAD];
}

// ---------------------------------------------------------------- запечений шар
export const vegLayer = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D
};
let keys = new Uint8Array(0);
const TILE = 8;
let tilesW = 0, tilesH = 0;
let dirtyTiles = new Uint8Array(0);

export function setupVegetation(): void {
  if (!atlases.length) for (const R of LODS) atlases.push(buildAtlas(R));
  const c = document.createElement('canvas');
  c.width = world.BW; c.height = world.BH;
  vegLayer.canvas = c;
  vegLayer.ctx = c.getContext('2d')!;
  keys = new Uint8Array(world.N);
  tilesW = Math.ceil(world.W / TILE); tilesH = Math.ceil(world.H / TILE);
  dirtyTiles = new Uint8Array(tilesW * tilesH);
  fullRedraw();
}

function drawCell(g: CanvasRenderingContext2D, x: number, y: number, key: number): void {
  const slot = key - 1, i = y * world.W + x;
  const [dx, dy] = spritePos(x, y, slot, i);
  const [sx, sy] = slotXY(slot);
  g.drawImage(atlases[0], sx, sy, SLOT_W, SLOT_H, Math.round(dx), Math.round(dy), SLOT_W, SLOT_H);
}

function drawRegion(g: CanvasRenderingContext2D, cx0: number, cy0: number, cx1: number, cy1: number): void {
  const { W, H } = world;
  cx0 = Math.max(0, cx0); cy0 = Math.max(0, cy0); cx1 = Math.min(W - 1, cx1); cy1 = Math.min(H - 1, cy1);
  for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
    const k = keys[y * W + x];
    if (k) drawCell(g, x, y, k);
  }
}

function fullRedraw(): void {
  const { W, H, N } = world;
  for (let i = 0; i < N; i++) keys[i] = vegSlot(i);
  vegLayer.ctx.clearRect(0, 0, vegLayer.canvas.width, vegLayer.canvas.height);
  drawRegion(vegLayer.ctx, 0, 0, W - 1, H - 1);
}

/** Звіряє, що змінилось у рослинності, і перемальовує лише зачеплені плитки. */
export function updateVegetation(): void {
  const { W, N } = world;
  let changed = 0;
  for (let i = 0; i < N; i++) {
    const k = vegSlot(i);
    if (k === keys[i]) continue;
    keys[i] = k;
    changed++;
    const x = i % W, y = (i / W) | 0;
    // спрайт клітинки заходить на ~1 клітинку вбік і ~2 вгору
    for (let ty = Math.max(0, ((y - 2) / TILE) | 0); ty <= Math.min(tilesH - 1, (y / TILE) | 0); ty++)
      for (let tx = Math.max(0, ((x - 1) / TILE) | 0); tx <= Math.min(tilesW - 1, ((x + 1) / TILE) | 0); tx++)
        dirtyTiles[ty * tilesW + tx] = 1;
  }
  if (!changed) return;
  if (changed > N * 0.2) { dirtyTiles.fill(0); fullRedraw(); return; }
  const g = vegLayer.ctx;
  for (let t = 0; t < dirtyTiles.length; t++) {
    if (!dirtyTiles[t]) continue;
    dirtyTiles[t] = 0;
    const tx = t % tilesW, ty = (t / tilesW) | 0;
    const cx0 = tx * TILE, cy0 = ty * TILE;
    const px = cx0 * SUB, py = cy0 * SUB, pw = TILE * SUB, ph = TILE * SUB;
    g.save();
    g.beginPath(); g.rect(px, py, pw, ph); g.clip();
    g.clearRect(px, py, pw, ph);
    drawRegion(g, cx0 - 2, cy0 - 1, cx0 + TILE + 1, cy0 + TILE + 2);
    g.restore();
  }
}

// ---------------------------------------------------------------- покадрово зблизька
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Змінюється щоразу, коли рослинність/вогонь могли змінитись (раз на тік). */
let vegVersion = 0;
export function bumpVegVersion(): void { vegVersion++; }

// Кеш видимих спрайтів у координатах екрана: перемальовується, лише коли
// зсунулась камера або змінилась рослинність (≈7 разів/с), а не щокадру.
const hiCache = { canvas: null as HTMLCanvasElement | null, ox: NaN, oy: NaN, z: NaN, ver: -1 };

function visibleRange(cw: number, ch: number, ox: number, oy: number, cell: number) {
  const { W, H } = world;
  return {
    x0: Math.max(0, Math.floor(-ox / cell) - 1), x1: Math.min(W - 1, Math.ceil((cw - ox) / cell) + 1),
    y0: Math.max(0, Math.floor(-oy / cell) - 1), y1: Math.min(H - 1, Math.ceil((ch - oy) / cell) + 2)
  };
}

function renderSprites(g: CanvasRenderingContext2D, ox: number, oy: number, z: number, frame: number): void {
  const { W, cover, vari } = world;
  let li = LODS.length - 1;
  for (let k = 0; k < LODS.length; k++) if (LODS[k] >= z * 0.85) { li = k; break; }
  const R = LODS[li], atlas = atlases[li];
  const { x0, x1, y0, y1 } = visibleRange(g.canvas.width, g.canvas.height, ox, oy, SUB * z);
  const sw = SLOT_W * R, sh = SLOT_H * R, dw = SLOT_W * z, dh = SLOT_H * z;
  g.imageSmoothingEnabled = true;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    let slot: number;
    if (cover[i] === C_FIRE) slot = FIRE_SLOT0 + ((frame + ((vari[i] * 3) | 0)) % 3) * 2 + (vari[i] > 0.5 ? 1 : 0);
    else {
      const k = keys[i];
      if (!k) continue;
      slot = k - 1;
    }
    const [px, py] = spritePos(x, y, slot, i);
    const [sx, sy] = slotXY(slot);
    g.drawImage(atlas, sx * R, sy * R, sw, sh, ox + px * z, oy + py * z, dw, dh);
  }
}

function drawWaves(ctx: CanvasRenderingContext2D, ox: number, oy: number, z: number, time: number): void {
  const { W, hgt } = world;
  const cell = SUB * z;
  const { x0, x1, y0, y1 } = visibleRange(ctx.canvas.width, ctx.canvas.height, ox, oy, cell);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, z * 0.45);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (hgt[y * W + x] > SEA - 0.035) continue;
    const r = hash2(x, y);
    if (r > 0.06) continue;
    const ph = (time / 2600 + r * 16.7) % 1;
    const a = Math.sin(ph * Math.PI);
    if (a < 0.08) continue;
    const cx = ox + (x + 0.5) * cell, cy = oy + (y + 0.5 - ph * 0.35) * cell, rr = cell * 0.42;
    ctx.strokeStyle = `rgba(235,248,255,${0.75 * a})`;
    ctx.beginPath();
    ctx.arc(cx - rr * 0.55, cy, rr * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(cx + rr * 0.55, cy, rr * 0.55, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

/**
 * Зблизька: хвильки на глибокій воді (щокадру, вони анімовані плавно) і
 * чіткі спрайти дерев/вогню/декору з атласу потрібної роздільності (з кешу).
 */
export function drawVegetationHi(ctx: CanvasRenderingContext2D, ox: number, oy: number, z: number, frame: number, time: number): void {
  drawWaves(ctx, ox, oy, z, time);
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  let c = hiCache.canvas;
  if (!c || c.width !== cw || c.height !== ch) {
    c = hiCache.canvas = document.createElement('canvas');
    c.width = cw; c.height = ch;
    hiCache.ver = -1;
  }
  if (hiCache.ox !== ox || hiCache.oy !== oy || hiCache.z !== z || hiCache.ver !== vegVersion) {
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, cw, ch);
    renderSprites(g, ox, oy, z, frame);
    hiCache.ox = ox; hiCache.oy = oy; hiCache.z = z; hiCache.ver = vegVersion;
  }
  ctx.drawImage(c, 0, 0);
}
