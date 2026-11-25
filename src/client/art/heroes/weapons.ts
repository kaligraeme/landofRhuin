/**
 * The heroes' weapons, painted fresh each frame along the hand's direction so they stay crisp at
 * any angle. Shapes are given in the weapon's own frame: u runs from the grip toward the business
 * end, v across it (positive v is the weapon's "forward" side when it points up).
 */
import { type Canvas, hex, ramp, type Ramp, type RGB } from './paint.js';
import type { Vec } from './skeleton.js';

export type WeaponKind = 'greatsword' | 'knightSword' | 'shield' | 'branchStaff' | 'mysticSword' | 'wand' | 'crossbow' | 'longbow' | 'halberd' | 'blade';

interface WeaponShape {
  /** Where the second hand holds a two-handed weapon (along u), or null for one hand. */
  grip2: number | null;
  /** The cutting or striking part along u, for smears and impacts. */
  reach: [number, number];
  /** A glow at a point along u (crystal, enchanted blade, wand tip). */
  glow?: { u: number; color: RGB; r: number };
  /**
   * Seen from the front or back, which way the weapon's broad side faces: most show their flat
   * (an axe's bit, a crossbow's prod across); a longbow keeps its limbs in the plane of the aim.
   */
  aim?: boolean;
  /** Points a little out to the side rather than straight at the foe, seen from the front or back. */
  yaw: number;
}

const STEEL = ramp('#eef1f6', '#a3abba', '#5c6372');
const DARK_STEEL = ramp('#9ca2b2', '#5e6474', '#353844');
const GOLD = ramp('#ffe9a0', '#d0a24a', '#83601f');
const WOOD = ramp('#b48a5a', '#7a5434', '#47301c');
const DARK_WOOD = ramp('#8a6a48', '#5a4028', '#33231a');
const LEATHER = ramp('#7a5a44', '#523826', '#2e1e14');
const RED_WRAP = ramp('#d0545a', '#982834', '#5a1620');

export const WEAPON_SHAPES: Record<WeaponKind, WeaponShape> = {
  greatsword: { grip2: -6, reach: [5, 50], yaw: 38 },
  knightSword: { grip2: null, reach: [4, 33], yaw: 36 },
  shield: { grip2: null, reach: [-11, 13], yaw: 0 },
  branchStaff: { grip2: -13, reach: [30, 42], glow: { u: 37, color: hex('#7ff5d0'), r: 7 }, yaw: 24 },
  mysticSword: { grip2: null, reach: [4, 30], glow: { u: 18, color: hex('#c98cff'), r: 9 }, yaw: 36 },
  wand: { grip2: null, reach: [6, 14], glow: { u: 14, color: hex('#ffe58a'), r: 4 }, yaw: 30 },
  crossbow: { grip2: 10, reach: [14, 24], yaw: 10 },
  longbow: { grip2: null, reach: [0, 4], aim: true, yaw: 10 },
  halberd: { grip2: -15, reach: [26, 46], yaw: 34 },
  blade: { grip2: null, reach: [3, 25], yaw: 40 },
};

/**
 * World position of a point (u, v) on a weapon held at `grip` pointing along `dir`. Seen side on,
 * `dir` is a unit vector and v runs clockwise of it (for a weapon pointing up, +v is forward).
 * Turned toward or away from the viewer, `dir` shortens with the foreshortening and `across`
 * gives the v axis on screen.
 */
export function weaponPoint(grip: Vec, dir: Vec, u: number, v: number, across?: Vec): Vec {
  const ax = across ?? [-dir[1], dir[0]];
  return [grip[0] + dir[0] * u + ax[0] * v, grip[1] + dir[1] * u + ax[1] * v];
}

function part(c: Canvas, grip: Vec, dir: Vec, pts: [number, number][], r: Ramp, shade: number, across: Vec | undefined): void {
  c.paint(c.mask().poly(pts.map(([u, v]) => weaponPoint(grip, dir, u, v, across))), r, { shade });
}

function rod(c: Canvas, grip: Vec, dir: Vec, u0: number, u1: number, w: number, r: Ramp, across: Vec | undefined): void {
  const a = weaponPoint(grip, dir, u0, 0, across);
  const b = weaponPoint(grip, dir, u1, 0, across);
  c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], w, w), r);
}

/**
 * Paints a weapon. `draw` is where the bowstring hand is, for a longbow being drawn; `across`
 * is the weapon's v axis on screen when it is not seen side on (see weaponPoint).
 */
export function paintWeapon(c: Canvas, kind: WeaponKind, grip: Vec, dir: Vec, draw?: Vec, across?: Vec): void {
  const at = (u: number, v: number): Vec => weaponPoint(grip, dir, u, v, across);
  const piece = (pts: [number, number][], r: Ramp, shade = 1): void => part(c, grip, dir, pts, r, shade, across);
  const shaft = (u0: number, u1: number, w: number, r: Ramp): void => rod(c, grip, dir, u0, u1, w, r, across);
  switch (kind) {
    case 'greatsword':
      shaft(-10, 2, 1.4, LEATHER);
      c.paint(c.mask().ellipse(...at(-10.5, 0), 2.2, 2.2), GOLD);
      piece([[4, -3.6], [52, -2.2], [56, 0], [52, 2.4], [4, 3.6]], DARK_STEEL, 2);
      c.line(...at(6, 0.4), ...at(46, 0.4), hex('#7a1f2a'));
      c.line(...at(5, -3), ...at(50, -1.6), hex('#c3c8d4'));
      piece([[2, -7], [4.5, -7], [4.5, 7], [2, 7]], GOLD);
      break;
    case 'knightSword':
      // A paladin's arming sword: a broad, bright blade and a gilded cross.
      shaft(-6, 1, 1.2, LEATHER);
      c.paint(c.mask().ellipse(...at(-6.5, 0), 1.8, 1.8), GOLD);
      piece([[1.5, -6], [4, -6.5], [4, 6.5], [1.5, 6]], GOLD);
      piece([[4, -2.6], [31, -2], [35, 0], [31, 2], [4, 2.6]], STEEL, 2);
      c.line(...at(6, -1), ...at(31, -0.8), hex('#ffffff'));
      c.line(...at(5, 0.6), ...at(30, 0.5), hex('#d9b860'));
      break;
    case 'shield': {
      // A kite shield, held by its centre: white field, gold rim and a sunburst.
      const rim = ([[11, 0], [10, -5], [7, -7.5], [0, -7.5], [-6, -6], [-11, -2], [-14, 0], [-11, 2], [-6, 6], [0, 7.5], [7, 7.5], [10, 5]] as [number, number][]).map(([u, v]) => [u * 1.18, v * 1.18] as [number, number]);
      piece(rim, GOLD, 2);
      piece(rim.map(([u, v]) => [u * 0.82 - 0.8, v * 0.78] as [number, number]), ramp('#f6f3ea', '#cfd3dc', '#8a90a0'), 2);
      piece([[6, -1.1], [6, 1.1], [-11, 1.1], [-11, -1.1]], GOLD, 0);
      piece([[1, -5.5], [3.4, -5.5], [3.4, 5.5], [1, 5.5]], GOLD, 0);
      c.paint(c.mask().ellipse(...at(2, 0), 1.6, 1.6), ramp('#fff6c0', '#ffd860', '#b88a20'), { line: false });
      break;
    }
    case 'branchStaff': {
      // A crooked branch, knotted, forking around a crystal.
      const bends: [number, number][] = [[-24, 0.5], [-12, -0.8], [0, 0.6], [12, -0.7], [24, 0.8], [31, 0]];
      for (let i = 0; i < bends.length - 1; i++) {
        const [u0, v0] = bends[i] as [number, number];
        const [u1, v1] = bends[i + 1] as [number, number];
        const a = at(u0, v0);
        const b = at(u1, v1);
        c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], 1.8, 1.6), WOOD);
      }
      for (const [u, v] of [[-6, -1.6], [8, 1.6], [19, -1.5]] as [number, number][]) c.paint(c.mask().ellipse(...at(u, v), 1.4, 1.4), DARK_WOOD, { line: false });
      for (const side of [-1, 1]) {
        const a = at(30, 0);
        const m = at(35, side * 4.5);
        const b = at(41, side * 2);
        c.paint(c.mask().capsule(a[0], a[1], m[0], m[1], 1.3, 1.1), WOOD);
        c.paint(c.mask().capsule(m[0], m[1], b[0], b[1], 1.1, 0.8), WOOD);
      }
      c.paint(c.mask().ellipse(...at(37, 0), 3.2, 3.2), ramp('#effff9', '#6ee8c4', '#2a9a7a'), { shade: 2 });
      break;
    }
    case 'mysticSword':
      shaft(-6, 1, 1.2, ramp('#6a5a8a', '#41355e', '#251d38'));
      piece([[1.5, -5], [3.5, -5], [3.5, 5], [1.5, 5]], GOLD);
      piece([[4, -2.4], [29, -1.4], [33, 0], [29, 1.6], [4, 2.4]], ramp('#fbefff', '#c897f0', '#7a46b8'), 1);
      c.line(...at(6, 0), ...at(28, 0), hex('#ffffff'));
      c.paint(c.mask().ellipse(...at(-6.5, 0), 1.6, 1.6), ramp('#f0b0ff', '#c060f0', '#7a2aa8'));
      break;
    case 'wand':
      shaft(-3, 12, 1, DARK_WOOD);
      piece([[12, 0], [14, -2.4], [16, 0], [14, 2.4]], GOLD);
      c.dots([at(14, 0)], hex('#ffffff'));
      break;
    case 'crossbow': {
      shaft(-7, 18, 2, WOOD);
      c.paint(c.mask().ellipse(...at(-7, 0), 2.6, 2.2), DARK_WOOD);
      // The prod, bowed forward, and its string.
      const tipA = at(13, -11);
      const tipB = at(13, 11);
      const mid = at(19, 0);
      c.paint(c.mask().capsule(tipA[0], tipA[1], mid[0], mid[1], 1.1, 1.6).capsule(mid[0], mid[1], tipB[0], tipB[1], 1.6, 1.1), STEEL);
      const nut = at(7, 0);
      c.line(tipA[0], tipA[1], nut[0], nut[1], hex('#e9e2cc')).line(nut[0], nut[1], tipB[0], tipB[1], hex('#e9e2cc'));
      piece([[7, -0.8], [24, -0.6], [27, 0], [24, 0.6], [7, 0.8]], DARK_STEEL);
      break;
    }
    case 'longbow': {
      // The bow stands across the aim; its limbs curve back toward the archer.
      const pts: Vec[] = [];
      for (let i = 0; i <= 12; i++) {
        const v = -25 + (50 * i) / 12;
        const u = 3 - 0.012 * v * v;
        pts.push(at(u, v));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i] as Vec;
        const b = pts[i + 1] as Vec;
        const w = i === 5 || i === 6 ? 1.9 : 1.4;
        c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], w, w), WOOD, { line: false });
      }
      c.paint(c.mask().ellipse(...at(3, 0), 2, 2.6), LEATHER, { line: false });
      const top = pts[0] as Vec;
      const bottom = pts[pts.length - 1] as Vec;
      const pull = draw ?? at(-4.5, 0);
      c.line(top[0], top[1], pull[0], pull[1], hex('#efe7d2')).line(pull[0], pull[1], bottom[0], bottom[1], hex('#efe7d2'));
      if (draw) {
        // An arrow nocked on the string, resting on the bow hand.
        const tip = at(10, 0);
        c.line(pull[0], pull[1], tip[0], tip[1], hex('#c8b08a'));
        c.dots([tip, [tip[0] + dir[0], tip[1] + dir[1]]], hex('#dfe4ec'));
        c.dots([pull], hex('#e04a4a'));
      }
      break;
    }
    case 'halberd':
      shaft(-28, 40, 1.3, DARK_WOOD);
      for (const u of [-22, -2]) c.line(...at(u, -1.2), ...at(u + 3, 1.2), LEATHER[0]);
      // Axe blade forward, a hook behind, a spike on top.
      piece([[27, 1], [23, 8], [26, 13], [33, 13], [38, 9], [36, 1]], STEEL, 2);
      piece([[30, -1], [31, -6], [35, -8], [34, -1]], STEEL);
      piece([[37, -1.8], [47, 0], [37, 1.8]], STEEL);
      c.paint(c.mask().ellipse(...at(31, 0), 2, 2.4), RED_WRAP);
      break;
    case 'blade':
      shaft(-5, 1, 1.2, RED_WRAP);
      piece([[1.2, -3.5], [3, -3.5], [3, 3.5], [1.2, 3.5]], GOLD);
      // A gently curved blade.
      piece([[3, -2.2], [14, -2.2], [22, -0.6], [27, 1.8], [22, 2.2], [13, 2], [3, 2]], STEEL, 1);
      c.line(...at(4, -1.5), ...at(21, -0.6), hex('#ffffff'));
      break;
  }
}

/** Where along the weapon the tip is, for impacts. */
export function weaponTip(kind: WeaponKind): number {
  return WEAPON_SHAPES[kind].reach[1];
}
