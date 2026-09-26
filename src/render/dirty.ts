// Спільна сітка "брудних" плиток зведеного зображення світу. Кожен шар
// (рельєф, ефекти, території, рослинність і будівлі) позначає плитки, які
// перемалював, і buffer.ts зводить заново лише їх, а не весь світ щотіку —
// у великому світі з містами це різниця між десятками мілісекунд і одиницями.

import { world } from '../world/state';

/** Розмір плитки в клітинках (той самий, що в effects/vegetation). */
export const DTILE = 8;

export const composeDirty = {
  tw: 0, th: 0,
  tiles: new Uint8Array(0),
  count: 0,
  all: true
};

export function setupDirty(): void {
  composeDirty.tw = Math.ceil(world.W / DTILE);
  composeDirty.th = Math.ceil(world.H / DTILE);
  composeDirty.tiles = new Uint8Array(composeDirty.tw * composeDirty.th);
  composeDirty.count = 0;
  composeDirty.all = true;
}

/** Позначає прямокутник клітинок (включно) для повторного зведення. */
export function markCells(x0: number, y0: number, x1: number, y1: number): void {
  const d = composeDirty;
  if (d.all || !d.tw) return;
  const tx0 = Math.max(0, (x0 / DTILE) | 0), tx1 = Math.min(d.tw - 1, (x1 / DTILE) | 0);
  const ty0 = Math.max(0, (y0 / DTILE) | 0), ty1 = Math.min(d.th - 1, (y1 / DTILE) | 0);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const k = ty * d.tw + tx;
    if (!d.tiles[k]) { d.tiles[k] = 1; d.count++; }
  }
}

export function markAll(): void { composeDirty.all = true; }
