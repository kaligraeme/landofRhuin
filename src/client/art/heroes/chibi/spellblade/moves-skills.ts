/**
 * The Spellblade's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of their own
 * painted through `fx.extra`. Wind-up frames come first; with no server wind-up they take 0.06 s
 * each and the rest share the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special  7  (1 wind-up) Runic Ward: the wand drawn in, then raised high; a ring of gold runes
 *               spins up round her off the floor and closes over her as a dome of light
 *   q        8  (1 wind-up) Spellblade Rush: coiled low, the sword drawn back, then a dash with the
 *               point thrust ahead, violet afterimages and speed lines trailing her and wind
 *               spiralling off the point; a skid to a stop, boots ploughing the floor
 *   e        8  (1 wind-up) Arc Lightning: the wand drawn back by her shoulder, then thrust ahead as
 *               lightning crackles from its crystal, the sword held back low
 *   r       10  (2 wind-up) Lifebinding Sigil: the sword turned point down and touched to the
 *               floor, the wand raised; a green-gold sigil of petals blooms on the ground round her
 *               and motes of light rise from it like petals
 *   ult     14  (4 wind-up, stretched over the server's half second) Astral Cleave: the sword
 *               raised high on her right while the wand pours light into it and a translucent
 *               astral blade grows from its point; then both hands on the hilt, a cleave down and
 *               forward, the astral blade slamming along the floor ahead of her and a rift of
 *               light running on from it
 *   cast     8  (2 wind-up) role skills (Arcane Blink, Mana Font) and the Elixir: the wand raised
 *               with a flourish, a quick spell circle under her and sparkles spiralling up
 *
 * Each starts from the battle stance (`fromReady`) and the clips that give way to it end in it
 * (`settle`), so the sword and wand are where the loop holds them. Raised hands go out beside her
 * head, never across her face, and wands raised overhead are held out (a third `handB` value of
 * 14 to 16) so they clear her hair.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { DUST, DUST_DARK, glowLine, lightning, puff, ward } from '../fx.js';
import { hex } from '../../paint.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, type FxContext, lerp, type P2, pose, rad, type V3 } from '../rig.js';
import { fromReady, READY, settle } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

type Extra = (x: FxContext) => void;

/** Runs several extra painters in turn. */
const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** Fills a screen polygon (convex or not, even-odd) on an effects layer. */
function fill(c: FxContext['c'], q: readonly Vec[], col: RGB, a: number, under = false): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of q) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs: number[] = [];
    const yy = y + 0.5;
    for (let i = 0; i < q.length; i++) {
      const p = q[i] as Vec;
      const r = q[(i + 1) % q.length] as Vec;
      if ((p[1] <= yy && r[1] > yy) || (r[1] <= yy && p[1] > yy)) xs.push(p[0] + ((yy - p[1]) / (r[1] - p[1])) * (r[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.ceil((xs[j] as number) - 0.5); x <= Math.floor((xs[j + 1] as number) - 0.5); x++) c.glow(x, y, col, clamp(a, 0, 1), under);
  }
}

/** The ward's colours: pale gold runes and bands with a violet fringe. */
const WARD_AURA = { core: hex('#f4d888'), edge: hex('#b98cff'), hot: hex('#fffbea') };

/** The ward (fx.ts `ward`) in gold and violet rather than her aura's colours. */
const goldWard =
  (k: number, spin: number, dome = false): Extra =>
  (x) =>
    ward({ ...x, aura: WARD_AURA }, k, { radius: 22, height: 22, spin, runes: 8, dome });

/** Healing light: a soft green-gold, warm at its heart. */
const LIFE = { core: hex('#b4ec7c'), edge: hex('#f2dc84'), hot: hex('#f6fff0') };

/**
 * The Lifebinding Sigil on the floor round her, `k` from 0 (a spark) to 1 (in full bloom): an outer
 * ring and an inner one, six petals between them turning slowly (`spin` degrees) and a small
 * ring of ticks, all green-gold. It lies on the floor, so it shows round her feet and not over her.
 */
const sigil =
  (k: number, spin = 0): Extra =>
  (x) => {
    const { c, rig } = x;
    if (k <= 0) return;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const ease = k * k * (3 - 2 * k);
    const R = 8 + 22 * ease;
    const at = (a: number, r: number): Vec => x.proj([g[0] + Math.cos(a) * r, 0, g[2] + Math.sin(a) * r]);
    const ring = (r: number, col: RGB, a: number): void => {
      const n = Math.ceil(r * 7);
      for (let i = 0; i < n; i++) {
        const p = at((i / n) * Math.PI * 2, r);
        c.glow(p[0], p[1], col, a, true);
      }
    };
    ring(R, LIFE.core, 0.95 * k);
    ring(R + 1, LIFE.edge, 0.45 * k);
    ring(R * 0.42, LIFE.edge, 0.8 * k);
    // Petals: pointed loops from the inner ring out to the outer one.
    for (let i = 0; i < 6; i++) {
      const a0 = rad(spin + i * 60);
      const n = 18;
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const r = lerp(R * 0.42, R * 0.96, Math.sin((Math.PI * t) / 2));
        const w = Math.sin(Math.PI * t) * 0.32;
        for (const side of [-1, 1]) {
          const p = at(a0 + side * w, r);
          c.glow(p[0], p[1], s > n - 3 ? LIFE.hot : LIFE.core, 0.9 * k, true);
        }
      }
    }
    // A faint wash of light inside it.
    const p0 = x.proj(g);
    for (let y = -Math.ceil(R * 0.42); y <= Math.ceil(R * 0.42); y++) for (let xx = -Math.ceil(R); xx <= Math.ceil(R); xx++) if ((xx / R) ** 2 + (y / (R * 0.4)) ** 2 < 0.92) c.glow(p0[0] + xx, p0[1] + y, LIFE.core, 0.14 * k, true);
  };

/**
 * Motes of healing light rising off the sigil like loosed petals, `t` how far they have risen
 * (each takes its own path and rate) and `k` their strength: a bright head and a short fading tail,
 * swaying as they climb. Those behind her pass behind her.
 */
const petals =
  (t: number, k: number): Extra =>
  (x) => {
    const { c, rig, hash } = x;
    for (let i = 0; i < 12; i++) {
      const th = hash(i, 201) * Math.PI * 2;
      const r = 10 + hash(i, 202) * 16;
      const rise = ((t * (0.8 + hash(i, 203) * 0.6) + hash(i, 204)) % 1) * 60;
      const sway = Math.sin(rise * 0.15 + i) * 2;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * r + sway, 2 + rise, rig.pelvis.o[2] + Math.sin(th) * r];
      const fade = k * Math.sin(Math.PI * Math.min(1, rise / 60));
      const under = x.behind(p3);
      const p = x.proj(p3);
      c.glow(p[0], p[1], LIFE.hot, fade, under);
      c.glow(p[0] + 1, p[1], LIFE.core, fade * 0.8, under);
      c.glow(p[0], p[1] + 1, LIFE.core, fade * 0.7, under);
      c.glow(p[0], p[1] + 2, LIFE.edge, fade * 0.4, under);
    }
  };

/** Sparkles spiralling up round her (the cast), `t` how far up they have climbed, `k` their strength. */
const sparkles =
  (t: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, hash } = x;
    for (let i = 0; i < 10; i++) {
      const th = hash(i, 301) * Math.PI * 2 + t * 4;
      const r = 14 + hash(i, 302) * 8;
      const h = (hash(i, 303) * 30 + t * 50) % 70;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * r, 4 + h, rig.pelvis.o[2] + Math.sin(th) * r];
      const under = x.behind(p3);
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * (h / 70));
      // A tiny four-point star.
      c.glow(p[0], p[1], aura.hot, a, under);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(p[0] + dx, p[1] + dy, i % 3 ? aura.core : aura.edge, a * 0.7, under);
    }
  };

/**
 * The astral blade: a great translucent blade of violet light grown from the sword's point along
 * its line, `len` pixels past the tip at full growth, `k` its strength; a white-hot spine, the
 * aura's violet body and a pale cyan rim, tapering to a point, with a glow sheathing the sword.
 * It is drawn on screen along the sword's line, so it reads in every view.
 */
const astral =
  (len: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, tip } = x;
    if (k <= 0 || len <= 0) return;
    const w = rig.weapon;
    const A = x.proj(add3(w.o, w.u, 8));
    const B = x.proj(tip);
    let dx = B[0] - A[0];
    let dy = B[1] - A[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const nx = -dy;
    const ny = dx;
    const end: Vec = [B[0] + dx * len, B[1] + dy * len];
    // Half-width along it: as broad as a greatsword where it leaves the sword, then a long taper.
    const W = 4.5 + len * 0.04;
    const pts = (scale: number): Vec[] => [
      [A[0] + nx * 2 * scale, A[1] + ny * 2 * scale],
      [B[0] + nx * W * scale, B[1] + ny * W * scale],
      [B[0] + dx * len * 0.72 + nx * W * 0.8 * scale, B[1] + dy * len * 0.72 + ny * W * 0.8 * scale],
      [end[0] + dx * 2 * scale, end[1] + dy * 2 * scale],
      [B[0] + dx * len * 0.72 - nx * W * 0.8 * scale, B[1] + dy * len * 0.72 - ny * W * 0.8 * scale],
      [B[0] - nx * W * scale, B[1] - ny * W * scale],
      [A[0] - nx * 2 * scale, A[1] - ny * 2 * scale],
    ];
    const under = x.behind(add3(tip, w.u, len * 0.5));
    fill(c, pts(1.25), aura.edge, 0.35 * k, under);
    fill(c, pts(1), aura.core, 0.45 * k, under);
    fill(c, pts(0.45), mixc(aura.core, aura.hot, 0.6), 0.6 * k, under);
    glowLine(c, A, end, aura.hot, 0.9 * k, under);
  };

/**
 * The astral blade's great swoosh: a broad crescent swept about the grip by a blade `reach`
 * pixels long, from the sword's angle `from` to the pose's own (as a smear's are given, in the
 * same roll and yaw), white-hot along its outer edge and violet within, fading toward its tail.
 */
const greatArc =
  (from: number, reach: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, cam } = x;
    const w = rig.weapon;
    const p = rig.pose;
    const to = p.weapon;
    const roll = rad(p.roll ?? 0);
    const yaw = rad(p.yaw ?? 0);
    // The swing's plane from its roll and yaw, as weaponAxes builds a weapon's direction.
    const dir = (deg: number): V3 => {
      const th = rad(deg);
      const f0 = Math.sin(th);
      const u0 = Math.cos(th);
      const u1 = u0 * Math.cos(roll);
      const r1 = u0 * Math.sin(roll);
      return [f0 * Math.cos(yaw) - r1 * Math.sin(yaw), u1, f0 * Math.sin(yaw) + r1 * Math.cos(yaw)];
    };
    const n = Math.max(4, Math.ceil(Math.abs(to - from) / 5));
    const bands: [number, number, RGB, number][] = [
      [0, 0.1, aura.hot, 1],
      [0.1, 0.3, mixc(aura.hot, aura.core, 0.5), 0.9],
      [0.3, 0.75, aura.core, 0.7],
      [0.75, 1, aura.edge, 0.3],
    ];
    const at = (deg: number, r: number): Vec => {
      const q = add3(w.o, dir(deg), r);
      return x.proj(q[1] < 0.5 ? [q[0], 0.5, q[2]] : q);
    };
    const under = cam.view === 'back';
    for (let i = 0; i < n; i++) {
      const a0 = lerp(from, to, i / n);
      const a1 = lerp(from, to, (i + 1) / n);
      const fade = 0.25 + 0.75 * ((i + 1) / n);
      const th = reach * 0.55 * Math.sin(((i + 1) / n) * (Math.PI / 2));
      for (const [f0, f1, col, a] of bands) fill(c, [at(a0, reach - f0 * th), at(a1, reach - f0 * th), at(a1, reach - f1 * th), at(a0, reach - f1 * th)], col, a * k * fade, under);
    }
  };

/**
 * A rift of light running along the floor ahead of her where the astral blade struck, along the
 * way the sword points: `k` how far it has run (0 to 1) and `a` its strength. A jagged crack of
 * white-hot light three pixels wide with a violet glow either side, and shards of light thrown up
 * along it.
 */
const rift =
  (k: number, a: number): Extra =>
  (x) => {
    const { c, rig, aura, hash } = x;
    const u = rig.weapon.u;
    const hl = Math.hypot(u[0], u[2]) || 1;
    const d: V3 = [u[0] / hl, 0, u[2] / hl];
    const side: V3 = [-d[2], 0, d[0]];
    const o = rig.pelvis.o;
    const len = 30 + 90 * k;
    let prev: Vec | null = null;
    for (let s = 0; s <= 30; s++) {
      const t = s / 30;
      const along = 16 + len * t;
      const off = (hash(s, 401) - 0.5) * 3.5;
      const p = x.proj([o[0] + d[0] * along + side[0] * off, 0, o[2] + d[2] * along + side[2] * off]);
      if (prev) {
        const fade = a * (1 - t * 0.55);
        glowLine(c, [prev[0], prev[1] - 2], [p[0], p[1] - 2], aura.edge, fade * 0.35, false);
        glowLine(c, [prev[0], prev[1] - 1], [p[0], p[1] - 1], aura.core, fade * 0.85, false);
        glowLine(c, prev, p, aura.hot, fade, false);
        glowLine(c, [prev[0], prev[1] + 1], [p[0], p[1] + 1], aura.core, fade * 0.85, false);
        glowLine(c, [prev[0], prev[1] + 2], [p[0], p[1] + 2], aura.edge, fade * 0.35, false);
      }
      prev = p;
      if (s % 3 === 1) {
        // A shard of light standing up off the crack.
        const h = (3 + hash(s, 402) * 9) * a * (1 - t * 0.5);
        const base = x.proj([o[0] + d[0] * along, 0, o[2] + d[2] * along]);
        const top = x.proj([o[0] + d[0] * along, h, o[2] + d[2] * along]);
        glowLine(c, base, top, aura.core, a * 0.8, false);
        c.glow(top[0], top[1], aura.hot, a);
      }
    }
  };

/** Light poured from the wand's crystal into the sword: a thin crackling arc between them (`seed` reshapes it). */
const pour =
  (seed: number, a = 0.7): Extra =>
  (x) =>
    lightning(x, x.tipB, add3(x.rig.weapon.o, x.rig.weapon.u, 22), { seed, forks: 1, alpha: a, jag: 0.25 });

/** A skid (strength k): furrows ploughed behind her boots, and a bank of dust and grit thrown up ahead of them. */
const skid =
  (k: number): Extra =>
  (x) => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 18 * k, 0, g[2]]);
      glowLine(x.c, a, b, [70, 60, 66], 0.8 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.5 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3 - i * 0.6) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.55 * k);
      }
      for (let i = 0; i < 6; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 12 * k, hash(i, s + 81) * 9 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        x.c.glow(p[0], p[1], i % 2 ? DUST : DUST_DARK, 0.9 * k);
      }
    }
  };

// ── Runic Ward ───────────────────────────────────────────────────────────────────────────────

/** The wand raised high out to her left (clear of her hair), the sword lowered point down and forward at her right. */
const WARD_UP: ChibiPose = pose(S, { x: 0, y: 3, lean: -2, twist: 6, head: -6, look: 2, footF: [7, 0, 5], footB: [-7, 0, 4.6], handF: [5, 13, 9], weapon: 150, roll: 10, yaw: 10, handB: [-2, -7, 15], weaponB: -10, rollB: 18, yawB: 0, face: 'closed', wind: 0.25, lift: 0.25 });

const runicWard: ChibiPose[] = [
  // Wind-up: the wand drawn in to her chest, its crystal gathering light, the sword lowering.
  fromReady(pose(S, { y: 5, lean: 6, twist: 4, head: 3, look: 0, handF: [6, 13, 9], weapon: 120, roll: 14, yaw: 0, handB: [6, 5, 3], weaponB: 10, rollB: 0, yawB: 0, face: 'closed', fx: { runeB: 0.8, aura: 0.2 } }), 0.6),
  // The wand thrown up high: a flash at its crystal, the runes rising off the floor.
  pose(WARD_UP, { phase: 0.1, fx: { runeB: 1, impactB: 0.7, aura: 0.4, extra: goldWard(0.25, 0) } }),
  pose(WARD_UP, { y: 2.5, head: -7, lift: 0.32, phase: 0.25, fx: { runeB: 1, aura: 0.5, extra: goldWard(0.6, 30) } }),
  pose(WARD_UP, { y: 2.5, head: -7, lift: 0.35, phase: 0.4, face: 'stern', fx: { runeB: 1, aura: 0.45, extra: goldWard(0.9, 62) } }),
  // The ring closes over her: a dome of light, the barrier.
  pose(WARD_UP, { y: 3, head: -5, handB: [0, -5, 14], lift: 0.3, phase: 0.55, face: 'stern', fx: { runeB: 0.8, aura: 0.3, extra: both(goldWard(0.7, 90), goldWard(1, 10, true)) } }),
  // Back into her guard, the dome fading round her.
  settle(pose(WARD_UP, { handB: [4, 4, 10], weaponB: 60, handF: [8, 11, 9], weapon: 70 }), 0.5, { lift: 0.3, phase: 0.7, face: 'stern', fx: { runeB: 0.5, extra: goldWard(0.55, 20, true) } }),
  settle(S, 0.9, { phase: 0.85, fx: { runeB: 0.35, extra: goldWard(0.2, 30, true) } }),
];

// ── Spellblade Rush ──────────────────────────────────────────────────────────────────────────

/**
 * The dash: low and long, the point thrust ahead and a little down in her right hand, tipped out to
 * her right so that toward and away from the viewer it shows beside her; the wand trailing back.
 */
const DASH: ChibiPose = pose(S, { x: 8, y: 5, lean: 30, twist: -14, head: -14, look: -4, handF: [15, 10, 8], weapon: 102, roll: -30, yaw: 4, handB: [-8, 12, 10], weaponB: 215, rollB: 10, yawB: 0, face: 'grit', wind: 1.1, lift: 0.1 });

const rush: ChibiPose[] = [
  // Coiled low, the sword drawn back to her hip, point forward, the wand forward to balance.
  fromReady(pose(S, { x: -3, y: 9, lean: 20, twist: 18, head: -2, footF: [9, 0, 4.8], footB: [-12, 0, 4.4], handF: [-3, 15, 9], weapon: 88, roll: 0, yaw: 0, handB: [9, 9, 6], weaponB: 70, rollB: 0, yawB: 20, face: 'grit', wind: 0.3, fx: { rune: 0.7, aura: 0.5, dust: 0.4 } }), 0.6),
  // Launch: the back leg drives off, the point shoots forward.
  pose(DASH, { x: 5, y: 5, footF: [14, -6, 4.6], footB: [-15, 0, 4.4], phase: 0.1, fx: { rune: 1, aura: 0.8, dust: 1, speed: 0.8, ghosts: { k: 0.6 } } }),
  // The dash: long, light strides, barely touching the floor.
  pose(DASH, { y: 1, footF: [20, -4, 4.6], footB: [-13, -9, 4.4], phase: 0.3, fx: { rune: 1, aura: 0.8, speed: 1, ghosts: { k: 1, n: 3 }, swirl: { k: 0.9, spin: 0.1 } } }),
  pose(DASH, { y: 5, footF: [7, 0, 4.6], footB: [12, -11, 4.4], phase: 0.5, fx: { rune: 1, aura: 0.8, speed: 1, dust: 0.6, ghosts: { k: 1, n: 3 }, swirl: { k: 1, spin: 0.35 } } }),
  pose(DASH, { y: 1, footF: [-13, -9, 4.6], footB: [20, -4, 4.4], phase: 0.7, fx: { rune: 1, aura: 0.7, speed: 1, ghosts: { k: 0.9, n: 3 }, swirl: { k: 0.8, spin: 0.6 } } }),
  // The skid: the lead leg braced out ahead, heel dug in, the body thrown back, the sword swept out to her side.
  pose(S, { x: 10, y: 10, lean: -6, twist: 14, head: -2, look: -4, footF: [24, 0, 5], footB: [3, 0, 4.6], handF: [6, 10, 14], weapon: 100, roll: 0, yaw: 80, handB: [6, 9, 6], weaponB: 120, rollB: 0, yawB: 40, face: 'grit', wind: 0, lift: 0.45, sway: 0.4, phase: 0.85, fx: { rune: 0.6, aura: 0.4, dust: 1, ghosts: { k: 0.3 }, extra: skid(1) } }),
  pose(S, { x: 8, y: 7, lean: 6, twist: 2, head: 1, footF: [18, 0, 5], footB: [-4, 0, 4.6], handF: [8, 11, 10], weapon: 70, roll: 24, yaw: 10, handB: [6, 10, 7], weaponB: 105, rollB: -10, yawB: 45, face: 'stern', wind: 0.15, lift: 0.2, phase: 1, fx: { rune: 0.3, dust: 0.4, extra: skid(0.4) } }),
  settle(pose(S, { x: 3, y: 5, lean: 10 }), 0.8, { phase: 1.1 }),
];

// ── Arc Lightning ────────────────────────────────────────────────────────────────────────────

/** The wand thrust out ahead at shoulder height, a little out to her left; the sword held back low. */
const BOLT: ChibiPose = pose(S, { x: 3, y: 6, lean: 12, twist: 24, head: 0, look: -8, footF: [12, 0, 5], footB: [-10, 0, 4.6], handF: [-5, 14, 10], weapon: -128, roll: 8, yaw: -20, handB: [15, 3, 4], weaponB: 86, rollB: 0, yawB: 10, face: 'shout', wind: 0.55 });

const arc: ChibiPose[] = [
  // Wind-up: the wand drawn back by her left shoulder, crackling, the sword swung back.
  fromReady(pose(S, { x: -2, y: 5, lean: 2, twist: -14, head: 2, look: 2, footF: [10, 0, 5], footB: [-10, 0, 4.6], handF: [2, 13, 10], weapon: 160, roll: 10, yaw: -10, handB: [-3, 2, 11], weaponB: 20, rollB: 30, yawB: 0, face: 'grit', wind: 0.3, fx: { runeB: 1, aura: 0.3, lightning: { from: 'off', dir: [0, 1, -0.4], len: 8, seed: 1, forks: 1, alpha: 0.6 } } }), 0.6),
  // Thrust: the bolt leaves the crystal.
  pose(BOLT, { phase: 0.1, fx: { runeB: 1, impactB: 0.6, aura: 0.4, lightning: { seed: 2, len: 64 } } }),
  pose(BOLT, { x: 4, lean: 13, phase: 0.25, fx: { runeB: 1, aura: 0.4, lightning: { seed: 3, len: 72 } } }),
  pose(BOLT, { x: 4, lean: 13, phase: 0.4, wind: 0.5, fx: { runeB: 1, aura: 0.3, lightning: { seed: 4, len: 72, alpha: 0.85 } } }),
  pose(BOLT, { x: 3, lean: 12, phase: 0.55, wind: 0.45, face: 'grit', fx: { runeB: 0.8, lightning: { seed: 5, len: 60, forks: 2, alpha: 0.55 } } }),
  // The last crackle off the crystal as she draws back.
  pose(BOLT, { x: 2, lean: 10, twist: 16, handB: [12, 5, 5], weaponB: 80, phase: 0.7, wind: 0.35, face: 'stern', fx: { runeB: 0.5, lightning: { seed: 6, len: 16, forks: 1, alpha: 0.4 } } }),
  settle(pose(BOLT, { handB: [10, 8, 7], weaponB: 95, handF: [4, 12, 10], weapon: 120 }), 0.55, { phase: 0.85, face: 'stern', fx: { runeB: 0.35 } }),
  settle(BOLT, 0.9, { phase: 1, fx: { runeB: 0.3 } }),
];

// ── Lifebinding Sigil ────────────────────────────────────────────────────────────────────────

/** Feet planted for the sigil. */
const PLANT = { footF: [8, 0, 6] as P2, footB: [-8, 0, 5.6] as P2 };

/** The sword point down before her, its point touched to the floor; the wand raised high out to her left. */
const BLOOM: ChibiPose = pose(S, { x: 0, y: 4, lean: 2, twist: 6, head: -4, look: 0, ...PLANT, handF: [8, 15, 5], weapon: 176, roll: 0, yaw: 0, handB: [-1, -7, 15], weaponB: -8, rollB: 16, yawB: 0, face: 'closed', wind: 0.15, lift: 0.2 });

const bloom = (k: number, t: number, phase: number): ChibiPose => pose(BLOOM, { phase, lift: 0.18 + k * 0.12, fx: { runeB: 1, rune: 0.6, extra: both(sigil(k, t * 40), petals(t, k)) } });

const lifebinding: ChibiPose[] = [
  // Wind-up: the sword turned point down, the wand drawn up to her chest, a green glow gathering.
  fromReady(pose(S, { y: 5, lean: 8, twist: 4, head: 2, ...PLANT, handF: [7, 10, 7], weapon: 200, roll: 0, yaw: 0, handB: [6, 6, 4], weaponB: 20, rollB: 0, yawB: 0, face: 'grit', fx: { runeB: 0.6 } }), 0.6),
  pose(S, { y: 6, lean: 6, twist: 6, head: 1, ...PLANT, handF: [7, 12, 6], weapon: 178, roll: 0, yaw: 0, handB: [2, 0, 10], weaponB: 5, rollB: 10, yawB: 0, face: 'closed', lift: 0.15, fx: { runeB: 0.9, extra: sigil(0.12) } }),
  // The point touches the floor; the sigil blooms out from it.
  pose(BLOOM, { y: 5, phase: 0.1, fx: { runeB: 1, rune: 0.8, impact: 0.5, impactAt: [8, 1, 4], extra: both(sigil(0.3), petals(0, 0.4)) } }),
  bloom(0.55, 0.1, 0.2),
  bloom(0.8, 0.2, 0.3),
  bloom(1, 0.3, 0.4),
  bloom(1, 0.4, 0.5),
  bloom(0.95, 0.5, 0.6),
  // The light settles; she comes back up into her guard.
  settle(pose(BLOOM, { handB: [3, 4, 11], weaponB: 50, handF: [8, 12, 8], weapon: 110 }), 0.45, { phase: 0.75, face: 'stern', fx: { runeB: 0.5, extra: both(sigil(0.6, 25), petals(0.6, 0.5)) } }),
  settle(S, 0.9, { phase: 0.9, fx: { runeB: 0.3, extra: sigil(0.25, 28) } }),
];

// ── Astral Cleave ────────────────────────────────────────────────────────────────────────────

/** The sword raised high out to her right, tip up and a little back; the wand turned to it, pouring light into the blade. */
const RAISE: ChibiPose = pose(S, { x: -1, y: 4, lean: -6, twist: 10, head: -8, look: 4, footF: [9, 0, 5.4], footB: [-10, 0, 5], handF: [-5, -8, 13], weapon: -12, roll: 22, yaw: -6, handB: [8, 2, 2], weaponB: 30, rollB: -30, yawB: -30, face: 'grit', wind: 0.3, lift: 0.5 });

/** The cleave lands: both hands on the hilt, low and forward, the astral blade slammed along the floor ahead. */
const CLEAVE: ChibiPose = pose(S, { x: 8, y: 11, lean: 30, twist: 6, head: 6, look: -2, footF: [17, 0, 5.6], footB: [-12, 0, 5], handF: [15, 13, 5], handB: undefined, grip: 0, weapon: 100, roll: 10, yaw: 22, weaponB: 200, rollB: 20, yawB: 0, face: 'shout', wind: 0.85, lift: -0.1 });

const astralCleave: ChibiPose[] = [
  // Wind-up over the server's half second: the sword swept up high on her right...
  fromReady(pose(RAISE, { y: 6, lean: 2, handF: [2, 2, 13], weapon: 20, handB: [7, 7, 4], weaponB: 40, face: 'grit', fx: { rune: 0.8, runeB: 0.8, aura: 0.3 } }), 0.6),
  // ...the wand pours light into it and the astral blade grows from its point...
  pose(RAISE, { phase: 0.1, fx: { rune: 1, runeB: 1, aura: 0.5, extra: both(pour(1), astral(18, 0.7)) } }),
  pose(RAISE, { y: 5, lean: -8, head: -9, phase: 0.2, lift: 0.6, fx: { rune: 1, runeB: 1, aura: 0.7, extra: both(pour(2), astral(40, 0.85)) } }),
  pose(RAISE, { y: 6, lean: -10, twist: 14, head: -10, handF: [-6, -7, 13], weapon: -24, phase: 0.3, lift: 0.7, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, extra: both(pour(3, 0.5), astral(58, 1)) } }),
  // The cleave: down through the front of her, both hands on the hilt...
  pose(CLEAVE, { x: 4, y: 6, lean: 14, handF: [13, 2, 6], weapon: 40, wind: 0.6, phase: 0.4, fx: { rune: 1, aura: 1, extra: both(greatArc(-24, 96, 0.9), astral(56, 1)) } }),
  // ...and slammed along the floor ahead: the rift runs on from it.
  pose(CLEAVE, { phase: 0.5, fx: { rune: 1, aura: 0.9, impact: 1.4, dust: 1, extra: both(greatArc(-24, 96, 0.7), astral(54, 1), rift(0.1, 1)) } }),
  pose(CLEAVE, { y: 11.5, lean: 31, phase: 0.6, wind: 0.7, face: 'grit', fx: { rune: 1, aura: 0.7, dust: 0.8, extra: both(astral(50, 0.7), rift(0.4, 1)) } }),
  pose(CLEAVE, { y: 11, lean: 30, phase: 0.7, wind: 0.5, face: 'grit', fx: { rune: 0.9, aura: 0.5, dust: 0.5, extra: both(astral(40, 0.45), rift(0.7, 0.85)) } }),
  pose(CLEAVE, { y: 10.5, lean: 28, phase: 0.8, wind: 0.35, fx: { rune: 0.8, aura: 0.3, dust: 0.3, extra: both(astral(26, 0.25), rift(1, 0.6)) } }),
  pose(CLEAVE, { y: 10, lean: 26, phase: 0.9, wind: 0.25, lift: 0.1, face: 'stern', fx: { rune: 0.6, extra: rift(1, 0.35) } }),
  // Rising out of it, the wand hand letting go of the hilt.
  pose(CLEAVE, { x: 6, y: 8, lean: 20, head: 3, handF: [13, 12, 5], handB: [6, 11, 8], weaponB: 120, rollB: 0, weapon: 96, phase: 1, wind: 0.2, lift: 0.2, face: 'stern', fx: { rune: 0.5, extra: rift(1, 0.15) } }),
  settle(pose(CLEAVE, { x: 4, y: 6, lean: 14, handF: [11, 11, 7], handB: [6, 10, 8], weaponB: 105, weapon: 80, roll: 20 }), 0.4, { phase: 1.1, face: 'stern', fx: { rune: 0.4 } }),
  settle(pose(CLEAVE, { x: 2, y: 5, lean: 12, handF: [10, 11, 8], handB: [6, 10, 8], weaponB: 100, weapon: 60, roll: 30 }), 0.7, { phase: 1.2, fx: { rune: 0.3 } }),
  settle(S, 0.95, { phase: 1.3 }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** The wand raised with a flourish high out to her left, the sword lowered at her right. */
const FLOURISH: ChibiPose = pose(S, { x: 0, y: 3, lean: -3, twist: 8, head: -5, look: 4, footF: [6, 0, 5], footB: [-7, 0, 4.6], handF: [5, 13, 9], weapon: 140, roll: 12, yaw: 14, handB: [-1, -7, 15], weaponB: -14, rollB: 20, yawB: 0, face: 'stern', wind: 0.25, lift: 0.45 });

const cast: ChibiPose[] = [
  // Wind-up: the wand twirled in close, the sword lowering.
  fromReady(pose(S, { y: 5, lean: 6, twist: 0, head: 2, handF: [6, 12, 9], weapon: 120, roll: 14, yaw: 0, handB: [7, 6, 4], weaponB: 170, rollB: 0, yawB: 20, face: 'closed', fx: { runeB: 0.6, smearB: { from: 70, alpha: 0.5 } } }), 0.6),
  pose(S, { y: 6, lean: 4, twist: 4, head: 1, handF: [6, 13, 9], weapon: 130, roll: 14, yaw: 6, handB: [4, 0, 9], weaponB: 290, rollB: 10, yawB: 0, face: 'closed', lift: 0.2, fx: { runeB: 0.9, circle: 0.3, smearB: { from: 170, alpha: 0.6 } } }),
  // Up with a flourish: a flash at the crystal, the circle under her, sparkles spiralling up.
  pose(FLOURISH, { phase: 0.1, fx: { runeB: 1, impactB: 0.8, aura: 0.6, circle: 1, smearB: { from: 290 - 360, alpha: 0.7 }, extra: sparkles(0, 1) } }),
  pose(FLOURISH, { y: 2.5, head: -6, lift: 0.55, phase: 0.25, face: 'smirk', fx: { runeB: 1, aura: 0.8, circle: 1, extra: sparkles(0.2, 1) } }),
  pose(FLOURISH, { y: 2.5, head: -6, lift: 0.5, phase: 0.4, face: 'smirk', fx: { runeB: 1, aura: 0.6, circle: 0.9, extra: sparkles(0.4, 0.9) } }),
  pose(FLOURISH, { y: 3, head: -4, handB: [1, -4, 14], lift: 0.4, phase: 0.55, fx: { runeB: 0.8, aura: 0.35, circle: 0.7, extra: sparkles(0.6, 0.7) } }),
  settle(pose(FLOURISH, { handB: [5, 5, 10], weaponB: 60, handF: [8, 11, 9], weapon: 70 }), 0.5, { lift: 0.25, phase: 0.7, fx: { runeB: 0.5, circle: 0.4, extra: sparkles(0.8, 0.4) } }),
  settle(S, 0.92, { phase: 0.85, fx: { runeB: 0.35, circle: 0.12 } }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special: runicWard, q: rush, e: arc, r: lifebinding, ult: astralCleave, cast };
