/**
 * The Flame Warden's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back and sideways, head snapped back, eyes squeezed shut, the
 *               coat tails flicked forward, then most of the way back into the battle stance
 *   kneel    4  (loop) low health: down on his right knee, his weight on the sword planted point
 *               down in front of him, the left hand on his raised knee; heaving, panting, a bead of
 *               sweat, the blade's fire burnt low to a few embers
 *   ko       6  (hold) a stagger, a drop to his knees, and he falls on his side, the coat spread
 *               over the floor behind him, the sword dropped beside him
 *   victory  8  (hold) the sword flicked out and down, shaking its flames off in a spray of
 *               embers, then rested on his shoulder: a grin, his fist on his hip, the coat streaming
 *
 * The effects these clips paint for themselves (the sweat, the dust of his fall, the flames shaken
 * off the blade) are `fx.extra` painters defined beside them or in fire.ts.
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { type ChibiPose, type FxContext, lerp3, pose, solveRig, type V3, wave } from '../rig.js';
import { FLAME_WARDEN } from './design.js';
import { both, embers, fireArc, flames, SMOKE, SMOKE_DARK, tongue } from './fire.js';
import { AT_EASE, READY, settle } from './moves-core.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];

/** Puts a pose's right hand on the grip of a sword it has let go of (`drop`): where `dropAt` puts the grip. */
function handOnGrip(p: ChibiPose): ChibiPose {
  const rig = solveRig(FLAME_WARDEN.build, p, FLAME_WARDEN.weapon.grip2);
  const g = rig.weapon.o;
  return { ...p, handF: [g[0] - rig.neck[0], rig.neck[1] - g[1], g[2]] };
}

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, head snapped back, the arms flung loose, the coat tails
  // whipped forward past his legs.
  pose(S, { x: -4, y: 5, lean: -16, twist: -10, tilt: -10, head: -16, look: -10, footF: [13, 0, 6], footB: [-10, -2, 5.5], handF: [2, 16, 9], handB: [-4, 8, 14], weapon: -160, roll: 10, yaw: -30, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 6, lean: -8, twist: 0, tilt: -6, head: -8, look: -6, footF: [12, 0, 6], footB: [-11, 0, 5.5], handF: [0, 16, 10], handB: [0, 11, 13], weapon: -146, roll: 4, yaw: -28, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 6, lean: 10, twist: 6, tilt: 0, head: 4 }), 0.7, { face: 'grit', wind: 0.2, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on his right knee, the left knee up and out, leaning on the sword planted point down in
 * front of his right knee (its point bitten into the floor), his right hand on the grip and his
 * left on his raised knee, head hung.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 13,
  twist: 4,
  tilt: 6,
  head: 3,
  look: 8,
  footF: [-12, 0, 7],
  footB: [6, 0, 12],
  kneel: 'F',
  handF: [0, 0, 0],
  handB: [3, 19, 9.5],
  drop: true,
  dropAt: [9, 33, 13],
  weapon: 176,
  roll: -6,
  yaw: 30,
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
 * A bead of sweat on his temple, at the edge of the head on screen: on the face's side side on,
 * on his left toward the viewer and his right away from them. `k` runs it down, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'front' ? -1 : 1;
    const x = Math.round(h[0] + dir * 11);
    const y = Math.round(h[1] - 6 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Heaving: the chest rises and slumps over the loop while the hands stay on the grip and the knee. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return handOnGrip(
    pose(KNELT, {
      y: 13 + b,
      lean: 13 + b * 4,
      head: 3 + b * 3,
      handB: [3 - 2 * b, 19 - 1.6 * b, 9.5],
      phase: i / 4,
      sway: (b - 0.5) * 0.2,
      face: i === 2 ? 'hurt' : 'grit',
      fx: { rune: 0, extra: both(embers(0.5, i, [9, 8, 10], 10, 4), i === 1 || i === 2 ? sweat(i === 1 ? 0 : 1) : undefined) },
    }),
  );
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * Down on his side: fallen back and rolled onto his left side, knees drawn up a little, turned
 * so he lies across the screen in every view, the coat spread over the floor behind him and the
 * sword dropped flat beside his outflung right hand.
 */
const DOWN: ChibiPose = pose(S, {
  x: -8,
  y: 22,
  lean: -84,
  twist: -55,
  tilt: 0,
  turn: -60,
  head: -10,
  look: -30,
  footF: [14, -2, 4],
  footB: [11, 0, -1],
  handF: [10, 4, 16],
  handB: [-2, 6, 8],
  drop: true,
  dropAt: [-14, 1.5, 24],
  weapon: 90,
  roll: 84,
  yaw: 0,
  face: 'closed',
  wind: -0.2,
  lift: -0.4,
  flare: 0.8,
});

/** Dust thrown up along him as he lands: puffs beside his hips, his back and his head. */
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
          c.glow(g[0] + dx, cy + dy, dy > r * 0.3 ? DUST_DARK : DUST, d < 0.6 ? 0.6 : 0.35, side < 0);
        }
      }
    }
  });
};

/** The blade's fire going out: a last curl of smoke off the dropped sword. */
const smoulder =
  (k: number) =>
  ({ c, tip, rig, proj, hash }: FxContext): void => {
    for (let i = 0; i < 4; i++) {
      const p = proj(lerp3(rig.weapon.o, tip, 0.35 + i * 0.18));
      const r = 1.5 + hash(i, 201) * 1.5;
      for (let j = 0; j < 3; j++) c.glow(p[0] + j * (i % 2 ? 1 : -1), p[1] - 2 - j * 2 - k * 3, j ? SMOKE : SMOKE_DARK, 0.5 * (1 - j * 0.25) * (r / 3));
    }
  };

const ko: ChibiPose[] = [
  // Stagger back.
  pose(S, { x: -4, y: 5, lean: -14, twist: -10, tilt: -6, head: -16, handF: [2, 15, 9], handB: [-3, 10, 13], weapon: 196, roll: 10, yaw: -30, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // His knees give: down on both, the sword's point striking the floor beside him.
  pose(S, { x: -2, y: 14, lean: 10, twist: 0, head: 18, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [6, 17, 9], handB: [6, 16, 6], weapon: 160, roll: -10, yaw: -20, face: 'hurt', wind: 0, flare: 0.2 }),
  // He sways back and over, turning, the sword slipping from his grip.
  pose(S, { x: -2, y: 15, lean: -12, twist: -20, tilt: -10, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [6, 18, 14], handB: [2, 18, 11], weapon: 170, roll: -10, yaw: 0, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling, the coat flying up; the sword has hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -48, twist: -35, turn: -45, head: -6, look: -10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 16], handB: [0, 6, 12], dropAt: [-12, 3, 24], weapon: 84, lift: 0.6, flare: 0.5 }),
  // Down: the thud raises dust and bounces his boots.
  pose(DOWN, { lean: -80, head: -8, footF: [14, -4, 4], footB: [11, -4, -1], lift: 0.2, fx: { dust: 0.9, extra: both(thud, smoulder(0)) } }),
  pose(DOWN, { fx: { extra: smoulder(1) } }),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * The flames shaken off the blade (k 0, just flung, to 1, scattered): tongues of fire flying off
 * the blade's length the way it was flicked (down and out ahead of him), breaking into embers and
 * a puff of smoke.
 */
const shaken =
  (k: number) =>
  (x: FxContext): void => {
    const { c, rig, hash, cam } = x;
    const w = rig.weapon;
    const out: V3 = [0.5, -0.55, 0.65];
    for (let i = 0; i < 11; i++) {
      const along = 12 + i * 3;
      const flung = (5 + hash(i, 211) * 12) * (0.35 + k);
      const p3 = add(add(w.o, w.u, along), out, flung);
      const p = x.proj(p3);
      if (k < 0.7) tongue(c, p[0], p[1], (8 - k * 9) * (0.6 + hash(i, 212) * 0.7), 1.8, cam.view === 'side' ? -0.6 : 0, 0.95);
      c.glow(p[0], p[1] - 1, i % 2 ? [255, 224, 138] : [255, 251, 232], 1 - k * 0.5);
      c.glow(p[0] + 1, p[1], [255, 126, 38], 0.8 - k * 0.4);
      if (k >= 0.5 && i % 3 === 0) {
        for (let j = 0; j < 3; j++) c.glow(p[0] + j, p[1] - 3 - j, j % 2 ? SMOKE : SMOKE_DARK, 0.5 - j * 0.12);
      }
    }
  };

const add = (a: V3, b: V3, k: number): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** The last pose, held: the sword on his shoulder, chin up, a grin, the fist on his hip, the coat streaming out on his left. */
const PROUD: ChibiPose = pose(AT_EASE, { y: 1.5, lean: -3, twist: 10, tilt: 3, head: -6, look: 12, footF: [7, 0, 7], footB: [-6, 0, 6], handF: [3, 6, 8.5], weapon: -50, roll: 24, yaw: -26, handB: [1, 14, 11], face: 'smirk', wind: 0.6, lift: 0.4, sway: -0.7 });

const victory: ChibiPose[] = [
  // The blade swung up out of the stance and out to his right, blazing.
  pose(S, { x: 0, y: 4, lean: 2, twist: -6, head: -2, look: 6, footF: [9, 0, 6.5], footB: [-8, 0, 6], handF: [0, 3, 15], weapon: -28, roll: 50, yaw: 0, handB: [1, 14, 11], face: 'grit', wind: 0.3, lift: 0.2, fx: { rune: 1, extra: flames(1.1, 81) } }),
  // Flicked hard down and out beside him: its flames fly off.
  pose(S, { x: 1, y: 5.5, lean: 8, twist: 6, head: 2, look: 6, footF: [9, 0, 6.5], footB: [-8, 0, 6], handF: [8, 15, 14], weapon: -206, roll: -24, yaw: 0, handB: [1, 14, 11], face: 'smirk', wind: 0.5, lift: 0.2, phase: 0.15, fx: { rune: 0.6, extra: both(fireArc({ from: -28, roll: 50, yaw: 0, width: 0.5, alpha: 0.8 }, 82), shaken(0)) } }),
  pose(S, { x: 1, y: 5.5, lean: 7, twist: 6, head: 0, look: 8, footF: [9, 0, 6.5], footB: [-8, 0, 6], handF: [8, 15.5, 14], weapon: -210, roll: -24, yaw: 0, handB: [1, 14, 11], face: 'smirk', wind: 0.45, lift: 0.3, phase: 0.3, fx: { rune: 0.25, extra: shaken(0.6) } }),
  // Swung back up onto his shoulder.
  pose(PROUD, { y: 2, lean: 0, handF: [5, 6, 10], weapon: -100, roll: 20, phase: 0.45, wind: 0.6, fx: { rune: 0.25, extra: shaken(1) } }),
  // Settled: chin up, a grin, the coat still streaming, an ember or two off the blade.
  pose(PROUD, { phase: 0.6, wind: 0.65, fx: { rune: 0.2, extra: embers(0.5, 1, undefined, 26, 5) } }),
  pose(PROUD, { phase: 0.75, wind: 0.62, fx: { rune: 0.2, extra: embers(0.5, 2, undefined, 26, 5) } }),
  pose(PROUD, { phase: 0.9, wind: 0.6, fx: { rune: 0.2, extra: embers(0.5, 3, undefined, 26, 5) } }),
  pose(PROUD, { phase: 1, fx: { rune: 0.2, extra: embers(0.5, 4, undefined, 26, 5) } }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
