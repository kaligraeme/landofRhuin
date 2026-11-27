/**
 * The Flame Warden, the third Duelist: a fast, short-reaching glass cannon whose ultimate turns him
 * into the Firebeast for 5 seconds. The Firebeast only claws (potency 1000 a blow), refuses every
 * other skill, the Elixir and the dodge roll, and no monster can hurt it.
 */
import { describe, expect, it } from 'vitest';
import { taunt } from '../src/server/sim/aggro.js';
import { applyDamage, applyStatus, basicAttack, dodge, formOf, getStatus, useSkill } from '../src/server/sim/combat.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import { startAbility } from '../src/server/sim/mechanics.js';
import type { Monster, Player } from '../src/server/sim/types.js';
import { FORMS, HEROES, hotbarFor, ROLES, SKILLS, WEAPONS, weaponFor, type Delivery } from '../src/shared/content/classes.js';
import type { AbilityDef } from '../src/shared/content/monsters.js';
import { STATUSES } from '../src/shared/content/statuses.js';
import type { GameEvent } from '../src/shared/protocol.js';

const seats = (warden: string | null): Seat[] => [
  { ownerId: 'h1', name: 'Tank', role: 'tank', weapon: 'tank_greatsword' },
  { ownerId: 'h2', name: 'Mage', role: 'mage', weapon: 'staff' },
  { ownerId: 'h3', name: 'Ranger', role: 'ranger', weapon: 'bow' },
  { ownerId: warden, name: 'Warden', role: 'melee', weapon: 'flame_sword', hero: 'flameWarden' },
];

const run = (inst: Instance, seconds: number, each?: (ev: GameEvent) => void): void => {
  for (let i = 0; i < Math.round(seconds * 20); i++) {
    inst.tick();
    for (const ev of inst.drainEvents()) each?.(ev);
  }
};

/** A human Flame Warden in the open entrance hall, beside a training dummy that never hits back. */
function setup() {
  const inst = new Instance('fw', seats('h4'), { seed: 11, countdown: 0 });
  inst.tick();
  const warden = inst.players[3] as Player;
  const [tank, mage, ranger] = inst.players as [Player, Player, Player];
  const hall = inst.plan.rooms[0]!.center;
  warden.x = hall.x - 4;
  warden.y = hall.y;
  const dummy = inst.spawnMob('brute', warden.x + 2, warden.y, 0, 0);
  dummy.hp = dummy.maxHp = 1e9;
  dummy.speed = 0;
  dummy.autoInterval = 1e9;
  dummy.mob = { ...dummy.mob!, abilities: [] };
  inst.engage(dummy);
  dummy.autoNext = 1e9;
  warden.aim = { x: dummy.x, y: dummy.y };
  inst.drainEvents();
  return { inst, warden, tank, mage, ranger, dummy };
}

const transform = (inst: Instance, warden: Player, dummy: Monster): void => {
  expect(useSkill(inst, warden, 'firebeast', { x: dummy.x, y: dummy.y })).toBeNull();
  expect(formOf(warden)?.name).toBe('Firebeast');
};

const reach = (d: Delivery): number => (d.kind === 'arc' ? d.radius : d.kind === 'thrust' ? d.length : 0);

describe('the Flame Warden’s kit', () => {
  it('is the third Duelist: an Ember Blade with the quickest, shortest cuts and five fire skills', () => {
    expect(HEROES.flameWarden).toEqual({ id: 'flameWarden', role: 'melee', name: 'Flame Warden', weapon: 'flame_sword' });
    expect(ROLES.melee.heroes).toEqual(['dragoon', 'blademaster', 'flameWarden']);
    const blade = WEAPONS.flame_sword!;
    expect(blade).toMatchObject({ name: 'Ember Blade', role: 'melee', ranged: false });
    expect(hotbarFor('melee', 'flame_sword')).toEqual(['flame_sword.basic1', 'blazingCrescent', 'flashfire', 'infernoBurst', 'kindle', 'firebeast', 'bloodrush', 'secondWind', 'elixir', 'dodge']);

    // Ember Slash I, II, III: short arcs, the third wider, swung faster than any other Duelist's.
    const hits = blade.basic.hits.map((id) => SKILLS[id]!);
    expect(hits.map((s) => s.name)).toEqual(['Ember Slash I', 'Ember Slash II', 'Ember Slash III']);
    for (const s of hits) {
      expect(s.delivery.kind).toBe('arc');
      expect(reach(s.delivery)).toBeGreaterThanOrEqual(2.4);
      expect(reach(s.delivery)).toBeLessThanOrEqual(2.8);
    }
    const [first, , third] = hits.map((s) => s.delivery as Extract<Delivery, { kind: 'arc' }>);
    expect(third!.angle).toBeGreaterThan(first!.angle);
    expect(blade.basic.interval).toBeCloseTo(0.4);
    const others = ROLES.melee.heroes.filter((h) => h !== 'flameWarden').map((h) => WEAPONS[weaponFor(h)]!);
    for (const w of others) {
      expect(blade.basic.interval, w.name).toBeLessThan(w.basic.interval);
      // The trade-off: shorter reach than every other Duelist's basic attack.
      const theirs = Math.min(...w.basic.hits.map((id) => reach(SKILLS[id]!.delivery)));
      expect(Math.max(...hits.map((s) => reach(s.delivery))), w.name).toBeLessThanOrEqual(theirs);
    }

    const [special, q, e, r, ult] = blade.skills.map((id) => SKILLS[id]!);
    expect(special).toMatchObject({ name: 'Blazing Crescent', slot: 'special', delivery: { kind: 'projectile', pierce: true, look: 'flame' } });
    expect(q).toMatchObject({ name: 'Flashfire', slot: 'q', delivery: { kind: 'dash', distance: 6 } });
    expect(q!.effects).toContainEqual({ kind: 'status', status: 'burning', duration: 9, to: 'hit', potency: 60 });
    expect(e).toMatchObject({ name: 'Inferno Burst', slot: 'e', delivery: { kind: 'ground', radius: 3 } });
    expect((e!.delivery as Extract<Delivery, { kind: 'ground' }>).range).toBeLessThanOrEqual(3);
    expect(e!.effects.some((x) => x.kind === 'knockback')).toBe(true);
    expect(r).toMatchObject({ name: 'Kindle', slot: 'r' });
    expect(r!.effects).toEqual([{ kind: 'status', status: 'kindle', duration: 8, to: 'self' }]);
    expect(STATUSES.kindle).toMatchObject({ haste: 0.25, ignite: { potency: 60, duration: 6 } });
    expect(ult).toMatchObject({ name: 'Firebeast', slot: 'ult', windup: 0 });
    expect(ult!.effects).toEqual([{ kind: 'status', status: 'firebeast', duration: 5, to: 'self' }]);
    // The ultimate is far stronger than the others, so it waits longest.
    const ults = Object.values(WEAPONS).filter((w) => w.id !== 'flame_sword').map((w) => SKILLS[w.skills[4]]!.cooldown);
    expect(ult!.cooldown).toBe(90);
    expect(ult!.cooldown).toBeGreaterThan(Math.max(...ults));
    // The tooltip says how buffs treat the claws.
    expect(ult!.description).toMatch(/Bloodrush and the Echo of Rhuin still raise the claws’ damage/);
    expect(ult!.description).toMatch(/Kindle does not hurry them/);

    // The Firebeast's claw chain.
    const claws = FORMS.firebeast!.basic.hits.map((id) => SKILLS[id]!);
    expect(claws.map((s) => s.name)).toEqual(['Firebeast Claw I', 'Firebeast Claw II', 'Firebeast Claw III']);
    for (const s of claws) {
      expect(s.effects[0]).toEqual({ kind: 'damage', potency: 1000 });
      expect(s.delivery).toMatchObject({ kind: 'arc', radius: 3 });
    }
    expect(FORMS.firebeast!.basic.interval).toBeCloseTo(0.45);
  });

  it('Blazing Crescent pierces a line of foes; Flashfire burns what it dashes through; Inferno Burst throws foes back', () => {
    const { inst, warden, dummy } = setup();
    const second = inst.spawnMob('skirmisher', dummy.x + 2, dummy.y, 0, 0);
    second.hp = second.maxHp = 1e9;
    inst.engage(second);
    expect(useSkill(inst, warden, 'blazingCrescent', { x: dummy.x, y: dummy.y })).toBeNull();
    const struck = new Set<number>();
    run(inst, 0.6, (ev) => ev.e === 'dmg' && ev.n === 'Blazing Crescent' && struck.add(ev.t));
    expect(struck).toEqual(new Set([dummy.id, second.id]));

    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'flashfire', { x: dummy.x, y: dummy.y })).toBeNull();
    expect(getStatus(dummy, 'burning')).toMatchObject({ sourceId: warden.id });
    expect(getStatus(dummy, 'burning')!.potency).toBeGreaterThan(0);

    const loose = inst.spawnMob('skirmisher', warden.x + 2, warden.y, 0, 0);
    loose.hp = loose.maxHp = 1e9;
    const before = Math.hypot(loose.x - warden.x, loose.y - warden.y);
    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'infernoBurst', { x: loose.x, y: loose.y })).toBeNull();
    expect(Math.hypot(loose.x - warden.x, loose.y - warden.y)).toBeGreaterThan(before);
  });

  it('Kindle quickens the Ember Blade and sets every foe it strikes alight', () => {
    const { inst, warden, dummy } = setup();
    const swings = (): number => {
      let n = 0;
      warden.attacking = true;
      run(inst, 4, (ev) => ev.e === 'dmg' && ev.s === warden.id && ev.n?.startsWith('Ember Slash') && n++);
      warden.attacking = false;
      run(inst, 1.5);
      return n;
    };
    const plain = swings();
    expect(plain).toBeGreaterThanOrEqual(9);
    expect(getStatus(dummy, 'burning')).toBeUndefined();
    expect(useSkill(inst, warden, 'kindle', warden.aim)).toBeNull();
    expect(getStatus(warden, 'kindle')).toBeDefined();
    const kindled = swings();
    expect(kindled).toBeGreaterThanOrEqual(plain * 1.15);
    expect(getStatus(dummy, 'burning')).toMatchObject({ sourceId: warden.id });
  });
});

describe('the Firebeast', () => {
  it('lasts 5 seconds, then waits out a 90 second cooldown; clients hear when it starts and ends', () => {
    const { inst, warden, dummy } = setup();
    const events: GameEvent[] = [];
    transform(inst, warden, dummy);
    events.push(...inst.drainEvents());
    expect(events).toContainEqual({ e: 'status', i: warden.id, id: 'firebeast', gain: true });
    expect(events).toContainEqual({ e: 'act', i: warden.id, k: 'sk', s: 'firebeast' });
    const start = inst.now;
    expect(warden.cooldowns.get('firebeast')).toBeCloseTo(start + 90);
    let ended = -1;
    run(inst, 6, (ev) => {
      if (ev.e === 'status' && ev.i === warden.id && !ev.gain) ended = inst.now;
    });
    expect(ended - start).toBeGreaterThanOrEqual(5 - 1e-6);
    expect(ended - start).toBeLessThan(5.1);
    expect(formOf(warden)).toBeNull();
    // Back to the Warden: his skills answer, the Firebeast waits.
    expect(useSkill(inst, warden, 'blazingCrescent', warden.aim)).toBeNull();
    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'firebeast', warden.aim)).toBe('Not ready yet');
    inst.now = start + 90.01;
    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'firebeast', warden.aim)).toBeNull();
  });

  it('refuses every other skill, role skill, the Elixir and the dodge roll', () => {
    const { inst, warden, dummy } = setup();
    transform(inst, warden, dummy);
    run(inst, 0.5);
    const refusal = 'The Firebeast only has its claws';
    for (const id of warden.hotbar.filter((s) => s !== 'flame_sword.basic1' && s !== 'dodge')) {
      warden.lockUntil = 0;
      expect(useSkill(inst, warden, id, warden.aim), id).toBe(refusal);
    }
    const stamina = warden.stamina;
    expect(dodge(inst, warden, 1, 0)).toBe(refusal);
    expect(warden.stamina).toBe(stamina);
    expect(getStatus(warden, 'evasion')).toBeUndefined();
    // A player's requests are refused out loud.
    const sent: string[] = [];
    inst.sendPrivate = (_p, msg) => msg.t === 'skillFail' && sent.push(msg.reason);
    inst.requestSkill(warden, 'elixir', warden.aim);
    inst.requestDodge(warden, 0, 1);
    expect(sent).toEqual([refusal, refusal]);
    // Once it ends, all of it answers again.
    run(inst, 5);
    expect(dodge(inst, warden, 1, 0)).toBeNull();
    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'bloodrush', warden.aim)).toBeNull();
  });

  it('claws at potency 1000 every 0.45 seconds, whatever Kindle says, and Bloodrush still raises them', () => {
    const { inst, warden, dummy } = setup();
    // Beyond the Ember Blade's reach, inside the claws'.
    warden.x = dummy.x - dummy.radius - warden.radius - 2.9;
    warden.y = dummy.y;
    warden.aim = { x: dummy.x, y: dummy.y };
    const ember = WEAPONS.flame_sword!.basic.hits.map((id) => SKILLS[id]!.delivery).map(reach);
    expect(Math.max(...ember) + warden.radius).toBeLessThan(dummy.x - warden.x - dummy.radius);
    applyStatus(inst, warden, 'kindle', 30, warden.id);
    const power = ROLES.melee.power / 100;
    const claws: { at: number; name: string; v: number; crit: boolean }[] = [];
    const watch = (ev: GameEvent): void => {
      if (ev.e === 'dmg' && ev.s === warden.id && ev.t === dummy.id && ev.n?.startsWith('Firebeast Claw')) claws.push({ at: inst.now, name: ev.n, v: ev.v, crit: !!ev.c });
    };
    const start = inst.now;
    transform(inst, warden, dummy);
    warden.attacking = true;
    run(inst, 5.5, watch);
    // Ten claws in the 5 seconds: the first once the form has taken shape, then one every 0.45s.
    expect(claws.map((c) => c.name)).toEqual(['I', 'II', 'III', 'I', 'II', 'III', 'I', 'II', 'III', 'I'].map((n) => `Firebeast Claw ${n}`));
    expect(claws[0]!.at - start).toBeGreaterThanOrEqual(FORMS.firebeast!.emerge - 1e-6);
    for (let i = 1; i < claws.length; i++) expect(claws[i]!.at - claws[i - 1]!.at).toBeCloseTo(0.45, 1);
    for (const c of claws) {
      const base = 1000 * power * (c.crit ? 1.5 : 1);
      expect(c.v).toBeGreaterThanOrEqual(Math.floor(base * 0.95));
      expect(c.v).toBeLessThanOrEqual(Math.ceil(base * 1.05));
    }

    // Bloodrush (used before the form: role skills wait during it) raises every claw by a quarter.
    run(inst, 1);
    claws.length = 0;
    warden.cooldowns.clear();
    warden.lockUntil = 0;
    expect(useSkill(inst, warden, 'bloodrush', warden.aim)).toBeNull();
    warden.lockUntil = 0;
    transform(inst, warden, dummy);
    run(inst, 5, watch);
    expect(claws.length).toBe(10);
    for (const c of claws) {
      const base = 1000 * power * 1.25 * (c.crit ? 1.5 : 1);
      expect(c.v).toBeGreaterThanOrEqual(Math.floor(base * 0.95));
      expect(c.v).toBeLessThanOrEqual(Math.ceil(base * 1.05));
    }
  });

  it('starts the claw chain afresh, and the Ember Blade’s chain afresh after it', () => {
    const { inst, warden, dummy } = setup();
    basicAttack(inst, warden);
    expect(warden.chain).toBe(1);
    warden.basicReadyAt = 0;
    transform(inst, warden, dummy);
    expect(warden.chain).toBe(0);
    expect(warden.basicReadyAt).toBeCloseTo(inst.now + FORMS.firebeast!.emerge);
    inst.now = warden.basicReadyAt;
    inst.drainEvents();
    basicAttack(inst, warden);
    expect(inst.drainEvents()).toContainEqual({ e: 'act', i: warden.id, k: 'atk', c: 0, s: 'firebeast.basic1' });
    run(inst, 5);
    expect(formOf(warden)).toBeNull();
    expect(warden.chain).toBe(0);
    warden.basicReadyAt = 0;
    basicAttack(inst, warden);
    expect(inst.drainEvents()).toContainEqual({ e: 'act', i: warden.id, k: 'atk', c: 0 });
  });

  it('takes no damage from monsters: blows, shots, ground mechanics and damage over time', () => {
    const { inst, warden, tank, dummy } = setup();
    tank.maxHp = tank.hp = 1e6;
    const boss = [...inst.monsters.values()].find((m) => m.kind === 'boss')!;
    const hits = { immune: 0, taken: 0 };
    const watch = (ev: GameEvent): void => {
      if (ev.e === 'fx' && ev.k === 'immune' && ev.t === warden.id) hits.immune++;
      if (ev.e === 'dmg' && ev.t === warden.id) hits.taken++;
    };
    const near = (m: Monster, d = 1.5): void => {
      m.x = warden.x + d;
      m.y = warden.y;
    };
    transform(inst, warden, dummy);
    warden.maxHp = 1e6;
    warden.hp = warden.maxHp;
    // Keep him transformed through every trial.
    const hold = (): void => {
      getStatus(warden, 'firebeast')!.expires = inst.now + 60;
    };
    const trial = (name: string, fn: () => void, seconds = 2.5): void => {
      hold();
      const before = { ...hits };
      fn();
      run(inst, seconds, watch);
      expect(warden.hp, name).toBe(warden.maxHp);
      expect(hits.immune, name).toBeGreaterThan(before.immune);
      expect(hits.taken, name).toBe(0);
    };

    // A monster's routine swings, on whoever holds its aggro.
    const brute = inst.spawnMob('brute', warden.x + 1.2, warden.y, 0, 0);
    brute.hp = brute.maxHp = 1e9;
    inst.engage(brute);
    taunt(brute, warden);
    trial('routine swings', () => undefined, 4);
    // Every pattern a monster or boss can throw at him.
    const patterns: AbilityDef['pattern'][] = [
      { kind: 'cleave', radius: 4, angle: Math.PI },
      { kind: 'pbaoe', radius: 6 },
      { kind: 'donut', inner: 0.5, radius: 8 },
      { kind: 'targetCircle', radius: 3 },
      { kind: 'puddles', radius: 3 },
      { kind: 'lines', count: 4, length: 20, width: 3 },
      { kind: 'cross', length: 30, width: 4 },
      { kind: 'charge', width: 4 },
      { kind: 'tankbuster', radius: 3 },
      { kind: 'raidwide' },
      { kind: 'stack', radius: 4 },
      { kind: 'spread', radius: 4 },
      { kind: 'knockback', distance: 2 },
      { kind: 'bolt' },
      { kind: 'shot', speed: 20, radius: 0.5 },
      { kind: 'enrage' },
    ];
    for (const pattern of patterns) {
      trial(pattern.kind, () => {
        near(boss, 3);
        boss.targetId = warden.id;
        boss.cast = null;
        startAbility(inst, boss, { id: pattern.kind, name: pattern.kind, cast: 0.5, potency: 3000, pattern });
      });
    }
    // A boss's blow straight on him, and an archer's arrow in flight.
    trial('a boss’s blow', () => applyDamage(inst, boss, warden, 9000, { name: 'Attack' }), 0.1);
    trial('an arrow', () => inst.spawnProjectile({ ownerId: brute.id, team: 'enemy', x: warden.x + 3, y: warden.y, dir: Math.PI, speed: 20, radius: 0.4, range: 10, pierce: false, explode: 0, look: 'enemy', hue: 0, skill: null, potency: 4000, name: 'Arrow' }), 0.5);
    // Damage over time, and a bleed whose monster has since fallen.
    trial('a bleed', () => applyStatus(inst, warden, 'bleed', 9, brute.id, 800), 7);
    trial('an orphaned bleed', () => {
      applyStatus(inst, warden, 'burning', 9, brute.id, 800);
      inst.kill(brute, tank);
    }, 7);
    expect(getStatus(warden, 'vuln')).toBeUndefined();

    // The others in the blast are hurt as ever, and once the form ends, so is he.
    tank.x = warden.x;
    tank.y = warden.y + 1;
    const tankHp = tank.hp;
    getStatus(warden, 'firebeast')!.expires = inst.now + 0.01;
    run(inst, 0.2);
    expect(formOf(warden)).toBeNull();
    startAbility(inst, boss, { id: 'slam', name: 'Slam', cast: 0.3, potency: 3000, pattern: { kind: 'pbaoe', radius: 30 } });
    run(inst, 0.5);
    expect(warden.hp).toBeLessThan(warden.maxHp);
    expect(tank.hp).toBeLessThan(tankHp);
  });

  it('ends when he falls, and does not come back with him', () => {
    const { inst, warden, tank, dummy } = setup();
    transform(inst, warden, dummy);
    inst.drainEvents();
    inst.kill(warden, null);
    expect(inst.drainEvents()).toContainEqual({ e: 'status', i: warden.id, id: 'firebeast', gain: false });
    expect(formOf(warden)).toBeNull();
    inst.revive(warden, 0.5);
    expect(formOf(warden)).toBeNull();
    expect(warden.statuses.some((s) => STATUSES[s.id]?.form)).toBe(false);
    expect(tank.dead).toBe(false);
  });
});

describe('an AI Flame Warden', () => {
  /** A bot Warden, with the tank holding a pack and everyone else out of the fight. */
  function fight(pack: { kind: 'brute' | 'skirmisher'; hp: number }[]) {
    const inst = new Instance('ai', seats(null), { seed: 5, countdown: 0 });
    inst.tick();
    const warden = inst.players[3] as Player;
    const tank = inst.players[0] as Player;
    for (const o of inst.players.slice(1, 3)) o.x += 400;
    tank.botControlled = false;
    tank.maxHp = tank.hp = 1e9;
    tank.x = warden.x + 6;
    tank.y = warden.y;
    const mobs = pack.map((spec, i) => {
      const m = inst.spawnMob(spec.kind, warden.x + 3.5, warden.y + (i - (pack.length - 1) / 2) * 1.2, 0, 0);
      m.hp = m.maxHp = spec.hp;
      m.speed = 0;
      inst.engage(m);
      taunt(m, tank);
      return m;
    });
    return { inst, warden, tank, mobs };
  }

  /** Ticks the fight, the monsters held on the tank, handing each event to `each`. */
  const tick = (inst: Instance, mobs: Monster[], tank: Player, seconds: number, each: (ev: GameEvent) => void, before?: () => void): void => {
    for (let i = 0; i < Math.round(seconds * 20); i++) {
      for (const m of mobs) m.enmity.set(tank.id, 1e12);
      before?.();
      inst.tick();
      for (const ev of inst.drainEvents()) each(ev);
    }
  };
  const slam = (inst: Instance, m: Monster): void => {
    startAbility(inst, m, { id: 'slam', name: 'Slam', cast: 1.2, potency: 3000, pattern: { kind: 'puddles', radius: 6 } });
  };
  const pack = (): { kind: 'brute' | 'skirmisher'; hp: number }[] => [
    { kind: 'brute', hp: 2e6 },
    { kind: 'brute', hp: 2e6 },
    { kind: 'skirmisher', hp: 2e6 },
  ];

  it('rolls out of a blast marked on him while he is the Warden', () => {
    const { inst, warden, tank, mobs } = fight(pack());
    warden.cooldowns.set('firebeast', 1e9);
    let rolls = 0;
    tick(inst, mobs, tank, 2, () => undefined);
    slam(inst, mobs[0]!);
    tick(inst, mobs, tank, 1.5, (ev) => ev.e === 'fx' && ev.k === 'roll' && ev.s === warden.id && rolls++);
    expect(rolls).toBeGreaterThan(0);
  });

  it('takes the form when a fight worth it is on, then only claws: no skills and no rolls', () => {
    const { inst, warden, tank, mobs } = fight(pack());
    let formAt = -1;
    let endAt = -1;
    let marked = false;
    const during: GameEvent[] = [];
    let clawDamage = 0;
    let usedAfter = 0;
    const inForm = (): boolean => formAt >= 0 && endAt < 0;
    tick(
      inst,
      mobs,
      tank,
      14,
      (ev) => {
        if (ev.e === 'status' && ev.i === warden.id) {
          if (ev.gain) formAt = inst.now;
          else endAt = inst.now;
        }
        if (inForm() && ((ev.e === 'act' && ev.i === warden.id && ev.k === 'sk') || (ev.e === 'fx' && ev.k === 'roll' && ev.s === warden.id))) during.push(ev);
        if (ev.e === 'dmg' && ev.s === warden.id && ev.n?.startsWith('Firebeast Claw')) clawDamage += ev.v;
        if (endAt >= 0 && ev.e === 'act' && ev.i === warden.id && ev.k === 'sk') usedAfter++;
      },
      () => {
        // A blast marked on him a second into the form: the Warden rolls out of these, the Firebeast does not.
        if (inForm() && !marked && inst.now - formAt > 1) {
          marked = true;
          slam(inst, mobs[0]!);
        }
      },
    );
    expect(formAt).toBeGreaterThanOrEqual(0);
    expect(formAt).toBeLessThan(3);
    expect(marked).toBe(true);
    expect(endAt - formAt).toBeCloseTo(5, 0);
    expect(during).toEqual([]);
    expect(clawDamage).toBeGreaterThan(20 * 1000 * 3.2);
    // Back to the Warden, he uses his skills again.
    expect(usedAfter).toBeGreaterThan(0);
  });

  it('leaves the AI tank’s taunt for when the form ends: a monster on the Firebeast cannot hurt it', () => {
    const inst = new Instance('taunt', [{ ...seats(null)[0]!, ownerId: null }, ...seats('h4').slice(1)], { seed: 5, countdown: 0 });
    inst.tick();
    const [tank, , , warden] = inst.players as [Player, Player, Player, Player];
    for (const o of inst.players.slice(1, 3)) o.x += 400;
    tank.x = warden.x + 1;
    tank.y = warden.y + 1;
    const brute = inst.spawnMob('brute', warden.x + 2, warden.y, 0, 0);
    brute.hp = brute.maxHp = 1e9;
    inst.engage(brute);
    taunt(brute, warden);
    applyStatus(inst, warden, 'firebeast', 60, warden.id);
    const taunts = (seconds: number): number => {
      let n = 0;
      for (let i = 0; i < seconds * 20; i++) {
        brute.enmity.set(warden.id, 1e9);
        inst.tick();
        for (const ev of inst.drainEvents()) if (ev.e === 'act' && ev.i === tank.id && ev.s === 'challenge') n++;
      }
      return n;
    };
    expect(taunts(3)).toBe(0);
    expect(brute.targetId).toBe(warden.id);
    getStatus(warden, 'firebeast')!.expires = inst.now;
    let n = 0;
    for (let i = 0; i < 60 && !n; i++) {
      inst.tick();
      for (const ev of inst.drainEvents()) if (ev.e === 'act' && ev.i === tank.id && ev.s === 'challenge') n++;
    }
    expect(n).toBe(1);
    expect(brute.targetId).toBe(tank.id);
  });

  it('keeps the form for a fight worth it, not for a stray foe nearly done', () => {
    const { inst, warden, mobs, tank } = fight([{ kind: 'skirmisher', hp: 2000 }]);
    let forms = 0;
    tick(inst, mobs, tank, 2, (ev) => ev.e === 'status' && ev.gain && ev.i === warden.id && forms++);
    expect(forms).toBe(0);
  });
});
