/** Pixel weapons point up. The renderer rotates them around the grip. */
import { Pix, type Ramp } from './pixel.js';

const X = 'x';
const GOLD: Ramp = ['#fff0a0', '#e9b843', '#a8701f'];
const STEEL: Ramp = ['#f2f6fb', '#b3bfcd', '#6d7a8e'];
const DARK_STEEL: Ramp = ['#828aa2', '#4f566c', '#30354a'];
const DARKER_STEEL: Ramp = ['#646b82', '#3c4155', '#25293a'];
const DARK_LEATHER: Ramp = ['#7c5538', '#553620', '#382213'];
const RED: Ramp = ['#ee5a52', '#bd2c38', '#7a1828'];
const WOOD: Ramp = ['#d4a46a', '#9c6e40', '#664626'];

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

/** Tiles per weapon art pixel, independent of the wielder sprite resolution. */
export const WEAPON_PIXEL = 2.18 / 48;

function weapon(w: number, h: number, draw: (p: Pix, s: () => Pix) => void, gx: number, gy: number, glowAt?: WeaponArt['glow'], after?: (p: Pix) => void): WeaponArt {
  const p = new Pix(w + 2, h + 2);
  draw(p, () => new Pix(w + 2, h + 2));
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
