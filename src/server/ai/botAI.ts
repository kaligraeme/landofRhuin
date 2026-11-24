/**
 * AI companions. They fill empty roles and take over for players who disconnect. Each tick a
 * bot picks a target, aims at it, works out where its role should stand, steps or rolls out of
 * telegraphed attacks (stacking and spreading as markers demand), holds its basic attack when in
 * reach, and fires whichever skill would do the most good right now.
 */
import { PARTY_EFFECT_RADIUS, ROLL_STAMINA } from '../../shared/constants.js';
import { skillDef, WEAPONS, type SkillDef } from '../../shared/content/classes.js';
import { STATUSES } from '../../shared/content/statuses.js';
import { angleDiff, angleTo, dist, shapeHits, type Shape, type Vec } from '../../shared/geometry.js';
import { circleFree, findPath, lineOfSight, moveCircle, segmentClear } from '../../shared/map.js';
import { dodge, enemiesIn, getStatus, skillBlocker, skillShape, speedOf, useSkill } from '../sim/combat.js';
import type { Instance } from '../sim/instance.js';
import type { Monster, Player, Telegraph } from '../sim/types.js';

interface BotMemory {
  notice: Map<number, number>;
  reaction: number;
  path?: Vec[];
  pathGoal?: Vec;
  pathAt?: number;
  dest?: Vec;
  thinkAt?: number;
  repositioning?: boolean;
  side?: number;
}

function memory(p: Player): BotMemory {
  const ai = p.ai as { mem?: BotMemory };
  if (!ai.mem) ai.mem = { notice: new Map(), reaction: 0.3 + Math.random() * 0.3, side: Math.random() < 0.5 ? 1 : -1 };
  return ai.mem;
}

interface Ctx {
  inst: Instance;
  p: Player;
  mem: BotMemory;
  enemies: Monster[];
  allies: Player[];
  dead: Player[];
  tank: Player | null;
  target: Monster | null;
  inCombat: boolean;
  moving: boolean;
  busterOnMe: boolean;
  raidwideSoon: boolean;
  healer: boolean;
  ranged: boolean;
  reach: number;
}

export function updateBot(inst: Instance, p: Player, dt: number): void {
  if (p.dead) return;
  const mem = memory(p);
  const enemies = [...inst.monsters.values()].filter((m) => !m.dead && m.engaged);
  const allies = inst.players.filter((o) => !o.dead);
  const weapon = WEAPONS[p.weapon];
  const tgs = [...inst.telegraphs.values()];
  const ctx: Ctx = {
    inst,
    p,
    mem,
    enemies,
    allies,
    dead: inst.players.filter((o) => o.dead),
    tank: allies.find((o) => o.role === 'tank') ?? null,
    target: null,
    inCombat: enemies.length > 0,
    moving: false,
    busterOnMe: tgs.some((t) => t.style === 'buster' && t.followId === p.id),
    raidwideSoon: tgs.some((t) => t.style === 'raidwide' && t.shape.kind === 'circle' && t.shape.radius === 0 && t.end - inst.now < 3),
    healer: !!weapon?.healer,
    ranged: !!weapon?.ranged,
    reach: weapon?.reach ?? 1,
  };
  ctx.target = pickTarget(ctx);
  p.targetId = ctx.target?.id ?? null;
  if (ctx.target) p.aim = { x: ctx.target.x, y: ctx.target.y };

  // Where to stand.
  if (mem.thinkAt === undefined || inst.now >= mem.thinkAt || !mem.dest) {
    mem.thinkAt = inst.now + 0.15;
    mem.dest = chooseDestination(ctx);
  }
  const dest = mem.dest;
  const gap = dist(p, dest);
  const here = danger(ctx, p);
  const inDanger = here > 0;
  const threshold = mem.repositioning ? 0.35 : ctx.inCombat ? (ctx.ranged ? 2.5 : 1) : 3;
  if (gap > threshold || inDanger) {
    mem.repositioning = true;
    ctx.moving = !(p.cast && !inDanger && gap < 3);
  } else mem.repositioning = false;
  if (gap <= 0.35) mem.repositioning = false;

  // Roll out of anything about to land.
  if (inDanger && here >= 50 && p.stamina >= ROLL_STAMINA && gap > 1 && soonestDanger(ctx) < 0.5) {
    const a = angleTo(p, dest);
    dodge(inst, p, Math.cos(a), Math.sin(a));
    return;
  }

  if (ctx.moving) moveToward(ctx, dest, speedOf(p) * dt);
  if (ctx.target) p.facing = angleTo(p, ctx.target);

  p.attacking = !!ctx.target && ctx.inCombat && inBasicReach(ctx, ctx.target);
  if (!p.cast) chooseAndUseSkill(ctx);
}

// ── Targeting ──────────────────────────────────────────────────────────────────────────────

function pickTarget(ctx: Ctx): Monster | null {
  const { inst, p, enemies, tank } = ctx;
  if (!ctx.inCombat) return null;
  const current = p.targetId != null ? inst.monsters.get(p.targetId) : undefined;
  if (p.role === 'tank') {
    // Peel enemies that are hitting someone else, nearest first.
    const loose = enemies.filter((m) => m.targetId != null && m.targetId !== p.id && dist(m, p) < 30).sort((a, b) => dist(a, p) - dist(b, p));
    if (loose[0]) return loose[0];
    if (current && !current.dead && current.engaged) return current;
    return enemies.find((m) => m.kind === 'boss') ?? nearest(p, enemies);
  }
  const tankTarget = tank && tank.targetId != null ? inst.monsters.get(tank.targetId) : undefined;
  if (current && !current.dead && current.engaged && (current.kind === 'boss' || current.hp < current.maxHp * 0.95)) {
    if (!tankTarget || tankTarget === current || current.hp < current.maxHp * 0.6) return current;
  }
  if (tankTarget && !tankTarget.dead && tankTarget.engaged) return tankTarget;
  return nearest(p, enemies);
}

function nearest<T extends Vec>(from: Vec, list: T[]): T | null {
  let best: T | null = null;
  for (const v of list) if (!best || dist(from, v) < dist(from, best)) best = v;
  return best;
}

function inBasicReach(ctx: Ctx, t: Monster): boolean {
  const { p, inst } = ctx;
  const weapon = WEAPONS[p.weapon];
  if (!weapon) return false;
  const d = skillDef(weapon.basic.hits[p.chain % weapon.basic.hits.length] as string).delivery;
  const edge = dist(p, t) - t.radius;
  switch (d.kind) {
    case 'arc':
      return edge <= d.radius + p.radius;
    case 'thrust':
      return edge <= d.length;
    case 'projectile':
      return edge <= d.range * 0.9 && lineOfSight(inst.map, p, t);
    default:
      return edge <= 2;
  }
}

// ── Positioning ────────────────────────────────────────────────────────────────────────────

function noticed(ctx: Ctx, t: Telegraph): boolean {
  let at = ctx.mem.notice.get(t.id);
  if (at === undefined) {
    at = t.start + ctx.mem.reaction;
    ctx.mem.notice.set(t.id, at);
    if (ctx.mem.notice.size > 300) for (const id of [...ctx.mem.notice.keys()].slice(0, 150)) ctx.mem.notice.delete(id);
  }
  return ctx.inst.now >= at;
}

/** Routine monster swings matter only to a hurt, non-tank companion. */
function cares(ctx: Ctx, t: Telegraph): boolean {
  if (t.style === 'ally') return false;
  if (!t.minor) return true;
  return ctx.p.role !== 'tank' && ctx.p.hp < ctx.p.maxHp * 0.5;
}

/** How bad it is to stand at q right now. 0 is safe. */
function danger(ctx: Ctx, q: Vec): number {
  const { inst, p } = ctx;
  const r = p.radius + 0.4;
  let d = 0;
  for (const t of inst.telegraphs.values()) {
    if (!cares(ctx, t) || !noticed(ctx, t)) continue;
    const s = t.shape;
    switch (t.style) {
      case 'aoe':
        if (shapeHits(s, q, r)) d += t.minor ? 40 : 100;
        break;
      case 'buster':
        if (t.followId !== p.id && shapeHits(s, q, r + 0.6)) d += 80;
        break;
      case 'spread':
        if (t.followId === p.id) {
          for (const o of ctx.allies) if (o !== p && s.kind === 'circle' && dist(q, o) < s.radius + o.radius + 0.6) d += 40;
        } else if (shapeHits(s, q, r + 0.6)) d += 60;
        break;
      case 'stack':
        if (t.followId !== p.id && s.kind === 'circle' && dist(q, s) > s.radius - 0.9) d += 50;
        break;
      default:
        break;
    }
  }
  return d;
}

/** Seconds until the next damaging telegraph covering the bot lands. */
function soonestDanger(ctx: Ctx): number {
  let best = Infinity;
  for (const t of ctx.inst.telegraphs.values()) {
    if (t.style !== 'aoe' || !cares(ctx, t) || !noticed(ctx, t)) continue;
    if (shapeHits(t.shape, ctx.p, ctx.p.radius + 0.3)) best = Math.min(best, t.end - ctx.inst.now);
  }
  return best;
}

function combatSpot(ctx: Ctx, t: Monster): Vec {
  const { p, inst } = ctx;
  if (p.role === 'tank') {
    const a = angleTo(t, p);
    const d = t.radius + p.radius + 0.6;
    return { x: t.x + Math.cos(a) * d, y: t.y + Math.sin(a) * d };
  }
  if (!ctx.ranged) {
    // Melee: behind or beside the enemy, out of its frontal attacks, within weapon reach.
    const behind = t.facing + Math.PI + (ctx.mem.side ?? 1) * (t.kind === 'boss' ? 0.5 : 0.35);
    const d = t.radius + p.radius + Math.min(ctx.reach, 2.2) * 0.6;
    return { x: t.x + Math.cos(behind) * d, y: t.y + Math.sin(behind) * d };
  }
  // Ranged: behind and to one side of the enemy, at the weapon's preferred distance.
  const offset = p.role === 'mage' ? -0.6 : 0.6;
  let spot = { x: t.x + Math.cos(t.facing + Math.PI + offset) * (t.radius + ctx.reach), y: t.y + Math.sin(t.facing + Math.PI + offset) * (t.radius + ctx.reach) };
  if (!circleFree(inst.map, spot.x, spot.y, p.radius) || !lineOfSight(inst.map, spot, t)) {
    const a = angleTo(t, p);
    spot = { x: t.x + Math.cos(a) * (t.radius + 6), y: t.y + Math.sin(a) * (t.radius + 6) };
    if (!circleFree(inst.map, spot.x, spot.y, p.radius) || !lineOfSight(inst.map, spot, t)) spot = { x: t.x, y: t.y };
  }
  return spot;
}

/**
 * Who leads between fights: a human tank, otherwise the AI tank (who guides the party through
 * the dungeon and waits for the players), otherwise the first human.
 */
export function pilotOf(inst: Instance): Player | undefined {
  const alive = inst.players.filter((o) => !o.dead);
  return alive.find((o) => o.role === 'tank' && !o.botControlled) ?? alive.find((o) => o.role === 'tank') ?? alive.find((o) => !o.botControlled) ?? alive[0];
}

function followSpot(ctx: Ctx): Vec {
  const { inst, p } = ctx;
  const pilot = pilotOf(inst);
  if (!pilot) return p;
  if (pilot === p) return objectiveSpot(ctx);
  const slot = inst.players.indexOf(p);
  const behind = pilot.facing + Math.PI + (slot - 1.5) * 0.55;
  const spot = { x: pilot.x + Math.cos(behind) * 2.6, y: pilot.y + Math.sin(behind) * 2.6 };
  return circleFree(inst.map, spot.x, spot.y, p.radius) ? spot : { x: pilot.x, y: pilot.y };
}

/** Where an AI party leader heads next: into the next uncleared room, once everyone is ready. */
function objectiveSpot(ctx: Ctx): Vec {
  const { inst, p } = ctx;
  if (inst.phase === 'countdown') return p;
  const duty = inst.rooms.find((r) => r.status !== 'cleared');
  if (!duty) return p;
  const humans = inst.players.filter((o) => !o.botControlled && !o.dead);
  if (humans.some((o) => dist(o, p) > 14)) return p;
  const resting = inst.players.some((o) => !o.dead && (o.hp < o.maxHp * 0.7 || (o.maxMp > 0 && o.mp < o.maxMp * 0.5)));
  if (resting && duty.status === 'idle') return p;
  if (duty.plan.kind === 'boss' && duty.bossId != null) {
    const boss = inst.monsters.get(duty.bossId);
    if (boss) return { x: boss.x + Math.cos(boss.facing) * (boss.radius + 1), y: boss.y + Math.sin(boss.facing) * (boss.radius + 1) };
  }
  return duty.plan.center;
}

/** During a spread, each party member takes a fixed quarter around the caster. */
function spreadSpot(ctx: Ctx, mark: Telegraph): Vec {
  const { inst, p } = ctx;
  const caster = inst.monsters.get(mark.ownerId) ?? ctx.target;
  if (!caster) return p;
  const slot = inst.players.indexOf(p);
  const angle = caster.facing + Math.PI / 4 + slot * (Math.PI / 2);
  const radius = mark.shape.kind === 'circle' ? mark.shape.radius : 4;
  const groundDanger = (q: Vec): boolean => {
    for (const t of inst.telegraphs.values()) if (t.style === 'aoe' && !t.minor && shapeHits(t.shape, q, p.radius + 0.4)) return true;
    return false;
  };
  for (const d of [radius + 1.5, radius + 3, radius + 0.5, radius + 5, radius + 7]) {
    const q = { x: caster.x + Math.cos(angle) * d, y: caster.y + Math.sin(angle) * d };
    if (circleFree(inst.map, q.x, q.y, p.radius) && !groundDanger(q)) return q;
  }
  return { x: caster.x + Math.cos(angle) * (radius + 1.5), y: caster.y + Math.sin(angle) * (radius + 1.5) };
}

function chooseDestination(ctx: Ctx): Vec {
  const { p, target } = ctx;
  let desired: Vec;
  const marks = [...ctx.inst.telegraphs.values()];
  const stackOnMe = marks.some((t) => t.style === 'stack' && t.followId === p.id);
  const spreadOnMe = marks.find((t) => t.style === 'spread' && t.followId === p.id && noticed(ctx, t));
  if (ctx.inCombat && target) desired = stackOnMe ? { x: p.x, y: p.y } : spreadOnMe ? spreadSpot(ctx, spreadOnMe) : combatSpot(ctx, target);
  else desired = followSpot(ctx);

  const hereDanger = danger(ctx, p);
  const desiredDanger = danger(ctx, desired);
  if (hereDanger === 0 && desiredDanger === 0) return desired;

  let best = desired;
  let bestScore = desiredDanger * 1000 + dist(p, desired);
  const consider = (q: Vec): void => {
    if (!circleFree(ctx.inst.map, q.x, q.y, p.radius)) return;
    if (!segmentClear(ctx.inst.map, p, q, p.radius)) return;
    const score = danger(ctx, q) * 1000 + dist(p, q) + dist(q, desired) * 0.4;
    if (score < bestScore) {
      best = q;
      bestScore = score;
    }
  };
  consider({ x: p.x, y: p.y });
  for (let ring = 1; ring <= 9; ring++) {
    const radius = ring * 1.4;
    const n = 12 + ring * 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      consider({ x: p.x + Math.cos(a) * radius, y: p.y + Math.sin(a) * radius });
    }
  }
  for (let ring = 1; ring <= 4; ring++) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      consider({ x: desired.x + Math.cos(a) * ring * 1.5, y: desired.y + Math.sin(a) * ring * 1.5 });
    }
  }
  return best;
}

function moveToward(ctx: Ctx, dest: Vec, step: number): void {
  const { inst, p, mem } = ctx;
  let wp = dest;
  if (!segmentClear(inst.map, p, dest, p.radius)) {
    const stale = !mem.path || !mem.pathGoal || dist(mem.pathGoal, dest) > 1.5 || (mem.pathAt ?? 0) < inst.now - 1;
    if (stale) {
      mem.path = findPath(inst.map, p, dest, p.radius, 40000) ?? undefined;
      mem.pathGoal = { ...dest };
      mem.pathAt = inst.now;
    }
    while (mem.path && mem.path.length > 1 && dist(p, mem.path[0] as Vec) < 0.35) mem.path.shift();
    if (mem.path?.[0]) wp = mem.path[0];
  } else mem.path = undefined;
  const d = dist(p, wp);
  if (d < 1e-3) return;
  const a = angleTo(p, wp);
  const len = Math.min(step, d);
  const to = moveCircle(inst.map, p, Math.cos(a) * len, Math.sin(a) * len, p.radius);
  p.x = to.x;
  p.y = to.y;
  if (!ctx.target) p.facing = a;
}

// ── Skills ─────────────────────────────────────────────────────────────────────────────────

interface Choice {
  skill: SkillDef;
  aim: Vec;
  value: number;
}

function chooseAndUseSkill(ctx: Ctx): void {
  const { inst, p } = ctx;
  let best: Choice | null = null;
  for (const id of p.hotbar) {
    const skill = skillDef(id);
    if (skill.slot === 'basic' || skill.slot === 'dodge') continue;
    if (skillBlocker(inst, p, skill)) continue;
    const choice = evaluate(ctx, skill);
    if (choice && choice.value >= 150 && (!best || choice.value > best.value)) best = choice;
  }
  if (best) useSkill(inst, p, best.skill.id, best.aim);
}

const hpFrac = (a: { hp: number; maxHp: number }): number => a.hp / a.maxHp;

function hurtNear(ctx: Ctx, at: Vec, radius: number, below: number): Player[] {
  return ctx.allies.filter((a) => dist(a, at) <= radius + a.radius && hpFrac(a) < below);
}

function evaluate(ctx: Ctx, skill: SkillDef): Choice | null {
  const { inst, p, target } = ctx;
  if (skill.windup > 0 && ctx.moving) return null;
  const d = skill.delivery;
  const kinds = new Set(skill.effects.map((e) => e.kind));

  // Raising the fallen comes first.
  if (kinds.has('raise')) {
    const fallen = ctx.dead.filter((o) => dist(o, p) <= (d.kind === 'ground' ? d.range : 0) + 2);
    if (!fallen[0]) return null;
    return { skill, aim: { x: fallen[0].x, y: fallen[0].y }, value: 3000 };
  }

  let aim: Vec = target ? { x: target.x, y: target.y } : { x: p.x + Math.cos(p.facing), y: p.y + Math.sin(p.facing) };
  let value = 0;

  // Area heals aim at whoever needs it most.
  const areaHeal = skill.effects.some((e) => (e.kind === 'heal' || (e.kind === 'status' && STATUSES[e.status]?.hot)) && 'to' in e && e.to === 'area');
  if (areaHeal && d.kind === 'ground') {
    const hurt = [...ctx.allies].filter((a) => dist(a, p) <= d.range + 1).sort((a, b) => hpFrac(a) - hpFrac(b));
    const worst = hurt[0];
    if (!worst || hpFrac(worst) > 0.8) return null;
    aim = { x: worst.x, y: worst.y };
    const covered = hurtNear(ctx, aim, d.radius, 0.85).length;
    const isHot = skill.effects.some((e) => e.kind === 'status');
    if (isHot && covered < 2 && hpFrac(worst) > 0.5) return null;
    value += 700 + covered * 300 + (0.8 - hpFrac(worst)) * 1500;
  } else if (areaHeal && d.kind === 'self') {
    const covered = hurtNear(ctx, p, d.radius, 0.75).length;
    if (covered) value += 300 + covered * 250;
  }

  if (!ctx.inCombat && value === 0) return null;

  // Damage and crowd control on enemies.
  const dmgPotency = skill.effects.reduce((s, e) => s + (e.kind === 'damage' ? e.potency : 0), 0);
  let hits: Monster[] = [];
  if (target && d.kind !== 'none' && !(areaHeal && d.kind === 'ground')) {
    if (d.kind === 'projectile') {
      const gap = dist(p, target) - target.radius;
      if (gap <= d.range * 0.9 && lineOfSight(inst.map, p, target)) {
        hits = [target];
        if (d.explode) hits = ctx.enemies.filter((m) => dist(m, target) <= d.explode! + m.radius);
        else if (d.pierce) {
          const line: Shape = { kind: 'line', x: p.x, y: p.y, dir: angleTo(p, target), length: d.range, width: d.radius * 2 + 0.6 };
          hits = enemiesIn(inst, line);
        }
        if ((d.count ?? 1) > 1) value += dmgPotency * Math.min(d.count ?? 1, 3) * 0.6;
      }
    } else {
      const shape = skillShape(inst, p, skill, aim);
      if (shape) hits = enemiesIn(inst, shape);
    }
  }
  if (dmgPotency > 0) {
    if (hits.length === 0 && value === 0) return null;
    value += dmgPotency * hits.length;
  }
  for (const e of skill.effects) {
    switch (e.kind) {
      case 'stun':
      case 'stagger': {
        for (const m of hits) {
          if (m.kind === 'boss' && !getStatus(m, 'staggered')) value += (e.kind === 'stun' ? e.duration * 15 : e.amount) * 3;
          else if (m.kind !== 'boss' && !m.stunImmune && e.kind === 'stun') value += 40;
        }
        if (m0(hits)?.cast?.ability.interruptible && e.kind === 'stun') value += 1500;
        break;
      }
      case 'taunt':
        if (p.role === 'tank') {
          const loose = hits.filter((m) => m.targetId !== p.id);
          if (loose.length) value += 600 + loose.length * 300;
        }
        break;
      case 'healPct':
        if (e.to === 'self') value += hpFrac(p) < 0.4 ? 1200 : 0;
        else if (hurtNear(ctx, p, PARTY_EFFECT_RADIUS, 0.6).length >= 2) value += 800;
        break;
      case 'status': {
        const def = STATUSES[e.status];
        if (!def || e.to === 'hit' || e.to === 'area') break;
        if (getStatus(p, e.status)) break;
        if (e.to === 'party') {
          if (ctx.raidwideSoon || hurtNear(ctx, p, PARTY_EFFECT_RADIUS, 0.6).length >= 2) value += 1500;
        } else if ((def.dmgTaken ?? 0) < 0 || def.lifesteal) {
          const pressed = p.role === 'tank' ? ctx.busterOnMe || hpFrac(p) < 0.55 || ctx.enemies.filter((m) => m.targetId === p.id).length >= 4 : hpFrac(p) < 0.45;
          if (pressed) value += 900;
        } else if ((def.dmgDealt ?? 0) > 0 && ctx.inCombat && (ctx.enemies.some((m) => m.kind === 'boss') || ctx.enemies.length >= 3)) value += 600;
        break;
      }
      case 'barrier':
        if (e.to === 'self' && (ctx.busterOnMe || hpFrac(p) < 0.5)) value += 500;
        if (e.to !== 'self' && (ctx.raidwideSoon || hurtNear(ctx, p, d.kind === 'self' ? d.radius : PARTY_EFFECT_RADIUS, 0.75).length >= 2)) value += 700;
        break;
      case 'mp':
        if (p.maxMp > 0 && p.mp / p.maxMp < 0.4) value += 900;
        break;
      case 'move':
        // Blinks and vaults are for players to aim; a tumble keeps its damage value.
        if (dmgPotency === 0) return null;
        break;
      default:
        break;
    }
  }
  // Gap closers: worth more when the target is far away.
  if ((d.kind === 'dash' || d.kind === 'leap') && target) {
    const gap = dist(p, target) - target.radius;
    if (p.role !== 'tank' && ctx.ranged) return null;
    if (gap > 5) value += 250;
    // Do not charge past a boss into its frontal attacks.
    if (target.kind === 'boss' && Math.abs(angleDiff(angleTo(target, p), target.facing)) < 0.8 && p.role !== 'tank') value *= 0.5;
  }
  if (skill.mp > 0 && p.maxMp > 0 && !ctx.healer && p.mp - skill.mp < 1500) value *= 0.5;
  if (ctx.healer && dmgPotency > 0 && !areaHeal && p.mp - skill.mp < 2500) value *= 0.3;
  return { skill, aim, value };
}

function m0(list: Monster[]): Monster | undefined {
  return list[0];
}
