/**
 * The Dark Knight's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   guard    4  Parry: a braced crouch behind the blade held level across his body, a clang
 *   hurt     3  a flinch: knocked back, head snapped, coat flicked forward
 *   kneel    4  (loop) low health: down on his left knee, leaning on the planted blade, heaving
 *   ko       6  (hold) stagger, drop to his knees, topple; the last frame lies on his back, blade dropped
 *   victory  8  (hold) a flourish of the blade, then it comes to rest on his shoulder, coat billowing
 */
import { AT_EASE, GUARD_STANCE } from './moves-core.js';
import { type ChibiPose, pose, wave } from './rig.js';

const S = GUARD_STANCE;

/** The blade held level across his body, the left hand braced on its flat. */
const BLOCK: ChibiPose = pose(S, { x: -1, y: 8, lean: 4, twist: 18, head: 4, footF: [11, 0, 6], footB: [-10, 0, 5.6], handF: [9, -1, 7], handB: [10, 0, -6], weapon: 90, roll: 0, yaw: -78, face: 'grit', wind: 0.2 });

const guard: ChibiPose[] = [
  pose(BLOCK, { y: 6, lean: 8, handF: [9, 2, 7], handB: [10, 3, -6], fx: { rune: 0.5 } }),
  pose(BLOCK, { fx: { clang: 1, rune: 1 }, wind: 0.5, phase: 0.2 }),
  pose(BLOCK, { x: -3, y: 9, lean: 0, head: 2, wind: 0.4, phase: 0.4, fx: { clang: 0.35, dust: 0.6, rune: 0.6 } }),
  pose(BLOCK, { x: -2, y: 8, lean: 3, phase: 0.6, fx: { rune: 0.4 } }),
];

const hurt: ChibiPose[] = [
  pose(S, { x: -4, y: 5, lean: -12, twist: -8, head: -16, look: -6, handF: [5, 12, 5], weapon: 60, roll: 36, face: 'hurt', wind: 0, sway: -0.6, lift: 0.4, phase: 0.2 }),
  pose(S, { x: -5, y: 6, lean: -10, twist: -10, head: -10, look: -4, handF: [5, 13, 5], weapon: 64, roll: 36, face: 'hurt', wind: 0, sway: -0.3, lift: 0.2, phase: 0.4 }),
  pose(S, { x: -2, y: 6, lean: 4, twist: -12, head: 0, handF: [7, 12, 4], weapon: 55, face: 'grit', wind: 0.15, phase: 0.6 }),
];

/** Down on the left knee, both hands on the blade planted at a slant in front of him. */
const KNELT: ChibiPose = {
  x: 0,
  y: 12,
  lean: 20,
  twist: -4,
  head: 12,
  footF: [9, 0, 5.5],
  footB: [-9, -1, 4.6],
  kneel: 'B',
  handF: [11, 9, 2],
  weapon: 128,
  roll: -6,
  face: 'grit',
  wind: 0.05,
};

const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, { y: 12 + b * 1.2, lean: 20 + b * 4, head: 12 + b * 5, handF: [11, 9 + b * 0.8, 2], phase: i / 4, sway: (b - 0.5) * 0.2 });
});

const ko: ChibiPose[] = [
  // Stagger back.
  pose(S, { x: -4, y: 5, lean: -14, twist: -10, head: -16, handF: [4, 14, 6], weapon: 70, roll: 30, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // Down on both knees, the blade slipping.
  pose(S, { x: -2, y: 14, lean: 6, twist: 0, head: 16, footF: [-8, -1, 5], footB: [-9, -1, 4.6], handF: [8, 16, 7], weapon: 140, roll: 20, face: 'closed', wind: 0 }),
  pose(S, { x: -2, y: 15, lean: 20, twist: 0, head: 22, footF: [-8, -1, 5], footB: [-9, -1, 4.6], handF: [9, 20, 8], handB: [4, 20, 9], drop: true, dropAt: [12, 3, 8], weapon: 100, roll: 0, yaw: 20, face: 'closed', wind: 0 }),
  // Toppling back.
  pose(S, { x: -5, y: 17, lean: -40, twist: 0, head: -8, footF: [4, -2, 5], footB: [0, -1, 5], handF: [4, 6, 11], handB: [2, 6, 11], drop: true, dropAt: [14, 1, 9], weapon: 96, roll: 0, yaw: 24, face: 'closed', wind: 0, lift: 0.5 }),
  // Lying on his back.
  pose(S, { x: -8, y: 22, lean: -84, twist: 0, head: -16, footF: [10, -1, 6], footB: [6, -3, 5], handF: [-2, 2, 13], handB: [-4, 1, 12], drop: true, dropAt: [14, 1.2, 10], weapon: 96, roll: 0, yaw: 24, face: 'closed', wind: 0, lift: -0.3, fx: { dust: 0.7 } }),
  pose(S, { x: -8, y: 22, lean: -86, twist: 0, head: -16, footF: [11, -1, 6], footB: [7, -2, 5], handF: [-2, 3, 13], handB: [-4, 2, 12], drop: true, dropAt: [14, 1.2, 10], weapon: 96, roll: 0, yaw: 24, face: 'closed', wind: 0, lift: -0.4 }),
];

const victory: ChibiPose[] = [
  // A flourish: the blade whirled up and round.
  pose(S, { y: 4, lean: 4, twist: 10, head: -2, handF: [10, 4, 6], weapon: 20, roll: 30, face: 'grit', wind: 0.4, fx: { smear: { from: 60, width: 0.5, alpha: 0.7 } } }),
  pose(S, { y: 3, lean: -2, twist: 20, head: -4, handF: [8, -4, 8], weapon: -100, roll: 50, wind: 0.6, flare: 0.4, fx: { smear: { from: 20, width: 0.55 }, rune: 0.8 } }),
  pose(S, { y: 3, lean: 2, twist: 24, head: -4, handF: [10, 6, 9], weapon: -200, roll: 50, wind: 0.6, flare: 0.5, fx: { smear: { from: -100, width: 0.55 }, rune: 1 } }),
  // Pointed at the sky, coat thrown back.
  pose(S, { y: 2, lean: -4, twist: 14, head: -8, footF: [8, 0, 5.4], footB: [-8, 0, 5], handF: [7, -12, 6], weapon: 8, roll: 16, face: 'shout', wind: 0.5, lift: 0.5, fx: { impact: 0.7, rune: 1, aura: 0.4 } }),
  // Down onto his shoulder.
  pose(AT_EASE, { y: 1, lean: 0, head: -4, look: 6, handF: [5, 2, 7.4], weapon: -40, wind: 0.5, lift: 0.4, phase: 0.2, face: 'stern' }),
  pose(AT_EASE, { y: 1, lean: 1, head: -6, look: 10, wind: 0.6, lift: 0.3, sway: 0.3, phase: 0.4, face: 'smirk' }),
  pose(AT_EASE, { y: 1, lean: 1, head: -6, look: 12, wind: 0.55, lift: 0.25, sway: 0.4, phase: 0.6, face: 'smirk' }),
  pose(AT_EASE, { y: 1, lean: 1, head: -6, look: 12, wind: 0.5, lift: 0.2, sway: 0.35, phase: 0.8, face: 'smirk' }),
];

export const STATE_CLIPS = { guard, hurt, kneel, ko, victory };
