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
import { hex, type RGB } from '../../paint.js';
import { scaleAt } from '../armour.js';
import { type BodyDesign, type ChibiDesign, type FaceStyle, GEAR_ID, type HeadPiece, type Held, type Lock, type Piece, type PieceContext, type WeaponDesign } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { helm } from '../headgear.js';
import { clipToGround, heldAxes, mainHeld } from '../held.js';
import { cape, collar, skirt } from '../pieces.js';
import { pole, type PoleSpec } from '../pole.js';
import { type Blob, flat, type Hit, type Mat, mat4, type Part } from '../raster.js';
import { add3, at3, type Build, clamp, cross3, dot3, type Frame3, type Limb, mul3, norm3, rotate, sub3, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Lightly tanned.
const SKIN = mat4('#f8d6b2', '#e6ae84', '#c4865e', '#8e553a', '#57291c', 0.14);
// Jet black with a cool blue sheen: with the head's `darkHair` the base tone covers the clumps and the highlight is a thin blue streak.
const HAIR = mat4('#4e5e80', '#262c3e', '#1c2030', '#0e1018', '#06070c', -0.04);
// Dark violet steel: its base tone covers most of it, the light tone only the planes facing up into
// the light, the highlight only a glint, so the plates read dark indigo and the glowing lance and
// the effects stay the brightest things on him.
const ARMOUR = { ...mat4('#9a86d8', '#5e4a9c', '#3a2c66', '#1c1434', '#0e0a1c', -0.3), gain: 0.72, clear: 1.2 };
// The few near-white edges he has: the helm's brow band, the leading edges of its fins, the tips of the pauldrons.
const BRIGHT = mat4('#f4f0ff', '#d8ccff', '#a898e0', '#6a5aa8', '#2a2048', 0.02);
// A duller lilac for every other rim: the scales, the lower edges of plates, the vambraces' cuffs, the knee cops, the toe caps.
const RIM = mat4('#b4a4ec', '#8e7cd0', '#6a58a8', '#3e3070', '#0e0a1c', -0.1);
// The scales' rims: the dull lilac, mostly its light tone.
const SCALE = { ...mat4('#b4a4ec', '#8e7cd0', '#6a58a8', '#4e3e8e', '#0e0a1c', -0.15), clear: 1.2 };
// The shadowed gaps under the scales.
const UNDER = mat4('#3a2c66', '#2a1f4c', '#1c1434', '#120c24', '#08060e', -0.2);
// The helm's crest: a dark keel, lit only where it rises over the brow.
const KEEL = mat4('#c8bcf4', '#5e4a9c', '#2a1f4c', '#1c1434', '#0e0a1c');
// The charcoal under-suit, a step cooler and darker than the steel, so the plates stand out from it.
const SUIT = mat4('#50505e', '#3a3a46', '#24242e', '#14141a', '#0a0a0e', -0.06);
// Dark leather for the gloves and the belt.
const LEATHER = mat4('#5a4a64', '#3e3046', '#2a2030', '#18121c', '#0a070c', -0.04);
const SOLE = mat4('#2a2630', '#1e1b22', '#141217', '#0c0a0e', '#060508');
// Dark steel for the buckle, the lance's bands and its butt spike.
const STEEL = mat4('#c4c2d2', '#8a8898', '#5e5c70', '#3a384a', '#121018', 0.02);
// The belt's lower edge.
const BELT_EDGE = flat(hex('#0e0a14'));
// The cape: violet-black outside, its base and shadow tones over most of it and its light tone on the lit folds; a crimson lining.
const CAPE = { ...mat4('#5e4a86', '#3e2e62', '#2a1e44', '#170f28', '#0a0614', -0.22), gain: 0.62 };
const CAPE_IN = { ...mat4('#e04a54', '#a8242e', '#841a24', '#64121a', '#2a060a', 0.02), gain: 0.7 };
// The lining in the shadow under him as he kneels, a deep wine nearly black.
const CAPE_IN_DEEP = { ...mat4('#6a1620', '#4a0e18', '#360a12', '#24060c', '#120306', 0), gain: 0.6 };

// The lance: a dark steel shaft with violet wraps and two small steel bands; its point is violet
// steel that glows, with pale lilac edges and a white-hot channel; a vamplate of dark violet steel.
const SHAFT = mat4('#6e6c84', '#44425a', '#2c2a3c', '#191826', '#0a0a10', -0.04);
const WRAP = mat4('#b096f0', '#7a5ec8', '#54409a', '#32245e', '#140c28', -0.02);
const POINT_STEEL = mat4('#e0ccff', '#b48cff', '#8a5ee0', '#5a36a8', '#1a0c3a', 0.08);
const POINT_EDGE = mat4('#ffffff', '#f0e8ff', '#d8c4ff', '#a888e8', '#2a1a50', 0.2);

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
  // Locks falling from under the brow band over his forehead, to his brows and past them at the
  // temples: one long over his left brow, a pair over his right, one at each temple.
  L(-16, 42, [0.6, -1, -0.25], 9.6, 3, [0.2, 0, -0.16], 0.45, 0.3),
  L(10, 44, [0.6, -1, 0.15], 8.4, 2.8, [0.18, 0, 0.12], 0.45, 0.3),
  L(30, 38, [0.4, -1, 0.4], 8.8, 2.6, [0.12, 0, 0.16], 0.4, 0.3),
  L(-42, 30, [0.3, -1, -0.45], 8.2, 2.4, [0.1, 0, -0.14], 0.4, 0.3),
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
/** How far clear of the hair the helm stands. */
const EASE = 1.8;

const HELM_BASE = helm({
  metal: ARMOUR,
  trim: BRIGHT,
  shell: SHELL,
  ease: EASE,
  // The brow band above his brows, above the ears at the sides, and a half-helm behind, stopping
  // above the nape so the ponytail falls from under it.
  edge: { front: 4, side: -0.6, back: -2.6 },
  band: 1.1,
  cheeks: { down: -7.2, forward: 2.6, w: 3.3 },
  ridge: KEEL,
});

/** How far the helm's own plates stand toward the viewer in the head's depth test (as headgear.ts's gear does, past the fringe). */
const HELM_LIFT = 3.5;

/**
 * The point of the brow band: a short scale of plate hanging over the bridge of his nose between
 * his brows, rimmed in the pale edge, so the band dips to a dragon's snout at the middle.
 */
const BROW_POINT: readonly V3[] = [
  [10.2, 5.4, -2.4],
  [10.2, 5.4, 2.4],
  [10.8, 1.2, 0],
];

/**
 * One blade of a dragon's frill, in its own plane ([along, across] from its root): a broad blade
 * sweeping back from the temple to a hooked point, its trailing edge cut into two smaller points
 * on the way back to the root, like the spines of a folded wing. Its leading edge (the first
 * `FRILL_LEAD` edges, from the root's upper corner to the tip) is pale, the last stretch to the
 * tip a duller lilac.
 */
const FRILL: readonly (readonly [number, number])[] = [
  [0, 2.6],
  [4.4, 5],
  [9.6, 7.4],
  [15.6, 10.4],
  [12.4, 5.8],
  [14, 4.2],
  [9.8, 2.8],
  [10.6, 0.6],
  [5.6, -0.6],
  [1, -2.6],
];
const FRILL_LEAD = 3;

/**
 * The frill each side: three blades rooted one above another behind the temple, the top one the
 * longest, swept back and up past the dome and leaning out so they read from the front too; the
 * top blade's leading edge is the near-white edge (on the side of the head toward the viewer), the
 * others' the dull lilac. Each is rooted
 * at a yaw and pitch on the helm (as a lock's root), runs along `dir` and spreads across `rise`
 * (head space, for his right side; the left mirrors it), `size` scaling it.
 */
const FRILLS: readonly { yaw: number; pitch: number; dir: V3; rise: V3; size: number }[] = [
  { yaw: 80, pitch: 28, dir: [-1, 0.36, 0.18], rise: [1.4, 1, 0.3], size: 0.92 },
  { yaw: 96, pitch: 12, dir: [-1, 0.18, 0.24], rise: [1.2, 1, 0.3], size: 0.8 },
  { yaw: 112, pitch: 2, dir: [-1, 0.04, 0.3], rise: [1, 1, 0.3], size: 0.62 },
];

/** A point on the helm's shell (grown by `e`) at a yaw and pitch, head space. */
function onHelm(e: number, yaw: number, pitch: number): V3 {
  const cp = Math.cos((pitch * Math.PI) / 180);
  return [SHELL.c[0] + Math.cos((yaw * Math.PI) / 180) * cp * (SHELL.r[0] + e), SHELL.c[1] + Math.sin((pitch * Math.PI) / 180) * (SHELL.r[1] + e), SHELL.c[2] + Math.sin((yaw * Math.PI) / 180) * cp * (SHELL.r[2] + e)];
}

/**
 * Paints the frills: each blade a flat plate of the dark steel with its true depth, its leading
 * edge a pale line, the rest of its outline the steel's dark line.
 */
function paintFrills(ctx: PieceContext, part: Part, head: Frame3): void {
  FRILLS.forEach((f, i) => {
    for (const side of [1, -1]) {
      const root = onHelm(EASE - 0.8, side * f.yaw, f.pitch);
      const a = norm3([f.dir[0], f.dir[1], side * f.dir[2]]);
      const r0: V3 = [f.rise[0], f.rise[1], side * f.rise[2]];
      const b = norm3(sub3(r0, mul3(a, dot3(r0, a))));
      const pts = FRILL.map(([u, v]) => {
        const p = add3(add3(root, a, u * f.size), b, v * f.size);
        return at3(head, p[0], p[1], p[2]);
      });
      const id = GEAR_ID + 70 + i * 2 + (side > 0 ? 0 : 1);
      // The top blade's leading edge is pale on the side of the head toward the viewer; behind the head it is the dull lilac.
      const pale = i === 0 && ctx.cam.facing(mul3(head.r, side)) > -0.2;
      part.facet(pts, ARMOUR, 0.25 - i * 0.12, id, undefined, HELM_LIFT);
      const P = pts.map((p) => ctx.proj(p));
      const Z = pts.map((p) => ctx.depth(p) + HELM_LIFT + 0.3);
      for (let j = 0; j < FRILL_LEAD; j++) {
        part.line(P[j] as [number, number], P[j + 1] as [number, number], pale && j < FRILL_LEAD - 1 ? BRIGHT : RIM, 0.5 - j * 0.15, ((Z[j] as number) + (Z[j + 1] as number)) / 2, id);
      }
    }
  });
}

/**
 * The dragon crest half-helm: the engine's open-faced helm (a smooth dark cap, a pale brow band,
 * cheek guards and a crest), with a dark keel along its crest lit only over the brow, overlapping
 * scales over the cheek guards and in a row round the cap above the band, a snout point dipping
 * from the middle of the brow band, and the frills. Turned away from the viewer it keeps the
 * scales only where they face him: the far cheek guard and the back of the cap are plain dark
 * steel, so a head seen from behind reads as one dark dome.
 */
const HELM: HeadPiece = {
  ...HELM_BASE,
  blobs: (ctx, head) => {
    // How far his face is turned toward the viewer (1 full on, -1 away).
    const face = ctx.cam.facing(head.f);
    return (HELM_BASE.blobs?.(ctx, head) ?? []).map((b) => ({
      ...b,
      shade: (h: Hit) => {
        const r = b.shade(h);
        if (!r) return r;
        // The crest: a dark keel, lit where it rises over the brow.
        if (r.m === KEEL) return { ...r, light: h.p[0] > SHELL.c[0] + 8 && h.p[1] < SHELL.c[1] + 6 ? 1.2 : 0.1 };
        // The cheek guards (the small blobs beside the cap): rows of scales hanging down them, and
        // their trimmed edges in the duller lilac; plain on a cheek turned from the viewer.
        if (h.blob.r[0] < 6) {
          const near = ctx.cam.facing(mul3(head.r, h.p[2] > 0 ? 1 : -1)) > -0.25 && face > -0.35;
          if (r.m === BRIGHT) return { ...r, m: near ? RIM : ARMOUR };
          if (!near) return r;
          const s = scaleAt(h.p[0] * 1.2 + 30, 2 - h.p[1], 3.8, 2.6);
          return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? RIM : UNDER };
        }
        if (r.m !== ARMOUR) return r;
        // The cap: smooth over the crown, a row of broad scales round its lower front above the band.
        const q = norm3(sub3(h.p, SHELL.c));
        const down = (Math.PI / 2 - Math.asin(clamp(q[1], -1, 1))) * 12;
        if (down < 11.5 || q[0] < -0.2 || face < -0.3) return r;
        const s = scaleAt(Math.atan2(q[2], q[0]) * 12 + 2.6, down - 11.5, 5.2, 4.2);
        return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? RIM : UNDER };
      },
    }));
  },
  paint: (ctx, part, head) => {
    HELM_BASE.paint?.(ctx, part, head);
    paintFrills(ctx, part, head);
    const pts = BROW_POINT.map((p) => at3(head, p[0], p[1], p[2]));
    part.facet(pts, ARMOUR, 0.2, GEAR_ID + 60, undefined, HELM_LIFT);
    const P = pts.map((p) => ctx.proj(p));
    const z = Math.max(...pts.map((p) => ctx.depth(p))) + HELM_LIFT + 0.3;
    part.line(P[0] as [number, number], P[2] as [number, number], BRIGHT, 0.2, z, GEAR_ID + 60);
    part.line(P[1] as [number, number], P[2] as [number, number], BRIGHT, 0.2, z, GEAR_ID + 60);
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
    if (yaw < 12 && u > 5.5 && u < 7.4) return yaw < 6 && u > 6 && u < 6.9 ? LEATHER : STEEL;
    return u > 7.3 ? BELT_EDGE : LEATHER;
  }
  // The breastplate: a dull lilac rim along its lower edge, then overlapping scales over the chest
  // and round to the sides, their rims lit only on the upper rows and toward the light; plain plate
  // across the back, under the cape.
  if (u < 9.2) return RIM;
  if (yaw > 100) return ARMOUR;
  const part = scaleAt(Math.atan2(h.p[2], h.p[0]) * 6.6 + 40, 25 - u, 8.4, 5.4);
  if (part === 'rim') return u > 13 && h.p[2] < 3 ? SCALE : UNDER;
  return part === 'face' ? ARMOUR : UNDER;
}

const BODY: BodyDesign = {
  thigh: { mat: SUIT, r0: 3.6, r1: 3.1 },
  shin: { mat: ARMOUR, r0: 3, r1: 2.7 },
  boot: { mat: ARMOUR, r: 3.5, top: 0.5, toe: 6.2, heel: 2.4, sole: SOLE, cap: RIM },
  knee: { mat: RIM, r: 2.5 },
  // Charcoal sleeves, violet vambraces flaring to a lilac cuff, dark gloves with violet plates over the knuckles (and claws: see `spurs`).
  upperArm: { mat: SUIT, r0: 2.8, r1: 2.5 },
  foreArm: { mat: ARMOUR, r0: 2.7, r1: 2.5 },
  cuff: { mat: ARMOUR, r: 3.1, at: 0.12, rim: RIM },
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

/**
 * A flat plate with a rim a pixel wide all round, painted with its true depth (as a helm's fin
 * is); with `tip` the two edges meeting at that corner are drawn in the near-white edge instead.
 */
function plate(ctx: PieceContext, part: Part, pts: readonly V3[], m: Mat, rim: Mat, id: number, bias = 0, tip = -1): void {
  part.facet(pts, m, bias, id);
  const P = pts.map((p) => ctx.proj(p));
  const Z = pts.map((p) => ctx.depth(p) + 0.3);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    const pale = i === tip || j === tip;
    part.line(P[i] as [number, number], P[j] as [number, number], pale ? BRIGHT : rim, pale ? 0.3 : 0.55, ((Z[i] as number) + (Z[j] as number)) / 2 + (pale ? 0.05 : 0), id);
  }
}

/** The pauldrons' layers, from the top down, in the shoulder's frame ([forward, up, outward]). */
const PAULDRON: readonly Blob[] = [
  { c: [0, 2.2, 1], r: [4.9, 3.8, 4.7], id: 40 },
  { c: [-0.3, -0.4, 1.9], r: [4.4, 3.2, 4.2], id: 41 },
  { c: [-0.5, -2.8, 2.5], r: [3.9, 2.8, 3.7], id: 42 },
];

/**
 * The spikes on top of each pauldron, in the shoulder's frame ([forward, up, outward]): two
 * scales jutting up and back past the line of the shoulder, the second lower and further out.
 */
const SPIKES: readonly (readonly V3[])[] = [
  [
    [0.6, 5.2, 3.4],
    [-8.4, 10.2, 4.6],
    [-3.6, 4.6, 4.2],
  ],
  [
    [-1.6, 3.4, 4.8],
    [-9.6, 5.6, 6.6],
    [-4.8, 1.6, 5.4],
  ],
];

/**
 * Wing-like pauldrons: three layers of scaled plate over each shoulder that tip outward as the arm
 * rises (as pieces.ts `plates` do), each swept back into a point behind the shoulder, and two
 * scales on top jutting up and back past the shoulder's line, so the layers read as the folded
 * feathers of a dragon's wing and break the outline. Their tips are the near-white edge. Plates and
 * points share one part, so they sort pixel by pixel.
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
          // The points and spikes first, under the plates' rims.
          SPIKES.forEach((sp, i) => plate(ctx, part, sp.map((p) => at3(fr, p[0], p[1], p[2])), ARMOUR, RIM, 48 + i, 0.15, 1));
          PAULDRON.forEach((pl, i) => {
            const [f, u, o] = pl.c;
            const back = f - pl.r[0] * 0.55;
            const pts: V3[] = [
              [back, u + pl.r[1] * 0.55, o + pl.r[2] * 0.45],
              [f - pl.r[0] - 6 + i * 0.9, u + 1.6 - i * 0.4, o + pl.r[2] * 0.8],
              [back + 0.6, u - pl.r[1] * 0.45, o + pl.r[2] * 0.8],
            ];
            plate(ctx, part, pts.map((p) => at3(fr, p[0], p[1], p[2])), ARMOUR, RIM, 45 + i, 0.05, 1);
          });
          PAULDRON.forEach((pl) => {
            part.blobs(fr, [pl], (h: Hit) => {
              const k = (h.p[1] - pl.c[1]) / pl.r[1];
              if (k < -0.15) return null;
              if ((h.p[2] - pl.c[2]) / pl.r[2] < -0.55) return null;
              if (h.back) return { m: ARMOUR, light: -0.9 };
              if (k < 0.15) return { m: RIM };
              const x = Math.atan2(h.p[0] - pl.c[0], h.p[2] - pl.c[2]) * (pl.r[0] + pl.r[2]) * 0.5;
              const s = scaleAt(x + 32, pl.c[1] + pl.r[1] - h.p[1], 4.6, 3.2);
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
 * A spur rising from each knee cop, up and forward over the knee past its outline, and small claws
 * over the knuckles of each fist, curving on along the forearm past the fist: flat plates of the
 * dark steel rimmed in the dull lilac.
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
    const pts: V3[] = [add3(add3(k, front, 1.6), thigh, -2.6), add3(add3(k, front, 4.6), thigh, 3.6), add3(add3(k, front, 1.2), thigh, 0.6)].map((p) => add3(p, side, 0.5));
    items.push({
      z: legZ(ctx, leg) + 0.02,
      draw: () => {
        const part = ctx.part();
        plate(ctx, part, pts, ARMOUR, RIM, 60, 0.3);
        part.commit();
      },
    });
  }
  for (const [arm, s] of [[rig.armR, 1], [rig.armL, -1]] as const) {
    // Two claws from the end of the vambrace over the back of the fist, curving on past it.
    const f = norm3(sub3(arm.end, arm.mid));
    const across = norm3(cross3(f, [0, 1, 0]));
    const back = norm3(cross3(across, f));
    items.push({
      z: fistZ(ctx, arm, s) + 0.01,
      draw: () => {
        const part = ctx.part();
        for (const o of [-1.2, 1.2]) {
          const root = add3(add3(arm.end, back, 2), across, o);
          const pts: V3[] = [add3(root, f, -2.4), add3(add3(root, f, 4.6), back, -1.4), add3(add3(root, f, -1.4), across, o * 0.7)];
          plate(ctx, part, pts, ARMOUR, RIM, 62, 0.3);
        }
        part.commit();
      },
    });
  }
  return items;
};

/** The pieces over the hips: plates (tassets) at the front and sides, cut to long points at their hems. */
const TASSETS = skirt({
  outer: ARMOUR,
  inner: UNDER,
  waist: 5.6,
  ring: [5.4, 6.9],
  aline: 0.42,
  fan: 0.3,
  give: 0.22,
  legs: 4.2,
  trim: RIM,
  panels: [
    { from: -44, to: -4, len: 9.5, jag: -4.6 },
    { from: 4, to: 44, len: 9.5, jag: -4.6 },
    { from: 52, to: 118, len: 10.5, jag: -5 },
    { from: 242, to: 308, len: 10.5, jag: -5 },
    { from: 128, to: 232, len: 8.5, jag: -3.6 },
  ],
});

/** The cape's cut: from the shoulders to below the knee, four panels whose hems meet in points, a wing's trailing edge. */
const CAPE_CUT = {
  outer: CAPE,
  inner: CAPE_IN,
  top: 20.4,
  ring: [5.4, 8.4] as const,
  from: 104,
  to: 256,
  len: 40,
  jag: 6,
  taper: 1.4,
  panels: 4,
  folds: true,
  give: 0.95,
  over: { chest: BODY.chest, hips: BODY.hips, pad: 1.2 },
};
const CAPE_OPEN = cape(CAPE_CUT);
const CAPE_GATHERED = cape({ ...CAPE_CUT, inner: CAPE_IN_DEEP });

/**
 * The cape, its crimson lining showing where it streams, flares and turns. Down on a knee it falls
 * behind him to the floor and the lining there lies in his shadow, a deep wine, so seen from the
 * front no bright block of red shows under his hips.
 */
const CAPE_PIECE: Piece = (ctx) => (ctx.pose.kneel ? CAPE_GATHERED : CAPE_OPEN)(ctx);

/**
 * A short mantle of the same violet-black over the top of the cape, round the back of the neck
 * and the shoulders, its hem cut in points: it closes the cape round the collar, so its crimson
 * lining shows only where the cape flares or turns below it, never as a patch at the nape. With
 * his back to the viewer it sorts over the cape even where the cape streams up off his back.
 */
const MANTLE_CLOTH = cape({
  outer: CAPE,
  inner: CAPE,
  top: 21.2,
  ring: [6.2, 9.2],
  from: 100,
  to: 260,
  len: 12.5,
  jag: -3.5,
  taper: 1.3,
  panels: 3,
  give: 0.45,
  over: { chest: BODY.chest, hips: BODY.hips, pad: 1.8 },
});
const MANTLE: Piece = (ctx) => {
  const back = ctx.cam.facing(mul3(ctx.rig.chest.f, -1)) > 0.25;
  return MANTLE_CLOTH(ctx).map((it) => (back ? { ...it, z: it.z + 6 } : it));
};

// ── The lance ────────────────────────────────────────────────────────────────────────────────

/** The lance's parts the pole arm builder makes: about 104 px from the butt spike to the point. */
const LANCE: PoleSpec = {
  haft: { from: -35, to: 43, r: 1.3, mat: SHAFT },
  butt: { len: 5.5, r: 1.6, mat: STEEL, spike: true },
  bands: { at: [-29, 26], len: 1, mat: STEEL },
  wraps: [
    { from: -8, to: 4, mat: WRAP, cord: flat(hex('#1c1434')) },
    { from: 12, to: 20, mat: WRAP, cord: flat(hex('#1c1434')) },
  ],
  metal: POINT_STEEL,
  edge: POINT_EDGE,
  socket: { from: 40, to: 46, r: 1.8 },
  point: { from: 45.5, len: 21, w: 2.9, belly: 0.26 },
  rune: { from: 47, to: 64, rest: hex('#d8c0ff'), colour: hex('#f4ecff'), glow: hex('#ffffff'), marks: [51, 56] },
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
  [46.4, 5.4],
  [45.8, 9.8],
  [42.6, 7.4],
  [41.4, 9],
  [39.8, 6],
  [37, 6.8],
  [37.8, 3.2],
  [39.6, 1.3],
];
/** The leading edge of the wing, from its root to its tip: a pale band along it. */
const WING_LEAD = 2;

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
    for (let i = 0; i < WING_LEAD; i++) part.line(pts[i] as [number, number], pts[i + 1] as [number, number], RIM, 0.6 - i * 0.2, z(44) + 0.2, WING_ID + 2);
  }
  part.clip = null;
}

const POLE = pole(LANCE);
/** Where the point's tip is along the lance. */
const TIP_U = (LANCE.point?.from ?? 0) + (LANCE.point?.len ?? 0);

/** The violet of the halo round the lance's head. */
const HALO: RGB = hex('#b48cff');
const HALO_EDGE: RGB = hex('#8a5ee0');

/**
 * The lance's glow: the point's channel glowing as the pole arm's does, and a soft violet halo
 * two pixels wide round the whole head (the point and the vamplate's wings), just outside its
 * outline, in every pose: brighter as the lance blazes, never quite gone. It lies only where
 * nothing else is painted, so it never shows through the body.
 */
function lanceGlow(ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)): void {
  POLE.glow?.(ctx, strength, held);
  const { c, owner } = ctx;
  const ax = heldAxes(ctx, held.grip);
  const at = (u: number, v: number): [number, number] => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
  const ul2 = ax.u[0] * ax.u[0] + ax.u[1] * ax.u[1] || 1;
  const uOf = (x: number, y: number): number => ((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2;
  const corners = [at(36, 11), at(36, -11), at(TIP_U + 1, 11), at(TIP_U + 1, -11)];
  const R = 3;
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[0]))) - R);
  const x1 = Math.min(c.w - 1, Math.ceil(Math.max(...corners.map((p) => p[0]))) + R);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((p) => p[1]))) - R);
  const y1 = Math.min(c.h - 1, Math.ceil(Math.max(...corners.map((p) => p[1]))) + R);
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  if (bw <= 0 || bh <= 0) return;
  const dist = new Float32Array(bw * bh).fill(Infinity);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (owner[y * c.w + x] !== held.tag || uOf(x, y) < 36) continue;
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx - x0;
          const yy = y + dy - y0;
          if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
          const d = Math.hypot(dx, dy);
          if (d < (dist[yy * bw + xx] as number)) dist[yy * bw + xx] = d;
        }
      }
    }
  }
  // A pixel in a notch between two arms of the halo joins it, so the halo has no pinholes.
  const inHalo = (x: number, y: number): boolean => x >= x0 && y >= y0 && x <= x1 && y <= y1 && (dist[(y - y0) * bw + (x - x0)] as number) <= R + 0.2;
  const k = 0.3 + 0.16 * clamp(strength, 0, 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (c.opaque(x, y)) continue;
      let d = dist[(y - y0) * bw + (x - x0)] as number;
      if (d > R + 0.2) {
        const held = (xx: number, yy: number): boolean => inHalo(xx, yy) || c.opaque(xx, yy);
        if (!(held(x - 1, y) && held(x + 1, y) && held(x, y - 1) && held(x, y + 1))) continue;
        d = R;
      }
      c.glow(x, y, d < 2.3 ? HALO : HALO_EDGE, d < 1.5 ? k * 1.25 : d < 2.3 ? k : k * 0.5);
    }
  }
}

/**
 * The lance: the pole arm, with the vamplate's wings painted after it and its head glowing. Hands
 * hold it below the wings. The painter sorts the whole lance at one depth, so held level across
 * his back with his back to the viewer (a spin) it would lie over the cape: then whatever of it
 * lies well behind his torso stays hidden behind what is already painted there, and only its ends
 * show past his flanks.
 */
const LANCE_WEAPON: WeaponDesign = {
  ...POLE,
  haft: [-33, 35],
  paint: (ctx, part, held = mainHeld(ctx)) => {
    const { rig, c } = ctx;
    const backTurned = held.grip === rig.weapon && ctx.cam.facing(mul3(rig.chest.f, -1)) > 0.3;
    if (!backTurned) {
      POLE.paint(ctx, part, held);
      paintWings(ctx, part, held);
      return;
    }
    const torso = ctx.depth(at3(rig.chest, 0, 12, 0)) - 3;
    const plot = part.plot.bind(part);
    part.plot = (x, y, m, light, z = 0, id = 0, force = false) => {
      if (z < torso && c.opaque(Math.floor(x), Math.floor(y))) return;
      plot(x, y, m, light, z, id, force);
    };
    POLE.paint(ctx, part, held);
    paintWings(ctx, part, held);
    part.plot = plot;
  },
  glow: lanceGlow,
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
    darkHair: true,
    whorl: { yaw: 180, pitch: 42, reach: 110, clumps: 7, twist: 0 },
    long: {
      // Tied at the back of the head under the helm, falling from beneath it past his shoulder blades.
      tail: { yaw: 180, pitch: 30, dir: [-1, 0.3, 0], stiff: 0.16, len: 36, w: 1.8, give: 1.45, tie: { mat: RIM, r: 2.1 } },
      back: [
        { yaw: 170, pitch: 30, dir: [-1, -0.2, -0.35], stiff: 0.2, len: 30, w: 1.25, give: 1.5, taper: 0.5 },
        { yaw: 190, pitch: 30, dir: [-1, -0.2, 0.35], stiff: 0.2, len: 26, w: 1.15, give: 1.6, taper: 0.5 },
      ],
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
  outfit: [pauldron(1), pauldron(-1), TASSETS, spurs, CAPE_PIECE, MANTLE],
  weapon: LANCE_WEAPON,
  // Violet energy: a pale lilac edge and a white-hot core.
  aura: { core: hex('#a46cff'), edge: hex('#d4c0ff'), hot: hex('#ffffff') },
};

export { DRAGOON };
