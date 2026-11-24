/** Entities in a dungeon instance. */
import type { ProjectileLook, RoleId, SkillDef } from '../../shared/content/classes.js';
import type { AbilityDef, BossDef, BossKind, MobDef, MobKind } from '../../shared/content/monsters.js';
import type { Shape, Vec } from '../../shared/geometry.js';
import type { TelegraphStyle } from '../../shared/protocol.js';

export interface StatusInst {
  id: string;
  sourceId: number;
  expires: number;
  stacks: number;
  /** Damage or heal per tick for DoTs and HoTs. */
  potency: number;
  /** Remaining absorb for barriers. */
  value: number;
}

export interface ActorBase {
  id: number;
  team: 'party' | 'enemy';
  name: string;
  x: number;
  y: number;
  facing: number;
  radius: number;
  speed: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  statuses: StatusInst[];
  targetId: number | null;
  /** Damage dealt per 100 potency (players) or multiplier on listed damage (monsters). */
  power: number;
  autoNext: number;
}

/** A skill being wound up. Moving cancels it. */
export interface PlayerCast {
  skillId: string;
  aim: Vec;
  start: number;
  end: number;
  x: number;
  y: number;
}

export interface PlayerStats {
  damage: number;
  healing: number;
  deaths: number;
  raises: number;
}

export interface Player extends ActorBase {
  kind: 'player';
  team: 'party';
  /** The lobby player who controls this character, or null for an AI companion. */
  ownerId: string | null;
  /** True while an AI drives the character (companions, and humans who disconnected). */
  botControlled: boolean;
  role: RoleId;
  weapon: string;
  hotbar: string[];
  mp: number;
  maxMp: number;
  stamina: number;
  maxStamina: number;
  staminaRegen: number;
  healPower: number;
  defense: number;
  enmityMult: number;
  cooldowns: Map<string, number>;
  cast: PlayerCast | null;
  /** Where the player is aiming (world coordinates). */
  aim: Vec;
  /** Holding the basic attack button. */
  attacking: boolean;
  basicReadyAt: number;
  chain: number;
  chainResetAt: number;
  /** Short lock after using a skill. */
  lockUntil: number;
  /** An AI roll in progress. */
  roll: { dx: number; dy: number; until: number } | null;
  /** Bumped whenever the server moves the character, so stale client positions are ignored. */
  epoch: number;
  moveBudget: number;
  lastHitAt: number;
  stats: PlayerStats;
  /** Scratch space for the AI controller. */
  ai: Record<string, unknown>;
}

export interface MonsterCast {
  ability: AbilityDef;
  /** Shown on the cast bar; combined steps show every ability. */
  name: string;
  start: number;
  end: number;
  telegraphs: number[];
  /** Target captured when the cast started. */
  targetId: number | null;
}

export interface Monster extends ActorBase {
  kind: 'mob' | 'boss';
  team: 'enemy';
  mob?: MobDef;
  mobKind?: MobKind;
  boss?: BossDef;
  bossKind?: BossKind;
  roomIndex: number;
  engaged: boolean;
  enmity: Map<number, number>;
  cast: MonsterCast | null;
  abilityReady: Map<string, number>;
  stunImmune: boolean;
  attackRange: number;
  autoPotency: number;
  autoInterval: number;
  ranged: boolean;
  home: { x: number; y: number };
  /** Boss crowd-control meter; full means staggered. */
  stagger: number;
  staggerMax: number;
  /** Boss timeline. */
  phase: number;
  step: number;
  inIntro: boolean;
  nextStepAt: number;
}

export type Actor = Player | Monster;

export interface Telegraph {
  id: number;
  ownerId: number;
  ability: AbilityDef;
  shape: Shape;
  style: TelegraphStyle;
  start: number;
  end: number;
  /** Marker telegraphs follow an entity until they resolve. */
  followId: number | null;
  /** Routine attacks (monster swings) that AI companions mostly ignore. */
  minor: boolean;
  resolve: () => void;
}

export interface Projectile {
  id: number;
  ownerId: number;
  team: 'party' | 'enemy';
  x: number;
  y: number;
  dir: number;
  speed: number;
  radius: number;
  range: number;
  traveled: number;
  pierce: boolean;
  explode: number;
  look: ProjectileLook;
  hue: number;
  hit: Set<number>;
  /** Player projectiles carry their skill; monster projectiles their potency. */
  skill: SkillDef | null;
  potency: number;
  name: string;
}
