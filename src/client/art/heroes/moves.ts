/**
 * The heroes' choreography: every frame of every clip, per weapon. Poses place the pelvis, lean
 * the torso and put the feet, hands and weapon (see skeleton.ts); hands are relative to the base
 * of the neck, feet to the ground under the hero.
 *
 *   idle    6 frames  relaxed, weapon at rest, breathing
 *   battle  6 frames  a low, wide fighting stance with the weapon ready, bouncing on the balls of the feet
 *   move    8 frames  a full sprint: long strides, a hard forward lean, cape and hair streaming
 *   action  8 frames  the basic attack: 2 frames of wind-up, then the blow, follow-through and recovery
 *   skill  10 frames  3 frames gathering power, then the weapon's signature move
 */
import type { Moveset } from './designs.js';
import type { Pose, Vec } from './skeleton.js';

export type HeroClip = 'idle' | 'battle' | 'move' | 'action' | 'skill';
export const HERO_CLIP_LENGTH: Record<HeroClip, number> = { idle: 6, battle: 6, move: 8, action: 8, skill: 10 };
/** Frames of the attack that wind up before the blow, and of the skill that gather power. */
export const HERO_WINDUP = 2;
export const HERO_CHARGE = 3;

const wave = (i: number, n: number): number => (1 - Math.cos((2 * Math.PI * i) / n)) / 2;

/** The sprint's legs: contact, down, passing, flight, then the same with the other leg. */
const RUN: { f: Vec; b: Vec; y: number }[] = [
  { f: [18, 0], b: [-14, -12], y: 3 },
  { f: [10, 0], b: [-9, -17], y: 5 },
  { f: [2, 0], b: [4, -14], y: 2 },
  { f: [-8, -1], b: [14, -7], y: -3 },
];
function runLegs(i: number): { footF: Vec; footB: Vec; y: number } {
  const k = RUN[i % 4] as { f: Vec; b: Vec; y: number };
  return i < 4 ? { footF: k.f, footB: k.b, y: k.y } : { footF: k.b, footB: k.f, y: k.y };
}

/** Free arms pump against the legs while sprinting. */
function pump(i: number, amp: number): number {
  return Math.cos((2 * Math.PI * i) / 8) * amp;
}

type Clips = Record<HeroClip, Pose[]>;

function build(base: Pose, clips: { idle: (i: number) => Partial<Pose>; battle: (i: number) => Partial<Pose>; move: (i: number) => Partial<Pose>; action: Partial<Pose>[]; skill: Partial<Pose>[] }): Clips {
  const make = (p: Partial<Pose>): Pose => ({ ...base, ...p });
  const series = (n: number, f: (i: number) => Partial<Pose>): Pose[] => Array.from({ length: n }, (_, i) => make(f(i)));
  return {
    idle: series(HERO_CLIP_LENGTH.idle, clips.idle),
    battle: series(HERO_CLIP_LENGTH.battle, clips.battle),
    move: series(HERO_CLIP_LENGTH.move, (i) => ({ ...runLegs(i), lean: 26, wind: 1, x: 3, fx: { speed: true, dust: i === 0 || i === 4 }, ...clips.move(i) })),
    action: clips.action.map(make),
    skill: clips.skill.map(make),
  };
}

/** A relaxed stance and a fighting stance shared by everyone; weapons adjust the arms. */
const STAND = { x: 0, y: 1, lean: 4, footF: [6, 0] as Vec, footB: [-6, 0] as Vec };
const FIGHT = { x: 0, y: 5, lean: 14, footF: [14, 0] as Vec, footB: [-12, 0] as Vec };

// ── Warrior: greatsword ──────────────────────────────────────────────────────────────────────

const greatsword = (): Clips =>
  build({ ...FIGHT, handF: [9, 12], weapon: 55, wind: 0.2 }, {
    // Out of combat the blade rests on his shoulder.
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [5, 11 + wave(i, 6)], weapon: -52, bendF: 1, behind: true }),
    battle: (i) => ({ y: 5 + wave(i, 6) * 2, handF: [10, 11 + wave(i, 6)], weapon: 52 + wave(i, 6) * 4 }),
    move: (i) => ({ handF: [6 + pump(i, 1), 16], weapon: -118 + pump(i, 4), behind: true }),
    action: [
      { x: -2, y: 4, lean: -6, footF: [14, 0], footB: [-13, 0], handF: [-3, -9], bendF: -1, weapon: -112, behind: true, wind: 0.4 },
      { x: -3, y: 5, lean: -14, footF: [14, 0], footB: [-14, 0], handF: [-6, -11], bendF: -1, weapon: -138, behind: true, wind: 0.4 },
      { x: 4, y: 3, lean: 16, footF: [17, 0], footB: [-14, 0], handF: [9, -8], weapon: 28, wind: 0.6, fx: { smear: -138 } },
      { x: 9, y: 9, lean: 36, footF: [20, 0], footB: [-16, 0], handF: [17, 15], weapon: 138, wind: 0.7, fx: { smear: 28, impact: true, dust: true } },
      { x: 9, y: 10, lean: 38, footF: [20, 0], footB: [-16, 0], handF: [15, 19], weapon: 160, wind: 0.5, fx: { smear: 138 } },
      { x: 8, y: 9, lean: 36, footF: [20, 0], footB: [-16, 0], handF: [15, 19], weapon: 162, wind: 0.3 },
      { x: 4, y: 6, lean: 22, footF: [16, 0], footB: [-13, 0], handF: [12, 12], weapon: 100, wind: 0.2 },
      { handF: [10, 12], weapon: 62 },
    ],
    // Leap high, sword raised, and crash down: a shockwave runs along the ground.
    skill: [
      { y: 9, lean: 10, footF: [14, 0], footB: [-12, 0], handF: [4, 10], weapon: -110, behind: true, fx: { aura: 0.4 } },
      { y: 12, lean: 14, footF: [14, 0], footB: [-12, 0], handF: [3, 12], weapon: -125, behind: true, fx: { aura: 0.7 } },
      { y: 13, lean: 16, footF: [14, 0], footB: [-12, 0], handF: [3, 12], weapon: -128, behind: true, fx: { aura: 1, dust: true } },
      { x: 2, y: -18, lean: -4, footF: [10, -28], footB: [-6, -24], handF: [-2, -12], bendF: -1, weapon: -128, behind: true, wind: 0.8, fx: { aura: 1, smear: -128 } },
      { x: 4, y: -22, lean: -10, footF: [12, -32], footB: [-4, -30], handF: [-5, -13], bendF: -1, weapon: -145, behind: true, wind: 0.9, fx: { aura: 0.9 } },
      { x: 8, y: 9, lean: 38, footF: [18, 0], footB: [-14, 0], handF: [16, 16], weapon: 150, wind: 0.8, fx: { smear: -145, impact: true, quake: true, aura: 0.8 } },
      { x: 8, y: 11, lean: 40, footF: [18, 0], footB: [-14, 0], handF: [15, 19], weapon: 165, wind: 0.5, fx: { quake: true, dust: true, aura: 0.5 } },
      { x: 7, y: 10, lean: 36, footF: [18, 0], footB: [-14, 0], handF: [15, 18], weapon: 165, wind: 0.3, fx: { aura: 0.25 } },
      { x: 4, y: 7, lean: 24, footF: [16, 0], footB: [-13, 0], handF: [12, 13], weapon: 110 },
      { handF: [10, 12], weapon: 62 },
    ],
  });

// ── Warrior: battleaxe ───────────────────────────────────────────────────────────────────────

const battleaxe = (): Clips =>
  build({ ...FIGHT, handF: [8, 9], weapon: 35, wind: 0.2 }, {
    // The axe hangs from one hand, head down by her boot.
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [5, 20], handB: [-3, 21 + wave(i, 6)], weapon: 170, behind: false }),
    battle: (i) => ({ y: 5 + wave(i, 6) * 2, handF: [8, 8 + wave(i, 6)], weapon: 32 + wave(i, 6) * 5 }),
    move: (i) => ({ handF: [10 + pump(i, 1), 13], weapon: 62 + pump(i, 3) }),
    // A huge two-handed chop from over the shoulder down to the floor.
    action: [
      { x: -2, y: 4, lean: -4, handF: [-2, -4], bendF: -1, weapon: -95, behind: true, wind: 0.4 },
      { x: -4, y: 6, lean: -14, footF: [12, 0], footB: [-15, 0], handF: [-7, -8], bendF: -1, weapon: -140, behind: true, wind: 0.4 },
      { x: 4, y: 3, lean: 18, footF: [17, 0], footB: [-14, 0], handF: [10, -6], weapon: 40, wind: 0.6, fx: { smear: -140 } },
      { x: 9, y: 9, lean: 36, footF: [20, 0], footB: [-16, 0], handF: [17, 14], weapon: 150, wind: 0.7, fx: { smear: 40, impact: true, dust: true } },
      { x: 9, y: 10, lean: 38, footF: [20, 0], footB: [-16, 0], handF: [15, 18], weapon: 170, wind: 0.5, fx: { smear: 150 } },
      { x: 8, y: 9, lean: 34, footF: [20, 0], footB: [-16, 0], handF: [15, 18], weapon: 172, wind: 0.3 },
      { x: 4, y: 6, lean: 22, handF: [11, 11], weapon: 95, wind: 0.2 },
      { handF: [9, 9], weapon: 42 },
    ],
    // A spinning whirlwind: the axe sweeps across the front, round the back and across again.
    skill: [
      { y: 9, lean: -4, handF: [-2, 4], weapon: -100, behind: true, fx: { aura: 0.4 } },
      { y: 11, lean: -10, handF: [-6, 2], bendF: -1, weapon: -125, behind: true, fx: { aura: 0.7 } },
      { y: 12, lean: -12, handF: [-7, 2], bendF: -1, weapon: -130, behind: true, fx: { aura: 1, dust: true } },
      { x: 3, y: 7, lean: 10, handF: [18, 8], weapon: 95, wind: 0.6, fx: { smear: -130, aura: 1 } },
      { x: 3, y: 7, lean: -6, handF: [-8, 8], bendF: -1, weapon: -95, behind: true, wind: 0.7, fx: { aura: 0.9 } },
      { x: 3, y: 7, lean: 12, handF: [18, 8], weapon: 98, wind: 0.8, fx: { smear: -95, aura: 0.9, dust: true } },
      { x: 3, y: 7, lean: -6, handF: [-8, 8], bendF: -1, weapon: -95, behind: true, wind: 0.8, fx: { aura: 0.8 } },
      { x: 8, y: 10, lean: 34, footF: [19, 0], footB: [-15, 0], handF: [17, 15], weapon: 155, wind: 0.6, fx: { smear: -95, impact: true, quake: true, aura: 0.6 } },
      { x: 5, y: 7, lean: 24, handF: [12, 12], weapon: 110, fx: { aura: 0.2 } },
      { handF: [9, 9], weapon: 42 },
    ],
  });

// ── Mage: branch staff ───────────────────────────────────────────────────────────────────────

const staff = (): Clips =>
  build({ ...FIGHT, y: 3, lean: 8, footF: [12, 0], footB: [-10, 0], handF: [10, 8], handB: [12, 14], weapon: 18, wind: 0.2 }, {
    // Leaning on his staff like a walking stick.
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [9, 12 + wave(i, 6)], handB: [-2, 22], weapon: 6 }),
    battle: (i) => ({ y: 3 + wave(i, 6) * 1.5, handF: [10, 7 + wave(i, 6)], handB: [14, 13 - wave(i, 6) * 2], weapon: 16 + wave(i, 6) * 4, fx: { circle: 0.25 } }),
    move: (i) => ({ lean: 22, handF: [9, 10], handB: [-6 - pump(i, 6), 16], weapon: 55 + pump(i, 3) }),
    // Raise the staff, then thrust it forward to loose a bolt from the crystal.
    action: [
      { y: 3, lean: -2, handF: [4, -6], handB: [8, 6], weapon: -12, fx: { circle: 0.4 } },
      { y: 4, lean: -8, handF: [0, -8], handB: [10, 4], weapon: -28, fx: { circle: 0.6, aura: 0.3 } },
      { x: 4, y: 3, lean: 16, handF: [20, 2], handB: [18, 10], weapon: 72, fx: { flash: true, circle: 0.6 } },
      { x: 5, y: 4, lean: 18, handF: [21, 3], handB: [17, 11], weapon: 76, fx: { flash: true, circle: 0.4 } },
      { x: 4, y: 4, lean: 16, handF: [18, 4], handB: [15, 12], weapon: 66, fx: { circle: 0.2 } },
      { x: 2, y: 3, lean: 12, handF: [14, 6], handB: [14, 13], weapon: 45 },
      { x: 1, y: 3, lean: 10, handF: [12, 7], handB: [13, 14], weapon: 28 },
      { handF: [10, 8], weapon: 20 },
    ],
    // Hold the staff high in a widening magic circle, then drive it down to unleash the spell.
    skill: [
      { y: 2, lean: 0, handF: [4, -12], handB: [-8, 4], weapon: 4, fx: { circle: 0.5, aura: 0.4 } },
      { y: 1, lean: -4, handF: [3, -15], handB: [-10, 0], weapon: -2, fx: { circle: 0.8, aura: 0.7 } },
      { y: 0, lean: -6, handF: [2, -16], handB: [-12, -2], weapon: -6, fx: { circle: 1, aura: 1 } },
      { x: 3, y: 4, lean: 18, handF: [18, 0], handB: [16, 6], weapon: 80, fx: { circle: 1, aura: 1, flash: true } },
      { x: 4, y: 5, lean: 20, handF: [20, 2], handB: [18, 8], weapon: 86, fx: { circle: 0.9, aura: 0.8, flash: true } },
      { x: 4, y: 5, lean: 20, handF: [20, 3], handB: [18, 9], weapon: 86, fx: { circle: 0.7, aura: 0.6, flash: true } },
      { x: 3, y: 4, lean: 16, handF: [17, 5], handB: [16, 11], weapon: 64, fx: { circle: 0.5, aura: 0.4 } },
      { x: 2, y: 3, lean: 12, handF: [14, 6], handB: [14, 13], weapon: 42, fx: { circle: 0.3, aura: 0.2 } },
      { x: 1, y: 3, lean: 10, handF: [12, 7], handB: [13, 14], weapon: 28, fx: { circle: 0.15 } },
      { handF: [10, 8], weapon: 20 },
    ],
  });

// ── Mage: mystic sword and wand ──────────────────────────────────────────────────────────────

const swordWand = (): Clips =>
  build({ ...FIGHT, y: 4, lean: 12, handF: [11, 10], handB: [10, 4], weapon: 70, weapon2: 50, wind: 0.2, front2: false }, {
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [6, 19], handB: [-2, 20 + wave(i, 6)], weapon: 150, weapon2: 170 }),
    battle: (i) => ({ y: 4 + wave(i, 6) * 2, handF: [11, 10 + wave(i, 6)], handB: [9, 3 - wave(i, 6)], weapon: 68 + wave(i, 6) * 5, weapon2: 45 }),
    move: (i) => ({ handF: [-4 + pump(i, 3), 14], handB: [8 - pump(i, 5), 10], weapon: -112 + pump(i, 3), weapon2: 80, behind: true }),
    // A wide rising-then-falling slash, the wand held high for balance.
    action: [
      { x: -1, y: 4, lean: -4, handF: [-4, 4], bendF: -1, handB: [10, -6], weapon: -100, weapon2: 30, behind: true },
      { x: -3, y: 5, lean: -12, handF: [-8, 2], bendF: -1, handB: [12, -8], weapon: -135, weapon2: 20, behind: true },
      { x: 4, y: 3, lean: 16, handF: [14, -6], handB: [4, 4], weapon: 40, weapon2: 60, fx: { smear: -135 } },
      { x: 8, y: 7, lean: 30, footF: [18, 0], footB: [-14, 0], handF: [20, 12], handB: [2, 8], weapon: 140, weapon2: 70, fx: { smear: 40, impact: true } },
      { x: 8, y: 8, lean: 32, footF: [18, 0], footB: [-14, 0], handF: [18, 16], handB: [2, 9], weapon: 162, weapon2: 72, fx: { smear: 140 } },
      { x: 7, y: 7, lean: 28, footF: [18, 0], footB: [-14, 0], handF: [18, 16], handB: [4, 8], weapon: 160, weapon2: 66 },
      { x: 3, y: 5, lean: 18, handF: [14, 12], handB: [8, 5], weapon: 110, weapon2: 55 },
      { handF: [11, 10], weapon: 72 },
    ],
    // Point the wand, gather a circle of light, then loose a burst while the sword cuts.
    skill: [
      { y: 3, lean: 6, handF: [4, 10], handB: [16, 2], weapon: -60, weapon2: 85, front2: true, behind: true, fx: { circle: 0.5, aura: 0.4 } },
      { y: 3, lean: 6, handF: [2, 10], handB: [18, 1], weapon: -70, weapon2: 88, front2: true, behind: true, fx: { circle: 0.8, aura: 0.7 } },
      { y: 3, lean: 6, handF: [0, 9], handB: [19, 0], weapon: -80, weapon2: 90, front2: true, behind: true, fx: { circle: 1, aura: 1 } },
      { x: 4, y: 4, lean: 18, handF: [16, 0], handB: [21, 2], weapon: 60, weapon2: 92, front2: true, fx: { smear: -80, circle: 1, aura: 1, flash: true } },
      { x: 7, y: 7, lean: 28, footF: [18, 0], footB: [-14, 0], handF: [20, 12], handB: [20, 4], weapon: 145, weapon2: 95, front2: true, fx: { smear: 60, impact: true, circle: 0.8, aura: 0.8 } },
      { x: 7, y: 8, lean: 30, footF: [18, 0], footB: [-14, 0], handF: [18, 16], handB: [18, 6], weapon: 160, weapon2: 98, front2: true, fx: { circle: 0.6, aura: 0.6 } },
      { x: 6, y: 7, lean: 26, footF: [18, 0], footB: [-14, 0], handF: [18, 16], handB: [14, 6], weapon: 160, weapon2: 80, fx: { circle: 0.4, aura: 0.4 } },
      { x: 4, y: 6, lean: 20, handF: [15, 13], handB: [10, 5], weapon: 120, weapon2: 60, fx: { circle: 0.2, aura: 0.2 } },
      { x: 2, y: 5, lean: 15, handF: [12, 11], handB: [10, 4], weapon: 85, weapon2: 52 },
      { handF: [11, 10], weapon: 72 },
    ],
  });

// ── Ranger: crossbow ─────────────────────────────────────────────────────────────────────────

const crossbow = (): Clips =>
  build({ ...FIGHT, y: 4, lean: 8, footF: [12, 0], footB: [-12, 0], handF: [9, 6], weapon: 92, wind: 0.2 }, {
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [7, 14 + wave(i, 6)], weapon: 150 }),
    battle: (i) => ({ y: 4 + wave(i, 6) * 1.5, handF: [9, 6 + wave(i, 6) * 0.6], weapon: 91 + wave(i, 6) * 2 }),
    move: (i) => ({ handF: [8, 10 + pump(i, 1)], weapon: 120 + pump(i, 3) }),
    // Shoulder, aim, loose: the bolt flies with a flash and the stock kicks.
    action: [
      { y: 4, lean: 6, handF: [9, 4], weapon: 90 },
      { y: 4, lean: 6, handF: [9, 4], weapon: 90 },
      { x: -2, y: 4, lean: 2, handF: [6, 3], weapon: 80, fx: { flash: true } },
      { x: -3, y: 4, lean: 0, handF: [5, 2], weapon: 76 },
      { x: -2, y: 4, lean: 3, handF: [7, 4], weapon: 84 },
      { x: -1, y: 4, lean: 5, handF: [8, 6], handB: [2, 12], weapon: 100 },
      { y: 4, lean: 7, handF: [9, 6], handB: [4, 10], weapon: 96 },
      { handF: [9, 6], weapon: 92 },
    ],
    // A rapid volley: three bolts in quick succession, each with a kick.
    skill: [
      { y: 6, lean: 10, footF: [14, 0], footB: [-14, 0], handF: [9, 4], weapon: 90, fx: { aura: 0.4 } },
      { y: 6, lean: 10, footF: [14, 0], footB: [-14, 0], handF: [9, 4], weapon: 90, fx: { aura: 0.7 } },
      { y: 6, lean: 10, footF: [14, 0], footB: [-14, 0], handF: [9, 4], weapon: 90, fx: { aura: 1 } },
      { x: -2, y: 6, lean: 4, footF: [14, 0], footB: [-14, 0], handF: [6, 3], weapon: 80, fx: { flash: true, aura: 1 } },
      { y: 6, lean: 9, footF: [14, 0], footB: [-14, 0], handF: [9, 4], weapon: 90, fx: { aura: 0.9 } },
      { x: -2, y: 6, lean: 4, footF: [14, 0], footB: [-14, 0], handF: [6, 3], weapon: 80, fx: { flash: true, aura: 0.8 } },
      { y: 6, lean: 9, footF: [14, 0], footB: [-14, 0], handF: [9, 4], weapon: 90, fx: { aura: 0.7 } },
      { x: -3, y: 6, lean: 2, footF: [14, 0], footB: [-14, 0], handF: [5, 2], weapon: 76, fx: { flash: true, aura: 0.5 } },
      { x: -1, y: 5, lean: 6, handF: [8, 5], weapon: 86, fx: { aura: 0.2 } },
      { handF: [9, 6], weapon: 92 },
    ],
  });

// ── Ranger: longbow ──────────────────────────────────────────────────────────────────────────

const longbow = (): Clips =>
  build({ ...FIGHT, y: 4, lean: 6, footF: [12, 0], footB: [-12, 0], handF: [17, 4], handB: [8, 6], weapon: 90, wind: 0.2 }, {
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [7, 16], handB: [-2, 21 + wave(i, 6)], weapon: 102 }),
    battle: (i) => ({ y: 4 + wave(i, 6) * 1.5, handF: [16, 5 + wave(i, 6)], handB: [8, 7], weapon: 88 + wave(i, 6) * 3 }),
    move: (i) => ({ handF: [10, 14], handB: [-6 - pump(i, 6), 15], weapon: 150 + pump(i, 3) }),
    // Draw to the cheek, loose, and let the string hand fly back.
    action: [
      { y: 4, lean: 4, handF: [18, 3], handB: [10, 4], weapon: 90, draw: true },
      { y: 4, lean: 2, handF: [19, 3], handB: [1, 0], weapon: 90, draw: true },
      { x: -1, y: 4, lean: 0, handF: [19, 3], handB: [-7, -2], weapon: 88, fx: { flash: true } },
      { x: -1, y: 4, lean: 0, handF: [19, 3], handB: [-9, -3], weapon: 88 },
      { y: 4, lean: 2, handF: [18, 4], handB: [-6, 2], weapon: 90 },
      { y: 4, lean: 4, handF: [17, 4], handB: [2, 6], weapon: 90 },
      { y: 4, lean: 6, handF: [17, 4], handB: [6, 6], weapon: 90 },
      { handF: [17, 4], weapon: 90 },
    ],
    // Aim at the sky and loose a volley that rains down.
    skill: [
      { y: 7, lean: -4, footF: [14, 0], footB: [-14, 0], handF: [14, -8], handB: [8, -2], weapon: 42, draw: true, fx: { aura: 0.4 } },
      { y: 8, lean: -10, footF: [14, 0], footB: [-14, 0], handF: [13, -12], handB: [0, -2], weapon: 36, draw: true, fx: { aura: 0.7 } },
      { y: 8, lean: -12, footF: [14, 0], footB: [-14, 0], handF: [12, -13], handB: [-2, -3], weapon: 34, draw: true, fx: { aura: 1 } },
      { y: 8, lean: -12, footF: [14, 0], footB: [-14, 0], handF: [12, -13], handB: [-9, -5], weapon: 34, fx: { flash: true, aura: 1 } },
      { y: 8, lean: -10, footF: [14, 0], footB: [-14, 0], handF: [13, -12], handB: [2, -3], weapon: 36, draw: true, fx: { aura: 0.9 } },
      { y: 8, lean: -10, footF: [14, 0], footB: [-14, 0], handF: [13, -12], handB: [-8, -5], weapon: 36, fx: { flash: true, aura: 0.8 } },
      { y: 7, lean: -6, footF: [14, 0], footB: [-14, 0], handF: [14, -9], handB: [-6, -2], weapon: 42, fx: { aura: 0.6 } },
      { y: 6, lean: 0, handF: [16, -2], handB: [2, 2], weapon: 65, fx: { aura: 0.4 } },
      { y: 5, lean: 4, handF: [17, 3], handB: [6, 5], weapon: 84, fx: { aura: 0.2 } },
      { handF: [17, 4], weapon: 90 },
    ],
  });

// ── Duelist: halberd ─────────────────────────────────────────────────────────────────────────

const halberd = (): Clips =>
  build({ ...FIGHT, handF: [10, 10], weapon: 72, wind: 0.2 }, {
    // Planted upright beside him.
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [8, 8 + wave(i, 6)], handB: [-2, 21], weapon: 4 }),
    battle: (i) => ({ y: 5 + wave(i, 6) * 2, handF: [10, 10 + wave(i, 6)], weapon: 70 + wave(i, 6) * 5 }),
    move: (i) => ({ handF: [9 + pump(i, 1), 12], weapon: 96 + pump(i, 3) }),
    // Coil back and drive a sweeping lunge through everything in front.
    action: [
      { x: -2, y: 5, lean: -2, handF: [2, 10], weapon: 45 },
      { x: -4, y: 6, lean: -10, footF: [12, 0], footB: [-15, 0], handF: [-4, 8], weapon: 28 },
      { x: 5, y: 4, lean: 20, footF: [18, 0], footB: [-15, 0], handF: [18, 4], weapon: 88, wind: 0.6, fx: { smear: 28 } },
      { x: 10, y: 7, lean: 30, footF: [21, 0], footB: [-16, 0], handF: [24, 8], weapon: 108, wind: 0.7, fx: { smear: 88, impact: true, dust: true } },
      { x: 10, y: 8, lean: 30, footF: [21, 0], footB: [-16, 0], handF: [22, 10], weapon: 126, wind: 0.5, fx: { smear: 108 } },
      { x: 9, y: 8, lean: 28, footF: [21, 0], footB: [-16, 0], handF: [21, 11], weapon: 128, wind: 0.3 },
      { x: 4, y: 6, lean: 20, handF: [14, 10], weapon: 96 },
      { handF: [10, 10], weapon: 74 },
    ],
    // Spin the halberd overhead, round and round, and bring it crashing down.
    skill: [
      { y: 7, lean: 4, handF: [4, 4], weapon: 10, fx: { aura: 0.4 } },
      { y: 8, lean: 0, handF: [2, -4], weapon: -40, behind: true, fx: { aura: 0.7 } },
      { y: 8, lean: -4, handF: [0, -10], weapon: -90, behind: true, fx: { aura: 1 } },
      { y: 6, lean: 4, handF: [6, -12], weapon: 0, fx: { smear: -90, aura: 1 } },
      { y: 6, lean: 6, handF: [10, -10], weapon: 90, fx: { smear: 0, aura: 1 } },
      { y: 6, lean: 2, handF: [2, -12], weapon: -170, behind: true, fx: { smear: -270, aura: 0.9 } },
      { y: 6, lean: 4, handF: [6, -12], weapon: -60, behind: true, fx: { smear: -170, aura: 0.8 } },
      { x: 9, y: 10, lean: 34, footF: [20, 0], footB: [-15, 0], handF: [20, 12], weapon: 150, wind: 0.6, fx: { smear: -60, impact: true, quake: true, aura: 0.6 } },
      { x: 5, y: 7, lean: 24, handF: [14, 11], weapon: 110, fx: { aura: 0.2 } },
      { handF: [10, 10], weapon: 74 },
    ],
  });

// ── Duelist: twin blades ─────────────────────────────────────────────────────────────────────

const twinBlades = (): Clips =>
  build({ ...FIGHT, y: 6, lean: 18, handF: [12, 9], handB: [6, 4], weapon: 75, weapon2: 40, wind: 0.2 }, {
    idle: (i) => ({ ...STAND, y: 1 + wave(i, 6), handF: [6, 20], handB: [-2, 21 + wave(i, 6)], weapon: 160, weapon2: 170 }),
    battle: (i) => ({ y: 6 + wave(i, 6) * 2.5, handF: [12, 9 + wave(i, 6)], handB: [6, 4 - wave(i, 6)], weapon: 72 + wave(i, 6) * 6, weapon2: 38 + wave(i, 6) * 6 }),
    // Arms swept back, blades trailing: a ninja's sprint.
    move: (i) => ({ lean: 32, handF: [-8 + pump(i, 2), 14], handB: [-10 - pump(i, 2), 12], bendF: -1, weapon: -100 + pump(i, 3), weapon2: -105, behind: true }),
    // Cross both blades, then cut with one and the other.
    action: [
      { x: -1, y: 6, lean: 8, handF: [2, 2], handB: [8, 2], weapon: -40, weapon2: -10, front2: true },
      { x: -3, y: 7, lean: 2, handF: [-2, 0], handB: [6, -2], weapon: -60, weapon2: -30, front2: true },
      { x: 5, y: 5, lean: 24, handF: [20, 10], handB: [6, -2], weapon: 150, weapon2: -30, fx: { smear: -60 } },
      { x: 8, y: 7, lean: 30, handF: [18, 14], handB: [20, 6], weapon: 160, weapon2: 120, front2: true, fx: { smear2: -30, impact: true } },
      { x: 9, y: 8, lean: 32, handF: [16, 16], handB: [20, 10], weapon: 165, weapon2: 150, front2: true, fx: { smear2: 120 } },
      { x: 8, y: 8, lean: 30, handF: [16, 16], handB: [18, 11], weapon: 165, weapon2: 152, front2: true },
      { x: 4, y: 7, lean: 22, handF: [14, 12], handB: [10, 6], weapon: 110, weapon2: 80 },
      { handF: [12, 9], weapon: 78 },
    ],
    // A whirlwind: blades out wide, spinning through slash after slash.
    skill: [
      { y: 9, lean: 10, handF: [0, 6], handB: [10, 6], weapon: -80, weapon2: 100, front2: true, behind: true, fx: { aura: 0.4 } },
      { y: 10, lean: 8, handF: [-2, 6], handB: [12, 6], weapon: -90, weapon2: 95, front2: true, behind: true, fx: { aura: 0.7 } },
      { y: 11, lean: 6, handF: [-4, 6], handB: [14, 6], weapon: -95, weapon2: 92, front2: true, behind: true, fx: { aura: 1, dust: true } },
      { x: 3, y: 6, lean: 14, handF: [20, 4], handB: [-6, 6], weapon: 95, weapon2: -95, fx: { smear: -95, smear2: 92, aura: 1 } },
      { x: 3, y: 6, lean: 10, handF: [-6, 6], handB: [20, 4], weapon: -95, weapon2: 95, behind: true, front2: true, fx: { smear: 95, smear2: -95, aura: 1 } },
      { x: 3, y: 6, lean: 14, handF: [20, 4], handB: [-6, 6], weapon: 95, weapon2: -95, fx: { smear: -95, smear2: 95, aura: 0.9, dust: true } },
      { x: 3, y: 6, lean: 10, handF: [-6, 6], handB: [20, 4], weapon: -95, weapon2: 95, behind: true, front2: true, fx: { smear: 95, smear2: -95, aura: 0.8 } },
      { x: 8, y: 8, lean: 30, handF: [18, 14], handB: [20, 8], weapon: 155, weapon2: 140, front2: true, fx: { smear: -95, impact: true, aura: 0.6 } },
      { x: 4, y: 7, lean: 22, handF: [14, 12], handB: [10, 6], weapon: 110, weapon2: 80, fx: { aura: 0.2 } },
      { handF: [12, 9], weapon: 78 },
    ],
  });

const MOVESETS: Record<Moveset, () => Clips> = { greatsword, battleaxe, staff, swordWand, crossbow, longbow, halberd, twinBlades };

/** Every frame's pose, clip by clip, for a weapon style. */
export function heroClips(moveset: Moveset): Clips {
  return MOVESETS[moveset]();
}
