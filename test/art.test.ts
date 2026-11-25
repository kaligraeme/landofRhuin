import { describe, expect, it } from 'vitest';
import { creatureArt } from '../src/client/art/creature-art.js';
import { shieldArt, WEAPON_ART } from '../src/client/art/weapons.js';
import { HERO_LOOKS } from '../src/shared/protocol.js';
import { WEAPONS } from '../src/shared/content/classes.js';

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
    if (id.startsWith('hero-')) {
      expect(sprite.hand).toBeDefined();
      expect(sprite.hand!.x).toBeGreaterThan(0);
      expect(sprite.hand!.x).toBeLessThan(sprite.w);
      expect(sprite.hand!.y).toBeGreaterThan(0);
      expect(sprite.hand!.y).toBeLessThan(sprite.ay);
    }
  });
});

/** A small well-formedness check: every tag closes, in order. */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, name, , selfClosing] = m;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else stack.push(name as string);
  }
  return stack.length === 0;
}

describe('weapon pixel art', () => {
  it('draws every weapon, plus the shield, as a well-formed pixel image with its grip inside it', () => {
    for (const id of Object.keys(WEAPONS)) expect(WEAPON_ART[id], id).toBeDefined();
    for (const art of [...Object.values(WEAPON_ART).map((f) => f()), shieldArt()]) {
      expect(art.svg.startsWith('<svg')).toBe(true);
      expect(wellFormed(art.svg)).toBe(true);
      expect(art.svg).toContain('crispEdges');
      expect(art.gx).toBeGreaterThan(0);
      expect(art.gx).toBeLessThan(art.w);
      expect(art.gy).toBeGreaterThan(0);
      expect(art.gy).toBeLessThan(art.h);
    }
  });
});
