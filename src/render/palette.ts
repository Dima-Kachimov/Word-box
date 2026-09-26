// Кольорові палітри рельєфу та функція змішування кольору клітинки за
// висотою/біомом. `col` навмисно є спільним буфером (а не поверненням нового
// масиву): terrainColor() викликається на кожен піксель у гарячому циклі
// renderBuffer(), і повторна алокація масиву на кожен виклик помітно
// просадила б продуктивність — так само було влаштовано в оригіналі.

import { clamp, lerp } from '../world/noise';
import { DEEP, SEA, SAND, GRASS, HILL, ROCK } from '../world/constants';

type RGB = [number, number, number];

export const P = {
  deep0: [24, 62, 138] as RGB, deep1: [36, 96, 182] as RGB,
  sh0: [48, 128, 214] as RGB, sh1: [88, 176, 240] as RGB,
  sand0: [234, 216, 154] as RGB, sand1: [214, 190, 122] as RGB,
  tsand0: [196, 198, 188] as RGB, tsand1: [176, 178, 170] as RGB,
  rk0: [132, 128, 122] as RGB, rk1: [88, 86, 92] as RGB,
  sn0: [224, 232, 240] as RGB, sn1: [255, 255, 255] as RGB
};

export interface BiomePalette { g0: RGB; g1: RGB; h0: RGB; h1: RGB; }

/** Індекс = B_TEMP/B_TUNDRA/B_DESERT/B_SAVANNA/B_JUNGLE/B_SWAMP. */
export const BIO: BiomePalette[] = [
  { g0: [122, 198, 78], g1: [72, 152, 56], h0: [66, 132, 52], h1: [112, 108, 76] },
  { g0: [204, 220, 210], g1: [162, 184, 172], h0: [150, 170, 160], h1: [140, 142, 146] },
  { g0: [240, 208, 134], g1: [220, 178, 104], h0: [208, 152, 98], h1: [162, 110, 74] },
  { g0: [204, 196, 96], g1: [168, 162, 74], h0: [152, 146, 72], h1: [126, 112, 76] },
  { g0: [74, 182, 64], g1: [40, 132, 46], h0: [36, 114, 44], h1: [82, 98, 62] },
  { g0: [106, 128, 72], g1: [76, 100, 58], h0: [72, 98, 58], h1: [98, 102, 74] }
];

/** Спільний вихідний буфер для mix()/terrainColor() — див. коментар вище файлу. */
export const col: [number, number, number] = [0, 0, 0];

export function mix(a: RGB, b: RGB, t: number): void {
  t = clamp(t, 0, 1);
  col[0] = lerp(a[0], b[0], t);
  col[1] = lerp(a[1], b[1], t);
  col[2] = lerp(a[2], b[2], t);
}

/** Записує колір рельєфу для висоти h (0..1) і біома b у спільний буфер `col`. */
export function terrainColor(h: number, b: number): void {
  const bio = BIO[b];
  if (h < DEEP) mix(P.deep0, P.deep1, h / DEEP);
  else if (h < SEA) mix(P.sh0, P.sh1, (h - DEEP) / (SEA - DEEP));
  else if (h < SAND) {
    const t = (h - SEA) / (SAND - SEA);
    b === 1 /* B_TUNDRA */ ? mix(P.tsand0, P.tsand1, t) : mix(P.sand0, P.sand1, t);
  }
  else if (h < GRASS) mix(bio.g0, bio.g1, (h - SAND) / (GRASS - SAND));
  else if (h < HILL) mix(bio.h0, bio.h1, (h - GRASS) / (HILL - GRASS));
  else if (h < ROCK) mix(P.rk0, P.rk1, (h - HILL) / (ROCK - HILL));
  else mix(P.sn0, P.sn1, (h - ROCK) / 0.1);
}
