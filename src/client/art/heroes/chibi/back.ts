/**
 * Things worn across and on the back: a strap across the torso (a baldric, a bandolier with bolts
 * or pouches along it), a quiver of arrows with their fletchings showing over the shoulder, and
 * any held item slung on the back (a sheathed sword, a shield, a bow), each an outfit piece.
 *
 * A strap lies on the torso (painted only where it faces the viewer, just over the torso, so the
 * arms, a cowl or a beard pass over it); what hangs on the back is sorted with the upper body by
 * its depth (`PieceContext.upperZ`), so it hides behind the body seen from the front, but for what
 * shows over the shoulders and past the sides, and lies over the back, a cape or a cowl seen from
 * behind. Positions and directions are given in the chest frame ([forward, up, right] from the
 * pelvis, up the spine), so they ride the torso as it leans and twists.
 */
import { type DrawItem, type HeldItem, type Piece, type PieceContext } from './design.js';
import { type Blob, type Mat, type Part } from './raster.js';
import { add3, at3, cross3, dirIn, dot3, type Frame3, lerp3, mul3, norm3, rad, sub3, type V3 } from './rig.js';

// ── A strap ──────────────────────────────────────────────────────────────────────────────────

export interface StrapSpec {
  mat: Mat;
  /** Over which shoulder it runs: his right (1, down to his left hip) or his left (-1). */
  side: 1 | -1;
  /** Its half-width (pixels), how steeply it crosses the chest (degrees from level, default 52), and the chest-frame height where it crosses his middle (default 13). */
  w: number;
  tilt?: number;
  at?: number;
  /** What it lies on (the design's `body.chest` and `body.hips`) and how far clear (default 0.5). */
  over: { chest: readonly Blob[]; hips?: readonly Blob[]; pad?: number };
  /**
   * Things along it on the front (bolts in a bandolier, pouches, studs): one every `every`
   * pixels along it, from `from` to `to` (shares of its run from his hip up over his shoulder,
   * default 0.15 to 0.8), each a short capsule `len` long (0: a stud) and `r` thick, standing
   * along the strap (or across it with `across`).
   */
  studs?: { every: number; r: number; len?: number; mat: Mat; from?: number; to?: number; across?: boolean };
}

/** How far out from a point inside them the surface of some ellipsoids lies along a ray (the farthest exit). */
function exit(fr: Frame3, blobs: readonly Blob[], o: V3, d: V3): number {
  let best = 0;
  for (const b of blobs) {
    const c = at3(fr, b.c[0], b.c[1], b.c[2]);
    const oc = sub3(o, c);
    const q = (v: V3): V3 => [dot3(v, fr.f) / b.r[0], dot3(v, fr.u) / b.r[1], dot3(v, fr.r) / b.r[2]];
    const oo = q(oc);
    const dd = q(d);
    const a = dot3(dd, dd);
    const bb = dot3(oo, dd);
    const cc = dot3(oo, oo) - 1;
    const disc = bb * bb - a * cc;
    if (disc < 0) continue;
    const t = (-bb + Math.sqrt(disc)) / a;
    if (t > best) best = t;
  }
  return best;
}

/** The strap's path round the torso: points and their outward normals, from the front of the hip on the far side, up across the chest, over the shoulder and down the back. */
function strapPath(ctx: PieceContext, spec: StrapSpec, n = 40): { p: V3; out: V3 }[] {
  const cf = ctx.rig.chest;
  const pf = ctx.rig.pelvis;
  const tilt = rad(spec.tilt ?? 52);
  const C = at3(cf, 0, spec.at ?? 13, 0);
  const f = cf.f;
  // Up toward the shoulder it runs over.
  const d = norm3(add3(mul3(cf.u, Math.sin(tilt)), cf.r, spec.side * Math.cos(tilt)));
  const pad = spec.over.pad ?? 0.5;
  const pts: { p: V3; out: V3 }[] = [];
  for (let i = 0; i <= n; i++) {
    // From -90 (down at the hip, in front) round through the front and over the shoulder to 270.
    const th = rad(-90 + (360 * i) / n);
    const dir = norm3(add3(mul3(f, Math.cos(th)), d, Math.sin(th)));
    const t = Math.max(exit(cf, spec.over.chest, C, dir), spec.over.hips ? exit(pf, spec.over.hips, C, dir) : 0);
    pts.push({ p: add3(C, dir, t + pad), out: dir });
  }
  return pts;
}

/**
 * A strap across the torso from one shoulder to the other hip, front and back (a baldric, a
 * quiver's strap, a bandolier), with studs or bolts along it if given. It is painted just over
 * the torso, and only where it faces the viewer.
 */
export function strap(spec: StrapSpec): Piece {
  return (ctx: PieceContext): DrawItem[] => {
    const torsoTrue = ctx.depth(at3(ctx.rig.chest, 0, 14, 0));
    return [{ z: torsoTrue + ctx.upper + 0.02, draw: () => paintStrap(ctx, spec) }];
  };
}

function paintStrap(ctx: PieceContext, spec: StrapSpec): void {
  const { cam } = ctx;
  const cf = ctx.rig.chest;
  const tilt = rad(spec.tilt ?? 52);
  const d = norm3(add3(mul3(cf.u, Math.sin(tilt)), cf.r, spec.side * Math.cos(tilt)));
  // Across the strap: the normal of the plane it runs round in.
  const across = norm3(cross3(cf.f, d));
  const path = strapPath(ctx, spec);
  const part = ctx.part();
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i] as { p: V3; out: V3 };
    const b = path[i + 1] as { p: V3; out: V3 };
    const out = norm3(add3(a.out, b.out));
    if (cam.facing(out) < -0.05) continue;
    const quad = [add3(a.p, across, -spec.w), add3(a.p, across, spec.w), add3(b.p, across, spec.w), add3(b.p, across, -spec.w)].map((p) => ctx.proj(p));
    part.poly(quad, spec.mat, cam.light(out), ctx.depth(lerp3(a.p, b.p, 0.5)), 1);
  }
  const st = spec.studs;
  if (st) {
    // Measure along the front run (from the hip up over the chest to the top of the shoulder).
    const run: number[] = [0];
    for (let i = 1; i < path.length; i++) run.push((run[i - 1] as number) + Math.hypot(...sub3((path[i] as { p: V3 }).p, (path[i - 1] as { p: V3 }).p)));
    const half = Math.floor(path.length / 2);
    const total = run[half] as number;
    const from = (st.from ?? 0.15) * total;
    const to = (st.to ?? 0.8) * total;
    for (let s = from; s <= to + 1e-6; s += Math.max(1, st.every)) {
      let i = 0;
      while (i < half - 1 && (run[i + 1] as number) < s) i++;
      const k = (s - (run[i] as number)) / Math.max(1e-6, (run[i + 1] as number) - (run[i] as number));
      const a = path[i] as { p: V3; out: V3 };
      const b = path[i + 1] as { p: V3; out: V3 };
      const out = norm3(lerp3(a.out, b.out, k));
      if (cam.facing(out) < 0.05) continue;
      const c = add3(lerp3(a.p, b.p, k), out, st.r * 0.6);
      const along = st.across ? across : norm3(sub3(b.p, a.p));
      const len = (st.len ?? 0) / 2;
      const p0 = add3(c, along, -len);
      const p1 = add3(c, along, len);
      part.capsule(ctx.proj(p0), ctx.proj(p1), st.r, st.r * 0.9, st.mat, 0.1, ctx.depth(p0) + 0.5, ctx.depth(p1) + 0.5, 2);
    }
  }
  part.commit();
}

// ── A quiver ─────────────────────────────────────────────────────────────────────────────────

export interface QuiverSpec {
  /** Where its mouth and its foot are on his back (chest frame): the mouth up behind one shoulder, the foot lower on the other side, so it slants across the back. */
  mouth: V3;
  foot: V3;
  /** Its radius at the mouth and at the foot. */
  r: readonly [number, number];
  /** Its body, the bands at its mouth and foot (default the body), and the dark inside of its mouth. */
  mat: Mat;
  band?: Mat;
  /**
   * The arrows standing in it: how many, how far they stand out of the mouth, their shafts and
   * their fletchings (`fletch` long, default 3), fanning out a little (`spread`, default 1).
   */
  arrows?: { n: number; out: number; shaft: Mat; fletch: Mat; len?: number; spread?: number };
  /** The strap it hangs from, across the chest (see StrapSpec). */
  strap?: StrapSpec;
}

/**
 * A quiver on the back: a tube slanting across the back from low on one side to its mouth up
 * behind the other shoulder, banded at mouth and foot, with arrows standing out of the mouth, their
 * fletchings showing over the shoulder (from the front too, beside the head), and its strap
 * across the chest. It rides the torso.
 */
export function quiver(spec: QuiverSpec): Piece {
  const strapPiece = spec.strap ? strap(spec.strap) : null;
  return (ctx: PieceContext): DrawItem[] => {
    const cf = ctx.rig.chest;
    const mouth = at3(cf, ...spec.mouth);
    const foot = at3(cf, ...spec.foot);
    const items: DrawItem[] = strapPiece ? strapPiece(ctx) : [];
    items.push({ z: ctx.upperZ(ctx.depth(lerp3(mouth, foot, 0.4))), draw: () => paintQuiver(ctx, spec, mouth, foot) });
    return items;
  };
}

function paintQuiver(ctx: PieceContext, spec: QuiverSpec, mouth: V3, foot: V3): void {
  const { proj, depth } = ctx;
  const part = ctx.part();
  const axis = norm3(sub3(mouth, foot));
  const band = spec.band ?? spec.mat;
  const [r0, r1] = spec.r;
  // The body, a cylinder lit from the upper left, and its bands.
  part.capsule(proj(foot), proj(mouth), r1, r0, spec.mat, 0, depth(foot), depth(mouth), 1);
  const ring = (at: V3, len: number, r: number): void => {
    const a = add3(at, axis, -len / 2);
    const b = add3(at, axis, len / 2);
    part.capsule(proj(a), proj(b), r, r, band, 0.1, depth(a) + 0.4, depth(b) + 0.4, 2);
  };
  ring(add3(mouth, axis, -0.7), 1.4, r0 + 0.35);
  ring(add3(foot, axis, 0.9), 1.6, r1 + 0.3);
  const ar = spec.arrows;
  if (ar) {
    // Two axes across the mouth, to spread the arrows over it.
    const a1 = norm3(cross3(axis, Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const a2 = cross3(axis, a1);
    const fl = ar.len ?? 3;
    for (let i = 0; i < ar.n; i++) {
      const ang = (i / ar.n) * Math.PI * 2 + 0.6;
      const k = ar.n > 1 ? 0.55 : 0;
      const off = add3(mul3(a1, Math.cos(ang) * r0 * k), a2, Math.sin(ang) * r0 * k);
      const dir = norm3(add3(axis, off, 0.08 * (ar.spread ?? 1)));
      const base = add3(mouth, off);
      const tip = add3(base, dir, ar.out);
      // The shaft from inside the quiver to the fletching, then the fletching: a vane either side.
      const fs = add3(tip, dir, -fl);
      part.line(proj(add3(base, dir, -2)), proj(fs), ar.shaft, 0.3, depth(fs) - 0.2, 10 + i);
      part.capsule(proj(fs), proj(tip), 1.25, 0.55, ar.fletch, 0.1, depth(fs), depth(tip), 10 + i);
    }
  }
  part.commit();
}

// ── Something slung on the back ──────────────────────────────────────────────────────────────

export interface SlungSpec {
  /** The item (any held item: a blade, a pole arm, a bow, a shield), painted at a grip on his back. */
  item: HeldItem;
  /** Where its grip is (chest frame), the way along it toward its tip (chest frame), and the way its edge or face turns (chest frame, default out from his back). */
  at: V3;
  dir: V3;
  edge?: V3;
  /** A sheath over it from `from` to `to` along it from the grip (a scabbard over a blade), its radius at the mouth and the tip, its material and the band at its mouth (and its chape at the tip). */
  sheath?: { from: number; to: number; r: readonly [number, number]; mat: Mat; band?: Mat };
  /** The strap it hangs from, across the chest (see StrapSpec). */
  strap?: StrapSpec;
}

/**
 * A held item slung on the back (a sheathed sword with its hilt over the shoulder, a shield
 * between the shoulders, a bow across the back): painted at a fixed grip in the chest frame, in a
 * sheath if given, with its strap across the chest. Its glowing parts smoulder at rest.
 */
export function slung(spec: SlungSpec): Piece {
  const strapPiece = spec.strap ? strap(spec.strap) : null;
  return (ctx: PieceContext): DrawItem[] => {
    const cf = ctx.rig.chest;
    const o = at3(cf, ...spec.at);
    const u = norm3(dirIn(cf, ...spec.dir));
    const e0 = dirIn(cf, ...(spec.edge ?? [-1, 0, 0]));
    const v = norm3(sub3(e0, mul3(u, dot3(e0, u))));
    const grip = { o, u, v, n: cross3(u, v) };
    const reach = spec.item.reach;
    const mid = add3(o, u, (reach[0] + reach[1]) * 0.35);
    const items: DrawItem[] = strapPiece ? strapPiece(ctx) : [];
    items.push({
      z: ctx.upperZ(ctx.depth(mid)),
      draw: () => {
        const part: Part = ctx.part();
        spec.item.paint(ctx, part, { grip, blaze: 0, tag: 0 });
        const sh = spec.sheath;
        if (sh) {
          // Over the blade, in the same part: nearer than the blade wherever it covers it.
          const a = add3(o, u, sh.from);
          const b = add3(o, u, sh.to);
          part.capsule(ctx.proj(a), ctx.proj(b), sh.r[0], sh.r[1], sh.mat, 0, ctx.depth(a) + 0.6, ctx.depth(b) + 0.6, 40);
          if (sh.band) {
            const m1 = add3(o, u, sh.from + 1.4);
            const t0 = add3(o, u, sh.to - 2);
            part.capsule(ctx.proj(a), ctx.proj(m1), sh.r[0] + 0.3, sh.r[0] + 0.3, sh.band, 0.1, ctx.depth(a) + 1, ctx.depth(m1) + 1, 41);
            part.capsule(ctx.proj(t0), ctx.proj(b), sh.r[1] + 0.25, sh.r[1], sh.band, 0.1, ctx.depth(t0) + 1, ctx.depth(b) + 1, 41);
          }
        }
        part.commit();
      },
    });
    return items;
  };
}
