/**
 * Outfit pieces any chibi hero can wear, each built from a design's numbers: layered shoulder
 * plates, a high open collar (painted with the head), and a skirt of cloth panels (a coat's front
 * panels and split tails, a robe, a tabard) that hang from the hips, drape over the legs and stream,
 * ripple, flare and lift with the pose's wind.
 */
import type { HeadPiece, Piece, PieceContext } from './design.js';
import { dim, type Hit, type Mat } from './raster.js';
import { add3, at3, clamp, cross3, dirIn, dot3, type Frame3, lerp, mul3, norm3, rad, rotate, sub3, type V3 } from './rig.js';
import type { Vec } from '../skeleton.js';

// ── Shoulder plates ──────────────────────────────────────────────────────────────────────────

export interface PlatesSpec {
  /** 1 his right shoulder, -1 his left. */
  side: 1 | -1;
  /** Plates from the top down, in the shoulder's frame: [forward, up, outward] centres and radii. */
  plates: readonly { c: V3; r: V3 }[];
  mat: Mat;
  /** The plates' lower rims. */
  rim: Mat;
  /** Below this share of a plate's height (from its centre, -1 to 1) it is cut away. */
  cut?: number;
}

/** Layered plates over a shoulder: they tip outward as the arm rises. */
export function plates(spec: PlatesSpec): Piece {
  return (ctx: PieceContext) => {
    const { rig } = ctx;
    const side = spec.side;
    const arm = side === 1 ? rig.armR : rig.armL;
    const upper = norm3(sub3(arm.mid, arm.root));
    // How far the upper arm has risen from hanging (0) toward level (1) and beyond.
    const rise = clamp((dot3(upper, rig.chest.u) + 1) / 1.4, 0, 1.3);
    const swing = dot3(upper, rig.chest.f);
    const base: Frame3 = { o: arm.root, f: rig.chest.f, u: rig.chest.u, r: mul3(rig.chest.r, side) };
    const fr = rotate(base, swing * -18, rise * 55);
    const cut = spec.cut ?? -0.15;
    const tip = at3(fr, 0, 0, 4);
    return [
      {
        z: ctx.depth(tip) + ctx.upper + 0.5,
        draw: () => {
          const part = ctx.part();
          spec.plates.forEach((pl, i) => {
            part.blobs(fr, [{ c: pl.c, r: pl.r, id: 40 + i }], (h: Hit) => {
              const k = (h.p[1] - pl.c[1]) / pl.r[1];
              if (k < cut) return null;
              // The inner face toward the body stays hidden.
              if ((h.p[2] - pl.c[2]) / pl.r[2] < -0.55) return null;
              if (h.back) return { m: spec.mat, light: -0.9 };
              return { m: k < cut + 0.22 ? spec.rim : spec.mat };
            });
          });
          part.commit();
        },
      },
    ];
  };
}

// ── A high collar ────────────────────────────────────────────────────────────────────────────

export interface CollarSpec {
  outer: Mat;
  lining: Mat;
  /** The collar's shape: an ellipsoid shell in the chest frame (centre at its top edge). */
  c: V3;
  r: V3;
  /** Its bottom (chest-frame height) and how high its top edge stands at the back, sides and front edges. */
  bottom: number;
  top: { back: number; side: number; front: number };
  /** The opening at the front, in degrees either side of the middle. */
  open: number;
}

/** A high collar, open at the front and lined, painted with the head so they sort pixel by pixel. */
export function collar(spec: CollarSpec): HeadPiece {
  return {
    blobs: (ctx) => [
      {
        frame: ctx.rig.chest,
        blobs: [{ c: spec.c, r: spec.r, id: 30 }],
        shade: (h: Hit) => {
          const p = h.p;
          const yaw = Math.abs((Math.atan2(p[2] - spec.c[2], p[0] - spec.c[0]) * 180) / Math.PI);
          if (yaw < spec.open) return null;
          const k = (yaw - spec.open) / (180 - spec.open);
          const top = k < 0.5 ? lerp(spec.top.front, spec.top.side, k * 2) : lerp(spec.top.side, spec.top.back, (k - 0.5) * 2);
          if (p[1] > top || p[1] < spec.bottom) return null;
          // A pale-edged rim along the top.
          if (h.back) return { m: spec.lining, id: 31 };
          return { m: p[1] > top - 1.1 ? dim(spec.outer, 0.12) : spec.outer };
        },
      },
    ],
  };
}

// ── Cloth panels ─────────────────────────────────────────────────────────────────────────────

export interface Panel {
  /** Where it hangs from, in degrees around the waist (0 the front, 90 his right, 180 the back). */
  from: number;
  to: number;
  /** Its length, how ragged its hem is (pixels), and how it narrows (<1) or widens (>1) to the hem. */
  len: number;
  jag?: number;
  taper?: number;
  /** How far it kicks out backward at rest (coat tails standing off the back), on top of the skirt's A-line. */
  kick?: number;
}

export interface SkirtSpec {
  outer: Mat;
  inner: Mat;
  /** The ring it hangs from: height in the pelvis frame and radii [forward, right]. */
  waist: number;
  ring: readonly [number, number];
  panels: readonly Panel[];
  /** How much the panels flare out from the hips at rest. */
  aline?: number;
  /**
   * Streaming in the wind, how far a panel fans open top to bottom (the part of it further round
   * toward his back flies higher), so tails show their breadth side on rather than trailing as
   * ribbons.
   */
  fan?: number;
  /** How readily the panels stream in the wind (1 normal). */
  give?: number;
  /** Fold lines on the outside, in a darker hue. */
  folds?: boolean;
}

const COLS = 4;
const ROWS = 7;

/** A tiny seeded hash in [0, 1). */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A skirt of cloth panels: each its own item, sorted by depth around the legs. */
export function skirt(spec: SkirtSpec): Piece {
  return (ctx: PieceContext) => {
    const { rig, pose, cam } = ctx;
    const pf = rig.pelvis;
    const wind = clamp(pose.wind ?? 0, 0, 1.3) * (spec.give ?? 1);
    const lift = pose.lift ?? 0;
    const flare = pose.flare ?? 0;
    const sway = pose.sway ?? 0;
    const phase = (pose.phase ?? 0) * Math.PI * 2;
    const down: V3 = [0, -1, 0];
    const windDir = norm3([-1, 0.06 + lift * 0.5, sway * 0.5]);
    const fan = spec.fan ?? 0.8;
    const items = spec.panels.map((pn, pi) => {
      const grid: V3[][] = [];
      const backMid = -Math.cos(rad((pn.from + pn.to) / 2));
      for (let k = 0; k <= COLS; k++) {
        const phi = rad(lerp(pn.from, pn.to, k / COLS));
        const backness = -Math.cos(phi) - backMid;
        const out = norm3(dirIn(pf, Math.cos(phi), 0, Math.sin(phi)));
        const top = at3(pf, Math.cos(phi) * spec.ring[0], spec.waist, Math.sin(phi) * spec.ring[1]);
        // Front panels drape over the thigh on their side.
        const leg = Math.sin(phi) >= 0 ? rig.legR : rig.legL;
        const thigh = norm3(sub3(leg.mid, leg.root));
        const front = clamp(Math.cos(phi), 0, 1) * clamp(Math.abs(Math.sin(phi)) * 1.6, 0.3, 1);
        let d0 = norm3(add3(add3(add3(down, out, spec.aline ?? 0.3), dirIn(pf, -1, 0, 0), pn.kick ?? 0), thigh, front * 0.9));
        const col: V3[] = [top];
        let p = top;
        const seg = pn.len / ROWS;
        for (let j = 1; j <= ROWS; j++) {
          const t = j / ROWS;
          const bend = clamp(wind * (0.3 + 0.75 * t), 0, 1);
          let d = norm3(add3(mul3(d0, 1 - bend), windDir, bend));
          d = add3(d, [0, 1, 0], backness * fan * bend * 1.2);
          d = add3(d, out, flare * (0.6 + t));
          d = add3(d, [0, 1, 0], Math.max(0, lift) * t * 0.9);
          d = add3(d, [0, 0, 1], sway * 0.35 * t);
          d = norm3(d);
          // A ripple running down the cloth, stronger toward the hem and in the wind.
          const wave = Math.sin(phase * 1 - j * 1.05 + k * 0.8 + pi * 1.7) * (0.35 + wind * 1.3 + flare) * t;
          const across = norm3(cross3(d, out));
          const normal = norm3(cross3(across, d));
          p = add3(add3(p, d, seg), add3(mul3(normal, wave * 0.55), across, wave * 0.18 * (k - COLS / 2)));
          // Taper: pull the panel's columns toward its middle (or spread them) down its length.
          col.push(p);
          if (j === 1) d0 = d;
        }
        grid.push(col);
      }
      // Narrow or widen toward the hem.
      if ((pn.taper ?? 1) !== 1) {
        for (let j = 1; j <= ROWS; j++) {
          const mid = lerp3s(grid.map((c) => c[j] as V3));
          for (const c of grid) c[j] = add3(mid, sub3(c[j] as V3, mid), lerp(1, pn.taper ?? 1, j / ROWS));
        }
      }
      // Keep cloth above the floor.
      for (const c of grid) for (let j = 0; j < c.length; j++) if ((c[j] as V3)[1] < 0.6) c[j] = [(c[j] as V3)[0], 0.6, (c[j] as V3)[2]];
      const mid = grid[COLS >> 1]?.[ROWS >> 1] as V3;
      const topMid = grid[COLS >> 1]?.[0] as V3;
      return {
        z: ctx.depth(topMid) * 0.55 + ctx.depth(mid) * 0.45,
        draw: () => drawPanel(ctx, spec, pn, pi, grid),
      };
    });
    void cam;
    return items;
  };
}

const lerp3s = (pts: V3[]): V3 => {
  let s: V3 = [0, 0, 0];
  for (const p of pts) s = add3(s, p);
  return mul3(s, 1 / Math.max(1, pts.length));
};

function drawPanel(ctx: PieceContext, spec: SkirtSpec, pn: Panel, pi: number, grid: V3[][]): void {
  const { cam } = ctx;
  const part = ctx.part();
  const P = grid.map((c) => c.map((p) => ctx.proj(p)));
  const jag = pn.jag ?? 0;
  for (let k = 0; k < COLS; k++) {
    for (let j = 0; j < ROWS; j++) {
      const a = (grid[k] as V3[])[j] as V3;
      const b = (grid[k + 1] as V3[])[j] as V3;
      const c = (grid[k + 1] as V3[])[j + 1] as V3;
      const d = (grid[k] as V3[])[j + 1] as V3;
      // Outward normal: across the panel (k grows anticlockwise seen from above) and down it.
      let n = norm3(cross3(sub3(d, a), sub3(b, a)));
      const outward = sub3(lerp3s([a, b, c, d]), ctx.rig.pelvis.o);
      if (dot3(n, [outward[0], 0, outward[2]]) < 0) n = mul3(n, -1);
      const facing = cam.facing(n);
      const inside = facing < 0;
      const m = inside ? spec.inner : spec.outer;
      const light = inside ? cam.light(mul3(n, -1)) - 0.25 : cam.light(n);
      const quad: Vec[] = [(P[k] as Vec[])[j] as Vec, (P[k + 1] as Vec[])[j] as Vec, (P[k + 1] as Vec[])[j + 1] as Vec, (P[k] as Vec[])[j + 1] as Vec];
      // A ragged hem: teeth hang below the last row.
      if (j === ROWS - 1 && jag > 0) {
        const cut = (q: number): number => jag * (0.55 + hash(pi * 31 + k * 7 + q, 3) * 0.9);
        const dirA = norm3(sub3(d, a));
        const dirB = norm3(sub3(c, b));
        const tipK = add3(lerp3(c, d, 0.5), norm3(add3(dirA, dirB)), cut(0) * 1.1);
        const notch = lerp3(c, d, 0.5);
        // Teeth lying on the floor stay on it.
        const floor = (p: V3): Vec => ctx.proj(p[1] < 0.3 ? [p[0], 0.3, p[2]] : p);
        const pd = floor(add3(d, dirA, cut(1) * (k === 0 ? 0.4 : 0.7)));
        const pc = floor(add3(c, dirB, cut(2) * (k === COLS - 1 ? 0.4 : 0.5)));
        quad.splice(2, 2, pc, floor(add3(notch, dirA, -0.5)), floor(tipK), floor(lerp3(notch, d, 0.4)), pd);
      }
      const z = ctx.depth(lerp3s([a, b, c, d]));
      part.poly(quad, m, light, z, 50 + pi * 2 + (inside ? 1 : 0));
    }
  }
  // Fold lines down the outside, in the cloth's shadow tone.
  if (spec.folds) {
    for (let k = 1; k < COLS; k += 2) {
      for (let j = 1; j < ROWS; j++) {
        const a = (grid[k] as V3[])[j] as V3;
        const b = (grid[k] as V3[])[j + 1] as V3;
        const n = norm3(cross3(sub3(b, a), sub3((grid[k + 1] as V3[])[j] as V3, a)));
        void n;
        const pa = (P[k] as Vec[])[j] as Vec;
        const pb = (P[k] as Vec[])[j + 1] as Vec;
        const z = ctx.depth(lerp3(a, b, 0.5)) + 0.05;
        const n2 = Math.max(1, Math.ceil(Math.max(Math.abs(pb[0] - pa[0]), Math.abs(pb[1] - pa[1]))));
        for (let i = 0; i <= n2; i++) {
          const x = Math.floor(pa[0] + ((pb[0] - pa[0]) * i) / n2);
          const y = Math.floor(pa[1] + ((pb[1] - pa[1]) * i) / n2);
          const id = part.idAt(x, y);
          if (id === 50 + pi * 2 && part.zAt(x, y) <= z + 0.6) part.plot(x, y, spec.outer, -0.9, z, id, true);
        }
      }
    }
  }
  part.commit();
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
