/**
 * A small pixel painter for the heroes: hard-edged shapes (polygons, tapered limbs, ellipses)
 * filled with three-tone cel shading lit from the upper left, outlined where they overlap what
 * is already painted, plus a soft effects layer (smears, glows, dust) drawn on top.
 */

export type RGB = readonly [number, number, number];
/** Light, base and shadow tones. */
export type Ramp = readonly [RGB, RGB, RGB];

export const INK: RGB = [24, 18, 26];

export function hex(h: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)] : [255, 0, 255];
}

/** A ramp from three hex colours. */
export const ramp = (hi: string, base: string, lo: string): Ramp => [hex(hi), hex(base), hex(lo)];

/** Darkens (k < 0) or lightens (k > 0) every tone of a ramp. */
export function shiftRamp(r: Ramp, k: number): Ramp {
  const f = (c: RGB): RGB => c.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))) as unknown as RGB;
  return [f(r[0]), f(r[1]), f(r[2])];
}

export interface Raster {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** A set of pixels, with its bounds, that a part fills. */
export class Mask {
  readonly bits: Uint8Array;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.bits = new Uint8Array(w * h);
    this.x0 = w;
    this.y0 = h;
    this.x1 = -1;
    this.y1 = -1;
  }

  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.bits[y * this.w + x] === 1;
  }

  set(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.bits[y * this.w + x] = 1;
    if (x < this.x0) this.x0 = x;
    if (y < this.y0) this.y0 = y;
    if (x > this.x1) this.x1 = x;
    if (y > this.y1) this.y1 = y;
  }

  /** Every pixel whose centre lies inside the polygon. */
  poly(pts: readonly (readonly [number, number])[]): this {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const yA = Math.max(0, Math.floor(Math.min(...ys)));
    const yB = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    const xA = Math.max(0, Math.floor(Math.min(...xs)));
    const xB = Math.min(this.w - 1, Math.ceil(Math.max(...xs)));
    for (let y = yA; y <= yB; y++) {
      const cy = y + 0.5;
      for (let x = xA; x <= xB; x++) {
        const cx = x + 0.5;
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i] as [number, number];
          const [xj, yj] = pts[j] as [number, number];
          if (yi > cy !== yj > cy && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y);
      }
    }
    return this;
  }

  /** A limb: a segment from a to b, ra wide at a and rb wide at b, with rounded ends. */
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number): this {
    const r = Math.max(ra, rb);
    const xA = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
    const xB = Math.min(this.w - 1, Math.ceil(Math.max(ax, bx) + r + 1));
    const yA = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
    const yB = Math.min(this.h - 1, Math.ceil(Math.max(ay, by) + r + 1));
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = yA; y <= yB; y++) {
      for (let x = xA; x <= xB; x++) {
        const px = x + 0.5 - ax;
        const py = y + 0.5 - ay;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const ex = px - dx * t;
        const ey = py - dy * t;
        const rr = ra + (rb - ra) * t;
        if (ex * ex + ey * ey <= rr * rr) this.set(x, y);
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / Math.max(0.5, rx);
        const dy = (y + 0.5 - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1) this.set(x, y);
      }
    }
    return this;
  }

  /** Keeps only pixels that a test accepts (for cutting a band out of a part). */
  filter(keep: (x: number, y: number) => boolean): this {
    for (let y = this.y0; y <= this.y1; y++) for (let x = this.x0; x <= this.x1; x++) if (this.bits[y * this.w + x] && !keep(x, y)) this.bits[y * this.w + x] = 0;
    return this;
  }
}

export interface PaintOpts {
  /** Line where the part overlaps parts painted before it (default ink; false for none). */
  line?: RGB | false;
  /** Pixels of shadow down the right edge. */
  shade?: number;
  hi?: boolean;
  bottom?: boolean;
}

/** The canvas one hero frame is painted on. */
export class Canvas implements Raster {
  readonly data: Uint8ClampedArray;
  /** Soft effects drawn over the figure after it is outlined, and under it (on the ground). */
  readonly fx: Float32Array;
  readonly under: Float32Array;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
    this.fx = new Float32Array(w * h * 4);
    this.under = new Float32Array(w * h * 4);
  }

  mask(): Mask {
    return new Mask(this.w, this.h);
  }

  opaque(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && (this.data[(y * this.w + x) * 4 + 3] as number) > 0;
  }

  setPx(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }

  /** Fills a part with cel shading, outlining it where it covers earlier parts. */
  paint(m: Mask, r: Ramp, opts: PaintOpts = {}): this {
    if (m.x1 < 0) return this;
    const line = opts.line === undefined ? INK : opts.line;
    if (line) {
      for (let y = m.y0 - 1; y <= m.y1 + 1; y++) {
        for (let x = m.x0 - 1; x <= m.x1 + 1; x++) {
          if (m.has(x, y) || !this.opaque(x, y)) continue;
          if (m.has(x - 1, y) || m.has(x + 1, y) || m.has(x, y - 1) || m.has(x, y + 1)) this.setPx(x, y, line);
        }
      }
    }
    const shade = opts.shade ?? 1;
    const run = (x: number, y: number, dx: number, dy: number): number => {
      let k = 1;
      while (k <= 4 && m.has(x + dx * k, y + dy * k)) k++;
      return k;
    };
    for (let y = m.y0; y <= m.y1; y++) {
      for (let x = m.x0; x <= m.x1; x++) {
        if (!m.has(x, y)) continue;
        let c = r[1];
        if (run(x, y, 1, 0) <= shade || (opts.bottom !== false && run(x, y, 0, 1) <= 1)) c = r[2];
        else if (opts.hi !== false && (run(x, y, 0, -1) <= 1 || run(x, y, -1, 0) <= 1)) c = r[0];
        this.setPx(x, y, c);
      }
    }
    return this;
  }

  /** Paints single pixels in one colour (details: eyes of a gem, rivets, stitches). */
  dots(pts: readonly (readonly [number, number])[], c: RGB): this {
    for (const [x, y] of pts) this.setPx(Math.floor(x), Math.floor(y), c);
    return this;
  }

  /** A one-pixel line in one colour. */
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): this {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    for (let i = 0; i <= n; i++) this.setPx(Math.floor(x0 + ((x1 - x0) * i) / n), Math.floor(y0 + ((y1 - y0) * i) / n), c);
    return this;
  }

  /** Copies a raster (a hero's head) onto the canvas with its top-left at (x, y). */
  stamp(src: Raster, x: number, y: number): this {
    for (let sy = 0; sy < src.h; sy++) {
      for (let sx = 0; sx < src.w; sx++) {
        const si = (sy * src.w + sx) * 4;
        if ((src.data[si + 3] as number) < 96) continue;
        this.setPx(x + sx, y + sy, [src.data[si] as number, src.data[si + 1] as number, src.data[si + 2] as number]);
      }
    }
    return this;
  }

  /** Outlines the whole figure. */
  outline(c: RGB = INK): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1)) add.push(x, y);
      }
    }
    for (let i = 0; i < add.length; i += 2) this.setPx(add[i] as number, add[i + 1] as number, c);
    return this;
  }

  /** Adds colour to an effects layer (blended over the figure at the end, or under it). */
  glow(x: number, y: number, c: RGB, a: number, under = false): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const layer = under ? this.under : this.fx;
    const i = (y * this.w + x) * 4;
    const prev = layer[i + 3] as number;
    const na = Math.min(1, prev + a * (1 - prev));
    // Newer colour lands on top of what was there.
    for (let k = 0; k < 3; k++) layer[i + k] = ((c[k] as number) * a + (layer[i + k] as number) * prev * (1 - a)) / (na || 1);
    layer[i + 3] = na;
  }

  /** Fills a mask on the effects layer. */
  glowMask(m: Mask, c: RGB, a: number): void {
    for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) if (m.has(x, y)) this.glow(x, y, c, a);
  }

  /** Blends the ground effects under the figure and the effects layer over it. */
  flatten(): Raster {
    const d = this.data;
    for (let i = 0; i < this.w * this.h; i++) {
      const ua = this.under[i * 4 + 3] as number;
      if (ua > 0 && (d[i * 4 + 3] as number) === 0) {
        for (let k = 0; k < 3; k++) d[i * 4 + k] = this.under[i * 4 + k] as number;
        d[i * 4 + 3] = ua * 255;
      }
      const a = this.fx[i * 4 + 3] as number;
      if (a <= 0) continue;
      const da = (d[i * 4 + 3] as number) / 255;
      const oa = a + da * (1 - a);
      for (let k = 0; k < 3; k++) d[i * 4 + k] = ((this.fx[i * 4 + k] as number) * a + (d[i * 4 + k] as number) * da * (1 - a)) / oa;
      d[i * 4 + 3] = oa * 255;
    }
    return { w: this.w, h: this.h, data: d };
  }
}
