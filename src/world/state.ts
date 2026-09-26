// Єдине сховище стану ландшафту. Масиви типізовані під конкретні дані,
// індекс клітинки i = y * W + x (як в оригіналі).
//
// Реалізовано як один мутований об'єкт (а не окремі let-змінні модуля),
// тому що ES-модулі не дозволяють іншим файлам переприв'язувати імпортовані
// binding'и — а тут потрібно і читати, і повністю перестворювати масиви
// (setupWorldGrid). Мутація полів об'єкта дозволена звідусіль.

export interface WorldState {
  /** Ширина/висота сітки клітинок. */
  W: number;
  H: number;
  /** Кількість клітинок (W*H). */
  N: number;
  /** Розмір текстурного буфера в пікселях (W*SUB, H*SUB). */
  BW: number;
  BH: number;
  /** Насіння генератора шуму для поточного світу. */
  seed: number;
  /** Множник популяцій: у більшому світі тварин і хмар більше (≥1). */
  popK: number;

  /** Висота рельєфу 0..1. */
  hgt: Float32Array;
  /** Покрив клітинки: C_NONE/C_TREE/C_FIRE/C_BURNT/C_ICE/C_LAVA/C_BASALT. */
  cover: Uint8Array;
  /** Лічильник-таймер стану покриву (горіння, застигання лави тощо). */
  timer: Int16Array;
  /** "Мокрота" ґрунту після дощу (гасить вогонь, гальмує пожежу). */
  wet: Uint8Array;
  /** Стабільний випадковий варіант клітинки 0..1 (вибір спрайту/кольору декору). */
  vari: Float32Array;
  /** Позначка "вже займалась цього тіку" — не даємо вогню пройти по колу за один крок. */
  lit: Uint8Array;
  /** Базова температура 0..1 (з широтою і шумом). */
  temp: Float32Array;
  /** Вологість 0..1. */
  moist: Float32Array;
  /** Біом клітинки: B_TEMP/B_TUNDRA/B_DESERT/B_SAVANNA/B_JUNGLE/B_SWAMP. */
  biome: Uint8Array;
  /** Товщина снігового покриву 0..~900. */
  snow: Uint16Array;
  /** Лічильник "витоптано/з'їдено" — трава тимчасово не росте й не годує. */
  grazed: Uint16Array;

}

export const world: WorldState = {
  W: 0, H: 0, N: 0, BW: 0, BH: 0, seed: 0, popK: 1,
  hgt: new Float32Array(0),
  cover: new Uint8Array(0),
  timer: new Int16Array(0),
  wet: new Uint8Array(0),
  vari: new Float32Array(0),
  lit: new Uint8Array(0),
  temp: new Float32Array(0),
  moist: new Float32Array(0),
  biome: new Uint8Array(0),
  snow: new Uint16Array(0),
  grazed: new Uint16Array(0)
};

/**
 * Прямокутник клітинок, у яких змінилась висота/біом з моменту останнього
 * перемальовування рельєфу. Рельєф рендериться дорого (плавні береги), тож
 * рендер перебудовує лише цю область. Світ нічого не знає про рендер —
 * просто накопичує межі, а render/terrain.ts їх забирає й скидає.
 */
export const heightDirty = { x0: 0, y0: 0, x1: -1, y1: -1 };

export function markHeightDirtyCell(i: number): void {
  const x = i % world.W, y = (i / world.W) | 0;
  if (heightDirty.x1 < heightDirty.x0) {
    heightDirty.x0 = heightDirty.x1 = x; heightDirty.y0 = heightDirty.y1 = y;
    return;
  }
  if (x < heightDirty.x0) heightDirty.x0 = x;
  if (x > heightDirty.x1) heightDirty.x1 = x;
  if (y < heightDirty.y0) heightDirty.y0 = y;
  if (y > heightDirty.y1) heightDirty.y1 = y;
}

export function markHeightDirtyAll(): void {
  heightDirty.x0 = 0; heightDirty.y0 = 0;
  heightDirty.x1 = world.W - 1; heightDirty.y1 = world.H - 1;
}

export function tileAt(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= world.W || iy >= world.H) return -1;
  return iy * world.W + ix;
}

export function hAt(x: number, y: number): number {
  const { W, H, hgt } = world;
  x = x < 0 ? 0 : x >= W ? W - 1 : x;
  y = y < 0 ? 0 : y >= H ? H - 1 : y;
  return hgt[y * W + x];
}
