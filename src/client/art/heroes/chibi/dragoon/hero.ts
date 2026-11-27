/**
 * The Dragoon as a chibi hero: his design (design.ts) and moves (moves-core.ts,
 * moves-skills.ts, moves-states.ts) put together with his clip timing, frame boxes and scale.
 * Registered in ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { DRAGOON } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * His clip timing (frame counts match his moves files). His basic attack strikes every 0.5 s, so
 * each thrust plays out in about that, wind-up included. His weapon skills: `special` Sweeping
 * Strike, `q` Piercing Thrust, `e` Vault Strike, `r` Whirling Lance, `ult` Skewer; `cast` his
 * role skills and the Elixir. None has a server wind-up, so wind-up frames take 0.06 s each.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.8, windup: 0 },
  battle: { frames: 8, seconds: 0.8, windup: 0 },
  move: { frames: 8, seconds: 0.56, windup: 0 },
  atk1: { frames: 7, seconds: 0.34, windup: 1 },
  atk2: { frames: 7, seconds: 0.34, windup: 1 },
  atk3: { frames: 9, seconds: 0.38, windup: 2 },
  special: { frames: 7, seconds: 0.42, windup: 1 },
  q: { frames: 8, seconds: 0.45, windup: 2 },
  e: { frames: 11, seconds: 0.75, windup: 1 },
  r: { frames: 10, seconds: 0.6, windup: 1 },
  ult: { frames: 12, seconds: 0.75, windup: 2 },
  cast: { frames: 8, seconds: 0.6, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of him for the point of his thrusts and the drill of wind
 * off it, and behind for the halberd trailing as he runs, the scarf tails, the ponytail and the
 * afterimages of his charge; toward and away from the viewer he stands centred, with room either
 * side for the halberd on his shoulder and his sweeps. All are tall enough for the vault
 * (the point about 130 px up) and deep enough below the ground point for the shockwaves, which
 * roll out toward the viewer. The game crops every frame to what is painted, so the spare room
 * costs nothing there. He stands about 85 px tall at ease (87 standing straight): 2.1 tiles per 84
 * px, as the Dark Knight, so he stands a little taller in game.
 */
export const DRAGOON_HERO: ChibiHero = chibiHero(
  DRAGOON,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 384, h: 256, ax: 160, ay: 196 },
    front: { w: 256, h: 256, ax: 128, ay: 188 },
    back: { w: 256, h: 256, ax: 128, ay: 188 },
  },
  2.1 / 84,
  85,
);
