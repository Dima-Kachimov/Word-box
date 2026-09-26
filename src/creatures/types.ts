// Тип "жива істота". Це стан-машина з великою кількістю необовʼязкових
// полів (кожен стан AI використовує свій піднабір) — так само, як у
// оригінальному прототипі, де тварина була простим динамічним обʼєктом.
// Навмисно не розбито на клас-ієрархію: логіка станів у creatures/ai.ts
// написана під конкретні поля, і рефакторинг у класи означав би переписати
// (і ризикувати зламати) саму механіку.

import type { Species } from './species';

export type AnimalState =
  | 'wander' | 'eat' | 'toFood' | 'drink' | 'toWater' | 'sleep' | 'rest'
  | 'flee' | 'stalk' | 'chase' | 'feast' | 'lurk' | 'tossed' | 'mate'
  | 'follow' | 'dive' | 'climb' | 'circle';

export interface Goal { x: number; y: number; }

export interface Animal {
  S: Species;
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  dir: 1 | -1;
  t: number;
  timer: number;
  think: number;
  state: AnimalState;
  z: number; vz: number;
  pal: number;
  hunger: number;
  thirst: number;
  stam: number;
  phase: number;
  hx: number; hy: number;
  baby: number;
  jump: number;
  age: number;
  life: number;
  mateCd: number;
  stuck: number;
  emoT: number;
  wa: number;
  idle?: boolean;

  dead?: boolean;
  how?: string;
  goneT?: number;

  target?: Animal | null;
  goal?: Goal;
  waterMem?: Goal | null;
  mom?: Animal | null;
  lead?: Animal | null;
  ox?: number; oy?: number;
  partner?: Animal | null;
  fleeT?: number;
  fx?: number; fy?: number;
  prowl?: boolean;
  emo?: string;

  // орел
  alt?: number;
  cx?: number; cy?: number;

  // метелик/кажан/світлячок
  auto?: boolean;
}
