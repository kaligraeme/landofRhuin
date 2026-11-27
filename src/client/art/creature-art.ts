import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import type { PaintedArtId } from './heroArt.js';
import metrics from './creatures/metrics.json';

const urls = import.meta.glob<string>('./creatures/*.png', {
  eager: true, import: 'default', query: '?url',
});

export type CreatureId = PaintedArtId | `${ThemeId}-${MobKind}` | `${ThemeId}-boss-${BossKind}`;

interface SpriteMetrics {
  w: number;
  h: number;
  ax: number;
  ay: number;
  height: number;
  hand?: { x: number; y: number };
  offhand?: { x: number; y: number };
  floats?: boolean;
}

export interface CreatureArt extends SpriteMetrics {
  url: string;
}

const catalog: Record<CreatureId, SpriteMetrics> = metrics;

/** Whether there is artwork for this id in creatures/ (chibi-only heroes and forms have none). */
export function hasCreatureArt(id: string): id is CreatureId {
  return `./creatures/${id}.png` in urls && id in catalog;
}

export function creatureArt(id: CreatureId): CreatureArt {
  const url = urls[`./creatures/${id}.png`];
  if (!url) throw new Error(`Missing creature sprite: ${id}`);
  return { ...catalog[id], url };
}
