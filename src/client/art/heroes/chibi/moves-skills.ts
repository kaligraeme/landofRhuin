/**
 * The Dark Knight's skills, in the chibi pose format (rig.ts, ChibiPose). Wind-up frames come
 * first; the game stretches them over the server's wind-up.
 *
 *   cast       8  (2 wind-up) role skills: plant the feet, raise the blade, a roar, aura and rune circle
 *   charge     8  (1 wind-up) Stalwart Charge: crouch, a shoulder-first dash, blade low, a braced stop
 *   eclipse   10  (1 wind-up) Eclipse: a full turn with the blade held out level, a ring of steel
 *   drain     10  (2 wind-up) Drain: the blade driven into the ground, wisps drawn in, the body glows
 *   ruination 16  (2 wind-up) Ruination: a mist of blood, a leap, three strikes falling and a slam
 *                 (strikes on frames 5, 8, 11 and the slam on 14, about when the server lands them)
 */
import { GUARD_STANCE } from './moves-core.js';
import { type ChibiPose, pose } from './rig.js';

const S = GUARD_STANCE;

const cast: ChibiPose[] = [
  // Plant the feet wide, blade low.
  pose(S, { y: 7, lean: 10, twist: -6, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [9, 14, 4], weapon: 110, roll: 20, face: 'grit', fx: { aura: 0.25, circle: 0.3 } }),
  pose(S, { y: 8, lean: 6, twist: -2, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [6, 8, 4], weapon: 40, roll: 12, face: 'grit', lift: 0.2, fx: { aura: 0.5, circle: 0.55, rune: 0.6 } }),
  // The blade raised high: the roar.
  pose(S, { y: 5, lean: -6, twist: 0, head: -10, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [3, -13, 3], weapon: -4, roll: 6, face: 'shout', lift: 0.7, wind: 0.3, fx: { aura: 1, circle: 1, rune: 1, impact: 1.1 } }),
  pose(S, { y: 5, lean: -7, twist: 0, head: -11, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [3, -14, 3], weapon: -3, roll: 6, face: 'shout', lift: 0.8, wind: 0.35, phase: 0.25, fx: { aura: 1, circle: 1, rune: 1 } }),
  pose(S, { y: 5, lean: -6, twist: 0, head: -9, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [3, -13, 3], weapon: -4, roll: 6, face: 'shout', lift: 0.6, wind: 0.3, phase: 0.5, fx: { aura: 0.8, circle: 0.9, rune: 0.8 } }),
  pose(S, { y: 6, lean: 0, twist: -4, head: -4, footF: [12, 0, 6], footB: [-11, 0, 5.6], handF: [5, -6, 4], weapon: 20, roll: 14, face: 'stern', lift: 0.3, phase: 0.75, fx: { aura: 0.5, circle: 0.6, rune: 0.5 } }),
  pose(S, { y: 6, lean: 8, twist: -10, footF: [11, 0, 5.6], handF: [7, 6, 4], weapon: 40, roll: 24, fx: { aura: 0.25, circle: 0.3 } }),
  pose(S, { y: 5, lean: 12, handF: [8, 10, 4], weapon: 48 }),
];

const charge: ChibiPose[] = [
  // Crouch, shoulder turned toward the foe, blade low and back.
  pose(S, { x: -2, y: 10, lean: 26, twist: 28, head: -6, footF: [9, 0, 5.4], footB: [-12, 0, 5], handF: [4, 18, 7], weapon: 120, roll: -10, yaw: -20, face: 'grit', wind: 0.3, fx: { aura: 0.5, dust: 0.4 } }),
  // Launch.
  pose(S, { x: 8, y: 6, lean: 38, twist: 34, head: -14, footF: [16, -3, 5], footB: [-12, 0, 5], handF: [10, 18, 6], weapon: 100, roll: -12, yaw: -15, face: 'shout', wind: 1, phase: 0.1, fx: { aura: 1, dust: 1, speed: 1 } }),
  // The dash: shoulder first, blade low and forward.
  pose(S, { x: 12, y: 4, lean: 36, twist: 34, head: -14, footF: [20, -5, 5], footB: [-2, -8, 5], handF: [12, 18, 6], weapon: 96, roll: -12, yaw: -12, face: 'shout', wind: 1.1, phase: 0.3, fx: { aura: 1, speed: 1 } }),
  pose(S, { x: 12, y: 3, lean: 36, twist: 34, head: -14, footF: [14, -6, 5], footB: [6, -4, 5], handF: [12, 18, 6], weapon: 96, roll: -12, yaw: -12, face: 'shout', wind: 1.1, phase: 0.5, fx: { aura: 1, speed: 1 } }),
  pose(S, { x: 12, y: 4, lean: 36, twist: 34, head: -14, footF: [22, -2, 5], footB: [-4, -9, 5], handF: [12, 18, 6], weapon: 96, roll: -12, yaw: -12, face: 'shout', wind: 1.1, phase: 0.7, fx: { aura: 0.9, speed: 1, dust: 0.5 } }),
  // The braced stop: heels dug in, cloth thrown forward.
  pose(S, { x: 8, y: 8, lean: 6, twist: 12, head: -2, footF: [18, 0, 6], footB: [-6, 0, 5.6], handF: [12, 12, 5], weapon: 80, roll: 10, face: 'grit', wind: 0.2, sway: 0.4, phase: 0.9, fx: { aura: 0.6, dust: 1 } }),
  pose(S, { x: 6, y: 7, lean: 10, twist: 0, footF: [16, 0, 6], footB: [-8, 0, 5.6], handF: [10, 11, 4], weapon: 60, face: 'stern', wind: 0.15, fx: { aura: 0.3, dust: 0.4 } }),
  pose(S, { x: 3, y: 5, lean: 12, handF: [8, 11, 4], weapon: 52 }),
];

/** Eclipse: frame i of the turn, the blade level out to his right, a ring trailing it. */
function spin(i: number): ChibiPose {
  const turn = i * 45;
  return pose(S, {
    y: 6,
    lean: 6,
    twist: 10,
    turn,
    head: 0,
    footF: [9, 0, 6.5],
    footB: [-9, 0, 6],
    handF: [6, 12, 10],
    weapon: 90,
    roll: 0,
    yaw: 86,
    face: 'shout',
    wind: 0.4,
    flare: 1,
    phase: i / 8,
    fx: { ring: { from: turn + 90 - 200, to: turn + 90, height: 36 }, rune: 1, aura: 0.4 },
  });
}

const eclipse: ChibiPose[] = [
  // Wind-up: wound up to the left, the blade held back.
  pose(S, { y: 7, lean: 8, twist: -40, turn: -30, footF: [9, 0, 6.5], footB: [-9, 0, 6], handF: [2, 12, 9], weapon: 90, roll: 0, yaw: -20, face: 'grit', wind: 0.3, fx: { rune: 0.6, aura: 0.3 } }),
  spin(1),
  spin(2),
  spin(3),
  spin(4),
  spin(5),
  spin(6),
  spin(7),
  pose(spin(8), { fx: { ring: { from: 8 * 45 + 90 - 140, to: 8 * 45 + 90, height: 36 }, rune: 0.5 } }),
  pose(S, { y: 6, lean: 10, twist: 10, handF: [8, 11, 6], weapon: 70, roll: 10, flare: 0.3, wind: 0.3 }),
];

/** Drain: the blade planted point down in front of him, buried in the ground. */
const planted = (k: number, phase: number): ChibiPose =>
  pose(S, {
    x: 1,
    y: 11,
    lean: 16,
    twist: 0,
    head: 8,
    footF: [10, 0, 6],
    footB: [-11, 0, 5.6],
    handF: [11, 4, 1],
    weapon: 178,
    roll: 0,
    face: 'grit',
    lift: 0.25 + k * 0.4,
    wind: 0.15,
    phase,
    fx: { wisps: k, glow: k, aura: 0.4 + k * 0.6, circle: 0.6 + k * 0.4, rune: 1 },
  });

const drain: ChibiPose[] = [
  // Raise the blade point down.
  pose(S, { y: 4, lean: 0, twist: 0, head: -4, handF: [7, -10, 1], weapon: 178, roll: 0, face: 'grit', fx: { rune: 0.6, aura: 0.3 } }),
  pose(S, { y: 2, lean: -4, twist: 0, head: -6, handF: [6, -13, 1], weapon: 178, roll: 0, face: 'shout', lift: 0.3, fx: { rune: 1, aura: 0.6 } }),
  // Drive it into the ground.
  pose(planted(0, 0), { y: 12, fx: { impact: 1, shock: 0.1, dust: 1, rune: 1, aura: 0.8, shockAt: [12, 0, 1] } }),
  planted(0.15, 0.1),
  planted(0.35, 0.2),
  planted(0.55, 0.3),
  planted(0.75, 0.4),
  planted(0.92, 0.5),
  pose(planted(1, 0.6), { fx: { glow: 1, aura: 1, circle: 1, rune: 1 } }),
  // Pull it free.
  pose(S, { y: 6, lean: 8, head: 2, handF: [9, 6, 3], weapon: 120, roll: 10, fx: { aura: 0.4, rune: 0.5 } }),
];

/** Ruination: in the air, a strike frame (blade low in front) or a recock (blade high behind). */
const air = (y: number, strike: boolean, from: number, extra: Partial<ChibiPose> = {}): ChibiPose =>
  pose(S, {
    x: 4,
    y,
    lean: strike ? 30 : -8,
    twist: strike ? 20 : -20,
    head: strike ? 6 : -4,
    footF: strike ? [10, y < -10 ? -14 : -6, 5] : [6, y < -10 ? -16 : -8, 5],
    footB: strike ? [-8, y < -10 ? -10 : -4, 5] : [-6, y < -10 ? -12 : -5, 5],
    handF: strike ? [15, 10, 1] : [-1, -9, 3],
    weapon: strike ? 125 : from,
    roll: strike ? 18 : 22,
    face: 'shout',
    wind: 0.5,
    lift: 0.8,
    phase: (y + 40) / 30,
    fx: strike ? { smear: { from, width: 0.8 }, impact: 1, rune: 1, aura: 1, blood: 0.6 } : { rune: 1, aura: 1, blood: 0.7 },
    ...extra,
  });

const ruination: ChibiPose[] = [
  // The price: a mist of blood, a deep crouch.
  pose(S, { y: 9, lean: 18, twist: -10, head: 6, handF: [6, 14, 5], weapon: 120, roll: 10, face: 'grit', fx: { blood: 0.7, aura: 0.5, rune: 0.6 } }),
  pose(S, { y: 12, lean: 22, twist: -14, head: 8, handF: [4, 15, 5], weapon: 130, roll: 10, face: 'grit', lift: 0.4, fx: { blood: 1, aura: 1, rune: 1, dust: 0.5 } }),
  // The leap.
  pose(S, { x: 2, y: -14, lean: 0, twist: -10, head: -6, footF: [6, -12, 5], footB: [-4, -8, 5], handF: [2, -8, 4], weapon: -30, roll: 20, face: 'shout', lift: 1, wind: 0.4, fx: { blood: 0.9, aura: 1, rune: 1, dust: 0.8 } }),
  pose(S, { x: 3, y: -30, lean: -8, twist: -14, head: -8, footF: [6, -26, 5], footB: [-4, -22, 5], handF: [0, -10, 3], weapon: -50, roll: 20, face: 'shout', lift: 0.8, wind: 0.3, fx: { blood: 0.7, aura: 1, rune: 1 } }),
  air(-30, false, -100),
  air(-27, true, -100),
  air(-24, false, -70, { fx: { rune: 1, aura: 1, blood: 0.5 } }),
  air(-21, false, -110),
  air(-18, true, -110),
  air(-14, false, -70, { fx: { rune: 1, aura: 1, blood: 0.4 } }),
  air(-11, false, -110),
  air(-8, true, -110),
  // Recock high for the slam.
  air(-5, false, -125, { handF: [-2, -11, 2], fx: { rune: 1, aura: 1, blood: 0.3 } }),
  pose(S, { x: 4, y: -2, lean: -6, twist: -10, head: -4, footF: [8, -3, 5], footB: [-6, -2, 5], handF: [0, -11, 2], weapon: -70, roll: 0, face: 'shout', lift: 0.6, fx: { rune: 1, aura: 1, smear: { from: -125, width: 0.5, alpha: 0.6 } } }),
  // The slam.
  pose(S, { x: 7, y: 10, lean: 34, twist: 4, head: 8, footF: [15, 0, 6], footB: [-11, 0, 5.6], handF: [17, 13, 0], weapon: 128, roll: 0, face: 'shout', wind: 0.8, lift: -0.2, fx: { smear: { from: -70, width: 0.85 }, impact: 1.5, shock: 0.12, dust: 1, rune: 1, aura: 0.8 } }),
  pose(S, { x: 7, y: 10, lean: 33, twist: 4, head: 7, footF: [15, 0, 6], footB: [-11, 0, 5.6], handF: [17, 14, 0], weapon: 132, roll: 0, face: 'grit', wind: 0.4, fx: { shock: 0.6, dust: 0.6, rune: 0.6, aura: 0.4 } }),
];

export const SKILL_CLIPS_DK = { cast, charge, eclipse, drain, ruination };
