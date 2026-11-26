/**
 * Pole arms from parts (a sibling of blade.ts): a long haft of wood with metal bands, wrapped
 * grips and a butt cap or spike, and a head built of a spear point, an axe blade on one side, a
 * back spike or hook on the other and a pair of flared lugs ("wings") below them, a ribbon or
 * tassel tied under the head that streams, ripples and flies out with the pose's wind, and an
 * optional glowing channel along the point that smoulders at rest and blazes in skills (as the
 * greatsword's rune does, from the pose's `fx.rune`).
 *
 * The flat parts are drawn in the weapon's own plane, as a blade's are: u runs along the haft from
 * where the right hand holds it at rest (the butt below at negative u, the head above), v across
 * it toward the axe's edge. Seen edge on the head keeps part of its breadth, so it still reads.
 * Both hands hold the haft where the pose says (`grip` for the right hand, `grip2` for the left;
 * see rig.ts), and smears and impacts use the head's reach.
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { bladeAxes, channelGlow, clipToGround, mainHeld, runeColour } from './blade.js';
import type { Held, HeldItem, PieceContext, WeaponDesign } from './design.js';
import { dim, type Mat, type Part } from './raster.js';
import { add3, clamp, cross3, mul3, norm3, sub3, type V3 } from './rig.js';

export interface PoleSpec {
  /** The haft: from its butt end (`from`, below the hand: negative) up into the head's socket (`to`), its radius and its wood. */
  haft: { from: number; to: number; r: number; mat: Mat };
  /** A metal cap on the butt, `len` long and `r` wide, or a spike tapering to a point (`spike`). */
  butt?: { len: number; r: number; mat: Mat; spike?: boolean };
  /** Metal bands round the haft, centred at these points along it, each `len` long. */
  bands?: { at: readonly number[]; len: number; mat: Mat };
  /** Grips wrapped in leather (`mat`) with a cord (`cord`) slanting round them two pixels apart. */
  wraps?: readonly { from: number; to: number; mat: Mat; cord: Mat }[];
  /** The head's metal and the pale band along its cutting edges. */
  metal: Mat;
  edge: Mat;
  /** The socket: a metal collar holding the head on the haft, from `from` to `to`, `r` wide. */
  socket?: { from: number; to: number; r: number };
  /** The spear point: a leaf from `from` (where it leaves the socket) `len` long, `w` half-width at its widest, which is `belly` of the way up (default 0.32). */
  point: { from: number; len: number; w: number; belly?: number };
  /**
   * An axe blade on the +v side: fixed to the socket from `from` to `to`, its edge `out` from the
   * haft, its top corner at `top` (default `to` + 1) and its lower corner hanging `beard` below
   * `from` (default 3), the edge bowed outward between them.
   */
  axe?: { from: number; to: number; out: number; top?: number; beard?: number };
  /** A back spike on the -v side at `at`, `len` long and `w` half-wide at its root, its point curled `hook` toward the head (a hook). */
  spike?: { at: number; len: number; w: number; hook?: number };
  /** A pair of lugs below the head at `at`, one each side, `len` out, `w` half-wide at the root, swept back toward the butt by `sweep` (default 0.6 of `len`). */
  lugs?: { at: number; len: number; w: number; sweep?: number };
  /**
   * A ribbon (or tassel) tied round the haft at `at`, with `tails` tails (default 2) `len` long and
   * `w` half-wide, streaming with the pose's `wind`, `lift`, `flare` and `sway` and rippling with
   * its `phase`.
   */
  ribbon?: { at: number; len: number; w: number; mat: Mat; tails?: number };
  /** A glowing channel along the middle of the point from `from` to `to`: its colour at rest and ablaze, its glow's colour, and marks across it that show as it blazes. */
  rune?: { from: number; to: number; rest: RGB; colour: RGB; glow: RGB; marks?: readonly number[] };
  /** Where the left hand holds it at rest (the pose's `grip2` moves it). */
  grip2: number;
  /** The cutting part along it for smears and impacts (default: from the lowest part of the head to the point's tip). */
  reach?: readonly [number, number];
}

/** Shape ids inside the weapon's part. */
const HAFT = 1;
const BUTT = 2;
const BAND = 3;
const WRAP = 4;
const SOCKET = 5;
const LUG = 6;
const SPIKE = 7;
const AXE = 8;
const POINT = 9;
const EDGE = 10;
const RIBBON = 11;

/** A quadratic curve's points from a to b pulled toward c. */
function bow(a: readonly [number, number], c: readonly [number, number], b: readonly [number, number], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** The spear point's half-width at a share t of the way up it. */
function leaf(t: number, base: number, w: number, belly: number): number {
  if (t <= belly) return base + (w - base) * Math.sin(((t / belly) * Math.PI) / 2);
  return w * Math.pow(Math.cos((((t - belly) / (1 - belly)) * Math.PI) / 2), 0.85);
}

export function pole(spec: PoleSpec): WeaponDesign & HeldItem {
  const P = spec.point;
  const belly = P.belly ?? 0.32;
  const tipU = P.from + P.len;
  const low = Math.min(P.from, spec.axe ? spec.axe.from - (spec.axe.beard ?? 3) : Infinity, spec.lugs?.at ?? Infinity, spec.spike ? spec.spike.at - spec.spike.w : Infinity);
  const reach = spec.reach ?? [low - 1, tipU];
  const base = (spec.socket?.r ?? spec.haft.r) * 0.85;
  // The point's outline, up one edge to the tip and down the other.
  const pointPts: [number, number][] = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pointPts.push([P.from + P.len * t, leaf(t, base, P.w, belly)]);
  }
  for (let i = N - 1; i >= 0; i--) {
    const t = i / N;
    pointPts.push([P.from + P.len * t, -leaf(t, base, P.w, belly)]);
  }
  const ax = spec.axe;
  const axeEdge = ax ? bow([ax.top ?? ax.to + 1, ax.out * 0.86], [(ax.to + ax.from) / 2, ax.out * 1.16], [ax.from - (ax.beard ?? 3), ax.out * 0.92], 8) : [];
  const axePts: [number, number][] = ax ? [[ax.to, spec.haft.r], ...axeEdge, ...bow([ax.from - (ax.beard ?? 3), ax.out * 0.92], [ax.from + 0.5, ax.out * 0.3], [ax.from, spec.haft.r], 4).slice(1)] : [];
  const sp = spec.spike;
  const spikePts: [number, number][] = sp
    ? [
        [sp.at - sp.w, -spec.haft.r * 0.6],
        [sp.at - sp.w * 0.35 + (sp.hook ?? 0) * 0.35, -sp.len * 0.55],
        [sp.at + (sp.hook ?? 0), -sp.len],
        [sp.at + sp.w * 0.4 + (sp.hook ?? 0) * 0.45, -sp.len * 0.5],
        [sp.at + sp.w, -spec.haft.r * 0.6],
      ]
    : [];
  const lg = spec.lugs;
  const lugPts = (side: number): [number, number][] =>
    lg
      ? [
          [lg.at + lg.w, side * spec.haft.r * 0.6],
          [lg.at - (lg.sweep ?? lg.len * 0.6), side * lg.len],
          [lg.at - (lg.sweep ?? lg.len * 0.6) * 0.55 - lg.w * 0.6, side * lg.len * 0.55],
          [lg.at - lg.w, side * spec.haft.r * 0.6],
        ]
      : [];

  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const { cam } = ctx;
    const w = held.grip;
    const sax = bladeAxes(ctx, w);
    const at = (u: number, v: number): Vec => [sax.o[0] + sax.u[0] * u + sax.v[0] * v, sax.o[1] + sax.u[1] * u + sax.v[1] * v];
    const z = (u: number): number => ctx.depth(add3(w.o, w.u, u));
    let n = norm3(cross3(w.u, w.v));
    if (cam.facing(n) < 0) n = [-n[0], -n[1], -n[2]];
    const flatLight = cam.light(n);
    const ul2 = sax.u[0] * sax.u[0] + sax.u[1] * sax.u[1] || 1;
    const vl2 = sax.v[0] * sax.v[0] + sax.v[1] * sax.v[1] || 1;
    const uOf = (x: number, y: number): number => ((x + 0.5 - sax.o[0]) * sax.u[0] + (y + 0.5 - sax.o[1]) * sax.u[1]) / ul2;
    const vOf = (x: number, y: number): number => ((x + 0.5 - sax.o[0]) * sax.v[0] + (y + 0.5 - sax.o[1]) * sax.v[1]) / vl2;
    const zAt = (x: number, y: number): number => z(uOf(x, y)) + 0.4;
    clipToGround(part, sax, w);
    const H = spec.haft;
    // The haft, its butt, bands and wrapped grips.
    part.capsule(at(H.from, 0), at(H.to, 0), H.r, H.r, H.mat, 0, z(H.from), z(H.to), HAFT);
    if (spec.butt) {
      const b = spec.butt;
      if (b.spike) part.poly([at(H.from + 0.5, b.r), at(H.from - b.len, 0), at(H.from + 0.5, -b.r)], b.mat, flatLight * 0.6, (x, y) => zAt(x, y) + 0.3, BUTT);
      else part.capsule(at(H.from - b.len, 0), at(H.from + 0.5, 0), b.r, b.r, b.mat, 0, z(H.from - b.len) + 0.3, z(H.from) + 0.3, BUTT);
      part.capsule(at(H.from, 0), at(H.from + 1.2, 0), H.r + 0.6, H.r + 0.6, b.mat, 0.1, z(H.from) + 0.5, z(H.from + 1.2) + 0.5, BAND);
    }
    for (const wr of spec.wraps ?? []) {
      part.capsule(at(wr.from, 0), at(wr.to, 0), H.r + 0.25, H.r + 0.25, wr.mat, 0, z(wr.from) + 0.3, z(wr.to) + 0.3, WRAP);
      for (let u = wr.from + 0.8; u < wr.to - 0.5; u += 2) part.line(at(u, -H.r - 0.2), at(u + 1.2, H.r + 0.2), wr.cord, 0, z(u) + 0.9, WRAP, true);
    }
    if (spec.bands) {
      const bd = spec.bands;
      for (const u of bd.at) part.capsule(at(u - bd.len / 2, 0), at(u + bd.len / 2, 0), H.r + 0.55, H.r + 0.55, bd.mat, 0.1, z(u) + 0.6, z(u) + 0.6, BAND);
    }
    // The head: socket, lugs, back spike, axe blade and the point.
    if (spec.socket) {
      const so = spec.socket;
      part.capsule(at(so.from, 0), at(so.to, 0), so.r, so.r * 0.9, spec.metal, 0.05, z(so.from) + 0.8, z(so.to) + 0.8, SOCKET);
      part.capsule(at(so.from - 0.3, 0), at(so.from + 0.9, 0), so.r + 0.45, so.r + 0.45, dim(spec.metal, 0.2), 0.15, z(so.from) + 1, z(so.from) + 1, BAND);
    }
    const bevel = (k: number) => (x: number, y: number): number => flatLight * 0.6 + (vOf(x, y) > 0 ? 0.16 : -0.1) * k;
    const flatPoly = (pts: readonly (readonly [number, number])[], m: Mat, dz: number, id: number, light: number | ((x: number, y: number) => number) = bevel(1)): void => {
      part.poly(pts.map(([u, v]) => at(u, v)), m, light, (x, y) => zAt(x, y) + dz, id);
    };
    if (lg) {
      flatPoly(lugPts(1), spec.metal, 0.5, LUG);
      flatPoly(lugPts(-1), spec.metal, 0.5, LUG);
    }
    if (sp) flatPoly(spikePts, spec.metal, 0.4, SPIKE, flatLight * 0.6 - 0.05);
    if (ax) {
      flatPoly(axePts, spec.metal, 0.6, AXE, (x, y) => flatLight * 0.6 + (vOf(x, y) > ax.out * 0.55 ? 0.12 : -0.06));
      // The pale band along the axe's edge.
      const inner = axeEdge.map(([u, v]): [number, number] => [u, v - 1.4]);
      flatPoly([...axeEdge, ...inner.reverse()], spec.edge, 0.65, EDGE, flatLight * 0.4 + 0.3);
    }
    // The point stands well in front of the axe and lugs, so a line parts it from them.
    flatPoly(pointPts, spec.metal, 4, POINT);
    // Pale bands down both edges of the point, from a little above its root to the tip.
    for (const side of [1, -1]) {
      const outer: [number, number][] = [];
      const inner: [number, number][] = [];
      for (let i = 2; i <= N; i++) {
        const t = i / N;
        const hw = leaf(t, base, P.w, belly);
        outer.push([P.from + P.len * t, side * hw]);
        inner.push([P.from + P.len * t - (t > 0.85 ? 1.2 : 0), side * Math.max(0, hw - 1.1)]);
      }
      flatPoly([...outer, ...inner.reverse()], spec.edge, 4.05, EDGE, (x, y) => flatLight * 0.4 + 0.25 + (uOf(x, y) > P.from + P.len * 0.6 ? 0.25 : 0));
    }
    // A ridge down the point's middle, or the glowing channel.
    if (spec.rune) {
      const r = spec.rune;
      const col = runeColour(r, held.blaze);
      const runeMat: Mat = { tones: [col, col, col, col], line: col, flat: true };
      const n2 = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(sax.u[0], sax.u[1]));
      for (let i = 0; i <= n2; i++) {
        const u = r.from + ((r.to - r.from) * i) / Math.max(1, n2);
        const p = at(u, 0);
        if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === POINT) part.plot(p[0], p[1], runeMat, 0, z(u) + 4.7, POINT, true);
      }
      if (held.blaze > 0.3) {
        for (const u of r.marks ?? []) {
          for (const dv of [-1, 1]) {
            const p = at(u, dv);
            if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === POINT) part.plot(p[0], p[1], runeMat, 0, z(u) + 4.7, POINT, true);
          }
        }
      }
    } else {
      part.line(at(P.from + 1, 0), at(tipU - 3, 0), spec.metal, 0.9, z(P.from) + 4.6, POINT, true);
    }
    part.clip = null;
    if (spec.ribbon) paintRibbon(ctx, part, held, spec.ribbon);
  };

  return {
    grip2: spec.grip2,
    reach,
    tip: tipU,
    // Hands hold the haft anywhere from a little above the butt to a little below the head.
    haft: [spec.haft.from + 2, Math.min(spec.haft.to, spec.socket?.from ?? spec.haft.to, low) - 2],
    paint,
    glow: (ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)) => {
      if (spec.rune) channelGlow(ctx, held, { v: 0, from: spec.rune.from, to: spec.rune.to, glow: spec.rune.glow }, strength);
    },
  };
}

/** Segments down each ribbon tail. */
const SEGS = 8;

/**
 * A ribbon tied round the haft: a knot, and tails hanging from it that stream back in the wind,
 * rise in an updraft, fly outward in a spin, swing sideways and ripple down their length, showing
 * their face and then their edge as they twist.
 */
function paintRibbon(ctx: PieceContext, part: Part, held: Held, rb: NonNullable<PoleSpec['ribbon']>): void {
  const { pose, rig, cam } = ctx;
  const w = held.grip;
  const tie = add3(w.o, w.u, rb.at);
  const blow = clamp(pose.wind ?? 0, -0.8, 1.3);
  const wind = Math.abs(blow) * 1.3;
  const lift = pose.lift ?? 0;
  const flare = pose.flare ?? 0;
  const sway = pose.sway ?? 0;
  const phase = (pose.phase ?? 0) * Math.PI * 2;
  const windDir = norm3([blow < 0 ? 1 : -1, 0.08 + lift * 0.5, sway * 0.5]);
  // Outward from his middle, for the fling of a spin.
  const outR = sub3(tie, rig.pelvis.o);
  const out = norm3([outR[0], 0, outR[2]]);
  const tails = rb.tails ?? 2;
  const knot = ctx.proj(tie);
  part.ellipse(knot[0], knot[1], 1.6, 1.4, rb.mat, 0.1, ctx.depth(tie) + 2.2, RIBBON);
  for (let j = 0; j < tails; j++) {
    const len = rb.len * (1 - j * 0.18);
    const seg = len / SEGS;
    const pts: V3[] = [tie];
    let p = tie;
    for (let i = 1; i <= SEGS; i++) {
      const t = i / SEGS;
      const bend = clamp(0.12 + wind * (0.35 + 0.8 * t), 0, 1);
      let d = add3(mul3([0, -1, 0], 1 - bend), windDir, bend);
      d = add3(d, out, flare * (0.7 + t));
      d = add3(d, [0, 1, 0], Math.max(0, lift) * t * 0.8);
      // The tails part a little from each other.
      d = add3(d, [0, 0, 1], (j - (tails - 1) / 2) * 0.35 + sway * 0.35 * t);
      d = norm3(d);
      const across = norm3(cross3(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]));
      const ripple = Math.sin(phase - i * 1.15 + j * 1.9) * (0.45 + wind * 0.9 + flare) * t;
      p = add3(add3(p, d, seg), across, ripple);
      if (p[1] < 0.6) p = [p[0], 0.6, p[2]];
      pts.push(p);
    }
    const scr = pts.map((q) => ctx.proj(q));
    for (let i = 0; i < SEGS; i++) {
      const a = scr[i] as Vec;
      const b = scr[i + 1] as Vec;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l;
      const ny = dx / l;
      // It twists as it ripples: broad where it shows its face, thin where it turns edge on.
      const twist = (k: number): number => 0.55 + 0.45 * Math.abs(Math.cos(phase * 0.5 - k * 0.8 + j * 1.3));
      const wa = rb.w * twist(i) * (i === 0 ? 0.7 : 1);
      const wb = rb.w * twist(i + 1) * (i === SEGS - 1 ? 0.75 : 1);
      const quad: Vec[] = [
        [a[0] + nx * wa, a[1] + ny * wa],
        [b[0] + nx * wb, b[1] + ny * wb],
        [b[0] - nx * wb, b[1] - ny * wb],
        [a[0] - nx * wa, a[1] - ny * wa],
      ];
      const mid = add3(pts[i] as V3, sub3(pts[i + 1] as V3, pts[i] as V3), 0.5);
      // Lit where its face turns up toward the light, darker on the turns.
      const face = cam.light(norm3(cross3(sub3(pts[i + 1] as V3, pts[i] as V3), [0, 0, 1]))) * 0.3 + (twist(i) > 0.8 ? 0.35 : -0.15);
      part.poly(quad, rb.mat, face, ctx.depth(mid) + 1.5, RIBBON + 1 + j);
    }
    // A forked end, a pixel either side of the tip.
    const end = scr[SEGS] as Vec;
    const prev = scr[SEGS - 1] as Vec;
    const ex = end[0] - prev[0];
    const ey = end[1] - prev[1];
    const el = Math.hypot(ex, ey) || 1;
    const zEnd = ctx.depth(pts[SEGS] as V3) + 1.5;
    for (const s of [1, -1]) part.plot(end[0] + (ex / el) * 1.2 + (-ey / el) * s * rb.w * 0.6, end[1] + (ey / el) * 1.2 + (ex / el) * s * rb.w * 0.6, rb.mat, 0.1, zEnd, RIBBON + 1 + j);
  }
}
