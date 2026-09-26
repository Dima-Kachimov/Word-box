// Панель "огляду" тварини (клітинка інструменту "Огляд"): показує стан,
// ситість/спрагу/сили, вік і харчові звʼязки обраної істоти.

import { creatureState, DEATH } from '../creatures/animal';
import { STATE_TXT } from '../creatures/render';
import { SPECIES } from '../creatures/species';

const inspEl = document.getElementById('insp')!;

function bar(v: number, color: string): string {
  const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
  return `<span class="bar"><i style="width:${pct}%;background:${color}"></i></span>`;
}

export function updateInspect(): void {
  const a = creatureState.selected;
  if (!a) { inspEl.style.display = 'none'; return; }
  inspEl.style.display = 'block';
  const S = a.S;
  if (a.dead) {
    inspEl.innerHTML = `<b>${S.name}</b><br>${DEATH[a.how || ''] || 'Загинув'}`;
    if (!a.goneT) a.goneT = creatureState.fc;
    if (creatureState.fc - a.goneT > 240) creatureState.selected = null;
    return;
  }
  let st = STATE_TXT[a.state] || a.state;
  if (a.state === 'toFood' && S.eats && a.prowl) st = 'Вистежує здобич';
  if ((a.state === 'stalk' || a.state === 'chase' || a.state === 'dive') && a.target) st += ': ' + a.target.S.name.toLowerCase();
  const days = Math.floor(a.age / 9000);
  let html = `<b>${S.name}${a.baby > 0 ? ' (малюк)' : ''}</b><br>${st}`;
  if (S.kind === 'land') {
    html += `<br>Ситість${bar(1 - a.hunger, '#7ad05a')}`;
    if (S.thirsty) html += `<br>Вода${bar(1 - a.thirst, '#5ab8ff')}`;
    if (S.eats) html += `<br>Сили${bar(a.stam / S.stam, '#ffd23c')}`;
    html += `<br>Вік: ${days} дн.`;
    if (S.eats) html += `<br>Полює на: ${S.eats.map(e => SPECIES[e].name.toLowerCase()).join(', ')}`;
    else if (S.preyOf) html += `<br>Боїться: ${[...S.preyOf].map(e => SPECIES[e].name.toLowerCase()).join(', ')}`;
  }
  inspEl.innerHTML = html;
}
