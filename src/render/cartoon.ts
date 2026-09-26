// Інструменти мультяшного малювання: фігури з товстим темним контуром і
// об'ємною заливкою (радіальний градієнт "світло зверху-зліва"). Усі
// спрайти гри (дерева, тварини, емоції) малюються через Painter у власних
// одиницях, а потім растеризуються в атласи потрібної роздільності.
//
// Контур робиться у два проходи: спершу всі фігури обводяться й заливаються
// кольором контуру з подвійною товщиною (це дає єдиний зовнішній силует),
// потім поверх малюються кольорові заливки. Так внутрішні стики частин тіла
// не мають зайвих ліній, а зовнішній контур — суцільний, як у наліпки.
// Фігури з sep:true додатково обводяться у другому проході, щоб відділитися
// від того, що позаду (наприклад, голова поверх тулуба).

export const INK = '#2b1a14';
export const TAU = Math.PI * 2;

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}
/** Затемнює колір множенням (f<1 — темніше). */
export function shade(hex: string, f: number): string {
  const [r, g, b] = hexRgb(hex);
  return toHex(r * f, g * f, b * f);
}
/** Висвітлює колір у бік білого (f=0 — без змін, f=1 — білий). */
export function tint(hex: string, f: number): string {
  const [r, g, b] = hexRgb(hex);
  return toHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

/** Об'ємна заливка: світло зверху-зліва, тінь знизу-справа. */
export function volume(base: string, cx: number, cy: number, r: number, light = 0.35, dark = 0.72) {
  return (g: CanvasRenderingContext2D) => {
    const gr = g.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx, cy, r * 1.15);
    gr.addColorStop(0, tint(base, light));
    gr.addColorStop(0.6, base);
    gr.addColorStop(1, shade(base, dark));
    return gr;
  };
}

type Fill = string | ((g: CanvasRenderingContext2D) => string | CanvasGradient);

interface Opts { outline?: boolean; sep?: boolean; }

type Op =
  | { t: 'shape'; path: (g: CanvasRenderingContext2D) => void; fill: Fill; outline: boolean; sep: boolean }
  | { t: 'line'; pts: number[]; w: number; color: Fill; outline: boolean; sep: boolean };

export class Painter {
  private ops: Op[] = [];
  constructor(private lw = 0.42, private ink = INK) {}

  shape(path: (g: CanvasRenderingContext2D) => void, fill: Fill, o: Opts = {}): this {
    this.ops.push({ t: 'shape', path, fill, outline: o.outline !== false, sep: !!o.sep });
    return this;
  }
  ell(x: number, y: number, rx: number, ry: number, fill: Fill, o: Opts & { rot?: number } = {}): this {
    const rot = o.rot || 0;
    return this.shape(g => g.ellipse(x, y, rx, ry, rot, 0, TAU), fill, o);
  }
  circ(x: number, y: number, r: number, fill: Fill, o: Opts = {}): this {
    return this.shape(g => g.arc(x, y, r, 0, TAU), fill, o);
  }
  poly(pts: number[], fill: Fill, o: Opts = {}): this {
    return this.shape(g => {
      g.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) g.lineTo(pts[k], pts[k + 1]);
      g.closePath();
    }, fill, o);
  }
  /** Товста лінія з круглими кінцями (кінцівки, стовбури, хвости). */
  line(pts: number[], w: number, color: Fill, o: Opts = {}): this {
    this.ops.push({ t: 'line', pts, w, color, outline: o.outline !== false, sep: !!o.sep });
    return this;
  }

  private trace(g: CanvasRenderingContext2D, op: Op): void {
    g.beginPath();
    if (op.t === 'shape') op.path(g);
    else {
      g.moveTo(op.pts[0], op.pts[1]);
      for (let k = 2; k < op.pts.length; k += 2) g.lineTo(op.pts[k], op.pts[k + 1]);
    }
  }
  private inkOp(g: CanvasRenderingContext2D, op: Op): void {
    this.trace(g, op);
    g.strokeStyle = this.ink;
    if (op.t === 'shape') {
      g.fillStyle = this.ink; g.lineWidth = this.lw * 2;
      g.stroke(); g.fill();
    } else {
      g.lineWidth = op.w + this.lw * 2;
      g.stroke();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.lineJoin = 'round'; g.lineCap = 'round';
    for (const op of this.ops) if (op.outline && !op.sep) this.inkOp(g, op);
    for (const op of this.ops) {
      if (op.outline && op.sep) this.inkOp(g, op);
      this.trace(g, op);
      if (op.t === 'shape') {
        g.fillStyle = typeof op.fill === 'function' ? op.fill(g) : op.fill;
        g.fill();
      } else {
        g.strokeStyle = typeof op.color === 'function' ? op.color(g) : op.color;
        g.lineWidth = op.w;
        g.stroke();
      }
    }
    this.ops = [];
  }
}

/** Мультяшне око: білок, зіниця, відблиск. closed — спляче око-дужка. */
export function eye(g: CanvasRenderingContext2D, x: number, y: number, r: number, closed = false, lw = 0.28): void {
  if (closed) {
    g.strokeStyle = INK; g.lineWidth = lw * 1.4; g.lineCap = 'round';
    g.beginPath(); g.arc(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    return;
  }
  g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = lw;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = INK;
  g.beginPath(); g.arc(x + r * 0.28, y + r * 0.05, r * 0.58, 0, TAU); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(x + r * 0.08, y - r * 0.28, r * 0.24, 0, TAU); g.fill();
}

/** Звичайна заливка без контуру (плями, смуги, відблиски). */
export function blob(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill();
}
