/**
 * Draws the dungeon on a canvas: textured floors, walls with height, braziers and darkness,
 * ground telegraphs, characters and monsters, effects and floating combat text.
 */
import { ROLES, type RoleId } from '../../shared/content/classes.js';
import type { MobKind } from '../../shared/content/monsters.js';
import { clamp, type Shape } from '../../shared/geometry.js';
import { T_FLOOR, T_GATE, tileAt } from '../../shared/map.js';
import type { TelegraphSnap } from '../../shared/protocol.js';
import { spriteFor, type Sprite, type SpriteAnim } from '../art/sprites.js';
import type { Clip } from '../art/animation.js';
import type { Effects, Fx } from './fx.js';
import type { ClientEntity, World } from './world.js';

export interface View {
  world: World;
  fx: Effects;
  me: { x: number; y: number; f: number };
  /** Where the mouse is pointing, in world coordinates. */
  aim: { x: number; y: number };
  rolling: boolean;
  targetId: number | null;
  hoverId: number | null;
  zoom: number;
}

const ROLE_EMBLEMS: Record<RoleId, Path2D> = {
  tank: new Path2D('M12 3.5 18.5 6V11c0 4.4-2.8 7.7-6.5 9.2C8.3 18.7 5.5 15.4 5.5 11V6Z'),
  mage: new Path2D('M12 3 13.9 10.1 21 12l-7.1 1.9L12 21l-1.9-7.1L3 12l7.1-1.9Z'),
  ranger: new Path2D('M3.5 10.6h10.2V7l7 5-7 5v-3.6H3.5Z'),
  melee: new Path2D('M5 3.5h2.4l9.4 10.6-1.9 1.7ZM19 3.5h-2.4L7.2 14.1l1.9 1.7ZM5.6 16.2l3.6-.1.1 1.7-3.6.1ZM14.7 16.1l3.6.1-.1 1.7-3.6-.1Z'),
};

const MOB_COLORS: Record<MobKind, string> = {
  brute: '#b9533d',
  skirmisher: '#de8a3a',
  archer: '#5fae7a',
  caster: '#8f5ee0',
  elite: '#c8393a',
  sentry: '#7088b8',
};

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)] : [128, 128, 128];
}

function shade(hex: string, k: number, alpha = 1): string {
  const [r, g, b] = rgb(hex);
  const f = (v: number): number => Math.round(clamp(k >= 0 ? v + (255 - v) * k : v * (1 + k), 0, 255));
  return `rgba(${f(r)}, ${f(g)}, ${f(b)}, ${alpha})`;
}

function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private light = document.createElement('canvas');
  private lg: CanvasRenderingContext2D;
  private floorPattern: CanvasPattern | null = null;
  private floorPath = new Path2D();
  private edgePath = new Path2D();
  private wallTiles: { x: number; y: number; face: boolean; n: boolean; s: boolean; e: boolean; w: boolean }[] = [];
  private pebbles: { x: number; y: number; r: number; a: number }[] = [];
  /** Clan-specific floor decorations. */
  private decor: { x: number; y: number; kind: 'bones' | 'skull' | 'blood' | 'stakes' | 'crack' | 'scorch' | 'grave' | 'web'; rot: number; s: number; seed: number }[] = [];
  /** Ambient particles: dust (orcs), embers (dragons), mist (undead). */
  private particles: { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number }[] = [];
  private builtVersion = -1;
  cam = { x: 0, y: 0 };
  private shakeAmt = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private zoom = 34;
  private frameDt = 1 / 60;
  /** Per-entity movement tracking for walk animation. */
  private motion = new Map<number, { x: number; y: number; speed: number; phase: number }>();
  /** Enemies currently fighting someone, this frame: heroes near them take a battle stance. */
  private engaged: { x: number; y: number }[] = [];
  /** Scratch canvas for flashing one animation frame white. */
  private flashCanvas: HTMLCanvasElement | null = null;
  /** Top of each sprite (world y), for nameplates and markers. */
  private tops = new Map<number, number>();
  /** Clickable sprite bounds (world units), for picking. */
  readonly hitBoxes = new Map<number, { x0: number; y0: number; x1: number; y1: number }>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.lg = this.light.getContext('2d') as CanvasRenderingContext2D;
  }

  shake(amount: number): void {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.w / 2) / this.zoom + this.cam.x, y: (sy - this.h / 2) / this.zoom + this.cam.y };
  }

  worldToScreen(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.cam.x) * this.zoom + this.w / 2, y: (y - this.cam.y) * this.zoom + this.h / 2 };
  }

  // ── Static map geometry ──────────────────────────────────────────────────────────────────

  private build(world: World): void {
    const { map, theme } = world;
    const pal = theme.palette;
    if (!this.floorPattern) {
      const T = 32;
      const N = 4;
      const c = document.createElement('canvas');
      c.width = c.height = T * N;
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.fillStyle = shade(pal.floor, -0.35);
      g.fillRect(0, 0, c.width, c.height);
      const rnd = mulberry(world.duty.name.length * 977 + 13);
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; ) {
          const wide = x < N - 1 && rnd() < 0.35 ? 2 : 1;
          const base = rnd() < 0.5 ? pal.floor : pal.floorAlt;
          const k = (rnd() - 0.5) * 0.18;
          const grad = g.createLinearGradient(x * T, y * T, x * T, (y + 1) * T);
          grad.addColorStop(0, shade(base, k + 0.06));
          grad.addColorStop(1, shade(base, k - 0.06));
          g.fillStyle = grad;
          g.beginPath();
          g.roundRect(x * T + 1.5, y * T + 1.5, wide * T - 3, T - 3, 3);
          g.fill();
          // Worn speckles and a hairline crack now and then.
          for (let i = 0; i < 14; i++) {
            g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)';
            g.fillRect(x * T + 3 + rnd() * (wide * T - 6), y * T + 3 + rnd() * (T - 6), 1 + rnd() * 2, 1 + rnd() * 2);
          }
          if (rnd() < 0.25) {
            g.strokeStyle = 'rgba(0,0,0,0.22)';
            g.lineWidth = 1;
            g.beginPath();
            let cx = x * T + 4 + rnd() * (wide * T - 8);
            let cy = y * T + 4;
            g.moveTo(cx, cy);
            for (let s = 0; s < 4; s++) {
              cx += (rnd() - 0.5) * 8;
              cy += 5 + rnd() * 3;
              g.lineTo(cx, Math.min(cy, (y + 1) * T - 4));
            }
            g.stroke();
          }
          x += wide;
        }
      }
      this.floorPattern = this.g.createPattern(c, 'repeat');
      this.floorPattern?.setTransform(new DOMMatrix().scale(1 / T));
      const prnd = mulberry(map.w * 31 + map.h);
      this.pebbles = [];
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if (map.tiles[y * map.w + x] === T_FLOOR && prnd() < 0.05) this.pebbles.push({ x: x + prnd(), y: y + prnd(), r: 0.04 + prnd() * 0.08, a: 0.15 + prnd() * 0.25 });
      // Each clan leaves its own mess on the floor.
      const clan = world.theme.id;
      const open = (x: number, y: number): boolean => map.tiles[y * map.w + x] === T_FLOOR;
      this.decor = [];
      for (let y = 1; y < map.h - 1; y++) {
        for (let x = 1; x < map.w - 1; x++) {
          if (!open(x, y)) continue;
          const wallN = !open(x, y - 1);
          const wallW = !open(x - 1, y);
          const near = wallN || wallW || !open(x + 1, y) || !open(x, y + 1);
          const r = prnd();
          const d = (kind: (typeof this.decor)[number]['kind'], s = 1): void => {
            this.decor.push({ x: x + 0.2 + prnd() * 0.6, y: y + 0.2 + prnd() * 0.6, kind, rot: prnd() * Math.PI * 2, s: s * (0.8 + prnd() * 0.4), seed: prnd() * 100 });
          };
          if (clan === 'orc') {
            if (near && wallN && r < 0.07) d('stakes');
            else if (r < 0.022) d('bones');
            else if (r < 0.04) d('blood', 1.4);
            else if (r < 0.047) d('skull');
          } else if (clan === 'dragon') {
            if (r < 0.03) d('crack', 1.6);
            else if (r < 0.048) d('scorch', 1.5);
            else if (r < 0.054) d('skull', 1.3);
          } else {
            if (wallN && wallW && r < 0.6) this.decor.push({ x, y, kind: 'web', rot: 0, s: 1, seed: 0 });
            else if (near && wallN && r < 0.06) d('grave');
            else if (r < 0.025) d('bones');
            else if (r < 0.04) d('skull');
          }
        }
      }
    }
    // Floor runs and wall edges change when gates open or close.
    this.floorPath = new Path2D();
    this.edgePath = new Path2D();
    this.wallTiles = [];
    const isFloor = (x: number, y: number): boolean => tileAt(map, x, y) === T_FLOOR;
    for (let y = 0; y < map.h; y++) {
      let run = -1;
      for (let x = 0; x <= map.w; x++) {
        const f = x < map.w && isFloor(x, y);
        if (f && run < 0) run = x;
        if (!f && run >= 0) {
          this.floorPath.rect(run, y, x - run, 1);
          run = -1;
        }
        if (x >= map.w) continue;
        if (f) {
          if (!isFloor(x, y - 1)) {
            this.edgePath.moveTo(x, y);
            this.edgePath.lineTo(x + 1, y);
          }
          if (!isFloor(x, y + 1)) {
            this.edgePath.moveTo(x, y + 1);
            this.edgePath.lineTo(x + 1, y + 1);
          }
          if (!isFloor(x - 1, y)) {
            this.edgePath.moveTo(x, y);
            this.edgePath.lineTo(x, y + 1);
          }
          if (!isFloor(x + 1, y)) {
            this.edgePath.moveTo(x + 1, y);
            this.edgePath.lineTo(x + 1, y + 1);
          }
        } else if (tileAt(map, x, y) !== T_GATE) {
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (tileAt(map, x + dx, y + dy) !== 0) near = true;
          if (near) this.wallTiles.push({ x, y, face: isFloor(x, y + 1) || tileAt(map, x, y + 1) === T_GATE, n: isFloor(x, y - 1), s: isFloor(x, y + 1), e: isFloor(x + 1, y), w: isFloor(x - 1, y) });
        }
      }
    }
    this.builtVersion = world.mapVersion;
  }

  // ── Frame ────────────────────────────────────────────────────────────────────────────────

  render(view: View, dt: number): void {
    const { world } = view;
    if (this.builtVersion !== world.mapVersion) this.build(world);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      this.light.width = this.canvas.width;
      this.light.height = this.canvas.height;
    }
    this.w = cw;
    this.h = ch;
    this.frameDt = Math.max(1 / 240, dt);
    this.dpr = dpr;
    this.zoom = view.zoom;
    const follow = 1 - Math.exp(-dt * 9);
    this.cam.x += (view.me.x - this.cam.x) * follow;
    this.cam.y += (view.me.y - this.cam.y) * follow;
    if (Math.hypot(view.me.x - this.cam.x, view.me.y - this.cam.y) > 25) {
      this.cam.x = view.me.x;
      this.cam.y = view.me.y;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.8);
    const sx = (Math.random() - 0.5) * this.shakeAmt * 0.4;
    const sy = (Math.random() - 0.5) * this.shakeAmt * 0.4;

    const g = this.g;
    const pal = world.theme.palette;
    const now = performance.now() / 1000;
    const serverNow = world.serverNow();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = pal.fog;
    g.fillRect(0, 0, cw, ch);

    // World transform.
    const z = this.zoom;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - (this.cam.x + sx) * z), dpr * (ch / 2 - (this.cam.y + sy) * z));
    const x0 = Math.floor(this.cam.x - cw / 2 / z) - 2;
    const x1 = Math.ceil(this.cam.x + cw / 2 / z) + 2;
    const y0 = Math.floor(this.cam.y - ch / 2 / z) - 2;
    const y1 = Math.ceil(this.cam.y + ch / 2 / z) + 2;

    this.drawFloor(x0, y0, x1, y1);
    this.drawDecor(world, now, x0, y0, x1, y1);
    this.drawArenas(world, now);
    this.drawWalls(world, x0, y0, x1, y1);
    this.drawGates(world, now);
    this.drawBraziers(world, now, x0, y0, x1, y1);
    this.drawLighting(view, now);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (cw / 2 - (this.cam.x + sx) * z), dpr * (ch / 2 - (this.cam.y + sy) * z));
    // Ground markers stay on the floor, as if painted on it.
    g.save();
    g.clip(this.floorPath);
    for (const t of world.telegraphs) if (t.style === 'aoe') this.drawTelegraph(view, t, serverNow, now);
    g.restore();
    for (const t of world.telegraphs) if (t.style !== 'aoe') this.drawTelegraph(view, t, serverNow, now);
    this.drawParticles(world, dt, x0, y0, x1, y1);
    this.drawEntities(view, now, serverNow);
    this.drawProjectiles(view, serverNow, now);
    this.drawFx(view, now);
    this.drawReticle(view, now);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawOverlayText(view, now, serverNow);
  }

  private drawFloor(x0: number, y0: number, x1: number, y1: number): void {
    const g = this.g;
    if (this.floorPattern) {
      g.save();
      g.clip(this.floorPath);
      g.fillStyle = this.floorPattern;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      // Pebbles and grit.
      for (const p of this.pebbles) {
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        g.fillStyle = `rgba(0,0,0,${p.a})`;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
      }
      // Soft shadow where floor meets wall.
      g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.lineWidth = 0.7;
      g.stroke(this.edgePath);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1.4;
      g.stroke(this.edgePath);
      g.restore();
    }
  }

  private drawDecor(world: World, now: number, x0: number, y0: number, x1: number, y1: number): void {
    const g = this.g;
    const pal = world.theme.palette;
    for (const d of this.decor) {
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      g.save();
      g.translate(d.x, d.y);
      switch (d.kind) {
        case 'bones':
          g.rotate(d.rot);
          g.strokeStyle = '#d9cfb6';
          g.lineCap = 'round';
          g.lineWidth = 0.07 * d.s;
          for (const a of [0, 1.1]) {
            g.save();
            g.rotate(a);
            g.beginPath();
            g.moveTo(-0.22 * d.s, 0);
            g.lineTo(0.22 * d.s, 0);
            g.stroke();
            g.fillStyle = '#d9cfb6';
            for (const e of [-0.22, 0.22]) {
              g.beginPath();
              g.arc(e * d.s, -0.035, 0.045 * d.s, 0, Math.PI * 2);
              g.arc(e * d.s, 0.035, 0.045 * d.s, 0, Math.PI * 2);
              g.fill();
            }
            g.restore();
          }
          break;
        case 'skull': {
          const k = 0.16 * d.s;
          g.fillStyle = '#ddd3ba';
          g.beginPath();
          g.arc(0, 0, k, Math.PI, 0);
          g.lineTo(k * 0.7, k * 0.8);
          g.lineTo(-k * 0.7, k * 0.8);
          g.closePath();
          g.fill();
          g.fillStyle = '#1a120d';
          g.beginPath();
          g.arc(-k * 0.4, 0, k * 0.26, 0, Math.PI * 2);
          g.arc(k * 0.4, 0, k * 0.26, 0, Math.PI * 2);
          g.fill();
          break;
        }
        case 'blood':
          g.rotate(d.rot);
          g.fillStyle = 'rgba(90, 10, 8, 0.45)';
          g.beginPath();
          g.ellipse(0, 0, 0.35 * d.s, 0.22 * d.s, 0, 0, Math.PI * 2);
          g.ellipse(0.25 * d.s, 0.1, 0.1 * d.s, 0.08 * d.s, 0, 0, Math.PI * 2);
          g.fill();
          break;
        case 'stakes':
          for (let i = 0; i < 3; i++) {
            const x = (i - 1) * 0.28;
            g.fillStyle = '#6b4527';
            g.strokeStyle = '#1a120d';
            g.lineWidth = 0.035;
            g.beginPath();
            g.moveTo(x - 0.07, 0.25);
            g.lineTo(x + 0.07, 0.25);
            g.lineTo(x, -0.35 - (i % 2) * 0.12);
            g.closePath();
            g.fill();
            g.stroke();
          }
          break;
        case 'crack': {
          g.rotate(d.rot);
          const flick = 0.6 + Math.sin(now * 3 + d.seed) * 0.25;
          g.lineCap = 'round';
          g.lineJoin = 'round';
          const path = (): void => {
            g.beginPath();
            g.moveTo(-0.5 * d.s, 0);
            g.lineTo(-0.2 * d.s, 0.12);
            g.lineTo(0.05 * d.s, -0.08);
            g.lineTo(0.3 * d.s, 0.1);
            g.lineTo(0.5 * d.s, -0.02);
            g.moveTo(0.05 * d.s, -0.08);
            g.lineTo(0.12 * d.s, -0.3);
          };
          g.strokeStyle = `rgba(255, 90, 20, ${0.35 * flick})`;
          g.lineWidth = 0.22;
          path();
          g.stroke();
          g.strokeStyle = `rgba(255, 190, 90, ${0.9 * flick})`;
          g.lineWidth = 0.06;
          path();
          g.stroke();
          break;
        }
        case 'scorch': {
          const grad = g.createRadialGradient(0, 0, 0, 0, 0, 0.5 * d.s);
          grad.addColorStop(0, 'rgba(0,0,0,0.5)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grad;
          g.fillRect(-0.5 * d.s, -0.5 * d.s, d.s, d.s);
          break;
        }
        case 'grave':
          g.fillStyle = '#4b585b';
          g.strokeStyle = '#141a1b';
          g.lineWidth = 0.04;
          g.beginPath();
          g.moveTo(-0.2, 0.25);
          g.lineTo(-0.2, -0.15);
          g.arc(0, -0.15, 0.2, Math.PI, 0);
          g.lineTo(0.2, 0.25);
          g.closePath();
          g.fill();
          g.stroke();
          g.strokeStyle = 'rgba(20, 26, 27, 0.8)';
          g.beginPath();
          g.moveTo(0, -0.25);
          g.lineTo(0, 0.05);
          g.moveTo(-0.08, -0.15);
          g.lineTo(0.08, -0.15);
          g.stroke();
          break;
        case 'web': {
          g.strokeStyle = 'rgba(220, 230, 230, 0.22)';
          g.lineWidth = 0.025;
          g.beginPath();
          for (let i = 0; i <= 4; i++) {
            const a = (i / 4) * (Math.PI / 2);
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a) * 1.1, Math.sin(a) * 1.1);
          }
          for (const rr of [0.35, 0.65, 0.95]) {
            g.moveTo(rr, 0);
            for (let i = 1; i <= 4; i++) {
              const a = (i / 4) * (Math.PI / 2);
              g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
          }
          g.stroke();
          break;
        }
      }
      g.restore();
    }
    void pal;
  }

  private drawParticles(world: World, dt: number, x0: number, y0: number, x1: number, y1: number): void {
    const g = this.g;
    const clan = world.theme.id;
    const area = (x1 - x0) * (y1 - y0);
    const rate = clan === 'undead' ? 0.004 : clan === 'dragon' ? 0.02 : 0.008;
    let spawn = area * rate * dt * 10;
    while (spawn > 0) {
      if (Math.random() < spawn && this.particles.length < 260) {
        const x = x0 + Math.random() * (x1 - x0);
        const y = y0 + Math.random() * (y1 - y0);
        if (tileAt(world.map, Math.floor(x), Math.floor(y)) === T_FLOOR) {
          if (clan === 'dragon') this.particles.push({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.4 - Math.random() * 0.6, age: 0, life: 2 + Math.random() * 2, size: 0.04 + Math.random() * 0.05 });
          else if (clan === 'undead') this.particles.push({ x, y, vx: 0.15 + Math.random() * 0.2, vy: (Math.random() - 0.5) * 0.05, age: 0, life: 6 + Math.random() * 4, size: 0.8 + Math.random() * 1.2 });
          else this.particles.push({ x, y, vx: (Math.random() - 0.5) * 0.15, vy: -0.05 - Math.random() * 0.1, age: 0, life: 4 + Math.random() * 3, size: 0.025 + Math.random() * 0.03 });
        }
      }
      spawn -= 1;
    }
    this.particles = this.particles.filter((p) => (p.age += dt) < p.life);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.age / p.life;
      const fade = Math.sin(k * Math.PI);
      if (clan === 'dragon') {
        p.vx += Math.sin(p.age * 3 + p.size * 100) * 0.3 * dt;
        g.fillStyle = `rgba(255, ${140 + Math.round(80 * (1 - k))}, 60, ${0.85 * fade})`;
        g.beginPath();
        g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        g.fill();
      } else if (clan === 'undead') {
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `rgba(150, 255, 200, ${0.07 * fade})`);
        grad.addColorStop(1, 'rgba(150, 255, 200, 0)');
        g.fillStyle = grad;
        g.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else {
        g.fillStyle = `rgba(255, 210, 150, ${0.35 * fade})`;
        g.fillRect(p.x, p.y, p.size, p.size);
      }
    }
  }

  private drawArenas(world: World, now: number): void {
    const g = this.g;
    const pal = world.theme.palette;
    for (const room of world.duty.rooms) {
      if (room.kind !== 'boss') continue;
      const { x, y } = room.center;
      const r = room.radius;
      const active = room.status === 'active';
      g.save();
      g.translate(x, y);
      g.strokeStyle = shade(pal.accent, 0, active ? 0.22 : 0.12);
      g.lineWidth = 0.08;
      for (const k of [0.92, 0.62, 0.3]) {
        g.beginPath();
        g.arc(0, 0, r * k, 0, Math.PI * 2);
        g.stroke();
      }
      g.rotate(now * (active ? 0.08 : 0.02));
      for (let i = 0; i < 24; i++) {
        g.rotate((Math.PI * 2) / 24);
        g.beginPath();
        g.moveTo(r * 0.62, 0);
        g.lineTo(r * (i % 2 ? 0.7 : 0.78), 0);
        g.stroke();
      }
      // A six-pointed sigil in the middle.
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = ((i + 2) / 6) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
        g.lineTo(Math.cos(b) * r * 0.3, Math.sin(b) * r * 0.3);
      }
      g.stroke();
      if (world.duty.sealed && active) {
        g.rotate(-now * 0.16);
        g.strokeStyle = shade(pal.accent, 0.2, 0.35 + Math.sin(now * 3) * 0.1);
        g.lineWidth = 0.18;
        g.setLineDash([0.6, 0.4]);
        g.beginPath();
        g.arc(0, 0, r - 0.35, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      g.restore();
    }
  }

  private drawWalls(world: World, x0: number, y0: number, x1: number, y1: number): void {
    const g = this.g;
    const pal = world.theme.palette;
    const top = shade(pal.wallTop, -0.5);
    const topHi = shade(pal.wallTop, -0.05);
    const face = shade(pal.wallTop, -0.6);
    const rim = shade(pal.accent, 0.3, 0.22);
    for (const t of this.wallTiles) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      g.fillStyle = top;
      g.fillRect(t.x - 0.01, t.y - 0.01, 1.02, 1.02);
      if (t.face) {
        const grad = g.createLinearGradient(0, t.y + 0.45, 0, t.y + 1);
        grad.addColorStop(0, face);
        grad.addColorStop(1, shade(pal.wall, 0.05));
        g.fillStyle = grad;
        g.fillRect(t.x - 0.01, t.y + 0.45, 1.02, 0.56);
        g.fillStyle = topHi;
        g.fillRect(t.x - 0.01, t.y + 0.4, 1.02, 0.06);
      }
      g.fillStyle = rim;
      if (t.n) g.fillRect(t.x, t.y, 1, 0.05);
      if (t.e) g.fillRect(t.x + 0.95, t.y, 0.05, t.face ? 0.45 : 1);
      if (t.w) g.fillRect(t.x, t.y, 0.05, t.face ? 0.45 : 1);
    }
  }

  private drawGates(world: World, now: number): void {
    const g = this.g;
    const pal = world.theme.palette;
    for (const gate of world.gates) {
      if (gate.open) continue;
      const xs = gate.tiles.map((i) => i % world.map.w);
      const ys = gate.tiles.map((i) => Math.floor(i / world.map.w));
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const w = Math.max(...xs) - x + 1;
      const h = Math.max(...ys) - y + 1;
      const grad = gate.vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, shade(pal.accent, 0, 0));
      grad.addColorStop(0.5, shade(pal.accent, 0.2, 0.55 + Math.sin(now * 4) * 0.12));
      grad.addColorStop(1, shade(pal.accent, 0, 0));
      g.fillStyle = grad;
      g.fillRect(x, y, w, h);
      g.strokeStyle = shade(pal.accent, 0.5, 0.8);
      g.lineWidth = 0.05;
      for (let i = 0; i < 5; i++) {
        const k = (i / 5 + now * 0.35) % 1;
        g.beginPath();
        if (gate.vertical) {
          g.moveTo(x + w / 2 + Math.sin(now * 3 + i) * 0.15, y + k * h);
          g.lineTo(x + w / 2 - Math.sin(now * 3 + i) * 0.15, y + k * h + 0.5);
        } else {
          g.moveTo(x + k * w, y + h / 2 + Math.sin(now * 3 + i) * 0.15);
          g.lineTo(x + k * w + 0.5, y + h / 2 - Math.sin(now * 3 + i) * 0.15);
        }
        g.stroke();
      }
    }
  }

  private drawBraziers(world: World, now: number, x0: number, y0: number, x1: number, y1: number): void {
    const g = this.g;
    const pal = world.theme.palette;
    for (const [i, l] of world.lights.entries()) {
      if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.ellipse(l.x, l.y + 0.18, 0.42, 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = shade(pal.wallTop, -0.3);
      g.beginPath();
      g.arc(l.x, l.y, 0.32, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = shade(pal.wallTop, 0.2);
      g.lineWidth = 0.05;
      g.stroke();
      const flick = 0.85 + Math.sin(now * 11 + i * 1.7) * 0.08 + Math.sin(now * 23 + i) * 0.05;
      const flame = g.createRadialGradient(l.x, l.y - 0.1, 0, l.x, l.y - 0.1, 0.38 * flick);
      flame.addColorStop(0, '#fff6d6');
      flame.addColorStop(0.35, shade(pal.light, 0));
      flame.addColorStop(1, shade(pal.light, 0, 0));
      g.fillStyle = flame;
      g.beginPath();
      g.arc(l.x, l.y - 0.1, 0.38 * flick, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawLighting(view: View, now: number): void {
    const { world } = view;
    const lg = this.lg;
    const W = this.light.width;
    const H = this.light.height;
    const pal = world.theme.palette;
    const [fr, fg, fb] = rgb(pal.fog);
    lg.globalCompositeOperation = 'source-over';
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = `rgba(${fr}, ${fg}, ${fb}, 0.8)`;
    lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'destination-out';
    const k = this.zoom * this.dpr;
    const hole = (x: number, y: number, radius: number, strength = 1): void => {
      const s = this.worldToScreen(x, y);
      const px = s.x * this.dpr;
      const py = s.y * this.dpr;
      const r = radius * k;
      if (px < -r || py < -r || px > W + r || py > H + r) return;
      const grad = lg.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(0,0,0,${strength})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.75})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = grad;
      lg.fillRect(px - r, py - r, r * 2, r * 2);
    };
    for (const [i, l] of world.lights.entries()) hole(l.x, l.y, 7.5 * (0.95 + Math.sin(now * 9 + i) * 0.04), 0.95);
    for (const e of world.partyMembers()) if (e.id !== world.meId) hole(e.x, e.y, 8, 0.9);
    hole(view.me.x, view.me.y, 12, 1);
    for (const gate of world.gates) if (!gate.open) hole(gate.center.x, gate.center.y, 4, 0.7);
    for (const room of world.duty.rooms) if (room.kind === 'boss' && room.status === 'active') hole(room.center.x, room.center.y, room.radius + 2, 0.75);
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.light, 0, 0);
    // Warm glow from braziers.
    g.globalCompositeOperation = 'lighter';
    const [lr, lgc, lb] = rgb(pal.light);
    for (const [i, l] of world.lights.entries()) {
      const s = this.worldToScreen(l.x, l.y);
      const r = 4.5 * k * (0.95 + Math.sin(now * 13 + i * 2) * 0.05);
      const px = s.x * this.dpr;
      const py = s.y * this.dpr;
      if (px < -r || py < -r || px > W + r || py > H + r) continue;
      const grad = g.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(${lr}, ${lgc}, ${lb}, 0.16)`);
      grad.addColorStop(1, `rgba(${lr}, ${lgc}, ${lb}, 0)`);
      g.fillStyle = grad;
      g.fillRect(px - r, py - r, r * 2, r * 2);
    }
    g.globalCompositeOperation = 'source-over';
  }

  // ── Telegraphs ───────────────────────────────────────────────────────────────────────────

  private entityPos(view: View, id: number): { x: number; y: number } | null {
    if (id === view.world.meId) return view.me;
    const e = view.world.ents.get(id);
    return e ? { x: e.x, y: e.y } : null;
  }

  private shapePath(s: Shape, scale = 1): Path2D {
    const p = new Path2D();
    switch (s.kind) {
      case 'circle':
        p.arc(s.x, s.y, Math.max(0.01, s.radius * scale), 0, Math.PI * 2);
        break;
      case 'donut': {
        // Fills outward from the edge of the safe middle, where it matters.
        const reach = Math.min(s.radius, s.inner + 16);
        const outer = s.inner + (reach - s.inner) * scale;
        p.arc(s.x, s.y, Math.max(0.01, outer), 0, Math.PI * 2);
        p.moveTo(s.x + s.inner, s.y);
        p.arc(s.x, s.y, Math.max(0.01, s.inner), 0, Math.PI * 2, true);
        break;
      }
      case 'cone':
        p.moveTo(s.x, s.y);
        p.arc(s.x, s.y, Math.max(0.01, s.radius * scale), s.dir - s.angle / 2, s.dir + s.angle / 2);
        p.closePath();
        break;
      case 'line': {
        const len = s.length * scale;
        const c = Math.cos(s.dir);
        const sn = Math.sin(s.dir);
        const hw = s.width / 2;
        p.moveTo(s.x - sn * hw, s.y + c * hw);
        p.lineTo(s.x - sn * hw + c * len, s.y + c * hw + sn * len);
        p.lineTo(s.x + sn * hw + c * len, s.y - c * hw + sn * len);
        p.lineTo(s.x + sn * hw, s.y - c * hw);
        p.closePath();
        break;
      }
    }
    return p;
  }

  private drawTelegraph(view: View, t: TelegraphSnap, serverNow: number, now: number): void {
    const g = this.g;
    const p = clamp((serverNow - t.start) / Math.max(0.01, t.end - t.start), 0, 1);
    let shape = t.shape;
    if (t.follow != null) {
      const pos = this.entityPos(view, t.follow);
      if (pos && (shape.kind === 'circle' || shape.kind === 'donut')) shape = { ...shape, x: pos.x, y: pos.y };
    }
    const lw = 2.2 / this.zoom;
    switch (t.style) {
      case 'ally': {
        // Your party's delayed blasts (meteors, volleys) land here.
        const full = this.shapePath(shape);
        g.fillStyle = 'rgba(120, 200, 255, 0.12)';
        g.fill(full);
        g.fillStyle = `rgba(160, 220, 255, ${0.1 + p * 0.15})`;
        g.fill(this.shapePath(shape, p));
        g.strokeStyle = 'rgba(190, 230, 255, 0.75)';
        g.lineWidth = lw;
        g.setLineDash([0.4, 0.25]);
        g.stroke(full);
        g.setLineDash([]);
        break;
      }
      case 'aoe': {
        const full = this.shapePath(shape);
        if (t.m) {
          // A routine monster swing: a quick, faint warning.
          g.fillStyle = `rgba(255, 80, 40, ${0.1 + p * 0.18})`;
          g.fill(this.shapePath(shape, p), 'evenodd');
          g.strokeStyle = 'rgba(255, 130, 80, 0.55)';
          g.lineWidth = lw * 0.8;
          g.stroke(full);
          break;
        }
        g.fillStyle = 'rgba(255, 110, 30, 0.2)';
        g.fill(full, 'evenodd');
        g.fillStyle = `rgba(255, 150, 60, ${0.18 + p * 0.12})`;
        g.fill(this.shapePath(shape, p), 'evenodd');
        g.strokeStyle = 'rgba(255, 140, 60, 0.35)';
        g.lineWidth = lw * 3;
        g.stroke(full);
        g.strokeStyle = `rgba(255, 200, 140, ${0.75 + Math.sin(now * 10) * 0.15})`;
        g.lineWidth = lw;
        g.stroke(full);
        break;
      }
      case 'stack': {
        if (shape.kind !== 'circle') break;
        const r = shape.radius;
        g.fillStyle = 'rgba(255, 214, 80, 0.14)';
        g.beginPath();
        g.arc(shape.x, shape.y, r, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(255, 226, 120, 0.9)';
        g.lineWidth = lw * 1.4;
        g.stroke();
        // Chevrons pointing in.
        g.fillStyle = 'rgba(255, 236, 150, 0.95)';
        const pulse = (now * 1.4) % 1;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const d = r * (1 - pulse * 0.5);
          g.save();
          g.translate(shape.x + Math.cos(a) * d, shape.y + Math.sin(a) * d);
          g.rotate(a + Math.PI);
          g.globalAlpha = 1 - pulse * 0.6;
          g.beginPath();
          g.moveTo(0.45, 0);
          g.lineTo(-0.3, -0.42);
          g.lineTo(-0.1, 0);
          g.lineTo(-0.3, 0.42);
          g.closePath();
          g.fill();
          g.restore();
        }
        g.globalAlpha = 1;
        break;
      }
      case 'spread': {
        if (shape.kind !== 'circle') break;
        const pulse = 0.5 + Math.sin(now * 8) * 0.5;
        g.fillStyle = `rgba(190, 110, 255, ${0.12 + p * 0.1})`;
        g.beginPath();
        g.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(220, 170, 255, ${0.7 + pulse * 0.3})`;
        g.lineWidth = lw * 1.4;
        g.stroke();
        g.setLineDash([0.4, 0.3]);
        g.beginPath();
        g.arc(shape.x, shape.y, shape.radius * (0.4 + p * 0.6), 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        break;
      }
      case 'buster': {
        if (shape.kind !== 'circle') break;
        g.fillStyle = 'rgba(255, 40, 40, 0.16)';
        g.beginPath();
        g.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = `rgba(255, 90, 80, ${0.7 + Math.sin(now * 12) * 0.25})`;
        g.lineWidth = lw * 1.6;
        g.stroke();
        // Crosshair marker.
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + now;
          g.moveTo(shape.x + Math.cos(a) * shape.radius * 0.55, shape.y + Math.sin(a) * shape.radius * 0.55);
          g.lineTo(shape.x + Math.cos(a) * shape.radius * 0.95, shape.y + Math.sin(a) * shape.radius * 0.95);
        }
        g.stroke();
        break;
      }
      case 'raidwide': {
        if (shape.kind !== 'circle' || shape.radius <= 0) break;
        // Knockback: arrows streaming outward from the caster.
        g.strokeStyle = 'rgba(140, 210, 255, 0.75)';
        g.lineWidth = lw * 1.5;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const k = (now * 0.8 + i * 0.13) % 1;
          const d0 = 2.5 + k * 5;
          g.globalAlpha = 1 - k;
          g.beginPath();
          g.moveTo(shape.x + Math.cos(a) * d0, shape.y + Math.sin(a) * d0);
          g.lineTo(shape.x + Math.cos(a) * (d0 + 1.2), shape.y + Math.sin(a) * (d0 + 1.2));
          g.lineTo(shape.x + Math.cos(a + 0.08) * (d0 + 0.8), shape.y + Math.sin(a + 0.08) * (d0 + 0.8));
          g.stroke();
        }
        g.globalAlpha = 1;
        break;
      }
    }
  }

  // ── Entities ─────────────────────────────────────────────────────────────────────────────

  private drawEntities(view: View, now: number, serverNow: number): void {
    const { world } = view;
    const list: ClientEntity[] = [];
    for (const e of world.ents.values()) {
      if (e.id === world.meId) {
        e.x = view.me.x;
        e.y = view.me.y;
        e.f = view.me.f;
      }
      if (e.removed && (!e.diedAt || now - e.diedAt > 0.7)) continue;
      if (e.samples.length === 0 && e.id !== world.meId) continue;
      list.push(e);
    }
    list.sort((a, b) => a.y - b.y);
    this.engaged = list.filter((e) => e.spawn.team === 'enemy' && !e.diedAt && e.snap.t !== undefined).map((e) => ({ x: e.x, y: e.y }));
    const g = this.g;
    // Shadows and rings first so bodies sit on top.
    for (const e of list) {
      const r = e.spawn.radius;
      const sp = spriteFor(e.spawn, world.theme.id);
      const sw = sp.ready ? (sp.def.height * sp.def.w) / sp.def.h : r * 3;
      const footW = Math.min(sw * 0.3, Math.max(r * 1.1, 0.45));
      g.fillStyle = sp.def.floats ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.42)';
      g.beginPath();
      g.ellipse(e.x, e.y + 0.15, footW, footW * 0.38, 0, 0, Math.PI * 2);
      g.fill();
      if (e.spawn.team === 'enemy' && !e.diedAt) this.drawTargetCircle(e, view.targetId === e.id, now);
      if (e.id === world.meId) {
        g.strokeStyle = `rgba(255, 224, 140, ${0.6 + Math.sin(now * 3) * 0.15})`;
        g.lineWidth = 0.07;
        g.beginPath();
        g.arc(e.x, e.y, r + 0.28, 0, Math.PI * 2);
        g.stroke();
      }
      if (view.targetId === e.id && e.spawn.team === 'party') {
        g.strokeStyle = 'rgba(255, 214, 110, 0.95)';
        g.lineWidth = 0.08;
        g.setLineDash([0.35, 0.2]);
        g.lineDashOffset = -now;
        g.beginPath();
        g.arc(e.x, e.y, r + 0.38, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      if (view.hoverId === e.id && view.targetId !== e.id) {
        g.strokeStyle = 'rgba(255,255,255,0.55)';
        g.lineWidth = 0.05;
        g.beginPath();
        g.arc(e.x, e.y, r + 0.3, 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (const e of list) {
      const fade = e.diedAt && e.spawn.team === 'enemy' ? clamp(1 - (now - e.diedAt) / 0.7, 0, 1) : 1;
      g.globalAlpha = fade;
      const sprite = spriteFor(e.spawn, world.theme.id);
      if (sprite.ready) this.drawSprite(view, e, sprite, now);
      else if (e.spawn.kind === 'player') {
        if (e.id === world.meId && view.rolling) this.drawRolling(e, now);
        else this.drawPlayer(e, now);
      } else if (e.spawn.kind === 'boss') this.drawBoss(view, e, now);
      else this.drawMob(e, now);
      // Flash white when struck (sprites flash their own silhouette).
      const hitAt = world.lastHit.get(e.id);
      if (!sprite.ready && hitAt !== undefined && now - hitAt < 0.12 && !e.diedAt) {
        g.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - (now - hitAt) / 0.12)})`;
        g.beginPath();
        g.arc(e.x, e.y, e.spawn.radius * (e.spawn.kind === 'boss' ? 0.95 : 1.05), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      // Tank-buster markers float above whoever they target.
      for (const t of world.telegraphs) {
        if (t.style !== 'buster' || t.follow !== e.id) continue;
        const p = clamp((serverNow - t.start) / Math.max(0.01, t.end - t.start), 0, 1);
        const y = (this.tops.get(e.id) ?? e.y - e.spawn.radius) - 0.8 - Math.sin(now * 6) * 0.08;
        g.fillStyle = `rgba(255, ${80 + p * 60}, 70, 0.95)`;
        g.beginPath();
        g.moveTo(e.x, y - 0.55);
        g.lineTo(e.x + 0.42, y);
        g.lineTo(e.x, y + 0.55);
        g.lineTo(e.x - 0.42, y);
        g.closePath();
        g.fill();
        g.fillStyle = '#fff';
        g.fillRect(e.x - 0.05, y - 0.3, 0.1, 0.36);
        g.fillRect(e.x - 0.05, y + 0.14, 0.1, 0.1);
      }
    }
  }

  private drawTargetCircle(e: ClientEntity, targeted: boolean, now: number): void {
    const g = this.g;
    const r = e.spawn.radius + 0.15;
    const big = e.spawn.kind === 'boss' || e.spawn.mob === 'elite';
    g.save();
    g.translate(e.x, e.y);
    g.rotate(e.f);
    g.strokeStyle = targeted ? 'rgba(255, 110, 90, 0.95)' : big ? 'rgba(255, 150, 120, 0.45)' : 'rgba(255, 150, 120, 0.25)';
    g.lineWidth = targeted ? 0.08 : 0.05;
    g.beginPath();
    g.arc(0, 0, r, 0.25, Math.PI * 2 - 0.25);
    g.stroke();
    // Front arrow.
    g.fillStyle = g.strokeStyle;
    g.beginPath();
    g.moveTo(r + 0.35, 0);
    g.lineTo(r - 0.02, -0.24);
    g.lineTo(r - 0.02, 0.24);
    g.closePath();
    g.fill();
    if (big) {
      // Flank and rear boundaries, for positional attacks.
      g.lineWidth = 0.05;
      for (const a of [Math.PI / 4, -Math.PI / 4, (Math.PI * 3) / 4, (-Math.PI * 3) / 4]) {
        g.beginPath();
        g.moveTo(Math.cos(a) * (r - 0.25), Math.sin(a) * (r - 0.25));
        g.lineTo(Math.cos(a) * (r + 0.25), Math.sin(a) * (r + 0.25));
        g.stroke();
      }
    }
    if (targeted) {
      g.rotate(now * 0.8);
      g.setLineDash([0.3, 0.25]);
      g.beginPath();
      g.arc(0, 0, r + 0.25, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }
    g.restore();
  }

  /**
   * Draws an entity standing at its position, mirrored to face its heading: an animation frame
   * once its frames are built (heroes carry their weapons in them), otherwise the still artwork
   * with a little bob. Flashes white when struck; knocked-out heroes lie greyed; dead monsters sink.
   */
  private drawSprite(view: View, e: ClientEntity, sp: Sprite, now: number): void {
    const g = this.g;
    const def = sp.def;
    const H = def.height;
    const W = (H * def.w) / def.h;
    const isPlayer = e.spawn.kind === 'player';
    const dead = isPlayer && !!e.snap.d;
    let m = this.motion.get(e.id);
    if (!m) {
      m = { x: e.x, y: e.y, speed: 0, phase: 0 };
      this.motion.set(e.id, m);
    }
    const step = Math.hypot(e.x - m.x, e.y - m.y) / this.frameDt;
    m.speed += (Math.min(step, 20) - m.speed) * 0.25;
    m.x = e.x;
    m.y = e.y;
    const moving = m.speed > 0.6 && !dead;
    const rolling = e.id === view.world.meId && view.rolling;
    const anim = sp.anim;
    const flip = Math.cos(e.f) < -0.05;
    const sink = e.diedAt && !isPlayer ? clamp((now - e.diedAt) / 0.7, 0, 1) : 0;
    const hitAt = view.world.lastHit.get(e.id);
    const flash = hitAt !== undefined && now - hitAt < 0.1 && !e.diedAt && !dead ? (e.spawn.kind === 'boss' ? 0.35 : 0.6) * (1 - (now - hitAt) / 0.1) : 0;
    const dy = (-H * def.ay) / def.h;
    let feetY: number;

    g.save();
    if (anim) {
      // Strides advance with distance travelled: a full stride every ~1.2 body heights.
      if (rolling) m.phase += this.frameDt * 26;
      else if (moving) m.phase += (this.frameDt * m.speed * Math.PI * 2) / Math.max(1.6, H * 1.2);
      const { clip, frame } = rolling ? { clip: 'move' as Clip, frame: Math.floor((m.phase / (Math.PI * 2)) * anim.lengths.move) % anim.lengths.move } : this.animState(view, e, anim, m.phase, now, moving);
      feetY = e.y + 0.15 - (def.floats ? 0.25 : 0);
      const k = anim.scale;
      g.translate(e.x, feetY);
      if (dead) {
        g.rotate(flip ? -1.45 : 1.45);
        g.globalAlpha *= 0.85;
      }
      if (flip) g.scale(-1, 1);
      g.scale(1, 1 - sink * 0.45);
      g.imageSmoothingEnabled = false;
      const ox = -anim.ax * k;
      const oy = -anim.ay * k;
      const fx = frame * anim.fw;
      const fy = anim.rows[clip] * anim.fh;
      if (dead && anim.grey) {
        g.drawImage(anim.grey, ox, oy, anim.fw * k, anim.fh * k);
      } else {
        if (rolling) {
          // A dash: two fading after-images trail behind.
          for (const [back, a] of [[1.1, 0.18], [0.55, 0.32]] as const) {
            g.globalAlpha = a;
            g.drawImage(anim.atlas, fx, fy, anim.fw, anim.fh, ox - back, oy, anim.fw * k, anim.fh * k);
          }
          g.globalAlpha = 1;
        }
        g.drawImage(anim.atlas, fx, fy, anim.fw, anim.fh, ox, oy, anim.fw * k, anim.fh * k);
        if (flash > 0) {
          g.globalAlpha *= flash;
          g.drawImage(this.whiteFrame(anim.atlas, fx, fy, anim.fw, anim.fh), 0, 0, anim.fw, anim.fh, ox, oy, anim.fw * k, anim.fh * k);
        }
      }
    } else {
      if (moving) m.phase += this.frameDt * (6 + m.speed * 1.2);
      const bob = moving ? Math.abs(Math.sin(m.phase)) * Math.min(H, 2.5) * 0.05 : 0;
      const breathe = moving ? 0 : Math.sin(now * 2.2 + e.id) * 0.012;
      feetY = e.y + 0.15 - bob - (def.floats ? 0.25 + Math.sin(now * 2 + e.id) * 0.15 : 0);
      g.translate(e.x, feetY);
      if (dead) {
        g.rotate(flip ? -1.45 : 1.45);
        g.globalAlpha *= 0.85;
      } else {
        g.rotate(moving ? Math.sin(m.phase) * 0.05 : 0);
      }
      if (flip) g.scale(-1, 1);
      g.scale(1, (1 + breathe) * (1 - sink * 0.45));
      g.imageSmoothingEnabled = false;
      const dx = (-W * def.ax) / def.w;
      g.drawImage(dead && sp.grey ? sp.grey : sp.img, dx, dy, W, H);
      if (sp.white && flash > 0) {
        g.globalAlpha *= flash;
        g.drawImage(sp.white, dx, dy, W, H);
      }
    }
    g.restore();

    this.tops.set(e.id, feetY + dy * (1 - sink * 0.45));
    this.hitBoxes.set(e.id, { x0: e.x - W * 0.28, x1: e.x + W * 0.28, y0: feetY + dy * 0.9, y1: e.y + 0.3 });
  }

  /**
   * Which clip and frame an entity shows: its attack or skill while one plays out (winding up for
   * as long as the server said, then the blow or the release), otherwise running, a battle stance
   * near a fight, or idling.
   */
  private animState(view: View, e: ClientEntity, anim: SpriteAnim, phase: number, now: number, moving: boolean): { clip: Clip; frame: number } {
    const len = anim.lengths;
    if (e.diedAt) return { clip: 'idle', frame: 0 };
    const act = view.world.acts.get(e.id);
    if (act) {
      const t = now - act.at;
      if (act.k === 'atk') {
        const wind = Math.max(act.d, 0.08);
        if (t >= 0 && t < wind) return { clip: 'action', frame: Math.min(anim.windup - 1, Math.floor((t / wind) * anim.windup)) };
        const blow = len.action - anim.windup;
        const r = (t - wind) / anim.strike;
        if (r >= 0 && r < 1) return { clip: 'action', frame: anim.windup + Math.min(blow - 1, Math.floor(r * blow)) };
      } else {
        const charge = Math.max(act.d, 0.15);
        // Gathering power loops its later frames for as long as the wind-up lasts.
        if (t >= 0 && t < charge) return { clip: 'skill', frame: t < 0.1 || anim.charge < 2 ? 0 : 1 + (Math.floor((t - 0.1) / 0.12) % (anim.charge - 1)) };
        const rel = len.skill - anim.charge;
        const r = (t - charge) / anim.release;
        if (r >= 0 && r < 1) return { clip: 'skill', frame: anim.charge + Math.min(rel - 1, Math.floor(r * rel)) };
      }
    }
    if (moving) return { clip: 'move', frame: Math.floor((phase / (Math.PI * 2)) * len.move) % len.move };
    const offset = e.id * 0.37;
    const fighting = e.spawn.team === 'enemy' ? e.snap.t !== undefined : this.engaged.some((o) => Math.abs(o.x - e.x) < 16 && Math.abs(o.y - e.y) < 16);
    if (fighting) return { clip: 'battle', frame: Math.floor((now / 0.8 + offset) * len.battle) % len.battle };
    return { clip: 'idle', frame: Math.floor((now / 1.4 + offset) * len.idle) % len.idle };
  }

  /** One atlas frame as a white silhouette, for the hit flash. */
  private whiteFrame(atlas: HTMLCanvasElement, fx: number, fy: number, fw: number, fh: number): HTMLCanvasElement {
    let c = this.flashCanvas;
    if (!c) {
      c = document.createElement('canvas');
      this.flashCanvas = c;
    }
    if (c.width < fw || c.height < fh) {
      c.width = Math.max(c.width, fw);
      c.height = Math.max(c.height, fh);
    }
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.globalCompositeOperation = 'copy';
    g.drawImage(atlas, fx, fy, fw, fh, 0, 0, fw, fh);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, fw, fh);
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  /** You, mid-roll: a tucked, spinning silhouette. */
  private drawRolling(e: ClientEntity, now: number): void {
    const g = this.g;
    const color = ROLES[(e.spawn.role ?? 'tank') as RoleId].color;
    g.save();
    g.translate(e.x, e.y);
    g.rotate(now * 20);
    g.globalAlpha *= 0.85;
    g.fillStyle = shade(color, 0.2);
    g.beginPath();
    g.ellipse(0, 0, e.spawn.radius * 0.9, e.spawn.radius * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 0.06;
    g.beginPath();
    g.arc(0, 0, e.spawn.radius * 0.55, 0, Math.PI * 1.2);
    g.stroke();
    g.restore();
  }

  private drawProjectiles(view: View, serverNow: number, now: number): void {
    const g = this.g;
    const dt = clamp(serverNow - view.world.projectileTime, 0, 0.25);
    for (const pr of view.world.projectiles) {
      const x = pr.x + Math.cos(pr.d) * pr.s * dt;
      const y = pr.y + Math.sin(pr.d) * pr.s * dt;
      g.save();
      g.translate(x, y);
      g.rotate(pr.d);
      switch (pr.k) {
        case 'arrow':
          g.strokeStyle = `hsla(${pr.h}, 40%, 85%, 0.5)`;
          g.lineWidth = 0.05;
          g.beginPath();
          g.moveTo(-1.6, 0);
          g.lineTo(-0.5, 0);
          g.stroke();
          g.strokeStyle = '#e9dcc0';
          g.lineWidth = 0.07;
          g.beginPath();
          g.moveTo(-0.6, 0);
          g.lineTo(0.25, 0);
          g.stroke();
          g.fillStyle = '#f4f4f4';
          g.beginPath();
          g.moveTo(0.4, 0);
          g.lineTo(0.18, -0.1);
          g.lineTo(0.18, 0.1);
          g.fill();
          break;
        case 'bolt':
          g.strokeStyle = `hsla(${pr.h}, 90%, 70%, 0.55)`;
          g.lineWidth = 0.18;
          g.beginPath();
          g.moveTo(-1.1, 0);
          g.lineTo(0.2, 0);
          g.stroke();
          g.strokeStyle = '#fff3dc';
          g.lineWidth = 0.08;
          g.beginPath();
          g.moveTo(-0.3, 0);
          g.lineTo(0.3, 0);
          g.stroke();
          break;
        case 'axe':
        case 'shield': {
          g.rotate(now * 18);
          g.fillStyle = pr.k === 'axe' ? '#dfe6ef' : '#7fa8e6';
          g.strokeStyle = 'rgba(0,0,0,0.6)';
          g.lineWidth = 0.05;
          g.beginPath();
          if (pr.k === 'axe') {
            g.moveTo(0.5, 0);
            g.lineTo(-0.2, -0.35);
            g.lineTo(-0.35, 0);
            g.lineTo(-0.2, 0.35);
            g.closePath();
            g.fill();
            g.stroke();
          } else {
            // A heater shield with the Guardian's crimson cross.
            const k = pr.r * 0.75;
            g.moveTo(-k, -k * 1.1);
            g.lineTo(k, -k * 1.1);
            g.quadraticCurveTo(k * 1.05, k * 0.4, 0, k * 1.35);
            g.quadraticCurveTo(-k * 1.05, k * 0.4, -k, -k * 1.1);
            g.closePath();
            g.fillStyle = '#6f7a8c';
            g.fill();
            g.stroke();
            g.fillStyle = '#8e1f22';
            g.fillRect(-0.05, -k * 0.9, 0.1, k * 1.9);
            g.fillRect(-k * 0.7, -k * 0.35, k * 1.4, 0.1);
          }
          break;
        }
        case 'wave':
          g.strokeStyle = `hsla(${pr.h}, 90%, 75%, 0.9)`;
          g.lineWidth = 0.22;
          g.beginPath();
          g.arc(-0.4, 0, pr.r + 0.4, -1, 1);
          g.stroke();
          break;
        default: {
          // Orbs, sparks and enemy shots: glowing balls.
          const radius = pr.k === 'orb' ? pr.r + 0.25 : pr.r + 0.15;
          const glow = g.createRadialGradient(0, 0, 0, 0, 0, radius * 1.8);
          const hue = pr.e ? pr.h : pr.h;
          glow.addColorStop(0, pr.e ? '#ffe0e0' : '#ffffff');
          glow.addColorStop(0.35, `hsla(${hue}, 95%, ${pr.e ? 55 : 65}%, 0.95)`);
          glow.addColorStop(1, `hsla(${hue}, 95%, 50%, 0)`);
          g.fillStyle = glow;
          g.beginPath();
          g.arc(0, 0, radius * 1.8, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = `hsla(${hue}, 90%, 70%, 0.35)`;
          g.lineWidth = radius;
          g.beginPath();
          g.moveTo(-radius * 3, 0);
          g.lineTo(-radius, 0);
          g.stroke();
        }
      }
      g.restore();
    }
  }

  private drawReticle(view: View, now: number): void {
    const g = this.g;
    const { aim, me } = view;
    const lw = 1.5 / this.zoom;
    g.strokeStyle = 'rgba(255, 240, 200, 0.18)';
    g.lineWidth = lw;
    g.setLineDash([0.25, 0.25]);
    g.beginPath();
    const a = Math.atan2(aim.y - me.y, aim.x - me.x);
    const len = Math.min(Math.hypot(aim.x - me.x, aim.y - me.y), 7);
    g.moveTo(me.x + Math.cos(a) * 0.8, me.y + Math.sin(a) * 0.8);
    g.lineTo(me.x + Math.cos(a) * len, me.y + Math.sin(a) * len);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = 'rgba(255, 236, 180, 0.85)';
    g.lineWidth = lw * 1.4;
    const r = 0.32 + Math.sin(now * 5) * 0.03;
    g.beginPath();
    g.arc(aim.x, aim.y, r, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const b = (i * Math.PI) / 2;
      g.moveTo(aim.x + Math.cos(b) * (r + 0.08), aim.y + Math.sin(b) * (r + 0.08));
      g.lineTo(aim.x + Math.cos(b) * (r + 0.26), aim.y + Math.sin(b) * (r + 0.26));
    }
    g.stroke();
  }

  private drawPlayer(e: ClientEntity, now: number): void {
    const g = this.g;
    const role = (e.spawn.role ?? 'tank') as RoleId;
    const color = ROLES[role].color;
    const r = e.spawn.radius;
    const dead = !!e.snap.d;
    g.save();
    g.translate(e.x, e.y);
    if (dead) {
      g.globalAlpha *= 0.6;
      g.scale(1, 0.55);
    }
    const bob = dead ? 0 : Math.sin(now * 4 + e.id) * 0.02;
    const body = g.createRadialGradient(-r * 0.3, -r * 0.4 + bob, r * 0.1, 0, bob, r);
    body.addColorStop(0, dead ? '#9a9a9a' : shade(color, 0.45));
    body.addColorStop(0.7, dead ? '#5a5a5a' : color);
    body.addColorStop(1, dead ? '#333' : shade(color, -0.45));
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, bob, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(10, 12, 20, 0.9)';
    g.lineWidth = 0.07;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 0.035;
    g.beginPath();
    g.arc(0, bob, r * 0.82, Math.PI * 1.1, Math.PI * 1.7);
    g.stroke();
    // Emblem.
    g.save();
    const s = (r * 1.25) / 12;
    g.translate(0, bob);
    g.scale(s, s);
    g.translate(-12, -12);
    g.fillStyle = 'rgba(255, 252, 240, 0.92)';
    g.fill(ROLE_EMBLEMS[role]);
    g.restore();
    if (!dead) {
      // Facing notch.
      g.rotate(e.f);
      g.fillStyle = '#fff6dc';
      g.beginPath();
      g.moveTo(r + 0.24, bob);
      g.lineTo(r - 0.02, -0.15 + bob);
      g.lineTo(r - 0.02, 0.15 + bob);
      g.closePath();
      g.fill();
    }
    g.restore();
  }

  private drawMob(e: ClientEntity, now: number): void {
    const g = this.g;
    const kind = (e.spawn.mob ?? 'brute') as MobKind;
    const base = MOB_COLORS[kind];
    const r = e.spawn.radius;
    g.save();
    g.translate(e.x, e.y);
    const body = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1);
    body.addColorStop(0, shade(base, 0.35));
    body.addColorStop(0.75, base);
    body.addColorStop(1, shade(base, -0.55));
    g.fillStyle = body;
    g.strokeStyle = 'rgba(15, 5, 5, 0.9)';
    g.lineWidth = 0.07;
    g.rotate(e.f);
    g.beginPath();
    switch (kind) {
      case 'brute':
        g.roundRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.45);
        break;
      case 'skirmisher':
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + now * 2;
          const d = i % 2 ? r * 0.6 : r * 1.05;
          i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        g.closePath();
        break;
      case 'archer':
        g.moveTo(r * 1.05, 0);
        g.lineTo(0, -r * 0.85);
        g.lineTo(-r * 0.95, 0);
        g.lineTo(0, r * 0.85);
        g.closePath();
        break;
      case 'caster':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        break;
      case 'elite':
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          const d = i % 2 ? r * 0.88 : r * 1.12;
          i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
        }
        g.closePath();
        break;
      case 'sentry':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
        break;
    }
    g.fill();
    g.stroke();
    // Details: horns, bow, orb, eye.
    if (kind === 'brute' || kind === 'elite') {
      g.fillStyle = '#e9dcc0';
      for (const sgn of [-1, 1]) {
        g.beginPath();
        g.moveTo(r * 0.55, sgn * r * 0.55);
        g.lineTo(r * 1.25, sgn * r * 0.85);
        g.lineTo(r * 0.75, sgn * r * 0.25);
        g.closePath();
        g.fill();
      }
    }
    if (kind === 'archer') {
      g.strokeStyle = '#e8d9a8';
      g.lineWidth = 0.08;
      g.beginPath();
      g.arc(r * 0.5, 0, r * 0.75, -1.2, 1.2);
      g.stroke();
    }
    if (kind === 'caster' || kind === 'sentry') {
      const orb = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
      orb.addColorStop(0, '#fff');
      orb.addColorStop(0.4, kind === 'caster' ? '#d6a8ff' : '#a8d8ff');
      orb.addColorStop(1, 'rgba(160, 100, 255, 0)');
      g.fillStyle = orb;
      g.beginPath();
      g.arc(0, 0, r * (0.5 + Math.sin(now * 5) * 0.06), 0, Math.PI * 2);
      g.fill();
    }
    // Eyes facing forward.
    g.fillStyle = '#ffe9a0';
    g.beginPath();
    g.arc(r * 0.55, -r * 0.22, r * 0.11, 0, Math.PI * 2);
    g.arc(r * 0.55, r * 0.22, r * 0.11, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  private drawBoss(view: View, e: ClientEntity, now: number): void {
    const g = this.g;
    const pal = view.world.theme.palette;
    const r = e.spawn.radius;
    const casting = !!e.snap.c;
    g.save();
    g.translate(e.x, e.y);
    // Aura.
    const aura = g.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.7);
    aura.addColorStop(0, shade(pal.accent, 0, casting ? 0.35 : 0.18));
    aura.addColorStop(1, shade(pal.accent, 0, 0));
    g.fillStyle = aura;
    g.beginPath();
    g.arc(0, 0, r * 1.7, 0, Math.PI * 2);
    g.fill();
    g.rotate(e.f);
    // Crown of spikes.
    g.fillStyle = shade('#8a2a2a', -0.2);
    g.strokeStyle = 'rgba(10, 4, 4, 0.9)';
    g.lineWidth = 0.08;
    g.beginPath();
    const spikes = 16;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2 + Math.sin(now * 0.7) * 0.05;
      const d = i % 2 ? r * 0.92 : r * 1.2;
      i ? g.lineTo(Math.cos(a) * d, Math.sin(a) * d) : g.moveTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    g.closePath();
    g.fill();
    g.stroke();
    const body = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    body.addColorStop(0, '#d46a52');
    body.addColorStop(0.6, '#7e2420');
    body.addColorStop(1, '#2a0907');
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, 0, r * 0.92, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = shade(pal.accent, 0.2, 0.75);
    g.lineWidth = 0.1;
    g.beginPath();
    g.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    g.stroke();
    // Inner sigil turning slowly.
    g.save();
    g.rotate(now * 0.6);
    g.strokeStyle = shade(pal.accent, 0.4, 0.6);
    g.lineWidth = 0.06;
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const b = ((i + 1) / 3) * Math.PI * 2;
      g.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55);
      g.lineTo(Math.cos(b) * r * 0.55, Math.sin(b) * r * 0.55);
    }
    g.stroke();
    g.restore();
    // Eyes.
    const glow = casting ? 1 : 0.75 + Math.sin(now * 3) * 0.15;
    g.fillStyle = `rgba(255, 236, 170, ${glow})`;
    g.shadowColor = '#ffcf6a';
    g.shadowBlur = 12;
    g.beginPath();
    g.ellipse(r * 0.62, -r * 0.24, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    g.ellipse(r * 0.62, r * 0.24, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.restore();
  }

  // ── Effects ──────────────────────────────────────────────────────────────────────────────

  private drawFx(view: View, now: number): void {
    const g = this.g;
    for (const f of view.fx.fx) {
      const k = clamp((now - f.born) / f.life, 0, 1);
      this.drawOneFx(view, g, f, k, now);
    }
    g.globalAlpha = 1;
  }

  private drawOneFx(view: View, g: CanvasRenderingContext2D, f: Fx, k: number, now: number): void {
    const col = (l: number, a: number): string => `hsla(${f.hue}, 90%, ${l}%, ${a})`;
    const at = f.follow != null ? this.entityPos(view, f.follow) : null;
    const x = at?.x ?? f.x;
    const y = at?.y ?? f.y;
    switch (f.kind) {
      case 'proj': {
        const px = f.x + (f.x2 - f.x) * k;
        const py = f.y + (f.y2 - f.y) * k;
        const tx = f.x + (f.x2 - f.x) * Math.max(0, k - 0.25);
        const ty = f.y + (f.y2 - f.y) * Math.max(0, k - 0.25);
        g.strokeStyle = col(70, 0.6);
        g.lineWidth = 0.12;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(px, py);
        g.stroke();
        const head = g.createRadialGradient(px, py, 0, px, py, 0.35);
        head.addColorStop(0, 'rgba(255,255,255,0.95)');
        head.addColorStop(0.4, col(65, 0.8));
        head.addColorStop(1, col(60, 0));
        g.fillStyle = head;
        g.beginPath();
        g.arc(px, py, 0.35, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'slash': {
        g.strokeStyle = col(80, 1 - k);
        g.lineWidth = 0.14 * (1 - k) + 0.03;
        const a0 = f.seed + k * 2.2;
        g.beginPath();
        g.arc(x, y, f.r * (0.6 + k * 0.4), a0, a0 + 1.6);
        g.stroke();
        break;
      }
      case 'burst': {
        g.globalAlpha = 1 - k;
        g.fillStyle = col(60, 0.15);
        g.strokeStyle = col(75, 0.85);
        g.lineWidth = 0.12;
        g.beginPath();
        g.arc(x, y, f.r * (0.3 + 0.7 * Math.sqrt(k)), 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.globalAlpha = 1;
        break;
      }
      case 'impact': {
        g.globalAlpha = 1 - k;
        g.strokeStyle = col(70, 0.9);
        g.lineWidth = 0.25 * (1 - k) + 0.04;
        g.beginPath();
        g.arc(x, y, f.r * (0.2 + k), 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        break;
      }
      case 'shout': {
        g.globalAlpha = 1 - k;
        g.strokeStyle = col(65, 0.8);
        g.lineWidth = 0.1;
        g.beginPath();
        g.arc(x, y, 0.8 + k * f.r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
        break;
      }
      case 'heal':
      case 'buff':
      case 'spark': {
        const n = f.kind === 'heal' ? 6 : 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + f.seed;
          const d = 0.35 + (f.kind === 'buff' ? 0.25 : 0.15 * Math.sin(f.seed + i));
          const px = x + Math.cos(a) * d;
          const py = y + Math.sin(a) * d * 0.6 - k * 1.3;
          g.fillStyle = f.kind === 'heal' ? `rgba(150, 255, 170, ${1 - k})` : col(75, 1 - k);
          if (f.kind === 'heal') {
            g.fillRect(px - 0.04, py - 0.13, 0.08, 0.26);
            g.fillRect(px - 0.13, py - 0.04, 0.26, 0.08);
          } else {
            g.beginPath();
            g.arc(px, py, 0.06, 0, Math.PI * 2);
            g.fill();
          }
        }
        break;
      }
      case 'arc': {
        // A crescent sweep through the swing.
        const dir = f.d ?? 0;
        const half = (f.a ?? 1.5) / 2;
        const sweep = -half + k * half * 2.4;
        g.save();
        g.translate(x, y);
        g.rotate(dir);
        g.globalAlpha = 1 - k * 0.8;
        const grad = g.createRadialGradient(0, 0, f.r * 0.45, 0, 0, f.r);
        grad.addColorStop(0, col(70, 0));
        grad.addColorStop(0.75, col(80, 0.45));
        grad.addColorStop(1, col(92, 0.9));
        g.fillStyle = grad;
        g.beginPath();
        g.arc(0, 0, f.r, -half, Math.min(half, sweep));
        g.arc(0, 0, f.r * 0.55, Math.min(half, sweep), -half, true);
        g.closePath();
        g.fill();
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'thrust': {
        const dir = f.d ?? 0;
        const w = Math.max(0.3, f.a ?? 1);
        g.save();
        g.translate(x, y);
        g.rotate(dir);
        g.globalAlpha = 1 - k;
        const grad = g.createLinearGradient(0, 0, f.r, 0);
        grad.addColorStop(0, col(70, 0));
        grad.addColorStop(0.7, col(80, 0.55));
        grad.addColorStop(1, col(95, 0.95));
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(0.3, -w * 0.25);
        g.lineTo(f.r * (0.6 + k * 0.4), -w * 0.12);
        g.lineTo(f.r * (0.7 + k * 0.4), 0);
        g.lineTo(f.r * (0.6 + k * 0.4), w * 0.12);
        g.lineTo(0.3, w * 0.25);
        g.closePath();
        g.fill();
        g.restore();
        g.globalAlpha = 1;
        break;
      }
      case 'roll': {
        g.fillStyle = `rgba(200, 190, 170, ${0.35 * (1 - k)})`;
        for (let i = 0; i < 4; i++) {
          const a = f.seed + i * 1.7;
          g.beginPath();
          g.arc(f.x + Math.cos(a) * 0.4 * k, f.y + Math.sin(a) * 0.4 * k + 0.2, 0.15 + k * 0.25, 0, Math.PI * 2);
          g.fill();
        }
        break;
      }
      case 'dash': {
        g.strokeStyle = col(80, (1 - k) * 0.7);
        g.lineWidth = 0.4 * (1 - k);
        g.beginPath();
        g.moveTo(f.x, f.y);
        g.lineTo(f.x2, f.y2);
        g.stroke();
        break;
      }
      case 'rift': {
        g.save();
        g.translate(x, y);
        g.rotate(now * 4);
        g.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = col(70 - i * 10, 0.8);
          g.lineWidth = 0.08;
          g.beginPath();
          g.arc(0, 0, f.r * (0.5 + i * 0.25) * (0.4 + k * 0.6), i, i + 4);
          g.stroke();
        }
        g.restore();
        g.globalAlpha = 1;
        break;
      }
    }
  }

  // ── Screen-space text ────────────────────────────────────────────────────────────────────

  private drawOverlayText(view: View, now: number, serverNow: number): void {
    const g = this.g;
    const { world } = view;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    for (const e of world.ents.values()) {
      if (e.removed || (e.diedAt && e.spawn.team === 'enemy')) continue;
      if (e.samples.length === 0 && e.id !== world.meId) continue;
      const s = this.worldToScreen(e.x, e.y);
      if (s.x < -100 || s.y < -100 || s.x > this.w + 100 || s.y > this.h + 100) continue;
      const spriteTop = this.tops.get(e.id);
      const top = spriteTop !== undefined ? this.worldToScreen(e.x, spriteTop).y - 6 : s.y - (e.spawn.radius + 0.55) * this.zoom;
      const isEnemy = e.spawn.team === 'enemy';
      const targeted = view.targetId === e.id;
      const boss = e.spawn.kind === 'boss';
      g.font = `${boss ? 700 : 600} ${boss ? 14 : 11.5}px Inter, system-ui, sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.fillStyle = isEnemy ? (targeted ? '#ffd0c4' : '#ff9e8a') : e.id === world.meId ? '#fff0c8' : '#cfe6ff';
      let label = e.spawn.name;
      if (e.snap.d && !isEnemy) label += ' (KO)';
      const engaged = isEnemy && (e.snap.a !== undefined || e.snap.hp < e.snap.mh);
      const showBar = isEnemy && !boss && (engaged || targeted);
      const nameY = showBar ? top - 6 : top;
      g.strokeText(label, s.x, nameY);
      g.fillText(label, s.x, nameY);
      if (showBar) {
        const w = Math.max(36, e.spawn.radius * this.zoom * 1.8);
        g.fillStyle = 'rgba(0,0,0,0.7)';
        g.fillRect(s.x - w / 2 - 1, top - 2, w + 2, 6);
        g.fillStyle = '#e5573e';
        g.fillRect(s.x - w / 2, top - 1, (w * e.snap.hp) / e.snap.mh, 4);
      }
      if (boss && e.snap.g) {
        // Stagger meter under the boss's name.
        const w = 120;
        const [cur, max] = e.snap.g;
        const staggered = (e.snap.s ?? []).some(([id]) => id === 'staggered');
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillRect(s.x - w / 2 - 1, top + 4, w + 2, 6);
        g.fillStyle = staggered ? `rgba(255, 230, 120, ${0.7 + Math.sin(now * 12) * 0.3})` : '#e8c14a';
        g.fillRect(s.x - w / 2, top + 5, staggered ? w : (w * cur) / max, 4);
      }
      const c = e.snap.c;
      if (c && isEnemy) {
        const p = clamp((serverNow - c[1]) / Math.max(0.01, c[2] - c[1]), 0, 1);
        const w = boss ? 140 : 80;
        const y = s.y + (e.spawn.radius + 0.5) * this.zoom + 10;
        g.fillStyle = 'rgba(0,0,0,0.75)';
        g.fillRect(s.x - w / 2 - 1, y - 1, w + 2, 6);
        g.fillStyle = c[3] ? `rgba(255, 255, 255, ${0.7 + Math.sin(now * 14) * 0.3})` : '#f4cd72';
        g.fillRect(s.x - w / 2, y, w * p, 4);
        g.font = '600 11px Inter, system-ui, sans-serif';
        g.fillStyle = '#ffe3a0';
        g.strokeText(c[0], s.x, y + 17);
        g.fillText(c[0], s.x, y + 17);
      }
    }
    // Floating numbers.
    for (const t of view.fx.texts) {
      const k = (now - t.born) / t.life;
      const s = this.worldToScreen(t.x + t.dx, t.y);
      const rise = 18 + k * 34;
      const pop = k < 0.12 ? 1 + (0.12 - k) * 4 : 1;
      g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      g.font = `800 ${Math.round(t.size * pop)}px Inter, system-ui, sans-serif`;
      g.lineWidth = 3.5;
      g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(t.text, s.x, s.y - rise);
      g.fillStyle = t.color;
      g.fillText(t.text, s.x, s.y - rise);
    }
    g.globalAlpha = 1;
  }
}
