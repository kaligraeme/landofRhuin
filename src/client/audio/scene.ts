/** Picks the music for what is happening in a dungeon. */
import type { ThemeId } from '../../shared/content/monsters.js';
import type { TrackId } from './score.js';

export interface SceneFoe {
  boss: boolean;
  x: number;
  y: number;
  /** Fighting someone (has a target). */
  engaged: boolean;
}

/** How far away a fight still sets the mood, in tiles. */
const NEAR = 22;

/**
 * The boss theme while a boss is fighting nearby; otherwise the clan's theme, with its drums in
 * while any foe nearby is fighting.
 */
export function dungeonScene(clan: ThemeId, me: { x: number; y: number } | null, foes: SceneFoe[]): { track: TrackId; combat: boolean } {
  const near = (f: SceneFoe): boolean => !me || Math.hypot(f.x - me.x, f.y - me.y) < NEAR + (f.boss ? 10 : 0);
  if (foes.some((f) => f.boss && f.engaged && near(f))) return { track: 'boss', combat: true };
  return { track: `explore-${clan}`, combat: foes.some((f) => f.engaged && near(f)) };
}
