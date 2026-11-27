/**
 * Bows and arrows. A bow is a held item (design.ts `HeldItem`) for the off hand, held at its grip
 * in the middle: two limbs, each tapering from the grip to a tip (curling forward at the end in a
 * recurve), a wrapped grip and capped tips, and a string from tip to tip. It is drawn in its own
 * plane: u along it (from the grip toward the upper limb), and across it the way it faces, its
 * back toward the target and the string toward the archer.
 *
 * The pose's `draw` (0 slack, 1 full) bends the limbs back toward the string and draws the tips in
 * a little, and runs the string from each tip through the drawing hand (the main hand,
 * `ctx.rig.armR.end`), so a pose draws the bow by pulling that hand back; slack, the string runs
 * straight from tip to tip. Drawn, the bow turns its back from the drawing hand; slack, it faces
 * where the off hand's angles point it (`weaponB: 0` stands it upright facing ahead). With the
 * pose's `nock` (by default while drawn) an arrow lies on the string, from the drawing hand (or
 * the string's middle when slack) past the grip. The string and arrow sort on their own (`items`),
 * so they can cross in front of the body while the bow is held out beyond it; the string is a
 * single pixel wide, with no line of its own, and passes behind the head (drawn to the cheek, it
 * does not cut across the face).
 *
 * Shots leave from the arrow's head along its line (`aim`: `FxContext.tipB` and `dirB`; once it
 * is loosed, from just ahead of the grip, the way the bow faces), so `fx.flash` and `fx.trail`
 * start there. The arrowhead glows toward its `glow` as the bow blazes (`fx.runeB`: a charged
 * shot).
 *
 * `arrow` makes the arrow alone as a main weapon, for the drawing hand to hold when the bow is
 * not drawn (taking one from the quiver, say); it hides itself while one is on the string, which
 * the bow paints. `NO_WEAPON` (held.ts) leaves the drawing hand empty instead.
 */
import type { RGB, Vec } from '../paint.js';
import { type DrawItem, HEAD_TAG, type Held, type HeldItem, OFFHAND_TAG, type PieceContext, WEAPON_TAG, type WeaponDesign } from './design.js';
import { heldAxes, mainHeld } from './held.js';
import { type Mat, mixc, type Part, type Ramp4 } from './raster.js';
import { add3, type ChibiPose, clamp, len3, lerp3, mul3, norm3, sub3, type V3 } from './rig.js';

export interface ArrowSpec {
  /** Its length from the nock to the point, and its shaft's colour (painted flat, a pixel wide). */
  len: number;
  shaft: Mat;
  /** Its head: `len` long and `w` half-wide at its barbs; it runs toward `glow` as it blazes. */
  head: { len: number; w: number; mat: Mat; glow?: RGB };
  /** Its fletching: vanes `len` long from just ahead of the nock, `w` out from the shaft. */
  fletch: { len: number; w: number; mat: Mat };
}

export interface BowSpec {
  /** Each limb, from the end of the grip to its tip: `len` long, `w0` half-wide at its root and `w1` at its tip. */
  limb: { len: number; w0: number; w1: number; mat: Mat };
  /** The grip in the middle: `len` long, `r` wide, wrapped in its material. */
  grip: { len: number; r: number; mat: Mat };
  /** How far the braced bow's tips stand back toward the string (default 4), and how much further at full draw (default 6). */
  brace?: number;
  bend?: number;
  /** How far the tips curl forward again, away from the archer: a recurve's (default 0, a plain long bow). */
  recurve?: number;
  /** Caps on the tips (horn or metal). */
  tips?: Mat;
  /** The string's colour (painted flat, a pixel wide), and how far short of the drawing hand's middle it stops on screen (default 2: inside the fist). */
  string: Mat;
  gap?: number;
  arrow: ArrowSpec;
}

/** Is an arrow (or a bolt) on the string in this pose? A bow has one while it is drawn, unless the pose says otherwise. */
export const nocked = (pose: ChibiPose): boolean => pose.nock ?? (pose.draw ?? 0) > 0;

const LIMB = 1;
const GRIP = 2;
const TIP = 3;
const SHAFT = 1;
const HEAD = 2;
const FLETCH = 3;
const STEPS = 8;

/** An arrow's head's materials at a few strengths toward its glow, made once (for `paintArrow`). */
export function arrowHeads(a: ArrowSpec): Mat[] {
  const g = a.head.glow;
  return Array.from({ length: STEPS + 1 }, (_, i) => (g ? { ...a.head.mat, tones: a.head.mat.tones.map((c, k) => mixc(c, k < 2 ? [255, 255, 255] : g, (i / STEPS) * 0.7)) as unknown as Ramp4 } : a.head.mat));
}

/**
 * Paints an arrow (or a crossbow's bolt) from its nock along `dir` (hero space) into a part: the
 * shaft, the vanes by the nock and the head at the point, starting `skip` along it (hidden in the
 * fist). `heads` are its head's materials from cold to ablaze (`arrowHeads`), picked by `blaze`.
 */
export function paintArrow(ctx: PieceContext, part: Part, a: ArrowSpec, heads: readonly Mat[], nock: V3, dir: V3, blaze: number, skip: number): void {
  const p = (t: number): V3 => add3(nock, dir, t);
  const P = (t: number): Vec => ctx.proj(p(t));
  const z = (t: number): number => ctx.depth(p(t));
  // Across the arrow on screen, for the vanes and the head's barbs.
  const s0 = P(0);
  const s1 = P(a.len);
  const sl = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
  const n: Vec = sl > 1e-3 ? [-(s1[1] - s0[1]) / sl, (s1[0] - s0[0]) / sl] : [1, 0];
  const across = (t: number, w: number): Vec => {
    const q = P(t);
    return [q[0] + n[0] * w, q[1] + n[1] * w];
  };
  const H = a.head;
  part.line(P(skip), P(a.len - H.len * 0.5), a.shaft, 0.3, z(a.len * 0.5), SHAFT, true);
  const F = a.fletch;
  for (const s of [1, -1]) part.poly([P(1.2), across(1.2 + F.len * 0.35, s * F.w), across(1.2 + F.len, s * F.w * 0.4), P(1.2 + F.len)], F.mat, 0.25, z(1 + F.len / 2) + 0.2, FLETCH);
  const head = heads[Math.round(clamp(blaze, 0, 1) * STEPS)] as Mat;
  part.poly([P(a.len), across(a.len - H.len, H.w), P(a.len - H.len * 0.7), across(a.len - H.len, -H.w)], head, 0.45, z(a.len) + 0.5, HEAD);
}

/** The same arrow with its shaft painted flat (a pixel wide, with no line of its own). */
export const flatShaft = (a: ArrowSpec): ArrowSpec => ({ ...a, shaft: { ...a.shaft, flat: true } });

/** The arrow alone as a main weapon, held at its nock end in the drawing hand: it hides itself while an arrow is on the bow's string (the bow paints that one). */
export function arrow(arrowSpec: ArrowSpec): WeaponDesign {
  const spec = flatShaft(arrowSpec);
  const heads = arrowHeads(spec);
  return {
    grip2: 0,
    reach: [spec.len * 0.5 - 3, spec.len - 3],
    tip: spec.len - 3,
    paint: (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)) => {
      if (held.tag === WEAPON_TAG && nocked(ctx.pose)) return;
      paintArrow(ctx, part, spec, heads, add3(held.grip.o, held.grip.u, -3), held.grip.u, held.blaze, 0);
    },
  };
}

export function bow(spec: BowSpec): HeldItem {
  const L = spec.limb;
  const g = spec.grip.len / 2;
  const brace = spec.brace ?? 4;
  const bend = spec.bend ?? 6;
  const recurve = spec.recurve ?? 0;
  const A = flatShaft(spec.arrow);
  const heads = arrowHeads(A);
  const stringMat: Mat = { ...spec.string, flat: true };
  const N = 7;

  /** The bow's frame in this pose: its grip, along it, and the way its back faces. */
  const frame = (ctx: PieceContext, held: Held): { o: V3; u: V3; v: V3; draw: number; inHand: boolean } => {
    const w = held.grip;
    // Only a bow in the off hand is drawn (not one slung on the back or dropped).
    const inHand = held.tag === OFFHAND_TAG && !ctx.pose.slingB && !ctx.pose.dropB;
    const draw = inHand ? clamp(ctx.pose.draw ?? 0, 0, 1) : 0;
    let v = w.v;
    if (draw > 0) {
      // Drawn, its back turns from the drawing hand (blended in over the first quarter of the draw).
      const away = sub3(w.o, ctx.rig.armR.end);
      const perp = sub3(away, mul3(w.u, away[0] * w.u[0] + away[1] * w.u[1] + away[2] * w.u[2]));
      if (len3(perp) > 2) v = norm3(lerp3(w.v, norm3(perp), clamp(draw * 4, 0, 1)));
    }
    return { o: w.o, u: w.u, v, draw, inHand };
  };
  /** A point of the bow's plane: `s` along it, `t` toward its back. */
  const at3 = (f: { o: V3; u: V3; v: V3 }, s: number, t: number): V3 => add3(add3(f.o, f.u, s), f.v, t);
  /** A limb's centreline: `side` 1 the upper limb, -1 the lower; `k` from its root to its tip. */
  const limbAt = (draw: number, side: number, k: number): [number, number] => {
    const D = brace + bend * draw;
    const reach = L.len * (1 - 0.1 * draw);
    const curl = recurve * Math.pow(Math.max(0, (k - 0.7) / 0.3), 2);
    return [side * (g + reach * k), -D * Math.pow(k, 1.7) + curl];
  };
  /** Where the string is nocked: the drawing hand while drawn, else the middle of the straight string. */
  const nockOf = (ctx: PieceContext, f: { o: V3; u: V3; v: V3; draw: number }): V3 => {
    if (f.draw > 0) return ctx.rig.armR.end;
    const [, t] = limbAt(0, 1, 1);
    return at3(f, 0, t);
  };
  const arrowDir = (f: { o: V3; u: V3; v: V3 }, nock: V3): V3 => {
    const d = sub3(f.o, nock);
    return len3(d) > 3 ? norm3(d) : f.v;
  };

  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const f = frame(ctx, held);
    // On screen, its plane keeps some breadth when it is seen edge on (as a blade's does).
    const ax = heldAxes(ctx, { o: f.o, u: f.u, v: f.v, n: [0, 0, 0] });
    const at = (s: number, t: number): Vec => [ax.o[0] + ax.u[0] * s + ax.v[0] * t, ax.o[1] + ax.u[1] * s + ax.v[1] * t];
    const z = (s: number, t: number): number => ctx.depth(at3(f, s, t));
    for (const side of [1, -1]) {
      let prev = limbAt(f.draw, side, 0);
      for (let i = 1; i <= N; i++) {
        const k = i / N;
        const cur = limbAt(f.draw, side, k);
        const w0 = L.w0 + (L.w1 - L.w0) * ((i - 1) / N);
        const w1 = L.w0 + (L.w1 - L.w0) * k;
        part.capsule(at(prev[0], prev[1]), at(cur[0], cur[1]), w0, w1, L.mat, 0, z(prev[0], prev[1]), z(cur[0], cur[1]), LIMB);
        prev = cur;
      }
      if (spec.tips) {
        const tp = at(prev[0], prev[1]);
        part.ellipse(tp[0], tp[1], L.w1 + 0.6, L.w1 + 0.6, spec.tips, 0.1, z(prev[0], prev[1]) + 0.6, TIP);
      }
    }
    part.capsule(at(-g, 0), at(g, 0), spec.grip.r, spec.grip.r, spec.grip.mat, 0.05, z(-g, 0) + 0.6, z(g, 0) + 0.6, GRIP);
  };

  return {
    reach: [-(g + L.len), g + L.len],
    paint,
    aim: (ctx: PieceContext, held: Held) => {
      const f = frame(ctx, held);
      if (!f.inHand || !nocked(ctx.pose)) return { tip: at3(f, 0, 2), dir: f.draw > 0 ? arrowDir(f, ctx.rig.armR.end) : f.v };
      const nock = nockOf(ctx, f);
      const dir = arrowDir(f, nock);
      return { tip: add3(nock, dir, A.len), dir };
    },
    items: (ctx: PieceContext, held: Held): DrawItem[] => {
      const f = frame(ctx, held);
      const tipsAt = [limbAt(f.draw, 1, 1), limbAt(f.draw, -1, 1)].map(([s, t]) => at3(f, s, t)) as [V3, V3];
      const nock = nockOf(ctx, f);
      const out: DrawItem[] = [];
      // The string from each tip to the nock (one straight line when slack), stopping short of the hand.
      const ax = heldAxes(ctx, { o: f.o, u: f.u, v: f.v, n: [0, 0, 0] });
      const onScreen = (p3: V3): Vec => {
        // The tips sit where the bow's (opened out) plane puts them on screen.
        const d = sub3(p3, f.o);
        const s = d[0] * f.u[0] + d[1] * f.u[1] + d[2] * f.u[2];
        const t = d[0] * f.v[0] + d[1] * f.v[1] + d[2] * f.v[2];
        return [ax.o[0] + ax.u[0] * s + ax.v[0] * t, ax.o[1] + ax.u[1] * s + ax.v[1] * t];
      };
      const gap = spec.gap ?? 2;
      const segs: [V3, V3, boolean][] = f.draw > 0 ? [[tipsAt[0], nock, true], [tipsAt[1], nock, true]] : [[tipsAt[0], tipsAt[1], false]];
      for (const [a3, b3, toHand] of segs) {
        out.push({
          z: ctx.upperZ(ctx.depth(lerp3(a3, b3, 0.5))),
          draw: () => {
            const part = ctx.part(OFFHAND_TAG);
            const a = onScreen(a3);
            let b = toHand ? ctx.proj(b3) : onScreen(b3);
            if (toHand) {
              const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
              if (l > gap) b = [b[0] - ((b[0] - a[0]) / l) * gap, b[1] - ((b[1] - a[1]) / l) * gap];
            }
            // It never crosses the head: drawn to the cheek, it passes behind the face.
            part.clip = (x, y) => ctx.owner[y * ctx.c.w + x] !== HEAD_TAG;
            part.line(a, b, stringMat, 0, ctx.depth(lerp3(a3, b3, 0.5)), 1, true);
            part.clip = null;
            part.commit();
          },
        });
      }
      if (f.inHand && nocked(ctx.pose)) {
        const dir = arrowDir(f, nock);
        out.push({
          z: ctx.upperZ(ctx.depth(add3(nock, dir, A.len * 0.5))) + 0.05,
          draw: () => {
            const part = ctx.part(OFFHAND_TAG);
            paintArrow(ctx, part, A, heads, nock, dir, held.blaze, f.draw > 0 ? 1.5 : 0);
            part.commit();
          },
        });
      }
      return out;
    },
  };
}
