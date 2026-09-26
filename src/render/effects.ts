// Шар "поверхневих ефектів" поверх рельєфу: сніг, лід, мокра земля,
// витоптана трава, згарище, базальт, лава, палаюча земля.
//
// Спершу для кожної клітинки рахується колір і прозорість (композиція
// ефектів). Потім поле розмивається (3×3), і шар растеризується з ER
// субпікселями на клітинку: форма береться з розмитого поля, "загостреного"
// smoothstep-ом відносно найсильнішого сусіда. Розмиття згладжує драбинку
// клітинок, тож край снігової шапки чи згарища виходить плавною кривою, як
// берегова лінія, а не квадратами з заокругленими кутами. Щотіку перераховуються лише плитки, де колір клітинок справді
// змінився (горіння, танення краю снігу тощо) — решта шару не чіпається.

import { world } from '../world/state';
import { SUB, SEA, C_NONE, C_FIRE, C_BURNT, C_ICE, C_LAVA, C_BASALT } from '../world/constants';
import { camera } from './camera';
import { view } from './context';

/** Субпікселів ефектів на клітинку (як у рельєфу — краї такі ж чіткі). */
export const ER = SUB;
const TILE = 8;

export const effectLayer = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  img: null as unknown as ImageData
};

/** Трійки [x,y,сила] у пікселях світу для клітинок, що світяться вночі (вогонь/лава). */
export const lights: number[] = [];
/** Скільки вогню/лави у кадрі — від цього залежить гучність відповідних звуків. */
export const weatherStats = { visFire: 0, visLava: 0 };
export const viewBounds = { x0: 0, y0: 0, x1: 0, y1: 0 };

// Колір клітинки в premultiplied-вигляді (R*A, G*A, B*A) і прозорість.
let pr = new Float32Array(0), pg = new Float32Array(0), pb = new Float32Array(0), pa = new Float32Array(0);
/** Квантований колір клітинки з минулого тіку — щоб бачити, що змінилось. */
let prev = new Uint32Array(0);
// Розмите поле (premultiplied), максимум розмитої прозорості і максимум
// справжньої прозорості в околі 3×3 — для форми й сили ефекту.
let br = new Float32Array(0), bg = new Float32Array(0), bb = new Float32Array(0), ba = new Float32Array(0);
let mB = new Float32Array(0), mA = new Float32Array(0), tmp = new Float32Array(0);
let tilesW = 0, tilesH = 0, dirtyTiles = new Uint8Array(0), firstRun = true;

export function setupEffects(): void {
  const c = document.createElement('canvas');
  c.width = world.W * ER; c.height = world.H * ER;
  const ctx = c.getContext('2d')!;
  effectLayer.canvas = c;
  effectLayer.ctx = ctx;
  effectLayer.img = ctx.createImageData(c.width, c.height);
  pr = new Float32Array(world.N); pg = new Float32Array(world.N);
  pb = new Float32Array(world.N); pa = new Float32Array(world.N);
  prev = new Uint32Array(world.N);
  br = new Float32Array(world.N); bg = new Float32Array(world.N);
  bb = new Float32Array(world.N); ba = new Float32Array(world.N);
  mB = new Float32Array(world.N); mA = new Float32Array(world.N); tmp = new Float32Array(world.N);
  tilesW = Math.ceil(world.W / TILE); tilesH = Math.ceil(world.H / TILE);
  dirtyTiles = new Uint8Array(tilesW * tilesH);
  firstRun = true;
}

function markTileAround(x: number, y: number): void {
  // клітинка впливає на розмите поле й максимуми в радіусі 2, плюс білінійка
  const tx0 = Math.max(0, ((x - 3) / TILE) | 0), tx1 = Math.min(tilesW - 1, ((x + 3) / TILE) | 0);
  const ty0 = Math.max(0, ((y - 3) / TILE) | 0), ty1 = Math.min(tilesH - 1, ((y + 3) / TILE) | 0);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) dirtyTiles[ty * tilesW + tx] = 1;
}

let R = 0, G = 0, B = 0, A = 0;
function over(r: number, g: number, b: number, a: number): void {
  if (a <= 0) return;
  const na = a + A * (1 - a);
  R = (r * a + R * A * (1 - a)) / na;
  G = (g * a + G * A * (1 - a)) / na;
  B = (b * a + B * A * (1 - a)) / na;
  A = na;
}

function computeCells(frame: number): void {
  const { W, H, hgt, cover, snow, wet, grazed, timer, vari } = world;
  lights.length = 0; weatherStats.visFire = 0; weatherStats.visLava = 0;
  viewBounds.x0 = -camera.camX / camera.zoom / SUB;
  viewBounds.y0 = -camera.camY / camera.zoom / SUB;
  viewBounds.x1 = (view.canvas.width - camera.camX) / camera.zoom / SUB;
  viewBounds.y1 = (view.canvas.height - camera.camY) / camera.zoom / SUB;
  const flick = frame * 0.55;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, c = cover[i];
    R = 0; G = 0; B = 0; A = 0;
    if (hgt[i] < SEA) {
      if (c === C_ICE) over(222, 244, 252, 0.96);
    } else {
      if (wet[i] > 0) over(30, 50, 84, 0.16);
      if (c === C_NONE && grazed[i] > 0) over(164, 134, 86, Math.min(0.55, grazed[i] / 260));
      if (c === C_BURNT) over(56, 44, 38, 0.86);
      else if (c === C_BASALT) {
        const hot = timer[i] > 500 ? Math.min(1, (timer[i] - 500) / 400) : 0;
        over(66 + 84 * hot, 60 + 4 * hot, 64 - 28 * hot, 0.95);
      } else if (c === C_FIRE) {
        const t = 0.5 + 0.5 * Math.sin(flick + vari[i] * 17);
        over(255, 110 + 70 * t, 30 + 30 * t, 0.95);
        lights.push(x * SUB + SUB / 2, y * SUB, 1.2);
        if (x >= viewBounds.x0 && x <= viewBounds.x1 && y >= viewBounds.y0 && y <= viewBounds.y1) weatherStats.visFire++;
      } else if (c === C_LAVA) {
        const t = 0.5 + 0.5 * Math.sin(flick + vari[i] * 12);
        over(226 + 29 * t, 64 + 132 * t, 18 + 46 * t, 1);
        if (vari[i] < 0.4) lights.push(x * SUB + SUB / 2, y * SUB + SUB / 2, 0.8);
        if (x >= viewBounds.x0 && x <= viewBounds.x1 && y >= viewBounds.y0 && y <= viewBounds.y1) weatherStats.visLava++;
      }
      if (snow[i] > 0 && c !== C_FIRE && c !== C_LAVA) over(246, 250, 254, Math.min(1, snow[i] / 200) * 0.97);
    }
    pr[i] = R * A; pg[i] = G * A; pb[i] = B * A; pa[i] = A;
    const key = A <= 0.004 ? 0 : (((R >> 2) << 24) | ((G >> 2) << 18) | ((B >> 2) << 12) | ((A * 255) | 0)) >>> 0 | 1;
    if (key !== prev[i]) { prev[i] = key; markTileAround(x, y); }
  }
}

/** Розмиття 1-2-1 по обох осях: src → dst. */
function blur(src: Float32Array, dst: Float32Array): void {
  const { W, H } = world;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const l = src[r + (x > 0 ? x - 1 : x)], c = src[r + x], rr = src[r + (x < W - 1 ? x + 1 : x)];
      tmp[r + x] = (l + 2 * c + rr) * 0.25;
    }
  }
  for (let y = 0; y < H; y++) {
    const ru = (y > 0 ? y - 1 : y) * W, r = y * W, rd = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) dst[r + x] = (tmp[ru + x] + 2 * tmp[r + x] + tmp[rd + x]) * 0.25;
  }
}
/** Максимум в околі 3×3: src → dst. */
function max3(src: Float32Array, dst: Float32Array): void {
  const { W, H } = world;
  for (let y = 0; y < H; y++) {
    const r = y * W;
    for (let x = 0; x < W; x++) {
      const l = src[r + (x > 0 ? x - 1 : x)], c = src[r + x], rr = src[r + (x < W - 1 ? x + 1 : x)];
      tmp[r + x] = l > c ? (l > rr ? l : rr) : (c > rr ? c : rr);
    }
  }
  for (let y = 0; y < H; y++) {
    const ru = (y > 0 ? y - 1 : y) * W, r = y * W, rd = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < W; x++) {
      const u = tmp[ru + x], c = tmp[r + x], d = tmp[rd + x];
      dst[r + x] = u > c ? (u > d ? u : d) : (c > d ? c : d);
    }
  }
}

function rasterize(cx0: number, cy0: number, cx1: number, cy1: number): void {
  const { W, H } = world;
  const data = effectLayer.img.data, EW = W * ER;
  const px0 = cx0 * ER, px1 = (cx1 + 1) * ER, py0 = cy0 * ER, py1 = (cy1 + 1) * ER;
  for (let py = py0; py < py1; py++) {
    const fy = (py + 0.5) / ER - 0.5;
    let y0 = Math.floor(fy);
    const ty = fy - y0;
    let y1 = y0 + 1;
    if (y0 < 0) y0 = 0;
    if (y1 >= H) y1 = H - 1;
    const r0 = y0 * W, r1 = y1 * W;
    let q = (py * EW + px0) * 4;
    for (let px = px0; px < px1; px++, q += 4) {
      const fx = (px + 0.5) / ER - 0.5;
      let x0 = Math.floor(fx);
      const tx = fx - x0;
      let x1 = x0 + 1;
      if (x0 < 0) x0 = 0;
      if (x1 >= W) x1 = W - 1;
      const a = r0 + x0, b = r0 + x1, c = r1 + x0, d = r1 + x1;
      if (mA[a] + mA[b] + mA[c] + mA[d] === 0) { data[q + 3] = 0; continue; }
      const wa = (1 - tx) * (1 - ty), wb = tx * (1 - ty), wc = (1 - tx) * ty, wd = tx * ty;
      const al = ba[a] * wa + ba[b] * wb + ba[c] * wc + ba[d] * wd;
      if (al <= 1e-4) { data[q + 3] = 0; continue; }
      const ml = mB[a] * wa + mB[b] * wb + mB[c] * wc + mB[d] * wd;
      // "загострення": плавний, але вузький перехід навколо половини сили
      let k = al / ml;
      k = k <= 0.38 ? 0 : k >= 0.62 ? 1 : (k - 0.38) / 0.24;
      k = k * k * (3 - 2 * k);
      // темніший "обідок" по краю плями — мультяшний контур снігу/згарища
      const inv = (1 - 0.34 * 4 * k * (1 - k)) / al;
      data[q] = (br[a] * wa + br[b] * wb + br[c] * wc + br[d] * wd) * inv;
      data[q + 1] = (bg[a] * wa + bg[b] * wb + bg[c] * wc + bg[d] * wd) * inv;
      data[q + 2] = (bb[a] * wa + bb[b] * wb + bb[c] * wc + bb[d] * wd) * inv;
      data[q + 3] = (mA[a] * wa + mA[b] * wb + mA[c] * wc + mA[d] * wd) * k * 255;
    }
  }
}

export function updateEffects(frame: number): void {
  computeCells(frame);
  blur(pr, br); blur(pg, bg); blur(pb, bb); blur(pa, ba);
  max3(ba, mB); max3(pa, mA);
  const { W, H } = world;
  if (firstRun) { dirtyTiles.fill(1); firstRun = false; }
  for (let t = 0; t < dirtyTiles.length; t++) {
    if (!dirtyTiles[t]) continue;
    dirtyTiles[t] = 0;
    const tx = t % tilesW, ty = (t / tilesW) | 0;
    const cx0 = tx * TILE, cy0 = ty * TILE;
    const cx1 = Math.min(W - 1, cx0 + TILE - 1), cy1 = Math.min(H - 1, cy0 + TILE - 1);
    rasterize(cx0, cy0, cx1, cy1);
    effectLayer.ctx.putImageData(effectLayer.img, 0, 0, cx0 * ER, cy0 * ER, (cx1 - cx0 + 1) * ER, (cy1 - cy0 + 1) * ER);
  }
}
