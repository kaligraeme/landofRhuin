/**
 * The Dragoon's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back and sideways, head jolted back, eyes squeezed shut, the
 *               lead hand torn off the haft and the point knocked down, the scarf tails flicked
 *               forward
 *   kneel    4  (loop) low health: down on his right knee, the left knee up, leaning on the
 *               halberd planted upright beside him, his right hand on the haft at his shoulder;
 *               heaving, head down but his face to the viewer, a bead of sweat
 *   ko       6  (hold) a stagger, onto his knees, toppling back, twisting so that he lies across
 *               the screen in every view, the halberd clattering down beside him
 *   victory  8  (hold) the halberd twirled round beside him in a wheel of wind and swept down,
 *               then planted upright beside him: weight on one leg, hip cocked and a fist on it,
 *               head tilted with a grin, the scarf streaming
 *
 * The effects these clips paint for themselves (the sweat, the clatter, the glint) are `fx.extra`
 * painters defined beside them. The flinch ends most of the way back into the battle stance.
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { type ChibiPose, type FxContext, lerp3, pose, wave } from '../rig.js';
import { fromReady, READY, settle } from './moves-core.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, the head jolted back (only a little further than the
  // body, so his hair and ponytail keep their shape), the lead hand torn off the haft and flung
  // out, the point knocked down, the scarf tails whipped forward past him.
  pose(S, { x: -4, y: 6, lean: -16, twist: 8, tilt: -8, head: 0, look: -8, footF: [-13, 0, 5], footB: [9, -2, 5.4], handF: [-6, 15, 9], handB: [-2, 8, 14], weapon: 106, roll: -6, yaw: -34, grip: -8, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 7, lean: -8, twist: 12, tilt: -5, head: -4, look: -8, footF: [-14, 0, 5], footB: [8, 0, 5.4], handF: [-5, 16, 8], handB: [2, 11, 12], weapon: 100, roll: -4, yaw: -40, grip: -8, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 7, lean: 6, twist: 16, head: 4, handF: [-4, 16, 7], weapon: 50, yaw: -42 }), 0.7, { face: 'grit', wind: 0.45, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on his right knee, the left foot planted forward and out with its knee up, leaning on the
 * halberd planted upright beside his right knee: his right hand on the haft at his shoulder, out
 * beside him so his arm never crosses his face, his left on the raised knee, head down but his
 * face still turned to the viewer. The skirt hangs straight (no flare), draping over the thigh.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 12.5,
  lean: 10,
  twist: 6,
  tilt: 4,
  head: 4,
  look: 2,
  footF: [-12, 0, 6],
  footB: [9, 0, 11],
  kneel: 'F',
  handF: [-2, 3, 15],
  handB: [3, 19, 9],
  weapon: -4,
  roll: -6,
  yaw: 0,
  grip: 4,
  face: 'grit',
  wind: 0.08,
  flare: 0,
};

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
  [-2, 4, SWEAT_INK],
  [-1, 4, SWEAT],
  [0, 4, SWEAT_MID],
  [1, 4, SWEAT_MID],
  [2, 4, SWEAT_INK],
  [-1, 5, SWEAT_INK],
  [0, 5, SWEAT_INK],
  [1, 5, SWEAT_INK],
];

/**
 * A bead of sweat on his temple, at the edge of the head on screen: on the face's side side on,
 * and on the side away from the planted halberd toward or away from the viewer. `k` runs it down
 * his temple, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'front' ? 1 : cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 11);
    const y = Math.round(h[1] - 7 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Heaving: the chest rises and slumps over the loop while the hands stay on the haft and the knee. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, {
    y: 12.5 + b,
    lean: 10 + b * 4,
    head: 3 + b * 4,
    // The neck moves about 1.6 forward and 1.4 down as he slumps: the hands stay put.
    handF: [-2 - 1.6 * b, 3 - 1.4 * b, 15],
    handB: [3 - 1.6 * b, 19 - 1.4 * b, 9],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    face: i === 2 ? 'hurt' : 'grit',
    fx: i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : undefined,
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * He falls on his back with his feet toward the way he faced, twisting as he goes (`turn` to
 * -60), so he lies across the screen in all three views. The halberd lies flat beside him, on his
 * right, by his outflung hand.
 */
const DOWN: ChibiPose = pose(S, {
  x: -8,
  y: 23,
  lean: -86,
  twist: 0,
  tilt: 0,
  turn: -60,
  head: -16,
  look: 24,
  footF: [16, 0, 7],
  footB: [14, -1, 2],
  handF: [12, 5.5, 18],
  handB: [-4, 2, 12],
  drop: true,
  dropAt: [-6, 1.5, 26],
  weapon: 90,
  roll: 86,
  yaw: -6,
  face: 'closed',
  wind: 0,
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

/** The halberd hitting the floor: a few sparks and a puff of dust along the haft where it lands. */
const clatter = ({ c, rig, proj, hash }: FxContext): void => {
  const w = rig.weapon;
  for (let i = 0; i < 4; i++) {
    const p = proj([w.o[0] + w.u[0] * (i * 22 - 20), 0, w.o[2] + w.u[2] * (i * 22 - 20)]);
    for (let j = 0; j < 3; j++) c.glow(p[0] + (hash(i, 91 + j) - 0.5) * 8, p[1] - 1 - hash(i, 94 + j) * 4, j === 0 ? [255, 236, 190] : DUST, 0.9);
  }
};

const ko: ChibiPose[] = [
  // Stagger back, the haft slipping in his grip.
  pose(S, { x: -4, y: 6, lean: -13, twist: 6, tilt: -6, head: -2, footF: [-13, 0, 5], footB: [9, -1, 5.4], handF: [-4, 14, 8], handB: [-3, 9.5, 13.5], weapon: 104, roll: -10, yaw: -34, grip: -8, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // His knees give: down on both, the halberd's butt striking the floor as it tips.
  pose(S, { x: -2, y: 15, lean: 8, twist: 0, head: 18, footF: [-9, -1, 5], footB: [-10, -1, 4.6], kneel: 'F', handF: [6, 16, 8], weapon: 28, roll: -16, yaw: -20, grip: 4, face: 'hurt', wind: 0, flare: 0.2 }),
  // He sways back, turning, the halberd falling away from his loosening grip.
  pose(S, { x: -2, y: 16, lean: -10, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-7, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [6, 18, 14], handB: [2, 18, 11], weapon: 60, roll: 40, yaw: -10, grip: 4, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the scarf flying up; the halberd hits the floor beside him.
  pose(DOWN, { x: -5, y: 18, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 16], handB: [0, 6, 13], dropAt: [-4, 2.5, 26], weapon: 86, lift: 0.6, fx: { extra: clatter } }),
  // Down: the thud raises dust and bounces his boots.
  pose(DOWN, { lean: -82, head: -12, footF: [16, -4, 7], footB: [14, -5, 2], lift: 0.25, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * A glint of light at the point: a white four-pointed star with a pale jade halo, `k` its size
 * (1 = rays 7 pixels long).
 */
const glint =
  (k: number) =>
  ({ c, tip, proj }: FxContext): void => {
    const [x, y] = proj(tip);
    const r = Math.round(7 * k);
    for (let i = -r; i <= r; i++) {
      const a = 1 - Math.abs(i) / (r + 1);
      c.glow(x + i, y, WHITE, a);
      c.glow(x, y + i, WHITE, a);
    }
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, [210, 255, 240], Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(x + i * 2, y + j * 2, WHITE, 0.6);
  };

/** The twirl: his right hand out beside him at shoulder height, the halberd wheeling round in it in a plane he faces side on. */
const TWIRL: ChibiPose = pose(S, { x: 0, y: 4, lean: -2, twist: 10, tilt: -3, head: -4, look: 6, footF: [-8, 0, 6.5], footB: [8, 0, 6], handF: [4, 6, 16], handB: [1, 14, 11], weapon: 0, roll: 10, yaw: 0, grip: 12, face: 'smirk', wind: 0.5, flare: 0.3 });

/**
 * The last pose, held: the halberd planted upright beside him, his right hand high on it, and a
 * cocky contrapposto: his weight on his right leg, the left knee bent and its heel lifted, the hip
 * cocked and his left fist on it, the head tilted with a grin for the viewer. A light breeze
 * streams the scarf and ponytail out on his left, away from the halberd, while the heavier skirt
 * stays round his hips.
 */
const PROUD: ChibiPose = pose(S, { x: 1.5, y: 1.5, lean: -3, twist: 10, tilt: 7, head: -4, look: 4, footF: [-1, 0, 4.5], footB: [5, -1.2, 8.5], handF: [-9, 0, 14], handB: [2, 16, 10.5], weapon: 0, roll: -4, yaw: 0, grip: 6, face: 'smirk', wind: 0.55, lift: 0.3, sway: -0.5 });

const victory: ChibiPose[] = [
  // A breath first: the halberd lifted out of the stance, upright in his right hand.
  fromReady(pose(TWIRL, { y: 6, lean: 6, twist: 6, head: 1, handF: [5, 10, 13.8], weapon: 20, roll: 16, yaw: 20, face: 'smirk', wind: 0.4 }), 0.8),
  // It wheels round beside him, once...
  pose(TWIRL, { weapon: 170, grip: 22, handF: [4, 1, 16], phase: 0.1, fx: { smear: { from: 20, roll: 10, width: 0.6 }, rune: 0.8 } }),
  pose(TWIRL, { weapon: 325, phase: 0.2, wind: 0.6, fx: { smear: { from: 170, roll: 10, width: 0.6 }, rune: 1 } }),
  // ...and is swept down and planted beside him with a glint at the point.
  pose(PROUD, { y: 3, lean: 2, head: -2, handF: [-8, 2, 14], wind: 0.7, lift: 0.55, phase: 0.35, face: 'shout', fx: { rune: 1, dust: 0.6, extra: glint(1) } }),
  pose(PROUD, { y: 2, phase: 0.5, wind: 0.65, lift: 0.4, fx: { rune: 0.5, extra: glint(0.5) } }),
  // Settled: chin up, a grin, the scarf still streaming.
  pose(PROUD, { phase: 0.65, wind: 0.6 }),
  pose(PROUD, { phase: 0.82, wind: 0.57 }),
  pose(PROUD, { phase: 0.95 }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
