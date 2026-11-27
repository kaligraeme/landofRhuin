/**
 * What a chibi hero is made of: the data a design file fills in (proportions, palette, head,
 * hair and face, the body's materials, outfit pieces, the weapon and an off-hand item) and the
 * shapes the engine paints it with. A new hero is a new design file plus its moves files; nothing here is any one hero's.
 */
import type { Canvas, RGB, Vec } from '../paint.js';
import type { Blob, Hit, Mat, Part } from './raster.js';
import type { Build, Camera, ChibiPose, Face, Frame3, Grip, Rig, Strap, V3 } from './rig.js';

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
  /**
   * A springy lock (a single upright lock on the crown, an ahoge) sways to and fro by this much
   * as the pose's `phase` runs (scaled by `give`, as the wind is): about 0.6 bobs it in a run.
   */
  bob?: number;
  /**
   * How a lock seen end on (pointing at the viewer or away, so it would shrink to a nub) is laid
   * out instead: 0 (the default) splays it out from the middle of the head and lets it droop, as a
   * soft lock falls; 1 sets it standing straight out from the middle of the head, as a stiff
   * spike does (hair swept back, seen from in front or behind, as a ring of points).
   */
  stand?: number;
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
   * stern, level stare). head.ts also has FACE_SOFT (large lashed eyes, soft brows, a small
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
  /**
   * How far its end flips out, away from the head, as the ends of a layered cut do (default 0: it
   * hangs straight). About 1 turns the last two fifths of it out and a little up. A flipped end
   * catches the light where it turns up, rather than darkening to its tip.
   */
  flip?: number;
}

/**
 * A tail of hair tied at a point on the head: a ponytail, or a tail at the nape. It is a thick
 * tress with a thinner one either side of it, the tie standing clear of the hair at its root so
 * it shows on the head's outline side on. Streaming straight away from the viewer (running, seen
 * from the front) it flicks out to one side of the head rather than hiding behind it.
 */
export interface Ponytail {
  /** Where it is tied on the hair's shell, as a tress's root is given. */
  yaw: number;
  pitch: number;
  /** Which way it leaves the tie (head space: up and back for a high tail), and how long it keeps to that (default 0.3 of its length). */
  dir: V3;
  stiff?: number;
  /** Its length and its half-width where widest (frame pixels), and how readily it streams (default 1). */
  len: number;
  w: number;
  give?: number;
  /** The tie round its root: its material, its radius, and how long the two loose ends of a cord hang from it (none if left out). */
  tie: { mat: Mat; r: number; ends?: number };
  /**
   * Lifts its lighting (default 0): a tail streaming out behind the head faces away from the
   * light and paints in its darkest tones; about 0.4 lets its clumps show their lit sides and a
   * highlight streak, as glossy dark hair does.
   */
  sheen?: number;
}

/**
 * Hair that hangs past the shoulders, painted with the head's hair material (head.ts
 * `hairItems`). Each part of it is sorted with the body on its own (but for layers at the nape:
 * see `nape`), so a curtain down the back hangs behind the body seen from the front and over the
 * back (and a cape) seen from behind, and
 * where it grows out of the head's own hair no line parts them. It hangs from the head, then falls
 * and lies over the body; the pose's `wind` streams it back (a negative wind leaves it be),
 * `lift` raises it, `flare` swings it out around the body in a spin and `sway` swings it to a side,
 * and `phase` runs a ripple down it. To make it lag behind a turn, sway it against the turn (a
 * turn toward his right sways it to his left) and give it some wind.
 */
export interface LongHair {
  /**
   * Tresses down the back, a curtain (head.ts `curtain` lays out a row of them). Each is painted
   * and sorted on its own, so side on the near ones lie over a cape while the far ones hang
   * behind it, and a coloured line parts one from the next.
   */
  back?: readonly Tress[];
  /** Locks over the shoulders that frame the face, each painted on its own, so the near one can lie over the chest while the far one hangs behind. */
  front?: readonly Tress[];
  /** A tied tail. */
  tail?: Ponytail;
  /**
   * Short layers at the nape (a wolf cut's or a mullet's), painted with the head inside its depth
   * test rather than sorted with the body, so they lie over a high collar where they fall outside
   * it and stay hidden where it stands nearer, in every view. They lie over the head, the jaw and
   * the head's pieces (a high collar: the pieces' ellipsoids whole, `lie` clear of them), and sort
   * as the head does: keep them short (about 8 to 16), above the shoulders.
   */
  nape?: readonly Tress[];
  /**
   * How many tones darker than other long hair the nape layers are where they grow out from under
   * the hair above them, in its shadow (default 1: their upper part a tone deeper, so the layers
   * read apart from the hair over them). With 0 they are lit all along as the rest of the hair is.
   */
  napeDeep?: number;
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
   * sides; and the sides and back are bare below `nape` (and around the ears, below `ear`). The
   * hair shades the skin under its edge for `shadow` pixels (default 2: a fringe's shadow on the
   * brow; 1 suits hair that lifts off the forehead, 0 none).
   */
  hairline: { faceYaw: number; brow: number; temple: number; nape: number; ear: number; shadow?: number };
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
   * far they twist as they fall (radians of turn per radian out). By default each clump is banded
   * the same all round the head (a dark parting, a lit band, the light tone, a darker far side),
   * and they meet again at the point opposite the whorl.
   */
  whorl?: { yaw: number; pitch: number; reach: number; clumps: number; twist: number };
  face: FaceDesign;
  /** Hair longer than the locks: a curtain down the back, locks over the shoulders, a ponytail. */
  long?: LongHair;
  /** A beard (head.ts `beard` lays one out: full, short or pointed). */
  beard?: Beard;
  /** A moustache under the nose. */
  moustache?: Moustache;
  /** Hair worn up: buns, a twist, a high updo (painted with the head, on its hair). */
  buns?: readonly Bun[];
}

/**
 * A beard: hair grown over the jaw and, for a longer one, tresses hanging from it. The part on the
 * jaw is a shell `thick` pixels clear of the jaw (painted with the head, in its depth test, so it
 * turns with it and hides behind it seen from behind), growing below a line from the sideburns
 * (`side`, head-space height at the ear) to beside the mouth (`cheek`, the height at the front of
 * the cheek), and leaving the lips bare in a patch `mouth` wide and high (half-sizes; [0, 0] grows
 * over them). The face's mouth is drawn over the beard wherever it reaches, so every expression
 * reads through it. The hanging tresses (`hang`) are rooted on that shell as locks are on the
 * hair's (`yaw` round the jaw from the chin, 90 his right; `pitch` up from the jaw's middle, so
 * about -40 is under the chin), and hang, lie over the chest, sway and stream as long hair does
 * (see LongHair: they answer to `wind`, `lift`, `flare`, `sway` and `phase`, by their own `give`),
 * each sorted with the body on its own: in front of the chest from the front and the side, hidden
 * by the body from behind except where it shows beside the neck. Where a tress crosses a held item
 * on screen it sorts by which of the two is nearer there (`DrawItem.cross`): a staff held across
 * the chest passes behind a beard lying on it, one held out in front passes over it.
 */
export interface Beard {
  /** Its material (default the hair's). */
  mat?: Mat;
  thick: number;
  side: number;
  cheek: number;
  mouth: readonly [number, number];
  /** How far round the jaw it grows from the chin (degrees, default 100: to the back of the jaw, under the ears). */
  round?: number;
  hang?: readonly Tress[];
  /** How far clear of the chest the hanging tresses lie (default 1.2). */
  lie?: number;
}

/**
 * A moustache: two clumps of hair from under the nose (at `at`, head space [forward, up]; default
 * a pixel under `face.noseAt`) out to either side over the corners of the mouth, `len` long and
 * `w` thick, their tips drooping `droop` pixels (negative curls them up), painted with the head
 * in front of the face. The mouth is drawn over it, so it never hides an expression.
 */
export interface Moustache {
  mat?: Mat;
  len: number;
  w: number;
  droop: number;
  at?: readonly [number, number];
}

/**
 * Hair worn up: a bun, a twist or a high updo, a ball of hair standing on the hair's shell at a
 * yaw and pitch (as a lock's root: 0 the face, 90 his right, 180 the back; pitch up from the
 * ears' level), `r` its radii [across, out from the head, across] (so [3, 3, 3] is a round bun
 * and [3, 6, 3] a tall twist standing out), clumps of hair wound round it (`clumps` of them,
 * twisting `twist` turns from its root to its top: about 0.3 for a bun, 1 or more for a twist),
 * leaning `lean` (head space, the way its top tips, need not be unit length) and tied at its root
 * with a band (`tie`) if given. Two buns are two of these. Painted with the head, in its depth
 * test, so they turn with it.
 */
export interface Bun {
  yaw: number;
  pitch: number;
  r: V3;
  clumps?: number;
  twist?: number;
  lean?: V3;
  tie?: { mat: Mat; r: number };
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
  /**
   * Boots: over the lower `top` share of the shin, then a foot `toe` long ahead of the ankle and
   * `heel` behind it, `foot` thick at the heel and at the toe (radii, default [2.6, 2.4]: a
   * smaller toe tapers a soft boot to a point) on a sole a little narrower.
   */
  boot: { mat: Mat; r: number; top: number; toe: number; heel: number; sole: Mat; cap?: Mat; foot?: readonly [number, number] };
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
  /** Which tagged part painted each pixel last (0 untagged): the weapon is WEAPON_TAG, the head HEAD_TAG, the off-hand item OFFHAND_TAG and long hair HAIR_TAG. */
  owner: Int16Array;
  /** Hero space to frame pixels, and to depth toward the viewer. */
  proj: (p: V3) => Vec;
  depth: (p: V3) => number;
  /** Added to upper-body depths so they sort after the legs and the hips (see painter.ts). */
  upper: number;
  /**
   * The depth an upper-body item sorts at, given its true depth: lifted by `upper`, unless it lies
   * on the far side of the torso (more than 2 px behind its middle), where it keeps its true depth
   * as an arm there does, so an arm or a coat flap nearer the viewer stays in front of it. Capes,
   * scarf tails, long hair and the off-hand item sort this way.
   */
  upperZ: (z: number) => number;
}

/** The owner tag of the weapon's pixels. */
export const WEAPON_TAG = 1;
/** The owner tag of the head's pixels (with its hair and collar). */
export const HEAD_TAG = 2;
/** The owner tag of the off-hand item's pixels. */
export const OFFHAND_TAG = 3;
/** The owner tag of long hair (a design's `head.long`), painted apart from the head. */
export const HAIR_TAG = 4;

/** Something to paint at a depth (bigger is nearer the viewer). */
export interface DrawItem {
  z: number;
  draw: () => void;
  /**
   * A strand hanging over the body (a beard's tress: its points, hero space, and its half-width)
   * that sorts against what the hands hold where they cross on screen, rather than by its own
   * depth alone: the painter puts it just in front of or behind each held item it crosses, by
   * which of the two is nearer the viewer where they cross.
   */
  cross?: { pts: readonly V3[]; w: number };
}

/**
 * An outfit piece: given a solved frame, it says what to paint and at what depths. The engine's
 * pieces (pieces.ts) cover pauldrons, skirts and coat tails, a cape and a scarf's tails; a design
 * may add its own (pieces.ts `strand` hangs cloth that lies over the body and streams).
 */
export type Piece = (ctx: PieceContext) => DrawItem[];

/**
 * A piece painted with the head (inside its depth test): collars, hoods, scarves round the neck,
 * and things worn on the head itself (a hairpin, a circlet), which take `head`, the head's frame
 * as painted (side on it turns a little further toward the viewer than the rig's head: see
 * SIDE_LOOK in rig.ts), so they stay on the hair.
 */
export interface HeadPiece {
  blobs?: (ctx: PieceContext, head: Frame3) => { frame: Frame3; blobs: readonly Blob[]; shade: (h: Hit) => { m: Mat; light?: number; id?: number; lift?: number } | null }[];
  /**
   * Paints anything else into the head's part, in its depth test, once its blobs, the neck and
   * the hair are down (flat shapes such as a helm's fins: raster.ts `Part.facet`).
   */
  paint?: (ctx: PieceContext, part: Part, head: Frame3) => void;
  /**
   * Gear over the hair (a hood worn up, a helm) says which hair it covers: given where a lock, a
   * tress, a bun or a tail grows (a point on the hair's shell, head space) and which way it grows
   * from there (head space), true if that hair is under the gear and would only poke through it,
   * so it is not painted. Hair that comes out from under its edge (a fringe hanging from under a
   * hood or a brow band) is still painted and shows where it comes out. Long hair (`LongHair`'s
   * tresses and tail) rooted under it comes out from under its edge: its root slides down the
   * hair's shell until this says it is uncovered (it is left out only if it never is). Null this
   * frame if it covers nothing (a hood worn down).
   */
  covers?: (ctx: PieceContext, head: Frame3) => ((p: V3, dir: V3) => boolean) | null;
}

/**
 * Shape ids in the head's part at or above this are gear over the head (a hood, a helm, a
 * circlet): the eyebrows, which show through hair as drawn brows do, do not show through it.
 */
export const GEAR_ID = 500;

/**
 * How an item is held in this frame, for its painter: the grip (where the hand holds it and its
 * axes, as `Rig.weapon` or `Rig.offhand`), how brightly its glowing parts burn (0 smouldering at
 * rest to 1 ablaze: the pose's `fx.rune` for the main weapon, `fx.runeB` for the off-hand item,
 * plus a little of `fx.aura`; see held.ts `blaze`) and the owner tag its pixels carry
 * (WEAPON_TAG or OFFHAND_TAG), so its glow can keep to its own pixels.
 */
export interface Held {
  grip: Grip;
  blaze: number;
  tag: number;
}

/**
 * Something a hand holds, painted at whichever grip it is given: the builders (blade.ts,
 * pole.ts, wand.ts) make items that serve as the main weapon or as the off-hand item alike, so
 * twin blades or a sword and a wand are a design's choice (held.ts has what they share, for an
 * item a design draws itself). Its own axes are a grip's: u along it from where the hand holds
 * it, v across it (toward a blade's cutting edge), n its flat.
 *
 * Other kinds build on the same: a shield (shield.ts) is strapped to the forearm (`strap`) and
 * faces out from it; a bow (bow.ts) is held at its middle in the off hand and strings itself to
 * wherever the main hand is (`ctx.rig.armR.end`), so a pose draws it by pulling that hand back,
 * its string and arrow sorted on their own (`items`) and its shots leaving from the arrow's head
 * (`aim`); the main weapon is then what the drawing hand holds (`NO_WEAPON` in held.ts, or an
 * arrow). A crossbow (crossbow.ts) is a two-handed main weapon.
 */
export interface HeldItem {
  /** Its working part along it from the hand (a blade, a pole arm's head, a wand's crystal), for smears and impacts. */
  reach: readonly [number, number];
  /** Where effects leave it (`FxContext.tip`, `tipB`), along it from the hand (default `reach[1]`). */
  tip?: number;
  /** Paints it into a part. Without `held` it is the main weapon (`ctx.rig.weapon`, the pose's `fx.rune`, WEAPON_TAG). */
  paint: (ctx: PieceContext, part: Part, held?: Held) => void;
  /** A soft glow painted over the figure after it is outlined, 0 to 1 strength (or more), on its own pixels only. */
  glow?: (ctx: PieceContext, strength: number, held?: Held) => void;
  /**
   * Worn strapped to the forearm (a shield) rather than gripped at the pose's angles, in the off
   * hand: its grip is then the middle of its back, on the forearm, its u axis its top and its n
   * axis out of its face (see rig.ts `strapGrip` and the pose's notes on shields). The left arm
   * and hand sort behind it while its face is toward the viewer, in front of it otherwise.
   */
  strap?: Strap;
  /**
   * Where effects leave it and which way they fly, in hero space, when that is not simply its
   * `tip` along it (`FxContext.tip`/`dir`, `tipB`/`dirB`): a bow's is its arrow's head and the
   * arrow's line, a shield's the middle of its face and out of it.
   */
  aim?: (ctx: PieceContext, held: Held) => { tip: V3; dir: V3 };
  /**
   * Parts of it sorted on their own rather than with it (a bow's string and nocked arrow, which
   * run back to the drawing hand across the body): more draw items for the frame.
   */
  items?: (ctx: PieceContext, held: Held) => DrawItem[];
}

/**
 * The main weapon, in the right hand: a held item (blade.ts `blade`, pole.ts `pole`, or a
 * design's own) that both hands may hold. Painted without a `Held`, it lies along `rig.weapon`,
 * blazes with the pose's `fx.rune` and carries WEAPON_TAG.
 */
export interface WeaponDesign extends HeldItem {
  /** Where the second hand holds it, along the weapon from the first (negative: toward the pommel or the butt); a pose's `grip2` moves it. */
  grip2: number;
  /**
   * The stretch along it a hand may hold (a pole arm's haft, from near its butt to below its
   * head): a left hand that cannot reach its place on a two-handed weapon (the pose's `grip2`)
   * slides along the haft to the nearest place it can reach, so it stays on the weapon. Without
   * it the hand reaches for its place and may fall short of it, as a sword's hand on a grip would.
   */
  haft?: readonly [number, number];
}

export interface ChibiDesign {
  id: string;
  build: Build;
  head: HeadDesign;
  body: BodyDesign;
  /** Pieces painted with the head (collars, a scarf's wrap) and pieces sorted with the body (pauldrons, coats, capes, a scarf's tails). */
  headPieces: readonly HeadPiece[];
  outfit: readonly Piece[];
  weapon: WeaponDesign;
  /**
   * An item in the off (left) hand: a wand, a second blade, a shield, a bow. With one, the main weapon
   * is one-handed: the pose gives `handB` and the item's own angles (`weaponB`, `rollB`, `yawB`);
   * a pose that leaves `handB` out still puts that hand, item and all, on the main weapon's
   * second grip (a two-handed blow).
   */
  offhand?: HeldItem;
  /** Skill aura: core, edge and the white-hot colour of a smear's cutting edge (every effect is painted in these). */
  aura: { core: RGB; edge: RGB; hot: RGB };
  /**
   * Fills with ink, after the outline (as one-pixel pinholes are everywhere), each see-through gap
   * of at most this many pixels that the figure encloses wholly within twice the hair shell's
   * largest radius of the head's centre: the small windows a helm's own plates can leave against
   * the hair, the cheeks, the collar or the shoulders. Off when left out.
   */
  headGaps?: number;
}
