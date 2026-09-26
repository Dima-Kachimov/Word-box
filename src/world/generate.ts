import { world } from './state';
import { fbm, clamp, rnd } from './noise';
import {
  SUB, SEA, SAND, GRASS, HILL, B_TEMP, B_TUNDRA, B_DESERT, B_SAVANNA, B_JUNGLE, B_SWAMP,
  C_TREE, C_NONE
} from './constants';

export const isVeg = (h: number): boolean => h >= SAND && h < HILL;

/** Ефективна температура з поправкою на висоту (у горах холодніше). */
export function effTemp(i: number): number {
  return world.temp[i] - Math.max(0, world.hgt[i] - 0.55) * 1.3;
}

export function calcBiome(i: number): number {
  const h = world.hgt[i], t = effTemp(i), m = world.moist[i];
  if (t < 0.28) return B_TUNDRA;
  if (t > 0.62) {
    if (m < 0.4) return B_DESERT;
    if (m < 0.55) return B_SAVANNA;
    return B_JUNGLE;
  }
  if (m > 0.66 && h < 0.52) return B_SWAMP;
  return B_TEMP;
}

export function isCold(i: number): boolean {
  return world.biome[i] === B_TUNDRA || effTemp(i) < 0.33;
}

/** Встановлює висоту клітинки і одразу перераховує її біом. */
export function setH(i: number, v: number): void {
  world.hgt[i] = clamp(v, 0, 1);
  world.biome[i] = calcBiome(i);
}

/**
 * Виділяє сітку клітинок під переданий розмір вʼюпорта. Викликається один раз
 * при старті — розмір сітки після цього не змінюється (як і в оригіналі: resize
 * вікна не перегенеровує світ, лише масштабує камеру).
 */
export function setupWorldGrid(viewportW: number, viewportH: number): void {
  const W = clamp(Math.round(viewportW / 4.2), 80, 200);
  const H = clamp(Math.round(W * viewportH / viewportW), 60, 300);
  allocateGrid(W, H);
}

/**
 * Виділяє масиви сітки під точні W×H — окремо від setupWorldGrid(), щоб
 * збереження/завантаження світу (save/save.ts) могло відтворити ту саму
 * сітку, з якою було збережено, а не перераховувати її з розміру вʼюпорта.
 */
export function allocateGrid(W: number, H: number): void {
  const N = W * H;
  world.W = W; world.H = H; world.N = N;
  world.hgt = new Float32Array(N);
  world.cover = new Uint8Array(N);
  world.timer = new Int16Array(N);
  world.wet = new Uint8Array(N);
  world.vari = new Float32Array(N);
  world.lit = new Uint8Array(N);
  world.temp = new Float32Array(N);
  world.moist = new Float32Array(N);
  world.biome = new Uint8Array(N);
  world.snow = new Uint16Array(N);
  world.grazed = new Uint16Array(N);
  world.BW = W * SUB;
  world.BH = H * SUB;
  world.noise = new Uint8Array(world.BW * world.BH);
  for (let i = 0; i < world.noise.length; i++) world.noise[i] = (rnd() * 256) | 0;
}

/**
 * Генерує рельєф, температуру, вологість, біоми та початкові дерева.
 * Не чіпає тварин/хмари/частинки — це відповідальність sim/worldLifecycle.ts.
 */
export function generateTerrain(): void {
  const { W, H, N } = world;
  world.seed = rnd() * 1000;
  const seed = world.seed;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const dx = (x / (W - 1) - 0.5) * 2, dy = (y / (H - 1) - 0.5) * 2;
    let e = fbm(x / 24, y / 24, seed, 6);
    e = 0.5 + (e - 0.5) * 1.8;
    e += (fbm(x / 6.5, y / 6.5, seed + 13, 3) - 0.5) * 0.1;
    e = e + 0.14 - Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 4) * 0.45 - (dx * dx + dy * dy) * 0.1;
    world.hgt[i] = clamp(e, 0, 1);
    let t = fbm(x / 36, y / 36, seed + 200, 4);
    t = (0.5 + (t - 0.5) * 1.8) * 0.65 + (y / (H - 1)) * 0.5 - 0.08;
    world.temp[i] = clamp(t, 0, 1);
    world.moist[i] = clamp(0.5 + (fbm(x / 22, y / 22, seed + 400, 4) - 0.5) * 1.9, 0, 1);
    world.cover[i] = C_NONE; world.timer[i] = 0; world.wet[i] = 0; world.snow[i] = 0; world.grazed[i] = 0;
    world.vari[i] = rnd();
  }
  for (let i = 0; i < N; i++) world.biome[i] = calcBiome(i);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = world.hgt[i], b = world.biome[i];
    if (h >= SEA && b === B_TUNDRA) world.snow[i] = 250 + ((rnd() * 300) | 0);
    if (!isVeg(h) || h < SAND + 0.01) continue;
    const f = fbm(x / 10, y / 10, seed + 77, 4);
    let tree = false;
    switch (b) {
      case B_TEMP: tree = (f > 0.53 && rnd() < 0.85) || rnd() < 0.03; break;
      case B_JUNGLE: tree = (f > 0.42 && rnd() < 0.9) || rnd() < 0.08; break;
      case B_SWAMP: tree = f > 0.5 && rnd() < 0.55; break;
      case B_TUNDRA: tree = f > 0.55 && rnd() < 0.7; break;
      case B_SAVANNA: tree = rnd() < 0.06; break;
      case B_DESERT: tree = rnd() < 0.025; break;
    }
    if (tree) world.cover[i] = C_TREE;
  }
}
