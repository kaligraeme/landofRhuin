/**
 * The Firebeast's skill clips, in the chibi pose format (rig.ts, ChibiPose) with its own `fire`
 * (fire.ts `BeastPose`). While the form lasts it can only strike, so the game plays only two of
 * these: `ult` once as the form begins and `cast` once as it ends. The rest exist because every
 * chibi hero has every clip, and are its roars and flourishes:
 *
 *   special  6  (1 wind-up) a roar that breathes a gout of fire ahead of it
 *   q        8  (1 wind-up) a pounce: a crouch, a low leap with both claws ahead in a trail of fiery
 *               afterimages, the claws raked into the floor as it lands and skids
 *   e        8  (2 wind-up) both fists raised and hammered into the floor: fire erupts round them
 *               with a shockwave
 *   r        8  (1 wind-up) a flexing roar: arms bent up and out, the fire blazing high and a gold
 *               starburst of rays round it
 *   ult      7  it emerges, in the 0.4 s the game gives it: the column of fire the Warden's own
 *               `ult` ended on, then the column bursting open round the beast, which roars with
 *               its arms flung wide, flames flung out round it and a shockwave round its feet;
 *               then one frame toward its battle stance
 *   cast     8  it collapses back into flame, in the 0.45 s the game gives it: flames rising off a
 *               ring round its feet, climbing it as it curls down, into that same column, which
 *               hides all of it (the game then swaps the Warden back in)
 *
 * The effects painters are fire.ts's (`column`, `flare`, `slash`) and the jaws' fire (moves-core.ts
 * `jaws`); the fire's level (`fire`) rises with every roar.
 */
import type { FxContext } from '../rig.js';
import { type BeastPose, column, flare } from './fire.js';
import { beast, blend, both, fromReady, jaws, READY, settle, swipe } from './moves-core.js';

/** A burst of flame from its chest, `k` 0 to 1 (fire.ts `flare`). */
const burst =
  (k: number, len = 46) =>
  (x: FxContext): void =>
    flare(x, [x.rig.chest.o[0] + x.rig.chest.u[0] * 20, x.rig.chest.o[1] + x.rig.chest.u[1] * 20, x.rig.chest.o[2]], k, { n: 14, len, skip: headSkip(x) });

/** Keeps a burst off the face. */
const headSkip = (x: FxContext): ((px: number, py: number) => boolean) => {
  const h = x.proj(x.rig.head.o);
  return (px, py) => Math.hypot(px - h[0], py - h[1]) < 12;
};

/** The column of fire (fire.ts `column`), `k` its height, `open` how far it has burst and `seed` its flicker. */
const blaze =
  (k: number, open = 0, seed = 0) =>
  (x: FxContext): void =>
    column(x, k, { open, seed });

// ── Special: a roar of fire ──────────────────────────────────────────────────────────────────

/** Reared back, chest swelling, drawing in breath. */
const BREATHE_IN = beast(READY, { x: -2, y: 5, lean: 12, twist: 0, head: -16, look: 0, handF: [6, 16, 16], handB: [4, 16, 15], weapon: 150, weaponB: 150, face: 'grit', wind: 0.2, lift: 0.3, fire: 1.3 });
/** Thrust forward, jaws wide, the gout of fire pouring ahead. */
const GOUT = beast(READY, { x: 4, y: 8, lean: 40, twist: 0, head: -38, look: 0, footF: [13, 0, 8.4], footB: [-10, 0, 7.4], handF: [2, 18, 18], handB: [0, 18, 17], weapon: 170, weaponB: 170, face: 'shout', wind: 0.7, fire: 1.5 });

const special: BeastPose[] = [
  fromReady(BREATHE_IN, 0.7, { phase: 0.05 }),
  beast(GOUT, { phase: 0.2, fx: { extra: jaws(1, 30) } }),
  beast(GOUT, { phase: 0.35, x: 3, fx: { extra: jaws(1, 40) } }),
  beast(GOUT, { phase: 0.5, x: 2, lean: 38, fx: { extra: jaws(0.75, 40) } }),
  settle(GOUT, 0.45, { phase: 0.65, fx: { extra: jaws(0.3, 24) } }),
  settle(GOUT, 0.85, { phase: 0.8 }),
];

// ── Q: a pounce ──────────────────────────────────────────────────────────────────────────────

const CROUCH = beast(READY, { x: -3, y: 14, lean: 42, twist: 0, head: -34, footF: [8, 0, 8], footB: [-11, 0, 7.4], handF: [2, 20, 15], handB: [0, 20, 14], weapon: 200, weaponB: 200, face: 'grit', wind: 0.3, fire: 1.3 });
const LEAP = beast(READY, { x: 6, y: -6, lean: 34, twist: 0, head: -30, footF: [-4, -9, 7], footB: [-12, -6, 7], handF: [22, 6, 12], handB: [20, 8, 11], weapon: 80, weaponB: 80, roll: 0, rollB: 0, yaw: 0, yawB: 0, face: 'shout', wind: 1, lift: 0.3, fire: 1.5 });
const LAND = beast(READY, { x: 10, y: 13, lean: 46, twist: 0, head: -36, footF: [16, 0, 8.6], footB: [-10, 0, 7.6], handF: [22, 26, 12], handB: [20, 26, 11], weapon: 160, weaponB: 160, face: 'shout', wind: 0.9, lift: 0.3, fire: 1.4 });

/** The top of the leap, and the landing that rakes both claws down from there into the floor. */
const FLIGHT = beast(LEAP, { x: 8, y: -6, phase: 0.35 });
const RAKED = beast(LAND, { phase: 0.5 });

const q: BeastPose[] = [
  fromReady(CROUCH, 0.75, { phase: 0.05 }),
  beast(LEAP, { y: -2, phase: 0.2, fx: { ghosts: { k: 0.9, n: 3, gap: 9 }, speed: 1 } }),
  beast(FLIGHT, { fx: { ghosts: { k: 0.8, n: 3, gap: 10 }, speed: 1 } }),
  beast(RAKED, { fx: { dust: 1, impact: 1, extra: both(swipe([FLIGHT, RAKED], 0.9, false, 14), swipe([FLIGHT, RAKED], 0.9, true, 14)) } }),
  beast(LAND, { x: 6, y: 12, phase: 0.65, wind: 0.6, fx: { dust: 0.8, ghosts: { k: 0.3, n: 1 } } }),
  settle(LAND, 0.4, { phase: 0.8, fx: { dust: 0.4 } }),
  settle(LAND, 0.72, { phase: 0.95 }),
  settle(LAND, 0.92, { phase: 1.1 }),
];

// ── E: a hammer blow into the floor ──────────────────────────────────────────────────────────

const RAISE = beast(READY, { x: -2, y: 3, lean: 4, twist: 0, head: -10, footF: [9, 0, 8], footB: [-9, 0, 7.4], handF: [-4, -8, 9], handB: [-4, -8, 9], weapon: -10, weaponB: -10, roll: 0, rollB: 0, yaw: 0, yawB: 0, face: 'shout', wind: 0.3, lift: 0.4, fire: 1.4 });
const HAMMER = beast(READY, { x: 4, y: 15, lean: 50, twist: 0, head: -38, footF: [13, 0, 9], footB: [-10, 0, 8], handF: [18, 32, 7], handB: [18, 32, 7], weapon: 175, weaponB: 175, roll: 0, rollB: 0, yaw: 0, yawB: 0, face: 'shout', wind: 0.6, lift: 0.5, fire: 1.6 });
/** Where its fists strike the floor. */
const fists = (x: FxContext) => [(x.rig.armR.end[0] + x.rig.armL.end[0]) / 2, 2, (x.rig.armR.end[2] + x.rig.armL.end[2]) / 2] as const;
const erupt =
  (k: number) =>
  (x: FxContext): void =>
    flare(x, [...fists(x)], k, { n: 12, len: 50 });

const e: BeastPose[] = [
  fromReady(RAISE, 0.6, { phase: 0.05 }),
  beast(RAISE, { y: 2, lean: 0, head: -8, handF: [-6, -10, 9], handB: [-6, -10, 9], weapon: -24, weaponB: -24, phase: 0.15, fx: { aura: 0.3 } }),
  beast(HAMMER, { phase: 0.3, fx: { impact: 1.4, shock: 0.05, dust: 1, extra: erupt(0.12) } }),
  beast(HAMMER, { y: 16, phase: 0.45, fx: { shock: 0.35, dust: 0.7, extra: erupt(0.4) } }),
  beast(HAMMER, { y: 15, lean: 46, phase: 0.6, fx: { shock: 0.65, extra: erupt(0.68) } }),
  settle(HAMMER, 0.35, { phase: 0.75, fx: { shock: 0.9, extra: erupt(0.9) } }),
  settle(HAMMER, 0.7, { phase: 0.9 }),
  settle(HAMMER, 0.92, { phase: 1.05 }),
];

// ── R: a flexing roar ────────────────────────────────────────────────────────────────────────

/** Upright, arms bent up and out with the fists clenched, the head thrown up in a roar. */
const FLEX = beast(READY, { x: 0, y: 4, lean: 6, twist: 0, head: -24, look: 0, footF: [9, 0, 8.4], footB: [-9, 0, 7.6], handF: [0, -6, 21], handB: [0, -6, 21], elbowF: [0, -1, 1], elbowB: [0, -1, 1], weapon: -10, weaponB: -10, roll: 40, rollB: 40, face: 'shout', wind: 0.4, lift: 0.7, fire: 1.6 });

const r: BeastPose[] = [
  fromReady(beast(FLEX, { y: 9, lean: 30, head: -28, handF: [8, 14, 16], handB: [6, 14, 15], weapon: 150, weaponB: 150, face: 'grit', lift: 0 }), 0.7, { phase: 0.05 }),
  beast(FLEX, { phase: 0.15, fx: { rays: { k: 0.6, spin: 0 }, aura: 0.5 } }),
  beast(FLEX, { phase: 0.3, y: 3, fx: { rays: { k: 1, spin: 8 }, aura: 0.8, extra: burst(0.2) } }),
  beast(FLEX, { phase: 0.45, y: 3, fx: { rays: { k: 1, spin: 16 }, aura: 0.8, extra: burst(0.5) } }),
  beast(FLEX, { phase: 0.6, y: 4, fx: { rays: { k: 0.7, spin: 24 }, aura: 0.6, extra: burst(0.8) } }),
  settle(FLEX, 0.4, { phase: 0.75, fx: { rays: { k: 0.3, spin: 30 }, aura: 0.3 } }),
  settle(FLEX, 0.75, { phase: 0.9 }),
  settle(FLEX, 0.93, { phase: 1.05 }),
];

// ── Ult: it emerges ──────────────────────────────────────────────────────────────────────────

/** Curled low inside the column, as the Warden was when the flames took him. */
const CURLED = beast(READY, { x: 0, y: 16, lean: 50, twist: 0, head: -10, footF: [8, 0, 8], footB: [-9, 0, 7.4], handF: [6, 26, 10], handB: [5, 26, 9], weapon: 180, weaponB: 180, face: 'closed', wind: 0, lift: 0.6, fire: 1.5 });
/** Risen out of it, arms flung wide and head thrown back in a roar. */
const EMERGE = beast(READY, { x: 0, y: 3, lean: 2, twist: 0, head: -26, look: 0, footF: [10, 0, 8.6], footB: [-9, 0, 7.8], handF: [2, 4, 26], handB: [2, 4, 26], elbowF: [-0.2, -1, 1], elbowB: [-0.2, -1, 1], weapon: 60, weaponB: 60, roll: 70, rollB: 70, face: 'shout', wind: 0.5, lift: 0.9, fire: 1.7 });

/** The roar's shockwave rolls out round its feet, not from under a claw. */
const UNDER: [number, number, number] = [0, 0, 0];

/**
 * Played in the 0.4 s the game gives the form to emerge (half of FormDef.emerge), about 57 ms a
 * frame: two frames of the Warden's column, one of it bursting open round the beast, the roar held
 * for three and one to settle toward the battle stance.
 */
const ult: BeastPose[] = [
  beast(CURLED, { phase: 0, fx: { extra: blaze(1, 0, 0) } }),
  beast(CURLED, { y: 13, lean: 42, head: -14, phase: 0.14, fx: { extra: blaze(1, 0, 1) } }),
  beast(blend(CURLED, EMERGE, 0.65), { phase: 0.28, face: 'shout', fx: { aura: 0.9, extra: blaze(1, 0.7, 2) } }),
  beast(EMERGE, { y: 4, phase: 0.42, fx: { shock: 0.12, shockAt: UNDER, rays: { k: 1, spin: 0 }, aura: 0.8, extra: both(blaze(0.9, 1, 3), burst(0.18, 56), jaws(0.8, 18)) } }),
  beast(EMERGE, { phase: 0.57, y: 2.5, fx: { shock: 0.45, shockAt: UNDER, rays: { k: 1, spin: 10 }, aura: 0.7, extra: both(burst(0.5, 56), jaws(0.8, 18)) } }),
  beast(EMERGE, { phase: 0.71, y: 3.5, lift: 0.7, fx: { shock: 0.8, shockAt: UNDER, rays: { k: 0.6, spin: 20 }, aura: 0.5, extra: burst(0.82, 56) } }),
  settle(EMERGE, 0.85, { phase: 0.86 }),
];

// ── Cast: it collapses into flame ────────────────────────────────────────────────────────────

/**
 * Played in the 0.45 s the game gives the form to collapse (FORM_COLLAPSE): flames already rising
 * off a ring round its feet in the first frame, climbing it as it curls down, and from the sixth
 * frame the Warden's column, which hides all of it.
 */
const cast: BeastPose[] = [
  fromReady(beast(CURLED, { face: 'grit', y: 10, lean: 40, lift: 0.2, fire: 1.4 }), 0.45, { phase: 0.05, fx: { extra: blaze(0.3, 0, 10) } }),
  fromReady(beast(CURLED, { face: 'grit', lift: 0.3 }), 0.8, { phase: 0.15, fx: { extra: blaze(0.46, 0, 11) } }),
  beast(CURLED, { y: 14, phase: 0.25, face: 'hurt', fx: { extra: blaze(0.6, 0, 12) } }),
  beast(CURLED, { phase: 0.35, fx: { extra: blaze(0.72, 0, 13) } }),
  beast(CURLED, { phase: 0.45, fx: { extra: blaze(0.84, 0, 14) } }),
  beast(CURLED, { phase: 0.55, fx: { extra: blaze(0.94, 0, 15) } }),
  beast(CURLED, { phase: 0.65, fx: { extra: blaze(1, 0, 16) } }),
  beast(CURLED, { phase: 0.75, fx: { extra: blaze(1, 0, 17) } }),
];

/** The skill clips' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
