/**
 * The Dark Knight, as a chibi: a stern young knight with a mop of spiky chestnut hair, blackened
 * plate with dull silver edges over a dark padded suit, a long open oxblood coat with a high collar
 * and ragged split tails, and an oversized black greatsword with a pale edge, a notched spine and a
 * crimson rune channel. Everything here is data for the chibi engine; his moves are in the
 * moves-*.ts files.
 */
import { hex } from '../paint.js';
import { blade } from './blade.js';
import type { ChibiDesign, Lock } from './design.js';
import { collar, plates, skirt } from './pieces.js';
import { flat, type Hit, type Mat, mat4 } from './raster.js';
import type { Build } from './rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

const SKIN = mat4('#f6d0a8', '#e2a67e', '#c2805e', '#8e5442', '#5c2a22', 0.16);
const HAIR = mat4('#a87650', '#7c5236', '#583822', '#341f12', '#1e1009', -0.2);
const ARMOUR = mat4('#8a90a4', '#5c6274', '#3a3e4c', '#22242e', '#121319', -0.36);
const SILVER = mat4('#d2d6e0', '#a4aab8', '#767c8c', '#4a4e5e', '#20222c', 0.1);
const COAT = mat4('#b33e48', '#8e2a34', '#64161f', '#3a0a12', '#22050b', -0.2);
const COAT_SEAM = mat4('#64161f', '#4c0f18', '#3a0a12', '#2a060d', '#22050b');
const LINING = mat4('#46303a', '#2e1f27', '#1c1218', '#110a0e', '#08050a');
const SUIT = mat4('#6c6672', '#4e4954', '#36323c', '#221f27', '#141218', -0.15);
const LEATHER = mat4('#7c5642', '#5a3c2c', '#3e281c', '#25170f', '#140c07', -0.1);
const SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');
const STEEL = mat4('#80869a', '#505466', '#32343f', '#1c1d25', '#0d0e13');
const EDGE = mat4('#f6f8fc', '#d8dce6', '#aab0be', '#7e8494', '#2a2c36');
const GUARD = mat4('#b8bcca', '#6c7080', '#40424e', '#25262f', '#111218');
const GRIP = mat4('#843640', '#5e242b', '#40161b', '#260c10', '#150608');
const GEM = mat4('#ff8a8a', '#e8283c', '#a8101e', '#600812', '#30040a');

// ── Build ────────────────────────────────────────────────────────────────────────────────────

const BUILD: Build = {
  hip: 27,
  thigh: 12,
  shin: 12,
  ankle: 4,
  torso: 24,
  neck: 2,
  shoulder: 8.6,
  hipWidth: 4.3,
  shoulderDrop: 3.6,
  upperArm: 9,
  foreArm: 9,
  headUp: 12,
};

// ── Hair: thick, spiky and messy, swept back and up, a few strands over the brow ─────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give });

const LOCKS: Lock[] = [
  // The nape and the back: volume that sticks out behind and down.
  L(180, -22, [-0.7, -0.75, 0], 6.5, 4, [0, 0.15, 0], 0.6),
  L(128, -14, [-0.45, -0.6, 0.9], 5.5, 3.4, [0, 0.15, 0], 0.6),
  L(-128, -14, [-0.45, -0.6, -0.9], 5.5, 3.4, [0, 0.15, 0], 0.6),
  L(150, 10, [-0.75, 0.1, 0.85], 7.5, 4, [0, 0.3, 0]),
  L(-150, 10, [-0.75, 0.1, -0.85], 7.5, 4, [0, 0.3, 0]),
  // Over the ears.
  L(88, 16, [-0.4, 0.25, 1], 5.5, 3.4, [-0.1, 0.2, 0]),
  L(-88, 16, [-0.4, 0.25, -1], 5.5, 3.4, [-0.1, 0.2, 0]),
  // The crown: big spikes swept back and up.
  L(172, 46, [-1, 0.75, 0], 8.5, 4.3, [-0.1, 0.3, 0]),
  L(118, 44, [-0.65, 0.8, 0.8], 7.5, 3.9, [-0.2, 0.2, 0]),
  L(-118, 44, [-0.65, 0.8, -0.8], 7.5, 3.9, [-0.2, 0.2, 0]),
  L(48, 52, [-0.35, 1, 0.6], 7, 3.9, [-0.35, 0, 0]),
  L(-48, 52, [-0.35, 1, -0.6], 7, 3.9, [-0.35, 0, 0]),
  // A swept-up forelock at the front of the crown.
  L(0, 54, [0.1, 1, 0], 7, 4.2, [-0.55, 0, 0]),
  // The fringe: a few strands falling over the forehead.
  L(16, 34, [0.5, -1, 0.35], 4.6, 2.9, [0.1, 0, 0.15], 0.4),
  L(-18, 34, [0.5, -1, -0.2], 4, 2.7, [0.1, 0, -0.1], 0.4),
  L(46, 26, [0.3, -1, 0.55], 4.4, 2.6, [0.1, 0, 0.2], 0.4),
  L(-48, 26, [0.3, -1, -0.55], 4, 2.5, [0.1, 0, -0.2], 0.4),
  // Sideburns in front of the ears.
  L(70, 8, [0.1, -1, 0.3], 5, 2.3, [0.1, 0, 0.1], 0.3),
  L(-70, 8, [0.1, -1, -0.3], 5, 2.3, [0.1, 0, -0.1], 0.3),
];

// ── The torso: belt, breastplate in the coat's opening, coat over the rest ───────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') return u > 4.6 ? LEATHER : SUIT;
  if (u < 5) return null;
  // A broad belt with a silver buckle.
  if (u < 8.4) {
    if (yaw < 13 && u > 5.6 && u < 7.8) return yaw < 9 && u > 6.2 && u < 7.2 ? LEATHER : SILVER;
    return u > 7.7 ? flat(hex('#24170f')) : LEATHER;
  }
  // The coat opens in a V over the breastplate.
  const open = 30 + (u - 8) * 0.9;
  if (yaw < open) return yaw > open - 4 && u < 21.5 ? SILVER : ARMOUR;
  // A seam down the middle of the back.
  if (yaw > 176) return COAT_SEAM;
  return COAT;
}

const DARK_KNIGHT: ChibiDesign = {
  id: 'hero-tank-male',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.4, 9.7, 10.3] },
    jaw: { c: [1.7, -4.1, 0], r: [7.9, 6.8, 8.2] },
    ear: { c: [-0.6, -3.2, 10], r: [2, 2.8, 1.6] },
    shell: { c: [-0.9, 0.8, 0], r: [10.9, 10.5, 11.5] },
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -7.5, ear: -1.6 },
    locks: LOCKS,
    face: {
      eye: [8.8, -1.7, 3.9],
      lash: hex('#1e0e10'),
      iris: hex('#4c1612'),
      irisLight: hex('#9a3e24'),
      white: hex('#f2e9e0'),
      shine: hex('#ffffff'),
      brow: hex('#2c170c'),
      browUp: 3,
      mouth: hex('#6e2a26'),
      mouthAt: [9.5, -7.8],
      noseAt: [10.2, -4.6],
      scar: { at: [7.2, -5.8, 6], colour: hex('#f8dcc4') },
    },
  },
  body: {
    thigh: { mat: SUIT, r0: 4.1, r1: 3.5 },
    shin: { mat: ARMOUR, r0: 3.3, r1: 3.1 },
    boot: { mat: LEATHER, r: 4.1, top: 0.55, toe: 6.8, heel: 2.6, sole: SOLE, cap: ARMOUR },
    knee: { mat: ARMOUR, r: 3.1 },
    upperArm: { mat: COAT, r0: 3.4, r1: 3.0 },
    foreArm: { mat: ARMOUR, r0: 2.9, r1: 2.7 },
    cuff: { mat: ARMOUR, r: 3.8, at: 0.04 },
    hand: { mat: ARMOUR, r: 3.5 },
    neck: { mat: SKIN, r: 2.6 },
    hips: [{ c: [0, 3.2, 0], r: [5.4, 5.6, 7.2], id: 1 }],
    chest: [
      { c: [0, 8.5, 0], r: [5, 5.2, 6.8], id: 1 },
      { c: [0.3, 15.5, 0], r: [5.9, 9.2, 8.6], id: 1 },
    ],
    torso,
  },
  headPieces: [
    collar({
      outer: COAT,
      lining: LINING,
      c: [-1, 32, 0],
      r: [8.6, 12.5, 10.4],
      bottom: 20.5,
      top: { back: 32.5, side: 30, front: 26.5 },
      open: 44,
    }),
  ],
  outfit: [
    plates({
      side: 1,
      plates: [
        { c: [0, 2.4, 1.2], r: [5.6, 4.2, 5.4] },
        { c: [-0.2, -0.4, 2.2], r: [5.1, 3.6, 4.8] },
        { c: [-0.3, -3, 2.8], r: [4.5, 3.1, 4.2] },
      ],
      mat: ARMOUR,
      rim: SILVER,
    }),
    plates({
      side: -1,
      plates: [
        { c: [0, 2, 0.8], r: [4.7, 3.6, 4.6] },
        { c: [-0.2, -0.6, 1.8], r: [4.1, 3, 4] },
      ],
      mat: ARMOUR,
      rim: SILVER,
    }),
    skirt({
      outer: COAT,
      inner: LINING,
      waist: 5.6,
      ring: [6.2, 8.2],
      aline: 0.3,
      fan: 0.9,
      folds: true,
      // Short front flaps, long tails at either side and a tail down the back: split three ways.
      panels: [
        { from: 30, to: 78, len: 18, jag: 2.4 },
        { from: 84, to: 150, len: 32, jag: 4.5, taper: 1.1, kick: 0.25 },
        { from: 156, to: 204, len: 29, jag: 4, taper: 1.05, kick: 0.4 },
        { from: -150, to: -84, len: 32, jag: 4.5, taper: 1.1, kick: 0.25 },
        { from: -78, to: -30, len: 18, jag: 2.4 },
      ],
    }),
  ],
  weapon: blade({
    blade: [
      [5, 3.4],
      [5, -3.4],
      [9, -4.6],
      [13, -4.6],
      [15.6, -2.8],
      [16.2, -4.9],
      [21, -4.5],
      [23.6, -2.7],
      [24.2, -4.8],
      [29, -4.4],
      [31.6, -2.7],
      [32.2, -4.7],
      [37, -4.3],
      [39.6, -2.8],
      [40.2, -4.5],
      [47, -4.1],
      [56, -2.6],
      [64, 0.2],
      [59, 2.8],
      [52, 4.8],
      [40, 5.5],
      [20, 5.3],
      [9, 4.8],
    ],
    edge: { from: 8, width: 1.7, mat: EDGE },
    spine: { v: -3.5, from: 7, to: 46, mat: STEEL },
    rune: { v: -0.3, from: 10, to: 46, colour: hex('#e01a34'), glow: hex('#ff3a52'), marks: [17, 25, 33, 41] },
    steel: STEEL,
    guard: {
      pts: [
        [6.4, -4.6],
        [4.4, -8.6],
        [7, -13.4],
        [1.6, -12],
        [0, -5.4],
        [0, 5.4],
        [1.6, 12],
        [7, 13.4],
        [4.4, 8.6],
        [6.4, 4.6],
      ],
      mat: GUARD,
      gem: { u: 3.2, r: 1.6, mat: GEM },
    },
    grip: { from: -10, to: 0.6, r: 1.7, mat: GRIP, wrap: flat(hex('#1c0a0c')) },
    pommel: { u: -12, r: 2.6, mat: GUARD, gem: flat(hex('#f02a40')) },
    grip2: -6.5,
    reach: [8, 64],
  }),
  aura: { core: hex('#c81a34'), edge: hex('#8c3ce0'), hot: hex('#fff2f2') },
};

export default DARK_KNIGHT;
export { DARK_KNIGHT };
