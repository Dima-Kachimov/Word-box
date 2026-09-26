// Генератор маленьких canvas-спрайтів із текстових "піксель-карт" (рядки
// символів → колір з палітри). Використовується і для тварин (species.ts),
// і для іконок емоцій (emotes.ts).

export type PixelRows = string[];
export type Palette = Record<string, string>;

export function spriteCanvas(rows: PixelRows, pal: Palette, w: number, flip: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[flip ? w - 1 - x : x];
      if (ch && ch !== '.') { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}
