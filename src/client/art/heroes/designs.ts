/**
 * The eight heroes: how each is dressed and armed. Faces and hair are cut from the hero artwork
 * (`head` gives the crop and the point under the chin that sits on the neck); everything else is
 * painted from these colours and shapes.
 */
import type { HeroLook, RoleId } from '../../../shared/content/classes.js';
import { hex, ramp, type Ramp, type RGB } from './paint.js';
import type { WeaponKind } from './weapons.js';

export type Moveset = 'greatsword' | 'battleaxe' | 'staff' | 'swordWand' | 'crossbow' | 'longbow' | 'halberd' | 'twinBlades';

export interface HeroDesign {
  id: `hero-${RoleId}-${HeroLook}`;
  moveset: Moveset;
  weapon: WeaponKind;
  /** The off-hand weapon, if any. */
  weapon2?: WeaponKind;
  head: { x0: number; y0: number; x1: number; y1: number; neckX: number; neckY: number };
  /** Broadness of the build (1 normal). */
  build: number;
  skin: Ramp;
  chest: Ramp;
  /** A stripe down the front (tabard, sash, robe opening). */
  front?: Ramp;
  trim: Ramp;
  belt: Ramp;
  sleeve: Ramp;
  glove: Ramp;
  pauldron?: Ramp;
  pants: Ramp;
  boot: Ramp;
  kneepad?: Ramp;
  /** Below the belt: plate tassets, a floor-length robe, a coat's tails or a short skirt. */
  skirt: { kind: 'tassets' | 'robe' | 'coat' | 'tunic'; ramp: Ramp };
  cape?: { ramp: Ramp; length: number };
  scarf?: Ramp;
  /** Long hair falling down the back. */
  hair?: { ramp: Ramp; length: number };
  quiver?: boolean;
  /** Skill glow. */
  aura: RGB;
}

const SKIN = ramp('#f6cfab', '#d8a27c', '#a26c4e');
const GOLD = ramp('#f6dc8c', '#c49a46', '#7a5a22');
const CRIMSON = ramp('#b83440', '#86202c', '#521018');
const LEATHER = ramp('#9a7452', '#684a32', '#3e2b1c');
const DARK_LEATHER = ramp('#6e503a', '#4a3424', '#2a1c12');
const BOOT = ramp('#5e4434', '#3e2c20', '#22170f');
const GREEN_CLOAK = ramp('#6e8c4c', '#4a6230', '#2c3c1c');

const WARRIOR_GOLD = hex('#ffd56b');
const MAGE_VIOLET = hex('#b98cff');
const RANGER_GREEN = hex('#8fe36f');
const DUELIST_RED = hex('#ff6f5e');

export const HERO_DESIGNS: Record<`hero-${RoleId}-${HeroLook}`, HeroDesign> = {
  'hero-tank-male': {
    id: 'hero-tank-male',
    moveset: 'greatsword',
    weapon: 'greatsword',
    head: { x0: 32, y0: 1, x1: 48, y1: 14, neckX: 40, neckY: 14 },
    build: 1.15,
    skin: SKIN,
    chest: ramp('#8c909e', '#575b69', '#32343e'),
    front: CRIMSON,
    trim: GOLD,
    belt: DARK_LEATHER,
    sleeve: ramp('#7a7e8c', '#4c505d', '#2c2e37'),
    glove: ramp('#6c707e', '#42454f', '#26282f'),
    pauldron: ramp('#9a9eac', '#5e6270', '#363844'),
    pants: ramp('#6c707e', '#44474f', '#282a30'),
    boot: ramp('#5e6270', '#3a3d46', '#22242a'),
    kneepad: ramp('#a2a6b4', '#666a78', '#3c3e48'),
    skirt: { kind: 'tassets', ramp: ramp('#80848f', '#52555f', '#2f313a') },
    cape: { ramp: CRIMSON, length: 40 },
    aura: WARRIOR_GOLD,
  },
  'hero-tank-female': {
    id: 'hero-tank-female',
    moveset: 'battleaxe',
    weapon: 'battleaxe',
    head: { x0: 27, y0: 1, x1: 47, y1: 14, neckX: 38, neckY: 14 },
    build: 1.05,
    skin: SKIN,
    chest: ramp('#cbb896', '#8e7c60', '#564a38'),
    front: CRIMSON,
    trim: GOLD,
    belt: DARK_LEATHER,
    sleeve: ramp('#b8a682', '#7e6e54', '#4c4232'),
    glove: ramp('#9a8a6c', '#66593f', '#3c3424'),
    pauldron: ramp('#d6c4a0', '#9a8868', '#5e523e'),
    pants: ramp('#9a8a6c', '#66593f', '#3c3424'),
    boot: ramp('#7a6a52', '#4e4232', '#2c251c'),
    kneepad: ramp('#d6c4a0', '#9a8868', '#5e523e'),
    skirt: { kind: 'tassets', ramp: ramp('#b8a682', '#7e6e54', '#4c4232') },
    cape: { ramp: CRIMSON, length: 38 },
    aura: WARRIOR_GOLD,
  },
  'hero-mage-male': {
    id: 'hero-mage-male',
    moveset: 'staff',
    weapon: 'branchStaff',
    head: { x0: 25, y0: 1, x1: 39, y1: 15, neckX: 33, neckY: 15 },
    build: 1,
    skin: SKIN,
    chest: ramp('#5a6cc0', '#36448c', '#1e2654'),
    front: ramp('#7a8ad0', '#4a5aa8', '#2a3470'),
    trim: GOLD,
    belt: GOLD,
    sleeve: ramp('#5a6cc0', '#36448c', '#1e2654'),
    glove: SKIN,
    pants: ramp('#4a3a46', '#30263a', '#1c1624'),
    boot: BOOT,
    skirt: { kind: 'robe', ramp: ramp('#5a6cc0', '#36448c', '#1e2654') },
    aura: MAGE_VIOLET,
  },
  'hero-mage-female': {
    id: 'hero-mage-female',
    moveset: 'swordWand',
    weapon: 'mysticSword',
    weapon2: 'wand',
    head: { x0: 23, y0: 1, x1: 42, y1: 13, neckX: 34, neckY: 13 },
    build: 0.92,
    skin: SKIN,
    chest: ramp('#8c66c8', '#5c3f96', '#35205e'),
    front: ramp('#e8e2f4', '#b6aed0', '#7c7496'),
    trim: ramp('#f2e6c0', '#c8b88a', '#7e7050'),
    belt: ramp('#f2e6c0', '#c8b88a', '#7e7050'),
    sleeve: ramp('#8c66c8', '#5c3f96', '#35205e'),
    glove: SKIN,
    pants: ramp('#4a3a56', '#30263e', '#1c1626'),
    boot: BOOT,
    skirt: { kind: 'robe', ramp: ramp('#8c66c8', '#5c3f96', '#35205e') },
    hair: { ramp: ramp('#f4f2fa', '#c8c4dc', '#8e8aa8'), length: 26 },
    aura: MAGE_VIOLET,
  },
  'hero-ranger-male': {
    id: 'hero-ranger-male',
    moveset: 'crossbow',
    weapon: 'crossbow',
    head: { x0: 24, y0: 1, x1: 42, y1: 13, neckX: 34, neckY: 13 },
    build: 1,
    skin: SKIN,
    chest: LEATHER,
    front: DARK_LEATHER,
    trim: ramp('#c8b08a', '#8a7450', '#544428'),
    belt: DARK_LEATHER,
    sleeve: ramp('#6a8a4a', '#48602e', '#2a3a1a'),
    glove: DARK_LEATHER,
    pants: ramp('#6a5a46', '#463a2c', '#2a221a'),
    boot: BOOT,
    skirt: { kind: 'coat', ramp: GREEN_CLOAK },
    cape: { ramp: GREEN_CLOAK, length: 32 },
    quiver: true,
    aura: RANGER_GREEN,
  },
  'hero-ranger-female': {
    id: 'hero-ranger-female',
    moveset: 'longbow',
    weapon: 'longbow',
    head: { x0: 20, y0: 1, x1: 40, y1: 13, neckX: 31, neckY: 13 },
    build: 0.92,
    skin: SKIN,
    chest: LEATHER,
    front: DARK_LEATHER,
    trim: ramp('#c8b08a', '#8a7450', '#544428'),
    belt: DARK_LEATHER,
    sleeve: ramp('#6a8a4a', '#48602e', '#2a3a1a'),
    glove: DARK_LEATHER,
    pants: ramp('#5e4e3e', '#3e3328', '#241e18'),
    boot: BOOT,
    skirt: { kind: 'coat', ramp: GREEN_CLOAK },
    cape: { ramp: GREEN_CLOAK, length: 30 },
    hair: { ramp: ramp('#ec9254', '#bc5e2c', '#783618'), length: 22 },
    quiver: true,
    aura: RANGER_GREEN,
  },
  'hero-melee-male': {
    id: 'hero-melee-male',
    moveset: 'halberd',
    weapon: 'halberd',
    head: { x0: 26, y0: 1, x1: 43, y1: 13, neckX: 35, neckY: 13 },
    build: 1,
    skin: SKIN,
    chest: ramp('#a47c5a', '#704e36', '#463020'),
    front: ramp('#8a6446', '#5a3e2a', '#36241a'),
    trim: ramp('#c8a070', '#8a6a44', '#523c22'),
    belt: DARK_LEATHER,
    sleeve: SKIN,
    glove: DARK_LEATHER,
    pants: ramp('#5a4a58', '#3a2e40', '#221a26'),
    boot: BOOT,
    skirt: { kind: 'tunic', ramp: ramp('#a47c5a', '#704e36', '#463020') },
    scarf: ramp('#de4a50', '#a8242e', '#64121a'),
    aura: DUELIST_RED,
  },
  'hero-melee-female': {
    id: 'hero-melee-female',
    moveset: 'twinBlades',
    weapon: 'blade',
    weapon2: 'blade',
    head: { x0: 13, y0: 1, x1: 36, y1: 14, neckX: 29, neckY: 13 },
    build: 0.92,
    skin: SKIN,
    chest: ramp('#a47c5a', '#704e36', '#463020'),
    front: ramp('#8a6446', '#5a3e2a', '#36241a'),
    trim: ramp('#c8a070', '#8a6a44', '#523c22'),
    belt: DARK_LEATHER,
    sleeve: SKIN,
    glove: DARK_LEATHER,
    pants: ramp('#5a4a58', '#3a2e40', '#221a26'),
    boot: BOOT,
    skirt: { kind: 'tunic', ramp: ramp('#a47c5a', '#704e36', '#463020') },
    scarf: ramp('#de4a50', '#a8242e', '#64121a'),
    hair: { ramp: ramp('#946446', '#643e28', '#3c2416'), length: 20 },
    aura: DUELIST_RED,
  },
};
