/**
 * The Flame Warden, as a chibi: a lean, quick young swordsman with tanned skin and sharp
 * amber-orange eyes, black hair in spikes swept back from his face whose ends flick up like
 * flames (a few strands left over his forehead), a long black coat with a high collar and
 * coat-tails to the calves, lined in ember orange, a short black hooded cape over his shoulders
 * (the hood down), a crimson shirt under a dark leather harness, a blackened-iron pauldron and
 * gauntlet on his sword arm, dark trousers and armoured boots, and a single-edged longsword of dark
 * steel whose edge glows with heat from orange to white-hot, with a plain black guard and grip.
 * His fire is orange with a gold edge and a white-hot heart. Everything here is data for the
 * chibi engine; his moves are in the moves-*.ts files beside it, his fire in fire.ts, and hero.ts
 * puts him together.
 */
import { hex } from '../../paint.js';
import { blade } from '../blade.js';
import type { BodyDesign, ChibiDesign, DrawItem, FaceStyle, Lock, Piece, PieceContext } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { hood } from '../headgear.js';
import { collar, cowl, plates, skirt } from '../pieces.js';
import { dim, flat, type Hit, type Mat, mat4 } from '../raster.js';
import { at3, type Build, type Limb, lerp3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Tanned.
const SKIN = mat4('#f4c79c', '#dc9e70', '#b8784e', '#844c32', '#4e2416', 0.14);
// Black hair with a cool sheen: the light tone over the clumps, the highlight streaking their lit sides.
const HAIR = mat4('#6e7088', '#33333f', '#1b1a21', '#0e0d12', '#060508', -0.04);
/**
 * The same black hair lit by his fire in his skills: a warm red-orange sheen on the light tone
 * and ember highlights (hero.ts paints his skill clips with it).
 */
export const HAIR_HOT = mat4('#e8743c', '#432628', '#1f161b', '#0f0a0c', '#060404', -0.04);
// The long black coat: its base tone over most of it, the light tone only on lit folds.
const COAT = { ...mat4('#6c6876', '#4a4650', '#2c2a32', '#18161c', '#0c0b0f', -0.04), gain: 0.55 };
const COAT_SEAM = mat4('#2c2a32', '#222028', '#18161c', '#121016', '#0c0b0f');
// The ember-orange lining, which flashes when the coat streams.
const LINING = mat4('#ffc878', '#ff9a3c', '#d0601e', '#7a2e0c', '#3c1406', 0.05);
// The coat's hem, smouldering: the lining's ember turned out along its edge.
const HEM = mat4('#ffd08a', '#ffa040', '#e06a1e', '#8a3410', '#3c1406', 0.1);
// The short hooded cape: a black a shade warmer than the coat, lined in deep crimson.
const CAPE = { ...mat4('#6e6670', '#463f48', '#2a252c', '#17141a', '#0b090d', -0.04), gain: 0.55 };
const CAPE_IN = mat4('#a0302a', '#741a18', '#4a0e0e', '#2c0808', '#160404');
// The cape's hem: a crimson band, the shirt's colour, that sets it apart from the coat under it.
const CAPE_TRIM = mat4('#ff7a64', '#d8382c', '#9a1a18', '#5a0c0c', '#2a0404', 0.05);
// The crimson shirt.
const SHIRT = { ...mat4('#ff8a74', '#e84a3c', '#b0221e', '#64100e', '#320606', 0.05), gain: 0.7 };
// Dark leather: the harness and the belt.
const LEATHER = mat4('#7a5444', '#54382c', '#36241c', '#20140f', '#0e0806', -0.05);
const BELT_EDGE = flat(hex('#170e0a'));
// Blackened iron, with dull steel edges.
const IRON = { ...mat4('#8a8894', '#5a5864', '#3a3842', '#222029', '#0e0d12', -0.3), clear: 1.2 };
const IRON_EDGE = mat4('#c4c0cc', '#96929e', '#6c6876', '#46434e', '#16151a', 0.05);
// A small ember stone on his gauntlet and in the sword's pommel.
const EMBER = mat4('#fff0b0', '#ffb43c', '#e8601e', '#8a2a08', '#3c1004', 0.1);
const TROUSERS = mat4('#5a5058', '#3c343c', '#272128', '#161216', '#08070a', -0.06);
const BOOT = mat4('#4e464e', '#342e36', '#221e24', '#141116', '#070609', -0.04);
const SOLE = mat4('#2a2428', '#1e191d', '#141114', '#0c0a0c', '#060506');
const GLOVE = mat4('#6a4c44', '#48322c', '#30201c', '#1c1210', '#0a0605', -0.04);
// The sword: dark steel, its cutting edge glowing with heat (orange at the guard to white-hot at
// the point: the edge band is lit brighter toward the tip), a pale line along its back, and a
// plain black guard, grip and pommel.
const STEEL = mat4('#7c7a86', '#4e4c58', '#302e38', '#1c1b22', '#0a090d');
const HOT_EDGE = mat4('#fffbe8', '#ffe08a', '#ffb43c', '#e0601e', '#5a1e06', 0.1);
const SPINE = mat4('#b4b2be', '#8a8896', '#62606e', '#3e3c48', '#121116');
const GUARD = mat4('#6e6a76', '#45424e', '#2a2830', '#17161b', '#08070a');
const GRIP = mat4('#5a4644', '#3e2e2e', '#2a1e1e', '#181010', '#0a0606');

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** Lean and quick: longer in the leg than the Dark Knight, not as long as the Dragoon, narrow hips. */
const BUILD: Build = {
  hip: 29,
  thigh: 13,
  shin: 13,
  ankle: 4,
  torso: 23,
  neck: 2.1,
  shoulder: 8,
  hipWidth: 4,
  shoulderDrop: 3.5,
  upperArm: 9.2,
  foreArm: 9.2,
  headUp: 12,
};

// ── Hair: spikes swept back, their ends flicking up like flames ──────────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // Big spikes swept back over the top from the hairline, low over the skull, their tips
  // flicking up as flames do.
  L(-4, 60, [-1, 0.2, 0.05], 13.5, 4.8, [-0.05, 0.5, 0], 0.7, 0.3),
  L(30, 54, [-1, 0.14, 0.4], 12.5, 4.4, [0, 0.46, 0.14], 0.7, 0.3),
  L(-36, 54, [-1, 0.14, -0.4], 12.5, 4.4, [0, 0.46, -0.14], 0.7, 0.3),
  // The back of the crown: spikes fanning out behind, each flicking up at its end.
  L(130, 46, [-0.8, 0.1, 0.7], 11, 4.2, [0, 0.42, 0.1], 1, 0.3),
  L(-130, 46, [-0.8, 0.1, -0.7], 11, 4.2, [0, 0.42, -0.1], 1, 0.3),
  L(176, 42, [-1, 0.02, 0.05], 12.5, 4.4, [-0.1, 0.48, 0], 1.1, 0.3),
  // Lower spikes at the back of the head and above the ears, sweeping back and out and flicking
  // up, so the outline is a row of flames from every side.
  L(150, 12, [-0.8, -0.45, 0.45], 10, 3.6, [-0.1, 0.46, 0.12], 1.1, 0.3),
  L(-150, 12, [-0.8, -0.45, -0.45], 10, 3.6, [-0.1, 0.46, -0.12], 1.1, 0.3),
  L(100, 20, [-0.75, -0.3, 0.6], 9, 3.3, [-0.05, 0.42, 0.12], 0.9, 0.3),
  L(-100, 20, [-0.75, -0.3, -0.6], 9, 3.3, [-0.05, 0.42, -0.12], 0.9, 0.3),
  // Short layers close round the ears, so front on the ears show under the spikes.
  L(108, 0, [-0.35, -1, 0.2], 5, 2.4, [-0.05, 0.1, 0.05], 0.8, 0.3),
  L(-108, 0, [-0.35, -1, -0.2], 5, 2.4, [-0.05, 0.1, -0.05], 0.8, 0.3),
  // A few strands left over the forehead, flicking out at their ends.
  L(-14, 44, [0.55, -1, -0.12], 8.5, 1.9, [0.12, 0.2, -0.18], 0.35, 0.25),
  L(12, 46, [0.55, -1, 0.2], 6.6, 1.7, [0.12, 0.2, 0.16], 0.35, 0.25),
  L(-34, 36, [0.4, -1, -0.35], 5.5, 1.7, [0.1, 0.15, -0.15], 0.35, 0.25),
  // Pieces at the temples, swept back past the ears.
  L(64, 18, [-0.3, -0.8, 0.3], 7, 2.2, [-0.1, 0.2, 0.08], 0.5, 0.3),
  L(-64, 18, [-0.3, -0.8, -0.3], 7, 2.2, [-0.1, 0.2, -0.08], 0.5, 0.3),
  // Two flames licking up from the crown, leaning back.
  L(150, 72, [-0.8, 0.5, 0.2], 9, 3.4, [-0.25, 0.25, 0.05], 1, 0.3),
  L(-120, 68, [-0.75, 0.45, -0.4], 8, 3.2, [-0.25, 0.25, -0.05], 1, 0.3),
];

// ── His face: the sharp style, with a fierce grin ────────────────────────────────────────────

/**
 * The sharp style (narrow eyes under a heavy lid sweeping up to the outer corner, straight brows)
 * with the inner corners kept apart, so toward the viewer the eyes and brows never run together
 * across the bridge of his nose; his smirk is a fierce, lopsided grin showing his teeth.
 */
const FACE_WARDEN: FaceStyle = {
  ...FACE_SHARP,
  eyes: {
    ...FACE_SHARP.eyes,
    full: { rows: ['..KKKK', 'KKhIIK', '.iIIDW', '..lll.'], ax: 2, ay: 1 },
    mid: { rows: ['..KKK', '.KhIK', '.iIDK', '..l..'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKKK', 'KKhIIK', '.iIIDW', '..lll.'], ax: 2, ay: 1 },
  },
  brows: {
    full: { rows: ['...BBB', 'BBBB..'], ax: 2, ay: 1 },
    mid: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
  mouths: {
    ...FACE_SHARP.mouths,
    smirk: { rows: ['....M', 'MTTM.'], ax: 2, ay: 0 },
  },
};

// ── The torso: belt, the crimson shirt and harness in the coat's opening, coat over the rest ─

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') return u > 4.6 ? LEATHER : TROUSERS;
  if (u < 5) return null;
  // A dark belt with an iron buckle.
  if (u < 8) {
    if (yaw < 12 && u > 5.4 && u < 7.6) return yaw < 7 && u > 6 && u < 7 ? LEATHER : IRON_EDGE;
    return u > 7.4 ? BELT_EDGE : LEATHER;
  }
  // The coat opens in a deep V over the crimson shirt, an ember edge of its lining showing.
  const open = 34 + (u - 8) * 1.1;
  if (yaw < open) {
    if (yaw > open - 4) return LINING;
    // The harness: a strap from his right shoulder down across to his left hip, a band round
    // the chest and an iron ring where they cross.
    const r = h.p[2];
    const across = u - 12.4 - r * 0.62;
    if (Math.abs(u - 15.6) < 1.1 && Math.abs(r - 1.9) < 1.5) return IRON_EDGE;
    if (Math.abs(across) < 1.15) return LEATHER;
    if (Math.abs(u - 15.6) < 0.8) return LEATHER;
    return SHIRT;
  }
  // A seam down the middle of the back.
  if (yaw > 176) return COAT_SEAM;
  return COAT;
}

const BODY: BodyDesign = {
  thigh: { mat: TROUSERS, r0: 3.8, r1: 3.2 },
  shin: { mat: IRON, r0: 3.1, r1: 2.8 },
  boot: { mat: BOOT, r: 3.6, top: 0.55, toe: 6.4, heel: 2.4, sole: SOLE, cap: IRON },
  knee: { mat: IRON, r: 2.8 },
  upperArm: { mat: COAT, r0: 3.1, r1: 2.8 },
  foreArm: { mat: COAT, r0: 2.8, r1: 2.6 },
  // The coat's sleeves turned back at the wrist, showing the ember lining.
  cuff: { mat: LINING, r: 3.1, at: 0.62 },
  hand: { mat: GLOVE, r: 3.1, knuckle: IRON },
  neck: { mat: SKIN, r: 2.4 },
  hips: [{ c: [0, 3.4, 0], r: [5, 5, 6.6], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.8, 5.1, 6.4], id: 1 },
    { c: [0.4, 15.2, 0], r: [5.7, 9, 8.2], id: 1 },
  ],
  torso,
};

// ── The gauntlet on his sword arm ────────────────────────────────────────────────────────────

/**
 * A blackened-iron gauntlet over his right forearm: a flared cuff with a pale rim at the elbow
 * end, plates down to the wrist and an ember stone set in its back. It sorts just over his arm
 * (as the painter sorts the arm) and under the hand and the sword.
 */
const gauntlet: Piece = (ctx: PieceContext): DrawItem[] => {
  const { rig, depth, proj } = ctx;
  const arm: Limb = rig.armR;
  const torsoTrue = depth(at3(rig.chest, 0, 14, 0));
  const far = depth(arm.mid) < torsoTrue - 2 && depth(arm.end) < torsoTrue - 2;
  const zArm = depth(lerp3(arm.mid, arm.end, 0.4)) * 0.6 + depth(arm.root) * 0.4 + (far ? 0 : ctx.upper);
  const bias = far ? -0.16 : 0;
  const k = (m: Mat): Mat => (far ? dim(m, -0.12) : m);
  return [
    {
      z: zArm + 0.02,
      draw: () => {
        const part = ctx.part();
        const a = lerp3(arm.mid, arm.end, 0.18);
        const e = lerp3(arm.mid, arm.end, 0.3);
        const b = lerp3(arm.mid, arm.end, 0.92);
        part.capsule(proj(a), proj(e), 3.7, 3.6, k(IRON_EDGE), bias + 0.05, depth(a) + 0.9, depth(e) + 0.9, 1);
        part.capsule(proj(e), proj(b), 3.3, 2.9, k(IRON), bias + 0.05, depth(e) + 0.9, depth(b) + 0.9, 2);
        const s = lerp3(arm.mid, arm.end, 0.58);
        const sp = proj(s);
        part.ellipse(sp[0], sp[1], 1.1, 1.1, k(EMBER), 0.3, depth(s) + 3.6, 3);
        part.commit();
      },
    },
  ];
};

// ── The coat's high collar, the hooded cape and the hood worn down ───────────────────────────

const SHELL = { c: [-1.6, 1.6, 0] as const, r: [11.2, 10.6, 11] as const };

const HOOD = hood({ outer: CAPE, inner: CAPE_IN, shell: SHELL, opening: { top: 5, bottom: -12, side: 8.6 }, folds: true, worn: 'down' });

const FLAME_WARDEN: ChibiDesign = {
  id: 'hero-flame-warden',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.2, 9.6, 10] },
    jaw: { c: [1.7, -4.2, 0], r: [7.6, 6.8, 7.7] },
    ear: { c: [-0.6, -3.3, 9.6], r: [1.8, 2.5, 1.5] },
    shell: SHELL,
    hairline: { faceYaw: 74, brow: 4.4, temple: 0.4, nape: -7, ear: -1.6 },
    locks: LOCKS,
    lockLine: hex('#060508'),
    whorl: { yaw: 180, pitch: 46, reach: 100, clumps: 7, twist: 0.15 },
    face: {
      eye: [8.8, -1.6, 4.1],
      lash: hex('#140a0a'),
      iris: hex('#e8681a'),
      irisLight: hex('#ffd25a'),
      irisDeep: hex('#8c2c06'),
      white: hex('#fbf1e2'),
      shine: hex('#ffffff'),
      brow: hex('#100c10'),
      browUp: 3.1,
      mouth: hex('#4e1a12'),
      mouthAt: [9.8, -6.2],
      noseAt: [10.3, -3.9],
      style: FACE_WARDEN,
      rest: 'smirk',
    },
  },
  body: BODY,
  headPieces: [
    collar({
      outer: COAT,
      lining: LINING,
      c: [-1, 30.6, 0],
      r: [7.8, 11.4, 9.6],
      bottom: 20,
      top: { back: 30.6, side: 28.6, front: 25.2 },
      open: 46,
    }),
  ],
  outfit: [
    HOOD.down,
    // The pauldron on his sword arm, under the cape.
    plates({
      side: 1,
      plates: [
        { c: [0, 2.2, 1.1], r: [5.2, 3.9, 5] },
        { c: [-0.2, -0.6, 2], r: [4.7, 3.3, 4.4] },
      ],
      mat: IRON,
      rim: IRON_EDGE,
    }),
    gauntlet,
    // The long coat: short flaps either side of the opening, long tails to the calves at the
    // sides and back, split so they stream as flames do.
    skirt({
      outer: COAT,
      inner: LINING,
      waist: 5.4,
      ring: [5.8, 7.6],
      aline: 0.3,
      fan: 0.9,
      folds: true,
      // Its hem smoulders: a narrow ember edge, the lining's colour.
      trim: HEM,
      legs: 4.2,
      panels: [
        { from: 30, to: 80, len: 15, jag: 2 },
        { from: 86, to: 150, len: 26, jag: 3.6, taper: 1.1, kick: 0.25 },
        { from: 156, to: 204, len: 25, jag: 3.4, taper: 1.05, kick: 0.35 },
        { from: -150, to: -86, len: 26, jag: 3.6, taper: 1.1, kick: 0.25 },
        { from: -80, to: -30, len: 15, jag: 2 },
      ],
    }),
    // A short hooded cape over his shoulders: to the chest at the front, over the upper arms, to
    // the shoulder blades behind.
    cowl({
      outer: CAPE,
      inner: CAPE_IN,
      top: 22.6,
      ring: [3.8, 4.4],
      folds: true,
      trim: CAPE_TRIM,
      panels: [
        { from: -34, to: 34, len: 2.6, jag: 0.6 },
        { from: 34, to: 112, len: 10.5, jag: 1.6 },
        { from: 112, to: 180, len: 15, jag: 2.4 },
        { from: 180, to: 248, len: 15, jag: 2.4 },
        { from: 248, to: 326, len: 10.5, jag: 1.6 },
      ],
      over: { chest: BODY.chest, hips: BODY.hips },
    }),
  ],
  // The single-edged longsword, 44 px from the grip to the point: a straight back that drops to
  // a clipped point, the edge glowing with heat along its length.
  weapon: blade({
    blade: [
      [4, 2.7],
      [4, -2.2],
      [35, -2.1],
      [40.5, -1.2],
      [44.5, 0.6],
      [41.5, 2.3],
      [32, 2.9],
      [14, 2.9],
    ],
    edge: { from: 6, width: 1.4, mat: HOT_EDGE },
    spine: { v: -1.3, from: 6, to: 35, mat: SPINE },
    rune: { v: 0.9, from: 7, to: 40, rest: hex('#7a2a0e'), colour: hex('#ff8a2a'), glow: hex('#ffd27a') },
    steel: STEEL,
    guard: {
      pts: [
        [2.6, -1.8],
        [1.8, -5.6],
        [0.2, -6],
        [0, -1.8],
        [0, 1.8],
        [0.2, 6],
        [1.8, 5.6],
        [2.6, 1.8],
      ],
      mat: GUARD,
    },
    grip: { from: -7, to: 0.4, r: 1.4, mat: GRIP, wrap: flat(hex('#0e0808')) },
    pommel: { u: -8.6, r: 2, mat: GUARD, gem: EMBER, gemR: 1 },
    grip2: -4,
    reach: [8, 44.5],
  }),
  // Fire: orange at the core, a gold edge, a white-hot heart.
  aura: { core: hex('#ffb43c'), edge: hex('#ffe08a'), hot: hex('#fffbe8') },
};

/** The same design with his hair lit by his fire (his skill clips: see hero.ts). */
const FLAME_WARDEN_HOT: ChibiDesign = { ...FLAME_WARDEN, head: { ...FLAME_WARDEN.head, hair: HAIR_HOT } };

export { FLAME_WARDEN, FLAME_WARDEN_HOT };
