/**
 * The Arbalest's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back, head snapped back, eyes squeezed shut, the crossbow's
 *               nose flung up and his left hand off it, the coat flicked forward
 *   kneel    4  (loop) low health: down on his right knee, the crossbow laid across his raised
 *               left thigh under both hands, head hung, panting, a bead of sweat
 *   ko       6  (hold) he staggers, falls back onto the floor and lies on his back; the crossbow
 *               flies from his hands and skids away along the floor
 *   victory  8  (hold) the crossbow swung up and propped on his right shoulder, his left hand
 *               pulling the goggles down over his eyes, a grin
 *
 * The flinch ends most of the way back into the battle stance (moves-core.ts `settle`); the
 * others start from it.
 */
import { skid, sweat, thud } from './effects.js';
import { AT_EASE, fromStance, settle, STANCE } from './moves-core.js';
import { type ChibiPose, pose, wave } from '../rig.js';

const S = STANCE;

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back, head snapped back, the crossbow's nose flung up, the left hand off it.
  pose(S, { x: -4, y: 4, lean: -16, twist: 8, tilt: -8, head: -14, look: -8, footF: [12, 0, 6], footB: [-10, -2, 5.5], handF: [6, 5, 6], handB: [-3, 9, 13], weapon: 58, roll: 10, yaw: -12, face: 'hurt', wink: undefined, wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 5, lean: -8, twist: 12, tilt: -4, head: -6, look: -4, footF: [11, 0, 6], footB: [-12, 0, 5.5], handF: [7, 4, 5], handB: [0, 10, 12], weapon: 72, roll: 6, yaw: -10, face: 'hurt', wink: undefined, wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance.
  settle(pose(S, { x: -3, y: 5, lean: 2, head: 2, handF: [8, 4, 4.5], weapon: 90 }), 0.7, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on his right knee, the left knee up and out; the crossbow laid across his left thigh, his
 * right hand on its grip by his hip and his left on the fore-stock over the knee; head hung.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 16,
  twist: -10,
  tilt: 4,
  head: 14,
  look: 6,
  footF: [-12, 0, 6],
  footB: [7, 0, 7],
  kneel: 'F',
  handF: [4, 17, 7],
  weapon: 100,
  roll: 0,
  yaw: -58,
  grip2: 11,
  face: 'grit',
  wind: 0.05,
};

/** Heaving: the chest rises and slumps over the loop, the crossbow resting where it lies. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, {
    y: 13 + b,
    lean: 16 + b * 5,
    head: 12 + b * 5,
    handF: [4 - b * 1.5, 17 - b * 0.6, 7],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    face: i === 2 ? 'hurt' : 'grit',
    fx: i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : undefined,
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * On his back with his feet toward the way he faced, twisted (`turn` -60) so he lies across the
 * screen in every view; the crossbow lies dropped well clear of his boots on his right, where it
 * skidded, turned across his line so its stock and prod show as a T, never as more of his legs.
 */
const DOWN: ChibiPose = pose(S, {
  x: -8,
  y: 22,
  lean: -86,
  twist: 0,
  tilt: 0,
  turn: -60,
  head: -16,
  look: 24,
  footF: [15, 0, 7],
  footB: [13, -1, 2],
  handF: [12, 5.5, 18],
  handB: [-4, 2, 12],
  drop: true,
  dropAt: [54, 2.5, 18],
  weapon: 90,
  roll: 0,
  yaw: 40,
  draw: 0,
  nock: false,
  face: 'closed',
  wink: undefined,
  wind: 0,
  lift: -0.4,
});

const ko: ChibiPose[] = [
  // Staggered: the crossbow's nose flung up, the left hand off it.
  pose(S, { x: -4, y: 5, lean: -14, twist: 6, tilt: -6, head: -16, footF: [12, 0, 6], footB: [-10, -2, 5.5], handF: [5, 6, 5], handB: [-3, 10, 13], weapon: 50, roll: 10, yaw: -10, face: 'hurt', wink: undefined, sway: -0.4, lift: 0.3 }),
  // His legs go: falling back, the crossbow flying out of his hands.
  pose(S, { x: -6, y: 12, lean: -30, twist: 0, turn: -20, head: -12, footF: [12, -2, 6], footB: [2, -1, 5], handF: [8, 2, 10], handB: [2, 4, 12], drop: true, dropAt: [12, 22, 12], weapon: 40, roll: 50, yaw: 10, draw: 0, nock: false, face: 'hurt', wink: undefined, wind: 0, lift: 0.5, flare: 0.2 }),
  // Hitting the floor; the crossbow lands ahead of him.
  pose(DOWN, { x: -6, y: 18, lean: -55, turn: -45, head: -8, look: 10, footF: [10, -5, 6], footB: [6, -3, 4], handF: [8, 3, 16], handB: [0, 5, 13], dropAt: [26, 7, 12], weapon: 95, roll: 20, yaw: 25, lift: 0.6, fx: { dust: 0.6 } }),
  // Flat on his back: the thud raises dust and bounces his boots; the crossbow skids on.
  pose(DOWN, { lean: -82, head: -12, footF: [15, -4, 7], footB: [13, -5, 2], dropAt: [42, 3, 16], yaw: 34, lift: 0.2, fx: { dust: 0.9, extra: (x) => (thud(x), skid(0.9)(x)) } }),
  pose(DOWN, { fx: { extra: skid(0.4) } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * The last pose, held: the crossbow propped on his right shoulder, rolled so its prod stands up
 * behind his head as a T rather than wrapping round it side on; goggles down (the pose's `hood`
 * moves them: see gear.ts `goggles`), a toothy grin, weight on one hip.
 */
const PROUD: ChibiPose = pose(AT_EASE, {
  y: 1.5,
  lean: -3,
  twist: 12,
  tilt: 4,
  head: -2,
  look: 12,
  footF: [6, 0, 6.5],
  footB: [-6, 0, 6],
  handF: [3, 4, 8.5],
  handB: [2, 14, 11],
  weapon: -28,
  roll: 60,
  yaw: -24,
  face: 'smirk',
  hood: 'down',
  wind: 0.25,
  lift: 0.1,
});

const victory: ChibiPose[] = [
  // The crossbow swung down out of his aim...
  fromStance(pose(S, { y: 5, lean: 8, twist: 8, head: 4, look: 4, handF: [5, 12, 7], weapon: 150, roll: 0, yaw: -10, face: 'stern', wink: undefined }), 0.6),
  // ...back past his hip and up behind him in one swing onto his shoulder (behind his head side
  // on, never across his face), his left hand coming up to his brow.
  pose(PROUD, { y: 3, lean: 4, handF: [-2, 13, 10], handB: [8, -8, 3], weapon: 215, roll: 0, yaw: -10, face: 'stern', hood: 'up', wind: 0.45, lift: 0.3, phase: 0.15 }),
  pose(PROUD, { y: 2, handF: [1, 3, 9.5], handB: [8, -11, 3], weapon: -50, roll: 40, face: 'stern', hood: 'up', wind: 0.4, lift: 0.3, phase: 0.3 }),
  // The goggles pulled down over his eyes.
  pose(PROUD, { y: 1.5, head: -2, handB: [8, -6, 3], face: 'grit', wind: 0.35, lift: 0.2, phase: 0.45 }),
  // A grin, chin up, the hand dropping to his hip.
  pose(PROUD, { handB: [4, 6, 8], phase: 0.6, wind: 0.3 }),
  pose(PROUD, { phase: 0.72 }),
  pose(PROUD, { phase: 0.86, wind: 0.22 }),
  pose(PROUD, { phase: 1 }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
