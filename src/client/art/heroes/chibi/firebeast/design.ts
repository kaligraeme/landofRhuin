/**
 * The Firebeast, as a chibi: the form the Flame Warden takes for his ultimate. An upright, hunched
 * and hulking beast on the same biped rig as the heroes but bigger (about 108 px tall): charred
 * obsidian hide and plates cracked with glowing magma seams, a great mane of living flame round
 * its head and shoulders (licking up off its crown), two obsidian horns sweeping out and up
 * through it (black against the flame), glowing white-gold eyes ringed in the Warden's amber,
 * fangs, long claws on both hands that glow like his blade, digitigrade legs on clawed feet, a
 * thick flaming tail, and a scrap of his crimson shirt knotted round its waist as a sash with a
 * tatter of his black coat hanging behind. Everything here is data for the chibi engine and the beast's own pieces
 * (fire.ts); its moves are in the moves-*.ts files beside it, and hero.ts puts it together.
 */
import { hex } from '../../paint.js';
import type { ChibiDesign, FaceStyle, Lock } from '../design.js';
import { plates, skirt } from '../pieces.js';
import { flat, type Hit, type Mat, mat4 } from '../raster.js';
import type { Build } from '../rig.js';
import { claws, cracks, horns, type ManeFlame, mane, paws, shoulderFlames, tail } from './fire.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

/** Charred obsidian hide: nearly black, with a glassy grey-violet highlight. */
const HIDE = { ...mat4('#6e647a', '#3a3340', '#221d27', '#121016', '#07050a', -0.1), gain: 0.85 };
/** The face and the muzzle, a step lighter so the features read on it. */
const FACE = mat4('#7e748a', '#463e4e', '#2a2430', '#17131b', '#07050a', 0);
/** Obsidian plates: glossier than the hide, parted from it by their own edges. */
const PLATE = { ...mat4('#8e84a0', '#4c4556', '#2e2836', '#19151e', '#07050a', -0.04), clear: 1.2 };
/** Horn: darker than the plates, so it stands out black against the flame of the mane. */
const HORN = { ...mat4('#7a7088', '#3e3746', '#241f2a', '#141118', '#07050a', 0.05), clear: 1.2 };
/** The plates' rims, catching the fire's light. */
const PLATE_RIM = mat4('#ffd27a', '#e0803a', '#9a4422', '#5a2414', '#1e0a06', 0.1);
/** Magma in the seams: flat, so it reads as light rather than a lit surface. */
const SEAM = flat('#ffa236');
const SEAM_HOT = flat('#ffe48a');
/** Living flame (the mane, the tail's fire): white-hot, gold, orange and an ember red, parted by a deep ember line. */
const FLAME = mat4('#fff7cf', '#ffd148', '#ff8f22', '#e04a18', '#7a1a06');
/** Claws: dark horn with a glowing inside edge and white-hot points, as the Warden's blade glows. */
const CLAW = mat4('#b4aabe', '#6e6578', '#463e50', '#262030', '#07050a', 0.1);
const CLAW_EDGE = flat('#ff9a32');
const CLAW_HOT = flat('#fff1b8');
/** The scrap of his crimson shirt knotted round its waist, and of his black coat with its ember lining. */
const CRIMSON = { ...mat4('#ff8a74', '#e84a3c', '#b0221e', '#64100e', '#2a0606', 0.14), gain: 0.7 };
/** The fold running round the sash. */
const SASH_FOLD = { ...CRIMSON, bias: -0.25 };
const COAT = { ...mat4('#6a6672', '#4a4650', '#2c2a32', '#18161c', '#0c0b0f', -0.05), gain: 0.6 };
const LINING = mat4('#ffc070', '#ff9a3c', '#d0601e', '#7a2e0c', '#3a1404');

/** The flame's own colours (fire.ts `burn` darkens them to embers as the fire dies). */
export const FLAME_TONES = [...FLAME.tones, FLAME.line];

/** The colours that glow (fire.ts `burn`): the flame's bright tones, the seams and the claws' edges. */
export const FIRE_HOT = [FLAME.tones[0], FLAME.tones[1], FLAME.tones[2], SEAM.tones[0], SEAM_HOT.tones[0], CLAW_EDGE.tones[0], CLAW_HOT.tones[0], PLATE_RIM.tones[0], PLATE_RIM.tones[1], hex('#fff6c8'), hex('#ffd25a'), hex('#ff9a1e')];

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/**
 * Bigger than a hero all through: long, heavy arms, a deep chest and broad shoulders standing high
 * round the neck, and digitigrade legs whose "ankle" is the hock, 10 px off the floor (the feet,
 * fire.ts `paws`, run from it down to the toes).
 */
const BUILD: Build = {
  hip: 35,
  thigh: 15,
  shin: 15,
  ankle: 10,
  torso: 28,
  neck: 3,
  shoulder: 13.5,
  hipWidth: 6.4,
  shoulderDrop: 4,
  upperArm: 13,
  foreArm: 14,
  headUp: 14.5,
};

// ── The head: a broad skull, a heavy muzzle, a mane of flame ─────────────────────────────────

const SHELL = { c: [-4, 2.8, 0] as const, r: [14.2, 13, 14.6] as const };

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], bob?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give: 0.8, belly: 0.3, bob });

/**
 * The mane's mass on the head: broad flames swept up and back off the brow and the crown, and
 * out from the cheeks, every one curling upward at its tip as fire does. The springy ones (`bob`)
 * toss as it moves.
 */
const LOCKS: Lock[] = [
  // Off the brow, swept back over the crown.
  L(0, 48, [-0.8, 0.45, 0], 11, 4, [-0.4, 0.3, 0], 0.4),
  L(-34, 44, [-0.7, 0.4, -0.6], 10, 3.8, [-0.4, 0.3, -0.1]),
  L(34, 44, [-0.7, 0.4, 0.6], 10, 3.8, [-0.4, 0.3, 0.1]),
  // The crown and the back, streaming back and rising at their tips.
  L(150, 60, [-1, 0.35, 0.35], 13, 4.6, [-0.2, 0.45, 0], 0.5),
  L(-150, 60, [-1, 0.35, -0.35], 13, 4.6, [-0.2, 0.45, 0], 0.5),
  L(180, 28, [-1, 0, 0], 13, 5, [-0.1, 0.5, 0]),
  // Out from the cheeks and the temples, framing the face and streaming back.
  L(96, 8, [-0.6, 0, 1], 11, 4.4, [-0.4, 0.4, 0]),
  L(-96, 8, [-0.6, 0, -1], 11, 4.4, [-0.4, 0.4, 0]),
  L(100, 38, [-0.6, 0.35, 1], 12, 4.4, [-0.4, 0.35, 0], 0.4),
  L(-100, 38, [-0.6, 0.35, -1], 12, 4.4, [-0.4, 0.35, 0], 0.4),
  // A ruff round the jaw at the sides, and down the back of the neck.
  L(100, -22, [-0.5, -0.45, 1], 10, 4, [-0.3, 0.6, 0.2]),
  L(-100, -22, [-0.5, -0.45, -1], 10, 4, [-0.3, 0.6, -0.2]),
  L(150, -10, [-1, -0.5, 0.4], 11, 4.4, [-0.2, 0.6, 0]),
  L(-150, -10, [-1, -0.5, -0.4], 11, 4.4, [-0.2, 0.6, 0]),
];

/** The mane's flickering tongues, round the back and sides of the head. */
const MANE: ManeFlame[] = [
  { yaw: 100, pitch: 30, len: 14, w: 4, back: 1 },
  { yaw: -100, pitch: 30, len: 14, w: 4, back: 1 },
  { yaw: 125, pitch: 55, len: 15, w: 4.6, back: 1.4 },
  { yaw: -125, pitch: 55, len: 15, w: 4.6, back: 1.4 },
  { yaw: 180, pitch: 50, len: 16, w: 5, back: 1.8 },
  { yaw: 140, pitch: 5, len: 16, w: 4.6, back: 1.6 },
  { yaw: -140, pitch: 5, len: 16, w: 4.6, back: 1.6 },
  { yaw: 180, pitch: 0, len: 15, w: 5, back: 2 },
  // Licking up off the crown, so the mane's outline burns upward seen from behind too.
  { yaw: 130, pitch: 68, len: 17, w: 4.4, back: 0.5 },
  { yaw: -130, pitch: 68, len: 17, w: 4.4, back: 0.5 },
  { yaw: 180, pitch: 78, len: 19, w: 4.8, back: 0.4 },
];

/**
 * The beast's face: slanted eyes glowing white-gold, ringed in the Warden's amber, under heavy
 * dark brows; its mouths are a fanged muzzle's (a snarl at rest, a roar wide open).
 */
const FACE_BEAST: FaceStyle = {
  eyes: {
    full: { rows: ['.KKKKK', 'KWWWhW', 'KiIIiK', '.KKKK.'], ax: 2, ay: 1 },
    mid: { rows: ['KKKKK', 'WWWhW', 'iIIiK', 'KKKK.'], ax: 1, ay: 1 },
    narrow: { rows: ['KKK', 'WhW', 'iIK'], ax: 1, ay: 1 },
    closed: { rows: ['KKKKK', '.KKK.'], ax: 2, ay: 0 },
    squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKK', 'KhWWi', 'KWWiI', '.KIIK'], ax: 2, ay: 1 },
  },
  brows: {
    full: { rows: ['...BBB', '.BBBB.', 'BB....'], ax: 2, ay: 1 },
    mid: { rows: ['..BBB', 'BBBB.', 'B....'], ax: 1, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
  browsUp: {
    full: { rows: ['BB....', '.BBBB.', '....BB'], ax: 2, ay: 1 },
    mid: { rows: ['BB...', '.BBBB'], ax: 1, ay: 1 },
    narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
  },
  mouths: {
    stern: { rows: ['MMMMMM', '.T..T.'], ax: 3, ay: 0 },
    shout: { rows: ['MMMMMM', 'MTrrTM', 'MrrrrM', 'MTrrTM', '.MMMM.'], ax: 3, ay: 0 },
    grit: { rows: ['MMMMMM', 'MTrrTM', 'MTMMTM', '.M..M.'], ax: 3, ay: 1 },
    hurt: { rows: ['.MMMM.', 'MrrrrM', '.MMMM.'], ax: 3, ay: 1 },
    closed: { rows: ['MMMMM'], ax: 2, ay: 0 },
    smirk: { rows: ['MMMMMM', '....T.'], ax: 3, ay: 0 },
  },
};

// ── The torso: obsidian plates cracked with magma, the crimson sash at the waist ─────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);
/** A crack's half-width in frame units: about a pixel across. */
const SEAM_W = 0.5;

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const [, u, r] = h.p;
  const yaw = deg(h);
  if (where === 'hips') return u > 4.2 ? CRIMSON : HIDE;
  if (u < 4) return null;
  // The sash, knotted round the waist, a fold running round it.
  if (u < 9.4) return Math.abs(u - 6.8 - r * 0.08) < 0.45 ? SASH_FOLD : CRIMSON;
  const ar = Math.abs(r);
  if (yaw < 80) {
    // The chest's two great plates and the belly's, parted by seams.
    if (ar < SEAM_W && u < 30) return SEAM_HOT;
    const pec = 18.5 + ar * 0.18;
    if (Math.abs(u - pec) < SEAM_W) return SEAM;
    if (u < pec && Math.abs(u - 13.2 - ar * 0.06) < SEAM_W * 0.9) return SEAM;
    // A crack across the right plate.
    if (u > pec && Math.abs(u - pec - 4 - (r - 4) * 0.7) < SEAM_W * 0.8 && r > 2 && r < 8) return SEAM;
    return u > pec ? PLATE : HIDE;
  }
  if (yaw > 125) {
    // Down the spine, plate by plate.
    if (ar < SEAM_W) return SEAM;
    for (const s of [13, 19, 25]) if (Math.abs(u - s - ar * 0.25) < SEAM_W && ar < 8) return SEAM;
    return ar < 8 ? PLATE : HIDE;
  }
  // The flanks: a jagged crack each side.
  if (Math.abs(u - 14 - Math.sin(yaw * 0.25) * 2) < SEAM_W * 0.8) return SEAM;
  return HIDE;
}

const FIREBEAST: ChibiDesign = {
  id: 'hero-firebeast',
  build: BUILD,
  head: {
    skin: FACE,
    hair: FLAME,
    skull: { c: [0, 0.5, 0], r: [11.4, 11, 12] },
    jaw: { c: [7, -5.2, 0], r: [9, 6, 7.4] },
    ear: { c: [-1, 1, 7], r: [0.5, 0.5, 0.5] },
    shell: SHELL,
    hairline: { faceYaw: 78, brow: 3.6, temple: -1, nape: -9, ear: -4 },
    locks: LOCKS,
    lockLine: hex('#7a1a06'),
    darkHair: true,
    whorl: { yaw: 180, pitch: 36, reach: 110, clumps: 9, twist: 0.45 },
    face: {
      eye: [10.3, 0, 4.7],
      lash: hex('#160606'),
      iris: hex('#ff9a1e'),
      irisLight: hex('#ffd25a'),
      white: hex('#fff6c8'),
      shine: hex('#ffffff'),
      brow: hex('#060407'),
      browUp: 3,
      mouth: hex('#0a0406'),
      mouthAt: [14.6, -7.4],
      noseAt: [15.6, -3],
      style: FACE_BEAST,
      rest: 'stern',
      irisDeep: hex('#c85a10'),
    },
  },
  body: {
    thigh: { mat: HIDE, r0: 7.4, r1: 5.4 },
    shin: { mat: HIDE, r0: 4.8, r1: 3.6 },
    boot: { mat: HIDE, r: 3.6, top: 0.2, toe: 6.5, heel: -1.5, sole: CLAW, foot: [3, 2.4] },
    knee: { mat: PLATE, r: 4.2 },
    upperArm: { mat: HIDE, r0: 7, r1: 5.8 },
    foreArm: { mat: HIDE, r0: 5.4, r1: 6.2 },
    cuff: { mat: PLATE, r: 7, at: 0.42 },
    hand: { mat: HIDE, r: 6.2, knuckle: SEAM_HOT },
    neck: { mat: HIDE, r: 6 },
    hips: [{ c: [0, 3.5, 0], r: [7.4, 6.4, 9.4], id: 1 }],
    chest: [
      { c: [1, 10, 0], r: [9, 7.6, 10.6], id: 1 },
      { c: [2, 20, 0], r: [12.2, 11, 14.4], id: 1 },
      // The hump of muscle behind the neck that hunches it.
      { c: [-3.5, 26, 0], r: [9, 7.5, 12], id: 1 },
    ],
    torso,
  },
  headPieces: [
    mane({ shell: SHELL, flames: MANE, mat: FLAME }),
    horns({
      path: [
        [7, 6.4, 8],
        [4.4, 9.4, 12.6],
        [1.4, 12.8, 15.6],
        [-0.4, 16.6, 16.6],
        [-0.6, 20.4, 16.4],
      ],
      r: [3.6, 1],
      mat: HORN,
      seam: SEAM,
      brow: { c: [9.6, 3.4, 4.4], r: [2.6, 1.5, 3.8] },
    }),
  ],
  outfit: [
    plates({
      side: 1,
      plates: [
        { c: [0, 2, 1.5], r: [8, 4.8, 7.4] },
        { c: [-0.3, -1.6, 2.8], r: [7, 4, 6.4] },
      ],
      mat: PLATE,
      rim: PLATE_RIM,
    }),
    plates({
      side: -1,
      plates: [
        { c: [0, 2, 1.5], r: [8, 4.8, 7.4] },
        { c: [-0.3, -1.6, 2.8], r: [7, 4, 6.4] },
      ],
      mat: PLATE,
      rim: PLATE_RIM,
    }),
    shoulderFlames({
      top: 28,
      ring: [9, 13.5],
      mat: FLAME,
      flames: [
        { at: 95, len: 13, w: 4.4 },
        { at: 135, len: 17, w: 5.2 },
        { at: 180, len: 19, w: 5.6 },
        { at: 225, len: 17, w: 5.2 },
        { at: 265, len: 13, w: 4.4 },
      ],
    }),
    skirt({
      outer: COAT,
      inner: LINING,
      waist: 5.4,
      ring: [7.6, 9.6],
      aline: 0.3,
      fan: 0.8,
      folds: true,
      // A tatter of his black coat hanging behind, torn ragged.
      panels: [{ from: 140, to: 220, len: 20, jag: 5, taper: 0.9, kick: 0.3 }],
    }),
    skirt({
      outer: CRIMSON,
      inner: { ...CRIMSON, tones: [CRIMSON.tones[2], CRIMSON.tones[2], CRIMSON.tones[3], CRIMSON.tones[3]] },
      waist: 5.8,
      ring: [7.6, 9.6],
      aline: 0.2,
      folds: false,
      // The sash's knotted ends at his left hip.
      panels: [
        { from: -68, to: -48, len: 21, jag: 3, taper: 0.8 },
        { from: -44, to: -28, len: 15, jag: 2.5, taper: 0.8 },
      ],
    }),
    tail({ root: [-6, 4, 0], len: 36, r: [5.6, 2], hide: HIDE, plate: PLATE, seam: SEAM, flame: FLAME }),
    paws({ hide: HIDE, claw: CLAW, hot: CLAW_HOT, r: 3.6 }),
    cracks({ seam: SEAM, arms: [6, 5.6], thigh: 6.2 }),
  ],
  weapon: claws({ len: 14.5, w: 2.8, spread: 3, hook: 4.6, mat: CLAW, edge: CLAW_EDGE, hot: CLAW_HOT, glow: hex('#ffb43c'), reach: [4, 30], tip: 16 }),
  offhand: claws({ len: 14.5, w: 2.8, spread: 3, hook: 4.6, mat: CLAW, edge: CLAW_EDGE, hot: CLAW_HOT, glow: hex('#ffb43c'), reach: [4, 30], tip: 16 }),
  aura: { core: hex('#ff9a26'), edge: hex('#d8401a'), hot: hex('#fff4c8') },
};

export { FIREBEAST };
