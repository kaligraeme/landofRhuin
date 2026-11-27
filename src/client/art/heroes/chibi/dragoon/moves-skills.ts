/**
 * The Dragoon's skills, in the chibi pose format (rig.ts, ChibiPose), with a few effects of
 * their own painted through `fx.extra`. Wind-up frames come first; none of his skills has a
 * server wind-up, so they take 0.06 s each and the rest share the clip's seconds. A weapon skill's
 * clip is named after its hotbar slot.
 *
 *   special   7  (1 wind-up) Sweeping Strike: wound up to his right with the haft held low and
 *                level, then swung round low and wide through 200 degrees in front of him, a level
 *                violet arc trailing the point and a gust of violet energy kicked up off the floor
 *   q         8  (2 wind-up) Piercing Thrust: drawn far back and low while the point gathers its
 *                glow, then a deep lunge, the front hand sliding up the haft, a long spiral of
 *                violet energy off the point well past it
 *   e        11  (1 wind-up) Vault Strike, the dragoon's jump: a deep crouch with violet light
 *                gathering at his feet, a launch straight up with a ring on the floor and a beam
 *                rising under him, out of the top of the frame for two frames (only the beam he
 *                left and a glint where he turns over high above), then a dive back in point first,
 *                a violet beam trailing down out of the sky behind him and energy spiralling round
 *                the point, the cape spread like wings; the point driven into the floor as he
 *                lands, a burst of rays and a ring, dust. The server moves him to his aim at once,
 *                so it plays in place.
 *   r        10  (1 wind-up) Whirling Lance: two fast turns with the haft held level at its
 *                middle in both hands, a violet ring round him that trails the point, the cape and
 *                ponytail flung out
 *   ult      12  (2 wind-up) Skewer: the lance couched low under his arm, a crouch while the
 *                energy gathers, then a charge in long bounding strides, crisp violet echoes of
 *                his silhouette a stride apart behind him and a spearhead of light sheathing the
 *                point, a great burst and a bright ring at the point, and a skidding stop. The
 *                server moves him, so it plays in place.
 *   cast      8  (2 wind-up) role skills (Bloodrush, Second Wind) and the Elixir: the lance
 *                lifted upright beside his shoulder, spun once level round his hips and planted
 *                upright beside him, a flare of violet rays behind him and a burst round him
 *
 * The poses build on the battle stance (moves-core.ts READY); each clip starts from it
 * (`fromReady`) and its last frames ease back into it (`settle`), so the loop takes over smoothly.
 */
import type { RGB, Vec } from '../../paint.js';
import { DUST, DUST_DARK, glowLine, puff } from '../fx.js';
import { scanPoly } from '../raster.js';
import { add3, type ChibiPose, clamp, cross3, type FxContext, norm3, pose, solveRig, type V3 } from '../rig.js';
import { DRAGOON } from './design.js';
import { alongOf, both, drill, flash, fromReady, gust, headUp, READY, settle, streak, thrust, tipOf, withExtra } from './moves-core.js';

const S = READY;
const BUILD = DRAGOON.build;
const W = DRAGOON.weapon;
const TIP = W.tip ?? W.reach[1];

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

const FURROW: RGB = [62, 54, 50];

/**
 * A skid (strength k): furrows ploughed behind his boots, a bank of dust and grit thrown up ahead
 * of them.
 */
const skid =
  (k: number) =>
  (x: FxContext): void => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 22 * k, 0, g[2]]);
      glowLine(x.c, a, b, FURROW, 0.85 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.55 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3.4 - i * 0.7) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.6 * k);
      }
      for (let i = 0; i < 7; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 13 * k, hash(i, s + 81) * 10 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        const col: RGB = i % 3 === 0 ? x.aura.core : i % 3 === 1 ? DUST : DUST_DARK;
        x.c.glow(p[0], p[1], col, 0.95 * k);
        x.c.glow(p[0] + 1, p[1], col, 0.7 * k);
      }
    }
  };

/** A burst of violet energy at the point: white streaks thrown out round it (strength k). */
const burstAt =
  (at: 'tip' | V3, k: number) =>
  (x: FxContext): void => {
    const p = x.proj(at === 'tip' ? x.tip : at);
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * Math.PI * 2 + x.hash(i, 131) * 0.4;
      const r0 = 6 + 4 * k;
      const r1 = r0 + (6 + x.hash(i, 132) * 8) * k;
      glowLine(x.c, [p[0] + Math.cos(th) * r0, p[1] + Math.sin(th) * r0 * 0.7], [p[0] + Math.cos(th) * r1, p[1] + Math.sin(th) * r1 * 0.7], i % 2 ? x.aura.core : x.aura.hot, 0.85 * k);
    }
  };

/** The violet body of a ring: between the aura's core and its pale lilac edge. */
const RING_VIOLET: RGB = [180, 140, 255];

/**
 * A level ring of violet wind swept round him by the lance's head (strength k): from `from` to
 * `to` degrees round him (as the engine's `fx.ring`: 90 his right, 0 ahead, in the turn-0 frame)
 * at `height` above the floor, `radius` out (default the lance's reach), a crescent `radius` / 2
 * deep that thickens and brightens toward its head. Its outer rim is the pale lilac edge, then a
 * band of violet, then the core colour fading inward; only the head's leading edge is white. The
 * half behind him goes under the figure. It stops at the floor.
 */
const ringArc =
  (from: number, to: number, height: number, radius = TIP + 4, k = 1) =>
  (x: FxContext): void => {
    const { c, aura, rig } = x;
    const turn = x.rig.pose.turn ?? 0;
    const centre: V3 = [rig.pelvis.o[0], height, rig.pelvis.o[2]];
    const n = Math.max(2, Math.ceil(Math.abs(to - from) / 5));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = (((from + ((to - from) * i) / n) - turn) * Math.PI) / 180;
      dirs.push([Math.cos(a), 0, Math.sin(a)]);
    }
    const thick = radius * 0.5;
    const bands: [number, number, RGB, number][] = [
      [0, 0.1, aura.edge, 0.95],
      [0.1, 0.4, RING_VIOLET, 0.78],
      [0.4, 0.75, aura.core, 0.45],
      [0.75, 1, aura.core, 0.16],
    ];
    const at = (d: V3, r: number): Vec => {
      const p = add3(centre, d, r);
      return x.proj(p[1] < 0.5 ? [p[0], 0.5, p[2]] : p);
    };
    for (let i = 0; i < n; i++) {
      const k0 = i / n;
      const k1 = (i + 1) / n;
      const th = (q: number): number => thick * Math.pow(Math.sin((Math.min(1, q * 1.08) * Math.PI) / 2), 0.9);
      const fade = k * (0.3 + 0.7 * Math.pow(k1, 1.1));
      const da = dirs[i] as V3;
      const db = dirs[i + 1] as V3;
      const under = x.depth(add3(centre, add3(da, db), radius / 2)) < x.depth(centre) - 1;
      for (const [f0, f1, col, a] of bands) {
        const quad = [at(da, radius - f0 * th(k0)), at(db, radius - f0 * th(k1)), at(db, radius - f1 * th(k1)), at(da, radius - f1 * th(k0))];
        scanPoly(quad, c.w, c.h, (px, py) => c.glow(px, py, col, a * fade, under));
      }
      // A white line along the leading edge of its head.
      if (k1 > 0.86) glowLine(c, at(da, radius), at(db, radius), aura.hot, k * 0.9 * (k1 - 0.86) / 0.14, under);
    }
  };

// ── Sweeping Strike ──────────────────────────────────────────────────────────────────────────

/**
 * The sweep: the haft held low and nearly level in both hands, its head out at shin height, the
 * hands far enough up the haft that seen end on (coming at the viewer) the point stays by his feet
 * rather than dipping below them; `sweep` is where the head points, in degrees round him in the
 * turn-0 frame (90 his right, 0 ahead, -90 his left). The body turns into it and the haft's yaw
 * does the rest; the head turns back against the body's turn, so he keeps his face to the viewer,
 * looking along the sweep.
 */
const sweepPose = (sweep: number, turn: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(S, {
    x: 1,
    y: 11,
    lean: 14,
    twist: (sweep - turn) * 0.12,
    turn,
    head: 4,
    look: 6 - turn * 0.9,
    footF: [-13, 0, 6.5],
    footB: [12, 0, 7],
    handF: [3, 18, 8],
    weapon: 97,
    roll: 0,
    yaw: sweep - turn,
    grip: -3,
    grip2: 11,
    wind: 0.6,
    flare: 0.5,
    face: 'shout',
    ...over,
  });

const special: ChibiPose[] = [
  // Wound up: the haft drawn back round to his right, low, the head behind him.
  fromReady(sweepPose(128, 40, { y: 9, lean: 10, twist: 20, handF: [0, 17, 10], wind: 0.3, flare: 0, sway: 0.4, face: 'grit', fx: { rune: 0.6 } }), 0.85),
  sweepPose(60, 20, { phase: 0.15, sway: 0.3, fx: { rune: 1, dust: 0.4, extra: ringArc(128, 60, 16) } }),
  sweepPose(-15, -10, { phase: 0.3, wind: 0.8, sway: -0.2, fx: { rune: 1, dust: 0.8, extra: both(ringArc(128, -15, 16), gust(0.1)) } }),
  sweepPose(-72, -30, { phase: 0.45, wind: 0.9, flare: 0.8, sway: -0.5, fx: { rune: 1, dust: 1, extra: both(ringArc(60, -72, 16), gust(0.45)) } }),
  // Follow-through, the gust blowing out.
  sweepPose(-96, -34, { y: 10, lean: 12, phase: 0.6, wind: 0.6, flare: 0.6, sway: -0.6, face: 'grit', fx: { rune: 0.6, extra: both(ringArc(-40, -96, 16, TIP + 4, 0.7), gust(0.8)) } }),
  settle(sweepPose(-90, -30, { y: 9, face: 'stern', wind: 0.4, flare: 0.3 }), 0.55, { turn: -14, phase: 0.8, face: 'stern', fx: { extra: gust(1) } }),
  settle(sweepPose(-90, -30), 0.9, { turn: -3, phase: 1, wind: 0.78, fx: undefined }),
];

// ── Piercing Thrust ──────────────────────────────────────────────────────────────────────────

// Drawn right back: the right hand far behind him and high on the haft, so the point comes in
// close in front of his lead hip and the butt reaches far behind, the haft canted across him so
// toward the viewer its length and point still show; weight on the back foot. Then
// the lunge drives the haft out through the lead hand nearly its whole length, the right hand
// sliding back to the butt end.
const Q_DRAW = pose(S, { x: -6, y: 10, lean: 0, twist: 34, head: headUp(0, 4), look: -8, footF: [-15, 0, 5.2], footB: [8, 0, 5.6], handF: [-15, 15, 9], weapon: 82, yaw: -38, grip: 12, grip2: 30, wind: 0.3, lift: 0.2, sway: 0.3, face: 'grit', fx: { rune: 0.6, aura: 0.2 } });
const Q_COIL = pose(Q_DRAW, { x: -7, y: 12, lean: 2, twist: 38, head: headUp(2, 4), handF: [-16, 16, 9], weapon: 80, wind: 0.35, lift: 0.35, phase: 0.1, fx: { rune: 1, aura: 0.55 } });
const Q_LUNGE = pose(S, { x: 14, y: 12, lean: 26, twist: 0, head: headUp(26), look: -2, footF: [-12, 0, 5], footB: [26, 0, 6], handF: [13, 11, 4], weapon: 80, yaw: -28, grip: -24, grip2: 36, wind: 1.2, phase: 0.3, face: 'shout', fx: { rune: 1, aura: 0.5, dust: 1, speed: 0.6 } });
const Q_MID = pose(Q_LUNGE, { x: 8, y: 9, lean: 18, head: headUp(18), footB: [20, -2, 6], handF: [7, 12, 5], grip: -10, grip2: 30, wind: 0.9, phase: 0.2, fx: { rune: 1, aura: 0.6, speed: 0.4 } });
const q: ChibiPose[] = [
  fromReady(Q_DRAW, 0.85),
  Q_COIL,
  drill(thrust(Q_MID, 0.8, 4, 36), 0.8, 0.05, 30, 9),
  drill(withExtra(thrust(Q_LUNGE, 1, 6, 56), flash(1.4)), 1.5, 0.2, 72, 13),
  drill(pose(Q_LUNGE, { y: 12.5, lean: 27, head: headUp(27), wind: 1, lift: 0.15, phase: 0.45, face: 'grit', fx: { rune: 1, aura: 0.4, dust: 0.6, extra: streak(alongOf(Q_LUNGE, 56), tipOf(Q_LUNGE), 0.4, 6) } }), 1.2, 0.4, 72, 13),
  drill(pose(Q_LUNGE, { y: 12, lean: 25, head: headUp(25), handF: [11, 12, 5], wind: 0.7, lift: 0.35, phase: 0.6, face: 'grit', fx: { rune: 0.7 } }), 0.6, 0.6, 72, 13),
  drill(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, head: headUp(18), handF: [5, 14, 6], weapon: 76, grip: -16, grip2: 26, wind: 0.5, lift: 0.3, phase: 0.75, face: 'stern', fx: { rune: 0.4 } }), 0.2, 0.8, 72, 13),
  settle(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, head: headUp(18), handF: [5, 14, 6], weapon: 76, grip: -16, grip2: 26 }), 0.9, { wind: 0.78, lift: 0.1, phase: 0.9, face: 'stern', fx: undefined }),
];

// ── Vault Strike: the dragoon's jump ─────────────────────────────────────────────────────────

/**
 * Sets the lance's angle and the right hand's place along it so that the lance runs through the
 * right hand where the pose puts it (`handF`) with its point at a point in hero space, the left
 * hand a little above the right: the dive drives the point into the floor this way.
 */
function pointAt(p: ChibiPose, at: V3): ChibiPose {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const h = rig.armR.end;
  const d: V3 = [at[0] - h[0], at[1] - h[1], at[2] - h[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const u: V3 = [d[0] / len, d[1] / len, d[2] / len];
  const deg = (r: number): number => (r * 180) / Math.PI;
  const flat = Math.hypot(u[1], u[2]) * (u[1] < 0 ? -1 : 1);
  const weapon = deg(Math.atan2(u[0], flat));
  const roll = u[1] < 0 ? deg(Math.atan2(-u[2], -u[1])) : deg(Math.atan2(u[2], u[1]));
  const grip = TIP - len;
  return { ...p, weapon, roll, yaw: 0, grip, grip2: grip + 9 };
}

/** Where the point strikes the floor on landing (a little under it: it bites in), and the burst on the floor round it. */
const STRIKE: V3 = [22, -7, 10];
const BURST: V3 = [22, 0, 10];

/** Out of the frame: his pelvis this far above the floor is above the top of every view's frame (with his lance), so only the trail he leaves shows. */
const GONE = -300;

/**
 * The energy gathering round the point as he dives: a cone opening back up the lance from just
 * past the point, so the swirl leads the point down.
 */
const diveWind = (p: ChibiPose, k: number, spin: number): ChibiPose => {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const w = rig.weapon;
  return { ...p, fx: { ...p.fx, swirl: { k, spin, from: add3(w.o, w.u, TIP + 3), to: add3(w.o, w.u, TIP - 28), radius: 2, taper: 4.5, turns: 1.6 } } };
};

/**
 * A beam of his violet light from `a` to `b` (hero space): a point at `a` widening to `w` either
 * side at `b`, where it is brightest (where he is now): violet through its body with pale lilac
 * rims, a white-hot line down its middle only near `b`, and violet sparks shed off it either side;
 * `k` its strength. The streak of his jump: rising from the floor under him, and trailing down out
 * of the sky behind him as he dives. It goes under the figure, so where it meets him he covers it.
 */
const beam =
  (a: V3, b: V3, k: number, w = 4) =>
  (x: FxContext): void => {
    const A = x.proj(a);
    const B = x.proj(b);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (L < 2 || k <= 0) return;
    const d: Vec = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    const n: Vec = [-d[1], d[0]];
    const under = true;
    for (let s = 0; s <= L; s++) {
      const t = s / L;
      const half = 0.6 + w * Math.pow(t, 0.45);
      const a2 = k * (0.35 + 0.65 * t);
      for (let o = -Math.ceil(half); o <= Math.ceil(half); o++) {
        const r = Math.abs(o) / half;
        if (r > 1) continue;
        const hot = r < 0.2 && t > 0.7;
        const col: RGB = hot ? x.aura.hot : r < 0.72 ? RING_VIOLET : x.aura.edge;
        x.c.glow(Math.round(A[0] + d[0] * s + n[0] * o), Math.round(A[1] + d[1] * s + n[1] * o), col, a2 * (hot ? 1 : r < 0.72 ? 0.8 : 0.6), under);
      }
    }
    // Violet sparks shed off it, drifting out to either side.
    for (let i = 0; i < 14; i++) {
      const t = 0.15 + 0.83 * x.hash(i, 171);
      const side = (x.hash(i, 172) - 0.5) * (w * 2 + 12);
      const px = A[0] + d[0] * L * t + n[0] * side;
      const py = A[1] + d[1] * L * t + n[1] * side;
      const a2 = k * (0.5 + 0.5 * t);
      x.c.glow(px, py, i % 4 ? x.aura.edge : x.aura.hot, a2, under);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) x.c.glow(px + dx, py + dy, x.aura.core, a2 * 0.6, under);
    }
  };

/** The streak he leaves rising, from the floor straight up to `top` (brightest at its top, where he is), `w` wide there. */
const rise = (k: number, top: number, w = 4): ((x: FxContext) => void) => beam([2, 2, 0], [2, top, 0], k, w);

/**
 * A glint high above where he turns over at the top of the jump, out of the frame: a four-pointed
 * star of white light with a violet halo, `k` its size (1 = rays 9 pixels long).
 */
const glintAt =
  (at: V3, k: number) =>
  (x: FxContext): void => {
    const [px, py] = x.proj(at);
    const r = Math.round(9 * k);
    for (let i = -r; i <= r; i++) {
      const a2 = 1 - Math.abs(i) / (r + 1);
      x.c.glow(px + i, py, x.aura.hot, a2);
      x.c.glow(px, py + i, x.aura.hot, a2);
    }
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) if (Math.abs(i) + Math.abs(j) <= 3) x.c.glow(px + i, py + j, x.aura.core, (4 - Math.abs(i) - Math.abs(j)) * 0.2);
  };

/**
 * Diving, the point leading: riding the lance down at his right side, both hands low on it by his
 * hip and out from his body, the point in under him and the butt tipped out away from his head, so
 * the shaft runs up beside his head rather than across his face in every view; his knees tucked,
 * the cape and ponytail streaming up behind him.
 */
const dive = (y: number, over: Partial<ChibiPose>): ChibiPose =>
  pose(S, { x: 6, y, lean: 4, twist: 4, head: headUp(4, 4), look: -4, footF: [-6, y - 13, 5], footB: [-12, y - 8, 5], handF: [6, 14, 17], wind: 0.45, lift: 0.5, face: 'shout', ...over });

const e: ChibiPose[] = [
  // Wind-up: a deep crouch, the lance drawn in upright at his right side, violet light gathering
  // at his feet.
  fromReady(pose(S, { x: -1, y: 15, lean: 14, twist: 6, head: headUp(14, 0), look: -4, footF: [-9, 0, 6], footB: [8, 0, 6.5], handF: [-6, 15, 12], weapon: -30, roll: 10, yaw: 0, grip: -2, grip2: -20, wind: 0.2, lift: 0.3, face: 'grit', fx: { rune: 0.6, aura: 0.6, circle: 0.6, dust: 0.4 } }), 0.9),
  // The launch: straight up off both feet, body at full stretch, the lance held upright before
  // him, a burst of dust and a ring on the floor, the streak rising under him.
  pose(S, { x: 1, y: -54, lean: -4, twist: 4, head: -6, look: -4, footF: [0, -51, 4.5], footB: [-3, -47, 4.5], handF: [-6, 5, 12], weapon: -28, roll: 10, yaw: 0, grip: -4, grip2: -18, wind: -0.4, lift: -0.6, phase: 0.1, face: 'shout', fx: { rune: 1, aura: 0.8, dust: 1, shock: 0.12, shockAt: [0, 0, 0], extra: rise(1, 50, 5) } }),
  // Gone: out of the top of the frame, only the streak he left and the ring rolling out.
  pose(S, { y: GONE, phase: 0.2, fx: { shock: 0.45, shockAt: [0, 0, 0], dust: 0.5, extra: rise(1, 172, 6) } }),
  // High above, turning over: the streak fading, a glint where he turns at the top.
  pose(S, { y: GONE, phase: 0.3, fx: { shock: 0.75, shockAt: [0, 0, 0], extra: both(rise(0.4, 150, 3), glintAt([12, 168, 4], 1)) } }),
  // The dive: back into the top of the frame point first, a violet streak behind him and the
  // energy gathering round the point.
  diveWind(pointAt(dive(-92, { phase: 0.4, fx: { rune: 1, aura: 1, extra: beam([-2, 186, 0], [6, 150, 2], 1, 6) } }), [34, 44, 2]), 0.8, 0.1),
  diveWind(pointAt(dive(-36, { lean: 8, head: headUp(8, 4), phase: 0.5, fx: { rune: 1, aura: 1, speed: 0.5, extra: beam([-2, 186, 0], [6, 94, 2], 1, 7) } }), [32, 6, 2]), 1.1, 0.35),
  // The strike: the point driven into the floor as he lands, crouched over it: a violet burst of
  // rays and a ring on the floor, dust.
  pointAt(pose(S, { x: 6, y: 13, lean: 20, twist: 2, head: headUp(20, -2), look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10, 12], wind: 0.5, lift: 0.35, phase: 0.6, face: 'shout', fx: { rune: 1, aura: 0.8, impact: 1.5, impactAt: BURST, rays: { k: 1, at: BURST, n: 10, len: 34 }, shock: 0.06, shockAt: BURST, dust: 1, extra: gust(0.05, 26) } }), STRIKE),
  pointAt(pose(S, { x: 6, y: 12, lean: 19, twist: 2, head: headUp(19, -2), look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10.5, 12], wind: 0.5, lift: 0.4, phase: 0.7, face: 'grit', fx: { rune: 0.8, aura: 0.4, rays: { k: 0.45, at: BURST, n: 10, len: 40, spin: 10 }, shock: 0.45, shockAt: BURST, dust: 0.6, extra: gust(0.5, 26) } }), STRIKE),
  // Pulled free, rising toward the stance as the energy blows out.
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, head: headUp(20, 4), footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [8, 10, 6], weapon: 120, roll: 0, yaw: -10, grip: -12, grip2: 10 }), 0.45, { wind: 0.5, lift: 0.2, phase: 0.85, face: 'stern', fx: { shock: 0.85, shockAt: BURST, extra: gust(0.9, 26) } }),
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, handF: [8, 10, 6], weapon: 120, yaw: -10, grip: -12, grip2: 10 }), 0.75, { phase: 0.95, fx: undefined }),
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, handF: [8, 10, 6], weapon: 120, yaw: -10, grip: -12, grip2: 10 }), 0.93, { phase: 1.05, fx: undefined }),
];

// ── Whirling Lance ───────────────────────────────────────────────────────────────────────────

/** Where the spin starts (the wind-up's turn) and how far round each spin frame is: two fast turns. */
const WHIRL_FROM = -20;
const WHIRL = [45, 135, 225, 315, 405, 495, 585, 665];

function whirl(i: number): ChibiPose {
  const turn = WHIRL[i - 1] as number;
  // The head is out to his right: the ring trails it round.
  const to = turn + 90;
  return pose(S, {
    x: 0,
    y: 6,
    lean: 6,
    twist: 4,
    turn,
    head: 1,
    look: -14,
    footF: [-8, 0, 6.5],
    footB: [8, 0, 6.5],
    handF: [6, 12, 4],
    weapon: 90,
    roll: 0,
    yaw: 88,
    grip: 4,
    grip2: -6,
    face: 'shout',
    wind: 0.5,
    flare: 1,
    sway: -0.6,
    phase: i / 8,
    fx: { rune: 1, aura: 0.3, swirl: { k: 0.8, on: 'body', spin: i / 6 }, extra: ringArc(Math.max(WHIRL_FROM + 90, to - 300), to, 40) },
  });
}

const r: ChibiPose[] = [
  // Wind-up: a coil to his left, his chest wound round but his face still to the viewer, the haft
  // drawn level across in front of him, its head out past his left hip.
  fromReady(pose(S, { y: 8, lean: 10, twist: -28, turn: WHIRL_FROM, head: 3, look: 30, footF: [-8, 0, 6.5], footB: [8, 0, 6.5], handF: [7, 12, -2], weapon: 90, roll: 0, yaw: -62, grip: 4, grip2: -6, face: 'grit', wind: 0.3, sway: 0.4, fx: { rune: 0.7, aura: 0.2 } }), 0.85),
  whirl(1),
  whirl(2),
  whirl(3),
  whirl(4),
  whirl(5),
  whirl(6),
  whirl(7),
  // The ring closes and the slowing energy rolls out over the floor and blows out, gone before the
  // last frame so the stance takes over cleanly.
  pose(whirl(8), { fx: { rune: 0.8, aura: 0.2, shock: 0.55, shockAt: [0, 0, 0], extra: both(ringArc((WHIRL[7] as number) + 90 - 320, (WHIRL[7] as number) + 90, 40, TIP + 4, 0.8), gust(0.85, 24)) } }),
  settle(pose(S, { y: 6, lean: 8, twist: 10, turn: 720, handF: [2, 15, 7], weapon: 70, yaw: -20, flare: 0.5, wind: 0.4 }), 0.85, { turn: 720, flare: 0.3, wind: 0.78, lift: 0.05, fx: undefined }),
];

// ── Skewer ───────────────────────────────────────────────────────────────────────────────────

/**
 * The charge: low, the lance couched under his right arm, the point forward and a little down,
 * turned a little across toward his left so that toward the viewer the lance still shows its
 * length down the screen.
 */
const COUCH: ChibiPose = pose(S, { x: 10, y: 6, lean: 30, twist: 14, head: headUp(30, 1), look: -4, handF: [0, 17, 6], weapon: 94, roll: 0, yaw: -30, grip: -20, grip2: 16, face: 'shout', wind: 1.2, lift: 0.1 });

/** A screen polygon's convex hull (Andrew's monotone chain), counter-clockwise on screen. */
function hull(pts: readonly Vec[]): Vec[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const turn = (o: Vec, a: Vec, b: Vec): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec[] = [];
  for (const q of p) {
    while (lower.length >= 2 && turn(lower[lower.length - 2] as Vec, lower[lower.length - 1] as Vec, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Vec[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i] as Vec;
    while (upper.length >= 2 && turn(upper[upper.length - 2] as Vec, upper[upper.length - 1] as Vec, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** How far the cone runs past the point, back from it along the lance, and how wide its mouth is. */
const CONE_AHEAD = 13;
const CONE_BACK = 16;
const CONE_R = 7.5;

/**
 * The cone of energy he drives before him (strength k; `spin` turns its streaks, advance it frame
 * by frame): a spearhead of violet light sheathing the lance's point, its apex well ahead of the
 * point and its mouth, fourteen pixels across, back round the vamplate: violet within, rimmed in
 * the pale lilac edge, a white-hot core along the lance's line to the apex and two streaks winding
 * round it. Seen end on (charging at the viewer or away) it would close up into a flat disc, so it
 * turns into a starburst of spikes round the point instead, in proportion.
 */
const cone =
  (k: number, spin: number) =>
  (x: FxContext): void => {
    const { c, aura } = x;
    const u = x.rig.weapon.u;
    const tip = x.tip;
    const ref: V3 = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm3(cross3(u, ref));
    const e2 = cross3(u, e1);
    const apex = add3(tip, u, CONE_AHEAD);
    const mouth = add3(tip, u, -CONE_BACK);
    const L = CONE_AHEAD + CONE_BACK;
    const on = (d: number, th: number): V3 => {
      const r = CONE_R * (1 - (d + CONE_BACK) / L);
      return add3(add3(add3(tip, u, d), e1, Math.cos(th) * r), e2, Math.sin(th) * r);
    };
    const A = x.proj(apex);
    const M = x.proj(mouth);
    const P = x.proj(tip);
    const under = x.behind(tip);
    // How far along the screen the cone runs, as a share of its length: 1 side on, 0 end on.
    const seen = clamp(Math.hypot(A[0] - M[0], A[1] - M[1]) / L, 0, 1);
    const side = clamp((seen - 0.18) / 0.37, 0, 1);
    const ring: Vec[] = [];
    for (let j = 0; j < 24; j++) ring.push(x.proj(on(-CONE_BACK, (j / 24) * Math.PI * 2)));
    if (side > 0) {
      // The fill: the whole cone in violet, an inner cone brighter, fading toward the mouth.
      const outer = hull([A, ...ring]);
      scanPoly(outer, c.w, c.h, (px, py) => {
        const t = clamp(((px + 0.5 - A[0]) * (M[0] - A[0]) + (py + 0.5 - A[1]) * (M[1] - A[1])) / ((M[0] - A[0]) ** 2 + (M[1] - A[1]) ** 2 || 1), 0, 1);
        c.glow(px, py, aura.core, k * side * (0.6 - 0.25 * t), under);
      });
      const inner = hull([A, ...ring.map((q): Vec => [M[0] + (q[0] - M[0]) * 0.45, M[1] + (q[1] - M[1]) * 0.45])]);
      scanPoly(inner, c.w, c.h, (px, py) => c.glow(px, py, RING_VIOLET, k * side * 0.6, under));
      // The rims: the cone's two edges from the apex and the near half of its mouth, pale lilac.
      const i = outer.findIndex((q) => q === A);
      if (i >= 0) {
        for (const j of [i - 1, i + 1]) {
          const q = outer[(j + outer.length) % outer.length] as Vec;
          glowLine(c, A, q, aura.edge, k * side * 0.95, under);
        }
      }
      ring.forEach((q, j) => {
        const back = x.depth(on(-CONE_BACK, (j / 24) * Math.PI * 2)) < x.depth(mouth);
        glowLine(c, q, ring[(j + 1) % ring.length] as Vec, back ? aura.core : aura.edge, k * side * (back ? 0.4 : 0.8), under);
      });
      // Two streaks winding round it from the mouth to the apex.
      for (let s2 = 0; s2 < 2; s2++) {
        let prev: Vec | null = null;
        for (let n = 0; n <= 16; n++) {
          const t = n / 16;
          const q3 = on(-CONE_BACK + L * t, Math.PI * 2 * (t * 1.2 + spin + s2 / 2));
          const q = x.proj(q3);
          if (prev && x.depth(q3) >= x.depth(add3(tip, u, -CONE_BACK + L * t))) glowLine(c, prev, q, aura.edge, k * side * 0.7 * (0.4 + 0.6 * t), under);
          prev = q;
        }
      }
    }
    if (side < 1) {
      // End on: a starburst of spikes round the point, white-hot at their roots, violet outward.
      const n = 10;
      for (let j = 0; j < n; j++) {
        const th = (j / n) * Math.PI * 2 + spin * 0.8;
        const len = (j % 2 ? 10 : 17) * (0.8 + 0.4 * x.hash(j, 191));
        const ex = P[0] + Math.cos(th) * len;
        const ey = P[1] + Math.sin(th) * len * 0.85;
        const steps = Math.ceil(len);
        for (let q = 0; q <= steps; q++) {
          const t = q / steps;
          const w = (1 - t) * 1.6;
          const px = P[0] + (ex - P[0]) * t;
          const py = P[1] + (ey - P[1]) * t;
          const col: RGB = t < 0.3 ? aura.hot : t < 0.7 ? RING_VIOLET : aura.edge;
          c.glow(px, py, col, k * (1 - side) * (1 - t * 0.6), under);
          if (w > 0.8) {
            c.glow(px - Math.sin(th), py + Math.cos(th), aura.core, k * (1 - side) * 0.6 * (1 - t), under);
            c.glow(px + Math.sin(th), py - Math.cos(th), aura.core, k * (1 - side) * 0.6 * (1 - t), under);
          }
        }
      }
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.hypot(dx, dy);
          if (d <= 4.2) c.glow(P[0] + dx, P[1] + dy, d < 2 ? aura.hot : RING_VIOLET, k * (1 - side) * (d < 2 ? 1 : 0.55), under);
        }
      }
    }
    // The white-hot core along the lance's line, from just behind the point to the apex.
    const B = x.proj(add3(tip, u, -4));
    const n = Math.max(1, Math.ceil(Math.hypot(A[0] - B[0], A[1] - B[1])));
    const nx = -(A[1] - B[1]) / n;
    const ny = (A[0] - B[0]) / n;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      for (const o of [-0.5, 0.5]) c.glow(B[0] + (A[0] - B[0]) * t + nx * o, B[1] + (A[1] - B[1]) * t + ny * o, t < 0.75 ? aura.hot : aura.edge, k * (1 - 0.3 * t), under);
    }
  };

/**
 * Crisp afterimages of his whole silhouette as painted (strength k): `n` copies trailing a stride
 * apart behind him on screen (however the charge runs in this view: foreshortened toward or away
 * from the viewer), each flat violet with a pale lilac rim round its outline, at about 55%, 35%
 * and 15%, so his fins, cape and couched lance read in every echo. Each shows only where it sticks
 * out past him and the nearer echoes, so they step back in clean layers; they lie under the figure.
 */
const echoes =
  (k: number, n = 3, gap = 26) =>
  (x: FxContext): void => {
    const { c, cam, aura } = x;
    let v = cam.vec([-1, 0, 0]);
    const vl = Math.hypot(v[0], v[1]);
    const short = clamp(vl / 0.85, 0.45, 1);
    v = vl > 1e-3 ? [(v[0] / vl) * short, (v[1] / vl) * short] : [0, -short];
    const taken = new Uint8Array(c.w * c.h);
    const pts: number[] = [];
    for (let y = 0; y < c.h; y++) {
      for (let xx = 0; xx < c.w; xx++) {
        if (!c.opaque(xx, y)) continue;
        taken[y * c.w + xx] = 1;
        pts.push(xx, y);
      }
    }
    const strengths = [0.55, 0.35, 0.15];
    for (let i = 1; i <= n; i++) {
      const dx = Math.round(v[0] * gap * i);
      const dy = Math.round(v[1] * gap * i);
      const a = k * (strengths[i - 1] ?? 0.1);
      const inside = (px: number, py: number): boolean => c.opaque(px - dx, py - dy);
      const mine: number[] = [];
      for (let j = 0; j < pts.length; j += 2) {
        const px = (pts[j] as number) + dx;
        const py = (pts[j + 1] as number) + dy;
        if (px < 0 || py < 0 || px >= c.w || py >= c.h || taken[py * c.w + px]) continue;
        const rim = !inside(px - 1, py) || !inside(px + 1, py) || !inside(px, py - 1) || !inside(px, py + 1);
        c.glow(px, py, rim ? aura.edge : RING_VIOLET, rim ? Math.min(1, a * 1.3) : a, true);
        mine.push(py * c.w + px);
      }
      for (const m of mine) taken[m] = 1;
    }
  };

/** A ring of violet energy thrown out round the point (radius r on screen, strength k): two pixels thick, pale lilac at its rim. */
const shockAt =
  (r: number, k: number) =>
  (x: FxContext): void => {
    const p = x.proj(x.tip);
    const n = Math.ceil(r * 8);
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2;
      for (const [dr, col, a] of [[0.5, x.aura.edge, 1], [-0.5, RING_VIOLET, 0.9], [-1.5, x.aura.core, 0.4], [1.5, x.aura.core, 0.25]] as const) {
        x.c.glow(p[0] + Math.cos(th) * (r + dr), p[1] + Math.sin(th) * (r + dr) * 0.8, col, a * k);
      }
    }
  };

const ult: ChibiPose[] = [
  // Couched and crouching, the energy gathering round the point.
  fromReady(pose(COUCH, { x: -3, y: 11, lean: 22, twist: 22, head: headUp(22, 2), footF: [-15, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17, 7], face: 'grit', wind: 0.3, lift: 0.2, fx: { rune: 0.8, aura: 0.6, dust: 0.4 } }), 0.85),
  pose(COUCH, { x: -4, y: 13, lean: 24, twist: 24, head: headUp(24, 2), footF: [-16, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17.5, 7], face: 'grit', wind: 0.4, lift: 0.5, phase: 0.1, fx: { rune: 1, aura: 1, dust: 0.6, extra: cone(0.45, 0) } }),
  // Launch: the back leg drives off, the front knee comes through.
  pose(COUCH, { x: 6, y: 6, footF: [-18, 0, 5], footB: [14, -7, 5], phase: 0.2, fx: { rune: 1, aura: 0.5, dust: 1, speed: 0.5, extra: both(echoes(0.7, 2), cone(0.8, 0.1)) } }),
  // The charge: long bounding strides, barely touching the floor, his echoes a stride apart behind him.
  pose(COUCH, { y: 1, footF: [-16, -10, 5], footB: [24, -4, 5], phase: 0.3, fx: { rune: 1, aura: 0.45, speed: 0.6, extra: both(echoes(1), cone(1.1, 0.25)) } }),
  pose(COUCH, { y: 6, footF: [12, -12, 5], footB: [8, 0, 5], lift: 0.15, phase: 0.4, fx: { rune: 1, aura: 0.45, speed: 0.6, dust: 0.7, extra: both(echoes(1), cone(1.1, 0.4)) } }),
  pose(COUCH, { y: 1, footF: [24, -4, 5], footB: [-16, -10, 5], phase: 0.5, fx: { rune: 1, aura: 0.45, speed: 0.6, extra: both(echoes(1), cone(1.1, 0.55)) } }),
  pose(COUCH, { y: 6, footF: [8, 0, 5], footB: [12, -12, 5], phase: 0.6, fx: { rune: 1, aura: 0.45, speed: 0.6, dust: 0.7, extra: both(echoes(1), cone(1.1, 0.7)) } }),
  // Skewered: a great burst of energy at the point, a white flash and a bright ring thrown out round it.
  pose(COUCH, { y: 2, footF: [-14, -8, 5], footB: [22, -3, 5], phase: 0.7, fx: { rune: 1, aura: 0.6, speed: 0.5, impact: 2, extra: both(echoes(0.8), cone(0.6, 0.85), flash(2.2), burstAt('tip', 1.8), shockAt(20, 1)) } }),
  // The braced, skidding stop: the lead leg thrust out, the body thrown back, the point still up.
  pose(S, { x: 12, y: 12, lean: -4, twist: 10, head: -2, look: -4, footF: [2, 0, 5.6], footB: [26, 0, 6], handF: [-2, 15, 8], weapon: 78, roll: 0, yaw: -30, grip: -16, grip2: 18, face: 'grit', wind: -0.2, lift: 0.5, sway: 0.4, phase: 0.85, fx: { aura: 0.5, dust: 1, speed: 0.3, extra: both(skid(1), burstAt('tip', 0.6), shockAt(30, 0.8)) } }),
  pose(S, { x: 10, y: 9, lean: 6, twist: 14, head: 1, footF: [-4, 0, 5.6], footB: [20, 0, 6], handF: [-3, 16, 7.5], weapon: 64, yaw: -38, grip: -10, grip2: 16, face: 'stern', wind: 0.3, lift: 0.3, phase: 1, fx: { aura: 0.2, dust: 0.5, extra: skid(0.45) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.6, { phase: 1.1, fx: { extra: skid(0.15) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.92, { phase: 1.2 }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** Planted upright beside his right foot, his left fist raised, the energy bursting round him. */
const PLANTED: ChibiPose = pose(S, { x: 0, y: 4, lean: -4, twist: 4, head: -8, look: 4, footF: [-6, 0, 8], footB: [8, 0, 7.5], handF: [-11, 2, 13], handB: [2, -8, 15], weapon: 0, roll: -4, yaw: 0, grip: 10, face: 'shout', wind: 0.6, lift: 0.3, sway: -0.4 });

/**
 * The twirl: gripped at the middle of the haft in his right hand low in front of him, the lance
 * spun round level (`roll` 90 lays the haft's plane flat), so it sweeps round his hips and never
 * passes his face; `weapon` is where it points round him (0 his right, 90 ahead, 180 his left).
 * Its trail is a level violet ring (a ring's angles run the other way: 90 his right, 0 ahead)
 * from where the head was, `from`.
 */
const twirl = (weapon: number, from: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(S, { y: 7, lean: 4, twist: 6, head: headUp(4, 2), look: 0, handF: [8, 17, 5], handB: [-2, 13, 12], weapon, roll: 90, yaw: 0, grip: 4, face: 'grit', wind: 0.4, lift: 0.2, flare: 0.5, fx: { rune: 1, aura: 0.6, extra: ringArc(90 - from, 90 - weapon, 20, 58) }, ...over });

const cast: ChibiPose[] = [
  // Gather: the lance lifted upright beside his right shoulder, out past his head.
  fromReady(pose(PLANTED, { y: 7, lean: 4, head: headUp(4, 2), look: 0, handF: [-6, 6, 13], handB: [2, 14, 9], weapon: 8, roll: 10, grip: 2, face: 'grit', wind: 0.3, lift: 0.1, sway: 0, fx: { rune: 0.6, aura: 0.3 } }), 0.85),
  // The spin: once round, level, round his hips.
  twirl(150, 20, { phase: 0.1 }),
  twirl(300, 40, { y: 6, phase: 0.2, sway: -0.3 }),
  // Planted: the butt struck into the floor, a flare of violet rays behind him and a burst round him.
  pose(PLANTED, { phase: 0.3, fx: { rune: 1, aura: 1, circle: 1, impact: 1, impactAt: [-8, 2, 13], rays: { k: 1, at: 'body', n: 12 }, shock: 0.08, shockAt: [0, 0, 0], dust: 1, extra: gust(0.1, 24) } }),
  pose(PLANTED, { y: 4.7, lean: -6, head: -9, phase: 0.45, lift: 0.4, fx: { rune: 1, aura: 1, circle: 0.9, rays: { k: 0.5, at: 'body', n: 12, spin: 12 }, shock: 0.45, shockAt: [0, 0, 0], extra: gust(0.5, 24) } }),
  pose(PLANTED, { y: 4, lean: -5, head: -8, phase: 0.6, lift: 0.3, face: 'smirk', fx: { rune: 0.8, aura: 0.6, circle: 0.45, shock: 0.8, shockAt: [0, 0, 0], extra: gust(0.9, 24) } }),
  // Back into the stance: the haft swung down across him, the point out past his lead shoulder
  // clear of his face, then into the guard, the energy gone.
  settle(pose(PLANTED, { handB: undefined, handF: [-2, 15, 9], weapon: 64, roll: 0, yaw: -62, grip: -6, grip2: 14, face: 'stern' }), 0.45, { phase: 0.8, fx: { aura: 0.15 } }),
  settle(PLANTED, 0.92, { phase: 1, fx: undefined }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
