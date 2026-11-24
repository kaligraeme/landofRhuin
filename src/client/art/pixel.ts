/**
 * A tiny pixel-art canvas: paint shapes on a grid of palette colours, add a dark outline around
 * the silhouette, and export crisp SVG (one rect per run of pixels) for the sprite pipeline.
 */

export const INK = '#17121e';

/** Light, base and shadow tones of one material. */
export type Ramp = readonly [string, string, string];

export interface PaintOpts {
  /** Colour of the line drawn where the part overlaps earlier parts; false for none. */
  line?: string | false;
  /** How many pixels of shadow run down the right-hand edge. */
  shade?: number;
  /** Light rim on the upper-left edges (default on). */
  hi?: boolean;
  /** Shadow along the bottom edge (default on). */
  bottom?: boolean;
}

export class Pix {
  readonly w: number;
  readonly h: number;
  private px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array<string | null>(w * h).fill(null);
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x] ?? null;
  }

  set(x: number, y: number, c: string | null): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  /** Sets many single pixels: [[x, y], ...]. */
  dots(points: [number, number][], c: string): this {
    for (const [x, y] of points) this.set(x, y, c);
    return this;
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: string): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: string): this {
    return this.rect(x0, y, x1, y, c);
  }

  vline(x: number, y0: number, y1: number, c: string): this {
    return this.rect(x, y0, x, y1, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35);
        const dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  /** A filled polygon (pixel centres inside the shape). */
  poly(points: [number, number][], c: string): this {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i] as [number, number];
          const [xj, yj] = points[j] as [number, number];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    }
    return this;
  }

  /** Repaints pixels of colour `from` with `to` inside a region (for shading a shape). */
  recolor(from: string, to: string, test: (x: number, y: number) => boolean): this {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) === from && test(x, y)) this.set(x, y, to);
    return this;
  }

  /**
   * Paints a shape (any pixels set in `mask`) as one cel-shaded part: a dark line where it overlaps
   * parts painted before it, a light rim on its upper-left edges and shadow down its right side and
   * bottom — light comes from the upper left.
   */
  paint(mask: Pix, ramp: Ramp, opts: PaintOpts = {}): this {
    const [hi, base, lo] = ramp;
    const inside = (x: number, y: number): boolean => mask.get(x, y) !== null;
    if (opts.line !== false) {
      const ink = opts.line ?? INK;
      const add: [number, number][] = [];
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          if (inside(x, y) || this.get(x, y) === null) continue;
          if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1)) add.push([x, y]);
        }
      }
      for (const [x, y] of add) this.set(x, y, ink);
    }
    const shade = opts.shade ?? 1;
    const run = (x: number, y: number, dx: number, dy: number): number => {
      let k = 1;
      while (k <= 4 && inside(x + dx * k, y + dy * k)) k++;
      return k;
    };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (!inside(x, y)) continue;
        let c = base;
        if (run(x, y, 1, 0) <= shade || (opts.bottom !== false && run(x, y, 0, 1) <= 1)) c = lo;
        else if (opts.hi !== false && (run(x, y, 0, -1) <= 1 || run(x, y, -1, 0) <= 1)) c = hi;
        this.set(x, y, c);
      }
    }
    return this;
  }

  /** Adds a 1-pixel outline around everything painted so far. */
  outline(c = INK): this {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
      }
    }
    for (const [x, y] of add) this.set(x, y, c);
    return this;
  }

  /** Crisp SVG, each pixel `scale` units on its side when rasterised. */
  toSvg(scale = 8): string {
    let body = '';
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const c = this.get(x, y);
        if (!c) {
          x++;
          continue;
        }
        let n = 1;
        while (x + n < this.w && this.get(x + n, y) === c) n++;
        body += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${c}"/>`;
        x += n;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w * scale}" height="${this.h * scale}" shape-rendering="crispEdges">${body}</svg>`;
  }
}
