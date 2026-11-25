import type { RoleId } from '../../shared/content/classes.js';
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import type { HeroLook } from '../../shared/protocol.js';
import metrics from './creatures/metrics.json';

const urls = import.meta.glob<string>('./creatures/*.png', {
  eager: true, import: 'default', query: '?url',
});

type CreatureId = `hero-${RoleId}-${HeroLook}` | `${ThemeId}-${MobKind}` | `${ThemeId}-boss-${BossKind}`;

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

export function creatureArt(id: CreatureId): CreatureArt {
  const url = urls[`./creatures/${id}.png`];
  if (!url) throw new Error(`Missing creature sprite: ${id}`);
  return { ...catalog[id], url };
}
