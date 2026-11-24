/** Arrows, bolts, orbs, thrown weapons and monster shots: they fly, hit, pierce and explode. */
import { dist } from '../../shared/geometry.js';
import { isWalkable } from '../../shared/map.js';
import { applyDamage, isInvulnerable, projectileImpact } from './combat.js';
import type { Instance } from './instance.js';
import type { Actor, Monster, Player, Projectile } from './types.js';

export function stepProjectiles(inst: Instance, dt: number): void {
  for (const pr of [...inst.projectiles.values()]) {
    if (advance(inst, pr, dt)) inst.projectiles.delete(pr.id);
  }
}

/** Moves one projectile. Returns true when it is spent. */
function advance(inst: Instance, pr: Projectile, dt: number): boolean {
  const total = pr.speed * dt;
  const steps = Math.max(1, Math.ceil(total / 0.3));
  const step = total / steps;
  for (let i = 0; i < steps; i++) {
    pr.x += Math.cos(pr.dir) * step;
    pr.y += Math.sin(pr.dir) * step;
    pr.traveled += step;
    if (!isWalkable(inst.map, Math.floor(pr.x), Math.floor(pr.y))) {
      impact(inst, pr, null);
      return true;
    }
    const targets: Actor[] = pr.team === 'party' ? [...inst.monsters.values()] : inst.players;
    for (const t of targets) {
      if (t.dead || pr.hit.has(t.id)) continue;
      if (dist(pr, t) > pr.radius + t.radius) continue;
      pr.hit.add(t.id);
      if (pr.team === 'enemy' && isInvulnerable(t)) {
        inst.emit({ e: 'fx', k: 'evade', t: t.id });
        continue; // Rolled through it.
      }
      impact(inst, pr, t);
      if (!pr.pierce || pr.explode > 0) return true;
    }
    if (pr.traveled >= pr.range) {
      if (pr.explode > 0) impact(inst, pr, null);
      return true;
    }
  }
  return false;
}

function impact(inst: Instance, pr: Projectile, target: Actor | null): void {
  const at = { x: pr.x, y: pr.y };
  if (pr.team === 'party') {
    const owner = inst.players.find((p) => p.id === pr.ownerId);
    if (!owner || !pr.skill) return;
    projectileImpact(inst, owner as Player, pr.skill, at, target as Monster | null, pr.explode);
    return;
  }
  if (!target) return;
  const owner = inst.monsters.get(pr.ownerId) ?? null;
  inst.emit({ e: 'fx', k: 'impact', x: at.x, y: at.y, r: 0.7, hue: pr.hue });
  applyDamage(inst, owner, target, pr.potency, { name: pr.name });
}
