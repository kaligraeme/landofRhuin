/**
 * The Firebeast as a chibi hero: its design (design.ts) and moves (moves-core.ts, moves-skills.ts,
 * moves-states.ts) put together with its clip timing, frame boxes and scale. It is the form the
 * Flame Warden takes for his ultimate, not a hero of its own: the game draws it under the sprite
 * id `hero-firebeast` while the form lasts. Registered in ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming } from '../index.js';
import { chibiHero } from '../painter.js';
import type { ChibiPose, FxContext } from '../rig.js';
import { FIRE_HOT, FIREBEAST, FLAME_TONES } from './design.js';
import { burn } from './fire.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * Its clip timing (frame counts match its moves files). The strikes suit the claw chain's 0.45 s
 * between hits: each is over (or into its last frames of recovery) by then. `ult` plays once as
 * the form begins (it emerges from the fire) and `cast` once as it ends (it collapses into it).
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.4, windup: 0 },
  battle: { frames: 8, seconds: 0.8, windup: 0 },
  move: { frames: 8, seconds: 0.6, windup: 0 },
  atk1: { frames: 7, seconds: 0.36, windup: 1 },
  atk2: { frames: 7, seconds: 0.36, windup: 1 },
  atk3: { frames: 9, seconds: 0.4, windup: 2 },
  special: { frames: 6, seconds: 0.7, windup: 1 },
  q: { frames: 8, seconds: 0.5, windup: 1 },
  e: { frames: 8, seconds: 0.6, windup: 2 },
  r: { frames: 8, seconds: 0.8, windup: 1 },
  ult: { frames: 7, seconds: 0.4, windup: 0 },
  cast: { frames: 8, seconds: 0.45, windup: 0 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.4, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.4, windup: 0 },
};

/** Its fire's glow and the embers rising off it (fire.ts `burn`), over every frame, under whatever else the pose paints. */
const GLOW = burn(FIRE_HOT, FIREBEAST.aura.core, [FIREBEAST.aura.hot, FIREBEAST.aura.edge], FLAME_TONES);

function lit(poses: readonly ChibiPose[]): ChibiPose[] {
  return poses.map((p) => {
    const own = p.fx?.extra;
    const extra = own
      ? (x: FxContext): void => {
          GLOW(x);
          own(x);
        }
      : GLOW;
    return { ...p, fx: { ...p.fx, extra } };
  });
}

const MOVES: Record<ChibiClip, readonly ChibiPose[]> = { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES };
const POSES = {} as Record<ChibiClip, readonly ChibiPose[]>;
for (const clip of Object.keys(TIMING) as ChibiClip[]) POSES[clip] = lit(MOVES[clip]);

/**
 * Frames, each fitted round everything any of its clips paints with at least five pixels to spare
 * (the canvas is painted whole for every frame, so a tight one paints faster): side on there is
 * room ahead of it for its slashes and the gout of fire from its jaws and behind for its tail and
 * the pillar of fire bursting open round it; toward the viewer, room to its right for the tail
 * curling out and its fall, and below for the shockwaves rolling toward the viewer; all are tall
 * enough for that pillar (about 120 px above the ground) and the rays round its roars. It stands
 * about 108 px tall to the tips of its mane: 2.56 tiles in game, a head taller than the heroes.
 */
export const FIREBEAST_HERO: ChibiHero = chibiHero(
  FIREBEAST,
  POSES,
  TIMING,
  {
    side: { w: 204, h: 214, ax: 80, ay: 161 },
    front: { w: 208, h: 219, ax: 104, ay: 164 },
    back: { w: 166, h: 176, ax: 84, ay: 145 },
  },
  2.56 / 108,
  108,
);
