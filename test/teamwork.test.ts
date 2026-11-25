/**
 * The party's roles depend on each other: monsters hit too hard for anyone but a tank to stand in
 * front of them, and even a tank needs a healer to keep standing.
 */
import { describe, expect, it } from 'vitest';
import { taunt } from '../src/server/sim/aggro.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import type { MobKind } from '../src/shared/content/monsters.js';
import type { Player } from '../src/server/sim/types.js';

const WEAPON: Record<string, [Seat['role'], string]> = {
  'Dark Knight': ['tank', 'tank_greatsword'],
  Guardian: ['tank', 'sword_shield'],
  Sage: ['mage', 'staff'],
  Spellblade: ['mage', 'mystic_sword'],
  Marksman: ['ranger', 'bow'],
  Arbalist: ['ranger', 'crossbow'],
  Halberdier: ['melee', 'spear'],
  Reaver: ['melee', 'greatsword'],
};

/** Puts a pack on one hero (everyone else out of the fight) and returns seconds until they fall (or the limit). */
function standAgainst(hero: string, pack: MobKind[], opts: { fight: boolean; healer?: boolean; seed?: number; limit?: number }): { fell: number | null; won: boolean } {
  const [role, weapon] = WEAPON[hero] as [Seat['role'], string];
  const others = (['tank', 'mage', 'ranger', 'melee'] as Seat['role'][]).filter((r) => r !== role);
  const seats: Seat[] = [{ ownerId: null, name: hero, role, weapon }, ...others.map((r): Seat => ({ ownerId: null, name: r, role: r, weapon: r === 'tank' ? 'tank_greatsword' : r === 'mage' ? 'staff' : r === 'ranger' ? 'bow' : 'spear' }))];
  const inst = new Instance('t', seats, { seed: opts.seed ?? 1, countdown: 0 });
  inst.tick();
  const me = inst.players[0] as Player;
  me.botControlled = opts.fight;
  for (const o of inst.players.slice(1)) {
    // A Staff healer stays to help when asked; everyone else steps out of the fight.
    if (opts.healer && o.role === 'mage') continue;
    o.botControlled = false;
    o.x += 400;
  }
  const mobs = pack.map((k, i) => inst.spawnMob(k, me.x + 3 + (i % 3), me.y + (i - 2), 0, 1));
  for (const m of mobs) {
    inst.engage(m);
    taunt(m, me);
  }
  const limit = opts.limit ?? 120;
  let t = 0;
  while (!me.dead && t < limit && mobs.some((m) => !m.dead)) {
    inst.tick();
    t += 0.05;
  }
  return { fell: me.dead ? t : null, won: mobs.every((m) => m.dead) };
}

describe('teamwork', () => {
  const pack: MobKind[] = ['brute', 'skirmisher', 'archer'];

  it('with a pack on them, damage dealers and mages fall in seconds; tanks last far longer', () => {
    const fell: Record<string, number> = {};
    for (const hero of Object.keys(WEAPON)) fell[hero] = standAgainst(hero, pack, { fight: false }).fell ?? Infinity;
    const others = Object.entries(fell).filter(([h]) => WEAPON[h]![0] !== 'tank');
    for (const [hero, t] of others) expect(t, hero).toBeLessThan(8);
    const longest = Math.max(...others.map(([, t]) => t));
    expect(fell['Dark Knight']).toBeGreaterThan(longest * 1.6);
    expect(fell.Guardian).toBeGreaterThan(longest * 1.6);
  });

  it('fighting back does not save a damage dealer who has a pack on them', () => {
    for (const hero of ['Marksman', 'Sage', 'Halberdier', 'Reaver']) {
      const r = standAgainst(hero, pack, { fight: true, limit: 60 });
      expect(r.won, hero).toBe(false);
      expect(r.fell, hero).not.toBeNull();
    }
  });

  it('a tank can take a big pack for a while, but only a healer keeps it standing', () => {
    const big: MobKind[] = ['brute', 'brute', 'skirmisher', 'archer', 'caster'];
    for (const seed of [1, 2, 3]) {
      const alone = standAgainst('Dark Knight', big, { fight: true, seed });
      expect(alone.fell, `alone, seed ${seed}`).not.toBeNull();
      expect(alone.fell!, `alone, seed ${seed}`).toBeGreaterThan(12);
      const helped = standAgainst('Dark Knight', big, { fight: true, healer: true, seed });
      expect(helped.won, `with a healer, seed ${seed}`).toBe(true);
      expect(helped.fell, `with a healer, seed ${seed}`).toBeNull();
    }
    const guardianAlone = standAgainst('Guardian', big, { fight: true, seed: 2 });
    expect(guardianAlone.fell).not.toBeNull();
    expect(guardianAlone.fell!).toBeGreaterThan(30);
    const guardianHelped = standAgainst('Guardian', big, { fight: true, healer: true, seed: 2 });
    expect(guardianHelped.won).toBe(true);
  });
});
