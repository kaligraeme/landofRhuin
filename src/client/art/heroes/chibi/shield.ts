/**
 * Shields, as a held item (design.ts `HeldItem`) for the off hand, strapped to the forearm: the
 * rig puts its grip (the middle of its back) on the forearm and turns its face out from it (rig.ts
 * `strapGrip`), so it follows the forearm wherever a pose takes it: low at his side, raised in
 * front of him for a block, driven out for a bash, or slung on his back (the pose's `slingB`).
 *
 * It is drawn in its own plane (u up toward its top, v across it, n out of its face) from an
 * outline (round, heater or kite, tower, or a design's own: see the outline makers below): a face
 * that domes out a little at its middle, a raised rim round its edge, its thickness showing as an
 * edge where it turns, a boss at its middle (a dome, with a spike if wanted) and an emblem painted
 * or embossed on its face (any simple shapes, given in the same plane). Seen from behind, the
 * inside shows: its backing, the rim wrapped round and the straps the forearm passes through.
 * Turned edge on it keeps part of its breadth, as a blade does, so it still reads.
 *
 * It blazes with the pose's `fx.runeB` (or `fx.rune` in the main hand): its emblem and boss
 * brighten toward its glow's colour, and a soft glow lies over its face with a halo round its rim
 * (a block, a holy light). Effects leave from the middle of its face, out of it (`aim`: `tipB` and
 * `dirB`), so `fx.impactB` lands a bash there and `fx.clangB` rings a blow caught on it.
 */
import type { RGB, Vec } from '../paint.js';
import { type Held, type HeldItem, type PieceContext, WEAPON_TAG } from './design.js';
import { heldAxes, mainHeld } from './held.js';
import { dim, type Mat, mixc, type Part, type Ramp4, scanPoly } from './raster.js';
import { add3, clamp, mul3, norm3, sub3 } from './rig.js';

/** A shape in a shield's plane, [u, v] (u up toward its top, v across it), its points in order round it. */
export type Outline = readonly (readonly [number, number])[];

/** A round shield's outline (a buckler, a round shield), `r` in radius about its middle. */
export function roundOutline(r: number, n = 28): Outline {
  return Array.from({ length: n }, (_, i): [number, number] => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)]);
}

/**
 * A heater or kite shield's outline: a top edge `top` above its middle, `w` half-wide and arched
 * up `arch` at its centre (default 1), straight sides for `waist` of its height (default 0.3),
 * then curving in to a point `bottom` (below its middle: negative). `belly` shapes the curve: 2
 * (the default) a heater's full rounded sides, toward 1 a kite's long, nearly straight taper.
 */
export function heaterOutline(o: { w: number; top: number; bottom: number; waist?: number; arch?: number; belly?: number }): Outline {
  const { w, top, bottom } = o;
  const arch = o.arch ?? 1;
  const p = o.belly ?? 2;
  const u1 = top - (o.waist ?? 0.3) * (top - bottom);
  // The arched top edge corner to corner, down one side to the point and back up the other.
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const v = -w + (2 * w * i) / 12;
    pts.push([top + arch * (1 - (v / w) ** 2), v]);
  }
  pts.push([u1, w]);
  const N = 12;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    pts.push([u1 - (u1 - bottom) * t, w * (1 - Math.pow(t, p))]);
  }
  pts.push([bottom, 0]);
  for (let i = N - 1; i >= 1; i--) {
    const t = i / N;
    pts.push([u1 - (u1 - bottom) * t, -w * (1 - Math.pow(t, p))]);
  }
  pts.push([u1, -w]);
  return pts;
}

/**
 * A tower shield's outline: tall and straight-sided, `w` half-wide from `top` down to `bottom`
 * (negative), its top edge arched up `arch` (default 1.5), its bottom edge bowed down half as
 * much, and its corners cut `corner` (default 2).
 */
export function towerOutline(o: { w: number; top: number; bottom: number; arch?: number; corner?: number }): Outline {
  const { w, top, bottom } = o;
  const arch = o.arch ?? 1.5;
  const k = o.corner ?? 2;
  const pts: [number, number][] = [];
  const edge = (u: number, bow: number, from: number, to: number): void => {
    for (let i = 0; i <= 8; i++) {
      const v = from + ((to - from) * i) / 8;
      pts.push([u + bow * (1 - (v / w) ** 2), v]);
    }
  };
  edge(top, arch, -w + k, w - k);
  pts.push([top - k, w], [bottom + k, w]);
  edge(bottom, -arch / 2, w - k, -w + k);
  pts.push([bottom + k, -w], [top - k, -w]);
  return pts;
}

/** A star of `points` points for an emblem, `outer` and `inner` radii, centred at `at` and turned so a point stands up. */
export function starOutline(points: number, outer: number, inner: number, at: readonly [number, number] = [0, 0]): Outline {
  return Array.from({ length: points * 2 }, (_, i): [number, number] => {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2;
    return [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r];
  });
}

export interface ShieldSpec {
  /** Its outline in its plane, [u, v] about the middle of its back (where the forearm crosses it): `roundOutline`, `heaterOutline`, `towerOutline` or its own. */
  outline: Outline;
  /** Its face, and its inside (the backing, seen when it faces away). */
  face: Mat;
  back: Mat;
  /** A rim round its edge `w` wide, standing `raise` off the face (default 0.8). */
  rim: { w: number; mat: Mat; raise?: number };
  /** How thick it is (default 1.6) and how far its face domes out at the middle (default 1.6). */
  thick?: number;
  bulge?: number;
  /** A boss: a dome `r` in radius at `at` (default its middle), with a spike `spike` long if given. */
  boss?: { at?: readonly [number, number]; r: number; mat: Mat; spike?: number };
  /**
   * An emblem on its face: shapes in its plane laid on in order, each painted on (`raise` 0, the
   * default) or embossed, standing `raise` off the face with a line round it. A field of two
   * colours is two shapes; a cross, a sun or a beast's head are a few more.
   */
  emblem?: readonly { pts: Outline; mat: Mat; raise?: number }[];
  /** The straps and handle on its back (default its back's material, darker). */
  straps?: Mat;
  /** Its glow's colour, and the colour its emblem and boss run toward ablaze (default white). */
  glow: RGB;
  hot?: RGB;
  /** Where it is strapped: `at` of the way down the forearm from the elbow (default 0.62), its back `out` clear of the forearm's axis (default 3). */
  strap?: { at?: number; out?: number };
}

/** Shape ids inside its part. */
const EDGE = 1;
const BACK = 2;
const STRAP = 3;
const RIM = 4;
const FACE = 5;
const BOSS = 30;
const EMBLEM = 6;

/** Distance from a point to a closed outline's edge, in its plane. */
function edgeDist(pts: Outline, u: number, v: number): number {
  let best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j] as readonly [number, number];
    const b = pts[i] as readonly [number, number];
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const l2 = du * du + dv * dv || 1;
    const t = clamp(((u - a[0]) * du + (v - a[1]) * dv) / l2, 0, 1);
    const d = Math.hypot(u - a[0] - du * t, v - a[1] - dv * t);
    if (d < best) best = d;
  }
  return best;
}

/** Is a point inside an outline (even-odd)? */
function inside(pts: Outline, u: number, v: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[j] as readonly [number, number];
    const b = pts[i] as readonly [number, number];
    if (a[1] > v !== b[1] > v && u < a[0] + ((v - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit;
  }
  return hit;
}

/** A material at a few strengths toward a glow, made once so a part sees the same objects every frame. */
function blazeSteps(m: Mat, glow: RGB, hot: RGB, steps: number): Mat[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({ ...m, tones: m.tones.map((c, k) => mixc(c, k < 2 ? hot : glow, (i / steps) * (k < 2 ? 0.75 : 0.6))) as unknown as Ramp4 }));
}

export function shield(spec: ShieldSpec): HeldItem {
  const O = spec.outline;
  const thick = spec.thick ?? 1.6;
  const bulge = spec.bulge ?? 1.6;
  const raise = spec.rim.raise ?? 0.8;
  const hot = spec.hot ?? [255, 255, 255];
  const us = O.map((p) => p[0]);
  const vs = O.map((p) => p[1]);
  const uMin = Math.min(...us);
  const uMax = Math.max(...us);
  const vMin = Math.min(...vs);
  const vMax = Math.max(...vs);
  // The middle of its face and its extent, for the dome.
  const cu = (uMin + uMax) / 2;
  const cv = (vMin + vMax) / 2;
  const hu = (uMax - uMin) / 2 || 1;
  const hv = (vMax - vMin) / 2 || 1;
  const dome = (u: number, v: number): number => Math.max(0, 1 - ((u - cu) / hu) ** 2 - ((v - cv) / hv) ** 2);
  const STEPS = 8;
  const emblems = (spec.emblem ?? []).map((e) => ({ ...e, mats: blazeSteps(e.mat, spec.glow, hot, STEPS) }));
  const bosses = spec.boss ? blazeSteps(spec.boss.mat, spec.glow, hot, STEPS) : [];
  const edgeMat = dim(spec.rim.mat, -0.28);
  const innerRim = dim(spec.rim.mat, -0.12);
  const strapMat = spec.straps ?? dim(spec.back, -0.35);
  const bossAt = spec.boss?.at ?? [0, 0];
  const bossLift = thick + bulge * dome(bossAt[0], bossAt[1]);

  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const { cam, depth } = ctx;
    const g = held.grip;
    const ax = heldAxes(ctx, g);
    const det = ax.u[0] * ax.v[1] - ax.u[1] * ax.v[0];
    if (Math.abs(det) < 1e-3) return;
    const front = cam.facing(g.n) >= 0;
    const faceOff = cam.vec(mul3(g.n, thick));
    const oBack: Vec = ax.o;
    const oFace: Vec = [ax.o[0] + faceOff[0], ax.o[1] + faceOff[1]];
    const at = (o: Vec, u: number, v: number): Vec => [o[0] + ax.u[0] * u + ax.v[0] * v, o[1] + ax.u[1] * u + ax.v[1] * v];
    const uvAt = (o: Vec, x: number, y: number): [number, number] => {
      const px = x + 0.5 - o[0];
      const py = y + 0.5 - o[1];
      return [(px * ax.v[1] - py * ax.v[0]) / det, (ax.u[0] * py - ax.u[1] * px) / det];
    };
    // Depth and light are linear in its axes.
    const z0 = depth(g.o);
    const zu = depth(g.u);
    const zv = depth(g.v);
    const zn = depth(g.n);
    const zAt = (u: number, v: number, n: number): number => z0 + zu * u + zv * v + zn * n;
    const lu = cam.light(g.u);
    const lv = cam.light(g.v);
    const ln = cam.light(g.n);
    // The face domes out: its normal leans toward the edge it is nearest.
    const K = (bulge / Math.max(hu, hv)) * 2.4;
    const lightAt = (u: number, v: number, side: number): number => {
      const a = ((u - cu) / hu) * K;
      const b = ((v - cv) / hv) * K;
      return (side * ln + lu * a + lv * b) / Math.sqrt(1 + a * a + b * b);
    };
    const blz = Math.round(clamp(held.blaze, 0, 1) * STEPS);
    const outlineAt = (o: Vec): Vec[] => O.map(([u, v]) => at(o, u, v));
    if (front) {
      // Its thickness: the back's outline, showing past the face where it turns.
      scanPoly(outlineAt(oBack), part.c.w, part.c.h, (x, y) => {
        const [u, v] = uvAt(oBack, x, y);
        part.plot(x, y, edgeMat, lightAt(u, v, 1) * 0.5 - 0.1, zAt(u, v, 0) - 0.2, EDGE);
      });
      scanPoly(outlineAt(oFace), part.c.w, part.c.h, (x, y) => {
        const [u, v] = uvAt(oFace, x, y);
        const l = lightAt(u, v, 1);
        if (edgeDist(O, u, v) < spec.rim.w) {
          part.plot(x, y, spec.rim.mat, l * 0.8 + 0.12, zAt(u, v, thick + raise + bulge * dome(u, v) * 0.3), RIM);
          return;
        }
        const zf = zAt(u, v, thick + bulge * dome(u, v));
        for (let i = emblems.length - 1; i >= 0; i--) {
          const e = emblems[i] as (typeof emblems)[number];
          if (!inside(e.pts, u, v)) continue;
          const r = e.raise ?? 0;
          part.plot(x, y, e.mats[blz] as Mat, l * 0.85 + (r > 0 ? 0.12 : 0), zf + (r > 0 ? r : 0.01), EMBLEM + i);
          return;
        }
        part.plot(x, y, spec.face, l, zf, FACE);
      });
      if (spec.boss) {
        const b = spec.boss;
        const c3 = add3(add3(add3(g.o, g.u, bossAt[0]), g.v, bossAt[1]), g.n, bossLift);
        const p = ctx.proj(c3);
        part.ellipse(p[0], p[1], b.r, b.r, bosses[blz] as Mat, 0.05, depth(c3) + 0.6, BOSS);
        if (b.spike) {
          const tipP = ctx.proj(add3(c3, g.n, b.spike));
          part.line(p, tipP, bosses[blz] as Mat, 0.6, depth(c3) + b.r + 0.6, BOSS + 1, true);
        }
      }
      return;
    }
    // From behind: the face's outline beyond is the edge, then the inside with the rim wrapped round it and the straps.
    scanPoly(outlineAt(oFace), part.c.w, part.c.h, (x, y) => {
      const [u, v] = uvAt(oFace, x, y);
      part.plot(x, y, edgeMat, lightAt(u, v, -1) * 0.5 - 0.1, zAt(u, v, thick) - 0.2, EDGE);
    });
    scanPoly(outlineAt(oBack), part.c.w, part.c.h, (x, y) => {
      const [u, v] = uvAt(oBack, x, y);
      const l = lightAt(u, v, -1);
      if (edgeDist(O, u, v) < spec.rim.w * 0.8) part.plot(x, y, innerRim, l * 0.7, zAt(u, v, -0.4), RIM);
      else part.plot(x, y, spec.back, l * 0.8 - 0.05, zAt(u, v, -bulge * dome(u, v) * 0.4), BACK);
    });
    // The straps across the forearm's way (or across the shield when it is not on an arm) and the handle near the hand.
    const pose = ctx.pose;
    const onArm = held.tag !== WEAPON_TAG && !pose.dropB && !pose.slingB;
    let au = 0;
    let av = 1;
    if (onArm) {
      const a = norm3(sub3(ctx.rig.armL.end, ctx.rig.armL.mid));
      const pu = a[0] * g.u[0] + a[1] * g.u[1] + a[2] * g.u[2];
      const pv = a[0] * g.v[0] + a[1] * g.v[1] + a[2] * g.v[2];
      const l = Math.hypot(pu, pv);
      if (l > 0.2) {
        au = pu / l;
        av = pv / l;
      }
    }
    const span = Math.min(hu, hv) * 0.55;
    for (const s of [-4.5, 3.5]) {
      const cU = au * s;
      const cV = av * s;
      // Across the forearm's line.
      const a0 = at(oBack, cU - av * span, cV + au * span);
      const a1 = at(oBack, cU + av * span, cV - au * span);
      part.line(a0, a1, strapMat, 0.2, zAt(cU, cV, -1.2), STRAP, true);
      part.line([a0[0], a0[1] + 1], [a1[0], a1[1] + 1], strapMat, -0.2, zAt(cU, cV, -1.2), STRAP, true);
    }
  };

  return {
    reach: [uMin, uMax],
    tip: 0,
    strap: { at: spec.strap?.at ?? 0.62, out: spec.strap?.out ?? 3 },
    paint,
    aim: (_ctx: PieceContext, held: Held) => ({ tip: add3(add3(add3(held.grip.o, held.grip.u, bossAt[0]), held.grip.v, bossAt[1]), held.grip.n, bossLift + (spec.boss?.r ?? 0)), dir: held.grip.n }),
    glow: (ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)) => {
      // At rest it does not glow: only a block or a skill lights it.
      const s = strength - 0.12;
      if (s <= 0) return;
      const c = ctx.c;
      const g = held.grip;
      const ax = heldAxes(ctx, g);
      const det = ax.u[0] * ax.v[1] - ax.u[1] * ax.v[0];
      if (Math.abs(det) < 1e-3) return;
      const faceOff = ctx.cam.vec(mul3(g.n, thick));
      const front = ctx.cam.facing(g.n) >= 0;
      const o: Vec = front ? [ax.o[0] + faceOff[0], ax.o[1] + faceOff[1]] : ax.o;
      const pts = O.map(([u, v]): Vec => [o[0] + ax.u[0] * u + ax.v[0] * v, o[1] + ax.u[1] * u + ax.v[1] * v]);
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const p of pts) {
        x0 = Math.min(x0, p[0]);
        y0 = Math.min(y0, p[1]);
        x1 = Math.max(x1, p[0]);
        y1 = Math.max(y1, p[1]);
      }
      const R = 3;
      x0 = Math.max(0, Math.floor(x0) - R - 1);
      y0 = Math.max(0, Math.floor(y0) - R - 1);
      x1 = Math.min(c.w - 1, Math.ceil(x1) + R + 1);
      y1 = Math.min(c.h - 1, Math.ceil(y1) + R + 1);
      const mine = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && ctx.owner[y * c.w + x] === held.tag;
      const k = Math.min(1.2, s);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (mine(x, y)) {
            // Over its face, brightest on the emblem and the boss.
            let a = 0.16;
            if (front) {
              const px = x + 0.5 - o[0];
              const py = y + 0.5 - o[1];
              const u = (px * ax.v[1] - py * ax.v[0]) / det;
              const v = (ax.u[0] * py - ax.u[1] * px) / det;
              if (spec.boss && Math.hypot(u - bossAt[0], v - bossAt[1]) < spec.boss.r + 0.5) a = 0.5;
              else if (emblems.some((e) => inside(e.pts, u, v))) a = 0.34;
            }
            c.glow(x, y, a > 0.4 ? hot : spec.glow, k * a);
            continue;
          }
          if (c.opaque(x, y)) continue;
          // A halo round its rim, out into the air.
          let d = Infinity;
          for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (mine(x + dx, y + dy)) d = Math.min(d, Math.hypot(dx, dy));
          if (d <= R) c.glow(x, y, spec.glow, k * 0.55 * (1 - d / (R + 0.8)));
        }
      }
    },
  };
}
