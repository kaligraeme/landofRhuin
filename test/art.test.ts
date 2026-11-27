import { describe, expect, it } from 'vitest';
import { creatureArt } from '../src/client/art/creature-art.js';
import { heroArtId, isPainted } from '../src/client/art/heroArt.js';
import { HERO_ORDER } from '../src/shared/content/classes.js';

const clans = ['orc', 'dragon', 'undead'] as const;
const mobs = ['brute', 'skirmisher', 'archer', 'caster', 'elite', 'sentry'] as const;
const bosses = ['juggernaut', 'hexer', 'beast', 'warden', 'sovereign'] as const;

const roster = [
  ...HERO_ORDER.filter(isPainted).map(heroArtId),
  ...clans.flatMap((clan) => [
    ...mobs.map((kind) => `${clan}-${kind}` as const),
    ...bosses.map((kind) => `${clan}-boss-${kind}` as const),
  ]),
];

describe('creature art', () => {
  it.each(roster)('%s resolves to a sprite with its anchors inside the canvas', (id) => {
    const sprite = creatureArt(id);
    expect(sprite.url).toBeTruthy();
    expect(sprite.ax).toBeGreaterThan(0);
    expect(sprite.ax).toBeLessThan(sprite.w);
    expect(sprite.ay).toBeGreaterThan(0);
    expect(sprite.ay).toBeLessThanOrEqual(sprite.h);
    expect(sprite.height).toBeGreaterThan(1);
  });
});
