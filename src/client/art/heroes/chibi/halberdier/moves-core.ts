/**
 * The Halberdier's core moves: stances, running and the three-thrust combo. Poses use the chibi
 * pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the
 * halberd's angle (0 up, 90 forward), its plane's `roll` and `yaw`, both hands' places along the
 * haft (`grip` the right hand's, `grip2` the left's), and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, the halberd laid across his shoulders behind his neck with both wrists
 *              draped over it, weight on one leg: a slow breath, a blink, the scarf and ponytail
 *              swaying
 *   battle  8  a low, bladed spear stance, left foot and left hand leading, the right hand on the
 *              haft by his hip, the point forward and up; a quick, springy bounce on his toes, the
 *              point bobbing, head, scarf and hair a frame behind
 *   move    8  a sprint: long strides, a hard lean, the halberd trailing low behind him in his
 *              right hand, the left arm pumping, the scarf and ponytail streaming
 *   atk1    7  (1 wind-up) a straight thrust from the stance: drawn back, driven out with a
 *              stamp of the lead foot, the left hand sliding up the haft
 *   atk2    7  (1 wind-up) an overhand thrust: the haft lifted to his shoulder and driven forward
 *              and down
 *   atk3    9  (2 wind-up) a coil low, then a long leaping lunge from the butt end of the haft
 *              for the farthest reach: a drill of wind off the point, a burst, dust
 *
 * Thrusts leave spiralling wind streaks (`fx.swirl`) and a streak of jade along the path of the
 * point (`streak` below); each has an anticipation, a strike, a held extension and a recovery
 * into the battle stance (`settle`), with the scarf and ponytail streaming hardest a frame after
 * the strike. The skill and state clips (moves-skills.ts, moves-states.ts) start from the stance
 * (`fromReady`) and those that hand back to it end in it (`settle`).
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { glowLine, puff } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, type FxContext, mix, pose, solveRig, type V3, wave } from '../rig.js';
import { HALBERDIER } from './design.js';

const BUILD = HALBERDIER.build;
const W = HALBERDIER.weapon;
const TIP = W.tip ?? W.reach[1];

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The battle stance: low and bladed, the left foot and the left shoulder leading (a positive
 * `twist` opens his chest toward the viewer side on), the right hand on the haft by his hip, the
 * left hand forward on it, the point forward and up. The haft is yawed across toward his left so
 * side on it lies flat to the viewer at its full length, and toward the viewer it crosses his
 * body on a diagonal with the head out past his left shoulder, clear of his face.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 6,
  lean: 8,
  twist: 18,
  head: 3,
  look: -6,
  footF: [-12, 0, 5],
  footB: [11, 0, 5.4],
  handF: [-4, 17, 7],
  weapon: 55,
  roll: 0,
  yaw: -45,
  grip: -8,
  grip2: 14,
  wind: 0.62,
  phase: 0,
};

/** At ease: the halberd across his shoulders behind his neck, the head out to his right, his wrists draped over the haft. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 0,
  twist: 6,
  tilt: -2,
  head: -4,
  look: 6,
  footF: [4, 0, 5.2],
  footB: [-5, 0, 4.4],
  handF: [-8, 4, 14],
  weapon: 82,
  roll: 0,
  yaw: 128,
  grip: 14,
  grip2: -14,
  wind: 0.1,
  face: 'smirk',
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

/** Where a pose's point is, in hero space (turned by the pose's `turn` into the turn-0 frame). */
export function tipOf(p: ChibiPose): V3 {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const t = add3(rig.weapon.o, rig.weapon.u, TIP);
  const a = ((p.turn ?? 0) * Math.PI) / 180;
  return [t[0] * Math.cos(a) - t[2] * Math.sin(a), t[1], t[0] * Math.sin(a) + t[2] * Math.cos(a)];
}

/**
 * A pose with a drill of wind spiralling off its point (`fx.swirl`): from a little behind the
 * point to `len` past it, `radius` round at its start and narrowing, `k` its strength and `spin`
 * how far its streaks have run on (advance it frame by frame). A longer drill turns more times.
 */
export function drill(p: ChibiPose, k: number, spin: number, len = 34, radius = 7): ChibiPose {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const w = rig.weapon;
  return { ...p, fx: { ...p.fx, swirl: { k, spin, from: add3(w.o, w.u, TIP - 14), to: add3(w.o, w.u, TIP + len), radius, taper: 0.4, turns: 1 + len / 24 } } };
}

/**
 * Streaks of wind along the path of the point (`from` to `to`, hero space at turn 0, as `tipOf`
 * gives them), `k` their strength: a few thin lines running parallel to the path either side of
 * it, white-hot toward the point, jade behind, fading toward where the point started (each starts
 * at its own seeded place), with a faint jade wash between them. A thrust's smear: a swoosh is an
 * arc, a thrust is a line. A thrust straight at the viewer or away would shrink to a dot, so its
 * streaks open out on screen to at least half their length, downward for one coming at the viewer
 * (nearer is lower on screen) and upward for one going away.
 */
export const streak =
  (from: V3, to: V3, k = 1, width = 3) =>
  (x: FxContext): void => {
    const turn = (q: V3): V3 => {
      // Back into the pose's own frame (the painter's), undoing the turn tipOf took out.
      const a = -(((x.rig.pose.turn ?? 0) * Math.PI) / 180);
      return [q[0] * Math.cos(a) - q[2] * Math.sin(a), q[1], q[0] * Math.sin(a) + q[2] * Math.cos(a)];
    };
    const a3 = turn(from);
    const b3 = turn(to);
    const B = x.proj(b3);
    let A = x.proj(a3);
    const full = Math.hypot(b3[0] - a3[0], b3[1] - a3[1], b3[2] - a3[2]);
    const seen = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (seen < full * 0.5 && full > 1) {
      // Opened out behind the point: up the screen behind a point coming at the viewer.
      const toward = x.depth(b3) > x.depth(a3);
      const want: Vec = [0, toward ? 1 : -1];
      const s = seen > 0.5 ? clamp(seen / (full * 0.5), 0, 1) : 0;
      const d: Vec = seen > 0.5 ? [((B[0] - A[0]) / seen) * s + want[0] * (1 - s), ((B[1] - A[1]) / seen) * s + want[1] * (1 - s)] : want;
      const dl = Math.hypot(d[0], d[1]) || 1;
      A = [B[0] - (d[0] / dl) * full * 0.5, B[1] - (d[1] / dl) * full * 0.5];
    }
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (len < 2) return;
    const ux = (B[0] - A[0]) / len;
    const uy = (B[1] - A[1]) / len;
    const behind = x.behind(b3) && x.behind(a3);
    const at = (t: number, s: number): Vec => [A[0] + ux * len * t - uy * s, A[1] + uy * len * t + ux * s];
    // The wash between the lines.
    for (let t = 0; t <= 1; t += 1 / Math.ceil(len)) {
      for (let s = -width; s <= width; s += 1) x.c.glow(at(t, s)[0], at(t, s)[1], x.aura.core, k * 0.22 * t * (1 - Math.abs(s) / (width + 1)), behind);
    }
    // The lines: two either side, of seeded lengths, stopping a little short of the point.
    const lines = [-width, -width * 0.45, width * 0.4, width];
    lines.forEach((s, i) => {
      const t0 = 0.05 + x.hash(i, 151) * 0.4;
      const t1 = 0.92 - x.hash(i, 152) * 0.12;
      const n = Math.ceil(len * (t1 - t0));
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / Math.max(1, n);
        const f = (t - t0) / (t1 - t0);
        const col: RGB = f > 0.7 ? x.aura.hot : f > 0.3 ? mixc(x.aura.hot, x.aura.core, 0.5) : x.aura.core;
        const p = at(t, s);
        x.c.glow(p[0], p[1], col, k * (0.25 + 0.75 * f), behind);
      }
    });
  };

/**
 * A gust of wind kicked up round him (k from 0, just kicked up, to 1, blown out and fading):
 * curling streaks low over the floor running out from under him, white at their heads, jade
 * behind, with a few motes of grit. Those behind him go under the figure.
 */
export const gust =
  (k: number, radius = 22, seed = 0) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const fade = clamp(1.2 - k, 0, 1);
    for (let i = 0; i < 9; i++) {
      const th0 = (i / 9) * Math.PI * 2 + hash(i, 141 + seed) * 0.5;
      const h = 2 + hash(i, 142 + seed) * 10 + k * 6;
      const r0 = radius * (0.45 + 0.5 * k) + hash(i, 143 + seed) * 6;
      const sweep = 0.7 + hash(i, 144 + seed) * 0.4;
      let prev: Vec | null = null;
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const th = th0 + sweep * t;
        const p3: V3 = [g[0] + Math.cos(th) * (r0 + t * 6), h + Math.sin(t * Math.PI) * 2, g[2] + Math.sin(th) * (r0 + t * 6)];
        const p = x.proj(p3);
        if (prev) {
          const col: RGB = t > 0.75 ? aura.hot : t > 0.35 ? aura.core : mixc(aura.core, aura.edge, 0.5);
          glowLine(c, prev, p, col, fade * (0.2 + 0.8 * t) * 0.9, x.behind(p3));
        }
        prev = p;
      }
    }
    for (let i = 0; i < 6; i++) {
      const th = hash(i, 147 + seed) * Math.PI * 2;
      const r = radius * (0.3 + 0.7 * k) * (0.6 + 0.5 * hash(i, 148 + seed));
      const p3: V3 = [g[0] + Math.cos(th) * r, 2 + hash(i, 149 + seed) * 8 * (1 - k * 0.5), g[2] + Math.sin(th) * r];
      const p = x.proj(p3);
      puff(c, p[0], p[1], 1.2, aura.core, 0.6 * fade, x.behind(p3));
    }
  };

/** Runs several extra painters in turn. */
export const both =
  (...fs: ((x: FxContext) => void)[]) =>
  (x: FxContext): void => {
    for (const f of fs) f(x);
  };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles exactly one pixel for the second half of the
  // loop (a whole pixel, so the hair's clumps do not shimmer), while the scarf tails and the
  // ponytail sway slowly round, the ribbon stirs and he blinks once.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 1 + out,
    handF: [-8, 4 + out * 0.4, 14],
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.16 + wave(i, 8) * 0.14,
    face: i === 6 ? 'closed' : 'smirk',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back up, quick and light. The point dips a beat behind the
  // body, the head nods a frame behind it, and the scarf and hair lift as he drops.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 4.6 + b * 3,
    lean: 7 + b * 2.5,
    head: 1 + bounce(i - 1) * 3,
    handF: [-4, 16 + b * 1.2, 7],
    weapon: 54 + bounce(i - 1) * 6,
    wind: 0.62 + Math.max(0, lag) * 0.2,
    lift: lag * 0.8,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
  });
});

/** The first battle frame: the skill and state clips hand over from it and back to it. */
const STANCE0 = battle[0] as ChibiPose;

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. Long legs, long strides. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [13, 0], b: [-11, -6], y: 2.4 },
  { f: [7, 0], b: [-9, -11], y: 4.4 },
  { f: [0, 0], b: [3, -9.5], y: 1.2 },
  { f: [-8, -1.5], b: [11, -4.5], y: -3 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 22 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 10,
    head: -10,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.2] : [k.b[0], k.b[1], 4.2],
    footB: right ? [k.b[0], k.b[1], 4] : [k.f[0], k.f[1], 4],
    // The halberd trails low behind him in his right hand, held near the butt; the left arm pumps against the legs.
    handF: [-5 - swing * 2, 15 - Math.abs(swing), 9],
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    weapon: -94 + swing * 4,
    roll: 0,
    yaw: -16,
    grip: -26,
    wind: 1.05,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (from k 0.5 the effects come from the battle frame, which has none). The combo's recoveries
 * use it, and so do the skill and state clips that hand back to the stance.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, STANCE0, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. A clip the battle loop hands over to starts with it, so its first frame carries on from the
 * stance. Keep k at 0.5 or more so the hands, face and effects come from the pose.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(STANCE0, p, k), over);

/** Adds a streak along the path of the point from pose `a`'s tip to pose `b`'s, to b's effects. */
const thrust = (a: ChibiPose, b: ChibiPose, k = 1, width = 3): ChibiPose => {
  const prev = b.fx?.extra;
  const s = streak(tipOf(a), tipOf(b), k, width);
  return { ...b, fx: { ...b.fx, extra: prev ? both(prev, s) : s } };
};

// atk1: a straight thrust. Drawn back, weight on the rear foot; then the lead foot stamps forward,
// the rear hand drives the haft through and the lead hand slides up it.
const A1_DRAW = pose(READY, { x: -3, y: 6, lean: 2, twist: 26, head: 4, look: -8, footF: [-13, 0, 5], footB: [9, -1, 5.4], handF: [-10, 15, 7.5], weapon: 84, yaw: -26, grip: -8, grip2: 18, wind: 0.3, lift: 0.1, sway: 0.2, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A1_DRIVE = pose(READY, { x: 4, y: 7, lean: 14, twist: 12, head: 1, look: -4, footF: [-12, 0, 5], footB: [16, 0, 5.4], handF: [3, 13, 6], weapon: 86, yaw: -24, grip: -8, grip2: 24, wind: 0.5, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A1_HIT = pose(READY, { x: 7, y: 8, lean: 20, twist: 6, head: 0, look: -2, footF: [-13, 0, 5], footB: [18, 0, 5.6], handF: [11, 11.5, 4.5], weapon: 88, yaw: -22, grip: -11, grip2: 30, wind: 0.8, phase: 0.4, face: 'shout', fx: { rune: 1, impact: 0.6 } });
const A1_HOLD = pose(A1_HIT, { y: 8.5, lean: 21, handF: [11, 12, 4.5], wind: 0.9, lift: 0.15, phase: 0.55, face: 'grit', fx: { rune: 0.7 } });

const atk1: ChibiPose[] = [
  fromReady(A1_DRAW, 0.85),
  drill(thrust(A1_DRAW, A1_DRIVE, 0.8), 0.6, 0.1, 22),
  drill(thrust(A1_DRAW, A1_HIT), 1, 0.3),
  drill(thrust(A1_DRAW, A1_HOLD, 0.35), 0.5, 0.55),
  pose(A1_HOLD, { x: 5, y: 7.5, lean: 16, handF: [6, 13.5, 5.5], grip2: 24, wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A1_HOLD, 0.6, { wind: 0.55, lift: 0.25, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A1_HOLD, 0.9, { wind: 0.6, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: an overhand thrust. The haft swung up to his right shoulder, the point still on the foe,
// then driven forward and down from above.
const A2_RAISE = pose(READY, { x: -2, y: 4, lean: -2, twist: 16, head: -1, look: -6, footF: [-12, 0, 5], footB: [10, 0, 5.4], handF: [-8, -4, 12], weapon: 96, roll: 0, yaw: -26, grip: -12, grip2: 16, wind: 0.3, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A2_DRIVE = pose(READY, { x: 4, y: 6, lean: 12, twist: 8, head: 1, look: -4, footF: [-12, 0, 5], footB: [15, 0, 5.4], handF: [2, 2, 10], weapon: 102, yaw: -22, grip: -12, grip2: 20, wind: 0.5, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A2_HIT = pose(READY, { x: 7, y: 8, lean: 22, twist: 2, head: 2, look: -2, footF: [-13, 0, 5], footB: [18, 0, 5.6], handF: [8, 7, 8], weapon: 106, yaw: -20, grip: -12, grip2: 26, wind: 0.85, phase: 0.4, face: 'shout', fx: { rune: 1, impact: 0.65 } });
const A2_HOLD = pose(A2_HIT, { y: 8.5, lean: 23, handF: [8, 7.5, 8], wind: 0.9, lift: 0.2, phase: 0.55, face: 'grit', fx: { rune: 0.7 } });

const atk2: ChibiPose[] = [
  fromReady(A2_RAISE, 0.8),
  drill(thrust(A2_RAISE, A2_DRIVE, 0.8), 0.6, 0.15, 22),
  drill(thrust(A2_RAISE, A2_HIT), 1, 0.35),
  drill(thrust(A2_RAISE, A2_HOLD, 0.35), 0.5, 0.6),
  pose(A2_HOLD, { x: 5, y: 7.5, lean: 15, handF: [4, 10, 8], weapon: 90, grip2: 20, wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A2_HOLD, 0.6, { wind: 0.55, lift: 0.25, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A2_HOLD, 0.9, { wind: 0.6, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: coil low with the haft drawn right back, then a leaping lunge, the right hand sliding to
// the butt end so the point reaches its farthest; a drill of wind, a burst at the point, dust.
const A3_COIL = pose(READY, { x: -4, y: 10, lean: 6, twist: 30, head: 6, look: -8, footF: [-14, 0, 5.2], footB: [9, 0, 5.6], handF: [-12, 17, 8], weapon: 80, yaw: -30, grip: -14, grip2: 14, wind: 0.3, sway: 0.3, face: 'grit', fx: { rune: 0.6 } });
const A3_COIL2 = pose(A3_COIL, { x: -5, y: 11, lean: 8, twist: 34, head: 7, handF: [-13, 17.5, 8], weapon: 82, grip2: 13, wind: 0.35, lift: 0.2, phase: 0.1, fx: { rune: 0.9, aura: 0.3 } });
const A3_LEAP = pose(READY, { x: 6, y: 0, lean: 18, twist: 10, head: -2, look: -4, footF: [-16, -4, 5], footB: [14, -6, 5.4], handF: [0, 13, 6], weapon: 82, yaw: -32, grip: -22, grip2: 6, wind: 0.9, lift: 0.3, phase: 0.25, face: 'shout', fx: { rune: 1, aura: 0.4, speed: 0.6 } });
const A3_LUNGE = pose(READY, { x: 12, y: 11, lean: 26, twist: 2, head: 0, look: -2, footF: [-12, 0, 5], footB: [23, 0, 5.8], handF: [12, 11, 4], weapon: 84, yaw: -26, grip: -26, grip2: 14, wind: 1.1, phase: 0.4, face: 'shout', fx: { rune: 1, aura: 0.3, impact: 1.1, dust: 1 } });
const A3_HOLD = pose(A3_LUNGE, { y: 11.5, lean: 27, handF: [12, 11.5, 4], wind: 0.9, lift: 0.2, phase: 0.55, face: 'grit', fx: { rune: 0.8, dust: 0.6 } });

const atk3: ChibiPose[] = [
  fromReady(A3_COIL, 0.85),
  A3_COIL2,
  drill(thrust(A3_COIL2, A3_LEAP, 0.7), 0.7, 0.1, 24),
  drill(thrust(A3_COIL2, A3_LUNGE, 1, 3.6), 1.2, 0.35, 48, 9),
  drill(thrust(A3_COIL2, A3_HOLD, 0.45, 3.6), 0.7, 0.6, 48, 9),
  drill(pose(A3_HOLD, { y: 11, lean: 24, handF: [10, 12, 5], wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4, dust: 0.3 } }), 0.25, 0.85, 48, 9),
  pose(A3_HOLD, { x: 9, y: 9.5, lean: 18, handF: [6, 13.5, 6], grip: -18, grip2: 16, wind: 0.45, lift: 0.3, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.7, { wind: 0.55, lift: 0.15, phase: 1, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.92, { wind: 0.6, lift: 0.05, phase: 1.1, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
