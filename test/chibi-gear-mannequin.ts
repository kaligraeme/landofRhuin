/**
 * Test mannequins for the chibi engine's gear and effects (not registered heroes): the Dark
 * Knight's body and head carrying other things. One holds a slender one-handed sword with a wand
 * in the off hand; the other a long winged halberd-lance in both hands (spear point, axe blade,
 * back spike, flared lugs and a streaming ribbon). Their poses run through the grips along the
 * haft and the generic effects: a thrust with the front hand sliding up the haft, a spin with the
 * hands mid-haft, a plant and a vault strike gripping near the butt, a wand thrust throwing
 * lightning, a ward round the body and a dash with afterimages and a wind swirl. Used by
 * chibi-gear.test.ts, and handy for rendering contact sheets of new gear.
 */
import { hex } from '../src/client/art/heroes/paint.js';
import { blade } from '../src/client/art/heroes/chibi/blade.js';
import { DARK_KNIGHT } from '../src/client/art/heroes/chibi/darkKnight/design.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { pole, type PoleSpec } from '../src/client/art/heroes/chibi/pole.js';
import { flat, mat4 } from '../src/client/art/heroes/chibi/raster.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';
import { wand } from '../src/client/art/heroes/chibi/wand.js';

const STEEL = mat4('#f2f4fa', '#c8ccd8', '#8e94a6', '#5a5f70', '#262833', 0.05);
const EDGE = mat4('#ffffff', '#eef0f6', '#c4c8d4', '#8e94a4', '#2a2c36', 0.1);
const GOLD = mat4('#fff2c4', '#f2d68a', '#c8a050', '#7e6030', '#3e2c12', 0.05);
const VIOLET_GRIP = mat4('#8c66c8', '#5c3f96', '#3e2870', '#24164a', '#120a26');
const CRYSTAL = mat4('#f0e0ff', '#b880ff', '#8044e0', '#4c1c9c', '#24104e', 0.05);
const WAND_WOOD = mat4('#f4ece0', '#d8cab4', '#a89478', '#6e5c48', '#2e241a', 0.05);
const WOOD = mat4('#7a5446', '#553530', '#36201c', '#1e1210', '#0c0606', -0.05);
const RIBBON = mat4('#7fe0d4', '#3aa39a', '#1f7570', '#0f4744', '#072624', 0.05);
const LEATHER = mat4('#7c5642', '#5a3c2c', '#3e281c', '#25170f', '#140c07', -0.1);
const GUNMETAL = mat4('#c4c9d6', '#949aac', '#666c80', '#40455a', '#1a1c26', 0.02);
const DARK_STEEL = mat4('#a4aab8', '#767c8c', '#4a4e5e', '#2c2f3a', '#14151b');

/** A slender one-handed sword about 40 px long: a narrow double-edged blade with a violet fuller, a gold guard curving toward the blade and a crystal pommel. */
export const SLENDER_SWORD = blade({
  blade: [
    [3, 1.9],
    [3, -1.9],
    [30, -1.8],
    [37, -1.1],
    [41, 0],
    [37, 1.1],
    [30, 1.8],
  ],
  edge: { from: 6, width: 0.9, mat: EDGE },
  rune: { v: 0, from: 5, to: 32, rest: hex('#5e3a9a'), colour: hex('#b98cff'), glow: hex('#dcc4ff'), marks: [12, 20, 28] },
  steel: STEEL,
  guard: {
    pts: [
      [3.2, -1.4],
      [5.6, -5.6],
      [3.4, -6],
      [0.8, -3],
      [0, -1.6],
      [0, 1.6],
      [0.8, 3],
      [3.4, 6],
      [5.6, 5.6],
      [3.2, 1.4],
    ],
    mat: GOLD,
  },
  grip: { from: -6, to: 0.4, r: 1.3, mat: VIOLET_GRIP, wrap: flat(hex('#24164a')) },
  pommel: { u: -7.4, r: 1.8, mat: GOLD, gem: CRYSTAL, gemR: 1.2 },
  grip2: -4,
  reach: [6, 41],
});

/** A wand about 18 px: a pale rod with gold bands and a violet crystal at its tip. */
export const WAND = wand({
  rod: { from: -3, to: 11, r0: 1.45, r1: 1.1, mat: WAND_WOOD },
  bands: { at: [-1.6, 4.6, 9.8], mat: GOLD },
  knob: { r: 1.7, mat: GOLD },
  claws: { len: 2.4, mat: GOLD },
  crystal: { len: 6.5, w: 2.4, mat: CRYSTAL, glow: hex('#c8a0ff') },
});

/** A winged halberd-lance about 107 px long: a dark wooden haft with steel bands and a butt spike, a leaf point with a jade channel, an axe blade, a back spike, flared lugs and a teal ribbon. */
export const HALBERD_SPEC: PoleSpec = {
  haft: { from: -38, to: 44, r: 1.35, mat: WOOD },
  butt: { len: 4.5, r: 1.6, mat: DARK_STEEL, spike: true },
  bands: { at: [-30, 14, 36], len: 1.6, mat: DARK_STEEL },
  wraps: [{ from: -8, to: 6, mat: LEATHER, cord: flat(hex('#1a0e08')) }],
  metal: GUNMETAL,
  edge: EDGE,
  socket: { from: 40, to: 47, r: 1.8 },
  point: { from: 46, len: 20, w: 3.1 },
  axe: { from: 45, to: 52, out: 8, beard: 3.5 },
  spike: { at: 50, len: 6.5, w: 1.6, hook: 2 },
  lugs: { at: 42, len: 4.2, w: 1.1 },
  ribbon: { at: 39, len: 17, w: 1.5, mat: RIBBON },
  rune: { from: 49, to: 62, rest: hex('#2a7a64'), colour: hex('#6fe3c1'), glow: hex('#c8ffef'), marks: [53, 58] },
  grip2: -12,
};
export const HALBERD = pole(HALBERD_SPEC);

const VIOLET = { core: hex('#b98cff'), edge: hex('#bff4ff'), hot: hex('#fbf6ff') };
const JADE = { core: hex('#6fe3c1'), edge: hex('#e4fff6'), hot: hex('#ffffff') };

/** The Dark Knight's body and head without his coat and collar (so hands and gear show), with a sword and a wand. */
export const SPELLBLADE_MANNEQUIN: ChibiDesign = { ...DARK_KNIGHT, id: 'mannequin-sword-wand', headPieces: [], outfit: [], weapon: SLENDER_SWORD, offhand: WAND, aura: VIOLET };

/** The same body with the halberd in both hands. */
export const HALBERD_MANNEQUIN: ChibiDesign = { ...DARK_KNIGHT, id: 'mannequin-halberd', headPieces: [], outfit: [], weapon: HALBERD, aura: JADE };

// ── Sword and wand ───────────────────────────────────────────────────────────────────────────

const GUARD: ChibiPose = { x: 0, y: 4, lean: 8, twist: -6, head: 2, footF: [9, 0, 5], footB: [-9, 0, 4.6], handF: [8, 12, 9], weapon: 62, roll: 22, yaw: -6, handB: [3, 8, 10], weaponB: 25, rollB: 12, wind: 0.2, fx: { runeB: 0.2 } };

export const SWORD_WAND_POSES: Record<string, ChibiPose> = {
  guard: GUARD,
  // The wand thrust forward throwing lightning, the sword held back low.
  bolt: pose(GUARD, { x: 2, lean: 10, twist: 22, head: 0, look: -6, face: 'shout', footF: [12, 0, 5], footB: [-10, 0, 5], handF: [-5, 15, 10], weapon: -130, roll: 10, yaw: 0, handB: [15, 3, 3], weaponB: 88, rollB: 0, wind: 0.5, phase: 0.3, fx: { runeB: 1, lightning: { seed: 3 } } }),
  // The wand raised high, the ward of runes round her, the sword point down.
  ward: pose(GUARD, { y: 2, lean: -3, twist: 4, head: -6, face: 'closed', footF: [5, 0, 5], footB: [-5, 0, 4.6], handF: [3, 15, 9], weapon: 168, roll: 0, yaw: 0, handB: [-4, -8, 16], weaponB: -8, rollB: 6, wind: 0.3, lift: 0.4, phase: 0.5, fx: { runeB: 1, aura: 0.4, ward: { k: 1, spin: 18 } } }),
  dome: pose(GUARD, { y: 2, lean: -3, twist: 4, head: -6, footF: [5, 0, 5], footB: [-5, 0, 4.6], handF: [3, 15, 9], weapon: 168, roll: 0, yaw: 0, handB: [-4, -8, 16], weaponB: -8, rollB: 6, wind: 0.3, lift: 0.4, phase: 0.6, fx: { runeB: 1, ward: { k: 1, dome: true, spin: 10 } } }),
  // A dash: the sword thrust ahead, the wand trailing, afterimages and a spiral of wind off the point.
  dash: pose(GUARD, { x: 6, y: 5, lean: 26, twist: -12, head: -6, face: 'grit', footF: [14, -4, 5], footB: [-17, 0, 5], handF: [15, 9, 5], weapon: 86, roll: 4, yaw: 0, handB: [-9, 12, 10], weaponB: 215, rollB: 0, wind: 1, phase: 0.2, fx: { rune: 1, ghosts: { k: 1 }, swirl: { k: 1, spin: 0.1 }, speed: 0.8, dust: 0.6 } }),
  // A flick of the wand: its own smear.
  flick: pose(GUARD, { twist: 10, handF: [2, 14, 9], weapon: 120, handB: [12, 6, 6], weaponB: 120, rollB: 30, wind: 0.4, fx: { runeB: 0.8, smearB: { from: 10, roll: 30 } } }),
  // Both hands on the sword overhead, the wand still in the left hand, pointing back and down.
  overhead: pose(GUARD, { y: 3, lean: -4, twist: -6, head: -4, face: 'shout', handF: [-5, -8, 9], weapon: -22, roll: 12, yaw: -4, handB: undefined, grip: 0, weaponB: 200, rollB: 20, wind: 0.3, lift: 0.4, fx: { rune: 1, aura: 0.6 } }),
};

// ── Halberd ──────────────────────────────────────────────────────────────────────────────────

const STANCE: ChibiPose = { x: 0, y: 5, lean: 10, twist: -14, head: 3, footF: [11, 0, 5.4], footB: [-11, 0, 5], handF: [-2, 16, 5], weapon: 56, roll: 10, yaw: -32, grip: -6, grip2: 6, wind: 0.25, phase: 0.1 };

export const HALBERD_POSES: Record<string, ChibiPose> = {
  stance: STANCE,
  // A thrust in three beats: drawn back, then driving forward, the front (left) hand sliding up the haft as the rear one pushes.
  thrustBack: pose(STANCE, { x: -3, y: 6, lean: 4, twist: 14, head: 3, face: 'grit', footF: [12, 0, 5.4], footB: [-12, 0, 5], handF: [-10, 15, 5], weapon: 82, roll: 4, yaw: -14, grip: -14, grip2: -3, wind: 0.2, phase: 0.2 }),
  thrust: pose(STANCE, { x: 6, y: 8, lean: 20, twist: 16, head: 0, face: 'shout', footF: [19, 0, 5.6], footB: [-15, 0, 5], handF: [-1, 14, 4], weapon: 86, roll: 2, yaw: -10, grip: -14, grip2: 1, wind: 0.6, phase: 0.35, fx: { rune: 1, swirl: { k: 0.7, spin: 0.05 } } }),
  lunge: pose(STANCE, { x: 10, y: 10, lean: 28, twist: 22, head: -2, face: 'shout', footF: [24, 0, 5.8], footB: [-16, 0, 5], handF: [-2, 12, 3], weapon: 88, roll: 0, yaw: -6, grip: -14, grip2: 4, wind: 1, phase: 0.5, fx: { rune: 1, swirl: { k: 1, spin: 0.25 } } }),
  // A low, wide sweep round to his right, its level arc (a ring, which stays level) riding the head's reach.
  sweep: pose(STANCE, { x: 2, y: 9, lean: 16, twist: -20, head: 2, face: 'shout', footF: [14, 0, 6], footB: [-13, 0, 5.4], handF: [4, 15, 9], weapon: 100, roll: 0, yaw: 60, grip: -6, grip2: -12, wind: 0.7, flare: 0.4, phase: 0.4, fx: { rune: 1, ring: { from: -70, to: 62 }, dust: 0.6 } }),
  // A spin: the haft held level at its middle, both hands close, a ring of wind round him.
  spin: pose(STANCE, { x: 0, y: 3, lean: 4, twist: 0, turn: 120, head: 0, face: 'grit', footF: [7, -3, 5], footB: [-7, -1, 5], handF: [7, 12, 4], weapon: 90, roll: 0, yaw: 88, grip: 6, grip2: -4, wind: 0.8, flare: 1, phase: 0.3, fx: { rune: 0.8, swirl: { k: 1, on: 'body', spin: 0.15 } } }),
  // The butt planted ahead, both hands high up the haft, springing off.
  plant: pose(STANCE, { x: 2, y: 2, lean: 14, twist: 6, head: -4, face: 'grit', footF: [6, -3, 5], footB: [-12, 0, 5], handF: [10, 2, 3], weapon: -28, roll: 6, yaw: 0, grip: 14, grip2: 8, wind: 0.5, lift: 0.4, phase: 0.6 }),
  // High in the vault, gripping near the butt for the longest reach, the head swung up behind for the drive down.
  vault: pose(STANCE, { x: 4, y: -24, lean: -8, twist: 6, head: -6, face: 'shout', footF: [6, -30, 5], footB: [-8, -22, 5], handF: [-4, -6, 8], weapon: -40, roll: 10, yaw: -6, grip: -33, grip2: -37, wind: 0.9, lift: 1, phase: 0.75, fx: { rune: 1, aura: 0.5 } }),
  // A dash with the lance couched low: afterimages, wind off the point, speed lines.
  charge: pose(STANCE, { x: 6, y: 7, lean: 24, twist: 14, head: -2, face: 'grit', footF: [16, -3, 5.4], footB: [-17, 0, 5], handF: [-4, 16, 4], weapon: 96, roll: 0, yaw: -10, grip: -12, grip2: 2, wind: 1.1, phase: 0.8, fx: { rune: 1, ghosts: { k: 1, n: 3 }, swirl: { k: 1, spin: 0.4 }, speed: 1, dust: 0.8 } }),
};
