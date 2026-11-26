/**
 * Outfit pieces any chibi hero can wear, each built from a design's numbers: layered shoulder
 * plates, a high open collar (painted with the head), and a skirt of cloth panels (a coat's front
 * panels and split tails, a robe, a tabard) that hang from the hips, drape over the legs and stream,
 * ripple, flare and lift with the pose's wind.
 */
import type { HeadPiece, Piece, PieceContext } from './design.js';
import { dim, type Hit, type Mat, toneLight } from './raster.js';
import { add3, at3, clamp, cross3, dirIn, dot3, type Frame3, lerp, mul3, norm3, rad, rotate, sub3, TO_CAMERA, type V3 } from './rig.js';
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
              return { m: k < cut + 0.3 ? spec.rim : spec.mat };
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
  /** Its length, how deep the fork in its hem is (pixels: a swallowtail, its corners hanging longer than its middle), and how it narrows (<1) or widens (>1) to the hem. */
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
  /**
   * Folds: the cloth is pleated across its width, a little deeper toward the hem, so it shades in
   * bands two or three pixels wide (lit folds and shaded ones) with a short crease up from the hem
   * in each hollow.
   */
  folds?: boolean;
}

const COLS = 4;
const ROWS = 7;
/** How deep the pleats of a folded panel are at its hem (pixels). */
const PLEAT = 1.3;
/** However a panel turns, it shows at least this breadth on screen: at its top and at its hem. */
const MIN_W: readonly [number, number] = [2.5, 5.5];

/** A tiny seeded hash in [0, 1). */
export function hash(a: number, b = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A skirt of cloth panels: each its own item, sorted by depth around the legs. */
export function skirt(spec: SkirtSpec): Piece {
  return (ctx: PieceContext) => {
    const { rig, pose } = ctx;
    const pf = rig.pelvis;
    const wind = clamp(pose.wind ?? 0, 0, 1.3) * (spec.give ?? 1);
    const lift = pose.lift ?? 0;
    const flare = pose.flare ?? 0;
    const sway = pose.sway ?? 0;
    const phase = (pose.phase ?? 0) * Math.PI * 2;
    const down: V3 = [0, -1, 0];
    const windDir = norm3([-1, 0.06 + lift * 0.5, sway * 0.5]);
    const toCam = norm3(ctx.cam.local(TO_CAMERA));
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
        // Cloth streaming straight at the viewer would fold into a pile of slivers: as a sprite
        // artist would, some of the wind carrying it at the viewer carries it out to its own side
        // instead, so the tails open out.
        let wd = windDir;
        const atCam = dot3(wd, toCam);
        if (atCam > 0) {
          const side = sub3(out, mul3(toCam, dot3(out, toCam)));
          wd = norm3(add3(add3(wd, toCam, -atCam * 0.55), side, atCam * 0.4));
        }
        const col: V3[] = [top];
        let p = top;
        const seg = pn.len / ROWS;
        for (let j = 1; j <= ROWS; j++) {
          const t = j / ROWS;
          const bend = clamp(wind * (0.3 + 0.75 * t), 0, 1);
          let d = norm3(add3(mul3(d0, 1 - bend), wd, bend));
          d = add3(d, [0, 1, 0], backness * fan * bend * 1.2);
          d = add3(d, out, flare * (0.6 + t));
          d = add3(d, [0, 1, 0], Math.max(0, lift) * t * 0.9);
          d = add3(d, [0, 0, 1], sway * 0.35 * t);
          d = norm3(d);
          // A ripple running down the cloth, stronger toward the hem and in the wind.
          const wave = Math.sin(phase - j * 1.05 + k * 0.8 + pi * 1.7) * (0.8 + wind * 1.2 + flare) * t;
          const across = norm3(cross3(d, out));
          const normal = norm3(cross3(across, d));
          p = add3(add3(p, d, seg), add3(mul3(normal, wave * 0.55), across, wave * 0.18 * (k - COLS / 2)));
          // Pleats: alternate columns stand out and sink in, deeper toward the hem.
          col.push(spec.folds ? add3(p, normal, (k % 2 ? 1 : -1) * PLEAT * (0.3 + 0.7 * t)) : p);
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
  // A panel turned edge on keeps some breadth, as a sprite artist would draw it, rather than
  // thinning to a ribbon: its columns are pushed apart across its run down the screen.
  for (let j = 1; j <= ROWS; j++) {
    const mid = (P[COLS >> 1] as Vec[])[j] as Vec;
    const up = (P[COLS >> 1] as Vec[])[j - 1] as Vec;
    const dl = Math.hypot(mid[0] - up[0], mid[1] - up[1]) || 1;
    const perp: Vec = [-(mid[1] - up[1]) / dl, (mid[0] - up[0]) / dl];
    const a = (P[0] as Vec[])[j] as Vec;
    const b = (P[COLS] as Vec[])[j] as Vec;
    const w = (b[0] - a[0]) * perp[0] + (b[1] - a[1]) * perp[1];
    const want = lerp(MIN_W[0], MIN_W[1], j / ROWS);
    if (Math.abs(w) >= want) continue;
    const grow = (w >= 0 ? want : -want) - w;
    for (let k = 0; k <= COLS; k++) {
      const p = (P[k] as Vec[])[j] as Vec;
      (P[k] as Vec[])[j] = [p[0] + perp[0] * grow * (k / COLS - 0.5), p[1] + perp[1] * grow * (k / COLS - 0.5)];
    }
  }
  // The hem: a clean swallowtail, its corners hanging longer than its middle.
  const fork = pn.jag ?? 0;
  const hem: Vec[] = [];
  for (let k = 0; k <= COLS; k++) {
    const a = (grid[k] as V3[])[ROWS - 1] as V3;
    const b = (grid[k] as V3[])[ROWS] as V3;
    const p = add3(b, norm3(sub3(b, a)), fork * Math.pow(Math.abs((2 * k) / COLS - 1), 1.4));
    const ground = ctx.proj(p[1] < 0.3 ? [p[0], 0.3, p[2]] : p);
    const q = (P[k] as Vec[])[ROWS] as Vec;
    const o = ctx.proj(b);
    // Carry over the widening applied to the last row.
    hem.push([ground[0] + q[0] - o[0], ground[1] + q[1] - o[1]]);
  }
  const outerId = 50 + pi * 2;
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
      // The lining shows only where the cloth clearly turns its inside to the viewer: near edge on
      // it keeps its outside, so a tail streaming at the viewer does not break into patches.
      const facing = cam.facing(n);
      const inside = facing < -0.22;
      const m = inside ? spec.inner : spec.outer;
      const light = inside ? cam.light(mul3(n, -1)) - 0.25 : cam.light(n);
      const last = j === ROWS - 1;
      const quad: Vec[] = [(P[k] as Vec[])[j] as Vec, (P[k + 1] as Vec[])[j] as Vec, last ? (hem[k + 1] as Vec) : ((P[k + 1] as Vec[])[j + 1] as Vec), last ? (hem[k] as Vec) : ((P[k] as Vec[])[j + 1] as Vec)];
      const z = ctx.depth(lerp3s([a, b, c, d]));
      part.poly(quad, m, light, z, outerId + (inside ? 1 : 0));
    }
  }
  // Creases: a short shaded line up from the hem in each hollow of the pleats.
  const mark = (x: number, y: number, tone: number): void => {
    const id = part.idAt(x, y);
    if (id !== outerId && id !== outerId + 1) return;
    const m = id === outerId ? spec.outer : spec.inner;
    part.plot(x, y, m, toneLight(m, tone), part.zAt(x, y), id, true);
  };
  if (spec.folds) {
    for (let k = 2; k < COLS; k += 2) {
      const a = hem[k] as Vec;
      const b = (P[k] as Vec[])[ROWS - 2] as Vec;
      const n2 = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let i = 1; i <= n2; i++) mark(Math.floor(a[0] + ((b[0] - a[0]) * i) / n2), Math.floor(a[1] + ((b[1] - a[1]) * i) / n2), 3);
    }
  }
  // A clean hem line just inside the bottom edge, in the cloth's shadow tone.
  for (let k = 0; k < COLS; k++) {
    const a = hem[k] as Vec;
    const b = hem[k + 1] as Vec;
    const inA = (P[k] as Vec[])[ROWS - 1] as Vec;
    const inB = (P[k + 1] as Vec[])[ROWS - 1] as Vec;
    const n2 = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
    for (let i = 0; i <= n2; i++) {
      const t = i / n2;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      // Half a pixel back up the cloth from the edge.
      const ux = inA[0] + (inB[0] - inA[0]) * t - x;
      const uy = inA[1] + (inB[1] - inA[1]) * t - y;
      const ul = Math.hypot(ux, uy) || 1;
      mark(Math.floor(x + (ux / ul) * 0.7), Math.floor(y + (uy / ul) * 0.7), 3);
    }
  }
  part.commit();
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
