// Мультяшні малюнки тварин. Кожен вид — функція, що малює тварину в
// одиницях своєї "коробки" w×h (1 одиниця = 1 піксель світу), обличчям
// вправо, лапами на нижньому краї. Поза: 0/1 — два кадри ходьби, 2 — лежить.
// Малюнки растеризуються один раз при старті (creatures/species.ts).

import { Painter, volume, eye, blob, tint, shade, INK, TAU } from '../render/cartoon';

export type Pose = 0 | 1 | 2;
export type Pal = Record<string, string>;

export interface Art {
  w: number;
  h: number;
  pals: Pal[];
  /** Чи є окремий малюнок "лежить" (для сну/відпочинку/засідки). */
  lie?: boolean;
  /** На скільки одиниць опускається тіло, коли тварина лягає. */
  drop?: number;
  draw(g: CanvasRenderingContext2D, pose: Pose, pal: Pal): void;
}

const LW = 0.4;

// ---------------------------------------------------------------- хелпери
/** Кінцівки: пари [дальня, ближня, дальня, ближня…]; діагональні пари рухаються разом. */
function legs(p: Painter, xs: number[], top: number, len: number, w: number, color: string, pose: Pose, hoof?: string): void {
  const sw = len * 0.3;
  const add = (k: number) => {
    const far = k % 2 === 0;
    const phase = ((k >> 1) + (k & 1)) % 2 === 0 ? 1 : -1;
    const off = (pose === 1 ? -phase : phase) * sw;
    const x = xs[k], c = far ? shade(color, 0.8) : color;
    p.line([x, top, x + off, top + len], w, c);
    if (hoof) {
      const hc = far ? shade(hoof, 0.85) : hoof;
      p.line([x + off * 0.88, top + len - w * 0.45, x + off, top + len], w * 1.02, hc, { outline: false });
    }
  };
  for (let k = 0; k < xs.length; k += 2) add(k);
  for (let k = 1; k < xs.length; k += 2) add(k);
}

/** Лежача тварина: замість ніг — підібгані лапки під тілом. */
function tucked(p: Painter, xs: number[], y: number, w: number, color: string): void {
  for (let k = 1; k < xs.length; k += 2) p.ell(xs[k] + 0.3, y, w * 0.9, w * 0.55, color);
}

function clip(g: CanvasRenderingContext2D, path: (g: CanvasRenderingContext2D) => void, fn: () => void): void {
  g.save(); g.beginPath(); path(g); g.clip(); fn(); g.restore();
}
const ellPath = (x: number, y: number, rx: number, ry: number, rot = 0) =>
  (g: CanvasRenderingContext2D) => g.ellipse(x, y, rx - 0.15, ry - 0.15, rot, 0, TAU);

function nose(g: CanvasRenderingContext2D, x: number, y: number, r = 0.32): void {
  blob(g, x, y, r, r * 0.8, INK);
}
function smile(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.strokeStyle = INK; g.lineWidth = 0.22; g.lineCap = 'round';
  g.beginPath(); g.arc(x, y - r, r, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke();
}
function eyeFor(g: CanvasRenderingContext2D, x: number, y: number, r: number, pose: Pose): void {
  eye(g, x, y, r, pose === 2);
}
function stripes(g: CanvasRenderingContext2D, xs: number[], y0: number, y1: number, color: string, w: number, bend = 0.5): void {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  for (const x of xs) { g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + bend, (y0 + y1) / 2, x - bend * 0.3, y1); g.stroke(); }
}

/** Загальний каркас земної тварини: хвіст, ноги, тіло, голова, деталі. */
interface QuadSpec {
  w: number; h: number; pals: Pal[];
  legs: { xs: number[]; top: number; len: number; w: number; key: string; hoof?: string };
  back?: (p: Painter, c: Pal, pose: Pose) => void;
  body: (p: Painter, c: Pal, pose: Pose) => void;
  head: (p: Painter, c: Pal, pose: Pose) => void;
  details?: (g: CanvasRenderingContext2D, c: Pal, pose: Pose) => void;
}
function quad(s: QuadSpec): Art {
  const drop = s.legs.len * 0.8;
  return {
    w: s.w, h: s.h, pals: s.pals, lie: true, drop,
    draw(g, pose, c) {
      if (pose === 2) g.translate(0, drop);
      const p = new Painter(LW);
      s.back?.(p, c, pose);
      if (pose === 2) tucked(p, s.legs.xs, s.legs.top + 0.2 - drop * 0.1, s.legs.w, c[s.legs.key]);
      else legs(p, s.legs.xs, s.legs.top, s.legs.len, s.legs.w, c[s.legs.key], pose, s.legs.hoof ? c[s.legs.hoof] : undefined);
      s.body(p, c, pose);
      s.head(p, c, pose);
      p.render(g);
      s.details?.(g, c, pose);
    }
  };
}

// ---------------------------------------------------------------- травоїдні
const cow = quad({
  w: 16, h: 12,
  pals: [{ b: '#f7f5ef', s: '#2e2a28', m: '#f2a9a4', h: '#efe2c2', f: '#3a302c' }],
  legs: { xs: [3.8, 4.8, 9.8, 10.8], top: 7.6, len: 3.8, w: 1.3, key: 'b', hoof: 'f' },
  back(p, c) { p.line([2.2, 5.0, 1.0, 8.2], 0.5, c.b); p.circ(1.0, 8.6, 0.6, c.f); },
  body(p, c) { p.ell(7.6, 6.1, 5.6, 3.2, volume(c.b, 7.6, 6.1, 5.6, 0.2, 0.82)); },
  head(p, c) {
    p.line([12.5, 2.5, 12.1, 1.2], 0.55, c.h).line([13.9, 2.4, 14.4, 1.1], 0.55, c.h);
    p.ell(11.3, 3.2, 1.1, 0.55, c.b, { rot: -0.5 });
    p.ell(13.2, 4.3, 2.3, 2.1, volume(c.b, 13.2, 4.3, 2.3, 0.2, 0.82), { sep: true });
    p.ell(14.8, 5.5, 1.4, 1.05, c.m, { sep: true });
  },
  details(g, c, pose) {
    clip(g, ellPath(7.6, 6.1, 5.6, 3.2), () => {
      blob(g, 5.0, 5.2, 1.7, 1.2, c.s, 0.3); blob(g, 9.4, 6.9, 1.4, 1.0, c.s, -0.2); blob(g, 7.6, 3.6, 1.0, 0.7, c.s);
    });
    blob(g, 12.4, 3.6, 0.8, 0.55, c.s, 0.4);
    nose(g, 14.5, 5.5, 0.22); nose(g, 15.3, 5.4, 0.22);
    eyeFor(g, 13.5, 3.8, 0.62, pose);
  }
});

const sheep = quad({
  w: 13, h: 11,
  pals: [{ w: '#f4f1e6', k: '#4a4442', l: '#3a3432' }],
  legs: { xs: [3.8, 4.8, 7.8, 8.8], top: 7.4, len: 3.0, w: 1.0, key: 'l' },
  body(p, c) {
    const f = volume(c.w, 6.2, 5.4, 5.2, 0.25, 0.85);
    for (const [x, y, r] of [[2.4, 5.3, 1.6], [3.7, 3.4, 1.6], [6.1, 2.7, 1.7], [8.5, 3.3, 1.6], [9.6, 5.3, 1.5], [8.6, 7.3, 1.5], [6.0, 7.8, 1.6], [3.4, 7.3, 1.5]] as const) p.circ(x, y, r, f);
    p.ell(6.1, 5.4, 4.3, 2.9, f);
  },
  head(p, c) {
    p.ell(10.2, 4.7, 1.1, 0.5, c.k, { rot: 0.5 });
    p.ell(11.3, 5.1, 1.6, 1.9, volume(c.k, 11.3, 5.1, 1.9, 0.3, 0.8), { sep: true });
    p.circ(11.0, 3.4, 1.0, c.w, { sep: true });
  },
  details(g, c, pose) { eyeFor(g, 11.8, 4.9, 0.5, pose); nose(g, 12.6, 6.2, 0.2); }
});

const chicken: Art = {
  w: 8, h: 9, lie: true, drop: 1.4,
  pals: [{ w: '#fbfaf4', r: '#e0342a', y: '#f2a61e', g: '#e2dccb' }],
  draw(g, pose, c) {
    if (pose === 2) g.translate(0, 1.4);
    const p = new Painter(0.36);
    p.poly([1.6, 5.0, 0.3, 2.3, 1.5, 3.3, 1.5, 1.6, 2.6, 3.7], c.w);
    if (pose !== 2) legs(p, [3.4, 4.4], 7.2, 1.7, 0.45, c.y, pose);
    p.ell(3.8, 5.5, 2.9, 2.3, volume(c.w, 3.8, 5.5, 2.9, 0.2, 0.85));
    p.circ(5.2, 1.6, 0.52, c.r).circ(5.8, 1.35, 0.58, c.r).circ(6.35, 1.75, 0.48, c.r);
    p.circ(5.6, 3.0, 1.45, volume(c.w, 5.6, 3.0, 1.45, 0.2, 0.85), { sep: true });
    p.poly([6.8, 2.75, 7.9, 3.25, 6.8, 3.7], c.y, { sep: true });
    p.ell(6.6, 4.15, 0.35, 0.55, c.r, { sep: true });
    p.ell(3.4, 5.4, 1.6, 1.05, c.g, { sep: true, rot: 0.25 });
    p.render(g);
    eyeFor(g, 5.95, 2.8, 0.45, pose);
  }
};

const rabbit: Art = {
  w: 9, h: 9, lie: true, drop: 0.9,
  pals: [{ b: '#bca88e', w: '#fbfaf6', p: '#f0a6aa' }],
  draw(g, pose, c) {
    if (pose === 2) g.translate(0, 0.9);
    const p = new Painter(0.36);
    const tilt = pose === 1 ? 0.25 : 0;
    p.ell(5.9, 1.9, 0.55, 1.7, c.b, { rot: -0.25 - tilt }).ell(6.9, 1.7, 0.55, 1.7, c.b, { rot: 0.12 - tilt });
    p.circ(1.1, 5.6, 0.85, c.w);
    if (pose !== 2) {
      const f = pose === 1 ? 0.8 : 0;
      p.ell(2.8 - f, 8.2, 1.2, 0.45, c.b).ell(6.0 + f * 0.5, 8.3, 0.7, 0.4, c.b);
    }
    p.ell(4.2, 6.0, 3.0, 2.1, volume(c.b, 4.2, 6.0, 3.0, 0.25, 0.8));
    p.ell(2.9, 6.6, 1.5, 1.25, volume(c.b, 2.9, 6.6, 1.5, 0.25, 0.8), { sep: true });
    p.circ(6.8, 4.4, 1.6, volume(c.b, 6.8, 4.4, 1.6, 0.25, 0.8), { sep: true });
    p.render(g);
    blob(g, 5.9, 1.9, 0.25, 1.1, c.p, -0.25 - tilt);
    blob(g, 6.9, 1.7, 0.25, 1.1, c.p, 0.12 - tilt);
    blob(g, 8.3, 4.8, 0.3, 0.25, c.p);
    eyeFor(g, 7.3, 4.1, 0.5, pose);
  }
};

const deer = quad({
  w: 14, h: 14,
  pals: [{ b: '#a8683a', l: '#e6c49a', a: '#ecdcb4', k: '#1e1612', w: '#fbf6ec' }],
  legs: { xs: [3.4, 4.2, 8.6, 9.4], top: 9.4, len: 4.0, w: 0.85, key: 'b', hoof: 'k' },
  back(p, c) { p.circ(2.0, 7.2, 0.75, c.w); },
  body(p, c) {
    p.ell(6.5, 8.2, 4.5, 2.4, volume(c.b, 6.5, 8.2, 4.5, 0.25, 0.8));
    p.line([9.6, 7.4, 11.1, 4.7], 1.7, c.b);
  },
  head(p, c) {
    p.line([11.3, 2.9, 10.6, 0.9], 0.38, c.a).line([10.9, 1.8, 10.0, 1.4], 0.32, c.a);
    p.line([12.0, 2.8, 12.8, 0.8], 0.38, c.a).line([12.4, 1.8, 13.3, 1.5], 0.32, c.a);
    p.ell(10.8, 3.0, 0.85, 0.42, c.b, { rot: -0.6 });
    p.ell(11.8, 4.0, 1.75, 1.35, volume(c.b, 11.8, 4.0, 1.75, 0.25, 0.8), { rot: 0.2, sep: true });
    p.ell(13.2, 4.6, 0.9, 0.7, shade(c.b, 0.85), { sep: true });
  },
  details(g, c, pose) {
    clip(g, ellPath(6.5, 8.2, 4.5, 2.4), () => {
      blob(g, 6.5, 10.3, 4.2, 1.1, c.l);
      for (const [x, y] of [[4.6, 7.0], [6.2, 6.6], [7.8, 7.0], [5.4, 7.9], [7.1, 7.8]]) blob(g, x, y, 0.32, 0.32, c.w);
    });
    nose(g, 13.9, 4.55, 0.3);
    eyeFor(g, 12.0, 3.7, 0.5, pose);
  }
});

const zebra = quad({
  w: 15, h: 12,
  pals: [{ w: '#f6f6f2', k: '#1c1c20', m: '#3a3a3e' }],
  legs: { xs: [3.6, 4.4, 9.6, 10.4], top: 7.8, len: 3.6, w: 1.0, key: 'w', hoof: 'k' },
  back(p, c) { p.line([2.1, 5.6, 1.2, 8.6], 0.45, c.w); p.ell(1.1, 8.9, 0.45, 0.75, c.k); },
  body(p, c) {
    p.ell(7.0, 6.6, 5.0, 2.8, volume(c.w, 7, 6.6, 5, 0.15, 0.85));
    p.line([10.8, 5.8, 12.3, 3.6], 2.1, c.w);
    p.line([10.3, 4.8, 12.0, 2.3], 0.8, c.k, { outline: false });
  },
  head(p, c) {
    p.ell(12.2, 2.0, 0.9, 0.42, c.w, { rot: -1.2 });
    p.ell(13.0, 3.6, 1.9, 1.4, volume(c.w, 13, 3.6, 1.9, 0.15, 0.85), { rot: 0.35, sep: true });
    p.ell(14.3, 4.4, 0.95, 0.8, c.m, { sep: true });
  },
  details(g, c, pose) {
    clip(g, ellPath(7.0, 6.6, 5.0, 2.8), () => stripes(g, [3.4, 4.9, 6.4, 7.9, 9.4, 10.8], 3.6, 9.4, c.k, 0.62, 0.6));
    clip(g, ellPath(13.0, 3.6, 1.9, 1.4, 0.35), () => stripes(g, [12.0, 12.8], 2.0, 5.0, c.k, 0.4, 0.3));
    eyeFor(g, 13.2, 3.2, 0.5, pose);
  }
});

const elephant = quad({
  w: 18, h: 15,
  pals: [{ g: '#8c9096', e: '#7c8088', t: '#f4f0e0', p: '#d8a4a8' }],
  legs: { xs: [3.8, 5.2, 10.4, 11.8], top: 9.8, len: 4.2, w: 2.1, key: 'g' },
  back(p, c) { p.line([1.9, 6.8, 1.1, 9.4], 0.45, c.g); },
  body(p, c) {
    p.ell(8.0, 7.8, 6.2, 4.2, volume(c.g, 8, 7.8, 6.2, 0.25, 0.8));
    p.line([16.0, 7.0, 16.8, 9.4, 16.4, 11.6, 17.1, 12.6], 1.35, c.g);
  },
  head(p, c) {
    p.circ(14.0, 6.2, 3.0, volume(c.g, 14, 6.2, 3.0, 0.25, 0.8), { sep: true });
    p.ell(12.4, 6.6, 2.2, 2.9, volume(c.e, 12.4, 6.6, 2.9, 0.2, 0.8), { sep: true });
    p.line([15.3, 8.7, 16.6, 9.9], 0.55, c.t, { sep: true });
  },
  details(g, c, pose) {
    blob(g, 12.4, 6.9, 1.2, 1.8, c.p);
    g.strokeStyle = shade(c.g, 0.75); g.lineWidth = 0.22;
    for (const y of [9.4, 10.4, 11.3]) { g.beginPath(); g.moveTo(16.2, y); g.lineTo(17.0, y - 0.1); g.stroke(); }
    eyeFor(g, 15.3, 5.4, 0.55, pose);
  }
});

const camel = quad({
  w: 15, h: 14,
  pals: [{ c: '#cba06a', l: '#e2c294', k: '#2a1e14' }],
  legs: { xs: [3.4, 4.2, 8.4, 9.2], top: 8.6, len: 4.6, w: 0.85, key: 'c' },
  back(p, c) { p.line([2.1, 6.6, 1.4, 8.8], 0.4, c.c); },
  body(p, c) {
    const f = volume(c.c, 6.4, 6.4, 4.8, 0.25, 0.8);
    p.circ(5.8, 4.9, 2.3, f);
    p.ell(6.4, 7.2, 4.4, 2.4, f);
    p.line([9.6, 6.4, 11.2, 5.6, 12.0, 3.2], 1.45, c.c);
  },
  head(p, c) {
    p.ell(12.1, 1.8, 0.45, 0.32, c.c);
    p.ell(12.9, 2.7, 1.5, 1.0, volume(c.c, 12.9, 2.7, 1.5, 0.25, 0.8), { rot: 0.15, sep: true });
    p.ell(14.0, 3.15, 0.75, 0.62, c.l, { sep: true });
  },
  details(g, c, pose) { nose(g, 14.5, 3.0, 0.18); eyeFor(g, 13.0, 2.4, 0.42, pose); }
});

const penguin: Art = {
  w: 8, h: 10, lie: true, drop: 0.5,
  pals: [{ k: '#1c1c28', w: '#f6f6f6', y: '#ff9e24' }],
  draw(g, pose, c) {
    if (pose === 2) g.translate(0, 0.5);
    const p = new Painter(0.36);
    const f = pose === 1 ? 0.35 : -0.35;
    p.ell(3.4 + f, 9.55, 0.95, 0.42, c.y).ell(4.9 - f, 9.55, 0.95, 0.42, c.y);
    p.ell(4.0, 5.6, 2.9, 4.1, volume(c.k, 4.0, 5.6, 4.1, 0.3, 0.7));
    p.ell(2.6, 6.2, 0.7, 1.9, c.k, { rot: pose === 1 ? 0.55 : 0.3, sep: true });
    p.poly([6.3, 3.2, 7.7, 3.6, 6.3, 4.1], c.y, { sep: true });
    p.render(g);
    clip(g, ellPath(4.0, 5.6, 2.9, 4.1), () => blob(g, 4.8, 6.4, 2.0, 3.3, c.w));
    blob(g, 5.5, 3.3, 1.0, 0.8, c.w);
    eyeFor(g, 5.5, 3.0, 0.48, pose);
  }
};

const frog: Art = {
  w: 9, h: 7, lie: true, drop: 0.4,
  pals: [{ g: '#4ea83a', l: '#b8e08a', k: '#1a1a1a' }],
  draw(g, pose, c) {
    if (pose === 2) g.translate(0, 0.4);
    const p = new Painter(0.34);
    const ext = pose === 1;
    if (ext) p.line([2.2, 5.4, 0.6, 6.4, 0.2, 6.8], 0.7, c.g);
    p.ell(ext ? 1.9 : 2.1, ext ? 5.0 : 5.4, 1.5, 1.0, volume(c.g, 2, 5.2, 1.5, 0.3, 0.8));
    p.ell(ext ? 0.8 : 1.6, 6.6, 1.2, 0.4, c.g);
    p.line([6.0, 5.2, 6.5, 6.5], 0.6, c.g).ell(6.8, 6.7, 0.7, 0.3, c.g);
    p.ell(4.3, 4.6, 3.4, 2.0, volume(c.g, 4.3, 4.6, 3.4, 0.3, 0.8));
    p.circ(5.5, 2.7, 1.05, c.g).circ(7.0, 2.9, 0.95, c.g);
    p.render(g);
    clip(g, ellPath(4.3, 4.6, 3.4, 2.0), () => blob(g, 4.8, 6.0, 2.8, 1.1, c.l));
    for (const [x, y] of [[3.0, 3.6], [4.2, 3.2]]) blob(g, x, y, 0.35, 0.28, shade(c.g, 0.75));
    eye(g, 5.6, 2.6, 0.62, pose === 2); eye(g, 7.05, 2.8, 0.55, pose === 2);
    smile(g, 6.9, 4.9, 0.9);
  }
};

// ---------------------------------------------------------------- хижаки
function canine(body: string, belly: string, dark: string, big: boolean): Omit<QuadSpec, 'w' | 'h' | 'pals'> {
  const s = big ? 1 : 0.86;
  return {
    legs: { xs: [3.2 * s, 4.0 * s, 8.2 * s, 9.0 * s], top: 7.2 * s, len: 3.1 * s, w: 0.8 * s, key: 'b', hoof: big ? undefined : 'k' },
    back(p, c) {
      p.ell(1.5 * s, 5.4 * s, 2.2 * s, 0.85 * s, volume(c.b, 1.5 * s, 5.4 * s, 2.2 * s, 0.25, 0.8), { rot: big ? 0.55 : 0.35 });
    },
    body(p, c) { p.ell(6.3 * s, 6.0 * s, 4.4 * s, 2.3 * s, volume(c.b, 6.3 * s, 6.0 * s, 4.4 * s, 0.25, 0.8)); },
    head(p, c) {
      p.poly([10.0 * s, 3.5 * s, 10.3 * s, 1.1 * s, 11.3 * s, 3.0 * s], c.b).poly([11.0 * s, 3.2 * s, 11.9 * s, 1.1 * s, 12.1 * s, 3.3 * s], c.b);
      p.ell(11.0 * s, 4.4 * s, 1.8 * s, 1.6 * s, volume(c.b, 11 * s, 4.4 * s, 1.8 * s, 0.25, 0.8), { sep: true });
      p.poly([12.1 * s, 3.9 * s, 14.2 * s, 5.0 * s, 12.1 * s, 5.9 * s], c.b, { sep: true });
    },
    details(g, c, pose) {
      clip(g, ellPath(6.3 * s, 6.0 * s, 4.4 * s, 2.3 * s), () => blob(g, 6.6 * s, 7.8 * s, 3.8 * s, 1.1 * s, c.l));
      blob(g, 12.5 * s, 5.2 * s, 0.9 * s, 0.45 * s, c.l, 0.3);
      blob(g, -0.4 * s + 0.2, 4.6 * s, 0.7 * s, 0.5 * s, big ? c.l : c.l, 0.35);
      nose(g, 14.0 * s, 5.0 * s, 0.34 * s);
      eyeFor(g, 11.6 * s, 3.9 * s, 0.45, pose);
      void body; void belly; void dark;
    }
  };
}
const wolf = quad({ w: 14, h: 11, pals: [{ b: '#8a8c94', l: '#d4d4d8', k: '#1e1e22' }], ...canine('#8a8c94', '#d4d4d8', '#1e1e22', true) });
const fox = quad({ w: 12, h: 9, pals: [{ b: '#e0782a', l: '#f8f2e8', k: '#3a2418' }], ...canine('#e0782a', '#f8f2e8', '#3a2418', false) });

function bearSpec(): Omit<QuadSpec, 'pals'> {
  return {
    w: 14, h: 11,
    legs: { xs: [3.2, 4.2, 8.4, 9.4], top: 7.2, len: 2.9, w: 1.55, key: 'b' },
    body(p, c) {
      const f = volume(c.b, 6.6, 5.4, 5.2, 0.25, 0.78);
      p.circ(8.4, 4.2, 2.1, f);
      p.ell(6.4, 5.8, 4.9, 3.1, f);
    },
    head(p, c) {
      p.circ(10.5, 3.2, 0.62, c.b).circ(11.9, 3.1, 0.62, c.b);
      p.circ(11.4, 5.0, 1.95, volume(c.b, 11.4, 5, 1.95, 0.25, 0.78), { sep: true });
      p.ell(12.9, 5.75, 1.05, 0.82, c.s, { sep: true });
    },
    details(g, c, pose) {
      blob(g, 10.5, 3.2, 0.3, 0.3, c.s); blob(g, 11.9, 3.1, 0.3, 0.3, c.s);
      nose(g, 13.6, 5.5, 0.34);
      eyeFor(g, 11.9, 4.6, 0.45, pose);
    }
  };
}
const bear = quad({ ...bearSpec(), pals: [{ b: '#6e4a2e', s: '#b08a60' }] });
const polar = quad({ ...bearSpec(), pals: [{ b: '#f0ece0', s: '#d8d2c4' }] });

const lion = quad({
  w: 14, h: 11,
  pals: [{ b: '#d8a850', m: '#9a5a22', l: '#f0d8a0' }],
  legs: { xs: [3.2, 4.0, 8.2, 9.0], top: 7.6, len: 2.9, w: 0.95, key: 'b' },
  back(p, c) { p.line([1.9, 5.6, 0.8, 7.4, 1.0, 8.4], 0.42, c.b); p.circ(1.0, 8.8, 0.62, c.m); },
  body(p, c) { p.ell(6.2, 6.4, 4.4, 2.2, volume(c.b, 6.2, 6.4, 4.4, 0.25, 0.8)); },
  head(p, c) {
    const f = volume(c.m, 10.6, 4.8, 3.0, 0.25, 0.75);
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU;
      p.circ(10.6 + Math.cos(a) * 2.2, 4.8 + Math.sin(a) * 2.2, 1.1, f);
    }
    p.circ(10.6, 4.8, 2.4, f);
    p.circ(11.0, 4.9, 1.8, volume(c.b, 11, 4.9, 1.8, 0.25, 0.8), { sep: true });
    p.ell(12.4, 5.6, 0.95, 0.75, c.l, { sep: true });
  },
  details(g, c, pose) { nose(g, 13.1, 5.35, 0.3); eyeFor(g, 11.5, 4.5, 0.45, pose); }
});

const tiger = quad({
  w: 15, h: 10,
  pals: [{ b: '#e8802a', w: '#f6efe4', k: '#1e1612' }],
  legs: { xs: [3.4, 4.2, 9.2, 10.0], top: 6.9, len: 2.7, w: 0.95, key: 'b' },
  back(p, c) { p.line([1.9, 5.2, 0.7, 3.6, 0.5, 2.3], 0.5, c.b); },
  body(p, c) { p.ell(6.8, 5.8, 5.0, 2.2, volume(c.b, 6.8, 5.8, 5.0, 0.25, 0.8)); },
  head(p, c) {
    p.circ(11.4, 3.0, 0.58, c.b).circ(12.8, 2.9, 0.58, c.b);
    p.circ(12.2, 4.6, 1.85, volume(c.b, 12.2, 4.6, 1.85, 0.25, 0.8), { sep: true });
    p.ell(13.5, 5.3, 0.95, 0.72, c.w, { sep: true });
  },
  details(g, c, pose) {
    clip(g, ellPath(6.8, 5.8, 5.0, 2.2), () => {
      blob(g, 7.0, 7.5, 4.4, 1.0, c.w);
      stripes(g, [3.2, 4.6, 6.0, 7.4, 8.8, 10.2], 3.5, 6.4, c.k, 0.5, 0.4);
    });
    clip(g, g2 => g2.arc(12.2, 4.6, 1.7, 0, TAU), () => stripes(g, [11.4, 12.2], 2.8, 3.9, c.k, 0.32, 0.2));
    g.strokeStyle = c.k; g.lineWidth = 0.3;
    for (const t of [0.35, 0.6]) { g.beginPath(); g.moveTo(1.9 - t * 1.2 - 0.3, 5.2 - t * 1.6); g.lineTo(1.9 - t * 1.2 + 0.4, 5.2 - t * 1.6 + 0.1); g.stroke(); }
    nose(g, 14.2, 5.05, 0.3);
    eyeFor(g, 12.7, 4.2, 0.45, pose);
  }
});

const croc: Art = {
  w: 20, h: 7, lie: true, drop: 0.9,
  pals: [{ g: '#4a7a34', d: '#2e4a22', l: '#a8c080', t: '#fbfbf0', y: '#e8d040' }],
  draw(g, pose, c) {
    if (pose === 2) g.translate(0, 0.9);
    const p = new Painter(0.36);
    if (pose !== 2) {
      const f = pose === 1 ? 0.5 : -0.5;
      for (const [x, far] of [[5.6, true], [11.2, true], [6.4, false], [12.0, false]] as const) {
        const col = far ? shade(c.g, 0.8) : c.g;
        p.line([x, 4.6, x + (far ? f : -f), 6.2], 0.8, col).ell(x + (far ? f : -f) + 0.4, 6.3, 0.7, 0.3, col);
      }
    }
    const f = volume(c.g, 9, 3.8, 7, 0.25, 0.8);
    p.shape(g2 => { g2.moveTo(4.0, 2.8); g2.quadraticCurveTo(1.5, 3.2, 0.1, 4.4); g2.quadraticCurveTo(2.0, 5.0, 4.2, 5.0); g2.closePath(); }, f);
    p.ell(9.2, 3.9, 5.8, 1.7, f);
    p.ell(14.6, 3.4, 1.7, 1.3, f);
    p.shape(g2 => { g2.moveTo(14.4, 2.8); g2.lineTo(19.4, 3.7); g2.quadraticCurveTo(19.8, 4.2, 19.2, 4.6); g2.lineTo(14.6, 4.9); g2.closePath(); }, f);
    p.render(g);
    g.fillStyle = c.d;
    for (let x = 5.0; x < 13.5; x += 1.3) { g.beginPath(); g.moveTo(x, 2.4); g.lineTo(x + 0.45, 1.6); g.lineTo(x + 0.9, 2.4); g.fill(); }
    clip(g, ellPath(9.2, 3.9, 5.8, 1.7), () => blob(g, 9.4, 5.2, 5.4, 0.8, c.l));
    g.fillStyle = c.t;
    for (let x = 15.6; x < 19; x += 0.9) { g.beginPath(); g.moveTo(x, 4.6); g.lineTo(x + 0.25, 5.2); g.lineTo(x + 0.5, 4.55); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(15.0, 4.3); g.lineTo(19.1, 4.3); g.stroke();
    eye(g, 14.8, 2.4, 0.55, pose === 2);
    nose(g, 19.0, 3.7, 0.2);
  }
};

// ---------------------------------------------------------------- море
const fish: Art = {
  w: 8, h: 5,
  pals: [
    { o: '#ff9030', l: '#ffd08a' }, { o: '#ffd23a', l: '#fff0a0' },
    { o: '#4aa0e0', l: '#bfe4ff' }, { o: '#ff6a8a', l: '#ffc0d0' }
  ],
  draw(g, pose, c) {
    const p = new Painter(0.32);
    const t = pose === 1 ? 0.5 : -0.3;
    p.poly([1.8, 2.5, 0.2, 0.9 + t, 0.7, 2.5, 0.2, 4.1 + t], c.o);
    p.poly([3.4, 1.2, 4.6, 0.3, 5.2, 1.2], c.l);
    p.ell(4.3, 2.5, 2.9, 1.7, volume(c.o, 4.3, 2.5, 2.9, 0.35, 0.8));
    p.render(g);
    clip(g, ellPath(4.3, 2.5, 2.9, 1.7), () => blob(g, 4.6, 3.6, 2.4, 0.8, c.l));
    g.strokeStyle = shade(c.o, 0.7); g.lineWidth = 0.22;
    g.beginPath(); g.arc(5.2, 2.5, 1.1, -1.1, 1.1); g.stroke();
    eye(g, 6.0, 2.1, 0.45);
  }
};

const whale: Art = {
  w: 24, h: 10,
  pals: [{ b: '#3f6286', l: '#c8d6e2', d: '#2a4460' }],
  draw(g, pose, c) {
    const p = new Painter(0.4);
    const up = pose === 1 ? -0.8 : 0.3;
    p.line([3.0, 5.0, 1.4, 3.6 + up], 1.5, c.b);
    p.ell(0.6, 2.8 + up, 1.7, 0.7, c.b, { rot: -0.7 }).ell(2.0, 2.2 + up, 1.7, 0.7, c.b, { rot: 0.6 });
    p.ell(11.5, 5.6, 9.6, 3.8, volume(c.b, 11.5, 5.4, 9.6, 0.3, 0.75));
    p.ell(12.0, 8.6, 2.0, 0.75, c.d, { rot: 0.5, sep: true });
    p.render(g);
    clip(g, ellPath(11.5, 5.6, 9.6, 3.8), () => {
      blob(g, 13, 8.2, 8.5, 1.9, c.l);
      g.strokeStyle = shade(c.l, 0.8); g.lineWidth = 0.25;
      for (const y of [7.4, 8.2, 9.0]) { g.beginPath(); g.moveTo(14, y); g.lineTo(20.5, y - 0.8); g.stroke(); }
    });
    g.strokeStyle = INK; g.lineWidth = 0.3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(16.5, 7.0); g.quadraticCurveTo(19.2, 7.4, 20.8, 6.1); g.stroke();
    eye(g, 17.6, 5.6, 0.55);
  }
};

const shark: Art = {
  w: 16, h: 8,
  pals: [{ g: '#7c8a98', w: '#eef2f4', d: '#5f6c7a' }],
  draw(g, pose, c) {
    const p = new Painter(0.36);
    const t = pose === 1 ? 0.6 : -0.2;
    p.poly([2.4, 4.4, 0.2, 1.6 + t, 1.0, 4.6, 0.2, 7.2 + t], c.g);
    p.poly([6.8, 3.0, 8.4, 0.3, 9.9, 3.0], c.g);
    const f = volume(c.g, 8, 4.4, 6.5, 0.3, 0.78);
    p.ell(7.8, 4.6, 6.0, 2.0, f);
    p.shape(g2 => { g2.moveTo(11.8, 2.9); g2.quadraticCurveTo(15.6, 3.4, 15.9, 4.5); g2.quadraticCurveTo(14.6, 5.8, 11.8, 6.4); g2.closePath(); }, f);
    p.poly([8.8, 5.7, 10.4, 7.8, 11.0, 5.8], c.d, { sep: true });
    p.render(g);
    clip(g, g2 => { g2.ellipse(7.8, 4.6, 5.85, 1.85, 0, 0, TAU); g2.moveTo(11.8, 4.5); g2.lineTo(15.8, 4.5); g2.lineTo(11.8, 6.3); }, () => blob(g, 9.2, 6.0, 6.2, 1.1, c.w));
    g.strokeStyle = shade(c.g, 0.65); g.lineWidth = 0.22;
    for (const x of [10.2, 10.8, 11.4]) { g.beginPath(); g.moveTo(x, 3.8); g.lineTo(x - 0.25, 5.0); g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = 0.25;
    g.beginPath(); g.moveTo(13.4, 5.4); g.quadraticCurveTo(14.6, 5.5, 15.4, 4.9); g.stroke();
    eye(g, 13.4, 4.0, 0.4);
  }
};

const dolphin: Art = {
  w: 13, h: 7,
  pals: [{ d: '#6a92bc', l: '#e2ecf6' }],
  draw(g, pose, c) {
    const p = new Painter(0.34);
    const t = pose === 1 ? 0.6 : -0.2;
    p.poly([2.0, 3.6, 0.2, 1.8 + t, 0.9, 3.8, 0.2, 5.6 + t], c.d);
    p.poly([5.6, 2.3, 6.4, 0.3, 7.7, 2.3], c.d);
    p.ell(6.4, 3.8, 5.0, 1.9, volume(c.d, 6.4, 3.8, 5.0, 0.3, 0.78));
    p.ell(11.9, 4.2, 1.3, 0.55, c.d, { sep: true });
    p.poly([7.0, 4.8, 7.6, 6.4, 8.6, 4.9], shade(c.d, 0.85), { sep: true });
    p.render(g);
    clip(g, ellPath(6.4, 3.8, 5.0, 1.9), () => blob(g, 7.2, 5.1, 4.4, 1.0, c.l));
    smile(g, 11.4, 4.9, 0.8);
    eye(g, 10.2, 3.3, 0.45);
  }
};

const crab: Art = {
  w: 10, h: 7,
  pals: [{ r: '#e04a2a' }],
  draw(g, pose, c) {
    const p = new Painter(0.32);
    const up = pose === 1 ? -0.6 : 0;
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
      const x0 = 5 + s * (1.8 + k * 0.4), y0 = 4.8 + k * 0.2;
      p.line([x0, y0, x0 + s * 1.4, y0 + 0.9, x0 + s * 1.7, y0 + 1.8], 0.4, shade(c.r, 0.85));
    }
    p.line([4.2, 3.0, 4.0, 1.6], 0.3, c.r).line([5.8, 3.0, 6.0, 1.6], 0.3, c.r);
    p.ell(5, 4.4, 3.0, 1.8, volume(c.r, 5, 4.4, 3.0, 0.3, 0.8));
    p.line([2.6, 3.8, 1.3, 2.2 + up], 0.55, c.r).line([7.4, 3.8, 8.7, 2.2 + up], 0.55, c.r);
    p.circ(1.2, 1.6 + up, 0.95, volume(c.r, 1.2, 1.6 + up, 0.95, 0.3, 0.8), { sep: true });
    p.circ(8.8, 1.6 + up, 0.95, volume(c.r, 8.8, 1.6 + up, 0.95, 0.3, 0.8), { sep: true });
    p.render(g);
    g.strokeStyle = INK; g.lineWidth = 0.25;
    for (const x of [1.2, 8.8]) { g.beginPath(); g.moveTo(x, 1.6 + up); g.lineTo(x + (x < 5 ? -0.9 : 0.9), 1.3 + up); g.stroke(); }
    eye(g, 4.0, 1.5, 0.45); eye(g, 6.0, 1.5, 0.45);
    smile(g, 5, 4.8, 0.55);
  }
};

// ---------------------------------------------------------------- небо
function flyer(w: number, h: number, pals: Pal[], fn: (p: Painter, c: Pal, up: boolean) => void, after?: (g: CanvasRenderingContext2D, c: Pal, up: boolean) => void): Art {
  return {
    w, h, pals,
    draw(g, pose, c) {
      const p = new Painter(0.3);
      fn(p, c, pose === 0);
      p.render(g);
      after?.(g, c, pose === 0);
    }
  };
}

const bird = flyer(8, 5, [{ k: '#3a3a48', y: '#f2a61e' }], (p, c, up) => {
  if (up) p.poly([4, 2.8, 0.8, 0.5, 2.2, 3.0], c.k).poly([4, 2.8, 7.2, 0.5, 5.8, 3.0], c.k);
  else p.ell(2.0, 3.0, 1.9, 0.5, c.k, { rot: 0.1 }).ell(6.0, 3.0, 1.9, 0.5, c.k, { rot: -0.1 });
  p.ell(4, 3.0, 1.5, 1.0, volume(c.k, 4, 3, 1.5, 0.35, 0.8));
  p.poly([5.3, 2.7, 6.3, 3.0, 5.3, 3.3], c.y);
}, g => { blob(g, 4.7, 2.7, 0.22, 0.22, '#ffffff'); });

const gull = flyer(10, 5, [{ w: '#f8f8f8', g: '#a8b0b8', k: '#3a3f46', y: '#f2c21e' }], (p, c, up) => {
  if (up) {
    p.poly([5, 2.9, 1.2, 0.4, 0.2, 0.9, 3.0, 3.2], c.g).poly([5, 2.9, 8.8, 0.4, 9.8, 0.9, 7.0, 3.2], c.g);
  } else p.ell(2.4, 3.0, 2.4, 0.55, c.g, { rot: 0.05 }).ell(7.6, 3.0, 2.4, 0.55, c.g, { rot: -0.05 });
  p.ell(5, 3.1, 1.7, 1.0, volume(c.w, 5, 3.1, 1.7, 0.3, 0.85));
  p.poly([6.5, 2.8, 7.6, 3.1, 6.5, 3.4], c.y);
}, (g, c, up) => {
  if (up) { blob(g, 0.8, 0.8, 0.5, 0.3, c.k); blob(g, 9.2, 0.8, 0.5, 0.3, c.k); }
  blob(g, 5.9, 2.8, 0.2, 0.2, INK);
});

const eagle = flyer(13, 7, [{ k: '#6a4424', w: '#f6f4ee', y: '#f2b134' }], (p, c, up) => {
  const f = volume(c.k, 6.5, 3.5, 6, 0.25, 0.8);
  if (up) {
    p.shape(g => { g.moveTo(6, 3.4); g.lineTo(0.3, 1.0); g.lineTo(0.8, 2.2); g.lineTo(0.2, 2.6); g.lineTo(1.4, 3.4); g.lineTo(0.8, 3.9); g.lineTo(3.4, 4.4); g.closePath(); }, f);
    p.shape(g => { g.moveTo(7, 3.4); g.lineTo(12.7, 1.0); g.lineTo(12.2, 2.2); g.lineTo(12.8, 2.6); g.lineTo(11.6, 3.4); g.lineTo(12.2, 3.9); g.lineTo(9.6, 4.4); g.closePath(); }, f);
  } else {
    p.shape(g => { g.moveTo(6, 3.4); g.lineTo(1.4, 5.8); g.lineTo(2.6, 4.4); g.lineTo(3.8, 4.4); g.closePath(); }, f);
    p.shape(g => { g.moveTo(7, 3.4); g.lineTo(11.6, 5.8); g.lineTo(10.4, 4.4); g.lineTo(9.2, 4.4); g.closePath(); }, f);
  }
  p.poly([5.6, 4.6, 6.5, 6.6, 7.4, 4.6], c.k);
  p.ell(6.5, 3.8, 1.3, 1.6, f);
  p.circ(6.5, 2.0, 1.1, c.w, { sep: true });
  p.poly([6.1, 2.6, 6.5, 3.6, 6.9, 2.6], c.y, { sep: true });
}, g => { blob(g, 6.1, 1.8, 0.2, 0.2, INK); blob(g, 6.9, 1.8, 0.2, 0.2, INK); });

const bat = flyer(10, 5, [{ k: '#3a2e48', p: '#6a5a80' }], (p, c, up) => {
  const f = volume(c.k, 5, 2.5, 5, 0.35, 0.8);
  if (up) {
    p.shape(g => { g.moveTo(4.4, 2.6); g.lineTo(0.2, 0.6); g.quadraticCurveTo(0.9, 2.2, 0.4, 3.0); g.quadraticCurveTo(1.6, 2.4, 2.0, 3.6); g.quadraticCurveTo(2.8, 2.8, 3.6, 3.8); g.closePath(); }, f);
    p.shape(g => { g.moveTo(5.6, 2.6); g.lineTo(9.8, 0.6); g.quadraticCurveTo(9.1, 2.2, 9.6, 3.0); g.quadraticCurveTo(8.4, 2.4, 8.0, 3.6); g.quadraticCurveTo(7.2, 2.8, 6.4, 3.8); g.closePath(); }, f);
  } else {
    p.shape(g => { g.moveTo(4.4, 2.6); g.lineTo(1.4, 4.8); g.quadraticCurveTo(2.2, 4.0, 2.8, 4.6); g.quadraticCurveTo(3.2, 3.8, 3.8, 4.2); g.closePath(); }, f);
    p.shape(g => { g.moveTo(5.6, 2.6); g.lineTo(8.6, 4.8); g.quadraticCurveTo(7.8, 4.0, 7.2, 4.6); g.quadraticCurveTo(6.8, 3.8, 6.2, 4.2); g.closePath(); }, f);
  }
  p.poly([4.2, 1.8, 4.3, 0.6, 4.9, 1.6], c.k).poly([5.1, 1.6, 5.7, 0.6, 5.8, 1.8], c.k);
  p.ell(5, 2.8, 1.1, 1.3, f);
}, g => { blob(g, 4.6, 2.4, 0.22, 0.22, '#ffe066'); blob(g, 5.4, 2.4, 0.22, 0.22, '#ffe066'); });

const butterfly = flyer(7, 5,
  [{ y: '#ffd23c' }, { y: '#ff7ab8' }, { y: '#6ab8ff' }, { y: '#f4f4f4' }],
  (p, c, up) => {
    const f = volume(c.y, 3.5, 2.2, 3.5, 0.4, 0.8);
    if (up) {
      p.ell(1.9, 1.6, 1.6, 1.3, f, { rot: -0.3 }).ell(5.1, 1.6, 1.6, 1.3, f, { rot: 0.3 });
      p.ell(2.3, 3.4, 1.0, 0.8, f, { rot: 0.4 }).ell(4.7, 3.4, 1.0, 0.8, f, { rot: -0.4 });
    } else {
      p.ell(2.6, 1.9, 0.9, 1.4, f, { rot: -0.2 }).ell(4.4, 1.9, 0.9, 1.4, f, { rot: 0.2 });
    }
    p.line([3.5, 1.4, 3.5, 3.9], 0.45, '#3a2a20');
  },
  (g, c, up) => {
    g.strokeStyle = INK; g.lineWidth = 0.18;
    g.beginPath(); g.moveTo(3.4, 1.4); g.quadraticCurveTo(2.9, 0.4, 2.5, 0.3); g.moveTo(3.6, 1.4); g.quadraticCurveTo(4.1, 0.4, 4.5, 0.3); g.stroke();
    if (up) { blob(g, 1.6, 1.4, 0.4, 0.4, tint(c.y, 0.55)); blob(g, 5.4, 1.4, 0.4, 0.4, tint(c.y, 0.55)); }
  });

const firefly = flyer(2, 2, [{ y: '#eaff80' }], (p, c) => { p.circ(1, 1, 0.6, c.y); });

export const ART: Record<string, Art> = {
  cow, sheep, chicken, rabbit, deer, zebra, elephant, camel, penguin, frog,
  wolf, fox, bear, polar, lion, tiger, croc,
  fish, whale, shark, dolphin, crab,
  bird, gull, eagle, bat, butterfly, firefly
};

/** Поля навколо коробки спрайта (одиниці) — щоб хвости/контури не обрізались. */
export const ART_PAD = 2;
