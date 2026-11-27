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
import { brow, claws, cracks, type ManeFlame, mane, muzzle, paws, shoulderFlames, tail } from './fire.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

/**
 * Charred obsidian hide: nearly black, its lit edges warm with the light of the fire above it,
 * a cool grey-violet glint below them.
 */
const HIDE = { ...mat4('#8a5646', '#3a3340', '#221d27', '#121016', '#07050a', -0.1), gain: 0.85 };
/** The face and the muzzle, a step lighter so the features read on it. */
const FACE = mat4('#a06a52', '#4a4150', '#2c2632', '#17131b', '#07050a', 0);
/** The throat and neck: the hide's middle tone, so the head stands apart from the chest. */
const THROAT = { ...mat4('#8a5646', '#4a4150', '#38303e', '#221d27', '#07050a', 0.1), gain: 0.7 };
/** Obsidian plates: glossier than the hide, parted from it by their own edges, their tops fire-lit. */
const PLATE = { ...mat4('#b87656', '#4c4556', '#2e2836', '#19151e', '#07050a', -0.04), clear: 1.2 };
/** The plates' rims, catching the fire's light. */
const PLATE_RIM = mat4('#ffd27a', '#e0803a', '#9a4422', '#5a2414', '#1e0a06', 0.1);
/** Magma in the seams: flat, so it reads as light rather than a lit surface. */
const SEAM = flat('#ffa236');
const SEAM_HOT = flat('#ffe48a');
/** Living flame (the mane, the tail's fire): white-hot, gold, orange and an ember red, parted by a deep ember line. */
const FLAME = mat4('#fff7cf', '#ffd148', '#ff8f22', '#e04a18', '#7a1a06');
/**
 * The mane's mass on the head and its locks: a step deeper than its tongues (orange into ember
 * red), so the bright tongues licking up off it stand apart from it, darker between them.
 */
const MANE_MASS = mat4('#ffd148', '#ff9a2a', '#e8581c', '#a8300e', '#5a1204');
/** Claws: dark horn with a glowing inside edge and white-hot points, as the Warden's blade glows. */
const CLAW = mat4('#7a5c50', '#40384a', '#28222e', '#16121a', '#07050a', 0.1);
const CLAW_EDGE = flat('#ff9a32');
const CLAW_HOT = flat('#fff1b8');
/** The scrap of his crimson shirt knotted round its waist, and of his black coat with its ember lining. */
const CRIMSON = { ...mat4('#ff8a74', '#e84a3c', '#b0221e', '#64100e', '#2a0606', 0.14), gain: 0.7 };
/** The fold running round the sash. */
const SASH_FOLD = { ...CRIMSON, bias: -0.25 };
const COAT = { ...mat4('#7a6a6e', '#56505c', '#3a3640', '#221f28', '#0c0b0f', 0), gain: 0.6 };
const LINING = mat4('#ffc070', '#ff9a3c', '#d0601e', '#7a2e0c', '#3a1404');

/** The flame's own colours (fire.ts `burn` darkens them to embers as the fire dies). */
export const FLAME_TONES = [...FLAME.tones, FLAME.line, ...MANE_MASS.tones, MANE_MASS.line];

/** The colours that glow (fire.ts `burn`): the flame's bright tones, the seams and the claws' edges. */
export const FIRE_HOT = [FLAME.tones[0], FLAME.tones[1], FLAME.tones[2], MANE_MASS.tones[1], SEAM.tones[0], SEAM_HOT.tones[0], CLAW_EDGE.tones[0], CLAW_HOT.tones[0], PLATE_RIM.tones[0], PLATE_RIM.tones[1], hex('#fff6c8'), hex('#ffd25a'), hex('#ff9a1e')];

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

const SHELL = { c: [-3.4, 3, 0] as const, r: [13.2, 12.4, 14] as const };

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
  // A ruff of flame under the jaw, parting the head from the chest.
  L(0, -58, [0.5, -1, 0], 7, 3.6, [0.5, 0.4, 0]),
  L(34, -52, [0.4, -1, 0.4], 7, 3.4, [0.4, 0.4, 0.2]),
  L(-34, -52, [0.4, -1, -0.4], 7, 3.4, [0.4, 0.4, -0.2]),
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
  // Streaming up and back off the back of the head and the nape, in separate tongues.
  { yaw: 158, pitch: 32, len: 21, w: 4.2, back: 1.1 },
  { yaw: -158, pitch: 32, len: 21, w: 4.2, back: 1.1 },
  { yaw: 180, pitch: 12, len: 22, w: 4.6, back: 1.4 },
];

/**
 * The beast's face: big slanted eyes glowing white-gold, ringed in the Warden's amber, under heavy
 * dark brows (they glow, fire.ts `burn`, so they read as eyes even at game size); its mouths are
 * a fanged muzzle's: two upper fangs over the lower lip at rest, and in the snarl and the roar a
 * maw bared round them that glows red with the fire in its throat (the mouth's inside, `r`, is
 * relit by `burn`).
 */
const FACE_BEAST: FaceStyle = {
  eyes: {
    full: { rows: ['..KKKK.', '.KWWhiK', 'KiWWWIK', 'KIiiIK.', '.KKK...'], ax: 2, ay: 2 },
    mid: { rows: ['.KKKK', 'KWWhK', 'iWWIK', 'KIIK.'], ax: 1, ay: 2 },
    narrow: { rows: ['.KK', 'KWh', 'iIK', 'KK.'], ax: 1, ay: 2 },
    closed: { rows: ['KKKKK', '.KKKK'], ax: 2, ay: 0 },
    squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKKK', 'KhWWWK', 'KWWWiK', 'KIWiIK', '.KIIK.'], ax: 2, ay: 2 },
  },
  brows: {
    full: { rows: ['....BBB', '..BBBB.', 'BBBB...'], ax: 2, ay: 1 },
    mid: { rows: ['...BBB', '.BBBB.', 'BB....'], ax: 1, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
  browsUp: {
    full: { rows: ['BB.....', '.BBBB..', '....BB.'], ax: 2, ay: 1 },
    mid: { rows: ['BB...', '.BBBB'], ax: 1, ay: 1 },
    narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
  },
  mouths: {
    stern: { rows: ['MMMMMMM', 'MT...TM', '.T...T.'], ax: 3, ay: 0 },
    shout: { rows: ['.MMMMM.', 'MTrrrTM', 'MTrrrTM', 'MrrrrrM', 'MrrrrrM', 'MTrrrTM', '.MMMMM.'], ax: 3, ay: 1 },
    grit: { rows: ['MMMMMMM', 'MTrrrTM', 'MTrrrTM', 'MrrrrrM', '.MTMTM.'], ax: 3, ay: 1 },
    hurt: { rows: ['.MMMMM.', 'MrrrrrM', 'MrrrrrM', '.MMMMM.'], ax: 3, ay: 1 },
    closed: { rows: ['MMMMMMM', '.T...T.'], ax: 3, ay: 0 },
    smirk: { rows: ['MMMMMMM', 'M....TM', '.....T.'], ax: 3, ay: 0 },
  },
};

// ── The torso: obsidian plates cracked with magma, the crimson sash at the waist ─────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);
/** A crack's half-width in frame units: about a pixel across. */
const SEAM_W = 0.6;

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const [, u, r] = h.p;
  const yaw = deg(h);
  if (where === 'hips') return u > 3.4 ? CRIMSON : HIDE;
  if (u < 3) return null;
  // The sash, knotted round the waist, a fold running round it.
  if (u < 11) return Math.abs(u - 7.4 - r * 0.08) < 0.5 ? SASH_FOLD : CRIMSON;
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
    hair: MANE_MASS,
    skull: { c: [0, 0.5, 0], r: [11.4, 11, 12] },
    jaw: { c: [8.4, -6.2, 0], r: [9.8, 7.4, 8.6] },
    ear: { c: [-1, 1, 7], r: [0.5, 0.5, 0.5] },
    shell: SHELL,
    hairline: { faceYaw: 78, brow: 3.6, temple: -1, nape: -2, ear: -4 },
    locks: LOCKS,
    lockLine: hex('#7a1a06'),
    darkHair: true,
    whorl: { yaw: 180, pitch: 40, reach: 70, clumps: 5, twist: 0.6 },
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
      mouthAt: [16.6, -7.4],
      noseAt: [17.4, -2.4],
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
    upperArm: { mat: HIDE, r0: 7.2, r1: 6 },
    // Heavy forearms, thickening down to the fists as an ape's do.
    foreArm: { mat: HIDE, r0: 5.4, r1: 7.4 },
    hand: { mat: HIDE, r: 6, knuckle: SEAM_HOT },
    neck: { mat: THROAT, r: 6.4 },
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
    brow({ mat: HIDE, c: [9.4, 4.8, 4.6], r: [2.8, 1.5, 4.2] }),
    muzzle({ nose: [17.6, -2.4, 0], chin: [16, -12.4, 0], nostril: hex('#050306'), lit: flat('#a06a52'), chinLit: flat('#c07a52') }),
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
      give: 1.8,
      // A tatter of his black coat hanging behind, torn ragged, its ember lining showing as it flies.
      panels: [{ from: 135, to: 225, len: 21, jag: 5, taper: 0.95, kick: 0.55 }],
    }),
    skirt({
      outer: CRIMSON,
      inner: { ...CRIMSON, tones: [CRIMSON.tones[2], CRIMSON.tones[2], CRIMSON.tones[3], CRIMSON.tones[3]] },
      waist: 5.8,
      ring: [7.6, 9.6],
      aline: 0.2,
      folds: false,
      give: 1.2,
      // The sash's knotted ends at his left hip, broad enough to read toward the viewer.
      panels: [
        { from: -78, to: -46, len: 22, jag: 3, taper: 0.85 },
        { from: -46, to: -18, len: 16, jag: 2.5, taper: 0.85 },
      ],
    }),
    tail({ root: [-6, 3, 0], len: 42, r: [6, 2.6], hide: HIDE, plate: PLATE, seam: SEAM, flame: FLAME }),
    paws({ hide: HIDE, plate: PLATE, claw: CLAW, hot: CLAW_HOT, r: 3.6 }),
    cracks({ seam: SEAM, hot: SEAM_HOT, arms: [6.4, 6.2], thigh: 6.8 }),
  ],
  weapon: claws({ len: 14.5, w: 3.4, spread: 4.2, hook: 5, mat: CLAW, edge: CLAW_EDGE, hot: CLAW_HOT, glow: hex('#ffb43c'), reach: [4, 30], tip: 16 }),
  offhand: claws({ len: 14.5, w: 3.4, spread: 4.2, hook: 5, mat: CLAW, edge: CLAW_EDGE, hot: CLAW_HOT, glow: hex('#ffb43c'), reach: [4, 30], tip: 16 }),
  aura: { core: hex('#ff9a26'), edge: hex('#d8401a'), hot: hex('#fff4c8') },
};

export { FIREBEAST };
