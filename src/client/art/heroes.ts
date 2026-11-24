/**
 * The four heroes as chibi pixel art: big heads, dark outlines and three-tone shading, lit from
 * the upper left. Each faces right with an empty weapon hand; weapons are separate pixel images
 * the renderer turns toward the hero's aim.
 */
import type { RoleId } from '../../shared/content/classes.js';
import type { SpriteDef } from './kit.js';
import { INK, Pix, type Ramp } from './pixel.js';

const W = 40;
const H = 48;
/** Height on screen in tiles: two screen pixels per art pixel at the default zoom. */
const HERO_HEIGHT = 2.18;
const X = 'x';

const shape = (w = W, h = H): Pix => new Pix(w, h);

// ── Palette ──────────────────────────────────────────────────────────────────────────────────

const SKIN: Ramp = ['#ffdcc0', '#f2b48e', '#c97f63'];
const GOLD: Ramp = ['#fff0a0', '#e9b843', '#a8701f'];
const STEEL: Ramp = ['#f2f6fb', '#b3bfcd', '#6d7a8e'];
const DARK_STEEL: Ramp = ['#828aa2', '#4f566c', '#30354a'];
const DARKER_STEEL: Ramp = ['#646b82', '#3c4155', '#25293a'];
const LEATHER: Ramp = ['#c0884f', '#8a5730', '#5c371d'];
const DARK_LEATHER: Ramp = ['#7c5538', '#553620', '#382213'];
const RED: Ramp = ['#ee5a52', '#bd2c38', '#7a1828'];
const CAPE: Ramp = ['#c4323e', '#8e1c2c', '#5a1020'];
const FUR: Ramp = ['#d4c2a2', '#9c8668', '#66563f'];
const BONE: Ramp = ['#fff8e6', '#e3d3ae', '#a99470'];
const PLATE: Ramp = ['#93a2c4', '#5a6890', '#384265'];
const PLATE_DARK: Ramp = ['#73809f', '#444f70', '#2a3150'];
const DARK_HAIR: Ramp = ['#58525f', '#2f2a36', '#18141c'];
const WEATHERED: Ramp = ['#f2c29c', '#d4946c', '#9c5e44'];
const SCAR = '#f0b4a0';
const WHITE_HAIR: Ramp = ['#ffffff', '#e6e4f1', '#aeaaca'];
const ROBE: Ramp = ['#7360cc', '#44328e', '#2a1d5e'];
const ROBE_INNER: Ramp = ['#ffffff', '#ddd6f2', '#a99dcc'];
const COPPER: Ramp = ['#f7a868', '#c8642e', '#83371b'];
const TUNIC: Ramp = ['#74b456', '#438a3a', '#2a5c2a'];
const CLOAK: Ramp = ['#4c8c4a', '#2c6237', '#1a3e26'];
const TAN: Ramp = ['#e0c292', '#b49264', '#816747'];
const BROWN_HAIR: Ramp = ['#9a6a42', '#64402a', '#3c261a'];
const TROUSERS: Ramp = ['#5e6582', '#3e435c', '#282b3e'];
const WOOD: Ramp = ['#d4a46a', '#9c6e40', '#664626'];

/** A pair of chibi eyes for a face turned three-quarters to the right. */
function eyes(p: Pix, xa: number, xb: number, y: number, iris: string, irisDark: string): void {
  for (const x of [xa, xb]) {
    p.hline(x, x + 1, y, INK);
    p.set(x, y + 1, '#ffffff').set(x + 1, y + 1, iris);
    p.set(x, y + 2, iris).set(x + 1, y + 2, irisDark);
  }
}

function legs(p: Pix, back: Ramp, front: Ramp, boot: Ramp, backBoot: Ramp, bootTop = 40): void {
  p.paint(shape().rect(15, 34, 18, bootTop, X), back);
  p.paint(shape().rect(15, bootTop, 18, 45, X).rect(19, 43, 19, 45, X), backBoot);
  p.paint(shape().rect(21, 34, 24, bootTop, X), front);
  p.paint(shape().rect(21, bootTop, 24, 45, X).rect(25, 43, 26, 45, X), boot);
}

function heroDef(p: Pix, hand: { x: number; y: number }): SpriteDef {
  p.outline();
  return { svg: p.toSvg(8), vx: 0, vy: 0, w: W, h: H, ax: 20.5, ay: 46, height: HERO_HEIGHT, hand, pixel: true };
}

// ── Heroes ───────────────────────────────────────────────────────────────────────────────────

/** Tank: a gruff barbarian dark knight — long dark mane, bushy beard, fur collar and tattered cape. */
function tank(): SpriteDef {
  const p = new Pix(W, H);
  p.paint(shape().poly([[14, 22], [26, 22], [24, 30], [22, 40], [20, 43], [18, 41], [16, 44], [14, 41], [11, 44], [9, 41], [6, 43], [5, 37], [7, 30], [10, 25]], X), CAPE, { shade: 2 });
  // Long dark mane down the back.
  p.paint(shape().poly([[12, 8], [18, 6], [19, 20], [17, 28], [15, 34], [13, 31], [11, 35], [9, 31], [6, 33], [7, 27], [4, 28], [6, 22], [3, 19], [7, 15], [8, 11]], X), DARK_HAIR, { shade: 2 });
  p.line(10, 12, 8, 20, DARK_HAIR[0]).line(14, 10, 13, 17, DARK_HAIR[0]);
  p.line(9, 22, 8, 30, DARK_HAIR[2]).line(12, 20, 12, 31, DARK_HAIR[2]).line(6, 24, 5, 27, DARK_HAIR[2]).line(15, 24, 15, 31, DARK_HAIR[2]);
  legs(p, PLATE_DARK, PLATE, PLATE, PLATE_DARK);
  p.paint(shape().ellipse(16.5, 37, 1.6, 1.2, X), PLATE, { line: false });
  p.paint(shape().ellipse(22.5, 37, 1.8, 1.3, X), STEEL, { line: false });
  // Back arm and pauldron.
  p.paint(shape().rect(11, 25, 14, 31, X), PLATE_DARK);
  p.paint(shape().rect(11, 31, 14, 34, X), PLATE_DARK);
  p.paint(shape().ellipse(13, 24.5, 3.5, 3, X), PLATE, { shade: 2 });
  p.paint(shape().poly([[10.5, 23], [13, 22.5], [10.5, 18]], X), BONE, { bottom: false });
  // Breastplate, belt and crimson tabard.
  p.paint(shape().poly([[14, 22], [27, 22], [26, 34], [15, 34]], X), PLATE, { shade: 2 });
  p.vline(20, 24, 28, PLATE[0]);
  p.hline(16, 25, 28, PLATE_DARK[2]);
  p.paint(shape().rect(15, 30, 26, 31, X), DARK_LEATHER, { hi: false });
  p.paint(shape().rect(19, 30, 21, 31, X), GOLD, { line: false });
  p.paint(shape().poly([[17, 32], [24, 32], [24, 38], [20.5, 41], [17, 38]], X), RED, { shade: 2 });
  p.dots([[20, 34], [21, 35], [20, 36], [19, 35]], GOLD[1]).set(20, 35, GOLD[0]);
  // Fur collar.
  p.paint(shape().ellipse(20.5, 22.5, 8, 2.6, X).dots([[13, 25], [16, 26], [19, 25], [22, 26], [25, 25], [28, 24]], X), FUR, { shade: 2 });
  p.dots([[15, 21], [18, 21], [21, 21], [24, 21]], FUR[0]);
  // Front arm, gauntlet and spiked pauldron.
  p.paint(shape().rect(26, 25, 29, 31, X), PLATE);
  p.paint(shape().rect(26, 31, 29, 35, X), PLATE_DARK);
  p.hline(26, 28, 33, PLATE[0]);
  p.paint(shape().ellipse(28, 24.5, 4.5, 3.5, X), PLATE, { shade: 2 });
  p.hline(25, 31, 26, PLATE_DARK[2]).dots([[26, 22], [27, 22]], PLATE[0]);
  p.paint(shape().poly([[29, 22], [32, 22.5], [33, 17]], X), BONE, { bottom: false });
  // Weathered face, a crown of wild hair and a crooked nose.
  p.paint(shape().ellipse(20.5, 14.5, 8, 7.5, X), WEATHERED, { shade: 2 });
  p.paint(shape().poly([[12, 20], [11, 13], [12, 9], [14, 5], [16, 6.5], [18, 3.5], [20, 5], [23, 3.5], [24, 5.5], [27, 6], [29, 9], [29.5, 13], [28, 11.5], [26.5, 13], [25.5, 10.5], [23.5, 12], [22, 10], [20, 12.5], [19, 17], [17.5, 21], [14, 23]], X), DARK_HAIR, { shade: 2 });
  p.line(15, 7, 13, 12, DARK_HAIR[0]).line(19, 6, 18, 9, DARK_HAIR[0]).line(23, 6, 24, 8, DARK_HAIR[0]);
  p.line(15, 14, 15, 20, DARK_HAIR[2]).line(13, 13, 13, 18, DARK_HAIR[2]);
  p.dots([[29, 16], [29, 17]], WEATHERED[1]).set(28, 17, WEATHERED[2]);
  // A heavy scowl: low brows, narrowed eyes and a scar across the nose.
  p.dots([[20, 13], [21, 13], [22, 14], [23, 14], [25, 14], [26, 13], [27, 13]], INK).dots([[21, 12], [26, 12]], DARK_HAIR[1]);
  for (const x of [21, 25]) p.hline(x, x + 1, 15, INK).set(x, 16, '#f1e6d2').set(x + 1, 16, '#3b2418');
  p.dots([[23, 15], [24, 16], [25, 17]], SCAR);
  // Bushy beard and moustache, with a downturned mouth.
  p.paint(shape().poly([[17, 17.5], [19, 19.5], [22, 18.5], [25, 19.5], [27.5, 18], [29, 17.5], [29, 22], [28, 25], [26, 27.5], [24.5, 29.5], [23, 28], [21.5, 29.5], [19.5, 27], [18, 24.5], [17, 21]], X), DARK_HAIR, { shade: 2, line: DARK_HAIR[2] });
  p.line(20, 23, 21, 26, DARK_HAIR[2]).line(24, 23, 24, 27, DARK_HAIR[2]).line(27, 22, 26, 25, DARK_HAIR[2]).dots([[19, 21], [20, 22]], DARK_HAIR[0]);
  p.hline(21, 28, 19, DARK_HAIR[1]).dots([[21, 20], [28, 20]], DARK_HAIR[1]);
  p.hline(23, 26, 21, '#120c0c').dots([[22, 22], [27, 22]], '#120c0c');
  return heroDef(p, { x: 27.5, y: 33.5 });
}

/** Mage: long white hair, a gold circlet and star-blue robes with gold trim. */
function mage(): SpriteDef {
  const p = new Pix(W, H);
  p.paint(shape().poly([[12, 10], [17, 6], [22, 8], [22, 20], [21, 30], [22, 38], [19, 36], [17, 40], [15, 37], [12, 41], [11, 36], [8, 39], [8, 32], [6, 34], [7, 26], [8, 18]], X), WHITE_HAIR, { shade: 2 });
  p.paint(shape().rect(16, 43, 18, 45, X), DARK_LEATHER);
  p.paint(shape().rect(22, 43, 25, 45, X), DARK_LEATHER);
  // Back sleeve.
  p.paint(shape().poly([[13, 23], [16, 24], [15, 30], [14, 33], [10, 33], [11, 28]], X), ROBE, { shade: 2 });
  p.hline(10, 14, 33, GOLD[1]);
  p.paint(shape().ellipse(12, 34.5, 1.3, 1, X), SKIN);
  // Robe: a flared skirt, an inner panel and a gold-trimmed hem.
  p.paint(shape().poly([[15, 30], [26, 30], [29.5, 43], [10.5, 43]], X), ROBE, { shade: 2 });
  p.paint(shape().poly([[21, 31], [24, 31], [26, 43], [21, 43]], X), ROBE_INNER, { line: false });
  p.line(21, 31, 21, 43, GOLD[1]).line(24, 31, 26, 43, GOLD[1]);
  p.hline(11, 29, 43, GOLD[1]).dots([[13, 43], [17, 43], [28, 43]], GOLD[0]);
  p.paint(shape().poly([[14, 22], [26, 22], [26, 31], [15, 31]], X), ROBE, { shade: 2 });
  p.paint(shape().poly([[19, 22], [24, 22], [21.5, 27]], X), ROBE_INNER, { line: GOLD[2] });
  p.paint(shape().rect(15, 30, 26, 31, X), RED, { hi: false });
  p.paint(shape().poly([[16, 31], [18, 31], [17.5, 37], [15, 36]], X), RED);
  p.paint(shape().rect(17, 21, 24, 22, X), GOLD, { line: false });
  // Front sleeve, gold cuff and hand.
  p.paint(shape().poly([[24, 23], [28, 24], [30, 31], [29, 33], [25, 33], [25, 28]], X), ROBE);
  p.hline(25, 29, 32, GOLD[1]).set(26, 32, GOLD[0]);
  p.paint(shape().ellipse(27.5, 34, 1.6, 1.3, X), SKIN);
  // Head, fringe and the long lock falling over the shoulder.
  p.paint(shape().ellipse(20.5, 14.5, 8, 7.5, X), SKIN, { shade: 2 });
  p.paint(shape().poly([[12, 18], [12, 11], [14, 8], [18, 6], [23, 6], [27, 8], [29, 11], [29, 14], [27, 12], [26, 14], [24, 12], [22, 14], [21, 12], [19, 15], [18, 19], [16, 22], [13, 22]], X), WHITE_HAIR, { shade: 2 });
  p.paint(shape().poly([[28, 12], [30, 13], [30.5, 22], [29.5, 28], [27.5, 25], [28, 19]], X), WHITE_HAIR);
  p.line(14, 11, 16, 9, GOLD[1]).hline(17, 27, 9, GOLD[1]).set(24, 9, '#5ff0ff').set(24, 8, '#c8fdff');
  eyes(p, 21, 25, 15, '#8a5ae0', '#4c2a96');
  p.set(23, 20, '#c4685a');
  p.dots([[20, 18], [27, 18]], '#f59a8e');
  return heroDef(p, { x: 27.5, y: 34 });
}

/** Ranger: an elvish archer — long pointed ears, a golden braid, a green cowl and a quiver. */
function ranger(): SpriteDef {
  const p = new Pix(W, H);
  p.paint(shape().poly([[14, 22], [25, 22], [23, 31], [19, 42], [17, 40], [15, 43], [13, 40], [10, 42], [10, 34], [12, 27]], X), CLOAK, { shade: 2 });
  // Long copper hair down the back.
  p.paint(shape().poly([[12, 10], [17, 8], [18, 20], [16, 27], [15, 33], [13, 31], [11, 34], [10, 29], [8, 31], [9, 24], [7, 22], [9, 16]], X), COPPER, { shade: 2 });
  p.dots([[11, 20], [12, 24], [10, 26]], COPPER[0]);
  // Quiver at the back hip, fletchings showing.
  p.paint(shape().poly([[9, 28], [12, 27], [15, 37], [12, 38]], X), LEATHER, { shade: 1 });
  p.line(9, 27, 8, 24, '#d8c8a0').line(11, 27, 11, 23, '#d8c8a0');
  p.dots([[7, 23], [8, 23], [10, 22], [11, 22], [12, 22]], '#e23b3b').dots([[8, 22], [11, 21]], '#ffffff');
  legs(p, TAN, TAN, LEATHER, DARK_LEATHER, 38);
  p.hline(15, 18, 38, DARK_LEATHER[0]).hline(21, 24, 38, LEATHER[0]);
  // Back arm: sleeve, bracer and glove.
  p.paint(shape().rect(12, 24, 14, 28, X), TUNIC);
  p.paint(shape().rect(11, 28, 14, 31, X), DARK_LEATHER);
  p.paint(shape().ellipse(12.5, 32.5, 1.6, 1.3, X), DARK_LEATHER);
  // Green tunic with a leaf-cut hem under a laced leather jerkin.
  p.paint(shape().poly([[15, 32], [26, 32], [27, 37], [25, 36], [23, 38], [21, 36], [19, 38], [17, 36], [14, 37]], X), TUNIC);
  p.paint(shape().poly([[14, 22], [26, 22], [26, 32], [15, 32]], X), LEATHER, { shade: 2 });
  p.paint(shape().poly([[19, 22], [23, 22], [21, 27]], X), TUNIC, { line: DARK_LEATHER[2] });
  p.dots([[20, 28], [22, 28], [20, 30], [22, 30]], DARK_LEATHER[2]).dots([[21, 29]], TAN[0]);
  p.paint(shape().rect(15, 31, 26, 32, X), DARK_LEATHER, { hi: false });
  p.rect(20, 31, 21, 32, '#dfe4ec');
  p.dots([[16, 36], [20, 37], [24, 36]], TUNIC[0]);
  p.paint(shape().ellipse(20.5, 22.5, 6.5, 2.2, X), CLOAK, { shade: 2 });
  // Front arm.
  p.paint(shape().rect(26, 24, 28, 27, X), TUNIC);
  p.paint(shape().rect(26, 27, 29, 31, X), LEATHER);
  p.paint(shape().ellipse(27.5, 33, 1.7, 1.5, X), DARK_LEATHER);
  // Head, a long pointed ear, swept fringe and a silver leaf circlet.
  p.paint(shape().ellipse(20.5, 14.5, 8, 7.5, X), SKIN, { shade: 2 });
  p.paint(shape().poly([[12, 19], [12, 11], [14, 8], [18, 6], [23, 6], [27, 8], [29, 11], [29, 16], [27.5, 13], [26, 11], [25, 13], [23, 11], [21, 13], [20, 11], [18, 14], [17, 18], [15, 21]], X), COPPER, { shade: 2 });
  p.paint(shape().poly([[15, 15], [11, 13], [5, 8], [8, 13], [10, 16], [14, 18]], X), SKIN);
  p.line(12, 15, 8, 11, SKIN[2]);
  p.line(14, 11, 16, 9, '#dfe4ec').hline(17, 26, 9, '#dfe4ec').dots([[25, 8], [26, 8], [26, 7]], '#6fd46a');
  eyes(p, 21, 25, 15, '#3fae5a', '#1f6a36');
  p.set(23, 20, '#c4685a');
  return heroDef(p, { x: 27.5, y: 33 });
}

/** Melee: a lean soldier — spiky hair, a long red scarf, steel cuirass and a quilted gambeson. */
function melee(): SpriteDef {
  const p = new Pix(W, H);
  p.paint(shape().poly([[16, 22], [12, 23], [8, 25], [5, 28], [3, 32], [2, 36], [5, 34], [4, 38], [7, 34], [9, 30], [12, 27], [15, 26]], X), RED, { shade: 1 });
  legs(p, TROUSERS, TROUSERS, DARK_LEATHER, DARK_LEATHER);
  p.paint(shape().rect(15, 37, 18, 40, X), STEEL, { line: false });
  p.paint(shape().rect(21, 37, 24, 40, X), STEEL, { line: false });
  // Back arm.
  p.paint(shape().rect(12, 24, 14, 29, X), RED);
  p.paint(shape().rect(11, 29, 14, 33, X), LEATHER);
  // Quilted gambeson skirt, cuirass, belt and pouch.
  p.paint(shape().poly([[14, 31], [26, 31], [27, 37], [13, 37]], X), RED, { shade: 2 });
  for (const x of [17, 20, 23]) p.vline(x, 33, 36, RED[2]);
  p.paint(shape().poly([[14, 22], [26, 22], [26, 31], [15, 31]], X), STEEL, { shade: 2 });
  p.vline(21, 24, 29, '#ffffff').dots([[16, 24], [24, 24], [16, 29], [24, 29]], STEEL[2]);
  p.paint(shape().rect(14, 31, 26, 32, X), LEATHER, { hi: false });
  p.rect(19, 31, 20, 32, GOLD[1]);
  p.paint(shape().rect(23, 33, 25, 35, X), LEATHER);
  // Scarf wrapped at the neck.
  p.paint(shape().ellipse(20.5, 22.5, 6, 2, X).ellipse(16, 24, 1.5, 1.5, X), RED, { shade: 2 });
  // Front arm: sleeve, vambrace, glove and a layered pauldron.
  p.paint(shape().rect(26, 25, 28, 27, X), RED);
  p.paint(shape().rect(26, 27, 29, 31, X), STEEL);
  p.paint(shape().ellipse(27.5, 33, 1.8, 1.6, X), LEATHER);
  p.paint(shape().ellipse(26.5, 24.5, 3.5, 2.8, X), STEEL);
  p.hline(24, 29, 26, STEEL[2]);
  // Head, spiky hair, determined brows and a scar.
  p.paint(shape().ellipse(20.5, 14.5, 8, 7.5, X), SKIN, { shade: 2 });
  p.paint(shape().poly([[12, 19], [11, 14], [9, 11], [12, 10], [11, 6], [14, 7], [15, 3], [18, 6], [20, 2], [22, 6], [25, 3], [25, 7], [28, 6], [28, 9], [30, 10], [29, 13], [27, 12], [25, 13], [24, 11], [22, 13], [21, 11], [19, 14], [18, 18], [16, 21], [13, 21]], X), BROWN_HAIR, { shade: 2 });
  eyes(p, 21, 25, 15, '#5a3a24', '#2c1a10');
  p.dots([[20, 13], [21, 14], [22, 14]], INK).dots([[25, 14], [26, 14], [27, 13]], INK);
  p.dots([[27, 18], [28, 19]], '#e7a28e');
  p.hline(23, 24, 20, '#a85a4a');
  return heroDef(p, { x: 27.5, y: 33 });
}

export const HERO_SPRITES: Record<RoleId, () => SpriteDef> = { tank, mage, ranger, melee };

// ── Weapons ──────────────────────────────────────────────────────────────────────────────────

/** A pixel weapon drawn pointing up, held at its grip. */
export interface WeaponArt {
  svg: string;
  w: number;
  h: number;
  /** The grip, in pixels: the point placed in the hero's hand. */
  gx: number;
  gy: number;
  /** A glow to draw over the weapon (staff orb, enchanted blade), in pixels. */
  glow?: { x: number; y: number; r: number; color: string };
}

/** Tiles per art pixel, shared by heroes and their weapons. */
export const HERO_PIXEL = HERO_HEIGHT / H;

function weapon(w: number, h: number, draw: (p: Pix, s: () => Pix) => void, gx: number, gy: number, glowAt?: WeaponArt['glow'], after?: (p: Pix) => void): WeaponArt {
  const p = new Pix(w + 2, h + 2);
  draw(p, () => shape(w + 2, h + 2));
  p.outline();
  after?.(p);
  return { svg: p.toSvg(8), w: w + 2, h: h + 2, gx: gx + 1, gy: gy + 1, glow: glowAt && { ...glowAt, x: glowAt.x + 1, y: glowAt.y + 1 } };
}

const longsword = (blade: Ramp, guard: Ramp): WeaponArt =>
  weapon(8, 30, (p, s) => {
    p.paint(s().poly([[3, 22], [3, 3], [4, 0], [5, 3], [5, 22]], X).rect(3, 3, 5, 21, X), blade, { shade: 1 });
    p.vline(4, 4, 19, blade[0]);
    p.paint(s().rect(1, 22, 7, 23, X), guard);
    p.paint(s().rect(3, 24, 5, 28, X), DARK_LEATHER);
    p.dots([[3, 25], [4, 26], [5, 27]], DARK_LEATHER[0]);
    p.paint(s().ellipse(4, 29.5, 1.2, 1, X), guard);
  }, 4, 26);

export const WEAPON_ART: Record<string, () => WeaponArt> = {
  greatsword: () => longsword(STEEL, GOLD),
  tank_greatsword: () =>
    weapon(12, 35, (p, s) => {
      p.paint(s().poly([[2, 25], [2, 5], [5.5, 0], [9, 5], [9, 25]], X).dots([[1, 10], [1, 16], [10, 12], [10, 19]], X), DARK_STEEL, { shade: 2 });
      p.vline(5, 4, 22, '#ff4a3a').vline(6, 4, 22, '#9a1c24').dots([[5, 8], [5, 14], [5, 20]], '#ffd27a');
      p.paint(s().rect(0, 25, 11, 26, X).dots([[0, 24], [11, 24]], X), DARKER_STEEL);
      p.paint(s().rect(4, 27, 7, 31, X), DARK_LEATHER);
      p.paint(s().poly([[5.5, 32], [7, 33], [5.5, 34.5], [4, 33]], X), RED);
    }, 5.5, 29),
  battleaxe: () =>
    weapon(15, 32, (p, s) => {
      p.paint(s().rect(7, 2, 8, 31, X), WOOD);
      p.paint(s().poly([[7, 4], [2, 1], [0.5, 6], [2, 12], [7, 9]], X), STEEL, { shade: 1 });
      p.paint(s().poly([[8, 4], [13, 1], [14.5, 6], [13, 12], [8, 9]], X), STEEL, { shade: 1 });
      p.paint(s().poly([[7, 3], [7.5, 0], [8, 3]], X), STEEL);
      p.paint(s().rect(6, 4, 9, 8, X), DARK_STEEL);
      p.paint(s().rect(7, 24, 8, 30, X), DARK_LEATHER, { hi: false });
    }, 7.5, 27),
  sword_shield: () =>
    weapon(8, 20, (p, s) => {
      p.paint(s().poly([[3, 13], [3, 2], [4, 0], [5, 2], [5, 13]], X).rect(3, 2, 5, 13, X), STEEL);
      p.vline(4, 3, 12, '#ffffff');
      p.paint(s().rect(0, 14, 8, 15, X), GOLD);
      p.paint(s().rect(3, 16, 5, 18, X), DARK_LEATHER);
      p.paint(s().rect(4, 19, 4, 19, X), GOLD);
    }, 4, 17),
  staff: () =>
    weapon(9, 37, (p, s) => {
      p.paint(s().rect(4, 8, 5, 36, X), WOOD);
      p.paint(s().rect(3, 26, 6, 29, X), DARK_LEATHER, { hi: false });
      p.paint(s().ellipse(4.5, 4.5, 2.6, 2.6, X), ['#effff8', '#72e2bc', '#2e9a7a'], { shade: 2 });
      p.set(3, 3, '#ffffff');
      p.paint(s().dots([[1, 3], [1, 4], [1, 5], [1, 6], [2, 7], [2, 8], [3, 8], [8, 3], [8, 4], [8, 5], [8, 6], [7, 7], [7, 8], [6, 8], [2, 1], [7, 1], [4, 9], [5, 9]], X), GOLD, { line: false });
    }, 4.5, 24, { x: 4.5, y: 4.5, r: 4.5, color: '#62f0b8' }),
  mystic_sword: () =>
    weapon(8, 24, (p, s) => {
      p.paint(s().poly([[3, 16], [3, 3], [4, 0], [5, 3], [5, 16]], X).rect(3, 3, 5, 16, X), ['#fbf0ff', '#c68ef2', '#7a42c0']);
      p.dots([[4, 5], [4, 9], [4, 13]], '#ffffff');
      p.paint(s().rect(0, 17, 8, 18, X), DARK_STEEL);
      p.set(4, 17, '#e05cff');
      p.paint(s().rect(3, 19, 5, 22, X), ['#5a4a7a', '#3a2c58', '#241a3a']);
      p.paint(s().rect(4, 23, 4, 23, X), ['#f0b0ff', '#c060f0', '#7a2aa8']);
    }, 4, 21, { x: 4, y: 8, r: 9, color: '#c77dff' }),
  bow: () =>
    weapon(26, 9, (p, s) => {
      const limb = s();
      for (let x = 0; x <= 25; x++) {
        const t = (x - 12.5) / 12.5;
        const y = 2 + Math.round(5 * t * t);
        limb.rect(x, y, x, y + (Math.abs(t) < 0.75 ? 1 : 0), X);
      }
      limb.dots([[0, 6], [0, 7], [25, 6], [25, 7]], X);
      p.paint(limb, WOOD, { bottom: false });
      p.paint(s().rect(11, 2, 14, 4, X), DARK_LEATHER, { line: false });
      p.dots([[1, 6], [24, 6]], GOLD[1]);
    }, 12.5, 3, undefined, (p) => p.hline(2, 25, 9, '#efe9d8')),
  crossbow: () =>
    weapon(15, 18, (p, s) => {
      p.paint(s().rect(6, 3, 8, 17, X), WOOD, { shade: 1 });
      const prod = s();
      for (let x = 0; x <= 14; x++) {
        const t = (x - 7) / 7;
        prod.set(x, 3 + Math.round(3 * t * t), X);
      }
      p.paint(prod, STEEL, { hi: false, bottom: false });
      p.paint(s().rect(7, 0, 7, 8, X), DARK_STEEL, { line: false });
      p.set(7, 0, STEEL[0]);
      p.paint(s().rect(6, 12, 8, 13, X), DARK_STEEL);
    }, 7, 15, undefined, (p) => p.line(2, 8, 8, 10, '#efe9d8').line(8, 10, 14, 8, '#efe9d8')),
  spear: () =>
    weapon(7, 41, (p, s) => {
      p.paint(s().rect(3, 9, 4, 40, X), WOOD, { shade: 1 });
      p.paint(s().poly([[3.5, 0], [6, 4], [4.5, 8.5], [2.5, 8.5], [1, 4]], X), STEEL, { shade: 1 });
      p.vline(3, 2, 7, '#ffffff');
      p.paint(s().rect(2, 9, 5, 11, X).dots([[2, 12], [4, 13], [5, 12]], X), RED, { line: false });
    }, 3.5, 30),
  lance: () =>
    weapon(11, 43, (p, s) => {
      p.paint(s().poly([[5.5, 0], [9, 31], [2, 31]], X), STEEL, { shade: 2 });
      for (const y of [10, 18, 25]) p.line(3, y + 2, 8, y - 1, GOLD[1]);
      p.paint(s().ellipse(5.5, 32, 5.2, 1.8, X), GOLD, { shade: 2 });
      p.paint(s().rect(4, 34, 7, 41, X), DARK_LEATHER);
      p.paint(s().ellipse(5.5, 42, 1.8, 1, X), DARK_STEEL);
    }, 5.5, 37),
};

/** The Guardian's heater shield, carried on the back arm. */
export function shieldArt(): WeaponArt {
  return weapon(14, 16, (p, s) => {
    p.paint(s().poly([[0, 0], [13, 0], [13, 7], [6.5, 15], [0, 7]], X), GOLD, { shade: 1 });
    p.paint(s().poly([[1.5, 1.5], [11.5, 1.5], [11.5, 6.5], [6.5, 12.5], [1.5, 6.5]], X), STEEL, { shade: 2, line: false });
    p.rect(6, 2, 7, 11, RED[1]).rect(2, 4, 11, 5, RED[1]).set(6, 2, RED[0]).set(2, 4, RED[0]);
  }, 6.5, 6);
}
