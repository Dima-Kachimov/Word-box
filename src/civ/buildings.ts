// Будівлі: типи, вартість, місткість і розміщення на сітці світу.
// Будівля живе в клітинці як код world.bld = 1 + раса*BT + тип — так
// рендер рослинності (render/vegetation.ts) малює її тим самим механізмом,
// що й дерева (запікання здалеку, чіткі спрайти зблизька), а вогонь, лава,
// метеорит чи інструмент "Чисто" руйнують її через звичайні шари клітинок.

import { world } from '../world/state';
import { SEA, SAND, ROCK, C_NONE, C_TREE, C_BURNT } from '../world/constants';
import type { RaceId } from './races';

export const T_HALL = 0, T_CASTLE = 1, T_HUT = 2, T_HOUSE = 3, T_TOWER = 4, T_FARM = 5;
/** Кількість типів будівель на расу. */
export const BT = 6;

export const B_NAMES = ['Ратуша', 'Замок', 'Хатина', 'Будинок', 'Вежа', 'Поле'];

/** Скільки жителів вміщує будівля. */
export const CAPACITY = [4, 10, 3, 5, 9, 0];

/** Вартість [дерево, камінь]. Для будинку/вежі/замку — це ціна перебудови з попереднього типу. */
export const COST: [number, number][] = [
  [6, 0],   // ратуша
  [12, 10], // замок (з ратуші)
  [4, 0],   // хатина
  [4, 2],   // будинок (з хатини)
  [6, 6],   // вежа (з будинку)
  [2, 0]    // поле
];

export const bldCode = (race: RaceId, type: number): number => 1 + race * BT + type;
export const bldType = (code: number): number => (code - 1) % BT;
export const bldRace = (code: number): RaceId => (((code - 1) / BT) | 0) as RaceId;

/** Чи можна тут будувати для міста cityId (дерево буде зрубано, згарище розчищено). */
export function buildable(i: number, cityId: number, hills: boolean): boolean {
  const h = world.hgt[i], c = world.cover[i];
  if (h < SEA + 0.008 || h >= (hills ? ROCK + 0.06 : ROCK)) return false;
  if (world.bld[i]) return false;
  if (c !== C_NONE && c !== C_TREE && c !== C_BURNT) return false;
  const o = world.owner[i];
  return o === 0 || o === cityId + 1;
}

/** Поле краще на рівнині (не на піску й не в горах). */
export function farmable(i: number): boolean {
  const h = world.hgt[i];
  return h >= SAND && h < 0.62;
}

/** Ставить будівлю в клітинку. */
export function placeBuilding(i: number, race: RaceId, type: number, cityId: number): void {
  world.bld[i] = bldCode(race, type);
  world.cover[i] = C_NONE;
  world.snow[i] = Math.min(world.snow[i], 30);
  world.owner[i] = cityId + 1;
}

/** Будівля ціла? (не згоріла, не залита лавою, не пішла під воду, не прибрана). */
export function buildingAlive(i: number): boolean {
  if (!world.bld[i]) return false;
  const c = world.cover[i];
  return world.hgt[i] >= SEA && (c === C_NONE || c === C_TREE);
}
