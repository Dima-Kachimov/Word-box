// Типи цивілізаційного шару: житель, місто, королівство, стосунки між
// королівствами. Усі посилання — прямі об'єкти (як у тварин), а в сітці
// світу місто позначається своїм id (world.owner = id + 1).

import type { RaceId } from './races';

/** Професія ("клас") жителя. */
export type Job = 'farmer' | 'woodcutter' | 'miner' | 'hunter' | 'builder' | 'warrior' | 'king';

/** Що житель робить просто зараз. */
export type Task =
  | 'idle' | 'walk' | 'work' | 'carry' | 'build' | 'hunt' | 'march' | 'fight' | 'raid'
  | 'flee' | 'home' | 'settle' | 'patrol';

export type Res = 'food' | 'wood' | 'stone';

export interface Unit {
  id: number;
  name: string;
  race: RaceId;
  city: City;
  job: Job;
  x: number; y: number;
  /** Куди йде (клітинки). */
  tx: number; ty: number;
  dir: 1 | -1;
  /** Фаза анімації кроку. */
  t: number;
  task: Task;
  /** Яке завдання почнеться, коли житель дійде до цілі (для task = 'walk'). */
  next: Task;
  /** Лічильник роботи/очікування (кадри). */
  timer: number;
  /** Що несе додому. */
  carry: Res | null;
  carryN: number;
  /** Клітинка, з якою працює (дерево, ферма, будмайданчик). */
  cell: number;
  /** Ціль бою/полювання. */
  foe: Unit | null;
  prey: unknown;
  hp: number;
  maxHp: number;
  age: number;
  life: number;
  cd: number;
  stuck: number;
  /** Сховався в будинку на ніч (не малюється). */
  inside: boolean;
  /** Поселенці: місце нового міста. */
  settle?: { x: number; y: number };
  dead?: boolean;
  how?: string;
  kills: number;
}

export interface Plan { cell: number; type: number; by: Unit | null; }

export interface City {
  id: number;
  name: string;
  race: RaceId;
  kingdom: Kingdom;
  /** Клітинка ратуші. */
  cx: number; cy: number;
  food: number; wood: number; stone: number;
  /** Клітинки з будівлями цього міста. */
  cells: number[];
  pop: number;
  cap: number;
  /** 0 село, 1 містечко, 2 місто, 3 мегаполіс. */
  level: number;
  /** Найвищий досягнутий рівень (щоб подія "стало містом" не повторювалась). */
  best: number;
  radius: number;
  /** Будмайданчики: клітинка, тип будівлі й хто будує (кілька будов одночасно). */
  plans: Plan[];
  loyalty: number;
  /** Куди йдуть воїни міста (id ворожого міста) під час війни. */
  target: City | null;
  /** Скільки кадрів вороги стоять у центрі без захисників — прогрес захоплення. */
  siege: number;
  founded: number;
  alive: boolean;
}

export interface Relation {
  opinion: number;
  war: boolean;
  ally: boolean;
  /** Кадр початку поточного стану (війни/миру). */
  since: number;
  /** Втрати сторін у поточній війні. */
  losses: number;
}

export interface Kingdom {
  id: number;
  name: string;
  race: RaceId;
  color: string;
  capital: City | null;
  king: Unit | null;
  /** Стосунки з іншими королівствами (за id). */
  rel: Map<number, Relation>;
  founded: number;
  alive: boolean;
}
