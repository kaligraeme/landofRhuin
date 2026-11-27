/**
 * The Dragoon's core moves: stances, running and the three-thrust combo. Poses use the chibi
 * pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the
 * lance's angle (0 up, 90 forward), its plane's `roll` and `yaw`, both hands' places along the
 * haft (`grip` the right hand's, `grip2` the left's), and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, weight on his back foot, the lance shouldered and sloping up and back
 *              past his head, its butt down by his front foot, his left thumb in his belt: a
 *              slow breath, a blink, the cape and ponytail swaying, sparks drifting off the point
 *   battle  8  a low, bladed spear stance, left foot and left hand leading, the right hand on the
 *              haft by his hip, the point forward and up; a quick, springy bounce on his toes, the
 *              point bobbing, head, cape and hair a frame behind
 *   move    8  a sprint: long strides, a hard lean, the lance carried low in his right fist at
 *              the hip, its point trailing back, the left arm pumping, the cape and ponytail
 *              streaming
 *   atk1    7  (1 wind-up) a quick low jab: the hands slid back and the point dropped to the hip,
 *              then snapped out at hip height with a stamp of the lead foot, a short drill
 *   atk2    7  (1 wind-up) a downward stab: the haft cocked high by his ear, rear elbow up, then
 *              stabbed down from above the shoulder over the bent front knee to a foe's knee
 *              height, a violet smear arcing down behind the point
 *   atk3    9  (2 wind-up) a deep coil, then a hop in and a long lunge from the butt end of the
 *              haft for the farthest reach: a flash and a burst of violet energy at the point, dust
 *
 * Thrusts drive a drill of violet energy out of the point (`drill` below: a white-hot core beam
 * wrapped in two violet ribbons) and leave violet streaks along the thrust line (`streak`), with
 * a white-hot flash at the point as they land (`flash`); each has an anticipation, a strike, a
 * held extension and a recovery into the battle stance (`settle`), with the cape and ponytail
 * streaming hardest a frame after the strike. Every effect is painted in the design's aura:
 * violet, a pale lilac edge and a white-hot core. The skill and state clips (moves-skills.ts,
 * moves-states.ts) start from the stance (`fromReady`) and those that hand back to it end in it
 * (`settle`).
 */
import type { RGB, Vec } from '../../paint.js';
import { glowLine, puff, starburst } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, cross3, type FxContext, mix, norm3, pose, solveRig, type V3, wave } from '../rig.js';
import { DRAGOON } from './design.js';

const BUILD = DRAGOON.build;
const W = DRAGOON.weapon;
const TIP = W.tip ?? W.reach[1];

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The battle stance: low and bladed, the left foot and the left shoulder leading (a positive
 * `twist` opens his chest toward the viewer side on), the right hand on the haft by his hip, the
 * left hand forward on it, the point forward and up. The haft is yawed across toward his left so
 * side on it lies flat to the viewer at its full length, and toward the viewer it crosses his
 * body on a diagonal with the head out past his left shoulder, clear of his face.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 6,
  lean: 8,
  twist: 18,
  head: 3,
  look: -6,
  footF: [-12, 0, 5],
  footB: [11, 0, 5.4],
  handF: [-4, 17, 7],
  weapon: 55,
  roll: 0,
  yaw: -45,
  grip: -8,
  grip2: 14,
  wind: 0.8,
  phase: 0,
};

/**
 * At ease, weight on his back foot: the lance shouldered and sloping up and back at about 50
 * degrees, its haft resting against his right shoulder, his right hand on it at his chest and its
 * butt resting on the floor by his front foot, the point up behind his head; the left thumb hooked
 * in his belt.
 * Toward the viewer the lance rises on a diagonal past his right shoulder, away from the viewer
 * the same diagonal mirrored, clear of his face in every view.
 */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: -2,
  twist: 8,
  tilt: -3,
  head: -4,
  look: 6,
  footF: [5, 0, 5.4],
  footB: [-5, 0, 4.2],
  handF: [5, 13, 9.5],
  handB: [0, 17, 6.5],
  weapon: -38,
  roll: 8,
  yaw: -35,
  grip: 6,
  wind: 0.1,
  face: 'smirk',
};

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

/** Where a pose's point is, in hero space (turned by the pose's `turn` into the turn-0 frame). */
export function tipOf(p: ChibiPose): V3 {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const t = add3(rig.weapon.o, rig.weapon.u, TIP);
  const a = ((p.turn ?? 0) * Math.PI) / 180;
  return [t[0] * Math.cos(a) - t[2] * Math.sin(a), t[1], t[0] * Math.sin(a) + t[2] * Math.cos(a)];
}

/**
 * A drill of violet energy driven out of the point (strength k), from a little behind the point
 * to `len` past it, `radius` round at its widest and tapering to its far end: a white-hot core
 * beam two pixels thick along the thrust line, two broad violet ribbons with pale lilac rims
 * spiralling round it, and a violet glow filling the space between them, everything fading
 * toward the far end. `spin` turns the ribbons (advance it frame by frame). Toward the viewer a
 * thrust's point runs down the screen, so the drill stops short where it would run on under his
 * feet: it ends no lower on screen than a few pixels under the ground he stands on, and never
 * below the floor itself.
 */
export function drill(p: ChibiPose, k: number, spin: number, len = 34, radius = 9): ChibiPose {
  const paint = (x: FxContext): void => {
    const w = x.rig.weapon;
    const from = add3(w.o, w.u, TIP - 6);
    const foot = x.proj([x.rig.pelvis.o[0], 0, x.rig.pelvis.o[2]])[1] + 4;
    let L = len + 6;
    for (let i = 0; i < 40 && L > 8; i++) {
      const end = add3(from, w.u, L);
      if (end[1] > radius * 0.5 + 1 && x.proj(end)[1] <= foot) break;
      L *= 0.92;
    }
    spiral(x, from, w.u, L, k, radius, spin);
  };
  return withExtra(p, paint);
}

/**
 * The drill's spiral (see `drill`): from `from` along the unit direction `dir` for `L`, hero space.
 * Parts of it behind the line it wraps (or behind the figure) go under the figure, dimmer.
 */
export function spiral(x: FxContext, from: V3, dir: V3, L: number, k: number, radius: number, spin: number): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.6);
  if (k <= 0 || L < 2) return;
  const ref: V3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm3(cross3(dir, ref));
  const e2 = cross3(dir, e1);
  const A = x.proj(from);
  const B = x.proj(add3(from, dir, L));
  const seen = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const steps = Math.max(8, Math.ceil(Math.max(seen, L * 0.5) * 1.6));
  // Across the line on screen (or, seen end on, up the screen).
  const nx = seen > 0.5 ? -(B[1] - A[1]) / seen : 1;
  const ny = seen > 0.5 ? (B[0] - A[0]) / seen : 0;
  const r = (t: number): number => radius * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.7))) * (1 - 0.6 * t);
  const turns = 0.6 + L / 40;
  const fade = (t: number): number => Math.min(1, k) * Math.pow(1 - t, 0.8);
  const behindLine = (p3: V3, ctr: V3): boolean => x.depth(p3) < x.depth(ctr) - 0.3;
  // The glow filling it.
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ctr = add3(from, dir, L * t);
    const C = x.proj(ctr);
    const edge = x.proj(add3(ctr, e1, r(t)));
    const edge2 = x.proj(add3(ctr, e2, r(t)));
    const rs = Math.max(1, Math.max(Math.hypot(edge[0] - C[0], edge[1] - C[1]), Math.hypot(edge2[0] - C[0], edge2[1] - C[1])) * 0.85);
    for (let o = -Math.ceil(rs); o <= Math.ceil(rs); o++) {
      const q = Math.abs(o) / rs;
      if (q > 1) continue;
      c.glow(C[0] + nx * o, C[1] + ny * o, aura.core, fade(t) * 0.3 * (1 - q * 0.6), x.behind(ctr));
    }
  }
  // The two ribbons, each a band `bw` broad along the line wound round it: broad where it faces
  // the viewer, thin where it turns edge on, its leading edge pale lilac. The halves behind the
  // line first, then the core, then the halves in front.
  const bw = Math.max(2, radius * 0.4);
  const ribbon = (front: boolean): void => {
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const th = Math.PI * 2 * (turns * t + spin + s / 2);
        const ctr = add3(from, dir, L * t);
        const p3 = add3(add3(ctr, e1, Math.cos(th) * r(t)), e2, Math.sin(th) * r(t));
        const back = behindLine(p3, ctr);
        if (back === front) continue;
        const lead = add3(p3, dir, bw * (1 - 0.5 * t));
        const P = x.proj(p3);
        const Q = x.proj(lead);
        const a = fade(t) * (back ? 0.4 : 0.9);
        const under = back || x.behind(p3);
        glowLine(c, P, Q, aura.core, a, under);
        c.glow(P[0], P[1] + 1, aura.core, a * 0.7, under);
        c.glow(Q[0], Q[1], aura.edge, a * (back ? 0.5 : 0.95), under);
      }
    }
  };
  ribbon(false);
  // The white-hot core beam, two pixels thick, violet toward its far end.
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > 0.85) break;
    const ctr = add3(from, dir, L * t);
    const C = x.proj(ctr);
    const col: RGB = t < 0.45 ? aura.hot : mixc(aura.hot, aura.core, (t - 0.45) / 0.4);
    for (const o of [-0.5, 0.5]) c.glow(C[0] + nx * o, C[1] + ny * o, col, Math.min(1, fade(t) * 1.1), x.behind(ctr));
  }
  ribbon(true);
}

/**
 * A white-hot flash at the point as a thrust lands (strength k): a starburst, white at its heart,
 * violet at its fringe, with a small ring of violet light round it.
 */
export const flash =
  (k: number) =>
  (x: FxContext): void => {
    const p = x.proj(x.tip);
    starburst(x.c, p, 0.75 * k, x.aura.hot, x.aura.core, Math.min(1, k));
    const r = 6 + 3 * k;
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2;
      x.c.glow(p[0] + Math.cos(th) * r, p[1] + Math.sin(th) * r * 0.8, i % 3 ? x.aura.core : x.aura.edge, 0.55 * k);
    }
  };

/** Adds a painter to a pose's own `fx.extra` (after whatever it paints already). */
export const withExtra = (p: ChibiPose, f: (x: FxContext) => void): ChibiPose => {
  const prev = p.fx?.extra;
  return { ...p, fx: { ...p.fx, extra: prev ? both(prev, f) : f } };
};

/**
 * Violet streaks along the path of the point (`from` to `to`, hero space at turn 0, as `tipOf`
 * gives them), `k` their strength: three thin lines running parallel to the path, one either side
 * of it and one down it, violet with pale lilac heads toward the point, fading toward where the
 * point started (each starts at its own seeded place), with a faint violet wash between them. A thrust's smear: a swoosh is an
 * arc, a thrust is a line. A thrust straight at the viewer or away would shrink to a dot, so its
 * streaks open out on screen to at least half their length, downward for one coming at the viewer
 * (nearer is lower on screen) and upward for one going away.
 */
export const streak =
  (from: V3, to: V3, k = 1, width = 3) =>
  (x: FxContext): void => {
    const turn = (q: V3): V3 => {
      // Back into the pose's own frame (the painter's), undoing the turn tipOf took out.
      const a = -(((x.rig.pose.turn ?? 0) * Math.PI) / 180);
      return [q[0] * Math.cos(a) - q[2] * Math.sin(a), q[1], q[0] * Math.sin(a) + q[2] * Math.cos(a)];
    };
    const a3 = turn(from);
    const b3 = turn(to);
    const B = x.proj(b3);
    let A = x.proj(a3);
    const full = Math.hypot(b3[0] - a3[0], b3[1] - a3[1], b3[2] - a3[2]);
    const seen = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (seen < full * 0.5 && full > 1) {
      // Opened out behind the point: up the screen behind a point coming at the viewer.
      const toward = x.depth(b3) > x.depth(a3);
      const want: Vec = [0, toward ? 1 : -1];
      const s = seen > 0.5 ? clamp(seen / (full * 0.5), 0, 1) : 0;
      const d: Vec = seen > 0.5 ? [((B[0] - A[0]) / seen) * s + want[0] * (1 - s), ((B[1] - A[1]) / seen) * s + want[1] * (1 - s)] : want;
      const dl = Math.hypot(d[0], d[1]) || 1;
      A = [B[0] - (d[0] / dl) * full * 0.5, B[1] - (d[1] / dl) * full * 0.5];
    }
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (len < 2) return;
    const ux = (B[0] - A[0]) / len;
    const uy = (B[1] - A[1]) / len;
    const behind = x.behind(b3) && x.behind(a3);
    const at = (t: number, s: number): Vec => [A[0] + ux * len * t - uy * s, A[1] + uy * len * t + ux * s];
    // The wash between the lines.
    for (let t = 0; t <= 1; t += 1 / Math.ceil(len)) {
      for (let s = -width; s <= width; s += 1) x.c.glow(at(t, s)[0], at(t, s)[1], x.aura.core, k * 0.22 * t * (1 - Math.abs(s) / (width + 1)), behind);
    }
    // The lines: one each side and one down the middle, of seeded lengths, stopping a little
    // short of the point: violet, with a pale lilac head.
    const lines = [-width, 0, width];
    lines.forEach((s, i) => {
      const t0 = 0.05 + x.hash(i, 151) * 0.35;
      const t1 = 0.9 - x.hash(i, 152) * 0.12;
      const n = Math.ceil(len * (t1 - t0));
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / Math.max(1, n);
        const f = (t - t0) / (t1 - t0);
        const col: RGB = f > 0.75 ? x.aura.edge : x.aura.core;
        const p = at(t, s);
        x.c.glow(p[0], p[1], col, k * (0.3 + 0.7 * f) * (s === 0 ? 0.7 : 1), behind);
      }
    });
  };

/**
 * A gust of violet energy kicked up round him (k from 0, just kicked up, to 1, blown out and fading):
 * curling streaks low over the floor running out from under him, white at their heads, violet
 * behind, with a few motes of grit. Those behind him go under the figure.
 */
export const gust =
  (k: number, radius = 22, seed = 0) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const fade = clamp(1.2 - k, 0, 1);
    for (let i = 0; i < 9; i++) {
      const th0 = (i / 9) * Math.PI * 2 + hash(i, 141 + seed) * 0.5;
      const h = 2 + hash(i, 142 + seed) * 10 + k * 6;
      const r0 = radius * (0.45 + 0.5 * k) + hash(i, 143 + seed) * 6;
      const sweep = 0.7 + hash(i, 144 + seed) * 0.4;
      let prev: Vec | null = null;
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const th = th0 + sweep * t;
        const p3: V3 = [g[0] + Math.cos(th) * (r0 + t * 6), h + Math.sin(t * Math.PI) * 2, g[2] + Math.sin(th) * (r0 + t * 6)];
        const p = x.proj(p3);
        if (prev) {
          const col: RGB = t > 0.75 ? aura.hot : t > 0.35 ? aura.core : mixc(aura.core, aura.edge, 0.5);
          glowLine(c, prev, p, col, fade * (0.2 + 0.8 * t) * 0.9, x.behind(p3));
        }
        prev = p;
      }
    }
    for (let i = 0; i < 6; i++) {
      const th = hash(i, 147 + seed) * Math.PI * 2;
      const r = radius * (0.3 + 0.7 * k) * (0.6 + 0.5 * hash(i, 148 + seed));
      const p3: V3 = [g[0] + Math.cos(th) * r, 2 + hash(i, 149 + seed) * 8 * (1 - k * 0.5), g[2] + Math.sin(th) * r];
      const p = x.proj(p3);
      puff(c, p[0], p[1], 1.2, aura.core, 0.6 * fade, x.behind(p3));
    }
  };

/** Runs several extra painters in turn. */
export const both =
  (...fs: ((x: FxContext) => void)[]) =>
  (x: FxContext): void => {
    for (const f of fs) f(x);
  };

/**
 * Sparks shed off the glowing point as it rests or moves (strength k): a short wisp of violet
 * light curling up and back off the tip, and `n` motes that leave the tip and drift up and back
 * off it, clear of the lance's own glowing head, fading as they go: each a white-hot heart in a
 * violet cross, the fresh ones a little larger. `phase` (turns: advance it frame by frame) carries
 * them on, each wrapping back to the tip when it fades, and curls the wisp. Where the figure
 * stands nearer the viewer than they are, it hides them: the trail a glowing lance leaves.
 */
export const sparks =
  (k: number, phase: number, n = 7) =>
  (x: FxContext): void => {
    const { c, aura, hash } = x;
    const up: V3 = [0, 1, 0];
    const hidden = (p3: V3, q: Vec): boolean => x.behind(p3) && c.opaque(Math.floor(q[0]), Math.floor(q[1]));
    // The wisp: a curl of violet light rising off the tip, brightest at the tip.
    let prev: Vec | null = null;
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      const curl = Math.sin(t * Math.PI * 1.4 + phase * Math.PI * 2) * 2.4 * t;
      const p3 = add3(add3(x.tip, x.dir, -1 - t * 9), up, 1 + t * 9 + curl);
      const p = x.proj(p3);
      if (prev) glowLine(c, prev, p, t < 0.35 ? mixc(aura.hot, aura.core, 0.35) : aura.core, k * 0.8 * (1 - t * 0.85), hidden(p3, p));
      prev = p;
    }
    for (let i = 0; i < n; i++) {
      const t = (((hash(i, 181) + phase * (0.8 + 0.4 * hash(i, 182))) % 1) + 1) % 1;
      const back = t * 11 + hash(i, 183) * 5;
      const p3 = add3(add3(x.tip, x.dir, -back), up, 2 + t * 15 + (hash(i, 184) - 0.5) * 5);
      const q = x.proj([p3[0], p3[1], p3[2] + (hash(i, 185) - 0.5) * 6]);
      const a = Math.min(1, k * Math.pow(1 - t, 0.6) * (0.85 + 0.3 * hash(i, 186)));
      const under = hidden(p3, q);
      c.glow(q[0], q[1], aura.hot, a, under);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(q[0] + dx, q[1] + dy, aura.core, a * 0.65, under);
      if (t < 0.3) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]] as const) c.glow(q[0] + dx, q[1] + dy, aura.edge, a * 0.3, under);
    }
  };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles exactly one pixel for the second half of the
  // loop (a whole pixel, so the hair's clumps do not shimmer), the left hand with it, while the
  // lance barely moves (its hand stays almost where it was), the cape and the ponytail sway slowly
  // round and he blinks once. The point sheds sparks all the while.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 1 + out,
    handF: [5, 13 - out * 0.85, 9.5],
    handB: [0, 17 + out * 0.4, 6.5],
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.16 + wave(i, 8) * 0.14,
    face: i === 6 ? 'closed' : 'smirk',
    fx: { rune: 0.3 + wave(i, 8) * 0.2, extra: sparks(0.9, i / 8, 7) },
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back up, quick and light. The point dips a beat behind the
  // body, the head nods a frame behind it, and the cape and hair lift a little as he drops: a
  // steady breeze keeps the cape out behind him in every frame, so it never pops.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 4.6 + b * 3,
    lean: 7 + b * 2.5,
    head: 1 + bounce(i - 1) * 3,
    handF: [-4, 16 + b * 1.2, 7],
    weapon: 55 + bounce(i - 1) * 6,
    wind: 0.8 + Math.max(0, lag) * 0.15,
    lift: 0.1 + lag * 0.35,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
    fx: { rune: 0.5 + bounce(i - 2) * 0.3, extra: sparks(1, i / BOUNCE, 8) },
  });
});

/** The first battle frame: the skill and state clips hand over from it and back to it. */
const STANCE0 = battle[0] as ChibiPose;

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. Long legs, long strides. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [13, 0], b: [-11, -6], y: 2.4 },
  { f: [7, 0], b: [-9, -11], y: 4.4 },
  { f: [0, 0], b: [3, -9.5], y: 1.2 },
  { f: [-8, -1.5], b: [11, -4.5], y: -3 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 22 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 10,
    head: -10,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.2] : [k.b[0], k.b[1], 4.2],
    footB: right ? [k.b[0], k.b[1], 4] : [k.f[0], k.f[1], 4],
    // The lance carried low in his right fist at the hip, out at his side in front of the cape,
    // its point trailing back and a little down and out (so toward the viewer it shows past his
    // right hip rather than end on); the left arm pumps against the legs.
    handF: [-3 - swing * 2, 19 - Math.abs(swing), 10],
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    weapon: -104 + swing * 4,
    roll: -10,
    yaw: -30,
    grip: -10,
    wind: 1.05,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0, rune: 0.5, extra: sparks(0.8, i / 8) },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (from k 0.5 the effects come from the battle frame, which has none). The combo's recoveries
 * use it, and so do the skill and state clips that hand back to the stance.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, STANCE0, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. A clip the battle loop hands over to starts with it, so its first frame carries on from the
 * stance. Keep k at 0.5 or more so the hands, face and effects come from the pose.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(STANCE0, p, k), over);

/** A point on the lance `back` short of its tip in a pose, in hero space (turned into the turn-0 frame, as `tipOf`). */
export function alongOf(p: ChibiPose, back: number): V3 {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const t = add3(rig.weapon.o, rig.weapon.u, TIP - back);
  const a = ((p.turn ?? 0) * Math.PI) / 180;
  return [t[0] * Math.cos(a) - t[2] * Math.sin(a), t[1], t[0] * Math.sin(a) + t[2] * Math.cos(a)];
}

/** Adds streaks along the thrust line to pose `b`'s effects: from `reach` back along the lance from its point to the point. */
export const thrust = (b: ChibiPose, k = 1, width = 3, reach = 30): ChibiPose => withExtra(b, streak(alongOf(b, reach), tipOf(b), k, width));

/**
 * The head's own tip for a pose leaning `lean`, so that the head pitches `pitch` in all (the rig
 * tips the head by half the torso's lean on its own): in a lunge he keeps his head up and his eyes
 * on the foe, and toward the viewer his face stays as open as in the stance rather than showing
 * the crown.
 */
export const headUp = (lean: number, pitch = 3): number => pitch - lean * 0.5;

// Every thrust is drawn back first, so the strike visibly travels in every view, and lands on
// the first frame after the wind-up with a white-hot flash at the point, violet streaks along
// the thrust line behind the point and a drill of violet energy driven out of it, sized to the
// blow: short for the jab, longer for the lunge, longest for Piercing Thrust (moves-skills.ts).

// atk1: a quick low jab. The hands slide back to the rear hip and the point drops level with the
// hip; then it snaps out at hip height, the lead foot stamping forward, the lead hand sliding up
// the haft.
const A1_DRAW = pose(READY, { x: -5, y: 8, lean: 4, twist: 28, head: headUp(4, 4), look: -6, footF: [-13, 0, 5], footB: [8, -1, 5.4], handF: [-12, 21, 8], weapon: 86, yaw: -30, grip: -8, grip2: 12, wind: 0.3, lift: 0.1, sway: 0.2, phase: 0.1, face: 'grit', fx: { rune: 0.6 } });
const A1_HIT = pose(READY, { x: 5, y: 8, lean: 14, twist: 8, head: headUp(14), look: -2, footF: [-13, 0, 5], footB: [17, 0, 5.6], handF: [7, 20, 5], weapon: 93, yaw: -28, grip: -16, grip2: 24, wind: 0.8, phase: 0.3, face: 'shout', fx: { rune: 1 } });
const A1_HOLD = pose(A1_HIT, { y: 8.5, lean: 15, head: headUp(15), handF: [7, 20.5, 5], wind: 0.9, lift: 0.15, phase: 0.45, face: 'grit', fx: { rune: 0.7 } });

const atk1: ChibiPose[] = [
  fromReady(A1_DRAW, 0.85),
  drill(withExtra(thrust(A1_HIT, 1, 3, 24), flash(0.9)), 1.1, 0.15, 20, 6),
  drill(thrust(A1_HOLD, 0.45, 3, 24), 0.75, 0.4, 22, 6.5),
  drill(pose(A1_HOLD, { x: 3, y: 7.5, lean: 12, head: headUp(12), handF: [2, 19.5, 6], weapon: 88, grip: -12, grip2: 20, wind: 0.6, lift: 0.4, phase: 0.6, face: 'stern', fx: { rune: 0.4 } }), 0.3, 0.65, 22, 6.5),
  settle(A1_HOLD, 0.5, { wind: 0.68, lift: 0.25, phase: 0.75, face: 'stern', fx: undefined }),
  settle(A1_HOLD, 0.8, { wind: 0.75, lift: 0.1, phase: 0.9, fx: undefined }),
  settle(A1_HOLD, 0.94, { wind: 0.78, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: a downward stab. The haft cocked high by his right ear, rear elbow up, the point raised
// behind; then stabbed down from above the shoulder at about 25 degrees, the body leaning over the
// front knee, a violet smear arcing down behind the point, which ends at the height of a foe's knee.
const A2_RAISE = pose(READY, { x: -3, y: 4, lean: -2, twist: 18, head: headUp(-2, 1), look: -6, footF: [-12, 0, 5], footB: [10, 0, 5.4], handF: [-7, -11, 13], weapon: 58, roll: 0, yaw: -6, grip: -4, grip2: 12, wind: 0.3, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.6 } });
const A2_HIT = pose(READY, { x: 7, y: 9, lean: 24, twist: 4, head: headUp(24, 3), look: -2, footF: [-13, 0, 5], footB: [19, 0, 5.6], handF: [3, 1, 10], weapon: 116, roll: 0, yaw: -34, grip: -14, grip2: 22, wind: 0.85, lift: 0.1, phase: 0.3, face: 'shout', fx: { rune: 1, smear: { from: 58, yaw: -6, width: 0.5 } } });
const A2_HOLD = pose(A2_HIT, { y: 9.5, lean: 25, head: headUp(25, 3), handF: [3, 1.5, 10], wind: 0.9, lift: 0.2, phase: 0.45, face: 'grit', fx: { rune: 0.7 } });

const atk2: ChibiPose[] = [
  fromReady(A2_RAISE, 0.9),
  drill(withExtra(thrust(A2_HIT, 1, 3, 22), flash(1)), 1, 0.2, 16, 6),
  drill(A2_HOLD, 0.6, 0.45, 18, 6),
  pose(A2_HOLD, { x: 5, y: 8, lean: 18, head: headUp(18), handF: [0, 8, 9], weapon: 100, yaw: -30, grip2: 20, wind: 0.6, lift: 0.4, phase: 0.6, face: 'stern', fx: { rune: 0.4 } }),
  settle(A2_HOLD, 0.55, { wind: 0.68, lift: 0.25, phase: 0.75, face: 'stern', fx: undefined }),
  settle(A2_HOLD, 0.82, { wind: 0.75, lift: 0.1, phase: 0.9, fx: undefined }),
  settle(A2_HOLD, 0.94, { wind: 0.78, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: a real coil (low, the haft drawn right back, the torso wound round), then a hop in and a
// long lunge, the right hand sliding to the butt end so the point reaches its farthest; a flash
// and a burst of violet energy at the point, a spiral of it off the point, dust.
const A3_COIL = pose(READY, { x: -6, y: 12, lean: 6, twist: 34, head: headUp(6, 4), look: -8, footF: [-15, 0, 5.2], footB: [8, 0, 5.6], handF: [-14, 16, 8], weapon: 50, yaw: -26, grip: -10, grip2: 10, wind: 0.3, sway: 0.3, face: 'grit', fx: { rune: 0.6 } });
const A3_COIL2 = pose(A3_COIL, { x: -7, y: 13.5, lean: 8, twist: 38, head: headUp(8, 4), handF: [-15, 16.5, 8], weapon: 46, grip2: 9, wind: 0.35, lift: 0.2, phase: 0.1, fx: { rune: 0.9, aura: 0.3 } });
const A3_LEAP = pose(READY, { x: 6, y: 0, lean: 16, twist: 10, head: headUp(16), look: -4, footF: [-16, -4, 5], footB: [14, -6, 5.4], handF: [0, 13, 6], weapon: 74, yaw: -34, grip: -22, grip2: 6, wind: 0.9, lift: 0.35, phase: 0.25, face: 'shout', fx: { rune: 1, aura: 0.4, speed: 0.6 } });
const A3_LUNGE = pose(READY, { x: 12, y: 11, lean: 24, twist: 2, head: headUp(24), look: -2, footF: [-12, 0, 5], footB: [23, 0, 5.8], handF: [12, 11, 4], weapon: 80, yaw: -36, grip: -26, grip2: 14, wind: 1.1, phase: 0.4, face: 'shout', fx: { rune: 1, aura: 0.3, dust: 1 } });
const A3_HOLD = pose(A3_LUNGE, { y: 11.5, lean: 25, head: headUp(25), handF: [12, 11.5, 4], wind: 0.9, lift: 0.2, phase: 0.55, face: 'grit', fx: { rune: 0.8, dust: 0.6 } });

/** A burst of violet energy thrown out round the point (strength k): white and violet streaks in a ring. */
export const burst =
  (k: number) =>
  (x: FxContext): void => {
    const p = x.proj(x.tip);
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + x.hash(i, 131) * 0.4;
      const r0 = 7 + 4 * k;
      const r1 = r0 + (6 + x.hash(i, 132) * 9) * k;
      glowLine(x.c, [p[0] + Math.cos(th) * r0, p[1] + Math.sin(th) * r0 * 0.75], [p[0] + Math.cos(th) * r1, p[1] + Math.sin(th) * r1 * 0.75], i % 2 ? x.aura.core : x.aura.hot, 0.9 * Math.min(1, k));
    }
  };

const atk3: ChibiPose[] = [
  fromReady(A3_COIL, 0.85),
  A3_COIL2,
  drill(thrust(A3_LEAP, 0.7, 3.5, 28), 0.6, 0.1, 18, 6),
  drill(withExtra(withExtra(thrust(A3_LUNGE, 1, 4.5, 36), flash(1.2)), burst(1)), 1.3, 0.3, 36, 9),
  drill(withExtra(thrust(A3_HOLD, 0.45, 4.5, 36), burst(0.6)), 0.85, 0.55, 38, 9),
  drill(pose(A3_HOLD, { y: 11, lean: 22, head: headUp(22), handF: [10, 12, 5], wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4, dust: 0.3 } }), 0.3, 0.8, 38, 9),
  pose(A3_HOLD, { x: 9, y: 9.5, lean: 18, head: headUp(18), handF: [6, 13.5, 6], weapon: 72, grip: -18, grip2: 16, wind: 0.45, lift: 0.3, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.7, { wind: 0.68, lift: 0.15, phase: 1, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.92, { wind: 0.78, lift: 0.05, phase: 1.1, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
