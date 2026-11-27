/**
 * Pole arms from parts (a sibling of blade.ts): a long haft of wood with metal bands, wrapped
 * grips and a butt cap or spike, and a head built of a spear point, an axe blade on one side, a
 * back spike or hook on the other and a pair of flared lugs ("wings") below them, a ribbon or
 * tassel tied under the head that streams, ripples and flies out with the pose's wind, and an
 * optional glowing channel along the point that smoulders at rest and blazes in skills (as the
 * greatsword's rune does, from the pose's `fx.rune`).
 *
 * A staff is a pole arm too: leave the point out and crown the haft with an orb or a crystal
 * (`orb`), held in a ring, in claws curling up round it, or in the haft's own top curled over
 * into a crook. It burns with `fx.rune` (its tones running white-hot, a halo round it and
 * sparkles when it blazes), spells leave from it (the weapon's `tip` is the top of the orb, or
 * of the crystal), and a channel (`rune`) then runs up the haft instead, as carved runes.
 *
 * The flat parts are drawn in the weapon's own plane, as a blade's are: u runs along the haft from
 * where the right hand holds it at rest (the butt below at negative u, the head above), v across
 * it toward the axe's edge. Seen edge on the head keeps part of its breadth, so it still reads.
 * Both hands hold the haft where the pose says (`grip` for the right hand, `grip2` for the left;
 * see rig.ts), and smears and impacts use the head's reach.
 */
import type { RGB, Vec } from '../paint.js';
import type { Held, PieceContext, WeaponDesign } from './design.js';
import { channelGlow, clipToGround, heldAxes, mainHeld, runeColour } from './held.js';
import { dim, type Mat, mixc, type Part, type Ramp4 } from './raster.js';
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
  /** The spear point: a leaf from `from` (where it leaves the socket) `len` long, `w` half-width at its widest, which is `belly` of the way up (default 0.32). A staff has none. */
  point?: { from: number; len: number; w: number; belly?: number };
  /**
   * A staff's head: an orb (a ball `r` in radius) or, with `len`, a crystal (a long faceted stone
   * `len` long and `r` half-wide), its middle `at` along the haft, in its four tones; ablaze, its
   * tones run toward `hot` (default white) and its halo is `glow`. Its `holder` (in its own
   * material, `w` thick, default 0.9): a `ring` round it in the weapon's plane on a short neck,
   * `claws` (`n` of them, default 4) curling up round it from a collar at the haft's top, or a
   * `crook`, the haft's top curled up the back of it, over it and down its front.
   */
  orb?: { at: number; r: number; len?: number; mat: Mat; glow: RGB; hot?: RGB; holder?: { kind: 'ring' | 'claws' | 'crook'; mat: Mat; n?: number; w?: number } };
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
  /** A glowing channel along the middle of the point (or, with no point, of the haft) from `from` to `to`: its colour at rest and ablaze, its glow's colour, and marks across it that show as it blazes. */
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
/** The orb and its holder (the ribbon's tails take the ids after RIBBON). */
const ORB = 20;
const HOLDER = 21;

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

export function pole(spec: PoleSpec): WeaponDesign {
  const P = spec.point;
  const belly = P?.belly ?? 0.32;
  const O = spec.orb;
  // An orb's half-length along the haft (a crystal's is half its length).
  const orbHalf = O ? (O.len ? O.len / 2 : O.r) : 0;
  const tipU = P ? P.from + P.len : O ? O.at + orbHalf : spec.haft.to;
  const lowest = Math.min(P ? P.from : Infinity, spec.axe ? spec.axe.from - (spec.axe.beard ?? 3) : Infinity, spec.lugs?.at ?? Infinity, spec.spike ? spec.spike.at - spec.spike.w : Infinity);
  const low = O ? Math.min(lowest, O.at - orbHalf - (O.holder ? 1.5 : 0)) : P ? lowest : Math.min(lowest, spec.haft.to);
  const reach = spec.reach ?? [low - 1, tipU];
  const base = (spec.socket?.r ?? spec.haft.r) * 0.85;
  // The point's outline, up one edge to the tip and down the other.
  const pointPts: [number, number][] = [];
  const N = 10;
  for (let i = 0; P && i <= N; i++) {
    const t = i / N;
    pointPts.push([P.from + P.len * t, leaf(t, base, P.w, belly)]);
  }
  for (let i = N - 1; P && i >= 0; i--) {
    const t = i / N;
    pointPts.push([P.from + P.len * t, -leaf(t, base, P.w, belly)]);
  }
  // The orb's tones at a few strengths toward its glow, made once so the part sees the same objects every frame.
  const orbHot = O?.hot ?? [255, 255, 255];
  const orbMats: Mat[] = O ? Array.from({ length: ORB_STEPS + 1 }, (_, i) => ({ ...O.mat, tones: O.mat.tones.map((c, k) => mixc(c, k < 2 ? orbHot : O.glow, (i / ORB_STEPS) * (k < 2 ? 0.7 : 0.55))) as unknown as Ramp4 })) : [];
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
    const sax = heldAxes(ctx, w);
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
    if (P) flatPoly(pointPts, spec.metal, 4, POINT);
    // Pale bands down both edges of the point, from a little above its root to the tip.
    for (const side of P ? [1, -1] : []) {
      const outer: [number, number][] = [];
      const inner: [number, number][] = [];
      for (let i = 2; i <= N; i++) {
        const t = i / N;
        const pt = P as NonNullable<PoleSpec['point']>;
        const hw = leaf(t, base, pt.w, belly);
        outer.push([pt.from + pt.len * t, side * hw]);
        inner.push([pt.from + pt.len * t - (t > 0.85 ? 1.2 : 0), side * Math.max(0, hw - 1.1)]);
      }
      flatPoly([...outer, ...inner.reverse()], spec.edge, 4.05, EDGE, (x, y) => flatLight * 0.4 + 0.25 + (uOf(x, y) > (P as NonNullable<PoleSpec['point']>).from + (P as NonNullable<PoleSpec['point']>).len * 0.6 ? 0.25 : 0));
    }
    // A ridge down the point's middle, or the glowing channel (along the haft, on a staff).
    const on = P ? POINT : HAFT;
    const lift = P ? 4.7 : 0.9;
    if (spec.rune) {
      const r = spec.rune;
      const col = runeColour(r, held.blaze);
      const runeMat: Mat = { tones: [col, col, col, col], line: col, flat: true };
      const n2 = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(sax.u[0], sax.u[1]));
      for (let i = 0; i <= n2; i++) {
        const u = r.from + ((r.to - r.from) * i) / Math.max(1, n2);
        const p = at(u, 0);
        if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === on) part.plot(p[0], p[1], runeMat, 0, z(u) + lift, on, true);
      }
      if (held.blaze > 0.3) {
        for (const u of r.marks ?? []) {
          for (const dv of [-1, 1]) {
            const p = at(u, dv);
            if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === on) part.plot(p[0], p[1], runeMat, 0, z(u) + lift, on, true);
          }
        }
      }
    } else if (P) {
      part.line(at(P.from + 1, 0), at(tipU - 3, 0), spec.metal, 0.9, z(P.from) + 4.6, POINT, true);
    }
    if (O) paintOrb(ctx, part, held, O, orbMats[Math.round(clamp(held.blaze, 0, 1) * ORB_STEPS)] as Mat, spec.haft);
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
      if (O) orbHalo(ctx, held, O.at, orbHalf, O.glow, orbHot, strength);
    },
  };
}

/** Steps of an orb's tones from cold to ablaze. */
const ORB_STEPS = 8;

/**
 * A staff's orb or crystal and its holder, in the weapon's part: the stone at its place along the
 * haft (brighter as it blazes, with a glint), and a ring, claws or a crook holding it, the parts of
 * them nearer the viewer than the stone over it and the rest behind.
 */
function paintOrb(ctx: PieceContext, part: Part, held: Held, O: NonNullable<PoleSpec['orb']>, m: Mat, haft: PoleSpec['haft']): void {
  const w = held.grip;
  const ax = heldAxes(ctx, w);
  const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
  const c3 = add3(w.o, w.u, O.at);
  const c = ctx.proj(c3);
  const zc = ctx.depth(c3);
  const half = O.len ? O.len / 2 : O.r;
  if (O.len) {
    // A crystal: a long diamond, its two facets lit differently.
    const vl2 = ax.v[0] * ax.v[0] + ax.v[1] * ax.v[1] || 1;
    const pts: Vec[] = [at(O.at - half, 0), at(O.at - half * 0.25, O.r), at(O.at + half, 0), at(O.at - half * 0.25, -O.r)];
    part.poly(pts, m, (x, y) => (((x + 0.5 - ax.o[0]) * ax.v[0] + (y + 0.5 - ax.o[1]) * ax.v[1]) / vl2 < 0 ? 0.55 : -0.05), zc + 1.2, ORB);
    const g = at(O.at + half * 0.3, -O.r * 0.3);
    part.plot(g[0], g[1], m, 1.4, zc + 2, ORB, true);
  } else {
    part.ellipse(c[0], c[1], O.r, O.r, m, 0.05, zc, ORB);
    // A glint up toward the light.
    part.plot(c[0] - O.r * 0.4, c[1] - O.r * 0.45, m, 1.6, zc + O.r, ORB, true);
  }
  const H = O.holder;
  if (!H) return;
  const t = H.w ?? 0.9;
  const R = O.len ? Math.max(O.r, half * 0.55) + 1.3 : O.r + 1.2;
  // Points of the holder in the weapon's axes [u, v, n]: on screen through the same opened-out
  // plane as the stone (so seen edge on a ring still rings it), in depth as they truly lie.
  const nv = ctx.cam.vec(w.n);
  const p3 = (u: number, v: number, n = 0): readonly [number, number, number] => [u, v, n];
  const scr = (q: readonly [number, number, number]): Vec => {
    const a = at(q[0], q[1]);
    return [a[0] + nv[0] * q[2], a[1] + nv[1] * q[2]];
  };
  const deep = (q: readonly [number, number, number]): number => ctx.depth(add3(add3(add3(w.o, w.u, q[0]), w.v, q[1]), w.n, q[2]));
  // A chain of capsules through such points, each a little nearer the viewer than the stone where it is in front of it.
  const chain = (pts: readonly (readonly [number, number, number])[], r0: number, r1: number): void => {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as readonly [number, number, number];
      const b = pts[i + 1] as readonly [number, number, number];
      const z = (q: readonly [number, number, number]): number => deep(q) + (deep(q) > zc ? 0.9 * O.r + 0.4 : 0);
      const k0 = i / (pts.length - 1);
      const k1 = (i + 1) / (pts.length - 1);
      part.capsule(scr(a), scr(b), r0 + (r1 - r0) * k0, r0 + (r1 - r0) * k1, H.mat, 0, z(a), z(b), HOLDER);
    }
  };
  if (H.kind === 'ring') {
    // A neck from the haft's top up to the ring, and the ring round the stone in the weapon's plane.
    chain([p3(haft.to, 0), p3(O.at - (O.len ? half : R), 0)], t + 0.3, t);
    const ring: (readonly [number, number, number])[] = [];
    const ru = O.len ? half + 1.2 : R;
    for (let i = 0; i <= 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      ring.push(p3(O.at + Math.cos(th) * ru, Math.sin(th) * R));
    }
    chain(ring, t, t);
  } else if (H.kind === 'claws') {
    // A collar at the haft's top, and claws curling up round the stone from it.
    chain([p3(haft.to - 1, 0), p3(O.at - half - 0.6, 0)], t + 0.9, t + 0.6);
    const n = H.n ?? 4;
    for (let j = 0; j < n; j++) {
      const phi = ((j + 0.5) / n) * Math.PI * 2;
      const rad3 = (k: number): [number, number] => [Math.cos(phi) * k, Math.sin(phi) * k];
      const pts: (readonly [number, number, number])[] = [];
      for (const [u, k] of [[O.at - half - 0.8, 1], [O.at - half * 0.55, O.r * 0.85 + 0.6], [O.at, O.r + 0.7], [O.at + half * 0.5, O.r * 0.8]] as [number, number][]) {
        const [v, nn] = rad3(k);
        pts.push(p3(u, v, nn));
      }
      chain(pts, t * 1.1, t * 0.6);
    }
  } else {
    // The crook: the haft's top running on up the back of the stone, over it and down its front.
    const ring: (readonly [number, number, number])[] = [p3(haft.to, 0)];
    for (let i = 0; i <= 14; i++) {
      const th = Math.PI + (i / 14) * Math.PI * 1.75;
      ring.push(p3(O.at + Math.cos(th) * (half + 1.2), -Math.sin(th) * R));
    }
    chain(ring, Math.max(t, haft.r), t * 0.8);
  }
}

/**
 * A halo round a staff's stone, `at` along the held item (`half` its half-length), growing with
 * its strength, white-hot at its heart, over the stone itself and the air round it (not over the
 * figure beside it), with sparkles round it when it blazes.
 */
function orbHalo(ctx: PieceContext, held: Held, at: number, half: number, glow: RGB, hot: RGB, strength: number): void {
  if (strength <= 0) return;
  const c = ctx.c;
  const centre = ctx.proj(add3(held.grip.o, held.grip.u, at));
  const mine = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && ctx.owner[y * c.w + x] === held.tag;
  // Hidden behind something in front of it (a head, an arm): no halo.
  if (!mine(Math.floor(centre[0]), Math.floor(centre[1])) && c.opaque(Math.floor(centre[0]), Math.floor(centre[1]))) return;
  const rad = half + 1.5 + 4 * Math.min(1.2, strength);
  const rr = Math.ceil(rad);
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      const d = Math.hypot(dx, dy) / rad;
      if (d > 1) continue;
      const x = Math.floor(centre[0]) + dx;
      const y = Math.floor(centre[1]) + dy;
      if (!mine(x, y) && c.opaque(x, y)) continue;
      c.glow(x, y, d < 0.35 ? hot : glow, strength * 0.55 * (1 - d) * (1 - d) + (d < 0.35 ? strength * 0.25 : 0));
    }
  }
  if (strength > 0.5) {
    const seed = Math.floor((ctx.pose.phase ?? 0) * 16) + Math.round(held.grip.o[0] * 3 + held.grip.o[1] * 5);
    for (let i = 0; i < 5; i++) {
      const a = ((i + (seed % 7) * 0.37) / 5) * Math.PI * 2;
      const r = rad + 1 + (i % 2) * 2;
      const x = Math.floor(centre[0] + Math.cos(a) * r);
      const y = Math.floor(centre[1] + Math.sin(a) * r);
      if (c.opaque(x, y)) continue;
      c.glow(x, y, hot, Math.min(1, strength) * 0.9);
    }
  }
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
