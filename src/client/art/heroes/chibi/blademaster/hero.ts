/**
 * The Blademaster as a chibi hero: her design (design.ts) and moves (moves-core.ts, moves-skills.ts,
 * moves-states.ts) put together with her clip timing, frame boxes and scale. Registered in
 * ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { BLADEMASTER } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * Her clip timing (frame counts match her moves files). Her weapon skills: `special` Rising
 * Slash, `q` Whirlwind, `e` Blademaster's Lunge, `r` Executioner (its three wind-up frames stretch
 * over the server's 0.4 s wind-up), `ult` Cataclysm Blades (four wind-up frames over its 0.6 s);
 * `cast` her role skills (Bloodrush, Second Wind) and the Elixir.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.8, windup: 0 },
  battle: { frames: 8, seconds: 0.8, windup: 0 },
  move: { frames: 8, seconds: 0.5, windup: 0 },
  atk1: { frames: 7, seconds: 0.38, windup: 1 },
  atk2: { frames: 7, seconds: 0.38, windup: 1 },
  atk3: { frames: 9, seconds: 0.6, windup: 2 },
  special: { frames: 7, seconds: 0.55, windup: 1 },
  q: { frames: 10, seconds: 0.7, windup: 1 },
  e: { frames: 8, seconds: 0.45, windup: 1 },
  r: { frames: 10, seconds: 0.55, windup: 3 },
  ult: { frames: 14, seconds: 1, windup: 4 },
  cast: { frames: 8, seconds: 0.6, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of her for the blades and her lunge, behind for her
 * coat-tails, and all round for the whirlwinds of Whirlwind and Cataclysm Blades; toward and away
 * from the viewer she stands centred. All are tall enough for the whirlwinds and Rising Slash's
 * hop. The game crops every frame to what is painted, so the spare room costs nothing there. She
 * stands about 80 px tall: at the Dark Knight's 2.1 tiles per 84 px, 2 tiles in game.
 */
export const BLADEMASTER_HERO: ChibiHero = chibiHero(
  BLADEMASTER,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 256, h: 232, ax: 120, ay: 180 },
    front: { w: 224, h: 240, ax: 112, ay: 172 },
    back: { w: 224, h: 240, ax: 112, ay: 172 },
  },
  2.1 / 84,
  80,
);
