/**
 * Aggro: who each monster wants to kill. Every monster keeps its own table of how much each
 * hero has drawn its attention, and goes for whoever tops it.
 *
 *  - Damage builds aggro, multiplied by the hero's role (tanks build three times as much) and by
 *    the skill (charges and sweeps built to hold a crowd build more).
 *  - Healing builds aggro on every monster in the fight nearby (no first-contact bonus).
 *  - First contact: the first time a hero touches a monster adds a flat chunk (twice as much for
 *    a tank), so whoever opens the fight gets its attention.
 *  - Unhinged damage builds aggro fast: each hero's recent damage on a monster is a heat that
 *    cools in a couple of seconds, and the hotter it runs the more each blow counts, up to 3.5x.
 *  - Monsters are sticky: to pull one off its target you need 10% more aggro than the target has,
 *    30% more if the target is a tank. And aggro fades, the tank's three times slower, so a tank
 *    that keeps working holds what it has taken.
 */
import { AGGRO_STICK, AGGRO_TANK_STICK } from '../../shared/constants.js';
import { dist } from '../../shared/geometry.js';
import type { Instance } from './instance.js';
import type { Monster, Player } from './types.js';

export const AGGRO = {
  /** Flat aggro the first time a hero touches a monster (doubled for tanks). */
  firstContact: 1500,
  /** Aggro per point of healing, on every engaged monster within `healRange`. */
  healShare: 0.6,
  healRange: 30,
  /** Heat (recent damage on one monster) at which blows count double; the extra caps at +2.5x. */
  surgeAt: 4500,
  surgeMax: 2.5,
  /** Seconds for a hero's heat on a monster to halve. */
  heatHalfLife: 2,
  /** Share of each hero's aggro that fades per second; tanks lose theirs three times slower. */
  fade: 0.03,
  tankFade: 0.01,
  /** How much more aggro than the current target a hero needs to pull a monster off it. */
  stick: AGGRO_STICK,
  tankStick: AGGRO_TANK_STICK,
  /** A taunt puts the taunter this far above the top of the table, plus a flat amount. */
  tauntOver: 1.1,
  tauntFlat: 1000,
};

/** How hard a hero is hitting this monster right now, decayed to the present. */
export function heatOf(inst: Instance, m: Monster, p: Player): number {
  const h = m.heat.get(p.id);
  if (!h) return 0;
  return h.v * 0.5 ** ((inst.now - h.at) / AGGRO.heatHalfLife);
}

/** The multiplier unhinged damage earns: 1 when calm, up to 1 + surgeMax when running hot. */
export function surgeOf(heat: number): number {
  return 1 + Math.min(AGGRO.surgeMax, (heat / AGGRO.surgeAt) ** 2);
}

/**
 * Adds aggro, with the first-contact bonus the first time this hero touches this monster.
 * Healing (`contact` false) adds only its own share: it never touches the monster.
 */
export function addAggro(m: Monster, p: Player, amount: number, contact = true): void {
  if (contact && !m.touched.has(p.id)) {
    m.touched.add(p.id);
    amount += AGGRO.firstContact * (p.role === 'tank' ? 2 : 1);
  }
  m.enmity.set(p.id, (m.enmity.get(p.id) ?? 0) + amount);
}

/** Aggro for damage dealt: role and skill multipliers, then the surge from recent damage. */
export function damageAggro(inst: Instance, m: Monster, p: Player, damage: number, skillMult = 1): number {
  // A fallen hero's last blows (a strike still raining down, a bleed) do not put them back on the table.
  if (p.dead) return 0;
  const heat = heatOf(inst, m, p) + damage;
  m.heat.set(p.id, { v: heat, at: inst.now });
  const amount = damage * p.enmityMult * skillMult * surgeOf(heat);
  addAggro(m, p, amount);
  return amount;
}

/** Aggro for healing: every monster fighting nearby notices the healer. */
export function healAggro(inst: Instance, healer: Player, healed: number): void {
  if (healed <= 0 || healer.dead) return;
  const amount = healed * AGGRO.healShare * healer.enmityMult;
  for (const m of inst.monsters.values()) {
    if (!m.engaged || m.dead || dist(m, healer) > AGGRO.healRange) continue;
    addAggro(m, healer, amount, false);
  }
}

/** Puts the taunter at the top of the table and turns the monster on them at once. */
export function taunt(m: Monster, p: Player): void {
  let top = 0;
  for (const v of m.enmity.values()) top = Math.max(top, v);
  addAggro(m, p, 0);
  m.enmity.set(p.id, Math.max(m.enmity.get(p.id) ?? 0, top * AGGRO.tauntOver + AGGRO.tauntFlat));
  m.targetId = p.id;
}

/** Aggro fades over time; the tank's three times slower. */
export function fadeAggro(inst: Instance, m: Monster, dt: number): void {
  for (const [id, v] of m.enmity) {
    const p = inst.actor(id) as Player | undefined;
    const rate = p?.role === 'tank' ? AGGRO.tankFade : AGGRO.fade;
    m.enmity.set(id, v * (1 - rate * dt));
  }
}

/**
 * Who the monster goes for: its current target unless someone has pulled clearly ahead of it
 * (by 10%, or 30% if the target is a tank), otherwise the top of the table (nearest on a tie).
 */
export function pickTarget(inst: Instance, m: Monster): Player | null {
  let best: Player | null = null;
  let bestV = -1;
  for (const p of inst.players) {
    if (p.dead) continue;
    const v = m.enmity.get(p.id) ?? 0;
    if (v > bestV || (v === bestV && best && dist(m, p) < dist(m, best))) {
      best = p;
      bestV = v;
    }
  }
  const current = m.targetId != null ? inst.players.find((p) => p.id === m.targetId && !p.dead) : undefined;
  if (current && best && best !== current) {
    const held = m.enmity.get(current.id) ?? 0;
    if (bestV <= held * (current.role === 'tank' ? AGGRO.tankStick : AGGRO.stick)) return current;
  }
  return best;
}

/**
 * The top of the table for the threat meter, as [hero id, percent of the holder's aggro]. The
 * hero the monster is on reads 100; anyone else reads how close they are to pulling it, and can
 * read over 100 while the monster still sticks (it turns at 110, or 130 off a tank).
 */
export function aggroTable(m: Monster, limit = 4): [number, number][] {
  const rows = [...m.enmity.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = rows[0]?.[1] ?? 0;
  if (top <= 0) return [];
  const held = m.targetId != null ? (m.enmity.get(m.targetId) ?? 0) : 0;
  const base = held > 0 ? held : top;
  return rows.slice(0, limit).map(([id, v]) => [id, Math.min(999, Math.round((v / base) * 100))]);
}
