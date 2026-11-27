/**
 * The Guardian's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   special  6  (1 wind-up) Aegis, her special: the shield swung up before her and set, braced
 *               low behind it, a gold glint sweeping across its face as it blazes, held steady for
 *               the two seconds it lasts
 *   hurt     3  a flinch: knocked back, head snapped back, eyes squeezed shut, the shield arm
 *               flung wide, the cape flicked forward
 *   kneel    4  (loop) low health: down on her right knee behind the shield, its point planted on
 *               the floor before her, her sword hand resting on its rim; panting, a bead of sweat
 *   ko       6  (hold) a stagger, down onto her knees, then onto her back, turned so she lies
 *               across the screen in every view, the shield fallen flat beside her
 *   victory  8  (hold) the sword wheeled round beside her head and raised high with a glint, the
 *               shield on her arm, a smile
 *
 * The effects these clips paint for themselves (the glint over the shield, the sweat, the glint at
 * the sword's point, the dust of her fall) are `fx.extra` painters defined beside them. The guard's
 * wind-up comes up from the battle stance, and the flinch ends most of the way back into it.
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { add3, type ChibiPose, type FxContext, lerp3, pose, wave } from '../rig.js';
import { KITE } from './design.js';
import { AT_EASE, fromReady, READY, settle } from './moves-core.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];
const PALE_GOLD: RGB = [255, 240, 190];

// ── Aegis ────────────────────────────────────────────────────────────────────────────────────

/** Is a point of the shield's plane inside its outline? */
function onShield(u: number, v: number): boolean {
  let hit = false;
  for (let i = 0, j = KITE.length - 1; i < KITE.length; j = i++) {
    const a = KITE[j] as readonly [number, number];
    const b = KITE[i] as readonly [number, number];
    if (a[1] > v !== b[1] > v && u < a[0] + ((v - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit;
  }
  return hit;
}

/**
 * A glint sweeping across the shield's face: a slanting band of white light with a gold fringe,
 * `k` how far down the face it has run (0 at its top, 1 past its point), `a` its strength. Painted
 * only where the face is turned toward the viewer.
 */
const shieldGlint =
  (k: number, a = 1) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const g = rig.offhand;
    if (cam.facing(g.n) < 0.15) return;
    // The band runs across the face on a slant (u + 0.55 v constant), from above its top to below its point.
    const s = 22 - k * 58;
    for (let u = -32; u <= 17; u += 0.5) {
      for (let v = -13; v <= 13; v += 0.5) {
        const d = u + v * 0.55 - s;
        if (Math.abs(d) > 3.4 || !onShield(u, v)) continue;
        const p = proj(add3(add3(add3(g.o, g.u, u), g.v, v), g.n, 3.6));
        const core = Math.abs(d) < 1.3;
        c.glow(p[0], p[1], core ? WHITE : PALE_GOLD, a * (core ? 0.85 : 0.45));
      }
    }
  };

/** Raised and set: braced low behind the shield, its face square to the foe, the sword drawn back ready over it. */
const AEGIS: ChibiPose = pose(S, {
  x: -1,
  y: 8,
  lean: 6,
  twist: -2,
  head: 5,
  look: 0,
  footF: [11, 0, 6.5],
  footB: [-11, 0, 6],
  handF: [0, 9, 10],
  weapon: 62,
  roll: 30,
  yaw: -10,
  handB: [9.5, 9, -0.5],
  elbowB: [0.4, -0.25, 1],
  yawB: 0,
  rollB: 8,
  weaponB: 0,
  face: 'grit',
  wind: 0.3,
});

const guard: ChibiPose[] = [
  // Wind-up (a blink): the shield swung up out of the stance.
  fromReady(pose(AEGIS, { y: 6, lean: 8, handB: [9, 10, 0.5], rollB: 4, face: 'grit', fx: { runeB: 0.15 } }), 0.6),
  // Set: it locks into place with a flash of gold; the glint starts across its face.
  pose(AEGIS, { wind: 0.5, lift: 0.2, phase: 0.2, fx: { runeB: 0.3, aura: 0.3, dust: 0.7, extra: shieldGlint(0.1) } }),
  // Braced, the glint running down the face as the light settles over it.
  pose(AEGIS, { y: 8.5, lean: 7, phase: 0.35, wind: 0.4, fx: { runeB: 0.35, aura: 0.35, extra: shieldGlint(0.45) } }),
  pose(AEGIS, { y: 8.5, lean: 7, phase: 0.5, wind: 0.35, face: 'stern', fx: { runeB: 0.3, aura: 0.2, extra: shieldGlint(0.85, 0.7) } }),
  // Held steady.
  pose(AEGIS, { y: 8, lean: 6, phase: 0.65, wind: 0.3, face: 'stern', fx: { runeB: 0.25 } }),
  pose(AEGIS, { y: 8.4, lean: 6.5, phase: 0.8, wind: 0.28, face: 'stern', fx: { runeB: 0.2 } }),
];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back, head snapped back, the shield arm flung wide, the cape whipped forward.
  pose(S, { x: -4, y: 5, lean: -16, twist: 10, tilt: -8, head: -14, look: -8, footF: [11, 0, 5.4], footB: [-9, -2, 4.6], handF: [4, 15, 11], weapon: 70, roll: 10, yaw: -20, handB: [2, 8, 12], elbowB: [-0.2, -0.4, 1], yawB: 40, rollB: 0, face: 'hurt', wind: -0.7, lift: 0.2, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 6, lean: -8, twist: 4, tilt: -5, head: -6, look: -5, footF: [10, 0, 5.4], footB: [-10, 0, 4.6], handF: [4, 13, 10], weapon: 60, roll: 14, yaw: -12, handB: [5, 9, 7], elbowB: [0.1, -0.4, 1], yawB: 22, rollB: 0, face: 'hurt', wind: -0.3, lift: 0.15, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 6, lean: 6, twist: -4, head: 4, handF: [5, 12, 10], weapon: 52, handB: [8, 9.5, 2] }), 0.65, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on her right knee, the left knee up, the shield planted before her (its point bitten into
 * the floor, its face to the foe, its rim under her chin), her sword hand resting on the corner of
 * its rim with the sword hanging point down beside it, head bowed.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 12,
  twist: -4,
  tilt: 4,
  head: 12,
  look: 4,
  footF: [-12, 0, 6],
  footB: [7, 0, 6],
  kneel: 'F',
  handF: [12, 4, 7],
  weapon: 180,
  roll: 0,
  yaw: 0,
  handB: [10, 14, 0],
  elbowB: [0.4, -0.3, 1],
  yawB: 0,
  rollB: -6,
  weaponB: 0,
  face: 'grit',
  wind: 0.05,
  flare: 0.3,
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

/** A bead of sweat on her temple, at the edge of the head on screen (its face side), `k` running it down, 0 to 1. */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 11);
    const y = Math.round(h[1] - 6 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Panting: the chest rises and slumps over the loop while the hands stay on the shield. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return pose(KNELT, {
    y: 13 + b * 0.8,
    lean: 12 + b * 4,
    head: 5 + b * 4,
    handF: [12 - 1.6 * b, 4 - 1.2 * b, 7],
    handB: [10 - 1.6 * b, 14 - 1.2 * b, 0],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    face: i === 2 ? 'hurt' : 'grit',
    fx: i === 1 || i === 2 ? { extra: sweat(i === 1 ? 0 : 1) } : undefined,
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * She falls on her back with her feet toward the way she faced, turned (`turn` -60) so she lies
 * across the screen in all three views. The shield has slipped from her arm and lies flat on the
 * floor beside her, face up; the sword lies by her outflung hand.
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
  footF: [14, 0, 6.5],
  footB: [12, -1, 2],
  handF: [12, 5, 17],
  handB: [-4, 2, 12],
  elbowB: undefined,
  drop: true,
  dropAt: [-16, 1.5, 24],
  weapon: 90,
  roll: 80,
  yaw: 0,
  dropB: true,
  dropAtB: [2, 1.5, -20],
  weaponB: 90,
  rollB: -90,
  yawB: 0,
  face: 'closed',
  wind: 0,
  lift: -0.4,
});

/** Dust thrown up from the floor all along her as she lands flat: puffs beside her hips, her back and her head. */
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
  // Stagger back, the shield arm dropping.
  pose(S, { x: -4, y: 5, lean: -14, twist: 6, tilt: -6, head: -14, handF: [4, 14, 9], weapon: 70, roll: 10, yaw: -20, handB: [3, 12, 9], elbowB: [0, -0.6, 1], yawB: 30, rollB: 0, face: 'hurt', sway: -0.4, lift: 0.15 }),
  // Her knees give: down on both, the sword's point striking the floor in front of her.
  pose(S, { x: -2, y: 14, lean: 8, twist: 0, head: 16, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [8, 15, 6], weapon: 150, roll: 0, yaw: -10, handB: [5, 15, 8], elbowB: [0, -0.8, 1], yawB: 10, rollB: -20, face: 'hurt', wind: 0, flare: 0.2 }),
  // She sways back, turning, the shield slipping off her arm.
  pose(S, { x: -2, y: 15, lean: -10, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [6, 17, 13], weapon: 160, roll: -10, yaw: 0, handB: [2, 17, 11], elbowB: [0, -0.8, 1], dropB: true, dropAtB: [3, 10, -14], weaponB: 40, rollB: -40, yawB: 0, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the cape flying up; the shield has hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 15], handB: [0, 6, 13], dropAt: [-14, 3, 24], weapon: 84, dropAtB: [2, 3, -19], weaponB: 80, rollB: -80, lift: 0.3 }),
  // Down: the thud raises dust and bounces her boots.
  pose(DOWN, { lean: -82, head: -12, footF: [14, -4, 6.5], footB: [12, -5, 2], lift: 0.2, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * A glint of light at the sword's point: a white four-pointed star with a warm halo, `k` its size
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
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, PALE_GOLD, Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(x + i * 2, y + j * 2, WHITE, 0.6);
  };

/** The flourish: her sword arm raised out beside her head, the sword wheeling round in her hand, the shield low on her arm. */
const TWIRL: ChibiPose = pose(S, { y: 3, lean: -3, twist: 10, tilt: -3, head: -4, look: 6, footF: [7, 0, 6], footB: [-7, 0, 5.4], handF: [-7, -9, 16], handB: [4, 13, 8], elbowB: [0.1, -0.7, 1], yawB: 10, rollB: 0, weaponB: 0, roll: -20, yaw: 0, face: 'smirk', wind: 0.5, flare: 0.2 });

/** The last pose, held: the sword raised high out to her right, the shield on her arm, chin up, a smile, the cape streaming on her left. */
const PROUD: ChibiPose = pose(AT_EASE, { y: 1.5, lean: -3, twist: 6, tilt: -2, head: -6, look: 10, footF: [6, 0, 6.5], footB: [-6, 0, 5.4], handF: [-5, -6, 16], weapon: 14, roll: 28, yaw: 0, handB: [6, 12, 6], elbowB: [0.2, -0.6, 1], yawB: 6, rollB: 0, weaponB: 0, face: 'smirk', wind: 0.6, lift: 0.25, sway: -0.7 });

const victory: ChibiPose[] = [
  // A breath first: the sword swung down out of her guard, on its way round behind her.
  fromReady(pose(S, { y: 6, lean: 8, twist: -10, head: 2, look: 4, handF: [2, 14, 11], weapon: 250, roll: 0, yaw: 0, handB: [5, 12, 7], elbowB: [0.1, -0.6, 1], yawB: 10, face: 'smirk', wind: 0.25 }), 0.5),
  // The sword wheels up behind her, over the top...
  pose(TWIRL, { weapon: 372, phase: 0.1, fx: { smear: { from: 250, roll: 0, width: 0.5 }, rune: 0.6 } }),
  // ...and round again.
  pose(TWIRL, { weapon: 650, yaw: -30, phase: 0.25, wind: 0.6, fx: { smear: { from: 372, width: 0.5 }, rune: 0.8 } }),
  // Raised high and out beside her, a glint at the point, the cape thrown wide.
  pose(PROUD, { y: 1, lean: -5, head: -8, handF: [-6, -7, 17], weapon: 8, roll: 30, wind: 0.65, lift: 0.3, flare: 0.3, phase: 0.4, fx: { rune: 1, extra: glint(1) } }),
  pose(PROUD, { y: 1.2, handF: [-5.5, -6.5, 16.5], weapon: 12, wind: 0.65, lift: 0.25, phase: 0.55, fx: { rune: 0.7, extra: glint(0.6) } }),
  // Held: chin up, a smile, the cape still streaming.
  pose(PROUD, { phase: 0.7, wind: 0.62, fx: { rune: 0.45 } }),
  pose(PROUD, { phase: 0.85, wind: 0.6, fx: { rune: 0.3 } }),
  pose(PROUD, { phase: 1, fx: { rune: 0.2 } }),
];

/** The state clips' poses, by clip (Aegis is her special, so the guard plays as `special`). */
export const STATE_MOVES = { special: guard, hurt, kneel, ko, victory };
