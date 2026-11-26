/**
 * The chibi part painter. A part (a limb, the head and its hair, a coat tail, the sword) is first
 * rasterised into a scratch buffer, each pixel with a material, a light value from the part's 3D
 * shape, a depth and a shape id; then it is committed onto the Canvas from paint.ts:
 *
 *  - four-tone cel shading (highlight, light, base, shadow) from the light value, with a rim of
 *    light along the part's upper-left edges and a darker run along its lower-right ones;
 *  - coloured inner lines: where the part covers what is already painted it draws a line in its
 *    own darkest hue (not ink), and inside the part, where one shape passes in front of another
 *    (a lock of hair over the hair behind it, a fold of coat over the lining), the nearer shape's
 *    line colour marks the edge. Near-black ink is left for the figure's outer silhouette
 *    (`Canvas.outline`, once every part is down).
 *
 * Parts are painted far to near (the painter sorts them); inside a part a depth test keeps the
 * nearest shape, so a head's hair, face and features can be built in any order.
 */
import { type Canvas, hex, type RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { type Camera, DEPTH, dirIn, dot3, type Frame3, LIGHT, sub3, type V3 } from './rig.js';

export type Ramp4 = readonly [RGB, RGB, RGB, RGB];

/** A material: four tones lit to dark and the coloured line it draws over what lies behind. */
export interface Mat {
  tones: Ramp4;
  line: RGB;
  /** Added to the light: skin and pale trims read brighter than steel. */
  bias?: number;
  /** One flat colour with no rim and no lines (eyes, scars, runes). */
  flat?: boolean;
}

export function mat4(hi: string, light: string, base: string, shadow: string, line: string, bias = 0): Mat {
  return { tones: [hex(hi), hex(light), hex(base), hex(shadow)], line: hex(line), bias };
}

/** A flat colour for painted details. */
export const flat = (c: RGB | string): Mat => {
  const rgb = typeof c === 'string' ? hex(c) : c;
  return { tones: [rgb, rgb, rgb, rgb], line: rgb, flat: true };
};

/** Darkens (k < 0) or lightens (k > 0) a colour. */
export const shade = (c: RGB, k: number): RGB => c.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))) as unknown as RGB;

/** The same material a step darker or lighter (far limbs, the inside of a coat). */
export function dim(m: Mat, k: number): Mat {
  return { ...m, tones: m.tones.map((c) => shade(c, k)) as unknown as Ramp4, line: shade(m.line, Math.min(0, k)) };
}

/** Light thresholds for the four tones. */
const T_HI = 0.8;
const T_LIGHT = 0.42;
const T_BASE = -0.02;
/** Rim light on upper-left edges, and the dark run on lower-right ones. */
const RIM = 0.3;
const UNDER = 0.22;
/**
 * How much nearer a shape must be than its neighbour inside a part to draw a line between them:
 * different materials (a strap over a coat) part readily, the same one (a lock of hair over the
 * hair behind it) only where it stands well clear.
 */
const EDGE_DEPTH = 0.7;
const EDGE_DEPTH_SAME = 3.2;

export function toneOf(light: number): number {
  return light >= T_HI ? 0 : light >= T_LIGHT ? 1 : light >= T_BASE ? 2 : 3;
}

interface Scratch {
  w: number;
  h: number;
  mat: Uint8Array;
  id: Uint16Array;
  light: Float32Array;
  z: Float32Array;
  touched: Int32Array;
  lined: Uint8Array;
}

const SCRATCH = new Map<string, Scratch>();

function scratch(w: number, h: number): Scratch {
  const key = `${w}x${h}`;
  let s = SCRATCH.get(key);
  if (!s) {
    s = { w, h, mat: new Uint8Array(w * h), id: new Uint16Array(w * h), light: new Float32Array(w * h), z: new Float32Array(w * h), touched: new Int32Array(w * h), lined: new Uint8Array(w * h) };
    SCRATCH.set(key, s);
  }
  return s;
}

/**
 * Scan-converts a polygon: calls `cb` for every pixel whose centre is inside it (even-odd rule).
 */
export function scanPoly(pts: readonly Vec[], w: number, h: number, cb: (x: number, y: number) => void): void {
  if (pts.length < 3) return;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of pts) {
    if (p[1] < yMin) yMin = p[1];
    if (p[1] > yMax) yMax = p[1];
  }
  const y0 = Math.max(0, Math.floor(yMin));
  const y1 = Math.min(h - 1, Math.ceil(yMax));
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i] as Vec;
      const b = pts[j] as Vec;
      if (a[1] > cy !== b[1] > cy) xs.push(a[0] + ((cy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil((xs[k] as number) - 0.5));
      const xb = Math.min(w - 1, Math.floor((xs[k + 1] as number) - 0.5));
      for (let x = xa; x <= xb; x++) cb(x, y);
    }
  }
}

/**
 * One part being painted. Only one part is open at a time (they share a scratch buffer):
 * `begin`, add shapes, `commit`.
 */
export class Part {
  private s: Scratch;
  private mats: Mat[] = [];
  private n = 0;
  constructor(
    readonly c: Canvas,
    readonly cam: Camera,
    /** Records which part painted each pixel (for effects that must stay on one part). */
    readonly owner?: { buf: Int16Array; id: number },
  ) {
    this.s = scratch(c.w, c.h);
  }

  private matIndex(m: Mat): number {
    let i = this.mats.indexOf(m);
    if (i < 0) {
      i = this.mats.length;
      this.mats.push(m);
    }
    return i + 1;
  }

  /** Is this pixel already in the part? */
  has(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.s.w && y < this.s.h && this.s.mat[y * this.s.w + x] !== 0;
  }

  /** The part's depth at a pixel (-Infinity where empty). */
  zAt(x: number, y: number): number {
    return this.has(x, y) ? (this.s.z[y * this.s.w + x] as number) : -Infinity;
  }

  /** The shape id at a pixel (-1 where empty). */
  idAt(x: number, y: number): number {
    return this.has(x, y) ? (this.s.id[y * this.s.w + x] as number) : -1;
  }

  /** Adjusts the light at a pixel already in the part (cast shadows). */
  darken(x: number, y: number, k: number): void {
    if (!this.has(x, y)) return;
    const i = y * this.s.w + x;
    this.s.light[i] = (this.s.light[i] as number) - k;
  }

  /** When set, only pixels it accepts are painted (a blade sunk into the ground). */
  clip: ((x: number, y: number) => boolean) | null = null;

  /** Sets one pixel, unless a nearer one of this part is there. `z` is depth toward the viewer. */
  plot(x: number, y: number, m: Mat, light: number, z = 0, id = 0, force = false): void {
    x = Math.floor(x);
    y = Math.floor(y);
    const s = this.s;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
    if (this.clip && !this.clip(x, y)) return;
    const i = y * s.w + x;
    if (s.mat[i] === 0) s.touched[this.n++] = i;
    else if (!force && (s.z[i] as number) > z) return;
    s.mat[i] = this.matIndex(m);
    s.light[i] = light + (m.bias ?? 0);
    s.z[i] = z;
    s.id[i] = id;
  }

  /** A polygon of one material; light and depth may vary across it. */
  poly(pts: readonly Vec[], m: Mat, light: number | ((x: number, y: number) => number), z: number | ((x: number, y: number) => number) = 0, id = 0): this {
    scanPoly(pts, this.s.w, this.s.h, (x, y) => this.plot(x, y, m, typeof light === 'number' ? light : light(x, y), typeof z === 'number' ? z : z(x, y), id));
    return this;
  }

  /**
   * A limb: a segment from a to b, ra wide at a and rb at b, rounded at the ends, shaded as a
   * cylinder lit from the upper left. `za`/`zb` are the ends' depths.
   */
  capsule(a: Vec, b: Vec, ra: number, rb: number, m: Mat, bias = 0, za = 0, zb = 0, id = 0): this {
    const r = Math.max(ra, rb);
    const s = this.s;
    const xA = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r - 1));
    const xB = Math.min(s.w - 1, Math.ceil(Math.max(a[0], b[0]) + r + 1));
    const yA = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r - 1));
    const yB = Math.min(s.h - 1, Math.ceil(Math.max(a[1], b[1]) + r + 1));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy || 1;
    for (let y = yA; y <= yB; y++) {
      for (let x = xA; x <= xB; x++) {
        const px = x + 0.5 - a[0];
        const py = y + 0.5 - a[1];
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
        const ex = px - dx * t;
        const ey = py - dy * t;
        const rr = ra + (rb - ra) * t;
        const d2 = ex * ex + ey * ey;
        if (d2 > rr * rr) continue;
        const nz = Math.sqrt(Math.max(0, 1 - d2 / (rr * rr)));
        const light = (ex / rr) * LIGHT[0] - (ey / rr) * LIGHT[1] + nz * LIGHT[2];
        this.plot(x, y, m, light + bias, za + (zb - za) * t + nz * rr * 0.8, id);
      }
    }
    return this;
  }

  /** An ellipse shaded as a dome. */
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Mat, bias = 0, z = 0, id = 0): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const nx = (x + 0.5 - cx) / Math.max(0.5, rx);
        const ny = (y + 0.5 - cy) / Math.max(0.5, ry);
        const d2 = nx * nx + ny * ny;
        if (d2 > 1) continue;
        const nz = Math.sqrt(1 - d2);
        this.plot(x, y, m, nx * LIGHT[0] - ny * LIGHT[1] + nz * LIGHT[2] + bias, z + nz * Math.min(rx, ry) * 0.8, id);
      }
    }
    return this;
  }

  /** A one-pixel line (edges, seams, straps). */
  line(a: Vec, b: Vec, m: Mat, light: number, z = 0, id = 0, force = false): this {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
    for (let i = 0; i <= n; i++) this.plot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, m, light, z, id, force);
    return this;
  }

  /**
   * Ray-casts ellipsoids given in a frame (each `c` and radii `r` in the frame's own axes) through
   * the camera. `shade` picks the material for a hit, or null to cut the surface away there (the
   * ray then tries the inside of the far wall: an open collar shows its lining).
   */
  blobs(fr: Frame3, list: readonly Blob[], shade: (h: Hit) => { m: Mat; light?: number; id?: number } | null): this {
    const cam = this.cam;
    const s = this.s;
    // A pixel's ray in frame coordinates: origin o0 + x * ex + y * ey, direction d.
    const toF = (w: V3, point: boolean): V3 => {
      const l = cam.local(w);
      const p = point ? sub3(l, fr.o) : l;
      return [dot3(p, fr.f), dot3(p, fr.u), dot3(p, fr.r)];
    };
    const o0 = toF([0.5 - cam.ax, cam.ay - 0.5, 0], true);
    const ex0 = toF([1, 0, 0], false);
    const ey0 = toF([0, -1, 0], false);
    const d = toF([0, DEPTH, 1], false);
    for (const b of list) {
      // Screen bounds of the ellipsoid's box.
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (let k = 0; k < 8; k++) {
        const p = cam.proj(atFrame(fr, b.c[0] + (k & 1 ? b.r[0] : -b.r[0]), b.c[1] + (k & 2 ? b.r[1] : -b.r[1]), b.c[2] + (k & 4 ? b.r[2] : -b.r[2])));
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      }
      const xa = Math.max(0, Math.floor(x0) - 1);
      const xb = Math.min(s.w - 1, Math.ceil(x1) + 1);
      const ya = Math.max(0, Math.floor(y0) - 1);
      const yb = Math.min(s.h - 1, Math.ceil(y1) + 1);
      const [rf, ru, rr] = b.r;
      const dd: V3 = [d[0] / rf, d[1] / ru, d[2] / rr];
      const a = dot3(dd, dd);
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const of: V3 = [o0[0] + ex0[0] * x + ey0[0] * y, o0[1] + ex0[1] * x + ey0[1] * y, o0[2] + ex0[2] * x + ey0[2] * y];
          const oo: V3 = [(of[0] - b.c[0]) / rf, (of[1] - b.c[1]) / ru, (of[2] - b.c[2]) / rr];
          const bb = dot3(oo, dd);
          const cc = dot3(oo, oo) - 1;
          const disc = bb * bb - a * cc;
          if (disc < 0) continue;
          const sq = Math.sqrt(disc);
          for (const back of [false, true]) {
            const t = back ? (-bb - sq) / a : (-bb + sq) / a;
            const p: V3 = [of[0] + d[0] * t, of[1] + d[1] * t, of[2] + d[2] * t];
            let n: V3 = [(p[0] - b.c[0]) / (rf * rf), (p[1] - b.c[1]) / (ru * ru), (p[2] - b.c[2]) / (rr * rr)];
            const nl = Math.sqrt(dot3(n, n)) || 1;
            n = back ? [-n[0] / nl, -n[1] / nl, -n[2] / nl] : [n[0] / nl, n[1] / nl, n[2] / nl];
            const hit = shade({ p, n, blob: b, back });
            if (!hit) continue;
            const light = hit.light ?? cam.light(dirIn(fr, n[0], n[1], n[2]));
            // World depth of the hit: the ray's parameter is its depth toward the viewer.
            this.plot(x, y, hit.m, light, t, hit.id ?? b.id);
            break;
          }
        }
      }
    }
    return this;
  }

  /** Paints the part onto the canvas and clears the scratch buffer. */
  commit(opts: { rim?: boolean; lines?: boolean } = {}): void {
    const { c } = this;
    const s = this.s;
    const w = s.w;
    const rim = opts.rim !== false;
    const lines = opts.lines !== false;
    const mats = this.mats;
    const own = this.owner;
    const set = (i: number, col: RGB): void => {
      if (own) own.buf[i] = own.id;
      c.data[i * 4] = col[0];
      c.data[i * 4 + 1] = col[1];
      c.data[i * 4 + 2] = col[2];
      c.data[i * 4 + 3] = 255;
    };
    const opaque = (i: number): boolean => (c.data[i * 4 + 3] as number) > 0;
    const nb = [-1, 1, -w, w];
    // Lines over what lies behind, in the part's own dark hue.
    if (lines) {
      for (let k = 0; k < this.n; k++) {
        const i = s.touched[k] as number;
        const m = mats[(s.mat[i] as number) - 1] as Mat;
        if (m.flat) continue;
        const x = i % w;
        for (let q = 0; q < 4; q++) {
          if ((q === 0 && x === 0) || (q === 1 && x === w - 1)) continue;
          const j = i + (nb[q] as number);
          if (j < 0 || j >= s.mat.length || s.mat[j] !== 0 || !opaque(j)) continue;
          set(j, m.line);
        }
      }
    }
    // Lines inside the part where a nearer shape passes in front of another.
    for (let k = 0; k < this.n; k++) {
      const i = s.touched[k] as number;
      s.lined[i] = 0;
      if (!lines || (mats[(s.mat[i] as number) - 1] as Mat).flat) continue;
      const x = i % w;
      for (let q = 0; q < 4; q++) {
        if ((q === 0 && x === 0) || (q === 1 && x === w - 1)) continue;
        const j = i + (nb[q] as number);
        if (j < 0 || j >= s.mat.length || s.mat[j] === 0 || s.id[j] === s.id[i]) continue;
        const mj = mats[(s.mat[j] as number) - 1] as Mat;
        if (mj.flat || (s.z[j] as number) <= (s.z[i] as number) + (s.mat[j] === s.mat[i] ? EDGE_DEPTH_SAME : EDGE_DEPTH)) continue;
        set(i, mj.line);
        s.lined[i] = 1;
        break;
      }
    }
    // Four-tone fill.
    for (let k = 0; k < this.n; k++) {
      const i = s.touched[k] as number;
      if (s.lined[i]) continue;
      const m = mats[(s.mat[i] as number) - 1] as Mat;
      let l = s.light[i] as number;
      if (rim && !m.flat) {
        const x = i % w;
        const out = (j: number, edge: boolean): boolean => edge || j < 0 || j >= s.mat.length || s.mat[j] === 0;
        if (out(i - w, false) || out(i - 1, x === 0)) l += RIM;
        else if (out(i + w, false) || out(i + 1, x === w - 1)) l -= UNDER;
      }
      set(i, m.tones[toneOf(l)] as RGB);
    }
    for (let k = 0; k < this.n; k++) s.mat[s.touched[k] as number] = 0;
    this.n = 0;
    this.mats = [];
  }
}

/** An ellipsoid in a frame's own axes. */
export interface Blob {
  c: V3;
  r: V3;
  id: number;
  /** Free for the shader (which piece of the solid this is). */
  tag?: string;
}

/** Where a ray met a blob: point and normal in the frame's axes. `back`: the inside of the far wall. */
export interface Hit {
  p: V3;
  n: V3;
  blob: Blob;
  back: boolean;
}

const atFrame = (fr: Frame3, f: number, u: number, r: number): V3 => [
  fr.o[0] + fr.f[0] * f + fr.u[0] * u + fr.r[0] * r,
  fr.o[1] + fr.f[1] * f + fr.u[1] * u + fr.r[1] * r,
  fr.o[2] + fr.f[2] * f + fr.u[2] * u + fr.r[2] * r,
];
