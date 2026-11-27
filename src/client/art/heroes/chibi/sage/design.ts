/**
 * The Sage, as a chibi: an old, wise mage, the party's healer. Weathered fair skin, kind but stern
 * blue-grey eyes under bushy white brows, a mane of white hair swept back from a high forehead and
 * falling to his shoulders behind, a full white beard to the middle of his chest and a drooping
 * moustache, the beard swaying as he moves. He wears a full-length deep blue robe with wide
 * sleeves, gold trim at the hems, the cuffs and down its opening, a gold-embroidered stole over his
 * shoulders hanging to his shins, a corded gold belt with a leather pouch and a scroll tucked in
 * it, a hood lying down behind his neck and soft brown shoes peeking out under the hem. His staff,
 * taller than he is, is gnarled dark wood bound in silver bands, a glowing teal orb held in silver
 * claws at its head that blazes when he casts. His bolts, orbs and wards burn arcane teal-green,
 * his healing a soft gold-green and his Meteor fiery orange-red. Everything here is data for the
 * chibi engine; his moves are in the moves-*.ts files beside it, and hero.ts puts him together.
 */
import { hex } from '../../paint.js';
import type { BodyDesign, ChibiDesign, FaceStyle, Held, Lock, Piece, PieceContext, WeaponDesign } from '../design.js';
import { beard, curtain, FACE_PLAIN } from '../head.js';
import { clipToGround, heldAxes, mainHeld } from '../held.js';
import { hood } from '../headgear.js';
import { skirt } from '../pieces.js';
import { pole } from '../pole.js';
import { type Hit, type Mat, mat4 } from '../raster.js';
import { add3, at3, type Build, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Weathered fair skin, a little ruddy.
const SKIN = mat4('#fde4c8', '#efbf98', '#cf9570', '#965f45', '#5e3024', 0.18);
// White hair and beard: the light tone over most of it, the highlight on the lit streaks.
const HAIR = mat4('#ffffff', '#e4e4ea', '#acacb6', '#6e6e7a', '#3c3c4a', 0.08);
// The robe reads as one deep blue: its base tone over most of it, the light tone on lit folds.
const ROBE = { ...mat4('#6a7ed4', '#3a4a9c', '#232c66', '#121838', '#080a1e', -0.02), gain: 0.6 };
const LINING = mat4('#2a3060', '#1c2048', '#121434', '#0a0c20', '#060712');
const GOLD = mat4('#fff8d0', '#fff0b0', '#e2c264', '#9c7a2c', '#4a3810', 0.1);
// The cord of the belt, a darker gold so its twist shows against the trim.
const CORD = mat4('#fff0b0', '#e2c264', '#b08c3c', '#7a5a20', '#3a2a08', 0.05);
// The stole: gold cloth, its base tone over most of it, with embroidery a step darker.
const STOLE = { ...mat4('#fff8d8', '#f4dc8c', '#d6b058', '#9c7a2c', '#4a3810', 0.05), gain: 0.7 };
const STOLE_IN = mat4('#c8a050', '#a88438', '#806024', '#5a4014', '#2e2008');
const EMBROIDERY = mat4('#c89a48', '#a87c30', '#8a6220', '#664612', '#2e2008', 0);
const SHOE = mat4('#b88a62', '#8a603e', '#5e3e24', '#3a2412', '#1a0e06', -0.05);
const SOLE = mat4('#3a2c26', '#2a201c', '#1c1512', '#100c0a', '#08060a');
// The pouch's leather and the scroll's parchment, with its red tie.
const POUCH = mat4('#c08a5c', '#9a663c', '#6c4424', '#422812', '#1e1006', -0.05);
const PARCHMENT = mat4('#fffaea', '#f2e4c0', '#d4bf8e', '#9c865a', '#4a3e24', 0.15);
const TIE = mat4('#ff8a7a', '#e04848', '#a82830', '#6a141c', '#30080c', 0.05);
// The staff: gnarled dark wood, bright silver fittings and a teal orb.
const WOOD = mat4('#8a6a4c', '#62462e', '#43301e', '#291c10', '#140c06', -0.06);
const SILVER = mat4('#eef2f8', '#c6ccd8', '#9096a8', '#585e70', '#24272f', 0.08);
const ORB = mat4('#eafff8', '#94f2d8', '#3cc8a6', '#187a68', '#08362e', 0.1);

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** A little shorter in the leg and narrower in the shoulder than the Dark Knight: an old man about 80 px tall. */
const BUILD: Build = {
  hip: 26.5,
  thigh: 11.6,
  shin: 11.6,
  ankle: 4,
  torso: 23,
  neck: 2,
  shoulder: 7.8,
  hipWidth: 3.9,
  shoulderDrop: 3.4,
  upperArm: 8.6,
  foreArm: 8.4,
  headUp: 11.8,
};

// ── Head ─────────────────────────────────────────────────────────────────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

/**
 * A mane of white hair swept straight back from a high forehead: broad clumps over the crown
 * lying back and down, fuller at the sides over his ears, and wisps standing a little off the
 * crown so the outline is soft rather than a smooth cap.
 */
const LOCKS: Lock[] = [
  // Swept back from the forehead over the crown.
  L(0, 54, [-0.95, 0.12, 0], 12, 5.4, [-0.2, -0.35, 0], 0.5, 0.4),
  L(36, 44, [-0.9, 0, 0.4], 11, 5, [-0.2, -0.4, 0.05], 0.5, 0.4),
  L(-36, 44, [-0.9, 0, -0.4], 11, 5, [-0.2, -0.4, -0.05], 0.5, 0.4),
  // Full at the sides, over and behind the ears.
  L(78, 18, [-0.55, -0.8, 0.45], 8.5, 4, [-0.15, -0.2, 0.1], 0.5, 0.35),
  L(-78, 18, [-0.55, -0.8, -0.45], 8.5, 4, [-0.15, -0.2, -0.1], 0.5, 0.35),
  L(112, 30, [-0.7, -0.5, 0.55], 9, 4.4, [-0.2, -0.3, 0.15], 0.7, 0.35),
  L(-112, 30, [-0.7, -0.5, -0.55], 9, 4.4, [-0.2, -0.3, -0.15], 0.7, 0.35),
  // Wisps lying back off the crown and the back, so the top of the mane reads soft.
  L(150, 54, [-0.9, 0.1, 0.35], 7, 3.6, [-0.1, -0.5, 0], 0.9, 0.3),
  L(-160, 52, [-0.9, 0.1, -0.35], 7, 3.6, [-0.1, -0.5, 0], 0.9, 0.3),
  L(60, 60, [-0.8, 0.2, 0.5], 6.5, 3.4, [-0.1, -0.45, 0.1], 0.9, 0.3),
  L(-64, 60, [-0.8, 0.2, -0.5], 6.5, 3.4, [-0.1, -0.45, -0.1], 0.9, 0.3),
];

const SHELL = { c: [-1.8, 1.8, 0] as const, r: [11.2, 10.8, 11] as const };

/**
 * His face glyphs: the plain style's level eyes with a crease of age at their outer corners, and bushy white
 * brows drooping past the eyes' outer corners, with a line of shadow under them so they stand
 * out from his skin. Calm when closed; his `smirk` is a warm smile under the moustache (his mouth
 * sits a little lower than a young face's, so it shows below the moustache).
 */
const FACE_ELDER: FaceStyle = {
  ...FACE_PLAIN,
  eyes: {
    ...FACE_PLAIN.eyes,
    full: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '...ll'], ax: 2, ay: 1 },
    mid: { rows: ['KKKK', 'IhIW', 'iIIK', '..ll'], ax: 1, ay: 1 },
  },
  brows: {
    full: { rows: ['.BBB..', 'BBBBBB', 'llBBBB', '....lB'], ax: 2, ay: 1 },
    mid: { rows: ['.BB..', 'BBBBB', 'lBBBB', '...lB'], ax: 1, ay: 1 },
    narrow: { rows: ['BB.', 'BBB', 'lBB'], ax: 1, ay: 1 },
  },
  browsUp: {
    full: { rows: ['BB....', 'BBBBB.', 'llBBBB', '....lB'], ax: 2, ay: 1 },
    mid: { rows: ['BB...', 'BBBB.', 'lBBBB', '...lB'], ax: 1, ay: 1 },
    narrow: { rows: ['B..', 'BBB', 'lBB'], ax: 1, ay: 1 },
  },
  mouths: { ...FACE_PLAIN.mouths, smirk: { rows: ['M...M', '.MMM.'], ax: 2, ay: 1 } },
};

/** His hood, worn down: fallen back behind his neck onto his shoulders, its gold rim turned up. */
const HOOD = hood({ outer: ROBE, inner: LINING, rim: GOLD, shell: SHELL, opening: { top: 5, bottom: -12, side: 8.6 }, peak: { pitch: 40, size: 3 }, folds: true, worn: 'down' });

// ── The torso: corded belt, gold-edged opening, the stole over the chest ─────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

/** Where the stole lies over the chest: a band each side of the opening, from the shoulders to the belt. */
const STOLE_IN_DEG = 16;
const STOLE_OUT_DEG = 34;

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  if (where === 'hips') return ROBE;
  if (u < 5) return null;
  const yaw = deg(h);
  // A corded gold belt: its twist shows as slanting bands.
  if (u > 5.8 && u < 8.2) {
    const twist = (((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI / 9 + u * 0.9) % 2 + 2) % 2;
    return twist < 1 ? GOLD : CORD;
  }
  // The robe's opening, edged in gold down the middle.
  if (yaw < 5) return GOLD;
  // The stole, gold with a darker embroidered cross every few pixels.
  if (yaw > STOLE_IN_DEG && yaw < STOLE_OUT_DEG && u < 20.5) {
    const along = u % 5;
    const mid = Math.abs(yaw - (STOLE_IN_DEG + STOLE_OUT_DEG) / 2);
    if ((along > 1.8 && along < 3.2 && mid < 2.2) || (mid < 0.9 && along > 1 && along < 4)) return EMBROIDERY;
    return STOLE;
  }
  return ROBE;
}

// ── Outfit pieces of his own ─────────────────────────────────────────────────────────────────

/**
 * The pouch on his left hip and the scroll tucked into the belt on his right: small items sorted
 * with the robe by their own depths, so they show on the side nearer the viewer and hide behind
 * him on the far side.
 */
const beltGear: Piece = (ctx: PieceContext) => {
  const { rig } = ctx;
  const cf = rig.chest;
  const pouch = at3(cf, 3.2, 3.6, -5.6);
  const scrollA = at3(cf, 3.6, 5.2, 4.4);
  const scrollB = at3(cf, 1.6, 0.2, 6.6);
  const z = (p: V3): number => ctx.upperZ(ctx.depth(p)) + 0.2;
  return [
    {
      z: z(pouch),
      draw: () => {
        const part = ctx.part();
        const p = ctx.proj(pouch);
        part.ellipse(p[0], p[1], 2.4, 2.8, POUCH, 0, ctx.depth(pouch), 1);
        // Its flap and a gold stud.
        part.ellipse(p[0], p[1] - 1.6, 2.5, 1.2, POUCH, 0.25, ctx.depth(pouch) + 1, 2);
        part.plot(p[0], p[1] - 0.6, GOLD, 0.8, ctx.depth(pouch) + 2, 3, true);
        part.commit();
      },
    },
    {
      z: z(scrollA),
      draw: () => {
        const part = ctx.part();
        const a = ctx.proj(scrollA);
        const b = ctx.proj(scrollB);
        part.capsule(a, b, 1.5, 1.5, PARCHMENT, 0.1, ctx.depth(scrollA), ctx.depth(scrollB), 1);
        const m = add3(scrollA, scrollB, 1);
        const c = ctx.proj([m[0] / 2, m[1] / 2, m[2] / 2]);
        part.ellipse(c[0], c[1], 1.2, 1.7, TIE, 0.1, ctx.depth(scrollA) + 1.5, 2);
        part.commit();
      },
    },
  ];
};

/** The robe: panels all round to the ankles, kept clear of the striding legs, its hem edged in gold. */
const ROBE_SKIRT = skirt({
  outer: ROBE,
  inner: LINING,
  waist: 5.4,
  ring: [5.6, 7],
  aline: 0.36,
  fan: 0.5,
  give: 0.5,
  folds: true,
  trim: GOLD,
  legs: 4,
  panels: [
    { from: -30, to: 0, len: 22.5 },
    { from: 0, to: 30, len: 22.5 },
    { from: 30, to: 90, len: 22.5 },
    { from: 90, to: 150, len: 22.5 },
    { from: 150, to: 210, len: 22.5 },
    { from: 210, to: 270, len: 22.5 },
    { from: 270, to: 330, len: 22.5 },
  ],
});

/** The ends of the stole hanging from his belt down the front of the robe to his shins. */
const STOLE_ENDS = skirt({
  outer: STOLE,
  inner: STOLE_IN,
  waist: 5.6,
  ring: [6.3, 7.5],
  aline: 0.3,
  fan: 0.4,
  give: 0.45,
  folds: false,
  trim: EMBROIDERY,
  legs: 4.6,
  panels: [
    { from: STOLE_IN_DEG - 2, to: STOLE_OUT_DEG - 2, len: 18, jag: 1 },
    { from: -STOLE_OUT_DEG + 2, to: -STOLE_IN_DEG + 2, len: 18, jag: 1 },
  ],
});

// ── The staff ────────────────────────────────────────────────────────────────────────────────

/** Shape id of the staff's haft in pole.ts, so the knots join it with no line between. */
const HAFT_ID = 1;

/** Knots on the haft: [along it, across it (toward v, + or -), radius]. */
const KNOTS: readonly (readonly [number, number, number])[] = [
  [-28, 1, 1.5],
  [-12, -1.1, 1.4],
  [3, 1, 1.3],
  [20, -1, 1.5],
  [37, 1, 1.4],
];

/**
 * His staff: about 100 px from the butt to the top of the orb, the haft gnarled dark wood (knots
 * standing out from it, bound with silver bands), the orb held in four silver claws. The right
 * hand holds it at its origin, about 42 px above the butt, so planted beside him with his hand at
 * his chest it stands on the floor.
 */
const BASE_STAFF = pole({
  haft: { from: -42, to: 45, r: 1.55, mat: WOOD },
  butt: { len: 1.6, r: 1.8, mat: SILVER },
  bands: { at: [-34, -6, 24, 42], len: 1.6, mat: SILVER },
  metal: SILVER,
  edge: SILVER,
  orb: { at: 51, r: 5.2, mat: ORB, glow: hex('#6fe8c8'), holder: { kind: 'claws', mat: SILVER, n: 4, w: 1 } },
  grip2: -14,
});

const STAFF: WeaponDesign = {
  ...BASE_STAFF,
  paint: (ctx: PieceContext, part, held: Held = mainHeld(ctx)) => {
    BASE_STAFF.paint(ctx, part, held);
    const w = held.grip;
    const sax = heldAxes(ctx, w);
    clipToGround(part, sax, w);
    for (const [u, v, r] of KNOTS) {
      const p = [sax.o[0] + sax.u[0] * u + sax.v[0] * v, sax.o[1] + sax.u[1] * u + sax.v[1] * v] as const;
      part.ellipse(p[0], p[1], r, r * 0.9, WOOD, 0.05, ctx.depth(add3(w.o, w.u, u)) + 0.3, HAFT_ID);
    }
    part.clip = null;
  },
};

// ── The design ───────────────────────────────────────────────────────────────────────────────

const BODY: BodyDesign = {
  thigh: { mat: ROBE, r0: 3.5, r1: 3.1 },
  shin: { mat: ROBE, r0: 2.9, r1: 2.7 },
  boot: { mat: SHOE, r: 3, top: 0.3, toe: 5.2, heel: 2, sole: SOLE, foot: [2.7, 2.3] },
  upperArm: { mat: ROBE, r0: 3.3, r1: 3.1 },
  // Wide sleeves: the forearm flares toward the wrist into a broad gold cuff.
  foreArm: { mat: ROBE, r0: 3.1, r1: 3.7 },
  cuff: { mat: GOLD, r: 4.2, at: 0.7 },
  hand: { mat: SKIN, r: 2.7 },
  neck: { mat: SKIN, r: 2.3 },
  hips: [{ c: [0, 3, 0], r: [5.2, 5.6, 6.6], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.8, 5.2, 6.4], id: 1 },
    { c: [0.2, 14.5, 0], r: [5.5, 8.4, 7.6], id: 1 },
  ],
  torso,
};

export const SAGE: ChibiDesign = {
  id: 'hero-sage',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.1, 9.5, 10] },
    jaw: { c: [1.6, -4.1, 0], r: [7.7, 6.7, 8] },
    ear: { c: [-0.6, -3.2, 9.7], r: [2, 2.8, 1.6] },
    shell: SHELL,
    hairline: { faceYaw: 70, brow: 5.8, temple: 1.6, nape: -8, ear: -1.6 },
    locks: LOCKS,
    whorl: { yaw: 180, pitch: 40, reach: 90, clumps: 7, twist: 0.2 },
    long: {
      back: curtain({ from: 112, to: 248, count: 7, pitch: 8, len: 18, w: 3.2, jag: 0.4, taper: 0.8 }),
      lie: 1.8,
    },
    // The beard grows from lower on his cheeks than the preset's, so they show under his eyes.
    beard: beard({ kind: 'full', len: 16, w: 3, give: 0.35, cheek: -7.2, mouth: [2.6, 1.6] }),
    // The moustache hangs from a little lower under his nose than usual, so his cheeks show
    // between it and his eyes; his mouth sits lower still, below it.
    moustache: { len: 4.2, w: 1.4, droop: 2.4, at: [9.8, -6] },
    face: {
      eye: [8.6, -1.6, 4],
      lash: hex('#2a1a16'),
      iris: hex('#3a6488'),
      irisLight: hex('#7aaccc'),
      white: hex('#f6f2ee'),
      shine: hex('#ffffff'),
      brow: hex('#fbfbff'),
      browUp: 3.4,
      mouth: hex('#8a4038'),
      mouthAt: [9.6, -7.7],
      noseAt: [10.1, -3.9],
      style: FACE_ELDER,
    },
  },
  body: BODY,
  headPieces: [HOOD.up],
  outfit: [HOOD.down, ROBE_SKIRT, STOLE_ENDS, beltGear],
  weapon: STAFF,
  aura: { core: hex('#6fe8c8'), edge: hex('#d6fff2'), hot: hex('#ffffff') },
};
