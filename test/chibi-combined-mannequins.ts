/**
 * Two test mannequins that use the hair and cloth options and the gear options together on one
 * figure (not registered heroes), to check how they sort and interact:
 *
 *  - SWORD_WAND: the slim robed figure (chibi-mannequins.ts ROBED: long hair down her back, a lock
 *    over each shoulder, a cape and a robe-coat) with the slender one-handed sword in her right
 *    hand and the wand in her left (chibi-gear-mannequin.ts);
 *  - POLEARM: the lanky figure (LANKY: a high ponytail, a long scarf with two tails, a split skirt)
 *    with the winged halberd-lance in both hands, its grips along the haft set by each pose.
 *
 * Each has a stand, a run, a spin, a dash with afterimages, a thrust and a fall (and a cast and a
 * vault, which put the wand among the hair and the pole beside the scarf). Used by
 * chibi-combined.test.ts; a scratch script can paint them into contact sheets.
 */
import { hex } from '../src/client/art/heroes/paint.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';
import { HALBERD, SLENDER_SWORD, WAND } from './chibi-gear-mannequin.js';
import { FALL, LANKY, ROBED, RUN, SPIN, STAND } from './chibi-mannequins.js';

/** The slim robed figure with a sword and a wand. */
export const SWORD_WAND: ChibiDesign = { ...ROBED, id: 'mannequin-sword-wand-robed', weapon: SLENDER_SWORD, offhand: WAND, aura: { core: hex('#b98cff'), edge: hex('#bff4ff'), hot: hex('#fbf6ff') } };

/** The lanky figure with the halberd-lance in both hands. */
export const POLEARM: ChibiDesign = { ...LANKY, id: 'mannequin-polearm-lanky', weapon: HALBERD, aura: { core: hex('#6fe3c1'), edge: hex('#e4fff6'), hot: hex('#ffffff') } };

// ── Sword and wand ───────────────────────────────────────────────────────────────────────────

/** Standing at ease: the sword hanging point down at her right, the wand held low and forward in her left. */
const SW_STAND: ChibiPose = pose(STAND, { handB: [2, 13, 7.5], weaponB: 150, rollB: 12, yawB: 10, fx: { runeB: 0.1 } });

const SW_GUARD: ChibiPose = { x: 0, y: 4, lean: 8, twist: -6, head: 2, footF: [8, 0, 4.4], footB: [-8, 0, 4], handF: [7, 11, 8], weapon: 62, roll: 22, yaw: -6, handB: [3, 8, 9], weaponB: 25, rollB: 12, wind: 0.2, phase: 0.1, fx: { runeB: 0.2 } };

export const SWORD_WAND_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: [SW_STAND, pose(SW_STAND, { y: 1.4, phase: 0.5, sway: 0.15, face: 'closed' })],
  // Running, the sword trailing low behind her and the wand held forward and down.
  run: RUN.map((p, i) => ({ ...p, weaponB: 140 + Math.cos((2 * Math.PI * i) / 8) * 12, rollB: 10 })),
  // A full turn, both arms out, the wand mirroring the sword.
  spin: SPIN.map((p) => ({ ...p, weaponB: 90, yawB: 70 })),
  // A dash: the sword thrust ahead, the wand trailing, afterimages, a spiral of wind off the point and a skid.
  dash: [
    pose(SW_GUARD, { x: 4, y: 5, lean: 22, twist: -10, head: -4, face: 'grit', footF: [12, -3, 4.4], footB: [-14, 0, 4], handF: [12, 10, 6], weapon: 84, roll: 4, yaw: 0, handB: [-7, 12, 9], weaponB: 210, wind: 0.9, phase: 0.1, fx: { rune: 0.8, ghosts: { k: 0.6 }, speed: 0.5 } }),
    pose(SW_GUARD, { x: 6, y: 5, lean: 26, twist: -12, head: -6, face: 'grit', footF: [14, -4, 4.4], footB: [-16, 0, 4], handF: [14, 9, 5], weapon: 86, roll: 4, yaw: 0, handB: [-9, 12, 9], weaponB: 215, wind: 1.1, phase: 0.3, fx: { rune: 1, ghosts: { k: 1, n: 3 }, swirl: { k: 1, spin: 0.1 }, speed: 0.9, dust: 0.6 } }),
    pose(SW_GUARD, { x: 2, y: 7, lean: 8, twist: -6, head: 0, footF: [14, 0, 4.6], footB: [-10, 0, 4], handF: [11, 10, 7], weapon: 80, roll: 8, yaw: 0, handB: [-4, 11, 9], weaponB: 200, wind: 0.6, lift: 0.1, phase: 0.5, fx: { rune: 0.6, ghosts: { k: 0.3 }, dust: 1 } }),
  ],
  // A sword thrust: drawn back, driven forward, held.
  thrust: [
    pose(SW_GUARD, { x: -2, y: 5, lean: 2, twist: 18, head: 2, face: 'grit', footF: [10, 0, 4.4], footB: [-10, 0, 4], handF: [-4, 12, 8], weapon: 88, roll: 4, yaw: -4, handB: [8, 9, 8], weaponB: 40, wind: 0.2, phase: 0.2, fx: { rune: 0.5, runeB: 0.3 } }),
    pose(SW_GUARD, { x: 6, y: 7, lean: 20, twist: -18, head: 0, face: 'shout', footF: [17, 0, 4.6], footB: [-13, 0, 4], handF: [15, 9, 4], weapon: 88, roll: 2, yaw: 0, handB: [-6, 11, 9], weaponB: 200, wind: 0.7, phase: 0.35, fx: { rune: 1, swirl: { k: 0.8, spin: 0.05 }, impact: 0.6 } }),
    pose(SW_GUARD, { x: 5, y: 7, lean: 18, twist: -14, head: 0, face: 'grit', footF: [17, 0, 4.6], footB: [-13, 0, 4], handF: [14, 9, 4], weapon: 89, roll: 2, yaw: 0, handB: [-5, 11, 9], weaponB: 195, wind: 0.4, phase: 0.5, fx: { rune: 0.7, swirl: { k: 0.4, spin: 0.25 } } }),
  ],
  // The wand raised high beside her hair, a ward of runes round her, then lightning thrown forward.
  cast: [
    pose(SW_GUARD, { y: 2, lean: -3, twist: 4, head: -6, face: 'closed', footF: [5, 0, 4.4], footB: [-5, 0, 4], handF: [3, 14, 8], weapon: 168, roll: 0, yaw: 0, handB: [3, -5, 17], weaponB: -12, rollB: 14, wind: 0.3, lift: 0.4, phase: 0.5, fx: { runeB: 1, aura: 0.4, ward: { k: 1, spin: 18 } } }),
    pose(SW_GUARD, { x: 2, lean: 10, twist: 22, head: 0, look: -6, face: 'shout', footF: [11, 0, 4.4], footB: [-9, 0, 4], handF: [-4, 14, 9], weapon: -130, roll: 10, yaw: 0, handB: [13, 3, 3], weaponB: 88, rollB: 0, wind: 0.5, phase: 0.3, fx: { runeB: 1, lightning: { seed: 3 } } }),
  ],
  // Knocked down, the sword and the wand both let go.
  fall: FALL.map((p, i) => (i < 3 ? { ...p, weaponB: 170 } : { ...p, dropB: true, dropAtB: [-2, 1.5, -14] as const, weaponB: 100, rollB: -80 })),
};

// ── The halberd-lance ────────────────────────────────────────────────────────────────────────

/** The battle stance: the haft across his body, the point forward and up, the rear hand by the hip. */
const PL_STANCE: ChibiPose = { x: 0, y: 5, lean: 10, twist: -14, head: 3, footF: [12, 0, 5.2], footB: [-12, 0, 4.8], handF: [-2, 16, 5], weapon: 56, roll: 10, yaw: -32, grip: -6, grip2: 6, wind: 0.25, phase: 0.1 };

const STRIDE = (i: number): number => Math.cos((2 * Math.PI * i) / 8);

export const POLEARM_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: [PL_STANCE, pose(PL_STANCE, { y: 5.6, phase: 0.5, sway: 0.15, face: 'closed' })],
  // Running with the lance trailing low behind him in his right hand, the left arm pumping.
  run: RUN.map((p, i) => ({ ...p, handF: [-4 - STRIDE(i) * 2, 15, 8], handB: [2 + STRIDE(i) * 6, 12 - Math.abs(STRIDE(i)) * 2.5, 8], weapon: -108, roll: 0, yaw: -14, grip: -16 })),
  // Whirling it round him: the haft level, both hands near its middle, a ring of wind.
  spin: SPIN.map((p, i) => ({ ...p, y: 4, handF: [7, 12, 4], handB: undefined, weapon: 90, roll: 0, yaw: 88, grip: 6, grip2: -4, wind: 0.8, flare: 1, sway: -0.5, fx: { rune: 0.8, swirl: { k: 1, on: 'body' as const, spin: i / 8 } } })),
  // The charge, couched low: afterimages, wind off the point, speed lines, then the skid.
  dash: [
    pose(PL_STANCE, { x: 4, y: 7, lean: 20, twist: 12, head: -2, face: 'grit', footF: [14, -3, 5.2], footB: [-15, 0, 4.8], handF: [-4, 16, 4], weapon: 94, roll: 0, yaw: -10, grip: -12, grip2: 2, wind: 0.9, phase: 0.6, fx: { rune: 0.8, ghosts: { k: 0.6 }, speed: 0.6 } }),
    pose(PL_STANCE, { x: 6, y: 7, lean: 24, twist: 14, head: -2, face: 'grit', footF: [16, -3, 5.2], footB: [-17, 0, 4.8], handF: [-4, 16, 4], weapon: 96, roll: 0, yaw: -10, grip: -12, grip2: 2, wind: 1.1, phase: 0.8, fx: { rune: 1, ghosts: { k: 1, n: 3 }, swirl: { k: 1, spin: 0.4 }, speed: 1, dust: 0.8 } }),
    pose(PL_STANCE, { x: 2, y: 8, lean: 6, twist: 4, head: 0, footF: [16, 0, 5.4], footB: [-11, 0, 4.8], handF: [-3, 15, 5], weapon: 80, roll: 4, yaw: -18, grip: -10, grip2: 4, wind: 0.6, lift: 0.1, phase: 0.9, fx: { rune: 0.6, ghosts: { k: 0.3 }, dust: 1 } }),
  ],
  // A thrust: drawn back, then driving forward, the front (left) hand sliding up the haft.
  thrust: [
    pose(PL_STANCE, { x: -3, y: 6, lean: 4, twist: 14, head: 3, face: 'grit', footF: [12, 0, 5.2], footB: [-12, 0, 4.8], handF: [-10, 15, 5], weapon: 82, roll: 4, yaw: -14, grip: -14, grip2: -3, wind: 0.2, phase: 0.2 }),
    pose(PL_STANCE, { x: 6, y: 8, lean: 20, twist: 16, head: 0, face: 'shout', footF: [19, 0, 5.4], footB: [-15, 0, 4.8], handF: [-1, 14, 4], weapon: 86, roll: 2, yaw: -10, grip: -14, grip2: 1, wind: 0.6, phase: 0.35, fx: { rune: 1, swirl: { k: 0.7, spin: 0.05 } } }),
    pose(PL_STANCE, { x: 10, y: 10, lean: 28, twist: 22, head: -2, face: 'shout', footF: [24, 0, 5.6], footB: [-16, 0, 4.8], handF: [-2, 12, 3], weapon: 88, roll: 0, yaw: -6, grip: -14, grip2: 4, wind: 1, phase: 0.5, fx: { rune: 1, swirl: { k: 1, spin: 0.25 }, impact: 0.7 } }),
  ],
  // The butt planted ahead and both hands high up the haft, then high in the vault gripping near the butt.
  vault: [
    pose(PL_STANCE, { x: 2, y: 2, lean: 14, twist: 6, head: -4, face: 'grit', footF: [6, -3, 5], footB: [-12, 0, 4.8], handF: [10, 2, 3], weapon: -28, roll: 6, yaw: 0, grip: 14, grip2: 8, wind: 0.5, lift: 0.4, phase: 0.6 }),
    pose(PL_STANCE, { x: 4, y: -24, lean: -8, twist: 6, head: -6, face: 'shout', footF: [6, -30, 5], footB: [-8, -22, 4.8], handF: [-4, -6, 8], weapon: -40, roll: 10, yaw: -6, grip: -33, grip2: -37, wind: 0.9, lift: 1, phase: 0.75, fx: { rune: 1, aura: 0.5 } }),
  ],
  // Knocked down, the halberd clattering down beside him.
  fall: FALL.map((p, i) => (i < 1 ? { ...p, handB: undefined, handF: [2, 13, 6], weapon: 30, roll: 0, yaw: -20, grip: -8 } : { ...p, drop: true, dropAt: [4, 1.5, 16] as const, weapon: 90, roll: 86, yaw: -4 })),
};

/** A frame big enough for the halberd's vault and the effects round the mannequins. */
export const COMBINED_BOX = { w: 320, h: 300, ax: 160, ay: 215 };

export const COMBINED: readonly { design: ChibiDesign; clips: Record<string, readonly ChibiPose[]> }[] = [
  { design: SWORD_WAND, clips: SWORD_WAND_CLIPS },
  { design: POLEARM, clips: POLEARM_CLIPS },
];
