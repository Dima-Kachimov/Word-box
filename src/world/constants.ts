// Базові константи світу: розмір субтайлової сітки, пороги висот рельєфу,
// типи покриву та біомів, швидкості росту рослинності по біомах.

/** Кількість пікселів текстури на одну клітинку сітки. */
export const SUB = 6;
/** Коефіцієнт масштабування дрібних ефектів відносно SUB=6 (SFX/партиклі калібровані під нього). */
export const K = SUB / 4;

// Пороги висоти рельєфу (0..1): від найглибшого моря до вершин у снігу.
export const DEEP = 0.27;
export const SEA = 0.36;
export const SAND = 0.395;
export const GRASS = 0.60;
export const HILL = 0.70;
export const ROCK = 0.86;

// Типи покриву клітинки.
export const C_NONE = 0;
export const C_TREE = 1;
export const C_FIRE = 2;
export const C_BURNT = 3;
export const C_ICE = 4;
export const C_LAVA = 5;
export const C_BASALT = 6;

// Біоми.
export const B_TEMP = 0;
export const B_TUNDRA = 1;
export const B_DESERT = 2;
export const B_SAVANNA = 3;
export const B_JUNGLE = 4;
export const B_SWAMP = 5;

/** Ймовірність проростання дерева за тік для кожного біома (індекс = B_*). */
export const GROW = [0.0008, 0.0004, 0.00015, 0.0003, 0.002, 0.0008];

/** Період симуляційного тіку (мс) — вогонь/ріст/погода оновлюються не щокадру. */
export const TICK = 150;
