/**
 * The Arbalest, as a chibi: a compact, sturdy crossbowman with a tanned, weathered face, sharp
 * grey-green eyes, short ginger hair swept back off his brow and a short ginger beard, brass
 * goggles with amber lenses pushed up on his forehead, a weathered brown leather coat to
 * mid-thigh, belted and open over a slate-blue padded jerkin, a steel pauldron on his leading
 * (left) shoulder, a bandolier of bolts across his chest, leather bracers and gloves, dark
 * trousers and heavy boots strapped with brass buckles. He carries a heavy crossbow: a dark walnut
 * stock with brass bands, a steel prod, a cocking lever along the fore-stock and a bolt with
 * orange fletching. His shots flash amber-orange with a white core and leave pale gold trails.
 * Everything here is data for the chibi engine (and his own gear in gear.ts); his moves are in
 * the moves-*.ts files beside it, and hero.ts puts him together.
 */
import { hex } from '../../paint.js';
import { strap } from '../back.js';
import { crossbow } from '../crossbow.js';
import type { ChibiDesign, Lock } from '../design.js';
import { beard } from '../head.js';
import { collar, plates, skirt } from '../pieces.js';
import { flat, type Hit, type Mat, mat4 } from '../raster.js';
import type { Build } from '../rig.js';
import { buckles, goggles, type LeverSpec, withLever } from './gear.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Tanned, a little weathered.
const SKIN = mat4('#f8d2ac', '#e6aa80', '#c4845c', '#8e5640', '#4e2618', 0.18);
// Ginger, worn as dark hair is (design `darkHair`): the clumps in a warm ginger, their lit sides a
// pale ginger with a near-white glint on the brightest, rust in their hollows and a deep brown line.
const HAIR = mat4('#ffc890', '#f4a066', '#d0723a', '#9c4a1e', '#5e2a0e', -0.05);
// The beard a touch deeper than the hair on his head, so it reads as a beard and not as more of the face.
const BEARD = mat4('#f4a066', '#d0723a', '#9c4a1e', '#5e2a0e', '#2e1206', -0.2);
// Weathered brown leather: the coat, its sleeves and its collar.
const COAT = { ...mat4('#b07a4e', '#7c5234', '#4e321e', '#2a1a0e', '#170d06', -0.02), gain: 0.8 };
const COAT_EDGE = mat4('#c89464', '#9a6a44', '#6a4428', '#3a2414', '#170d06');
const COAT_SEAM = mat4('#4e321e', '#3c2616', '#2a1a0e', '#1e1209', '#170d06');
const COAT_IN = mat4('#6a4a34', '#4e3424', '#36221a', '#22150e', '#120a06');
// The padded jerkin under the coat, slate blue, quilted in bands.
const JERKIN = mat4('#8a9eb8', '#6a7e9a', '#46566e', '#2c3646', '#161c26', -0.05);
const JERKIN_SEAM = mat4('#46566e', '#3a4860', '#2c3646', '#1e2632', '#161c26');
// Darker, redder leather: the belt, the bandolier, the bracers and gloves.
const STRAP = mat4('#8a5a3c', '#664028', '#462a1a', '#2a180e', '#140b05', -0.05);
// Buckskin gloves, paler than the coat, so his hands and the grip read against it.
const GLOVE = mat4('#e8cca0', '#c4a070', '#94724a', '#5e462c', '#261a0e', -0.05);
const TROUSERS = mat4('#5a5e6c', '#3e424e', '#2a2d36', '#1a1c22', '#0b0c10', -0.08);
const BOOT = mat4('#7a5440', '#58392a', '#3c261a', '#24160e', '#120a05', -0.08);
const SOLE = mat4('#2e221c', '#221914', '#18110d', '#0e0a07', '#080504');
const BRASS = mat4('#fff2b8', '#f0c860', '#c0902c', '#7e5612', '#3a2606', 0.05);
const STEEL = { ...mat4('#d4d8e2', '#a0a6b4', '#70768a', '#464b5c', '#1c1e27', -0.1), clear: 1.2 };
const STEEL_EDGE = mat4('#eef0f6', '#c8ccd6', '#9298a8', '#5c6272', '#1c1e27', 0.05);
// Aged brass on the bracers' rims, duller than the buckles.
const BRONZE = mat4('#d8b070', '#a88040', '#7a5a28', '#4e3814', '#24180a');
// Amber glass in the goggles.
const AMBER = mat4('#fff4c0', '#ffc860', '#e88a20', '#a04e0c', '#4a2204', 0.1);
// The crossbow: dark walnut, a steel prod and an iron trigger and stirrup.
const WALNUT = mat4('#8e5e3e', '#6c442a', '#4a2c1a', '#2e190d', '#140a04', -0.02);
const PROD = mat4('#f2f4fa', '#c8ccd8', '#8e94a6', '#5a5f70', '#262833', 0.05);
const IRON = mat4('#a8acb8', '#7c8090', '#565a6a', '#363946', '#16181f');
const STRING = mat4('#f2ead6', '#f2ead6', '#f2ead6', '#f2ead6', '#f2ead6');
// Bolts: pale ash shafts, steel heads, orange fletching.
const SHAFT = mat4('#d8b888', '#b8925e', '#8a6a42', '#5a4428', '#2a1e10');
const FLETCH = mat4('#ffc890', '#ff9440', '#d8601c', '#8a340c', '#401606', 0.05);
const BOLT_HEAD = mat4('#f2f4fa', '#c8ccd8', '#8e94a6', '#5a5f70', '#262833', 0.05);
// The belt's lower edge.
const BELT_EDGE = flat(hex('#1e120a'));

// ── Build: compact and sturdy, the Dark Knight's proportions ─────────────────────────────────

const BUILD: Build = {
  hip: 27,
  thigh: 12,
  shin: 12,
  ankle: 4,
  torso: 24,
  neck: 2,
  shoulder: 8.8,
  hipWidth: 4.4,
  shoulderDrop: 3.6,
  upperArm: 9,
  foreArm: 9,
  headUp: 12,
};

// ── Hair: short, swept back ──────────────────────────────────────────────────────────────────
// Short ginger hair combed back off a high brow: a lift at the front that sweeps up and back, broad
// clumps raked back over the top and the sides past his ears, their ends flicking out a little at
// the back of the crown, and short layers at the nape. No fringe, so the goggles pushed up on his
// forehead sit on the swept-back hair and his brow stays clear.

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // The lift at the front: broad clumps up off the brow and back over the top.
  L(-30, 38, [-0.45, 1, -0.35], 9, 4.4, [-0.6, -0.3, -0.05], 1.2, 0.35),
  L(0, 40, [-0.5, 1, 0], 10, 4.8, [-0.7, -0.35, 0], 1.2, 0.35),
  L(30, 38, [-0.45, 1, 0.35], 9, 4.4, [-0.6, -0.3, 0.05], 1.2, 0.35),
  // Raked back over the top, lying close, their ends curling down over the crown.
  L(-50, 62, [-1, 0.2, -0.3], 11, 4.6, [-0.1, -0.5, -0.1], 1.4, 0.3),
  L(10, 72, [-1, 0.25, 0.05], 12, 5, [-0.1, -0.55, 0], 1.4, 0.3),
  L(60, 62, [-1, 0.2, 0.35], 11, 4.6, [-0.1, -0.5, 0.1], 1.4, 0.3),
  // Swept back over the sides, past the ears, standing out a little.
  L(72, 30, [-1, 0.2, 0.45], 10, 4, [-0.1, -0.35, 0.1], 1, 0.35),
  L(-72, 30, [-1, 0.2, -0.45], 10, 4, [-0.1, -0.35, -0.1], 1, 0.35),
  L(108, 44, [-1, 0, 0.65], 9.5, 4.4, [-0.15, -0.35, 0.1], 1.2, 0.3),
  L(-108, 44, [-1, 0, -0.65], 9.5, 4.4, [-0.15, -0.35, -0.1], 1.2, 0.3),
  // The back of the crown: the swept clumps meet and their ends kick out a little.
  L(150, 50, [-0.8, -0.5, 0.5], 8, 4.4, [-0.15, 0.3, 0.15], 1.6, 0.3),
  L(180, 58, [-1, -0.4, 0], 8.5, 4.6, [-0.15, 0.3, 0], 1.6, 0.3),
  L(-150, 50, [-0.8, -0.5, -0.5], 8, 4.4, [-0.15, 0.3, -0.15], 1.6, 0.3),
  // Short tufts at the crown, swept back, so its outline is not a smooth cap.
  L(155, 66, [-0.85, 0.5, 0.3], 6.5, 3, [-0.1, -0.2, 0.05], 1.6, 0.3),
  L(-160, 62, [-0.85, 0.45, -0.35], 6, 3, [-0.1, -0.2, -0.05], 1.6, 0.3),
  L(-20, 76, [-0.7, 0.6, -0.3], 6, 2.8, [-0.1, -0.25, 0], 1.4, 0.3),
  // Short layers at the nape.
  L(135, 14, [-0.45, -1, 0.35], 5, 3.2, [-0.1, 0, 0.05], 0.8, 0.3),
  L(180, 10, [-0.45, -1, 0], 5.5, 3.4, [-0.1, 0, 0], 0.8, 0.3),
  L(-135, 14, [-0.45, -1, -0.35], 5, 3.2, [-0.1, 0, -0.05], 0.8, 0.3),
];

/** The hair's shell (head space): his hair lies close over the skull. */
const SHELL = { c: [-1.6, 2.4, 0] as const, r: [11.4, 11.2, 11.6] as const };
const SKULL = { c: [0, 0.5, 0] as const, r: [9.4, 9.7, 10.3] as const };

// ── The torso: a belted leather coat, open over the jerkin ───────────────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  // The hips: the jerkin's skirt and the trousers in the coat's opening, the coat elsewhere.
  if (where === 'hips') {
    if (yaw > 38) return COAT;
    return u > 3.2 ? JERKIN : TROUSERS;
  }
  if (u < 5) return null;
  // A broad belt round the coat, a brass buckle at the front.
  if (u < 8.4) {
    if (yaw < 12 && u > 5.5 && u < 7.9) return yaw < 7 && u > 6.2 && u < 7.2 ? STRAP : BRASS;
    return u > 7.7 ? BELT_EDGE : STRAP;
  }
  // The coat opens in a V over the jerkin, its lapels edged a shade paler; the jerkin is quilted
  // in bands, with a seam down its middle.
  const open = 26 + (u - 8) * 1.5;
  if (yaw < open) {
    if (yaw < 2.2) return JERKIN_SEAM;
    if (u > 9.5 && u < 20 && (u - 9.5) % 3.4 < 0.7) return JERKIN_SEAM;
    return JERKIN;
  }
  if (yaw < open + 5 && u < 21.5) return COAT_EDGE;
  // A seam down the middle of the back.
  if (yaw > 176) return COAT_SEAM;
  return COAT;
}

const BODY_HIPS = [{ c: [0, 3.2, 0] as const, r: [5.6, 5.6, 7.4] as const, id: 1 }];
const BODY_CHEST = [
  { c: [0, 8.5, 0] as const, r: [5.2, 5.2, 7] as const, id: 1 },
  { c: [0.3, 15.5, 0] as const, r: [6.2, 9.2, 8.9] as const, id: 1 },
];

// ── The crossbow ─────────────────────────────────────────────────────────────────────────────

/** A heavy bolt about 24 px: a pale shaft, a broad steel head that glows amber when charged, orange vanes. */
const BOLT = {
  len: 24,
  shaft: SHAFT,
  head: { len: 4, w: 1.8, mat: BOLT_HEAD, glow: hex('#ffb24a') },
  fletch: { len: 3.6, w: 1.5, mat: FLETCH },
};

/** The cocking lever along the right side of the fore-stock, hinged by the prod: folded back, its grip lies under his left hand. */
export const LEVER: LeverSpec = { hinge: 21, len: 11, out: 2.2, v: 0.6, mat: IRON, grip: STRAP };

/**
 * A heavy crossbow about 46 px from butt to nose: a deep walnut butt, a long fore-stock, brass
 * bands, a steel prod 15 px either side, an iron trigger and stirrup, and the lever.
 */
const CROSSBOW = withLever(
  crossbow({
    stock: {
      pts: [
        [-16, -2],
        [-5, -1.8],
        [1, -2.4],
        [28, -2.4],
        [29.5, -1.2],
        [29.5, 1.8],
        [8, 2.4],
        [2.4, 2],
        [-1.6, 2.2],
        [-7, 3.8],
        [-16, 5.6],
        [-17.4, 1.8],
      ],
      mat: WALNUT,
    },
    bands: { at: [-14.6, 4.5, 18, 27.5], mat: BRASS },
    prod: { at: 26.5, span: 15, sweep: 4, w: [1.9, 1.1], mat: PROD },
    string: STRING,
    latch: 3.5,
    groove: 2.4,
    trigger: { at: 0.5, len: 4.2, mat: IRON },
    stirrup: IRON,
    bolt: BOLT,
    grip2: 11,
  }),
  LEVER,
);

// ── The design ───────────────────────────────────────────────────────────────────────────────

export const ARBALEST: ChibiDesign = {
  id: 'hero-arbalest',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: SKULL,
    jaw: { c: [1.8, -4.1, 0], r: [8, 6.9, 8.4] },
    ear: { c: [-0.6, -3.2, 10], r: [2, 2.8, 1.6] },
    shell: SHELL,
    hairline: { faceYaw: 76, brow: 5.4, temple: 1, nape: -6.5, ear: -1.4 },
    locks: LOCKS,
    darkHair: true,
    lockLine: hex('#6e2c0c'),
    // Combed back: clumps run back over the head from the brow to a point low on the crown.
    whorl: { yaw: 180, pitch: 20, reach: 150, clumps: 9, twist: 0.05 },
    beard: beard({ kind: 'short', mat: BEARD, len: 3, thick: 0.9, cheek: -6.3, side: -2.4, mouth: [2.6, 1.4] }),
    moustache: { mat: BEARD, len: 3, w: 0.8, droop: 1 },
    face: {
      eye: [8.8, -1.7, 3.9],
      lash: hex('#24140e'),
      iris: hex('#3e5a4e'),
      irisLight: hex('#8cb4a2'),
      white: hex('#f2ece2'),
      shine: hex('#ffffff'),
      brow: hex('#8a3a12'),
      browUp: 3,
      mouth: hex('#5a2216'),
      mouthAt: [9.8, -6.6],
      noseAt: [10.4, -3.9],
    },
  },
  body: {
    thigh: { mat: TROUSERS, r0: 4.2, r1: 3.6 },
    shin: { mat: TROUSERS, r0: 3.4, r1: 3.2 },
    boot: { mat: BOOT, r: 4.3, top: 0.68, toe: 6.8, heel: 2.6, sole: SOLE, foot: [2.8, 2.6] },
    upperArm: { mat: COAT, r0: 3.6, r1: 3.2 },
    foreArm: { mat: COAT, r0: 3.1, r1: 2.8 },
    cuff: { mat: STRAP, r: 3.3, at: 0.34, rim: BRONZE },
    hand: { mat: GLOVE, r: 3.4 },
    neck: { mat: SKIN, r: 2.7 },
    hips: BODY_HIPS,
    chest: BODY_CHEST,
    torso,
  },
  headPieces: [
    collar({
      outer: COAT,
      lining: COAT_IN,
      c: [-1, 29.5, 0],
      r: [8.2, 11, 9.8],
      bottom: 19.5,
      top: { back: 28.5, side: 26.5, front: 24 },
      open: 52,
    }),
    goggles({
      strap: STRAP,
      brass: BRASS,
      glass: AMBER,
      shell: SHELL,
      skull: SKULL,
      up: { front: 7.6, back: 5.2, lens: 8.4, yaw: 28 },
      down: { front: -0.4, back: 1.6, lens: -1.7, yaw: 25 },
      r: 2.3,
      depth: 1.2,
    }),
  ],
  outfit: [
    // The steel pauldron on his leading (left) shoulder.
    plates({
      side: -1,
      plates: [
        { c: [0, 2.4, 1.2], r: [5.6, 4.2, 5.4] },
        { c: [-0.2, -0.4, 2.2], r: [5, 3.5, 4.8] },
        { c: [-0.3, -2.9, 2.8], r: [4.4, 3, 4.2] },
      ],
      mat: STEEL,
      rim: STEEL_EDGE,
    }),
    // The bandolier: over his left shoulder, down to his right hip, a row of bolts along it.
    strap({ mat: STRAP, side: -1, w: 1.5, at: 13, over: { chest: BODY_CHEST, hips: BODY_HIPS, pad: 0.7 }, studs: { every: 2.4, r: 0.75, len: 3.4, mat: SHAFT, from: 0.22, to: 0.72, across: true } }),
    // The coat below the belt: two front flaps and two tails parted by a vent at the back, to mid-thigh.
    skirt({
      outer: COAT,
      inner: COAT_IN,
      waist: 5.6,
      ring: [6.4, 8.4],
      aline: 0.32,
      fan: 0.7,
      give: 0.75,
      folds: true,
      trim: COAT_EDGE,
      panels: [
        { from: 34, to: 92, len: 14, jag: 1 },
        { from: 96, to: 174, len: 16, jag: 1.4, taper: 1.05, kick: 0.15 },
        { from: -174, to: -96, len: 16, jag: 1.4, taper: 1.05, kick: 0.15 },
        { from: -92, to: -34, len: 14, jag: 1 },
      ],
    }),
    buckles({ strap: STRAP, buckle: BRASS, at: 0.62, top: 0.68, r: 4.3 }),
  ],
  weapon: CROSSBOW,
  aura: { core: hex('#ffb24a'), edge: hex('#ffe6a0'), hot: hex('#ffffff') },
};
