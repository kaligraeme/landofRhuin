/**
 * The Guardian as a chibi hero: her design (design.ts) and moves (moves-core.ts, moves-skills.ts,
 * moves-states.ts) put together with her clip timing, frame boxes and scale. Registered in
 * ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { GUARDIAN } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * Her clip timing (frame counts match her moves files). Her weapon skills: `special` Aegis, `q`
 * Flash, `e` Mend, `r` Shield's Up!, `ult` Luminaire; `cast` her role skills and the Elixir.
 * Aegis holds the shield up for the two seconds it lasts. Shield's Up! braces for the server's
 * three seconds: its nine frames after the wind-up take 3.8 s, so the burst (the ninth frame)
 * shows from 3.0 s, when the server's lands. Luminaire's three wind-up frames stretch over the
 * server's 0.6 s wind-up, so the light bursts out as the blow lands.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.7, windup: 0 },
  battle: { frames: 8, seconds: 0.9, windup: 0 },
  move: { frames: 8, seconds: 0.6, windup: 0 },
  atk1: { frames: 7, seconds: 0.38, windup: 1 },
  atk2: { frames: 7, seconds: 0.38, windup: 1 },
  atk3: { frames: 9, seconds: 0.62, windup: 2 },
  special: { frames: 6, seconds: 1.9, windup: 1 },
  q: { frames: 8, seconds: 0.45, windup: 1 },
  e: { frames: 10, seconds: 1, windup: 1 },
  r: { frames: 10, seconds: 3.8, windup: 1 },
  ult: { frames: 14, seconds: 1.3, windup: 3 },
  cast: { frames: 8, seconds: 0.7, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of her for the sword's reach and the shield's bash, and
 * behind for the cape, the afterimages of her dash and Luminaire's rays; toward and away from the
 * viewer she stands centred, with room either side for the rays and the light flooding over the
 * floor, which rolls out toward the viewer below the ground point. The game crops every frame to
 * what is painted, so the spare room costs nothing there. She stands about 82 px tall, 2.1 tiles
 * per 84 px as the Dark Knight, so she stands a little shorter than him in game.
 */
export const GUARDIAN_HERO: ChibiHero = chibiHero(
  GUARDIAN,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 256, h: 232, ax: 120, ay: 176 },
    front: { w: 224, h: 232, ax: 112, ay: 172 },
    back: { w: 224, h: 232, ax: 112, ay: 172 },
  },
  2.1 / 84,
  82,
);
