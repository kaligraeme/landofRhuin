/**
 * Outfit pieces any chibi hero can wear, each built from a design's numbers: layered shoulder
 * plates, a high open collar (painted with the head), a skirt of cloth panels (a coat's front
 * panels and split tails, a robe, a tabard) that hang from the hips, drape over the legs and stream,
 * ripple, flare and lift with the pose's wind, a cape hung from the shoulders and a scarf wrapped
 * round the neck with tails that stream behind. Cloth and long hair hang as strands (`strand`)
 * that lie over the body rather than passing through it.
 */
import type { HeadPiece, Piece, PieceContext } from './design.js';
import { type Blob, dim, type Hit, type Mat, toneLight } from './raster.js';
import { add3, at3, type ChibiPose, clamp, cross3, dirIn, dot3, type Frame3, len3, lerp, mul3, norm3, rad, type Rig, rotate, sub3, TO_CAMERA, type V3 } from './rig.js';
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
  const rim = dim(spec.outer, 0.12);
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
          return { m: p[1] > top - 1.1 ? rim : spec.outer };
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
  /** A band of another material along the hem (a gold edge), about two pixels deep. */
  trim?: Mat;
  /**
   * How thick the legs are (their radius and a little clearance): with it, cloth in front of the
   * legs stays in front of them and cloth behind stays behind, so a long robe drapes over a
   * striding knee or a kicked-back heel instead of letting the leg through.
   */
  legs?: number;
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
    // Negative wind flicks the tails forward (a flinch): the same bend, the other way.
    const blow = clamp(pose.wind ?? 0, -0.8, 1.3);
    const wind = Math.abs(blow) * (spec.give ?? 1);
    const lift = pose.lift ?? 0;
    const flare = pose.flare ?? 0;
    const sway = pose.sway ?? 0;
    const phase = (pose.phase ?? 0) * Math.PI * 2;
    const down: V3 = [0, -1, 0];
    const windDir = norm3([blow < 0 ? 1 : -1, 0.06 + lift * 0.5, sway * 0.5]);
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
          if (spec.legs) p = clearLegs(p, rig, pf.f, Math.cos(phi), spec.legs);
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
      let z = ctx.depth(topMid) * 0.55 + ctx.depth(mid) * 0.45;
      // A panel draped over the legs (`legs`) at the front or the back, on the viewer's side of
      // them, goes over both legs (sorted as the painter sorts legs), so a knee or a heel shows
      // through the cloth only as the bulge it makes.
      if (spec.legs && Math.abs(backMid) > 0.5 && ctx.depth(topMid) > ctx.depth(pf.o)) {
        for (const leg of [rig.legR, rig.legL]) z = Math.max(z, ctx.depth(leg.mid) * 0.7 + ctx.depth(leg.root) * 0.3 + 0.05);
      }
      return {
        z,
        draw: () => drawPanel(ctx, spec, pn, pi, grid),
      };
    });
    return items;
  };
}

/**
 * Keeps a point of cloth hanging at `front` (the cosine of its angle round the waist: 1 dead
 * ahead, -1 behind) on its own side of the legs: in front of them for cloth at the front, behind
 * them for cloth at the back, outside a cylinder `r` thick round each thigh and shin. Cloth at
 * the sides is left alone, and the push fades in between.
 */
function clearLegs(p: V3, rig: Rig, forward: V3, front: number, r: number): V3 {
  const w = clamp((Math.abs(front) - 0.25) / 0.35, 0, 1);
  if (w <= 0) return p;
  const F = norm3([forward[0], 0, forward[2]]);
  const sgn = front > 0 ? 1 : -1;
  const flat = (v: V3): V3 => sub3(v, mul3(F, dot3(v, F)));
  let q = p;
  for (const leg of [rig.legR, rig.legL]) {
    for (const [a, b] of [[leg.root, leg.mid], [leg.mid, leg.end]] as const) {
      const pa = flat(sub3(q, a));
      const ab = flat(sub3(b, a));
      const t = clamp(dot3(pa, ab) / (dot3(ab, ab) || 1), 0, 1);
      const off = sub3(pa, mul3(ab, t));
      const d2 = dot3(off, off);
      if (d2 >= r * r) continue;
      const h = Math.sqrt(r * r - d2);
      const fl = dot3(add3(a, sub3(b, a), t), F);
      const fp = dot3(q, F);
      const want = fl + sgn * h;
      if (sgn * (fp - want) < 0) q = add3(q, F, (want - fp) * w);
    }
  }
  return q;
}

const lerp3s = (pts: V3[]): V3 => {
  let s: V3 = [0, 0, 0];
  for (const p of pts) s = add3(s, p);
  return mul3(s, 1 / Math.max(1, pts.length));
};

/**
 * Paints a panel of cloth from its grid of points (columns across it, rows down it). Each quad
 * shows the cloth's outside or, turned to the viewer, its lining; which side is out is judged
 * from the body's axis (a panel round the hips), or from `orient` (the outside's way for each
 * row) for cloth that flies free of the body, such as a scarf's tail.
 */
function drawPanel(ctx: PieceContext, spec: SkirtSpec, pn: Panel, pi: number, grid: V3[][], orient?: (row: number) => V3): void {
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
      if (orient) {
        if (dot3(n, orient(j)) < 0) n = mul3(n, -1);
      } else {
        const outward = sub3(lerp3s([a, b, c, d]), ctx.rig.pelvis.o);
        if (dot3(n, [outward[0], 0, outward[2]]) < 0) n = mul3(n, -1);
      }
      // The lining shows only where the cloth clearly turns its inside to the viewer: near edge on
      // it keeps its outside, so a tail streaming at the viewer does not break into patches.
      const facing = cam.facing(n);
      const inside = facing < -0.22;
      const m = inside ? spec.inner : spec.outer;
      const light = inside ? cam.light(mul3(n, -1)) - 0.25 : cam.light(n);
      const last = j === ROWS - 1;
      const quad: Vec[] = [(P[k] as Vec[])[j] as Vec, (P[k + 1] as Vec[])[j] as Vec, last ? (hem[k + 1] as Vec) : ((P[k + 1] as Vec[])[j + 1] as Vec), last ? (hem[k] as Vec) : ((P[k] as Vec[])[j + 1] as Vec)];
      const z = ctx.depth(lerp3s([a, b, c, d]));
      if (last && spec.trim) {
        // The trim: the bottom two pixels or so of the last row, in its own material.
        const q = quad as [Vec, Vec, Vec, Vec];
        const run = Math.max(1, (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2);
        const t = clamp(1 - 2.2 / run, 0.55, 1);
        const at = (p: Vec, r: Vec): Vec => [p[0] + (r[0] - p[0]) * t, p[1] + (r[1] - p[1]) * t];
        const cutL = at(q[0], q[3]);
        const cutR = at(q[1], q[2]);
        part.poly([q[0], q[1], cutR, cutL], m, light, z, outerId + (inside ? 1 : 0));
        // Its own shape id, so the creases stop at it.
        part.poly([cutL, cutR, q[2], q[3]], spec.trim, light + 0.1, z, outerId + 100);
        continue;
      }
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
  // A clean hem line just inside the bottom edge, in the cloth's shadow tone (a trim is its own edge).
  for (let k = 0; k < COLS && !spec.trim; k++) {
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


// ── Strands: hair and cloth that hang ────────────────────────────────────────────────────────

/** An ellipsoid that hair and cloth lie over rather than pass through: its centre and radii in a frame's own axes. */
export interface Obstacle {
  fr: Frame3;
  c: V3;
  r: V3;
  /** How far clear of it things lie, in place of the strand's own `pad` (hair lies close on the head, further out over the body). */
  pad?: number;
}

/** The torso's ellipsoids (a design's `body.chest` and `body.hips`) as obstacles, in a solved pose. */
export function torsoObstacles(rig: Rig, chest: readonly Blob[], hips: readonly Blob[]): Obstacle[] {
  return [...chest.map((b) => ({ fr: rig.chest, c: b.c, r: b.r })), ...hips.map((b) => ({ fr: rig.pelvis, c: b.c, r: b.r }))];
}

/** Moves a point out of any obstacle it is inside (each grown by its own pad, or else `pad`), straight out from the obstacle's centre. */
export function pushOut(p: V3, obstacles: readonly Obstacle[], pad: number): V3 {
  let q = p;
  for (const o of obstacles) {
    const c = at3(o.fr, o.c[0], o.c[1], o.c[2]);
    const d = sub3(q, c);
    const k = o.pad ?? pad;
    const rf = o.r[0] + k;
    const ru = o.r[1] + k;
    const rr = o.r[2] + k;
    const a = dot3(d, o.fr.f) / rf;
    const b = dot3(d, o.fr.u) / ru;
    const e = dot3(d, o.fr.r) / rr;
    const l = Math.hypot(a, b, e);
    if (l >= 1 || l < 1e-6) continue;
    q = add3(add3(add3(c, o.fr.f, (a / l) * rf), o.fr.u, (b / l) * ru), o.fr.r, (e / l) * rr);
  }
  return q;
}

export interface StrandSpec {
  /** Where it hangs from and which way it leaves there (hero space). */
  root: V3;
  dir: V3;
  len: number;
  /** How many segments (default 8). */
  n?: number;
  /** The share of its length that keeps to `dir` before it falls (default 0.3). */
  stiff?: number;
  /** How readily it streams in the wind (default 1). */
  give?: number;
  /** Sets where the ripple is along it, so strands side by side ripple out of step. */
  seed?: number;
  /** Cloth flicks forward in a negative wind (a flinch thrown back); hair stays put. */
  flick?: boolean;
  /** What it lies over, and how far clear of it. */
  avoid?: readonly Obstacle[];
  pad?: number;
  /** A point on the upright axis a spin's `flare` throws it out from (hero space; default the hero's own axis). */
  axis?: V3;
  /**
   * The way to the viewer (hero space) and the strand's own side (the way out from the body where
   * it hangs). Wind that would carry it straight at the viewer or straight away (where it would
   * shrink to a stub, or hide behind the body) carries it less far that way and a little out to
   * its own side instead, as a sprite artist would draw it, so it shows its length.
   */
  view?: V3;
  side?: V3;
  /**
   * How much higher (+) or lower (-) than the rest it flies as the wind bends it: the middle of a
   * cape flies higher than its sides, so streaming side on it shows its breadth rather than an edge.
   */
  fan?: number;
}

const DOWN: V3 = [0, -1, 0];
const smooth = (x: number): number => x * x * (3 - 2 * x);

/**
 * A strand of hair or a tail of cloth in a pose: its points from root to tip, hero space. It
 * leaves its root along `dir`, then falls, pulled back by the pose's `wind` (more toward its tip),
 * up and out from the body by `lift`, out from the body's axis by `flare` and to a side by `sway`, with a ripple running
 * down it as `phase` advances; each point is moved out of anything it would pass through and kept
 * above the floor. The same pose always gives the same strand, and a small change of pose a small
 * change of strand, so it flows from frame to frame without flickering.
 */
export function strand(pose: ChibiPose, s: StrandSpec): V3[] {
  const n = s.n ?? 8;
  const stiff = s.stiff ?? 0.3;
  const raw = clamp(pose.wind ?? 0, -0.8, 1.3);
  const blow = s.flick ? raw : Math.max(0, raw);
  let wind = Math.abs(blow) * (s.give ?? 1);
  const lift = pose.lift ?? 0;
  const flare = pose.flare ?? 0;
  const sway = pose.sway ?? 0;
  const phase = (pose.phase ?? 0) * Math.PI * 2;
  let windDir = norm3([blow < 0 ? 1 : -1, 0.06 + lift * 0.5, sway * 0.5]);
  if (s.view && s.side) {
    // Level, so that taking it out of the wind neither lifts nor drops the strand.
    const view = norm3([s.view[0], 0, s.view[2]]);
    const at = dot3(windDir, view);
    const k = clamp((Math.abs(at) - 0.5) / 0.5, 0, 1) * Math.abs(at);
    if (k > 0) {
      // What is left of the wind blows less hard, so the strand hangs more.
      const side = sub3(s.side, mul3(view, dot3(s.side, view)));
      const left = add3(add3(windDir, view, -Math.sign(at) * k * 0.8), side, k * 0.4);
      wind *= Math.min(1, len3(left));
      windDir = norm3(left);
    }
  }
  const dir = norm3(s.dir);
  const axis = s.axis ?? [0, 0, 0];
  const seg = s.len / n;
  const pad = s.pad ?? 1;
  // In the wind the root gives way sooner.
  const hold0 = 1 - Math.min(1, wind) * 0.5;
  let p = s.root;
  const pts: V3[] = [p];
  for (let j = 1; j <= n; j++) {
    const t = j / n;
    const hold = stiff > 0 ? (1 - smooth(Math.min(1, t / stiff))) * hold0 : 0;
    const bend = clamp(wind * (0.3 + 0.75 * t), 0, 1);
    let hang = norm3(add3(mul3(DOWN, 1 - bend), windDir, bend));
    const ox = p[0] - axis[0];
    const oz = p[2] - axis[2];
    const ol = Math.hypot(ox, oz) || 1;
    // An updraft floats it up and out from the body, more toward its tip.
    const rise = clamp(Math.max(0, lift) * (0.4 + t) * 0.9, 0, 0.9);
    if (rise > 0) hang = add3(mul3(hang, 1 - rise), norm3([ox / ol, 1.3, oz / ol]), rise);
    hang = add3(hang, [ox / ol, 0, oz / ol], flare * 1.4 * t * t);
    hang = add3(hang, [0, 0, 1], sway * 0.35 * t);
    if (s.fan) hang = add3(norm3(hang), [0, 1, 0], s.fan * bend * 1.2);
    const d = norm3(add3(mul3(dir, hold), norm3(hang), 1 - hold));
    // A ripple across it and in and out, stronger toward the tip and in the wind.
    const wave = Math.sin(phase - j * 1.05 + (s.seed ?? 0)) * (0.35 + wind * 1.2 + flare) * t;
    let across = sub3([0, 0, 1], mul3(d, d[2]));
    across = Math.hypot(across[0], across[1], across[2]) < 0.2 ? norm3(cross3(d, [1, 0, 0])) : norm3(across);
    const normal = norm3(cross3(across, d));
    let q = add3(add3(p, d, seg), add3(mul3(normal, wave * 0.55), across, wave * 0.3));
    if (s.avoid) {
      // Out of the way, then back to its length along the new way, so it slides over the body
      // rather than bunching up against it.
      q = pushOut(q, s.avoid, pad);
      q = pushOut(add3(p, norm3(sub3(q, p)), seg), s.avoid, pad);
    }
    if (q[1] < 0.6) q = [q[0], 0.6, q[2]];
    pts.push(q);
    p = q;
  }
  return pts;
}

// ── A cape ───────────────────────────────────────────────────────────────────────────────────

export interface CapeSpec {
  outer: Mat;
  inner: Mat;
  /**
   * Where it hangs from: a ring in the chest frame at height `top` (about the shoulders' line, a
   * little under the base of the neck) with radii [forward, right], from `from` to `to` degrees
   * round it (as a skirt's panels: 90 his right, 180 the back, 270 his left; keep to the back of
   * the shoulders so it hangs behind the arms).
   */
  top: number;
  ring: readonly [number, number];
  from: number;
  to: number;
  /** Its length (to the waist about 20, to the knee about 40), the fork in its hem, and how it widens (>1) to the hem. */
  len: number;
  jag?: number;
  taper?: number;
  /** Split into this many panels side by side (default 1: one sheet). */
  panels?: number;
  /** How readily it streams (default 0.9) and whether it is pleated (see SkirtSpec). */
  give?: number;
  folds?: boolean;
  /** A band of another material along its hem (a gold edge). */
  trim?: Mat;
  /** What it lies over (usually the design's `body.chest` and `body.hips`) and how far clear (default 1). */
  over: { chest: readonly Blob[]; hips: readonly Blob[]; pad?: number };
}

/**
 * A cape hung from the shoulders: a sheet of cloth (or a few panels) down the back that lies over
 * the back and shoulders, hangs behind the arms, and streams, ripples, flares and lifts with the
 * pose's cloth fields as the coat's tails do. It sorts with the upper body.
 */
export function cape(spec: CapeSpec): Piece {
  const count = Math.max(1, spec.panels ?? 1);
  const span = (spec.to - spec.from) / count;
  const panels: Panel[] = Array.from({ length: count }, (_, i) => ({ from: spec.from + span * i, to: spec.from + span * (i + 1), len: spec.len, jag: spec.jag, taper: spec.taper }));
  const look: SkirtSpec = { outer: spec.outer, inner: spec.inner, waist: spec.top, ring: spec.ring, panels, folds: spec.folds, trim: spec.trim };
  return (ctx: PieceContext) => {
    const { rig, pose } = ctx;
    const cf = rig.chest;
    const avoid = torsoObstacles(rig, spec.over.chest, spec.over.hips);
    const pad = spec.over.pad ?? 1;
    const view = norm3(ctx.cam.local(TO_CAMERA));
    return panels.map((pn, pi) => {
      const grid: V3[][] = [];
      for (let k = 0; k <= COLS; k++) {
        const phi = rad(lerp(pn.from, pn.to, k / COLS));
        const top = at3(cf, Math.cos(phi) * spec.ring[0], spec.top, Math.sin(phi) * spec.ring[1]);
        // It leaves the shoulders falling back and a little out over the shoulder blades.
        const out = dirIn(cf, Math.cos(phi), 0, Math.sin(phi));
        const dir = add3(add3(dirIn(cf, 0, -1, 0), out, 0.35), dirIn(cf, -1, 0, 0), 0.15);
        // Streaming, its middle flies higher than its sides (as a skirt panel's back does).
        const fan = (-Math.cos(phi) - 1) * 0.9;
        grid.push(strand(pose, { root: top, dir, len: spec.len, n: ROWS, stiff: 0.2, give: spec.give ?? 0.9, seed: k * 0.8 + pi * 1.7, flick: true, avoid, pad, axis: rig.pelvis.o, view, side: out, fan }));
      }
      widen(grid, pn.taper ?? 1);
      const mid = grid[COLS >> 1]?.[ROWS >> 1] as V3;
      const topMid = grid[COLS >> 1]?.[0] as V3;
      return {
        z: ctx.depth(topMid) * 0.4 + ctx.depth(mid) * 0.6 + ctx.upper,
        draw: () => drawPanel(ctx, look, pn, 20 + pi, grid),
      };
    });
  };
}

/** Narrows (<1) or widens (>1) a panel's grid toward its hem. */
function widen(grid: V3[][], taper: number): void {
  if (taper === 1) return;
  for (let j = 1; j <= ROWS; j++) {
    const mid = lerp3s(grid.map((c) => c[j] as V3));
    for (const c of grid) c[j] = add3(mid, sub3(c[j] as V3, mid), lerp(1, taper, j / ROWS));
  }
}

// ── A scarf ──────────────────────────────────────────────────────────────────────────────────

export interface ScarfSpec {
  /** The cloth, and its underside where a tail turns over (default the cloth a little darker). */
  mat: Mat;
  inner?: Mat;
  /**
   * The wrap round the neck: the height of its middle in the chest frame (a little over the base
   * of the neck), its radii [forward, right] and its half-height. `muffle` raises its front (a
   * share of its height) so that side on it hides the lower jaw a little.
   */
  wrap: { u: number; r: readonly [number, number]; h: number; muffle?: number };
  /** Where the knot sits, in degrees round the neck (180 the back, 200 a little to his left). */
  knot: number;
  /** Its tails, hanging from the knot: length and half-width; `fork` cuts a swallowtail into the end. */
  tails: readonly { len: number; w: number; fork?: number }[];
  /** How readily the tails stream (default 1.1: a light cloth). */
  give?: number;
  /** What the tails lie over (usually the design's `body.chest` and `body.hips`). */
  over: { chest: readonly Blob[]; hips: readonly Blob[]; pad?: number };
}

/**
 * A scarf: a thick wrap round the neck, painted with the head (`wrap`, for the design's
 * headPieces) so it hides the neck and a little of the jaw pixel by pixel, folded in diagonal
 * bands with a knot behind; and its tails (`tails`, for the outfit), cloth ribbons that hang from
 * the knot and stream behind in the wind, ripple, flare and lift.
 */
export function scarf(spec: ScarfSpec): { wrap: HeadPiece; tails: Piece } {
  const w = spec.wrap;
  const kn = rad(spec.knot);
  const knotAt: V3 = [Math.cos(kn) * w.r[0] * 0.95, w.u - w.h * 0.2, Math.sin(kn) * w.r[1] * 0.95];
  const wrap: HeadPiece = {
    blobs: (ctx) => {
      const shade = (h: Hit): { m: Mat; light: number } | null => {
        if (h.back) return null;
        const l = ctx.cam.light(dirIn(ctx.rig.chest, h.n[0], h.n[1], h.n[2]));
        // Diagonal folds round the wrap: a shaded crease every so often.
        const yaw = (Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI;
        const band = (((yaw / 50 + (h.p[1] - w.u) / 2.6) % 1) + 1) % 1;
        return { m: spec.mat, light: band < 0.2 ? Math.min(l, 0.1) - 0.35 : band < 0.45 ? l + 0.25 : l };
      };
      const blobs: Blob[] = [{ c: [0.6, w.u, 0], r: [w.r[0], w.h, w.r[1]], id: 60 }];
      if (w.muffle) blobs.push({ c: [1.2, w.u + w.h * w.muffle, 0], r: [w.r[0] * 0.92, w.h * 0.75, w.r[1] * 0.9], id: 61 });
      blobs.push({ c: knotAt, r: [2.4, 2.4, 2.4], id: 62 });
      return [{ frame: ctx.rig.chest, blobs, shade }];
    },
  };
  const look: SkirtSpec = { outer: spec.mat, inner: spec.inner ?? dim(spec.mat, -0.15), waist: 0, ring: [0, 0], panels: [] };
  const tails: Piece = (ctx: PieceContext) => {
    const { rig, pose } = ctx;
    const cf = rig.chest;
    const avoid = torsoObstacles(rig, spec.over.chest, spec.over.hips);
    const root = at3(cf, knotAt[0], knotAt[1], knotAt[2]);
    const out = norm3(dirIn(cf, Math.cos(kn), 0, Math.sin(kn)));
    return spec.tails.map((tl, ti) => {
      // Each tail leaves the knot a little to one side of the other.
      const side = spec.tails.length > 1 ? (ti / (spec.tails.length - 1) - 0.5) * 2 : 0;
      const across = norm3(cross3(out, [0, 1, 0]));
      const start = add3(root, across, side * 1.6);
      const dir = add3(add3(dirIn(cf, 0, -1, 0), out, 0.45), across, side * 0.25);
      const spine = strand(pose, { root: start, dir, len: tl.len, n: ROWS, stiff: 0.15, give: spec.give ?? 1.1, seed: 1.3 + ti * 2.1, flick: true, avoid, pad: spec.over.pad ?? 1.5, axis: rig.pelvis.o, view: norm3(ctx.cam.local(TO_CAMERA)), side: add3(out, across, 0.6 + side * 0.4) });
      // The ribbon's breadth lies across its run and level, as a scarf's tail hangs and flies.
      const grid: V3[][] = Array.from({ length: COLS + 1 }, () => [] as V3[]);
      const faces: V3[] = [];
      for (let j = 0; j <= ROWS; j++) {
        const a = spine[Math.max(0, j - 1)] as V3;
        const b = spine[Math.min(ROWS, j + 1)] as V3;
        const run = norm3(sub3(b, a));
        let breadth = sub3(across, mul3(run, dot3(across, run)));
        breadth = Math.hypot(breadth[0], breadth[1], breadth[2]) < 0.2 ? norm3(cross3(run, [0, 1, 0])) : norm3(breadth);
        // Its outside faces away from the body (and up, as it flies).
        let face = norm3(cross3(run, breadth));
        if (dot3(face, add3(out, [0, 1, 0])) < 0) face = mul3(face, -1);
        faces.push(face);
        // A slow twist down the tail with the ripple.
        const twist = Math.sin((pose.phase ?? 0) * Math.PI * 2 - j * 0.7 + ti) * 0.25 * (j / ROWS);
        const bv = norm3(add3(breadth, faces[j] as V3, twist));
        for (let k = 0; k <= COLS; k++) (grid[k] as V3[]).push(add3(spine[j] as V3, bv, tl.w * ((2 * k) / COLS - 1)));
      }
      const pn: Panel = { from: 0, to: 0, len: tl.len, jag: tl.fork ?? 0 };
      const mid = spine[ROWS >> 1] as V3;
      return {
        z: ctx.depth(spine[1] as V3) * 0.4 + ctx.depth(mid) * 0.6 + ctx.upper,
        draw: () => drawPanel(ctx, look, pn, 24 + ti, grid, (j) => faces[Math.min(ROWS, j)] as V3),
      };
    });
  };
  return { wrap, tails };
}
