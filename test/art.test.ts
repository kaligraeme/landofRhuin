import { describe, expect, it } from 'vitest';
import { creatureArt } from '../src/client/art/creature-art.js';
import { HERO_LOOKS } from '../src/shared/protocol.js';

const heroes = ['tank', 'mage', 'ranger', 'melee'] as const;
const clans = ['orc', 'dragon', 'undead'] as const;
const mobs = ['brute', 'skirmisher', 'archer', 'caster', 'elite', 'sentry'] as const;
const bosses = ['juggernaut', 'hexer', 'beast', 'warden', 'sovereign'] as const;

const roster = [
  ...heroes.flatMap((role) => HERO_LOOKS.map((look) => `hero-${role}-${look}` as const)),
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
