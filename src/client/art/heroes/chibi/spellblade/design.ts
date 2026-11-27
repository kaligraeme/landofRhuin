/**
 * The Spellblade, as a chibi: a slim, quick young mage with long, straight silver-white hair (a
 * lavender shadow in it, a sheen round the back of her crown) falling to the middle of her back,
 * gathered in under the nape to her shoulders' width with a lock caught in a small gold clasp, two
 * long locks over her shoulders framing her face, a soft fringe swept to her left held back on the
 * right by a small gold crescent pin. She wears a fitted violet robe-coat with a high gold-edged
 * collar open at the throat, cut away at the front from the hip and falling to the knee behind, a
 * pale lavender under-dress showing as a narrow front panel to mid-thigh, a sash of the coat's
 * violet with a gold buckle, a short deep-violet cape to the hips with a gold hem, dark plum
 * leggings and slim dark grey-violet boots with pointed toes and narrow pale turned-down cuffs. She
 * fights with a slender sword in her right hand (a violet fuller that glows when she casts) and a
 * short wand with a violet crystal in her left; the two are separate held items, so a spell-bow can
 * replace them later without redrawing her. Her moves are in the moves-*.ts files beside this one,
 * and hero.ts puts her together.
 */
import { hex } from '../../paint.js';
import { blade } from '../blade.js';
import type { BodyDesign, ChibiDesign, DrawItem, HeadPiece, Lock, Piece, PieceContext, Tress } from '../design.js';
import { FACE_SOFT } from '../head.js';
import { cape, skirt } from '../pieces.js';
import { dim, flat, type Hit, type Mat, mat4, toneLight } from '../raster.js';
import { add3, at3, cross3, dirIn, type Frame3, type Limb, lerp, lerp3, norm3, rad, type V3 } from '../rig.js';
import { wand } from '../wand.js';

// ── Palette (highlight, light, base, shadow, line) ───────────────────────────────────────────

// Fair skin, for the hands and neck.
const SKIN = mat4('#fff0e0', '#f6cfab', '#d8a27c', '#a26c4e', '#6e3c2c', 0.3);
// The face: the light tone over all of it that faces the viewer at all, even pitched down in her
// crouch, so it reads clean and fair at game size; the base tone only where it turns well away.
// Its outline a soft warm brown, so the line under her chin reads as a crease, not a beard.
const FACE_SKIN: Mat = { ...SKIN, line: hex('#a8705a'), gain: 0.3, bias: 0.6 };
// The neck, the little of it that shows under her chin: pale and softly outlined, never a dark band.
const NECK: Mat = { ...mat4('#fff0e0', '#f6cfab', '#ecbc96', '#e0ae88', '#b47c62', 0.2), gain: 0.4 };
const HAIR = mat4('#ffffff', '#f4f2fa', '#c8c4dc', '#8e8aa8', '#5e5a78', 0.05);
// The robe-coat reads as one violet: its base tone over most of it, the light tone on lit folds.
const ROBE = { ...mat4('#a884de', '#8c66c8', '#5c3f96', '#35205e', '#1e1238', -0.02), gain: 0.6 };
const LINING = mat4('#4a3470', '#35245a', '#241640', '#160c2a', '#0c0618');
// The cape a step deeper than the coat, so the two read apart from behind.
const CAPE = { ...mat4('#6c4cac', '#4e3288', '#3a2266', '#221244', '#120826', -0.05), gain: 0.6 };
const CAPE_LINING = mat4('#5a3c8a', '#40286c', '#2c1a50', '#1a0e32', '#0c0618');
const PANEL = mat4('#ffffff', '#e8e2f4', '#b6aed0', '#7c7496', '#4a4460', 0.12);
// The under-dress below the sash: the same pale cloth, its base tone over most of it.
const DRESS = { ...PANEL, bias: -0.14, gain: 0.6 };
// Its inside, a step down the same lavender (a plain darkened white would read as grey).
const DRESS_IN = mat4('#d8d0ea', '#b6aed0', '#8e86aa', '#625a7c', '#3a3450');
const GOLD = mat4('#fff8dc', '#f2e6c0', '#c8b88a', '#7e7050', '#4a4028', 0.12);
// The sash: the coat's violet, lit (its light tone over most of it) so it reads as a band of
// colour at her waist rather than a dark belt, the gold buckle bright on it.
const SASH = mat4('#a884de', '#8c66c8', '#5c3f96', '#35205e', '#1e1238', 0.25);
// Dark plum leggings, their base tone over most of them so they read as plum, not black.
const LEGS = { ...mat4('#6a5878', '#4a3a56', '#30263e', '#1c1626', '#0e0a14', 0.12), gain: 0.75 };
// The same leggings over her hips, lit flatter, so in her crouch they show plum below the sash
// rather than a near-black band.
const HIPS = { ...LEGS, bias: 0.4, gain: 0.45 };
// Soft suede boots, a dark grey-violet a step lighter than the leggings.
const BOOT = mat4('#8a7aa2', '#64567e', '#463a5e', '#2c2440', '#120e1a', -0.04);
// The boots' turned-down cuffs: a narrow band of their pale lining.
const CUFF = mat4('#f4f0fa', '#d8d2ea', '#aaa2c4', '#6c6288', '#241c32', 0.05);
const SOLE = mat4('#3a3044', '#2a2232', '#1c1622', '#100c14', '#08060a');
const STEEL = mat4('#ffffff', '#dfe3ee', '#aab0c4', '#6e748c', '#2a2c3a', 0.12);
const EDGE = mat4('#ffffff', '#f4f6fc', '#cfd4e2', '#9aa0b4', '#2a2c3a', 0.15);
const GRIP = mat4('#7a58b4', '#56388e', '#3c2668', '#24164a', '#120a26');
const CRYSTAL = mat4('#f4e8ff', '#c49cff', '#8a52e8', '#5226a4', '#24104e', 0.05);
const WAND_ROD = mat4('#fffaf0', '#e6dccc', '#b8a890', '#7c6c58', '#2e241a', 0.08);

// ── Build ────────────────────────────────────────────────────────────────────────────────────

/** Slimmer and lighter than the Dark Knight, a little shorter: narrow shoulders, long legs for her size. */
const BUILD = { hip: 26.5, thigh: 11.8, shin: 11.6, ankle: 4, torso: 22, neck: 2, shoulder: 7, hipWidth: 3.6, shoulderDrop: 3.2, upperArm: 8.2, foreArm: 8, headUp: 11.6 };

// ── Hair: long, straight and silver ──────────────────────────────────────────────────────────

const L = (yaw: number, pitch: number, dir: [number, number, number], len: number, w: number, curl?: [number, number, number], give?: number, belly?: number): Lock => ({ yaw, pitch, dir, len, w, curl, give, belly });

const LOCKS: Lock[] = [
  // The crown: smooth clumps lying back over the round of the head, ending above the sheen.
  L(150, 52, [-0.55, -1, 0.35], 8, 3.6, [0, -0.2, 0.1], 0.4, 0.4),
  L(180, 58, [-0.6, -1, 0], 8.5, 4, [0, -0.2, 0], 0.4, 0.4),
  L(210, 52, [-0.55, -1, -0.35], 8, 3.6, [0, -0.2, -0.1], 0.4, 0.4),
  // The fringe, soft and swept across to her left, longest over her left brow; her right temple
  // is left clear where the crescent pin holds the hair back.
  L(36, 46, [0.3, -0.7, -0.9], 6, 3, [0.1, -0.15, -0.3], 0.3, 0.3),
  L(12, 50, [0.4, -0.85, -0.85], 9, 3.4, [0.1, -0.25, -0.3], 0.3, 0.3),
  L(-14, 46, [0.45, -1, -0.6], 10.5, 3.4, [0.15, -0.1, -0.2], 0.3, 0.3),
  L(-42, 34, [0.3, -1, -0.3], 10, 2.9, [0.1, 0, -0.1], 0.3),
  // Fine strands falling in front of the ears, into the long locks.
  L(72, 4, [0.15, -1, 0.2], 6, 2.2, [0.1, 0, 0.05], 0.3),
  L(-72, 4, [0.15, -1, -0.2], 6, 2.2, [0.1, 0, -0.05], 0.3),
];

// ── The crescent hairpin ─────────────────────────────────────────────────────────────────────

/** Where the pin sits on the hair (degrees round the head and up, as a lock's root), its size, and the bite out of it that makes the crescent. */
const PIN = { yaw: 54, pitch: 32, r: 3, bite: [1.3, 0.9] as const, biteR: 2.4 };

/**
 * A small gold crescent pinned in her hair above her right temple: a thin gold disk lying on the
 * hair with a round bite out of its upper side.
 */
function hairpin(shell: { c: V3; r: V3 }): HeadPiece {
  const cp = Math.cos(rad(PIN.pitch));
  const dir: V3 = [Math.cos(rad(PIN.yaw)) * cp, Math.sin(rad(PIN.pitch)), Math.sin(rad(PIN.yaw)) * cp];
  // On the shell, standing a little clear of it so the locks round it do not cover it.
  const at: V3 = [shell.c[0] + dir[0] * shell.r[0] * 1.06, shell.c[1] + dir[1] * shell.r[1] * 1.06, shell.c[2] + dir[2] * shell.r[2] * 1.06];
  const nrm = norm3([dir[0] / shell.r[0], dir[1] / shell.r[1], dir[2] / shell.r[2]]);
  return {
    blobs: (_ctx, head) => {
      // A frame lying on the hair: its r axis out of the hair, u up along it, f across.
      const out = dirIn(head, nrm[0], nrm[1], nrm[2]);
      const u = norm3(add3(head.u, out, -(head.u[0] * out[0] + head.u[1] * out[1] + head.u[2] * out[2])));
      const f = cross3(u, out);
      const fr: Frame3 = { o: at3(head, at[0], at[1], at[2]), f, u, r: out };
      return [
        {
          frame: fr,
          blobs: [{ c: [0, 0, 0], r: [PIN.r, PIN.r, 0.9], id: 70 }],
          shade: (h: Hit) => {
            const dx = h.p[0] - PIN.bite[0];
            const dy = h.p[1] - PIN.bite[1];
            if (dx * dx + dy * dy < PIN.biteR * PIN.biteR) return null;
            return { m: GOLD, light: 0.5 };
          },
        },
      ];
    },
  };
}

// ── The sheen on her crown ───────────────────────────────────────────────────────────────────

/** The band of sheen round the back of her crown: how high it runs (degrees up the shell) and how far round from the back. */
const SHEEN = { lo: 13, mid: 21, hi: 28, round: 100 };

/**
 * A band of sheen round the back of her crown, as glossy straight hair catches the light: a
 * bright ring with a band of shadow under it, on a skin just over the hair's shell (over the
 * clumps painted on it), round the back and sides of the head only, so it never crosses the fringe.
 */
function sheen(shell: { c: V3; r: V3 }): HeadPiece {
  const k = 1.035;
  return {
    blobs: (_ctx, head) => [
      {
        frame: head,
        blobs: [{ c: shell.c, r: [shell.r[0] * k, shell.r[1] * k, shell.r[2] * k], id: 71 }],
        shade: (h: Hit) => {
          if (h.back) return null;
          const p = h.p;
          const q: V3 = [(p[0] - shell.c[0]) / shell.r[0], (p[1] - shell.c[1]) / shell.r[1], (p[2] - shell.c[2]) / shell.r[2]];
          const pitch = (Math.asin(Math.max(-1, Math.min(1, q[1] / (Math.hypot(q[0], q[1], q[2]) || 1)))) * 180) / Math.PI;
          const yaw = Math.abs((Math.atan2(q[2], q[0]) * 180) / Math.PI);
          if (yaw < SHEEN.round || pitch < SHEEN.lo || pitch > SHEEN.hi) return null;
          return { m: HAIR, light: toneLight(HAIR, pitch > SHEEN.mid ? 0 : pitch > SHEEN.lo + 2.5 ? 2 : 3) };
        },
      },
    ],
  };
}

// ── The high collar, gold-edged ──────────────────────────────────────────────────────────────

/** A high collar, open at the front and lined, with a gold band along its top edge (painted with the head, as pieces.ts `collar`). */
function goldCollar(spec: { c: V3; r: V3; bottom: number; top: { back: number; side: number; front: number }; open: number }): HeadPiece {
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
          // The gold band along the top, and down the front edges of the opening.
          return { m: p[1] > top - 1.3 || yaw < spec.open + 7 ? GOLD : ROBE, id: p[1] > top - 1.3 || yaw < spec.open + 7 ? 32 : 30 };
        },
      },
    ],
  };
}

// ── Boots: soft suede with a turned-down cuff ────────────────────────────────────────────────

/**
 * The turned-down cuff at the top of each boot: a narrow pale band, two pixels deep, across the
 * shin a little wider than the boot, sorted just over its leg (and a step darker on the far leg,
 * as the painter dims a far leg).
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
        const top = lerp3(leg.end, leg.mid, BODY.boot.top);
        const a = proj(top);
        const b = proj(lerp3(leg.end, leg.mid, BODY.boot.top - 0.14));
        // Across the shin on screen, a little wider than the boot; two pixels down it.
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dl = Math.hypot(dx, dy) || 1;
        const ux = (dx / dl) * 2.1;
        const uy = (dy / dl) * 2.1;
        const w = BODY.boot.r * 1.12;
        const nx = (-dy / dl) * w;
        const ny = (dx / dl) * w;
        const m = far ? dim(CUFF, -0.12) : CUFF;
        const zz = depth(top) + 0.6;
        part.poly(
          [
            [a[0] + nx - ux * 0.2, a[1] + ny - uy * 0.2],
            [a[0] - nx - ux * 0.2, a[1] - ny - uy * 0.2],
            [a[0] - nx + ux, a[1] - ny + uy],
            [a[0] + nx + ux, a[1] + ny + uy],
          ],
          m,
          (x) => (far ? 0.25 : 0.55) - ((x - a[0]) / w) * 0.3,
          zz,
          1,
        );
        part.commit();
      },
    };
  };
  return [item(rig.legR), item(rig.legL)];
};

// ── The torso: sash, under-dress panel, the coat over the rest ───────────────────────────────

const deg = (h: Hit): number => Math.abs((Math.atan2(h.p[2], h.p[0]) * 180) / Math.PI);

function torso(h: Hit, where: 'hips' | 'chest'): Mat | null {
  const u = h.p[1];
  const yaw = deg(h);
  if (where === 'hips') {
    // The under-dress shows at the front, a narrow panel between the coat's cut-away edges that
    // runs on down into its skirt; either side of it, below the coat, her leggings.
    if (yaw < 26) return PANEL;
    return u <= 4.2 ? HIPS : ROBE;
  }
  if (u < 5) return null;
  // The sash, with a gold buckle at the front.
  if (u < 7.8) return yaw < 17 && u > 5.3 && u < 7.7 ? GOLD : SASH;
  // The pale bodice down the front, edged in gold, narrowing toward the collar.
  const open = 21 - (u - 8) * 0.35;
  if (yaw < open) return yaw > open - 3.2 ? GOLD : PANEL;
  return ROBE;
}

const BODY: BodyDesign = {
  thigh: { mat: LEGS, r0: 3.3, r1: 2.8 },
  shin: { mat: LEGS, r0: 2.6, r1: 2.4 },
  // Soft boots: slim, tapering to a pointed toe.
  boot: { mat: BOOT, r: 2.7, top: 0.5, toe: 5.6, heel: 2, sole: SOLE, foot: [2.4, 1.5] },
  upperArm: { mat: ROBE, r0: 2.8, r1: 2.5 },
  foreArm: { mat: ROBE, r0: 2.5, r1: 2.6 },
  // A gold band at the wrist of each sleeve.
  cuff: { mat: GOLD, r: 2.9, at: 0.66 },
  hand: { mat: SKIN, r: 2.3 },
  neck: { mat: NECK, r: 2 },
  hips: [{ c: [0, 3, 0], r: [4.6, 5, 6], id: 1 }],
  chest: [
    { c: [0, 8, 0], r: [4.1, 4.6, 5.4], id: 1 },
    { c: [0.3, 14, 0], r: [4.8, 8, 6.8], id: 1 },
  ],
  torso,
};

/** The curtain down her back: [yaw, length, half-width] of each tress, drawing in toward the middle as they fall. */
const CURTAIN: Tress[] = (
  [
    [146, 24, 2.8],
    [163, 31, 3.2],
    [197, 31, 3.2],
    [214, 24, 2.8],
  ] as const
).map(([yaw, len, w]): Tress => ({ yaw, pitch: 8, dir: [-0.5, -1, -Math.sin(rad(yaw)) * 0.6], len, w, taper: 0.45 }));

const SHELL = { c: [-1.4, 0.8, 0] as V3, r: [11.4, 10.2, 11.8] as V3 };

const SPELLBLADE: ChibiDesign = {
  id: 'hero-spellblade',
  build: BUILD,
  head: {
    skin: FACE_SKIN,
    hair: HAIR,
    skull: { c: [0, 0.5, 0], r: [8.9, 9.4, 9.9] },
    jaw: { c: [1.5, -4, 0], r: [7.4, 6.4, 7.6] },
    ear: { c: [-0.6, -3.2, 9.4], r: [1.8, 2.6, 1.5] },
    shell: SHELL,
    hairline: { faceYaw: 72, brow: 3.6, temple: 0, nape: -10, ear: -2 },
    locks: LOCKS,
    whorl: { yaw: 180, pitch: 58, reach: 82, clumps: 6, twist: 0.2 },
    long: {
      // A curtain to the middle of her back over the cape, gathered in under the nape to about
      // the width of her shoulders (so the cape shows either side of it from behind) and falling
      // in groups that end in points: two long ones either side of a shorter middle tress, and a
      // shorter one at each edge. And a long lock over each shoulder.
      back: CURTAIN,
      front: [
        { yaw: 70, pitch: 6, dir: [0.3, -1, 0.08], len: 25, w: 2.5, taper: 0.5 },
        { yaw: -70, pitch: 6, dir: [0.3, -1, -0.08], len: 25, w: 2.5, taper: 0.5 },
      ],
      // A lock gathered at the nape in a small gold clasp, its cord ends hanging: down the middle
      // of the curtain, a shorter point between its two long ones.
      tail: { yaw: 180, pitch: -1, dir: [-0.35, -1, 0], stiff: 0.15, len: 25, w: 2.8, tie: { mat: GOLD, r: 2.2, ends: 6 } },
      lie: 2.2,
    },
    face: {
      eye: [8.3, -1.8, 4.2],
      lash: hex('#26162e'),
      iris: hex('#5a46c0'),
      irisLight: hex('#9a8cf4'),
      irisDeep: hex('#2c1e72'),
      white: hex('#f8f4f8'),
      shine: hex('#ffffff'),
      brow: hex('#7a7498'),
      browUp: 3.6,
      mouth: hex('#c85a6c'),
      mouthAt: [9.1, -6.6],
      noseAt: [9.7, -4],
      style: FACE_SOFT,
    },
  },
  body: BODY,
  // The collar stands high behind and at the sides, but is open wide and low at the throat, so
  // its gold front edges stay well below her jaw.
  headPieces: [goldCollar({ c: [-0.8, 29, 0], r: [7.2, 10.5, 8.8], bottom: 19, top: { back: 29.6, side: 27.4, front: 23.5 }, open: 44 }), hairpin(SHELL), sheen(SHELL)],
  outfit: [
    // The under-dress: a pale front panel hanging between the coat's cut-away edges to the
    // middle of her thighs, narrow enough that her leggings show either side of it.
    skirt({
      outer: DRESS,
      inner: DRESS_IN,
      waist: 4.8,
      ring: [4.9, 6],
      aline: 0.1,
      folds: true,
      legs: 3.7,
      panels: [{ from: -28, to: 28, len: 12, jag: 1.4, taper: 0.8 }],
    }),
    // The robe-coat: cut away at the front from the hip, to the knee behind, gold at the hem.
    skirt({
      outer: ROBE,
      inner: LINING,
      waist: 5.2,
      ring: [5.2, 6.6],
      aline: 0.3,
      fan: 0.8,
      folds: true,
      trim: GOLD,
      legs: 3.8,
      panels: [
        { from: 38, to: 100, len: 16, jag: 1.5 },
        { from: 100, to: 160, len: 24, jag: 2, kick: 0.2 },
        { from: 160, to: 200, len: 26, jag: 2.5, kick: 0.3 },
        { from: 200, to: 260, len: 24, jag: 2, kick: 0.2 },
        { from: 260, to: 322, len: 16, jag: 1.5 },
      ],
    }),
    // The short cape, from the shoulders to the hips: wider and longer than the curtain of hair, so
    // its gold hem and edges show below and beside it from behind.
    cape({ outer: CAPE, inner: CAPE_LINING, top: 19.4, ring: [5.6, 8.8], from: 100, to: 260, len: 22, jag: 2.5, taper: 1.3, folds: true, trim: GOLD, over: { chest: BODY.chest, hips: BODY.hips, pad: 0.8 } }),
    bootCuffs,
  ],
  // The sword: a slender, straight, double-edged blade about 40 px long, pale steel with a violet
  // fuller, a gold guard whose arms curve up toward the blade, a wrapped violet grip and a small
  // violet crystal in the pommel.
  weapon: blade({
    blade: [
      [3, 1.9],
      [3, -1.9],
      [31, -1.8],
      [38, -1.1],
      [42, 0],
      [38, 1.1],
      [31, 1.8],
    ],
    edge: { from: 5, width: 0.9, mat: EDGE },
    rune: { v: 0, from: 5, to: 33, rest: hex('#6a48aa'), colour: hex('#b98cff'), glow: hex('#e2d0ff'), marks: [12, 20, 28] },
    steel: STEEL,
    guard: {
      pts: [
        [3.2, -1.4],
        [6, -5.4],
        [4, -6.2],
        [1, -3.2],
        [0, -1.6],
        [0, 1.6],
        [1, 3.2],
        [4, 6.2],
        [6, 5.4],
        [3.2, 1.4],
      ],
      mat: GOLD,
      gem: { u: 1.6, r: 0.9, mat: CRYSTAL },
    },
    grip: { from: -6, to: 0.4, r: 1.3, mat: GRIP, wrap: flat(hex('#1c1030')) },
    pommel: { u: -7.4, r: 1.8, mat: GOLD, gem: CRYSTAL, gemR: 1.2 },
    grip2: -4,
    reach: [6, 42],
  }),
  // The wand, in her left hand: a pale rod about 18 px long with gold bands and a violet crystal.
  offhand: wand({
    rod: { from: -3, to: 10.5, r0: 1.4, r1: 1.05, mat: WAND_ROD },
    bands: { at: [-1.4, 4.4, 9.6], mat: GOLD },
    knob: { r: 1.6, mat: GOLD },
    claws: { len: 2.4, mat: GOLD },
    crystal: { len: 6.5, w: 2.3, mat: CRYSTAL, glow: hex('#c8a4ff') },
  }),
  aura: { core: hex('#a878ff'), edge: hex('#a8ecff'), hot: hex('#ffffff') },
};

export { SPELLBLADE };
