/**
 * The Blademaster, as a chibi: a slim, quick young duelist with pale skin, sharp crimson eyes and a
 * confident smirk, a short, messy bob of dark-brown hair (choppy ends at the jaw, a choppy fringe
 * and one upright lock on her crown that springs as she moves) held back over her right temple by
 * a small crimson clip shaped like crossed blades. She wears a fitted black coat with a high
 * collar lined and edged in crimson, long sleeves with crimson cuffs and swallowtail coat-tails to
 * the backs of her knees, lined in crimson; under it a fitted wine-black vest buttoned in silver, a
 * crimson sash knotted at her left hip with its end hanging, dark grey tights, black boots
 * to the knee with straps and silver buckles, and fingerless gloves. She fights with two curved
 * sabres, dark steel with a crimson edge and a crimson streak that blazes as she strikes. Her cuts
 * leave crimson arcs; her spins (painted by her moves files) a violet-blue whirlwind. Everything
 * here is data for the chibi engine; her moves are in the moves-*.ts files beside this one, and
 * hero.ts puts her together.
 */
import { hex } from '../../paint.js';
import { blade, type BladeSpec } from '../blade.js';
import type { BodyDesign, ChibiDesign, DrawItem, HeadPiece, Lock, Piece, PieceContext, Tress } from '../design.js';
import { FACE_SHARP } from '../head.js';
import { skirt } from '../pieces.js';
import { dim, flat, type Hit, type Mat, mat4 } from '../raster.js';
import { add3, at3, cross3, dirIn, type Frame3, type Limb, lerp, lerp3, norm3, rad, type V3 } from '../rig.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Pale skin, for the hands' fingers and the neck.
const SKIN = mat4('#fff6ee', '#fadcc8', '#e2b29a', '#ac7666', '#6c3c36', 0.3);
// The face: lit over all of it that faces the viewer at all, so it reads pale and clean at game
// size, with a soft warm outline so the line under her chin reads as a crease.
const FACE_SKIN: Mat = { ...SKIN, line: hex('#a06a5e'), gain: 0.3, bias: 0.6 };
const NECK: Mat = { ...mat4('#fff6ee', '#fadcc8', '#eec2a8', '#e0b098', '#b07a68', 0.2), gain: 0.4 };
// Dark brown hair: its light tone along the lit side of each clump, a warm highlight on the brightest.
const HAIR = mat4('#a27660', '#7a5442', '#523426', '#2e1c14', '#170d09', -0.05);
// The coat: a soft black that keeps its shape at game size (its base tone over most of it, the
// light tone on lit folds), the crimson lining showing where it turns.
const COAT = { ...mat4('#67637a', '#4a4656', '#2c2a36', '#18161e', '#0c0b10', -0.02), gain: 0.6 };
const CRIMSON = mat4('#ff98a4', '#e84a5c', '#b02234', '#68101c', '#30060c', 0.1);
const LINING = mat4('#d03a4e', '#b02234', '#8a1828', '#5a0e1a', '#2c050c');
// The vest: a deep wine-black, so it reads apart from the coat over it and carries her crimson in.
const VEST = { ...mat4('#7c4452', '#5a2a38', '#3e1a26', '#260e18', '#10060a', 0.05), gain: 0.6 };
const BUTTON = mat4('#ffffff', '#e4e6ee', '#a8acbc', '#6a6e80', '#2a2c36', 0.2);
const SASH = mat4('#ff8a98', '#e84a5c', '#b02234', '#68101c', '#30060c', 0.25);
const SASH_IN = mat4('#b02234', '#8a1828', '#68101c', '#480a14', '#24040a');
// The sash's hanging end: a deeper crimson than the band, so it reads as a ribbon end, not a skirt.
const SASH_END = mat4('#f06474', '#c8303f', '#9a1a2a', '#68101c', '#30060c', 0.05);
// Dark grey tights, their base tone over most of them.
const TIGHTS = { ...mat4('#6a6878', '#4c4a58', '#323040', '#22202c', '#100e16', 0.1), gain: 0.75 };
const TIGHTS_HIP = { ...TIGHTS, bias: 0.35, gain: 0.45 };
const BOOT = mat4('#5a5666', '#38343f', '#221f28', '#141218', '#08070a', 0.05);
const SOLE = mat4('#2a2630', '#1e1a22', '#141118', '#0c0a0e', '#060508');
const SILVER = mat4('#ffffff', '#e2e5ee', '#a6aabc', '#666a7c', '#24262f', 0.15);
// Fingerless gloves in black leather: the fingers show pale over the knuckles.
const GLOVE = mat4('#5a5464', '#3a3542', '#24202a', '#15121a', '#09070b', 0.05);
// The sabres: dark steel, a crimson cutting edge, a pale line along the back.
const STEEL = mat4('#8e90a2', '#5c5e70', '#3c3d4c', '#24242f', '#0e0e14', 0.05);
const EDGE = mat4('#ffe4e8', '#ff8a98', '#e8384e', '#a01828', '#3a0810', 0.25);
const SPINE = mat4('#e6e8f2', '#b8bccc', '#8a8ea2', '#5a5e70', '#22242e', 0.1);
const GRIP = mat4('#4a4652', '#302c38', '#1e1b24', '#121016', '#060508');
const GEM = mat4('#ffb0bc', '#ff4a62', '#c01830', '#700a18', '#30040a', 0.1);

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** Slim and light, as the Spellblade: narrow shoulders, long legs for her size, a long reach for her height. */
const BUILD = { hip: 26.5, thigh: 11.8, shin: 11.6, ankle: 4, torso: 22, neck: 2, shoulder: 7.2, hipWidth: 3.6, shoulderDrop: 3.2, upperArm: 8.4, foreArm: 8.2, headUp: 11.6 };

// ── Hair: a short, messy bob ─────────────────────────────────────────────────────────────────
// Chin-length all round and choppy: a rounded crown of broad pieces tumbling out and down, a choppy
// fringe to her brows, swept a little to her left, broad pieces over her ears falling to her jaw
// in uneven points, and short layers at the back that flick out at the nape. One springy lock
// stands up off her crown. In a run the crown tosses back and the ends lift.

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // The crown: broad pieces lying back and down over the round of her head from high on it, to
  // about the level of her ears, their tips flicking out a little, so the outline is rounded but
  // choppy rather than a smooth helmet.
  L(42, 60, [0.25, -1, 0.5], 8.5, 3.9, [0.1, 0, 0.15], 1.2, 0.3),
  L(90, 62, [-0.15, -1, 0.5], 9, 4, [0, 0, 0.12], 1, 0.3),
  L(136, 60, [-0.5, -1, 0.38], 9.5, 4.2, [-0.2, 0, 0.1], 1.4, 0.3),
  L(180, 62, [-0.6, -1, 0], 9.5, 4.2, [-0.25, 0, 0], 1.4, 0.3),
  L(-136, 60, [-0.5, -1, -0.38], 9.5, 4.2, [-0.2, 0, -0.1], 1.4, 0.3),
  L(-90, 62, [-0.15, -1, -0.5], 9, 4, [0, 0, -0.12], 1, 0.3),
  L(-42, 60, [0.25, -1, -0.5], 8.5, 3.9, [0.1, 0, -0.15], 1.2, 0.3),
  // The bob's sides and back: broad pieces falling straight from over the ears to her jaw, uneven
  // at their ends, the front ones turning in toward her cheeks and the ones behind flicking out.
  L(70, 24, [0.14, -1, 0.06], 12.5, 3.1, [0.12, 0.02, -0.2], 0.5, 0.4),
  L(102, 22, [-0.15, -1, 0.12], 12.5, 3.4, [-0.05, 0.04, 0.16], 0.7, 0.4),
  L(140, 18, [-0.4, -1, 0.28], 11.5, 3.4, [-0.2, 0.06, 0.1], 0.9, 0.4),
  L(-70, 24, [0.14, -1, -0.06], 13.5, 3.1, [0.12, 0.02, 0.2], 0.5, 0.4),
  L(-102, 22, [-0.15, -1, -0.12], 11.5, 3.4, [-0.05, 0.04, -0.16], 0.7, 0.4),
  L(-140, 18, [-0.4, -1, -0.28], 12.5, 3.4, [-0.2, 0.06, -0.1], 0.9, 0.4),
  // The fringe: choppy pointed pieces to her brows, swept a little to her left.
  L(-44, 38, [0.35, -1, -0.45], 5.5, 2, [0.1, 0, -0.15], 0.3, 0.25),
  L(-18, 46, [0.5, -1, -0.35], 7, 2.2, [0.15, 0, -0.12], 0.3, 0.25),
  L(8, 48, [0.5, -1, -0.12], 6, 2.2, [0.15, 0, -0.04], 0.3, 0.25),
  L(32, 44, [0.5, -1, 0.2], 6.5, 2, [0.15, 0, 0.06], 0.3, 0.25),
  // The top: a piece from the whorl tumbling forward over it.
  L(170, 82, [0.95, 0.05, 0.2], 9, 4.4, [0.15, -0.5, 0], 1.6, 0.3),
  // The upright lock on her crown, springing as she moves. (Shapes from the 21st lock on share
  // their numbers with the collar's, which this one never touches.)
  { yaw: 150, pitch: 80, dir: [0.12, 1, 0.12], len: 13, w: 2.4, curl: [0.4, -0.25, 0.05], give: 0.7, belly: 0.4, bob: 0.75 },
];

/**
 * Short layers at the back of the bob, round the nape, their ends flicking out: from behind they
 * give the bob its jagged hem at the top of her collar.
 */
const NAPE: Tress[] = [
  { yaw: 128, pitch: -8, dir: [-0.4, -1.2, 0.6], len: 9, w: 3, stiff: 0.5, give: 0.8, taper: 0.4, flip: 1.6 },
  { yaw: 155, pitch: -12, dir: [-0.8, -1, 0.3], len: 8, w: 2.6, stiff: 0.5, give: 0.8, taper: 0.55, flip: 1.4 },
  { yaw: 180, pitch: -14, dir: [-1, -1, 0], len: 7, w: 2.4, stiff: 0.5, give: 0.8, taper: 0.6, flip: 1.2 },
  { yaw: 205, pitch: -12, dir: [-0.8, -1, -0.3], len: 8, w: 2.6, stiff: 0.5, give: 0.8, taper: 0.55, flip: 1.4 },
  { yaw: 232, pitch: -8, dir: [-0.4, -1.2, -0.6], len: 9, w: 3, stiff: 0.5, give: 0.8, taper: 0.4, flip: 1.6 },
];

const SHELL = { c: [-1.2, 1, 0] as V3, r: [10.9, 10, 11.2] as V3 };

// ── The hair clip ────────────────────────────────────────────────────────────────────────────

/** Where the clip sits on the hair (degrees round the head and up, as a lock's root) and its size. */
const CLIP = { yaw: 56, pitch: 34, r: 3, bar: 0.75 };

/**
 * A small crimson clip in her hair above her right temple, shaped like two crossed blades: a thin
 * disk lying on the hair, cut down to the two bars of an X.
 */
function hairClip(shell: { c: V3; r: V3 }): HeadPiece {
  const cp = Math.cos(rad(CLIP.pitch));
  const dir: V3 = [Math.cos(rad(CLIP.yaw)) * cp, Math.sin(rad(CLIP.pitch)), Math.sin(rad(CLIP.yaw)) * cp];
  // On the shell, standing a little clear of it so the locks round it do not cover it.
  const at: V3 = [shell.c[0] + dir[0] * shell.r[0] * 1.08, shell.c[1] + dir[1] * shell.r[1] * 1.08, shell.c[2] + dir[2] * shell.r[2] * 1.08];
  const nrm = norm3([dir[0] / shell.r[0], dir[1] / shell.r[1], dir[2] / shell.r[2]]);
  return {
    blobs: (_ctx, head) => {
      const out = dirIn(head, nrm[0], nrm[1], nrm[2]);
      const u = norm3(add3(head.u, out, -(head.u[0] * out[0] + head.u[1] * out[1] + head.u[2] * out[2])));
      const f = cross3(u, out);
      const fr: Frame3 = { o: at3(head, at[0], at[1], at[2]), f, u, r: out };
      return [
        {
          frame: fr,
          blobs: [{ c: [0, 0, 0], r: [CLIP.r, CLIP.r, 1], id: 70 }],
          shade: (h: Hit) => {
            const a = Math.abs(h.p[0] - h.p[1]);
            const b = Math.abs(h.p[0] + h.p[1]);
            if (Math.min(a, b) > CLIP.bar * 1.414) return null;
            return { m: CRIMSON, light: 0.45 };
          },
        },
      ];
    },
  };
}

// ── The high collar, lined and edged in crimson ──────────────────────────────────────────────

/** A high collar, open at the throat and lined in crimson, with a crimson band along its top edge (painted with the head, as pieces.ts `collar`). */
function crimsonCollar(spec: { c: V3; r: V3; bottom: number; top: { back: number; side: number; front: number }; open: number }): HeadPiece {
  return {
    blobs: (ctx) => [
      {
        frame: ctx.rig.chest,
        blobs: [{ c: spec.c, r: spec.r, id: 30 }],
        shade: (h: Hit) => {
          const p = h.p;
          const yaw = Math.abs((Math.atan2(p[2] - spec.c[2], p[0] - spec.c[0]) * 180) / Math.PI);
          if (yaw < spec.open) return null;
          const k = (yaw - spec.open) / (180 - spec.open);
          const top = k < 0.5 ? lerp(spec.top.front, spec.top.side, k * 2) : lerp(spec.top.side, spec.top.back, (k - 0.5) * 2);
          if (p[1] > top || p[1] < spec.bottom) return null;
          if (h.back) return { m: LINING, id: 31 };
          // The crimson band along the top, and down the front edges of the opening.
          const trim = p[1] > top - 1.2 || yaw < spec.open + 6;
          return { m: trim ? CRIMSON : COAT, id: trim ? 32 : 30 };
        },
      },
    ],
  };
}

// ── Boots: to the knee, strapped and buckled ─────────────────────────────────────────────────

/** Where the two straps cross each boot (shares of the shin up from the ankle). */
const STRAPS = [0.32, 0.62];

/**
 * Two straps round each boot, a pixel deep and a little wider than the boot, each fastened with
 * a silver buckle on its outer side, sorted just over its leg (a step darker on the far leg, as
 * the painter dims a far leg).
 */
const bootStraps: Piece = (ctx: PieceContext): DrawItem[] => {
  const { rig, depth, proj } = ctx;
  const torsoTrue = depth(at3(rig.chest, 0, 14, 0));
  const item = (leg: Limb): DrawItem => {
    const far = depth(leg.mid) < torsoTrue - 2;
    const z = depth(leg.mid) * 0.7 + depth(leg.root) * 0.3 + 0.02;
    return {
      z,
      draw: () => {
        const part = ctx.part();
        const m = far ? dim(BOOT, -0.15) : BOOT;
        const sm = far ? dim(SILVER, -0.15) : SILVER;
        for (const s of STRAPS) {
          const at = lerp3(leg.end, leg.mid, s);
          const a = proj(at);
          const b = proj(lerp3(leg.end, leg.mid, s + 0.1));
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const dl = Math.hypot(dx, dy) || 1;
          const ux = (dx / dl) * 1.2;
          const uy = (dy / dl) * 1.2;
          const w = BODY.boot.r * 1.1;
          const nx = (-dy / dl) * w;
          const ny = (dx / dl) * w;
          const zz = depth(at) + 0.6;
          part.poly(
            [
              [a[0] + nx, a[1] + ny],
              [a[0] - nx, a[1] - ny],
              [a[0] - nx + ux, a[1] - ny + uy],
              [a[0] + nx + ux, a[1] + ny + uy],
            ],
            m,
            -0.4,
            zz,
            1,
          );
          // The buckle on the side toward the viewer's left of the leg as seen, a two-pixel square.
          const bx = a[0] + (nx > 0 ? -nx : nx) * 0.35;
          const by = a[1] + (nx > 0 ? -ny : ny) * 0.35;
          part.plot(bx, by, sm, 0.8, zz + 1, 2, true);
          part.plot(bx + 1, by, sm, 0.3, zz + 1, 2, true);
        }
        part.commit();
      },
    };
  };
  return [item(rig.legR), item(rig.legL)];
};

// ── The torso: vest, sash, the coat over the rest ────────────────────────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') {
    // The vest's fitted hem over her hips, the tights below it; the coat-tails hang over the rest.
    if (u > 3.4) return VEST;
    return TIGHTS_HIP;
  }
  if (u < 5) return null;
  // The crimson sash round her waist.
  if (u < 7.6) return SASH;
  // The coat opens over the vest, widening toward the waist, edged in crimson; the vest is
  // buttoned in silver down the middle.
  const open = 30 - (u - 8) * 0.55;
  if (yaw < open) {
    if (yaw > open - 3.4) return CRIMSON;
    if (yaw < 3.2 && (Math.round(u) % 3 === 0) && u < 19) return BUTTON;
    return VEST;
  }
  return COAT;
}

const BODY: BodyDesign = {
  thigh: { mat: TIGHTS, r0: 3.2, r1: 2.7 },
  shin: { mat: TIGHTS, r0: 2.5, r1: 2.3 },
  // Black boots to the knee, slim, the toe a little pointed.
  boot: { mat: BOOT, r: 2.8, top: 0.86, toe: 5.6, heel: 2.1, sole: SOLE, foot: [2.5, 1.7] },
  upperArm: { mat: COAT, r0: 2.7, r1: 2.4 },
  foreArm: { mat: COAT, r0: 2.4, r1: 2.6 },
  // Crimson cuffs at the wrists.
  cuff: { mat: CRIMSON, r: 2.75, at: 0.64 },
  // Fingerless gloves: black leather, her fingers pale over the knuckles.
  hand: { mat: GLOVE, r: 2.3, knuckle: SKIN },
  neck: { mat: NECK, r: 2 },
  hips: [{ c: [0, 3, 0], r: [4.6, 5, 6], id: 1 }],
  chest: [
    { c: [0, 8, 0], r: [4.1, 4.6, 5.4], id: 1 },
    { c: [0.3, 14, 0], r: [4.8, 8, 6.8], id: 1 },
  ],
  torso,
};

// ── The sabres ───────────────────────────────────────────────────────────────────────────────

/**
 * A curved sabre about 34 px from the guard: a single-edged blade widening a little toward its
 * clipped point, swept back along its length, dark steel with a crimson cutting edge and a crimson
 * streak down it that blazes as she strikes, a small silver guard, a black wrapped grip and a
 * silver pommel set with a crimson stone.
 */
export const SABRE_SPEC: BladeSpec = {
  blade: [
    [3, 1.8],
    [22, 2.4],
    [30, 2.2],
    [35, -0.3],
    [30.5, -1.4],
    [3, -1.4],
  ],
  edge: { from: 5, width: 0.95, mat: EDGE },
  spine: { v: -0.9, from: 5, to: 29, mat: SPINE },
  rune: { v: 0.6, from: 6, to: 29, rest: hex('#5c1220'), colour: hex('#e8283c'), glow: hex('#ff5a6e'), marks: [12, 19, 26] },
  steel: STEEL,
  guard: {
    pts: [
      [2.6, -2.8],
      [3.1, -1],
      [3.1, 1],
      [2.6, 3.4],
      [1.2, 3.6],
      [0.8, 1.4],
      [0.8, -1.4],
      [1.2, -3],
    ],
    mat: SILVER,
  },
  grip: { from: -6, to: 0.8, r: 1.2, mat: GRIP, wrap: flat(hex('#5a5466')) },
  pommel: { u: -7, r: 1.4, mat: SILVER, gem: GEM, gemR: 0.8 },
  grip2: -4,
  reach: [5, 35],
  curve: 6.5,
};

const SABRE = blade(SABRE_SPEC);

// ── The face ─────────────────────────────────────────────────────────────────────────────────

const BLADEMASTER: ChibiDesign = {
  id: 'hero-blademaster',
  build: BUILD,
  head: {
    skin: FACE_SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [8.9, 9.4, 9.9] },
    jaw: { c: [1.5, -4, 0], r: [7.4, 6.4, 7.6] },
    ear: { c: [-0.6, -3.2, 9.4], r: [1.8, 2.6, 1.5] },
    shell: SHELL,
    hairline: { faceYaw: 72, brow: 3.8, temple: 0, nape: -8, ear: -2 },
    locks: LOCKS,
    long: { nape: NAPE, lie: 1 },
    darkHair: true,
    lockLine: hex('#2a170e'),
    whorl: { yaw: 180, pitch: 56, reach: 84, clumps: 7, twist: 0.3 },
    face: {
      eye: [8.3, -1.8, 4.2],
      lash: hex('#1c0c12'),
      iris: hex('#b01830'),
      irisLight: hex('#ff5a6e'),
      irisDeep: hex('#5a0814'),
      white: hex('#fbf4f4'),
      shine: hex('#ffffff'),
      brow: hex('#3a2218'),
      browUp: 3.4,
      mouth: hex('#a03848'),
      mouthAt: [9.1, -6.6],
      noseAt: [9.7, -4],
      style: FACE_SHARP,
      rest: 'smirk',
    },
  },
  body: BODY,
  // The collar stands high behind and at the sides, open at the throat, its crimson edges well
  // below her jaw.
  headPieces: [crimsonCollar({ c: [-0.8, 29, 0], r: [7.2, 10.5, 8.8], bottom: 19, top: { back: 29.8, side: 27.6, front: 23.5 }, open: 40 }), hairClip(SHELL)],
  outfit: [
    // The coat's skirt: open at the front, short at her hips, swallowtail tails behind to the
    // backs of her knees, lined and hemmed in crimson.
    skirt({
      outer: COAT,
      inner: LINING,
      waist: 5.4,
      ring: [5.2, 6.6],
      aline: 0.3,
      fan: 0.85,
      folds: true,
      trim: CRIMSON,
      legs: 3.7,
      panels: [
        { from: 40, to: 100, len: 13, jag: 1.5 },
        { from: 100, to: 178, len: 21, jag: 3.5, taper: 1.05, kick: 0.25 },
        { from: 182, to: 260, len: 21, jag: 3.5, taper: 1.05, kick: 0.25 },
        { from: 260, to: 320, len: 13, jag: 1.5 },
      ],
    }),
    // The sash's end, hanging from its knot at her left hip.
    skirt({
      outer: SASH_END,
      inner: SASH_IN,
      waist: 5.8,
      ring: [5.6, 6.9],
      aline: 0.12,
      give: 1.2,
      panels: [
        { from: -74, to: -66, len: 9, jag: 1.5, taper: 0.8 },
      ],
    }),
    bootStraps,
  ],
  weapon: SABRE,
  offhand: SABRE,
  // Her cuts burn crimson: a white-hot edge, a crimson body and a pale pink fringe.
  aura: { core: hex('#ff4a62'), edge: hex('#ffb8c8'), hot: hex('#fff4f6') },
};

export { BLADEMASTER };
