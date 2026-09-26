// Векторний малюнок, растеризований "на вимогу" у кількох роздільностях
// (LOD). Малювати великий спрайт сильно зменшеним — це мерехтливі зубці
// (canvas не має mip-мап), тож для кожного масштабу береться найближча
// роздільність, не менша за потрібну, і зменшується максимум удвічі.

/** Пікселів canvas на одиницю малюнка для кожного рівня деталізації. */
const LOD_RES = [1.5, 3, 6, 12, 24];

export class LodSprite {
  private lods: (HTMLCanvasElement | null)[] = LOD_RES.map(() => null);

  /**
   * @param w,h  розмір малюнка в одиницях (без полів)
   * @param pad  поля навколо (щоб контури/хвости не обрізались)
   * @param draw малює в одиницях, початок координат — лівий верхній кут коробки w×h
   */
  constructor(readonly w: number, readonly h: number, readonly pad: number, private draw: (g: CanvasRenderingContext2D) => void) {}

  /** Canvas для масштабу z (екранних пікселів на одиницю). */
  pick(z: number): HTMLCanvasElement {
    let k = 0;
    while (k < LOD_RES.length - 1 && LOD_RES[k] < z) k++;
    return this.lods[k] || (this.lods[k] = this.raster(LOD_RES[k]));
  }

  private raster(res: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.ceil((this.w + this.pad * 2) * res);
    c.height = Math.ceil((this.h + this.pad * 2) * res);
    const g = c.getContext('2d')!;
    g.scale(res, res);
    g.translate(this.pad, this.pad);
    this.draw(g);
    return c;
  }

  /** Малює спрайт так, що лівий верхній кут коробки w×h потрапляє в (x,y), розмір — w*s×h*s екранних пікселів. */
  blit(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flip = false): void {
    const img = this.pick(s), fw = (this.w + this.pad * 2) * s, fh = (this.h + this.pad * 2) * s;
    if (!flip) { ctx.drawImage(img, x - this.pad * s, y - this.pad * s, fw, fh); return; }
    ctx.save();
    ctx.translate(x + this.w * s, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -this.pad * s, y - this.pad * s, fw, fh);
    ctx.restore();
  }
}
