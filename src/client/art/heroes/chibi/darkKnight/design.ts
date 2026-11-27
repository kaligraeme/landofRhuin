/**
 * The Dark Knight, as a chibi: a stern young knight with dark chestnut hair in a backcomb (combed
 * straight back off his face, lifting over the brow in a soft pompadour and ending in short points
 * that flick out at the nape), blackened plate with dull silver edges over a dark padded suit, a
 * long open oxblood coat with a high collar and split swallowtail tails, and an oversized black
 * greatsword with a pale edge, a saw-toothed back and a crimson rune channel. Everything here is
 * data for the chibi engine; his moves are in the moves-*.ts files beside it, and hero.ts puts him
 * together.
 */
import { hex } from '../../paint.js';
import { blade } from '../blade.js';
import type { ChibiDesign, Lock, Tress } from '../design.js';
import { collar, plates, skirt } from '../pieces.js';
import { flat, type Hit, type Mat, mat4 } from '../raster.js';
import type { Build } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

const SKIN = mat4('#f6d0a8', '#e2a67e', '#c2805e', '#8e5442', '#5c2a22', 0.16);
const HAIR = mat4('#a87650', '#7c5236', '#583822', '#341f12', '#1e1009', -0.2);
// Overlapping plates of the same steel are parted by a line where one stands clear of the other.
const ARMOUR = { ...mat4('#8a90a4', '#5c6274', '#3a3e4c', '#22242e', '#121319', -0.36), clear: 1.2 };
const ARMOUR_RIDGE = mat4('#8a90a4', '#5c6274', '#3a3e4c', '#22242e', '#121319', 0.15);
const ARMOUR_SEAM = mat4('#5c6274', '#3a3e4c', '#22242e', '#16171e', '#121319', -0.5);
const SILVER = mat4('#d2d6e0', '#a4aab8', '#767c8c', '#4a4e5e', '#20222c', 0.1);
// Dull silver for the edges of plates: paler than the blackened steel, never as bright as the trims.
const PLATE_EDGE = mat4('#b4b9c6', '#8a90a0', '#646a7c', '#40444f', '#16171d', -0.05);
// The coat reads as one dark oxblood: its base tone spans most of it, the light tone only on lit folds.
const COAT = { ...mat4('#b33e48', '#8e2a34', '#64161f', '#3a0a12', '#22050b', -0.04), gain: 0.5 };
const COAT_SEAM = mat4('#64161f', '#4c0f18', '#3a0a12', '#2a060d', '#22050b');
const LINING = mat4('#46303a', '#2e1f27', '#1c1218', '#110a0e', '#08050a');
// The padded suit is a step darker and warmer than the plate, so the plates stand out from it.
const SUIT = mat4('#4c4652', '#35303b', '#25212a', '#16141a', '#0c0b0f', -0.1);
const LEATHER = mat4('#7c5642', '#5a3c2c', '#3e281c', '#25170f', '#140c07', -0.1);
const SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');
const STEEL = mat4('#80869a', '#505466', '#32343f', '#1c1d25', '#0d0e13');
const EDGE = mat4('#f6f8fc', '#d8dce6', '#aab0be', '#7e8494', '#2a2c36');
const GUARD = mat4('#b8bcca', '#6c7080', '#40424e', '#25262f', '#111218');
// Leather bound round the grip, a warm brown so the dark wrap shows across it.
const GRIP = mat4('#9a6448', '#76482f', '#52301e', '#321c11', '#180c07');
const GEM = mat4('#ff8a8a', '#e8283c', '#a8101e', '#600812', '#30040a');
// The belt's lower edge.
const BELT_EDGE = flat(hex('#24170f'));

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

// ── Hair: a backcomb ─────────────────────────────────────────────────────────────────────────
// Combed and swept straight back off his face, with volume: no fringe, so his whole forehead and
// brows show. Over the brow the hair lifts off the hairline in a raised mass, a soft pompadour,
// and sweeps back over a full crown in broad combed clumps that run back over the top, close over
// the ears along the sides, and gather at the back of the head toward the nape, where the hair
// ends in a few short tapered points flicking out over his high collar. One loose strand falls
// forward from the pompadour, short of his brow. Side on it sweeps back, higher at the front, and
// ends in points behind his head; front on it is a raised, rounded top over a bare forehead; from
// behind its clumps converge on the nape. The mass is combed into place and holds its shape: in
// a run, a charge or a leap the points at the nape stream, lift and ripple, and the strand flies
// back.
//
// The mass is the hair's shell with three volumes joined to it (`head.volume`: the pompadour over
// the brow, the crown, and the back of the head), the combed clumps are the whorl's, and the
// points are nape layers.

const LOCKS: Lock[] = [
  // The loose strand: it leaves the front of the pompadour and curls down over his forehead on his
  // right, ending above his brow.
  { yaw: 20, pitch: 40, dir: [0.8, 0.3, 0.1], len: 6, w: 1.6, curl: [0.2, -1.4, 0.1], give: 1, belly: 0.3 },
];

/**
 * The points at the nape: five short tapered tresses that leave the back of the head just above
 * the nape, follow it back and down, and flick out at their ends over the top of his collar,
 * every other one a little longer, so the hem is jagged. Side on the near ones end in points
 * behind his head; from behind they finish the clumps converging on the nape. They are nape
 * layers (`long.nape`), painted with the head, so they lie over the collar without popping in
 * front of or behind his head from frame to frame; their upper part is a tone deeper, in the
 * shadow of the hair above. In a run or a charge they stream back (more readily than most hair:
 * the mass above holds still), in a leap they lift, and they ripple with the pose.
 */
const NAPE: Tress[] = [
  { yaw: 130, pitch: 2, dir: [-1.3, -0.8, 0.35], len: 12.5, w: 2.8, stiff: 0.6, give: 1.5, taper: 0.65, flip: 0.8 },
  { yaw: 156, pitch: 4, dir: [-1.3, -0.8, 0.25], len: 13.5, w: 3, stiff: 0.6, give: 1.5, taper: 0.65, flip: 0.7 },
  { yaw: 180, pitch: 5, dir: [-1.3, -0.8, 0], len: 12.5, w: 3, stiff: 0.6, give: 1.5, taper: 0.65, flip: 0.6 },
  { yaw: 204, pitch: 4, dir: [-1.3, -0.8, -0.25], len: 13.5, w: 3, stiff: 0.6, give: 1.5, taper: 0.65, flip: 0.7 },
  { yaw: 230, pitch: 2, dir: [-1.3, -0.8, -0.35], len: 12.5, w: 2.8, stiff: 0.6, give: 1.5, taper: 0.65, flip: 0.8 },
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
    return u > 7.7 ? BELT_EDGE : LEATHER;
  }
  // The coat opens in a V over the breastplate: silver-edged, a ridge down the middle and the
  // edge of a plate across the belly.
  const open = 30 + (u - 8) * 0.9;
  if (yaw < open) {
    if (yaw > open - 6 && u < 21.5) return SILVER;
    if (Math.abs(u - 13.2) < 0.55) return ARMOUR_SEAM;
    if (yaw < 3 && u > 9) return ARMOUR_RIDGE;
    return ARMOUR;
  }
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
    // Close over the sides of his head, full behind.
    shell: { c: [-1.8, 2.4, 0], r: [11.6, 11.2, 10.7] },
    volume: [
      // The pompadour: the hair lifting off his hairline and standing out over his brow, its top
      // the highest point of his head.
      { c: [4.8, 10.2, 0], r: [7.6, 6, 9.4] },
      // The crown, broad enough that front on and from behind his head is rounded, not peaked.
      { c: [-2.5, 8.8, 0], r: [9.4, 6.6, 10.4] },
      // The back of the head, where the swept-back hair gathers.
      { c: [-6, 5, 0], r: [8, 7.5, 9.4] },
    ],
    // A high hairline, dipping a little toward the temples, so his whole forehead shows.
    hairline: { faceYaw: 72, brow: 7.5, temple: 6, nape: -7, ear: -1.4 },
    locks: LOCKS,
    long: { nape: NAPE, lie: 1 },
    // Dark chestnut: mostly the base tone, the light tone on the lit side of each clump.
    darkHair: true,
    lockLine: hex('#341f12'),
    // The combing: broad clumps fanning back from the middle of his hairline (the whorl sits at
    // the front, under the hairline, so only its fan shows) over the top and down the sides, and
    // gathering toward the nape, twisting a little as they go so they sweep rather than radiate.
    whorl: { yaw: 0, pitch: 5, reach: 178, clumps: 9, twist: 0.15 },
    face: {
      eye: [8.8, -1.7, 3.9],
      lash: hex('#1e0e10'),
      iris: hex('#4c1612'),
      irisLight: hex('#9a3e24'),
      white: hex('#f2e9e0'),
      shine: hex('#ffffff'),
      brow: hex('#2c170c'),
      browUp: 3,
      mouth: hex('#4a1614'),
      mouthAt: [9.8, -6.5],
      noseAt: [10.3, -3.9],
      scar: { at: [8.4, -4.6, 4.6], colour: hex('#fbe8d8') },
    },
  },
  body: {
    thigh: { mat: SUIT, r0: 4.1, r1: 3.5 },
    shin: { mat: ARMOUR, r0: 3.3, r1: 3.1 },
    boot: { mat: LEATHER, r: 4.1, top: 0.55, toe: 6.8, heel: 2.6, sole: SOLE, cap: ARMOUR },
    knee: { mat: ARMOUR, r: 3.1 },
    upperArm: { mat: COAT, r0: 3.4, r1: 3.0 },
    foreArm: { mat: ARMOUR, r0: 2.9, r1: 2.7 },
    cuff: { mat: ARMOUR, r: 3.8, at: 0.04, rim: PLATE_EDGE },
    hand: { mat: ARMOUR, r: 3.5, knuckle: SILVER },
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
      rim: PLATE_EDGE,
    }),
    plates({
      side: -1,
      plates: [
        { c: [0, 2, 0.8], r: [4.7, 3.6, 4.6] },
        { c: [-0.2, -0.6, 1.8], r: [4.1, 3, 4] },
      ],
      mat: ARMOUR,
      rim: PLATE_EDGE,
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
    // A broad black blade 64 px from the grip to the tip, its back stepped in saw teeth.
    blade: [
      [5, 3.6],
      [5, -3.6],
      [8, -5],
      [12, -5],
      [15.4, -2.8],
      [16, -5.4],
      [20, -5.3],
      [23.4, -2.8],
      [24, -5.4],
      [28, -5.2],
      [31.4, -2.8],
      [32, -5.3],
      [36, -5.1],
      [39.4, -2.8],
      [40, -5.1],
      [47, -4.7],
      [56, -3],
      [64, 0.2],
      [59.5, 3.2],
      [52, 5.4],
      [40, 6],
      [20, 5.8],
      [9, 5.2],
    ],
    edge: { from: 8, width: 1.8, mat: EDGE },
    spine: { v: -3.9, from: 7, to: 46, mat: STEEL },
    rune: { v: 0.2, from: 10, to: 46, rest: hex('#801224'), colour: hex('#e8203a'), glow: hex('#ff6a7c'), marks: [17, 25, 33, 41] },
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
    grip: { from: -10, to: 0.6, r: 1.8, mat: GRIP, wrap: flat(hex('#1e0e0a')) },
    pommel: { u: -12.2, r: 2.8, mat: GUARD, gem: GEM, gemR: 1.5 },
    grip2: -6.5,
    reach: [8, 64],
  }),
  aura: { core: hex('#d01a30'), edge: hex('#7a34c8'), hot: hex('#fff2f2') },
};

export { DARK_KNIGHT };
