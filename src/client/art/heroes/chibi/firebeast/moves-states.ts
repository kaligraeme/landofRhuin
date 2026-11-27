/**
 * The Firebeast's states, in the chibi pose format (rig.ts, ChibiPose) with its own `fire`
 * (fire.ts `BeastPose`). It takes no damage from monsters, so the game will not normally show the
 * first three; they exist because every chibi hero has every clip:
 *
 *   hurt     3  a flinch: thrown back, head snapped up, its fire flaring
 *   kneel    4  (loop) down on one knee, a fist planted on the floor, the other arm on the raised
 *               knee, heaving, its fire burning low and smoking
 *   ko       6  (hold) a collapse into embers: it staggers, drops to its knees and slumps forward
 *               onto the floor, its fire dying to embers and smoke
 *   victory  8  (hold) a roar: it rises up out of its crouch, arms flung wide, and roars at the sky
 *               in a burst of flame and a gold starburst, then stands blazing, fists clenched
 */
import type { FxContext } from '../rig.js';
import { type BeastPose, pillar, smoke } from './fire.js';
import { AT_EASE, beast, both, fromReady, jaws, READY, settle } from './moves-core.js';

// ── Hurt ─────────────────────────────────────────────────────────────────────────────────────

const hurt: BeastPose[] = [
  beast(READY, { x: -4, y: 6, lean: 10, twist: -10, tilt: -8, head: -6, look: -8, footF: [11, 0, 8], footB: [-10, -2, 7.4], handF: [8, 14, 14], handB: [-2, 10, 17], weapon: 120, weaponB: 160, face: 'hurt', wind: -0.6, lift: 0.5, sway: -0.5, phase: 0.2, fire: 1.4 }),
  beast(READY, { x: -6, y: 7, lean: 18, twist: -8, tilt: -4, head: -12, look: -4, footF: [11, 0, 8], footB: [-11, 0, 7.4], handF: [10, 13, 13], handB: [4, 14, 14], weapon: 100, weaponB: 120, face: 'hurt', wind: -0.2, lift: 0.3, sway: -0.3, phase: 0.4, fire: 1.2 }),
  settle(beast(READY, { x: -3, y: 7, lean: 26, twist: -6 }), 0.6, { face: 'grit', phase: 0.6 }),
];

// ── Kneel ────────────────────────────────────────────────────────────────────────────────────

/**
 * Down on its left knee (the far one side on), the right foot planted ahead, its right fist on
 * the floor in front of it and the left arm across the raised knee; head low, its fire burning low.
 */
const KNELT: BeastPose = {
  x: 0,
  y: 16,
  lean: 54,
  twist: 6,
  tilt: 4,
  head: -34,
  look: 6,
  footF: [10, 0, 8.4],
  footB: [-12, 0, 7],
  kneel: 'B',
  handF: [14, 40, 15],
  handB: [10, 22, 8],
  weapon: 150,
  weaponB: 170,
  face: 'grit',
  wind: 0.05,
  fire: 0.6,
};

const kneel = Array.from({ length: 4 }, (_, i): BeastPose => {
  const b = Math.sin((Math.PI * 2 * i) / 4) * 0.5 + 0.5;
  return beast(KNELT, {
    y: 16 + b,
    lean: 54 + b * 4,
    head: -34 + b * 4,
    handF: [8 - b * 2, 36 - b * 1.6, 15],
    handB: [10 - b * 2, 22 - b * 1.4, 8],
    phase: i / 4,
    sway: (b - 0.5) * 0.2,
    face: i === 1 ? 'shout' : 'grit',
    fire: 0.55 + b * 0.15,
    fx: { extra: (x: FxContext) => smoke(x, 0.35) },
  });
});

// ── Knocked out ──────────────────────────────────────────────────────────────────────────────

/**
 * Down on its front, turned so it lies across the screen in every view, its head on one side
 * (the face toward the viewer), arms flung out ahead of it and the tail limp behind.
 */
const DOWN: BeastPose = {
  x: 8,
  y: 26,
  lean: 84,
  twist: 0,
  tilt: 0,
  turn: -55,
  head: -12,
  look: 55,
  footF: [-22, 0, 9],
  footB: [-20, -1, 4],
  handF: [24, 30, 16],
  handB: [26, 30, 0],
  weapon: 100,
  weaponB: 100,
  face: 'closed',
  wind: 0,
  lift: -0.4,
  fire: 0.15,
};

/** Embers scattered where it lands (`k` 0 to 1 as they fly and fall), and its fire guttering into smoke. */
const gutter =
  (k: number, s: number) =>
  (x: FxContext): void => {
    smoke(x, s);
    if (k <= 0) return;
    const { c, rig, proj, hash } = x;
    const g = rig.pelvis.o;
    for (let i = 0; i < 16; i++) {
      const th = hash(i, 431) * Math.PI * 2;
      const d = (8 + hash(i, 432) * 22) * k;
      const up = (4 + hash(i, 433) * 14) * Math.sin(Math.PI * Math.min(1, k * 1.1));
      const p = proj([g[0] + 10 + Math.cos(th) * d, 1 + up, g[2] + Math.sin(th) * d]);
      const a = 1 - k * 0.5;
      c.glow(p[0], p[1], i % 3 ? [255, 176, 60] : [255, 240, 190], a);
      c.glow(p[0], p[1] + 1, [216, 64, 26], a * 0.7);
    }
  };

const ko: BeastPose[] = [
  // Stagger back, its fire flaring.
  beast(READY, { x: -4, y: 6, lean: 6, twist: -12, tilt: -6, head: -4, handF: [6, 18, 16], handB: [-2, 12, 17], weapon: 150, weaponB: 160, face: 'hurt', sway: -0.4, lift: 0.4, phase: 0.1, fire: 1.3 }),
  // Its legs give: down on both knees, arms hanging, the fire sinking.
  beast(READY, { x: -2, y: 17, lean: 30, twist: 0, head: 4, footF: [-11, 0, 7.4], footB: [-12, 0, 6.6], kneel: 'F', handF: [10, 30, 15], handB: [8, 30, 14], weapon: 170, weaponB: 170, face: 'hurt', wind: 0, phase: 0.25, fire: 0.9 }),
  // Slumping forward, a hand thrown out to catch itself.
  beast(DOWN, { x: 4, y: 20, lean: 58, turn: -25, head: -20, look: 20, footF: [-16, 0, 8], footB: [-17, 0, 5], handF: [20, 28, 15], handB: [16, 28, 6], face: 'hurt', lift: 0.3, phase: 0.4, fire: 0.6 }),
  // Down: embers burst from under it.
  beast(DOWN, { lean: 80, phase: 0.55, lift: 0.2, fire: 0.35, fx: { dust: 0.9, extra: gutter(0.35, 0.4) } }),
  beast(DOWN, { phase: 0.7, fire: 0.22, fx: { extra: gutter(0.75, 0.55) } }),
  beast(DOWN, { phase: 0.85, fx: { extra: gutter(0, 0.6) } }),
];

// ── Victory ──────────────────────────────────────────────────────────────────────────────────

/** Risen up, arms flung wide and head thrown back, roaring at the sky. */
const ROAR = beast(AT_EASE, { x: 0, y: 2, lean: -2, twist: 0, head: -34, look: 0, footF: [9, 0, 8.4], footB: [-8, 0, 7.6], handF: [0, 2, 26], handB: [0, 2, 26], elbowF: [-0.2, -1, 1], elbowB: [-0.2, -1, 1], weapon: 50, weaponB: 50, roll: 80, rollB: 80, face: 'shout', wind: 0.5, lift: 0.8, fire: 1.7 });
/** Standing tall and blazing after it, fists clenched by its sides, chin up. */
const PROUD = beast(AT_EASE, { x: 0, y: 2, lean: 14, twist: 6, head: -24, look: 8, footF: [8, 0, 8.4], footB: [-7, 0, 7.4], handF: [4, 18, 17], handB: [2, 18, 16], elbowF: [-0.3, -1, 1], elbowB: [-0.3, -1, 1], weapon: 150, weaponB: 150, roll: 20, rollB: 20, face: 'grit', wind: 0.4, lift: 0.4, fire: 1.5 });

/** Flames bursting up round its feet as it roars, `k` their height (fire.ts `pillar`, burst wide open). */
const ring =
  (k: number) =>
  (x: FxContext): void =>
    pillar(x, k, { open: 1, height: 90, feet: true });

const victory: BeastPose[] = [
  fromReady(beast(READY, { y: 10, lean: 40, head: -30, handF: [8, 20, 14], handB: [6, 20, 13], weapon: 170, weaponB: 170 }), 0.6, { phase: 0.05, face: 'grit' }),
  beast(ROAR, { y: 4, lean: 6, head: -26, phase: 0.18, fire: 1.5, fx: { aura: 0.5, extra: ring(0.4) } }),
  beast(ROAR, { phase: 0.3, fx: { rays: { k: 1, spin: 0 }, aura: 0.8, extra: both(ring(0.8), jaws(1, 24)) } }),
  beast(ROAR, { phase: 0.42, y: 1.5, fx: { rays: { k: 1, spin: 10 }, aura: 0.8, extra: both(ring(0.65), jaws(1, 28)) } }),
  beast(ROAR, { phase: 0.55, fx: { rays: { k: 0.7, spin: 20 }, aura: 0.6, extra: both(ring(0.4), jaws(0.6, 22)) } }),
  beast(PROUD, { y: 2.5, lean: 10, phase: 0.68, fx: { rays: { k: 0.3, spin: 28 }, aura: 0.3, extra: ring(0.18) } }),
  beast(PROUD, { phase: 0.82 }),
  beast(PROUD, { phase: 0.95 }),
];

/** The state clips' poses, by clip. */
export const STATE_MOVES = { hurt, kneel, ko, victory };
