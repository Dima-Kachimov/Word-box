// Точка входу цивілізаційного шару: щокадрове оновлення жителів, тік міст
// (~1 с) і дипломатії (~4 с), стартові народи для нового світу.

import { rnd } from '../world/noise';
import { world } from '../world/state';
import { SEA, ROCK } from '../world/constants';
import { RACES, type RaceId } from './races';
import { civState, rebuildGrid, resetCiv, kingdoms, cities } from './state';
import { updateUnits } from './units';
import { citiesTick, spawnCivilization } from './cities';
import { diplomacyTick } from './diplomacy';

/** Викликається щокадру (не на паузі). */
export function civFrame(): void {
  civState.frame++;
  rebuildGrid();
  updateUnits();
  if (civState.frame % 60 === 0) citiesTick();
  if (civState.frame % 240 === 120) diplomacyTick();
}

/** Стартові народи: по одному королівству кожної раси (у великому світі — більше). */
export function seedCivilizations(): void {
  resetCiv();
  const n = Math.min(8, Math.round(4 * Math.sqrt(world.popK)));
  const order: RaceId[] = [0, 1, 2, 3, 0, 3, 1, 2];
  for (let k = 0; k < n; k++) {
    const race = order[k], r = RACES[race];
    // найкраще місце: улюблений біом раси і якомога далі від інших народів
    let best = -1, bs = -1e9;
    const mx = world.W * 0.06, my = world.H * 0.06;
    for (let t = 0; t < 700; t++) {
      const x = (mx + rnd() * (world.W - 2 * mx)) | 0, y = (my + rnd() * (world.H - 2 * my)) | 0, i = y * world.W + x;
      const h = world.hgt[i];
      if (h < SEA + 0.02 || h >= ROCK) continue;
      let far = 90;
      for (const c of cities) far = Math.min(far, Math.hypot(c.cx - x, c.cy - y));
      if (far < 18) continue;
      let s = r.biomes.includes(world.biome[i]) ? 12 : 0;
      if (r.hills) s += h > 0.6 ? 8 : 0; else if (h > 0.66) s -= 6;
      s += far * 0.45 + rnd() * 3;
      if (s > bs) { bs = s; best = i; }
    }
    if (best >= 0) spawnCivilization(race, best % world.W, (best / world.W) | 0);
  }
}

export function aliveKingdoms(): number {
  return kingdoms.filter(k => k.alive).length;
}
