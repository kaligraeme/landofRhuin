/**
 * What a chibi hero is made of: the data a design file fills in (proportions, palette, head and
 * hair, the body's materials, outfit pieces and the weapon) and the shapes the engine paints it
 * with. A new hero is a new design file plus its moves files; nothing here is any one hero's.
 */
import type { Canvas, RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import type { Blob, Hit, Mat, Part } from './raster.js';
import type { Build, Camera, ChibiPose, Face, Frame3, Rig, V3 } from './rig.js';

/** A lock of hair: a clump raked over the head, a strand of the fringe, a lock at the nape. */
export interface Lock {
  /** Where it grows from on the hair's shell: degrees around the head (0 the face, 90 his right, 180 the back) and up from the ears' level. */
  yaw: number;
  pitch: number;
  /** Which way it grows, in head space [forward, up, right] (need not be unit length). */
  dir: V3;
  /** Length, half-width at the root, and a pull that curls it toward the tip (head space). */
  len: number;
  w: number;
  curl?: V3;
  /** How much it streams back in the wind (default 1). */
  give?: number;
  /** Where along it (0 root to 1 tip) the clump is widest (default 0.3). */
  belly?: number;
}

/** Eyes, brows and the rest of a face, in head space (the right eye; the left mirrors it). */
export interface FaceDesign {
  /** The right eye's centre on the face, [forward, up, right]. */
  eye: V3;
  /** Eye colours: upper lash and outline, iris dark and light, white, highlight. */
  lash: RGB;
  iris: RGB;
  irisLight: RGB;
  white: RGB;
  shine: RGB;
  brow: RGB;
  /** How far above the eye's centre the brow sits. */
  browUp: number;
  mouth: RGB;
  /** The mouth's centre, [forward, up]. */
  mouthAt: readonly [number, number];
  /** A nose tip, [forward, up] (a pixel of shadow). */
  noseAt: readonly [number, number];
  /** A pale scar on one cheek: its centre in head space (the sign of its right value picks the cheek) and its colour. */
  scar?: { at: V3; colour: RGB };
  /**
   * The glyphs the eyes, brows and mouth are stamped from (default FACE_PLAIN in head.ts: a
   * young man's level stare). head.ts also has FACE_SOFT (large lashed eyes, soft brows, a small
   * mouth) and FACE_SHARP (narrow, sharp eyes under straight brows); a design may draw its own.
   */
  style?: FaceStyle;
  /** The expression when a pose gives none (default 'stern'): a smirk for a cocky face, say. */
  rest?: Face;
  /** The deepest iris tone, for a style's `D` cells (default a shade under `iris`). */
  irisDeep?: RGB;
}

/**
 * A face feature drawn as a small pixel glyph: rows of cells, each the key of a colour or `.` for
 * none. Eyes and brows are drawn with their inner corner (toward the nose) on the left, and
 * mirrored for the other side; mouths left to right across the face. `ax`, `ay` is the cell that
 * sits on the anchor (the eye's centre, the brow's place above it, the mouth's centre).
 *
 * Keys: K lash and outline, I iris, i iris (light), D iris (deep), W white, h shine, l lid
 * crease or lower lash (the skin's shadow tone), B brow, M mouth, r the mouth's inside, T teeth.
 */
export interface FaceGlyph {
  rows: readonly string[];
  ax: number;
  ay: number;
}

/**
 * A face's set of glyphs. Each eye is drawn full, mid or narrow by how squarely it faces the
 * viewer, or as one of the expression shapes (closed: a blink or calm; squeeze: shut in pain;
 * wide: a shout, full on). Brows come in the same three widths, level and knitted up at their
 * inner ends (pain); there is a mouth for every expression. Every expression must work in every
 * style, so a style fills in all of them.
 */
export interface FaceStyle {
  eyes: Record<'full' | 'mid' | 'narrow' | 'closed' | 'squeeze' | 'wide', FaceGlyph>;
  brows: Record<'full' | 'mid' | 'narrow', FaceGlyph>;
  browsUp: Record<'full' | 'mid' | 'narrow', FaceGlyph>;
  mouths: Record<Face, FaceGlyph>;
}

/**
 * A tress of long hair: a clump that grows from the hair's shell (rooted as a lock is), follows
 * `dir` for a while and then hangs, lying over the back, the shoulders or the chest rather than
 * passing through them, and streams, lifts, swings and ripples with the pose's `wind`, `lift`,
 * `sway`, `flare` and `phase` (see LongHair).
 */
export interface Tress {
  /** Where it grows from on the hair's shell: degrees around the head (0 the face, 90 the right, 180 the back) and up from the ears' level. */
  yaw: number;
  pitch: number;
  /** Which way it leaves the head, in head space [forward, up, right] (need not be unit length). */
  dir: V3;
  /** Its length, and its half-width where widest, in frame pixels (it keeps that breadth whichever way it is seen). */
  len: number;
  w: number;
  /** The share of its length that keeps to `dir` before it falls (default 0.3). */
  stiff?: number;
  /** How readily it streams in the wind (default 1). */
  give?: number;
  /** The share of its length over which it narrows to its tip (default 0.35). */
  taper?: number;
}

/** A tail of hair tied at a point on the head: a ponytail, or a tail at the nape. */
export interface Ponytail {
  /** Where it is tied on the hair's shell, as a tress's root is given. */
  yaw: number;
  pitch: number;
  /** Which way it leaves the tie (head space: up and back for a high tail), and how long it keeps to that (default 0.25 of its length). */
  dir: V3;
  stiff?: number;
  /** Its length and its half-width where widest (frame pixels), and how readily it streams (default 1). */
  len: number;
  w: number;
  give?: number;
  /** The tie round its root: its material, its radius, and how long the two loose ends of a cord hang from it (none if left out). */
  tie: { mat: Mat; r: number; ends?: number };
}

/**
 * Hair that hangs past the shoulders, painted with the head's hair material (head.ts
 * `hairItems`). Each part of it is sorted with the body on its own, so a curtain down the back
 * hangs behind her seen from the front and over her back (and a cape) seen from behind, and where
 * it grows out of the head's own hair no line parts them. It hangs from the head, then falls
 * and lies over the body; the pose's `wind` streams it back (a negative wind leaves it be),
 * `lift` raises it, `flare` swings it out around her in a spin and `sway` swings it to a side,
 * and `phase` runs a ripple down it. To make it lag behind a turn, sway it against the turn (a
 * turn toward his right sways it to his left) and give it some wind.
 */
export interface LongHair {
  /** Tresses down the back, painted together as one curtain (head.ts `curtain` lays out a row of them). */
  back?: readonly Tress[];
  /** Locks over the shoulders that frame the face, each painted on its own, so the near one can lie over the chest while the far one hangs behind. */
  front?: readonly Tress[];
  /** A tied tail. */
  tail?: Ponytail;
  /** How far clear of the body the hair lies (default 1.5): more over a cape or a high collar. */
  lie?: number;
}

export interface HeadDesign {
  skin: Mat;
  hair: Mat;
  /** The skull and the jaw (ellipsoids in head space, origin at the head's centre). */
  skull: { c: V3; r: V3 };
  jaw: { c: V3; r: V3 };
  /** The right ear (mirrored for the left). */
  ear: { c: V3; r: V3 };
  /** The hair's shell over the skull. */
  shell: { c: V3; r: V3 };
  /**
   * Where the face shows through the shell: within `faceYaw` degrees of the front and below the
   * fringe, whose height (head space u) runs from `brow` at the middle to `temple` at the face's
   * sides; and the sides and back are bare below `nape` (and around the ears, below `ear`).
   */
  hairline: { faceYaw: number; brow: number; temple: number; nape: number; ear: number };
  locks: readonly Lock[];
  /**
   * Hair a tone darker overall: the base tone covers the clumps, the light tone runs along their
   * lit sides and the highlight only on the brightest streaks (by default the light tone covers
   * them, with highlight streaks along their lit sides).
   */
  darkHair?: boolean;
  /** The coloured line that parts a lock from the hair behind it (default: a shade under the hair's darkest tone). */
  lockLine?: RGB;
  /**
   * Clumps painted on the shell, fanning out from the crown's whorl (where on the shell, as a
   * lock's root is given), out to `reach` degrees from it: how many there are round it and how
   * far they twist as they fall (radians of turn per radian out).
   */
  whorl?: { yaw: number; pitch: number; reach: number; clumps: number; twist: number };
  face: FaceDesign;
  /** Hair longer than the locks: a curtain down the back, locks over the shoulders, a ponytail. */
  long?: LongHair;
}

/** A limb's look: material and radii at its root and end. */
export interface LimbLook {
  mat: Mat;
  r0: number;
  r1: number;
}

export interface BodyDesign {
  thigh: LimbLook;
  shin: LimbLook;
  /** Boots: over the lower `top` share of the shin, then a foot `toe` long ahead of the ankle and `heel` behind it. */
  boot: { mat: Mat; r: number; top: number; toe: number; heel: number; sole: Mat; cap?: Mat };
  /** A knee cop over each knee. */
  knee?: { mat: Mat; r: number };
  upperArm: LimbLook;
  foreArm: LimbLook;
  /** A gauntlet's flared cuff, `at` that share of the forearm from the elbow, and the band of a paler metal round its wide end. */
  cuff?: { mat: Mat; r: number; at: number; rim?: Mat };
  /** The hand (a fist), and the plates over its knuckles in a paler metal. */
  hand: { mat: Mat; r: number; knuckle?: Mat };
  neck: { mat: Mat; r: number };
  /**
   * The torso: ellipsoids in the pelvis frame and in the chest frame (both with their origin at
   * the pelvis, u up the spine, f out of the belly), and the material at a hit.
   */
  hips: readonly Blob[];
  chest: readonly Blob[];
  torso: (h: Hit, where: 'hips' | 'chest') => Mat | null;
}

/** What a piece of outfit or a weapon is given to paint with. */
export interface PieceContext {
  c: Canvas;
  rig: Rig;
  cam: Camera;
  pose: ChibiPose;
  build: Build;
  /** Starts a part (a set of shapes committed together) on the frame's canvas; `tag` marks its pixels in `owner`. */
  part: (tag?: number) => Part;
  /** Which tagged part painted each pixel last (0 untagged): the weapon is WEAPON_TAG, the head HEAD_TAG. */
  owner: Int16Array;
  /** Hero space to frame pixels, and to depth toward the viewer. */
  proj: (p: V3) => Vec;
  depth: (p: V3) => number;
  /** Added to upper-body depths so they sort after the legs and the hips (see painter.ts). */
  upper: number;
}

/** The owner tag of the weapon's pixels. */
export const WEAPON_TAG = 1;
/** The owner tag of the head's pixels (with its hair and collar). */
export const HEAD_TAG = 2;

/** Something to paint at a depth (bigger is nearer the viewer). */
export interface DrawItem {
  z: number;
  draw: () => void;
}

/**
 * An outfit piece: given a solved frame, it says what to paint and at what depths. The engine's
 * pieces (pieces.ts) cover pauldrons, a high collar and coat tails; a design may add its own.
 */
export type Piece = (ctx: PieceContext) => DrawItem[];

/** A piece painted with the head (inside its depth test): collars, hoods, scarves round the neck. */
export interface HeadPiece {
  blobs: (ctx: PieceContext) => { frame: Frame3; blobs: readonly Blob[]; shade: (h: Hit) => { m: Mat; light?: number; id?: number } | null }[];
}

/** The owner tag of long hair (a design's `head.long`), painted apart from the head. */
export const HAIR_TAG = 4;

export interface WeaponDesign {
  /** Where the second hand holds it, along the weapon from the first (negative: toward the pommel). */
  grip2: number;
  /** The cutting part along the weapon, for smears and impacts. */
  reach: readonly [number, number];
  /** Paints the weapon into a part; a glowing channel reads its brightness from the pose (fx.rune, fx.aura; see blade.ts `blaze`). */
  paint: (ctx: PieceContext, part: Part) => void;
  /** Soft glow painted over the figure (a rune channel), 0 to 1 strength. */
  glow?: (ctx: PieceContext, strength: number) => void;
}

export interface ChibiDesign {
  id: string;
  build: Build;
  head: HeadDesign;
  body: BodyDesign;
  /** Pieces painted with the head (collars) and pieces sorted with the body (pauldrons, coats). */
  headPieces: readonly HeadPiece[];
  outfit: readonly Piece[];
  weapon: WeaponDesign;
  /** Skill aura: core, edge and the white-hot colour of a smear's cutting edge (every effect is painted in these). */
  aura: { core: RGB; edge: RGB; hot: RGB };
}
