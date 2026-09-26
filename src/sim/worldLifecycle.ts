// Оркестрація "народження світу": виділяємо сітку клітинок і текстурний
// буфер під розмір вʼюпорта й обраний розмір світу (initWorld/newWorld), а
// саму генерацію ландшафту робить regenerateWorld. Зміна розміру вікна
// лише масштабує камеру, а не перегенеровує світ.

import { setupWorldGrid, generateTerrain, type WorldSize } from '../world/generate';
import { world } from '../world/state';
import { setupTileBuffer, markDirty } from '../render/buffer';
import { particles } from './particles';
import { clouds, spawnAmbientCloud } from './clouds';
import { tornados, meteors, bolts, waves } from './events';
import { populate } from '../creatures/animal';

export function initWorld(viewportW: number, viewportH: number, size: WorldSize): void {
  newWorld(viewportW, viewportH, size);
}

/** Новий світ заданого розміру: перевиділяє сітку (якщо розмір інший) і генерує ландшафт. */
export function newWorld(viewportW: number, viewportH: number, size: WorldSize): void {
  const W = world.W, H = world.H;
  setupWorldGrid(viewportW, viewportH, size);
  if (world.W !== W || world.H !== H || !W) setupTileBuffer();
  regenerateWorld();
}

export function regenerateWorld(): void {
  generateTerrain();
  particles.length = 0;
  clouds.length = 0;
  tornados.length = 0;
  meteors.length = 0;
  bolts.length = 0;
  waves.length = 0;
  for (let k = 0; k < Math.round(4 * world.popK); k++) spawnAmbientCloud(true);
  populate();
  markDirty();
}
