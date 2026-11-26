/**
 * The Dark Knight's skills, in the chibi pose format (rig.ts, ChibiPose), with a few effects of
 * their own painted through `fx.extra`. Wind-up frames come first; with no server wind-up they
 * take 0.06 s each and the rest share the clip's seconds.
 *
 *   cast       8  (2 wind-up) role skills (Challenge's roar, Rallying Bulwark): sink and gather,
 *                 then the blade thrown up high out to his right (clear of his face in every
 *                 view), the off fist flung out, a roar rolling off him, an aura burst across a
 *                 rune circle
 *   charge     8  (1 wind-up) Stalwart Charge: a coiled crouch, an explosive shoulder-first dash
 *                 in bounding strides, the blade low and forward, crimson afterimages trailing
 *                 him (streaks bursting round him toward or away from the viewer), then a
 *                 skidding braced stop with the blade's point scraping sparks off the floor
 *   eclipse   10  (1 wind-up) Eclipse: coiled to his left, then a full turn with the blade held
 *                 out level and a ring of steel growing round him, a slowing shockwave at the end
 *   drain     10  (2 wind-up) Drain: the blade plunged into the ground beside him, a shockwave
 *                 rolling out all round, then wisps and motes of stolen life drawn in from all
 *                 around and up the blade into him as his body glows
 *   ruination 16  (2 wind-up) Ruination: a mist of blood, a leap about 40 px high with the blade
 *                 blazing, then four blows as he falls, each sending a shockwave over the ground
 *                 ahead; the blows land on frames 4, 7 and 10 and the ground slam on 13 (they
 *                 show from 0.33, 0.66, 0.98 and 1.30 s; the server lands them at 0.4, 0.7, 1.0
 *                 and 1.3 s)
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { GUARD_STANCE, settle } from './moves-core.js';
import { add3, at3, type ChibiPose, clamp, type FxContext, lerp, type P2, pose, rad, rotate, SIDE_LOOK, type V3 } from './rig.js';

const S = GUARD_STANCE;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

type Extra = (x: FxContext) => void;

/** Runs several extra painters in turn. */
const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** A one-pixel line on an effects layer. */
function line(x: FxContext, a: Vec, b: Vec, col: RGB, alpha: number, under = false): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) x.c.glow(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, col, alpha, under);
}

/**
 * A roar: arcs of crimson force rolling off his face, `k` from 0 (just let out) to 1 (spread out).
 * Side on they open ahead of his face; toward or away from the viewer they crown his head.
 */
const roar =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura } = x;
    const head = cam.view === 'side' ? rotate(rig.head, 0, 0, SIDE_LOOK) : rig.head;
    const fwd = cam.vec(head.f);
    // How side on the face is: 0 facing the viewer or away, 1 in profile.
    const prof = clamp(Math.abs(fwd[0]) / 0.75, 0, 1);
    const centre = x.proj(at3(head, 3 * prof, -2, 0));
    const mid = lerp(-90, fwd[0] >= 0 ? -8 : -172, prof);
    const half = lerp(112, 48, prof);
    for (let i = 0; i < 3; i++) {
      const R = 19 + i * 7 + k * 13;
      const fade = (1 - k * 0.5) * (1 - i * 0.24);
      const n = Math.ceil(R * rad(half) * 2.2);
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const th = rad(mid - half + 2 * half * t);
        const env = Math.pow(Math.sin(Math.PI * t), 0.7);
        const ring: [number, RGB, number][] = [
          [0, aura.hot, 0.95],
          [1, aura.core, 0.85],
          [2, aura.edge, 0.4],
        ];
        for (const [dr, col, al] of ring) c.glow(centre[0] + Math.cos(th) * (R + dr), centre[1] + Math.sin(th) * (R + dr) * 0.88, col, al * fade * env);
      }
    }
  };

/** The farther of a charge's afterimages. */
const GHOST_FAR: RGB = [118, 14, 36];

/**
 * The rush of a charge (strength k). Side on, crimson afterimages of him trail behind (copies of
 * his silhouette, under the figure); toward or away from the viewer, streaks burst out all round him.
 */
const rush =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura, hash } = x;
    const C = x.proj(at3(rig.chest, 2, 14, 0));
    const fv = cam.vec([1, 0, 0]);
    if (Math.abs(fv[0]) > 0.4) {
      const dir = fv[0] >= 0 ? 1 : -1;
      // The far ghost a deep blood red, the near one the aura's crimson: violet stays a faint edge.
      const ghosts: [number, RGB, number][] = [
        [20, GHOST_FAR, 0.4],
        [10, aura.core, 0.5],
      ];
      for (let y = 0; y < c.h; y++) {
        for (let xx = 0; xx < c.w; xx++) {
          if (!c.opaque(xx, y)) continue;
          for (const [off, col, a] of ghosts) c.glow(xx - dir * Math.round(off * k), y, col, a * k, true);
        }
      }
    } else {
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2 + hash(i, 71) * 0.3;
        const r0 = 21 + hash(i, 72) * 7;
        const r1 = r0 + (7 + hash(i, 73) * 9) * k;
        const a: Vec = [C[0] + Math.cos(th) * r0, C[1] + 6 + Math.sin(th) * r0 * 1.15];
        const b: Vec = [C[0] + Math.cos(th) * r1, C[1] + 6 + Math.sin(th) * r1 * 1.15];
        line(x, a, b, i % 2 ? aura.core : aura.hot, 0.8 * k, true);
        line(x, [a[0] + 1, a[1]], [b[0] + 1, b[1]], aura.edge, 0.35 * k, true);
      }
    }
  };

/** A soft round puff of dust on an effects layer. */
function puff(x: FxContext, cx: number, cy: number, r: number, col: RGB, a: number, under = false): void {
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r * 1.3); dx <= Math.ceil(r * 1.3); dx++) {
      const d = Math.hypot(dx / 1.3, dy) / Math.max(0.5, r);
      if (d <= 1) x.c.glow(cx + dx, cy + dy, col, a * (d < 0.6 ? 1 : 0.6), under);
    }
  }
}

const DUST: RGB = [196, 182, 160];
const DUST_DARK: RGB = [120, 108, 92];
const FURROW: RGB = [62, 52, 48];

/**
 * A skid (strength k): furrows ploughed behind his boots, a bank of dust and grit thrown up ahead
 * of them, and sparks where the blade's point scrapes the floor (if it does).
 */
const skid =
  (k: number): Extra =>
  (x) => {
    const { rig, hash } = x;
    const w = rig.weapon;
    if (w.u[1] < -0.2 && w.o[1] + w.u[1] * 64 < 0) {
      const g = x.proj(add3(w.o, w.u, (w.o[1] - 0.5) / -w.u[1]));
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI * (1.05 + hash(i, 86) * 0.8);
        const len = (3 + hash(i, 87) * 8) * k;
        line(x, g, [g[0] + Math.cos(ang) * len, g[1] + Math.sin(ang) * len * 0.8], i % 2 ? [255, 214, 170] : [255, 250, 236], 0.9 * k);
      }
      line(x, [g[0], g[1] + 1], [g[0] + 16 * k, g[1] + 1], FURROW, 0.8 * k, true);
    }
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 20 * k, 0, g[2]]);
      line(x, a, b, FURROW, 0.85 * k, true);
      line(x, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.55 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3.4 - i * 0.7) * (0.6 + 0.5 * k);
        puff(x, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.6 * k);
      }
      for (let i = 0; i < 8; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 13 * k, hash(i, s + 81) * 11 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        const col: RGB = i % 3 === 0 ? [255, 214, 170] : i % 3 === 1 ? DUST : DUST_DARK;
        x.c.glow(p[0], p[1], col, 0.95 * k);
        x.c.glow(p[0] + 1, p[1], col, 0.7 * k);
      }
    }
  };

/**
 * Motes of stolen life (k from 0, far out, to 1, arrived): crimson orbs spiralling in on him from
 * all around, each trailing a short tail, and vanishing into him.
 */
const motes =
  (k: number): Extra =>
  (x) => {
    const { c, rig, aura, hash } = x;
    const centre: V3 = [rig.pelvis.o[0], 34, 0];
    const cz = x.depth(centre) + 2;
    for (let i = 0; i < 9; i++) {
      const delay = hash(i, 101) * 0.45;
      const at = (kk: number): { p: V3; t: number } => {
        const t = clamp((kk - delay) / (1 - delay), 0, 1);
        const th = (i / 9) * Math.PI * 2 + hash(i, 102) + t * 1.3;
        const R = 60 * Math.pow(1 - t, 0.85) + 3;
        const h = lerp(8 + hash(i, 103) * 54, 34, t);
        return { p: [centre[0] + Math.cos(th) * R, h, Math.sin(th) * R], t };
      };
      const head = at(k);
      if (head.t <= 0.02 || head.t >= 0.97) continue;
      for (let j = 3; j >= 1; j--) {
        const tail = at(k - j * 0.035);
        const q = x.proj(tail.p);
        c.glow(q[0], q[1], j > 1 ? aura.edge : aura.core, 0.55 - j * 0.12, x.depth(tail.p) < cz);
      }
      const p = x.proj(head.p);
      const under = x.depth(head.p) < cz;
      puff(x, p[0], p[1], 1.6, aura.core, 0.85, under);
      c.glow(p[0], p[1], aura.hot, 1, under);
      c.glow(p[0] - 1, p[1] - 1, aura.hot, 0.6, under);
    }
  };

/**
 * Power drawn up the planted blade into him: beads of crimson light climbing from where the blade
 * bites the ground to his hand, `k` how far the climb has got (they cycle as it goes on).
 */
const climb =
  (k: number): Extra =>
  (x) => {
    const { rig, aura } = x;
    const w = rig.weapon;
    // The blade runs down from the grip; find where it meets the floor.
    const down = -w.u[1];
    const reach = down > 0.2 ? clamp((w.o[1] - 0.5) / down, 8, 64) : 64;
    for (let i = 0; i < 4; i++) {
      const t = (k * 1.6 + i / 4) % 1;
      const along = lerp(reach, 8, t);
      const p = x.proj(add3(w.o, w.u, along));
      const a = Math.sin(Math.PI * t) * clamp(k * 3, 0, 1);
      for (const [dx, dy, col, al] of [[0, 0, aura.hot, 1], [-1, 0, aura.core, 0.8], [1, 0, aura.core, 0.8], [0, 1, aura.core, 0.7], [0, -1, aura.edge, 0.5]] as [number, number, RGB, number][]) x.c.glow(p[0] + dx, p[1] + dy, col, al * a);
    }
    // A glow where the blade bites the ground.
    const g = x.proj(add3(w.o, w.u, reach));
    for (let dx = -4; dx <= 4; dx++) x.c.glow(g[0] + dx, g[1], aura.core, 0.6 * (1 - Math.abs(dx) / 5), true);
  };

/**
 * The blade blazes (strength k): a crimson halo around it (under the figure, so it shows only
 * round its edges) and tongues of flame licking up off it, white at their roots.
 */
const blaze =
  (k: number, seed = 0): Extra =>
  (x) => {
    const { c, rig, aura, hash } = x;
    const w = rig.weapon;
    for (let i = 0; i <= 18; i++) {
      const p = x.proj(add3(w.o, w.u, 10 + i * 3));
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) c.glow(p[0] + dx, p[1] + dy, dx * dx + dy * dy <= 3 ? aura.core : aura.edge, 0.3 * k, true);
    }
    for (let i = 0; i < 14; i++) {
      const p = x.proj(add3(add3(w.o, w.u, 12 + i * 3.7 + hash(i, 90 + seed) * 2), w.v, (hash(i, 91 + seed) - 0.5) * 4));
      const h = Math.round((2 + hash(i, 92 + seed) * 6) * k);
      const sway = hash(i, 93 + seed) < 0.5 ? -1 : 1;
      for (let t = 0; t <= h; t++) {
        const f = t / Math.max(1, h);
        const col = f < 0.25 ? aura.hot : f < 0.65 ? aura.core : aura.edge;
        c.glow(p[0] + (f > 0.6 ? sway : 0), p[1] - t, col, (0.95 - f * 0.5) * k);
      }
    }
  };

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** Feet planted wide for the role skills. */
const PLANT = { footF: [11, 0, 8.5] as P2, footB: [-10, 0, 8] as P2 };

/** The roar: the blade high out to his right, the left fist thrust at the foe, head thrown back. */
const ROAR: ChibiPose = pose(S, {
  x: 0,
  y: 3,
  lean: -8,
  twist: -4,
  head: -12,
  look: 0,
  ...PLANT,
  handF: [-10, -9, 15],
  handB: [5, 3, 16],
  weapon: -6,
  roll: 18,
  yaw: 0,
  face: 'shout',
  lift: 0.8,
  wind: 0.35,
});

const cast: ChibiPose[] = [
  // Gather: sink into the planted stance, the blade swung low behind his right hip.
  pose(S, { y: 7, lean: 14, twist: 8, head: 6, ...PLANT, handF: [0, 15, 10], handB: [6, 10, 4], weapon: -108, roll: 8, yaw: -50, face: 'grit', wind: 0.2, fx: { aura: 0.3, circle: 0.3, rune: 0.4 } }),
  pose(S, { y: 9, lean: 18, twist: 12, head: 9, ...PLANT, handF: [-2, 16, 10], handB: [5, 11, 4], weapon: -114, roll: 8, yaw: -50, face: 'grit', lift: 0.2, wind: 0.15, fx: { aura: 0.6, circle: 0.55, rune: 0.8 } }),
  // The blade thrown up high, the roar let loose: an aura burst across the circle.
  pose(ROAR, { y: 2, lean: -6, head: -10, phase: 0.1, fx: { smear: { from: -114, roll: 8, yaw: -50, width: 0.7 }, impact: 1.1, aura: 1, circle: 1, rune: 1, shock: 0.12, shockAt: [0, 0, 0], extra: roar(0) } }),
  pose(ROAR, { y: 3, lean: -9, head: -13, phase: 0.3, lift: 0.95, fx: { aura: 1, circle: 1, rune: 1, shock: 0.45, shockAt: [0, 0, 0], extra: roar(0.5) } }),
  pose(ROAR, { y: 3, lean: -8, head: -11, phase: 0.5, lift: 0.8, fx: { aura: 0.85, circle: 1, rune: 1, shock: 0.8, shockAt: [0, 0, 0], extra: roar(1) } }),
  // Settle back into the guard, the circle fading.
  pose(S, { y: 5, lean: 2, twist: -4, head: -2, ...PLANT, handF: [4, 6, 12], handB: [7, 10, 7], weapon: 58, roll: 28, face: 'stern', lift: 0.4, wind: 0.3, phase: 0.7, fx: { aura: 0.5, circle: 0.7, rune: 0.6 } }),
  settle(pose(S, { y: 5, lean: 10, twist: -10, footF: [11, 0, 6], footB: [-10, 0, 5.4], handF: [7, 7, 10], weapon: 44, roll: 26 }), 0.5, { weapon: 84, grip: -4, wind: 0.25, phase: 0.85, fx: { aura: 0.2, circle: 0.35 } }),
  settle(S, 0.95, { grip: -9, phase: 1, fx: { circle: 0.12 } }),
];

// ── Charge ───────────────────────────────────────────────────────────────────────────────────

/** The dash: left shoulder first, low, the blade held low and forward in both hands. */
const DASH: ChibiPose = pose(S, {
  x: 10,
  y: 4,
  lean: 36,
  twist: 32,
  head: -16,
  look: -6,
  handF: [12, 17, 10],
  handB: [7, 13, 2],
  weapon: 93,
  roll: -12,
  yaw: -12,
  face: 'shout',
  wind: 1.1,
  lift: 0.1,
});

const charge: ChibiPose[] = [
  // Coiled low, the leading shoulder turned to the foe, the blade low and back.
  pose(S, { x: -3, y: 11, lean: 24, twist: 30, head: -4, footF: [10, 0, 5.6], footB: [-13, 0, 5.2], handF: [2, 17, 8], weapon: 122, roll: -10, yaw: -20, face: 'grit', wind: 0.3, fx: { aura: 0.6, dust: 0.5, rune: 0.6 } }),
  // Launch: the back leg drives off the ground, the front knee comes through.
  pose(DASH, { x: 6, y: 5, footF: [14, -7, 5], footB: [-16, 0, 5], phase: 0.1, fx: { aura: 1, dust: 1, speed: 0.8, extra: rush(0.6) } }),
  // The dash: long bounding strides, barely touching the ground.
  pose(DASH, { y: 0, footF: [25, -4, 5], footB: [-14, -10, 5], phase: 0.3, fx: { aura: 1, speed: 1, extra: rush(1) } }),
  pose(DASH, { y: 5, footF: [8, 0, 5], footB: [13, -12, 5], phase: 0.5, fx: { aura: 1, speed: 1, dust: 0.7, extra: rush(0.9) } }),
  pose(DASH, { y: 0, footF: [-15, -10, 5], footB: [24, -4, 5], phase: 0.7, fx: { aura: 0.9, speed: 1, extra: rush(1) } }),
  // The braced stop: the lead leg thrust out straight, heel dug in, the other folded under him,
  // the body thrown back and the blade's point dragged scraping along the floor.
  pose(S, { x: 12, y: 12, lean: -6, twist: 10, head: -2, look: -4, footF: [28, 0, 6], footB: [4, 0, 5.6], handF: [2, 14, 11], handB: [9, 9, 4], weapon: -122, roll: 0, yaw: -28, face: 'grit', wind: 0, lift: 0.4, sway: 0.4, phase: 0.85, fx: { aura: 0.6, dust: 1, speed: 0.3, extra: skid(1) } }),
  pose(S, { x: 9, y: 8, lean: 6, twist: 4, head: 1, footF: [20, 0, 6], footB: [-4, 0, 5.6], handF: [8, 12, 10], weapon: 56, roll: 26, face: 'stern', wind: 0.15, phase: 1, fx: { aura: 0.25, dust: 0.5, extra: skid(0.4) } }),
  settle(pose(S, { x: 3, y: 5, lean: 12, handF: [8, 11, 9], weapon: 52 }), 0.85, { grip: -8, phase: 1.1 }),
];

// ── Eclipse ──────────────────────────────────────────────────────────────────────────────────

/** Where the turn starts (the wind-up's turn) and how far round each spin frame is. */
const SPIN_FROM = -40;
const SPIN_TURNS = [40, 85, 130, 175, 220, 265, 310, 350];

/** Eclipse: frame i of the turn, the blade level out to his right, the ring growing behind it. */
function spin(i: number): ChibiPose {
  const turn = SPIN_TURNS[i - 1] as number;
  const to = turn + 90;
  return pose(S, {
    y: 6,
    lean: 6,
    twist: 6,
    turn,
    head: 1,
    // Side on the head turns a little ahead of the body anyway (SIDE_LOOK); keep it from leading the spin.
    look: -12,
    footF: [9, 0, 6.5],
    footB: [-9, 0, 6],
    handF: [5, 12, 11],
    weapon: 90,
    roll: 0,
    yaw: 86,
    face: 'shout',
    wind: 0.4,
    flare: 1,
    phase: i / 8,
    fx: { ring: { from: Math.max(SPIN_FROM + 90, to - 320), to, height: 36 }, rune: 1, aura: 0.45 },
  });
}

const eclipse: ChibiPose[] = [
  // Wind-up: coiled to his left, the blade drawn level across in front of him.
  pose(S, { y: 8, lean: 10, twist: -24, turn: SPIN_FROM, head: 3, look: 14, footF: [9, 0, 6.5], footB: [-9, 0, 6], handF: [9, 12, -2], handB: [6, 12, -6], weapon: 90, roll: 0, yaw: -62, face: 'grit', wind: 0.3, sway: -0.4, fx: { rune: 0.7, aura: 0.35 } }),
  spin(1),
  spin(2),
  spin(3),
  spin(4),
  spin(5),
  spin(6),
  spin(7),
  // The ring closes; the slowing field rolls out over the floor.
  pose(spin(8), { fx: { ring: { from: SPIN_TURNS[7]! + 90 - 330, to: SPIN_TURNS[7]! + 90, height: 36 }, rune: 0.8, aura: 0.4, shock: 0.2, shockAt: [0, 0, 0] } }),
  settle(pose(S, { y: 6, lean: 10, twist: 4, turn: 360, handF: [8, 11, 8], weapon: 70, roll: 10, flare: 0.4, wind: 0.3 }), 0.75, { turn: 360, grip: -7, flare: 0.4, wind: 0.3, fx: { shock: 0.6, shockAt: [0, 0, 0], aura: 0.15 } }),
];

// ── Drain ────────────────────────────────────────────────────────────────────────────────────

/** Drain: the blade planted point down beside his right foot, his left arm open to draw the power in. */
const planted = (k: number, phase: number, shock?: number): ChibiPose =>
  pose(S, {
    x: 0,
    y: 8 - k * 1.5,
    lean: 8 - k * 10,
    twist: -6,
    head: 4 - k * 12,
    look: 0,
    footF: [9, 0, 7],
    footB: [-10, 0, 6.5],
    handF: [3, 11, 13],
    handB: k < 0.7 ? [3, 4 - k * 8, 15] : [8, 3, 8],
    weapon: 180,
    roll: 0,
    yaw: 0,
    face: k > 0.6 ? 'shout' : 'grit',
    lift: 0.2 + k * 0.5,
    wind: 0.1,
    sway: -0.15,
    phase,
    fx: { wisps: k, glow: k, aura: 0.4 + k * 0.6, circle: 0.6 + k * 0.4, rune: 1, shock, shockAt: [0, 0, 0], extra: both(climb(k), motes(k)) },
  });

const drain: ChibiPose[] = [
  // Raise the blade point down at his right side.
  pose(S, { y: 4, lean: 0, twist: -6, head: -4, footF: [9, 0, 7], footB: [-10, 0, 6.5], handF: [-6, -4, 15], handB: [6, 10, 6], weapon: 180, roll: 0, yaw: 0, face: 'grit', fx: { rune: 0.6, aura: 0.3 } }),
  pose(S, { y: 1, lean: -6, twist: -8, head: -8, footF: [9, 0, 7], footB: [-10, 0, 6.5], handF: [-7, -9, 15], handB: [5, 8, 8], weapon: 180, roll: 0, yaw: 0, face: 'shout', lift: 0.3, fx: { rune: 1, aura: 0.6 } }),
  // Driven into the ground.
  pose(planted(0, 0), { y: 11, lean: 16, head: 8, handB: [6, 8, 9], face: 'shout', fx: { impact: 1.2, impactAt: [3, 2, 13], shock: 0.08, shockAt: [0, 0, 0], dust: 1, rune: 1, aura: 0.8, circle: 0.5 } }),
  planted(0.15, 0.1, 0.4),
  planted(0.35, 0.2, 0.75),
  planted(0.55, 0.3),
  planted(0.75, 0.4),
  planted(0.92, 0.5),
  // Every wisp home: a flash in his chest.
  pose(planted(1, 0.6), { fx: { glow: 1, aura: 1, circle: 1, rune: 1, impact: 0.85, impactAt: [2, 38, 0], extra: climb(1) } }),
  // Pull it free, coming up into the battle stance.
  settle(pose(S, { y: 6, lean: 8, head: 2, handF: [9, 6, 9], weapon: 120, roll: 10 }), 0.55, { grip: -5, fx: { aura: 0.4, rune: 0.5, glow: 0.3 } }),
];

// ── Ruination ────────────────────────────────────────────────────────────────────────────────

/** In the air: legs tucked up under him (feet about 12 below the hips), coat flung up. */
const AIR = (y: number, phase: number, turn: number): ChibiPose =>
  pose(S, {
    x: 4,
    y,
    lean: 0,
    twist: 0,
    turn,
    head: 0,
    look: 0,
    footF: [7, y - 12, 5],
    footB: [-5, y - 8, 5],
    face: 'shout',
    wind: 0.5,
    lift: 0.8,
    phase,
  });

/** Where each blow strikes the ground ahead of him (hero space, so it turns with him). */
const AIM: V3 = [70, 0, -12];

/** A blow lands: the blade has cut down from high over his right shoulder to low in front. */
const strike = (y: number, phase: number, turn: number): ChibiPose =>
  pose(AIR(y, phase, turn), {
    lean: 30,
    twist: 16,
    head: 6,
    handF: [15, 10, 3],
    weapon: 124,
    roll: 28,
    footF: [11, y - 7, 5],
    footB: [-9, y - 5, 5],
    wind: 0.7,
    fx: { smear: { from: -48, roll: 36, yaw: -20, width: 0.42 }, impact: 1.1, shock: 0.04, shockAt: AIM, rune: 1, aura: 1, blood: 0.4, extra: blaze(1, phase * 10) },
  });

/**
 * Swinging back up after a blow (k 0) to cocked high over his right shoulder (k 1). Just after a
 * blow, the blow's shockwave spreads on the ground ahead.
 */
const recock = (y: number, phase: number, turn: number, k: number, after = false): ChibiPose =>
  pose(AIR(y, phase, turn), {
    lean: lerp(12, -8, k),
    twist: lerp(4, -16, k),
    head: lerp(2, -4, k),
    // The fist swings out wide round the side of his head on its way up, so it never crosses his face.
    handF: [lerp(6, -9, k), lerp(1, -8, k), lerp(10, 14, k) + 3 * Math.sin(Math.PI * k)],
    // Cocked tip up behind his shoulder (not hanging down his back: the pommel would then point at his face).
    weapon: lerp(-10, -48, k),
    roll: lerp(28, 36, k),
    yaw: lerp(0, -20, k),
    fx: { rune: 1, aura: 1, blood: 0.35, extra: blaze(1, phase * 10), ...(after ? { shock: 0.42, shockAt: AIM } : {}) },
  });

const ruination: ChibiPose[] = [
  // The price: a mist of blood bursts from him; he crouches to spring.
  pose(S, { y: 9, lean: 18, twist: -10, head: 6, ...PLANT, handF: [6, 14, 7], weapon: 120, roll: 10, face: 'hurt', fx: { blood: 1, aura: 0.5, rune: 0.6 } }),
  pose(S, { y: 13, lean: 24, twist: -14, head: 8, ...PLANT, handF: [4, 15, 7], weapon: 130, roll: 10, face: 'grit', lift: 0.4, fx: { blood: 1, aura: 1, rune: 1, dust: 0.6 } }),
  // The leap: up through his own blood, the blade raised and blazing.
  pose(AIR(-24, 0.1, 0), { lean: -4, twist: -10, head: -8, footF: [5, -30, 5], footB: [-6, -20, 5], handF: [-7, -9, 14], weapon: -30, roll: 24, lift: 1, wind: 0.3, fx: { blood: 0.9, aura: 1, rune: 1, dust: 0.9, extra: blaze(0.8, 1) } }),
  // The top of the leap, the first blow cocked; then four blows as he falls, turning to rain
  // them over the ground ahead.
  recock(-40, 0.2, 0, 1),
  strike(-38, 0.3, 0),
  recock(-35, 0.4, -12, 0.35, true),
  recock(-31, 0.5, -20, 1),
  strike(-27, 0.6, -20),
  recock(-23, 0.7, 4, 0.35, true),
  recock(-18, 0.8, 18, 1),
  strike(-14, 0.9, 18),
  // Falling, the blade swung up over his head for the last blow.
  pose(recock(-9, 1, 6, 0.4, true), { roll: 10 }),
  pose(recock(-4, 1.1, 0, 1), { handF: [-10, -8, 14], weapon: -60, roll: 20, lean: -10, footF: [9, -9, 5], footB: [-6, -6, 5] }),
  // The slam: the blade crashes into the ground, a shockwave.
  pose(S, { x: 7, y: 11, lean: 34, twist: 4, head: 8, footF: [15, 0, 6], footB: [-12, 0, 5.6], handF: [17, 13, 6], weapon: 128, roll: 8, face: 'shout', wind: 0.8, lift: -0.2, phase: 1.2, fx: { smear: { from: -60, roll: 20, yaw: -20, width: 0.6 }, impact: 1.6, shock: 0.1, dust: 1, rune: 1, aura: 0.9, blood: 0.3 } }),
  pose(S, { x: 7, y: 10, lean: 33, twist: 4, head: 7, footF: [15, 0, 6], footB: [-12, 0, 5.6], handF: [17, 14, 6], weapon: 132, roll: 8, face: 'grit', wind: 0.4, phase: 1.3, fx: { shock: 0.5, dust: 0.7, rune: 0.7, aura: 0.5 } }),
  // Rising out of the slam toward the battle stance as the shockwave spreads.
  settle(pose(S, { x: 6, y: 9, lean: 28, twist: 2, head: 5, footF: [15, 0, 6], footB: [-12, 0, 5.6], handF: [15, 14, 7], weapon: 130, roll: 8 }), 0.45, { grip: -4, face: 'grit', wind: 0.25, phase: 1.4, fx: { shock: 0.85, dust: 0.3, rune: 0.4 } }),
];

export const SKILL_CLIPS_DK = { cast, charge, eclipse, drain, ruination };
