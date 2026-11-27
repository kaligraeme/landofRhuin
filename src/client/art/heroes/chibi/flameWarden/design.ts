/**
 * The Flame Warden, as a chibi: a lean, quick young swordsman with tanned skin and sharp
 * amber-orange eyes, black hair in spikes swept back from his face whose ends flick up like
 * flames (a few strands left over his forehead), a long black coat with a high collar and
 * coat-tails to the calves, lined in ember orange, a short black hooded cape over his shoulders
 * (the hood down), a crimson shirt crossed by a dark leather strap, a blackened-iron pauldron and
 * gauntlet on his sword arm, dark trousers and armoured boots, and a single-edged longsword of dark
 * steel whose edge glows with heat from orange to white-hot, with a plain black guard and grip.
 * His fire is orange with a gold edge and a white-hot heart. Everything here is data for the
 * chibi engine; his moves are in the moves-*.ts files beside it, his fire in fire.ts, and hero.ts
 * puts him together.
 */
import { hex } from '../../paint.js';
import { blade } from '../blade.js';
import type { BodyDesign, ChibiDesign, DrawItem, FaceStyle, HeadPiece, Lock, Piece, PieceContext } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { hood } from '../headgear.js';
import { collar, cowl, plates, skirt } from '../pieces.js';
import { dim, flat, type Hit, type Mat, mat4, mixc } from '../raster.js';
import { at3, type Build, type Limb, lerp3, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Tanned.
const SKIN = mat4('#f4c79c', '#dc9e70', '#b8784e', '#844c32', '#4e2416', 0.14);
// Black hair with a cool sheen: the light tone over the clumps, the highlight streaking their lit sides.
const HAIR = mat4('#767a96', '#383848', '#1d1c24', '#0e0d12', '#060508', -0.02);
/**
 * The same hair lit by his fire in his skills, `k` 0 to 1: only the highlight streaks along the lit
 * top edge of each clump warm to a red-orange ember sheen, the clumps themselves staying cool black;
 * `full` warms the light tone too, for the peaks of Kindle and his transformation.
 */
function hairLit(k: number, full = false): Mat {
  const ember = hex('#ec7a40');
  const t = HAIR.tones;
  return { ...HAIR, tones: [mixc(t[0], ember, k), full ? mixc(t[1], hex('#4a2a2c'), k) : t[1], t[2], t[3]] };
}
// The long black coat: its base tone over most of it, the light tone only on lit folds.
// A cool grey-violet catches its lit edges and folds, so it reads against a dark floor from behind.
const COAT = { ...mat4('#837f9c', '#4a4650', '#2c2a32', '#18161c', '#0c0b0f', -0.04), gain: 0.62 };
const COAT_SEAM = mat4('#2c2a32', '#222028', '#18161c', '#121016', '#0c0b0f');
// The ember-orange lining, which flashes when the coat streams.
const LINING = mat4('#ffc878', '#ff9a3c', '#d0601e', '#7a2e0c', '#3c1406', 0.05);
// The coat's hem, smouldering: the lining's ember turned out along its edge.
const HEM = mat4('#ffd08a', '#ffa040', '#e06a1e', '#8a3410', '#3c1406', 0.1);
// The short hooded cape: a black a shade warmer than the coat, lined in deep crimson.
const CAPE = { ...mat4('#857c98', '#4a4250', '#2a252c', '#17141a', '#0b090d', -0.04), gain: 0.62 };
const CAPE_IN = mat4('#a0302a', '#741a18', '#4a0e0e', '#2c0808', '#160404');
// The inside of the coat's high collar: a deep crimson, darker than the cape's lining.
const COLLAR_IN = mat4('#7a2220', '#4e1212', '#320a0c', '#1e0608', '#0e0204');
// The cape's hem: a crimson band, the shirt's colour, that sets it apart from the coat under it.
const CAPE_TRIM = mat4('#ff7a64', '#d8382c', '#9a1a18', '#5a0c0c', '#2a0404', 0.05);
// The crimson shirt.
const SHIRT = { ...mat4('#ff8a74', '#e84a3c', '#b0221e', '#64100e', '#320606', 0.05), gain: 0.7 };
// Dark leather: the strap across his shirt and the belt.
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
const STEEL = mat4('#7c7a86', '#565462', '#34323c', '#1e1d24', '#0a090d');
const HOT_EDGE = mat4('#fff6d0', '#ffc860', '#f08a30', '#b8401a', '#4a1806', -0.1);
const SPINE = mat4('#9c9aa8', '#76747f', '#565462', '#3a3842', '#121116');
const GUARD = mat4('#a8a4b2', '#5c5866', '#1e1c22', '#121115', '#060507');
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
  // The back of the head: spikes swept back from the crown and down over the skull toward the
  // nape in pairs either side of the middle (none runs down the middle), fanning out as they fall,
  // their tips flicking out like flames: the lower pairs break the outline at the sides, and two
  // short ones flick out over the collar.
  L(165, 62, [-0.5, -0.7, 0.3], 15, 4.8, [-0.2, 0.2, 0.25], 1, 0.3),
  L(-165, 62, [-0.5, -0.7, -0.3], 15, 4.8, [-0.2, 0.2, -0.25], 1, 0.3),
  L(140, 44, [-0.45, -0.75, 0.5], 13, 4.4, [-0.1, 0.3, 0.38], 1, 0.3),
  L(-140, 44, [-0.45, -0.75, -0.5], 13, 4.4, [-0.1, 0.3, -0.38], 1, 0.3),
  L(172, 16, [-0.4, -0.95, 0.3], 10.5, 3.8, [-0.3, 0.45, 0.65], 1, 0.3),
  L(-172, 16, [-0.4, -0.95, -0.3], 10.5, 3.8, [-0.3, 0.45, -0.65], 1, 0.3),
  L(170, -6, [-0.3, -1, 0.3], 7, 2.8, [-0.3, 0.2, 0.6], 0.9, 0.3),
  L(-170, -6, [-0.3, -1, -0.3], 7, 2.8, [-0.3, 0.2, -0.6], 0.9, 0.3),
  // Lower spikes above the ears, sweeping back and out and flicking up, so the outline is a row
  // of flames from every side.
  L(118, 20, [-0.5, -0.6, 0.7], 10, 3.6, [-0.1, 0.4, 0.35], 0.9, 0.3),
  L(-118, 20, [-0.5, -0.6, -0.7], 10, 3.6, [-0.1, 0.4, -0.35], 0.9, 0.3),
  // Short layers close round the ears, so front on the ears show under the spikes.
  L(108, 0, [-0.35, -1, 0.2], 5, 2.4, [-0.05, 0.1, 0.05], 0.8, 0.3),
  L(-108, 0, [-0.35, -1, -0.2], 5, 2.4, [-0.05, 0.1, -0.05], 0.8, 0.3),
  // A few strands left over the forehead, flicking out at their ends.
  L(-14, 48, [0.55, -1, -0.12], 6.6, 1.8, [0.12, 0.24, -0.2], 0.35, 0.25),
  L(12, 50, [0.55, -1, 0.2], 5.2, 1.6, [0.12, 0.24, 0.18], 0.35, 0.25),
  L(-34, 40, [0.4, -1, -0.35], 4.6, 1.6, [0.1, 0.2, -0.16], 0.35, 0.25),
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
  // Each eye a dark upper lash line over a dark pupil with one bright amber glint beside it, amber
  // round them and a fleck of white at the outer corner, so it reads as an eye (not a glow) at
  // game size; the lash flicks up at the outer corner.
  eyes: {
    ...FACE_SHARP.eyes,
    full: { rows: ['.KKKKK', 'KIDDiW', '.IDDIK', '..lll.'], ax: 2, ay: 1 },
    mid: { rows: ['.KKKK', 'IDDiK', 'IDDIK', '.ll..'], ax: 2, ay: 1 },
    narrow: { rows: ['KKKK', 'DDiK', 'DDK.'], ax: 1, ay: 1 },
    wide: { rows: ['.KKKKK', 'KIDDiW', 'KIDDIW', '.KKKK.'], ax: 2, ay: 1 },
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

// ── The torso: belt, the crimson shirt and its strap in the coat's opening, coat over the rest

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') return u > 5.3 && u < 7.2 ? (u > 6.7 ? BELT_EDGE : LEATHER) : TROUSERS;
  if (u < 5) return null;
  // A narrow dark belt with a small iron buckle.
  if (u < 7.2) {
    if (yaw < 7 && u > 5.3) return yaw < 3.5 && u > 5.9 && u < 6.7 ? LEATHER : IRON_EDGE;
    return u > 6.7 ? BELT_EDGE : LEATHER;
  }
  // The coat opens in a long V from the belt to the collar over the crimson shirt, an ember edge
  // of its lining showing; one leather strap crosses the shirt from his right shoulder to his left hip.
  const open = 10 + (u - 7.2) * 2.9;
  if (yaw < open) {
    if (yaw > open - 2.6) return LINING;
    const across = u - 15.5 - h.p[2] * 1.1;
    if (Math.abs(across) < 1) return LEATHER;
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
  hips: [{ c: [-0.3, 3.4, 0], r: [4.5, 5, 6.6], id: 1 }],
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

/**
 * The coat's high collar. Its inside is a deep crimson, so beside his jaw it is a dark frame for
 * the face rather than a band of orange across it; the ember lining shows only where it is turned
 * out along the front edges of the opening.
 */
const COLLAR_OPEN = 46;
const COLLAR_C: V3 = [-1, 30.6, 0];
const COLLAR_PLAIN = collar({
  outer: COAT,
  lining: COLLAR_IN,
  c: COLLAR_C,
  r: [7.8, 11.4, 9.6],
  bottom: 20,
  top: { back: 30.6, side: 28.6, front: 25.2 },
  open: COLLAR_OPEN,
});
const COLLAR: HeadPiece = {
  blobs: (ctx, head) =>
    (COLLAR_PLAIN.blobs?.(ctx, head) ?? []).map((b) => ({
      ...b,
      shade: (h: Hit) => {
        const s = b.shade(h);
        if (!s || h.back) return s;
        const yaw = Math.abs((Math.atan2(h.p[2] - COLLAR_C[2], h.p[0] - COLLAR_C[0]) * 180) / Math.PI);
        return yaw < COLLAR_OPEN + 9 ? { ...s, m: LINING } : s;
      },
    })),
};

/**
 * The short hooded cape over his shoulders: to the chest at the front, over the upper arms, to the
 * shoulder blades behind, with a broad crimson hem: a crimson under-layer a little longer than the
 * black cape shows below its own trim (it is sorted just under the black panel it belongs to).
 */
const CAPE_PANELS = [
  { from: -34, to: 34, len: 2.6, jag: 0.6 },
  { from: 34, to: 112, len: 10.5, jag: 1.6 },
  { from: 112, to: 180, len: 15, jag: 2.4 },
  { from: 180, to: 248, len: 15, jag: 2.4 },
  { from: 248, to: 326, len: 10.5, jag: 1.6 },
];
const CAPE_SPEC = { outer: CAPE, inner: CAPE_IN, top: 22.6, ring: [3.8, 4.4] as const, folds: true, trim: CAPE_TRIM, panels: CAPE_PANELS, over: { chest: BODY.chest, hips: BODY.hips } };
const CAPE_BLACK = cowl(CAPE_SPEC);
const CAPE_HEM = cowl({ ...CAPE_SPEC, outer: CAPE_TRIM, folds: false, trim: undefined, panels: CAPE_PANELS.map((p) => ({ ...p, len: p.len + (p.len > 5 ? 1.8 : 0) })) });
const CAPE_PIECE: Piece = (ctx) => {
  const top = CAPE_BLACK(ctx);
  const hem = CAPE_HEM(ctx);
  return [...hem.map((it, i) => ({ ...it, z: (top[i]?.z ?? it.z) - 0.005 })), ...top];
};

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
    hairline: { faceYaw: 74, brow: 5.8, temple: 1.2, nape: -7, ear: -1.6 },
    locks: LOCKS,
    lockLine: hex('#060508'),
    face: {
      eye: [8.8, -1.6, 4.1],
      lash: hex('#140a0a'),
      iris: hex('#c85a18'),
      irisLight: hex('#ffc44a'),
      irisDeep: hex('#2a0c08'),
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
  headPieces: [COLLAR],
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
        // The back, split by a vent up the middle that opens as the tails stream.
        { from: 157, to: 178, len: 25, jag: 2.6, taper: 1.05, kick: 0.35 },
        { from: 182, to: 203, len: 25, jag: 2.6, taper: 1.05, kick: 0.35 },
        { from: -150, to: -86, len: 26, jag: 3.6, taper: 1.1, kick: 0.25 },
        { from: -80, to: -30, len: 15, jag: 2 },
      ],
    }),
    CAPE_PIECE,
  ],
  // The single-edged longsword, about 44 px from the hand to the point: a broad flat of dark steel
  // with a straight back that drops to a clipped point, only its one-pixel cutting edge glowing
  // with heat (brightest toward the point), and a plain black crossguard standing clear above the
  // fist, wider than the blade, its upper face catching a steel highlight.
  weapon: blade({
    blade: [
      [5.4, 3.2],
      [5.4, -2.8],
      [35.5, -2.7],
      [41, -1.6],
      [45.5, 0.7],
      [42, 2.7],
      [32, 3.4],
      [14, 3.4],
    ],
    edge: { from: 6.5, width: 1.3, mat: HOT_EDGE },
    spine: { v: -2, from: 7, to: 35, mat: SPINE },
    // The heat in the steel just inside the edge: a dull ember at rest, blazing in his moves.
    rune: { v: 2.2, from: 9, to: 42, rest: hex('#6a240c'), colour: hex('#ff8a2a'), glow: hex('#ffd27a') },
    steel: STEEL,
    guard: {
      pts: [
        [5.6, -2.4],
        [5, -6.4],
        [3.2, -6.8],
        [3, -2.4],
        [3, 2.4],
        [3.2, 7],
        [5, 6.6],
        [5.6, 2.4],
      ],
      mat: GUARD,
    },
    grip: { from: -5.4, to: 3.2, r: 1.4, mat: GRIP, wrap: flat(hex('#0e0808')) },
    pommel: { u: -7, r: 2, mat: GUARD, gem: EMBER, gemR: 1 },
    grip2: -3,
    reach: [9, 45.5],
  }),
  // Fire: orange at the core, a gold edge, a white-hot heart.
  aura: { core: hex('#ffb43c'), edge: hex('#ffe08a'), hot: hex('#fffbe8') },
};

/**
 * The same design with his hair lit by his fire, by how hot (hero.ts picks one per frame of his
 * skill clips): 0 his own cool black, 1 the highlights a little warmed, 2 mostly warmed, 3 the
 * light tone warmed too (the peaks of Kindle and his transformation).
 */
const FLAME_WARDEN_LIT: readonly ChibiDesign[] = [HAIR, hairLit(0.3), hairLit(0.55), hairLit(1, true)].map((hair) => ({ ...FLAME_WARDEN, head: { ...FLAME_WARDEN.head, hair } }));

export { FLAME_WARDEN, FLAME_WARDEN_LIT };
