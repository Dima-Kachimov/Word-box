// Мультяшні іконки інструментів і вкладок (тварини беруть іконку зі свого
// малюнка — getSpeciesIcon()). Кожна іконка малюється в коробці 10×10
// одиниць тим самим Painter-ом, що й дерева/тварини: товстий контур +
// об'ємна заливка.

import { Painter, volume, blob, INK, TAU } from '../render/cartoon';

type Draw = (g: CanvasRenderingContext2D) => void;

const mountain = (p: Painter) => {
  p.poly([0.6, 8.8, 4.2, 2.6, 6.0, 5.2, 7.0, 4.0, 9.4, 8.8], volume('#9a9aa6', 4.5, 5, 5, 0.3, 0.75));
  p.poly([3.2, 4.3, 4.2, 2.6, 5.3, 4.5, 4.6, 4.1, 4.0, 4.7], '#ffffff', { sep: true, outline: false });
};
const grass = (p: Painter) => p.shape(g => { g.moveTo(0.3, 8.2); g.quadraticCurveTo(5, 7.0, 9.7, 8.2); g.lineTo(9.7, 9.6); g.lineTo(0.3, 9.6); g.closePath(); }, '#6cc04a');
const arrow = (p: Painter, x: number, y0: number, y1: number, color: string) => {
  const dir = Math.sign(y1 - y0);
  p.line([x, y0, x, y1 - dir * 0.8], 0.9, color);
  p.poly([x - 1.4, y1 - dir * 1.2, x + 1.4, y1 - dir * 1.2, x, y1 + dir * 0.4], color);
};
const drop = (p: Painter, x: number, y: number, s: number) =>
  p.shape(g => { g.moveTo(x, y - 2.2 * s); g.quadraticCurveTo(x + 2 * s, y + 0.2 * s, x + 1.5 * s, y + 0.9 * s); g.arc(x, y + 0.6 * s, 1.55 * s, 0.2, Math.PI - 0.2); g.quadraticCurveTo(x - 2 * s, y + 0.2 * s, x, y - 2.2 * s); }, volume('#4aa8f0', x, y, 2 * s, 0.4, 0.8));
const cloud = (p: Painter, fill: string, y = 0) => {
  const f = volume(fill, 5, 3.6 + y, 4.5, 0.35, 0.82);
  p.circ(3.2, 4.4 + y, 1.9, f).circ(5.4, 3.3 + y, 2.3, f).circ(7.4, 4.6 + y, 1.7, f).ell(5.2, 5.4 + y, 3.8, 1.2, f);
};
const flame = (p: Painter, x: number, y: number, s: number) => {
  p.shape(g => { g.moveTo(x, y - 4 * s); g.quadraticCurveTo(x + 3.4 * s, y - 1 * s, x + 2.4 * s, y + 1.4 * s); g.quadraticCurveTo(x, y + 3 * s, x - 2.4 * s, y + 1.4 * s); g.quadraticCurveTo(x - 3 * s, y - 1 * s, x - 1 * s, y - 2 * s); g.quadraticCurveTo(x - 0.4 * s, y - 0.6 * s, x, y - 4 * s); }, volume('#ff8a1e', x, y, 3 * s, 0.3, 0.8));
  p.shape(g => { g.moveTo(x + 0.2 * s, y - 1.6 * s); g.quadraticCurveTo(x + 1.8 * s, y + 0.2 * s, x + 1.1 * s, y + 1.3 * s); g.quadraticCurveTo(x, y + 2.1 * s, x - 1.1 * s, y + 1.3 * s); g.quadraticCurveTo(x - 1.4 * s, y - 0.2 * s, x + 0.2 * s, y - 1.6 * s); }, '#ffe45c', { outline: false });
};

const DRAW: Record<string, Draw> = {
  tabLand: g => { const p = new Painter(0.45); grass(p); mountain(p); p.render(g); },
  raise: g => { const p = new Painter(0.45); grass(p); mountain(p); arrow(p, 8.0, 3.6, 0.6, '#7cd35a'); p.render(g); },
  lower: g => {
    const p = new Painter(0.45);
    p.shape(g2 => { g2.moveTo(0.3, 6.8); g2.quadraticCurveTo(5, 9.8, 9.7, 6.8); g2.lineTo(9.7, 9.6); g2.lineTo(0.3, 9.6); g2.closePath(); }, volume('#3a86d8', 5, 8, 4, 0.3, 0.8));
    arrow(p, 5, 0.8, 5.6, '#ff6a4d');
    p.render(g);
  },
  tree: g => {
    const p = new Painter(0.45);
    p.line([5, 6.0, 5, 9.2], 1.3, '#8a5a32');
    const f = volume('#5cb84a', 5, 3.8, 3.4, 0.35, 0.75);
    p.circ(3.2, 5.0, 2.0, f).circ(6.8, 5.0, 2.0, f).circ(5, 3.2, 2.6, f);
    p.render(g);
    blob(g, 3.8, 2.6, 0.5, 0.5, '#e8443a'); blob(g, 6.4, 4.4, 0.45, 0.45, '#e8443a'); blob(g, 4.0, 5.4, 0.45, 0.45, '#e8443a');
  },
  clear: g => {
    const p = new Painter(0.45);
    p.shape(g2 => { g2.moveTo(1.2, 6.6); g2.lineTo(5.6, 2.2); g2.lineTo(8.8, 5.4); g2.lineTo(4.4, 9.8); g2.closePath(); }, volume('#ff8fa8', 5, 6, 4, 0.35, 0.8));
    p.shape(g2 => { g2.moveTo(1.2, 6.6); g2.lineTo(3.2, 4.6); g2.lineTo(6.4, 7.8); g2.lineTo(4.4, 9.8); g2.closePath(); }, '#6aa8e8', { sep: true });
    p.render(g);
  },
  rain: g => { const p = new Painter(0.45); drop(p, 5, 5, 1.7); p.render(g); blob(g, 4.1, 5.6, 0.45, 0.8, 'rgba(255,255,255,0.85)', 0.3); },
  snow: g => {
    g.strokeStyle = INK; g.lineCap = 'round';
    const arm = (w: number, c: string) => {
      g.strokeStyle = c; g.lineWidth = w;
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3, dx = Math.cos(a) * 3.8, dy = Math.sin(a) * 3.8;
        g.beginPath(); g.moveTo(5 - dx, 5 - dy); g.lineTo(5 + dx, 5 + dy); g.stroke();
        for (const s of [-1, 1]) {
          const bx = 5 + s * dx * 0.62, by = 5 + s * dy * 0.62;
          for (const t of [-1, 1]) {
            const b = a + t * Math.PI / 4 + (s < 0 ? Math.PI : 0);
            g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(b) * 1.3, by + Math.sin(b) * 1.3); g.stroke();
          }
        }
      }
    };
    arm(1.8, INK); arm(0.9, '#dff4ff');
  },
  cloud: g => {
    const p = new Painter(0.45);
    p.poly([5.4, 5.6, 3.8, 8.0, 5.0, 8.0, 4.2, 9.8, 6.8, 7.2, 5.6, 7.2, 6.6, 5.6], '#ffd23c');
    cloud(p, '#a4aec0', -0.6);
    p.render(g);
  },
  bolt: g => {
    const p = new Painter(0.5);
    p.poly([6.4, 0.6, 2.4, 5.6, 4.8, 5.6, 3.2, 9.6, 8.0, 3.8, 5.4, 3.8, 7.2, 0.6], volume('#ffe45c', 5, 5, 5, 0.4, 0.85));
    p.render(g);
  },
  tornado: g => {
    const p = new Painter(0.45);
    p.shape(g2 => { g2.moveTo(0.8, 1.4); g2.lineTo(9.2, 1.4); g2.quadraticCurveTo(7.8, 5, 5.6, 7.2); g2.quadraticCurveTo(4.8, 8.4, 5.4, 9.6); g2.quadraticCurveTo(3.8, 8.6, 4.4, 7.0); g2.quadraticCurveTo(2.2, 5, 0.8, 1.4); }, '#e4e8ee');
    p.render(g);
    g.strokeStyle = '#8a94a4'; g.lineWidth = 0.45; g.lineCap = 'round';
    for (const [y, w] of [[3.0, 3.2], [4.8, 2.2], [6.4, 1.2]]) { g.beginPath(); g.ellipse(5, y, w, 0.5, 0, 0.1, Math.PI - 0.1); g.stroke(); }
  },
  fire: g => { const p = new Painter(0.45); flame(p, 5, 5.6, 1.1); p.render(g); },
  lava: g => {
    const p = new Painter(0.45);
    p.poly([0.4, 9.4, 3.4, 3.6, 6.6, 3.6, 9.6, 9.4], volume('#6a5048', 5, 6, 5, 0.25, 0.75));
    p.shape(g2 => { g2.moveTo(3.4, 3.6); g2.lineTo(6.6, 3.6); g2.lineTo(6.0, 5.2); g2.quadraticCurveTo(5.6, 7.2, 6.6, 8.6); g2.quadraticCurveTo(5, 8.2, 4.8, 6.4); g2.quadraticCurveTo(4.0, 5.4, 3.4, 3.6); }, '#ff7a1e', { sep: true });
    p.circ(3.6, 1.8, 0.7, '#ffb347').circ(6.2, 1.2, 0.55, '#ff7a1e').circ(5.0, 2.4, 0.5, '#ffe45c');
    p.render(g);
  },
  meteor: g => {
    const p = new Painter(0.45);
    p.shape(g2 => { g2.moveTo(0.4, 0.4); g2.quadraticCurveTo(4.0, 3.0, 7.6, 4.8); g2.lineTo(4.8, 7.6); g2.quadraticCurveTo(3.0, 4.0, 0.4, 0.4); }, '#ff9a2a');
    p.shape(g2 => { g2.moveTo(2.2, 2.2); g2.quadraticCurveTo(4.6, 4.0, 7.0, 5.4); g2.lineTo(5.4, 7.0); g2.quadraticCurveTo(4.0, 4.6, 2.2, 2.2); }, '#ffe45c', { outline: false });
    p.circ(6.6, 6.6, 2.4, volume('#7a5e50', 6.6, 6.6, 2.4, 0.3, 0.75), { sep: true });
    p.render(g);
    blob(g, 7.2, 7.0, 0.5, 0.5, '#4a3630'); blob(g, 5.9, 6.0, 0.35, 0.35, '#4a3630');
  },
  inspect: g => {
    const p = new Painter(0.45);
    p.line([6.2, 6.2, 9.0, 9.0], 1.3, '#c8883a');
    p.circ(4.2, 4.2, 3.2, '#bfe4ff');
    p.render(g);
    g.strokeStyle = INK; g.lineWidth = 0.5;
    g.beginPath(); g.arc(4.2, 4.2, 3.2, 0, TAU); g.stroke();
    blob(g, 3.1, 3.0, 0.9, 0.55, 'rgba(255,255,255,0.9)', -0.6);
  }
};

export function hasIcon(id: string): boolean { return id in DRAW; }

/** Іконка n×n пікселів (з урахуванням щільності екрана — CSS зменшить). */
export function iconCanvas(id: string, n = 56): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d')!;
  const s = n / 11;
  g.scale(s, s); g.translate(0.5, 0.5);
  g.lineJoin = 'round'; g.lineCap = 'round';
  DRAW[id](g);
  return c;
}
