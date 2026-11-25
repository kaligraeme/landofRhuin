/** Monster behaviour: go for whoever holds its aggro, close in, auto-attack and use abilities. */
import { angleTo, dist, lerpAngle } from '../../shared/geometry.js';
import { findPath, lineOfSight, moveCircle, segmentClear } from '../../shared/map.js';
import { applyDamage, hasteMult, isStunned, outgoingDamage, speedOf } from './combat.js';
import type { Instance } from './instance.js';
import { emitAct, runBossStep, startAbility } from './mechanics.js';
import { pickTarget } from './aggro.js';
import type { Monster } from './types.js';

export function updateMonster(inst: Instance, m: Monster, dt: number): void {
  if (m.dead || !m.engaged) return;
  if (m.cast && inst.now >= m.cast.end) m.cast = null;
  if (isStunned(m)) return;

  const target = pickTarget(inst, m);
  if (!target) return;
  m.targetId = target.id;
  if (m.cast) return; // Casting monsters stand still and keep their facing.

  // Boss timeline.
  if (m.boss) {
    const phases = m.boss.phases;
    const next = phases[m.phase + 1];
    if (next && m.hp / m.maxHp <= next.below) {
      m.phase++;
      m.step = 0;
      m.inIntro = !!next.intro;
      m.nextStepAt = inst.now + 1;
      inst.log(`${m.name} grows more dangerous!`, 'boss');
    }
    if (inst.now >= m.nextStepAt) {
      m.facing = angleTo(m, target);
      runBossStep(inst, m);
      if (m.cast) return;
    }
  } else if (m.mob) {
    for (const ab of m.mob.abilities) {
      if ((m.abilityReady.get(ab.id) ?? 0) > inst.now) continue;
      if (ab.pattern.kind === 'healAlly') {
        const hurt = [...inst.monsters.values()].some((o) => !o.dead && o.engaged && o.hp < o.maxHp * 0.6 && dist(o, m) < (ab.range ?? 30));
        if (!hurt) continue;
      } else if (dist(m, target) - m.radius - target.radius > (ab.range ?? 99) || !lineOfSight(inst.map, m, target)) {
        continue;
      }
      m.abilityReady.set(ab.id, inst.now + (ab.cooldown ?? 12) * (0.85 + inst.rng.next() * 0.3));
      m.facing = angleTo(m, target);
      const end = startAbility(inst, m, ab);
      m.cast = { ability: ab, name: ab.name, start: inst.now, end, telegraphs: [], targetId: target.id };
      emitAct(inst, m, ab.minor ? 'atk' : 'sk', end);
      return;
    }
  }

  // Move into attack range.
  const gap = dist(m, target) - m.radius - target.radius;
  const wantRange = m.ranged ? m.attackRange - 2 : m.attackRange;
  const canSee = lineOfSight(inst.map, m, target);
  const desiredFacing = angleTo(m, target);
  m.facing = lerpAngle(m.facing, desiredFacing, Math.min(1, dt * 8));
  if (m.speed > 0 && (gap > wantRange || !canSee)) {
    const step = speedOf(m) * dt;
    let wp: { x: number; y: number } = target;
    if (!segmentClear(inst.map, m, target, m.radius)) {
      const ai = m as Monster & { path?: { x: number; y: number }[]; pathAt?: number };
      if (!ai.path || (ai.pathAt ?? 0) < inst.now - 0.6) {
        ai.path = findPath(inst.map, m, target, m.radius) ?? undefined;
        ai.pathAt = inst.now;
      }
      while (ai.path && ai.path.length > 1 && dist(m, ai.path[0] as { x: number; y: number }) < 0.4) ai.path.shift();
      if (ai.path?.[0]) wp = ai.path[0];
    }
    const a = angleTo(m, wp);
    const to = moveCircle(inst.map, m, Math.cos(a) * step, Math.sin(a) * step, m.radius);
    m.x = to.x;
    m.y = to.y;
  }

  // Keep a little space between monsters so packs do not collapse into one point.
  for (const o of inst.monsters.values()) {
    if (o === m || o.dead || !o.engaged || o.speed === 0) continue;
    const d = dist(m, o);
    const min = (m.radius + o.radius) * 0.9;
    if (d > 0.01 && d < min && m.kind !== 'boss') {
      const push = (min - d) * 0.5;
      const a = angleTo(o, m);
      const to = moveCircle(inst.map, m, Math.cos(a) * push, Math.sin(a) * push, m.radius);
      m.x = to.x;
      m.y = to.y;
    }
  }

  // Routine attacks. Monsters wind up a swing or a shot you can dodge; bosses just hit their target.
  if (gap <= m.attackRange + 0.3 && canSee && inst.now >= m.autoNext) {
    m.autoNext = inst.now + m.autoInterval * hasteMult(m);
    if (m.mob) {
      m.facing = angleTo(m, target);
      const basic = m.mob.basic;
      const end = startAbility(inst, m, basic);
      m.cast = { ability: basic, name: basic.name, start: inst.now, end, telegraphs: [], targetId: target.id };
      emitAct(inst, m, 'atk', end);
    } else {
      inst.emit({ e: 'act', i: m.id, k: 'atk' });
      const { amount } = outgoingDamage(inst, m, m.autoPotency, false, true);
      inst.emit({ e: 'fx', k: 'slash', s: m.id, t: target.id, hue: 0 });
      applyDamage(inst, m, target, amount, { name: 'Attack' });
    }
  }
}
