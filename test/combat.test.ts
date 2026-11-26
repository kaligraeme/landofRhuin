import { describe, expect, it } from 'vitest';
import { applyDamage, applyStatus, basicAttack, dodge, getStatus, statSum, useSkill } from '../src/server/sim/combat.js';
import { lineOfSight, T_FLOOR, T_WALL, tileAt } from '../src/shared/map.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import { startAbility } from '../src/server/sim/mechanics.js';
import type { Monster } from '../src/server/sim/types.js';
import { DEFAULT_LOOK, hotbarFor, ROLES, SKILLS, WEAPONS, weaponFor } from '../src/shared/content/classes.js';
import { STATUSES } from '../src/shared/content/statuses.js';
import type { GameEvent } from '../src/shared/protocol.js';

const seats: Seat[] = [
  { ownerId: 'h1', name: 'Warrior', role: 'tank', weapon: 'tank_greatsword' },
  { ownerId: 'h2', name: 'Mage', role: 'mage', weapon: 'staff' },
  { ownerId: 'h3', name: 'Ranger', role: 'ranger', weapon: 'bow' },
  { ownerId: 'h4', name: 'Duelist', role: 'melee', weapon: 'greatsword' },
];

function setup() {
  const inst = new Instance('t', seats, { seed: 7, countdown: 0 });
  inst.tick();
  const [tank, mage, ranger, melee] = inst.players;
  const dummy = inst.spawnMob('brute', tank!.x + 2, tank!.y, 0, 0);
  dummy.hp = dummy.maxHp = 1e9;
  dummy.speed = 0;
  dummy.autoInterval = 1e9;
  dummy.mob = { ...dummy.mob!, abilities: [] };
  inst.engage(dummy);
  dummy.autoNext = 1e9;
  return { inst, tank: tank!, mage: mage!, ranger: ranger!, melee: melee!, dummy };
}
const lineOfSightClear = (inst: Instance, a: { x: number; y: number }, b: { x: number; y: number }) => lineOfSight(inst.map, a, b);
const run = (inst: Instance, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) inst.tick();
};

describe('content', () => {
  it('matches the role and weapon design', () => {
    // Each hero carries one weapon: the man's first, then the woman's.
    expect(ROLES.tank.weapons.map((w) => WEAPONS[w]!.name)).toEqual(['Greatsword', 'Sword & Shield']);
    expect(ROLES.mage.weapons.map((w) => WEAPONS[w]!.name)).toEqual(['Staff', 'Mystic Sword & Wand']);
    expect(ROLES.ranger.weapons.map((w) => WEAPONS[w]!.name)).toEqual(['Crossbow', 'Longbow']);
    expect(ROLES.melee.weapons.map((w) => WEAPONS[w]!.name)).toEqual(['Halberd', 'Twin Blades']);
    expect(weaponFor('tank', 'female')).toBe('sword_shield');
    expect(weaponFor('mage', DEFAULT_LOOK.mage)).toBe('staff');
    // Tanks are the sturdiest; rangers and melee are glass cannons, melee hitting hardest.
    expect(ROLES.tank.hp).toBeGreaterThan(ROLES.melee.hp);
    expect(ROLES.tank.stamina).toBeGreaterThan(ROLES.melee.stamina);
    expect(ROLES.melee.power).toBeGreaterThan(ROLES.ranger.power);
    expect(ROLES.ranger.power).toBeGreaterThan(ROLES.mage.power);
    expect(ROLES.melee.defense).toBeGreaterThan(1);
    expect(ROLES.ranger.defense).toBeGreaterThan(1);
    // The tank has a party defence buff.
    expect(ROLES.tank.roleSkills).toContain('rallyingBulwark');
  });

  it('every weapon has a three-hit chain and five skills, and every reference resolves', () => {
    for (const role of Object.values(ROLES)) {
      for (const w of role.weapons) {
        const weapon = WEAPONS[w]!;
        expect(weapon.basic.hits).toHaveLength(3);
        expect(weapon.skills).toHaveLength(5);
        expect(weapon.skills.map((id) => SKILLS[id]!.slot)).toEqual(['special', 'q', 'e', 'r', 'ult']);
        expect(hotbarFor(role.id, w)).toHaveLength(10);
      }
    }
    for (const s of Object.values(SKILLS)) for (const e of s.effects) if (e.kind === 'status') expect(STATUSES[e.status], `${s.id} -> ${e.status}`).toBeDefined();
  });
});

describe('action combat', () => {
  it('basic attacks swing toward the aim and only hit what is in front', () => {
    const { inst, melee, dummy } = setup();
    melee.x = dummy.x - 2;
    melee.y = dummy.y;
    melee.aim = { x: dummy.x, y: dummy.y };
    basicAttack(inst, melee);
    const hit = melee.stats.damage;
    expect(hit).toBeGreaterThan(0);
    melee.aim = { x: melee.x - 5, y: melee.y }; // facing away
    melee.basicReadyAt = 0;
    basicAttack(inst, melee);
    expect(melee.stats.damage).toBe(hit);
  });

  it('holding attack runs the three-hit chain at the weapon’s pace', () => {
    const { inst, melee, dummy } = setup();
    melee.x = dummy.x - 2;
    melee.y = dummy.y;
    melee.aim = { x: dummy.x, y: dummy.y };
    melee.attacking = true;
    const hits: string[] = [];
    for (let i = 0; i < 60; i++) {
      inst.tick();
      for (const ev of inst.drainEvents()) if (ev.e === 'dmg' && ev.s === melee.id && ev.n) hits.push(ev.n);
    }
    // 3 seconds at 0.8s per swing.
    expect(hits.length).toBeGreaterThanOrEqual(3);
    expect(hits.slice(0, 3)).toEqual(['Twin Slash I', 'Twin Slash II', 'Twin Slash III']);
  });

  it('projectiles fly to the target, and walls stop them', () => {
    const { inst, ranger, dummy } = setup();
    ranger.x = dummy.x - 4;
    ranger.y = dummy.y;
    ranger.aim = { x: dummy.x, y: dummy.y };
    basicAttack(inst, ranger);
    expect(inst.projectiles.size).toBe(1);
    expect(ranger.stats.damage).toBe(0);
    run(inst, 0.5);
    expect(ranger.stats.damage).toBeGreaterThan(0);
    expect(inst.projectiles.size).toBe(0);
  });

  it('a dodge roll costs stamina and makes you untouchable for a moment', () => {
    const { inst, ranger, dummy } = setup();
    const st = ranger.stamina;
    expect(dodge(inst, ranger, 1, 0)).toBeNull();
    expect(ranger.stamina).toBe(st - 30);
    const hp = ranger.hp;
    startAbility(inst, dummy, { id: 'x', name: 'Test Slam', cast: 0.1, potency: 2000, pattern: { kind: 'puddles', radius: 3 } });
    run(inst, 0.15);
    expect(ranger.hp).toBe(hp);
    // Out of stamina, no more rolls.
    ranger.stamina = 10;
    expect(dodge(inst, ranger, 1, 0)).toBe('Not enough stamina');
  });

  it('skills respect cooldowns, and wind-ups break when you move', () => {
    const { inst, melee, dummy } = setup();
    melee.x = dummy.x - 2;
    melee.y = dummy.y;
    const aim = { x: dummy.x, y: dummy.y };
    expect(useSkill(inst, melee, 'whirlwind', aim)).toBeNull();
    run(inst, 0.3);
    expect(useSkill(inst, melee, 'whirlwind', aim)).toBe('Not ready yet');
    expect(useSkill(inst, melee, 'executioner', aim)).toBeNull();
    expect(melee.cast).not.toBeNull();
    melee.x -= 1;
    inst.tick();
    expect(melee.cast).toBeNull();
  });

  it('the Staff heals allies inside the circle it is aimed at, and raises the fallen', () => {
    const { inst, mage, tank, melee } = setup();
    tank.hp = 3000;
    melee.x = tank.x + 1;
    melee.y = tank.y;
    inst.kill(melee, null);
    expect(useSkill(inst, mage, 'mendingLight', { x: tank.x, y: tank.y })).toBeNull();
    run(inst, 0.5);
    expect(tank.hp).toBeGreaterThan(4000);
    mage.lockUntil = 0;
    expect(useSkill(inst, mage, 'resurrection', { x: melee.x, y: melee.y })).toBeNull();
    run(inst, 1.6);
    expect(melee.dead).toBe(false);
  });

  it('Challenge taunts every enemy nearby, and Rallying Bulwark shields the party', () => {
    const { inst, tank, ranger, mage, dummy } = setup();
    dummy.enmity.set(ranger.id, 50000);
    useSkill(inst, tank, 'challenge', { x: dummy.x, y: dummy.y });
    inst.tick();
    expect(dummy.targetId).toBe(tank.id);
    tank.lockUntil = 0;
    mage.x = tank.x + 3;
    useSkill(inst, tank, 'rallyingBulwark', tank);
    expect(mage.statuses.some((s) => s.id === 'bulwark')).toBe(true);
    expect(mage.statuses.some((s) => s.id === 'barrier')).toBe(true);
  });

  it('crowd control stuns monsters and staggers bosses', () => {
    const { inst, tank, dummy } = setup();
    tank.x = dummy.x - 2;
    useSkill(inst, tank, 'stalwartCharge', { x: dummy.x + 4, y: dummy.y });
    expect(dummy.statuses.some((s) => s.id === 'stun')).toBe(true);
    const boss = [...inst.monsters.values()].find((m) => m.kind === 'boss') as Monster;
    boss.stagger = boss.staggerMax - 10;
    tank.x = boss.x - boss.radius - 3;
    tank.y = boss.y;
    tank.cooldowns.clear();
    tank.lockUntil = 0;
    useSkill(inst, tank, 'stalwartCharge', { x: boss.x, y: boss.y });
    expect(boss.statuses.some((s) => s.id === 'staggered')).toBe(true);
    expect(boss.stagger).toBe(0);
  });

  it('the Dark Knight charges in, sweeps, drains life and bleeds for Ruination', () => {
    const { inst, tank, dummy } = setup();
    expect(hotbarFor('tank', 'tank_greatsword').slice(1, 6)).toEqual(['parry', 'stalwartCharge', 'eclipse', 'drain', 'ruination']);
    expect(WEAPONS.tank_greatsword!.style).toBe('Dark Knight');
    // Stalwart Charge: a dash through the foe, a stun, a big lump of aggro and a guard on himself.
    tank.x = dummy.x - 4;
    tank.y = dummy.y;
    expect(useSkill(inst, tank, 'stalwartCharge', { x: dummy.x + 3, y: dummy.y })).toBeNull();
    expect(dummy.statuses.some((s) => s.id === 'stun')).toBe(true);
    expect(statSum(tank, 'dmgTaken')).toBeCloseTo(-0.35);
    expect(dummy.enmity.get(tank.id) ?? 0).toBeGreaterThan(3000);
    // Eclipse: everything around him is slowed.
    tank.lockUntil = 0;
    tank.x = dummy.x - 2;
    expect(useSkill(inst, tank, 'eclipse', dummy)).toBeNull();
    expect(dummy.statuses.some((s) => s.id === 'slow')).toBe(true);
    // Drain heals him for a share of what it deals.
    tank.lockUntil = 0;
    tank.hp = 6000;
    const before = dummy.hp;
    expect(useSkill(inst, tank, 'drain', dummy)).toBeNull();
    const dealt = before - dummy.hp;
    expect(tank.hp - 6000).toBeCloseTo(dealt * 0.6, -1);
    // Ruination costs half his health (it never kills) and strikes four times.
    tank.lockUntil = 0;
    tank.hp = tank.maxHp;
    const hpBefore = dummy.hp;
    expect(useSkill(inst, tank, 'ruination', dummy)).toBeNull();
    expect(tank.hp).toBe(tank.maxHp - tank.maxHp * 0.5);
    let strikes = 0;
    let last = dummy.hp;
    for (let i = 0; i < 40; i++) {
      inst.tick();
      if (dummy.hp < last) strikes++;
      last = dummy.hp;
    }
    expect(strikes).toBe(4);
    expect(hpBefore - dummy.hp).toBeGreaterThan(4 * 700 * 2 * 0.9);
    tank.cooldowns.clear();
    tank.lockUntil = 0;
    tank.hp = 100;
    useSkill(inst, tank, 'ruination', dummy);
    expect(tank.hp).toBe(1);
  });

  it('Ruination stops raining when the Dark Knight falls', () => {
    const { inst, tank, dummy } = setup();
    tank.x = dummy.x - 4;
    tank.y = dummy.y;
    expect(useSkill(inst, tank, 'ruination', dummy)).toBeNull();
    let last = dummy.hp;
    let strikes = 0;
    for (let i = 0; i < 40; i++) {
      inst.tick();
      if (dummy.hp < last) {
        strikes++;
        if (strikes === 1) inst.kill(tank, null);
      }
      last = dummy.hp;
    }
    expect(strikes).toBe(1);
    expect(dummy.enmity.has(tank.id)).toBe(false);
  });

  it('Challenge turns every foe within 9 tiles, even round a pillar; Luminaire needs sight', () => {
    const inst = new Instance('c', seats.map((seat) => (seat.role === 'tank' ? { ...seat, weapon: 'sword_shield' } : seat)), { seed: 7, countdown: 0 });
    inst.tick();
    const tank = inst.players[0]!;
    const melee = inst.players[3]!;
    // Find a wall with floor three tiles either side of it.
    const { map } = inst;
    let spot: { x: number; y: number } | null = null;
    for (let y = 2; y < map.h - 2 && !spot; y++) {
      for (let x = 4; x < map.w - 4 && !spot; x++) {
        if (tileAt(map, x, y) !== T_WALL) continue;
        if (tileAt(map, x - 3, y) === T_FLOOR && tileAt(map, x + 3, y) === T_FLOOR) spot = { x, y };
      }
    }
    expect(spot).not.toBeNull();
    tank.x = spot!.x - 2.5;
    tank.y = spot!.y + 0.5;
    const foe = inst.spawnMob('brute', spot!.x + 3.5, spot!.y + 0.5, 0, 0);
    foe.hp = foe.maxHp = 1e9;
    foe.speed = 0;
    inst.engage(foe);
    expect(lineOfSightClear(inst, tank, foe)).toBe(false);
    foe.enmity.set(melee.id, 50000);
    foe.targetId = melee.id;
    expect(useSkill(inst, tank, 'challenge', tank)).toBeNull();
    expect(foe.targetId).toBe(tank.id);
    tank.lockUntil = 0;
    tank.cast = null;
    const hpBefore = foe.hp;
    expect(useSkill(inst, tank, 'luminaire', tank)).toBeNull();
    run(inst, 0.8);
    expect(foe.hp).toBe(hpBefore);
  });

  it('the Guardian flashes in, mends herself, blocks and bursts back, and floods the field with light', () => {
    const inst = new Instance('g', seats.map((seat) => (seat.role === 'tank' ? { ...seat, weapon: 'sword_shield' } : seat)), { seed: 7, countdown: 0 });
    inst.tick();
    const [tank, , ranger] = inst.players as [typeof inst.players[0], typeof inst.players[0], typeof inst.players[0]];
    expect(hotbarFor('tank', 'sword_shield').slice(1, 6)).toEqual(['aegis', 'flash', 'mend', 'shieldsUp', 'luminaire']);
    const foe = inst.spawnMob('brute', tank.x + 4, tank.y, 0, 0);
    foe.hp = foe.maxHp = 1e9;
    foe.speed = 0;
    foe.autoInterval = 1e9;
    foe.mob = { ...foe.mob!, abilities: [] };
    inst.engage(foe);
    foe.autoNext = 1e9;
    // Flash: like Stalwart Charge, with a radiant guard.
    expect(useSkill(inst, tank, 'flash', { x: foe.x + 3, y: foe.y })).toBeNull();
    expect(foe.statuses.some((s) => s.id === 'stun')).toBe(true);
    expect(getStatus(tank, 'radiantGuard')).toBeDefined();
    // Mend: heals her and draws a foe that has turned on the ranger back to her, even while it
    // is still stunned from Flash.
    const aggroBefore = foe.enmity.get(tank.id) ?? 0;
    foe.enmity.set(ranger.id, aggroBefore * 1.3 + 2000);
    foe.targetId = ranger.id;
    tank.lockUntil = 0;
    tank.hp = 5000;
    expect(useSkill(inst, tank, 'mend', tank)).toBeNull();
    expect(tank.hp).toBeCloseTo(5000 + tank.maxHp * 0.18, -1);
    expect((foe.enmity.get(tank.id) ?? 0) - aggroBefore).toBeGreaterThan(2500);
    inst.tick();
    expect(foe.statuses.some((s) => s.id === 'stun')).toBe(true);
    expect(foe.targetId).toBe(tank.id);
    // Shield's Up!: nothing gets through for 3s, then 30% of it comes back.
    tank.lockUntil = 0;
    tank.hp = tank.maxHp;
    tank.x = foe.x - foe.radius - 1;
    tank.statuses = []; // Flash's dodge frames and guard would change the sums below.
    expect(useSkill(inst, tank, 'shieldsUp', tank)).toBeNull();
    applyDamage(inst, foe, tank, 5000);
    applyDamage(inst, foe, tank, 3000);
    expect(tank.hp).toBe(tank.maxHp);
    const foeBefore = foe.hp;
    run(inst, 3.2);
    expect(getStatus(tank, 'shieldsUp')).toBeUndefined();
    const absorbed = (5000 + 3000) * tank.defense;
    expect(foeBefore - foe.hp).toBeCloseTo(absorbed * 0.3, -1);
    // Luminaire: every enemy she can see, however far.
    const far = inst.spawnMob('skirmisher', tank.x - 20, tank.y, 0, 0);
    far.hp = far.maxHp = 1e9;
    tank.lockUntil = 0;
    tank.cast = null;
    expect(useSkill(inst, tank, 'luminaire', tank)).toBeNull();
    run(inst, 0.8);
    const seen = [foe, far].map((m) => m.hp < m.maxHp);
    expect(seen).toEqual([true, lineOfSightClear(inst, tank, far)]);
  });

  it('statuses stack and add up', () => {
    const { inst, tank } = setup();
    applyStatus(inst, tank, 'vuln', 10, 0);
    applyStatus(inst, tank, 'vuln', 10, 0);
    applyStatus(inst, tank, 'bulwark', 10, 0);
    expect(statSum(tank, 'dmgTaken')).toBeCloseTo(0.25 * 2 - 0.2);
  });
});

describe('boss mechanics', () => {
  it('a cleave aimed at the target hits with the monster’s full weight; a tail lash behind it does not', () => {
    const inst = new Instance('r', seats, { seed: 3, countdown: 0 });
    inst.tick();
    const [tank, , , melee] = inst.players as [typeof inst.players[0], typeof inst.players[0], typeof inst.players[0], typeof inst.players[0]];
    const m = inst.spawnMob('brute', tank.x, tank.y, 0, 0);
    m.speed = 0;
    m.autoInterval = 1e9;
    m.mob = { ...m.mob!, abilities: [] };
    inst.engage(m);
    m.autoNext = 1e9;
    const hitFor = (rear: boolean, behind: boolean): number => {
      tank.x = m.x + 3;
      tank.y = m.y;
      melee.x = m.x + (behind ? -3 : 3);
      melee.y = m.y + (behind ? 0 : 0.8);
      melee.hp = melee.maxHp;
      melee.statuses = [];
      m.targetId = tank.id;
      m.enmity.set(tank.id, 1e6);
      startAbility(inst, m, { id: 'lash', name: 'Lash', cast: 0.5, potency: 1000, pattern: { kind: 'cleave', radius: 5, angle: Math.PI / 2, rear } });
      run(inst, 0.7);
      return melee.maxHp - melee.hp;
    };
    const front = hitFor(false, false);
    const rear = hitFor(true, true);
    expect(front).toBeGreaterThan(0);
    expect(rear).toBeGreaterThan(0);
    expect(front / rear).toBeGreaterThan(2.5);
  });

  it('a stack shares damage among everyone inside it', () => {
    const inst = new Instance('s', seats, { seed: 3, countdown: 0 });
    inst.tick();
    const boss = [...inst.monsters.values()].find((m) => m.kind === 'boss') as Monster;
    for (const p of inst.players) {
      p.x = boss.x + 6;
      p.y = boss.y;
    }
    boss.targetId = inst.players[0]!.id;
    const before = inst.players.map((p) => p.hp);
    startAbility(inst, boss, { id: 'x', name: 'Test Stack', cast: 1, potency: 8000, pattern: { kind: 'stack', radius: 4 } });
    for (let i = 0; i < 25; i++) inst.tick();
    const taken = inst.players.map((p, i) => before[i]! - p.hp);
    for (const t of taken) expect(t).toBeGreaterThan(0);
    for (const t of taken) expect(t).toBeLessThan((8000 / 4) * 1.6);
  });
});

describe('animation events', () => {
  it('tells clients when heroes attack or use skills, and how long they wind up', () => {
    const { inst, melee, mage } = setup();
    inst.drainEvents();
    basicAttack(inst, melee);
    expect(inst.drainEvents()).toContainEqual({ e: 'act', i: melee.id, k: 'atk', c: 0 });
    expect(useSkill(inst, mage, 'mendingLight', { x: mage.x + 2, y: mage.y })).toBeNull();
    const act = inst.drainEvents().find((ev) => ev.e === 'act' && ev.i === mage.id);
    expect(act).toMatchObject({ k: 'sk', s: 'mendingLight' });
    expect((act as { d?: number }).d).toBeGreaterThan(0.2);
  });

  it('names the skill used and which hit of the combo each swing is', () => {
    const { inst, tank, dummy } = setup();
    const acts = () => inst.drainEvents().filter((ev): ev is Extract<GameEvent, { e: 'act' }> => ev.e === 'act' && ev.i === tank.id);
    tank.aim = { x: dummy.x, y: dummy.y };
    inst.drainEvents();
    // The greatsword's three-hit combo, then round again.
    const hits: (number | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      basicAttack(inst, tank);
      hits.push(...acts().map((a) => a.c));
      inst.now += 0.5;
    }
    expect(hits).toEqual([0, 1, 2, 0]);
    // A pause long enough to drop the combo starts it over.
    basicAttack(inst, tank);
    inst.now += 5;
    basicAttack(inst, tank);
    expect(acts().map((a) => a.c)).toEqual([1, 0]);
    // Instant skills, and skills with a wind-up, name themselves.
    for (const id of ['parry', 'stalwartCharge', 'eclipse', 'drain', 'ruination', 'challenge']) {
      tank.lockUntil = 0;
      tank.cast = null;
      tank.mp = tank.maxMp;
      tank.hp = tank.maxHp;
      expect(useSkill(inst, tank, id, { x: dummy.x, y: dummy.y })).toBeNull();
      const [act] = acts();
      expect(act).toMatchObject({ k: 'sk', s: id });
      expect(act?.c).toBeUndefined();
    }
  });

  it('tells clients when monsters wind up their attacks', () => {
    const { inst, tank } = setup();
    const brute = inst.spawnMob('brute', tank.x + 1.5, tank.y, 0, 0);
    inst.engage(brute);
    inst.drainEvents();
    run(inst, 4);
    const acts = inst.drainEvents().filter((ev) => ev.e === 'act' && ev.i === brute.id);
    expect(acts.length).toBeGreaterThan(0);
    expect(acts[0]).toMatchObject({ k: 'atk' });
    // Monsters have no combo or skill ids to tell.
    for (const a of acts) expect(a).not.toHaveProperty('c');
    for (const a of acts) expect(a).not.toHaveProperty('s');
  });
});
