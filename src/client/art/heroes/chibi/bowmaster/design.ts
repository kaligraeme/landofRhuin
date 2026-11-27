/**
 * The Bowmaster, as a chibi: a slim, light-footed woodland archer, calm and keen-eyed. A forest-green
 * hood worn up over dark brown hair (a side fringe and two strands framing her face inside it, a
 * low tail tied at the nape that shows when the hood falls back), a short hooded cape of the same
 * green over her shoulders, to her elbows at the sides and down to the backs of her knees behind,
 * a fitted dark brown leather jerkin laced up the front, leather bracers over cream linen sleeves
 * and a shooting glove, a belt with a brass buckle and a pouch, tan trousers and tall brown boots
 * with turned cuffs. She carries a wooden recurve longbow of dark reddish wood with a leather grip
 * and horn tips in her left hand and draws it with her right, and a quiver of pale-fletched arrows
 * on her back. Her effects are a verdant green-gold. Everything here is data for the chibi engine
 * (and a few small pieces of her own: the boots' cuffs, the pouch, the five-arrow fan, the snare
 * and the dark arrow of her ultimate); her moves are in the moves-*.ts files beside it, and hero.ts
 * puts her together.
 */
import { hex } from '../../paint.js';
import { quiver } from '../back.js';
import { arrow, arrowHeads, type ArrowSpec, bow, type BowSpec, flatShaft, nocked, paintArrow } from '../bow.js';
import { type BodyDesign, type ChibiDesign, type DrawItem, GEAR_ID, type HeadPiece, type Held, type HeldItem, type Lock, OFFHAND_TAG, type Piece, type PieceContext, WEAPON_TAG, type WeaponDesign } from '../design.js';
import { FACE_SOFT } from '../head.js';
import { hood } from '../headgear.js';
import { mainHeld } from '../held.js';
import { cowl } from '../pieces.js';
import { type Blob, dim, flat, type Hit, type Mat, mat4, type Part, toneLight } from '../raster.js';
import { add3, at3, cross3, dirIn, type Frame3, type Limb, lerp3, norm3, rad, sub3, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Fair skin, for the neck; the face is lit flatter and brighter so it reads clean at game size,
// with a soft warm outline, so the line under her chin reads as a crease.
const SKIN = mat4('#fff0e0', '#f6cfab', '#d8a27c', '#a26c4e', '#6e3c2c', 0.3);
const FACE_SKIN: Mat = { ...SKIN, line: hex('#a8705a'), gain: 0.3, bias: 0.6 };
const NECK: Mat = { ...mat4('#fff0e0', '#f6cfab', '#ecbc96', '#e0ae88', '#b47c62', 0.2), gain: 0.4 };
// Dark brown hair.
const HAIR = mat4('#8e6448', '#6e4a36', '#4a2e20', '#2a1a10', '#160c06', -0.05);
// The hood and cape: forest green, lit from the top planes (the light tone) down through the
// base to a deep shadow under the drape and in the folds.
export const GREEN = { ...mat4('#a4d878', '#7cbc5a', '#4e8a3a', '#2e5a26', '#122810', -0.34), gain: 0.95 };
const GREEN_IN = mat4('#3a6a2e', '#2e5a26', '#1f4019', '#132a10', '#081208');
// The cape: the same green with more contrast, so its pleats read as folds with lit edges.
const CAPE_GREEN = { ...GREEN, bias: -0.74, gain: 1.5 };
// The deepest green: the shadow where the hood's drape lies on the shoulders.
const GREEN_DEEP = mat4('#2e5a26', '#24481e', '#1c3a18', '#173016', '#0a160a');
// The band round the hood's opening, a shade lighter.
const GREEN_RIM = { ...mat4('#b4e48c', '#8cc866', '#6aa84c', '#3e6e30', '#173016', 0.05), gain: 0.65 };
// The jerkin: fitted dark brown leather.
const JERKIN = { ...mat4('#b07a52', '#8a5a3a', '#5c3a24', '#36220f', '#1a1008', -0.02), gain: 0.8 };
// Its lacing, a pale cord over the dark gap of the shirt beneath.
const LACE = flat(hex('#e8d2a4'));
const LACE_GAP = flat(hex('#2a1a10'));
// Cream linen shirt sleeves under the bracers.
const SLEEVE = { ...mat4('#fff8e8', '#eadcc0', '#c4b08c', '#8a7656', '#3e3222', 0), gain: 0.75 };
// Bracers and the belt: a deeper, redder leather than the jerkin, so they read apart from it.
const BRACER = mat4('#a86a46', '#7e4a2e', '#56301c', '#341b0e', '#180a04', -0.02);
const BRACER_RIM = mat4('#e0b07a', '#c08c58', '#966438', '#5e3c1e', '#2a180a', 0.05);
// The shooting glove.
const GLOVE = mat4('#b07a52', '#8a5a3a', '#6a4228', '#40260f', '#1e1006', 0);
const BELT = mat4('#8a5a3a', '#6a4228', '#4a2c18', '#2c190c', '#140a04', -0.05);
const BRASS = mat4('#fff2c4', '#e8c86a', '#b08a3a', '#6e5220', '#382808', 0.05);
// The quiver's bands: an old, dull brass, so on her back they do not outshine her hood.
const OLD_BRASS = mat4('#b08a3a', '#8e6c2c', '#6e5220', '#4a3614', '#221806', -0.1);
// Tan trousers.
const TROUSERS = { ...mat4('#ecd6a8', '#d8bc8a', '#b0925e', '#7a6038', '#3e2e18', 0), gain: 0.8 };
// Tall brown boots, their turned cuffs a lighter suede.
const BOOT = mat4('#9a6448', '#76482f', '#52301e', '#321c11', '#180c07', -0.05);
const CUFF = mat4('#d2a074', '#b07e54', '#8a5a36', '#5a3820', '#24140a', 0.05);
const SOLE = mat4('#2a2026', '#1e171c', '#151014', '#0c090b', '#08060a');
// The quiver: tooled leather with brass bands.
const QUIVER = mat4('#c07a4c', '#9a5834', '#6c3a20', '#40200f', '#200e06', -0.02);
// The bow: dark reddish wood, a leather grip, horn tips, a pale string.
const BOW_WOOD = mat4('#d0805a', '#a8543a', '#743222', '#421a10', '#200a06', 0);
const BOW_GRIP = mat4('#a87a58', '#7c5236', '#583822', '#341f12', '#1a0e06', 0);
const HORN = mat4('#fff6e0', '#e8dcc0', '#b4a486', '#7a6c52', '#3a3224', 0.1);
const STRING = flat(hex('#f4ecd8'));
// Arrows: pale ash shafts, steel heads, pale fletching.
const SHAFT = mat4('#f2e2c0', '#e0c896', '#c4a874', '#8a7048', '#3a2e1a');
const STEEL = mat4('#ffffff', '#dfe4ee', '#a8b0c2', '#6c7488', '#2a2e3a', 0.08);
const FLETCH = mat4('#ffffff', '#f4f0e4', '#d6d0bc', '#a09680', '#4e463a', 0.1);
// The dark arrow of her ultimate: a black shaft, a violet head, black fletching.
const DARK_SHAFT = mat4('#4a3a5a', '#2e2238', '#1e1626', '#120c18', '#08040c');
const DARK_HEAD = mat4('#e4c8ff', '#a878e0', '#6a3aa8', '#3a1a66', '#140626', 0.05);
const DARK_FLETCH = mat4('#5a4a6a', '#3a2c48', '#261c30', '#160e1e', '#08040c');
// The snare: a coil of tarred cord with an iron jaw.
const CORD = mat4('#f4e2b0', '#d8c08a', '#a8905e', '#6e5a34', '#2a1e0c', 0.05);
const IRON = mat4('#c8ccd8', '#9096a6', '#62687a', '#3c404e', '#16181e', 0.05);

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** Slim and light: narrow shoulders, long legs for her size; about 80 px tall with the hood. */
const BUILD = { hip: 27.4, thigh: 12.3, shin: 12.1, ankle: 4, torso: 22, neck: 2, shoulder: 7, hipWidth: 3.6, shoulderDrop: 3.2, upperArm: 8.2, foreArm: 8, headUp: 11.6 };

// ── Hair: a side fringe, two strands framing the face, a low tail ────────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // A side fringe swept across to her left, under the hood's edge.
  L(30, 46, [0.35, -0.8, -0.85], 6.5, 3.2, [0.1, -0.15, -0.3], 0.3, 0.3),
  L(6, 50, [0.4, -0.9, -0.8], 8.5, 3.4, [0.1, -0.2, -0.3], 0.3, 0.3),
  L(-20, 46, [0.45, -1, -0.55], 9, 3.3, [0.15, -0.1, -0.2], 0.3, 0.3),
  L(-46, 32, [0.3, -1, -0.3], 8.5, 2.8, [0.1, 0, -0.1], 0.3),
  // Two strands framing her face inside the hood, to her jaw.
  L(66, 14, [0.2, -1, 0.12], 11, 2.3, [0.08, 0, 0.05], 0.4, 0.3),
  L(-66, 14, [0.2, -1, -0.12], 11, 2.3, [0.08, 0, -0.05], 0.4, 0.3),
];

const SHELL = { c: [-1.4, 1.2, 0] as V3, r: [11, 10.2, 10.9] as V3 };

/** The hood: worn up over her hair, its opening's band a shade lighter, a soft point at its crown. */
const HOOD_DRAPE = -15;
const HOOD = hood({ outer: GREEN, inner: GREEN_IN, rim: GREEN_RIM, shell: SHELL, opening: { top: 6.4, bottom: -12.5, side: 8.4 }, drape: HOOD_DRAPE, peak: { pitch: 34, size: 4.4 }, folds: true });

/**
 * The hood worn up, shaped further than the engine's plain hood so its back is not one flat dome:
 * a seam down the middle of its back from the peak, the lower half of its back falling into
 * shadow, and a band of the deepest green where its drape lies on her shoulders.
 */
const HOOD_UP: HeadPiece = {
  ...HOOD.up,
  blobs: (ctx, head) =>
    (HOOD.up.blobs?.(ctx, head) ?? []).map((g) => ({
      ...g,
      shade: (h: Hit) => {
        const out = g.shade(h);
        if (!out || h.back || out.m !== GREEN) return out;
        const p = h.p;
        const behind = SHELL.c[0] - p[0];
        // The drape's lower edge on the shoulders.
        if (p[1] < HOOD_DRAPE + 2.6) return { ...out, m: GREEN_DEEP, light: toneLight(GREEN_DEEP, p[1] < HOOD_DRAPE + 1.3 ? 3 : 2) };
        const light = out.light ?? ctx.cam.light(dirIn(head, h.n[0], h.n[1], h.n[2]));
        // The seam down the back, from the peak to the drape.
        if (behind > 4 && Math.abs(p[2]) < 0.6 && p[1] < SHELL.c[1] + 9) return { ...out, light: toneLight(GREEN, 3) };
        // The lower back half in shadow, deepening toward the shoulders.
        if (behind > 1 && p[1] < SHELL.c[1] - 2) return { ...out, light: light - 0.25 - Math.min(0.35, (SHELL.c[1] - 2 - p[1]) * 0.04) };
        return out;
      },
    })),
};

/** A frame tipped back by `deg` degrees about its own side axis, round a point (`pivot`, in the frame's own axes). */
function tipBack(fr: Frame3, deg: number, pivot: V3): Frame3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  const u = norm3(sub3(add3([0, 0, 0], fr.u, c), add3([0, 0, 0], fr.f, s)));
  const f = norm3(add3(add3([0, 0, 0], fr.f, c), fr.u, s));
  const P = add3(add3(add3(fr.o, fr.f, pivot[0]), fr.u, pivot[1]), fr.r, pivot[2]);
  const o = sub3(P, add3(add3(add3([0, 0, 0], f, pivot[0]), u, pivot[1]), fr.r, pivot[2]));
  return { o, f, u, r: fr.r };
}

/** How far the hood is tipped back as it slides off, and the point at the back of her skull it turns about. */
const SLIDE = 58;
const SLIDE_PIVOT: V3 = [-4, -6, 0];

/**
 * The hood sliding back off her hair, the one frame between worn up and worn down (in the KO and
 * the victory): the hood worn up, tipped back about the back of her skull, so her fringe and the
 * front of her crown show and its opening, rimmed in the lighter band, faces up. It covers the
 * hair it still lies over (where hair would poke through it).
 */
const HOOD_SLIDING: HeadPiece = {
  blobs: (ctx, head) => HOOD_UP.blobs?.({ ...ctx, pose: { ...ctx.pose, hood: 'up' } }, tipBack(head, SLIDE, SLIDE_PIVOT)) ?? [],
  covers: () => {
    const c = Math.cos(rad(-SLIDE));
    const s = Math.sin(rad(-SLIDE));
    const R = [SHELL.r[0] + 1.6, SHELL.r[1] + 1.6, SHELL.r[2] + 1.6];
    return (p: V3) => {
      // The point in the tipped hood's own axes: turned the other way about the pivot.
      const x = p[0] - SLIDE_PIVOT[0];
      const y = p[1] - SLIDE_PIVOT[1];
      const q: V3 = [SLIDE_PIVOT[0] + x * c + y * s, SLIDE_PIVOT[1] - x * s + y * c, p[2]];
      const d = ((q[0] - SHELL.c[0]) / (R[0] as number)) ** 2 + ((q[1] - SHELL.c[1]) / (R[1] as number)) ** 2 + ((q[2] - SHELL.c[2]) / (R[2] as number)) ** 2;
      // Everything growing from the back of her head is still under it (the tied tail too).
      return p[0] < -1 || (d < 0.92 && q[0] < 0);
    };
  },
};

/**
 * The hood worn down: a deep roll of cloth round the back of her neck and over her shoulders,
 * wider than her hair so it shows either side of it from behind, its opening turned up in the
 * lighter band with the lining in shadow along it, and the hood bunched on her upper back below,
 * narrowing to its point (which lifts a little in the wind).
 */
const FALLEN_HOOD: Piece = (ctx: PieceContext): DrawItem[] => {
  if (ctx.pose.hood !== 'down') return [];
  const { rig, pose } = ctx;
  const cf = rig.chest;
  const T = ctx.build.torso;
  const wind = Math.max(0, pose.wind ?? 0);
  const lift = pose.lift ?? 0;
  const roll: Blob = { c: [-3.4, T - 1, 0], r: [4.8, 4, 14.4], id: GEAR_ID + 1 };
  const bodyC: V3 = [-7 - wind * 1.2, T - 7 + lift * 1.5 + wind * 0.6, 0];
  const body: Blob = { c: bodyC, r: [3.2, 8.4, 9.6], id: GEAR_ID };
  const shade = (h: Hit): { m: Mat; light?: number; id?: number } | null => {
    if (h.back) return null;
    const p = h.p;
    if (h.blob === body) {
      // It narrows to a point at the bottom, a crease down its middle.
      const below = (bodyC[1] - p[1]) / body.r[1];
      if (below > 0 && Math.abs(p[2]) / body.r[2] > 1.05 - below) return null;
      if (Math.abs(p[2]) < 0.7 && p[1] < bodyC[1] + 2) return { m: GREEN, light: toneLight(GREEN, 3) };
      return { m: GREEN };
    }
    // The opening, turned up: the lining in shadow along the roll's top; the roll below it in the band's green, deep where it lies on her.
    if (h.n[1] > 0.86 && p[0] < -1.5) return { m: GREEN_IN, light: toneLight(GREEN_IN, 2), id: GEAR_ID + 2 };
    if (h.n[1] < -0.5) return { m: GREEN_DEEP, light: toneLight(GREEN_DEEP, 2) };
    return { m: GREEN_RIM };
  };
  const mid = at3(cf, bodyC[0] - body.r[0], T - 3, 0);
  return [
    {
      z: ctx.upperZ(ctx.depth(mid)),
      draw: () => {
        const part = ctx.part();
        part.blobs(cf, [roll, body], shade);
        part.commit();
      },
    },
  ];
};

// ── The torso: a laced jerkin and a belt ─────────────────────────────────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  // The jerkin's skirt over the top of the hips, then her trousers.
  if (where === 'hips') return u > 3.4 ? JERKIN : TROUSERS;
  if (u < 5) return null;
  // The belt, with a brass buckle at the front.
  if (u < 7.4) {
    if (yaw < 9 && u > 5.3 && u < 7.2) return yaw < 5 && u > 5.9 && u < 6.6 ? BELT : BRASS;
    return BELT;
  }
  // Laced up the front: a dark gap crossed by a pale cord in a zigzag.
  if (yaw < 3.6 && u > 8.6 && u < 19.5) {
    const k = (((u - 8.6) / 2.6) % 1 + 1) % 1;
    const across = Math.abs(k * 2 - 1);
    if (Math.abs(yaw / 3.6 - across) < 0.28) return LACE;
    if (yaw < 1.1) return LACE_GAP;
  }
  return JERKIN;
}

const BODY: BodyDesign = {
  thigh: { mat: TROUSERS, r0: 3.3, r1: 2.8 },
  shin: { mat: TROUSERS, r0: 2.6, r1: 2.4 },
  // Tall boots to just under the knee.
  boot: { mat: BOOT, r: 2.9, top: 0.72, toe: 5.4, heel: 2, sole: SOLE, foot: [2.5, 2.1] },
  upperArm: { mat: SLEEVE, r0: 2.7, r1: 2.4 },
  foreArm: { mat: SLEEVE, r0: 2.4, r1: 2.3 },
  // A leather bracer over the forearm, a pale rim at its elbow end.
  cuff: { mat: BRACER, r: 2.75, at: 0.22, rim: BRACER_RIM },
  hand: { mat: GLOVE, r: 2.4 },
  neck: { mat: NECK, r: 2 },
  hips: [{ c: [0, 3, 0], r: [4.6, 5, 6], id: 1 }],
  chest: [
    { c: [0, 8, 0], r: [4.1, 4.6, 5.5], id: 1 },
    { c: [0.3, 14, 0], r: [4.8, 8, 6.8], id: 1 },
  ],
  torso,
};

// ── Pieces of her own: the boots' cuffs and the belt pouch ───────────────────────────────────

/**
 * The turned cuff at the top of each tall boot: a band of lighter suede three pixels deep, a
 * little wider than the boot, sorted just over its leg (a step darker on the far leg, as the
 * painter dims a far leg).
 */
const bootCuffs: Piece = (ctx: PieceContext): DrawItem[] => {
  const { rig, depth, proj } = ctx;
  const torsoTrue = depth(at3(rig.chest, 0, 14, 0));
  const item = (leg: Limb): DrawItem => {
    const far = depth(leg.mid) < torsoTrue - 2;
    const z = depth(leg.mid) * 0.7 + depth(leg.root) * 0.3 + 0.02;
    return {
      z,
      draw: () => {
        const part = ctx.part();
        const top = lerp3(leg.end, leg.mid, BODY.boot.top + 0.04);
        const a = proj(top);
        const b = proj(lerp3(leg.end, leg.mid, BODY.boot.top - 0.14));
        // Across the shin on screen, a little wider than the boot; three pixels down it.
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dl = Math.hypot(dx, dy) || 1;
        const ux = (dx / dl) * 3;
        const uy = (dy / dl) * 3;
        const w = BODY.boot.r * 1.18;
        const nx = (-dy / dl) * w;
        const ny = (dx / dl) * w;
        const m = far ? dim(CUFF, -0.12) : CUFF;
        const zz = depth(top) + 0.6;
        part.poly(
          [
            [a[0] + nx - ux * 0.15, a[1] + ny - uy * 0.15],
            [a[0] - nx - ux * 0.15, a[1] - ny - uy * 0.15],
            [a[0] - nx * 0.92 + ux, a[1] - ny * 0.92 + uy],
            [a[0] + nx * 0.92 + ux, a[1] + ny * 0.92 + uy],
          ],
          m,
          (x) => (far ? 0.2 : 0.5) - ((x - a[0]) / w) * 0.3,
          zz,
          1,
        );
        part.commit();
      },
    };
  };
  return [item(rig.legR), item(rig.legL)];
};

/** The pouch on her belt at her right hip: a small leather bag with a flap and a brass stud. */
const POUCH = { at: [0.4, 4.4, 5.8] as V3, r: [2.4, 2.5, 1.6] as V3 };

const pouch: Piece = (ctx: PieceContext): DrawItem[] => {
  const { rig, depth } = ctx;
  const c = at3(rig.pelvis, POUCH.at[0], POUCH.at[1], POUCH.at[2]);
  return [
    {
      z: ctx.upperZ(depth(c)),
      draw: () => {
        const part = ctx.part();
        part.blobs(rig.pelvis, [{ c: POUCH.at, r: POUCH.r, id: 1 }], (h) => {
          if (h.back) return null;
          const dy = h.p[1] - POUCH.at[1];
          // A flap over the top, a brass stud at its point.
          if (dy > 0.2 && Math.abs(h.p[0] - POUCH.at[0]) < 0.7 && h.p[2] > POUCH.at[2]) return { m: BRASS, id: 3 };
          return { m: dy > 0.6 ? BRACER : BELT, id: dy > 0.6 ? 2 : 1 };
        });
        part.commit();
      },
    },
  ];
};

// ── The bow, the arrows and the quiver ───────────────────────────────────────────────────────

/** Her arrows: about 26 px, pale ash shafts, steel heads that glow green-gold when charged, pale fletching. */
export const ARROW: ArrowSpec = {
  len: 26,
  shaft: SHAFT,
  head: { len: 4, w: 1.8, mat: STEEL, glow: hex('#d8ffa0') },
  fletch: { len: 4.5, w: 1.6, mat: FLETCH },
};

/** The dark arrow of Rain of Ruin: black, its head ablaze in violet. */
export const DARK_ARROW: ArrowSpec = {
  len: 27,
  shaft: DARK_SHAFT,
  head: { len: 4.5, w: 2.1, mat: DARK_HEAD, glow: hex('#e8c0ff') },
  fletch: { len: 5, w: 1.8, mat: DARK_FLETCH },
};

/** A recurve longbow about 64 px tip to tip: dark reddish wood curling forward at the tips, a leather grip, horn caps. */
const BOW_SPEC: BowSpec = {
  limb: { len: 28.5, w0: 1.7, w1: 0.85, mat: BOW_WOOD },
  grip: { len: 7, r: 1.7, mat: BOW_GRIP },
  brace: 12.5,
  bend: 2,
  recurve: 5,
  tips: HORN,
  string: STRING,
  arrow: ARROW,
};

/**
 * A bow sorted against her head by its upper limb rather than by its grip alone. The painter
 * sorts the off-hand item by a point near its grip, and her big chibi head decides whether a bow
 * raised beside it reads: whenever the middle of the upper limb is clearly nearer the viewer than
 * the head's middle, the bow goes over the head (a bow raised high and canted toward the viewer
 * for Volley lies over the front of her hood), and whenever it is well beyond it, under it (a bow
 * held up beyond her hood seen from behind stays behind it). Otherwise it sorts as the painter
 * would. The limbs are painted as one of its own items; the painter's call paints nothing.
 *
 * `overhead` is for a bow raised over her head (Volley): from the front its grip is just ahead of
 * her face and its limb would lie across her eyes, so seen from the front it keeps behind her hood
 * (it is only a few pixels in front of it); seen from behind, its upper limb lies over the hood
 * where it passes over the crown.
 */
function headSorted(item: HeldItem, overhead = false): HeldItem {
  return {
    ...item,
    paint: () => {},
    items: (ctx: PieceContext, held: Held): DrawItem[] => {
      const { rig, depth } = ctx;
      const g = held.grip;
      const headZ = depth(at3(rig.chest, 0, 14, 0)) + ctx.upper + 1;
      let z = ctx.upperZ(depth(add3(g.o, g.u, item.reach[1] * 0.3)));
      const limb = depth(add3(g.o, g.u, 17)) - depth(rig.head.o);
      if (held.tag === OFFHAND_TAG && !ctx.pose.dropB && !ctx.pose.slingB) {
        if (overhead && ctx.cam.view === 'front') z = Math.min(z, headZ - 0.1);
        else if (limb > 2 || (overhead && ctx.cam.view === 'back')) z = Math.max(z, headZ + 0.1);
        else if (limb < -3) z = Math.min(z, headZ - 0.1);
      }
      return [
        {
          z,
          draw: () => {
            const part = ctx.part(OFFHAND_TAG);
            item.paint(ctx, part, held);
            part.commit();
          },
        },
        ...(item.items ? item.items(ctx, held) : []),
      ];
    },
  };
}

const LONGBOW = headSorted(bow(BOW_SPEC));

/**
 * The arrow in her drawing hand (bow.ts `arrow`, which hides itself while one is on the string):
 * dropped (`drop`) with nowhere to lie (no `dropAt`), it is not painted at all, so a pose can
 * leave the hand empty (at ease, running, nocked).
 */
function heldArrow(spec: ArrowSpec): WeaponDesign {
  const a = arrow(spec);
  return {
    ...a,
    paint: (ctx, part, held) => {
      if (ctx.pose.drop && !ctx.pose.dropAt) return;
      a.paint(ctx, part, held);
    },
  };
}

/**
 * An arrow twirled in her fingers (the victory): held at its middle, so it spins about the hand
 * rather than sweeping its whole length round; dropped with nowhere to lie, it is not painted.
 */
function twirlArrow(spec: ArrowSpec): WeaponDesign {
  const A = flatShaft(spec);
  const heads = arrowHeads(A);
  return {
    grip2: 0,
    reach: [0, A.len / 2],
    tip: A.len / 2,
    paint: (ctx, part, held = mainHeld(ctx)) => {
      if (ctx.pose.drop && !ctx.pose.dropAt) return;
      paintArrow(ctx, part, A, heads, add3(held.grip.o, held.grip.u, -A.len / 2), held.grip.u, held.blaze, 0);
    },
  };
}

/**
 * Fan of Arrows: the bow with five arrows on its string, fanned out in the bow's own plane (canted
 * flat, a level fan of 50 degrees) round the one the bow nocks itself.
 */
function fanBow(spec: BowSpec, spread = 50): HeldItem {
  const base = bow(spec);
  const A = flatShaft(spec.arrow);
  const heads = arrowHeads(A);
  return {
    ...base,
    items: (ctx: PieceContext, held: Held): DrawItem[] => {
      const out = base.items ? base.items(ctx, held) : [];
      // Only a full draw carries the fan: nocked at rest, it is a single arrow.
      if (ctx.pose.slingB || ctx.pose.dropB || !nocked(ctx.pose) || (ctx.pose.draw ?? 0) < 0.6 || !base.aim) return out;
      const { tip, dir } = base.aim(ctx, held);
      const nock = add3(tip, dir, -A.len);
      // Across the fan: the bow's own length, squared to the arrow.
      const u = held.grip.u;
      const side = norm3(sub3(u, [dir[0] * (u[0] * dir[0] + u[1] * dir[1] + u[2] * dir[2]), dir[1] * (u[0] * dir[0] + u[1] * dir[1] + u[2] * dir[2]), dir[2] * (u[0] * dir[0] + u[1] * dir[1] + u[2] * dir[2])]));
      for (const k of [-1, -0.5, 0.5, 1]) {
        const th = rad((spread / 2) * k);
        const d = norm3(add3([dir[0] * Math.cos(th), dir[1] * Math.cos(th), dir[2] * Math.cos(th)], side, Math.sin(th)));
        out.push({
          z: ctx.upperZ(ctx.depth(add3(nock, d, A.len * 0.5))) + 0.04,
          draw: () => {
            const part = ctx.part(3);
            paintArrow(ctx, part, A, heads, nock, d, held.blaze, (ctx.pose.draw ?? 0) > 0 ? 1.5 : 0);
            part.commit();
          },
        });
      }
      return out;
    },
  };
}

/**
 * The coiled snare she tosses (Snare Trap): a ring of cord about 10 px across with an iron jaw
 * along one side, its teeth pointing in, held at its edge. As a main weapon it is in her right
 * hand, or flies where the pose drops it (`dropAt`); dropped with nowhere to lie, it is gone.
 */
export const SNARE: WeaponDesign = {
  grip2: 0,
  reach: [0, 11],
  tip: 5.4,
  paint: (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)) => {
    if (held.tag === WEAPON_TAG && ctx.pose.drop && !ctx.pose.dropAt) return;
    const { o, u, v } = held.grip;
    const n = norm3(cross3(u, v));
    const R = 5;
    const centre = add3(o, u, R + 0.4);
    // The ring of cord, a little tilted out of the hand's plane so it shows as a loop in every view.
    const ring = (th: number, r: number): V3 => add3(add3(centre, u, Math.cos(th) * r), add3(v, n, 0.45), Math.sin(th) * r * 0.9);
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = ring((i / N) * Math.PI * 2, R);
      const b = ring(((i + 1) / N) * Math.PI * 2, R);
      part.capsule(ctx.proj(a), ctx.proj(b), 1.1, 1.1, CORD, 0.1, ctx.depth(a), ctx.depth(b), 1);
    }
    // A second, smaller turn of the coil inside it.
    for (let i = 0; i < N; i += 2) {
      const a = ring((i / N) * Math.PI * 2 + 0.5, R * 0.6);
      const b = ring(((i + 2) / N) * Math.PI * 2 + 0.5, R * 0.6);
      part.capsule(ctx.proj(a), ctx.proj(b), 0.8, 0.8, CORD, -0.1, ctx.depth(a) - 0.1, ctx.depth(b) - 0.1, 2);
    }
    // The iron jaw: an arc of iron along the far side of the ring, its teeth pointing in.
    for (let i = -3; i < 3; i++) {
      const a = ring((i / 7) * Math.PI, R + 0.3);
      const b = ring(((i + 1) / 7) * Math.PI, R + 0.3);
      part.capsule(ctx.proj(a), ctx.proj(b), 1.25, 1.25, IRON, 0.15, ctx.depth(a) + 0.4, ctx.depth(b) + 0.4, 3);
    }
    for (let i = -2; i <= 2; i++) {
      const a = ring((i / 7) * Math.PI, R);
      const b = ring((i / 7) * Math.PI, R - 2);
      part.capsule(ctx.proj(a), ctx.proj(b), 0.7, 0.4, IRON, 0.3, ctx.depth(a) + 0.5, ctx.depth(b) + 0.5, 3);
    }
  },
};

/**
 * The quiver on her back: slanting up across it to its mouth at her right shoulder, its arrows
 * leaning out past the shoulder so their fletchings fan above it beside the hood's drape (from the
 * side and the front too), its bands an old dull brass.
 */
const QUIVER_SPEC = {
  mouth: [-6.4, 23.2, 7.2] as V3,
  foot: [-6, 6, -3.6] as V3,
  r: [2.6, 2.1] as const,
  mat: QUIVER,
  band: OLD_BRASS,
  arrows: { n: 5, out: 9.5, shaft: flat(hex('#d8b080')), fletch: FLETCH, len: 4.5, spread: 2.2 },
  strap: { mat: BELT, side: 1 as const, w: 1, over: { chest: BODY.chest, hips: BODY.hips } },
};
const QUIVER_BASE = quiver(QUIVER_SPEC);
/** The quiver's strap (chest frame): from its mouth up over her right shoulder, and from its foot round her left side under the arm. */
const STRAP_RUNS: readonly (readonly V3[])[] = [
  [
    [-6.2, 21.4, 6.2],
    [-4.6, 24.4, 6.6],
    [-1.6, 25.6, 6.9],
    [1.6, 24.8, 6.6],
  ],
  [
    [-6.4, 7.4, -3.4],
    [-6.4, 9.6, -5.6],
    [-4.4, 11.6, -7.2],
    [-1, 12.8, -7.4],
  ],
];

/**
 * The quiver and its strap where it rises from the quiver's mouth over her right shoulder (over
 * the cape, so it shows from behind). Whenever her back is turned from the viewer (a backflip seen
 * from the front, or on its side), the quiver sorts behind her torso and head rather than over them.
 */
const QUIVER_PIECE: Piece = (ctx: PieceContext): DrawItem[] => {
  const { rig, cam, depth, proj } = ctx;
  const cf = rig.chest;
  const torsoZ = depth(at3(cf, 0, 14, 0)) + ctx.upper;
  const turnedAway = cam.facing([-cf.f[0], -cf.f[1], -cf.f[2]]) < -0.25;
  const items = QUIVER_BASE(ctx).map((it) => (turnedAway ? { ...it, z: Math.min(it.z, torsoZ - 0.3) } : it));
  for (const run of STRAP_RUNS) {
    const path = run.map((q) => at3(cf, ...q));
    const mid = path[1] as V3;
    items.push({
      z: turnedAway ? torsoZ - 0.25 : ctx.upperZ(depth(mid)) + 0.5,
      draw: () => {
        const part = ctx.part();
        for (let i = 0; i + 1 < path.length; i++) {
          const a = path[i] as V3;
          const b = path[i + 1] as V3;
          part.capsule(proj(a), proj(b), 1, 1, BELT, 0.1, depth(a) + 0.3, depth(b) + 0.3, 1);
        }
        part.commit();
      },
    });
  }
  return items;
};

/**
 * The hood worn down and the quiver: the fallen hood lies bunched on her upper back under the
 * quiver's tube (the engine lays a hood worn down over a quiver's mouth), so the tube and its
 * strap still cross her back when the hood is down, but over the cape, so the hood shows as a
 * green fold round the back of her neck.
 */
const BACK_GEAR: Piece = (ctx: PieceContext): DrawItem[] => {
  const quiverItems = QUIVER_PIECE(ctx);
  // The tube is the last of the engine quiver's own items (its chest strap comes first).
  const tube = quiverItems[QUIVER_BASE(ctx).length - 1];
  const under = (tube ? tube.z : Math.min(...quiverItems.map((it) => it.z))) - 0.02;
  return [...FALLEN_HOOD(ctx).map((it) => ({ ...it, z: Math.min(it.z, under) })), ...quiverItems];
};

/**
 * The hooded cape: a short capelet at the front (so the laced jerkin shows), over the shoulders
 * and upper arms at the sides, and down to the backs of her knees behind, its hem cut in points.
 */
const CAPE = cowl({
  outer: CAPE_GREEN,
  inner: GREEN_IN,
  top: 21.4,
  ring: [3.6, 4.2],
  folds: true,
  panels: [
    { from: -48, to: 48, len: 6, jag: 1.5 },
    { from: 48, to: 100, len: 12.5, jag: 2 },
    { from: 100, to: 145, len: 25, jag: 3, taper: 1.1 },
    { from: 145, to: 215, len: 31, jag: 3.5, taper: 1.1 },
    { from: 215, to: 260, len: 25, jag: 3, taper: 1.1 },
    { from: 260, to: 312, len: 12.5, jag: 2 },
  ],
  over: { chest: BODY.chest, hips: BODY.hips },
});

/** Verdant green-gold: a green core, a pale gold edge, a white heart. */
const AURA = { core: hex('#9ef08a'), edge: hex('#fff0a0'), hot: hex('#ffffff') };

const BOWMASTER: ChibiDesign = {
  id: 'hero-bowmaster',
  build: BUILD,
  head: {
    skin: FACE_SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [8.8, 9.3, 9.8] },
    jaw: { c: [1.5, -4, 0], r: [7.4, 6.4, 7.6] },
    ear: { c: [-0.6, -3.2, 9.4], r: [1.8, 2.6, 1.5] },
    shell: SHELL,
    hairline: { faceYaw: 72, brow: 3.6, temple: 0, nape: -9, ear: -2 },
    locks: LOCKS,
    whorl: { yaw: 180, pitch: 58, reach: 82, clumps: 6, twist: 0.2 },
    long: {
      // A low tail tied at the nape with a leather cord, hidden under the hood while it is up.
      tail: { yaw: 180, pitch: -4, dir: [-0.5, -1, 0], stiff: 0.2, len: 18, w: 2.8, tie: { mat: BELT, r: 1.8, ends: 4 }, sheen: 0.3 },
      lie: 1.8,
    },
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
  },
  body: BODY,
  headPieces: [HOOD_UP],
  outfit: [CAPE, BACK_GEAR, pouch, bootCuffs],
  weapon: heldArrow(ARROW),
  offhand: LONGBOW,
  aura: AURA,
};

/** Fan of Arrows: five arrows on the string. */
const BOWMASTER_FAN: ChibiDesign = { ...BOWMASTER, offhand: headSorted(fanBow(BOW_SPEC)) };

/** The victory: the arrow she twirls held at its middle. */
const BOWMASTER_TWIRL: ChibiDesign = { ...BOWMASTER, weapon: twirlArrow(ARROW) };

/** The frame her hood slides back off her hair (the KO and the victory): the hood tipped back, not yet down. */
const sliding = (d: ChibiDesign): ChibiDesign => ({ ...d, headPieces: [HOOD_SLIDING], outfit: [CAPE, QUIVER_PIECE, pouch, bootCuffs] });
const BOWMASTER_SLIDING = sliding(BOWMASTER);
const BOWMASTER_TWIRL_SLIDING = sliding(BOWMASTER_TWIRL);

/** Volley: the bow raised over her head, sorted against the hood as such (see `headSorted`). */
const BOWMASTER_VOLLEY: ChibiDesign = { ...BOWMASTER, offhand: headSorted(bow(BOW_SPEC), true) };

/** Snare Trap: the coiled snare in her right hand in place of an arrow. */
const BOWMASTER_SNARE: ChibiDesign = { ...BOWMASTER, weapon: SNARE };

/**
 * The bow for Rain of Ruin: the dark arrow on its string while it is drawn (half way or more), an
 * ordinary one at rest, so the arrow she nocks again afterward is her own.
 */
function darkBow(spec: BowSpec): HeldItem {
  const plain = bow(spec);
  const dark = bow({ ...spec, arrow: DARK_ARROW });
  const pick = (ctx: PieceContext): HeldItem => ((ctx.pose.draw ?? 0) >= 0.5 ? dark : plain);
  return {
    ...plain,
    aim: (ctx, held) => (pick(ctx).aim as NonNullable<HeldItem['aim']>)(ctx, held),
    items: (ctx, held) => (pick(ctx).items as NonNullable<HeldItem['items']>)(ctx, held),
  };
}

/** Rain of Ruin: a single dark arrow on a bow raised over her head (sorted as Volley's), and her effects turned violet-black with green sparks. */
const BOWMASTER_RUIN: ChibiDesign = {
  ...BOWMASTER,
  offhand: headSorted(darkBow(BOW_SPEC), true),
  aura: { core: hex('#7a34c8'), edge: hex('#1a0a2a'), hot: hex('#e4ffd0') },
};

export { BOWMASTER, BOWMASTER_FAN, BOWMASTER_RUIN, BOWMASTER_SLIDING, BOWMASTER_SNARE, BOWMASTER_TWIRL, BOWMASTER_TWIRL_SLIDING, BOWMASTER_VOLLEY };
