/**
 * Action combat: statuses, damage and healing, and aimed skills. Every skill fires toward the
 * user's aim point as an arc, thrust, area around the user, ground circle, projectile, dash or
 * leap, and applies its effects to whatever it strikes.
 */
import { CHAIN_RESET, CRIT_CHANCE, CRIT_MULT, PARTY_EFFECT_RADIUS, ROLL_STAMINA, ROLL_TIME, SKILL_LOCK, ROLL_DISTANCE } from '../../shared/constants.js';
import { skillDef, WEAPONS, type Effect, type SkillDef } from '../../shared/content/classes.js';
import { STATUSES, statusDef } from '../../shared/content/statuses.js';
import { angleTo, dist, shapeHits, type Shape, type Vec } from '../../shared/geometry.js';
import { circleFree, lineOfSight, moveCircle, nearestFree } from '../../shared/map.js';
import { addAggro, damageAggro, healAggro, taunt } from './aggro.js';
import type { Instance } from './instance.js';
import type { Actor, Monster, Player, StatusInst } from './types.js';

// ── Statuses ───────────────────────────────────────────────────────────────────────────────

export function getStatus(a: Actor, id: string): StatusInst | undefined {
  return a.statuses.find((s) => s.id === id);
}

/** Sum of a numeric status property across all statuses (times stacks). */
export function statSum(a: Actor, key: 'dmgDealt' | 'dmgTaken' | 'speed' | 'haste' | 'lifesteal'): number {
  let total = 0;
  for (const s of a.statuses) {
    const v = STATUSES[s.id]?.[key];
    if (typeof v === 'number') total += v * s.stacks;
  }
  return total;
}

export function isStunned(a: Actor): boolean {
  return a.statuses.some((s) => STATUSES[s.id]?.stun);
}

export function isInvulnerable(a: Actor): boolean {
  return a.statuses.some((s) => STATUSES[s.id]?.invulnerable);
}

export function applyStatus(inst: Instance, target: Actor, id: string, duration: number, sourceId: number, potency = 0, value = 0): void {
  if (target.dead) return;
  const def = statusDef(id);
  const existing = target.statuses.find((s) => s.id === id && (def.dot ? s.sourceId === sourceId : true));
  if (existing) {
    existing.expires = Math.max(existing.expires, inst.now + duration);
    existing.stacks = Math.min(def.maxStacks ?? 1, existing.stacks + (def.maxStacks ? 1 : 0));
    existing.potency = Math.max(existing.potency, potency);
    if (def.barrier) existing.value = Math.max(existing.value, value);
    existing.sourceId = sourceId;
    return;
  }
  target.statuses.push({ id, sourceId, expires: inst.now + duration, stacks: 1, potency, value });
}

export function removeStatus(target: Actor, id: string): void {
  target.statuses = target.statuses.filter((s) => s.id !== id);
}

export function speedOf(a: Actor): number {
  return a.speed * Math.max(0.3, 1 + statSum(a, 'speed'));
}

export function hasteMult(a: Actor): number {
  return Math.max(0.5, 1 - statSum(a, 'haste'));
}

// ── Damage and healing ─────────────────────────────────────────────────────────────────────

const variance = (inst: Instance): number => 0.95 + inst.rng.next() * 0.1;

/**
 * Outgoing damage before the target's mitigation. `focused` marks a monster's blow aimed at
 * whoever holds its aggro, which hits much harder than its area mechanics.
 */
export function outgoingDamage(inst: Instance, src: Actor, potency: number, canCrit: boolean, focused = false): { amount: number; crit: boolean } {
  const scale = src.team === 'party' ? src.power / 100 : src.power * (focused ? inst.focusDamage : 1);
  let amount = potency * scale * Math.max(0.1, 1 + statSum(src, 'dmgDealt')) * variance(inst);
  const crit = canCrit && inst.rng.chance(CRIT_CHANCE);
  if (crit) amount *= CRIT_MULT;
  return { amount, crit };
}

export interface DamageOpts {
  crit?: boolean;
  name?: string;
  /** Hit by an avoidable mechanic: adds a Vulnerability Up stack. */
  avoidable?: boolean;
  /** Damage over time ticks skip some effects. */
  tick?: boolean;
  /** Multiplier on the aggro this damage builds (the skill's). */
  aggro?: number;
}

export function applyDamage(inst: Instance, src: Actor | null, target: Actor, raw: number, opts: DamageOpts = {}): number {
  if (target.dead) return 0;
  if (isInvulnerable(target) && !opts.tick) {
    inst.emit({ e: 'fx', k: 'evade', t: target.id });
    return 0;
  }
  let amount = raw * Math.max(0.1, 1 + statSum(target, 'dmgTaken'));
  if (target.team === 'party') amount *= (target as Player).defense;
  amount = Math.max(1, Math.round(amount));
  // A raised shield takes the whole blow and remembers it, to throw back when it comes down.
  const shield = target.statuses.find((s) => STATUSES[s.id]?.block);
  if (shield) {
    shield.value += amount;
    inst.emit({ e: 'dmg', s: src?.id ?? 0, t: target.id, v: amount, ab: amount, ...(opts.name ? { n: opts.name } : {}) });
    if (target.team === 'party') (target as Player).lastHitAt = inst.now;
    return 0;
  }
  // Barriers absorb first.
  let absorbed = 0;
  for (const s of target.statuses) {
    if (!STATUSES[s.id]?.barrier || s.value <= 0) continue;
    const take = Math.min(s.value, amount - absorbed);
    s.value -= take;
    absorbed += take;
    if (absorbed >= amount) break;
  }
  target.statuses = target.statuses.filter((s) => !(STATUSES[s.id]?.barrier && s.value <= 0));
  const dealt = amount - absorbed;
  target.hp -= dealt;
  inst.emit({ e: 'dmg', s: src?.id ?? 0, t: target.id, v: amount, ...(opts.crit ? { c: 1 as const } : {}), ...(opts.name ? { n: opts.name } : {}), ...(absorbed ? { ab: absorbed } : {}) });

  if (target.team === 'party') {
    (target as Player).lastHitAt = inst.now;
    if (opts.avoidable) applyStatus(inst, target, 'vuln', 10, src?.id ?? 0);
  }
  if (src && src.team === 'party' && target.team === 'enemy') {
    const p = src as Player;
    p.stats.damage += amount;
    const m = target as Monster;
    damageAggro(inst, m, p, amount, opts.aggro ?? 1);
    inst.engage(m);
    const steal = statSum(p, 'lifesteal');
    if (steal > 0 && !opts.tick) applyHeal(inst, p, p, amount * steal, false, undefined, true);
  }
  if (target.hp <= 0) inst.kill(target, src);
  return amount;
}

export function applyHeal(inst: Instance, src: Player, target: Actor, raw: number, crit: boolean, name?: string, quiet = false): number {
  if (target.dead) return 0;
  const amount = Math.round(raw);
  const effective = Math.min(amount, target.maxHp - target.hp);
  target.hp += effective;
  src.stats.healing += effective;
  if (!quiet || effective > 0) inst.emit({ e: 'heal', s: src.id, t: target.id, v: amount, ...(crit ? { c: 1 as const } : {}), ...(name ? { n: name } : {}) });
  // Healing draws the attention of every enemy fighting nearby.
  healAggro(inst, src, effective);
  return effective;
}

export function healAmount(inst: Instance, src: Player, potency: number): { amount: number; crit: boolean } {
  const crit = inst.rng.chance(CRIT_CHANCE);
  return { amount: ((potency * src.healPower) / 100) * variance(inst) * (crit ? CRIT_MULT : 1), crit };
}

/** Fills a boss's stagger meter. A full meter staggers it: stunned and vulnerable for 4s. */
export function addStagger(inst: Instance, m: Monster, amount: number): void {
  if (m.staggerMax <= 0 || m.dead || getStatus(m, 'staggered')) return;
  m.stagger += amount;
  if (m.stagger < m.staggerMax) return;
  m.stagger = 0;
  applyStatus(inst, m, 'staggered', 4, 0);
  inst.cancelCasts(m);
  m.nextStepAt = Math.max(m.nextStepAt, inst.now + 4.5);
  inst.emit({ e: 'fx', k: 'stagger', t: m.id });
  inst.emit({ e: 'banner', text: `${m.name} is staggered!`, sub: 'Strike now', style: 'wave' });
  inst.log(`${m.name} is staggered and takes 25% more damage!`, 'good');
}

// ── Aiming ─────────────────────────────────────────────────────────────────────────────────

/** Pulls an aimed point in to `range` and back to where the user can see and stand. */
export function clampAim(inst: Instance, p: Vec, aim: Vec, range: number, radius = 0.45): Vec {
  const a = angleTo(p, aim);
  let d = Math.min(range, dist(p, aim));
  let q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  while (d > 0.5 && (!lineOfSight(inst.map, p, q) || !circleFree(inst.map, q.x, q.y, radius))) {
    d -= 0.5;
    q = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  }
  return q;
}

/**
 * The area an instant skill covers when aimed at `aim`. Projectiles have no area until they
 * land; dashes and leaps report the area they would strike if unobstructed.
 */
export function skillShape(inst: Instance, p: Player, skill: SkillDef, aim: Vec): Shape | null {
  const d = skill.delivery;
  const dir = angleTo(p, aim);
  switch (d.kind) {
    case 'arc':
      return { kind: 'cone', x: p.x, y: p.y, radius: d.radius + p.radius, dir, angle: d.angle };
    case 'thrust':
      return { kind: 'line', x: p.x, y: p.y, dir, length: d.length, width: d.width };
    case 'self':
      return { kind: 'circle', x: p.x, y: p.y, radius: d.radius };
    case 'ground': {
      const at = clampAim(inst, p, aim, d.range, 0.1);
      return { kind: 'circle', x: at.x, y: at.y, radius: d.radius };
    }
    case 'dash':
      return { kind: 'line', x: p.x, y: p.y, dir, length: d.distance, width: d.width };
    case 'leap': {
      const at = clampAim(inst, p, aim, d.range);
      return { kind: 'circle', x: at.x, y: at.y, radius: d.radius };
    }
    default:
      return null;
  }
}

export function enemiesIn(inst: Instance, shape: Shape): Monster[] {
  const out: Monster[] = [];
  for (const m of inst.monsters.values()) if (!m.dead && shapeHits(shape, m, m.radius)) out.push(m);
  return out;
}

function alliesIn(inst: Instance, shape: Shape): Player[] {
  return inst.players.filter((o) => !o.dead && shapeHits(shape, o, o.radius));
}

function partyAround(inst: Instance, p: Player): Player[] {
  return inst.players.filter((o) => !o.dead && dist(o, p) <= PARTY_EFFECT_RADIUS);
}

// ── Using skills ───────────────────────────────────────────────────────────────────────────

export function cooldownReady(inst: Instance, p: Player, skill: SkillDef): boolean {
  return (p.cooldowns.get(skill.id) ?? 0) <= inst.now + 1e-6;
}

/** Why the skill cannot be used now, or null if it can. */
export function skillBlocker(inst: Instance, p: Player, skill: SkillDef): string | null {
  if (p.dead) return 'You are knocked out';
  if (isStunned(p)) return 'You are stunned';
  if (!p.hotbar.includes(skill.id)) return 'Skill not on your hotbar';
  if (p.cast) return 'Already winding up';
  if (inst.now < p.lockUntil - 1e-6) return 'lock';
  if (!cooldownReady(inst, p, skill)) return 'Not ready yet';
  if (skill.mp > p.mp) return 'Not enough MP';
  if (skill.stamina > p.stamina) return 'Not enough stamina';
  return null;
}

/** A player (or bot) uses a skill toward `aim`. Returns null on success or a reason it failed. */
export function useSkill(inst: Instance, p: Player, skillId: string, aim: Vec): string | null {
  const skill = skillDef(skillId);
  if (skill.slot === 'basic' || skill.slot === 'dodge') return 'Not a skill';
  const blocked = skillBlocker(inst, p, skill);
  if (blocked) return blocked === 'lock' ? 'Not ready yet' : blocked;
  p.facing = angleTo(p, aim);
  if (skill.windup > 0) {
    p.cast = { skillId, aim: { ...aim }, start: inst.now, end: inst.now + skill.windup * hasteMult(p), x: p.x, y: p.y };
    inst.emit({ e: 'act', i: p.id, k: 'sk', d: Math.round((p.cast.end - p.cast.start) * 100) / 100 });
    return null;
  }
  inst.emit({ e: 'act', i: p.id, k: 'sk' });
  executeSkill(inst, p, skill, aim);
  return null;
}

/** Finishes a wind-up. */
export function finishCast(inst: Instance, p: Player): void {
  const cast = p.cast;
  if (!cast) return;
  p.cast = null;
  const skill = skillDef(cast.skillId);
  if (skill.mp > p.mp) {
    inst.privateMsg(p, { t: 'skillFail', id: skill.id, reason: 'Not enough MP' });
    return;
  }
  executeSkill(inst, p, skill, cast.aim);
}

/** Swings the next hit of the weapon's basic attack chain toward the player's aim. */
export function basicAttack(inst: Instance, p: Player): void {
  const weapon = WEAPONS[p.weapon];
  if (!weapon) return;
  if (inst.now > p.chainResetAt) p.chain = 0;
  const id = weapon.basic.hits[p.chain % weapon.basic.hits.length] as string;
  p.chain = (p.chain + 1) % weapon.basic.hits.length;
  const interval = weapon.basic.interval * hasteMult(p);
  p.basicReadyAt = inst.now + interval;
  p.chainResetAt = inst.now + interval + CHAIN_RESET;
  p.facing = angleTo(p, p.aim);
  inst.emit({ e: 'act', i: p.id, k: 'atk' });
  executeSkill(inst, p, skillDef(id), p.aim);
}

/** Starts a dodge roll in direction (dx, dy). */
export function dodge(inst: Instance, p: Player, dx: number, dy: number): string | null {
  if (p.dead) return 'You are knocked out';
  if (isStunned(p)) return 'You are stunned';
  if (p.stamina < ROLL_STAMINA) return 'Not enough stamina';
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) {
    dx = Math.cos(p.facing);
    dy = Math.sin(p.facing);
  } else {
    dx /= len;
    dy /= len;
  }
  p.cast = null;
  p.stamina -= ROLL_STAMINA;
  applyStatus(inst, p, 'evasion', ROLL_TIME + 0.08, p.id);
  if (p.botControlled) p.roll = { dx, dy, until: inst.now + ROLL_TIME };
  else p.moveBudget += ROLL_DISTANCE + 0.6;
  inst.emit({ e: 'fx', k: 'roll', s: p.id, x: p.x, y: p.y, d: Math.atan2(dy, dx) });
  return null;
}

export function executeSkill(inst: Instance, p: Player, skill: SkillDef, aim: Vec): void {
  p.mp -= skill.mp;
  if (skill.hpCost) {
    // Blood for power: the cost never kills.
    const cost = Math.min(p.hp - 1, Math.round(p.maxHp * skill.hpCost));
    if (cost > 0) {
      p.hp -= cost;
      inst.emit({ e: 'dmg', s: p.id, t: p.id, v: cost, n: skill.name });
    }
  }
  if (skill.cooldown > 0) p.cooldowns.set(skill.id, inst.now + skill.cooldown);
  if (skill.slot !== 'basic') p.lockUntil = inst.now + SKILL_LOCK;
  if (skill.iframes) applyStatus(inst, p, 'evasion', skill.iframes, p.id);
  const dir = angleTo(p, aim);
  p.facing = dir;
  const d = skill.delivery;
  const start = { x: p.x, y: p.y };

  switch (d.kind) {
    case 'arc':
    case 'thrust':
    case 'self': {
      const shape = skillShape(inst, p, skill, aim) as Shape;
      // Blasts as wide as the battlefield reach only what the user can see, not packs in the next room.
      const hits = enemiesIn(inst, shape).filter((m) => d.kind !== 'self' || !d.sight || lineOfSight(inst.map, p, m));
      const fxKind = d.kind === 'arc' ? 'arc' : d.kind === 'thrust' ? 'thrust' : 'burst';
      inst.emit({ e: 'fx', k: fxKind, s: p.id, x: p.x, y: p.y, d: dir, r: d.kind === 'arc' ? d.radius + p.radius : d.kind === 'self' ? d.radius : d.length, a: d.kind === 'arc' ? d.angle : d.kind === 'thrust' ? d.width : 0, hue: skill.hue });
      applyEffects(inst, p, skill, hits, p, d.kind === 'self' ? alliesIn(inst, shape) : [p], aim);
      break;
    }
    case 'ground': {
      const at = clampAim(inst, p, aim, d.range, 0.1);
      const shape: Shape = { kind: 'circle', x: at.x, y: at.y, radius: d.radius };
      const land = (): void => {
        inst.emit({ e: 'fx', k: 'burst', x: at.x, y: at.y, r: d.radius, hue: skill.hue, s: p.id });
        const raised = skill.effects.some((e) => e.kind === 'raise') ? inst.players.filter((o) => o.dead && shapeHits(shape, o, o.radius)) : [];
        for (const o of raised) {
          inst.revive(o, 0.4);
          applyStatus(inst, o, 'weakness', 15, p.id);
          p.stats.raises++;
        }
        applyEffects(inst, p, skill, enemiesIn(inst, shape), at, alliesIn(inst, shape), aim);
      };
      if (d.delay) {
        inst.addTelegraph({ ownerId: p.id, ability: { id: skill.id, name: skill.name, cast: d.delay, potency: 0, pattern: { kind: 'raidwide' } }, shape, style: 'ally', start: inst.now, end: inst.now + d.delay, followId: null, minor: true });
        inst.schedule(inst.now + d.delay, p.id, land);
      } else land();
      // Strikes that rain down again and again, until the user falls.
      for (let i = 1; i < (d.repeat ?? 1); i++) {
        inst.schedule(inst.now + (d.delay ?? 0) + i * (d.every ?? 0.3), p.id, () => {
          if (!p.dead) land();
        });
      }
      break;
    }
    case 'projectile': {
      const count = d.count ?? 1;
      const spread = d.spread ?? 0;
      for (let i = 0; i < count; i++) {
        const a = count > 1 ? dir - spread / 2 + (spread * i) / (count - 1) : dir;
        inst.spawnProjectile({ ownerId: p.id, team: 'party', x: p.x + Math.cos(a) * (p.radius + 0.2), y: p.y + Math.sin(a) * (p.radius + 0.2), dir: a, speed: d.speed, radius: d.radius, range: d.range, pierce: !!d.pierce, explode: d.explode ?? 0, look: d.look, hue: skill.hue, skill, potency: 0, name: skill.name });
      }
      // Non-damage effects on the user (Tumble Shot's roll) happen right away.
      applyEffects(inst, p, { ...skill, effects: skill.effects.filter((e) => e.kind === 'move') }, [], p, [p], aim);
      break;
    }
    case 'dash': {
      const to = moveCircle(inst.map, p, Math.cos(dir) * d.distance, Math.sin(dir) * d.distance, p.radius);
      const length = dist(start, to);
      const shape: Shape = { kind: 'line', x: start.x, y: start.y, dir, length: length + 0.5, width: d.width };
      inst.movePlayer(p, to.x, to.y);
      inst.emit({ e: 'fx', k: 'dash', s: p.id, x: start.x, y: start.y, hue: skill.hue });
      applyEffects(inst, p, skill, enemiesIn(inst, shape), start, [p], aim);
      break;
    }
    case 'leap': {
      let at = clampAim(inst, p, aim, d.range);
      at = nearestFree(inst.map, at.x, at.y, p.radius);
      inst.movePlayer(p, at.x, at.y);
      const shape: Shape = { kind: 'circle', x: at.x, y: at.y, radius: d.radius };
      inst.emit({ e: 'fx', k: 'dash', s: p.id, x: start.x, y: start.y, hue: skill.hue });
      inst.emit({ e: 'fx', k: 'impact', x: at.x, y: at.y, r: d.radius, hue: skill.hue });
      applyEffects(inst, p, skill, enemiesIn(inst, shape), at, [p], aim);
      break;
    }
    case 'none':
      applyEffects(inst, p, skill, [], p, [p], aim);
      break;
  }
}

/**
 * Applies a skill's effects. `hits` are the enemies it struck, `origin` is where knockbacks push
 * from, and `area` is the allies inside its area (for "area" heals and statuses).
 */
export function applyEffects(inst: Instance, p: Player, skill: SkillDef, hits: Monster[], origin: Vec, area: Player[], aim: Vec): void {
  const buffs = skill.effects.some((e) => (e.kind === 'status' || e.kind === 'barrier') && (e.to === 'self' || e.to === 'party'));
  const dealt = { total: 0 };
  for (const effect of skill.effects) applyEffect(inst, p, skill, effect, hits, origin, area, aim, dealt);
  if (buffs && skill.slot !== 'basic') inst.emit({ e: 'fx', k: 'buff', t: p.id, hue: skill.hue });
}

function recipients(inst: Instance, p: Player, to: 'self' | 'area' | 'party', area: Player[]): Player[] {
  return to === 'self' ? [p] : to === 'party' ? partyAround(inst, p) : area;
}

function applyEffect(inst: Instance, p: Player, skill: SkillDef, effect: Effect, hits: Monster[], origin: Vec, area: Player[], aim: Vec, dealt: { total: number }): void {
  switch (effect.kind) {
    case 'damage':
      for (const m of hits) {
        if (m.dead) continue;
        const pot = effect.potency * (skill.execute && m.hp < m.maxHp * 0.3 ? skill.execute : 1);
        const { amount, crit } = outgoingDamage(inst, p, pot, true);
        dealt.total += applyDamage(inst, p, m, amount, { crit, name: skill.name, aggro: skill.aggro });
      }
      break;
    case 'drain':
      if (dealt.total > 0) {
        applyHeal(inst, p, p, dealt.total * effect.pct, false, skill.name);
        inst.emit({ e: 'fx', k: 'heal', t: p.id, hue: skill.hue });
      }
      break;
    case 'aggro':
      // Draws the attention of foes already in the fight; it does not wake sleeping packs.
      for (const m of hits) {
        if (m.dead || !m.engaged) continue;
        addAggro(m, p, effect.amount);
        inst.engage(m);
      }
      break;
    case 'heal':
      for (const r of recipients(inst, p, effect.to, area)) {
        const { amount, crit } = healAmount(inst, p, effect.potency);
        applyHeal(inst, p, r, amount, crit, skill.name);
        inst.emit({ e: 'fx', k: 'heal', t: r.id, hue: skill.hue });
      }
      break;
    case 'healPct':
      for (const r of recipients(inst, p, effect.to, area)) {
        applyHeal(inst, p, r, r.maxHp * effect.pct, false, skill.name);
        inst.emit({ e: 'fx', k: 'heal', t: r.id, hue: skill.hue });
      }
      break;
    case 'status': {
      const def = statusDef(effect.status);
      let potency = 0;
      if (effect.potency) potency = def.hot ? (effect.potency * p.healPower) / 100 : outgoingDamage(inst, p, effect.potency, false).amount;
      const list: Actor[] = effect.to === 'hit' ? hits.filter((m) => !m.dead) : recipients(inst, p, effect.to, area);
      for (const r of list) applyStatus(inst, r, effect.status, effect.duration, p.id, potency);
      break;
    }
    case 'barrier':
      for (const r of recipients(inst, p, effect.to, area)) applyStatus(inst, r, 'barrier', 15, p.id, 0, r.maxHp * effect.pct);
      break;
    case 'knockback':
      for (const m of hits) {
        if (m.dead) continue;
        if (m.kind === 'boss') addStagger(inst, m, effect.distance * 5);
        if (m.stunImmune || m.kind === 'boss') continue;
        const a = angleTo(origin, m);
        const to = moveCircle(inst.map, m, Math.cos(a) * effect.distance, Math.sin(a) * effect.distance, m.radius);
        m.x = to.x;
        m.y = to.y;
      }
      break;
    case 'pull':
      for (const m of hits) {
        if (m.dead) continue;
        if (m.kind === 'boss') addStagger(inst, m, effect.distance * 4);
        if (m.stunImmune || m.kind === 'boss') continue;
        const gap = Math.max(0, dist(origin, m) - m.radius - p.radius - 0.4);
        const k = Math.min(effect.distance, gap);
        const a = angleTo(m, origin);
        const to = moveCircle(inst.map, m, Math.cos(a) * k, Math.sin(a) * k, m.radius);
        m.x = to.x;
        m.y = to.y;
      }
      break;
    case 'stun':
      for (const m of hits) {
        if (m.dead) continue;
        if (m.kind === 'boss') {
          addStagger(inst, m, effect.duration * 15);
          continue;
        }
        if (m.stunImmune) continue;
        applyStatus(inst, m, 'stun', effect.duration, p.id);
        inst.interrupt(m, p, false);
      }
      break;
    case 'taunt':
      for (const m of hits) {
        if (m.dead) continue;
        taunt(m, p);
        inst.engage(m);
      }
      if (hits.length) inst.emit({ e: 'fx', k: 'shout', s: p.id, hue: 0 });
      break;
    case 'stagger':
      for (const m of hits) if (m.kind === 'boss') addStagger(inst, m, effect.amount);
      break;
    case 'mp':
      p.mp = Math.min(p.maxMp, p.mp + effect.amount);
      break;
    case 'raise':
      break; // Handled by ground skills, which know their circle.
    case 'move': {
      const a = angleTo(p, aim) + (effect.mode === 'away' ? Math.PI : 0);
      const from = { x: p.x, y: p.y };
      const to = moveCircle(inst.map, p, Math.cos(a) * effect.distance, Math.sin(a) * effect.distance, p.radius);
      inst.movePlayer(p, to.x, to.y);
      inst.emit({ e: 'fx', k: 'dash', s: p.id, x: from.x, y: from.y, hue: skill.hue });
      break;
    }
  }
}

/** A player projectile strikes `target` (or explodes at `at`). */
export function projectileImpact(inst: Instance, p: Player, skill: SkillDef, at: Vec, target: Monster | null, explode: number): void {
  if (explode > 0) {
    const shape: Shape = { kind: 'circle', x: at.x, y: at.y, radius: explode };
    inst.emit({ e: 'fx', k: 'burst', x: at.x, y: at.y, r: explode, hue: skill.hue });
    applyEffects(inst, p, { ...skill, effects: skill.effects.filter((e) => e.kind !== 'move') }, enemiesIn(inst, shape), at, [], at);
  } else if (target) {
    inst.emit({ e: 'fx', k: 'impact', x: at.x, y: at.y, r: 0.8, hue: skill.hue });
    applyEffects(inst, p, { ...skill, effects: skill.effects.filter((e) => e.kind !== 'move') }, [target], at, [], at);
  }
}

/**
 * A blocking status comes down (Shield's Up!): it bursts on every enemy around the bearer for its
 * share of what it blocked, which also builds aggro.
 */
export function counterBurst(inst: Instance, p: Player, s: StatusInst): void {
  const def = STATUSES[s.id];
  if (!def?.counter) return;
  const radius = def.counterRadius ?? 5;
  const shape: Shape = { kind: 'circle', x: p.x, y: p.y, radius };
  inst.emit({ e: 'fx', k: 'burst', x: p.x, y: p.y, r: radius, hue: 48, s: p.id });
  for (const m of enemiesIn(inst, shape)) applyDamage(inst, p, m, s.value * def.counter, { name: def.name, aggro: 1.5 });
}
