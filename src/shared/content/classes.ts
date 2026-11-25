/**
 * Roles, weapons and skills. Combat is aimed: every attack and skill fires toward the mouse
 * cursor as an arc, thrust, projectile, ground blast, dash or leap.
 *
 * Each weapon has a basic attack chain (hold left mouse) and five skills: a special (right
 * mouse), three skills (Q, E, R) and an ultimate (F). Each role adds two role skills (1, 2),
 * and everyone has an Elixir (3) and a dodge roll (Space).
 */

export type RoleId = 'tank' | 'mage' | 'ranger' | 'melee';
export const ROLE_ORDER: RoleId[] = ['tank', 'mage', 'ranger', 'melee'];

export type ProjectileLook = 'arrow' | 'bolt' | 'orb' | 'axe' | 'shield' | 'wave' | 'spark' | 'enemy';

/** How a skill reaches its targets. Directions and points come from the player's aim. */
export type Delivery =
  /** A sweep in front of the user. */
  | { kind: 'arc'; radius: number; angle: number }
  /** A straight strike from the user toward the aim. */
  | { kind: 'thrust'; length: number; width: number }
  /** Everything within a radius of the user. */
  | { kind: 'self'; radius: number }
  /** A circle at the aimed point (pulled in to `range`), optionally landing after a delay. */
  | { kind: 'ground'; radius: number; range: number; delay?: number }
  /** One or more projectiles that fly toward the aim. */
  | { kind: 'projectile'; speed: number; radius: number; range: number; pierce?: boolean; explode?: number; count?: number; spread?: number; look: ProjectileLook }
  /** The user rushes toward the aim, striking everything along the way. */
  | { kind: 'dash'; distance: number; width: number }
  /** The user leaps to the aimed point and strikes around where they land. */
  | { kind: 'leap'; range: number; radius: number }
  /** No area: buffs, heals and movement on the user. */
  | { kind: 'none' };

/**
 * What a skill does. "hit" means the enemies it strikes; "area" means allies inside its area
 * (ground circles and self radius); "party" means every ally within 18 tiles.
 */
export type Effect =
  | { kind: 'damage'; potency: number }
  | { kind: 'heal'; potency: number; to: 'self' | 'area' | 'party' }
  | { kind: 'healPct'; pct: number; to: 'self' | 'area' | 'party' }
  | { kind: 'status'; status: string; duration: number; to: 'self' | 'hit' | 'area' | 'party'; potency?: number }
  | { kind: 'barrier'; pct: number; to: 'self' | 'area' | 'party' }
  | { kind: 'knockback'; distance: number }
  | { kind: 'pull'; distance: number }
  | { kind: 'stun'; duration: number }
  | { kind: 'taunt' }
  | { kind: 'stagger'; amount: number }
  | { kind: 'mp'; amount: number }
  | { kind: 'raise' }
  /** Moves the user toward or away from the aim (blinks and vaults). */
  | { kind: 'move'; mode: 'toward' | 'away'; distance: number };

export type Slot = 'basic' | 'special' | 'q' | 'e' | 'r' | 'ult' | 'role' | 'item' | 'dodge';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  glyph: string;
  hue: number;
  slot: Slot;
  cooldown: number;
  mp: number;
  stamina: number;
  /** Seconds the user stands still winding up before it fires. Moving cancels it. */
  windup: number;
  delivery: Delivery;
  effects: Effect[];
  /** Seconds of invulnerability when used. */
  iframes?: number;
  /** Damage multiplier against enemies below 30% health. */
  execute?: number;
}

export interface WeaponDef {
  id: string;
  role: RoleId;
  name: string;
  style: string;
  description: string;
  /** The basic attack chain: one hit every `interval` seconds while the button is held. */
  basic: { interval: number; hits: string[] };
  /** Special, Q, E, R and ultimate. */
  skills: [string, string, string, string, string];
  ranged: boolean;
  /** Where AI companions like to stand from their target's edge. */
  reach: number;
  /** The party's main source of healing. */
  healer?: boolean;
}

export interface RoleDef {
  id: RoleId;
  name: string;
  tagline: string;
  description: string;
  color: string;
  hp: number;
  /** 0 means the role does not use MP. */
  mp: number;
  stamina: number;
  staminaRegen: number;
  /** Damage per 100 potency. */
  power: number;
  /** Healing per 100 potency. */
  healPower: number;
  /** Multiplier on damage taken. */
  defense: number;
  /** Multiplier on enmity generated. */
  enmity: number;
  speed: number;
  /** The man's weapon, then the woman's: each hero carries one. */
  weapons: string[];
  roleSkills: [string, string];
}

const skills: SkillDef[] = [];
type SkillInput = Omit<SkillDef, 'cooldown' | 'mp' | 'stamina' | 'windup' | 'delivery'> & Partial<Pick<SkillDef, 'cooldown' | 'mp' | 'stamina' | 'windup' | 'delivery'>>;
function def(s: SkillInput): string {
  skills.push({ cooldown: 0, mp: 0, stamina: 0, windup: 0, delivery: { kind: 'none' }, ...s });
  return s.id;
}
const dmg = (potency: number): Effect => ({ kind: 'damage', potency });
const arc = (radius: number, degrees: number): Delivery => ({ kind: 'arc', radius, angle: (degrees * Math.PI) / 180 });
const thrust = (length: number, width: number): Delivery => ({ kind: 'thrust', length, width });

/** Builds a three-hit basic chain from deliveries and potencies. */
function chain(weapon: string, name: string, glyph: string, hue: number, hits: { delivery: Delivery; potency: number; effects?: Effect[] }[]): string[] {
  return hits.map((hit, i) =>
    def({ id: `${weapon}.basic${i + 1}`, name: `${name} ${['I', 'II', 'III'][i]}`, glyph, hue, slot: 'basic', delivery: hit.delivery, description: `Basic attack, hit ${i + 1} of ${hits.length}: potency ${hit.potency}.`, effects: [dmg(hit.potency), ...(hit.effects ?? [])] }),
  );
}

// ── Everyone ───────────────────────────────────────────────────────────────────────────────
def({ id: 'dodge', name: 'Dodge Roll', glyph: '↷', hue: 200, slot: 'dodge', stamina: 30, iframes: 0.35, description: 'Roll a short distance. You cannot be hurt while rolling. Costs 30 stamina.', effects: [] });
def({ id: 'elixir', name: 'Elixir', glyph: '⚗︎', hue: 330, slot: 'item', cooldown: 60, description: 'Drink an elixir: restore 35% of your maximum HP.', effects: [{ kind: 'healPct', pct: 0.35, to: 'self' }] });

// ── Role skills ────────────────────────────────────────────────────────────────────────────
def({ id: 'challenge', name: 'Challenge', glyph: '!', hue: 0, slot: 'role', cooldown: 15, delivery: { kind: 'self', radius: 9 }, description: 'Roar a challenge: every enemy within 9 tiles turns on you. Potency 60.', effects: [dmg(60), { kind: 'taunt' }, { kind: 'stagger', amount: 10 }] });
def({ id: 'rallyingBulwark', name: 'Rallying Bulwark', glyph: '⛨', hue: 215, slot: 'role', cooldown: 50, description: 'Rally the party: everyone within 18 tiles takes 20% less damage for 12s and gains a barrier of 8% of their max HP.', effects: [{ kind: 'status', status: 'bulwark', duration: 12, to: 'party' }, { kind: 'barrier', pct: 0.08, to: 'party' }] });
def({ id: 'arcaneBlink', name: 'Arcane Blink', glyph: '⤳', hue: 270, slot: 'role', cooldown: 12, iframes: 0.3, description: 'Teleport 7 tiles toward your aim.', effects: [{ kind: 'move', mode: 'toward', distance: 7 }] });
def({ id: 'manaFont', name: 'Mana Font', glyph: '◌', hue: 205, slot: 'role', cooldown: 45, description: 'Restore 3000 MP.', effects: [{ kind: 'mp', amount: 3000 }] });
def({ id: 'vault', name: 'Vault', glyph: '↶', hue: 165, slot: 'role', cooldown: 12, iframes: 0.4, description: 'Leap 7 tiles away from your aim, untouchable mid-air.', effects: [{ kind: 'move', mode: 'away', distance: 7 }] });
def({ id: 'fieldDressing', name: 'Field Dressing', glyph: '✚', hue: 130, slot: 'role', cooldown: 40, description: 'Patch yourself up: restore 25% of your max HP.', effects: [{ kind: 'healPct', pct: 0.25, to: 'self' }] });
def({ id: 'bloodrush', name: 'Bloodrush', glyph: '✪', hue: 10, slot: 'role', cooldown: 40, description: 'Deal 25% more damage for 12s, but take 15% more.', effects: [{ kind: 'status', status: 'bloodrush', duration: 12, to: 'self' }] });
def({ id: 'secondWind', name: 'Second Wind', glyph: '✚', hue: 120, slot: 'role', cooldown: 40, description: 'Catch your breath: restore 25% of your max HP.', effects: [{ kind: 'healPct', pct: 0.25, to: 'self' }] });

// ── Warrior: Greatsword ────────────────────────────────────────────────────────────────────────
const tgBasic = chain('tank_greatsword', 'Greatsword Cleave', '⚔', 30, [
  { delivery: arc(3.2, 160), potency: 120 },
  { delivery: arc(3.2, 160), potency: 120 },
  { delivery: arc(3.4, 180), potency: 190, effects: [{ kind: 'stagger', amount: 3 }] },
]);
const tgSkills: WeaponDef['skills'] = [
  def({ id: 'parry', name: 'Parry', glyph: '⟋', hue: 215, slot: 'special', cooldown: 7, description: 'Raise your blade for 1s: 75% less damage taken.', effects: [{ kind: 'status', status: 'parry', duration: 1, to: 'self' }] }),
  def({ id: 'upheaval', name: 'Upheaval', glyph: '⇡', hue: 35, slot: 'q', cooldown: 9, delivery: thrust(6, 3), description: 'Rip the ground upward: potency 200 and a 1.5s stun in a line.', effects: [dmg(200), { kind: 'stun', duration: 1.5 }, { kind: 'stagger', amount: 30 }] }),
  def({ id: 'gravitySweep', name: 'Gravity Sweep', glyph: '◎', hue: 260, slot: 'e', cooldown: 12, delivery: { kind: 'self', radius: 7 }, description: 'Drag every enemy within 7 tiles toward you: potency 140, and they turn on you.', effects: [dmg(140), { kind: 'pull', distance: 4 }, { kind: 'taunt' }, { kind: 'stagger', amount: 15 }] }),
  def({ id: 'earthsplitter', name: 'Earthsplitter', glyph: '⇥', hue: 25, slot: 'r', cooldown: 11, delivery: thrust(10, 3), description: 'Split the earth in a 10-tile line: potency 260 and slows.', effects: [dmg(260), { kind: 'status', status: 'slow', duration: 5, to: 'hit' }] }),
  def({ id: 'titansVerdict', name: 'Titan’s Verdict', glyph: '▼', hue: 40, slot: 'ult', cooldown: 40, iframes: 0.4, delivery: { kind: 'leap', range: 9, radius: 5 }, description: 'Ultimate. Leap to your aim and smash down: potency 420 and a 2s stun.', effects: [dmg(420), { kind: 'stun', duration: 2 }, { kind: 'stagger', amount: 70 }] }),
];

// ── Warrior: Battleaxe ─────────────────────────────────────────────────────────────────────────
const baBasic = chain('battleaxe', 'Axe Chop', '⚒', 5, [
  { delivery: arc(2.8, 110), potency: 110 },
  { delivery: arc(2.8, 110), potency: 110 },
  { delivery: arc(3, 140), potency: 170, effects: [{ kind: 'stagger', amount: 3 }] },
]);
const baSkills: WeaponDef['skills'] = [
  def({ id: 'ironHide', name: 'Iron Hide', glyph: '♥', hue: 350, slot: 'special', cooldown: 10, description: 'For 4s take 30% less damage and heal for 30% of the damage you deal.', effects: [{ kind: 'status', status: 'ironHide', duration: 4, to: 'self' }] }),
  def({ id: 'cleavingSpin', name: 'Cleaving Spin', glyph: '◎', hue: 10, slot: 'q', cooldown: 7, delivery: { kind: 'self', radius: 4.5 }, description: 'Spin with your axe: potency 180 to everything around you, and they turn on you.', effects: [dmg(180), { kind: 'taunt' }] }),
  def({ id: 'hurlAxe', name: 'Hurl Axe', glyph: '⚒', hue: 20, slot: 'e', cooldown: 9, delivery: { kind: 'projectile', speed: 18, radius: 0.6, range: 13, look: 'axe' }, description: 'Throw a hand axe: potency 180 and a 1.5s stun.', effects: [dmg(180), { kind: 'stun', duration: 1.5 }, { kind: 'stagger', amount: 20 }] }),
  def({ id: 'warStomp', name: 'War Stomp', glyph: '≋', hue: 30, slot: 'r', cooldown: 14, delivery: { kind: 'self', radius: 6 }, description: 'Stomp the ground: potency 120, a 1.5s stun and a slow around you.', effects: [dmg(120), { kind: 'stun', duration: 1.5 }, { kind: 'status', status: 'slow', duration: 4, to: 'hit' }, { kind: 'stagger', amount: 30 }] }),
  def({ id: 'bloodstorm', name: 'Bloodstorm', glyph: '✺', hue: 355, slot: 'ult', cooldown: 40, delivery: { kind: 'self', radius: 5 }, description: 'Ultimate. A whirlwind of blood: potency 450 around you, heal 20% of your max HP, and every enemy hit turns on you.', effects: [dmg(450), { kind: 'healPct', pct: 0.2, to: 'self' }, { kind: 'taunt' }, { kind: 'stagger', amount: 40 }] }),
];

// ── Mage: Staff (healer) ────────────────────────────────────────────────────────────────────
const stBasic = chain('staff', 'Arcane Bolt', '✦', 265, [
  { delivery: { kind: 'projectile', speed: 24, radius: 0.4, range: 22, look: 'spark' }, potency: 105 },
  { delivery: { kind: 'projectile', speed: 24, radius: 0.4, range: 22, look: 'spark' }, potency: 105 },
  { delivery: { kind: 'projectile', speed: 20, radius: 0.55, range: 22, explode: 2, look: 'orb' }, potency: 160 },
]);
const stSkills: WeaponDef['skills'] = [
  def({ id: 'mendingLight', name: 'Mending Light', glyph: '✚', hue: 120, slot: 'special', cooldown: 1.5, mp: 450, windup: 0.4, delivery: { kind: 'ground', radius: 3.5, range: 20 }, description: 'Heal allies in a circle at your aim (potency 450).', effects: [{ kind: 'heal', potency: 450, to: 'area' }] }),
  def({ id: 'arcaneOrb', name: 'Arcane Orb', glyph: '◉', hue: 280, slot: 'q', cooldown: 6, mp: 400, delivery: { kind: 'projectile', speed: 10, radius: 0.9, range: 18, pierce: true, look: 'orb' }, description: 'A slow orb that passes through foes: potency 230 to each.', effects: [dmg(230)] }),
  def({ id: 'sanctuary', name: 'Sanctuary', glyph: '❀', hue: 140, slot: 'e', cooldown: 14, mp: 700, delivery: { kind: 'ground', radius: 4.5, range: 18 }, description: 'Hallow the ground at your aim: allies there heal 130 every 3s for 12s; enemies take potency 150.', effects: [dmg(150), { kind: 'status', status: 'sanctuary', duration: 12, to: 'area', potency: 130 }] }),
  def({ id: 'meteor', name: 'Meteor', glyph: '☄', hue: 18, slot: 'r', cooldown: 12, mp: 800, delivery: { kind: 'ground', radius: 4, range: 20, delay: 1.1 }, description: 'Call down a meteor at your aim: after a moment, potency 420, a 1s stun and burning.', effects: [dmg(420), { kind: 'stun', duration: 1 }, { kind: 'status', status: 'burning', duration: 9, to: 'hit', potency: 60 }, { kind: 'stagger', amount: 25 }] }),
  def({ id: 'resurrection', name: 'Resurrection', glyph: '✧', hue: 55, slot: 'ult', cooldown: 60, mp: 2000, windup: 1.5, delivery: { kind: 'ground', radius: 5, range: 20 }, description: 'Ultimate. Revive every fallen ally in a circle at your aim, and heal everyone there (potency 600).', effects: [{ kind: 'raise' }, { kind: 'heal', potency: 600, to: 'area' }] }),
];

// ── Mage: Mystic Sword & Wand ──────────────────────────────────────────────────────────────────────
const msBasic = chain('mystic_sword', 'Mystic Slash', '⟋', 290, [
  { delivery: arc(2.6, 130), potency: 110 },
  { delivery: arc(2.6, 130), potency: 110 },
  { delivery: { kind: 'projectile', speed: 20, radius: 0.8, range: 9, pierce: true, look: 'wave' }, potency: 170 },
]);
const msSkills: WeaponDef['skills'] = [
  def({ id: 'runicWard', name: 'Runic Ward', glyph: '◇', hue: 48, slot: 'special', cooldown: 12, mp: 400, delivery: { kind: 'self', radius: 7 }, description: 'Wards: a barrier of 12% of max HP on you and 8% on allies within 7 tiles.', effects: [{ kind: 'barrier', pct: 0.08, to: 'area' }, { kind: 'barrier', pct: 0.12, to: 'self' }] }),
  def({ id: 'spellbladeRush', name: 'Spellblade Rush', glyph: '⇢', hue: 285, slot: 'q', cooldown: 7, mp: 300, iframes: 0.25, delivery: { kind: 'dash', distance: 6, width: 2 }, description: 'Dash 6 tiles through your foes: potency 180 to each.', effects: [dmg(180)] }),
  def({ id: 'arcLightning', name: 'Arc Lightning', glyph: '↯', hue: 200, slot: 'e', cooldown: 6, mp: 400, delivery: { kind: 'projectile', speed: 30, radius: 0.5, range: 16, explode: 2.5, look: 'bolt' }, description: 'Hurl lightning that bursts on impact: potency 210 around the target.', effects: [dmg(210)] }),
  def({ id: 'lifebindingSigil', name: 'Lifebinding Sigil', glyph: '✿', hue: 150, slot: 'r', cooldown: 12, mp: 600, delivery: { kind: 'self', radius: 6 }, description: 'A sigil around you: potency 170 to enemies and heals allies in it (potency 320).', effects: [dmg(170), { kind: 'heal', potency: 320, to: 'area' }] }),
  def({ id: 'astralCleave', name: 'Astral Cleave', glyph: '✹', hue: 300, slot: 'ult', cooldown: 35, mp: 800, windup: 0.5, delivery: thrust(14, 4), description: 'Ultimate. A great astral blade 14 tiles long: potency 560.', effects: [dmg(560), { kind: 'stagger', amount: 40 }] }),
];

// ── Ranger: Longbow ─────────────────────────────────────────────────────────────────────────────
const arrow = (potency: number) => ({ delivery: { kind: 'projectile', speed: 30, radius: 0.35, range: 24, look: 'arrow' } as Delivery, potency });
const bwBasic = chain('bow', 'Quick Arrow', '➶', 95, [arrow(120), arrow(120), arrow(150)]);
const bwSkills: WeaponDef['skills'] = [
  def({ id: 'chargedShot', name: 'Charged Shot', glyph: '➹', hue: 55, slot: 'special', cooldown: 5, windup: 0.6, delivery: { kind: 'projectile', speed: 42, radius: 0.5, range: 28, pierce: true, look: 'arrow' }, description: 'Draw fully, then loose an arrow that pierces everything: potency 420.', effects: [dmg(420)] }),
  def({ id: 'volley', name: 'Volley', glyph: '⇊', hue: 85, slot: 'q', cooldown: 8, delivery: { kind: 'ground', radius: 4, range: 20, delay: 0.6 }, description: 'Arrows rain on your aim a moment later: potency 260.', effects: [dmg(260)] }),
  def({ id: 'snareTrap', name: 'Snare Trap', glyph: '⁂', hue: 40, slot: 'e', cooldown: 14, delivery: { kind: 'ground', radius: 2.8, range: 12 }, description: 'Snap a snare at your aim: potency 80, a 2.5s stun and a slow.', effects: [dmg(80), { kind: 'stun', duration: 2.5 }, { kind: 'status', status: 'slow', duration: 6, to: 'hit' }, { kind: 'stagger', amount: 25 }] }),
  def({ id: 'fanOfArrows', name: 'Fan of Arrows', glyph: '⋔', hue: 75, slot: 'r', cooldown: 9, delivery: { kind: 'projectile', speed: 28, radius: 0.35, range: 14, count: 5, spread: (50 * Math.PI) / 180, look: 'arrow' }, description: 'Five arrows in a fan: potency 140 each.', effects: [dmg(140)] }),
  def({ id: 'rainOfRuin', name: 'Rain of Ruin', glyph: '☔︎', hue: 45, slot: 'ult', cooldown: 40, delivery: { kind: 'ground', radius: 6, range: 20, delay: 1 }, description: 'Ultimate. Blacken the sky over your aim: potency 680 and bleeding.', effects: [dmg(680), { kind: 'status', status: 'bleed', duration: 9, to: 'hit', potency: 80 }] }),
];

// ── Ranger: Crossbow ────────────────────────────────────────────────────────────────────────
const bolt = (potency: number) => ({ delivery: { kind: 'projectile', speed: 34, radius: 0.35, range: 20, look: 'bolt' } as Delivery, potency });
const cbBasic = chain('crossbow', 'Bolt', '→', 30, [bolt(92), bolt(92), bolt(120)]);
const cbSkills: WeaponDef['skills'] = [
  def({ id: 'piercingBolt', name: 'Piercing Bolt', glyph: '⇛', hue: 35, slot: 'special', cooldown: 6, delivery: { kind: 'projectile', speed: 40, radius: 0.45, range: 24, pierce: true, look: 'bolt' }, description: 'A bolt that pierces every foe in line: potency 290 and slows.', effects: [dmg(290), { kind: 'status', status: 'slow', duration: 4, to: 'hit' }] }),
  def({ id: 'explosiveBolt', name: 'Explosive Bolt', glyph: '✸', hue: 20, slot: 'q', cooldown: 8, delivery: { kind: 'projectile', speed: 30, radius: 0.45, range: 20, explode: 3, look: 'bolt' }, description: 'A bolt that explodes: potency 300 around the impact, knocking foes back.', effects: [dmg(300), { kind: 'knockback', distance: 2 }, { kind: 'stagger', amount: 15 }] }),
  def({ id: 'tumbleShot', name: 'Tumble Shot', glyph: '↺', hue: 170, slot: 'e', cooldown: 9, iframes: 0.35, delivery: { kind: 'projectile', speed: 34, radius: 0.4, range: 20, look: 'bolt' }, description: 'Tumble 5 tiles back while firing: potency 220.', effects: [{ kind: 'move', mode: 'away', distance: 5 }, dmg(220)] }),
  def({ id: 'scattershot', name: 'Scattershot', glyph: '⋙', hue: 40, slot: 'r', cooldown: 10, delivery: arc(7, 70), description: 'Blast a cone of shrapnel: potency 280, knocking foes back.', effects: [dmg(280), { kind: 'knockback', distance: 3 }, { kind: 'stagger', amount: 15 }] }),
  def({ id: 'siegeBarrage', name: 'Siege Barrage', glyph: '⇶', hue: 25, slot: 'ult', cooldown: 35, delivery: { kind: 'projectile', speed: 32, radius: 0.4, range: 20, count: 9, spread: (30 * Math.PI) / 180, look: 'bolt' }, description: 'Ultimate. Nine bolts in a tight spread: potency 150 each.', effects: [dmg(150)] }),
];

// ── Duelist: Halberd ────────────────────────────────────────────────────────────────────────────
const spBasic = chain('spear', 'Halberd Thrust', '↑', 220, [
  { delivery: thrust(3.8, 1.3), potency: 125 },
  { delivery: thrust(3.8, 1.3), potency: 125 },
  { delivery: thrust(4.2, 1.6), potency: 170 },
]);
const spSkills: WeaponDef['skills'] = [
  def({ id: 'sweepingStrike', name: 'Sweeping Strike', glyph: '◠', hue: 215, slot: 'special', cooldown: 5, delivery: arc(3.8, 200), description: 'Sweep the haft around you: potency 220, knocking foes back.', effects: [dmg(220), { kind: 'knockback', distance: 1.5 }] }),
  def({ id: 'piercingThrust', name: 'Piercing Thrust', glyph: '⇑', hue: 225, slot: 'q', cooldown: 6, delivery: thrust(6, 1.8), description: 'A lunging thrust 6 tiles long: potency 360.', effects: [dmg(360)] }),
  def({ id: 'vaultStrike', name: 'Vault Strike', glyph: '⤒', hue: 205, slot: 'e', cooldown: 10, iframes: 0.4, delivery: { kind: 'leap', range: 7, radius: 2.5 }, description: 'Pole-vault to your aim and strike: potency 250.', effects: [dmg(250)] }),
  def({ id: 'whirlingSpear', name: 'Whirling Halberd', glyph: '✣', hue: 230, slot: 'r', cooldown: 9, delivery: { kind: 'self', radius: 3.8 }, description: 'Spin the halberd: potency 300 around you and slows.', effects: [dmg(300), { kind: 'status', status: 'slow', duration: 4, to: 'hit' }] }),
  def({ id: 'skewer', name: 'Skewer', glyph: '⟿', hue: 240, slot: 'ult', cooldown: 35, iframes: 0.3, delivery: { kind: 'dash', distance: 9, width: 2 }, description: 'Ultimate. Charge 9 tiles, skewering everything: potency 680.', effects: [dmg(680), { kind: 'stagger', amount: 40 }] }),
];

// ── Duelist: Twin Blades ───────────────────────────────────────────────────────────────────────
const mgBasic = chain('greatsword', 'Twin Slash', '⚔', 0, [
  { delivery: arc(3.4, 150), potency: 175 },
  { delivery: arc(3.4, 150), potency: 175 },
  { delivery: arc(3.6, 200), potency: 260 },
]);
const mgSkills: WeaponDef['skills'] = [
  def({ id: 'risingSlash', name: 'Rising Slash', glyph: '⤴', hue: 15, slot: 'special', cooldown: 6, delivery: arc(3.6, 120), description: 'An upward slash that launches foes: potency 280 and a short stun.', effects: [dmg(280), { kind: 'stun', duration: 0.8 }, { kind: 'stagger', amount: 15 }] }),
  def({ id: 'whirlwind', name: 'Whirlwind', glyph: '◎', hue: 5, slot: 'q', cooldown: 8, delivery: { kind: 'self', radius: 4 }, description: 'Spin with both blades outstretched: potency 340 around you.', effects: [dmg(340)] }),
  def({ id: 'reaversLunge', name: 'Reaver’s Lunge', glyph: '⇢', hue: 355, slot: 'e', cooldown: 9, iframes: 0.25, delivery: { kind: 'dash', distance: 6, width: 2.2 }, description: 'Lunge 6 tiles: potency 260 to everything in your path.', effects: [dmg(260)] }),
  def({ id: 'executioner', name: 'Executioner', glyph: '✠', hue: 350, slot: 'r', cooldown: 12, windup: 0.4, delivery: thrust(5, 3), execute: 1.6, description: 'Both blades brought down in a crossing chop: potency 520, and 60% more against foes below 30% health.', effects: [dmg(520)] }),
  def({ id: 'cataclysmBlade', name: 'Cataclysm Blades', glyph: '✹', hue: 10, slot: 'ult', cooldown: 40, windup: 0.6, delivery: { kind: 'self', radius: 5.5 }, description: 'Ultimate. A ruinous spinning strike: potency 900 around you.', effects: [dmg(900), { kind: 'stagger', amount: 50 }] }),
];

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(skills.map((s) => [s.id, s]));

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(
  (
    [
      { id: 'tank_greatsword', role: 'tank', name: 'Greatsword', style: 'Warden', ranged: false, reach: 1, description: 'Wide cleaves and crowd control: drag enemies together, stun them in lines, leap in to crush them.', basic: { interval: 0.85, hits: tgBasic }, skills: tgSkills },
      { id: 'battleaxe', role: 'tank', name: 'Battleaxe', style: 'Berserker', ranged: false, reach: 1, description: 'Relentless chops that heal you, a thrown axe that stuns, and a stomp that locks down a crowd.', basic: { interval: 0.7, hits: baBasic }, skills: baSkills },
      { id: 'staff', role: 'mage', name: 'Staff', style: 'Sage', ranged: true, healer: true, reach: 9, description: 'The party’s lifeline: healing circles, a sanctuary, meteors and the power to raise the fallen.', basic: { interval: 0.55, hits: stBasic }, skills: stSkills },
      { id: 'mystic_sword', role: 'mage', name: 'Mystic Sword & Wand', style: 'Spellblade', ranged: false, reach: 1.2, description: 'A sword in one hand and a wand in the other: arcane slashes, lightning, wards and a healing sigil.', basic: { interval: 0.55, hits: msBasic }, skills: msSkills },
      { id: 'bow', role: 'ranger', name: 'Longbow', style: 'Marksman', ranged: true, reach: 11, description: 'Long range and huge damage: charged shots, volleys, traps and a fan of arrows.', basic: { interval: 0.5, hits: bwBasic }, skills: bwSkills },
      { id: 'crossbow', role: 'ranger', name: 'Crossbow', style: 'Arbalist', ranged: true, reach: 9, description: 'Rapid bolts, explosive shots, a shrapnel blast and a tumble to escape danger.', basic: { interval: 0.36, hits: cbBasic }, skills: cbSkills },
      { id: 'spear', role: 'melee', name: 'Halberd', style: 'Halberdier', ranged: false, reach: 2.4, description: 'An axe-blade on a long haft: fast thrusts with long reach, sweeping cuts, a vault and a skewering charge.', basic: { interval: 0.5, hits: spBasic }, skills: spSkills },
      { id: 'greatsword', role: 'melee', name: 'Twin Blades', style: 'Reaver', ranged: false, reach: 1.4, description: 'A blade in each hand and the biggest hits in Rhuin: sweeping slashes, whirlwinds and an executioner’s cross-cut.', basic: { interval: 0.8, hits: mgBasic }, skills: mgSkills },
    ] satisfies WeaponDef[]
  ).map((w) => [w.id, w]),
);

export const ROLES: Record<RoleId, RoleDef> = {
  tank: {
    id: 'tank',
    name: 'Warrior',
    tagline: 'Hold the line',
    description: 'The most health and stamina in the party. Crowd control and taunts keep enemies on you, and Rallying Bulwark shields everyone.',
    color: '#4f8dff',
    hp: 13000,
    mp: 0,
    stamina: 150,
    staminaRegen: 30,
    power: 200,
    healPower: 200,
    defense: 0.75,
    enmity: 5,
    speed: 5.7,
    weapons: ['tank_greatsword', 'battleaxe'],
    roleSkills: ['challenge', 'rallyingBulwark'],
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    tagline: 'Spells to harm and heal',
    description: 'Offensive and healing spells. His Staff keeps the party alive; her Mystic Sword and wand fight up close with spellblade magic.',
    color: '#c77dff',
    hp: 6200,
    mp: 10000,
    stamina: 100,
    staminaRegen: 22,
    power: 260,
    healPower: 300,
    defense: 1,
    enmity: 1,
    speed: 6,
    weapons: ['staff', 'mystic_sword'],
    roleSkills: ['arcaneBlink', 'manaFont'],
  },
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    tagline: 'Ranged glass cannon',
    description: 'High damage from afar, but fragile: low health and 15% more damage taken. Keep moving and keep your distance.',
    color: '#7dd96f',
    hp: 5200,
    mp: 0,
    stamina: 110,
    staminaRegen: 24,
    power: 290,
    healPower: 250,
    defense: 1.15,
    enmity: 1,
    speed: 6.4,
    weapons: ['crossbow', 'bow'],
    roleSkills: ['vault', 'fieldDressing'],
  },
  melee: {
    id: 'melee',
    name: 'Duelist',
    tagline: 'Melee glass cannon',
    description: 'The highest damage in the party and the easiest to fall: low health and 20% more damage taken. Strike hard, dodge often.',
    color: '#ff7d5a',
    hp: 5600,
    mp: 0,
    stamina: 110,
    staminaRegen: 24,
    power: 320,
    healPower: 250,
    defense: 1.2,
    enmity: 1,
    speed: 6.4,
    weapons: ['spear', 'greatsword'],
    roleSkills: ['bloodrush', 'secondWind'],
  },
};

export function skillDef(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`unknown skill ${id}`);
  return s;
}

/** The hotbar: basic attack, special, Q, E, R, ultimate, two role skills, Elixir, dodge. */
export function hotbarFor(role: RoleId, weaponId: string): string[] {
  const weapon = WEAPONS[weaponId];
  if (!weapon || weapon.role !== role) throw new Error(`weapon ${weaponId} is not a ${role} weapon`);
  return [weapon.basic.hits[0] as string, ...weapon.skills, ...ROLES[role].roleSkills, 'elixir', 'dodge'];
}

export const HOTBAR_KEYS = ['LMB', 'RMB', 'Q', 'E', 'R', 'F', '1', '2', '3', 'Space'];

export function isRole(role: unknown): role is RoleId {
  return typeof role === 'string' && role in ROLES;
}

/** Each hero comes as a man or a woman, and each carries one weapon of their own. */
export const HERO_LOOKS = ['male', 'female'] as const;
export type HeroLook = (typeof HERO_LOOKS)[number];

/** The look a hero has until the player picks one: the Mage defaults to the healer. */
export const DEFAULT_LOOK: Record<RoleId, HeroLook> = { tank: 'male', mage: 'male', ranger: 'female', melee: 'male' };

/** The weapon a hero carries: each role lists the man's weapon first, then the woman's. */
export function weaponFor(role: RoleId, look: HeroLook): string {
  return ROLES[role].weapons[look === 'male' ? 0 : 1] as string;
}

/** The weapon a basic-attack skill belongs to. */
export function weaponOfBasic(skillId: string): string | null {
  const dot = skillId.indexOf('.basic');
  return dot > 0 ? skillId.slice(0, dot) : null;
}
