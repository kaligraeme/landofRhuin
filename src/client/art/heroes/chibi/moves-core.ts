/**
 * The Dark Knight's core moves: stances, running and the three-hit greatsword combo. Poses use the
 * chibi pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the
 * blade's angle (0 up, 90 forward), its plane's `roll` and `yaw` and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  relaxed, the greatsword resting on his right shoulder, fist on his hip: a slow
 *              breath that moves his head and shoulders one pixel, a blink, the coat swaying
 *   battle  8  a low, wide guard, the blade held forward and across in both hands so it shows its
 *              full length side on; a springy bounce on his knees, head, coat and hair a frame behind
 *   move    8  a chibi sprint: hard lean, bouncy strides, the blade trailing low behind him in his
 *              right hand, the coat streaming
 *   atk1    7  (1 wind-up) a diagonal cut from high behind his right shoulder to low in front
 *   atk2    7  (1 wind-up) a rising backhand cut up the same diagonal, the reverse arc
 *   atk3    9  (2 wind-up) a spin with the blade held out level, a leap with it raised high, and a
 *              heavy overhead slam: impact, shockwave, dust
 *
 * Each blow has an anticipation, a smear frame, an impact frame and a recovery into the battle
 * stance, with the coat and hair streaming hardest a frame after the blow and floating up as he
 * stops. Its swoosh starts where the blade was (`trail`): the frame before on the smear frame, the
 * start of the swing on the impact frame, so the whole stroke shows as one arc that then fades.
 * The chibi head is too big for the hands to get above it, so raised hands go beside it, behind
 * and out to his right (about `[-6, -10, 14]`): clear of his face side on and seen from the front.
 */
import { DARK_KNIGHT } from './darkKnight.js';
import { add3, type ChibiPose, mix, norm3, pose, rad, solveRig, sub3, type V3, wave } from './rig.js';

/**
 * The battle stance the skill and state clips (moves-skills.ts, moves-states.ts) start from and
 * return to. The core clips use READY below.
 */
export const GUARD_STANCE: ChibiPose = {
  x: 0,
  y: 5,
  lean: 13,
  twist: -14,
  head: 4,
  look: -2,
  footF: [10, 0, 5.4],
  footB: [-10, 0, 5],
  handF: [8, 11, 9.5],
  weapon: 52,
  roll: 28,
  yaw: -8,
  wind: 0.22,
};

/** Standing at ease: the blade on his right shoulder, the left fist on his hip. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 8,
  head: -3,
  look: 4,
  footF: [4, 0, 5],
  footB: [-5, 0, 4.4],
  handF: [4, 6, 7.4],
  handB: [1, 14, 11],
  weapon: -58,
  roll: 26,
  yaw: -28,
  wind: 0.05,
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BUILD = DARK_KNIGHT.build;
const GRIP2 = DARK_KNIGHT.weapon.grip2;
const REACH = DARK_KNIGHT.weapon.reach[1];

/**
 * Puts the left hand on the grip `at` pixels from the guard (negative: down toward the pommel), as
 * its own hand rather than the rig's second grip, so the two fists can sit apart: with the right
 * hand slid down to the pommel (`grip` about -9) and the left just under the guard (`at` -0.5),
 * a blade held forward and across to his left is gripped left hand uppermost and the arms do not
 * cross over his belly.
 */
function spread(p: ChibiPose, at = -0.5): ChibiPose {
  const rig = solveRig(BUILD, { ...p, handB: undefined }, GRIP2);
  const h = add3(rig.weapon.o, rig.weapon.u, at);
  return { ...p, handB: [h[0] - rig.neck[0], rig.neck[1] - h[1], -h[2]] };
}

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * Where a smear starts for a blow swung from pose `a` to pose `b`: the blade angle, roll and yaw
 * that point from b's grip (the smear's centre) at a's blade tip, so the swoosh begins where the
 * blade was in pose a, even when the hands have travelled. The angle comes out on the side of a's
 * own angle, so the arc sweeps the way the blade went.
 */
function trail(a: ChibiPose, b: ChibiPose): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, GRIP2);
  const rb = solveRig(BUILD, b, GRIP2);
  const tip = turnPoint(add3(ra.weapon.o, ra.weapon.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  const d = norm3(sub3(tip, rb.weapon.o));
  // weaponAxes gives u = (sinθ·cosψ, cosθ·cosρ − sinθ·sinψ·sinρ, cosθ·sinρ + sinθ·sinψ·cosρ):
  // for each yaw ψ that can reach d there are two (θ, ρ); keep the one nearest a's own.
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

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

/** At rest for the idle loop: the blade back over his right shoulder, tip up behind him. */
const REST: ChibiPose = pose(AT_EASE, { lean: 1, twist: 10, head: -2, look: 3, handF: [1.5, 9, 9.5], weapon: -52, roll: 24, yaw: -26, wind: 0.06 });

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles exactly one pixel for the second half of the
  // loop (a whole pixel, so the spiky hair does not shimmer; from nearly straight legs, so the
  // front of the coat, which follows the thighs, does not swing open), while the coat sways
  // slowly round and he blinks once.
  const out = i >= 4 ? 1 : 0;
  return pose(REST, {
    y: -0.4 + out,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.2,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.06,
    face: i === 6 ? 'closed' : 'stern',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

/**
 * The core clips' battle stance: low and wide, the greatsword in both hands, held forward and
 * across toward his left so side on it shows its whole length, the fists apart on the grip.
 */
export const READY: ChibiPose = spread({
  x: 0,
  y: 5,
  lean: 12,
  twist: 4,
  head: 3,
  look: -2,
  footF: [11, 0, 5.6],
  footB: [-11, 0, 5.2],
  handF: [6, 18, 6],
  grip: -9,
  weapon: 52,
  roll: -8,
  yaw: -44,
  wind: 0.2,
});

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back. The head nods a frame behind the body, and the coat
  // and hair lag too: they lift as he drops and settle as he rises.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return spread(
    pose(READY, {
      y: 3.4 + b * 4,
      lean: 11 + b * 2.5,
      head: 1 + bounce(i - 1) * 3,
      handF: [6, 17 + b * 1.6, 6],
      weapon: 50 + b * 5,
      wind: 0.2 + Math.max(0, lag) * 0.2,
      lift: lag,
      sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
      phase: i / BOUNCE,
    }),
  );
});

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [11, 0], b: [-9, -6], y: 2 },
  { f: [6, 0], b: [-7, -10], y: 3.8 },
  { f: [0, 0], b: [2, -8.5], y: 1 },
  { f: [-6, -1.5], b: [9, -4], y: -2.6 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 24 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 9,
    head: -9,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.4] : [k.b[0], k.b[1], 4.4],
    footB: right ? [k.b[0], k.b[1], 4.2] : [k.f[0], k.f[1], 4.2],
    // The blade trails low behind him in his right hand; the left arm pumps against the legs.
    handF: [-4 - swing * 2, 15 - Math.abs(swing), 9.5],
    weapon: -106 + swing * 5,
    roll: 0,
    yaw: -40,
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

/**
 * Adds a smear to a pose's effects, starting where the blade was in pose `start`: the frame before
 * for a smear frame, or the start of the swing so the impact and follow-through frames show the
 * whole stroke as one big arc, fading as it goes. `width` is how far down the blade the arc
 * reaches (kept narrow enough on overhead arcs to pass over his face).
 */
const smear = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1): ChibiPose => ({ ...p, fx: { ...p.fx, smear: { ...trail(start, p), width, alpha } } });

/** Back into the stance: k of the way from a pose to the first battle frame, the grip spread again. */
const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => spread(pose(mix(p, battle[0] as ChibiPose, k), { ...over, handB: undefined }));

// atk1: high behind his right shoulder, down across to low in front on his left.
const A1_COCK = pose(READY, { x: -2, y: 4, lean: -6, twist: -30, head: -2, look: 2, footF: [10, -1, 5.4], footB: [-11, 0, 5.2], handF: [-6, -12, 10], handB: undefined, grip: 0, weapon: -38, roll: 45, yaw: -6, wind: 0.25, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A1_SWING = pose(READY, { x: 3, y: 4, lean: 10, twist: -4, head: 2, footF: [14, 0, 5.6], handF: [12, 3, 6], handB: undefined, grip: 0, weapon: 72, roll: 40, yaw: 0, wind: 0.45, lift: 0, phase: 0.25, face: 'shout', fx: { rune: 0.8 } });
const A1_HIT = pose(READY, { x: 6, y: 8, lean: 24, twist: 14, head: 1, look: -4, footF: [15, 0, 5.8], footB: [-12, 0, 5.2], handF: [17, 14, -3], handB: undefined, grip: 0, weapon: 114, roll: 40, yaw: 0, wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impact: 0.9, dust: 0.7, rune: 1 } });
const A1_FOLLOW = pose(A1_HIT, { y: 9, lean: 26, twist: 18, head: 2, handF: [16, 16, -4], weapon: 124, wind: 0.95, lift: 0.2, phase: 0.55, face: 'grit', fx: { dust: 0.4, rune: 0.6 } });

const atk1: ChibiPose[] = [
  A1_COCK,
  smear(A1_COCK, A1_SWING, 0.7),
  smear(A1_COCK, A1_HIT, 0.55),
  smear(A1_COCK, A1_FOLLOW, 0.5, 0.4),
  pose(A1_FOLLOW, { y: 8, lean: 23, twist: 14, head: 1, handF: [15, 15, -2], weapon: 120, wind: 0.6, lift: 0.45, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: from low on his left, up across his body to high on his right.
const A2_COCK = pose(READY, { x: 2, y: 7, lean: 20, twist: 32, head: 5, look: -6, footF: [12, 0, 5.6], handF: [7, 15, -3], handB: undefined, grip: 0, weapon: 156, roll: 28, yaw: 0, wind: 0.25, lift: 0.1, sway: -0.3, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A2_SWING = pose(READY, { x: 4, y: 5, lean: 12, twist: 6, head: 2, footF: [14, 0, 5.6], handF: [13, 4, 4], handB: undefined, grip: 0, weapon: 66, roll: 28, yaw: 0, wind: 0.45, lift: -0.2, phase: 0.25, face: 'shout', fx: { rune: 0.8 } });
const A2_HIT = pose(READY, { x: 6, y: 2, lean: -3, twist: -24, head: -5, look: 2, footF: [15, 0, 5.8], footB: [-11, -1, 5.2], handF: [-6, -10, 14], handB: undefined, grip: 0, weapon: -24, roll: 28, yaw: 0, wind: 0.75, lift: 0.1, phase: 0.4, face: 'shout', fx: { impact: 0.8, rune: 1 } });
const A2_FOLLOW = pose(A2_HIT, { y: 2, lean: -5, twist: -30, head: -6, handF: [-7, -9, 14], weapon: -44, wind: 0.9, lift: 0.5, phase: 0.55, face: 'grit', fx: { rune: 0.6 } });
/** The way down from the high finish: hands dropped to his right side, the blade tipped out that way, clear of his face. */
const A2_DOWN = pose(READY, { x: 3, y: 4, lean: 6, twist: -14, head: 0, footF: [13, 0, 5.6], handF: [8, 7, 9], handB: undefined, grip: 0, weapon: 4, roll: 56, yaw: -10, wind: 0.35, lift: 0.3, phase: 0.85, face: 'stern' });

const atk2: ChibiPose[] = [
  A2_COCK,
  smear(A2_COCK, A2_SWING, 0.7),
  smear(A2_COCK, A2_HIT, 0.6),
  smear(A2_COCK, A2_FOLLOW, 0.5, 0.4),
  pose(A2_FOLLOW, { y: 3, lean: -2, twist: -26, handF: [-6, -8, 14], weapon: -48, wind: 0.55, lift: 0.6, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  A2_DOWN,
  settle(A2_DOWN, 0.9, { weapon: 58, wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: coil, spin round in a hop with the blade held out level, leap with it raised high over
// his right shoulder, and slam it down in front.
const A3_COIL = pose(READY, { x: -1, y: 8, lean: 16, twist: -36, head: 5, footF: [11, 0, 6], footB: [-11, 0, 5.6], handF: [-1, 14, 9], handB: undefined, grip: 0, weapon: -118, roll: 10, yaw: 0, wind: 0.3, face: 'grit', fx: { rune: 0.5 } });
const A3_COIL2 = pose(A3_COIL, { y: 9, lean: 18, twist: -44, turn: -28, head: 6, handF: [-3, 13, 9.5], weapon: -126, wind: 0.35, lift: 0.2, phase: 0.1, fx: { rune: 0.7 } });
const A3_SPIN1 = pose(READY, { x: 0, y: 2, lean: 8, twist: 0, turn: 95, head: 0, footF: [8, -3, 5], footB: [-8, -1, 5], handF: [5, 10, 12], handB: undefined, grip: 0, weapon: 90, roll: 0, yaw: 85, wind: 0.7, flare: 0.8, phase: 0.25, face: 'grit', fx: { ring: { from: 20, to: 185, height: 40 }, rune: 0.8 } });
const A3_SPIN2 = pose(A3_SPIN1, { y: -4, lean: 2, turn: 215, footF: [6, -6, 5], footB: [-6, -5, 5], handF: [4, 8, 12], weapon: 76, yaw: 80, wind: 0.6, flare: 1, lift: 0.4, phase: 0.4, face: 'shout', fx: { ring: { from: 130, to: 300, height: 46 }, rune: 1 } });
const A3_TOP = pose(READY, { x: 2, y: -8, lean: -10, twist: -10, turn: 360, head: -5, footF: [7, -9, 5], footB: [-7, -6, 5], handF: [-6, -10, 13], handB: undefined, grip: 0, weapon: -36, roll: 26, yaw: -6, wind: 0.45, flare: 0.4, lift: 0.7, phase: 0.55, face: 'shout', fx: { rune: 1, aura: 0.35 } });
const A3_SLAM = pose(READY, { x: 6, y: 9, lean: 30, twist: 8, turn: 360, head: 2, footF: [14, 0, 6], footB: [-11, 0, 5.5], handF: [17, 13, 1], handB: undefined, grip: 0, weapon: 128, roll: 28, yaw: 0, wind: 0.8, lift: 0.5, phase: 0.7, face: 'shout', fx: { impact: 1.3, shock: 0.05, dust: 1, rune: 1 } });
const A3_HOLD = pose(A3_SLAM, { y: 10, lean: 32, handF: [17, 15, 1], weapon: 132, wind: 0.6, lift: 0.15, phase: 0.85, face: 'grit', fx: { shock: 0.45, dust: 0.7, rune: 0.6 } });

const atk3: ChibiPose[] = [
  A3_COIL,
  A3_COIL2,
  A3_SPIN1,
  A3_SPIN2,
  A3_TOP,
  smear(A3_TOP, A3_SLAM, 0.6),
  smear(A3_TOP, A3_HOLD, 0.45, 0.35),
  pose(A3_HOLD, { y: 9, lean: 28, twist: 6, handF: [16, 14, 1], weapon: 130, wind: 0.35, lift: 0, phase: 1, face: 'stern', fx: { shock: 0.85, dust: 0.3 } }),
  settle(A3_HOLD, 0.8, { turn: 360, wind: 0.24, lift: 0.1, phase: 1.15, fx: undefined }),
];

export const CORE_CLIPS = { idle, battle, move, atk1, atk2, atk3 };
