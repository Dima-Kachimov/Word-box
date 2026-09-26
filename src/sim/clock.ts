// Час доби, вітер, пауза та короткочасні екранні ефекти (струс камери, спалах).
// Це "годинник" симуляції — читається майже всіма модулями (рендер, істоти,
// погода), тому винесений окремо від sim/simulate.ts.

import { clamp, rnd } from '../world/noise';

export const clock = {
  /** Лічильник тіків симуляції (fire/grow/weather), збільшується раз на TICK мс. */
  frame: 0,
  paused: false,

  /** Час доби 0..1 (0 = північ умовно зсунута, рахунок як в оригіналі). */
  tod: 0.05,
  dayCycle: true,
  /** Затемнення екрана вночі 0..~0.62. */
  dark: 0,
  /** Тепле підсвічування на світанку/заході 0..~0.3. */
  warm: 0,

  windA: Math.random() * Math.PI * 2,
  windS: 0.8,
  wx: 1,
  wy: 0,

  /** Струс камери після вибуху (px, гаситься щокадру). */
  shake: 0,
  /** Біла спалахова накладка (блискавка/вибух), гаситься щокадру. */
  flash: 0
};

/** Оновлює напрям/силу вітру — викликається раз на симуляційний тік. */
export function tickWind(ts: number): void {
  clock.windA += (rnd() - 0.5) * 0.06;
  clock.windS = 0.65 + 0.35 * Math.sin(ts / 23000);
  clock.wx = Math.cos(clock.windA);
  clock.wy = Math.sin(clock.windA);
}

/** Просуває час доби — викликається щокадру (dt у мс). */
export function advanceTimeOfDay(dt: number): void {
  if (!clock.dayCycle) return;
  clock.tod = (clock.tod + dt / 150000) % 1;
}

/** Перераховує затемнення/тепле підсвічування з поточного часу доби. */
export function updateLighting(): void {
  if (clock.dayCycle) {
    const sun = Math.cos(clock.tod * Math.PI * 2);
    clock.dark = clamp((-0.2 - sun) * 0.9, 0, 0.62);
    clock.warm = clamp(1 - Math.abs(sun + 0.1) * 3.5, 0, 1) * 0.3;
  } else {
    clock.dark = 0;
    clock.warm = 0;
  }
}

export function isNight(): boolean {
  return clock.dark > 0.35;
}
