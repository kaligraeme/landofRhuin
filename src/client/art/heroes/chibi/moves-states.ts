/**
 * The Dark Knight's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   guard    5  (1 wind-up) Parry: the blade whipped up across his body, flat to the foe, his left
 *               hand braced on it; a crouch, a clang, sparks as he skids back, then a held brace
 *   hurt     3  a flinch: knocked back and sideways, head snapped back, eyes squeezed shut, arms
 *               flung loose, the coat tails flicked forward
 *   kneel    4  (loop) low health: down on his right knee, left knee up, leaning on the blade
 *               planted upright beside him; heaving, panting, a bead of sweat
 *   ko       6  (hold) stagger, drop to his knees, topple back, twisting so that he lies across
 *               the screen in every view; the blade lies dropped beside him
 *   victory  8  (hold) the blade wheeled round beside his head and raised with a glint, then
 *               swung onto his shoulder: chin up, a smirk, the coat streaming
 *
 * The effects these clips paint for themselves (the parry's flash and sparks, the sweat, the
 * glint, the dust of his fall) are `fx.extra` painters defined beside them. The guard's wind-up
 * comes up from the battle stance, and the flinch ends most of the way back into it (`settle`).
 */
import { AT_EASE, GUARD_STANCE, settle } from './moves-core.js';
import type { RGB } from '../paint.js';
import { type ChibiPose, type FxContext, lerp3, pose, wave } from './rig.js';

const S = GUARD_STANCE;
const WHITE: RGB = [255, 255, 255];
const SPARK: RGB = [255, 176, 84];
const SPARK_HOT: RGB = [255, 240, 190];

// ── Guard ────────────────────────────────────────────────────────────────────────────────────

/** The blade held up across his body like a shield, the left hand braced against its flat. */
const BRACE: ChibiPose = pose(S, { x: -1, y: 11, lean: 8, twist: 0, head: 8, look: 0, footF: [13, 0, 7.5], footB: [-12, 0, 7], handF: [10, 12, 5], handB: [15, -5, 11], weapon: 90, roll: 35, yaw: -74, face: 'grit', wind: 0.3 });

/**
 * A parried blow, where it struck the flat about half way up the blade (where the clang flashes):
 * `k` 0 is the instant of the blow (a white flash inside a tight bright ring), 1 a moment later (a
 * shower of sparks thrown off the blade, falling as they fly).
 */
const parried =
  (k: number) =>
  ({ c, rig, tip, proj, hash }: FxContext): void => {
    if (!tip) return;
    const [x, y] = proj(lerp3(rig.weapon.o, tip, 0.52));
    if (k === 0) {
      for (let i = 0; i < 56; i++) {
        const th = (i / 56) * Math.PI * 2;
        c.glow(x + Math.cos(th) * 8, y + Math.sin(th) * 6, WHITE, 0.9);
        c.glow(x + Math.cos(th) * 9, y + Math.sin(th) * 7, SPARK, 0.5);
      }
      for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy * 1.6 <= 25) c.glow(x + dx, y + dy, WHITE, 0.45);
      return;
    }
    for (let i = 0; i < 11; i++) {
      const th = (i / 11) * Math.PI * 2 + hash(i, 71) * 0.5;
      const d = 9 + hash(i, 72) * 13;
      const fall = 2 + (d * d) / 60;
      const sx = Math.round(x + Math.cos(th) * d);
      const sy = Math.round(y + Math.sin(th) * d * 0.8 + fall);
      // A hot two-pixel head and a short trail back toward the blade.
      c.glow(sx, sy, WHITE, 1);
      c.glow(sx + 1, sy, SPARK_HOT, 1);
      for (let t = 1; t <= 3; t++) c.glow(sx - Math.cos(th) * t, sy - (Math.sin(th) * 0.8 + 0.35) * t, SPARK, 0.95 - t * 0.2);
    }
  };

const guard: ChibiPose[] = [
  // Wind-up (a blink): the blade whipped up from the battle stance, still below his chin.
  pose(BRACE, { y: 7, lean: 10, handF: [9, 15, 6], handB: [10, 10, 10], weapon: 74, roll: 22, yaw: -60, fx: { rune: 0.5 } }),
  // The blow lands on the flat: a clang.
  pose(BRACE, { lean: 5, wind: 0.6, lift: 0.15, phase: 0.2, fx: { clang: 1, rune: 1, extra: parried(0) } }),
  // Driven back a step, boots skidding.
  pose(BRACE, { x: -3, y: 12, lean: 4, head: 6, wind: 0.45, phase: 0.4, fx: { dust: 0.8, rune: 0.6, extra: parried(1) } }),
  // Holding firm.
  pose(BRACE, { x: -3, y: 11.5, lean: 7, phase: 0.6, wind: 0.35, face: 'stern', fx: { rune: 0.4 } }),
  pose(BRACE, { x: -3, y: 11, lean: 7, phase: 0.8, wind: 0.3, face: 'stern', fx: { rune: 0.4 } }),
];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, head snapped back, the arms flung loose, the coat tails
  // whipped forward past his legs.
  pose(S, { x: -4, y: 5, lean: -18, twist: -14, tilt: -10, head: -16, look: -10, footF: [12, 0, 6], footB: [-10, -2, 5.5], handF: [8, 16, 13], handB: [-4, 8, 14], weapon: 118, roll: 20, yaw: 10, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 6, lean: -10, twist: -10, tilt: -6, head: -8, look: -6, footF: [11, 0, 6], footB: [-11, 0, 5.5], handF: [7, 15, 11], handB: [-1, 11, 13], weapon: 104, roll: 22, yaw: 4, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 6, lean: 8, twist: -12, tilt: 0, head: 4, handF: [8, 12, 9], weapon: 60 }), 0.7, { grip: -6, face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on his right knee, the left knee up and out, leaning on the blade planted upright beside
 * his right knee: his right hand on the hilt, his left on the raised knee, head hung.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 14,
  twist: 6,
  tilt: 8,
  head: 14,
  look: 10,
  footF: [-12, 0, 7],
  footB: [6, 0, 13],
  kneel: 'F',
  handF: [-0.2, -6.9, 17.5],
  handB: [2.8, 19.7, 10.6],
  drop: true,
  dropAt: [4, 40, 18],
  weapon: 180,
  roll: 0,
  yaw: 70,
  face: 'grit',
  wind: 0.05,
  flare: 0.4,
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
 * A bead of sweat on his temple, painted at the edge of the head on screen: on the face's side
 * side on, and on the side away from the planted blade toward or away from the viewer. `k` runs it
 * down his temple, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 11);
    const y = Math.round(h[1] - 7 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Heaving: the chest rises and slumps over the loop while the hands stay on the hilt and the knee. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, {
    y: 13 + b,
    lean: 14 + b * 5,
    head: 12 + b * 5,
    // The neck moves about 2 forward and 1.6 down as he slumps: the hands stay put, the right
    // one wrapped round the grip just in front of it.
    handF: [-0.2 - 2 * b, -6.9 - 1.6 * b, 17.5],
    handB: [2.8 - 2 * b, 19.7 - 1.6 * b, 10.6],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    // Slumped, he pants through gritted teeth, a bead of sweat running down.
    face: i === 2 ? 'hurt' : 'grit',
    fx: i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : undefined,
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * He falls on his back with his feet toward the way he faced, and twists as he goes (`turn` to
 * -60): lying straight back he would point at the viewer in the front and back views (a head on a
 * short lump), turned he lies across the screen in all three. The blade lies flat in front of him
 * (on his right, the side nearer the viewer side on and front on), by his outflung hand.
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
  dropAt: [-18, 1.5, 26],
  weapon: 90,
  roll: 80,
  yaw: 0,
  face: 'closed',
  wind: 0,
  lift: -0.4,
});

const DUST: RGB = [196, 182, 160];
const DUST_DARK: RGB = [128, 116, 100];

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
  // Stagger back.
  pose(S, { x: -4, y: 5, lean: -14, twist: -10, tilt: -6, head: -16, handF: [4, 14, 8], handB: [-3, 10, 13], weapon: 100, roll: 24, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // His knees give: down on both, the blade's point striking the floor.
  pose(S, { x: -2, y: 14, lean: 8, twist: 0, head: 18, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [8, 16, 9], weapon: 150, roll: 20, face: 'hurt', wind: 0, flare: 0.2 }),
  // He sways back, turning, the blade hanging from his loosening grip.
  pose(S, { x: -2, y: 15, lean: -10, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [6, 18, 14], handB: [2, 18, 11], weapon: 160, roll: -10, yaw: 0, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the coat flying up; the blade has hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 16], handB: [0, 6, 13], dropAt: [-16, 3, 26], weapon: 84, lift: 0.6 }),
  // Down: the thud raises dust and bounces his boots.
  pose(DOWN, { lean: -82, head: -12, footF: [15, -4, 7], footB: [13, -5, 2], lift: 0.2, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * A glint of light at the blade's tip: a white four-pointed star with a warm halo, `k` its size
 * (1 = rays 7 pixels long).
 */
const glint =
  (k: number) =>
  ({ c, tip, proj }: FxContext): void => {
    if (!tip) return;
    const [x, y] = proj(tip);
    const r = Math.round(7 * k);
    for (let i = -r; i <= r; i++) {
      const a = 1 - Math.abs(i) / (r + 1);
      c.glow(x + i, y, WHITE, a);
      c.glow(x, y + i, WHITE, a);
    }
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, [255, 236, 200], Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(x + i * 2, y + j * 2, WHITE, 0.6);
  };

/**
 * The flourish: his sword arm raised out beside his head, the blade wheeling round in his hand in a
 * plane tipped a little in over him, so front on the swoosh stays beside his face and away from
 * the viewer it shows as an arc rather than edge on.
 */
const TWIRL: ChibiPose = pose(S, { y: 3, lean: -3, twist: 14, tilt: -4, head: -4, look: 6, footF: [8, 0, 6.5], footB: [-8, 0, 6], handF: [-8, -10, 17], handB: [1, 14, 11], roll: -20, yaw: 0, face: 'smirk', wind: 0.5, flare: 0.2 });

/**
 * The last pose, held: the blade on his shoulder, chin up, a smirk for the viewer, the coat
 * streaming out on his left, away from the blade, so it shows beside him toward and away from the viewer.
 */
const PROUD: ChibiPose = pose(AT_EASE, { y: 1.5, lean: -3, twist: 10, tilt: 3, head: -6, look: 12, footF: [7, 0, 7], footB: [-6, 0, 6], handF: [4, 5, 8], weapon: -46, face: 'smirk', wind: 0.6, lift: 0.45, sway: -0.7 });

const victory: ChibiPose[] = [
  // A breath first: the blade trailing low behind him.
  pose(S, { y: 6, lean: 8, twist: -12, head: 2, look: 4, handF: [2, 15, 11], handB: [1, 14, 11], weapon: 250, roll: 0, yaw: 0, face: 'smirk', wind: 0.25 }),
  // The blade wheels up behind him, over the top...
  // (standing nearly upright over his head here: tipped forward it would cross his face side on)...
  pose(TWIRL, { weapon: 372, phase: 0.1, fx: { smear: { from: 250, roll: 0, width: 0.5 }, rune: 0.8 } }),
  // ...and round again, ending tipped out to his left so from behind it shows its length.
  pose(TWIRL, { weapon: 650, yaw: -30, phase: 0.25, wind: 0.6, fx: { smear: { from: 372, width: 0.5 }, rune: 1 } }),
  // Raised high and out beside him with a glint at the tip, the coat thrown wide. (No swoosh on
  // these two: a short arc at the tip reads as a pennant, not a swing.)
  pose(TWIRL, { y: 2, lean: -5, head: -8, handF: [-6, -4, 18], weapon: 720, roll: 30, wind: 0.6, lift: 0.5, flare: 0.3, phase: 0.4, fx: { rune: 1, extra: glint(1) } }),
  // Swung down onto his shoulder.
  pose(PROUD, { y: 2, handF: [5, 4, 8], weapon: -40, wind: 0.7, lift: 0.45, phase: 0.55, face: 'stern', look: 6, fx: { rune: 0.5 } }),
  // Settled: chin up, a smirk, the coat still streaming.
  pose(PROUD, { phase: 0.7, wind: 0.65 }),
  pose(PROUD, { phase: 0.85, wind: 0.6 }),
  pose(PROUD, { phase: 1 }),
];

export const STATE_CLIPS = { guard, hurt, kneel, ko, victory };
