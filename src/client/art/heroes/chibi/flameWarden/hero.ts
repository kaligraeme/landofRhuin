/**
 * The Flame Warden as a chibi hero: his design (design.ts), his fire (fire.ts) and moves
 * (moves-core.ts, moves-skills.ts, moves-states.ts) put together with his clip timing, frame boxes
 * and scale. Registered in ../index.ts.
 */
import type { ChibiClip, ChibiHero, ClipTiming, FrameBox } from '../index.js';
import { chibiHero, paintChibi } from '../painter.js';
import type { ChibiPose, ChibiView } from '../rig.js';
import { FLAME_WARDEN, FLAME_WARDEN_HOT } from './design.js';
import { CORE_MOVES } from './moves-core.js';
import { SKILL_MOVES } from './moves-skills.js';
import { STATE_MOVES } from './moves-states.js';

/**
 * His clip timing (frame counts match his moves files). His basic attack strikes every 0.4 s, the
 * quickest of the Duelists, so each slash plays out in about that, wind-up included (the third
 * coils for two frames, but only the first waits on the server). His weapon
 * skills: `special` Blazing Crescent, `q` Flashfire, `e` Inferno Burst, `r` Kindle, `ult` Firebeast
 * (the game plays it in the first half of the form's 0.8 s emergence, whatever its seconds);
 * `cast` his role skills and the Elixir. None has a server wind-up, so wind-up frames take 0.06 s
 * each.
 */
const TIMING: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 8, seconds: 1.6, windup: 0 },
  battle: { frames: 8, seconds: 0.75, windup: 0 },
  move: { frames: 8, seconds: 0.52, windup: 0 },
  atk1: { frames: 7, seconds: 0.3, windup: 1 },
  atk2: { frames: 7, seconds: 0.3, windup: 1 },
  atk3: { frames: 9, seconds: 0.34, windup: 1 },
  special: { frames: 7, seconds: 0.42, windup: 1 },
  q: { frames: 8, seconds: 0.42, windup: 1 },
  e: { frames: 9, seconds: 0.6, windup: 1 },
  r: { frames: 10, seconds: 0.75, windup: 1 },
  ult: { frames: 10, seconds: 0.5, windup: 0 },
  cast: { frames: 8, seconds: 0.6, windup: 2 },
  hurt: { frames: 3, seconds: 0.3, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

/**
 * Frames: side on there is room ahead of him for the Blazing Crescent (about two tiles out) and
 * Inferno Burst's fireball and shock ring, and behind for the coat tails, the trail of fire and
 * afterimages of Flashfire; toward and away from the viewer he stands centred, with room either
 * side for the ring of fire round his spin. All are tall enough for the pillar of fire that takes
 * him (about 130 px up) and deep enough below the ground point for what rolls out toward the
 * viewer. The game crops every frame to what is painted, so the spare room costs nothing there.
 * He stands about 84 px tall, 2.1 tiles in game.
 */
const FRAMES: Record<ChibiView, FrameBox> = {
  side: { w: 272, h: 224, ax: 116, ay: 168 },
  front: { w: 240, h: 224, ax: 120, ay: 164 },
  back: { w: 240, h: 224, ax: 120, ay: 164 },
};

const CLIPS: Record<ChibiClip, readonly ChibiPose[]> = { ...CORE_MOVES, ...SKILL_MOVES, ...STATE_MOVES };

/** The clips in which his fire lights his hair (a warm sheen on its light tone): his weapon skills. */
const LIT: ReadonlySet<ChibiClip> = new Set<ChibiClip>(['special', 'q', 'e', 'r', 'ult']);

const HERO = chibiHero(FLAME_WARDEN, CLIPS, TIMING, FRAMES, 2.1 / 84, 84);

export const FLAME_WARDEN_HERO: ChibiHero = {
  ...HERO,
  paint: (clip, i, view) => {
    const poses = CLIPS[clip];
    return paintChibi(LIT.has(clip) ? FLAME_WARDEN_HOT : FLAME_WARDEN, poses[Math.max(0, Math.min(i, poses.length - 1))] as ChibiPose, view, FRAMES[view]);
  },
};
