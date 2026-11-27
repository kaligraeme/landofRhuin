/**
 * The pixel canvas a chibi hero's frame is painted on (chibi/raster.ts paints the figure's parts
 * into it, chibi/fx.ts its effects): the figure's pixels, soft effects layers over and under them
 * and an outline round the whole figure; and the colour, point and raster types the art code
 * shares.
 */

/** A point or a direction on screen, in frame pixels (y down). */
export type Vec = readonly [number, number];

/** A colour: red, green and blue, 0 to 255. */
export type RGB = readonly [number, number, number];

/** The near-black the figure is outlined in by default. */
export const INK: RGB = [24, 18, 26];

/** A colour from its hex code (`#rrggbb`); magenta if it is not one. */
export function hex(h: string): RGB {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)] : [255, 0, 255];
}

/** RGBA pixels, row by row. */
export interface Raster {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** The canvas one hero frame is painted on: its pixels, and soft effects layers over and under them. */
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
