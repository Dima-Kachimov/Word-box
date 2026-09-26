// Дрібні частинки: дощ, сніг, дим, пара, іскри, уламки. Тут лише фізика й
// список — малювання винесене у render/scene.ts (`drawParticles`).

import { rnd } from '../world/noise';
import { K } from '../world/constants';
import { clock } from './clock';
import { cool } from '../util/cooldown';
import { SFX } from '../audio/sfx';

export type ParticleKind =
  | 'rain' | 'snow' | 'smoke' | 'steam' | 'ember' | 'splash'
  | 'leaf' | 'debris' | 'dust' | 'spark';

export interface Particle {
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; max: number;
  c?: string;
  drag?: number;
}

export const particles: Particle[] = [];

/** Скільки крапель дощу зараз на екрані — читає audio/ambient.ts для гучності петлі дощу. */
export const weatherCounters = { rainCount: 0 };

export function addP(
  kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number,
  extra?: Partial<Particle>
): Particle {
  const p: Particle = { kind, x, y, vx, vy, life, max: life };
  if (extra) Object.assign(p, extra);
  particles.push(p);
  return p;
}

export const rainAt = (bx: number, by: number): Particle =>
  addP('rain', bx - clock.wx * 4 * K, by - 14 * K, clock.wx * 0.6 * K, 2.4 * K, 6);

export const snowAt = (bx: number, by: number): Particle =>
  addP('snow', bx, by - 8 * K, clock.wx * 0.3 * K, 0.35 * K, 22 + rnd() * 14);

export const smokeAt = (bx: number, by: number): Particle =>
  addP('smoke', bx + (rnd() - 0.5) * 2, by, 0.08 + clock.wx * 0.15, -0.28 + clock.wy * 0.05, 45 + rnd() * 25);

export function steamAt(bx: number, by: number): void {
  addP('steam', bx + (rnd() - 0.5) * 3, by, clock.wx * 0.12, -0.35, 30 + rnd() * 20);
  if (cool('hiss', 450)) SFX.hiss();
}

export const emberAt = (bx: number, by: number): Particle =>
  addP('ember', bx + (rnd() - 0.5) * 3, by, (rnd() - 0.5) * 0.4 + clock.wx * 0.2, -0.4 - rnd() * 0.3, 15 + rnd() * 15);

export function burst(
  kind: ParticleKind, bx: number, by: number, n: number, sp: number, colors: string[], life: number
): void {
  for (let k = 0; k < n; k++) {
    const a = rnd() * Math.PI * 2, s = sp * (0.3 + rnd());
    addP(kind, bx, by, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + rnd() * 0.6), {
      c: colors[(rnd() * colors.length) | 0], drag: 0.93
    });
  }
}

export function updateParticles(): void {
  weatherCounters.rainCount = 0;
  for (let k = particles.length - 1; k >= 0; k--) {
    const p = particles[k];
    if (p.kind === 'rain') weatherCounters.rainCount++;
    p.x += p.vx; p.y += p.vy;
    if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
    if (p.kind === 'snow') p.vx += (rnd() - 0.5) * 0.08;
    else if (p.kind === 'leaf') p.vy -= 0.012;
    if (--p.life <= 0) {
      if (p.kind === 'rain' && rnd() < 0.5) addP('splash', p.x, p.y, 0, 0, 6);
      particles.splice(k, 1);
    }
  }
  if (particles.length > 1600) particles.splice(0, particles.length - 1600);
}
