/** The monsters' and bosses' artwork in creatures/: a transparent pixel sprite and its metrics. */
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import metrics from './creatures/metrics.json';

const urls = import.meta.glob<string>('./creatures/*.png', {
  eager: true, import: 'default', query: '?url',
});

export type CreatureId = `${ThemeId}-${MobKind}` | `${ThemeId}-boss-${BossKind}`;

interface SpriteMetrics {
  w: number;
  h: number;
  /** The point on the ground under its feet, in artwork pixels. */
  ax: number;
  ay: number;
  /** How tall it stands in game, in tiles. */
  height: number;
  floats?: boolean;
}

export interface CreatureArt extends SpriteMetrics {
  url: string;
}

const catalog: Record<CreatureId, SpriteMetrics> = metrics;

export function creatureArt(id: CreatureId): CreatureArt {
  const url = urls[`./creatures/${id}.png`];
  if (!url) throw new Error(`Missing creature sprite: ${id}`);
  return { ...catalog[id], url };
}
