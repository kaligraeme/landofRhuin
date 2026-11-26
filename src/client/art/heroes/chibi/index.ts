/**
 * Chibi heroes: big-headed pixel heroes painted frame by frame from a 3D rig, seen side on (a
 * three-quarter view facing right), toward the viewer and away from them, with a full set of
 * clips: stances, a three-hit combo, a clip per weapon skill, guarding, flinching, kneeling at low
 * health, falling when knocked out and a victory flourish.
 *
 * This file is the contract between the painter (which fills in `CHIBI_HEROES`) and the game
 * (sprites.ts and the renderer, which build atlases from `paint` and pick clips by `timing`).
 *
 * STUB: until the chibi painter lands, the Dark Knight is drawn with the old skeleton painter,
 * each chibi clip borrowing the nearest old clip, so the game side can be built and tested.
 */
import type { Raster } from '../paint.js';
import { HERO_DESIGNS } from '../designs.js';
import { heroClips, type HeroClip } from '../moves.js';
import { renderHero } from '../render.js';
import { ANCHOR_X, FRAME_H, FRAME_W, GROUND_Y } from '../skeleton.js';
import { renderTurned, TURNED_H, TURNED_W, TURNED_X, TURNED_Y } from '../turned.js';

export type ChibiView = 'side' | 'front' | 'back';
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

// ── STUB (replaced by the chibi painter) ──────────────────────────────────────────────────────

const STUB_TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 6, mode: 'loop', seconds: 1.6, windup: 0 },
  battle: { frames: 6, mode: 'loop', seconds: 0.9, windup: 0 },
  move: { frames: 8, mode: 'loop', seconds: 0.6, windup: 0 },
  atk1: { frames: 8, mode: 'once', seconds: 0.4, windup: 2 },
  atk2: { frames: 8, mode: 'once', seconds: 0.4, windup: 2 },
  atk3: { frames: 8, mode: 'once', seconds: 0.5, windup: 2 },
  guard: { frames: 6, mode: 'once', seconds: 1, windup: 0 },
  hurt: { frames: 3, mode: 'once', seconds: 0.3, windup: 0 },
  kneel: { frames: 6, mode: 'loop', seconds: 1.6, windup: 0 },
  ko: { frames: 6, mode: 'hold', seconds: 0.9, windup: 0 },
  victory: { frames: 6, mode: 'hold', seconds: 1.6, windup: 0 },
  cast: { frames: 10, mode: 'once', seconds: 0.7, windup: 3 },
  charge: { frames: 10, mode: 'once', seconds: 0.45, windup: 3 },
  eclipse: { frames: 10, mode: 'once', seconds: 0.55, windup: 3 },
  drain: { frames: 10, mode: 'once', seconds: 0.8, windup: 3 },
  ruination: { frames: 10, mode: 'once', seconds: 1.5, windup: 3 },
};

const STUB_FROM: Record<ChibiClip, HeroClip> = {
  idle: 'idle',
  battle: 'battle',
  move: 'move',
  atk1: 'action',
  atk2: 'action',
  atk3: 'action',
  guard: 'battle',
  hurt: 'battle',
  kneel: 'battle',
  ko: 'idle',
  victory: 'idle',
  cast: 'skill',
  charge: 'skill',
  eclipse: 'skill',
  drain: 'skill',
  ruination: 'skill',
};

const stubDesign = HERO_DESIGNS['hero-tank-male'];
const stubClips = heroClips(stubDesign.moveset);

/** The stub Dark Knight (not registered: the game keeps the old painter until the chibi one lands). */
export const stubDarkKnight: ChibiHero = {
  id: 'hero-tank-male',
  frame: {
    side: { w: FRAME_W, h: FRAME_H, ax: ANCHOR_X, ay: GROUND_Y },
    front: { w: TURNED_W, h: TURNED_H, ax: TURNED_X, ay: TURNED_Y },
    back: { w: TURNED_W, h: TURNED_H, ax: TURNED_X, ay: TURNED_Y },
  },
  scale: 2.17 / 96,
  timing: STUB_TIMING,
  paint(clip, frame, view) {
    const old = STUB_FROM[clip];
    const poses = stubClips[old];
    const pose = poses[Math.min(frame, poses.length - 1)]!;
    if (view === 'side') return renderHero(stubDesign, pose, null);
    return renderTurned(stubDesign, pose, view, old === 'action' || old === 'skill');
  },
};

/** The heroes drawn by the chibi painter, by sprite id. Others use the older painter. */
export const CHIBI_HEROES: Partial<Record<string, ChibiHero>> = {};
