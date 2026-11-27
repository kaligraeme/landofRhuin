/**
 * Test mannequins for the chibi engine's body and head options (not registered heroes):
 *
 *  - ELDER: an old man about 80 px tall with white hair to his shoulders, a full white beard to
 *    mid-chest and a moustache, a full-length robe that hangs over walking legs, and a hood worn
 *    down, lying behind his neck;
 *  - HOODED: a slim archer with a hood worn up over short hair (a side fringe and two strands
 *    framing her face inside it) and a cowl over her shoulders, a quiver of arrows on her back
 *    on a strap across her chest;
 *  - WARDEN: an armoured figure in an open-faced helm with a finned crest, scale-patterned plates
 *    over a scaled breastplate, a gorget, a short beard and a moustache, and a sheathed sword slung
 *    on his back;
 *  - BUNS: a figure with her hair worn up in two buns, a springy upright lock on her crown and a
 *    circlet with a gem; UPDO is the same head with one high twisted updo.
 *
 * Each has poses for a stand, a walk, a run, a spin, a gust of wind and a fall (`BODY_CLIPS`).
 * test/chibi-body.test.ts checks them; a scratch script can paint them into contact sheets.
 */
import { hex } from '../src/client/art/heroes/paint.js';
import { scaleAt } from '../src/client/art/heroes/chibi/armour.js';
import { quiver, slung } from '../src/client/art/heroes/chibi/back.js';
import { blade } from '../src/client/art/heroes/chibi/blade.js';
import type { BodyDesign, ChibiDesign, HeadDesign, Lock } from '../src/client/art/heroes/chibi/design.js';
import { beard, curtain, FACE_PLAIN, FACE_SHARP, FACE_SOFT } from '../src/client/art/heroes/chibi/head.js';
import { circlet, helm, hood } from '../src/client/art/heroes/chibi/headgear.js';
import { collar, cowl, plates, skirt } from '../src/client/art/heroes/chibi/pieces.js';
import { flat, type Hit, mat4 } from '../src/client/art/heroes/chibi/raster.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';
import { FALL, ROBED, RUN, SPIN, STAND } from './chibi-mannequins.js';

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number, bob?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly, bob });
const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

/** Empty hands: a fist with nothing in it. */
const EMPTY = { grip2: -4, reach: [2, 10] as const, paint: () => {} };

// ── The elder ────────────────────────────────────────────────────────────────────────────────

const E_SKIN = mat4('#ffe6cc', '#f0c49c', '#d09a74', '#9a6448', '#64342a', 0.16);
const E_HAIR = mat4('#ffffff', '#e4e4ea', '#acacb6', '#6e6e7a', '#3e3e4a', 0.1);
const E_ROBE = { ...mat4('#6a7ed4', '#3a4a9c', '#232c66', '#121838', '#0a0c20', -0.02), gain: 0.6 };
const E_LINING = mat4('#2a3060', '#1c2048', '#121434', '#0a0c20', '#060712');
const E_GOLD = mat4('#fff8d0', '#fff0b0', '#e2c264', '#9c7a2c', '#4a3810', 0.1);
const E_SHOE = mat4('#a87a5a', '#7c5636', '#563820', '#341f10', '#1a0e06', -0.05);
const E_SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');

const ELDER_BODY: BodyDesign = {
  thigh: { mat: E_ROBE, r0: 3.4, r1: 3 },
  shin: { mat: E_ROBE, r0: 2.8, r1: 2.6 },
  boot: { mat: E_SHOE, r: 3, top: 0.3, toe: 5, heel: 2, sole: E_SOLE, foot: [2.6, 2.2] },
  upperArm: { mat: E_ROBE, r0: 3, r1: 2.8 },
  foreArm: { mat: E_ROBE, r0: 2.9, r1: 3.2 },
  cuff: { mat: E_GOLD, r: 3.5, at: 0.74 },
  hand: { mat: E_SKIN, r: 2.5 },
  neck: { mat: E_SKIN, r: 2.2 },
  hips: [{ c: [0, 3, 0], r: [5, 5.4, 6.4], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.6, 5, 6.2], id: 1 },
    { c: [0.2, 14.5, 0], r: [5.2, 8.2, 7.4], id: 1 },
  ],
  torso: (h, where) => {
    const u = h.p[1];
    if (where === 'hips') return E_ROBE;
    if (u < 5) return null;
    // A corded gold belt, and the robe's gold-edged opening down the front.
    if (u > 6 && u < 8) return E_GOLD;
    return deg(h) < 6 ? E_GOLD : E_ROBE;
  },
};

const ELDER_LOCKS: Lock[] = [
  // White hair swept straight back from a high forehead.
  L(0, 52, [-0.95, 0.1, 0], 11, 5.4, [-0.2, -0.3, 0], 0.5, 0.4),
  L(48, 36, [-0.9, -0.1, 0.35], 10, 4.8, [-0.2, -0.4, 0], 0.5, 0.4),
  L(-48, 36, [-0.9, -0.1, -0.35], 10, 4.8, [-0.2, -0.4, 0], 0.5, 0.4),
  L(86, 10, [-0.6, -0.8, 0.3], 7, 3.4, [-0.1, -0.2, 0], 0.4),
  L(-86, 10, [-0.6, -0.8, -0.3], 7, 3.4, [-0.1, -0.2, 0], 0.4),
];

const ELDER_SHELL = { c: [-1.8, 1.6, 0] as const, r: [11, 10.4, 10.8] as const };

/** His hood, worn down: fallen back behind his neck onto his shoulders. */
const ELDER_HOOD = hood({ outer: E_ROBE, inner: E_LINING, rim: E_GOLD, shell: ELDER_SHELL, opening: { top: 5, bottom: -12, side: 8.6 }, peak: { pitch: 40, size: 3 }, folds: true, worn: 'down' });

export const ELDER: ChibiDesign = {
  id: 'mannequin-elder',
  build: { hip: 26, thigh: 11.5, shin: 11.5, ankle: 4, torso: 22.5, neck: 2, shoulder: 7.6, hipWidth: 3.8, shoulderDrop: 3.4, upperArm: 8.4, foreArm: 8.2, headUp: 11.5 },
  head: {
    skin: E_SKIN,
    hair: E_HAIR,
    skull: { c: [0, 0.5, 0], r: [9, 9.4, 9.9] },
    jaw: { c: [1.6, -4.1, 0], r: [7.6, 6.6, 7.9] },
    ear: { c: [-0.6, -3.2, 9.6], r: [2, 2.8, 1.6] },
    shell: ELDER_SHELL,
    hairline: { faceYaw: 70, brow: 5.6, temple: 1.5, nape: -8, ear: -1.6 },
    locks: ELDER_LOCKS,
    whorl: { yaw: 180, pitch: 40, reach: 90, clumps: 7, twist: 0.2 },
    long: {
      back: curtain({ from: 118, to: 242, count: 5, pitch: 6, len: 16, w: 3.2, jag: 0.25, taper: 0.5 }),
      lie: 1.8,
    },
    beard: beard({ kind: 'full', len: 15 }),
    moustache: { len: 4.6, w: 1.4, droop: 2.4 },
    face: {
      eye: [8.6, -1.6, 4],
      lash: hex('#2a1a16'),
      iris: hex('#3a6a8a'),
      irisLight: hex('#7ab0d0'),
      white: hex('#f6f2ee'),
      shine: hex('#ffffff'),
      brow: hex('#f4f4f8'),
      browUp: 3.2,
      mouth: hex('#8a4038'),
      mouthAt: [9.6, -6.6],
      noseAt: [10.1, -3.9],
      style: FACE_PLAIN,
    },
  },
  body: ELDER_BODY,
  headPieces: [ELDER_HOOD.up],
  outfit: [
    ELDER_HOOD.down,
    // A full-length robe: panels all round, to the ankles, kept clear of the striding legs.
    skirt({
      outer: E_ROBE,
      inner: E_LINING,
      waist: 5.4,
      ring: [5.4, 6.8],
      aline: 0.36,
      fan: 0.5,
      give: 0.5,
      folds: true,
      trim: E_GOLD,
      legs: 4,
      panels: [
        { from: -30, to: 30, len: 22.5 },
        { from: 30, to: 90, len: 22.5 },
        { from: 90, to: 150, len: 22.5 },
        { from: 150, to: 210, len: 22.5 },
        { from: 210, to: 270, len: 22.5 },
        { from: 270, to: 330, len: 22.5 },
      ],
    }),
  ],
  weapon: EMPTY,
  aura: { core: hex('#6fe8c8'), edge: hex('#e4fff6'), hot: hex('#ffffff') },
};

// ── The hooded archer ────────────────────────────────────────────────────────────────────────

const H_SKIN = mat4('#fff0e0', '#f6cfab', '#d8a27c', '#a26c4e', '#6e3c2c', 0.18);
const H_HAIR = mat4('#8e6448', '#6e4a36', '#4a2e20', '#2a1a10', '#160c06', -0.05);
const H_HOOD = { ...mat4('#a6dc80', '#7cbc5a', '#4e8a3a', '#2e5a26', '#173016', -0.02), gain: 0.65 };
const H_HOOD_IN = mat4('#2e5a26', '#24481e', '#173016', '#0e2010', '#081208');
const H_HOOD_RIM = { ...mat4('#c6ec9c', '#9cd47a', '#6aa44e', '#3e6e30', '#173016', 0.02), gain: 0.65 };
const H_LEATHER = mat4('#b07a52', '#8a5a3a', '#5c3a24', '#36220f', '#1a1008', -0.05);
const H_TROUSERS = mat4('#ecd6a8', '#d8bc8a', '#b0925e', '#7a6038', '#3e2e18', 0);
const H_BOOT = mat4('#9a6448', '#76482f', '#52301e', '#321c11', '#180c07', -0.05);
const H_SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');
const H_QUIVER = mat4('#c07a4c', '#9a5834', '#6c3a20', '#40200f', '#200e06', -0.02);
const H_BRASS = mat4('#fff2c4', '#e8c86a', '#b08a3a', '#6e5220', '#382808', 0.05);
const H_SHAFT = flat(hex('#d8b080'));
const H_FLETCH = mat4('#ffffff', '#f4f0e4', '#d0c8b4', '#988e7a', '#4e463a', 0.1);

const HOODED_BODY: BodyDesign = {
  thigh: { mat: H_TROUSERS, r0: 3.3, r1: 2.8 },
  shin: { mat: H_TROUSERS, r0: 2.6, r1: 2.4 },
  boot: { mat: H_BOOT, r: 3.1, top: 0.55, toe: 5.4, heel: 2, sole: H_SOLE },
  upperArm: { mat: H_LEATHER, r0: 2.8, r1: 2.5 },
  foreArm: { mat: H_SKIN, r0: 2.3, r1: 2.2 },
  cuff: { mat: H_LEATHER, r: 2.8, at: 0.2 },
  hand: { mat: H_LEATHER, r: 2.5 },
  neck: { mat: H_SKIN, r: 2.1 },
  hips: [{ c: [0, 3, 0], r: [4.6, 5, 6], id: 1 }],
  chest: [
    { c: [0, 8, 0], r: [4.2, 4.6, 5.6], id: 1 },
    { c: [0.3, 14, 0], r: [4.9, 8, 7], id: 1 },
  ],
  torso: (h, where) => {
    const u = h.p[1];
    if (where === 'hips') return u > 4.4 ? H_LEATHER : H_TROUSERS;
    if (u < 5) return null;
    // A fitted leather jerkin with a brass-buckled belt.
    if (u < 7.4) return deg(h) < 9 ? H_BRASS : H_BOOT;
    return H_LEATHER;
  },
};

const HOODED_SHELL = { c: [-1.4, 1.2, 0] as const, r: [11, 10.2, 10.9] as const };

const HOODED_LOCKS: Lock[] = [
  // A side fringe swept across to her left, under the hood's edge.
  L(24, 42, [0.5, -1, -0.45], 7, 3.4, [0.1, 0, -0.2], 0.3, 0.3),
  L(-4, 46, [0.5, -1, -0.6], 7.6, 3.4, [0.1, 0, -0.2], 0.3, 0.3),
  L(-30, 40, [0.4, -1, -0.5], 7.4, 3.2, [0.1, 0, -0.15], 0.3, 0.3),
  // Two strands framing her face inside the hood.
  L(62, 20, [0.25, -1, 0.1], 12, 2.4, [0.05, 0, 0.05], 0.5, 0.3),
  L(-62, 20, [0.25, -1, -0.1], 12, 2.4, [0.05, 0, -0.05], 0.5, 0.3),
  // The crown and the back (hidden under the hood while it is up).
  L(10, 60, [-0.9, -0.15, 0.1], 11, 5.4, [-0.1, -0.3, 0], 0.6, 0.4),
  L(150, 20, [-0.5, -1, 0.2], 9, 4.4, [-0.1, -0.2, 0], 0.6, 0.4),
  L(-150, 20, [-0.5, -1, -0.2], 9, 4.4, [-0.1, -0.2, 0], 0.6, 0.4),
];

const HOOD = hood({ outer: H_HOOD, inner: H_HOOD_IN, rim: H_HOOD_RIM, shell: HOODED_SHELL, opening: { top: 6.4, bottom: -12.5, side: 8.4 }, peak: { pitch: 38, size: 3.4 }, folds: true });

const HOODED_HEAD: HeadDesign = {
  skin: H_SKIN,
  hair: H_HAIR,
  skull: { c: [0, 0.5, 0], r: [8.8, 9.3, 9.8] },
  jaw: { c: [1.5, -4, 0], r: [7.4, 6.4, 7.6] },
  ear: { c: [-0.6, -3.2, 9.4], r: [1.8, 2.6, 1.5] },
  shell: HOODED_SHELL,
  hairline: { faceYaw: 72, brow: 3.6, temple: 0, nape: -9, ear: -2 },
  locks: HOODED_LOCKS,
  face: {
    eye: [8.3, -1.8, 4.2],
    lash: hex('#2a1a16'),
    iris: hex('#2e7a3a'),
    irisLight: hex('#7ad07a'),
    irisDeep: hex('#1a4a22'),
    white: hex('#f6f2f6'),
    shine: hex('#ffffff'),
    brow: hex('#4a2e20'),
    browUp: 3.6,
    mouth: hex('#a04a50'),
    mouthAt: [9.1, -6.6],
    noseAt: [9.7, -4],
    style: FACE_SOFT,
  },
};

export const HOODED: ChibiDesign = {
  id: 'mannequin-hooded',
  build: { hip: 26, thigh: 11.5, shin: 11.5, ankle: 4, torso: 22, neck: 2, shoulder: 7, hipWidth: 3.6, shoulderDrop: 3.2, upperArm: 8.2, foreArm: 8, headUp: 11.5 },
  head: HOODED_HEAD,
  body: HOODED_BODY,
  headPieces: [HOOD.up],
  outfit: [
    HOOD.down,
    // A short hooded cape: to the chest at the front, over the upper arms, to the hips behind.
    cowl({
      outer: H_HOOD,
      inner: H_HOOD_IN,
      top: 21.4,
      ring: [3.6, 4.2],
      folds: true,
      panels: [
        { from: -40, to: 40, len: 11, jag: 2.5 },
        { from: 40, to: 110, len: 12, jag: 1.5 },
        { from: 110, to: 180, len: 18, jag: 2 },
        { from: 180, to: 250, len: 18, jag: 2 },
        { from: 250, to: 320, len: 12, jag: 1.5 },
      ],
      over: { chest: HOODED_BODY.chest, hips: HOODED_BODY.hips },
    }),
    quiver({
      mouth: [-6.4, 22, 3.6],
      foot: [-6, 5, -3.5],
      r: [2.6, 2.1],
      mat: H_QUIVER,
      band: H_BRASS,
      arrows: { n: 4, out: 5.5, shaft: H_SHAFT, fletch: H_FLETCH },
      strap: { mat: H_BOOT, side: 1, w: 1, over: { chest: HOODED_BODY.chest, hips: HOODED_BODY.hips } },
    }),
  ],
  weapon: EMPTY,
  aura: { core: hex('#9ef08a'), edge: hex('#fff4b0'), hot: hex('#ffffff') },
};

// ── The armoured warden ──────────────────────────────────────────────────────────────────────

const W_SKIN = mat4('#f6d0a8', '#e2a67e', '#c2805e', '#8e5442', '#5c2a22', 0.16);
const W_HAIR = mat4('#e0a070', '#c06a3a', '#8a4420', '#52260e', '#2a1206', -0.05);
const W_METAL = { ...mat4('#b8a8f0', '#7e68c8', '#4e3e8e', '#2a2054', '#120c24', -0.1), clear: 1.2 };
const W_EDGE = mat4('#f4f0ff', '#d8ccff', '#a898e0', '#6a5aa8', '#2a2048', 0.1);
const W_UNDER = mat4('#4e3e8e', '#2a2054', '#1c1438', '#120c24', '#08060e', -0.2);
// The scales' rims: a lit lilac, between the metal and its pale edges.
const W_SCALE = { ...mat4('#e8e0ff', '#b8a8f0', '#8a78cc', '#4e3e8e', '#120c24', 0.05), clear: 1.2 };
const W_SUIT = mat4('#5a5a66', '#3a3a46', '#24242e', '#14141a', '#0a0a0e', -0.05);
const W_LEATHER = mat4('#8a5a3a', '#6a4028', '#46281a', '#28160c', '#140a06', -0.05);
const W_SHEATH = mat4('#6a4a6a', '#4a2e4a', '#301c30', '#1c101c', '#0c060c', -0.05);
const W_SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');

const W_CHEST = [
  { c: [0, 8.5, 0] as const, r: [4.6, 5, 6.2] as const, id: 1 },
  { c: [0.3, 15, 0] as const, r: [5.4, 8.6, 7.8] as const, id: 1 },
];

const WARDEN_BODY: BodyDesign = {
  thigh: { mat: W_SUIT, r0: 3.6, r1: 3.1 },
  shin: { mat: W_METAL, r0: 2.9, r1: 2.7 },
  boot: { mat: W_METAL, r: 3.5, top: 0.5, toe: 6, heel: 2.4, sole: W_SOLE, cap: W_EDGE },
  knee: { mat: W_EDGE, r: 2.4 },
  upperArm: { mat: W_SUIT, r0: 3, r1: 2.7 },
  foreArm: { mat: W_METAL, r0: 2.7, r1: 2.5 },
  cuff: { mat: W_METAL, r: 3.3, at: 0.1, rim: W_EDGE },
  hand: { mat: W_LEATHER, r: 3, knuckle: W_EDGE },
  neck: { mat: W_SKIN, r: 2.4 },
  hips: [{ c: [0, 3, 0], r: [5, 5.4, 6.6], id: 1 }],
  chest: W_CHEST,
  torso: (h, where) => {
    const u = h.p[1];
    if (where === 'hips') return u > 4.6 ? W_LEATHER : W_SUIT;
    if (u < 5) return null;
    if (u < 7.8) return W_LEATHER;
    // A breastplate of overlapping scales over the chest; plain plate round the back.
    const yaw = deg(h);
    if (yaw > 75) return W_METAL;
    const part = scaleAt(Math.atan2(h.p[2], h.p[0]) * 6.5 + 40, 26 - u, 5, 3.6);
    return part === 'face' ? W_METAL : part === 'rim' ? W_SCALE : W_UNDER;
  },
};

const WARDEN_SHELL = { c: [-1.6, 1.6, 0] as const, r: [11.2, 10.6, 10.8] as const };

const WARDEN_LOCKS: Lock[] = [
  // Short ginger hair: a fringe under the brow band, and the sides and nape below the helm.
  L(-14, 34, [0.55, -1, -0.15], 6, 2.8, [0.15, 0, -0.1], 0.4, 0.3),
  L(16, 32, [0.5, -1, 0.25], 5.6, 2.6, [0.15, 0, 0.1], 0.4, 0.3),
  L(78, 0, [0.05, -1, 0.3], 5, 2.4, [0.1, 0, 0.1], 0.3),
  L(-78, 0, [0.05, -1, -0.3], 5, 2.4, [0.1, 0, -0.1], 0.3),
  L(150, -6, [-0.4, -1, 0.2], 6, 3.4, [-0.1, 0, 0], 0.4),
  L(-150, -6, [-0.4, -1, -0.2], 6, 3.4, [-0.1, 0, 0], 0.4),
  // A crest of hair on the crown, hidden under the helm.
  L(0, 70, [-0.6, 0.6, 0], 9, 4.4, [-0.2, -0.2, 0], 0.6, 0.4),
];

/** A short sword about 30 px, to sling on a chibi's back. */
const SHORT_SWORD = blade({
  blade: [
    [3, 1.8],
    [3, -1.8],
    [21, -1.7],
    [26, 0],
    [21, 1.7],
  ],
  edge: { from: 5, width: 0.8, mat: W_EDGE },
  steel: W_EDGE,
  guard: { pts: [[3, -1.6], [3.4, -4.6], [1.4, -4.6], [0, -1.6], [0, 1.6], [1.4, 4.6], [3.4, 4.6], [3, 1.6]], mat: W_METAL },
  grip: { from: -5, to: 0.4, r: 1.3, mat: W_LEATHER },
  pommel: { u: -6.2, r: 1.7, mat: W_METAL },
  grip2: -3,
  reach: [4, 26],
});

/** Swept-back fins rising behind the temples, a smaller one behind each. */
const FIN_SHAPE: readonly (readonly [number, number])[] = [
  [0, 0],
  [1.5, 3.4],
  [4.5, 6.2],
  [9, 8.6],
  [7.4, 5.2],
  [11.5, 5.6],
  [7.2, 2],
  [4, -0.4],
];

export const WARDEN: ChibiDesign = {
  id: 'mannequin-warden',
  build: { hip: 27, thigh: 12, shin: 12, ankle: 4, torso: 24, neck: 2, shoulder: 8.6, hipWidth: 4.3, shoulderDrop: 3.6, upperArm: 9, foreArm: 9, headUp: 12 },
  head: {
    skin: W_SKIN,
    hair: W_HAIR,
    skull: { c: [0, 0.5, 0], r: [9.4, 9.7, 10.3] },
    jaw: { c: [1.7, -4.1, 0], r: [7.9, 6.8, 8.2] },
    ear: { c: [-0.6, -3.2, 10], r: [2, 2.8, 1.6] },
    shell: WARDEN_SHELL,
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -7.5, ear: -1.6 },
    locks: WARDEN_LOCKS,
    beard: beard({ kind: 'short', cheek: -5.6, side: -2 }),
    moustache: { len: 4.2, w: 1.3, droop: 1.6, at: [10, -5.2] },
    face: {
      eye: [8.8, -1.7, 3.9],
      lash: hex('#1a1012'),
      iris: hex('#6a8a7a'),
      irisLight: hex('#a8d0b8'),
      white: hex('#f6eee4'),
      shine: hex('#ffffff'),
      brow: hex('#8a4420'),
      browUp: 3,
      mouth: hex('#6a2a20'),
      mouthAt: [9.8, -6.6],
      noseAt: [10.3, -3.9],
      style: FACE_SHARP,
    },
  },
  body: WARDEN_BODY,
  headPieces: [
    helm({
      metal: W_METAL,
      trim: W_EDGE,
      shell: WARDEN_SHELL,
      edge: { front: 3.6, side: -0.5, back: -2.5 },
      cheeks: { down: -7.4, forward: 2.6 },
      ridge: W_EDGE,
      scales: { w: 5.2, h: 3.6, rim: W_SCALE, under: W_UNDER },
      fins: [
        { yaw: 96, pitch: 20, dir: [-1, 0.05, 0.4], rise: [0, 1, 0.9], shape: FIN_SHAPE },
        { yaw: -96, pitch: 20, dir: [-1, 0.05, -0.4], rise: [0, 1, -0.9], shape: FIN_SHAPE },
      ],
    }),
    // A gorget of three lames, closed round the neck.
    collar({ outer: W_METAL, lining: W_UNDER, c: [0, 21, 0], r: [6.6, 5.6, 8], bottom: 21, top: { back: 26, side: 25.4, front: 24.6 }, open: 0, lames: 3 }),
  ],
  outfit: [
    plates({ side: 1, plates: [{ c: [0, 2, 1], r: [4.8, 3.8, 4.6] }, { c: [-0.2, -0.6, 1.8], r: [4.3, 3.2, 4.2] }], mat: W_METAL, rim: W_EDGE, scales: { w: 4.4, h: 3.2, rim: W_SCALE, under: W_UNDER } }),
    plates({ side: -1, plates: [{ c: [0, 2, 1], r: [4.8, 3.8, 4.6] }, { c: [-0.2, -0.6, 1.8], r: [4.3, 3.2, 4.2] }], mat: W_METAL, rim: W_EDGE, scales: { w: 4.4, h: 3.2, rim: W_SCALE, under: W_UNDER } }),
    // A sheathed sword slung across his back, its hilt over his right shoulder, on a studded baldric.
    slung({
      item: SHORT_SWORD,
      at: [-6.6, 22, 5.4],
      dir: [-0.12, -0.8, -0.6],
      sheath: { from: 1.5, to: 27, r: [2.1, 1.6], mat: W_SHEATH, band: W_EDGE },
      strap: { mat: W_LEATHER, side: 1, w: 1.1, over: { chest: W_CHEST, hips: [{ c: [0, 3, 0], r: [5, 5.4, 6.6], id: 1 }] }, studs: { every: 3.4, r: 0.8, mat: W_EDGE } },
    }),
  ],
  weapon: EMPTY,
  aura: { core: hex('#b48cff'), edge: hex('#e8e0ff'), hot: hex('#ffffff') },
};

// ── Hair worn up ─────────────────────────────────────────────────────────────────────────────

const B_HAIR = mat4('#5a6a88', '#2e3446', '#1c2030', '#0e1018', '#06070c', -0.1);
const B_RIBBON = mat4('#ff9aa8', '#e84a5c', '#b02234', '#68101c', '#300810', 0.05);
const B_GOLD = mat4('#fff8dc', '#f2e6c0', '#c8b88a', '#7e7050', '#4a4028', 0.12);
const B_GEM = mat4('#d0f4ff', '#6ad0f0', '#2a8ac0', '#14507a', '#082840', 0.1);

const BUNS_LOCKS: Lock[] = [
  // Hair drawn up and back from the face toward the buns.
  L(0, 52, [-0.95, 0.3, 0], 10, 5.2, [-0.1, -0.1, 0], 0.4, 0.4),
  L(60, 34, [-0.8, 0.45, 0.25], 9, 4.6, [-0.1, -0.1, 0], 0.4, 0.4),
  L(-60, 34, [-0.8, 0.45, -0.25], 9, 4.6, [-0.1, -0.1, 0], 0.4, 0.4),
  // A short fringe and side locks.
  L(-10, 42, [0.55, -1, -0.2], 6.4, 3, [0.15, 0, -0.1], 0.3, 0.3),
  L(18, 40, [0.5, -1, 0.25], 6, 2.8, [0.15, 0, 0.1], 0.3, 0.3),
  L(70, 6, [0.15, -1, 0.3], 8, 2.4, [0.1, 0, 0.1], 0.4),
  L(-70, 6, [0.15, -1, -0.3], 8, 2.4, [0.1, 0, -0.1], 0.4),
  // A single springy lock standing up from the crown.
  L(12, 80, [0.15, 1, 0.05], 10.5, 2.5, [0.5, -0.2, 0], 0.7, 0.5, 0.8),
];

const BUNS_HEAD: HeadDesign = {
  ...ROBED.head,
  hair: B_HAIR,
  darkHair: true,
  long: undefined,
  locks: BUNS_LOCKS,
  whorl: { yaw: 180, pitch: 40, reach: 95, clumps: 8, twist: 0 },
  face: { ...ROBED.head.face, brow: hex('#1c2030') },
  buns: [
    { yaw: 116, pitch: 40, r: [4, 3.6, 4], twist: 0.35, clumps: 5, tie: { mat: B_RIBBON, r: 0.9 } },
    { yaw: -116, pitch: 40, r: [4, 3.6, 4], twist: 0.35, clumps: 5, tie: { mat: B_RIBBON, r: 0.9 } },
  ],
};

export const BUNS: ChibiDesign = {
  ...ROBED,
  id: 'mannequin-buns',
  head: BUNS_HEAD,
  headPieces: [circlet({ mat: B_GOLD, shell: ROBED.head.shell, front: 4.6, back: 7.4, gem: { mat: B_GEM, r: 1.4 } })],
  outfit: ROBED.outfit.slice(0, 1),
  weapon: EMPTY,
};

/** The same head with its hair in one high twisted updo. */
export const UPDO: ChibiDesign = {
  ...BUNS,
  id: 'mannequin-updo',
  head: { ...BUNS_HEAD, buns: [{ yaw: 180, pitch: 60, r: [3.4, 5.4, 3.4], twist: 1.3, clumps: 6, lean: [-0.4, 0.5, 0], tie: { mat: B_GOLD, r: 1 } }] },
};

// ── Poses ────────────────────────────────────────────────────────────────────────────────────

/** A walk of 8 frames: a slow, stately stride, the arms swinging a little. */
export const WALK: ChibiPose[] = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const a = (2 * Math.PI * i) / 8;
  const s = Math.sin(a);
  const lift = (k: number): number => Math.max(0, k) * 3;
  return {
    x: 0,
    y: 1.4 - Math.abs(Math.cos(a)) * 0.8,
    lean: 6,
    twist: s * 6,
    head: -2,
    footF: [s * 7, -lift(Math.cos(a)), 3.8],
    footB: [-s * 7, -lift(-Math.cos(a)), 3.6],
    handF: [-s * 4, 14, 7.5],
    handB: [s * 4, 14, 7.5],
    weapon: 150,
    wind: 0.3,
    phase: i / 8,
    sway: s * 0.1,
  };
});

/** Standing in a gust of wind: the hair, beard and cloth streaming back, then lifting. */
export const GUST: ChibiPose[] = [pose(STAND, { wind: 1, phase: 0.2 }), pose(STAND, { wind: 1.2, lift: 0.5, sway: 0.4, phase: 0.6 })];

/** The clips the body mannequins are shown in. */
export const BODY_CLIPS: Record<'stand' | 'walk' | 'run' | 'spin' | 'gust' | 'fall', readonly ChibiPose[]> = {
  stand: [STAND, pose(STAND, { y: 1.4, phase: 0.5, sway: 0.15, face: 'closed' })],
  walk: WALK,
  run: RUN,
  spin: SPIN,
  gust: GUST,
  // The hood falls back as he goes down.
  fall: FALL.map((p, i) => (i >= 3 ? { ...p, hood: 'down' as const } : p)),
};

/** Frame boxes big enough for the mannequins in every view. */
export const BODY_BOX = { w: 200, h: 170, ax: 100, ay: 130 };

export const BODY_MANNEQUINS: readonly ChibiDesign[] = [ELDER, HOODED, WARDEN, BUNS, UPDO];
