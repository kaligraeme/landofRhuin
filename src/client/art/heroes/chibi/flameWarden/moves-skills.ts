/**
 * The Flame Warden's skills, in the chibi pose format (rig.ts, ChibiPose), his fire painted by
 * fire.ts through `fx.extra`. Wind-up frames come first; none of his skills has a server wind-up,
 * so they take 0.06 s each and the rest share the clip's seconds. A weapon skill's clip is named
 * after its hotbar slot.
 *
 *   special   7  (1 wind-up) Blazing Crescent: coiled low with the blade blazing behind him, then
 *                a rising slash that throws a great crescent of flame off the blade; it flies about
 *                two tiles ahead, thinning, as the game's own crescent flies on
 *   q         8  (1 wind-up) Flashfire: a crouch, then a low dash in place, the blade trailing,
 *                afterimages in his fire behind him and a lane of fire on the floor, then a skid
 *                to a stop in a spray of embers
 *   e         9  (1 wind-up) Inferno Burst: the blade drawn back, then thrust ahead; a fireball
 *                blooms at its point, a pale violet shock ring flies out round it, and it burns out
 *                into smoke
 *   r        10  (1 wind-up) Kindle: hunched with his fists clenched, then thrown upright, a gold
 *                starburst of rays round him and a ring of fire at his feet, his hair and coat
 *                lifting in the heat
 *   ult      10  Firebeast: fire rises from a ring at his feet up his body as he roars, his arms
 *                flung wide, and engulfs him in a pillar of flame; the last frames are nearly all
 *                flame, and the game swaps him for the Firebeast after them
 *   cast      8  (2 wind-up) Bloodrush, Second Wind and the Elixir: the left hand drawn in and
 *                thrust out, a flare of fire in it ringed with green light of healing, motes rising
 *
 * The poses build on the battle stance (moves-core READY: the blade trailing low behind him);
 * clips that hand back to it end with `settle`, so the blade is already where the loop holds it.
 * His skill clips paint his hair lit by his fire (hero.ts).
 */
import { type ChibiPose, pose } from '../rig.js';
import { both, crescent, embers, fireArc, fireball, flames, flare, ghosts, kindle, pillar, trailFire } from './fire.js';
import { fromReady, plus, READY, settle, smear } from './moves-core.js';

const S = READY;

// ── Blazing Crescent ─────────────────────────────────────────────────────────────────────────

/** Coiled to throw it: low, the right shoulder drawn far back, the blade low behind him and ablaze. */
const SP_COIL = pose(S, { x: -3, y: 9, lean: 24, twist: 32, head: 6, look: -2, footF: [12, 0, 5.6], footB: [-13, 0, 5.2], handF: [-9, 15, 12], weapon: -128, roll: -4, yaw: -30, handB: [11, 6, 0], face: 'grit', wind: 0.3, lift: 0.2, phase: 0.1, fx: { rune: 1, extra: flames(1.1, 21) } });
/** The release: a rising slash, the blade swept up through his front to high ahead of him. */
const SP_THROW = pose(S, { x: 6, y: 4, lean: 4, twist: -22, head: -2, look: 0, footF: [16, 0, 5.8], footB: [-11, -1, 5.2], handF: [14, 1, 5], weapon: -326, roll: -20, yaw: 0, handB: [-2, 11, 12], face: 'shout', wind: 0.8, lift: 0.3, phase: 0.3, fx: { rune: 1, dust: 0.5 } });

const special: ChibiPose[] = [
  fromReady(SP_COIL, 0.6),
  plus(smear(SP_COIL, SP_THROW, 0.7, 1, 21), both(crescent(34, 1, 1), flames(1, 22))),
  plus(pose(SP_THROW, { y: 3.5, lean: 0, twist: -26, handF: [12, -2, 4], weapon: -346, wind: 0.95, lift: 0.4, phase: 0.45, fx: { rune: 0.8 } }), both(fireArc({ from: -220, roll: -20, yaw: 0, width: 0.5, alpha: 0.45 }, 22), crescent(58, 0.8, 2), flames(0.8, 23))),
  plus(pose(SP_THROW, { y: 4, lean: 4, twist: -20, handF: [11, 1, 6], weapon: 22, roll: -10, wind: 0.6, lift: 0.5, phase: 0.6, face: 'smirk', fx: { rune: 0.6 } }), both(crescent(82, 0.5, 3), flames(0.6, 24))),
  plus(pose(SP_THROW, { y: 5, lean: 10, twist: -10, handF: [9, 6, 8], weapon: 60, roll: 0, wind: 0.45, lift: 0.4, phase: 0.75, face: 'smirk', fx: { rune: 0.5 } }), both(crescent(100, 0.2, 4), flames(0.5, 25))),
  settle(pose(SP_THROW, { weapon: -160, roll: 0, yaw: -20 }), 0.6, { wind: 0.32, lift: 0.2, phase: 0.85, face: 'smirk', fx: { rune: 0.4, extra: flames(0.5, 26) } }),
  settle(pose(SP_THROW, { weapon: -140, roll: 0, yaw: -24 }), 0.9, { wind: 0.27, lift: 0.05, phase: 1, fx: { rune: 0.4, extra: flames(0.5, 27) } }),
];

// ── Flashfire ────────────────────────────────────────────────────────────────────────────────

/** The dash: bent low and flat out, the blade trailing level behind him, the left arm swept back. */
const DASH: ChibiPose = pose(S, { x: 10, y: 6, lean: 38, twist: 8, head: -18, look: -4, handF: [-8, 13, 11], weapon: -100, roll: 0, yaw: -30, handB: [-6, 11, 10], face: 'shout', wind: 1.1, lift: 0.1 });

/** The rush round him (strength k): afterimages in his fire, a lane of fire behind, speed lines. */
const rush = (k: number, seed: number): ChibiPose['fx'] => ({ speed: k, rune: 1, extra: both(ghosts(k, 12), trailFire(k, 76, seed), flames(0.9 * k, seed)) });

const flashfire: ChibiPose[] = [
  // Coiled low, weight forward over the front foot, the blade low behind him, flames at his feet.
  fromReady(pose(S, { x: -3, y: 11, lean: 30, twist: 14, head: -6, footF: [10, 0, 5.6], footB: [-14, 0, 5.2], handF: [-6, 14, 11], weapon: -118, roll: 0, yaw: -28, handB: [4, 12, 8], face: 'grit', wind: 0.3, fx: { dust: 0.5, rune: 0.8, extra: both(flames(0.8, 31), embers(0.8, 31, [0, 4, 0], 20, 8)) } }), 0.6),
  // Launch: the back leg drives off, the front knee comes through.
  pose(DASH, { x: 6, y: 6, footF: [15, -7, 5], footB: [-17, 0, 5], phase: 0.1, fx: { ...rush(0.7, 32), dust: 1 } }),
  // The dash: long, low strides barely touching the floor.
  pose(DASH, { y: 2, footF: [24, -4, 5], footB: [-15, -9, 5], phase: 0.3, fx: rush(1, 33) }),
  pose(DASH, { y: 6, footF: [9, 0, 5], footB: [12, -12, 5], phase: 0.5, fx: { ...rush(1, 34), dust: 0.6 } }),
  pose(DASH, { y: 2, footF: [-14, -10, 5], footB: [23, -4, 5], phase: 0.7, fx: rush(0.9, 35) }),
  // The skid: the lead leg thrust out, heel dug in, body thrown back, embers sprayed ahead.
  pose(S, { x: 12, y: 12, lean: -4, twist: 10, head: -2, look: -4, footF: [26, 0, 6], footB: [3, 0, 5.6], handF: [-4, 14, 12], weapon: -112, roll: 0, yaw: -32, handB: [9, 8, 5], face: 'grit', wind: 0, lift: 0.4, sway: 0.4, phase: 0.85, fx: { dust: 1, rune: 0.8, extra: both(trailFire(0.5, 76, 36), embers(1.3, 36, [30, 4, 0], 22, 14), flames(0.6, 36)) } }),
  pose(S, { x: 9, y: 8, lean: 10, twist: 12, head: 2, footF: [19, 0, 6], footB: [-5, 0, 5.6], handF: [-3, 15, 11], weapon: -118, roll: 0, yaw: -26, handB: [8, 9, 4], face: 'smirk', wind: 0.15, phase: 1, fx: { dust: 0.5, rune: 0.6, extra: both(trailFire(0.2, 76, 37), embers(0.7, 37, [30, 4, 0], 22, 8)) } }),
  settle(pose(S, { x: 4, y: 6 }), 0.85, { phase: 1.1, fx: { rune: 0.4, extra: flames(0.5, 38) } }),
];

// ── Inferno Burst ────────────────────────────────────────────────────────────────────────────

/** Where the fireball blooms: ahead of him at chest height, a little past the thrust's point. */
const BURST: [number, number, number] = [62, 30, -2];

/** The thrust: lunging, the blade driven straight ahead, the left hand flung back. */
const THRUST: ChibiPose = pose(S, { x: 8, y: 8, lean: 22, twist: -18, head: 0, look: -2, footF: [17, 0, 5.8], footB: [-12, 0, 5.2], handF: [16, 7, 2], weapon: 90, roll: 0, yaw: -4, handB: [-6, 10, 12], face: 'shout', wind: 0.6 });

const inferno: ChibiPose[] = [
  // Drawn back: the blade pulled back level by his hip, point ahead, the left hand aiming.
  fromReady(pose(S, { x: -2, y: 8, lean: 12, twist: 30, head: 2, look: -2, footF: [12, 0, 5.6], footB: [-12, 0, 5.2], handF: [-6, 12, 10], weapon: -266, roll: 0, yaw: -6, handB: [13, 6, 1], face: 'grit', wind: 0.3, fx: { rune: 1, extra: flames(1, 41) } }), 0.6),
  // The thrust: a spark of fire at the point, swelling.
  pose(THRUST, { phase: 0.15, fx: { rune: 1, dust: 0.6, impact: 0.8, extra: both(fireball(BURST, 0.25), flames(1, 42)) } }),
  pose(THRUST, { x: 9, y: 9, lean: 24, phase: 0.3, wind: 0.8, lift: 0.3, fx: { rune: 1, extra: both(fireball(BURST, 0.7, 0, 22, 0.2), flames(0.9, 43)) } }),
  pose(THRUST, { x: 9, y: 9, lean: 23, phase: 0.45, wind: 0.9, lift: 0.5, fx: { rune: 1, extra: both(fireball(BURST, 1, 0, 22, 0.45), flames(0.8, 44)) } }),
  pose(THRUST, { y: 8.5, lean: 20, phase: 0.6, wind: 0.7, lift: 0.5, face: 'grit', fx: { rune: 0.8, extra: both(fireball(BURST, 1, 0.3, 22, 0.7), flames(0.7, 45)) } }),
  pose(THRUST, { y: 8, lean: 18, twist: -12, handF: [14, 9, 4], phase: 0.75, wind: 0.5, lift: 0.4, face: 'smirk', fx: { rune: 0.6, extra: both(fireball(BURST, 1, 0.6, 22, 0.9), flames(0.6, 46)) } }),
  pose(THRUST, { y: 7, lean: 16, twist: -6, handF: [11, 11, 6], weapon: 110, phase: 0.85, wind: 0.4, lift: 0.3, face: 'smirk', fx: { rune: 0.5, extra: fireball(BURST, 1, 0.85, 22, 1) } }),
  settle(pose(THRUST, { weapon: -160, yaw: -20 }), 0.6, { phase: 0.95, fx: { rune: 0.4, extra: flames(0.5, 47) } }),
  settle(pose(THRUST, { weapon: -140, yaw: -24 }), 0.9, { phase: 1.05, fx: { rune: 0.4, extra: flames(0.5, 48) } }),
];

// ── Kindle ───────────────────────────────────────────────────────────────────────────────────

/** Thrown upright, chest out and head back, fists clenched by his hips, the blade pointing down. */
const BLAZE: ChibiPose = pose(S, { x: 0, y: 3, lean: -6, twist: 0, head: -10, look: 0, footF: [9, 0, 7.5], footB: [-9, 0, 7], handF: [2, 17, 12], weapon: -188, roll: -14, yaw: -10, handB: [2, 16, 12], elbowF: [-0.6, -0.6, 1], elbowB: [-0.6, -0.6, 1], face: 'shout', wind: 0.2, lift: 0.9 });

const kindleClip: ChibiPose[] = [
  // Hunched, gathering: fists clenched, head down, a glow at his feet.
  fromReady(pose(S, { x: 0, y: 9, lean: 22, twist: 4, head: 12, footF: [9, 0, 7.5], footB: [-9, 0, 7], handF: [4, 15, 9], weapon: -200, roll: -10, yaw: -10, handB: [5, 15, 7], elbowF: [-0.6, -0.6, 1], elbowB: [-0.6, -0.6, 1], face: 'grit', wind: 0.1, fx: { rune: 0.8, aura: 0.6, extra: both(flames(0.6, 51), kindle(0.2, 0, 51)) } }), 0.6),
  pose(BLAZE, { phase: 0.1, fx: { rune: 1, aura: 1, extra: both(kindle(1.2, 0, 52), flames(1, 52)) } }),
  pose(BLAZE, { y: 3.5, head: -11, phase: 0.2, lift: 1, fx: { rune: 1, aura: 1, extra: both(kindle(1.1, 6, 53), flames(1, 53)) } }),
  pose(BLAZE, { y: 3.5, head: -10, phase: 0.3, fx: { rune: 1, aura: 0.9, extra: both(kindle(1, 12, 54), flames(0.9, 54)) } }),
  pose(BLAZE, { y: 4, head: -8, phase: 0.4, lift: 0.8, fx: { rune: 1, aura: 0.85, extra: both(kindle(0.9, 18, 55), flames(0.9, 55)) } }),
  pose(BLAZE, { y: 4, head: -6, lean: -3, phase: 0.5, lift: 0.7, face: 'smirk', fx: { rune: 1, aura: 0.75, extra: both(kindle(0.75, 24, 56), flames(0.9, 56)) } }),
  pose(BLAZE, { y: 4.5, head: -4, lean: 0, phase: 0.6, lift: 0.55, face: 'smirk', fx: { rune: 1, aura: 0.6, extra: both(kindle(0.55, 30, 57), flames(0.9, 57)) } }),
  fromReady(pose(BLAZE, { lift: 0.4, face: 'smirk' }), 0.45, { phase: 0.75, fx: { rune: 0.9, aura: 0.45, extra: both(kindle(0.3, 36, 58), flames(0.9, 58)) } }),
  settle(BLAZE, 0.7, { phase: 0.9, fx: { rune: 0.8, aura: 0.15, extra: flames(0.8, 59) } }),
  settle(BLAZE, 0.95, { phase: 1, fx: { rune: 0.6, extra: flames(0.6, 60) } }),
];

// ── Firebeast ────────────────────────────────────────────────────────────────────────────────

/** Arms flung wide and head thrown back in a roar as the fire takes him. */
const ROAR: ChibiPose = pose(S, { x: 0, y: 4, lean: -10, twist: 0, head: -14, look: 0, footF: [9, 0, 8], footB: [-9, 0, 7.5], handF: [2, 6, 16], weapon: 120, roll: -40, yaw: -20, handB: [2, 6, 16], face: 'shout', wind: 0.1, lift: 1 });

const firebeast: ChibiPose[] = [
  // Doubled over, fists clenched, fire catching at his feet.
  pose(S, { x: 0, y: 10, lean: 28, twist: 0, head: 14, footF: [9, 0, 8], footB: [-9, 0, 7.5], handF: [4, 15, 9], weapon: 160, roll: -10, yaw: -10, handB: [5, 15, 7], face: 'grit', wind: 0, lift: 0.4, fx: { rune: 1, aura: 0.8, extra: both(pillar(0.15, 61), flames(1, 61)) } }),
  pose(S, { x: 0, y: 8, lean: 14, twist: 0, head: 4, footF: [9, 0, 8], footB: [-9, 0, 7.5], handF: [4, 10, 13], weapon: 140, roll: -30, yaw: -16, handB: [4, 10, 13], face: 'shout', lift: 0.7, phase: 0.1, fx: { rune: 1, aura: 1, extra: both(pillar(0.32, 62), flames(1, 62)) } }),
  pose(ROAR, { phase: 0.2, fx: { rune: 1, aura: 1, extra: pillar(0.48, 63) } }),
  pose(ROAR, { y: 3.5, head: -15, phase: 0.3, fx: { rune: 1, aura: 1, extra: pillar(0.62, 64) } }),
  pose(ROAR, { y: 3, head: -16, phase: 0.4, fx: { rune: 1, aura: 1, extra: pillar(0.76, 65) } }),
  pose(ROAR, { y: 3, head: -16, phase: 0.5, fx: { rune: 1, aura: 1, extra: pillar(0.88, 66) } }),
  pose(ROAR, { y: 2.5, head: -16, phase: 0.6, fx: { rune: 1, aura: 1, extra: pillar(1, 67) } }),
  pose(ROAR, { y: 2.5, head: -16, phase: 0.7, fx: { rune: 1, aura: 1, extra: pillar(1.12, 68) } }),
  pose(ROAR, { y: 2, head: -16, phase: 0.8, fx: { rune: 1, aura: 1, extra: pillar(1.22, 69) } }),
  pose(ROAR, { y: 2, head: -16, phase: 0.9, fx: { rune: 1, aura: 1, extra: pillar(1.3, 70) } }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** The left hand thrust out ahead of him, palm out, the flare burning in it; the blade lowered at his right. */
const RAISE: ChibiPose = pose(S, { x: 0, y: 5, lean: 6, twist: 18, head: -4, look: -2, footF: [11, 0, 6.5], footB: [-10, 0, 6], handF: [-1, 16, 11], weapon: -210, roll: -18, yaw: -10, handB: [15, 4, 3], elbowB: [-0.2, -0.6, 1], face: 'shout', wind: 0.25, lift: 0.5 });

const cast: ChibiPose[] = [
  // Drawn in: the left fist brought to his chest, fire kindling in it.
  fromReady(pose(S, { x: 0, y: 8, lean: 14, twist: 10, head: 6, footF: [10, 0, 6.5], footB: [-10, 0, 6], handF: [0, 15, 11], weapon: -190, roll: -10, yaw: -10, handB: [6, 6, -2], face: 'grit', wind: 0.15, fx: { rune: 0.6, extra: flare(0.3, 0, 0) } }), 0.6),
  pose(S, { x: 0, y: 7, lean: 8, twist: 4, head: 2, footF: [10, 0, 6.5], footB: [-10, 0, 6], handF: [1, 15, 11], weapon: -194, roll: -12, yaw: -10, handB: [10, 6, 4], face: 'grit', wind: 0.2, lift: 0.3, phase: 0.1, fx: { rune: 0.8, extra: flare(0.6, 0.05, 0.3) } }),
  // Raised: the flare bursts, ringed with green light; motes of healing rise round him.
  pose(RAISE, { phase: 0.2, fx: { rune: 1, impact: 0.6, extra: flare(1, 0.12) } }),
  pose(RAISE, { y: 3.5, head: -9, phase: 0.35, lift: 0.6, fx: { rune: 1, extra: flare(0.9, 0.2) } }),
  pose(RAISE, { y: 4, head: -6, phase: 0.5, lift: 0.5, face: 'smirk', fx: { rune: 0.8, extra: flare(0.7, 0.28) } }),
  pose(RAISE, { y: 5.5, head: -2, handB: [12, 7, 4], phase: 0.65, lift: 0.4, face: 'smirk', fx: { rune: 0.6, extra: flare(0.45, 0.36) } }),
  settle(RAISE, 0.6, { phase: 0.8, fx: { rune: 0.5, extra: both(flare(0.2, 0.44, 0.6), flames(0.5, 71)) } }),
  settle(RAISE, 0.92, { phase: 0.95, fx: { rune: 0.4, extra: flames(0.5, 72) } }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q: flashfire, e: inferno, r: kindleClip, ult: firebeast, cast };

