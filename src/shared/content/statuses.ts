/** Buffs and debuffs. Percentages add up per stack and across statuses. */

export interface StatusDef {
  id: string;
  name: string;
  description: string;
  glyph: string;
  color: string;
  debuff: boolean;
  maxStacks?: number;
  /** +0.1 means the bearer deals 10% more damage. */
  dmgDealt?: number;
  /** -0.2 means the bearer takes 20% less damage; +0.25 is a vulnerability. */
  dmgTaken?: number;
  /** +0.3 means 30% faster movement. */
  speed?: number;
  /** 0.1 means attacks and skills recover 10% faster. */
  haste?: number;
  stun?: boolean;
  /** Ignores all damage (dodge rolls, vaults). */
  invulnerable?: boolean;
  /** Damage over time; the potency is stored on the applied status. */
  dot?: boolean;
  /** Heal over time; the potency is stored on the applied status. */
  hot?: boolean;
  /** Absorbs damage; the remaining amount is stored on the applied status. */
  barrier?: boolean;
  /** Fraction of damage dealt returned to the bearer as healing. */
  lifesteal?: number;
  /** Hidden from status bars (short technical states). */
  hidden?: boolean;
}

const list: StatusDef[] = [
  // General
  { id: 'evasion', name: 'Evasion', description: 'Rolling: untouchable for a moment.', glyph: '↷', color: '#bfe6ff', debuff: false, invulnerable: true, hidden: true },
  { id: 'barrier', name: 'Barrier', description: 'A ward absorbs incoming damage.', glyph: '◇', color: '#ffe08a', debuff: false, barrier: true },
  { id: 'vuln', name: 'Vulnerability Up', description: 'Struck by an avoidable attack: 25% more damage taken per stack.', glyph: '▼', color: '#ff5d5d', debuff: true, dmgTaken: 0.25, maxStacks: 4 },
  { id: 'weakness', name: 'Weakness', description: 'Recently revived: 25% less damage dealt.', glyph: '☓', color: '#b07cff', debuff: true, dmgDealt: -0.25 },
  { id: 'stun', name: 'Stunned', description: 'Unable to act or move.', glyph: '✶', color: '#ffd84a', debuff: true, stun: true },
  { id: 'slow', name: 'Slowed', description: 'Movement is 35% slower.', glyph: '◒', color: '#9aa4ff', debuff: true, speed: -0.35 },
  { id: 'staggered', name: 'Staggered', description: 'Overwhelmed by crowd control: helpless for 4s and taking 25% more damage.', glyph: '✸', color: '#ffcf4a', debuff: true, stun: true, dmgTaken: 0.25 },
  { id: 'enrage', name: 'Enraged', description: 'Deals 15% more damage and acts faster.', glyph: '☄', color: '#ff3b3b', debuff: false, dmgDealt: 0.15, haste: 0.1 },
  { id: 'echo', name: 'Echo of Rhuin', description: 'Strengthened by past defeats: 10% more damage dealt and 10% less damage taken per stack.', glyph: '✧', color: '#ffe9a8', debuff: false, dmgDealt: 0.1, dmgTaken: -0.1, maxStacks: 3 },
  { id: 'rhuinWard', name: 'Ward of Rhuin', description: 'The party has no Staff healer: 15% less damage taken, and health slowly returns in combat.', glyph: '❂', color: '#ffd98a', debuff: false, dmgTaken: -0.15, hot: true },

  // Tank
  { id: 'parry', name: 'Parry', description: 'Blade raised to parry: 75% less damage taken.', glyph: '⟋', color: '#8fb8ff', debuff: false, dmgTaken: -0.75 },
  { id: 'aegis', name: 'Aegis', description: 'Shield raised: 60% less damage taken.', glyph: '◈', color: '#ffe38a', debuff: false, dmgTaken: -0.6 },
  { id: 'bulwark', name: 'Rallying Bulwark', description: 'Protected by the Warrior’s rally: 20% less damage taken.', glyph: '⛨', color: '#9cc4ff', debuff: false, dmgTaken: -0.2 },

  // Mage
  { id: 'sanctuary', name: 'Sanctuary', description: 'Restoring health over time.', glyph: '❀', color: '#8dffb0', debuff: false, hot: true },
  { id: 'burning', name: 'Burning', description: 'Taking fire damage over time.', glyph: '♨', color: '#ff6a2a', debuff: true, dot: true },

  // Ranger
  { id: 'focus', name: 'Hunter’s Focus', description: '20% more damage dealt.', glyph: '◉', color: '#ffe066', debuff: false, dmgDealt: 0.2 },
  { id: 'bleed', name: 'Bleeding', description: 'Taking damage over time.', glyph: '♦', color: '#ff4f6d', debuff: true, dot: true },

  // Melee
  { id: 'bloodrush', name: 'Bloodrush', description: '25% more damage dealt, but 15% more damage taken.', glyph: '✪', color: '#ff5a3c', debuff: false, dmgDealt: 0.25, dmgTaken: 0.15 },
];

export const STATUSES: Record<string, StatusDef> = Object.fromEntries(list.map((s) => [s.id, s]));

export function statusDef(id: string): StatusDef {
  const def = STATUSES[id];
  if (!def) throw new Error(`unknown status ${id}`);
  return def;
}
