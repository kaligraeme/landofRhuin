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
 * out in about that, its wind-up included. The server fires his bolts and the Arcane Orb at once,
 * with no wind-up, so those clips have a single wind-up frame (0.06 s) and the bolt or orb leaves
 * the staff on the frame after it, as the game draws it flying. His weapon skills: `special`
 * Mending Light (a 0.4 s wind-up on the server, which its two wind-up frames stretch over), `q`
 * Arcane Orb, `e` Sanctuary, `r` Meteor (the game draws it landing at the aim 1.1 s after the
 * cast; the clip sends its fire off toward the aim), `ult` Resurrection (a 1.5 s chant on the
 * server, which its eight wind-up frames stretch over); `cast` his role skills and the Elixir.
 * The others have no server wind-up, so their wind-up frames take 0.06 s each. He is old: his
 * stances loop slowly.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 2.2, windup: 0 },
  battle: { frames: 8, seconds: 1.2, windup: 0 },
  move: { frames: 8, seconds: 0.64, windup: 0 },
  atk1: { frames: 7, seconds: 0.42, windup: 1 },
  atk2: { frames: 7, seconds: 0.42, windup: 1 },
  atk3: { frames: 8, seconds: 0.44, windup: 1 },
  special: { frames: 7, seconds: 0.55, windup: 2 },
  q: { frames: 7, seconds: 0.5, windup: 1 },
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
 * Frames, each fitted to what his clips paint (with a few pixels to spare), since every pixel of
 * the frame costs paint time: side on there is room ahead of him for the staff thrust out and the
 * bolts, the Arcane Orb and the Meteor's fire that leave it, and behind for the staff swung back;
 * toward and away from the viewer room either side for the staff's twirl. All are tall enough for
 * the Meteor's sigil over the staff thrust at the sky and the pillar of light over him, and deep
 * enough below the ground point for the rings that roll out over the floor toward the viewer. He
 * stands about 80 px tall (2 tiles in game, at the Dark Knight's scale); his staff's orb rises
 * above him, to about 92 px at rest, which is what `height` measures.
 */
export const SAGE_HERO: ChibiHero = chibiHero(
  SAGE,
  { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES },
  TIMING,
  {
    side: { w: 200, h: 188, ax: 66, ay: 154 },
    front: { w: 144, h: 200, ax: 82, ay: 162 },
    back: { w: 144, h: 192, ax: 62, ay: 156 },
  },
  2.1 / 84,
  92,
);
