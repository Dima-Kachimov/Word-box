// Оркестратор шарів світу:
//  • terrain    — плавний рельєф із кривими берегами (оновлюється лише там,
//                 де змінилась висота);
//  • effects    — сніг/згарище/лава/вогонь/лід, щотіку;
//  • vegetation — мультяшні дерева й декор (інкрементально).
// Раз на тік вони зводяться в одне зображення світу (worldCanvas), і
// щокадру на екран масштабується лише воно — одне велике копіювання замість
// трьох. Зблизька дерева малюються окремо чіткими спрайтами, тож у
// зведення тоді не входять.
// Решта коду (тули, події, збереження, головний цикл) як і раніше просто
// кличе markDirty().

import { world } from '../world/state';
import { SUB } from '../world/constants';
import { camera } from './camera';
import { terrainLayer, setupTerrain, updateTerrain } from './terrain';
import { effectLayer, setupEffects, updateEffects } from './effects';
import { vegLayer, setupVegetation, updateVegetation, bumpVegVersion, HI_CELL } from './vegetation';
import { composeTerritory, updateTerritory } from '../civ/render';
import { composeDirty, setupDirty, DTILE } from './dirty';

export { lights, weatherStats, viewBounds } from './effects';

let dirty = true;
export function markDirty(): void { dirty = true; }
export function isDirty(): boolean { return dirty; }
export function clearDirty(): void { dirty = false; }

export const worldImage = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D,
  /** Чи зведено зображення в режимі "зблизька" (без запечених дерев). */
  hi: false
};

export function isHiDetail(): boolean {
  return SUB * camera.zoom >= HI_CELL;
}

export function setupTileBuffer(): void {
  setupTerrain();
  setupEffects();
  setupVegetation();
  const c = document.createElement('canvas');
  c.width = world.BW; c.height = world.BH;
  worldImage.canvas = c;
  worldImage.ctx = c.getContext('2d')!;
  setupDirty();
  markDirty();
}

/** Зводить прямокутник клітинок усіх шарів у зображення світу. */
function composeRect(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, hi: boolean): void {
  const px = x0 * SUB, py = y0 * SUB, pw = Math.min(w * SUB, world.BW - px), ph = Math.min(h * SUB, world.BH - py);
  if (pw <= 0 || ph <= 0) return;
  g.drawImage(terrainLayer.canvas, px, py, pw, ph, px, py, pw, ph);
  g.drawImage(effectLayer.canvas, px, py, pw, ph, px, py, pw, ph);
  composeTerritory(g, x0, y0, pw / SUB, ph / SUB);
  if (!hi) g.drawImage(vegLayer.canvas, px, py, pw, ph, px, py, pw, ph);
}

/**
 * Зводить шари в одне зображення світу. Лише плитки, які шари позначили
 * зміненими (render/dirty.ts), — або все, якщо змінився режим/розмір.
 */
export function composeWorld(hi: boolean): void {
  const g = worldImage.ctx, d = composeDirty;
  g.imageSmoothingEnabled = true;
  if (hi !== worldImage.hi) d.all = true;
  if (d.all || d.count > d.tiles.length * 0.4) {
    composeRect(g, 0, 0, world.W, world.H, hi);
  } else if (d.count) {
    for (let k = 0; k < d.tiles.length; k++) {
      if (!d.tiles[k]) continue;
      composeRect(g, (k % d.tw) * DTILE, ((k / d.tw) | 0) * DTILE, DTILE, DTILE, hi);
    }
  }
  d.tiles.fill(0); d.count = 0; d.all = false;
  worldImage.hi = hi;
}

/** Оновлює всі шари. Якщо розмір світу змінився (завантажене збереження) — перестворює їх. */
export function renderBuffer(frame: number): void {
  if (!terrainLayer.canvas || terrainLayer.canvas.width !== world.BW || terrainLayer.canvas.height !== world.BH) setupTileBuffer();
  updateTerrain();
  updateEffects(frame);
  updateTerritory();
  updateVegetation();
  bumpVegVersion();
  composeWorld(isHiDetail());
}
