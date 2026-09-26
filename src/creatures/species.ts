// Довідник видів: поведінкові параметри (швидкість, зір, дієта, розмноження)
// — перенесені 1:1 з оригінального прототипу, саме вони визначають
// "відчуття" симуляції. Вигляд тварин — векторні малюнки з art.ts
// (текстові піксель-карти оригіналу замінені мультяшною графікою).

import { ART, ART_PAD } from './art';
import { LodSprite } from './sprite';
import type { VoiceName } from '../audio/sfx';
import { B_TEMP, B_TUNDRA, B_DESERT, B_SAVANNA, B_JUNGLE, B_SWAMP } from '../world/constants';

export const F_GRASS = 1, F_BROWSE = 2, F_FISH = 3, F_BUGS = 4, F_DESERT = 5;
export type SpeciesKind = 'land' | 'sea' | 'beach' | 'sky';

export interface Species {
  key: string;
  kind: SpeciesKind;
  name: string;
  legs?: number;
  hop?: boolean;
  speed: number;
  run: number;
  stam: number;
  vision: number;
  hr: number;
  adult: number;
  cap: number;
  init: number;
  group: number;
  thirsty?: boolean;
  diurnal?: boolean;
  nocturnal?: boolean;
  pack?: boolean;
  swim?: boolean;
  amphib?: boolean;
  lurker?: boolean;
  brave?: boolean;
  herd?: boolean;
  school?: boolean;
  deep?: boolean;
  food?: number;
  eats?: string[];
  preyOf?: Set<string>;
  pounce?: number;
  litter?: number;
  breed?: number;
  voice?: VoiceName;
  biomes?: number[];
  alt?: number;
  night?: boolean;
  day?: boolean;
  h: number;
  w: number;
  /** Кількість варіантів забарвлення. */
  pals: number;
  /** imgs[забарвлення][кадр ходьби] — обличчям вправо, дзеркалиться при малюванні. */
  imgs: LodSprite[][];
  /** Поза "лежить" для сну/відпочинку/засідки. */
  lie?: LodSprite[];
}

function LAND(o: Record<string, unknown>): Record<string, unknown> {
  return Object.assign({
    kind: 'land', hr: 0.00022, stam: 170, adult: 2400, vision: 6, thirsty: true,
    diurnal: true, group: 1, init: 1, cap: 30
  }, o);
}

export const SPECIES: Record<string, Species> = {
  // ---- herbivores ----
  cow: LAND({ name: 'Корова', legs: 2, speed: 0.011, run: 0.03, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA], voice: 'moo', init: 2, group: 3, cap: 36, herd: true }),
  sheep: LAND({ name: 'Вівця', legs: 2, speed: 0.012, run: 0.032, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA, B_TUNDRA], voice: 'baa', init: 2, group: 4, cap: 34, herd: true }),
  chicken: LAND({ name: 'Курка', legs: 1, speed: 0.013, run: 0.03, food: F_GRASS, biomes: [B_TEMP], voice: 'cluck', init: 2, group: 3, cap: 28, herd: true, adult: 1800, litter: 2 }),
  rabbit: LAND({ name: 'Заєць', legs: 1, hop: true, speed: 0.016, run: 0.05, vision: 7, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA, B_TUNDRA], init: 3, group: 2, cap: 40, adult: 1600, litter: 2 }),
  deer: LAND({ name: 'Олень', legs: 2, speed: 0.015, run: 0.055, vision: 8, food: F_BROWSE, biomes: [B_TEMP, B_JUNGLE], init: 2, group: 3, cap: 36, herd: true }),
  zebra: LAND({ name: 'Зебра', legs: 2, speed: 0.014, run: 0.052, vision: 7, food: F_GRASS, biomes: [B_SAVANNA], init: 2, group: 4, cap: 40, herd: true }),
  elephant: LAND({ name: 'Слон', legs: 3, brave: true, speed: 0.009, run: 0.024, food: F_BROWSE, biomes: [B_SAVANNA, B_JUNGLE], voice: 'trumpet', init: 1, group: 3, cap: 14, herd: true, adult: 3600, hr: 0.0002 }),
  camel: LAND({ name: 'Верблюд', legs: 3, speed: 0.011, run: 0.03, food: F_DESERT, biomes: [B_DESERT, B_SAVANNA], voice: 'grunt', init: 2, group: 2, cap: 24, herd: true, hr: 0.0002 }),
  penguin: LAND({ name: 'Пінгвін', legs: 1, swim: true, thirsty: false, speed: 0.009, run: 0.022, vision: 5, food: F_FISH, biomes: [B_TUNDRA], voice: 'squawk', init: 2, group: 4, cap: 44, herd: true }),
  frog: LAND({ name: 'Жаба', legs: 1, hop: true, amphib: true, thirsty: false, diurnal: false, speed: 0.012, run: 0.04, vision: 4, food: F_BUGS, biomes: [B_SWAMP, B_JUNGLE], voice: 'croak', init: 3, group: 2, cap: 44, adult: 1600, litter: 2 }),
  // ---- predators ----
  wolf: LAND({ name: 'Вовк', legs: 2, diurnal: false, nocturnal: true, pack: true, speed: 0.014, run: 0.066, stam: 220, vision: 10, pounce: 4, hr: 0.00011, eats: ['sheep', 'chicken', 'rabbit', 'deer', 'cow'], biomes: [B_TEMP, B_TUNDRA], voice: 'howl', init: 1, group: 3, cap: 12 }),
  fox: LAND({ name: 'Лисиця', legs: 1, diurnal: false, nocturnal: true, speed: 0.015, run: 0.064, stam: 200, vision: 8, pounce: 3.5, hr: 0.00011, eats: ['chicken', 'rabbit', 'frog'], biomes: [B_TEMP], voice: 'yip', init: 1, group: 2, cap: 10 }),
  bear: LAND({ name: 'Ведмідь', legs: 2, swim: true, speed: 0.011, run: 0.058, stam: 200, vision: 7, pounce: 3.5, hr: 0.0001, food: F_FISH, eats: ['deer', 'sheep', 'rabbit'], biomes: [B_TEMP], voice: 'growl', init: 1, group: 2, cap: 6 }),
  polar: LAND({ name: 'Білий ведмідь', legs: 2, swim: true, speed: 0.011, run: 0.058, stam: 200, vision: 8, pounce: 3.5, hr: 0.0001, food: F_FISH, eats: ['penguin', 'rabbit', 'sheep'], biomes: [B_TUNDRA], voice: 'growl', init: 1, group: 2, cap: 6 }),
  lion: LAND({ name: 'Лев', legs: 1, diurnal: false, pack: true, speed: 0.012, run: 0.072, stam: 220, vision: 11, pounce: 4, hr: 0.00011, eats: ['zebra', 'camel', 'deer', 'cow', 'elephant'], biomes: [B_SAVANNA], voice: 'roar', init: 1, group: 3, cap: 10 }),
  tiger: LAND({ name: 'Тигр', legs: 1, speed: 0.013, run: 0.074, stam: 220, vision: 10, pounce: 4, hr: 0.00011, eats: ['deer', 'cow', 'sheep', 'zebra', 'elephant'], biomes: [B_JUNGLE], voice: 'roar', init: 1, group: 2, cap: 6 }),
  croc: LAND({ name: 'Крокодил', legs: 1, amphib: true, lurker: true, thirsty: false, diurnal: false, speed: 0.007, run: 0.095, stam: 55, vision: 3, pounce: 3, hr: 0.0001, eats: ['frog', 'deer', 'zebra', 'cow', 'sheep', 'rabbit', 'chicken', 'camel'], biomes: [B_SWAMP, B_JUNGLE], voice: 'growl', init: 1, group: 2, cap: 8 })
} as unknown as Record<string, Species>;

// ---- sea ----
Object.assign(SPECIES, {
  fish: { kind: 'sea', name: 'Риби', school: true, speed: 0.02, run: 0.05, stam: 200, vision: 4, hr: 0, init: 6, group: 5, cap: 80, breed: 0.6 },
  whale: { kind: 'sea', name: 'Кит', deep: true, speed: 0.01, run: 0.02, stam: 100, vision: 4, hr: 0, voice: 'whale', init: 2, cap: 6, breed: 0.1 },
  shark: { kind: 'sea', name: 'Акула', speed: 0.02, run: 0.07, stam: 220, vision: 9, hr: 0.00011, eats: ['fish'], init: 2, cap: 8, breed: 0.12 },
  dolphin: { kind: 'sea', name: 'Дельфін', speed: 0.024, run: 0.07, stam: 220, vision: 8, hr: 0.0001, eats: ['fish'], voice: 'dolphin', init: 1, group: 3, cap: 16, breed: 0.2 },
  crab: { kind: 'beach', name: 'Краб', speed: 0.01, run: 0.03, stam: 100, vision: 3, hr: 0, init: 4, group: 2, cap: 36, breed: 0.4 }
});

// ---- sky ----
Object.assign(SPECIES, {
  bird: { kind: 'sky', name: 'Птахи', alt: 20, speed: 0.045, voice: 'tweet' },
  gull: { kind: 'sky', name: 'Чайки', alt: 18, speed: 0.04, voice: 'gull' },
  eagle: { kind: 'sky', name: 'Орел', alt: 32, speed: 0.03, voice: 'screech', eats: ['rabbit', 'chicken', 'frog', 'fish'] },
  bat: { kind: 'sky', name: 'Кажани', alt: 12, speed: 0.035, voice: 'squeak', night: true },
  butterfly: { kind: 'sky', name: 'Метелик', alt: 6, speed: 0.012, day: true },
  firefly: { kind: 'sky', name: 'Світлячок', alt: 4, speed: 0.01, night: true }
});

/** Світових пікселів на одиницю малюнка art.ts. */
export const ART_SCALE = 0.85;

for (const k in SPECIES) {
  const S = SPECIES[k] as Species;
  const A = ART[k];
  S.key = k;
  S.w = A.w * ART_SCALE;
  S.h = A.h * ART_SCALE;
  S.pals = A.pals.length;
  const sprite = (pal: number, pose: 0 | 1 | 2) => new LodSprite(A.w, A.h, ART_PAD, g => A.draw(g, pose, A.pals[pal]));
  S.imgs = A.pals.map((_, pal) => [sprite(pal, 0), sprite(pal, 1)]);
  if (A.lie) S.lie = A.pals.map((_, pal) => sprite(pal, 2));
  if (!S.stam) S.stam = 150;
  if (!S.run) S.run = S.speed * 2;
}
for (const k in SPECIES) {
  const S = SPECIES[k];
  if (S.eats) for (const e of S.eats) {
    const P = SPECIES[e];
    (P.preyOf = P.preyOf || new Set()).add(k);
  }
}

/** Іконка виду для кнопки інструмента: малюнок, вписаний у квадрат n×n. */
export function getSpeciesIcon(key: string, n = 48): HTMLCanvasElement {
  const S = SPECIES[key], A = ART[key];
  const c = document.createElement('canvas'); c.width = c.height = n;
  const s = (n - 4) / (Math.max(A.w, A.h) + ART_PAD * 2);
  S.imgs[0][0].blit(c.getContext('2d')!, (n - A.w * s) / 2, (n - A.h * s) / 2, s);
  return c;
}
