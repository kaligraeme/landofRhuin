/**
 * The Bowmaster as a chibi hero: her design (design.ts) and moves (moves-core.ts, moves-skills.ts,
 * moves-states.ts) put together with her clip timing, frame boxes and scale. Registered in
 * ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import { paintChibi } from '../painter.js';
import type { ChibiDesign } from '../design.js';
import { BOWMASTER, BOWMASTER_FAN, BOWMASTER_RUIN, BOWMASTER_SNARE } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * Her clip timing (frame counts match her moves files). Her weapon skills: `special` Charged Shot
 * (its three wind-up frames stretch over the server's 0.6 s draw), `q` Volley, `e` Snare Trap,
 * `r` Fan of Arrows, `ult` Rain of Ruin; `cast` her role skills (Vault, Field Dressing) and the
 * Elixir. The basic attack has no server wind-up, so each Quick Arrow is loosed after a single
 * wind-up frame (0.06 s), close behind the game's own arrow.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.8, windup: 0 },
  battle: { frames: 8, seconds: 0.9, windup: 0 },
  move: { frames: 8, seconds: 0.55, windup: 0 },
  atk1: { frames: 7, seconds: 0.38, windup: 1 },
  atk2: { frames: 7, seconds: 0.38, windup: 1 },
  atk3: { frames: 9, seconds: 0.44, windup: 1 },
  special: { frames: 8, seconds: 0.55, windup: 3 },
  q: { frames: 9, seconds: 0.6, windup: 2 },
  e: { frames: 7, seconds: 0.5, windup: 2 },
  r: { frames: 8, seconds: 0.5, windup: 1 },
  ult: { frames: 12, seconds: 0.95, windup: 3 },
  cast: { frames: 8, seconds: 0.6, windup: 1 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

const MOVES = { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES };

/**
 * Clips painted with a variant of her design: the snare in her hand for Snare Trap, five arrows
 * on the string for Fan of Arrows, the dark arrow and her effects turned violet-black for Rain of
 * Ruin.
 */
const VARIANTS: Partial<Record<ChibiClip, ChibiDesign>> = { e: BOWMASTER_SNARE, r: BOWMASTER_FAN, ult: BOWMASTER_RUIN };

const FRAMES = {
  side: { w: 224, h: 208, ax: 72, ay: 188 },
  front: { w: 136, h: 212, ax: 68, ay: 172 },
  back: { w: 136, h: 232, ax: 68, ay: 208 },
};

const BASE = chibiHero(BOWMASTER, MOVES, TIMING, FRAMES, 2.1 / 84, 80);

/**
 * Frames: side on there is room ahead of her for the streaks of her shots (the Charged Shot's
 * runs about 90 px past the bow), the snare's flight and the fan of arrows, and behind for her
 * cape; toward and away from the viewer she stands centred, with room below for streaks flying
 * toward the viewer. All are tall enough for Volley and Rain of Ruin, loosed at the sky. The game
 * crops every frame to what is painted, so the spare room costs nothing there. She stands about
 * 80 px tall: at the Dark Knight's 2.1 tiles per 84 px, 2 tiles in game.
 */
export const BOWMASTER_HERO: ChibiHero = {
  ...BASE,
  paint: (clip, i, view) => paintChibi(VARIANTS[clip] ?? BOWMASTER, MOVES[clip][Math.max(0, Math.min(i, MOVES[clip].length - 1))]!, view, FRAMES[view]),
};
