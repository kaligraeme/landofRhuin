/**
 * The Flame Warden's core moves: stances, running and the three-hit combo of his basic attack,
 * Ember Slash. Poses use the chibi pose format (rig.ts, ChibiPose): side-plane points, hands from
 * the base of the neck, the sword's angle (0 up, 90 forward), its plane's `roll` and `yaw` and the
 * cloth's and hair's `wind`/`lift`/`phase`. His fire is painted by fire.ts through `fx.extra`.
 *
 *   idle    8  at ease, weight on his back foot, the sword hanging point down at his right side,
 *              his left fist on his hip, a smirk: a slow breath, a blink, embers rising off the
 *              blade, the coat swaying
 *   battle  8  a low, forward-leaning crouch, always about to spring: the sword trailing low behind
 *              him on his right, its edge glowing, the left hand open ahead of him; bouncing on the
 *              balls of his feet, hair and coat a frame behind
 *   move    8  a sprint, leaning hard, the blade trailing low behind him, the coat streaming
 *   atk1    7  (1 wind-up) a rising slash from low behind him up across his front, a blazing arc
 *   atk2    7  (1 wind-up) a downward diagonal cut from high over his right shoulder to low in front
 *   atk3    9  (1 wind-up) the wide, heavy one: coiled to his right, a full turn the other way with
 *              the blade held out level inside a ring of fire, finishing in a forehand sweep that
 *              bursts into flame
 *
 * His basic attack strikes every 0.4 s, the quickest of the Duelists, so each blow is short: an
 * anticipation, a smear frame, a hit frame and a recovery into the battle stance, the coat and hair
 * streaming hardest a frame after the blow. A cut's swoosh starts where the blade was (`trail`):
 * the frame before on the smear frame, the start of the swing on the hit frame, so the whole stroke
 * shows as one blazing arc that then fades and sheds embers and smoke. Raised sword hands go out
 * beside his head (`handF` about `[-7, -8, 13]`), clear of his face side on and from the front.
 */
import { add3, type ChibiPose, mix, norm3, pose, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { FLAME_WARDEN } from './design.js';
import { both, embers, fireArc, fireRing, flames } from './fire.js';

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BUILD = FLAME_WARDEN.build;
const GRIP2 = FLAME_WARDEN.weapon.grip2;
const REACH = FLAME_WARDEN.weapon.reach[1];

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * Where a smear starts for a blow swung from pose `a` to pose `b`: the blade angle, roll and yaw
 * that point from b's grip (the smear's centre) at a's tip, so the swoosh begins where the blade
 * was in pose a even when the hand has travelled. The angle comes out on the side of a's own
 * angle, so the arc sweeps the way the blade went.
 */
export function trail(a: ChibiPose, b: ChibiPose): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, GRIP2);
  const rb = solveRig(BUILD, b, GRIP2);
  const tip = turnPoint(add3(ra.weapon.o, ra.weapon.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  const d = norm3(sub3(tip, rb.weapon.o));
  const wrap = (x: number, near: number): number => x + 360 * Math.round((near - x) / 360);
  const a0 = { from: a.weapon, roll: a.roll ?? 0, yaw: a.yaw ?? 0 };
  let best = { ...a0, cost: Infinity };
  for (let yaw = -80; yaw <= 80; yaw += 2) {
    const cy = Math.cos(rad(yaw));
    if (Math.abs(d[0]) > cy) continue;
    const st = d[0] / cy;
    for (const sign of [1, -1]) {
      const ct = sign * Math.sqrt(1 - st * st);
      const from = wrap((Math.atan2(st, ct) * 180) / Math.PI, a0.from);
      const roll = wrap(((Math.atan2(d[2], d[1]) - Math.atan2(st * Math.sin(rad(yaw)), ct)) * 180) / Math.PI, a0.roll);
      const cost = Math.abs(from - a0.from) + Math.abs(roll - a0.roll) + Math.abs(yaw - a0.yaw);
      if (cost < best.cost) best = { from, roll, yaw, cost };
    }
  }
  return { from: best.from, roll: best.roll, yaw: best.yaw };
}

/** Adds an effect painter to a pose's own. */
export const plus = (p: ChibiPose, f: Parameters<typeof both>[0]): ChibiPose => ({ ...p, fx: { ...p.fx, extra: both(p.fx?.extra, f) } });

/**
 * Adds a blazing swoosh to a pose, starting where the blade was in pose `start` (the frame before
 * on a smear frame, the start of the swing on the hit frame), with embers and smoke shed along it.
 * `width` is how far down the blade the arc reaches (narrow enough on high arcs to pass over his
 * face), `alpha` its strength.
 */
export const smear = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1, seed = 0): ChibiPose => plus(p, fireArc({ ...trail(start, p), width, alpha }, seed));


// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The battle stance the skill and state clips build their poses from (`S` there): low and leaning
 * in, his right shoulder drawn back, the sword trailing low behind him on his right with its point
 * near the floor (tipped out to his right so it shows beside him from the front and behind), his
 * left hand open ahead of his chest.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 6,
  lean: 18,
  twist: 16,
  head: 4,
  look: -4,
  footF: [12, 0, 5.4],
  footB: [-12, 0, 5],
  handF: [-3, 17, 11],
  weapon: -122,
  roll: 0,
  yaw: -24,
  handB: [9, 9, 3],
  face: 'smirk',
  wind: 0.25,
};

/** Standing at ease: the sword hanging point down at his right side, the left fist on his hip. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 8,
  head: -3,
  look: 4,
  footF: [4, 0, 5.4],
  footB: [-6, 0, 4.6],
  handF: [3, 17, 10],
  weapon: 138,
  roll: -24,
  yaw: -6,
  handB: [1, 14, 11],
  face: 'smirk',
  wind: 0.06,
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles one whole pixel for the second half of the loop
  // (so the hair's clumps do not shimmer), the coat sways slowly round, he blinks once and embers
  // drift up off the blade.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 0.6 + out,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.2,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.06,
    face: i === 5 ? 'closed' : 'smirk',
    fx: { rune: 0.15, extra: both(flames(0.32, i), embers(0.6, i, undefined, 26, 5)) },
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back; the head nods a frame behind the body, the coat and hair
  // lag too (lifting as he drops, settling as he rises), and the blade flickers with flame.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 4.6 + b * 3.4,
    lean: 16 + b * 3,
    head: 2 + bounce(i - 1) * 3,
    handF: [-3, 16.5 + b * 1.4, 11],
    handB: [9, 8.5 + b * 1.6, 3],
    weapon: -120 - b * 5,
    wind: 0.25 + Math.max(0, lag) * 0.2,
    lift: lag,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
    fx: { rune: 0.4, extra: flames(0.5, i) },
  });
});

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [12, 0], b: [-10, -6], y: 2 },
  { f: [6, 0], b: [-8, -11], y: 3.8 },
  { f: [0, 0], b: [2, -9], y: 1 },
  { f: [-7, -1.5], b: [10, -4], y: -2.6 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 26 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 9,
    head: -10,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.4] : [k.b[0], k.b[1], 4.4],
    footB: right ? [k.b[0], k.b[1], 4.2] : [k.f[0], k.f[1], 4.2],
    // The blade trails low behind him in his right hand; the left arm pumps against the legs.
    handF: [-5 - swing * 2, 15 - Math.abs(swing), 10],
    weapon: -108 + swing * 5,
    roll: 0,
    yaw: -36,
    handB: [3 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    face: 'grit',
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0, rune: 0.3, extra: flames(0.35, i) },
  };
});

// ── Back into the stance ─────────────────────────────────────────────────────────────────────

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (pass `turn` for a pose that has spun round, and any effects: from k 0.5 they come from the
 * battle frame). The combo's recoveries use it, and so do the skill and state clips that hand back
 * to the battle stance, so the blade is already where the loop holds it when that takes over.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, battle[0] as ChibiPose, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. A clip the battle loop hands over to starts with it, so its first frame carries the blade
 * on from where the loop holds it. Keep k at 0.5 or more (the hands, face and effects then come
 * from the pose), and give the pose's blade angle on the side the swing goes round.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(battle[0] as ChibiPose, p, k), over);

// ── The combo ────────────────────────────────────────────────────────────────────────────────

// atk1: a rising slash, from the blade trailing low behind him, down past the floor and up across
// his front to high on his left.
const A1_COCK = pose(READY, { x: -2, y: 7.5, lean: 22, twist: 26, head: 5, look: -2, footF: [11, -1, 5.4], handF: [-7, 16, 11], weapon: -136, roll: -6, yaw: -28, handB: [10, 6, 1], wind: 0.3, lift: 0.15, sway: 0.25, phase: 0.1, face: 'grit', fx: { rune: 0.6, extra: flames(0.6, 1) } });
const A1_SWING = pose(READY, { x: 3, y: 6, lean: 14, twist: 4, head: 3, footF: [14, 0, 5.6], handF: [9, 14, 9], weapon: -210, roll: -20, yaw: -10, handB: [3, 11, 10], wind: 0.45, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A1_HIT = pose(READY, { x: 6, y: 3.5, lean: 2, twist: -22, head: -3, look: 0, footF: [15, 0, 5.8], footB: [-11, -1, 5.2], handF: [12, 2, -4], weapon: -332, roll: -34, yaw: 0, handB: [-2, 11, 12], wind: 0.75, lift: 0.2, phase: 0.4, face: 'shout', fx: { impact: 0.8, rune: 1 } });
const A1_FOLLOW = pose(A1_HIT, { y: 3, lean: 0, twist: -26, head: -4, handF: [10, -2, -6], weapon: -354, wind: 0.9, lift: 0.4, phase: 0.55, face: 'grit', fx: { rune: 0.7, extra: flames(0.7, 4) } });

const atk1: ChibiPose[] = [
  A1_COCK,
  smear(A1_COCK, A1_SWING, 0.7, 1, 1),
  smear(A1_COCK, A1_HIT, 0.6, 1, 2),
  smear(A1_COCK, A1_FOLLOW, 0.5, 0.45, 3),
  pose(A1_FOLLOW, { y: 4, lean: 6, twist: -18, handF: [9, 3, -2], weapon: 20, wind: 0.55, lift: 0.5, phase: 0.7, face: 'smirk', fx: { rune: 0.5, extra: flames(0.6, 5) } }),
  settle(pose(A1_FOLLOW, { weapon: 6 }), 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'smirk' }),
  settle(pose(A1_FOLLOW, { weapon: 6 }), 0.88, { wind: 0.27, lift: 0.05, phase: 1 }),
];

// atk2: from the high finish of the first, the blade cocked over his right shoulder, a hard cut
// down across his front to low on his left.
const A2_COCK = pose(READY, { x: 0, y: 4, lean: -2, twist: -24, head: -3, look: 2, footF: [11, -1, 5.4], footB: [-12, 0, 5], handF: [-7, -8, 13], weapon: -44, roll: 42, yaw: -6, handB: [9, 9, 4], wind: 0.3, lift: 0.25, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.6, extra: flames(0.6, 6) } });
const A2_SWING = pose(READY, { x: 4, y: 5, lean: 12, twist: -2, head: 2, footF: [14, 0, 5.6], handF: [12, 4, 7], weapon: 68, roll: 40, yaw: 0, handB: [5, 11, 9], wind: 0.45, lift: 0, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A2_HIT = pose(READY, { x: 7, y: 8, lean: 26, twist: 16, head: 2, look: -4, footF: [16, 0, 5.8], footB: [-12, 0, 5.2], handF: [16, 14, -3], weapon: 118, roll: 40, yaw: 0, handB: [-3, 10, 12], wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impact: 0.9, dust: 0.6, rune: 1 } });
const A2_FOLLOW = pose(A2_HIT, { y: 9, lean: 28, twist: 20, head: 3, handF: [15, 16, -4], weapon: 128, wind: 0.95, lift: 0.2, phase: 0.55, face: 'grit', fx: { dust: 0.3, rune: 0.7, extra: flames(0.7, 8) } });

const atk2: ChibiPose[] = [
  A2_COCK,
  smear(A2_COCK, A2_SWING, 0.7, 1, 4),
  smear(A2_COCK, A2_HIT, 0.55, 1, 5),
  smear(A2_COCK, A2_FOLLOW, 0.5, 0.45, 6),
  pose(A2_FOLLOW, { y: 8, lean: 24, twist: 16, handF: [13, 16, 0], weapon: 150, roll: 20, wind: 0.6, lift: 0.45, phase: 0.7, face: 'smirk', fx: { rune: 0.5, extra: flames(0.6, 9) } }),
  settle(pose(A2_FOLLOW, { weapon: -160, roll: 0, yaw: -20 }), 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'smirk' }),
  settle(pose(A2_FOLLOW, { weapon: -140, roll: 0, yaw: -24 }), 0.88, { wind: 0.27, lift: 0.05, phase: 1 }),
];

// atk3: the wide, heavy one. Coiled to his right, a full turn the other way on the spot with the
// blade held out level and leading inside a ring of fire, and a forehand sweep across his front to
// finish that bursts into flame.
const A3_COIL = pose(READY, { x: -2, y: 8, lean: 18, twist: 30, turn: 30, head: 5, look: -6, footF: [11, 0, 6], footB: [-11, 0, 5.6], handF: [-6, 15, 12], weapon: -130, roll: 0, yaw: -30, handB: [9, 7, 1], wind: 0.3, sway: 0.3, face: 'grit', fx: { rune: 0.8, extra: flames(0.8, 10) } });
const A3_COIL2 = pose(A3_COIL, { y: 9, lean: 20, twist: 34, turn: 40, head: 6, handF: [-8, 15, 12], weapon: -136, wind: 0.35, lift: 0.15, phase: 0.1, fx: { rune: 1, extra: flames(1, 11) } });
/** The turn: `turn` degrees round, the blade out level to his right and leading, the ring burning behind it from `from`. */
const spin = (turn: number, from: number, phase: number): ChibiPose =>
  pose(READY, { x: 1, y: 5, lean: 8, twist: 0, turn, head: 1, look: 10, footF: [9, -1, 6], footB: [-9, 0, 6], handF: [5, 11, 12], weapon: 90, roll: 0, yaw: 86, handB: [-2, 11, 11], wind: 0.6, flare: 1, lift: 0.2, sway: 0.4, phase, face: 'shout', fx: { rune: 1, extra: both(fireRing(from, turn + 86, 38, 50), flames(0.9, phase * 10)) } });
const A3_SWEEP = pose(READY, { x: 7, y: 8, lean: 24, twist: -16, turn: -360, head: 2, look: -2, footF: [16, 0, 6], footB: [-12, 0, 5.6], handF: [14, 9, -2], weapon: 94, roll: 0, yaw: -46, handB: [-2, 10, 12], wind: 0.9, flare: 0.5, phase: 0.6, face: 'shout', fx: { impact: 1.3, rune: 1, dust: 0.8, extra: fireRing(-150, -406, 34, 50) } });
const A3_HOLD = pose(A3_SWEEP, { y: 9, lean: 26, twist: -22, handF: [13, 10, -5], yaw: -62, wind: 0.8, lift: 0.3, phase: 0.75, face: 'grit', fx: { rune: 0.8, dust: 0.4, extra: fireRing(-300, -422, 33, 50, 0.45) } });

const atk3: ChibiPose[] = [
  A3_COIL,
  A3_COIL2,
  spin(-70, 110, 0.2),
  spin(-170, 0, 0.3),
  spin(-270, -100, 0.4),
  plus(A3_SWEEP, flames(1.2, 13)),
  plus(A3_HOLD, both(flames(0.9, 14), embers(1, 14, [40, 30, -12], 30, 14))),
  pose(A3_HOLD, { y: 8, lean: 22, twist: -14, handF: [12, 12, 2], weapon: 110, yaw: -40, wind: 0.5, lift: 0.4, phase: 0.9, face: 'smirk', fx: { rune: 0.5, extra: flames(0.6, 15) } }),
  settle(pose(A3_HOLD, { weapon: -160, yaw: -24, roll: 0 }), 0.8, { turn: -360, wind: 0.27, lift: 0.1, phase: 1.05 }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
