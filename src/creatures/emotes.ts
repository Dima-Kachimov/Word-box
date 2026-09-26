// Іконки-емоції над твариною (тривога, злість, сон, спрага, їжа тощо):
// мультяшна бульбашка з контуром і хвостиком, всередині — символ.

import { Painter, INK, TAU, volume } from '../render/cartoon';
import { LodSprite } from './sprite';

/** Розмір бульбашки у світових пікселях. */
export const EMO_W = 6, EMO_H = 6.4;

type Icon = (g: CanvasRenderingContext2D) => void;

function mark(color: string): Icon {
  return g => {
    const p = new Painter(0.3);
    p.shape(g2 => { g2.moveTo(2.5, 0.9); g2.lineTo(3.5, 0.9); g2.lineTo(3.2, 3.2); g2.lineTo(2.8, 3.2); g2.closePath(); }, color);
    p.circ(3, 4.1, 0.5, color);
    p.render(g);
  };
}

const ICONS: Record<string, Icon> = {
  alarm: mark('#ffd23c'),
  angry: g => {
    // "венка злості" 💢 — чотири дуги, вигнуті до центру
    g.strokeStyle = '#e8342a'; g.lineWidth = 0.6; g.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + TAU / 8, cx = 3 + Math.cos(a) * 2.1, cy = 2.8 + Math.sin(a) * 2.1;
      g.beginPath(); g.arc(cx, cy, 1.25, a + Math.PI - 0.62, a + Math.PI + 0.62); g.stroke();
    }
  },
  zzz: g => {
    g.strokeStyle = '#5a78c8'; g.lineJoin = 'round'; g.lineCap = 'round';
    const z = (x: number, y: number, s: number) => {
      g.lineWidth = 0.28 + s * 0.12;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + s, y); g.lineTo(x, y + s); g.lineTo(x + s, y + s); g.stroke();
    };
    z(1.4, 2.4, 1.6); z(3.4, 1.2, 1.1);
  },
  drop: g => {
    const p = new Painter(0.3);
    p.shape(g2 => { g2.moveTo(3, 0.8); g2.quadraticCurveTo(4.6, 2.9, 4.2, 3.6); g2.arc(3, 3.5, 1.25, 0.1, Math.PI - 0.1); g2.quadraticCurveTo(1.4, 2.9, 3, 0.8); }, volume('#4aa8f0', 3, 3.2, 1.6, 0.4, 0.8));
    p.render(g);
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(2.5, 3.3, 0.3, 0.5, 0.3, 0, TAU); g.fill();
  },
  leaf: g => {
    const p = new Painter(0.3);
    p.shape(g2 => { g2.moveTo(1.3, 4.4); g2.quadraticCurveTo(1.2, 1.2, 4.7, 1.0); g2.quadraticCurveTo(4.6, 4.2, 1.3, 4.4); }, volume('#6cc04a', 3, 2.7, 2, 0.35, 0.8));
    p.render(g);
    g.strokeStyle = '#3a7a2a'; g.lineWidth = 0.22; g.lineCap = 'round';
    g.beginPath(); g.moveTo(1.3, 4.4); g.quadraticCurveTo(2.8, 2.6, 4.2, 1.5); g.stroke();
  },
  meat: g => {
    const p = new Painter(0.3);
    p.line([3.2, 3.0, 4.6, 4.3], 0.55, '#f4efe0');
    p.circ(4.7, 4.5, 0.42, '#f4efe0').circ(4.4, 4.7, 0.36, '#f4efe0');
    p.ell(2.6, 2.4, 1.6, 1.3, volume('#c8503a', 2.6, 2.4, 1.6, 0.3, 0.8), { rot: -0.6 });
    p.render(g);
  },
  heart: g => {
    const p = new Painter(0.3);
    p.shape(g2 => {
      g2.moveTo(3, 4.5);
      g2.bezierCurveTo(0.6, 3.0, 0.9, 0.8, 3, 1.9);
      g2.bezierCurveTo(5.1, 0.8, 5.4, 3.0, 3, 4.5);
    }, volume('#ff5a7a', 3, 2.6, 2, 0.4, 0.8));
    p.render(g);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(2.0, 2.2, 0.35, 0.25, -0.5, 0, TAU); g.fill();
  }
};

function bubble(icon: Icon): LodSprite {
  return new LodSprite(EMO_W, EMO_H, 0.4, g => {
    g.lineJoin = 'round';
    g.beginPath();
    g.ellipse(3, 2.8, 2.85, 2.6, 0, 0, TAU);
    g.moveTo(2.2, 5.1); g.lineTo(2.6, 6.3); g.lineTo(3.6, 5.1);
    g.fillStyle = '#fffaf2'; g.strokeStyle = INK; g.lineWidth = 0.5;
    g.stroke(); g.fill();
    icon(g);
  });
}

export const EMO: Record<string, LodSprite> = {};
for (const [k, icon] of Object.entries(ICONS)) EMO[k] = bubble(icon);

export type EmoteKey = keyof typeof ICONS;
