import { describe, expect, it } from 'vitest';
import { HERO_SPRITES } from '../src/client/art/heroes.js';
import { allMonsterSprites } from '../src/client/art/monsters.js';

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

describe('sprite art', () => {
  const all = { ...Object.fromEntries(Object.entries(HERO_SPRITES).map(([k, f]) => [`hero ${k}`, f()])), ...allMonsterSprites() };

  it('covers four heroes and every clan’s six monsters and five bosses', () => {
    expect(Object.keys(all)).toHaveLength(4 + 3 * (6 + 5));
    for (const clan of ['orc', 'dragon', 'undead']) {
      expect(Object.keys(all).filter((k) => k.startsWith(`${clan} `))).toHaveLength(11);
    }
  });

  it.each(Object.keys(all))('%s is a well-formed SVG with unique ids and a sensible anchor', (key) => {
    const d = all[key]!;
    expect(d.svg.startsWith('<svg')).toBe(true);
    expect(wellFormed(d.svg)).toBe(true);
    const ids = [...d.svg.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(d.ax).toBeGreaterThan(d.vx);
    expect(d.ax).toBeLessThan(d.vx + d.w);
    expect(d.ay).toBeGreaterThan(d.vy);
    expect(d.ay).toBeLessThanOrEqual(d.vy + d.h);
    expect(d.height).toBeGreaterThan(1);
    expect(d.svg).not.toContain('NaN');
    expect(d.svg).not.toContain('undefined');
  });
});

describe('hero pixel art', () => {
  it('draws every weapon, plus the shield, as a well-formed pixel image with its grip inside it', async () => {
    const { WEAPONS } = await import('../src/shared/content/classes.js');
    const { WEAPON_ART, shieldArt } = await import('../src/client/art/heroes.js');
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

  it('gives every hero a weapon hand on the sprite and nearest-neighbour scaling', () => {
    for (const make of Object.values(HERO_SPRITES)) {
      const d = make();
      expect(d.pixel).toBe(true);
      expect(d.hand!.x).toBeGreaterThan(d.ax);
      expect(d.hand!.y).toBeLessThan(d.ay);
    }
  });
});
