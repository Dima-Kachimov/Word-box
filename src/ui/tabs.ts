// Нижня панель: вкладки категорій інструментів + сітка кнопок інструментів
// поточної вкладки.

import { hasIcon, iconCanvas } from './icons';
import { getSpeciesIcon } from '../creatures/species';
import { personSprite } from '../civ/art';
import type { RaceId } from '../civ/races';
import { toggleKingdomPanel } from './civPanel';
import { civState } from '../civ/state';
import { creatureState } from '../creatures/animal';
import { uiState } from './state';
import { showToast } from './toast';
import { SFX } from '../audio/sfx';
import { setPanMode } from './hud';

interface TabDef {
  id: string;
  label: string;
  icon: string;
  tools: [string, string][];
}

const TABS: TabDef[] = [
  { id: 'land', label: 'Земля', icon: 'tabLand', tools: [['raise', 'Вище'], ['lower', 'Нижче'], ['tree', 'Ліс'], ['clear', 'Чисто']] },
  { id: 'civ', label: 'Народи', icon: 'tabCiv', tools: [['inspect', 'Огляд'], ['race0', 'Люди'], ['race1', 'Ельфи'], ['race2', 'Гноми'], ['race3', 'Орки'], ['war', 'Розбрат'], ['peace', 'Мир'], ['kingdoms', 'Держави']] },
  { id: 'weather', label: 'Погода', icon: 'cloud', tools: [['rain', 'Дощ'], ['snow', 'Сніг'], ['cloud', 'Хмара'], ['bolt', 'Грім'], ['tornado', 'Смерч']] },
  { id: 'chaos', label: 'Лихо', icon: 'meteor', tools: [['fire', 'Вогонь'], ['lava', 'Лава'], ['meteor', 'Метеор']] },
  { id: 'herb', label: 'Травоїдні', icon: 'cow', tools: [['inspect', 'Огляд'], ['cow', 'Корова'], ['sheep', 'Вівця'], ['chicken', 'Курка'], ['rabbit', 'Заєць'], ['deer', 'Олень'], ['zebra', 'Зебра'], ['elephant', 'Слон'], ['camel', 'Верблюд'], ['penguin', 'Пінгвін'], ['frog', 'Жаба']] },
  { id: 'pred', label: 'Хижаки', icon: 'wolf', tools: [['inspect', 'Огляд'], ['wolf', 'Вовк'], ['fox', 'Лисиця'], ['bear', 'Ведмідь'], ['polar', 'Полярний'], ['lion', 'Лев'], ['tiger', 'Тигр'], ['croc', 'Крокодил']] },
  { id: 'sea', label: 'Море', icon: 'whale', tools: [['inspect', 'Огляд'], ['fish', 'Риби'], ['whale', 'Кит'], ['shark', 'Акула'], ['dolphin', 'Дельфін'], ['crab', 'Краб']] },
  { id: 'sky', label: 'Небо', icon: 'bird', tools: [['inspect', 'Огляд'], ['bird', 'Птахи'], ['gull', 'Чайки'], ['eagle', 'Орел'], ['bat', 'Кажани'], ['butterfly', 'Метелик']] }
];

const HINTS: Record<string, string> = {
  raise: 'Тримай — земля росте', lower: 'Тримай — копай і топи', tree: 'Саджай ліс', clear: 'Прибирає все з землі',
  rain: 'Гасить вогонь і поливає землю', snow: 'Сніг на землі, лід на воді', cloud: 'Гроза: дощ, сніг і блискавки',
  bolt: 'Торкнись — удар блискавки', tornado: 'Смерч вириває дерева', fire: 'Підпали — вітер рознесе вогонь',
  lava: 'Лава тече вниз, у воді застигає', meteor: 'Торкнись — метеорит', inspect: 'Торкнись жителя, міста чи звіра',
  race0: 'Торкнись суші — люди заснують королівство', race1: 'Торкнись лісу — ельфи заснують королівство',
  race2: 'Торкнись гір — гноми заснують королівство', race3: 'Торкнись степу — орки заснують орду',
  war: 'Торкнись міста — його королівство піде війною', peace: 'Торкнись міста — воно укладе мир'
};

let tabsEl: HTMLElement, toolbarEl: HTMLElement;
let onInspectCleared: () => void = () => {};

export function initTabs(tabs: HTMLElement, toolbar: HTMLElement, onInspectClear: () => void): void {
  tabsEl = tabs; toolbarEl = toolbar; onInspectCleared = onInspectClear;
  buildTabs();
  buildTools();
}

function iconFor(id: string): HTMLCanvasElement {
  if (id.startsWith('race')) {
    const c = document.createElement('canvas'); c.width = c.height = 56;
    const s = 56 / 11.5;
    personSprite(+id[4] as RaceId, ['#3a7be8', '#2ec4b6', '#e8443a', '#9a4ae8'][+id[4]], 'king', 0).blit(c.getContext('2d')!, (56 - 6 * s) / 2, (56 - 9 * s) / 2, s);
    return c;
  }
  return hasIcon(id) ? iconCanvas(id) : getSpeciesIcon(id, 56);
}

function buildTabs(): void {
  tabsEl.innerHTML = '';
  TABS.forEach(t => {
    const b = document.createElement('button');
    b.className = 'tab' + (t.id === uiState.tab ? ' active' : '');
    b.appendChild(iconFor(t.icon));
    b.title = t.label; b.setAttribute('aria-label', t.label);
    b.addEventListener('click', () => {
      uiState.tab = t.id;
      buildTabs(); buildTools();
      showToast(t.label, 1000);
    });
    tabsEl.appendChild(b);
  });
}

function buildTools(): void {
  toolbarEl.innerHTML = '';
  const current = TABS.find(t => t.id === uiState.tab)!;
  current.tools.forEach(([id, label]) => {
    const b = document.createElement('button');
    b.className = 'tool' + (id === uiState.tool ? ' active' : '');
    b.appendChild(iconFor(id));
    const s = document.createElement('span'); s.textContent = label; b.appendChild(s);
    b.addEventListener('click', () => {
      if (id === 'kingdoms') { toggleKingdomPanel(); SFX.click(); return; }
      uiState.tool = id;
      if (id !== 'inspect') { creatureState.selected = null; civState.selUnit = null; civState.selCity = null; onInspectCleared(); }
      setPanMode(false);
      buildTools();
      showToast(HINTS[id] || ('Торкнись карти: ' + label.toLowerCase()), 1800);
      SFX.click();
    });
    toolbarEl.appendChild(b);
  });
}
