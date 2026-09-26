// Раси розумних істот: вигляд, улюблені біоми, характер (агресивність,
// плодючість, сила) і генератор імен для міст, королівств і жителів.

import { rnd } from '../world/noise';
import { B_TEMP, B_TUNDRA, B_DESERT, B_SAVANNA, B_JUNGLE, B_SWAMP } from '../world/constants';

export type RaceId = 0 | 1 | 2 | 3;
export const R_HUMAN: RaceId = 0, R_ELF: RaceId = 1, R_DWARF: RaceId = 2, R_ORC: RaceId = 3;

export interface Race {
  id: RaceId;
  key: string;
  name: string;
  /** Однина для огляду ("Людина", "Ельф"…). */
  one: string;
  /** Біоми, де раса любить селитися (оцінка місця для міста). */
  biomes: number[];
  /** Чи любить гори (гноми). */
  hills?: boolean;
  skin: string;
  hair: string;
  /** Кольори будівель: стіни, дах, акцент. */
  wall: string;
  roof: string;
  trim: string;
  /** 0..1 — наскільки охоче воює. */
  aggr: number;
  /** Множник народжуваності. */
  fert: number;
  hp: number;
  atk: number;
  /** Дальність атаки в клітинках (ельфи — лучники). */
  range: number;
  speed: number;
  /** Тривалість життя в кадрах (середня). */
  life: number;
  /** Склади для імен: [початки, закінчення]. */
  syl: [string[], string[]];
  cityEnd: string[];
  realm: string[];
}

export const RACES: Race[] = [
  {
    id: 0, key: 'human', name: 'Люди', one: 'Людина',
    biomes: [B_TEMP, B_SAVANNA], skin: '#f2c9a0', hair: '#6a4428',
    wall: '#f4e2c0', roof: '#d8434b', trim: '#8a5a32',
    aggr: 0.5, fert: 1, hp: 10, atk: 2.2, range: 0.9, speed: 0.022, life: 30000,
    syl: [['Бо', 'Свя', 'Яро', 'Ми', 'Во', 'Ра', 'Ост', 'Люб', 'Бра', 'Ве', 'До', 'Зо'], ['слав', 'мир', 'дан', 'рад', 'бор', 'гост', 'зар', 'вит', 'лад']],
    cityEnd: ['град', 'поль', 'ів', 'ськ', 'бург', 'город'],
    realm: ['Королівство', 'Князівство', 'Держава']
  },
  {
    id: 1, key: 'elf', name: 'Ельфи', one: 'Ельф',
    biomes: [B_JUNGLE, B_TEMP, B_SWAMP], skin: '#f6e2c8', hair: '#f2d46a',
    wall: '#c9a36a', roof: '#4fae54', trim: '#f2e6a6',
    aggr: 0.3, fert: 0.75, hp: 8, atk: 2.4, range: 3.6, speed: 0.025, life: 52000,
    syl: [['Ае', 'Ель', 'Лі', 'Са', 'Іл', 'Фа', 'Ні', 'Ті', 'Ам', 'Ері'], ['ріель', 'ндор', 'віен', 'ліас', 'ріон', 'тіль', 'наель', 'дріль']],
    cityEnd: ['ліон', 'ндор', 'лорн', 'віль', 'раель'],
    realm: ['Ліс', 'Двір', 'Край']
  },
  {
    id: 2, key: 'dwarf', name: 'Гноми', one: 'Гном',
    biomes: [B_TUNDRA, B_TEMP], hills: true, skin: '#eab38a', hair: '#b8562a',
    wall: '#a8a29a', roof: '#5f6f86', trim: '#e0b040',
    aggr: 0.45, fert: 0.85, hp: 15, atk: 2.6, range: 0.9, speed: 0.019, life: 42000,
    syl: [['Тор', 'Гім', 'Дур', 'Бал', 'Гро', 'Кар', 'Брам', 'Дві', 'Ор', 'Фун'], ['ін', 'лі', 'ґар', 'рік', 'дін', 'бур', 'нар', 'грім']],
    cityEnd: ['гард', 'гейм', 'кузня', 'горн', 'дум'],
    realm: ['Гірське царство', 'Клан', 'Твердиня']
  },
  {
    id: 3, key: 'orc', name: 'Орки', one: 'Орк',
    biomes: [B_SAVANNA, B_DESERT, B_SWAMP], skin: '#7fae4a', hair: '#2e2a26',
    wall: '#a8784a', roof: '#6a4424', trim: '#e8dcc0',
    aggr: 0.85, fert: 1.25, hp: 13, atk: 2.8, range: 0.9, speed: 0.023, life: 24000,
    syl: [['Гра', 'Зуг', 'Мор', 'Урк', 'Гор', 'Шаг', 'Кру', 'Бур', 'Дра', 'Ґро'], ['ак', 'груш', 'тар', 'зог', 'бах', 'ґул', 'рук', 'маш']],
    cityEnd: ['-Гор', '-Зуг', 'граш', 'мок', 'бар'],
    realm: ['Орда', 'Плем\'я', 'Ватага']
  }
];

const pick = <T>(a: T[]): T => a[(rnd() * a.length) | 0];

/** Ім'я жителя. */
export function personName(r: Race): string {
  return pick(r.syl[0]) + pick(r.syl[1]);
}

/** Назва міста. */
export function cityName(r: Race): string {
  const base = pick(r.syl[0]) + (rnd() < 0.5 ? pick(r.syl[1]).slice(0, 2) : '');
  const end = pick(r.cityEnd);
  return end.startsWith('-') ? base + end : base + end;
}

/** Назва королівства за назвою його першого міста. */
export function realmName(r: Race, city: string): string {
  return pick(r.realm) + ' ' + city;
}

/** Рід назви держави — щоб узгоджувати дієслова ("Орда впала", "Клан впав"). */
const FEM = ['Орда', 'Ватага', 'Держава', 'Твердиня'], MASC = ['Ліс', 'Двір', 'Край', 'Клан'];
export function verb(realm: string, neut: string, fem: string, masc: string): string {
  const w = realm.split(' ')[0];
  return FEM.includes(w) ? fem : MASC.includes(w) ? masc : neut;
}

/** Кольори королівств (прапори, одяг, кордони) — яскраві й помітні на мапі. */
export const KINGDOM_COLORS = [
  '#e8443a', '#3a7be8', '#f2b134', '#9a4ae8', '#2ec4b6', '#ff7ab8',
  '#f07a1e', '#1e9e4a', '#ffffff', '#5a3a9a', '#c8e84a', '#2a2a3a'
];
