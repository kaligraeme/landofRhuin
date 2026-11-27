/**
 * A wand, or any short rod with a glowing crystal at its tip (a sceptre, a focus), as a held item
 * (design.ts `HeldItem`), usually the off-hand item: a slender rod with metal bands and a knob at
 * its butt, claws holding a crystal at its tip. The crystal brightens toward its glow's colour as
 * the item blazes (`fx.runeB` in the off hand, `fx.rune` in the main one) and throws a soft halo
 * that grows with it, with a few sparkles when it blazes; spells leave from its tip (the item's
 * `tip`, which effects see as `FxContext.tipB`).
 *
 * Drawn in the item's own axes as a blade is (u along it from the hand, the butt at negative u),
 * keeping some breadth across when it points at the viewer.
 */
import type { RGB, Vec } from '../paint.js';
import type { Held, HeldItem, PieceContext } from './design.js';
import { heldAxes, mainHeld } from './held.js';
import { type Mat, mixc, type Part, type Ramp4 } from './raster.js';
import { add3, cross3, norm3 } from './rig.js';

export interface WandSpec {
  /** The rod: from its butt (`from`, below the hand) to the crystal's seat (`to`), `r0` wide at the butt and `r1` at the top. */
  rod: { from: number; to: number; r0: number; r1: number; mat: Mat };
  /** Metal bands round the rod, centred at these points along it. */
  bands?: { at: readonly number[]; mat: Mat };
  /** A knob on the butt, `r` wide. */
  knob?: { r: number; mat: Mat };
  /** Claws `len` long holding the crystal, in their metal. */
  claws?: { len: number; mat: Mat };
  /**
   * The crystal: `len` long from its seat and `w` half-wide at its widest, in its four tones; as
   * it blazes its tones run toward `hot` (default white) and its halo is `glow`.
   */
  crystal: { len: number; w: number; mat: Mat; glow: RGB; hot?: RGB };
}

const ROD = 1;
const BAND = 2;
const KNOB = 3;
const CLAW = 4;
const CRYSTAL = 5;

export function wand(spec: WandSpec): HeldItem {
  const R = spec.rod;
  const C = spec.crystal;
  const tipU = R.to + C.len;
  const hot = C.hot ?? [255, 255, 255];
  // The crystal's material at a few strengths, made once so the part sees the same objects every frame.
  const steps = 8;
  const crystals: Mat[] = Array.from({ length: steps + 1 }, (_, i) => ({ ...C.mat, tones: C.mat.tones.map((c, k) => mixc(c, k < 2 ? hot : C.glow, (i / steps) * (k < 2 ? 0.7 : 0.55))) as unknown as Ramp4 }));

  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const { cam } = ctx;
    const w = held.grip;
    const ax = heldAxes(ctx, w);
    const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
    const z = (u: number): number => ctx.depth(add3(w.o, w.u, u));
    let n = norm3(cross3(w.u, w.v));
    if (cam.facing(n) < 0) n = [-n[0], -n[1], -n[2]];
    const flatLight = cam.light(n);
    part.capsule(at(R.from, 0), at(R.to, 0), R.r0, R.r1, R.mat, 0.05, z(R.from), z(R.to), ROD);
    if (spec.knob) {
      const k = at(R.from, 0);
      part.ellipse(k[0], k[1], spec.knob.r, spec.knob.r, spec.knob.mat, 0.1, z(R.from) + 1, KNOB);
    }
    for (const u of spec.bands?.at ?? []) {
      const r = (R.r0 + (R.r1 - R.r0) * ((u - R.from) / (R.to - R.from || 1))) + 0.55;
      part.capsule(at(u - 0.6, 0), at(u + 0.6, 0), r, r, (spec.bands as NonNullable<WandSpec['bands']>).mat, 0.15, z(u) + 0.6, z(u) + 0.6, BAND);
    }
    // The crystal: a long diamond, its two facets lit differently, brighter as it blazes.
    const m = crystals[Math.round(Math.max(0, Math.min(1, held.blaze)) * steps)] as Mat;
    const seat = R.to - 0.5;
    const pts: Vec[] = [at(seat, 0), at(seat + C.len * 0.3, C.w), at(tipU, 0), at(seat + C.len * 0.3, -C.w)];
    const vl2 = ax.v[0] * ax.v[0] + ax.v[1] * ax.v[1] || 1;
    part.poly(pts, m, (x, y) => (((x + 0.5 - ax.o[0]) * ax.v[0] + (y + 0.5 - ax.o[1]) * ax.v[1]) / vl2 < 0 ? 0.5 : -0.05) + flatLight * 0.15, z(seat + C.len * 0.4) + 1.2, CRYSTAL);
    // A glint near its tip.
    const g = at(seat + C.len * 0.62, -C.w * 0.25);
    part.plot(g[0], g[1], m, 1.4, z(tipU) + 2, CRYSTAL, true);
    if (spec.claws) {
      const cl = spec.claws;
      for (const s of [1, -1]) part.line(at(R.to - 0.8, s * R.r1), at(R.to + cl.len, s * C.w * 1.05), cl.mat, 0.5, z(R.to) + 2, CLAW, true);
    }
  };

  return {
    reach: [R.to - 2, tipU],
    tip: tipU,
    paint,
    glow: (ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)) => {
      if (strength <= 0) return;
      const c = ctx.c;
      const ax = heldAxes(ctx, held.grip);
      const centre: Vec = [ax.o[0] + ax.u[0] * (R.to + C.len * 0.45), ax.o[1] + ax.u[1] * (R.to + C.len * 0.45)];
      const mine = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && ctx.owner[y * c.w + x] === held.tag;
      // Hidden behind something in front of it (a head, an arm): no halo.
      if (!mine(Math.floor(centre[0]), Math.floor(centre[1])) && c.opaque(Math.floor(centre[0]), Math.floor(centre[1]))) return;
      const rad = 2.5 + 3.5 * Math.min(1.2, strength);
      const rr = Math.ceil(rad);
      for (let dy = -rr; dy <= rr; dy++) {
        for (let dx = -rr; dx <= rr; dx++) {
          const d = Math.hypot(dx, dy) / rad;
          if (d > 1) continue;
          const x = Math.floor(centre[0]) + dx;
          const y = Math.floor(centre[1]) + dy;
          // Over the crystal itself and the air round it, not over the figure beside it.
          if (!mine(x, y) && c.opaque(x, y)) continue;
          c.glow(x, y, d < 0.35 ? hot : C.glow, strength * 0.55 * (1 - d) * (1 - d) + (d < 0.35 ? strength * 0.25 : 0));
        }
      }
      // Sparkles round it when it blazes.
      if (strength > 0.5) {
        const seed = Math.floor((ctx.pose.phase ?? 0) * 16) + Math.round(held.grip.o[0] * 3 + held.grip.o[1] * 5);
        for (let i = 0; i < 4; i++) {
          const a = ((i + (seed % 7) * 0.37) / 4) * Math.PI * 2;
          const r = rad + 1 + (i % 2) * 2;
          const x = Math.floor(centre[0] + Math.cos(a) * r);
          const y = Math.floor(centre[1] + Math.sin(a) * r);
          if (c.opaque(x, y)) continue;
          c.glow(x, y, hot, Math.min(1, strength) * 0.9);
        }
      }
    },
  };
}
