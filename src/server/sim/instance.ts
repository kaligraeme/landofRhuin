/**
 * One dungeon run: the generated map, the party of four, the monsters and the room-by-room
 * progression (waves, sealed boss arenas, wipes and checkpoints). The server ticks it 20 times
 * a second; tests can tick it as fast as they like.
 */
import { DOT_TICK, OUT_OF_COMBAT_DELAY, PLAYER_RADIUS, ROLL_DISTANCE, ROLL_TIME, SLIDECAST_WINDOW, TICK_DT } from '../../shared/constants.js';
import { hotbarFor, ROLES, skillDef, WEAPONS, type RoleId } from '../../shared/content/classes.js';
import { BOSSES, MOBS, THEMES, type MobKind, type ThemeId } from '../../shared/content/monsters.js';
import { STATUSES } from '../../shared/content/statuses.js';
import { angleTo, dist, type Shape, type Vec } from '../../shared/geometry.js';
import { circleFree, encodeTiles, moveCircle, nearestFree, segmentClear, T_FLOOR, T_GATE, type TileMap } from '../../shared/map.js';
import type { DutyState, EntitySnap, EntitySpawn, GameEvent, GateInfo, HeroLook, InstanceStart, MemberResult, MeSnap, ProjectileSnap, RoomInfo, ServerMsg, TelegraphSnap } from '../../shared/protocol.js';
import { Rng } from '../../shared/rng.js';
import { updateBot } from '../ai/botAI.js';
import { generateDungeon, insideRoom, type DungeonPlan, type GatePlan, type RoomPlan } from '../dungeonGen.js';
import { applyDamage, applyHeal, applyStatus, basicAttack, counterBurst, dodge, finishCast, getStatus, isStunned, speedOf, useSkill } from './combat.js';
import { stepProjectiles } from './projectiles.js';
import { updateMonster } from './monsterAI.js';
import { aggroTable, fadeAggro } from './aggro.js';
import type { Actor, Monster, Player, Projectile, Telegraph } from './types.js';

/**
 * Monsters' routine attacks and the blows they aim at whoever holds their aggro (swings, bolts,
 * shots, tank-busters, boss attacks) hit this much harder than their area mechanics: only a tank
 * can stand in front of them for long.
 */
export const FOCUS_DAMAGE = 3;

export interface Seat {
  look?: HeroLook;
  ownerId: string | null;
  name: string;
  role: RoleId;
  weapon: string;
}

export interface InstanceOptions {
  seed?: number;
  theme?: ThemeId;
  bosses?: number;
  /** Multiplier on monster health (e.g. 0.3 for quick test runs). */
  enemyHp?: number;
  /** Multiplier on monster damage. */
  enemyDamage?: number;
  /** Multiplier on monster attacks aimed at their aggro target (default FOCUS_DAMAGE). */
  focusDamage?: number;
  /** Seconds before the entrance barrier drops. */
  countdown?: number;
}

interface RoomState {
  plan: RoomPlan;
  status: 'idle' | 'active' | 'cleared';
  wave: number;
  nextWaveAt: number | null;
  bossId: number | null;
  sealAt: number | null;
  sealed: boolean;
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

export class Instance {
  readonly id: string;
  readonly plan: DungeonPlan;
  readonly map: TileMap;
  readonly rng: Rng;
  now = 0;
  ticks = 0;
  players: Player[] = [];
  monsters = new Map<number, Monster>();
  telegraphs = new Map<number, Telegraph>();
  projectiles = new Map<number, Projectile>();
  rooms: RoomState[];
  gates: { plan: GatePlan; open: boolean }[];
  phase: DutyState['phase'] = 'countdown';
  startsAt: number;
  completedAt: number | null = null;
  bossesDefeated = 0;
  wipes = 0;
  checkpoint = 0;
  lastCombatAt = -999;
  /** Sends a message to one human player (wired up by the lobby). */
  sendPrivate: (p: Player, msg: ServerMsg) => void = () => {};
  onComplete: (() => void) | null = null;

  /** No Staff healer in the party: everyone gets the Ward of Rhuin. */
  readonly noHealer: boolean;
  private nextEntityId = 1;
  private nextTelegraphId = 1;
  private tasks: { at: number; ownerId: number; fn: () => void }[] = [];
  private events: GameEvent[] = [];
  private wipeAt: number | null = null;
  private enemyHp: number;
  private enemyDamage: number;
  /** Extra weight on monster attacks aimed at their aggro target (see outgoingDamage). */
  focusDamage: number;

  constructor(id: string, seats: Seat[], opts: InstanceOptions = {}) {
    this.id = id;
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.rng = new Rng(seed ^ 0x5bd1e995);
    this.plan = generateDungeon(seed, { theme: opts.theme, bosses: opts.bosses });
    this.map = this.plan.map;
    this.enemyHp = opts.enemyHp ?? 1;
    this.enemyDamage = opts.enemyDamage ?? 1;
    this.focusDamage = opts.focusDamage ?? FOCUS_DAMAGE;
    this.startsAt = opts.countdown ?? 5;
    this.gates = this.plan.gates.map((g) => ({ plan: g, open: !g.startsClosed }));
    this.rooms = this.plan.rooms.map((plan) => ({ plan, status: 'idle', wave: 0, nextWaveAt: null, bossId: null, sealAt: null, sealed: false }));
    seats.forEach((seat, i) => this.addPlayer(seat, i));
    this.noHealer = !this.players.some((p) => WEAPONS[p.weapon]?.healer);
    for (const p of this.players) this.applyPassives(p);
    for (const rs of this.rooms) if (rs.plan.kind === 'boss') rs.bossId = this.spawnBoss(rs.plan).id;
  }

  // ── Entities ─────────────────────────────────────────────────────────────────────────────

  private addPlayer(seat: Seat, index: number): Player {
    const role = ROLES[seat.role];
    const spawn = this.plan.spawns[index % this.plan.spawns.length] as { x: number; y: number };
    const exit = this.gates[this.plan.rooms[0]?.exitGate ?? 0]?.plan.center ?? spawn;
    const p: Player = {
      id: this.nextEntityId++,
      kind: 'player',
      team: 'party',
      name: seat.name,
      x: spawn.x,
      y: spawn.y,
      facing: angleTo(spawn, exit),
      radius: PLAYER_RADIUS,
      speed: role.speed,
      hp: role.hp,
      maxHp: role.hp,
      dead: false,
      statuses: [],
      targetId: null,
      power: role.power,
      autoNext: 0,
      ownerId: seat.ownerId,
      botControlled: seat.ownerId === null,
      role: seat.role,
      look: seat.look,
      weapon: seat.weapon,
      hotbar: hotbarFor(seat.role, seat.weapon),
      mp: role.mp,
      maxMp: role.mp,
      healPower: role.healPower,
      defense: role.defense,
      enmityMult: role.enmity,
      stamina: role.stamina,
      maxStamina: role.stamina,
      staminaRegen: role.staminaRegen,
      cooldowns: new Map(),
      cast: null,
      aim: { x: exit.x, y: exit.y },
      attacking: false,
      basicReadyAt: 0,
      chain: 0,
      chainResetAt: 0,
      lockUntil: 0,
      roll: null,
      epoch: 0,
      moveBudget: 2,
      lastHitAt: -99,
      stats: { damage: 0, healing: 0, deaths: 0, raises: 0 },
      ai: {},
    };
    this.players.push(p);
    return p;
  }

  depthOf(roomIndex: number): number {
    return this.plan.rooms[roomIndex]?.depth ?? 0;
  }

  spawnMob(kind: MobKind, x: number, y: number, roomIndex: number, depth: number): Monster {
    const def = MOBS[kind];
    const hp = Math.round(def.hp * this.enemyHp * (1 + depth * 0.5));
    const m: Monster = {
      id: this.nextEntityId++,
      kind: 'mob',
      team: 'enemy',
      name: THEMES[this.plan.theme].mobNames[kind],
      x,
      y,
      facing: this.rng.next() * Math.PI * 2,
      radius: def.radius,
      speed: def.speed,
      hp,
      maxHp: hp,
      dead: false,
      statuses: [],
      targetId: null,
      power: this.enemyDamage * (1 + depth * 0.35),
      autoNext: 0,
      mob: def,
      mobKind: kind,
      roomIndex,
      engaged: false,
      enmity: new Map(),
      heat: new Map(),
      touched: new Set(),
      cast: null,
      abilityReady: new Map(),
      stunImmune: !!def.stunImmune,
      attackRange: def.attackRange,
      autoPotency: def.autoPotency,
      autoInterval: def.autoInterval,
      ranged: def.ranged,
      home: { x, y },
      stagger: 0,
      staggerMax: 0,
      phase: 0,
      step: 0,
      inIntro: false,
      nextStepAt: 0,
    };
    this.monsters.set(m.id, m);
    this.emit({ e: 'spawn', ent: this.spawnInfo(m) });
    this.emit({ e: 'fx', k: 'rift', x, y, r: def.radius + 1, hue: 280 });
    return m;
  }

  private spawnBoss(room: RoomPlan): Monster {
    const kind = room.boss ?? 'juggernaut';
    const def = BOSSES[kind];
    const tier = room.bossIndex ?? 0;
    const hp = Math.round(def.hp * this.enemyHp * (1 + tier * 0.12));
    const facing = angleTo(room.center, room.entry);
    const m: Monster = {
      id: this.nextEntityId++,
      kind: 'boss',
      team: 'enemy',
      name: THEMES[this.plan.theme].bossNames[kind],
      x: room.center.x,
      y: room.center.y,
      facing,
      radius: def.radius,
      speed: def.speed,
      hp,
      maxHp: hp,
      dead: false,
      statuses: [],
      targetId: null,
      power: this.enemyDamage * (1 + tier * 0.05),
      autoNext: 0,
      boss: def,
      bossKind: kind,
      roomIndex: room.index,
      engaged: false,
      enmity: new Map(),
      heat: new Map(),
      touched: new Set(),
      cast: null,
      abilityReady: new Map(),
      stunImmune: true,
      attackRange: def.attackRange,
      autoPotency: def.autoPotency,
      autoInterval: def.autoInterval,
      ranged: false,
      home: { ...room.center },
      stagger: 0,
      staggerMax: def.stagger,
      phase: 0,
      step: 0,
      inIntro: false,
      nextStepAt: 0,
    };
    this.monsters.set(m.id, m);
    return m;
  }

  spawnInfo(a: Actor): EntitySpawn {
    if (a.team === 'party') {
      const p = a as Player;
      return { id: p.id, kind: 'player', team: 'party', name: p.name, radius: p.radius, role: p.role, weapon: p.weapon, look: p.look, bot: p.ownerId === null, ownerId: p.ownerId, speed: p.speed };
    }
    const m = a as Monster;
    const room = this.plan.rooms[m.roomIndex];
    return {
      id: m.id,
      kind: m.kind,
      team: 'enemy',
      name: m.name,
      radius: m.radius,
      ...(m.mobKind ? { mob: m.mobKind } : {}),
      ...(m.bossKind ? { boss: m.bossKind, bossNumber: (room?.bossIndex ?? 0) + 1 } : {}),
    };
  }

  actor(id: number): Actor | null {
    return this.monsters.get(id) ?? this.players.find((p) => p.id === id) ?? null;
  }

  playerByOwner(ownerId: string): Player | undefined {
    return this.players.find((p) => p.ownerId === ownerId);
  }

  engage(m: Monster): void {
    if (m.engaged || m.dead) return;
    m.engaged = true;
    m.autoNext = this.now + 1;
    if (m.enmity.size === 0) {
      let nearest: Player | null = null;
      for (const p of this.players) if (!p.dead && (!nearest || dist(p, m) < dist(nearest, m))) nearest = p;
      if (nearest) m.enmity.set(nearest.id, 1);
    }
    if (m.mob) for (const ab of m.mob.abilities) m.abilityReady.set(ab.id, this.now + 2 + this.rng.next() * (ab.cooldown ?? 10) * 0.6);
    if (m.boss) {
      m.phase = 0;
      m.step = 0;
      m.inIntro = false;
      m.nextStepAt = this.now + 4;
    }
    this.lastCombatAt = this.now;
  }

  kill(target: Actor, src: Actor | null): void {
    if (target.dead) return;
    target.dead = true;
    target.hp = 0;
    this.emit({ e: 'death', i: target.id });
    if (target.team === 'party') {
      const p = target as Player;
      p.cast = null;
      p.attacking = false;
      p.roll = null;
      p.statuses = [];
      p.stats.deaths++;
      this.log(`${p.name} has fallen${src ? ` to ${src.name}` : ''}.`, 'warn');
      for (const m of this.monsters.values()) m.enmity.delete(p.id);
    } else {
      const m = target as Monster;
      this.cancelOwner(m.id);
      m.cast = null;
      this.monsters.delete(m.id);
      this.emit({ e: 'despawn', i: m.id });
      if (m.kind === 'boss') this.log(`${m.name} has been defeated!`, 'good');
    }
  }

  /** Permanent party buffs that survive death: the Echo after wipes and the Ward without a healer. */
  applyPassives(p: Player): void {
    const forever = 1e9;
    if (this.noHealer) applyStatus(this, p, 'rhuinWard', forever, p.id, Math.round(p.maxHp * 0.03));
    for (let i = 0; i < Math.min(3, this.wipes); i++) applyStatus(this, p, 'echo', forever, p.id);
  }

  revive(p: Player, hpFrac: number): void {
    if (!p.dead) return;
    p.dead = false;
    p.hp = Math.max(1, Math.round(p.maxHp * hpFrac));
    p.statuses = [];
    this.applyPassives(p);
    this.emit({ e: 'raise', i: p.id });
    this.log(`${p.name} is back on their feet.`, 'good');
  }

  forceMove(p: Player, x: number, y: number): void {
    p.x = x;
    p.y = y;
    p.epoch++;
    p.moveBudget = 0;
  }

  /** Moves a player as part of a skill (dashes, leaps, blinks). */
  movePlayer(p: Player, x: number, y: number): void {
    if (p.botControlled) {
      p.x = x;
      p.y = y;
    } else this.forceMove(p, x, y);
  }

  /** Cancels a monster's cast and anything it has pending. */
  cancelCasts(m: Monster): void {
    this.cancelOwner(m.id);
    m.cast = null;
  }

  spawnProjectile(pr: Omit<Projectile, 'id' | 'traveled' | 'hit'>): void {
    const id = this.nextTelegraphId++;
    this.projectiles.set(id, { ...pr, id, traveled: 0, hit: new Set() });
  }

  /** Stops a monster's cast. With `requireInterruptible`, only pulsing casts stop. */
  interrupt(m: Monster, src: Player, requireInterruptible: boolean): boolean {
    if (!m.cast || m.dead) return false;
    if (requireInterruptible && !m.cast.ability.interruptible) return false;
    if (m.kind === 'boss' && !m.cast.ability.interruptible) return false;
    const name = m.cast.name;
    this.cancelOwner(m.id);
    m.cast = null;
    if (m.boss) m.nextStepAt = this.now + 2;
    this.emit({ e: 'interrupt', i: m.id });
    this.log(`${src.name} interrupts ${m.name}'s ${name}.`, 'good');
    return true;
  }

  // ── Telegraphs and scheduled resolutions ─────────────────────────────────────────────────

  addTelegraph(t: Omit<Telegraph, 'id' | 'resolve'>): number {
    const id = this.nextTelegraphId++;
    this.telegraphs.set(id, { ...t, id, resolve: () => {} });
    return id;
  }

  telegraphShape(id: number): Shape | null {
    return this.telegraphs.get(id)?.shape ?? null;
  }

  schedule(at: number, ownerId: number, fn: () => void): void {
    this.tasks.push({ at, ownerId, fn });
  }

  private cancelOwner(ownerId: number): void {
    this.tasks = this.tasks.filter((t) => t.ownerId !== ownerId);
    for (const [id, t] of this.telegraphs) if (t.ownerId === ownerId) this.telegraphs.delete(id);
    for (const [id, pr] of this.projectiles) if (pr.ownerId === ownerId && pr.team === 'enemy') this.projectiles.delete(id);
  }

  // ── Events ───────────────────────────────────────────────────────────────────────────────

  emit(ev: GameEvent): void {
    this.events.push(ev);
  }

  log(text: string, cls: Extract<GameEvent, { e: 'log' }>['cls'] = 'sys'): void {
    this.emit({ e: 'log', text, cls });
  }

  privateMsg(p: Player, msg: ServerMsg): void {
    if (!p.botControlled) this.sendPrivate(p, msg);
  }

  // ── Player input ─────────────────────────────────────────────────────────────────────────

  handleMove(p: Player, x: number, y: number, f: number, ep: number, aim?: Vec, attacking?: boolean): void {
    if (p.botControlled) return;
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.y)) p.aim = { x: aim.x, y: aim.y };
    if (attacking !== undefined) p.attacking = attacking;
    if (ep !== p.epoch) return;
    if (![x, y, f].every(Number.isFinite)) return;
    const d = dist(p, { x, y });
    if (d < 1e-4) {
      p.facing = f;
      return;
    }
    if (p.dead || isStunned(p) || d > p.moveBudget + 0.3 || !circleFree(this.map, x, y, p.radius - 0.05) || (d > 0.4 && !segmentClear(this.map, p, { x, y }, p.radius - 0.1))) {
      this.forceMove(p, p.x, p.y);
      return;
    }
    p.moveBudget -= d;
    p.x = x;
    p.y = y;
    p.facing = f;
  }

  setTarget(p: Player, id: number | null): void {
    p.targetId = id != null && this.actor(id) ? id : null;
  }

  requestSkill(p: Player, skillId: string, aim: Vec): void {
    if (!p.hotbar.includes(skillId) || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return;
    p.aim = { ...aim };
    const err = useSkill(this, p, skillId, aim);
    if (err) this.privateMsg(p, { t: 'skillFail', id: skillId, reason: err });
  }

  requestDodge(p: Player, dx: number, dy: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const err = dodge(this, p, dx, dy);
    if (err) this.privateMsg(p, { t: 'skillFail', id: 'dodge', reason: err });
  }

  setBotControl(ownerId: string, bot: boolean): void {
    const p = this.playerByOwner(ownerId);
    if (!p || p.botControlled === bot) return;
    p.botControlled = bot;
    p.ai = {};
    p.attacking = false;
    p.epoch++;
    this.log(bot ? `${p.name} lost connection; an AI companion takes over.` : `${p.name} has returned.`, 'party');
  }

  // ── Simulation ───────────────────────────────────────────────────────────────────────────

  tick(): void {
    const dt = TICK_DT;
    this.now += dt;
    this.ticks++;
    if (this.phase === 'countdown' && this.now >= this.startsAt) this.commence();
    const dotTick = Math.floor(this.now / DOT_TICK) !== Math.floor((this.now - dt) / DOT_TICK);

    for (const p of this.players) this.updateStatuses(p, dotTick);
    for (const m of [...this.monsters.values()]) this.updateStatuses(m, dotTick);
    for (const p of this.players) this.updatePlayer(p, dt);
    for (const m of [...this.monsters.values()]) {
      if (m.engaged && !m.dead) fadeAggro(this, m, dt);
      updateMonster(this, m, dt);
      if (m.stagger > 0) m.stagger = Math.max(0, m.stagger - 4 * dt);
    }
    stepProjectiles(this, dt);

    // Markers follow the player they are on.
    for (const t of this.telegraphs.values()) {
      if (t.followId == null) continue;
      const f = this.actor(t.followId);
      if (f && !f.dead && (t.shape.kind === 'circle' || t.shape.kind === 'donut')) {
        t.shape = { ...t.shape, x: f.x, y: f.y };
      }
    }
    // Resolve what is due, oldest first.
    if (this.tasks.length) {
      const due = this.tasks.filter((t) => t.at <= this.now + 1e-9).sort((a, b) => a.at - b.at);
      if (due.length) {
        this.tasks = this.tasks.filter((t) => t.at > this.now + 1e-9);
        for (const t of due) t.fn();
      }
    }
    for (const [id, t] of this.telegraphs) if (t.end <= this.now + 1e-9) this.telegraphs.delete(id);

    this.updateRooms();
    this.updateWipe();
    this.updateRegen(dotTick);
  }

  private commence(): void {
    this.phase = 'running';
    const entrance = this.rooms[0];
    if (entrance) {
      entrance.status = 'cleared';
      if (entrance.plan.exitGate !== undefined) this.setGate(entrance.plan.exitGate, true);
    }
    this.emit({ e: 'banner', text: this.plan.name, sub: 'Duty Commenced', style: 'duty' });
    this.log(`Duty commenced: ${this.plan.name}. Defeat all ${this.plan.bossCount} bosses.`, 'sys');
    this.dutyChanged();
  }

  private updateStatuses(a: Actor, dotTick: boolean): void {
    if (a.statuses.length === 0) return;
    const ending = a.statuses.filter((s) => s.expires <= this.now);
    a.statuses = a.statuses.filter((s) => s.expires > this.now);
    if (a.team === 'party' && !a.dead) for (const s of ending) if (STATUSES[s.id]?.counter && s.value > 0) counterBurst(this, a as Player, s);
    if (a.dead || !dotTick) return;
    for (const s of [...a.statuses]) {
      const def = STATUSES[s.id];
      if (!def || s.potency <= 0) continue;
      const src = this.actor(s.sourceId);
      if (def.dot) applyDamage(this, src, a, s.potency, { tick: true, name: def.name });
      else if (def.hot && src && src.team === 'party') {
        // The Ward only mends in combat; resting regeneration covers the rest.
        if (s.id === 'rhuinWard' && !this.inCombat()) continue;
        applyHeal(this, src as Player, a, s.potency, false, def.name, true);
      }
      if (a.dead) return;
    }
  }

  private updatePlayer(p: Player, dt: number): void {
    const speed = speedOf(p);
    const cap = speed * 0.75 + 1.5;
    if (p.moveBudget < cap) p.moveBudget = Math.min(cap, p.moveBudget + speed * dt * 1.25);
    if (p.dead) return;
    if (!getStatus(p, 'evasion')) p.stamina = Math.min(p.maxStamina, p.stamina + p.staminaRegen * dt);
    if (p.botControlled) {
      if (p.roll) {
        // AI rolls move over a few ticks, like a player's.
        const step = (ROLL_DISTANCE / ROLL_TIME) * dt;
        const to = moveCircle(this.map, p, p.roll.dx * step, p.roll.dy * step, p.radius);
        p.x = to.x;
        p.y = to.y;
        if (this.now >= p.roll.until) p.roll = null;
      } else updateBot(this, p, dt);
    }

    if (p.cast) {
      const moved = dist(p, p.cast) > 0.2;
      if (isStunned(p) || (moved && p.cast.end - this.now > SLIDECAST_WINDOW)) {
        p.cast = null;
        this.emit({ e: 'interrupt', i: p.id });
        this.privateMsg(p, { t: 'skillFail', id: '', reason: 'Interrupted' });
      } else if (this.now >= p.cast.end) {
        finishCast(this, p);
      }
    }
    // Holding the attack button swings the basic chain.
    if (p.attacking && !p.cast && !isStunned(p) && this.now >= p.basicReadyAt && this.now >= p.lockUntil && this.phase !== 'countdown') basicAttack(this, p);
  }

  inCombat(): boolean {
    for (const m of this.monsters.values()) if (m.engaged && !m.dead) return true;
    return false;
  }

  private updateRegen(dotTick: boolean): void {
    if (this.inCombat()) this.lastCombatAt = this.now;
    if (!dotTick) return;
    const resting = this.now - this.lastCombatAt > OUT_OF_COMBAT_DELAY;
    for (const p of this.players) {
      if (p.dead) continue;
      if (resting) {
        p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.25));
        p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp * 0.25));
      } else {
        p.mp = Math.min(p.maxMp, p.mp + Math.round(p.maxMp * 0.04));
      }
    }
  }

  private setGate(id: number, open: boolean): void {
    const g = this.gates[id];
    if (!g || g.open === open) return;
    g.open = open;
    for (const t of g.plan.tiles) this.map.tiles[t] = open ? T_FLOOR : T_GATE;
    this.emit({ e: 'gate', id, open });
  }

  private alivePlayers(): Player[] {
    return this.players.filter((p) => !p.dead);
  }

  private updateRooms(): void {
    if (this.phase === 'countdown') return;
    const alive = this.alivePlayers();
    for (const rs of this.rooms) {
      const plan = rs.plan;
      if (plan.kind === 'trash') {
        if (rs.status === 'idle' && this.wipeAt === null && alive.some((p) => insideRoom(plan, p, 2.5))) {
          rs.status = 'active';
          rs.wave = 0;
          rs.nextWaveAt = this.now + 0.8;
          this.checkpoint = plan.index;
          this.log(`Something stirs in the ${plan.name}...`, 'warn');
          this.dutyChanged();
        }
        if (rs.status !== 'active') continue;
        if (rs.nextWaveAt !== null) {
          if (this.now >= rs.nextWaveAt) {
            rs.nextWaveAt = null;
            const wave = plan.waves[rs.wave];
            for (const spec of wave?.mobs ?? []) this.engage(this.spawnMob(spec.kind, spec.x, spec.y, plan.index, plan.depth));
            if (plan.waves.length > 1) this.emit({ e: 'banner', text: `Wave ${rs.wave + 1} of ${plan.waves.length}`, sub: plan.name, style: 'wave' });
            this.dutyChanged();
          }
        } else if (![...this.monsters.values()].some((m) => m.roomIndex === plan.index && !m.dead)) {
          rs.wave++;
          if (rs.wave < plan.waves.length) {
            rs.nextWaveAt = this.now + 3;
            this.log(`More foes approach the ${plan.name}!`, 'warn');
          } else {
            rs.status = 'cleared';
            if (plan.exitGate !== undefined) this.setGate(plan.exitGate, true);
            this.emit({ e: 'banner', text: `${plan.name} cleared`, sub: 'The way forward opens', style: 'clear' });
            this.reviveFallen();
          }
          this.dutyChanged();
        }
      } else if (plan.kind === 'boss') {
        const boss = rs.bossId != null ? this.monsters.get(rs.bossId) : undefined;
        if (rs.status === 'idle') {
          if (boss && this.wipeAt === null && (boss.engaged || alive.some((p) => insideRoom(plan, p, 3)))) {
            this.engage(boss);
            rs.status = 'active';
            rs.sealAt = this.now + 6;
            this.checkpoint = plan.index;
            this.emit({ e: 'banner', text: boss.name, sub: `Boss ${(plan.bossIndex ?? 0) + 1} of ${this.plan.bossCount}`, style: 'boss' });
            this.log(`${plan.name} will be sealed off in 6 seconds!`, 'warn');
            this.dutyChanged();
          }
          continue;
        }
        if (rs.status !== 'active') continue;
        if (!rs.sealed && rs.sealAt !== null && this.now >= rs.sealAt) this.sealArena(rs);
        if (!boss || boss.dead) this.bossDefeated(rs);
      }
    }
  }

  private sealArena(rs: RoomState): void {
    rs.sealed = true;
    const plan = rs.plan;
    let i = 0;
    for (const p of this.players) {
      if (insideRoom(plan, p, 0.6)) continue;
      const a = (i++ / 4) * Math.PI * 2;
      const spot = nearestFree(this.map, plan.entry.x + Math.cos(a) * 1.2, plan.entry.y + Math.sin(a) * 1.2, p.radius);
      this.forceMove(p, spot.x, spot.y);
    }
    if (plan.entryGate !== undefined) this.setGate(plan.entryGate, false);
    this.emit({ e: 'banner', text: 'The arena is sealed', style: 'seal' });
    this.dutyChanged();
  }

  private bossDefeated(rs: RoomState): void {
    const plan = rs.plan;
    rs.status = 'cleared';
    rs.sealed = false;
    this.bossesDefeated++;
    for (const m of [...this.monsters.values()]) if (m.roomIndex === plan.index) this.despawn(m);
    if (plan.entryGate !== undefined) this.setGate(plan.entryGate, true);
    if (plan.exitGate !== undefined) this.setGate(plan.exitGate, true);
    this.reviveFallen();
    const final = this.bossesDefeated >= this.plan.bossCount;
    if (final) {
      this.phase = 'complete';
      this.completedAt = this.now;
      this.emit({ e: 'banner', text: 'Duty Complete', sub: this.plan.name, style: 'complete' });
      this.emit({ e: 'complete', results: this.results(), time: this.now - this.startsAt, wipes: this.wipes });
      this.log(`Duty complete in ${formatTime(this.now - this.startsAt)}.`, 'good');
      this.onComplete?.();
    } else {
      this.emit({ e: 'banner', text: 'Boss defeated', sub: `${this.bossesDefeated} of ${this.plan.bossCount}`, style: 'clear' });
    }
    this.dutyChanged();
  }

  private reviveFallen(): void {
    for (const p of this.players) if (p.dead) this.revive(p, 0.5);
  }

  private despawn(m: Monster): void {
    this.cancelOwner(m.id);
    this.monsters.delete(m.id);
    this.emit({ e: 'despawn', i: m.id });
  }

  private updateWipe(): void {
    if (this.phase !== 'running') return;
    if (this.wipeAt === null && this.players.every((p) => p.dead)) {
      this.wipeAt = this.now + 5;
      this.emit({ e: 'banner', text: 'Party Wiped', sub: 'Regrouping at the last checkpoint...', style: 'wipe' });
    }
    if (this.wipeAt !== null && this.now >= this.wipeAt) this.resetAfterWipe();
  }

  private resetAfterWipe(): void {
    this.wipeAt = null;
    this.wipes++;
    for (const rs of this.rooms) {
      if (rs.status !== 'active') continue;
      for (const m of [...this.monsters.values()]) if (m.roomIndex === rs.plan.index && m.kind !== 'boss') this.despawn(m);
      rs.status = 'idle';
      rs.wave = 0;
      rs.nextWaveAt = null;
      rs.sealAt = null;
      if (rs.sealed && rs.plan.entryGate !== undefined) this.setGate(rs.plan.entryGate, true);
      rs.sealed = false;
      const boss = rs.bossId != null ? this.monsters.get(rs.bossId) : undefined;
      if (boss) {
        this.cancelOwner(boss.id);
        Object.assign(boss, { hp: boss.maxHp, x: boss.home.x, y: boss.home.y, engaged: false, cast: null, statuses: [], phase: 0, step: 0, inIntro: false, targetId: null, stagger: 0 });
        boss.facing = angleTo(boss.home, rs.plan.entry);
        boss.enmity.clear();
        boss.heat.clear();
        boss.touched.clear();
      }
    }
    this.tasks = [];
    this.telegraphs.clear();
    this.projectiles.clear();
    const cp = this.plan.rooms[this.checkpoint];
    this.players.forEach((p, i) => {
      const base = cp && cp.index > 0 ? cp.approach : (this.plan.spawns[i] as { x: number; y: number });
      const spot = nearestFree(this.map, base.x + ((i % 2) - 0.5) * 1.6, base.y + (Math.floor(i / 2) - 0.5) * 1.6, p.radius);
      p.dead = false;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      p.statuses = [];
      p.cast = null;
      p.attacking = false;
      p.roll = null;
      p.stamina = p.maxStamina;
      p.cooldowns.clear();
      p.targetId = null;
      p.ai = {};
      this.applyPassives(p);
      this.forceMove(p, spot.x, spot.y);
      this.emit({ e: 'raise', i: p.id });
    });
    this.lastCombatAt = this.now;
    this.log('The party regroups. Try again!', 'sys');
    if (this.wipes <= 3) this.log(`The Echo of Rhuin grows stronger (${this.wipes}/3): more damage dealt, less damage taken.`, 'good');
    this.dutyChanged();
  }

  // ── Views ────────────────────────────────────────────────────────────────────────────────

  private dutyDirty = true;

  private dutyChanged(): void {
    this.dutyDirty = true;
  }

  dutyState(): DutyState {
    const rooms: RoomInfo[] = this.rooms.map((rs) => {
      const p = rs.plan;
      const boss = rs.bossId != null ? this.monsters.get(rs.bossId) : undefined;
      return {
        index: p.index,
        name: p.name,
        kind: p.kind,
        status: rs.status,
        wave: rs.wave,
        waves: p.waves.length,
        ...(p.boss ? { bossName: boss?.name ?? THEMES[this.plan.theme].bossNames[p.boss] } : {}),
        x: p.x,
        y: p.y,
        w: p.w,
        h: p.h,
        shape: p.shape,
        center: p.center,
        radius: p.radius,
      };
    });
    return {
      name: this.plan.name,
      theme: this.plan.theme,
      phase: this.phase,
      startsAt: this.startsAt,
      completedAt: this.completedAt,
      rooms,
      bossCount: this.plan.bossCount,
      bossesDefeated: this.bossesDefeated,
      wipes: this.wipes,
      sealed: this.rooms.some((r) => r.sealed),
    };
  }

  gateInfo(): GateInfo[] {
    return this.gates.map((g) => ({ id: g.plan.id, tiles: g.plan.tiles, center: g.plan.center, vertical: g.plan.vertical, open: g.open }));
  }

  startFor(p: Player): InstanceStart {
    return {
      instanceId: this.id,
      time: this.now,
      map: { w: this.map.w, h: this.map.h, tiles: encodeTiles(this.map) },
      theme: this.plan.theme,
      lights: this.plan.lights,
      gates: this.gateInfo(),
      duty: this.dutyState(),
      entities: [...this.players, ...this.monsters.values()].map((a) => this.spawnInfo(a)),
      you: p.id,
      hotbar: p.hotbar,
    };
  }

  results(): MemberResult[] {
    return this.players.map((p) => ({ id: p.id, name: p.name, role: p.role, weapon: p.weapon, bot: p.ownerId === null, damage: Math.round(p.stats.damage), healing: Math.round(p.stats.healing), deaths: p.stats.deaths, raises: p.stats.raises }));
  }

  /** Takes the events gathered since the last call and builds the shared part of a snapshot. */
  takeSnapshot(): { ents: EntitySnap[]; tgs: TelegraphSnap[]; pj: ProjectileSnap[]; ev: GameEvent[] } {
    if (this.dutyDirty) {
      this.dutyDirty = false;
      this.events.push({ e: 'duty', duty: this.dutyState() });
    }
    const ents: EntitySnap[] = [];
    const snapActor = (a: Actor): EntitySnap => {
      const s: EntitySnap = { i: a.id, x: r2(a.x), y: r2(a.y), f: r2(a.facing), hp: Math.max(0, Math.round(a.hp)), mh: a.maxHp };
      if (a.targetId != null) s.t = a.targetId;
      if (a.dead) s.d = 1;
      if (a.statuses.length) {
        s.s = a.statuses.map((st) => [st.id, Math.round((st.expires - this.now) * 10) / 10, st.stacks]);
        const b = a.statuses.reduce((sum, st) => sum + (STATUSES[st.id]?.barrier ? st.value : 0), 0);
        if (b > 0) s.b = Math.round(b);
      }
      return s;
    };
    for (const p of this.players) {
      const s = snapActor(p);
      if (p.maxMp > 0) {
        s.mp = Math.round(p.mp);
        s.mm = p.maxMp;
      }
      if (p.cast) {
        const def = skillDef(p.cast.skillId);
        s.c = [def.name, r2(p.cast.start), r2(p.cast.end), 0, def.id];
      }
      if (p.botControlled) s.ai = 1;
      ents.push(s);
    }
    for (const m of this.monsters.values()) {
      const s = snapActor(m);
      if (m.cast && !m.cast.ability.minor) s.c = [m.cast.name, r2(m.cast.start), r2(m.cast.end), m.cast.ability.interruptible ? 1 : 0, m.cast.ability.id];
      if (m.engaged && m.targetId != null) s.a = m.targetId;
      if (m.engaged && m.enmity.size) s.ag = aggroTable(m);
      if (m.staggerMax > 0) s.g = [Math.round(m.stagger), m.staggerMax];
      ents.push(s);
    }
    const tgs: TelegraphSnap[] = [...this.telegraphs.values()].map((t) => ({
      id: t.id,
      shape: roundShape(t.shape),
      style: t.style,
      start: r2(t.start),
      end: r2(t.end),
      ...(t.followId != null ? { follow: t.followId } : {}),
      ...(t.minor ? { m: 1 as const } : {}),
      name: t.ability.name,
    }));
    const pj: ProjectileSnap[] = [...this.projectiles.values()].map((pr) => ({ i: pr.id, x: r2(pr.x), y: r2(pr.y), d: r2(pr.dir), s: pr.speed, r: pr.radius, k: pr.look, h: pr.hue, ...(pr.team === 'enemy' ? { e: 1 as const } : {}) }));
    const ev = this.events;
    this.events = [];
    return { ents, tgs, pj, ev };
  }

  meSnap(p: Player): MeSnap {
    const cds: Record<string, number> = {};
    for (const [id, at] of p.cooldowns) if (at > this.now) cds[id] = r2(at);
    return { id: p.id, epoch: p.epoch, cds, stamina: Math.round(p.stamina), maxStamina: p.maxStamina, chain: p.chain, lock: r2(p.lockUntil) };
  }

  /** Drops events without sending them (used by headless simulations). */
  drainEvents(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}

function roundShape(s: Shape): Shape {
  const o: Record<string, unknown> = { ...s };
  for (const k of Object.keys(o)) if (typeof o[k] === 'number') o[k] = r2(o[k] as number);
  return o as Shape;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
