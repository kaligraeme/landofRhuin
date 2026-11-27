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
 * Frames: side on there is room ahead of him for the point of his thrusts and the spiral of energy
 * off it, and behind for the lance trailing as he runs, the cape, the ponytail and the afterimages
 * of his charge; toward and away from the viewer he stands centred, with room either side for the
 * lance on his shoulder and his sweeps. All are tall enough for the dive of his jump to come back
 * in at the top (his launch takes him out of the top of every frame for two frames, leaving only
 * the beam he rose on) and deep enough below the ground point for the rings, which roll out toward
 * the viewer. The game crops every frame to what is painted, so the spare room costs nothing there.
 * He stands about 84 px tall at ease from the top of his helm to his soles (nothing on the helm
 * rises above its crown): 2.1 tiles per 84 px, as the Dark Knight.
 */
export const DRAGOON_HERO: ChibiHero = chibiHero(
  DRAGOON,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 306, h: 238, ax: 110, ay: 192 },
    front: { w: 184, h: 238, ax: 92, ay: 193 },
    back: { w: 184, h: 238, ax: 92, ay: 193 },
  },
  2.1 / 84,
  84,
);
