// Довідник видів: спрайти (текстові "піксель-карти"), палітри та поведінкові
// параметри (швидкість, зір, дієта, розмноження). Значення перенесені 1:1 з
// оригінального прототипу — саме вони визначають "відчуття" симуляції.

import type { Palette } from './spriteCanvas';
import { spriteCanvas } from './spriteCanvas';
import type { VoiceName } from '../audio/sfx';
import { B_TEMP, B_TUNDRA, B_DESERT, B_SAVANNA, B_JUNGLE, B_SWAMP } from '../world/constants';

export const F_GRASS = 1, F_BROWSE = 2, F_FISH = 3, F_BUGS = 4, F_DESERT = 5;
export type SpeciesKind = 'land' | 'sea' | 'beach' | 'sky';

export interface Species {
  key: string;
  kind: SpeciesKind;
  name: string;
  legs?: number;
  hop?: boolean;
  frames: string[][];
  pals: Palette[];
  speed: number;
  run: number;
  stam: number;
  vision: number;
  hr: number;
  adult: number;
  cap: number;
  init: number;
  group: number;
  thirsty?: boolean;
  diurnal?: boolean;
  nocturnal?: boolean;
  pack?: boolean;
  swim?: boolean;
  amphib?: boolean;
  lurker?: boolean;
  brave?: boolean;
  herd?: boolean;
  school?: boolean;
  deep?: boolean;
  food?: number;
  eats?: string[];
  preyOf?: Set<string>;
  pounce?: number;
  litter?: number;
  breed?: number;
  voice?: VoiceName;
  biomes?: number[];
  alt?: number;
  night?: boolean;
  day?: boolean;
  h: number;
  w: number;
  imgs: HTMLCanvasElement[][][];
  lie?: HTMLCanvasElement[][];
}

function LAND(o: Record<string, unknown>): Record<string, unknown> {
  return Object.assign({
    kind: 'land', hr: 0.00022, stam: 170, adult: 2400, vision: 6, thirsty: true,
    diurnal: true, group: 1, init: 1, cap: 30
  }, o);
}

const BEAR_A = ['..........bb.', '....bbbbb.bbb', '..bbbbbbbbbkb', '.bbbbbbbbbbsk', 'bbbbbbbbbbbb.', 'bbbbbbbbbbb..', '.bbbbbbbbbb..', '.bb.bb.bb.bb.', '.kk.kk.kk.kk.'];
const BEAR_B = BEAR_A.slice(0, 7).concat(['.bb..bbbb.bb.', '.kk..kkkk.kk.']);

export const SPECIES: Record<string, Species> = {
  // ---- herbivores ----
  cow: LAND({ name: 'Корова', legs: 2, frames: [
    ['...........c.c', '..........kwwk', '.wwwkkwwwwwwkw', 'twkkkwwwkkwwww', 'twwkkwwwkkwppp', 'twwwwwwkwwkpp.', '.wkwwwwwww....', '..k.kpp.k.k...', '..g.g...g.g...'],
    ['...........c.c', '..........kwwk', '.wwwkkwwwwwwkw', 'twkkkwwwkkwwww', 'twwkkwwwkkwppp', 'twwwwwwkwwkpp.', '.wkwwwwwww....', '...kk.pp..kk..', '..g..g...g..g.']],
    pals: [{ w: '#f4f2ec', k: '#2e2a28', p: '#eaa4a0', c: '#e8dcc0', t: '#2e2a28', g: '#4a4040' }],
    speed: 0.011, run: 0.03, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA], voice: 'moo', init: 2, group: 3, cap: 36, herd: true }),
  sheep: LAND({ name: 'Вівця', legs: 2, frames: [
    ['..w.w.w...', '.wwwwwwkk.', 'wwwwwwwkek', 'wwwwwwwwkk', 'wwwwwwww..', '.sssssss..', '.k.k..k.k.', '.k.k..k.k.'],
    ['..w.w.w...', '.wwwwwwkk.', 'wwwwwwwkek', 'wwwwwwwwkk', 'wwwwwwww..', '.sssssss..', '..kk..kk..', '.k..k.k..k']],
    pals: [{ w: '#f2f0e4', s: '#d2cdbd', k: '#34302e', e: '#ffffff' }],
    speed: 0.012, run: 0.032, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA, B_TUNDRA], voice: 'baa', init: 2, group: 4, cap: 34, herd: true }),
  chicken: LAND({ name: 'Курка', legs: 1, frames: [
    ['....rr.', '...www.', '...wwky', 't..wwr.', 'ttwwww.', '.wvvvw.', '..www..', '..y.y..'],
    ['....rr.', '...www.', '...wwky', 't..wwr.', 'ttwwww.', '.wvvvw.', '..www..', '...y.y.']],
    pals: [{ w: '#fbfaf4', r: '#e0342a', y: '#f2a61e', k: '#1a1a1a', t: '#e6dfcf', v: '#d2cabb' }],
    speed: 0.013, run: 0.03, food: F_GRASS, biomes: [B_TEMP], voice: 'cluck', init: 2, group: 3, cap: 28, herd: true, adult: 1800, litter: 2 }),
  rabbit: LAND({ name: 'Заєць', legs: 1, hop: true, frames: [
    ['....b.b', '....b.b', '....bkb', 'wbbbbbp', 'wbbbbb.', '.bbbb..', '..b.bb.'],
    ['....b.b', '....b.b', '....bkb', 'wbbbbbp', 'wbbbbb.', '.bbbb..', 'bb...b.']],
    pals: [{ b: '#b9a68c', k: '#1a1a1a', w: '#ffffff', p: '#e8a0a0' }],
    speed: 0.016, run: 0.05, vision: 7, food: F_GRASS, biomes: [B_TEMP, B_SAVANNA, B_TUNDRA], init: 3, group: 2, cap: 40, adult: 1600, litter: 2 }),
  deer: LAND({ name: 'Олень', legs: 2, frames: [
    ['.......a.a.', '........aa.', '........bbb', '.......bbkb', '.......bbbd', 'wbbbbbbbbb.', '.bbbbbbbbb.', '..lllllll..', '..b.b..b.b.', '..k.k..k.k.'],
    ['.......a.a.', '........aa.', '........bbb', '.......bbkb', '.......bbbd', 'wbbbbbbbbb.', '.bbbbbbbbb.', '..lllllll..', '.b...b.b..b', '.k...k.k..k']],
    pals: [{ a: '#dccaa2', b: '#a8683a', k: '#1e1612', d: '#1e1612', w: '#f4efe6', l: '#d6ae80' }],
    speed: 0.015, run: 0.055, vision: 8, food: F_BROWSE, biomes: [B_TEMP, B_JUNGLE], init: 2, group: 3, cap: 36, herd: true }),
  zebra: LAND({ name: 'Зебра', legs: 2, frames: [
    ['.........kk.', '........kwww', 't......kwwkw', 'twkwkwkwkwwd', '.wkwkwkwkw..', '.kwkwkwkwk..', '.w.w...w.w..', '.k.k...k.k..'],
    ['.........kk.', '........kwww', 't......kwwkw', 'twkwkwkwkwwd', '.wkwkwkwkw..', '.kwkwkwkwk..', 'w...ww...w..', 'k...kk...k..']],
    pals: [{ w: '#f6f6f2', k: '#1c1c20', d: '#3a3a3e', t: '#1c1c20' }],
    speed: 0.014, run: 0.052, vision: 7, food: F_GRASS, biomes: [B_SAVANNA], init: 2, group: 4, cap: 40, herd: true }),
  elephant: LAND({ name: 'Слон', legs: 3, brave: true, frames: [
    ['..........ggg...', '..ggggggggeeggg.', '.gggggggggeeegkg', 'tgggggggggeeeggg', 'tgggggggggeeeggw', '.gggggggggeegg.g', '.ggggggggggggg.g', '.gggggggggggg..g', '.gg.gg...gg.gg..', '.gg.gg...gg.gg..', '.ll.ll...ll.ll..'],
    ['..........ggg...', '..ggggggggeeggg.', '.gggggggggeeegkg', 'tgggggggggeeeggg', 'tgggggggggeeeggw', '.gggggggggeegg.g', '.ggggggggggggg.g', '.gggggggggggg..g', '.gg..gg.gg..gg..', '.gg..gg.gg..gg..', '.ll..ll.ll..ll..']],
    pals: [{ g: '#8c9096', e: '#6e7278', k: '#1c1c1c', w: '#f4f0e0', t: '#6a6e74', l: '#b8b4ac' }],
    speed: 0.009, run: 0.024, food: F_BROWSE, biomes: [B_SAVANNA, B_JUNGLE], voice: 'trumpet', init: 1, group: 3, cap: 14, herd: true, adult: 3600, hr: 0.0002 }),
  camel: LAND({ name: 'Верблюд', legs: 3, frames: [
    ['...........cc', '..cc..cc...ck', '.ccccccccc.cc', 'tccccccccccc.', '.cccccccccc..', '..cccccccc...', '..c.c..c.c...', '..c.c..c.c...', '..d.d..d.d...'],
    ['...........cc', '..cc..cc...ck', '.ccccccccc.cc', 'tccccccccccc.', '.cccccccccc..', '..cccccccc...', '.c...cc...c..', '.c...cc...c..', '.d...dd...d..']],
    pals: [{ c: '#cba06a', k: '#2a1e14', t: '#a07848', d: '#7a5a38' }],
    speed: 0.011, run: 0.03, food: F_DESERT, biomes: [B_DESERT, B_SAVANNA], voice: 'grunt', init: 2, group: 2, cap: 24, herd: true, hr: 0.0002 }),
  penguin: LAND({ name: 'Пінгвін', legs: 1, swim: true, thirsty: false, frames: [
    ['..kk..', '.kkkwk', '.kkkky', '.kwwwk', 'kkwwwk', '.kwwwk', '.kwwk.', '.y..y.'],
    ['..kk..', '.kkkwk', '.kkkky', '.kwwwk', 'kkwwwk', '.kwwwk', '.kwwk.', '..yy..']],
    pals: [{ k: '#1c1c28', w: '#f4f4f4', y: '#ff9e24' }],
    speed: 0.009, run: 0.022, vision: 5, food: F_FISH, biomes: [B_TUNDRA], voice: 'squawk', init: 2, group: 4, cap: 44, herd: true }),
  frog: LAND({ name: 'Жаба', legs: 1, hop: true, amphib: true, thirsty: false, diurnal: false, frames: [
    ['....gg', '..ggkg', 'gggggl', 'gllllg', 'gg..gg'],
    ['....gg', '..ggkg', 'gggggl', 'gllllg', 'g....g']],
    pals: [{ g: '#4ea83a', k: '#1a1a1a', l: '#a8d880' }],
    speed: 0.012, run: 0.04, vision: 4, food: F_BUGS, biomes: [B_SWAMP, B_JUNGLE], voice: 'croak', init: 3, group: 2, cap: 44, adult: 1600, litter: 2 }),
  // ---- predators ----
  wolf: LAND({ name: 'Вовк', legs: 2, diurnal: false, nocturnal: true, pack: true, frames: [
    ['.........g.g', '........gggg', 'gg......gkgg', '.gddddddgggk', '..gggggggll.', '..gllllllg..', '..g.g..g.g..', '..k.k..k.k..'],
    ['.........g.g', '........gggg', 'gg......gkgg', '.gddddddgggk', '..gggggggll.', '..gllllllg..', '.g...gg...g.', '.k...kk...k.']],
    pals: [{ g: '#8a8c94', d: '#5a5c64', l: '#c8c8cc', k: '#1e1e22' }],
    speed: 0.014, run: 0.066, stam: 220, vision: 10, pounce: 4, hr: 0.00011, eats: ['sheep', 'chicken', 'rabbit', 'deer', 'cow'], biomes: [B_TEMP, B_TUNDRA], voice: 'howl', init: 1, group: 3, cap: 12 }),
  fox: LAND({ name: 'Лисиця', legs: 1, diurnal: false, nocturnal: true, frames: [
    ['........o.o', '........ooo', 'wo......okw', '.oooooooowk', '..owwwwoo..', '..k.k..k.k.'],
    ['........o.o', '........ooo', 'wo......okw', '.oooooooowk', '..owwwwoo..', '.k..kk..k..']],
    pals: [{ o: '#e0782a', w: '#f6f0e6', k: '#241c18' }],
    speed: 0.015, run: 0.064, stam: 200, vision: 8, pounce: 3.5, hr: 0.00011, eats: ['chicken', 'rabbit', 'frog'], biomes: [B_TEMP], voice: 'yip', init: 1, group: 2, cap: 10 }),
  bear: LAND({ name: 'Ведмідь', legs: 2, swim: true, frames: [BEAR_A, BEAR_B],
    pals: [{ b: '#6e4a2e', s: '#a07850', k: '#1e1612' }],
    speed: 0.011, run: 0.058, stam: 200, vision: 7, pounce: 3.5, hr: 0.0001, food: F_FISH, eats: ['deer', 'sheep', 'rabbit'], biomes: [B_TEMP], voice: 'growl', init: 1, group: 2, cap: 6 }),
  polar: LAND({ name: 'Білий ведмідь', legs: 2, swim: true, frames: [BEAR_A, BEAR_B],
    pals: [{ b: '#f0ece0', s: '#d8d2c4', k: '#2a2a2a' }],
    speed: 0.011, run: 0.058, stam: 200, vision: 8, pounce: 3.5, hr: 0.0001, food: F_FISH, eats: ['penguin', 'rabbit', 'sheep'], biomes: [B_TUNDRA], voice: 'growl', init: 1, group: 2, cap: 6 }),
  lion: LAND({ name: 'Лев', legs: 1, diurnal: false, pack: true, frames: [
    ['.........mmm.', 'm.......mmmmm', 't.......mmyky', 'tyyyyyyymmyyk', '.yyyyyyyymmm.', '.yyyyyyyyy...', '.y.y...y.y...'],
    ['.........mmm.', 'm.......mmmmm', 't.......mmyky', 'tyyyyyyymmyyk', '.yyyyyyyymmm.', '.yyyyyyyyy...', 'y...y.y...y..']],
    pals: [{ y: '#d8a850', m: '#8a4e1e', k: '#2a1a10', t: '#c8983e' }],
    speed: 0.012, run: 0.072, stam: 220, vision: 11, pounce: 4, hr: 0.00011, eats: ['zebra', 'camel', 'deer', 'cow', 'elephant'], biomes: [B_SAVANNA], voice: 'roar', init: 1, group: 3, cap: 10 }),
  tiger: LAND({ name: 'Тигр', legs: 1, frames: [
    ['..........o.o', 't.........ooo', 't.oqoqoqoooko', '.ooqoqoqoooow', '.oqoqoqoqoww.', '..wwwwwwww...', '..o.o...o.o..'],
    ['..........o.o', 't.........ooo', 't.oqoqoqoooko', '.ooqoqoqoooow', '.oqoqoqoqoww.', '..wwwwwwww...', '.o...oo...o..']],
    pals: [{ o: '#e8802a', q: '#1e1612', w: '#f6efe4', k: '#1e1612', t: '#e8802a' }],
    speed: 0.013, run: 0.074, stam: 220, vision: 10, pounce: 4, hr: 0.00011, eats: ['deer', 'cow', 'sheep', 'zebra', 'elephant'], biomes: [B_JUNGLE], voice: 'roar', init: 1, group: 2, cap: 6 }),
  croc: LAND({ name: 'Крокодил', legs: 1, amphib: true, lurker: true, thirsty: false, diurnal: false, frames: [
    ['....d.d.d.......', '..ggggggggggkg..', 'gggggggggggggggg', '..llllllllllwlwl', '...g..g...g..g..'],
    ['....d.d.d.......', '..ggggggggggkg..', 'gggggggggggggggg', '..llllllllllwlwl', '..g..g.....g.g..']],
    pals: [{ g: '#4a6e34', d: '#2e4a22', k: '#e8d040', l: '#8aa060', w: '#f4f4ea' }],
    speed: 0.007, run: 0.095, stam: 55, vision: 3, pounce: 3, hr: 0.0001, eats: ['frog', 'deer', 'zebra', 'cow', 'sheep', 'rabbit', 'chicken', 'camel'], biomes: [B_SWAMP, B_JUNGLE], voice: 'growl', init: 1, group: 2, cap: 8 })
} as unknown as Record<string, Species>;

// ---- sea ----
Object.assign(SPECIES, {
  fish: { kind: 'sea', name: 'Риби', school: true, frames: [['...oo..', 'o.oooko', '.oollll', 'o..ll..'], ['...oo..', '.ooooko', 'ooollll', '...ll..']],
    pals: [{ o: '#ff9030', l: '#ffd08a', k: '#1a1a1a' }, { o: '#ffd23a', l: '#fff0a0', k: '#1a1a1a' }, { o: '#4aa0e0', l: '#bfe4ff', k: '#1a1a1a' }, { o: '#ff6a8a', l: '#ffc0d0', k: '#1a1a1a' }],
    speed: 0.02, run: 0.05, stam: 200, vision: 4, hr: 0, init: 6, group: 5, cap: 80, breed: 0.6 },
  whale: { kind: 'sea', name: 'Кит', deep: true, frames: [
    ['..........bbbbbb....', 'b.......bbbbbbbbbbb.', 'bb....bbbbbbbbbbkbbb', '.bbbbbbbbbbbbbbbbbbb', 'bb..bbllllllllllllb.', 'b.....llllllllllll..', '.........f....f.....'],
    ['..........bbbbbb....', '........bbbbbbbbbbb.', 'b.....bbbbbbbbbbkbbb', 'bbbbbbbbbbbbbbbbbbbb', 'bb..bbllllllllllllb.', '......llllllllllll..', '.........f....f.....']],
    pals: [{ b: '#34506e', l: '#c8d6e2', k: '#101820', f: '#243a52' }],
    speed: 0.01, run: 0.02, stam: 100, vision: 4, hr: 0, voice: 'whale', init: 2, cap: 6, breed: 0.1 },
  shark: { kind: 'sea', name: 'Акула', frames: [
    ['........g.....', 'g......ggg....', 'gg.ggggggggkgg', '.ggggwwwwwwwwg', 'g.....w..w....'],
    ['........g.....', '.......ggg....', 'g..ggggggggkgg', 'gggggwwwwwwwwg', 'gg....w..w....']],
    pals: [{ g: '#7c8a98', w: '#eef2f4', k: '#101010' }],
    speed: 0.02, run: 0.07, stam: 220, vision: 9, hr: 0.00011, eats: ['fish'], init: 2, cap: 8, breed: 0.12 },
  dolphin: { kind: 'sea', name: 'Дельфін', frames: [
    ['......d.....', 'd..ddddddd..', 'dd.dddddddkd', '.dddlllllldd', 'd...l....l..'],
    ['......d.....', '...ddddddd..', 'd..dddddddkd', 'ddddlllllldd', 'dd..l....l..']],
    pals: [{ d: '#6a92bc', l: '#dfeaf4', k: '#101820' }],
    speed: 0.024, run: 0.07, stam: 220, vision: 8, hr: 0.0001, eats: ['fish'], voice: 'dolphin', init: 1, group: 3, cap: 16, breed: 0.2 },
  crab: { kind: 'beach', name: 'Краб', frames: [['rr....rr', 'r.k..k.r', '.rrrrrr.', 'rrrrrrrr', 'r.r..r.r'], ['.r....r.', 'r.k..k.r', '.rrrrrr.', 'rrrrrrrr', '.r.rr.r.']],
    pals: [{ r: '#e04a2a', k: '#1a1a1a' }], speed: 0.01, run: 0.03, stam: 100, vision: 3, hr: 0, init: 4, group: 2, cap: 36, breed: 0.4 }
});

// ---- sky ----
Object.assign(SPECIES, {
  bird: { kind: 'sky', name: 'Птахи', frames: [['k.....k', '.k...k.', '..kkk..'], ['.......', 'kkkkkkk', '..kkk..']], pals: [{ k: '#2a2a34' }], alt: 20, speed: 0.045, voice: 'tweet' },
  gull: { kind: 'sky', name: 'Чайки', frames: [['k.......k', '.ww...ww.', '...wkw...'], ['.........', 'kwwwwwwwk', '....w....']], pals: [{ w: '#f6f6f6', k: '#50555c' }], alt: 18, speed: 0.04, voice: 'gull' },
  eagle: { kind: 'sky', name: 'Орел', frames: [['k.........k', '.kk.....kk.', '..kkkwkkk..', '....kkk....', '....k.k....'], ['...........', 'kkkkkwkkkkk', '....kkk....', '....k.k....', '...........']],
    pals: [{ k: '#5a3a20', w: '#f4f4f0' }], alt: 32, speed: 0.03, voice: 'screech', eats: ['rabbit', 'chicken', 'frog', 'fish'] },
  bat: { kind: 'sky', name: 'Кажани', frames: [['k.....k', 'kk.k.kk', '.kkkkk.'], ['.......', '..kkk..', 'kkk.kkk']], pals: [{ k: '#2a2232' }], alt: 12, speed: 0.035, voice: 'squeak', night: true },
  butterfly: { kind: 'sky', name: 'Метелик', frames: [['yy.yy', 'yykyy', '.y.y.'], ['..k..', '.yky.', '..k..']],
    pals: [{ y: '#ffd23c', k: '#3a2a20' }, { y: '#ff7ab8', k: '#3a2a20' }, { y: '#6ab8ff', k: '#3a2a20' }, { y: '#f4f4f4', k: '#3a2a20' }], alt: 6, speed: 0.012, day: true },
  firefly: { kind: 'sky', name: 'Світлячок', frames: [['y'], ['y']], pals: [{ y: '#eaff80' }], alt: 4, speed: 0.01, night: true }
});

for (const k in SPECIES) {
  const S = SPECIES[k] as Species;
  S.key = k;
  S.h = S.frames[0].length;
  S.w = Math.max(...S.frames[0].map(r => r.length));
  S.imgs = S.pals.map(pal => S.frames.map(fr => [spriteCanvas(fr, pal, S.w, false), spriteCanvas(fr, pal, S.w, true)]));
  if (S.legs) {
    const lie = (Array(S.legs).fill('.'.repeat(S.w)) as string[]).concat(S.frames[0].slice(0, S.h - S.legs));
    S.lie = S.pals.map(pal => [spriteCanvas(lie, pal, S.w, false), spriteCanvas(lie, pal, S.w, true)]);
  }
  if (!S.stam) S.stam = 150;
  if (!S.run) S.run = S.speed * 2;
}
for (const k in SPECIES) {
  const S = SPECIES[k];
  if (S.eats) for (const e of S.eats) {
    const P = SPECIES[e];
    (P.preyOf = P.preyOf || new Set()).add(k);
  }
}

export function getSpeciesIcon(key: string): HTMLCanvasElement {
  const S = SPECIES[key], n = Math.max(S.w, S.h, 5);
  const c = document.createElement('canvas'); c.width = n; c.height = n;
  c.getContext('2d')!.drawImage(S.imgs[0][0][0], Math.floor((n - S.w) / 2), Math.floor((n - S.h) / 2));
  return c;
}
