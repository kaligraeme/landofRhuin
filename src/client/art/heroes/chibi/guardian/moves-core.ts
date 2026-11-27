/**
 * The Guardian's core moves: stances, running and the three blows of her basic attack. Poses use
 * the chibi pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck,
 * the sword's angle (0 up, 90 forward), its plane's `roll` and `yaw`, the shield's aim on her left
 * forearm (`handB` moves it, `yawB` and `rollB` turn its face) and the cloth's and hair's
 * `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease and upright, the sword hanging point down at her right, the kite shield
 *              resting forward on her left, its point near the floor: a slow breath, a blink, the
 *              cape and her tail swaying
 *   battle  8  on guard behind the shield: the shield up before her chest, the sword raised over
 *              its rim, point forward; a springy bounce on her knees, the cape and hair a frame
 *              behind
 *   move    8  a sprint, the shield carried forward on her left, the sword trailing low behind
 *              in her right hand, the cape streaming
 *   atk1    7  (1 wind-up) a diagonal cut over the shield's rim, from high behind her right
 *              shoulder to low in front
 *   atk2    7  (1 wind-up) a rising backhand cut back up the same diagonal
 *   atk3    9  (2 wind-up) the finisher: the shield driven into the foe with a burst of light
 *              on its face, then the sword raised high and brought down in a heavy chop that
 *              rings off the floor with a shockwave
 *
 * Each blow has an anticipation, a smear frame, a hit frame and a recovery into the battle stance,
 * the cape and hair streaming hardest a frame after the blow and floating up as she stops. A cut
 * leaves a swoosh that starts where the sword was (`trail`): the frame before on the smear frame,
 * the start of the swing on the hit frame, so the whole stroke shows as one arc that then fades.
 * The shield stays up before her through the cuts, its face to the foe. The chibi head is too big
 * for the hands to get above it, so a raised sword hand goes beside it, out to her right
 * (`handF` about `[-7, -8, 13]`), clear of her face side on and from the front.
 */
import { add3, type ChibiPose, mix, norm3, type P2, pose, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { GUARDIAN } from './design.js';

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BUILD = GUARDIAN.build;
const GRIP2 = GUARDIAN.weapon.grip2;
const REACH = GUARDIAN.weapon.reach[1];

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * Where a smear starts for a blow swung from pose `a` to pose `b`: the sword angle, roll and yaw
 * that point from b's grip (the smear's centre) at a's tip, so the swoosh begins where the sword
 * was in pose a even when the hand has travelled. The angle comes out on the side of a's own
 * angle, so the arc sweeps the way the sword went.
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

/**
 * Adds a smear to a pose's effects, starting where the sword was in pose `start`: the frame before
 * for a smear frame, or the start of the swing so the hit and follow-through frames show the whole
 * stroke as one arc, fading as it goes. `width` is how far down the blade the arc reaches.
 */
const smear = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1): ChibiPose => ({ ...p, fx: { ...p.fx, smear: { ...trail(start, p), width, alpha } } });

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The kite shield carried before her on guard: low on a lowered forearm, its point near the floor
 * ahead of her front foot and its top rim at her collar, its face turned about 35 degrees out
 * toward her right. Side on (the view seen most) it then shows its whole face, the sun and the
 * tower, as her biggest shape; front on it stands to her left, beside her face rather than over
 * it. A shield's face is square to the forearm, so the forearm hangs down and out from the elbow
 * for the face to turn this way: held across her chest, it would face her left and show its edge.
 */
export const SHIELD_UP: Partial<ChibiPose> = { handB: [6, 16, 14], elbowB: [0.5, -0.2, 0.4], yawB: -30, rollB: 10, weaponB: 0 };

/**
 * The shield through a blow: as on guard, a little higher and nearer her (she crouches into a
 * cut, and its point must stay off the floor), its rim at her chin front on. The blows twist her
 * body, which swings the forearm and the shield's face with it, so each pose of a blow sets its
 * own hand and aim on top of this to keep the face toward the viewer and off her face.
 */
export const SHIELD_CARRY: Partial<ChibiPose> = { handB: [2, 16, 10], elbowB: [0.5, -0.2, 0.4], yawB: -40, rollB: -10, weaponB: 0 };

/**
 * The shield raised square before her chest and the lower half of her face, its face still turned
 * toward the viewer side on, its rim at her nose front on: she peeks over it (a block, Aegis,
 * Shield's Up!).
 */
export const SHIELD_RAISED: Partial<ChibiPose> = { handB: [4, 6, 0], elbowB: [0.5, -0.2, 0.4], yawB: -10, rollB: 0, weaponB: 0 };

/**
 * The battle stance, and the guard the skill and state clips build their poses from: low and
 * wide behind the shield, the sword cocked high over her right shoulder, ready to cut down over
 * the shield's rim, its blade standing clear against the sky in every view.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 4,
  lean: 8,
  twist: -2,
  head: 2,
  look: -2,
  footF: [11, 0, 5.4],
  footB: [-11, 0, 5],
  handF: [-2, -1, 12],
  weapon: -24,
  roll: 26,
  yaw: -6,
  ...SHIELD_UP,
  wind: 0.2,
};

/** At ease: upright, the sword hanging point down at her right, the shield resting point down on the floor beside her front foot, its face out. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: -6,
  head: -2,
  look: 4,
  footF: [3, 0, 4.8],
  footB: [-4, 0, 4.6],
  handF: [3, 14, 8],
  weapon: 165,
  roll: 8,
  yaw: 12,
  handB: [4, 18, 12],
  elbowB: [0.5, -0.2, 0.4],
  yawB: -30,
  rollB: 0,
  weaponB: 0,
  wind: 0.06,
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles exactly one pixel for the second half of the
  // loop (a whole pixel, so the hair does not shimmer), while the cape sways slowly round, the
  // tail swings and she blinks once.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 0.6 + out,
    handF: [3, 14 - out * 0.4, 8],
    handB: [4, 18 - out * 0.4, 12],
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.08,
    face: i === 6 ? 'closed' : 'stern',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);
/**
 * How far she sinks on each frame of the bounce: whole pixels, with her lean held, so everything
 * above her knees (the shield and its emblem above all) moves down and up in whole-pixel steps
 * and keeps its shape instead of shimmering as it bobs.
 */
const SINK = [0, 1, 2, 3, 3, 2, 1, 0];

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back. The head nods a frame behind the body, the sword bobs
  // with it, and the cape and hair lag too: they lift as she drops and settle as she rises.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: READY.y + (SINK[i] as number),
    head: 1 + bounce(i - 1) * 2.5,
    handF: [-2, -1 + bounce(i - 1) * 1.2, 12],
    weapon: -24 + bounce(i - 1) * 6,
    wind: 0.2 + Math.max(0, lag) * 0.2,
    lift: lag * 0.4,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
  });
});

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (pass `turn` for a pose that has spun round, and any effects). The combo's recoveries use it,
 * and so do the skill and state clips that hand back to the battle stance.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, battle[0] as ChibiPose, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. A skill or state clip that the battle loop hands over to starts with it, so its first frame
 * carries the sword and shield on from where the loop holds them. Keep k at 0.5 or more.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(battle[0] as ChibiPose, p, k), over);

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [10, 0], b: [-8, -5], y: 2 },
  { f: [5, 0], b: [-6, -9], y: 3.6 },
  { f: [0, 0], b: [2, -8], y: 1 },
  { f: [-6, -1.5], b: [8, -3.5], y: -2.2 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  const footF: P2 = right ? [k.f[0], k.f[1], 4.2] : [k.b[0], k.b[1], 4.2];
  const footB: P2 = right ? [k.b[0], k.b[1], 4] : [k.f[0], k.f[1], 4];
  return {
    x: 2,
    y: k.y,
    lean: 20 + (i % 4 === 1 ? 2 : 0),
    twist: 6 + swing * 6,
    head: -8,
    look: -2,
    footF,
    footB,
    // The sword trails low behind her; the shield is carried low on her left, its face out toward
    // her right as on guard, bobbing with the stride.
    handF: [-4 - swing * 2, 15 - Math.abs(swing), 9],
    weapon: -112 + swing * 5,
    roll: 0,
    yaw: -30,
    handB: [4 + swing * 1.5, 16 - Math.abs(swing), 10],
    elbowB: [0.5, -0.2, 0.4],
    yawB: -40,
    rollB: -10,
    weaponB: 0,
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

/** The shield kept before her through a cut. */
const TUCK = SHIELD_CARRY;

// atk1: high behind her right shoulder, down across to low in front, over the shield's rim.
const A1_COCK = pose(READY, { x: -2, y: 4, lean: -4, twist: -24, head: -2, look: 2, footF: [9, -1, 5], footB: [-9, 0, 4.6], handF: [-7, -8, 12.5], weapon: -42, roll: 44, yaw: -6, ...TUCK, wind: 0.25, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.3 } });
const A1_SWING = pose(READY, { x: 3, y: 4, lean: 10, twist: -4, head: 2, footF: [12, 0, 5.2], handF: [11, 3, 8], weapon: 68, roll: 44, yaw: 0, ...TUCK, handB: [8, 16, 14], yawB: -30, wind: 0.45, lift: 0, phase: 0.25, face: 'shout', fx: { rune: 0.5 } });
const A1_HIT = pose(READY, { x: 5, y: 7, lean: 20, twist: 14, head: 1, look: -4, footF: [14, 0, 5.4], footB: [-11, 0, 4.6], handF: [15, 13, -2], weapon: 116, roll: 40, yaw: 0, ...TUCK, handB: [10, 14, 14], yawB: -30, wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impact: 0.8, dust: 0.6, rune: 0.6 } });
const A1_FOLLOW = pose(A1_HIT, { y: 8, lean: 22, twist: 18, head: 2, handF: [14, 15, -3], weapon: 126, wind: 0.9, lift: 0.15, phase: 0.55, face: 'grit', fx: { dust: 0.3, rune: 0.4 } });

const atk1: ChibiPose[] = [
  A1_COCK,
  smear(A1_COCK, A1_SWING, 0.7),
  smear(A1_COCK, A1_HIT, 0.55),
  smear(A1_COCK, A1_FOLLOW, 0.5, 0.4),
  pose(A1_FOLLOW, { y: 7, lean: 20, twist: 14, head: 1, handF: [13, 14, -1], weapon: 120, wind: 0.6, lift: 0.2, phase: 0.7, face: 'stern', fx: { rune: 0.2 } }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.12, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: from low on her left, up across her body to high on her right: a rising backhand.
const A2_COCK = pose(READY, { x: 1, y: 7, lean: 8, twist: 26, head: 0, look: -6, footF: [11, 0, 5.2], handF: [7, 15, -3], weapon: 156, roll: 30, yaw: 0, ...TUCK, handB: [10, 14, 12], rollB: 0, wind: 0.25, lift: 0.1, sway: -0.3, phase: 0.1, face: 'grit', fx: { rune: 0.3 } });
const A2_SWING = pose(READY, { x: 3, y: 5, lean: 12, twist: 6, head: 2, footF: [13, 0, 5.2], handF: [12, 5, 4], weapon: 68, roll: 30, yaw: 0, ...TUCK, handB: [8, 16, 14], rollB: 10, wind: 0.45, lift: -0.2, phase: 0.25, face: 'shout', fx: { rune: 0.5 } });
const A2_HIT = pose(READY, { x: 5, y: 3, lean: -2, twist: -22, head: -4, look: 2, footF: [14, 0, 5.4], footB: [-10, -1, 4.6], handF: [-5, -9, 13], weapon: -22, roll: 30, yaw: 0, ...TUCK, wind: 0.75, lift: 0.1, phase: 0.4, face: 'shout', fx: { impact: 0.7, rune: 0.6 } });
const A2_FOLLOW = pose(A2_HIT, { y: 3, lean: -4, twist: -26, head: -5, handF: [-6, -8, 13], weapon: -40, wind: 0.9, lift: 0.25, phase: 0.55, face: 'grit', fx: { rune: 0.4 } });
/** The way down from the high finish: the hand dropped to her right side, the sword tipped out that way, clear of her face. */
const A2_DOWN = pose(READY, { x: 3, y: 4, lean: 6, twist: -12, head: 0, footF: [12, 0, 5.2], handF: [7, 7, 9.5], weapon: 8, roll: 50, yaw: -8, ...TUCK, handB: [4, 16, 12], yawB: -30, rollB: 10, wind: 0.35, lift: 0.15, phase: 0.85, face: 'stern' });

const atk2: ChibiPose[] = [
  A2_COCK,
  smear(A2_COCK, A2_SWING, 0.7),
  smear(A2_COCK, A2_HIT, 0.6),
  smear(A2_COCK, A2_FOLLOW, 0.5, 0.4),
  pose(A2_FOLLOW, { y: 3, lean: -2, twist: -22, handF: [-5, -7, 13], weapon: -44, wind: 0.55, lift: 0.3, phase: 0.7, face: 'stern', fx: { rune: 0.2 } }),
  A2_DOWN,
  settle(A2_DOWN, 0.9, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: coil behind the shield, drive it into the foe, then raise the sword high over her right
// shoulder and bring it down in a heavy chop in front.
const A3_COIL = pose(READY, { x: -2, y: 7, lean: 4, twist: -20, head: 4, look: 2, footF: [10, 0, 5.4], footB: [-11, 0, 4.8], handF: [-2, 12, 10], weapon: -100, roll: 10, yaw: -20, ...TUCK, handB: [6, 14, 12], yawB: -30, rollB: 0, wind: 0.3, face: 'grit', fx: { runeB: 0.15 } });
const A3_COIL2 = pose(A3_COIL, { y: 8, lean: 6, twist: -26, head: 5, handB: [5, 14, 12], phase: 0.1, lift: 0.15, fx: { runeB: 0.25, rune: 0.3 } });
const A3_BASH = pose(READY, { x: 7, y: 6, lean: 18, twist: 22, head: 0, look: -4, footF: [16, 0, 5.4], footB: [-12, 0, 4.6], handF: [-3, 12, 10], weapon: -90, roll: 10, yaw: -24, ...TUCK, handB: [10, 14, 12], rollB: 0, wind: 0.6, phase: 0.25, face: 'shout', fx: { runeB: 0.35, impactB: 0.9, ghosts: { k: 0.4 }, dust: 0.7 } });
const A3_TOP = pose(READY, { x: 6, y: 2, lean: -6, twist: -12, head: -4, look: 0, footF: [15, 0, 5.4], footB: [-10, -2, 4.6], handF: [-6, -9, 13], weapon: -34, roll: 24, yaw: -6, ...TUCK, handB: [6, 16, 14], rollB: 10, wind: 0.45, lift: 0.3, phase: 0.4, face: 'shout', fx: { rune: 0.9, runeB: 0.15, aura: 0.3 } });
const A3_CHOP = pose(READY, { x: 8, y: 9, lean: 28, twist: 8, head: 2, look: -2, footF: [16, 0, 5.6], footB: [-11, 0, 4.8], handF: [16, 13, 2], weapon: 130, roll: 16, yaw: 0, ...TUCK, handB: [8, 8, 14], yawB: -50, rollB: 10, wind: 0.8, lift: 0.2, phase: 0.55, face: 'shout', fx: { impact: 1.25, shock: 0.05, dust: 1, rune: 1 } });
const A3_HOLD = pose(A3_CHOP, { y: 10, lean: 30, handF: [16, 15, 2], weapon: 134, wind: 0.6, lift: 0.15, phase: 0.7, face: 'grit', fx: { shock: 0.45, dust: 0.7, rune: 0.6 } });

const atk3: ChibiPose[] = [
  A3_COIL,
  A3_COIL2,
  A3_BASH,
  A3_TOP,
  smear(A3_TOP, A3_CHOP, 0.6),
  smear(A3_TOP, A3_HOLD, 0.45, 0.35),
  pose(A3_HOLD, { y: 9, lean: 26, twist: 6, handF: [15, 14, 2], weapon: 132, wind: 0.35, lift: 0, phase: 0.85, face: 'stern', fx: { shock: 0.85, dust: 0.3, rune: 0.3 } }),
  settle(A3_HOLD, 0.6, { wind: 0.3, lift: 0.1, phase: 1, fx: undefined }),
  settle(A3_HOLD, 0.9, { wind: 0.24, lift: 0.05, phase: 1.1, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
