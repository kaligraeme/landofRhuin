import { describe, expect, it } from 'vitest';
import { applyStatus, basicAttack, dodge, statSum, useSkill } from '../src/server/sim/combat.js';
import { Instance, type Seat } from '../src/server/sim/instance.js';
import { startAbility } from '../src/server/sim/mechanics.js';
import type { Monster } from '../src/server/sim/types.js';
import { DEFAULT_LOOK, hotbarFor, ROLES, SKILLS, WEAPONS, weaponFor } from '../src/shared/content/classes.js';
import { STATUSES } from '../src/shared/content/statuses.js';

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
    useSkill(inst, tank, 'upheaval', { x: dummy.x, y: dummy.y });
    expect(dummy.statuses.some((s) => s.id === 'stun')).toBe(true);
    const boss = [...inst.monsters.values()].find((m) => m.kind === 'boss') as Monster;
    boss.stagger = boss.staggerMax - 10;
    tank.x = boss.x - boss.radius - 1;
    tank.y = boss.y;
    tank.cooldowns.clear();
    tank.lockUntil = 0;
    useSkill(inst, tank, 'upheaval', { x: boss.x, y: boss.y });
    expect(boss.statuses.some((s) => s.id === 'staggered')).toBe(true);
    expect(boss.stagger).toBe(0);
  });

  it('the Guardian raises her shield, cures the party and smites foes into turning on her', () => {
    const inst = new Instance('g', seats.map((seat) => (seat.role === 'tank' ? { ...seat, weapon: 'sword_shield' } : seat)), { seed: 7, countdown: 0 });
    inst.tick();
    const [tank, mage, ranger] = inst.players as [typeof inst.players[0], typeof inst.players[0], typeof inst.players[0]];
    expect(hotbarFor('tank', 'sword_shield').slice(1, 6)).toEqual(['aegis', 'shieldBash', 'holySmite', 'cure', 'dawnbreaker']);
    expect(useSkill(inst, tank, 'aegis', tank)).toBeNull();
    expect(statSum(tank, 'dmgTaken')).toBeCloseTo(-0.6);
    // Cure: her own wounds and an ally's nearby.
    tank.lockUntil = 0;
    tank.hp = 4000;
    mage.hp = 2000;
    mage.x = tank.x + 3;
    mage.y = tank.y;
    expect(useSkill(inst, tank, 'cure', tank)).toBeNull();
    run(inst, 0.8);
    expect(tank.hp).toBeGreaterThan(4000 + tank.maxHp * 0.19);
    expect(mage.hp).toBeGreaterThan(2500);
    // Holy Smite turns a foe that was after someone else.
    const foe = inst.spawnMob('brute', tank.x + 6, tank.y, 0, 0);
    foe.hp = foe.maxHp = 1e9;
    inst.engage(foe);
    foe.enmity.set(ranger.id, 50000);
    tank.lockUntil = 0;
    expect(useSkill(inst, tank, 'holySmite', { x: foe.x, y: foe.y })).toBeNull();
    run(inst, 0.6);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(foe.targetId).toBe(tank.id);
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
    expect(inst.drainEvents()).toContainEqual({ e: 'act', i: melee.id, k: 'atk' });
    expect(useSkill(inst, mage, 'mendingLight', { x: mage.x + 2, y: mage.y })).toBeNull();
    const act = inst.drainEvents().find((ev) => ev.e === 'act' && ev.i === mage.id);
    expect(act).toMatchObject({ k: 'sk' });
    expect((act as { d?: number }).d).toBeGreaterThan(0.2);
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
  });
});
