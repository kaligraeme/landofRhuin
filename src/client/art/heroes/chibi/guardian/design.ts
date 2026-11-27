/**
 * The Guardian, as a chibi: a paladin who holds the line, sturdy but lighter than the Dark Knight,
 * kind but steely. Golden blonde hair swept back from her face and tied low at the nape in a short
 * tail with a blue ribbon, a soft parted fringe and a strand framing her face on either side, under
 * a slim silver circlet with a small blue gem. She wears polished silver plate: a breastplate with
 * a blue enamel panel down the front edged in gold, a gorget, rounded pauldrons of a silver dome
 * over a blue lame with gold edges, silver vambraces and gauntlets with gold knuckles over blue
 * sleeves, a short blue tabard over the hips with a gold hem, blue armoured legs with silver knee
 * cops and silver sabatons, and a dark violet-navy cape from her shoulders to her calves with a
 * crimson lining that shows as it moves. She carries a long arming sword (bright steel, a gold
 * crossguard, a blue grip and a gold pommel with a blue gem; its fuller glows gold in her skills)
 * and a large kite shield strapped to her left forearm: a deep blue field inside a broad gold rim,
 * a thin gold line inset, and a radiant sun rising behind a white tower. Her light is gold and
 * white with a pale blue edge. Everything here is data for the chibi engine; her moves are in the
 * moves-*.ts files beside it, and hero.ts puts her together.
 */
import { hex } from '../../paint.js';
import { blade } from '../blade.js';
import { type BodyDesign, type ChibiDesign, type DrawItem, GEAR_ID, type HeadPiece, type Lock, type Piece, type PieceContext } from '../design.js';
import { FACE_SOFT } from '../head.js';
import { cape, collar, skirt } from '../pieces.js';
import { flat, type Hit, type Mat, mat4 } from '../raster.js';
import { at3, type Build, clamp, dirIn, dot3, type Frame3, lerp, mul3, norm3, rad, rotate, sub3, type V3 } from '../rig.js';
import { heaterOutline, type Outline, roundOutline, shield, starOutline } from '../shield.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Fair skin, for the face and the neck.
const SKIN = mat4('#fff0e0', '#f6cfab', '#d8a27c', '#a26c4e', '#6e3c2c', 0.3);
// The face: lit over all of it that faces the viewer, outlined in a soft warm brown so the line
// under her chin reads as a crease.
const FACE_SKIN: Mat = { ...SKIN, line: hex('#a8705a'), gain: 0.3, bias: 0.6 };
const NECK: Mat = { ...mat4('#fff0e0', '#f6cfab', '#ecbc96', '#e0ae88', '#b47c62', 0.2), gain: 0.4 };
// Golden blonde: the light tone over the clumps, a pale highlight streaking their lit sides.
const HAIR = mat4('#fff8d4', '#f8d77a', '#dca848', '#a06a24', '#5c3610', 0.06);
// Polished silver plate: mostly its light and base tones, so it reads bright beside the blue.
const SILVER = { ...mat4('#f2f4fa', '#b8c0d4', '#7a849e', '#464e66', '#1c2030', 0.12), clear: 1.2 };
// The blue enamel and the blue plate of her legs: a glossy royal blue.
const BLUE = { ...mat4('#6a9cf0', '#3a64c0', '#22397a', '#121e44', '#0a1028', 0.04), gain: 0.85 };
// The blue cloth of her sleeves and tabard: the same blue, flatter, its light tone on the folds.
const CLOTH = { ...mat4('#6a9cf0', '#3a64c0', '#22397a', '#121e44', '#0a1028', 0.1), gain: 0.6 };
const CLOTH_IN = mat4('#2a4688', '#1c3066', '#121e44', '#0a1230', '#060a1c');
const GOLD = mat4('#fff0b0', '#e8c25a', '#a8802c', '#5e4414', '#2e2008', 0.1);
// The cape: dark violet-navy outside, crimson inside. Its light tone is the dark navy #3a3a7a,
// with the shadow tones in its folds; the pale violet highlight is left for the rim light along
// the top edges of its lit folds and shoulders, so from behind she reads as a knight in a navy
// cape, not a mage in a lavender robe.
const CAPE = { ...mat4('#5c5ca8', '#3a3a7a', '#262654', '#161632', '#0a0a1c', -0.05), gain: 0.9 };
const CRIMSON = mat4('#e0505e', '#b02c3c', '#7c1a2a', '#4a0e18', '#22060c');
// The circlet: fine silver, mostly its light tone with a bright glint, outlined in the hair's own
// brown so it lies in the hair as a slim band rather than a white bar ruled in ink.
const CIRCLET_SILVER: Mat = { ...mat4('#f2f4fa', '#b8c0d4', '#8a93aa', '#5a6278', '#8a5418', 0.05), gain: 0.7 };
// The ribbon tying her tail: a bright blue bow.
const RIBBON = mat4('#9cc4ff', '#5a8ae0', '#3a64c0', '#22397a', '#0a1028', 0.1);
const SAPPHIRE = mat4('#eef8ff', '#9ad6ff', '#3e8ee0', '#1c4e9c', '#0c2250', 0.05);
// The sword: bright steel with a white edge, a blue leather grip bound in gold thread.
const STEEL = mat4('#ffffff', '#e2e7f2', '#aeb6ca', '#6e7890', '#262a38', 0.12);
const EDGE = mat4('#ffffff', '#f6f8fc', '#d4d9e6', '#9ea6ba', '#2a2e3c', 0.16);
const GRIP = mat4('#5a8ae0', '#3a64c0', '#22397a', '#121e44', '#0a1028');
// The shield: a deep blue field, a white tower kept bright over the face's dome, its oak backing.
const FIELD = { ...mat4('#5a86e0', '#2e58b4', '#1c3a84', '#0f2054', '#060c26', 0), gain: 0.7 };
const PALE = mat4('#ffffff', '#f6f8fd', '#e6eaf4', '#ccd3e3', '#3a4258', 0.3);
const OAK = mat4('#8a6446', '#6a4a32', '#4a3222', '#2c1c12', '#140c06', -0.05);
const SOLE = mat4('#3a3a4a', '#2a2a36', '#1c1c26', '#101018', '#08080c');
// The belt's lower edge.
const BELT_EDGE = flat(hex('#0e1430'));

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** A sturdy knight, a little lighter than the Dark Knight: narrower shoulders and hips, a shorter torso. */
const BUILD: Build = {
  hip: 27,
  thigh: 12,
  shin: 11.8,
  ankle: 4,
  torso: 22.6,
  neck: 2,
  shoulder: 7.8,
  hipWidth: 3.9,
  shoulderDrop: 3.4,
  upperArm: 8.6,
  foreArm: 8.4,
  headUp: 11.8,
};

// ── Hair: swept back and tied low at the nape ────────────────────────────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // Broad clumps swept back from the brow either side of the crown toward the tie at the nape,
  // lying close, so the head reads smooth and neat under the circlet. They end on the crown: any
  // longer (or one up the middle), their tips stood up past the back of the head and notched its
  // outline seen from behind, where the hair is drawn down to the tie (the whorl, below).
  L(34, 46, [-1, 0.05, 0.1], 7, 4.6, [-0.15, -0.5, 0.05], 0.5, 0.4),
  L(-34, 46, [-1, 0.05, -0.1], 7, 4.6, [-0.15, -0.5, -0.05], 0.5, 0.4),
  L(70, 30, [-1, -0.25, 0.1], 9, 3.8, [-0.1, -0.35, 0], 0.5, 0.4),
  L(-70, 30, [-1, -0.25, -0.1], 9, 3.8, [-0.1, -0.35, 0], 0.5, 0.4),
  // A soft fringe parted a little to her left, falling over her brow to either side of the part.
  L(-20, 44, [0.5, -1, -0.35], 7, 2.8, [0.15, -0.05, -0.15], 0.3, 0.3),
  L(8, 46, [0.55, -1, 0.2], 6.4, 2.6, [0.15, -0.05, 0.12], 0.3, 0.3),
  L(30, 40, [0.4, -1, 0.42], 5.4, 2.3, [0.1, 0, 0.15], 0.3, 0.3),
  L(-42, 36, [0.35, -1, -0.45], 5.4, 2.3, [0.1, 0, -0.15], 0.3, 0.3),
  // Short wisps in front of the ears.
  L(74, 6, [0.15, -1, 0.25], 5, 2, [0.1, 0, 0.05], 0.3),
  L(-74, 6, [0.15, -1, -0.25], 5, 2, [0.1, 0, -0.05], 0.3),
];

// ── The pauldrons: a silver dome over a blue lame, edged in gold ─────────────────────────────

/** A plate of a pauldron: its centre and radii in the shoulder's frame, its metal and the rim along its lower edge. */
interface Plate {
  c: V3;
  r: V3;
  mat: Mat;
  rim: Mat;
}

/** Her right pauldron's plates from the top down (the left mirrors them, a size smaller). */
const PAULDRON: Plate[] = [
  { c: [0, 2.3, 1.1], r: [5, 4.1, 5], mat: SILVER, rim: GOLD },
  { c: [-0.2, -0.5, 2], r: [4.5, 3.3, 4.5], mat: BLUE, rim: GOLD },
];

/**
 * A rounded pauldron over one shoulder (1 her right, -1 her left): its plates painted together in
 * one part so they sort pixel by pixel, each of its own metal with a gold rim along its lower edge.
 * Like pieces.ts `plates`, the plates tip outward as the arm rises.
 */
function pauldron(side: 1 | -1, size: number): Piece {
  return (ctx: PieceContext): DrawItem[] => {
    const { rig } = ctx;
    const arm = side === 1 ? rig.armR : rig.armL;
    const upper = norm3(sub3(arm.mid, arm.root));
    const rise = clamp((dot3(upper, rig.chest.u) + 1) / 1.4, 0, 1.3);
    const swing = dot3(upper, rig.chest.f);
    const base: Frame3 = { o: arm.root, f: rig.chest.f, u: rig.chest.u, r: mul3(rig.chest.r, side) };
    const fr = rotate(base, swing * -18, rise * 55);
    const tip = at3(fr, 0, 0, 4);
    return [
      {
        z: ctx.depth(tip) + ctx.upper + 0.5,
        draw: () => {
          const part = ctx.part();
          PAULDRON.forEach((pl, i) => {
            const c = mul3(pl.c, size);
            const r = mul3(pl.r, size);
            part.blobs(fr, [{ c, r, id: 40 + i }], (h: Hit) => {
              const k = (h.p[1] - c[1]) / r[1];
              if (k < -0.2) return null;
              if ((h.p[2] - c[2]) / r[2] < -0.55) return null;
              if (h.back) return { m: pl.mat, light: -0.9 };
              if (k < 0.12) return { m: pl.rim };
              return { m: pl.mat };
            });
          });
          part.commit();
        },
      },
    ];
  };
}

// ── The torso: belt, breastplate with its blue panel ─────────────────────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') return CLOTH;
  if (u < 5) return null;
  // A blue belt with a gold buckle.
  if (u < 7.8) {
    if (yaw < 12 && u > 5.4 && u < 7.4) return yaw < 6 && u > 6 && u < 6.9 ? CLOTH : GOLD;
    return u > 7.3 ? BELT_EDGE : CLOTH;
  }
  // A gold rim along the breastplate's lower edge.
  if (u < 9) return GOLD;
  // The blue enamel panel down the front, edged in gold, narrowing a little toward the gorget.
  const panel = 22 - (u - 9) * 0.5;
  if (yaw < panel) return yaw > panel - 4.5 ? GOLD : BLUE;
  return SILVER;
}

const BODY: BodyDesign = {
  thigh: { mat: BLUE, r0: 3.8, r1: 3.3 },
  shin: { mat: BLUE, r0: 3.1, r1: 2.8 },
  boot: { mat: SILVER, r: 3.4, top: 0.42, toe: 6, heel: 2.3, sole: SOLE, cap: GOLD },
  knee: { mat: SILVER, r: 2.9 },
  upperArm: { mat: CLOTH, r0: 3, r1: 2.7 },
  foreArm: { mat: SILVER, r0: 2.7, r1: 2.6 },
  cuff: { mat: SILVER, r: 3.4, at: 0.1, rim: GOLD },
  hand: { mat: SILVER, r: 3, knuckle: GOLD },
  neck: { mat: NECK, r: 2.2 },
  hips: [{ c: [0, 3.2, 0], r: [4.9, 5.2, 6.4], id: 1 }],
  chest: [
    { c: [0, 8.4, 0], r: [4.6, 5, 6.2], id: 1 },
    { c: [0.4, 14.6, 0], r: [5.5, 8.4, 7.6], id: 1 },
  ],
  torso,
};

const SHELL = { c: [-1.4, 1, 0] as V3, r: [11.2, 10.4, 11.4] as V3 };

// ── The sword ────────────────────────────────────────────────────────────────────────────────

/** A long arming sword, about 43 px from the grip to the point. */
const SWORD = blade({
  blade: [
    [3, 2.2],
    [3, -2.2],
    [32, -2.1],
    [38.5, -1.3],
    [43, 0],
    [38.5, 1.3],
    [32, 2.1],
  ],
  edge: { from: 5, width: 0.9, mat: EDGE },
  // The fuller: steel at rest, glowing gold in her skills.
  rune: { v: 0, from: 6, to: 33, rest: hex('#9aa6c2'), colour: hex('#ffd25a'), glow: hex('#fff0b4') },
  steel: STEEL,
  guard: {
    // A straight gold crossguard flaring a little at its ends.
    pts: [
      [3, -1.6],
      [3.2, -6],
      [4.2, -7.4],
      [1.6, -7.6],
      [0, -6],
      [0, -1.6],
      [0, 1.6],
      [0, 6],
      [1.6, 7.6],
      [4.2, 7.4],
      [3.2, 6],
      [3, 1.6],
    ],
    mat: GOLD,
    gem: { u: 1.6, r: 1, mat: SAPPHIRE },
  },
  grip: { from: -7, to: 0.4, r: 1.4, mat: GRIP, wrap: flat(hex('#d8b050')) },
  pommel: { u: -8.6, r: 2.1, mat: GOLD, gem: SAPPHIRE, gemR: 1.1 },
  grip2: -4.5,
  reach: [6, 43],
});

// ── The shield ───────────────────────────────────────────────────────────────────────────────

/**
 * Every other point of a heater outline, keeping its corners and its point: the shield tests each
 * pixel of its face against its outline and its emblem's, so half the points paint it in about
 * half the time, and at this size the kite's long, nearly straight sides and its arched top look
 * the same.
 */
const sparse = (o: Outline): Outline => {
  const w = Math.max(...o.map((p) => Math.abs(p[1])));
  return o.filter((p, i) => i % 2 === 0 || p[1] === 0 || Math.abs(p[1]) === w);
};

/** The kite shield's outline: about 48 px tall and 25 wide, a long tapering point below. */
const KITE: Outline = sparse(heaterOutline({ w: 12.5, top: 15, bottom: -31, waist: 0.22, arch: 1.6, belly: 1.35 }));
/**
 * A thin gold line inset inside the rim: a ring, the space between two smaller copies of the
 * outline (one point list running round the outer copy and then the inner, so the emblem's
 * even-odd fill leaves the field inside it alone and only the line blazes with the shield).
 */
const INSET_OUT: Outline = sparse(heaterOutline({ w: 9.6, top: 12.2, bottom: -26, waist: 0.22, arch: 1.4, belly: 1.35 }));
const INSET_IN: Outline = sparse(heaterOutline({ w: 8.6, top: 11.2, bottom: -24.2, waist: 0.22, arch: 1.3, belly: 1.35 }));
const INSET: Outline = [...INSET_OUT, INSET_OUT[0] as readonly [number, number], ...INSET_IN, INSET_IN[0] as readonly [number, number]];

/** Where the sun rises (u, v in the shield's plane): over the top of the tower. */
const SUN: readonly [number, number] = [5.4, 0];

/** Turns a shape about a point in the shield's plane. */
const turned = (pts: Outline, at: readonly [number, number], a: number): Outline =>
  pts.map(([u, v]): [number, number] => [at[0] + (u - at[0]) * Math.cos(a) - (v - at[1]) * Math.sin(a), at[1] + (u - at[0]) * Math.sin(a) + (v - at[1]) * Math.cos(a)]);

/**
 * A sturdy tower standing on the shield's long point, [u, v] round it: walls a little wider at
 * the foot, a parapet that juts out under three square merlons.
 */
const TOWER: Outline = [
  [-17, -4],
  [-17, 4],
  [-2, 3.3],
  [-1.2, 4.3],
  [1.4, 4.3],
  [1.4, 2.6],
  [0.2, 2.6],
  [0.2, 0.8],
  [1.4, 0.8],
  [1.4, -0.8],
  [0.2, -0.8],
  [0.2, -2.6],
  [1.4, -2.6],
  [1.4, -4.3],
  [-1.2, -4.3],
  [-2, -3.3],
];
const KITE_SHIELD = shield({
  outline: KITE,
  face: FIELD,
  back: OAK,
  rim: { w: 2.2, mat: GOLD, raise: 1 },
  thick: 1.8,
  bulge: 2,
  emblem: [
    // A thin gold line inset inside the rim.
    { pts: INSET, mat: GOLD },
    // A radiant sun rising behind the tower: eight broad gold rays round its gold disc, a
    // white-hot heart (bold shapes, so it reads at the size it is seen in game).
    { pts: turned(starOutline(8, 9.6, 4.8, SUN), SUN, Math.PI / 8), mat: GOLD },
    { pts: roundOutline(4.4, 16).map(([u, v]): [number, number] => [u + SUN[0], v + SUN[1]]), mat: GOLD, raise: 0.8 },
    { pts: roundOutline(2, 10).map(([u, v]): [number, number] => [u + SUN[0], v + SUN[1]]), mat: PALE, raise: 0.9 },
    // The tower over the sun's lower half, in white.
    { pts: TOWER, mat: PALE, raise: 0.4 },
  ],
  glow: hex('#ffe9a8'),
  strap: { at: 0.6, out: 3 },
});

// ── The circlet ──────────────────────────────────────────────────────────────────────────────

/** Its height on the hair's shell (head space) at the brow and round the sides, and its depth. */
const CIRCLET_AT = { front: 4.4, side: 7.6, w: 1.1 };
/** How far round the head from the brow it shows (degrees): behind that it is under her hair. */
const CIRCLET_REACH = 118;

/**
 * A slim silver circlet: a band a pixel deep lying over the hair round her brow and the sides of
 * her head, dipping at the front to a small blue gem, and passing under her hair at the back (so
 * seen from behind only its ends show by her temples). Like headgear.ts `circlet`, it stands proud
 * of the locks in the head's depth test, so the fringe does not cover it.
 */
const CIRCLET: HeadPiece = {
  blobs: (ctx, head) => {
    const e = 0.5;
    const r: V3 = [SHELL.r[0] + e, SHELL.r[1] + e, SHELL.r[2] + e];
    const yawAt = (p: V3): number => Math.abs((Math.atan2(p[2], p[0] - SHELL.c[0]) * 180) / Math.PI);
    // Lower at the brow than round the sides, the dip held near the front.
    const at = (yaw: number): number => lerp(CIRCLET_AT.front, CIRCLET_AT.side, Math.min(1, (1 - Math.cos(rad(Math.min(90, yaw) * 2))) / 2));
    const ku = clamp((CIRCLET_AT.front - SHELL.c[1]) / r[1], -1, 1);
    const f = SHELL.c[0] + r[0] * Math.sqrt(1 - ku * ku);
    return [
      {
        frame: head,
        blobs: [{ c: SHELL.c, r, id: GEAR_ID + 10 }],
        shade: (h) => {
          if (h.back) return null;
          const yaw = yawAt(h.p);
          if (yaw > CIRCLET_REACH) return null;
          if (Math.abs(h.p[1] - at(yaw)) > CIRCLET_AT.w / 2) return null;
          const l = ctx.cam.light(dirIn(head, h.n[0], h.n[1], h.n[2]));
          return { m: CIRCLET_SILVER, light: l, lift: 3.5 };
        },
      },
      { frame: head, blobs: [{ c: [f + 0.3, CIRCLET_AT.front, 0], r: [0.8, 1.3, 1.1], id: GEAR_ID + 11 }], shade: (h) => (h.back ? null : { m: SAPPHIRE, lift: 3.5 }) },
    ];
  },
};

// ── The cape in the wind ─────────────────────────────────────────────────────────────────────

/**
 * A cape that billows: the wind that streams it back also lifts it (a third as much again), so
 * as she runs or swings it rises off her shoulders, its top sloping back from them, its panels
 * ripple apart and its crimson lining shows along the underside, instead of standing straight
 * back at her hips like a flag. The hair keeps the pose's own wind.
 */
function billowing(piece: Piece): Piece {
  return (ctx: PieceContext): DrawItem[] => {
    const p = ctx.pose;
    const wind = Math.max(0, p.wind ?? 0);
    return piece({ ...ctx, pose: { ...p, wind: (p.wind ?? 0) * 0.85, lift: (p.lift ?? 0) + wind * 0.35 } });
  };
}

// ── The design ───────────────────────────────────────────────────────────────────────────────

const GUARDIAN: ChibiDesign = {
  id: 'hero-guardian',
  build: BUILD,
  head: {
    skin: FACE_SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9, 9.5, 10] },
    jaw: { c: [1.5, -4, 0], r: [7.5, 6.5, 7.7] },
    ear: { c: [-0.6, -3.2, 9.5], r: [1.8, 2.6, 1.5] },
    shell: SHELL,
    hairline: { faceYaw: 72, brow: 3.8, temple: 0, nape: -9, ear: -2 },
    locks: LOCKS,
    lockLine: hex('#8a5418'),
    // The back of the head: four broad locks drawn down together from all round toward the tie at
    // the nape (the whorl sits just over the tie, so they sweep in to it).
    whorl: { yaw: 180, pitch: -6, reach: 110, clumps: 4, twist: 0.15 },
    long: {
      // A short, slim tail tied low at the nape with a blue ribbon bow, falling over the cape
      // between her shoulders: three or four pixels wide and a tone deeper than its light side
      // would paint it, so from behind it reads as hair, the same gold as her head, not a bib.
      tail: { yaw: 180, pitch: -20, dir: [-0.3, -1, 0], stiff: 0.2, len: 20, w: 1.7, give: 0.9, sheen: -0.15, tie: { mat: RIBBON, r: 2, ends: 5 } },
      // A strand framing her face on either side, down past her jaw: long enough to show beside
      // her cheeks toward the viewer, rooted far enough round to hang in front of the ear side on
      // rather than over her eye, and to lie against her cheek front on (rooted nearer the face,
      // a pixel of floor showed between them).
      front: [
        { yaw: 63, pitch: 12, dir: [0.35, -1, 0.1], len: 12, w: 2.2, taper: 0.7, give: 0.6 },
        { yaw: -64, pitch: 12, dir: [0.35, -1, -0.1], len: 13, w: 2.3, taper: 0.7, give: 0.6 },
      ],
      lie: 1.8,
    },
    face: {
      eye: [8.3, -1.8, 4.2],
      lash: hex('#2a1a16'),
      iris: hex('#2a64c8'),
      irisLight: hex('#86c8ff'),
      irisDeep: hex('#163a80'),
      white: hex('#f8f4f4'),
      shine: hex('#ffffff'),
      brow: hex('#a8702c'),
      browUp: 3.6,
      mouth: hex('#b84a56'),
      mouthAt: [9.1, -6.5],
      noseAt: [9.7, -4],
      style: FACE_SOFT,
    },
  },
  body: BODY,
  headPieces: [
    // A slim silver circlet over the hair, dipping to a small blue gem at the brow.
    CIRCLET,
    // A gorget of two lames, closed round her neck.
    collar({ outer: SILVER, lining: CLOTH_IN, c: [0, 19.8, 0], r: [6, 5, 7.4], bottom: 19.8, top: { back: 24.4, side: 23.8, front: 23.2 }, open: 0, lames: 2 }),
  ],
  outfit: [
    pauldron(1, 1),
    pauldron(-1, 0.94),
    // A short blue tabard over the hips with a gold hem: a front panel, shorter ones at the sides,
    // and none at the back, where the cape hangs.
    skirt({
      outer: CLOTH,
      inner: CLOTH_IN,
      waist: 5.2,
      ring: [5.4, 6.8],
      aline: 0.3,
      fan: 0.8,
      give: 0.6,
      folds: true,
      trim: GOLD,
      legs: 4.2,
      panels: [
        { from: -32, to: 32, len: 14, jag: 1.6, taper: 0.9 },
        { from: 36, to: 100, len: 10, jag: 1 },
        { from: 260, to: 324, len: 10, jag: 1 },
      ],
    }),
    // The cape, from the shoulders to the calves, in three panels that part at the hem.
    billowing(cape({ outer: CAPE, inner: CRIMSON, top: 19.6, ring: [5.4, 8.2], from: 106, to: 254, len: 36, jag: 3, taper: 1.25, panels: 3, folds: true, trim: GOLD, over: { chest: BODY.chest, hips: BODY.hips, pad: 1 } })),
  ],
  weapon: SWORD,
  offhand: KITE_SHIELD,
  // Holy light: a saturated gold body, white-hot at its leading edge and heart (pale gold between,
  // where the engine mixes the two), a deep amber where it fades, so it stays gold over the floor
  // at the size the game shows her rather than thinning to beige or slate. Her own floor rings
  // add a pale blue fringe (moves-skills.ts SKY).
  aura: { core: hex('#ffbe3a'), edge: hex('#e8962c'), hot: hex('#ffffff') },
};

export { GUARDIAN, KITE };
