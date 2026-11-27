import { describe, expect, it } from 'vitest';
import { Instance, type Seat } from '../src/server/sim/instance.js';

const party = (tank: string, mage: string, ranger: string, melee: string): Seat[] => [
  { ownerId: null, name: 'Tank', role: 'tank', weapon: tank },
  { ownerId: null, name: 'Mage', role: 'mage', weapon: mage },
  { ownerId: null, name: 'Ranger', role: 'ranger', weapon: ranger },
  { ownerId: null, name: 'Melee', role: 'melee', weapon: melee },
];

function clear(seats: Seat[], seed: number) {
  const inst = new Instance(`sim${seed}`, seats, { seed });
  const limit = 35 * 60 * 20;
  while (inst.phase !== 'complete' && inst.ticks < limit) {
    inst.tick();
    if (inst.ticks % 2 === 0) inst.takeSnapshot();
  }
  return inst;
}

describe('a full dungeon run with four AI companions', () => {
  it.each([
    [101, party('tank_greatsword', 'staff', 'bow', 'spear')],
    [202, party('sword_shield', 'staff', 'crossbow', 'twin_blades')],
    [303, party('sword_shield', 'staff', 'bow', 'spear')],
    [404, party('tank_greatsword', 'mystic_sword', 'crossbow', 'twin_blades')],
    [505, party('sword_shield', 'staff', 'bow', 'flame_sword')],
  ])('seed %i clears every boss', (seed, seats) => {
    const inst = clear(seats, seed);
    expect(inst.phase).toBe('complete');
    expect(inst.bossesDefeated).toBe(inst.plan.bossCount);
    expect(inst.rooms.every((r) => r.status === 'cleared')).toBe(true);
    expect(inst.wipes).toBeLessThanOrEqual(3);
    for (const p of inst.players) expect(p.stats.damage).toBeGreaterThan(0);
    // The glass cannons out-damage the tank, and melee leads.
    const dmg = Object.fromEntries(inst.players.map((p) => [p.role, p.stats.damage]));
    expect(dmg.melee).toBeGreaterThan(dmg.tank as number);
    expect(dmg.ranger).toBeGreaterThan(dmg.tank as number);
  });
});
