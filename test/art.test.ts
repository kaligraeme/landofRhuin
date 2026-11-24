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
