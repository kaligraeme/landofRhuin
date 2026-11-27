/**
 * The Bowmaster's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back, head snapped back, eyes squeezed shut, the bow flung
 *               out, the cape flicked forward; most of the way back into the battle stance
 *   kneel    4  (loop) low health: down on her right knee, the bow planted upright on its lower
 *               tip in her left hand, her right hand pressed to her side, head hung; heaving,
 *               a bead of sweat
 *   ko       6  (hold) a stagger, down to her knees and over onto her back, turning so she lies
 *               across the screen in every view; the hood falls back from her hair and the bow
 *               lies beside her
 *   victory  8  (hold) the arrow eased off the string and spun in her fingers, slid back into the
 *               quiver over her shoulder, then the hood pushed back from her hair: a smile, a
 *               hand on her hip, the cape lifting in the breeze
 *
 * The sweat and the glint are `fx.extra` painters defined beside them. The flinch ends most of the
 * way back into the battle stance (`settle`), and the victory starts from it (`fromReady`).
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { type ChibiPose, type FxContext, lerp3, pose, wave } from '../rig.js';
import { AT_EASE, fromReady, READY, settle } from './moves-core.js';

const WHITE: RGB = [255, 255, 255];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, head snapped back, the bow flung out, the cape whipped forward.
  pose(READY, { x: -4, y: 4, lean: -16, twist: -6, tilt: -8, head: -14, look: -8, footF: [10, 0, 5.6], footB: [-9, -2, 5], handF: [-2, 12, 10], elbowF: undefined, handB: [6, 6, 12], weaponB: 40, rollB: 50, draw: 0, nock: false, weapon: 90, drop: true, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(READY, { x: -6, y: 5, lean: -9, twist: 0, tilt: -5, head: -7, look: -6, footF: [9, 0, 5.6], footB: [-10, 0, 5], handF: [0, 12, 9], elbowF: undefined, handB: [9, 8, 9], weaponB: 30, rollB: 44, draw: 0, nock: false, drop: true, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance.
  settle(pose(READY, { x: -3, y: 5, lean: 4, twist: 10, head: 3, handF: [4, 10, 3], draw: 0, nock: true }), 0.7, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on her right knee, the left knee up: the bow planted upright on its lower tip beside her
 * left knee, her left hand on its grip, her right hand pressed to her side, head hung.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 12,
  twist: 4,
  tilt: -4,
  head: 12,
  look: 6,
  footF: [-12, 0, 5],
  footB: [7, 0, 6],
  kneel: 'F',
  handF: [1, 13, 7],
  elbowF: [-0.6, -0.6, 1],
  weapon: 90,
  drop: true,
  handB: [10, 6, 9],
  weaponB: 2,
  rollB: 6,
  yawB: 35,
  face: 'grit',
  wind: 0.05,
  flare: 0.2,
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
 * A bead of sweat at the edge of her hood on screen, on the face's side side on and on the side
 * away from the bow toward or away from the viewer; `k` runs it down, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 12);
    const y = Math.round(h[1] - 5 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, {
    y: 13 + b,
    lean: 12 + b * 5,
    head: 10 + b * 5,
    // The neck moves forward and down as she slumps; the bow hand stays on the grip.
    handB: [10 - 2 * b, 6 - 1.6 * b, 9],
    handF: [1 - b, 13 - b, 7],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    face: i === 2 ? 'hurt' : 'grit',
    fx: i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : undefined,
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * She falls on her back with her feet toward the way she faced, twisting as she goes (`turn` to
 * -60), so she lies across the screen in all three views; the hood has fallen back from her hair,
 * and the bow lies on the floor beside her, by her outflung left hand.
 */
const DOWN: ChibiPose = pose(READY, {
  x: -8,
  y: 21,
  lean: -86,
  twist: 0,
  tilt: 0,
  turn: -60,
  head: -16,
  look: 24,
  footF: [14, 0, 6],
  footB: [12, -1, 2],
  handF: [8, 4, 14],
  elbowF: undefined,
  handB: [-2, 2, 13],
  weapon: 90,
  drop: true,
  dropB: true,
  dropAtB: [-14, 1.2, 15],
  weaponB: 90,
  rollB: 90,
  yawB: 0,
  draw: 0,
  nock: false,
  hood: 'down',
  face: 'closed',
  wind: 0,
  lift: -0.4,
});

/** Dust thrown up from the floor along her as she lands flat: puffs beside her hips, her back and her head. */
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

const ko: ChibiPose[] = [
  // Stagger back, the bow arm flung out.
  pose(READY, { x: -4, y: 4, lean: -14, twist: -6, tilt: -6, head: -16, footF: [10, 0, 5.6], footB: [-9, 0, 5], handF: [0, 12, 9], elbowF: undefined, handB: [4, 8, 12], weaponB: 50, rollB: 40, draw: 0, nock: false, drop: true, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // Her knees give: down on both, the bow sagging in her hand.
  pose(READY, { x: -2, y: 14, lean: 8, twist: 0, head: 18, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [6, 16, 6], elbowF: undefined, handB: [8, 14, 9], weaponB: 120, rollB: 20, draw: 0, nock: false, drop: true, face: 'hurt', wind: 0, flare: 0.2 }),
  // She sways back, turning, the bow slipping from her fingers, the hood sliding back.
  pose(READY, { x: -2, y: 15, lean: -10, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [6, 18, 12], elbowF: undefined, handB: [4, 16, 12], weaponB: 140, rollB: 30, draw: 0, nock: false, drop: true, hood: 'down', face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the cape flying up; the bow has hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 14], handB: [0, 6, 12], dropAtB: [-12, 2.5, 14], lift: 0.6 }),
  // Down: the thud raises dust and bounces her boots.
  pose(DOWN, { lean: -82, head: -12, footF: [14, -4, 6], footB: [12, -5, 2], lift: 0.2, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/** A glint of light at the arrowhead: a white four-pointed star with a warm halo, `k` its size (1 = rays 6 pixels long). */
const glint =
  (k: number) =>
  ({ c, tip, proj }: FxContext): void => {
    const [x, y] = proj(tip);
    const r = Math.round(6 * k);
    for (let i = -r; i <= r; i++) {
      const a = 1 - Math.abs(i) / (r + 1);
      c.glow(x + i, y, WHITE, a);
      c.glow(x, y + i, WHITE, a);
    }
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, [236, 255, 200], Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
  };

/** The arrow held up ahead of her face in her right hand, spinning in her fingers; the bow lowered in her left. */
const SPIN: ChibiPose = pose(AT_EASE, { y: 1, lean: -2, twist: 10, head: -2, look: 10, footF: [5, 0, 5], footB: [-5, 0, 4.4], handF: [11, 1, 7], elbowF: [0, -1, 1], drop: false, weapon: 0, roll: 24, yaw: 0, handB: [1, 15, 8], weaponB: 6, rollB: 10, face: 'smirk', wind: 0.2, phase: 0.2 });

/** The last pose, held: the hood pushed back, a smile for the viewer, a hand on her hip, the cape stirring in the breeze. */
const PROUD: ChibiPose = pose(AT_EASE, { y: 1, lean: -3, twist: 12, tilt: 2, head: -5, look: 14, footF: [6, 0, 6], footB: [-5, 0, 5], handF: [2, 14, 10], elbowF: [-0.4, -0.6, 1], handB: [6, 14, 7], weaponB: 10, rollB: 10, hood: 'down', face: 'smirk', wind: 0.25, lift: 0.15, sway: -0.3 });

/** The arrow's spin: a bright arc swept behind it. */
const twirl = (from: number): ChibiPose['fx'] => ({ smear: { from, width: 0.5, alpha: 0.85 } });

const victory: ChibiPose[] = [
  // The arrow eased off the string, the bow lowered.
  fromReady(pose(SPIN, { handF: [10, 5, 4], weapon: 80, face: 'stern', draw: 0, nock: false, phase: 0.05 }), 0.6),
  // Spun in her fingers, up ahead of her face.
  pose(SPIN, { weapon: -10, phase: 0.15, fx: twirl(-120) }),
  pose(SPIN, { weapon: 160, phase: 0.25, fx: twirl(-10) }),
  pose(SPIN, { weapon: 360, phase: 0.35, fx: { ...twirl(160), extra: glint(0.9) } }),
  // Slid back into the quiver over her shoulder.
  pose(SPIN, { handF: [-5, -2, 6], elbowF: [0.2, 0.8, 0.6], weapon: 196, roll: 10, look: 6, phase: 0.45, face: 'stern' }),
  // The hood pushed back off her hair, the hand passing over the crown.
  pose(SPIN, { handF: [1, -15, 6], elbowF: [0.2, 0.6, 1], drop: true, lean: -4, head: -4, look: 8, phase: 0.55, face: 'closed', wind: 0.25, lift: 0.15 }),
  pose(PROUD, { handF: [-3, -12, 7], elbowF: [-0.2, 0.6, 1], drop: true, phase: 0.7, wind: 0.3, lift: 0.2 }),
  pose(PROUD, { drop: true, phase: 0.85, wink: 'L' }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
