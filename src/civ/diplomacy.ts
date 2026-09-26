// Дипломатія королівств: думка одне про одного (раса, характер, спільний
// кордон, випадкові події), союзи, оголошення війни й мир, захоплення міст,
// повстання далеких провінцій і падіння королівств. Тікає раз на ~4 секунди.

import { rnd } from '../world/noise';
import { SFX } from '../audio/sfx';
import { RACES, realmName, verb } from './races';
import { units, cities, kingdoms, civState, logEvent, forNear, markBordersCity } from './state';
import type { City, Kingdom, Relation } from './types';
import { newKingdom, pickCapital } from './cities';

export function rel(a: Kingdom, b: Kingdom): Relation {
  let r = a.rel.get(b.id);
  if (!r) {
    r = { opinion: a.race === b.race ? 20 : -5, war: false, ally: false, since: civState.frame, losses: 0 };
    a.rel.set(b.id, r); b.rel.set(a.id, r);
  }
  return r;
}

export function atWar(a: Kingdom, b: Kingdom): boolean {
  if (a === b) return false;
  const r = a.rel.get(b.id);
  return !!r && r.war;
}

export function isWarring(k: Kingdom): boolean {
  for (const r of k.rel.values()) if (r.war) return true;
  return false;
}

/** Загибель воїна — рахуємо втрати в усіх війнах королівства (втома від війни). */
export function noteLoss(k: Kingdom): void {
  for (const r of k.rel.values()) if (r.war) r.losses++;
}

function power(k: Kingdom): number {
  let p = 0;
  for (const u of units) if (!u.dead && u.city.kingdom === k) p += u.job === 'warrior' ? 3 : 1;
  return p;
}

function kCities(k: Kingdom): City[] {
  return cities.filter(c => c.alive && c.kingdom === k);
}

/** Мінімальна відстань між містами двох королівств (у клітинках). */
function distance(a: Kingdom, b: Kingdom): number {
  let best = 1e9;
  for (const c of kCities(a)) for (const d of kCities(b)) best = Math.min(best, Math.hypot(c.cx - d.cx, c.cy - d.cy) - c.radius - d.radius);
  return best;
}

export function declareWar(a: Kingdom, b: Kingdom, reason = ''): void {
  const r = rel(a, b);
  if (r.war || !a.alive || !b.alive) return;
  r.war = true; r.ally = false; r.since = civState.frame; r.losses = 0; r.opinion = Math.min(r.opinion, -60);
  logEvent('⚔️', `${a.name} ${verb(a.name, 'оголосило', 'оголосила', 'оголосив')} війну: ${b.name}${reason ? ' — ' + reason : ''}`, '#d8434b');
  SFX.rumble();
  // союзники стають на бік жертви
  for (const k of kingdoms) {
    if (!k.alive || k === a || k === b) continue;
    const rb = k.rel.get(b.id);
    if (rb && rb.ally && !atWar(k, a)) { const ra = rel(k, a); ra.war = true; ra.since = civState.frame; ra.losses = 0; logEvent('🛡', `${k.name} вступає у війну на боці союзника ${b.name}`, k.color); }
  }
}

export function makePeace(a: Kingdom, b: Kingdom): void {
  const r = rel(a, b);
  if (!r.war) return;
  r.war = false; r.since = civState.frame; r.opinion = -10;
  for (const c of cities) if (c.alive && ((c.kingdom === a && c.target?.kingdom === b) || (c.kingdom === b && c.target?.kingdom === a))) c.target = null;
  logEvent('🕊', `Мир між ${a.name} та ${b.name}`, '#3a8a4a');
}

/** Місто переходить до іншого королівства разом із жителями. */
export function captureCity(c: City, by: Kingdom): void {
  const old = c.kingdom;
  if (old === by) return;
  c.kingdom = by; c.siege = 0; c.loyalty = 25; c.target = null;
  markBordersCity(c);
  if (old.capital === c) old.capital = pickCapital(old);
  if (old.king && !old.king.dead && old.king.city === c) { old.king.dead = true; old.king.how = 'war'; old.king = null; }
  for (const u of units) if (!u.dead && u.city === c && u.job === 'warrior') u.job = 'farmer';
  // переможці лишаються в місті: частина — гарнізоном, решта — новими жителями
  let n = 0;
  forNear(c.cx + 0.5, c.cy + 0.5, c.radius + 2, u => {
    if (u.dead || u.city.kingdom !== by || u.job !== 'warrior') return;
    u.city = c; u.task = 'idle';
    if (n++ % 3 !== 0) u.job = 'farmer';
  });
  logEvent('🏴', `${by.name} ${verb(by.name, 'захопило', 'захопила', 'захопив')} ${c.name}`, by.color);
  SFX.boom();
  checkFall(old, by);
}

function checkFall(k: Kingdom, by?: Kingdom): void {
  if (!k.alive || kCities(k).length) return;
  k.alive = false;
  for (const r of k.rel.values()) r.war = false;
  for (const u of units) if (!u.dead && u.city.kingdom === k) { u.dead = true; u.how = 'war'; }
  logEvent('💀', `${k.name} ${verb(k.name, 'впало', 'впала', 'впав')}${by ? ' під натиском ' + by.name : ''}`, '#2b1a14');
}

/** Цілі для воїнів: найближче вороже місто кожному місту королівства. */
function pickTargets(): void {
  for (const c of cities) {
    if (!c.alive) continue;
    if (c.target && (!c.target.alive || !atWar(c.kingdom, c.target.kingdom))) c.target = null;
    if (c.target && rnd() > 0.1) continue;
    let best: City | null = null, bd = 130 * 130;
    for (const d of cities) {
      if (!d.alive || !atWar(c.kingdom, d.kingdom)) continue;
      const dist = (d.cx - c.cx) ** 2 + (d.cy - c.cy) ** 2;
      if (dist < bd) { bd = dist; best = d; }
    }
    c.target = best;
  }
}

function rebellion(): void {
  for (const k of kingdoms) {
    if (!k.alive || !k.capital) continue;
    const own = kCities(k);
    if (own.length < 3) continue;
    for (const c of own) {
      if (c === k.capital || c.pop < 8) continue;
      const far = Math.hypot(c.cx - k.capital.cx, c.cy - k.capital.cy);
      const unrest = (100 - c.loyalty) * 0.01 + far / 120 + own.length * 0.03;
      if (rnd() < unrest * 0.02) {
        const nk = newKingdom(c.race, realmName(RACES[c.race], c.name));
        c.kingdom = nk; nk.capital = c; c.loyalty = 90; c.target = null;
        for (const u of units) if (!u.dead && u.city === c) { if (u.job === 'king') u.job = 'warrior'; }
        const heir = units.find(u => !u.dead && u.city === c);
        if (heir) { heir.job = 'king'; nk.king = heir; }
        markBordersCity(c);
        logEvent('🔥', `Повстання! ${c.name} відділилось від ${k.name}`, nk.color);
        declareWar(k, nk, 'придушити бунт');
        return;
      }
    }
  }
}

/** Дипломатичний тік: зміна думок, війни, мир, союзи, повстання. */
export function diplomacyTick(): void {
  const alive = kingdoms.filter(k => k.alive);
  for (const k of alive) checkFall(k);
  for (let a = 0; a < alive.length; a++) for (let b = a + 1; b < alive.length; b++) {
    const A = alive[a], B = alive[b];
    if (!A.alive || !B.alive) continue;
    const dist = distance(A, B);
    const r = rel(A, B);
    if (dist > 110 && !r.war) { r.opinion += (0 - r.opinion) * 0.02; continue; }
    const ra = RACES[A.race], rb = RACES[B.race];
    let drift = (A.race === B.race ? 1.2 : -0.6) - (ra.aggr + rb.aggr) * 0.9 + (rnd() - 0.5) * 5;
    if (dist < 6) drift -= 1.5; // тісний кордон — сварки
    else if (dist > 50) drift *= 0.5; // далекі сусіди сваряться рідше
    if (r.ally) drift += 1;
    r.opinion = Math.max(-100, Math.min(100, r.opinion + drift));
    const age = civState.frame - r.since;
    if (!r.war) {
      if (r.ally && r.opinion < 10) { r.ally = false; logEvent('💔', `Союз ${A.name} і ${B.name} розпався`, '#7a6152'); }
      if (!r.ally && r.opinion > 55 && age > 1200) { r.ally = true; r.since = civState.frame; logEvent('🤝', `${A.name} та ${B.name} уклали союз`, '#3a8a4a'); continue; }
      const pa = power(A), pb = power(B);
      const [att, def, pAtt, pDef] = pa >= pb ? [A, B, pa, pb] : [B, A, pb, pa];
      const eager = RACES[att.race].aggr;
      if (!r.ally && r.opinion < -35 && age > 900 && pAtt > pDef * 0.8 && pAtt >= 8 && rnd() < 0.25 * eager) {
        const why = ['спірні землі', 'образа посла', 'жага здобичі', 'стара ворожнеча', 'викрадені вівці'][(rnd() * 5) | 0];
        declareWar(att, def, why);
      }
    } else {
      const tired = r.losses > 12 + (pwrCities(A) + pwrCities(B)) * 2;
      if (age > 2400 && (tired || rnd() < 0.05) && rnd() < 0.35) makePeace(A, B);
    }
  }
  pickTargets();
  rebellion();
}

function pwrCities(k: Kingdom): number { return kCities(k).length; }
