/**
 * The Blademaster's states, in the chibi pose format (rig.ts, ChibiPose).
 *
 *   hurt     3  a flinch: knocked back and sideways, head snapped back, eyes squeezed shut, both
 *               blades flung out loose, the coat-tails flicked forward
 *   kneel    4  (loop) low health: down on her right knee, the right sabre planted point down
 *               beside it with her hand on the hilt, the left held back low behind her, ready;
 *               her head hangs and she pants, a bead of sweat running down
 *   ko       6  (hold) a stagger, her knees give, and she falls back onto the floor, twisting
 *               so that she lies across the screen in every view; both sabres clatter down beside
 *               her
 *   victory  8  (hold) both blades twirled round in her raised hands, a glint at each tip, then
 *               crossed behind her back, the tips fanned out past her shoulders: chin up, a
 *               smirk and a wink
 *
 * The effects these clips paint for themselves (the sweat, the glint, the dust of her fall) are
 * `fx.extra` painters defined beside them. The flinch ends most of the way back into the battle
 * stance (`settle`), and victory starts from it (`fromReady`).
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK } from '../fx.js';
import { type ChibiPose, type FxContext, lerp3, pose, solveRig, wave } from '../rig.js';
import { BLADEMASTER } from './design.js';
import { AT_EASE, both, fromReady, READY, settle } from './moves-core.js';

const S = READY;
const WHITE: RGB = [255, 255, 255];
const REACH = BLADEMASTER.weapon.reach[1];

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: ChibiPose[] = [
  // The blow: thrown back and sideways, head snapped back, the arms flung loose, the coat-tails
  // whipped forward past her legs.
  pose(S, { x: -4, y: 5, lean: -18, twist: -14, tilt: -10, head: -16, look: -10, footF: [12, 0, 6], footB: [-10, -2, 5.5], handF: [5, 16, 5], weapon: 60, roll: -16, yaw: 40, handB: [-4, 8, 14], weaponB: -40, rollB: 20, yawB: 0, face: 'hurt', wind: -0.7, lift: 0.4, flare: 0.3, sway: -0.5, phase: 0.2 }),
  // Knocked back a step.
  pose(S, { x: -6, y: 6, lean: -10, twist: -10, tilt: -6, head: -8, look: -6, footF: [11, 0, 6], footB: [-11, 0, 5.5], handF: [6, 15, 6], weapon: 70, roll: -10, yaw: 40, handB: [-1, 10, 12], weaponB: -10, rollB: 20, yawB: 0, face: 'hurt', wind: -0.3, lift: 0.3, flare: 0.15, sway: -0.3, phase: 0.4 }),
  // Recovering, teeth gritted: most of the way back into the battle stance, which follows.
  settle(pose(S, { x: -3, y: 6, lean: 8, twist: -12, tilt: 0, head: 4, handF: [8, 14, 7], weapon: 86, handB: [8, 9, 8], weaponB: 30 }), 0.7, { face: 'grit', wind: 0.15, phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on her right knee, the left knee up, the right sabre planted point down beside the knee
 * with her hand on the hilt; the left held back low behind her, point trailing, still ready.
 */
const KNELT: ChibiPose = {
  x: 0,
  y: 13,
  lean: 16,
  twist: 6,
  tilt: 6,
  head: 14,
  look: 8,
  footF: [-12, 0, 6],
  footB: [6, 0, 7],
  kneel: 'F',
  handF: [8, 5, 13],
  weapon: 180,
  roll: 0,
  yaw: 0,
  handB: [-3, 12, 11],
  weaponB: -120,
  rollB: 10,
  yawB: -20,
  face: 'grit',
  wind: 0.05,
  flare: 0.4,
};

/** Puts the right hand where the planted blade's point just bites the floor (its tip a pixel under it). */
function planted(p: ChibiPose): ChibiPose {
  const rig = solveRig(BLADEMASTER.build, p, BLADEMASTER.weapon.grip2);
  const tip = rig.weapon.o[1] + rig.weapon.u[1] * REACH;
  return { ...p, handF: [p.handF[0], p.handF[1] + tip + 1, p.handF[2] ?? 13] };
}

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
 * A bead of sweat on her temple, painted at the edge of the head on screen: on the face's side side
 * on, and on her left toward or away from the viewer (away from the planted blade). `k` runs it
 * down her temple, 0 to 1.
 */
const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const x = Math.round(h[0] + dir * 12);
    const y = Math.round(h[1] - 6 + k * 4);
    for (const [dx, dy, col] of DROP) c.glow(x + dx, y + dy, col, 1);
  };

/** Panting: the chest rises and slumps over the loop while the hand stays on the hilt. */
const kneel = Array.from({ length: 4 }, (_, i): ChibiPose => {
  const b = wave(i, 4);
  return planted(
    pose(KNELT, {
      y: 13 + b,
      lean: 16 + b * 5,
      head: 12 + b * 5,
      handB: [-3 - b, 12 + b * 0.6, 11],
      weaponB: -120 + b * 4,
      phase: i / 4,
      sway: (b - 0.5) * 0.2,
      face: i === 2 ? 'hurt' : 'grit',
      fx: { rune: 0.1, runeB: 0.25, extra: i === 1 || i === 2 ? sweat(i === 1 ? 0 : 1) : undefined },
    }),
  );
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * She falls on her back with her feet toward the way she faced, and twists as she goes (`turn` to
 * -60): lying straight back she would point at the viewer in the front and back views, turned she
 * lies across the screen in all three. Both sabres lie flat on the floor, one by each outflung hand.
 */
const DOWN: ChibiPose = pose(S, {
  x: -8,
  y: 21,
  lean: -86,
  twist: 0,
  tilt: 0,
  turn: -60,
  head: -16,
  look: 24,
  footF: [15, 0, 6],
  footB: [13, -1, 2],
  handF: [12, 5.5, 16],
  handB: [-4, 2, 12],
  drop: true,
  dropAt: [-14, 1.5, 22],
  weapon: 80,
  roll: 82,
  yaw: 0,
  dropB: true,
  dropAtB: [6, 1.5, -18],
  weaponB: 100,
  rollB: 82,
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

/** A clatter: a glint and a couple of sparks where each fallen blade strikes the floor. */
const clatter = ({ c, rig, proj }: FxContext): void => {
  for (const g of [rig.weapon, rig.offhand]) {
    const p = proj([g.o[0] + g.u[0] * 22, 1, g.o[2] + g.u[2] * 22]);
    for (let i = -3; i <= 3; i++) {
      c.glow(p[0] + i, p[1], WHITE, 1 - Math.abs(i) / 4);
      c.glow(p[0], p[1] + i, WHITE, 1 - Math.abs(i) / 4);
    }
    c.glow(p[0] + 4, p[1] - 3, [255, 214, 170], 0.9);
    c.glow(p[0] - 4, p[1] - 2, [255, 214, 170], 0.9);
  }
};

const ko: ChibiPose[] = [
  // Stagger back, the blades swinging loose.
  pose(S, { x: -4, y: 5, lean: -14, twist: -10, tilt: -6, head: -16, handF: [4, 14, 6], weapon: 70, roll: -10, yaw: 30, handB: [-3, 10, 12], weaponB: 200, rollB: 10, yawB: 0, face: 'hurt', sway: -0.4, lift: 0.3 }),
  // Her knees give: down on both, the blades hanging from her loosening grip, points on the floor.
  pose(S, { x: -2, y: 14, lean: 8, twist: 0, head: 18, footF: [-8, -1, 5], footB: [-9, -1, 4.6], kneel: 'F', handF: [7, 16, 9], weapon: 160, roll: 0, yaw: 20, handB: [7, 16, 9], weaponB: 160, rollB: 0, yawB: 20, face: 'hurt', wind: 0, flare: 0.2 }),
  // She sways back, turning; the blades slip from her hands.
  pose(S, { x: -2, y: 15, lean: -10, twist: 0, tilt: -8, turn: -20, head: 2, footF: [-6, -1, 5], footB: [-8, -1, 4.6], kneel: 'F', handF: [6, 18, 14], handB: [2, 18, 11], drop: true, dropAt: [-6, 3, 20], weapon: 120, roll: 70, yaw: 0, dropB: true, dropAtB: [6, 3, -16], weaponB: 110, rollB: 70, yawB: 0, face: 'closed', wind: 0, lift: 0.2 }),
  // Toppling back, the coat flying up; the blades have hit the floor.
  pose(DOWN, { x: -5, y: 17, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 6], footB: [3, -1, 4], handF: [6, 4, 15], handB: [0, 6, 13], lift: 0.6, fx: { extra: clatter } }),
  // Down: the thud raises dust and bounces her boots.
  pose(DOWN, { lean: -82, head: -12, footF: [15, -4, 6], footB: [13, -5, 2], lift: 0.2, fx: { dust: 0.9, extra: thud } }),
  pose(DOWN, {}),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/**
 * A glint of light at a blade's tip: a white four-pointed star with a warm halo, `k` its size
 * (1 = rays 7 pixels long); `off` for the left blade's.
 */
const glint =
  (k: number, off = false) =>
  ({ c, tip, tipB, proj }: FxContext): void => {
    const [x, y] = proj(off ? tipB : tip);
    const r = Math.round(7 * k);
    for (let i = -r; i <= r; i++) {
      const a = 1 - Math.abs(i) / (r + 1);
      c.glow(x + i, y, WHITE, a);
      c.glow(x, y + i, WHITE, a);
    }
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.abs(i) + Math.abs(j) <= 2) c.glow(x + i, y + j, [255, 214, 220], Math.abs(i) + Math.abs(j) === 0 ? 1 : 0.5);
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(x + i * 2, y + j * 2, WHITE, 0.6);
  };

/** The twirl: both arms raised out beside her head, the blades wheeling round in her hands. */
const TWIRL: ChibiPose = pose(S, { y: 3, lean: -3, twist: 0, head: -4, look: 6, footF: [8, 0, 6.5], footB: [-8, 0, 6], handF: [-6, -6, 15], handB: [-6, -6, 15], roll: -16, yaw: 0, rollB: -16, yawB: 0, face: 'smirk', wind: 0.5, flare: 0.2 });

/**
 * The last pose, held: both blades crossed behind her back, the hands crossed at the small of her
 * back and the tips fanned out past her shoulders, an X behind her; chin up, a smirk for the viewer.
 */
const PROUD: ChibiPose = pose(AT_EASE, { x: 0, y: 1.5, lean: -2, twist: 6, tilt: 3, head: -6, look: 12, footF: [6, 0, 5.4], footB: [-5, 0, 4.6], handF: [-7, 15, -1], weapon: -8, roll: 50, yaw: -6, handB: [-7, 15, -1], weaponB: -8, rollB: 50, yawB: -6, face: 'smirk', wind: 0.5, lift: 0.4, sway: -0.6 });

const victory: ChibiPose[] = [
  // A breath first: the blades swung down out of her guard.
  fromReady(pose(S, { y: 6, lean: 8, twist: 0, head: 2, look: 4, handF: [4, 14, 11], weapon: 190, roll: 0, yaw: 0, handB: [4, 14, 11], weaponB: 190, rollB: 0, yawB: 0, face: 'smirk', wind: 0.25 }), 0.6),
  // Both blades wheel up and over in her raised hands...
  pose(TWIRL, { weapon: 360, weaponB: 360, phase: 0.1, fx: { smear: { from: 190, roll: 0, width: 0.45 }, smearB: { from: 190, roll: 0, width: 0.45 }, rune: 0.8, runeB: 0.8 } }),
  // ...and round again...
  pose(TWIRL, { weapon: 640, weaponB: 640, phase: 0.25, wind: 0.6, fx: { smear: { from: 360, width: 0.45 }, smearB: { from: 360, width: 0.45 }, rune: 1, runeB: 1 } }),
  // ...stopping upright beside her head with a glint at each tip.
  pose(TWIRL, { y: 2, lean: -5, head: -8, handF: [-5, -5, 16], handB: [-5, -5, 16], weapon: 720, weaponB: 720, roll: 24, rollB: 24, wind: 0.6, lift: 0.5, flare: 0.3, phase: 0.4, fx: { rune: 1, runeB: 1, extra: both(glint(1), glint(0.8, true)) } }),
  // Swung down and round behind her back.
  pose(PROUD, { y: 2, handF: [-5, 13, 5], handB: [-5, 13, 5], weapon: -30, weaponB: -30, roll: 20, rollB: 20, wind: 0.7, lift: 0.45, phase: 0.55, face: 'stern', look: 6, fx: { rune: 0.5, runeB: 0.5 } }),
  // Settled: chin up, a smirk, then a wink.
  pose(PROUD, { phase: 0.7, wind: 0.6 }),
  pose(PROUD, { phase: 0.85, wind: 0.55, wink: 'L' }),
  pose(PROUD, { phase: 1 }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
