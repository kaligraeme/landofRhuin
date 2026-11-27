/**
 * The Dragoon, as a chibi: a lean, long-legged young lancer with a cocky half-smile, jet-black
 * hair with a cool blue sheen swept back into a high ponytail tied with a red cord (a few loose
 * locks over his brow), a long red scarf wrapped round his neck and jaw with two tails streaming
 * behind him, light gunmetal armour (a fitted breastplate, a layered pauldron on his leading left
 * shoulder, vambraces and greaves) over a teal sleeveless tunic with a split skirt to mid-thigh,
 * dark trousers and black boots with steel toe caps, and a halberd-lance longer than he is tall:
 * a dark lacquered haft with steel bands and a butt spike, a long leaf-shaped point with a jade
 * channel, an axe blade, a back spike, flared lugs and a teal ribbon. His wind is pale jade-mint
 * with a white edge. Everything here is data for the chibi engine; his moves are in the
 * moves-*.ts files beside it, and hero.ts puts him together.
 */
import { hex } from '../../paint.js';
import type { BodyDesign, ChibiDesign, FaceStyle, Lock } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { plates, scarf, skirt } from '../pieces.js';
import { pole, type PoleSpec } from '../pole.js';
import { flat, type Hit, type Mat, mat4 } from '../raster.js';
import type { Build } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Lightly tanned.
const SKIN = mat4('#f8d6b2', '#e6ae84', '#c4865e', '#8e553a', '#57291c', 0.14);
// Jet black with a cool blue sheen: the light tone covers the clumps, the highlight streaks their lit sides.
const HAIR = mat4('#5a6a88', '#2e3446', '#1c2030', '#0e1018', '#06070c', -0.04);
// The scarf: the brightest colour on him.
const SCARF = { ...mat4('#ff7f82', '#de4a50', '#a8242e', '#64121a', '#36070e', 0.06), gain: 0.75 };
const SCARF_IN = mat4('#d24a52', '#a82a34', '#741822', '#460c14', '#200408');
// Light gunmetal plate with pale steel edges: mostly its base tone, so the red scarf and the teal stay the brightest colours on him.
const ARMOUR = { ...mat4('#c4ccd8', '#8a96a8', '#5c6678', '#363d4a', '#171a22', -0.28), clear: 1.2, gain: 0.8 };
const ARMOUR_RIDGE = mat4('#d6dce6', '#a4aebe', '#76808f', '#4a5260', '#171a22', 0.12);
const STEEL_EDGE = mat4('#f2f5fa', '#d0d6e0', '#a6aebd', '#727b8a', '#262a33', 0.12);
// Teal cloth: one colour with its light tone only on the folds that catch the light.
const TEAL = { ...mat4('#6ad0c4', '#3aa39a', '#1f7570', '#0f4744', '#062422', -0.02), gain: 0.62 };
const TEAL_IN = mat4('#1c5e5a', '#134844', '#0b322f', '#061e1c', '#030f0e');
const TROUSERS = mat4('#5c5c68', '#40404c', '#2c2c36', '#1b1b22', '#0b0b10', -0.06);
const BOOT = mat4('#46424e', '#2e2b34', '#1e1c23', '#121116', '#070609', -0.04);
const SOLE = mat4('#2a2630', '#1e1b22', '#141217', '#0c0a0e', '#060508');
const LEATHER = mat4('#a2724c', '#7c5434', '#583a22', '#362212', '#1a0e06', -0.04);
// Dark leather gloves.
const GLOVE = mat4('#7a5a48', '#55392b', '#3a261c', '#24160f', '#100906', -0.04);
const SILVER = mat4('#ffffff', '#dfe4ee', '#aab2c2', '#6e7686', '#2a2e38', 0.14);
// The belt's lower edge.
const BELT_EDGE = flat(hex('#24160c'));
// A red cord ties the ponytail.
const CORD = mat4('#ff8a8a', '#e8303e', '#a8182a', '#600a18', '#30040a', 0.1);

// The halberd: a dark lacquered haft (a deep red-brown with a glossy light tone), dark steel
// fittings, a bright steel head with pale edges, and a teal ribbon.
const LACQUER = mat4('#a0645a', '#6a362e', '#44201c', '#261010', '#0e0606', -0.02);
const FITTING = mat4('#b4bcc8', '#7c8596', '#525a6a', '#30353f', '#131519');
const HEAD_STEEL = mat4('#f0f3f8', '#c4cad6', '#8e96a8', '#596072', '#22252e', 0.06);
const HEAD_EDGE = mat4('#ffffff', '#f2f5fa', '#cfd5e0', '#97a0b0', '#2a2d36', 0.12);
const WRAP = mat4('#6a5040', '#4c3628', '#34241a', '#1e140e', '#0c0806', -0.04);
const RIBBON = { ...mat4('#7fe0d4', '#3aa39a', '#1f7570', '#0f4744', '#062422', 0.08), gain: 0.8 };

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** Lean and long in the leg: hips four pixels higher than the Dark Knight's on a shorter torso, narrower shoulders. */
const BUILD: Build = {
  hip: 31,
  thigh: 14,
  shin: 14,
  ankle: 4,
  torso: 22.5,
  neck: 2.2,
  shoulder: 7.8,
  hipWidth: 4,
  shoulderDrop: 3.4,
  upperArm: 9.4,
  foreArm: 9.4,
  headUp: 12,
};

// ── Hair: swept back into a high ponytail, loose locks over the brow ─────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // Swept back over the top toward the tie, close to the head.
  L(0, 54, [-1, 0.25, 0], 11, 4.8, [-0.15, -0.3, 0], 0.5, 0.4),
  L(40, 40, [-1, 0.2, -0.2], 10.5, 4, [-0.1, -0.25, -0.1], 0.5, 0.4),
  L(-40, 40, [-1, 0.2, 0.2], 10.5, 4, [-0.1, -0.25, 0.1], 0.5, 0.4),
  // Loose locks falling over the forehead: one long over his left brow, a shorter pair.
  L(-14, 42, [0.55, -1, -0.2], 7, 2.8, [0.2, 0, -0.14], 0.45, 0.3),
  L(12, 44, [0.6, -1, 0.18], 5.2, 2.5, [0.18, 0, 0.12], 0.45, 0.3),
  L(36, 34, [0.35, -1, 0.45], 4.4, 2.2, [0.1, 0, 0.15], 0.4),
  // Sideburns in front of the ears.
  L(70, 4, [0.1, -1, 0.3], 5, 2.1, [0.1, 0, 0.1], 0.3),
  L(-70, 4, [0.1, -1, -0.3], 5, 2.1, [0.1, 0, -0.1], 0.3),
];

// ── His face: the sharp style, with each eye kept to itself ──────────────────────────────────

/**
 * The sharp style (FACE_SHARP: narrow eyes under a heavy lid that sweeps up to the outer corner, a
 * slit of amber iris with a bright shine, straight brows, a lopsided smirk) with the inner corners
 * of the eyes and brows pulled back from the nose, so toward the viewer his two eyes and brows
 * stay apart instead of running together across the bridge of his nose. Shouting, the eye opens a
 * row higher but keeps no dark lower lash, so it never closes into a dark-framed band.
 */
const FACE_DRAGOON: FaceStyle = {
  ...FACE_SHARP,
  eyes: {
    ...FACE_SHARP.eyes,
    full: { rows: ['..KKK', 'KKhIK', '.iIIW', '..ll.'], ax: 2, ay: 1 },
    mid: { rows: ['..KKK', '.KhIK', '.iIIK', '..l..'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKK', 'KhIIK', '.iIIW', '..ll.'], ax: 2, ay: 1 },
  },
  brows: {
    full: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
    mid: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
};

// ── The torso: belt, breastplate, the teal tunic at the sides and back under leather straps ─

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  // The tunic covers his hips all round (its skirt hangs from them), so no dark seat of the
  // trousers shows between the flaps.
  if (where === 'hips') return TEAL;
  if (u < 5) return null;
  // A brown leather belt with a silver buckle.
  if (u < 8) {
    if (yaw < 12 && u > 5.5 && u < 7.6) return yaw < 7 && u > 6.1 && u < 7 ? LEATHER : SILVER;
    return u > 7.4 ? BELT_EDGE : LEATHER;
  }
  // The fitted breastplate: pale steel along its edges and its lower rim, a ridge down the middle.
  const side = 76 - Math.max(0, u - 19) * 2.2;
  if (yaw < side) {
    if (yaw > side - 5 || u < 9.6) return STEEL_EDGE;
    if (yaw < 3 && u > 10) return ARMOUR_RIDGE;
    return ARMOUR;
  }
  // A leather strap across the back of the tunic, from his left shoulder down to his right hip.
  if (yaw > 110) {
    const x = (180 - yaw) * (h.p[2] >= 0 ? 1 : -1);
    if (Math.abs(x + (u - 15) * 5) < 7) return LEATHER;
  }
  return TEAL;
}

const BODY: BodyDesign = {
  thigh: { mat: TROUSERS, r0: 3.7, r1: 3.1 },
  shin: { mat: ARMOUR, r0: 3, r1: 2.7 },
  boot: { mat: BOOT, r: 3.5, top: 0.5, toe: 6.2, heel: 2.4, sole: SOLE, cap: ARMOUR },
  knee: { mat: ARMOUR, r: 2.6 },
  // Bare upper arms (the tunic is sleeveless), gunmetal vambraces.
  upperArm: { mat: SKIN, r0: 2.8, r1: 2.5 },
  foreArm: { mat: ARMOUR, r0: 2.7, r1: 2.5 },
  cuff: { mat: ARMOUR, r: 3.1, at: 0.12, rim: ARMOUR_RIDGE },
  hand: { mat: GLOVE, r: 3, knuckle: ARMOUR_RIDGE },
  neck: { mat: SKIN, r: 2.4 },
  hips: [{ c: [0, 3.6, 0], r: [4.8, 4.6, 6.3], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.6, 5, 6.1], id: 1 },
    { c: [0.4, 15, 0], r: [5.5, 8.8, 7.8], id: 1 },
  ],
  torso,
};

const SCARF_PIECES = scarf({
  mat: SCARF,
  inner: SCARF_IN,
  wrap: { u: 23.6, r: [6.1, 6.9], h: 2.9, muffle: 0.45 },
  knot: 205,
  // Two long tails of different lengths, narrowing to forked ends. Blown away from the viewer
  // they climb behind his shoulders rather than standing out to his side.
  tails: [
    { len: 44, w: 3.1, fork: 1.6, taper: 0.5, climb: 0.95 },
    { len: 35, w: 2.7, fork: 1.4, taper: 0.5, climb: 0.45 },
  ],
  ripple: 2.6,
  over: { chest: BODY.chest, hips: BODY.hips, pad: 1.6 },
});

/** The halberd-lance, about 104 px from the butt spike to the point: taller than he is. */
const HALBERD: PoleSpec = {
  haft: { from: -35, to: 44, r: 1.35, mat: LACQUER },
  butt: { len: 5, r: 1.7, mat: FITTING, spike: true },
  bands: { at: [-28, -14, 16, 34], len: 1.5, mat: FITTING },
  wraps: [{ from: -8, to: 5, mat: WRAP, cord: flat(hex('#140c08')) }],
  metal: HEAD_STEEL,
  edge: HEAD_EDGE,
  socket: { from: 40, to: 46, r: 1.8 },
  point: { from: 45.5, len: 20, w: 3.2, belly: 0.3 },
  axe: { from: 45, to: 52, out: 8.2, beard: 3.8 },
  spike: { at: 49.5, len: 6.5, w: 1.6, hook: 2.2 },
  lugs: { at: 41.5, len: 4.4, w: 1.1, sweep: 2.8 },
  ribbon: { at: 38.5, len: 17, w: 1.5, mat: RIBBON },
  rune: { from: 48.5, to: 62, rest: hex('#2a7a64'), colour: hex('#6fe3c1'), glow: hex('#c8ffef'), marks: [52.5, 57.5] },
  grip2: 12,
};

/** Where the tip of the butt spike is along the haft (u, from the right hand's rest grip): where a planted halberd meets the floor. */
export const BUTT = HALBERD.haft.from - (HALBERD.butt?.len ?? 0);

const DRAGOON: ChibiDesign = {
  id: 'hero-dragoon',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.2, 9.6, 10] },
    jaw: { c: [1.6, -4.2, 0], r: [7.6, 6.8, 7.7] },
    // Small, round ears, tucked in under the hair.
    ear: { c: [-0.6, -3.4, 9.5], r: [1.7, 2.2, 1.4] },
    shell: { c: [-1.6, 1.2, 0], r: [11.2, 10.4, 11] },
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -7, ear: -1.6 },
    locks: LOCKS,
    lockLine: hex('#06070c'),
    // The back of the head: clumps fanning from the tie down to the nape.
    whorl: { yaw: 180, pitch: 42, reach: 110, clumps: 7, twist: 0 },
    long: {
      // Tied high at the back of the head, falling past his shoulder blades.
      tail: { yaw: 180, pitch: 42, dir: [-1, 0.55, 0], stiff: 0.28, len: 46, w: 3, give: 1.1, tie: { mat: CORD, r: 2.6, ends: 7 }, sheen: 0.45 },
      // Two loose locks framing his face.
      front: [
        { yaw: 60, pitch: 16, dir: [0.4, -1, 0.15], len: 13, w: 2.3, taper: 0.5, give: 0.6 },
        { yaw: -60, pitch: 16, dir: [0.4, -1, -0.15], len: 11.5, w: 2.1, taper: 0.5, give: 0.6 },
      ],
      lie: 2,
    },
    face: {
      eye: [8.8, -1.6, 4.1],
      lash: hex('#140c10'),
      iris: hex('#b8721a'),
      irisLight: hex('#ffc04a'),
      irisDeep: hex('#6e3a08'),
      white: hex('#f6eee4'),
      shine: hex('#ffffff'),
      brow: hex('#141822'),
      browUp: 3.2,
      mouth: hex('#5a2018'),
      mouthAt: [9.8, -6.1],
      noseAt: [10.3, -3.9],
      style: FACE_DRAGOON,
      rest: 'smirk',
    },
  },
  body: BODY,
  headPieces: [SCARF_PIECES.wrap],
  outfit: [
    // One layered pauldron, on his leading (left) shoulder.
    plates({
      side: -1,
      plates: [
        { c: [0, 2.2, 1], r: [4.9, 3.8, 4.7] },
        { c: [-0.2, -0.4, 1.9], r: [4.4, 3.2, 4.2] },
        { c: [-0.3, -2.8, 2.5], r: [3.9, 2.8, 3.7] },
      ],
      mat: ARMOUR,
      rim: STEEL_EDGE,
    }),
    skirt({
      outer: TEAL,
      inner: TEAL_IN,
      waist: 5.4,
      ring: [5.6, 7.1],
      aline: 0.32,
      fan: 0.85,
      // Heavier than the scarf: the wind flutters the flaps round his hips without lifting them
      // off him, so the teal keeps its place between the breastplate and the legs.
      give: 0.5,
      folds: true,
      legs: 4.2,
      // Split into five flaps to mid-thigh, the front one hanging over his crotch: it flaps as he moves.
      panels: [
        { from: -26, to: 26, len: 15, jag: 1.4, taper: 0.85 },
        { from: 30, to: 84, len: 15, jag: 1.6 },
        { from: 92, to: 172, len: 16, jag: 2.2, kick: 0.1 },
        { from: 188, to: 268, len: 16, jag: 2.2, kick: 0.1 },
        { from: 276, to: 330, len: 15, jag: 1.6 },
      ],
    }),
    SCARF_PIECES.tails,
  ],
  weapon: pole(HALBERD),
  // Wind: pale jade-mint, a white edge and a white-hot core.
  aura: { core: hex('#6fe3c1'), edge: hex('#e8fff8'), hot: hex('#ffffff') },
};

export { DRAGOON };
