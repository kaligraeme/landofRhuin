/**
 * The Spellblade's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back and sideways, head snapped back, eyes squeezed shut, arms
 *               flung loose, the coat and cape flicked forward
 *   kneel    4  (loop) low health: down on her right knee, the sword planted point down beside it
 *               with her hand on the hilt, the wand hand pressed to her chest; heaving, a bead of
 *               sweat, the hair hanging forward
 *   ko       6  (hold) a stagger, her knees give, and she crumples onto her side, the hair spilling
 *               out over the floor; the sword and the wand let fall beside her
 *   victory  8  (hold) a twirl on the spot with the hair and coat flaring, the sword raised high
 *               with a glint, then held up before her in a salute, a smile for the viewer
 *
 * The effects these clips paint for themselves (the sweat, the glint, the dust of her fall) are
 * `fx.extra` painters defined beside them. The flinch ends most of the way back into the battle
 * stance (`settle`), and the victory starts from it (`fromReady`).
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { AT_EASE, fromReady, READY, settle } from './moves-core.js';
import { SPELLBLADE } from './design.js';
import { add3, type ChibiPose, type FxContext, lerp3, pose, solveRig, type V3, wave } from '../rig.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, head snapped back, arms flung loose, the cloth whipped forward.
  pose(S, { x: -4, y: 5, lean: -16, twist: -12, tilt: -10, head: -14, look: -10, footF: [11, 0, 5], footB: [-9, -2, 4.4], handF: [6, 15, 10], weapon: 120, roll: 10, yaw: 20, handB: [-4, 8, 12], weaponB: 210, rollB: 20, yawB: 0, face: 'hurt', wind: -0.7, lift: 0.35, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 6, lean: -9, twist: -8, tilt: -6, head: -7, look: -6, footF: [10, 0, 5], footB: [-10, 0, 4.4], handF: [7, 13, 10], weapon: 90, roll: 20, yaw: 0, handB: [0, 10, 11], weaponB: 160, rollB: 10, yawB: 20, face: 'hurt', wind: -0.3, lift: 0.25, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 6, lean: 6, twist: -10, head: 3, handF: [8, 11, 9], weapon: 60 }), 0.7, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/** Where the planted sword's grip is (hero space) and the hand's place on it, along the sword from the guard. */
const PLANTED: V3 = [3, 30, 14];
const HILT_AT = -3;

/** Down on her right knee, the left knee up, the sword planted point down by her right knee, the wand hand on her chest. */
const KNELT_BASE: ChibiPose = {
  x: 0,
  y: 12.5,
  lean: 12,
  twist: 8,
  tilt: 6,
  head: 14,
  look: 10,
  footF: [-11, 0, 5.6],
  footB: [6, 0, 7],
  kneel: 'F',
  handF: [0, 0, 13],
  handB: [3, 7, 1],
  weaponB: 40,
  rollB: 40,
  yawB: 0,
  drop: true,
  dropAt: PLANTED,
  weapon: 180,
  roll: 0,
  yaw: 70,
  face: 'grit',
  wind: 0.05,
  flare: 0.3,
};

/** The right hand on the planted sword's grip, wherever the pose's neck is. */
function onHilt(p: ChibiPose): ChibiPose {
  const rig = solveRig(SPELLBLADE.build, p, SPELLBLADE.weapon.grip2);
  const h = add3(rig.weapon.o, rig.weapon.u, HILT_AT);
  return { ...p, handF: [h[0] - rig.neck[0], rig.neck[1] - h[1], h[2]] };
}

const SWEAT: RGB = [196, 232, 252];
const SWEAT_MID: RGB = [120, 172, 224];
const SWEAT_INK: RGB = [40, 52, 88];

/** A bead of sweat, five pixels wide, its tip up: [dx, dy, colour]. */
const DROP: [number, number, RGB][] = [
  [0, 0, SWEAT_INK],
  [-1, 1, SWEAT_INK],
  [0, 1, SWEAT],
  [1, 1, SWEAT_INK],
  [-2, 2, SWEAT_INK],
  [-1, 2, WHITE],
  [0, 2, SWEAT],
  [1, 2, SWEAT_MID],
  [2, 2, SWEAT_INK],
  [-2, 3, SWEAT_INK],
  [-1, 3, SWEAT],
  [0, 3, SWEAT_MID],
  [1, 3, SWEAT_MID],
  [2, 3, SWEAT_INK],
  [-1, 4, SWEAT_INK],
  [0, 4, SWEAT_INK],
  [1, 4, SWEAT_INK],
];

/**
 * A bead of sweat at her temple, painted at the edge of the head on screen: on the face's side side
 * on, on the side away from the planted sword toward or away from the viewer. `k` runs it down, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 10);
    const y = Math.round(h[1] - 2 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Heaving: the chest rises and slumps over the loop while the hands stay on the hilt and her chest. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return onHilt(
    pose(KNELT_BASE, {
      y: 12.5 + b,
      lean: 12 + b * 5,
      head: 12 + b * 5,
      handB: [3 - b, 7 - b * 0.5, 1],
      phase: i / 4,
      sway: (b - 0.5) * 0.2,
      face: i === 2 ? 'hurt' : 'grit',
      fx: { runeB: 0.1, ...(i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : {}) },
    }),
  );
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * Lying crumpled on her right side, knees drawn up together, her head turned to the floor and the
 * hair spilling out from it; turned (`turn` -60) so that she lies across the screen in every view.
 * The sword lies dropped in front of her, the wand by her outflung left hand.
 */
const DOWN: ChibiPose = {
  x: -6,
  y: 21,
  lean: -84,
  twist: -40,
  tilt: 10,
  turn: -60,
  head: -10,
  look: 30,
  footF: [12, -2, 4],
  footB: [11, -3, -1],
  handF: [12, 6, 16],
  handB: [4, -2, 12],
  drop: true,
  dropAt: [-14, 1.5, 24],
  weapon: 90,
  roll: 80,
  yaw: 0,
  dropB: true,
  dropAtB: [-2, 1.5, -16],
  weaponB: 100,
  rollB: -80,
  yawB: 0,
  face: 'closed',
  wind: 0,
  lift: -0.4,
  flare: 0.5,
};

/** Dust thrown up from the floor along her as she lands: puffs beside her hips and her shoulders. */
const thud = ({ c, rig, proj, hash }: FxContext): void => {
  const along = [rig.pelvis.o, lerp3(rig.pelvis.o, rig.head.o, 0.6)];
  along.forEach((p, i) => {
    for (const side of [-1, 1]) {
      const g = proj([p[0] + (hash(i, 81 + side) - 0.5) * 8, 0, p[2] + side * 9]);
      const r = 2.6 + hash(i, 83 + side) * 2;
      const cy = g[1] - r * 0.7;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r * 1.4); dx <= Math.ceil(r * 1.4); dx++) {
          const d = Math.hypot(dx / 1.4, dy) / r;
          if (d > 1) continue;
          c.glow(g[0] + dx, cy + dy, dy > r * 0.3 ? DUST_DARK : DUST, d < 0.6 ? 0.55 : 0.3, side < 0);
        }
      }
    }
  });
};

const ko: ChibiPose[] = [
  // A stagger back, the sword arm dropping.
  pose(S, { x: -4, y: 5, lean: -12, twist: -8, tilt: -6, head: -14, footF: [9, 0, 5], footB: [-9, 0, 4.4], handF: [5, 14, 8], weapon: 140, roll: 10, yaw: 10, handB: [-2, 9, 11], weaponB: 190, rollB: 10, yawB: 0, face: 'hurt', sway: -0.4, lift: 0.3, wind: 0.2 }),
  // Her knees give: down on both, swaying, the sword's point to the floor.
  pose(S, { x: -2, y: 12.5, lean: 8, twist: 0, head: 16, footF: [-7, -1, 4], footB: [-8, -1, 3.6], kneel: 'F', handF: [7, 15, 6], weapon: 160, roll: 0, yaw: -10, handB: [4, 15, 6], weaponB: 170, rollB: 0, yawB: 0, face: 'hurt', wind: 0, flare: 0.25 }),
  // Tipping over onto her side, letting go.
  pose(S, { x: -3, y: 14, lean: -20, twist: -20, tilt: 14, turn: -25, head: 4, look: 10, footF: [-4, -1, 4], footB: [-6, -1, 3.6], kneel: 'F', handF: [6, 16, 14], weapon: 165, roll: -10, yaw: 0, handB: [3, 14, 10], weaponB: 180, face: 'closed', wind: 0, lift: 0.4, flare: 0.4 }),
  // Falling, the hair and coat flying up; the sword and wand hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -50, twist: -24, turn: -45, head: -4, look: 18, footF: [6, -3, 4.6], footB: [5, -2, 0], handF: [8, 4, 15], handB: [3, 2, 11], dropAt: [-12, 3, 22], dropAtB: [-1, 3, -14], lift: 0.7, flare: 0.6 }),
  // Down: the thud raises dust and bounces her boots, the hair spilling out.
  pose(DOWN, { lean: -80, head: -8, footF: [12, -4, 4], footB: [11, -5, -1], lift: 0.25, flare: 0.7, fx: { dust: 0.8, extra: thud } }),
  DOWN,
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * A glint of light at the sword's point: a white four-pointed star with a violet halo, `k` its
 * size (1 = rays 7 pixels long).
 */
const glint =
  (k: number) =>
  ({ c, tip, proj, aura }: FxContext): void => {
    const [x, y] = proj(tip);
    const r = Math.round(7 * k);
    for (let i = -r; i <= r; i++) {
      const a = 1 - Math.abs(i) / (r + 1);
      c.glow(x + i, y, WHITE, a);
      c.glow(x, y + i, WHITE, a);
    }
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, aura.core, Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(x + i * 2, y + j * 2, WHITE, 0.6);
  };

/** The twirl: arms out, sword and wand held level, the hair and coat flaring and lagging behind the turn. */
const twirl = (turn: number, phase: number): ChibiPose =>
  pose(S, { x: 0, y: 3, lean: 4, twist: 0, turn, head: -2, look: -10, footF: [3, -2, 4], footB: [-3, 0, 4], handF: [5, 6, 14], weapon: 90, roll: 0, yaw: 70, handB: [4, 6, 14], weaponB: 90, rollB: 0, yawB: 70, face: 'smirk', wind: 0.4, flare: 0.9, sway: -0.6, lift: 0.25, phase, fx: { rune: 0.6, runeB: 0.6 } });

/** Raised high out to her right with a glint at the point, the wand hand on her hip. */
const RAISED: ChibiPose = pose(AT_EASE, { y: 1.5, lean: -4, twist: 10, tilt: 3, head: -8, look: 10, footF: [6, 0, 5.6], footB: [-5, 0, 5], handF: [-5, -8, 15], weapon: -4, roll: 24, yaw: 0, handB: [0, 15, 10], weaponB: 150, rollB: 10, yawB: 20, face: 'smirk', wind: 0.4, lift: 0.2, sway: 0.3 });

/**
 * The last pose, held: the sword swept down and out to her right in a flourish, the wand hand on
 * her hip, head tipped, a smile for the viewer. Out and down, the sword shows its length in every
 * view and stays clear of her face.
 */
const SALUTE: ChibiPose = pose(AT_EASE, { y: 1.5, lean: -2, twist: 4, tilt: 4, head: -3, look: 14, footF: [5, 0, 5], footB: [-5, 0, 4.4], handF: [5, 12, 12], weapon: 124, roll: -32, yaw: 4, handB: [0, 15, 10], weaponB: 150, rollB: 10, yawB: 20, face: 'smirk', wind: 0.3, lift: 0.2, sway: 0.3 });

const victory: ChibiPose[] = [
  // A breath first, dipping into the twirl.
  fromReady(pose(S, { y: 6, lean: 6, twist: -10, head: 2, look: 4, handF: [6, 9, 12], weapon: 90, roll: 0, yaw: 40, handB: [5, 8, 12], weaponB: 90, rollB: 0, yawB: 40, face: 'smirk', wind: 0.25 }), 0.6),
  // A full twirl, the hair and coat swinging out and lagging behind her.
  twirl(120, 0.1),
  twirl(240, 0.25),
  // Round to face front again, the sword thrown up high: a glint.
  pose(RAISED, { turn: 360, phase: 0.4, flare: 0.35, sway: -0.4, wind: 0.45, lift: 0.25, fx: { rune: 1, extra: glint(1) } }),
  pose(RAISED, { turn: 360, phase: 0.55, flare: 0.2, sway: -0.2, fx: { rune: 0.7, extra: glint(0.6) } }),
  // Brought down into a salute, smiling; the hair settling.
  pose(SALUTE, { turn: 360, phase: 0.7, wind: 0.35, lift: 0.2, fx: { rune: 0.5, smear: { from: 40, roll: 0, width: 0.4, alpha: 0.5 } } }),
  pose(SALUTE, { turn: 360, phase: 0.85, wind: 0.32, lift: 0.15, fx: { rune: 0.4 } }),
  pose(SALUTE, { turn: 360, phase: 1, fx: { rune: 0.35 } }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
