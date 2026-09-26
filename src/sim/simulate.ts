// Клітинкова симуляція ландшафту: поширення вогню, тління, застигання лави,
// танення снігу, ріст рослинності. Викликається раз на симуляційний тік
// (не щокадру) — так само, як в оригіналі.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SUB, SEA, GROW, B_DESERT, B_SAVANNA, B_JUNGLE, B_SWAMP, B_TUNDRA, C_NONE, C_TREE, C_FIRE, C_BURNT, C_ICE, C_LAVA, C_BASALT } from '../world/constants';
import { isVeg, setH } from '../world/generate';
import { clock } from './clock';
import { smokeAt, emberAt, steamAt } from './particles';

function igniteNeighbor(j: number, dx: number, dy: number): void {
  if (world.lit[j] || world.wet[j] > 0 || world.snow[j] > 40) return;
  const h = world.hgt[j], c = world.cover[j];
  if (!isVeg(h)) return;
  const b = world.biome[j];
  const bf = (b === B_DESERT || b === B_SAVANNA) ? 1.5 : b === B_JUNGLE ? 0.8 : b === B_SWAMP ? 0.4 : b === B_TUNDRA ? 0.6 : 1;
  const wf = Math.max(0.15, 1 + 1.1 * (dx * clock.wx + dy * clock.wy) * clock.windS);
  if (c === C_TREE && rnd() < 0.14 * bf * wf) { world.cover[j] = C_FIRE; world.timer[j] = 28 + ((rnd() * 16) | 0); world.lit[j] = 1; }
  else if (c === C_NONE && world.bld[j] && rnd() < 0.16 * wf) { world.cover[j] = C_FIRE; world.timer[j] = 40 + ((rnd() * 20) | 0); world.lit[j] = 1; }
  else if (c === C_NONE && rnd() < 0.035 * bf * wf) { world.cover[j] = C_FIRE; world.timer[j] = 10 + ((rnd() * 8) | 0); world.lit[j] = 1; }
}

function lavaTick(x: number, y: number, i: number): void {
  world.snow[i] = 0;
  let best = -1, bh = world.hgt[i] + 0.006;
  const W = world.W, H = world.H;
  const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
  for (const j of nb) {
    if (j < 0) continue;
    if (world.cover[j] === C_TREE && !world.lit[j] && rnd() < 0.3) { world.cover[j] = C_FIRE; world.timer[j] = 30; world.lit[j] = 1; }
    if (world.snow[j] > 0) { world.snow[j] = 0; if (rnd() < 0.3) steamAt((j % W) * SUB + 2, ((j / W) | 0) * SUB); }
    if (world.cover[j] !== C_LAVA && world.hgt[j] < bh) { bh = world.hgt[j]; best = j; }
  }
  world.timer[i]--;
  if (best >= 0 && world.timer[i] > 10 && rnd() < 0.3) {
    const bx = (best % W) * SUB + 2, by = ((best / W) | 0) * SUB;
    if (world.hgt[best] < SEA) {
      setH(best, SEA + 0.012); world.cover[best] = C_BASALT; world.timer[best] = 900; world.lit[best] = 1; world.timer[i] -= 6;
      for (let n = 0; n < 4; n++) steamAt(bx, by);
    } else { world.cover[best] = C_LAVA; world.timer[best] = world.timer[i] - 8; world.lit[best] = 1; world.timer[i] -= 4; }
  }
  if (world.wet[i] > 0) world.timer[i] -= 3;
  if (world.timer[i] <= 0) { world.cover[i] = C_BASALT; world.timer[i] = 900; setH(i, world.hgt[i] + 0.008); }
  if (rnd() < 0.02) emberAt(x * SUB + 2, y * SUB + 1);
}

/** Один тік клітинкового автомата ландшафту (вогонь/сніг/лава/ріст). */
export function simulate(): void {
  world.lit.fill(0);
  const W = world.W, H = world.H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = world.hgt[i], c = world.cover[i], b = world.biome[i];
    if (world.wet[i] > 0) world.wet[i]--;
    if (world.grazed[i] > 0) world.grazed[i] = Math.max(0, world.grazed[i] - (world.wet[i] ? 3 : 1));
    if (world.lit[i]) continue;
    if (world.snow[i] > 0) {
      if (h < SEA) world.snow[i] = 0;
      else {
        const rate = b === B_TUNDRA ? (world.snow[i] > 300 ? 1 : 0) : b === B_DESERT ? 5 : (b === B_SAVANNA || b === B_JUNGLE) ? 3 : 1;
        if (rate) { world.snow[i] = Math.max(0, world.snow[i] - rate); if (world.snow[i] === 0) world.wet[i] = Math.max(world.wet[i], 40); }
      }
    }
    if (h < SEA) {
      if (c === C_ICE) { if (b !== B_TUNDRA || rnd() < 0.25) world.timer[i]--; if (world.timer[i] <= 0) world.cover[i] = C_NONE; }
      else if (c !== C_NONE) world.cover[i] = C_NONE;
      continue;
    }
    switch (c) {
      case C_ICE: world.cover[i] = C_NONE; break;
      case C_FIRE:
        world.snow[i] = 0;
        if (--world.timer[i] <= 0) { world.cover[i] = C_BURNT; world.timer[i] = 150 + ((rnd() * 200) | 0); }
        else {
          if (x > 0) igniteNeighbor(i - 1, -1, 0);
          if (x < W - 1) igniteNeighbor(i + 1, 1, 0);
          if (y > 0) igniteNeighbor(i - W, 0, -1);
          if (y < H - 1) igniteNeighbor(i + W, 0, 1);
          if (rnd() < 0.05) smokeAt(x * SUB + 2, y * SUB);
          if (rnd() < 0.04) emberAt(x * SUB + 2, y * SUB);
        }
        break;
      case C_BURNT:
        if (world.timer[i] > 0) world.timer[i]--;
        else if (rnd() < (world.wet[i] ? 0.08 : 0.015)) world.cover[i] = C_NONE;
        break;
      case C_LAVA: lavaTick(x, y, i); break;
      case C_BASALT:
        if (world.timer[i] > 0) world.timer[i]--;
        else if (rnd() < 0.004) world.cover[i] = C_NONE;
        break;
      case C_NONE:
        if (!world.bld[i] && isVeg(h) && rnd() < GROW[b] * (world.wet[i] ? 2 : 1)) {
          if ((x > 0 && world.cover[i - 1] === C_TREE) || (x < W - 1 && world.cover[i + 1] === C_TREE) ||
              (y > 0 && world.cover[i - W] === C_TREE) || (y < H - 1 && world.cover[i + W] === C_TREE)) world.cover[i] = C_TREE;
        }
        break;
    }
  }
}
