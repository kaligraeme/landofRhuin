/**
 * Chibi heroes: big-headed pixel heroes painted frame by frame from a 3D rig, seen side on (a
 * three-quarter view facing right), toward the viewer and away from them, with a full set of
 * clips: stances, a three-hit combo, a clip per weapon skill, guarding, flinching, kneeling at low
 * health, falling when knocked out and a victory flourish.
 *
 * This file is the contract between the painter (which fills in `CHIBI_HEROES`) and the game
 * (sprites.ts and the renderer, which build atlases from `paint` and pick clips by `timing`).
 *
 * The engine: rig.ts (the pose format, the 3D skeleton and the camera), raster.ts (the part
 * painter: four-tone shading and coloured inner lines over paint.ts's Canvas), design.ts (what a
 * design file fills in), head.ts (heads, face styles, locks and long hair: curtains, locks over
 * the shoulders, ponytails; beards, moustaches, buns and updos), headgear.ts (gear worn on the
 * head: a hood worn up or down, an open-faced helm with cheek guards, scales and fins, a
 * circlet), pieces.ts (pauldrons, collars and gorgets, skirts, coats and robes, capes, cowls,
 * scarves, and the strands cloth and hair hang as), back.ts (straps and bandoliers, a quiver,
 * anything slung on the back), armour.ts (patterns such as scales), the held items (blade.ts
 * bladed weapons, straight or curved, pole.ts pole arms and staves, wand.ts wands, shield.ts
 * shields strapped to the forearm, bow.ts bows and arrows, crossbow.ts crossbows, held.ts what
 * they share; a design may also give one for the off hand), fx.ts (effects) and painter.ts (puts
 * a frame together). Every hero is a chibi, and so is the form the Flame Warden takes (the
 * Firebeast). Each has a folder of its own: a design file, its moves files and a hero file that
 * puts them together with its timing (see darkKnight/ for the first of them), registered below;
 * a few keep pieces and effects of their own beside them (arbalest/gear.ts and effects.ts,
 * flameWarden/fire.ts, firebeast/fire.ts).
 */
import type { Raster } from '../paint.js';
import { ARBALEST_HERO } from './arbalest/hero.js';
import { BLADEMASTER_HERO } from './blademaster/hero.js';
import { BOWMASTER_HERO } from './bowmaster/hero.js';
import { DARK_KNIGHT_HERO } from './darkKnight/hero.js';
import type { ChibiDesign } from './design.js';
import { DRAGOON_HERO } from './dragoon/hero.js';
import { FIREBEAST_HERO } from './firebeast/hero.js';
import { FLAME_WARDEN_HERO } from './flameWarden/hero.js';
import { GUARDIAN_HERO } from './guardian/hero.js';
import type { ChibiPose, ChibiView } from './rig.js';
import { SAGE_HERO } from './sage/hero.js';
import { SPELLBLADE_HERO } from './spellblade/hero.js';

export type { ChibiView } from './rig.js';

export const CHIBI_VIEWS: readonly ChibiView[] = ['side', 'front', 'back'];

/**
 * Every chibi hero has all of these clips. The weapon skills' clips are named after the hotbar
 * slot of the skill that plays them (see SLOT_CLIPS), so every hero shares one list whatever its
 * weapon's skills are called.
 */
export const CHIBI_CLIPS = [
  'idle',
  'battle',
  'move',
  'atk1',
  'atk2',
  'atk3',
  'special',
  'q',
  'e',
  'r',
  'ult',
  'cast',
  'hurt',
  'kneel',
  'ko',
  'victory',
] as const;
export type ChibiClip = (typeof CHIBI_CLIPS)[number];

/**
 * How long a clip takes. How it plays is fixed by the game for each clip (game/chibiState.ts):
 * idle, battle and kneel loop every `seconds`; move advances with the distance run; ko and victory
 * play through once and hold their last frame; the rest (the combo, the skills and the flinch)
 * play once and give way to whatever the hero is doing.
 *
 * `windup` frames at the start of an attack or skill cover a wind-up the server times (the `d` of
 * the act event): they are stretched over it, and the rest plays in `seconds`. With no server
 * wind-up they take `windup * 0.06` seconds.
 */
export interface ClipTiming {
  frames: number;
  seconds: number;
  windup: number;
}

export interface FrameBox {
  w: number;
  h: number;
  /** The point on the ground under the feet. */
  ax: number;
  ay: number;
}

export interface ChibiHero {
  id: string;
  /** Frame size and the ground point under the feet, per view (every frame of a view shares them). */
  frame: Record<ChibiView, FrameBox>;
  /** Tiles per frame pixel in game. */
  scale: number;
  /**
   * How tall it stands, from the top of its hair to its soles, in frame pixels (about 84 for the
   * Dark Knight; `height * scale` tiles in game). test/chibi.test.ts checks its first idle frame
   * side on against it.
   */
  height: number;
  timing: Record<ChibiClip, ClipTiming>;
  /** Paints one frame. Pure: the same arguments always give the same pixels. */
  paint(clip: ChibiClip, frame: number, view: ChibiView): Raster;
  /** Its design and its poses clip by clip, for tools and tests (to paint a frame without its effects, say); the game only calls `paint`. */
  design: ChibiDesign;
  poses: Record<ChibiClip, readonly ChibiPose[]>;
}

/**
 * The weapon skills' clips, named after their hotbar slots (SkillDef.slot in classes.ts): every
 * weapon has one skill in each, so a skill plays the clip of its slot. Role skills and items (the
 * Elixir) play `cast`.
 */
export const SLOT_CLIPS: readonly ChibiClip[] = ['special', 'q', 'e', 'r', 'ult'];

/** The basic attack's hits in order (the act event's chain index picks one). */
export const COMBO_CLIPS: readonly ChibiClip[] = ['atk1', 'atk2', 'atk3'];

/**
 * Every hero, and every form a hero takes, by sprite id (`hero-` and the name in kebab case: see
 * heroArt.ts), in the roster's order: the Tanks, the Mages, the Rangers, the Duelists, then the
 * forms (the Flame Warden's Firebeast).
 */
export const CHIBI_HEROES: Partial<Record<string, ChibiHero>> = {
  'hero-dark-knight': DARK_KNIGHT_HERO,
  'hero-guardian': GUARDIAN_HERO,
  'hero-sage': SAGE_HERO,
  'hero-spellblade': SPELLBLADE_HERO,
  'hero-arbalest': ARBALEST_HERO,
  'hero-bowmaster': BOWMASTER_HERO,
  'hero-dragoon': DRAGOON_HERO,
  'hero-blademaster': BLADEMASTER_HERO,
  'hero-flame-warden': FLAME_WARDEN_HERO,
  'hero-firebeast': FIREBEAST_HERO,
};
