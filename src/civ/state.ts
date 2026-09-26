// Спільний стан цивілізацій: списки жителів/міст/королівств, лічильники id,
// хроніка подій і просторова сітка для швидкого пошуку сусідів у бою.

import { world } from '../world/state';
import type { Unit, City, Kingdom } from './types';

export const units: Unit[] = [];
export const cities: City[] = [];
export const kingdoms: Kingdom[] = [];

/** Стріли ельфів у польоті — лише візуал (шкода вже нарахована). */
export interface Arrow { x0: number; y0: number; x1: number; y1: number; t: number; }
export const arrows: Arrow[] = [];

export const civState = {
  nextUnit: 1,
  nextCity: 0,
  nextKingdom: 0,
  /** Лічильник кадрів симуляції цивілізацій (стоїть на паузі). */
  frame: 0,
  /** Обране в огляді. */
  selUnit: null as Unit | null,
  selCity: null as City | null,
  /** Змінилась територія/належність міст — треба перемалювати кордони (прямокутник клітинок). */
  bordersDirty: true,
  borders: { x0: 0, y0: 0, x1: -1, y1: -1, all: true }
};

/** Кордони навколо міста змінились (нова земля, захоплення, повстання). */
export function markBordersCity(c: City): void {
  const r = Math.ceil(c.radius) + 2, b = civState.borders;
  civState.bordersDirty = true;
  if (b.x1 < b.x0) { b.x0 = c.cx - r; b.y0 = c.cy - r; b.x1 = c.cx + r; b.y1 = c.cy + r; return; }
  b.x0 = Math.min(b.x0, c.cx - r); b.y0 = Math.min(b.y0, c.cy - r);
  b.x1 = Math.max(b.x1, c.cx + r); b.y1 = Math.max(b.y1, c.cy + r);
}
export function markBordersAll(): void { civState.bordersDirty = true; civState.borders.all = true; }

/** Місто за id (world.owner − 1). Ids не перевикористовуються, тож це індекс у cities. */
export function cityById(id: number): City | null {
  return cities[id] || null;
}

// ---------------------------------------------------------------- хроніка
export interface ChronicleEntry { text: string; icon: string; color: string; t: number; }
export const chronicle: ChronicleEntry[] = [];

export function logEvent(icon: string, text: string, color = '#2b1a14'): void {
  chronicle.push({ icon, text, color, t: performance.now() });
  if (chronicle.length > 60) chronicle.shift();
}

// ---------------------------------------------------------------- просторова сітка
const CELL = 8;
let gw = 0, gh = 0;
let buckets: Unit[][] = [];

/** Перебудовує сітку жителів (раз на кадр). */
export function rebuildGrid(): void {
  const w = Math.ceil(world.W / CELL), h = Math.ceil(world.H / CELL);
  if (w !== gw || h !== gh) { gw = w; gh = h; buckets = Array.from({ length: w * h }, () => []); }
  for (const b of buckets) b.length = 0;
  for (const u of units) {
    if (u.dead || u.inside) continue;
    const bx = Math.min(gw - 1, Math.max(0, (u.x / CELL) | 0)), by = Math.min(gh - 1, Math.max(0, (u.y / CELL) | 0));
    buckets[by * gw + bx].push(u);
  }
}

/** Обходить жителів у радіусі r клітинок від (x,y). */
export function forNear(x: number, y: number, r: number, fn: (u: Unit) => void): void {
  if (!gw) return;
  const bx0 = Math.max(0, ((x - r) / CELL) | 0), bx1 = Math.min(gw - 1, ((x + r) / CELL) | 0);
  const by0 = Math.max(0, ((y - r) / CELL) | 0), by1 = Math.min(gh - 1, ((y + r) / CELL) | 0);
  const r2 = r * r;
  for (let by = by0; by <= by1; by++) for (let bx = bx0; bx <= bx1; bx++) {
    for (const u of buckets[by * gw + bx]) {
      const dx = u.x - x, dy = u.y - y;
      if (dx * dx + dy * dy <= r2) fn(u);
    }
  }
}

/** Скидає все (новий світ / завантаження). */
export function resetCiv(): void {
  units.length = 0; cities.length = 0; kingdoms.length = 0; chronicle.length = 0; arrows.length = 0;
  civState.nextUnit = 1; civState.nextCity = 0; civState.nextKingdom = 0; civState.frame = 0;
  civState.selUnit = null; civState.selCity = null; markBordersAll();
}
