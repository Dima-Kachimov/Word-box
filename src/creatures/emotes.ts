// Іконки-емоції над твариною (тривога, злість, сон, спрага, їжа тощо).

import { spriteCanvas } from './spriteCanvas';

const DEFS: Record<string, [string[], Record<string, string>]> = {
  alarm: [['.yy.', '.yy.', '.yy.', '....', '.yy.'], { y: '#ffd23c' }],
  angry: [['.rr.', '.rr.', '.rr.', '....', '.rr.'], { r: '#ff4a30' }],
  zzz: [['wwww', '..w.', '.w..', 'wwww', '....'], { w: '#e8f0ff' }],
  drop: [['..b..', '.bbb.', 'bbbbb', 'bbbbb', '.bbb.'], { b: '#5ab8ff' }],
  leaf: [['...gg', '..ggg', '.ggg.', 'gg...', 'g....'], { g: '#7ad05a' }],
  meat: [['.rr..', 'rrrr.', '.rrr.', '...w.', '....w'], { r: '#c0503a', w: '#f4efe0' }],
  heart: [['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], { r: '#ff5a7a' }]
};

export const EMO: Record<string, HTMLCanvasElement> = {};
for (const [k, d] of Object.entries(DEFS)) EMO[k] = spriteCanvas(d[0], d[1], d[0][0].length, false);

export type EmoteKey = keyof typeof DEFS;
