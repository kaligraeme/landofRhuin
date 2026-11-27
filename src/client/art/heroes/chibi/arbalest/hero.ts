/**
 * The Arbalest as a chibi hero: his design (design.ts, with his own gear in gear.ts) and moves
 * (moves-core.ts, moves-skills.ts, moves-states.ts, with his effects in effects.ts) put together
 * with his clip timing, frame boxes and scale. Registered in ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { ARBALEST } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * His clip timing (frame counts match his moves files). His basic attack fires every 0.36 s, so
 * each shot's clip (the wind-up frame at 0.06 s and the rest) fits inside that. His weapon skills:
 * `special` Piercing Bolt, `q` Explosive Bolt, `e` Tumble Shot, `r` Scattershot, `ult` Siege
 * Barrage; `cast` his role skills (Vault, Field Dressing) and the Elixir.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.8, windup: 0 },
  battle: { frames: 8, seconds: 1.2, windup: 0 },
  move: { frames: 8, seconds: 0.6, windup: 0 },
  atk1: { frames: 6, seconds: 0.3, windup: 1 },
  atk2: { frames: 6, seconds: 0.3, windup: 1 },
  atk3: { frames: 7, seconds: 0.36, windup: 1 },
  special: { frames: 8, seconds: 0.6, windup: 1 },
  q: { frames: 9, seconds: 0.65, windup: 2 },
  e: { frames: 9, seconds: 0.6, windup: 1 },
  r: { frames: 8, seconds: 0.6, windup: 1 },
  ult: { frames: 16, seconds: 1.45, windup: 1 },
  cast: { frames: 8, seconds: 0.8, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of him for the bolts' trails and the scattershot's cone
 * (about 150 px ahead of the ground point at most) and behind for the tumble (he rolls about
 * 30 px back); toward and away from the viewer he stands centred, with room below for a trail
 * flying at the viewer. He stands about 84 px tall, 2.1 tiles in game.
 */
export const ARBALEST_HERO: ChibiHero = chibiHero(
  ARBALEST,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 288, h: 216, ax: 112, ay: 172 },
    front: { w: 224, h: 240, ax: 112, ay: 168 },
    back: { w: 224, h: 240, ax: 112, ay: 168 },
  },
  2.1 / 84,
  84,
);
