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
  markDirty();
}

export function composeWorld(hi: boolean): void {
  const g = worldImage.ctx;
  g.imageSmoothingEnabled = true;
  g.drawImage(terrainLayer.canvas, 0, 0);
  g.drawImage(effectLayer.canvas, 0, 0, world.BW, world.BH);
  if (!hi) g.drawImage(vegLayer.canvas, 0, 0);
  worldImage.hi = hi;
}

/** Оновлює всі шари. Якщо розмір світу змінився (завантажене збереження) — перестворює їх. */
export function renderBuffer(frame: number): void {
  if (!terrainLayer.canvas || terrainLayer.canvas.width !== world.BW || terrainLayer.canvas.height !== world.BH) setupTileBuffer();
  updateTerrain();
  updateEffects(frame);
  updateVegetation();
  bumpVegVersion();
  composeWorld(isHiDetail());
}
