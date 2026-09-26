// Нижня панель: вкладки категорій інструментів + сітка кнопок інструментів
// поточної вкладки.

import { hasIcon, iconCanvas } from './icons';
import { getSpeciesIcon } from '../creatures/species';
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
  lava: 'Лава тече вниз, у воді застигає', meteor: 'Торкнись — метеорит', inspect: 'Торкнись звіра — побачиш, що він робить'
};

let tabsEl: HTMLElement, toolbarEl: HTMLElement;
let onInspectCleared: () => void = () => {};

export function initTabs(tabs: HTMLElement, toolbar: HTMLElement, onInspectClear: () => void): void {
  tabsEl = tabs; toolbarEl = toolbar; onInspectCleared = onInspectClear;
  buildTabs();
  buildTools();
}

function iconFor(id: string): HTMLCanvasElement {
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
      uiState.tool = id;
      if (id !== 'inspect') { creatureState.selected = null; onInspectCleared(); }
      setPanMode(false);
      buildTools();
      showToast(HINTS[id] || ('Торкнись карти: ' + label.toLowerCase()), 1800);
      SFX.click();
    });
    toolbarEl.appendChild(b);
  });
}
