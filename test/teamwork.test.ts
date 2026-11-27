/**
 * The party's roles depend on each other: monsters hit too hard for anyone but a tank to stand in
 * front of them, and even a tank needs a healer to keep standing. The one exception lasts five
 * seconds: the Flame Warden's Firebeast, which no monster can hurt.
 */
import { describe, expect, it } from 'vitest';
import { taunt } from '../src/server/sim/aggro.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import { PLAYER_RADIUS } from '../src/shared/constants.js';
import { startAbility } from '../src/server/sim/mechanics.js';
import type { MobKind } from '../src/shared/content/monsters.js';
import type { Player } from '../src/server/sim/types.js';

const WEAPON: Record<string, [Seat['role'], string]> = {
  'Dark Knight': ['tank', 'tank_greatsword'],
  Guardian: ['tank', 'sword_shield'],
  Sage: ['mage', 'staff'],
  Spellblade: ['mage', 'mystic_sword'],
  Bowmaster: ['ranger', 'bow'],
  Arbalest: ['ranger', 'crossbow'],
  Dragoon: ['melee', 'spear'],
  Blademaster: ['melee', 'twin_blades'],
  'Flame Warden': ['melee', 'flame_sword'],
};

/**
 * Puts a pack on one hero, with everyone else out of the fight, and returns seconds until they fall
 * (or the limit). When the hero is not the tank, the tank is gone, so there is no one to run to.
 */
function standAgainst(hero: string, pack: MobKind[], opts: { fight: boolean; healer?: boolean; seed?: number; limit?: number; noUltimate?: boolean }): { fell: number | null; won: boolean } {
  const [role, weapon] = WEAPON[hero] as [Seat['role'], string];
  const others = (['tank', 'mage', 'ranger', 'melee'] as Seat['role'][]).filter((r) => r !== role);
  const seats: Seat[] = [{ ownerId: null, name: hero, role, weapon }, ...others.map((r): Seat => ({ ownerId: null, name: r, role: r, weapon: r === 'tank' ? 'tank_greatsword' : r === 'mage' ? 'staff' : r === 'ranger' ? 'bow' : 'spear' }))];
  const inst = new Instance('t', seats, { seed: opts.seed ?? 1, countdown: 0 });
  inst.tick();
  const me = inst.players[0] as Player;
  me.botControlled = opts.fight;
  if (opts.noUltimate) me.cooldowns.set(me.hotbar[5] as string, 1e9);
  for (const o of inst.players.slice(1)) {
    // A Staff healer stays to help when asked; everyone else steps out of the fight.
    if (opts.healer && o.role === 'mage') continue;
    o.botControlled = false;
    o.x += 400;
    if (o.role === 'tank') inst.kill(o, null);
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

  it('fighting back does not save a damage dealer from a wave with no tank to hold it', () => {
    const wave: MobKind[] = ['brute', 'brute', 'skirmisher', 'archer', 'caster'];
    for (const hero of Object.keys(WEAPON).filter((h) => WEAPON[h]![0] !== 'tank')) {
      for (const seed of [1, 2, 3]) {
        // The Flame Warden's Firebeast is the exception, below.
        const r = standAgainst(hero, wave, { fight: true, seed, limit: 60, noUltimate: hero === 'Flame Warden' });
        expect(r.won, `${hero}, seed ${seed}`).toBe(false);
        expect(r.fell, `${hero}, seed ${seed}`).not.toBeNull();
        expect(r.fell!, `${hero}, seed ${seed}`).toBeLessThan(15);
      }
    }
  });

  it('the Firebeast carries the Flame Warden through a pack; on cooldown, he falls like any Duelist', () => {
    for (const seed of [1, 2, 3]) {
      const beast = standAgainst('Flame Warden', pack, { fight: true, seed, limit: 60 });
      expect(beast.won, `seed ${seed}`).toBe(true);
      expect(beast.fell, `seed ${seed}`).toBeNull();
      const warden = standAgainst('Flame Warden', pack, { fight: true, seed, limit: 60, noUltimate: true });
      expect(warden.won, `on cooldown, seed ${seed}`).toBe(false);
      expect(warden.fell, `on cooldown, seed ${seed}`).not.toBeNull();
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

describe('AI companions and tank-busters', () => {
  /**
   * An AI tank in front of a monster casting a tank-buster on it, and a Duelist standing still
   * behind the monster, in line with the tank's charge through it. Returns which skills the tank
   * used, and how far from the Duelist each one left it.
   */
  function busterOnTank(tankWeapon: string, seed: number): { used: string[]; gaps: Map<string, number> } {
    const seats: Seat[] = [
      { ownerId: null, name: 'Tank', role: 'tank', weapon: tankWeapon },
      { ownerId: 'h2', name: 'Mage', role: 'mage', weapon: 'staff' },
      { ownerId: 'h3', name: 'Ranger', role: 'ranger', weapon: 'bow' },
      { ownerId: 'h4', name: 'Duelist', role: 'melee', weapon: 'spear' },
    ];
    const inst = new Instance('tb', seats, { seed, countdown: 0 });
    inst.tick();
    const [tank, mage, ranger, duelist] = inst.players as [Player, Player, Player, Player];
    mage.x += 400;
    ranger.x += 400;
    const hall = inst.plan.rooms[0]!.center;
    const brute = inst.spawnMob('brute', hall.x, hall.y, 0, 0);
    brute.hp = brute.maxHp = 1e9;
    brute.speed = 0;
    brute.autoInterval = 1e9;
    brute.mob = { ...brute.mob!, abilities: [] };
    inst.engage(brute);
    brute.autoNext = 1e9;
    taunt(brute, tank);
    tank.x = hall.x - 2.2;
    tank.y = hall.y;
    tank.maxHp = tank.hp = 1e9;
    duelist.x = hall.x + 3;
    duelist.y = hall.y;
    duelist.maxHp = duelist.hp = 1e9;
    startAbility(inst, brute, { id: 'crush', name: 'Crush', cast: 3, potency: 4800, pattern: { kind: 'tankbuster', radius: 3 } });
    const used: string[] = [];
    const gaps = new Map<string, number>();
    for (let i = 0; i < 2.9 * 20; i++) {
      brute.enmity.set(tank.id, 1e12);
      inst.tick();
      for (const ev of inst.drainEvents()) {
        if (ev.e !== 'act' || ev.i !== tank.id || ev.k !== 'sk' || !ev.s) continue;
        used.push(ev.s);
        gaps.set(ev.s, Math.hypot(tank.x - duelist.x, tank.y - duelist.y));
      }
    }
    return { used, gaps };
  }

  /**
   * An AI Duelist (not the tank) with a monster casting a tank-buster on him, and a player Mage
   * standing beside him. Returns whether he rolled, and who the buster struck.
   */
  function busterOnDuelist(weapon: string, seed: number): { rolled: boolean; struck: number[]; dead: boolean } {
    const seats: Seat[] = [
      { ownerId: 'h1', name: 'Tank', role: 'tank', weapon: 'tank_greatsword' },
      { ownerId: 'h2', name: 'Mage', role: 'mage', weapon: 'staff' },
      { ownerId: 'h3', name: 'Ranger', role: 'ranger', weapon: 'bow' },
      { ownerId: null, name: 'Duelist', role: 'melee', weapon },
    ];
    const inst = new Instance('tb', seats, { seed, countdown: 0 });
    inst.tick();
    const [tank, mage, ranger, duelist] = inst.players as [Player, Player, Player, Player];
    tank.x += 400;
    ranger.x += 400;
    // Not his ultimate: the Firebeast would make it harmless anyway.
    duelist.cooldowns.set(duelist.hotbar[5] as string, 1e9);
    const hall = inst.plan.rooms[0]!.center;
    const brute = inst.spawnMob('brute', hall.x, hall.y, 0, 0);
    brute.hp = brute.maxHp = 1e9;
    brute.speed = 0;
    brute.mob = { ...brute.mob!, abilities: [] };
    inst.engage(brute);
    brute.autoNext = 1e9;
    taunt(brute, duelist);
    duelist.x = hall.x - 2.2;
    duelist.y = hall.y;
    mage.x = duelist.x - 1.5;
    mage.y = duelist.y;
    mage.maxHp = mage.hp = 1e9;
    startAbility(inst, brute, { id: 'crush', name: 'Crush', cast: 3, potency: 4800, pattern: { kind: 'tankbuster', radius: 3 } });
    const struck = new Set<number>();
    let rolled = false;
    for (let i = 0; i < 3.5 * 20; i++) {
      brute.enmity.set(duelist.id, 1e12);
      inst.tick();
      for (const ev of inst.drainEvents()) {
        if (ev.e === 'dmg' && ev.n === 'Crush') struck.add(ev.t);
        if (ev.e === 'fx' && ev.k === 'roll' && ev.s === duelist.id) rolled = true;
      }
    }
    return { rolled, struck: [...struck], dead: duelist.dead };
  }

  it('a Duelist with a buster on him cannot outrun it: he rolls through it as it lands, the way that keeps it off the others', () => {
    for (const weapon of ['spear', 'twin_blades', 'flame_sword']) {
      for (const seed of [1, 2, 3]) {
        const label = `${weapon}, seed ${seed}`;
        const { rolled, struck, dead } = busterOnDuelist(weapon, seed);
        expect(rolled, label).toBe(true);
        expect(struck, label).toEqual([]);
        expect(dead, label).toBe(false);
      }
    }
  });

  it('a tank bracing with its charge never drags its buster onto the heroes behind the boss', () => {
    // Both tanks' charges grant 35% less damage taken, so they charge to brace against a buster.
    // Straight through the monster would land the buster on the Duelist, with no time for him to
    // step out of it: they charge another way, and land with him clear of it.
    for (const [weapon, charge] of [
      ['tank_greatsword', 'stalwartCharge'],
      ['sword_shield', 'flash'],
    ]) {
      for (const seed of [1, 2, 3]) {
        const { used, gaps } = busterOnTank(weapon!, seed);
        expect(used, `${weapon}, seed ${seed}`).toContain(charge);
        expect(gaps.get(charge!), `${weapon}, seed ${seed}`).toBeGreaterThan(3 + PLAYER_RADIUS + 0.5);
      }
    }
  });
});

