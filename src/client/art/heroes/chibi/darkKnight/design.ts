/**
 * The Dark Knight, as a chibi: a stern young knight with a shaggy wolf cut of dark chestnut hair
 * (a big ragged crown, a piece-y fringe, longer layers flipping out at the nape), blackened plate
 * with dull silver edges over a dark padded suit, a long open oxblood coat with a high collar and
 * split swallowtail tails, and an oversized black greatsword with a pale edge, a saw-toothed back
 * and a crimson rune channel. Everything here is data for the chibi engine; his moves are in the
 * moves-*.ts files beside it, and hero.ts puts him together.
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

// ── Hair: a wolf cut ─────────────────────────────────────────────────────────────────────────
// A shaggy, heavily layered cut, between a shag and a mullet: a big tousled crown of broad, choppy
// pieces pointing every which way, with tufts breaking its top; a wispy fringe parted a little off
// the middle with longer pieces framing the face; short layers close round the ears; and at the
// back the crown's lower edge falling in points over longer layers that fall past the nape onto
// the top of the collar and flick out at the ends. From behind, the outline runs wide at the crown,
// pulls in at the ears and nape and flares again where the outer layers flick out over the collar,
// which shows below their points; front on those flicks show under his ears, and side on the near
// one hangs behind his jaw and kicks back. In a run or a charge the crown tosses back and the
// layers lift and stream.

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // The crown's widest part: broad, choppy pieces all round it, pointing out and down every which
  // way with their tips flicking out, so its outline is ragged and bumpy rather than a smooth dome,
  // and each has a lit side broad enough to hold at game size. The two at his sides give least to
  // the wind, so the crown keeps its breadth in a run while the rest toss back; they are lopsided
  // (his right one tips up, his left one down), so front on and from behind they never sit level
  // as a brim or a pair of horns.
  L(36, 50, [0.6, -0.4, 0.75], 8, 4.4, [0.1, -0.3, 0.3], 1.8, 0.28),
  L(86, 52, [-0.25, 0.25, 1.1], 8, 4.2, [-0.1, -0.3, 0.3], 0.6, 0.28),
  L(138, 48, [-0.75, 0.15, 0.98], 10, 4.8, [-0.3, -0.2, 0.2], 2.2, 0.28),
  L(178, 50, [-1, -0.3, -0.1], 9.5, 4.8, [-0.35, -0.25, 0.05], 2.2, 0.28),
  L(-136, 48, [-0.7, -0.55, -0.98], 11, 4.8, [-0.2, -0.2, -0.3], 2.2, 0.28),
  L(-98, 42, [-0.3, -0.6, -1.1], 9.5, 4.2, [-0.1, -0.35, -0.25], 0.6, 0.28),
  L(-40, 52, [0.55, -0.4, -0.8], 8, 4.4, [0.1, -0.3, -0.3], 1.8, 0.28),
  // Short layers close round the ears, so front on the ears show under the crown.
  L(104, 20, [-0.3, -1, 0.15], 5, 2.4, [-0.05, 0, 0.05], 1, 0.28),
  L(-104, 20, [-0.3, -1, -0.15], 5, 2.4, [-0.05, 0, -0.05], 1, 0.28),
  // The crown's lower edge at the back: broad pointed clumps falling to about his ears over the
  // longer layers at the nape, so from behind the cut steps down in layers.
  L(155, 14, [-0.6, -1, 0.35], 6.5, 3.5, [-0.1, 0, 0.1], 1.4, 0.3),
  L(180, 10, [-0.6, -1, 0], 7, 3.5, [-0.1, 0, 0], 1.4, 0.3),
  L(205, 14, [-0.6, -1, -0.35], 6.5, 3.5, [-0.1, 0, -0.1], 1.4, 0.3),
  // The fringe: wispy pointed pieces to the brows, parted a little to his left of the middle and
  // falling away to either side of the part.
  L(-50, 34, [0.35, -1, -0.5], 5, 1.8, [0.1, 0, -0.15], 0.3, 0.25),
  L(-28, 42, [0.5, -1, -0.45], 7.5, 1.8, [0.15, 0, -0.15], 0.3, 0.25),
  L(2, 46, [0.5, -1, 0.3], 6, 1.9, [0.15, 0, 0.1], 0.3, 0.25),
  L(26, 44, [0.5, -1, 0.35], 7.8, 1.9, [0.15, 0, 0.1], 0.3, 0.25),
  L(48, 36, [0.35, -1, 0.5], 5, 1.7, [0.1, 0, 0.15], 0.3, 0.25),
  // Longer pieces framing the face at the temples: to his cheekbone on his right (the side seen
  // side on, so it does not box in his face), a little longer on his left.
  L(60, 22, [0.25, -1, 0.12], 7, 2, [0.1, 0, 0.1], 0.3, 0.25),
  L(-60, 22, [0.25, -1, -0.12], 9.5, 2.4, [0.1, 0, -0.1], 0.3, 0.25),
  // Short tufts on top, splayed every which way (not upright spikes), so the top of the crown
  // stays ragged even at game size. They and the pieces after them come last: the head numbers
  // the locks' shapes by their places in this list, and from the 21st on those numbers are the
  // collar's too (no line parts shapes of one number), so the locks there must be ones that
  // never touch the collar.
  L(120, 66, [-0.4, 0.45, 1], 8, 3.8, [0, -0.3, 0], 2.2, 0.3),
  L(-150, 64, [-0.5, 0.45, -0.95], 8, 3.8, [0, -0.3, 0], 2.2, 0.3),
  L(60, 72, [0.3, 0.7, 0.8], 7, 3.3, [0, -0.3, 0], 2, 0.3),
  L(-80, 70, [-0.2, 0.7, -0.9], 7, 3.3, [0, -0.3, 0], 2, 0.3),
  // The top: pieces from the crown tumbling forward over the top and out to either side.
  L(170, 80, [0.9, 0.15, 0.2], 9, 4.8, [0.15, -0.5, 0], 2.2, 0.3),
  L(-20, 76, [-0.3, 0.2, -0.95], 8.5, 4.4, [0, -0.5, -0.15], 2, 0.3),
  L(50, 76, [-0.55, 0.2, 0.8], 8.5, 4.4, [-0.1, -0.5, 0.15], 2, 0.3),
  // Two more short tufts, toward the front and the back, so the outline is bumpy all the way
  // round and from behind has no single peak.
  L(-28, 60, [0.3, 0.55, -0.85], 6.5, 3.2, [0, -0.3, 0], 2, 0.3),
  L(152, 60, [-0.6, 0.45, 0.75], 6.5, 3.8, [0, -0.3, 0], 2.2, 0.3),
];

/**
 * The longer layers at the back (the soft mullet that makes it a wolf cut): six pointed tresses
 * round the nape, falling past it onto the top of his collar, the collar showing between and below
 * their points, their ends flicking out and catching the light. The outer two grow from behind
 * his ears and are the broadest and longest: they hang close, so from behind the cut pulls in at
 * the ears and nape, then flick out sideways at the top of the collar, past the head's width. Front
 * on they show as points under his ears beside his neck; side on the near one hangs behind his jaw
 * and kicks back at its end. The middle ones are shorter and narrower, so the hem is jagged. They
 * are nape layers (`long.nape`), painted with the head, so they lie over the collar (they slide
 * over it, as over the head) and stay behind his jaw where it is nearer, without popping in front
 * of or behind his head from frame to frame; their upper part is a tone deeper, in the shadow of
 * the hair above. In a run or a charge they lift and stream back, and they ripple with the pose.
 */
const NAPE: Tress[] = [
  { yaw: 116, pitch: -10, dir: [-0.3, -1.3, 0.65], len: 13.5, w: 3.5, stiff: 0.5, give: 0.8, taper: 0.25, flip: 2.5 },
  { yaw: 145, pitch: -14, dir: [-0.7, -1.1, 0.45], len: 9, w: 2.4, stiff: 0.5, give: 0.8, taper: 0.65, flip: 2 },
  { yaw: 168, pitch: -22, dir: [-1, -1, 0.15], len: 6.5, w: 1.8, stiff: 0.5, give: 0.8, taper: 0.75, flip: 1 },
  { yaw: 192, pitch: -22, dir: [-1, -1, -0.15], len: 6.5, w: 1.8, stiff: 0.5, give: 0.8, taper: 0.75, flip: 1 },
  { yaw: 215, pitch: -14, dir: [-0.7, -1.1, -0.45], len: 9, w: 2.4, stiff: 0.5, give: 0.8, taper: 0.65, flip: 2 },
  { yaw: 244, pitch: -10, dir: [-0.3, -1.3, -0.65], len: 13.5, w: 3.5, stiff: 0.5, give: 0.8, taper: 0.25, flip: 2.5 },
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
  id: 'hero-dark-knight',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.4, 9.7, 10.3] },
    jaw: { c: [1.7, -4.1, 0], r: [7.9, 6.8, 8.2] },
    ear: { c: [-0.6, -3.2, 10], r: [2, 2.8, 1.6] },
    shell: { c: [-1.6, 2.5, 0], r: [11.5, 11.4, 10.8] },
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -7.5, ear: -1.6 },
    locks: LOCKS,
    long: { nape: NAPE, lie: 1 },
    // Dark chestnut: mostly the base tone, the light tone on the lit side of each clump.
    darkHair: true,
    lockLine: hex('#341f12'),
    // The back of the head, between the locks: clumps fanning out from the crown that twist a
    // little as they fall, so it reads tousled rather than combed.
    whorl: { yaw: 180, pitch: 50, reach: 88, clumps: 7, twist: 0.28 },
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
