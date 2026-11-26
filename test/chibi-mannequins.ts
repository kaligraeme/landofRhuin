/**
 * Two test mannequins for the chibi engine's hair, cloth and face options (not registered heroes):
 *
 *  - ROBED: a slim figure about 80 px tall with long hair down her back, a lock over each shoulder
 *    framing her face, a short cape from the shoulders, a knee-length robe-coat cut away at the
 *    front, and the soft face style;
 *  - LANKY: a tall, long-legged figure with a high ponytail tied with a cord, loose locks over his
 *    forehead, a long scarf wrapped round his neck with two tails, a split skirt, and the sharp
 *    face style (smirking at rest).
 *
 * Each has poses for a stand, a run, a spin (a full turn) and a fall. test/chibi-look.test.ts
 * checks them; a scratch script can paint them into contact sheets.
 */
import { hex } from '../src/client/art/heroes/paint.js';
import { blade } from '../src/client/art/heroes/chibi/blade.js';
import type { BodyDesign, ChibiDesign, Lock } from '../src/client/art/heroes/chibi/design.js';
import { curtain, FACE_SHARP, FACE_SOFT } from '../src/client/art/heroes/chibi/head.js';
import { cape, collar, plates, scarf, skirt } from '../src/client/art/heroes/chibi/pieces.js';
import { type Hit, mat4 } from '../src/client/art/heroes/chibi/raster.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });
const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

// ── The robed mannequin ──────────────────────────────────────────────────────────────────────

const R_SKIN = mat4('#fff0e0', '#f6cfab', '#d8a27c', '#a26c4e', '#6e3c2c', 0.18);
const R_HAIR = mat4('#ffffff', '#f4f2fa', '#c8c4dc', '#8e8aa8', '#5e5a78', 0.05);
const R_ROBE = { ...mat4('#a884de', '#8c66c8', '#5c3f96', '#35205e', '#1e1238', -0.02), gain: 0.6 };
const R_LINING = mat4('#4a3470', '#35245a', '#241640', '#160c2a', '#0c0618');
const R_CAPE = { ...mat4('#7c58b8', '#5e3e9c', '#40246e', '#26124a', '#140828', -0.05), gain: 0.6 };
const R_PANEL = mat4('#ffffff', '#e8e2f4', '#b6aed0', '#7c7496', '#4a4460', 0.1);
const R_GOLD = mat4('#fff8dc', '#f2e6c0', '#c8b88a', '#7e7050', '#4a4028', 0.12);
const R_LEGS = mat4('#6a5878', '#4a3a56', '#30263e', '#1c1626', '#0e0a14', -0.05);
const R_BOOT = mat4('#7a6488', '#5a4668', '#3e2e4a', '#261c30', '#120c18', -0.05);
const R_SOLE = mat4('#2a2030', '#1e1824', '#141018', '#0c080e', '#06040a');
const R_STEEL = mat4('#f4f6fc', '#cfd4e2', '#9aa0b4', '#646a80', '#2a2c3a', 0.1);

const ROBED_BODY: BodyDesign = {
  thigh: { mat: R_LEGS, r0: 3.3, r1: 2.8 },
  shin: { mat: R_LEGS, r0: 2.6, r1: 2.4 },
  boot: { mat: R_BOOT, r: 3.1, top: 0.5, toe: 5.4, heel: 2, sole: R_SOLE },
  upperArm: { mat: R_ROBE, r0: 2.8, r1: 2.5 },
  foreArm: { mat: R_ROBE, r0: 2.5, r1: 2.3 },
  cuff: { mat: R_GOLD, r: 2.9, at: 0.72 },
  hand: { mat: R_SKIN, r: 2.5 },
  neck: { mat: R_SKIN, r: 2.1 },
  hips: [{ c: [0, 3, 0], r: [4.6, 5, 6], id: 1 }],
  chest: [
    { c: [0, 8, 0], r: [4.2, 4.6, 5.6], id: 1 },
    { c: [0.3, 14, 0], r: [4.9, 8, 7], id: 1 },
  ],
  torso: (h, where) => {
    const u = h.p[1];
    const yaw = deg(h);
    if (where === 'hips') return u > 4.4 ? R_ROBE : R_LEGS;
    if (u < 5) return null;
    // A gold-buckled sash.
    if (u < 7.6) return yaw < 10 ? R_GOLD : R_ROBE;
    // The pale panel down the front, edged in gold.
    if (yaw < 22) return yaw > 18 ? R_GOLD : R_PANEL;
    return R_ROBE;
  },
};

const ROBED_LOCKS: Lock[] = [
  // The crown: big smooth clumps lying back over the head.
  L(10, 58, [-0.9, -0.15, 0.1], 11, 5.4, [-0.1, -0.3, 0], 0.6, 0.4),
  L(70, 34, [-0.9, -0.25, 0.3], 10, 4.8, [-0.1, -0.3, 0], 0.6, 0.4),
  L(-70, 34, [-0.9, -0.25, -0.3], 10, 4.8, [-0.1, -0.3, 0], 0.6, 0.4),
  // A soft fringe swept across to her left.
  L(28, 40, [0.45, -1, -0.5], 6.8, 3.4, [0.1, 0, -0.2], 0.3, 0.3),
  L(2, 46, [0.5, -1, -0.6], 7.4, 3.4, [0.1, 0, -0.2], 0.3, 0.3),
  L(-26, 42, [0.4, -1, -0.55], 7.6, 3.2, [0.1, 0, -0.15], 0.3, 0.3),
  L(-52, 30, [0.2, -1, -0.3], 6, 2.6, [0.1, 0, -0.1], 0.3),
];

export const ROBED: ChibiDesign = {
  id: 'mannequin-robed',
  build: { hip: 26, thigh: 11.5, shin: 11.5, ankle: 4, torso: 22, neck: 2, shoulder: 7, hipWidth: 3.6, shoulderDrop: 3.2, upperArm: 8.2, foreArm: 8, headUp: 11.5 },
  head: {
    skin: R_SKIN,
    hair: R_HAIR,
    skull: { c: [0, 0.5, 0], r: [8.8, 9.3, 9.8] },
    jaw: { c: [1.5, -4, 0], r: [7.4, 6.4, 7.6] },
    ear: { c: [-0.6, -3.2, 9.4], r: [1.8, 2.6, 1.5] },
    shell: { c: [-1.4, 1.2, 0], r: [11, 10.2, 10.9] },
    hairline: { faceYaw: 72, brow: 3.6, temple: 0, nape: -9, ear: -2 },
    locks: ROBED_LOCKS,
    whorl: { yaw: 180, pitch: 55, reach: 80, clumps: 6, twist: 0.25 },
    long: {
      back: curtain({ from: 112, to: 248, count: 6, pitch: 8, len: 29, w: 3.2, jag: 0.35, taper: 0.5 }),
      front: [
        { yaw: 64, pitch: 8, dir: [0.35, -1, -0.12], len: 24, w: 2.4, taper: 0.5 },
        { yaw: -64, pitch: 8, dir: [0.35, -1, 0.12], len: 24, w: 2.4, taper: 0.5 },
      ],
      lie: 2.2,
    },
    face: {
      eye: [8.3, -1.8, 4.2],
      lash: hex('#2a1a2e'),
      iris: hex('#4a3a9a'),
      irisLight: hex('#8a7ae0'),
      irisDeep: hex('#2a1e60'),
      white: hex('#f6f2f6'),
      shine: hex('#ffffff'),
      brow: hex('#8e8aa8'),
      browUp: 3.6,
      mouth: hex('#a04a50'),
      mouthAt: [9.1, -6.6],
      noseAt: [9.7, -4],
      style: FACE_SOFT,
    },
  },
  body: ROBED_BODY,
  headPieces: [
    collar({ outer: R_ROBE, lining: R_LINING, c: [-0.8, 29, 0], r: [7.2, 10.5, 8.8], bottom: 19, top: { back: 29.5, side: 27.5, front: 25 }, open: 40 }),
  ],
  outfit: [
    skirt({
      outer: R_ROBE,
      inner: R_LINING,
      waist: 5.2,
      ring: [5.2, 6.6],
      aline: 0.3,
      fan: 0.8,
      folds: true,
      trim: R_GOLD,
      legs: 3.8,
      // Cut away at the front from the hip: short at the sides of the front, to the knee behind.
      panels: [
        { from: 40, to: 100, len: 17, jag: 1.5 },
        { from: 100, to: 160, len: 24, jag: 2, kick: 0.2 },
        { from: 160, to: 200, len: 26, jag: 2.5, kick: 0.3 },
        { from: 200, to: 260, len: 24, jag: 2, kick: 0.2 },
        { from: 260, to: 320, len: 17, jag: 1.5 },
      ],
    }),
    cape({ outer: R_CAPE, inner: R_LINING, top: 19.5, ring: [5.2, 7.8], from: 112, to: 248, len: 18, jag: 2, taper: 1.15, folds: true, trim: R_GOLD, over: { chest: ROBED_BODY.chest, hips: ROBED_BODY.hips, pad: 0.8 } }),
  ],
  weapon: blade({
    blade: [
      [3, 1.6],
      [3, -1.6],
      [30, -1.4],
      [38, 0],
      [30, 1.4],
    ],
    edge: { from: 4, width: 0.8, mat: R_STEEL },
    steel: R_STEEL,
    guard: {
      pts: [
        [3, -1.8],
        [5, -5],
        [1.4, -4.4],
        [0, -1.6],
        [0, 1.6],
        [1.4, 4.4],
        [5, 5],
        [3, 1.8],
      ],
      mat: R_GOLD,
    },
    grip: { from: -6, to: 0.4, r: 1.3, mat: R_LEGS },
    pommel: { u: -7.2, r: 1.8, mat: R_GOLD },
    grip2: -3.5,
    reach: [4, 38],
  }),
  aura: { core: hex('#b98cff'), edge: hex('#d8f4ff'), hot: hex('#ffffff') },
};

// ── The lanky mannequin ──────────────────────────────────────────────────────────────────────

const K_SKIN = mat4('#f8d8b8', '#e8b48c', '#c88a64', '#94583e', '#5c2c20', 0.14);
const K_HAIR = mat4('#5a6a88', '#2e3446', '#1c2030', '#0e1018', '#06070c', -0.1);
const K_SCARF = { ...mat4('#ff7a7e', '#de4a50', '#a8242e', '#64121a', '#3a0810', 0.02), gain: 0.7 };
const K_SCARF_IN = mat4('#a8343c', '#7c1a24', '#561018', '#36080e', '#200408');
const K_ARMOUR = { ...mat4('#c4ccd8', '#8a96a8', '#5c6678', '#363d4a', '#1a1e26', -0.2), clear: 1.2 };
const K_TEAL = { ...mat4('#6ad0c4', '#3aa39a', '#1f7570', '#0f4744', '#072624', -0.02), gain: 0.6 };
const K_TEAL_IN = mat4('#1a5a56', '#124440', '#0a302c', '#061e1c', '#030f0e');
const K_TROUSERS = mat4('#5a5a64', '#3e3e48', '#2a2a32', '#1a1a20', '#0c0c10', -0.05);
const K_BOOT = mat4('#3a3640', '#28252e', '#1a1820', '#100e14', '#08070a', -0.05);
const K_LEATHER = mat4('#9a6a48', '#76502f', '#52361e', '#321f11', '#180c07', -0.05);
const K_SILVER = mat4('#f0f2f8', '#c4c8d4', '#9096a6', '#5c6070', '#2a2c36', 0.12);
const K_CORD = mat4('#ff8a8a', '#e83040', '#a8182a', '#600a18', '#30040a', 0.1);

const LANKY_BODY: BodyDesign = {
  thigh: { mat: K_TROUSERS, r0: 3.6, r1: 3.1 },
  shin: { mat: K_ARMOUR, r0: 2.9, r1: 2.7 },
  boot: { mat: K_BOOT, r: 3.5, top: 0.5, toe: 6, heel: 2.4, sole: R_SOLE, cap: K_ARMOUR },
  upperArm: { mat: K_TEAL, r0: 3, r1: 2.7 },
  foreArm: { mat: K_ARMOUR, r0: 2.7, r1: 2.5 },
  cuff: { mat: K_ARMOUR, r: 3.3, at: 0.1, rim: K_SILVER },
  hand: { mat: K_LEATHER, r: 3 },
  neck: { mat: K_SKIN, r: 2.4 },
  hips: [{ c: [0, 3, 0], r: [5, 5.4, 6.6], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.6, 5, 6.2], id: 1 },
    { c: [0.3, 15, 0], r: [5.4, 8.6, 7.8], id: 1 },
  ],
  torso: (h, where) => {
    const u = h.p[1];
    const yaw = deg(h);
    if (where === 'hips') return u > 4.6 ? K_TEAL : K_TROUSERS;
    if (u < 5) return null;
    if (u < 7.8) return yaw < 10 ? K_SILVER : K_LEATHER;
    // A fitted breastplate over the teal tunic.
    if (yaw < 70 && u > 9) return K_ARMOUR;
    return K_TEAL;
  },
};

const LANKY_LOCKS: Lock[] = [
  // Hair swept back to the tie, the clumps fanning from it (see the whorl).
  L(30, 50, [-0.85, 0.3, 0.2], 11, 5, [-0.1, -0.15, 0], 1, 0.4),
  L(-30, 50, [-0.85, 0.3, -0.2], 11, 5, [-0.1, -0.15, 0], 1, 0.4),
  L(84, 24, [-0.95, 0.15, 0.2], 10, 4.4, [-0.1, 0.1, 0], 1, 0.4),
  L(-84, 24, [-0.95, 0.15, -0.2], 10, 4.4, [-0.1, 0.1, 0], 1, 0.4),
  // Loose locks over the forehead.
  L(-12, 42, [0.55, -1, -0.15], 7.6, 2.8, [0.15, 0, -0.1], 0.4, 0.3),
  L(16, 40, [0.5, -1, 0.25], 6.6, 2.6, [0.15, 0, 0.1], 0.4, 0.3),
  L(42, 30, [0.3, -1, 0.5], 5.6, 2.4, [0.1, 0, 0.15], 0.4),
  // Sideburns.
  L(70, 4, [0.1, -1, 0.3], 5, 2.2, [0.1, 0, 0.1], 0.3),
  L(-70, 4, [0.1, -1, -0.3], 5, 2.2, [0.1, 0, -0.1], 0.3),
];

const SCARF = scarf({
  mat: K_SCARF,
  inner: K_SCARF_IN,
  wrap: { u: 24.6, r: [6, 6.8], h: 2.8, muffle: 0.9 },
  knot: 205,
  tails: [
    { len: 40, w: 2.8, fork: 1.5 },
    { len: 33, w: 2.6, fork: 1.5 },
  ],
  over: { chest: LANKY_BODY.chest, hips: LANKY_BODY.hips, pad: 1.6 },
});

export const LANKY: ChibiDesign = {
  id: 'mannequin-lanky',
  build: { hip: 29, thigh: 13.5, shin: 13.5, ankle: 4, torso: 23, neck: 2.2, shoulder: 8, hipWidth: 4, shoulderDrop: 3.4, upperArm: 9, foreArm: 9, headUp: 12 },
  head: {
    skin: K_SKIN,
    hair: K_HAIR,
    skull: { c: [0, 0.5, 0], r: [9.2, 9.6, 10] },
    jaw: { c: [1.6, -4.2, 0], r: [7.6, 6.8, 7.8] },
    ear: { c: [-0.6, -3.2, 9.7], r: [2, 2.8, 1.6] },
    shell: { c: [-1.6, 1, 0], r: [11.2, 10.2, 11] },
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -8, ear: -1.6 },
    locks: LANKY_LOCKS,
    darkHair: true,
    whorl: { yaw: 180, pitch: 40, reach: 95, clumps: 8, twist: 0 },
    long: {
      tail: { yaw: 180, pitch: 40, dir: [-1, 0.4, 0], stiff: 0.3, len: 44, w: 3.8, tie: { mat: K_CORD, r: 2.6, ends: 6 } },
      front: [
        { yaw: 58, pitch: 18, dir: [0.4, -1, 0.15], len: 13, w: 2.4, taper: 0.5 },
        { yaw: -58, pitch: 18, dir: [0.4, -1, -0.15], len: 12, w: 2.2, taper: 0.5 },
      ],
    },
    face: {
      eye: [8.8, -1.6, 4.1],
      lash: hex('#1a1012'),
      iris: hex('#b06a14'),
      irisLight: hex('#f0b040'),
      white: hex('#f6eee4'),
      shine: hex('#ffffff'),
      brow: hex('#1c2030'),
      browUp: 3.2,
      mouth: hex('#5a2018'),
      mouthAt: [9.8, -6.6],
      noseAt: [10.3, -3.9],
      style: FACE_SHARP,
      rest: 'smirk',
    },
  },
  body: LANKY_BODY,
  headPieces: [SCARF.wrap],
  outfit: [
    plates({ side: 1, plates: [{ c: [0, 2, 1], r: [4.6, 3.6, 4.4] }, { c: [-0.2, -0.6, 1.8], r: [4.1, 3, 4] }], mat: K_ARMOUR, rim: K_SILVER }),
    skirt({
      outer: K_TEAL,
      inner: K_TEAL_IN,
      waist: 5.4,
      ring: [5.6, 7.2],
      aline: 0.32,
      fan: 0.8,
      folds: true,
      legs: 4.2,
      // A split skirt to mid-thigh.
      panels: [
        { from: 20, to: 80, len: 14, jag: 1.5 },
        { from: 90, to: 170, len: 15, jag: 2 },
        { from: 190, to: 270, len: 15, jag: 2 },
        { from: 280, to: 340, len: 14, jag: 1.5 },
      ],
    }),
    SCARF.tails,
  ],
  weapon: {
    grip2: -4,
    reach: [2, 10],
    // Empty hands: a fist with nothing in it.
    paint: () => {},
  },
  aura: { core: hex('#6fe3c1'), edge: hex('#ffffff'), hot: hex('#ffffff') },
};

// ── Poses ────────────────────────────────────────────────────────────────────────────────────

/** Standing at ease, hands at the sides (the robed one's sword hanging point down). */
export const STAND: ChibiPose = { x: 0, y: 1, lean: 2, twist: 4, head: -2, look: 2, footF: [3, 0, 3.8], footB: [-3, 0, 3.6], handF: [3, 14, 7], handB: [1, 14, 7.5], weapon: 150, roll: 10, yaw: 15, wind: 0.08, phase: 0 };

/** The stride: contact, down, passing, flight, then the same with the other leg (as the Dark Knight's). */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [10, 0], b: [-8, -5.5], y: 2 },
  { f: [5.5, 0], b: [-6.5, -9], y: 3.4 },
  { f: [0, 0], b: [2, -7.5], y: 1 },
  { f: [-5.5, -1.5], b: [8, -3.5], y: -2.2 },
];

/** A run of 8 frames. */
export const RUN: ChibiPose[] = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 20,
    twist: swing * 9,
    head: -8,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 3.6] : [k.b[0], k.b[1], 3.6],
    footB: right ? [k.b[0], k.b[1], 3.4] : [k.f[0], k.f[1], 3.4],
    handF: [-3 - swing * 5, 13 - Math.abs(swing) * 2, 8.5],
    handB: [2 + swing * 6, 12 - Math.abs(swing) * 2.5, 8],
    weapon: -120,
    roll: 0,
    yaw: -30,
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
  };
});

/** A full turn toward his right in 8 frames, arms out, the hair and cloth flaring and lagging behind. */
export const SPIN: ChibiPose[] = Array.from({ length: 8 }, (_, i): ChibiPose =>
  pose(STAND, {
    y: 3,
    lean: 6,
    turn: i * 45,
    handF: [6, 4, 14],
    handB: [4, 5, 14],
    weapon: 90,
    roll: 0,
    yaw: 70,
    wind: 0.45,
    flare: 0.6,
    sway: -0.6,
    lift: 0.15,
    phase: i / 8,
  }),
);

const DOWN: ChibiPose = { x: -8, y: 19, lean: -86, twist: 0, turn: -60, head: -16, look: 24, footF: [14, 0, 6], footB: [12, -1, 2], handF: [11, 5, 16], handB: [-4, 2, 11], drop: true, dropAt: [-16, 1.5, 22], weapon: 90, roll: 80, yaw: 0, face: 'closed', wind: 0, lift: -0.4 };

/** Knocked down: a stagger back, onto the knees, toppling back and lying still. */
export const FALL: ChibiPose[] = [
  pose(STAND, { x: -3, y: 4, lean: -12, twist: -8, tilt: -5, head: -14, handF: [4, 12, 5], handB: [-2, 9, 11], face: 'hurt', sway: -0.4, lift: 0.3, wind: 0.2 }),
  pose(STAND, { x: -2, y: 12, lean: 8, head: 16, footF: [-7, -1, 4], footB: [-8, -1, 3.6], kneel: 'F', handF: [7, 15, 5], handB: [3, 15, 6], weapon: 160, face: 'hurt', wind: 0, flare: 0.2 }),
  pose(STAND, { x: -2, y: 13, lean: -10, tilt: -8, turn: -20, head: 2, footF: [-5, -1, 4], footB: [-7, -1, 3.6], kneel: 'F', handF: [5, 16, 12], handB: [2, 16, 9], weapon: 165, face: 'closed', lift: 0.2 }),
  pose(DOWN, { x: -5, y: 15, lean: -45, turn: -45, head: -8, look: 10, footF: [6, -3, 5], footB: [3, -1, 3.6], handF: [5, 4, 14], handB: [0, 6, 11], lift: 0.6 }),
  pose(DOWN, {}),
];

/** The clips the mannequins are shown in. */
export const LOOK_CLIPS: Record<'stand' | 'run' | 'spin' | 'fall', readonly ChibiPose[]> = {
  stand: [STAND, pose(STAND, { y: 1.4, phase: 0.5, sway: 0.15, face: 'closed' })],
  run: RUN,
  spin: SPIN,
  fall: FALL,
};

/** Every expression, for checking the face styles. */
export const FACES: readonly NonNullable<ChibiPose['face']>[] = ['stern', 'shout', 'grit', 'hurt', 'closed', 'smirk'];

/** Frame boxes big enough for the mannequins in every view. */
export const BOX = { w: 200, h: 170, ax: 100, ay: 130 };

export const MANNEQUINS: readonly ChibiDesign[] = [ROBED, LANKY];
