// Інтерфейс цивілізацій: стрічка хроніки (важливі події світу), панель
// королівств (населення, міста, війни й союзи) і текст огляду жителя/міста.

import { RACES } from '../civ/races';
import { units, cities, kingdoms, chronicle, civState } from '../civ/state';
import { LEVEL_NAMES } from '../civ/cities';
import { DEATH_TXT } from '../civ/units';
import { B_NAMES, bldType } from '../civ/buildings';
import { world } from '../world/state';
import type { Job, Task } from '../civ/types';

let chronEl: HTMLElement, panelEl: HTMLElement, listEl: HTMLElement;
let panelOpen = false, lastChron = -1, lastPanel = 0;

const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

export function initCivUi(wrap: HTMLElement): void {
  chronEl = document.createElement('div');
  chronEl.id = 'chron';
  wrap.appendChild(chronEl);
  panelEl = document.createElement('div');
  panelEl.id = 'kpanel'; panelEl.hidden = true;
  panelEl.innerHTML = '<div class="kHead"><span>Королівства</span><button class="menuBtn kClose">✕</button></div><div class="kList"></div>';
  wrap.appendChild(panelEl);
  listEl = panelEl.querySelector('.kList')!;
  panelEl.querySelector('.kClose')!.addEventListener('click', () => toggleKingdomPanel(false));
}

export function toggleKingdomPanel(open = !panelOpen): void {
  panelOpen = open;
  panelEl.hidden = !open;
  if (open) renderPanel();
}

function renderChronicle(): void {
  const now = performance.now();
  const recent = chronicle.filter(e => now - e.t < 9000).slice(-3);
  const key = recent.length ? recent[recent.length - 1].t * 10 + recent.length : 0;
  if (key === lastChron) return;
  lastChron = key;
  chronEl.innerHTML = recent.map(e => `<div class="cItem" style="border-left-color:${e.color}"><span>${e.icon}</span>${esc(e.text)}</div>`).join('');
}

function renderPanel(): void {
  const alive = kingdoms.filter(k => k.alive);
  const pop = new Map<number, number>(), nc = new Map<number, number>();
  for (const u of units) if (!u.dead) pop.set(u.city.kingdom.id, (pop.get(u.city.kingdom.id) || 0) + 1);
  for (const c of cities) if (c.alive) nc.set(c.kingdom.id, (nc.get(c.kingdom.id) || 0) + 1);
  alive.sort((a, b) => (pop.get(b.id) || 0) - (pop.get(a.id) || 0));
  const byId = new Map(kingdoms.map(k => [k.id, k]));
  listEl.innerHTML = alive.length ? alive.map(k => {
    const wars: string[] = [], allies: string[] = [];
    for (const [id, r] of k.rel) {
      const o = byId.get(id);
      if (!o || !o.alive) continue;
      if (r.war) wars.push(o.name); else if (r.ally) allies.push(o.name);
    }
    const cap = k.capital ? `${k.capital.name} (${LEVEL_NAMES[k.capital.level].toLowerCase()})` : '—';
    return `<div class="kRow"><i style="background:${k.color}"></i><div>
      <b>${esc(k.name)}</b><small>${RACES[k.race].name} · 👥 ${pop.get(k.id) || 0} · 🏘 ${nc.get(k.id) || 0} · столиця ${esc(cap)}</small>
      ${k.king ? `<small>👑 Король ${esc(k.king.name)}</small>` : ''}
      ${wars.length ? `<small class="kWar">⚔️ Війна: ${esc(wars.join(', '))}</small>` : ''}
      ${allies.length ? `<small class="kAlly">🤝 Союз: ${esc(allies.join(', '))}</small>` : ''}
    </div></div>`;
  }).join('') : '<div class="kEmpty">Поки що жодного народу. Засели світ з вкладки «Народи».</div>';
}

/** Викликається з HUD кожні кілька кадрів. */
export function updateCivUi(): void {
  renderChronicle();
  if (panelOpen && performance.now() - lastPanel > 1000) { lastPanel = performance.now(); renderPanel(); }
}

const JOB_TXT: Record<Job, string> = {
  farmer: 'Фермер', woodcutter: 'Лісоруб', miner: 'Каменяр', hunter: 'Мисливець', builder: 'Будівельник', warrior: 'Воїн', king: 'Король'
};
const TASK_TXT: Partial<Record<Task, string>> = {
  idle: 'Думає, чим зайнятись', walk: 'Іде до роботи', work: 'Працює', carry: 'Несе здобуте в місто', build: 'Будує',
  hunt: 'Полює', march: 'Іде в похід', fight: 'Б\'ється!', raid: 'Грабує вороже місто', flee: 'Тікає!', home: 'Іде додому',
  settle: 'Іде засновувати нове місто', patrol: 'Прогулюється'
};

function bar(v: number, color: string): string {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return `<span class="bar"><i style="width:${pct}%;background:${color}"></i></span>`;
}

/** HTML огляду обраного жителя чи міста (або null, якщо нічого не вибрано). */
export function civInspectHtml(): string | null {
  const u = civState.selUnit;
  if (u) {
    const r = RACES[u.race], k = u.city.kingdom;
    if (u.dead) return `<b>${esc(u.name)}</b><br>${DEATH_TXT[u.how || ''] || 'Загинув'}`;
    let t = TASK_TXT[u.task] || u.task;
    if (u.inside) t = 'Спить удома';
    const years = Math.floor(u.age / 900);
    return `<b>${esc(u.name)}</b><br>${r.one} · ${JOB_TXT[u.job]}<br>${esc(u.city.name)} · <span style="color:${k.color}">■</span> ${esc(k.name)}<br>${t}` +
      `<br>Здоров'я${bar(u.hp / u.maxHp, '#7ad05a')}<br>Вік: ${years} р.${u.kills ? ` · Перемог: ${u.kills}` : ''}`;
  }
  const c = civState.selCity;
  if (c) {
    if (!c.alive) return `<b>${esc(c.name)}</b><br>Руїни`;
    const k = c.kingdom, cap = k.capital === c;
    const counts = new Map<number, number>();
    for (const i of c.cells) if (world.bld[i]) { const t = bldType(world.bld[i]); counts.set(t, (counts.get(t) || 0) + 1); }
    const blds = [...counts].map(([t, n]) => `${B_NAMES[t]} ×${n}`).join(', ');
    const war = [...k.rel].filter(([, r]) => r.war).length;
    return `<b>${cap ? '👑 ' : ''}${esc(c.name)}</b><br>${LEVEL_NAMES[c.level]} · ${RACES[c.race].name}<br><span style="color:${k.color}">■</span> ${esc(k.name)}` +
      `<br>👥 ${c.pop} / ${c.cap} місць` +
      `<br>🌾 ${Math.floor(c.food)} · 🪵 ${Math.floor(c.wood)} · 🪨 ${Math.floor(c.stone)}` +
      `<br>${blds || 'Без будівель'}` +
      (c.siege ? `<br><span class="kWar">Облога! ${Math.round(c.siege / 3.6)}%</span>` : war ? '<br><span class="kWar">⚔️ Королівство воює</span>' : '');
  }
  return null;
}
