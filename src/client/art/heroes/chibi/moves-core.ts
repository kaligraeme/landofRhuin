/**
 * The Dark Knight's core moves: stances, running and the three-hit greatsword combo. Poses use the
 * chibi pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the
 * blade's angle (0 up, 90 forward), its plane's `roll` and the cloth's `wind`/`phase`.
 *
 *   idle    6  relaxed, the greatsword resting on his right shoulder, fist on his hip, breathing
 *   battle  6  a low, wide guard, blade angled forward in both hands, bouncing on his knees
 *   move    8  a chibi sprint: hard lean, bouncy strides, the blade trailing low behind
 *   atk1    7  (1 wind-up) a diagonal cut from high behind his right shoulder to low in front
 *   atk2    7  (1 wind-up) a rising backhand cut up the same diagonal, the reverse arc
 *   atk3    9  (2 wind-up) a spinning leap into a heavy overhead slam: impact, shockwave, dust
 */
import { type ChibiPose, pose, wave } from './rig.js';

/** The battle stance every attack starts from and returns to. */
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

const idle = Array.from({ length: 6 }, (_, i): ChibiPose => {
  const b = wave(i, 6);
  return pose(AT_EASE, {
    y: 1 + b * 0.9,
    lean: 2 - b * 1.2,
    head: -3 + b * 2,
    handF: [4, 6 + b * 0.9, 7.4],
    handB: [1, 14 + b * 0.8, 11],
    weapon: -64 + b * 2.5,
    sway: Math.sin((2 * Math.PI * i) / 6) * 0.35,
    phase: i / 6,
    wind: 0.05 + b * 0.05,
  });
});

const battle = Array.from({ length: 6 }, (_, i): ChibiPose => {
  const b = wave(i, 6);
  return pose(GUARD_STANCE, {
    y: 4.2 + b * 1.8,
    lean: 12.5 + b * 1.5,
    head: 4 - b * 1.5,
    handF: [8, 10.6 + b * 1.4, 9.5],
    weapon: 49 + b * 4,
    sway: Math.sin((2 * Math.PI * i) / 6) * 0.25,
    phase: i / 6,
    wind: 0.2 + b * 0.08,
  });
});

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [11, 0], b: [-9, -6], y: 2 },
  { f: [6, 0], b: [-7, -10], y: 3.6 },
  { f: [0, 0], b: [2, -8.5], y: 1.2 },
  { f: [-6, -1.5], b: [9, -4], y: -2.4 },
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
    // The blade rides on his right shoulder; the left arm pumps against the legs.
    handF: [5, 4 + swing * 0.8, 7.6],
    weapon: -36 + swing * 3,
    roll: 22,
    yaw: -18,
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

const atk1: ChibiPose[] = [
  // Wind-up: the blade raised high over his right shoulder.
  pose(GUARD_STANCE, { x: -1, y: 4, lean: -5, twist: -32, head: 0, footF: [11, 0, 5.4], handF: [-1, -8, 8], weapon: -72, roll: 36, yaw: -22, wind: 0.35, face: 'grit' }),
  // Coming over the top.
  pose(GUARD_STANCE, { x: 2, y: 3, lean: 6, twist: -12, head: 0, footF: [13, 0, 5.4], handF: [6, -7, 8], weapon: -22, roll: 42, wind: 0.55, face: 'grit', fx: { smear: { from: -72, roll: 36, yaw: -22, width: 0.5 }, rune: 0.4 } }),
  // The blow lands low in front.
  pose(GUARD_STANCE, { x: 6, y: 7, lean: 25, twist: 22, head: 6, footF: [15, 0, 5.6], footB: [-11, 0, 5], handF: [15, 9, 0], weapon: 108, roll: 42, wind: 0.85, face: 'shout', fx: { smear: { from: -40, width: 0.72 }, impact: 0.9, dust: 0.6, rune: 0.8 } }),
  // Follow-through.
  pose(GUARD_STANCE, { x: 6, y: 8, lean: 27, twist: 30, head: 7, footF: [15, 0, 5.6], footB: [-11, 0, 5], handF: [13, 14, -1], weapon: 122, roll: 40, wind: 0.65, face: 'grit', fx: { smear: { from: 100, width: 0.6, alpha: 0.55 }, rune: 0.5 } }),
  pose(GUARD_STANCE, { x: 5, y: 8, lean: 25, twist: 28, head: 6, footF: [15, 0, 5.6], footB: [-11, 0, 5], handF: [12, 15, 0], weapon: 124, roll: 38, wind: 0.45 }),
  // Recover to the guard.
  pose(GUARD_STANCE, { x: 3, y: 6, lean: 19, twist: 6, footF: [12, 0, 5.4], handF: [10, 13, 4], weapon: 96, wind: 0.32 }),
  pose(GUARD_STANCE, { x: 1, y: 5, lean: 14, twist: -10, handF: [8, 11, 4], weapon: 62, wind: 0.26 }),
];

const atk2: ChibiPose[] = [
  // Wind-up: low on his left, the blade trailing.
  pose(GUARD_STANCE, { x: 3, y: 7, lean: 22, twist: 30, head: 6, footF: [13, 0, 5.4], handF: [12, 14, -2], weapon: 124, roll: 40, wind: 0.3, face: 'grit' }),
  pose(GUARD_STANCE, { x: 4, y: 6, lean: 15, twist: 16, head: 3, footF: [14, 0, 5.4], handF: [13, 6, 0], weapon: 100, roll: 40, wind: 0.5, face: 'grit', fx: { smear: { from: 128, width: 0.5 } } }),
  // The rising cut ends high on his right.
  pose(GUARD_STANCE, { x: 6, y: 3, lean: 0, twist: -26, head: -4, footF: [15, 0, 5.6], handF: [6, -8, 5], weapon: -10, roll: 42, wind: 0.75, face: 'shout', fx: { smear: { from: 118, width: 0.72 }, impact: 0.8, rune: 0.8 } }),
  pose(GUARD_STANCE, { x: 6, y: 3, lean: -4, twist: -32, head: -5, footF: [15, 0, 5.6], handF: [2, -9, 6], weapon: -46, roll: 42, wind: 0.6, fx: { smear: { from: -6, width: 0.6, alpha: 0.55 } } }),
  pose(GUARD_STANCE, { x: 5, y: 4, lean: 0, twist: -28, head: -2, footF: [14, 0, 5.6], handF: [2, -7, 6], weapon: -52, roll: 40, wind: 0.4 }),
  pose(GUARD_STANCE, { x: 3, y: 5, lean: 8, twist: -18, footF: [12, 0, 5.4], handF: [6, 3, 5], weapon: 12, wind: 0.3 }),
  pose(GUARD_STANCE, { x: 1, y: 5, lean: 12, twist: -14, handF: [8, 9, 4], weapon: 42, wind: 0.25 }),
];

const atk3: ChibiPose[] = [
  // Wind-up: crouched low, the blade swung back behind him.
  pose(GUARD_STANCE, { y: 8, lean: 18, twist: -36, head: 5, handF: [0, 14, 7], weapon: -112, roll: 8, wind: 0.3, face: 'grit' }),
  pose(GUARD_STANCE, { y: 9, lean: 20, twist: -46, turn: -20, head: 6, handF: [-2, 13, 7.5], weapon: -122, roll: 8, wind: 0.35, face: 'grit', fx: { rune: 0.6 } }),
  // A spinning hop, the blade sweeping round and up.
  pose(GUARD_STANCE, { y: 3, lean: 10, twist: 0, turn: 110, footF: [8, -3, 5], footB: [-8, -1, 5], handF: [6, 4, 6], weapon: -60, roll: 20, wind: 0.7, flare: 0.8, face: 'grit', fx: { ring: { from: -40, to: 140, height: 40 }, rune: 0.8 } }),
  pose(GUARD_STANCE, { y: -5, lean: -4, twist: 0, turn: 240, footF: [6, -6, 5], footB: [-6, -5, 5], handF: [3, -6, 3], weapon: -24, roll: 10, wind: 0.6, flare: 1, lift: 0.4, face: 'shout', fx: { ring: { from: 100, to: 270, height: 52 }, rune: 1 } }),
  // At the top, the blade raised behind his head.
  pose(GUARD_STANCE, { x: 2, y: -7, lean: -10, twist: -6, turn: 360, footF: [8, -7, 5], footB: [-7, -5, 5], handF: [-1, -10, 2], weapon: -82, roll: 14, wind: 0.5, flare: 0.5, lift: 0.6, face: 'shout', fx: { rune: 1, aura: 0.3 } }),
  // The slam: the blade crashes down in front of him.
  pose(GUARD_STANCE, { x: 6, y: 9, lean: 32, twist: 4, footF: [14, 0, 6], footB: [-11, 0, 5.5], handF: [16, 12, 2], weapon: 126, roll: 18, wind: 0.85, lift: -0.2, face: 'shout', fx: { smear: { from: -82, width: 0.85 }, impact: 1.3, shock: 0.05, dust: 1, rune: 1 } }),
  pose(GUARD_STANCE, { x: 6, y: 10, lean: 34, twist: 4, footF: [14, 0, 6], footB: [-11, 0, 5.5], handF: [16, 14, 2], weapon: 130, roll: 18, wind: 0.5, face: 'grit', fx: { shock: 0.45, dust: 0.7, rune: 0.6 } }),
  pose(GUARD_STANCE, { x: 6, y: 9, lean: 31, twist: 2, footF: [14, 0, 6], footB: [-11, 0, 5.5], handF: [15, 14, 2], weapon: 130, roll: 18, wind: 0.3, fx: { shock: 0.85, dust: 0.3 } }),
  pose(GUARD_STANCE, { x: 3, y: 6, lean: 18, twist: -8, handF: [9, 12, 4], weapon: 80, wind: 0.25 }),
];

export const CORE_CLIPS = { idle, battle, move, atk1, atk2, atk3 };
