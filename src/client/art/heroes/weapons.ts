/**
 * The heroes' weapons, painted fresh each frame along the hand's direction so they stay crisp at
 * any angle. Shapes are given in the weapon's own frame: u runs from the grip toward the business
 * end, v across it (positive v is the weapon's "forward" side when it points up).
 */
import { type Canvas, hex, ramp, type Ramp, type RGB } from './paint.js';
import type { Vec } from './skeleton.js';

export type WeaponKind = 'greatsword' | 'battleaxe' | 'branchStaff' | 'mysticSword' | 'wand' | 'crossbow' | 'longbow' | 'halberd' | 'blade';

interface WeaponShape {
  /** Where the second hand holds a two-handed weapon (along u), or null for one hand. */
  grip2: number | null;
  /** The cutting or striking part along u, for smears and impacts. */
  reach: [number, number];
  /** A glow at a point along u (crystal, enchanted blade, wand tip). */
  glow?: { u: number; color: RGB; r: number };
}

const STEEL = ramp('#eef1f6', '#a3abba', '#5c6372');
const DARK_STEEL = ramp('#9ca2b2', '#5e6474', '#353844');
const GOLD = ramp('#ffe9a0', '#d0a24a', '#83601f');
const WOOD = ramp('#b48a5a', '#7a5434', '#47301c');
const DARK_WOOD = ramp('#8a6a48', '#5a4028', '#33231a');
const LEATHER = ramp('#7a5a44', '#523826', '#2e1e14');
const RED_WRAP = ramp('#d0545a', '#982834', '#5a1620');

export const WEAPON_SHAPES: Record<WeaponKind, WeaponShape> = {
  greatsword: { grip2: -6, reach: [5, 50] },
  battleaxe: { grip2: -13, reach: [20, 36] },
  branchStaff: { grip2: -13, reach: [30, 42], glow: { u: 37, color: hex('#7ff5d0'), r: 7 } },
  mysticSword: { grip2: null, reach: [4, 30], glow: { u: 18, color: hex('#c98cff'), r: 9 } },
  wand: { grip2: null, reach: [6, 14], glow: { u: 14, color: hex('#ffe58a'), r: 4 } },
  crossbow: { grip2: 10, reach: [14, 24] },
  longbow: { grip2: null, reach: [0, 4] },
  halberd: { grip2: -15, reach: [26, 46] },
  blade: { grip2: null, reach: [3, 25] },
};

/** World position of a point (u, v) on a weapon held at `grip` pointing along `dir`. */
export function weaponPoint(grip: Vec, dir: Vec, u: number, v: number): Vec {
  // v runs clockwise of u: for a weapon pointing up, +v is forward.
  return [grip[0] + dir[0] * u - dir[1] * v, grip[1] + dir[1] * u + dir[0] * v];
}

function part(c: Canvas, grip: Vec, dir: Vec, pts: [number, number][], r: Ramp, shade = 1): void {
  c.paint(c.mask().poly(pts.map(([u, v]) => weaponPoint(grip, dir, u, v))), r, { shade });
}

function rod(c: Canvas, grip: Vec, dir: Vec, u0: number, u1: number, w: number, r: Ramp): void {
  const a = weaponPoint(grip, dir, u0, 0);
  const b = weaponPoint(grip, dir, u1, 0);
  c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], w, w), r);
}

/**
 * Paints a weapon. `draw` is where the bowstring hand is, for a longbow being drawn.
 */
export function paintWeapon(c: Canvas, kind: WeaponKind, grip: Vec, dir: Vec, draw?: Vec): void {
  switch (kind) {
    case 'greatsword':
      rod(c, grip, dir, -10, 2, 1.4, LEATHER);
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, -10.5, 0), 2.2, 2.2), GOLD);
      part(c, grip, dir, [[4, -3.6], [52, -2.2], [56, 0], [52, 2.4], [4, 3.6]], DARK_STEEL, 2);
      c.line(...weaponPoint(grip, dir, 6, 0.4), ...weaponPoint(grip, dir, 46, 0.4), hex('#7a1f2a'));
      c.line(...weaponPoint(grip, dir, 5, -3), ...weaponPoint(grip, dir, 50, -1.6), hex('#c3c8d4'));
      part(c, grip, dir, [[2, -7], [4.5, -7], [4.5, 7], [2, 7]], GOLD);
      break;
    case 'battleaxe':
      rod(c, grip, dir, -20, 36, 1.3, WOOD);
      for (const u of [-18, -6, 4]) c.line(...weaponPoint(grip, dir, u, -1.2), ...weaponPoint(grip, dir, u + 2, 1.2), LEATHER[2]);
      // A double-bit head: a big crescent forward, a smaller one behind.
      part(c, grip, dir, [[24, 1], [19, 9], [22, 15], [29, 16], [36, 15], [39, 9], [34, 1]], STEEL, 2);
      part(c, grip, dir, [[25, -1], [22, -7], [26, -10], [33, -10], [36, -7], [33, -1]], STEEL);
      part(c, grip, dir, [[34, -1.5], [40, 0], [34, 1.5]], STEEL);
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, 29, 0), 2.6, 2.6), GOLD);
      break;
    case 'branchStaff': {
      // A crooked branch, knotted, forking around a crystal.
      const bends: [number, number][] = [[-24, 0.5], [-12, -0.8], [0, 0.6], [12, -0.7], [24, 0.8], [31, 0]];
      for (let i = 0; i < bends.length - 1; i++) {
        const [u0, v0] = bends[i] as [number, number];
        const [u1, v1] = bends[i + 1] as [number, number];
        const a = weaponPoint(grip, dir, u0, v0);
        const b = weaponPoint(grip, dir, u1, v1);
        c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], 1.8, 1.6), WOOD);
      }
      for (const [u, v] of [[-6, -1.6], [8, 1.6], [19, -1.5]] as [number, number][]) c.paint(c.mask().ellipse(...weaponPoint(grip, dir, u, v), 1.4, 1.4), DARK_WOOD, { line: false });
      for (const side of [-1, 1]) {
        const a = weaponPoint(grip, dir, 30, 0);
        const m = weaponPoint(grip, dir, 35, side * 4.5);
        const b = weaponPoint(grip, dir, 41, side * 2);
        c.paint(c.mask().capsule(a[0], a[1], m[0], m[1], 1.3, 1.1), WOOD);
        c.paint(c.mask().capsule(m[0], m[1], b[0], b[1], 1.1, 0.8), WOOD);
      }
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, 37, 0), 3.2, 3.2), ramp('#effff9', '#6ee8c4', '#2a9a7a'), { shade: 2 });
      break;
    }
    case 'mysticSword':
      rod(c, grip, dir, -6, 1, 1.2, ramp('#6a5a8a', '#41355e', '#251d38'));
      part(c, grip, dir, [[1.5, -5], [3.5, -5], [3.5, 5], [1.5, 5]], GOLD);
      part(c, grip, dir, [[4, -2.4], [29, -1.4], [33, 0], [29, 1.6], [4, 2.4]], ramp('#fbefff', '#c897f0', '#7a46b8'), 1);
      c.line(...weaponPoint(grip, dir, 6, 0), ...weaponPoint(grip, dir, 28, 0), hex('#ffffff'));
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, -6.5, 0), 1.6, 1.6), ramp('#f0b0ff', '#c060f0', '#7a2aa8'));
      break;
    case 'wand':
      rod(c, grip, dir, -3, 12, 1, DARK_WOOD);
      part(c, grip, dir, [[12, 0], [14, -2.4], [16, 0], [14, 2.4]], GOLD);
      c.dots([weaponPoint(grip, dir, 14, 0)], hex('#ffffff'));
      break;
    case 'crossbow': {
      rod(c, grip, dir, -7, 18, 2, WOOD);
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, -7, 0), 2.6, 2.2), DARK_WOOD);
      // The prod, bowed forward, and its string.
      const tipA = weaponPoint(grip, dir, 13, -11);
      const tipB = weaponPoint(grip, dir, 13, 11);
      const mid = weaponPoint(grip, dir, 19, 0);
      c.paint(c.mask().capsule(tipA[0], tipA[1], mid[0], mid[1], 1.1, 1.6).capsule(mid[0], mid[1], tipB[0], tipB[1], 1.6, 1.1), STEEL);
      const nut = weaponPoint(grip, dir, 7, 0);
      c.line(tipA[0], tipA[1], nut[0], nut[1], hex('#e9e2cc')).line(nut[0], nut[1], tipB[0], tipB[1], hex('#e9e2cc'));
      part(c, grip, dir, [[7, -0.8], [24, -0.6], [27, 0], [24, 0.6], [7, 0.8]], DARK_STEEL);
      break;
    }
    case 'longbow': {
      // The bow stands across the aim; its limbs curve back toward the archer.
      const pts: Vec[] = [];
      for (let i = 0; i <= 12; i++) {
        const v = -25 + (50 * i) / 12;
        const u = 3 - 0.012 * v * v;
        pts.push(weaponPoint(grip, dir, u, v));
      }
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i] as Vec;
        const b = pts[i + 1] as Vec;
        const w = i === 5 || i === 6 ? 1.9 : 1.4;
        c.paint(c.mask().capsule(a[0], a[1], b[0], b[1], w, w), WOOD, { line: false });
      }
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, 3, 0), 2, 2.6), LEATHER, { line: false });
      const top = pts[0] as Vec;
      const bottom = pts[pts.length - 1] as Vec;
      const pull = draw ?? weaponPoint(grip, dir, -4.5, 0);
      c.line(top[0], top[1], pull[0], pull[1], hex('#efe7d2')).line(pull[0], pull[1], bottom[0], bottom[1], hex('#efe7d2'));
      if (draw) {
        // An arrow nocked on the string, resting on the bow hand.
        const tip = weaponPoint(grip, dir, 10, 0);
        c.line(pull[0], pull[1], tip[0], tip[1], hex('#c8b08a'));
        c.dots([tip, [tip[0] + dir[0], tip[1] + dir[1]]], hex('#dfe4ec'));
        c.dots([pull], hex('#e04a4a'));
      }
      break;
    }
    case 'halberd':
      rod(c, grip, dir, -28, 40, 1.3, DARK_WOOD);
      for (const u of [-22, -2]) c.line(...weaponPoint(grip, dir, u, -1.2), ...weaponPoint(grip, dir, u + 3, 1.2), LEATHER[0]);
      // Axe blade forward, a hook behind, a spike on top.
      part(c, grip, dir, [[27, 1], [23, 8], [26, 13], [33, 13], [38, 9], [36, 1]], STEEL, 2);
      part(c, grip, dir, [[30, -1], [31, -6], [35, -8], [34, -1]], STEEL);
      part(c, grip, dir, [[37, -1.8], [47, 0], [37, 1.8]], STEEL);
      c.paint(c.mask().ellipse(...weaponPoint(grip, dir, 31, 0), 2, 2.4), RED_WRAP);
      break;
    case 'blade':
      rod(c, grip, dir, -5, 1, 1.2, RED_WRAP);
      part(c, grip, dir, [[1.2, -3.5], [3, -3.5], [3, 3.5], [1.2, 3.5]], GOLD);
      // A gently curved blade.
      part(c, grip, dir, [[3, -2.2], [14, -2.2], [22, -0.6], [27, 1.8], [22, 2.2], [13, 2], [3, 2]], STEEL, 1);
      c.line(...weaponPoint(grip, dir, 4, -1.5), ...weaponPoint(grip, dir, 21, -0.6), hex('#ffffff'));
      break;
  }
}

/** Where along the weapon the tip is, for impacts. */
export function weaponTip(kind: WeaponKind): number {
  return WEAPON_SHAPES[kind].reach[1];
}
