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
 * painter: four-tone shading and coloured inner lines over paint.ts's Canvas), head.ts (heads
 * and hair), pieces.ts (pauldrons, collars, cloth), blade.ts (bladed weapons), fx.ts (effects) and
 * painter.ts (puts a frame together). A hero has a folder of its own: a design file, its moves
 * files and a hero file that puts them together with its timing (see darkKnight/), registered
 * below.
 */
import type { Raster } from '../paint.js';
import { DARK_KNIGHT_HERO } from './darkKnight/hero.js';
import type { ChibiView } from './rig.js';

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
  timing: Record<ChibiClip, ClipTiming>;
  /** Paints one frame. Pure: the same arguments always give the same pixels. */
  paint(clip: ChibiClip, frame: number, view: ChibiView): Raster;
}

/**
 * The weapon skills' clips, named after their hotbar slots (SkillDef.slot in classes.ts): every
 * weapon has one skill in each, so a skill plays the clip of its slot. Role skills and items (the
 * Elixir) play `cast`.
 */
export const SLOT_CLIPS: readonly ChibiClip[] = ['special', 'q', 'e', 'r', 'ult'];

/** The basic attack's hits in order (the act event's chain index picks one). */
export const COMBO_CLIPS: readonly ChibiClip[] = ['atk1', 'atk2', 'atk3'];

/** The heroes drawn by the chibi painter, by sprite id. Others use the older painter. */
export const CHIBI_HEROES: Partial<Record<string, ChibiHero>> = {
  'hero-tank-male': DARK_KNIGHT_HERO,
};
