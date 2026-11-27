/**
 * The Sage's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back, head snapped back, eyes squeezed shut, the beard and the
 *               robe flicked forward, the staff swaying away in his loosened grip
 *   kneel    4  (loop) low health: down on his right knee, leaning on the staff planted upright
 *               beside it, his left hand pressed to his chest; heaving, a bead of sweat
 *   ko       6  (hold) a stagger, his knees giving way, and a crumple onto his back, turned so he
 *               lies across the screen in every view and rolled a little onto his left side with
 *               his head turned toward the viewer, so his face shows side on, the staff falling
 *               beside him and the beard spilling over his chest
 *   victory  8  (hold) the staff twirled once and raised high on his right, his hand up at his
 *               brow and the staff off the floor, the orb blazing with teal rays and motes, chin up,
 *               his left hand on his hip and a warm smile
 *
 * The effects these clips paint for themselves (the sweat, the dust of his fall) are `fx.extra`
 * painters defined beside them. The flinch ends most of the way back into the battle stance
 * (`settle`), and the victory starts from it (`fromReady`).
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { type ChibiPose, type FxContext, lerp3, pose, wave } from '../rig.js';
import { fromReady, plant, READY, settle } from './moves-core.js';
import { TWIRL, twirled } from './moves-skills.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back, head snapped back, the staff swaying away in his hands.
  pose(S, { x: -4, y: 4, lean: -16, twist: 6, tilt: -8, head: -14, look: -8, footF: [10, 0, 5.6], footB: [-9, -2, 5], handF: [1, 14, 8], weapon: 40, roll: -16, yaw: -52, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -5, y: 5, lean: -8, twist: 10, tilt: -4, head: -6, look: -6, footF: [9, 0, 5.4], footB: [-10, 0, 5], handF: [2, 14, 8], weapon: 44, roll: -14, yaw: -48, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 4, lean: 4, twist: 12, head: 3, handF: [3, 15, 7], weapon: 46, roll: -12, yaw: -46 }), 0.7, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on his right knee, the left knee up, leaning on the staff planted upright ahead of his right
 * knee: his right hand on it, his left pressed to his chest, head bowed.
 */
const KNELT: ChibiPose = plant({
  x: 0,
  y: 12.5,
  lean: 12,
  twist: 4,
  tilt: 6,
  head: 12,
  look: 8,
  footF: [-12, 0, 6.5],
  footB: [6, 0, 7],
  kneel: 'F',
  handF: [21, 8, 11],
  handB: [6, 11, 4],
  // His hand low on the haft, so the staff's head stands well above him and side on the haft
  // stands ahead of his bowed face.
  grip: -14,
  weapon: 16,
  roll: 8,
  yaw: 0,
  face: 'grit',
  wind: 0.05,
  flare: 0.3,
});

const SWEAT: RGB = [190, 230, 252];
const SWEAT_MID: RGB = [110, 168, 222];
const SWEAT_INK: RGB = [36, 52, 86];

/** A bead of sweat, five pixels wide, its tip up: [dx, dy, colour]. */
const DROP: [number, number, RGB][] = [
  [0, 0, SWEAT_INK],
  [-1, 1, SWEAT_INK],
  [0, 1, SWEAT],
  [1, 1, SWEAT_INK],
  [-2, 2, SWEAT_INK],
  [-1, 2, SWEAT],
  [0, 2, SWEAT],
  [1, 2, SWEAT],
  [2, 2, SWEAT_INK],
  [-2, 3, SWEAT_INK],
  [-1, 3, WHITE],
  [0, 3, SWEAT],
  [1, 3, SWEAT_MID],
  [2, 3, SWEAT_INK],
  [-1, 4, SWEAT_INK],
  [0, 4, SWEAT_INK],
  [1, 4, SWEAT_INK],
];

/** A bead of sweat on his brow at the edge of his head on screen, on the side away from the staff; `k` runs it down, 0 to 1. */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? 1 : cam.view === 'front' ? 1 : -1;
    const x = Math.round(h[0] + dir * 11);
    const y = Math.round(h[1] - 6 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Heaving: the chest rises and slumps over the loop while the hand stays on the staff. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return plant(
    pose(KNELT, {
      y: 12.5 + b * 0.8,
      lean: 12 + b * 4,
      head: 12 + b * 4,
      handF: [21 - 0.8 * b, 8, 11],
      handB: [6 - 1.2 * b, 11 + b * 0.8, 4],
      phase: i / 4,
      sway: (b - 0.5) * 0.2,
      face: i === 2 ? 'hurt' : 'grit',
      fx: { rune: 0.1, extra: i === 1 || i === 2 ? sweat(i === 1 ? 0 : 1) : undefined },
    }),
  );
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * He falls on his back with his feet toward the way he faced, twisting as he goes (`turn` to -60)
 * so he lies across the screen in every view. The staff lies on the floor beside him on his right,
 * by his outflung hand, its orb dimmed.
 */
const DOWN: ChibiPose = pose(S, {
  x: -8,
  y: 21.5,
  lean: -86,
  twist: 0,
  // Rolled a little onto his left side and his head turned toward the viewer, so side on his
  // closed eye, his moustache and his beard show rather than the top of his head.
  tilt: -45,
  turn: -60,
  head: -6,
  look: 35,
  footF: [14, 0, 6.5],
  footB: [12, -1, 2],
  handF: [12, 5.5, 17],
  handB: [-2, 4, 12],
  drop: true,
  dropAt: [-8, 1.6, 22],
  grip: 0,
  weapon: 90,
  roll: 84,
  yaw: 0,
  face: 'closed',
  wind: -0.3,
  lift: -0.4,
});

/** Dust thrown up from the floor all along him as he lands flat: puffs beside his hips, his back and his head. */
const thud = ({ c, rig, proj, hash }: FxContext): void => {
  const along = [rig.pelvis.o, lerp3(rig.pelvis.o, rig.head.o, 0.5), rig.head.o];
  along.forEach((p, i) => {
    for (const side of [-1, 1]) {
      const g = proj([p[0] + (hash(i, 81 + side) - 0.5) * 8, 0, p[2] + side * 10]);
      const r = 3 + hash(i, 83 + side) * 2;
      const cy = g[1] - r * 0.7;
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
        for (let dx = -Math.ceil(r * 1.4); dx <= Math.ceil(r * 1.4); dx++) {
          const d = Math.hypot(dx / 1.4, dy) / r;
          if (d > 1) continue;
          // Puffs on the far side go under the figure, those on the near side over it.
          c.glow(g[0] + dx, cy + dy, dy > r * 0.3 ? DUST_DARK : DUST, d < 0.6 ? 0.6 : 0.35, side < 0);
        }
      }
    }
  });
};

const ko: ChibiPose[] = [
  // Stagger back, the staff tipping away.
  pose(S, { x: -4, y: 4, lean: -14, twist: 0, tilt: -6, head: -14, handF: [2, 13, 8], handB: [-3, 10, 12], weapon: 40, roll: -16, yaw: -52, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // His knees give: down on both, leaning on the staff a last moment.
  plant(pose(S, { x: -2, y: 13.5, lean: 10, twist: 0, head: 16, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [20, 8, 11], handB: [4, 16, 8], grip: -14, weapon: 16, roll: 8, yaw: 0, face: 'hurt', wind: 0, flare: 0.2 })),
  // He sways back, turning, the staff slipping from his grip.
  pose(S, { x: -2, y: 15, lean: -12, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [8, 16, 14], handB: [2, 18, 11], grip: 0, weapon: 40, roll: 30, yaw: 0, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the robe and beard flying up; the staff has hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 16], handB: [0, 6, 13], dropAt: [-6, 3, 22], roll: 70, lift: 0.6 }),
  // Down: the thud raises dust and bounces his shoes.
  pose(DOWN, { lean: -82, head: -12, footF: [14, -4, 6.5], footB: [12, -5, 2], lift: 0.2, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/** The staff raised high on his right, out beside his head, his left fist on his hip, chin up and smiling. */
const HIGH: ChibiPose = pose(S, { x: 0, y: 1.5, lean: -4, twist: 8, tilt: -4, head: -8, look: 8, footF: [6, 0, 6], footB: [-6, 0, 5.4], handF: [-1, -13, 12], handB: [0, 15, 10], grip: -4, weapon: -3, roll: 8, yaw: 0, face: 'smirk', wind: 0.3, lift: 0.25 });

const glow = (k: number, spin: number) => ({ rune: 1, rays: { k, at: 'main' as const, n: 10, len: 22, spin }, motes: { k: k * 0.8, rise: spin / 60 } });

const victory: ChibiPose[] = [
  fromReady(pose(TWIRL, { face: 'smirk' }), 0.85, { fx: { rune: 0.6 } }),
  twirled(pose(TWIRL, { face: 'smirk' }), 1),
  twirled(pose(TWIRL, { face: 'smirk' }), 2),
  pose(HIGH, { y: 2, lean: -6, head: -10, phase: 0.3, wind: 0.45, lift: 0.4, fx: glow(1.1, 0) }),
  pose(HIGH, { phase: 0.45, fx: glow(1, 8) }),
  pose(HIGH, { phase: 0.6, wind: 0.25, fx: glow(0.85, 16) }),
  pose(HIGH, { phase: 0.75, wind: 0.22, fx: glow(0.75, 24) }),
  pose(HIGH, { phase: 0.9, wind: 0.2, fx: glow(0.7, 32) }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
