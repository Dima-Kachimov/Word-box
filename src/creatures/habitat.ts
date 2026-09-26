import { world, tileAt } from '../world/state';
import { rnd } from '../world/noise';
import { SEA, SAND, HILL, DEEP, ROCK, B_TUNDRA, B_DESERT, C_LAVA, C_ICE, C_FIRE, C_BURNT, C_TREE, C_NONE } from '../world/constants';
import { isVeg } from '../world/generate';
import { F_GRASS, F_BROWSE, F_DESERT, F_FISH, F_BUGS, type Species } from './species';
import type { Animal, Goal } from './types';

export { tileAt };

/** Чи може вид даного "kind" взагалі перебувати на клітинці i. */
export function canBe(S: Species, i: number): boolean {
  if (i < 0) return false;
  const h = world.hgt[i], c = world.cover[i];
  switch (S.kind) {
    case 'land':
      if (c === C_LAVA) return false;
      if (h < SEA) return c === C_ICE || !!S.swim || (!!S.amphib && h > DEEP + 0.04);
      return h < ROCK;
    case 'sea': return h < SEA && (!S.deep || h < DEEP + 0.03);
    case 'beach': return h >= SEA - 0.015 && h < SAND + 0.02 && c !== C_LAVA;
    default: return true;
  }
}

export function passable(S: Species, j: number): boolean {
  return j >= 0 && canBe(S, j) && (S.kind === 'sea' || (world.cover[j] !== C_FIRE && world.cover[j] !== C_LAVA));
}

export function nearWater(i: number): boolean {
  if (i < 0) return false;
  const x = i % world.W, y = (i / world.W) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const j = tileAt(x + dx, y + dy);
    if (j >= 0 && world.hgt[j] < SEA && world.cover[j] !== C_ICE) return true;
  }
  return false;
}

export function foodAt(S: Species, i: number): boolean {
  if (i < 0 || world.grazed[i] > 0) return false;
  const h = world.hgt[i], c = world.cover[i], biome = world.biome[i];
  if (c === C_FIRE || c === C_LAVA || c === C_BURNT) return false;
  switch (S.food) {
    case F_GRASS: return isVeg(h) && c === C_NONE && biome !== B_DESERT && (world.snow[i] < 150 || biome === B_TUNDRA);
    case F_BROWSE: return isVeg(h) && (c === C_TREE || c === C_NONE);
    case F_DESERT: return h >= SEA && h < HILL;
    case F_FISH: return nearWater(i);
    case F_BUGS: return h > DEEP;
  }
  return false;
}

export function foodAround(a: Animal): number {
  let n = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (foodAt(a.S, tileAt(a.x + dx, a.y + dy))) n++;
  return n;
}

export function findNear(a: Animal, pred: (j: number) => boolean, maxR: number): Goal | null {
  let best: Goal | null = null, bd = 1e9;
  for (let k = 0; k < 16; k++) {
    const an = k * Math.PI / 8 + rnd() * 0.3, cx = Math.cos(an), cy = Math.sin(an);
    for (let r = 1; r <= maxR; r += (r < 6 ? 1 : 2)) {
      const j = tileAt(a.x + cx * r, a.y + cy * r);
      if (j < 0) break;
      if (pred(j)) { if (r < bd) { bd = r; best = { x: a.x + cx * r, y: a.y + cy * r }; } break; }
    }
  }
  return best;
}
