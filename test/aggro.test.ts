import { describe, expect, it } from 'vitest';
import { AGGRO, aggroTable, damageAggro, fadeAggro, healAggro, pickTarget, surgeOf, taunt } from '../src/server/sim/aggro.js';
import { applyDamage, applyHeal, outgoingDamage } from '../src/server/sim/combat.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import type { Monster, Player } from '../src/server/sim/types.js';

const seats: Seat[] = [
  { ownerId: 'h1', name: 'Tank', role: 'tank', weapon: 'tank_greatsword' },
  { ownerId: 'h2', name: 'Mage', role: 'mage', weapon: 'staff' },
  { ownerId: 'h3', name: 'Ranger', role: 'ranger', weapon: 'bow' },
  { ownerId: 'h4', name: 'Duelist', role: 'melee', weapon: 'twin_blades' },
];

function setup() {
  const inst = new Instance('a', seats, { seed: 3, countdown: 0 });
  inst.tick();
  const [tank, mage, ranger, melee] = inst.players as [Player, Player, Player, Player];
  const mob = (dx = 3): Monster => {
    const m = inst.spawnMob('brute', tank.x + dx, tank.y, 0, 0);
    m.hp = m.maxHp = 1e9;
    m.speed = 0;
    m.autoInterval = 1e9;
    m.mob = { ...m.mob!, abilities: [] };
    inst.engage(m);
    m.autoNext = 1e9;
    m.enmity.clear();
    return m;
  };
  return { inst, tank, mage, ranger, melee, mob };
}

describe('aggro', () => {
  it('damage builds aggro, three times as much for a tank', () => {
    const { inst, tank, melee, mob } = setup();
    const a = mob();
    const b = mob(5);
    // Touch both first so the first-contact bonus is out of the way.
    damageAggro(inst, a, tank, 0);
    damageAggro(inst, a, melee, 0);
    const base = (a.enmity.get(tank.id) ?? 0) - (a.enmity.get(melee.id) ?? 0);
    expect(base).toBe(AGGRO.firstContact);
    const t0 = a.enmity.get(tank.id) ?? 0;
    const m0 = a.enmity.get(melee.id) ?? 0;
    damageAggro(inst, a, tank, 100);
    damageAggro(inst, a, melee, 100);
    expect(((a.enmity.get(tank.id) ?? 0) - t0) / ((a.enmity.get(melee.id) ?? 0) - m0)).toBeCloseTo(3, 2);
    // A real hit builds aggro on the monster it lands on, and only there.
    applyDamage(inst, melee, b, 1000);
    expect(b.enmity.get(melee.id) ?? 0).toBeGreaterThan(1000);
  });

  it('first contact adds a flat chunk, twice as much for a tank', () => {
    const { inst, tank, ranger, mob } = setup();
    const m = mob();
    damageAggro(inst, m, ranger, 10);
    expect(m.enmity.get(ranger.id)).toBeCloseTo(AGGRO.firstContact + 10, 0);
    damageAggro(inst, m, ranger, 10);
    expect(m.enmity.get(ranger.id)).toBeCloseTo(AGGRO.firstContact + 20, 0);
    damageAggro(inst, m, tank, 0);
    expect(m.enmity.get(tank.id)).toBe(AGGRO.firstContact * 2);
  });

  it('healing builds aggro on every monster fighting nearby', () => {
    const { inst, tank, mage, mob } = setup();
    const near = mob(4);
    const far = inst.spawnMob('brute', tank.x + 60, tank.y, 0, 0);
    inst.engage(far);
    far.enmity.clear();
    tank.hp = 1000;
    const healed = applyHeal(inst, mage, tank, 2000, false);
    expect(healed).toBe(2000);
    // Healing never touches the monster: no first-contact bonus, only the healing share.
    expect(near.enmity.get(mage.id)).toBeCloseTo(2000 * AGGRO.healShare, 0);
    expect(far.enmity.get(mage.id) ?? 0).toBe(0);
    // Overhealing does not count.
    const before = near.enmity.get(mage.id) ?? 0;
    healAggro(inst, mage, 0);
    expect(near.enmity.get(mage.id)).toBe(before);
    // The healer's first blow on it still counts as first contact.
    damageAggro(inst, near, mage, 10);
    expect(near.enmity.get(mage.id)).toBeCloseTo(before + AGGRO.firstContact + 10, 0);
  });

  it('a fallen hero builds no aggro, from blows or heals still landing', () => {
    const { inst, tank, melee, mob } = setup();
    const m = mob();
    melee.dead = true;
    expect(damageAggro(inst, m, melee, 5000)).toBe(0);
    expect(m.enmity.has(melee.id)).toBe(false);
    tank.dead = true;
    healAggro(inst, tank, 3000);
    expect(m.enmity.has(tank.id)).toBe(false);
  });

  it('unhinged damage builds aggro fast: the same damage in a burst counts far more than spread out', () => {
    const { inst, melee, mob } = setup();
    const steady = mob();
    const burst = mob(6);
    damageAggro(inst, steady, melee, 0);
    damageAggro(inst, burst, melee, 0);
    // 12 hits of 1000: one every 2 seconds on one monster, all within a second on the other.
    const s0 = steady.enmity.get(melee.id) ?? 0;
    const b0 = burst.enmity.get(melee.id) ?? 0;
    for (let i = 0; i < 12; i++) {
      damageAggro(inst, steady, melee, 1000);
      for (let k = 0; k < 40; k++) inst.now += 0.05;
    }
    for (let i = 0; i < 12; i++) {
      damageAggro(inst, burst, melee, 1000);
      inst.now += 0.08;
    }
    const steadyGain = (steady.enmity.get(melee.id) ?? 0) - s0;
    const burstGain = (burst.enmity.get(melee.id) ?? 0) - b0;
    expect(burstGain).toBeGreaterThan(steadyGain * 2);
    expect(surgeOf(0)).toBe(1);
    expect(surgeOf(1e9)).toBe(1 + AGGRO.surgeMax);
  });

  it('monsters stick to their target: 10% more to pull from a damage dealer, 30% more from a tank', () => {
    const { inst, tank, ranger, melee, mob } = setup();
    const m = mob();
    m.enmity.set(ranger.id, 1000);
    expect(pickTarget(inst, m)?.id).toBe(ranger.id);
    m.targetId = ranger.id;
    m.enmity.set(melee.id, 1090);
    expect(pickTarget(inst, m)?.id).toBe(ranger.id);
    m.enmity.set(melee.id, 1110);
    expect(pickTarget(inst, m)?.id).toBe(melee.id);
    m.targetId = tank.id;
    m.enmity.set(tank.id, 1000);
    m.enmity.set(melee.id, 1250);
    expect(pickTarget(inst, m)?.id).toBe(tank.id);
    m.enmity.set(melee.id, 1350);
    expect(pickTarget(inst, m)?.id).toBe(melee.id);
  });

  it('aggro fades, the tank’s three times slower', () => {
    const { inst, tank, melee, mob } = setup();
    const m = mob();
    m.enmity.set(tank.id, 10000);
    m.enmity.set(melee.id, 10000);
    for (let i = 0; i < 100; i++) fadeAggro(inst, m, 0.05);
    const tankLeft = 1 - (m.enmity.get(tank.id) ?? 0) / 10000;
    const meleeLeft = 1 - (m.enmity.get(melee.id) ?? 0) / 10000;
    expect(meleeLeft / tankLeft).toBeCloseTo(3, 0);
  });

  it('a taunt puts the tank on top and turns the monster at once', () => {
    const { inst, tank, melee, mob } = setup();
    const m = mob();
    m.enmity.set(melee.id, 50000);
    m.targetId = melee.id;
    taunt(m, tank);
    expect(m.targetId).toBe(tank.id);
    expect(m.enmity.get(tank.id)).toBeGreaterThan(50000 * AGGRO.tauntOver);
    expect(pickTarget(inst, m)?.id).toBe(tank.id);
  });

  it('tells clients the top of each table for the threat meter', () => {
    const { inst, tank, ranger, mob } = setup();
    const m = mob();
    m.enmity.set(tank.id, 2000);
    m.enmity.set(ranger.id, 1500);
    expect(aggroTable(m)).toEqual([
      [tank.id, 100],
      [ranger.id, 75],
    ]);
    m.targetId = tank.id;
    const snap = inst.takeSnapshot();
    expect(snap.ents.find((e) => e.i === m.id)?.ag).toEqual([
      [tank.id, 100],
      [ranger.id, 75],
    ]);
    // Shares are of the holder's aggro: a ranger above a sticky tank reads over 100 until it turns.
    m.enmity.set(ranger.id, 2400);
    expect(pickTarget(inst, m)?.id).toBe(tank.id);
    expect(aggroTable(m)).toEqual([
      [ranger.id, 120],
      [tank.id, 100],
    ]);
  });

  it('monster blows aimed at their aggro target hit far harder than their area attacks', () => {
    const { inst, mob } = setup();
    const m = mob();
    const area = outgoingDamage(inst, m, 1000, false).amount;
    const focused = outgoingDamage(inst, m, 1000, false, true).amount;
    expect(focused / area).toBeGreaterThan(2.5);
  });
});
