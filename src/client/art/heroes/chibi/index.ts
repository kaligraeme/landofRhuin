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
 * painter.ts (puts a frame together). A hero is a design file (darkKnight.ts) and its moves
 * (moves-core.ts, moves-skills.ts, moves-states.ts), registered below.
 */
import type { Raster } from '../paint.js';
import { DARK_KNIGHT } from './darkKnight.js';
import { CORE_CLIPS } from './moves-core.js';
import { SKILL_CLIPS_DK } from './moves-skills.js';
import { STATE_CLIPS } from './moves-states.js';
import { chibiHero } from './painter.js';
import type { ChibiView } from './rig.js';

export type { ChibiView } from './rig.js';

export const CHIBI_VIEWS: readonly ChibiView[] = ['side', 'front', 'back'];

export const CHIBI_CLIPS = [
  'idle',
  'battle',
  'move',
  'atk1',
  'atk2',
  'atk3',
  'guard',
  'hurt',
  'kneel',
  'ko',
  'victory',
  'cast',
  'charge',
  'eclipse',
  'drain',
  'ruination',
] as const;
export type ChibiClip = (typeof CHIBI_CLIPS)[number];

/**
 * How a clip plays.
 *  - loop: cycles every `seconds` (idle, battle, kneel); `move` instead advances with distance run.
 *  - once: plays through in `seconds` after any wind-up, then the hero returns to a stance.
 *  - hold: plays through in `seconds`, then holds its last frame (ko, victory).
 * `windup` frames at the start cover a wind-up the server times (the `d` of the act event); they
 * are stretched over it, and the rest plays in `seconds`. With no server wind-up they take
 * `windup * 0.06` seconds.
 */
export interface ClipTiming {
  frames: number;
  mode: 'loop' | 'once' | 'hold';
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

/** Which clip a skill plays, by skill id; any other skill (role skills) plays `cast`. */
export const SKILL_CLIPS: Readonly<Record<string, ChibiClip>> = {
  parry: 'guard',
  stalwartCharge: 'charge',
  eclipse: 'eclipse',
  drain: 'drain',
  ruination: 'ruination',
};

/** The basic attack's hits in order (the act event's chain index picks one). */
export const COMBO_CLIPS: readonly ChibiClip[] = ['atk1', 'atk2', 'atk3'];

// ── The heroes ───────────────────────────────────────────────────────────────────────────────

/** The Dark Knight's clip timing (frame counts match his moves files). */
const DARK_KNIGHT_TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 6, mode: 'loop', seconds: 1.6, windup: 0 },
  battle: { frames: 6, mode: 'loop', seconds: 0.9, windup: 0 },
  move: { frames: 8, mode: 'loop', seconds: 0.6, windup: 0 },
  atk1: { frames: 7, mode: 'once', seconds: 0.36, windup: 1 },
  atk2: { frames: 7, mode: 'once', seconds: 0.36, windup: 1 },
  atk3: { frames: 9, mode: 'once', seconds: 0.62, windup: 2 },
  guard: { frames: 4, mode: 'once', seconds: 1, windup: 0 },
  hurt: { frames: 3, mode: 'once', seconds: 0.3, windup: 0 },
  kneel: { frames: 4, mode: 'loop', seconds: 1.6, windup: 0 },
  ko: { frames: 6, mode: 'hold', seconds: 0.9, windup: 0 },
  victory: { frames: 8, mode: 'hold', seconds: 1.6, windup: 0 },
  cast: { frames: 8, mode: 'once', seconds: 0.6, windup: 2 },
  charge: { frames: 8, mode: 'once', seconds: 0.45, windup: 1 },
  eclipse: { frames: 10, mode: 'once', seconds: 0.55, windup: 1 },
  drain: { frames: 10, mode: 'once', seconds: 0.8, windup: 2 },
  ruination: { frames: 16, mode: 'once', seconds: 1.5, windup: 2 },
};

/**
 * Frames: side on there is room ahead of him for the blade and behind for his coat tails; toward
 * and away from the viewer he stands centred with room below for blows swung toward the viewer.
 * Both are tall enough for Ruination's leap. He stands about 84 px tall, 2.1 tiles in game.
 */
export const DARK_KNIGHT_HERO: ChibiHero = chibiHero(DARK_KNIGHT, { ...CORE_CLIPS, ...SKILL_CLIPS_DK, ...STATE_CLIPS }, DARK_KNIGHT_TIMING, {
  side: { w: 240, h: 208, ax: 104, ay: 180 },
  front: { w: 224, h: 208, ax: 112, ay: 172 },
  back: { w: 224, h: 208, ax: 112, ay: 172 },
}, 2.1 / 84);

/** The heroes drawn by the chibi painter, by sprite id. Others use the older painter. */
export const CHIBI_HEROES: Partial<Record<string, ChibiHero>> = {
  'hero-tank-male': DARK_KNIGHT_HERO,
};
