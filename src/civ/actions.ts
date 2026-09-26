// Втручання гравця в цивілізації: заснувати народ, посіяти розбрат чи мир,
// вибрати жителя/місто для огляду.

import { world, tileAt } from '../world/state';
import { SUB } from '../world/constants';
import { RACES, verb, type RaceId } from './races';
import { units, cities, kingdoms, civState, logEvent } from './state';
import type { City, Unit } from './types';
import { spawnCivilization, cityAt } from './cities';
import { declareWar, makePeace, rel } from './diplomacy';
import { P_SCALE, PH } from './art';

/** Місто під точкою (клітинка належить місту або поруч з центром). */
function cityUnder(x: number, y: number): City | null {
  const i = tileAt(x, y);
  if (i >= 0 && world.owner[i]) {
    const c = cities[world.owner[i] - 1];
    if (c && c.alive) return c;
  }
  return cityAt(x, y, 4);
}

export function playerSpawnRace(race: RaceId, x: number, y: number): string {
  const c = spawnCivilization(race, Math.floor(x), Math.floor(y));
  return c ? `${RACES[race].name} заснували ${c.name}` : 'Тут не вийде заснувати місто — потрібна вільна суша';
}

export function playerWar(x: number, y: number): string {
  const c = cityUnder(x, y);
  if (!c) return 'Торкнись міста, щоб посіяти розбрат';
  const k = c.kingdom;
  let best = null as typeof k | null, bd = 1e9;
  for (const o of kingdoms) {
    if (!o.alive || o === k || rel(k, o).war) continue;
    for (const d of cities) if (d.alive && d.kingdom === o) { const dist = Math.hypot(d.cx - c.cx, d.cy - c.cy); if (dist < bd) { bd = dist; best = o; } }
  }
  if (!best) return `${k.name} вже воює з усіма сусідами`;
  declareWar(k, best, 'розбрат, посіяний богами');
  return `⚔️ ${k.name} йде війною на ${best.name}`;
}

export function playerPeace(x: number, y: number): string {
  const c = cityUnder(x, y);
  if (!c) return 'Торкнись міста, щоб принести мир';
  const k = c.kingdom;
  let n = 0;
  for (const o of kingdoms) if (o.alive && o !== k && rel(k, o).war) { makePeace(k, o); rel(k, o).opinion = 30; n++; }
  if (!n) { for (const o of kingdoms) if (o.alive && o !== k) rel(k, o).opinion = Math.min(100, rel(k, o).opinion + 40); logEvent('🕊', `Боги благословили ${k.name} на дружбу з сусідами`, '#3a8a4a'); }
  return n ? `🕊 ${k.name} ${verb(k.name, 'уклало', 'уклала', 'уклав')} мир` : `${k.name} тепер ${verb(k.name, 'дружнє', 'дружня', 'дружній')} до сусідів`;
}

/** Огляд: житель під пальцем або місто. Повертає true, якщо щось вибрано. */
export function pickCiv(x: number, y: number): boolean {
  let best: Unit | null = null, bd = 1.3;
  const lift = PH * P_SCALE * 0.5 / SUB;
  for (const u of units) {
    if (u.dead || u.inside) continue;
    const d = Math.hypot(u.x - x, u.y - lift - y);
    if (d < bd) { bd = d; best = u; }
  }
  civState.selUnit = best;
  civState.selCity = null;
  if (best) return true;
  const c = cityUnder(x, y);
  if (c) { civState.selCity = c; return true; }
  return false;
}
