/**
 * Runs a dungeon on the client: reads mouse and keyboard, predicts your own movement and dodge
 * rolls, sends your aim and actions, applies server snapshots and events, and drives the renderer
 * and HUD every frame.
 */
import { PLAYER_RADIUS, ROLL_DISTANCE, ROLL_STAMINA, ROLL_TIME } from '../../shared/constants.js';
import { SKILLS } from '../../shared/content/classes.js';
import { STATUSES } from '../../shared/content/statuses.js';
import { angleTo, dist } from '../../shared/geometry.js';
import { findPath, moveCircle } from '../../shared/map.js';
import type { GameEvent, InstanceStart, ServerMsg } from '../../shared/protocol.js';
import { h } from '../dom.js';
import type { Net } from '../net.js';
import { preloadClan } from '../art/sprites.js';
import { Effects } from './fx.js';
import { Hud } from './hud.js';
import { Renderer } from './renderer.js';
import { World } from './world.js';

/** Keyboard keys for hotbar slots 2-8 (slot 0 is the held left mouse button, 1 the right). */
const KEY_SLOTS: Record<string, number> = { q: 2, e: 3, r: 4, f: 5, '1': 6, '2': 7, '3': 8 };
const SLOT_DODGE = 9;

export class Game {
  readonly el: HTMLElement;
  readonly world: World;
  private canvas = h('canvas', { class: 'world' });
  private renderer: Renderer;
  private hud: Hud;
  private fx = new Effects();
  /** Where you are (predicted locally). */
  private local = { x: 0, y: 0, f: 0 };
  /** Smooths server-driven jumps (dashes, leaps, knockbacks) on screen. */
  private offset = { x: 0, y: 0 };
  private epoch = 0;
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0 };
  private aim = { x: 0, y: 0 };
  private attacking = false;
  private roll: { dx: number; dy: number; until: number } | null = null;
  private targetId: number | null = null;
  private hoverId: number | null = null;
  private followId: number | null = null;
  private followPath: { x: number; y: number }[] | null = null;
  private followPathAt = 0;
  private zoom = 44;
  private raf = 0;
  private last = performance.now();
  private lastSend = 0;
  private sent = { x: 0, y: 0, f: 0, ax: 0, ay: 0, atk: 0 };
  private hudTick = 0;
  private disposers: (() => void)[] = [];

  constructor(
    private net: Net,
    start: InstanceStart,
  ) {
    this.world = new World(start);
    preloadClan(start.theme);
    this.renderer = new Renderer(this.canvas);
    this.hud = new Hud(this.world, {
      useSlot: (i) => this.useSlot(i),
      setTarget: (id) => this.setTarget(id),
      leave: () => this.net.send({ t: 'instance.leave' }),
      chat: (text) => this.net.send({ t: 'chat', text }),
    });
    this.el = h('div', { class: 'game' }, this.canvas, this.hud.el);
    this.bindInput();
    this.hud.log(`Entering ${start.duty.name}.`, 'sys');
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    for (const d of this.disposers) d();
  }

  // ── Network ──────────────────────────────────────────────────────────────────────────────

  onMessage(msg: ServerMsg): void {
    switch (msg.t) {
      case 'snap': {
        for (const ev of msg.ev) this.onEvent(ev);
        this.world.applySnapshot(msg.time, msg.ents, msg.tgs, msg.pj);
        if (!msg.me) break;
        this.world.me = msg.me;
        const meSnap = msg.ents.find((e) => e.i === msg.me?.id);
        if (!meSnap) break;
        if (this.local.x === 0 && this.local.y === 0) {
          this.local = { x: meSnap.x, y: meSnap.y, f: meSnap.f };
          this.epoch = msg.me.epoch;
        } else if (msg.me.epoch !== this.epoch || meSnap.d) {
          // The server moved us (dash, leap, knockback, respawn) or we are down: take its position,
          // easing the jump on screen.
          if (dist(meSnap, this.local) > 0.05) {
            this.offset.x += this.local.x - meSnap.x;
            this.offset.y += this.local.y - meSnap.y;
            if (Math.hypot(this.offset.x, this.offset.y) > 15) this.offset = { x: 0, y: 0 };
            this.local.x = meSnap.x;
            this.local.y = meSnap.y;
          }
          this.epoch = msg.me.epoch;
          this.roll = null;
        }
        break;
      }
      case 'skillFail':
        if (msg.reason !== 'Not ready yet') this.hud.error(msg.reason);
        break;
      case 'chat':
        this.hud.chat(msg.from, msg.text);
        break;
      default:
        break;
    }
  }

  private onEvent(ev: GameEvent): void {
    const w = this.world;
    const pos = (id: number | undefined): { x: number; y: number } | null => {
      if (id === undefined) return null;
      if (id === w.meId) return this.local;
      const e = w.ents.get(id);
      return e ? { x: e.x, y: e.y } : null;
    };
    const now = performance.now() / 1000;
    switch (ev.e) {
      case 'spawn':
        w.addEntity(ev.ent);
        break;
      case 'despawn': {
        const e = w.ents.get(ev.i);
        if (e) {
          e.removed = true;
          if (!e.diedAt) w.ents.delete(ev.i);
        }
        if (this.targetId === ev.i) this.targetId = null;
        break;
      }
      case 'death': {
        const e = w.ents.get(ev.i);
        if (e) e.diedAt = now;
        if (e?.spawn.kind === 'boss') this.renderer.shake(1.4);
        if (e?.spawn.team === 'enemy' && this.targetId === ev.i) this.targetId = null;
        break;
      }
      case 'raise': {
        const e = w.ents.get(ev.i);
        if (e) e.diedAt = null;
        const p = pos(ev.i);
        if (p) this.fx.add({ kind: 'buff', x: p.x, y: p.y, x2: 0, y2: 0, follow: ev.i, hue: 50, r: 1, life: 1.2 });
        break;
      }
      case 'dmg': {
        const t = pos(ev.t);
        if (!t) break;
        // Flash at most a few times a second, or a boss under fire would glow white non-stop.
        if (now - (w.lastHit.get(ev.t) ?? -1) > 0.28) w.lastHit.set(ev.t, now);
        const target = w.ents.get(ev.t);
        const mine = ev.s === w.meId;
        if (target?.spawn.team === 'party') {
          if (ev.t === w.meId || ev.v > 1500) this.fx.text(`-${ev.v}`, t.x, t.y, '#ff6b5b', ev.t === w.meId ? 15 : 12);
          if (ev.t === w.meId && ev.v > 1500) this.renderer.shake(0.6);
        } else if (mine) {
          this.fx.text(`${ev.v}${ev.c ? '!' : ''}`, t.x, t.y, ev.c ? '#ffd76a' : '#ffffff', ev.c ? 20 : 15);
          if (ev.c) this.renderer.shake(0.25);
        } else if (ev.v > 0) {
          this.fx.text(String(ev.v), t.x, t.y, 'rgba(220, 225, 235, 0.6)', 11);
        }
        break;
      }
      case 'heal': {
        const t = pos(ev.t);
        if (!t || ev.v <= 0) break;
        if (ev.t === w.meId || ev.s === w.meId) this.fx.text(`+${ev.v}${ev.c ? '!' : ''}`, t.x, t.y, '#8ff0a4', ev.c ? 16 : 13);
        break;
      }
      case 'fx':
        this.onFx(ev, pos);
        break;
      case 'act':
        w.acts.set(ev.i, { at: performance.now() / 1000, k: ev.k, d: ev.d ?? 0 });
        break;
      case 'gate':
        w.setGate(ev.id, ev.open);
        break;
      case 'banner':
        this.hud.showBanner(ev.text, ev.sub, ev.style);
        break;
      case 'log':
        this.hud.log(ev.text, ev.cls ?? 'sys');
        break;
      case 'interrupt': {
        const p = pos(ev.i);
        if (p) this.fx.text('Interrupted', p.x, p.y, '#9fd6ff', 12);
        break;
      }
      case 'duty':
        w.duty = ev.duty;
        break;
      case 'complete':
        setTimeout(() => this.hud.showResults(ev.results, ev.time, ev.wipes, () => this.net.send({ t: 'instance.leave' })), 3500);
        break;
      default:
        break;
    }
  }

  private onFx(ev: Extract<GameEvent, { e: 'fx' }>, pos: (id: number | undefined) => { x: number; y: number } | null): void {
    const s = pos(ev.s);
    const t = pos(ev.t);
    const hue = ev.hue ?? 40;
    const at = (x?: number, y?: number) => ({ x: x ?? s?.x ?? 0, y: y ?? s?.y ?? 0 });
    const base = { x2: 0, y2: 0, follow: null as number | null, hue, r: ev.r ?? 1, a: ev.a ?? 0, d: ev.d ?? 0 };
    switch (ev.k) {
      case 'arc':
      case 'thrust': {
        // Melee swings are drawn from the attacker's current position so they stay attached.
        const p = at(ev.x, ev.y);
        if (ev.s !== undefined) this.world.swings.set(ev.s, { at: performance.now() / 1000, kind: ev.k, a: ev.a ?? 1 });
        this.fx.add({ ...base, kind: ev.k, x: p.x, y: p.y, follow: ev.s ?? null, life: ev.k === 'arc' ? 0.22 : 0.2 });
        break;
      }
      case 'burst':
        if (ev.x !== undefined) this.fx.add({ ...base, kind: 'burst', x: ev.x, y: ev.y as number, life: 0.45 });
        break;
      case 'impact':
        if (ev.x !== undefined) {
          this.fx.add({ ...base, kind: 'impact', x: ev.x, y: ev.y as number, life: 0.45 });
          if ((ev.r ?? 0) > 2 && dist({ x: ev.x, y: ev.y as number }, this.local) < (ev.r ?? 3) + 5) this.renderer.shake(0.5);
        }
        break;
      case 'heal':
      case 'buff':
        if (t) this.fx.add({ ...base, kind: ev.k, x: t.x, y: t.y, follow: ev.t ?? null, life: 0.9 });
        break;
      case 'dash':
        if (s && ev.x !== undefined) this.fx.add({ ...base, kind: 'dash', x: ev.x, y: ev.y as number, x2: s.x, y2: s.y, life: 0.35 });
        break;
      case 'roll':
        if (ev.x !== undefined) this.fx.add({ ...base, kind: 'roll', x: ev.x, y: ev.y as number, follow: ev.s ?? null, life: 0.4 });
        break;
      case 'evade':
        if (t) this.fx.text('Evade', t.x, t.y, '#bfe6ff', 12);
        break;
      case 'stagger':
        if (t) {
          this.fx.add({ ...base, kind: 'impact', x: t.x, y: t.y, hue: 45, r: 5, life: 0.8 });
          this.fx.text('STAGGERED', t.x, t.y, '#ffd75a', 22);
          this.renderer.shake(1);
        }
        break;
      case 'rift':
        if (ev.x !== undefined) this.fx.add({ ...base, kind: 'rift', x: ev.x, y: ev.y as number, r: ev.r ?? 1.5, life: 0.9 });
        break;
      case 'shout':
        if (s) this.fx.add({ ...base, kind: 'shout', x: s.x, y: s.y, follow: ev.s ?? null, r: 6, life: 0.6 });
        break;
      case 'slash':
        if (t) this.fx.add({ ...base, kind: 'slash', x: t.x, y: t.y, follow: ev.t ?? null, r: 1.2, life: 0.25 });
        break;
      default:
        break;
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────────────────────

  private bindInput(): void {
    const down = (e: KeyboardEvent): void => {
      if (this.hud.chatFocused()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
        this.keys.add(k);
        this.followId = null;
        e.preventDefault();
        return;
      }
      if (k === ' ') {
        e.preventDefault();
        if (!e.repeat) this.useSlot(SLOT_DODGE);
        return;
      }
      const slot = KEY_SLOTS[k];
      if (slot !== undefined) {
        e.preventDefault();
        this.useSlot(slot);
        return;
      }
      if (k === 't') this.toggleFollow();
      else if (k === 'Tab') {
        e.preventDefault();
        this.cycleTarget(e.shiftKey);
      } else if (k === 'Escape') {
        this.targetId = null;
        this.followId = null;
        this.net.send({ t: 'target', id: null });
      } else if (k === 'Enter') {
        e.preventDefault();
        this.hud.focusChat();
      } else if (/^F[1-4]$/.test(k)) {
        e.preventDefault();
        const m = this.partyOrder()[Number(k.slice(1)) - 1];
        if (m) this.setTarget(m.id);
      }
    };
    const up = (e: KeyboardEvent): void => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    const blur = (): void => {
      this.keys.clear();
      this.attacking = false;
    };
    const mouseUp = (e: MouseEvent): void => {
      if (e.button === 0) this.attacking = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('mouseup', mouseUp);
    this.disposers.push(() => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('mouseup', mouseUp);
    });
    this.canvas.addEventListener('mousedown', (e) => {
      this.trackMouse(e);
      if (e.button === 0) {
        this.attacking = true;
        const id = this.pick(e.clientX, e.clientY);
        if (id != null) this.setTarget(id);
      } else if (e.button === 2) this.useSlot(1);
    });
    this.canvas.addEventListener('mousemove', (e) => {
      this.trackMouse(e);
      this.hoverId = this.pick(e.clientX, e.clientY);
      const hovered = this.hoverId != null ? this.world.ents.get(this.hoverId) : undefined;
      // Hovering an enemy makes it your target, so its health and casts show up top.
      if (hovered && hovered.spawn.team === 'enemy' && hovered.id !== this.targetId) this.setTarget(hovered.id);
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom = Math.min(64, Math.max(18, this.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      },
      { passive: false },
    );
  }

  private trackMouse(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private partyOrder() {
    return this.world.partyMembers().sort((a, b) => (a.id === this.world.meId ? -1 : b.id === this.world.meId ? 1 : 0));
  }

  private pick(cx: number, cy: number): number | null {
    const rect = this.canvas.getBoundingClientRect();
    const p = this.renderer.screenToWorld(cx - rect.left, cy - rect.top);
    let best: number | null = null;
    let bestD = Infinity;
    for (const e of this.world.ents.values()) {
      if (e.removed || (e.diedAt && e.spawn.team === 'enemy')) continue;
      if (e.id === this.world.meId) continue;
      let d = Math.hypot(p.x - e.x, p.y - e.y) - e.spawn.radius;
      const box = this.renderer.hitBoxes.get(e.id);
      if (box && p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1) d = Math.min(d, 0.1);
      const bias = e.spawn.team === 'enemy' ? -0.2 : 0;
      if (d < 0.4 && d + bias < bestD) {
        best = e.id;
        bestD = d + bias;
      }
    }
    return best;
  }

  private setTarget(id: number | null): void {
    this.targetId = id;
    this.net.send({ t: 'target', id });
  }

  private cycleTarget(back: boolean): void {
    const list = this.world
      .enemies()
      .filter((e) => dist(e, this.local) < 30)
      .sort((a, b) => dist(a, this.local) - dist(b, this.local));
    if (!list.length) return;
    const i = list.findIndex((e) => e.id === this.targetId);
    const next = list[(i + (back ? -1 : 1) + list.length) % list.length];
    if (next) this.setTarget(next.id);
  }

  private toggleFollow(): void {
    if (this.followId != null) {
      this.followId = null;
      this.hud.error('Stopped following');
      return;
    }
    const t = this.targetId != null ? this.world.ents.get(this.targetId) : undefined;
    const pick = t && t.spawn.team === 'party' && t.id !== this.world.meId ? t : this.world.partyMembers().find((m) => m.spawn.role === 'tank' && m.id !== this.world.meId);
    if (!pick) return this.hud.error('Select a party member to follow');
    this.followId = pick.id;
    this.followPath = null;
    this.hud.error(`Following ${pick.spawn.name}`);
  }

  private useSlot(index: number): void {
    const id = this.world.hotbar[index];
    const def = id ? SKILLS[id] : undefined;
    if (!id || !def) return;
    if (def.slot === 'basic') return; // Hold the left mouse button instead.
    this.hud.pressed(index);
    if (def.slot === 'dodge') return this.dodge();
    this.net.send({ t: 'skill', id, ax: round(this.aim.x), ay: round(this.aim.y) });
  }

  private dodge(): void {
    const snap = this.world.meEntity()?.snap;
    const me = this.world.me;
    if (!snap || !me || snap.d || this.roll) return;
    if (me.stamina < ROLL_STAMINA) return this.hud.error('Not enough stamina');
    if ((snap.s ?? []).some(([id]) => STATUSES[id]?.stun)) return;
    let { dx, dy } = this.moveInput();
    if (!dx && !dy) {
      const a = angleTo(this.local, this.aim);
      dx = Math.cos(a);
      dy = Math.sin(a);
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    this.roll = { dx, dy, until: performance.now() / 1000 + ROLL_TIME };
    me.stamina -= ROLL_STAMINA; // Predicted; the next snapshot corrects it.
    this.net.send({ t: 'dodge', dx: round(dx), dy: round(dy) });
  }

  private moveInput(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) dx += 1;
    return { dx, dy };
  }

  // ── Frame ────────────────────────────────────────────────────────────────────────────────

  private frame(t: number): void {
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    this.raf = requestAnimationFrame((n) => this.frame(n));
    this.world.interpolate(dt);
    this.aim = this.renderer.screenToWorld(this.mouse.x, this.mouse.y);
    this.updateMovement(dt, t);
    const k = Math.exp(-dt * 14);
    this.offset.x *= k;
    this.offset.y *= k;
    const now = performance.now() / 1000;
    this.fx.prune(now);
    const shown = { x: this.local.x + this.offset.x, y: this.local.y + this.offset.y, f: this.local.f };
    this.renderer.render({ world: this.world, fx: this.fx, me: shown, aim: this.aim, rolling: !!this.roll, targetId: this.targetId, hoverId: this.hoverId, zoom: this.zoom }, dt);
    this.hudTick += dt;
    const full = this.hudTick > 0.1;
    if (full) this.hudTick = 0;
    this.hud.update(this.targetId, this.local, full);
  }

  private updateMovement(dt: number, t: number): void {
    const snap = this.world.meEntity()?.snap;
    if (!snap) return;
    const statuses = snap.s ?? [];
    const stunned = statuses.some(([id]) => STATUSES[id]?.stun);
    const casting = !!snap.c && snap.c[2] - this.world.serverNow() > 0.1;
    const speedMod = statuses.reduce((s, [id, , stacks]) => s + (STATUSES[id]?.speed ?? 0) * stacks, 0);
    const speed = this.roleSpeed() * Math.max(0.3, 1 + speedMod);
    const now = performance.now() / 1000;

    let { dx, dy } = this.moveInput();
    if (this.roll) {
      if (now >= this.roll.until) this.roll = null;
      else {
        const step = (ROLL_DISTANCE / ROLL_TIME) * dt;
        const to = moveCircle(this.world.map, this.local, this.roll.dx * step, this.roll.dy * step, PLAYER_RADIUS);
        this.local.x = to.x;
        this.local.y = to.y;
        dx = 0;
        dy = 0;
      }
    } else if (!dx && !dy && this.followId != null && !snap.d) {
      // Auto-follow: walk toward the followed hero, pathing around walls.
      const f = this.world.ents.get(this.followId);
      if (!f || f.removed) this.followId = null;
      else if (dist(f, this.local) > 2.4) {
        if (!this.followPath || t - this.followPathAt > 400) {
          this.followPath = findPath(this.world.map, this.local, f, PLAYER_RADIUS, 30000);
          this.followPathAt = t;
        }
        while (this.followPath && this.followPath.length > 1 && dist(this.followPath[0] as { x: number; y: number }, this.local) < 0.4) this.followPath.shift();
        const wp = this.followPath?.[0] ?? f;
        dx = wp.x - this.local.x;
        dy = wp.y - this.local.y;
      }
    }
    if ((dx || dy) && !snap.d && !stunned && !casting && !this.roll) {
      const len = Math.hypot(dx, dy);
      const step = speed * dt;
      const to = moveCircle(this.world.map, this.local, (dx / len) * step, (dy / len) * step, PLAYER_RADIUS);
      this.local.x = to.x;
      this.local.y = to.y;
    }
    if (!snap.d) this.local.f = angleTo(this.local, this.aim);

    // Send position, aim and attack state at up to 20 Hz when anything changes.
    const atk = this.attacking && !snap.d ? 1 : 0;
    const changed =
      Math.abs(this.local.x - this.sent.x) > 0.001 ||
      Math.abs(this.local.y - this.sent.y) > 0.001 ||
      Math.abs(this.local.f - this.sent.f) > 0.05 ||
      Math.abs(this.aim.x - this.sent.ax) > 0.25 ||
      Math.abs(this.aim.y - this.sent.ay) > 0.25 ||
      atk !== this.sent.atk;
    if (changed && (t - this.lastSend > 50 || atk !== this.sent.atk)) {
      this.lastSend = t;
      this.sent = { x: this.local.x, y: this.local.y, f: this.local.f, ax: this.aim.x, ay: this.aim.y, atk };
      this.net.send({ t: 'move', x: round(this.local.x), y: round(this.local.y), f: Math.round(this.local.f * 100) / 100, ep: this.epoch, ax: round(this.aim.x), ay: round(this.aim.y), atk: atk as 0 | 1 });
    }
  }

  private roleSpeed(): number {
    const me = this.world.meEntity();
    return me?.spawn.speed ?? 6;
  }
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
