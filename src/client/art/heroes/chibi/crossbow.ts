/**
 * Crossbows, as a two-handed main weapon (design.ts `WeaponDesign`): a wooden stock with its butt
 * behind the right hand (put to the shoulder, or held at the hip), a trigger under the grip, a
 * prod (short, stiff bow arms) across its nose with a string, metal bands and a stirrup at the
 * nose, and a bolt lying in the groove along its top.
 *
 * Its flat parts are drawn in its own plane, as a blade's are: u along the stock from where the
 * right hand holds it at the trigger (the butt behind at negative u, the nose ahead), v across it
 * toward its underside, so that held level and pointing ahead (`weapon: 90`) its top, where the
 * bolt lies, faces up. The prod's arms reach out to either side of that plane, so side on they
 * show as a short cross at the nose and toward the viewer as a bow across it. Seen end on the
 * stock keeps part of its depth, so it still reads.
 *
 * The pose's `draw` spans it (1, the default: the string pulled back to the nut, the prod bent) or
 * looses it (0: the string forward at the prod, the prod straighter), and `nock` loads it (by
 * default while spanned): a bolt from the nut along the groove, its point the weapon's `tip`, so
 * `fx.flash` and `fx.trail` leave from there along the stock. Reloading is a few frames with
 * `draw` 0 and then `draw` 1 and `nock: false`, the left hand at the stirrup or the string. The
 * left hand holds the fore-stock (`grip2`, ahead of the trigger) when the pose leaves `handB` out.
 */
import type { Vec } from '../skeleton.js';
import { type ArrowSpec, arrowHeads, flatShaft, paintArrow } from './bow.js';
import type { Held, PieceContext, WeaponDesign } from './design.js';
import { clipToGround, heldAxes, mainHeld } from './held.js';
import { dim, type Mat, type Part } from './raster.js';
import { add3, clamp, cross3, norm3, type V3 } from './rig.js';

export interface CrossbowSpec {
  /** The stock's outline, [u, v] (v + toward its underside), round from the butt (behind the hand: negative u) to the nose and back. */
  stock: { pts: readonly (readonly [number, number])[]; mat: Mat };
  /** Metal bands round the stock at these points along it, in their metal. */
  bands?: { at: readonly number[]; mat: Mat };
  /**
   * The prod across the nose at `at` along the stock: each arm `span` out to the side, its tip
   * swept back `sweep` toward the butt (half as much again when spanned), `w` half-thick at its
   * root and at its tip.
   */
  prod: { at: number; span: number; sweep: number; w: readonly [number, number]; mat: Mat };
  /** The string's colour (painted flat, a pixel wide). */
  string: Mat;
  /** The nut that holds the spanned string, `latch` along the stock (behind the prod), and the groove's height above the stock's middle (default 1.6). */
  latch: number;
  groove?: number;
  /** A trigger lever hanging `len` (default 3.5) under the grip at `at` along the stock, raked back. */
  trigger: { at: number; len?: number; mat: Mat };
  /** A stirrup at the nose for the foot when spanning it. */
  stirrup?: Mat;
  /** The bolt it shoots (bow.ts `ArrowSpec`: a short, heavy arrow). */
  bolt: ArrowSpec;
  /** Where the left hand holds the fore-stock at rest, along it (ahead of the trigger). */
  grip2: number;
}

/** Is it spanned in this pose (the pose's `draw`, 1 by default)? */
const spannedIn = (draw: number | undefined): boolean => (draw ?? 1) > 0.5;

const STOCK = 1;
const BAND = 2;
const TRIGGER = 3;
const PROD = 4;
const STIRRUP = 5;
const STRING = 6;

export function crossbow(spec: CrossbowSpec): WeaponDesign {
  const bolt = flatShaft(spec.bolt);
  const heads = arrowHeads(bolt);
  const stringMat: Mat = { ...spec.string, flat: true };
  const nose = Math.max(...spec.stock.pts.map((p) => p[0]));
  const groove = spec.groove ?? 1.6;
  const tipU = spec.latch + bolt.len;
  const P = spec.prod;

  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const { cam } = ctx;
    const w = held.grip;
    const ax = heldAxes(ctx, w);
    const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
    const p3 = (u: number, v: number, n = 0): V3 => add3(add3(add3(w.o, w.u, u), w.v, v), w.n, n);
    const z = (u: number, v = 0, n = 0): number => ctx.depth(p3(u, v, n));
    let nrm = norm3(cross3(w.u, w.v));
    if (cam.facing(nrm) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
    const flatLight = cam.light(nrm);
    const ul2 = ax.u[0] * ax.u[0] + ax.u[1] * ax.u[1] || 1;
    const vl2 = ax.v[0] * ax.v[0] + ax.v[1] * ax.v[1] || 1;
    const uOf = (x: number, y: number): number => ((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2;
    const vOf = (x: number, y: number): number => ((x + 0.5 - ax.o[0]) * ax.v[0] + (y + 0.5 - ax.o[1]) * ax.v[1]) / vl2;
    const zAt = (x: number, y: number): number => z(uOf(x, y)) + 0.4;
    clipToGround(part, ax, w);
    const spanned = spannedIn(ctx.pose.draw);
    // The stock: its top catching the light, its underside in shadow.
    part.poly(spec.stock.pts.map(([u, v]) => at(u, v)), spec.stock.mat, (x, y) => flatLight * 0.6 + (vOf(x, y) < -0.4 ? 0.2 : vOf(x, y) > 1.6 ? -0.15 : 0), zAt, STOCK);
    // The groove along its top, a darker line from the nut to the nose.
    part.line(at(spec.latch, -groove + 0.6), at(nose - 0.5, -groove + 0.6), dim(spec.stock.mat, -0.3), 0.2, z(spec.latch) + 0.45, STOCK, true);
    for (const u of spec.bands?.at ?? []) part.line(at(u, -groove - 0.3), at(u, 2.2), (spec.bands as NonNullable<CrossbowSpec['bands']>).mat, 0.5, z(u) + 0.6, BAND, true);
    const T = spec.trigger;
    const tl = T.len ?? 3.5;
    part.poly([at(T.at + 0.6, 0.8), at(T.at - 0.8, 0.8 + tl), at(T.at - 2, 0.8 + tl * 0.85), at(T.at - 0.8, 0.8)], T.mat, flatLight * 0.5, z(T.at) - 0.1, TRIGGER);
    // The prod: two arms out to either side of the stock's plane, swept back at their tips.
    const sweep = P.sweep * (spanned ? 1.5 : 1);
    const arm = (side: number, k: number): V3 => p3(P.at - sweep * k * k, -groove * 0.4, side * P.span * k);
    const tips: V3[] = [];
    for (const side of [1, -1]) {
      const N = 5;
      for (let i = 0; i < N; i++) {
        const a = arm(side, i / N);
        const b = arm(side, (i + 1) / N);
        const ra = P.w[0] + (P.w[1] - P.w[0]) * (i / N);
        const rb = P.w[0] + (P.w[1] - P.w[0]) * ((i + 1) / N);
        part.capsule(ctx.proj(a), ctx.proj(b), ra, rb, P.mat, 0, ctx.depth(a) + 0.5, ctx.depth(b) + 0.5, PROD);
      }
      tips.push(arm(side, 1));
    }
    if (spec.stirrup) {
      const s = spec.stirrup;
      const loop: V3[] = [p3(nose - 0.5, 0.4, -1.8), p3(nose + 3, 0.6, -1.8), p3(nose + 3.6, 0.6, 0), p3(nose + 3, 0.6, 1.8), p3(nose - 0.5, 0.4, 1.8)];
      for (let i = 0; i + 1 < loop.length; i++) part.line(ctx.proj(loop[i] as V3), ctx.proj(loop[i + 1] as V3), s, 0.4, Math.max(ctx.depth(loop[i] as V3), ctx.depth(loop[i + 1] as V3)) + 0.3, STIRRUP, true);
    }
    // The string: back to the nut when spanned, else straight across between the tips.
    const nut = p3(spec.latch, -groove, 0);
    const legs: [V3, V3][] = spanned ? [[tips[0] as V3, nut], [tips[1] as V3, nut]] : [[tips[0] as V3, tips[1] as V3]];
    for (const [a, b] of legs) part.line(ctx.proj(a), ctx.proj(b), stringMat, 0, Math.max(ctx.depth(a), ctx.depth(b)) + 0.6, STRING, true);
    // The bolt in the groove.
    if (ctx.pose.nock ?? spanned) paintArrow(ctx, part, bolt, heads, p3(spec.latch, -groove - 0.4), w.u, held.blaze, 0);
    part.clip = null;
  };

  return {
    grip2: spec.grip2,
    reach: [spec.latch, tipU],
    tip: tipU,
    paint,
    glow: (ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)) => {
      // A charged bolt: a soft glow round its head.
      const g = bolt.head.glow;
      if (!g || strength <= 0.2 || !(ctx.pose.nock ?? spannedIn(ctx.pose.draw))) return;
      const c = ctx.c;
      const p = ctx.proj(add3(add3(held.grip.o, held.grip.u, tipU - bolt.head.len * 0.4), held.grip.v, -groove - 0.4));
      const r = 2 + 3 * clamp(strength, 0, 1.2);
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          const d = Math.hypot(dx, dy) / r;
          const x = Math.floor(p[0]) + dx;
          const y = Math.floor(p[1]) + dy;
          if (d > 1 || (c.opaque(x, y) && ctx.owner[y * c.w + x] !== held.tag)) continue;
          c.glow(x, y, g, strength * 0.6 * (1 - d) * (1 - d));
        }
      }
    },
  };
}
