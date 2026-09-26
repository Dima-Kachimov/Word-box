// Посилання на головний видимий canvas (той, що бачить гравець).
// Ініціалізується один раз з main.ts після завантаження DOM.

export const view = {
  canvas: null as unknown as HTMLCanvasElement,
  ctx: null as unknown as CanvasRenderingContext2D
};

export function initView(canvas: HTMLCanvasElement): void {
  view.canvas = canvas;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas контекст недоступний');
  view.ctx = ctx;
}
