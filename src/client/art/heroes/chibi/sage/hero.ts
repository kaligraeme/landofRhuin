/**
 * The Sage as a chibi hero: his design (design.ts) and moves (moves-core.ts, moves-skills.ts,
 * moves-states.ts) put together with his clip timing, frame boxes and scale. Registered in
 * ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { SAGE } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * His clip timing (frame counts match his moves files). His bolts fly every 0.55 s, so each plays
 * out in about that, its wind-up included. His weapon skills: `special` Mending Light (a 0.4 s
 * wind-up on the server, which its two wind-up frames stretch over), `q` Arcane Orb, `e`
 * Sanctuary, `r` Meteor (which lands 1.1 s after the cast, as the clip's fire reaches the floor),
 * `ult` Resurrection (a 1.5 s chant on the server, which its eight wind-up frames stretch over);
 * `cast` his role skills and the Elixir. The others have no server wind-up, so their wind-up
 * frames take 0.06 s each. He is old: his stances loop slowly.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 2.2, windup: 0 },
  battle: { frames: 8, seconds: 1.2, windup: 0 },
  move: { frames: 8, seconds: 0.64, windup: 0 },
  atk1: { frames: 7, seconds: 0.42, windup: 1 },
  atk2: { frames: 7, seconds: 0.42, windup: 1 },
  atk3: { frames: 9, seconds: 0.44, windup: 2 },
  special: { frames: 7, seconds: 0.55, windup: 2 },
  q: { frames: 8, seconds: 0.5, windup: 2 },
  e: { frames: 10, seconds: 0.8, windup: 2 },
  r: { frames: 10, seconds: 0.9, windup: 2 },
  ult: { frames: 16, seconds: 1, windup: 8 },
  cast: { frames: 8, seconds: 0.6, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.8, windup: 0 },
  ko: { frames: 6, seconds: 1, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of him for the staff held out and the bolts, orbs and fire
 * that leave it, and behind for the staff swung back; toward and away from the viewer he stands
 * centred. All are tall enough for the staff raised high and the pillar of light over him, and
 * deep enough below the ground point for the rings and ripples that roll out over the floor
 * toward the viewer. The game crops every frame to what is painted, so the spare room costs
 * nothing there. He stands about 80 px tall (2 tiles in game, at the Dark Knight's scale); his
 * staff's orb rises well above him, to about 97 px at rest, which is what `height` measures.
 */
export const SAGE_HERO: ChibiHero = chibiHero(
  SAGE,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 320, h: 288, ax: 128, ay: 216 },
    front: { w: 256, h: 288, ax: 128, ay: 208 },
    back: { w: 256, h: 288, ax: 128, ay: 208 },
  },
  2.1 / 84,
  97,
);
