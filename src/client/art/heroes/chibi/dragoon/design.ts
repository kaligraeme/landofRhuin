/**
 * The Dragoon, as a chibi: a lean, long-legged young lancer with narrow amber eyes and a cocky
 * half-smile, in light dragon-styled armour of dark indigo steel, its pale lilac edges kept to a
 * few: the helm's brow band, the bones and claws of its wings and the pauldrons' tips. He wears an
 * open-faced half-helm whose sides are a pair of dragon's wings folded down and back round his
 * head: a smooth, low dark cap with a pale brow band set with a violet gem at its middle and a row
 * of scales above it, scaled cheek guards, and a low ridge of three small spines down the back like
 * a dragon's spine. Each wing's wrist sits high over the temple, a pale thumb claw hooking forward
 * and out from it over the outer end of his brow; from it the pale leading bone runs back high
 * along the side of the helm and curves down behind it, and a finger bone fans down past the ear,
 * with the membrane between them a step lighter than the steel. Behind the ear the wing leaves the
 * helm, so its two points trail down and back clear of the head beside the ponytail, a deep scallop
 * between them. Nothing on it rises above the crown. His jet-black hair, blue in its sheen, shows
 * at the fringe and falls from under the back of the helm in a long ponytail that parts into locks
 * at its end. A scale-patterned breastplate and a gorget, layered wing-like pauldrons swept back to
 * points with scales jutting past the shoulder, vambraces ending in claws over the knuckles,
 * pointed tassets and greaves with a spur at the knee, over a dark charcoal under-suit; a streaming
 * violet-black cape to below the knee, closed at the collar by a short mantle, with a crimson
 * lining and a hem cut like a wing's trailing edge. His lance is taller than he is: a dark steel
 * shaft with violet wraps and two small steel bands, a long leaf point that glows violet inside a
 * soft halo, a vamplate of spread dragon wings below it and a butt spike. His energy is violet with
 * a pale lilac edge and a white-hot core. Everything here is data for the chibi engine (with the
 * few pieces of his own below: the helm's folded wings, ridge, gem and scaled cheek guards, the
 * pauldrons, the spurs and claws, the cape's mantle, the lance's wings and halo); his moves are in
 * the moves-*.ts files beside it, and hero.ts puts him together.
 */
import { hex, type RGB, type Vec } from '../../paint.js';
import { scaleAt } from '../armour.js';
import { type BodyDesign, type ChibiDesign, type FaceStyle, GEAR_ID, type HeadPiece, type Held, type Lock, type Piece, type PieceContext, type WeaponDesign } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { helm } from '../headgear.js';
import { clipToGround, heldAxes, mainHeld } from '../held.js';
import { cape, collar, skirt } from '../pieces.js';
import { pole, type PoleSpec } from '../pole.js';
import { type Blob, flat, type Hit, type Mat, mat4, type Part, toneLight } from '../raster.js';
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
// The few near-white edges he has: the helm's brow band, the leading bones, points and thumb claws of its wings, the tips of the pauldrons.
const BRIGHT = mat4('#f4f0ff', '#d8ccff', '#a898e0', '#6a5aa8', '#2a2048', 0.02);
// A duller lilac for every other rim: the scales, the lower edges of plates, the vambraces' cuffs, the knee cops, the toe caps.
const RIM = mat4('#b4a4ec', '#8e7cd0', '#6a58a8', '#3e3070', '#0e0a1c', -0.1);
// The scales' rims: the dull lilac, mostly its light tone.
const SCALE = { ...mat4('#b4a4ec', '#8e7cd0', '#6a58a8', '#4e3e8e', '#0e0a1c', -0.15), clear: 1.2 };
// The shadowed gaps under the scales.
const UNDER = mat4('#3a2c66', '#2a1f4c', '#1c1434', '#120c24', '#08060e', -0.2);
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
});

/** How far the helm's own plates stand toward the viewer in the head's depth test (as headgear.ts's gear does, past the fringe). */
const HELM_LIFT = 3.5;

/** A point on the helm's shell (grown by `e`) at a yaw and pitch, head space. */
function onHelm(e: number, yaw: number, pitch: number): V3 {
  const cp = Math.cos((pitch * Math.PI) / 180);
  return [SHELL.c[0] + Math.cos((yaw * Math.PI) / 180) * cp * (SHELL.r[0] + e), SHELL.c[1] + Math.sin((pitch * Math.PI) / 180) * (SHELL.r[1] + e), SHELL.c[2] + Math.sin((yaw * Math.PI) / 180) * cp * (SHELL.r[2] + e)];
}

/** A point of the wing on his right side (the left mirrors it): yaw round the helm from the face, pitch, and how far clear of the helm's shell it stands. */
type WP = readonly [number, number, number];
/** The wing's wrist, high over the temple, where its bones fan from and its thumb claw hooks forward. */
const WRIST: WP = [70, 34, 0.5];
/**
 * The bones of the wing folded down and back over his right side, from the wrist: the leading bone
 * running back high along the side of the helm and curving down behind it toward the nape, and a
 * finger bone fanned under it, dropping past the ear. Both lie close along the helm until behind
 * the ear, then stand off it, so their points leave the helm and trail down, back and out beside
 * the ponytail.
 */
const WING_BONES: readonly (readonly WP[])[] = [
  [WRIST, [96, 40, 0.6], [122, 36, 1], [138, 18, 2.6], [146, -2, 8], [146, -16, 16]],
  [WRIST, [86, 18, 0.6], [102, 2, 0.9], [118, -12, 2.4], [130, -20, 6], [132, -28, 12.5]],
];
/**
 * The thumb claw at the wrist: a hook from its root along the leading bone forward, down and out
 * over the outer end of the brow band, standing clear of the helm toward its point, so seen from
 * the front it breaks the outline at the upper corners of the head and, side on, the far one hooks
 * forward past the brow.
 */
const CLAW: readonly WP[] = [[86, 42, 0.5], [68, 27, 0.5], [58, 20, 2.6], [48, 15, 5.2], [58, 29, 3.6], [72, 37, 1.6]];
/** How far the membrane's trailing edge sags in toward the wrist between the two points (a scallop), as a share of the bones' length. */
const SAG = 0.35;
/** Over how many of the last steps along the finger bone its point is pale. */
const PALE_TIP = 4;
/** Steps along each bone, and across the membrane between them. */
const STEPS = 12;
const ACROSS = 6;

/** The wing's membrane: the steel's own tones a step lighter, so it reads against the dark cap, the black ponytail and the cape. */
const MEMBRANE: Mat = { ...ARMOUR, bias: (ARMOUR.bias ?? 0) + 0.3 };

const WING_GUARD = GEAR_ID + 70;
/** The lowest a wing comes, hero space: just above the floor (lying down, the wing under him lies flat on it). */
const FLOOR = 0.5;

/** `n` + 1 points evenly along a polyline of wing points (spaced by their distance on the helm). */
function along(P: readonly WP[], n: number): WP[] {
  const pos = P.map((p) => onHelm(EASE + p[2], p[0], p[1]));
  const len: number[] = [0];
  for (let i = 1; i < P.length; i++) len.push((len[i - 1] as number) + Math.hypot(...sub3(pos[i] as V3, pos[i - 1] as V3)));
  const total = len[len.length - 1] as number;
  const out: WP[] = [];
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const d = (total * i) / n;
    while (k < P.length - 2 && (len[k + 1] as number) < d) k++;
    const t = (d - (len[k] as number)) / ((len[k + 1] as number) - (len[k] as number) || 1);
    out.push(mix(P[k] as WP, P[k + 1] as WP, t));
  }
  return out;
}
const mix = (a: WP, b: WP, t: number): WP => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A one-pixel line through points with their true depth, lifted as the helm's plates are and `lift` more. */
function edge(ctx: PieceContext, part: Part, P: readonly V3[], m: Mat, light: number, id: number, lift = 0.6): void {
  const Q = P.map((p) => ctx.proj(p));
  const Z = P.map((p) => ctx.depth(p) + HELM_LIFT + lift);
  for (let i = 0; i + 1 < P.length; i++) part.line(Q[i] as Vec, Q[i + 1] as Vec, m, light, ((Z[i] as number) + (Z[i + 1] as number)) / 2, id);
}

/**
 * Paints the folded wings: each a membrane lying just clear of the helm and following its curve
 * over the side, then leaving it behind the ear toward the points, in facets with their true
 * depth, cut back in a scallop between the two points; along its upper edge the leading bone, two
 * pixels thick with a pale upper edge, and along its lower edge the finger bone, a pixel of the
 * duller lilac with a pixel of the steel on the membrane's side, its point pale; and at the wrist
 * the thumb claw. The far wing passes behind the head and shows only where it clears it.
 */
function paintWingGuards(ctx: PieceContext, part: Part, head: Frame3): void {
  // The top of the helm's cap, hero space: the wings never rise above it.
  const top = at3(head, SHELL.c[0], SHELL.c[1], SHELL.c[2])[1] + Math.hypot((SHELL.r[0] + EASE) * head.f[1], (SHELL.r[1] + EASE) * head.u[1], (SHELL.r[2] + EASE) * head.r[1]);
  for (const side of [1, -1]) {
    // Lying down, a wing pressed to the floor lies flat on it rather than passing through it, and
    // the wing on top lies flat at the height of the helm rather than standing up from it.
    const at = (w: WP): V3 => {
      const p = onHelm(EASE + w[2], w[0], w[1]);
      const q = at3(head, p[0], p[1], side * p[2]);
      return [q[0], clamp(q[1], FLOOR, top), q[2]];
    };
    const id = WING_GUARD + (side > 0 ? 0 : 5);
    // The membrane's outer face is lit from its outward normal, never darker than the steel's base
    // tone; its inner face, seen where the wing turns away, lies a tone deeper in its shadow.
    const mid = at3(head, SHELL.c[0], SHELL.c[1], SHELL.c[2]);
    const tri = (p: V3, q: V3, r: V3): void => {
      let n = cross3(sub3(q, p), sub3(r, p));
      if (dot3(n, sub3(add3(add3(p, q), r), mul3(mid, 3))) < 0) n = mul3(n, -1);
      n = norm3(n);
      const light = ctx.cam.facing(n) >= 0 ? Math.max(ctx.cam.light(n) + 0.15, toneLight(MEMBRANE, 2) + 0.05) : toneLight(MEMBRANE, 3);
      part.facet([p, q, r], MEMBRANE, 0, id, light, HELM_LIFT);
    };
    const A = along(WING_BONES[0] as readonly WP[], STEPS);
    const B = along(WING_BONES[1] as readonly WP[], STEPS);
    // The membrane: strips across from the leading bone to the finger, each running along the bones
    // to the trailing edge, which reaches both points and sags in between them (the scallop).
    const M: V3[][] = [];
    for (let c = 0; c <= ACROSS; c++) {
      const t = c / ACROSS;
      const reach = 1 - SAG * Math.sin(Math.PI * t);
      const col: V3[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const u = (i / STEPS) * reach * STEPS;
        const i0 = Math.min(STEPS - 1, Math.floor(u));
        const f = u - i0;
        col.push(at(mix(mix(A[i0] as WP, A[i0 + 1] as WP, f), mix(B[i0] as WP, B[i0 + 1] as WP, f), t)));
      }
      M.push(col);
    }
    for (let c = 0; c < ACROSS; c++) {
      for (let i = 0; i < STEPS; i++) {
        const p00 = (M[c] as V3[])[i] as V3;
        const p10 = (M[c] as V3[])[i + 1] as V3;
        const p01 = (M[c + 1] as V3[])[i] as V3;
        const p11 = (M[c + 1] as V3[])[i + 1] as V3;
        tri(p00, p10, p11);
        tri(p00, p11, p01);
      }
    }
    const k = STEPS - PALE_TIP;
    // The thumb claw: dark steel, its lower edge and point pale.
    const claw = CLAW.map(at);
    part.facet(claw, ARMOUR, 0.25, id + 2, undefined, HELM_LIFT + 0.4);
    edge(ctx, part, claw.slice(0, 4), BRIGHT, 0.45, id + 2, 0.8);
    edge(ctx, part, claw.slice(3).concat([claw[0] as V3]), RIM, 0.3, id + 2, 0.8);
    // The leading bone, from the wrist over the wing to its point; the finger bone, its second pixel
    // on the membrane's side (not hanging below it, where it would leave slivers of background
    // between it and the cheek guard or the pauldrons), pale at its point.
    const lead = A.map(at);
    edge(ctx, part, lead.map((p) => add3(p, head.u, -0.8)), RIM, 0.3, id + 3, 0.5);
    edge(ctx, part, lead, BRIGHT, 0.45, id + 3);
    const finger = B.map(at);
    edge(ctx, part, finger.slice(0, k + 1).map((p) => add3(p, head.u, 0.7)), ARMOUR, 0.5, id + 4, 0.5);
    edge(ctx, part, finger.slice(0, k + 1), RIM, 0.3, id + 4);
    edge(ctx, part, finger.slice(k), BRIGHT, 0.3, id + 4);
  }
}

/**
 * The low ridge down the middle of the back of the helm, from behind the crown to above the nape
 * where the ponytail comes out: three small spines raked back, like a dragon's spine between its
 * folded wings. Each is given as the pitches (on the helm's back, at yaw 180) of its front and back
 * feet and of its point, and how far its point stands clear of the helm. None rises as high as the
 * crown, and seen from the front they stay hidden behind it.
 */
const RIDGE: readonly (readonly [number, number, number, number])[] = [
  [62, 46, 44, 1.5],
  [44, 26, 22, 2],
  [24, 6, 2, 1.7],
];
const RIDGE_ID = GEAR_ID + 78;
/** Paints the ridge's spines: plates of the steel with their true depth, rimmed in the duller lilac, the leading edge lit. */
function paintRidge(ctx: PieceContext, part: Part, head: Frame3): void {
  RIDGE.forEach(([a, b, t, h], i) => {
    const pts = [onHelm(EASE - 0.3, 180, a), onHelm(EASE + h, 180, t), onHelm(EASE - 0.3, 180, b)].map((p) => at3(head, p[0], p[1], p[2]));
    part.facet(pts, ARMOUR, 0.3, RIDGE_ID + i, undefined, HELM_LIFT + 0.3);
    edge(ctx, part, pts.slice(0, 2), RIM, 0.45, RIDGE_ID + i, 0.6);
    edge(ctx, part, pts.slice(1), RIM, 0.1, RIDGE_ID + i, 0.6);
  });
}

/** The row of scales above the brow band: how far round from the face it runs (radians), and between which heights (head space). */
const BROW_SCALES = { yaw: (62 * Math.PI) / 180, from: 5.1, to: 7.9 };

/** The violet gem at the middle of the brow band, in his lance point's glowing violet, two pixels across at game size. */
const GEM: Blob = { c: [11.3, 4.6, 0], r: [1.2, 2, 2], id: GEAR_ID + 80 };

/**
 * The folded wing half-helm: the engine's open-faced helm (a smooth dark cap, a pale brow band and
 * cheek guards) with overlapping scales over the cheek guards and in a row just above the brow
 * band, a violet gem at the middle of the band, a dragon's wing folded down and back round each
 * side of it and a low ridge down the back. Turned away from the viewer it keeps the cheek guards'
 * scales only where they face him: the far cheek guard is plain dark steel.
 */
const HELM: HeadPiece = {
  ...HELM_BASE,
  blobs: (ctx, head) => {
    // How far his face is turned toward the viewer (1 full on, -1 away).
    const face = ctx.cam.facing(head.f);
    const base = (HELM_BASE.blobs?.(ctx, head) ?? []).map((b) => ({
      ...b,
      shade: (h: Hit) => {
        const r = b.shade(h);
        if (!r) return r;
        // The cheek guards (the small blobs beside the cap): rows of scales hanging down them, and
        // their trimmed edges in the duller lilac; plain on a cheek turned from the viewer.
        if (h.blob.r[0] < 6) {
          const near = ctx.cam.facing(mul3(head.r, h.p[2] > 0 ? 1 : -1)) > -0.25 && face > -0.35;
          if (r.m === BRIGHT) return { ...r, m: near ? RIM : ARMOUR };
          if (!near) return r;
          const s = scaleAt(h.p[0] * 1.2 + 30, 2 - h.p[1], 3.8, 2.6);
          return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? RIM : UNDER };
        }
        // A row of scales across the front of the cap, just above the brow band.
        const round = Math.atan2(h.p[2], h.p[0] - SHELL.c[0]);
        if (r.m === ARMOUR && Math.abs(round) < BROW_SCALES.yaw && h.p[1] > BROW_SCALES.from && h.p[1] < BROW_SCALES.to) {
          const s = scaleAt(round * (SHELL.r[2] + EASE) + 30, BROW_SCALES.to - h.p[1], 3.2, 2.6);
          return { ...r, m: s === 'face' ? ARMOUR : s === 'rim' ? SCALE : UNDER };
        }
        return r;
      },
    }));
    return [
      ...base,
      { frame: head, blobs: [GEM], shade: (h: Hit) => (h.back ? null : { m: POINT_STEEL, lift: HELM_LIFT + 0.6 }) },
    ];
  },
  paint: (ctx, part, head) => {
    paintWingGuards(ctx, part, head);
    paintRidge(ctx, part, head);
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
      // Tied at the back of the head under the helm, falling from beneath it past his shoulder
      // blades: black hair, loose enough to sway a beat behind him, with two shorter locks beside
      // it that splay out at the end, so it ends in a split tip rather than one stiff point.
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
