/**
 * The Dragoon, as a chibi: a lean, long-legged young lancer with narrow amber eyes and a cocky
 * half-smile, in light dragon-styled armour of dark violet steel with pale lilac edges. He wears an
 * open-faced dragon crest half-helm (a pale brow band dipping to a point over his nose, a row of
 * overlapping scales above it and down the cheek guards, a pale ridge over the crown, two
 * swept-back fins like folded dragon wings rising behind each temple), with his jet-black hair,
 * blue in its sheen, showing at the fringe and falling from under the back of the helm in a long
 * ponytail. A scale-patterned breastplate and a gorget, layered wing-like pauldrons swept back to
 * points, vambraces ending in claws over the knuckles, scaled tassets and greaves with a spur at
 * the knee, over a dark charcoal under-suit; a streaming violet-black cape to below the knee with a
 * crimson lining and a hem cut like a wing's trailing edge. His lance is taller than he is: a dark
 * steel shaft with violet wraps and silver bands, a long leaf point with a glowing violet channel,
 * a vamplate of spread dragon wings below it and a butt spike. His energy is violet with a pale
 * lilac edge and a white-hot core. Everything here is data for the chibi engine (with the few
 * pieces of his own below: the helm's scaled cheek guards and brow point, the pauldrons, the spurs
 * and claws, the lance's wings); his moves are in the moves-*.ts files beside it, and hero.ts puts
 * him together.
 */
import { hex } from '../../paint.js';
import { scaleAt } from '../armour.js';
import { type BodyDesign, type ChibiDesign, type FaceStyle, GEAR_ID, type HeadPiece, type Held, type Lock, type Piece, type PieceContext, type WeaponDesign } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { type Fin, helm } from '../headgear.js';
import { clipToGround, heldAxes, mainHeld } from '../held.js';
import { cape, collar, skirt } from '../pieces.js';
import { pole, type PoleSpec } from '../pole.js';
import { type Blob, flat, type Hit, type Mat, mat4, type Part } from '../raster.js';
import { add3, at3, type Build, clamp, cross3, dot3, type Frame3, type Limb, mul3, norm3, rotate, sub3, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Lightly tanned.
const SKIN = mat4('#f8d6b2', '#e6ae84', '#c4865e', '#8e553a', '#57291c', 0.14);
// Jet black with a cool blue sheen: the light tone covers the clumps, the highlight streaks their lit sides.
const HAIR = mat4('#5a6a88', '#2e3446', '#1c2030', '#0e1018', '#06070c', -0.04);
// Dark violet steel: mostly its base and light tones, so the pale lilac edges and the violet glow stay the brightest things on him.
const ARMOUR = { ...mat4('#9a86d8', '#5e4a9c', '#3a2c66', '#1c1434', '#0e0a1c', -0.32), clear: 1.2 };
// Pale lilac for the edges of plates and the rims of scales.
const EDGE = mat4('#f4f0ff', '#d8ccff', '#a898e0', '#6a5aa8', '#2a2048', 0.12);
// The scales' rims: a lit lilac, between the steel and its pale edges.
const SCALE = { ...mat4('#e4dcff', '#b4a4ec', '#8270c4', '#4e3e8e', '#0e0a1c', 0.06), clear: 1.2 };
// A duller lilac for the rims of smaller plates (the vambraces' cuffs, the knee cops, the toe caps), so only the helm's and the breastplate's edges shine.
const PLATE_EDGE = mat4('#c8bcf4', '#8e7cd0', '#64529e', '#3a2e66', '#0e0a1c', -0.12);
// The shadowed gaps under the scales.
const UNDER = mat4('#3a2c66', '#2a1f4c', '#1c1434', '#120c24', '#08060e', -0.2);
// The charcoal under-suit, a step cooler and darker than the steel, so the plates stand out from it.
const SUIT = mat4('#50505e', '#3a3a46', '#24242e', '#14141a', '#0a0a0e', -0.06);
// Dark leather for the gloves and the belt.
const LEATHER = mat4('#5a4a64', '#3e3046', '#2a2030', '#18121c', '#0a070c', -0.04);
const SOLE = mat4('#2a2630', '#1e1b22', '#141217', '#0c0a0e', '#060508');
const SILVER = mat4('#ffffff', '#dfe4ee', '#aab2c2', '#6e7686', '#2a2e38', 0.14);
// The belt's lower edge.
const BELT_EDGE = flat(hex('#0e0a14'));
// The cape: violet-black outside, reading as one dark colour with its light tone on the lit folds; a crimson lining.
const CAPE = { ...mat4('#5e4a86', '#3e2e62', '#2a1e44', '#170f28', '#0a0614', -0.02), gain: 0.62 };
const CAPE_IN = { ...mat4('#e04a54', '#a8242e', '#841a24', '#64121a', '#2a060a', 0.02), gain: 0.7 };

// The lance: a dark steel shaft, violet wraps, silver bands, a pale violet-steel point with lilac
// edges, and a vamplate of dark violet steel.
const SHAFT = mat4('#6e6c84', '#44425a', '#2c2a3c', '#191826', '#0a0a10', -0.04);
const WRAP = mat4('#b096f0', '#7a5ec8', '#54409a', '#32245e', '#140c28', -0.02);
const POINT_STEEL = mat4('#e4dcfc', '#a89ed0', '#746a9c', '#463e6a', '#1a1628', 0);
const POINT_EDGE = mat4('#ffffff', '#f4f0ff', '#d4ccf0', '#a096c8', '#2a2440', 0.12);

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

// ── Hair: a fringe under the brow band, a long ponytail from under the back of the helm ─────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // Swept back over the top toward the tie (hidden under the helm but where it frames the brow band).
  L(0, 54, [-1, 0.25, 0], 11, 4.8, [-0.15, -0.3, 0], 0.5, 0.4),
  // Loose locks falling over the forehead from under the brow band: one long over his left brow, a shorter pair.
  L(-14, 42, [0.55, -1, -0.2], 7.5, 2.9, [0.2, 0, -0.14], 0.45, 0.3),
  L(12, 44, [0.6, -1, 0.18], 5.6, 2.6, [0.18, 0, 0.12], 0.45, 0.3),
  L(34, 36, [0.35, -1, 0.45], 4.8, 2.3, [0.1, 0, 0.15], 0.4),
  // Sideburns in front of the ears, under the cheek guards.
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

// ── The helm ─────────────────────────────────────────────────────────────────────────────────

const SHELL = { c: [-1.6, 1.2, 0] as V3, r: [11.2, 10.4, 11] as V3 };

/**
 * A fin like a folded dragon's wing, in its own plane ([along, up] from its root): a leading edge
 * rising steeply, then swept back to a high point, and a trailing edge cut into two more points
 * between scallops, as the fingers of a folded wing.
 */
const WING_FIN: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.8, 2.6],
  [3.6, 5.2],
  [8.4, 7.2],
  [15.6, 8],
  [11, 5.4],
  [15, 4.2],
  [10, 2.8],
  [12.4, 0.8],
  [6, 0.2],
  [2.6, -1.2],
];
const SMALL_FIN = WING_FIN.map(([a, b]): [number, number] => [a * 0.66, b * 0.58]);

/** Two fins each side, rising behind the temples and swept back, leaning out so they read from the front. */
const FINS: Fin[] = [1, -1].flatMap((s): Fin[] => [
  { yaw: s * 96, pitch: 16, dir: [-1, 0.08, s * 0.45], rise: [0.15, 1, s * 1.2], shape: WING_FIN },
  { yaw: s * 116, pitch: 2, dir: [-1, -0.05, s * 0.45], rise: [0, 1, s * 1.05], shape: SMALL_FIN },
]);

const HELM_BASE = helm({
  metal: ARMOUR,
  trim: EDGE,
  shell: SHELL,
  ease: 1.8,
  // The brow band above his brows, above the ears at the sides, and a half-helm behind, stopping
  // above the nape so the ponytail falls from under it.
  edge: { front: 4, side: -0.6, back: -2.6 },
  band: 1.3,
  cheeks: { down: -7.2, forward: 2.6, w: 3.3 },
  ridge: EDGE,
  fins: FINS,
});

/** How far the helm's own plates stand toward the viewer in the head's depth test (as headgear.ts's gear does, past the fringe). */
const HELM_LIFT = 3.5;

/**
 * The point of the brow band: a short scale of plate hanging over the bridge of his nose between
 * his brows, rimmed in the pale edge, so the band dips to a dragon's snout at the middle.
 */
const BROW_POINT: readonly V3[] = [
  [10.3, 5.4, -2.2],
  [10.3, 5.4, 2.2],
  [10.7, 2.2, 0],
];

/**
 * The dragon crest half-helm: the engine's open-faced helm (a smooth dark cap with a pale ridge,
 * a pale brow band, cheek guards and the fins), with overlapping scales over its cheek guards and
 * a point dipping from the middle of the brow band.
 */
const HELM: HeadPiece = {
  ...HELM_BASE,
  blobs: (ctx, head) =>
    (HELM_BASE.blobs?.(ctx, head) ?? []).map((b) => ({
      ...b,
      shade: (h: Hit) => {
        const r = b.shade(h);
        if (!r || r.m !== ARMOUR) return r;
        // The cheek guards (the small blobs beside the cap): rows of scales hanging down them.
        if (h.blob.r[0] < 6) {
          const s = scaleAt(h.p[0] * 1.2 + 30, 2 - h.p[1], 3.8, 2.6);
          return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? PLATE_EDGE : UNDER };
        }
        // The cap: smooth over the crown, a row of broad scales round its lower part above the band.
        const q = norm3(sub3(h.p, SHELL.c));
        const down = (Math.PI / 2 - Math.asin(clamp(q[1], -1, 1))) * 12;
        if (down < 11.5) return r;
        const s = scaleAt(Math.atan2(q[2], q[0]) * 12 + 2.6, down - 11.5, 5.2, 4.2);
        return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? PLATE_EDGE : UNDER };
      },
    })),
  paint: (ctx, part, head) => {
    HELM_BASE.paint?.(ctx, part, head);
    const pts = BROW_POINT.map((p) => at3(head, p[0], p[1], p[2]));
    part.facet(pts, ARMOUR, 0.2, GEAR_ID + 60, undefined, HELM_LIFT);
    const P = pts.map((p) => ctx.proj(p));
    const z = Math.max(...pts.map((p) => ctx.depth(p))) + HELM_LIFT + 0.3;
    part.line(P[0] as [number, number], P[2] as [number, number], EDGE, 0.55, z, GEAR_ID + 60);
    part.line(P[1] as [number, number], P[2] as [number, number], EDGE, 0.55, z, GEAR_ID + 60);
  },
};

// ── The torso: a scaled breastplate over the charcoal suit, a belt ──────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') return SUIT;
  if (u < 5) return null;
  // A dark belt with a silver buckle.
  if (u < 7.8) {
    if (yaw < 12 && u > 5.5 && u < 7.4) return yaw < 6 && u > 6 && u < 6.9 ? LEATHER : SILVER;
    return u > 7.3 ? BELT_EDGE : LEATHER;
  }
  // The breastplate: pale lilac along its lower rim, then overlapping scales over the chest and
  // round to the sides; plain plate across the back, under the cape.
  if (u < 9.4) return EDGE;
  if (yaw > 100) return ARMOUR;
  const part = scaleAt(Math.atan2(h.p[2], h.p[0]) * 6.6 + 40, 25 - u, 7.6, 5.2);
  return part === 'face' ? ARMOUR : part === 'rim' ? SCALE : UNDER;
}

const BODY: BodyDesign = {
  thigh: { mat: SUIT, r0: 3.6, r1: 3.1 },
  shin: { mat: ARMOUR, r0: 3, r1: 2.7 },
  boot: { mat: ARMOUR, r: 3.5, top: 0.5, toe: 6.2, heel: 2.4, sole: SOLE, cap: PLATE_EDGE },
  knee: { mat: PLATE_EDGE, r: 2.5 },
  // Charcoal sleeves, violet vambraces flaring to a lilac cuff, dark gloves with violet plates over the knuckles (and claws: see `spurs`).
  upperArm: { mat: SUIT, r0: 2.8, r1: 2.5 },
  foreArm: { mat: ARMOUR, r0: 2.7, r1: 2.5 },
  cuff: { mat: ARMOUR, r: 3.1, at: 0.12, rim: PLATE_EDGE },
  hand: { mat: LEATHER, r: 3, knuckle: ARMOUR },
  neck: { mat: SUIT, r: 2.4 },
  hips: [{ c: [0, 3.6, 0], r: [4.8, 4.6, 6.3], id: 1 }],
  chest: [
    { c: [0, 8.5, 0], r: [4.6, 5, 6.1], id: 1 },
    { c: [0.4, 15, 0], r: [5.5, 8.8, 7.8], id: 1 },
  ],
  torso,
};

// ── Pieces of his own: wing pauldrons, spurs and claws ───────────────────────────────────────

/** A flat plate with a pale rim a pixel wide all round, painted with its true depth (as a helm's fin is). */
function plate(ctx: PieceContext, part: Part, pts: readonly V3[], m: Mat, rim: Mat, id: number, bias = 0): void {
  part.facet(pts, m, bias, id);
  const P = pts.map((p) => ctx.proj(p));
  const Z = pts.map((p) => ctx.depth(p) + 0.3);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    part.line(P[i] as [number, number], P[j] as [number, number], rim, 0.55, ((Z[i] as number) + (Z[j] as number)) / 2, id);
  }
}

/** The pauldrons' layers, from the top down, in the shoulder's frame ([forward, up, outward]). */
const PAULDRON: readonly Blob[] = [
  { c: [0, 2.2, 1], r: [4.9, 3.8, 4.7], id: 40 },
  { c: [-0.3, -0.4, 1.9], r: [4.4, 3.2, 4.2], id: 41 },
  { c: [-0.5, -2.8, 2.5], r: [3.9, 2.8, 3.7], id: 42 },
];

/**
 * Wing-like pauldrons: three layers of scaled plate over each shoulder that tip outward as the arm
 * rises (as pieces.ts `plates` do), each swept back into a point behind the shoulder, so the
 * layers read as the folded feathers of a dragon's wing. Plates and points share one part, so
 * they sort pixel by pixel.
 */
function pauldron(side: 1 | -1): Piece {
  return (ctx) => {
    const { rig } = ctx;
    const arm = side === 1 ? rig.armR : rig.armL;
    const upper = norm3(sub3(arm.mid, arm.root));
    const rise = clamp((dot3(upper, rig.chest.u) + 1) / 1.4, 0, 1.3);
    const swing = dot3(upper, rig.chest.f);
    const base: Frame3 = { o: arm.root, f: rig.chest.f, u: rig.chest.u, r: mul3(rig.chest.r, side) };
    const fr = rotate(base, swing * -18, rise * 55);
    return [
      {
        z: ctx.depth(at3(fr, 0, 0, 4)) + ctx.upper + 0.5,
        draw: () => {
          const part = ctx.part();
          // The points first, under the plates' rims.
          PAULDRON.forEach((pl, i) => {
            const [f, u, o] = pl.c;
            const back = f - pl.r[0] * 0.55;
            const pts: V3[] = [
              [back, u + pl.r[1] * 0.55, o + pl.r[2] * 0.45],
              [f - pl.r[0] - 5.2 + i * 0.9, u + 1.6 - i * 0.4, o + pl.r[2] * 0.75],
              [back + 0.6, u - pl.r[1] * 0.45, o + pl.r[2] * 0.8],
            ];
            plate(ctx, part, pts.map((p) => at3(fr, p[0], p[1], p[2])), ARMOUR, EDGE, 45 + i, 0.05);
          });
          PAULDRON.forEach((pl) => {
            part.blobs(fr, [pl], (h: Hit) => {
              const k = (h.p[1] - pl.c[1]) / pl.r[1];
              if (k < -0.15) return null;
              if ((h.p[2] - pl.c[2]) / pl.r[2] < -0.55) return null;
              if (h.back) return { m: ARMOUR, light: -0.9 };
              if (k < 0.15) return { m: EDGE };
              const x = Math.atan2(h.p[0] - pl.c[0], h.p[2] - pl.c[2]) * (pl.r[0] + pl.r[2]) * 0.5;
              const s = scaleAt(x + 32, pl.c[1] + pl.r[1] - h.p[1], 4.2, 3);
              return { m: s === 'face' ? ARMOUR : s === 'rim' ? SCALE : UNDER };
            });
          });
          part.commit();
        },
      },
    ];
  };
}

/** The depth a leg sorts at (as the painter sorts it), so a piece on it goes on just after it. */
const legZ = (ctx: PieceContext, leg: Limb): number => ctx.depth(leg.mid) * 0.7 + ctx.depth(leg.root) * 0.3;

/**
 * The depth a fist sorts at, worked out as the painter works it out (painter.ts: an arm on the far
 * side of the torso keeps its true depth, a fist on the lance goes over the lance), so the claws
 * over it go on just after it.
 */
function fistZ(ctx: PieceContext, arm: Limb, side: 1 | -1): number {
  const { rig, depth } = ctx;
  const torso = depth(at3(rig.chest, 0, 14, 0));
  const far = (p: V3): boolean => depth(p) < torso - 2;
  const w = rig.weapon;
  const zArm = depth(add3(arm.mid, sub3(arm.end, arm.mid), 0.4)) * 0.6 + depth(arm.root) * 0.4 + (far(arm.mid) && far(arm.end) ? 0 : ctx.upper);
  const wZ = depth(add3(w.o, w.u, (LANCE.reach?.[1] ?? 0) * 0.3)) + ctx.upper;
  const holds = side === 1 ? !rig.pose.drop : rig.twoHanded;
  return holds && far(arm.end) === far(add3(w.o, w.u, 12)) ? Math.max(zArm, wZ) + 0.05 : zArm + 0.05;
}

/**
 * A spur rising from each knee cop, up and forward over the knee, and small claws over the
 * knuckles of each fist, pointing on along the forearm: flat plates of pale lilac.
 */
const spurs: Piece = (ctx) => {
  const { rig } = ctx;
  const items = [];
  for (const leg of [rig.legR, rig.legL]) {
    const thigh = norm3(sub3(leg.mid, leg.root));
    const shin = norm3(sub3(leg.end, leg.mid));
    // Out of the front of the knee, along the thigh's line, away from the shin.
    const front = norm3(sub3(thigh, shin));
    const k = leg.mid;
    const side: V3 = norm3([0, 0, leg === rig.legR ? 1 : -1]);
    const pts: V3[] = [add3(add3(k, front, 1.6), thigh, -2.4), add3(add3(k, front, 2.6), thigh, 3.2), add3(add3(k, front, 1.2), thigh, 0.4)].map((p) => add3(p, side, 0.4));
    items.push({
      z: legZ(ctx, leg) + 0.02,
      draw: () => {
        const part = ctx.part();
        plate(ctx, part, pts, PLATE_EDGE, EDGE, 60, 0.15);
        part.commit();
      },
    });
  }
  for (const [arm, s] of [[rig.armR, 1], [rig.armL, -1]] as const) {
    // Two claws from the end of the vambrace over the back of the fist, a little past it.
    const f = norm3(sub3(arm.end, arm.mid));
    const across = norm3(cross3(f, [0, 1, 0]));
    const back = norm3(cross3(across, f));
    items.push({
      z: fistZ(ctx, arm, s) + 0.01,
      draw: () => {
        const part = ctx.part();
        for (const o of [-1.1, 1.1]) {
          const root = add3(add3(arm.end, back, 1.8), across, o);
          const pts: V3[] = [add3(root, f, -2.2), add3(add3(root, f, 3.4), back, -0.6), add3(add3(root, f, -1.6), across, o * 0.6)];
          plate(ctx, part, pts, PLATE_EDGE, EDGE, 62, 0.15);
        }
        part.commit();
      },
    });
  }
  return items;
};

/** The pieces over the hips: scaled plates (tassets) at the front and sides, pointed at their hems. */
const TASSETS = skirt({
  outer: ARMOUR,
  inner: UNDER,
  waist: 5.6,
  ring: [5.4, 6.9],
  aline: 0.42,
  fan: 0.3,
  give: 0.22,
  legs: 4.2,
  trim: EDGE,
  panels: [
    { from: -44, to: -4, len: 9.5, jag: -2.2 },
    { from: 4, to: 44, len: 9.5, jag: -2.2 },
    { from: 52, to: 118, len: 10.5, jag: -2.6 },
    { from: 242, to: 308, len: 10.5, jag: -2.6 },
    { from: 128, to: 232, len: 8.5, jag: -2 },
  ],
});

/** The cape: from the shoulders to below the knee, three panels whose hems meet in points, a wing's trailing edge. */
const CAPE_PIECE = cape({
  outer: CAPE,
  inner: CAPE_IN,
  top: 20.4,
  ring: [5.4, 8.4],
  from: 104,
  to: 256,
  len: 40,
  jag: 6,
  taper: 1.4,
  panels: 4,
  folds: true,
  give: 0.95,
  over: { chest: BODY.chest, hips: BODY.hips, pad: 1.2 },
});

// ── The lance ────────────────────────────────────────────────────────────────────────────────

/** The lance's parts the pole arm builder makes: about 104 px from the butt spike to the point. */
const LANCE: PoleSpec = {
  haft: { from: -35, to: 43, r: 1.3, mat: SHAFT },
  butt: { len: 5.5, r: 1.6, mat: SILVER, spike: true },
  bands: { at: [-29, 26, 37], len: 1.4, mat: SILVER },
  wraps: [
    { from: -8, to: 4, mat: WRAP, cord: flat(hex('#1c1434')) },
    { from: 12, to: 20, mat: WRAP, cord: flat(hex('#1c1434')) },
  ],
  metal: POINT_STEEL,
  edge: POINT_EDGE,
  socket: { from: 40, to: 46, r: 1.8 },
  point: { from: 45.5, len: 21, w: 2.9, belly: 0.26 },
  rune: { from: 47.5, to: 63, rest: hex('#7a4ed0'), colour: hex('#b07cff'), glow: hex('#c8a8ff'), marks: [51, 56] },
  grip2: 12,
  reach: [37, 66.5],
};

/**
 * One wing of the vamplate, in the lance's plane ([along, across] from the right hand's rest grip,
 * on the +v side; the other mirrors it): a leading edge spreading out and up toward the point to
 * the wingtip, then a trailing edge scalloped back down toward the butt between two more points.
 */
const WING: readonly (readonly [number, number])[] = [
  [43.8, 1.4],
  [46, 4.2],
  [45.6, 7.6],
  [42.6, 5.9],
  [41.6, 7.2],
  [40.1, 4.7],
  [37.6, 5.4],
  [38, 2.8],
  [39.6, 1.3],
];
/** The leading edge of the wing, from its root to its tip: a pale band along it. */
const WING_LEAD = 3;

const WING_ID = 40;
const WING_MAT: Mat = ARMOUR;

/** Paints the vamplate's two wings into the lance's part, behind the point, with pale leading edges. */
function paintWings(ctx: PieceContext, part: Part, held: Held): void {
  const w = held.grip;
  const ax = heldAxes(ctx, w);
  clipToGround(part, ax, w);
  const at = (u: number, v: number): [number, number] => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
  const z = (u: number): number => ctx.depth(add3(w.o, w.u, u)) + 0.5;
  const light = ctx.cam.light(norm3([w.n[0], w.n[1], w.n[2]]));
  for (const s of [1, -1]) {
    const pts = WING.map(([u, v]) => at(u, s * v));
    // The far side's wing a little darker: the two read apart where they overlap edge on.
    part.poly(pts, WING_MAT, Math.abs(light) * 0.4 + (s > 0 ? 0.25 : -0.05), z(42), WING_ID + (s > 0 ? 0 : 1));
    for (let i = 0; i < WING_LEAD; i++) part.line(pts[i] as [number, number], pts[i + 1] as [number, number], EDGE, 0.6, z(44) + 0.2, WING_ID + 2);
  }
  part.clip = null;
}

const POLE = pole(LANCE);

/** The lance: the pole arm, with the vamplate's wings painted after it. Hands hold it below the wings. */
const LANCE_WEAPON: WeaponDesign = {
  ...POLE,
  haft: [-33, 35],
  paint: (ctx, part, held = mainHeld(ctx)) => {
    POLE.paint(ctx, part, held);
    paintWings(ctx, part, held);
  },
};

const DRAGOON: ChibiDesign = {
  id: 'hero-dragoon',
  build: BUILD,
  head: {
    skin: SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [9.2, 9.6, 10] },
    jaw: { c: [1.6, -4.2, 0], r: [7.6, 6.8, 7.7] },
    // Small, round ears, under the cheek guards.
    ear: { c: [-0.6, -3.4, 9.5], r: [1.7, 2.2, 1.4] },
    shell: SHELL,
    hairline: { faceYaw: 74, brow: 4, temple: 0, nape: -7, ear: -1.6 },
    locks: LOCKS,
    lockLine: hex('#06070c'),
    whorl: { yaw: 180, pitch: 42, reach: 110, clumps: 7, twist: 0 },
    long: {
      // Tied at the back of the head under the helm, falling from beneath it past his shoulder blades.
      tail: { yaw: 180, pitch: 30, dir: [-1, 0.3, 0], stiff: 0.25, len: 40, w: 2.9, give: 1.1, tie: { mat: EDGE, r: 2.4 }, sheen: 0.25 },
      lie: 2.2,
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
  headPieces: [
    HELM,
    // A gorget of two lames, closed round the neck.
    collar({ outer: ARMOUR, lining: UNDER, c: [0, 19.6, 0], r: [6, 5, 7.4], bottom: 19.6, top: { back: 24.4, side: 24, front: 23.2 }, open: 0, lames: 2 }),
  ],
  outfit: [pauldron(1), pauldron(-1), TASSETS, spurs, CAPE_PIECE],
  weapon: LANCE_WEAPON,
  // Violet energy: a pale lilac edge and a white-hot core.
  aura: { core: hex('#a46cff'), edge: hex('#d4c0ff'), hot: hex('#ffffff') },
};

export { DRAGOON };
