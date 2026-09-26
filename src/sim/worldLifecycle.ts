// Оркестрація "народження світу": один раз виділяємо сітку клітинок і
// текстурний буфер під поточний розмір вʼюпорта (initWorld), а кожну
// генерацію ландшафту (стартову й по кнопці "Новий світ") — regenerateWorld.
// Розмір сітки після старту не змінюється, як і в оригіналі: зміна розміру
// вікна лише масштабує камеру, а не перегенеровує світ.

import { setupWorldGrid, generateTerrain } from '../world/generate';
import { setupTileBuffer, markDirty } from '../render/buffer';
import { particles } from './particles';
import { clouds, spawnAmbientCloud } from './clouds';
import { tornados, meteors, bolts, waves } from './events';
import { populate } from '../creatures/animal';

export function initWorld(viewportW: number, viewportH: number): void {
  setupWorldGrid(viewportW, viewportH);
  setupTileBuffer();
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
  for (let k = 0; k < 4; k++) spawnAmbientCloud(true);
  populate();
  markDirty();
}
