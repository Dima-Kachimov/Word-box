// Каталог звукових ефектів — коротких синтезованих "нот" і "пострілів шуму",
// зібраних із примітивів audio/engine.ts. Точні параметри (частоти, тривалості,
// гучності) перенесені 1:1 з оригіналу, щоби звучання не змінилось.

import { rnd } from '../world/noise';
import { noiseShot, tone } from './engine';

export const SFX = {
  click(): void { tone({ type: 'square', freqs: [[0, 880], [0.04, 620]], dur: 0.05, vol: 0.04, attack: 0.003 }); },
  pop(): void { tone({ type: 'triangle', freqs: [[0, 420], [0.1, 880]], dur: 0.13, vol: 0.08, attack: 0.005 }); },
  poof(): void { noiseShot({ type: 'bandpass', freq: 700, dur: 0.18, vol: 0.1, attack: 0.005 }); },
  thunder(far?: number): void {
    const d = far || 0;
    noiseShot({ type: 'highpass', freq: 2200, dur: 0.15, vol: 0.4 * (1 - d * 0.7), delay: d * 0.8, attack: 0.003 });
    noiseShot({ type: 'lowpass', freq: 600, freqEnd: 70, dur: 2.4, vol: 0.55 * (1 - d * 0.4), delay: 0.05 + d * 0.8, attack: 0.04 });
    noiseShot({ type: 'lowpass', freq: 260, freqEnd: 50, dur: 1.8, vol: 0.35, delay: 0.6 + d * 0.8, attack: 0.25 });
  },
  boom(): void {
    tone({ type: 'sine', freqs: [[0, 95], [1.3, 26]], dur: 1.5, vol: 0.7, attack: 0.008 });
    noiseShot({ type: 'lowpass', freq: 1000, freqEnd: 55, dur: 2.8, vol: 0.65, attack: 0.008 });
    noiseShot({ type: 'highpass', freq: 1400, dur: 0.3, vol: 0.3, attack: 0.003 });
  },
  whoosh(): void { noiseShot({ type: 'bandpass', freq: 2600, freqEnd: 280, q: 2.2, dur: 1.05, vol: 0.28, attack: 0.35 }); },
  splash(v?: number): void { noiseShot({ type: 'bandpass', freq: 1500, freqEnd: 450, q: 0.9, dur: 0.35, vol: v || 0.15, attack: 0.005 }); },
  hiss(): void { noiseShot({ type: 'highpass', freq: 3200, dur: 0.6, vol: 0.06, attack: 0.05 }); },
  crackle(v: number): void { noiseShot({ type: 'highpass', freq: 1800 + rnd() * 2400, dur: 0.03 + rnd() * 0.04, vol: v, attack: 0.002 }); },
  blup(): void { tone({ type: 'sine', freqs: [[0, 60 + rnd() * 30], [0.16, 150 + rnd() * 60]], dur: 0.2, vol: 0.16, attack: 0.01 }); },
  rumble(): void { noiseShot({ type: 'lowpass', freq: 170, dur: 0.4, vol: 0.14, attack: 0.05 }); },
  cricket(): void {
    const f = 4200 + rnd() * 600;
    for (let k = 0; k < 4; k++) tone({ type: 'sine', freqs: [[0, f], [0.03, f]], dur: 0.035, vol: 0.018, delay: k * 0.06, attack: 0.003 });
  },
  baa(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 340], [0.12, 310], [0.6, 280]], dur: 0.65, vol: 0.1 * v, vib: 7, vibDepth: 20, filter: ['bandpass', 1100, 1.4], attack: 0.04 }); },
  moo(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 115], [0.35, 135], [1.1, 98]], dur: 1.15, vol: 0.16 * v, filter: ['lowpass', 650, 1.2], attack: 0.12 }); },
  cluck(v: number): void {
    for (let k = 0; k < 3; k++) tone({ type: 'square', freqs: [[0, 700 + rnd() * 250], [0.06, 430]], dur: 0.07, vol: 0.045 * v, delay: k * 0.13, filter: ['bandpass', 1200, 2], attack: 0.004 });
  },
  howl(v: number): void { tone({ type: 'sine', freqs: [[0, 380], [0.5, 640], [1.6, 580], [2.3, 420]], dur: 2.4, vol: 0.12 * v, vib: 5, vibDepth: 9, attack: 0.3, echo: true }); },
  tweet(v: number): void {
    const n = 2 + ((rnd() * 3) | 0);
    for (let k = 0; k < n; k++) tone({ type: 'sine', freqs: [[0, 2600 + rnd() * 900], [0.07, 3800 + rnd() * 900]], dur: 0.08, vol: 0.045 * v, delay: k * 0.11, attack: 0.004 });
  },
  gull(v: number): void {
    for (let k = 0; k < 2; k++) tone({ type: 'sawtooth', freqs: [[0, 1450], [0.25, 900]], dur: 0.3, vol: 0.05 * v, delay: k * 0.36, filter: ['bandpass', 1600, 3], attack: 0.02 });
  },
  screech(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 2300], [0.7, 1500]], dur: 0.75, vol: 0.06 * v, vib: 28, vibDepth: 70, filter: ['bandpass', 2200, 4], attack: 0.04, echo: true }); },
  croak(v: number): void { tone({ type: 'square', freqs: [[0, 96], [0.35, 80]], dur: 0.38, vol: 0.09 * v, filter: ['lowpass', 520, 3], am: 24, attack: 0.02 }); },
  whale(v: number): void { tone({ type: 'sine', freqs: [[0, 260], [1.2, 190], [2.4, 390], [3.2, 300]], dur: 3.3, vol: 0.17 * v, vib: 3, vibDepth: 7, attack: 0.6, echo: true }); },
  dolphin(v: number): void { tone({ type: 'sine', freqs: [[0, 1500], [0.15, 3300], [0.3, 2200]], dur: 0.32, vol: 0.045 * v, attack: 0.01 }); },
  squawk(v: number): void {
    for (let k = 0; k < 2; k++) tone({ type: 'sawtooth', freqs: [[0, 650], [0.12, 480]], dur: 0.14, vol: 0.06 * v, delay: k * 0.2, filter: ['bandpass', 900, 3], attack: 0.01 });
  },
  growl(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 72], [0.8, 58]], dur: 0.9, vol: 0.15 * v, filter: ['lowpass', 320, 2], am: 28, attack: 0.08 }); },
  grunt(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 92], [0.3, 70]], dur: 0.35, vol: 0.12 * v, filter: ['lowpass', 420, 1.5], attack: 0.03 }); },
  trumpet(v: number): void { tone({ type: 'sawtooth', freqs: [[0, 420], [0.15, 700], [0.8, 560]], dur: 0.9, vol: 0.09 * v, vib: 9, vibDepth: 25, filter: ['bandpass', 900, 2], attack: 0.05 }); },
  roar(v: number): void {
    noiseShot({ type: 'lowpass', freq: 420, freqEnd: 140, dur: 1.2, vol: 0.22 * v, attack: 0.1 });
    tone({ type: 'sawtooth', freqs: [[0, 115], [1.1, 70]], dur: 1.2, vol: 0.12 * v, filter: ['lowpass', 520, 1.5], am: 18, attack: 0.1 });
  },
  yip(v: number): void {
    for (let k = 0; k < 2; k++) tone({ type: 'square', freqs: [[0, 900], [0.08, 1300], [0.14, 800]], dur: 0.16, vol: 0.045 * v, delay: k * 0.25, filter: ['bandpass', 1100, 3], attack: 0.01 });
  },
  squeak(v: number): void {
    for (let k = 0; k < 3; k++) tone({ type: 'sine', freqs: [[0, 5200], [0.03, 4500]], dur: 0.04, vol: 0.022 * v, delay: k * 0.07, attack: 0.003 });
  }
};

export type VoiceName = 'baa' | 'moo' | 'cluck' | 'howl' | 'gull' | 'screech' | 'croak' | 'whale' | 'dolphin' | 'squawk' | 'growl' | 'trumpet' | 'roar' | 'yip' | 'squeak';

export function playVoice(name: VoiceName, v: number): void {
  (SFX[name] as (v: number) => void)(v);
}
