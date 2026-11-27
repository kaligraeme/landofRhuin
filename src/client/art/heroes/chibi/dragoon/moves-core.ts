/**
 * The Dragoon's core moves: stances, running and the three-thrust combo. Poses use the chibi
 * pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the
 * lance's angle (0 up, 90 forward), its plane's `roll` and `yaw`, both hands' places along the
 * haft (`grip` the right hand's, `grip2` the left's), and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, weight on his back foot, the lance resting on his right shoulder and
 *              sloping up and back behind him, his left thumb in his belt: a slow breath, a
 *              blink, the cape and ponytail swaying
 *   battle  8  a low, bladed spear stance, left foot and left hand leading, the right hand on the
 *              haft by his hip, the point forward and up; a quick, springy bounce on his toes, the
 *              point bobbing, head, cape and hair a frame behind
 *   move    8  a sprint: long strides, a hard lean, the lance held near its butt in his right
 *              hand and trailing level behind him, the left arm pumping, the cape and ponytail
 *              streaming
 *   atk1    7  (1 wind-up) a straight, low thrust: drawn back with the point lifted, driven out
 *              with a stamp of the lead foot, the left hand sliding up the haft
 *   atk2    7  (1 wind-up) an overhand thrust: the haft cocked high by his ear, rear elbow up,
 *              the point angled down, and driven forward and down
 *   atk3    9  (2 wind-up) a deep coil, then a hop in and a long lunge from the butt end of the
 *              haft for the farthest reach: a flash and a burst of violet energy at the point, dust
 *
 * Thrusts leave a spiral of violet energy off the point (`drill` below) and violet streaks along
 * the path of the point (`streak`), with a white-hot flash at the point as they land (`flash`);
 * each has an anticipation, a strike, a held extension and a recovery into the battle stance
 * (`settle`), with the cape and ponytail streaming hardest a frame after the strike. Every effect
 * is painted in the design's aura: violet, a pale lilac edge and a white-hot core. The skill and state clips (moves-skills.ts, moves-states.ts) start from the stance
 * (`fromReady`) and those that hand back to it end in it (`settle`).
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { glowLine, puff, starburst, swirl } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, type FxContext, mix, pose, solveRig, type V3, wave } from '../rig.js';
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
 * At ease, weight on his back foot: the lance resting on his right shoulder and sloping up and
 * back behind him, its head high over his back, his right hand on the haft at his collarbone, the
 * left thumb hooked in his belt. The haft crosses him at the shoulder, clear of his face in every
 * view.
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
  handF: [5, 3, 8.4],
  handB: [0, 17, 6.5],
  weapon: -62,
  roll: 18,
  yaw: -24,
  grip: -28,
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
 * A pose with a drill of violet energy spiralling off its point (`fx.swirl`'s spiral, painted through
 * `fx.extra`): from a little behind the point to `len` past it, `radius` round and narrowing a
 * little, with a white-hot core along its first stretch; `k` its strength and `spin` how far its
 * streaks have run on (advance it frame by frame). A longer drill turns more times. Toward the
 * viewer a thrust's point runs down the screen, so the drill stops short where it would run on
 * under his feet: it ends no lower on screen than a few pixels under the ground he stands on, and
 * never below the floor itself.
 */
export function drill(p: ChibiPose, k: number, spin: number, len = 34, radius = 9): ChibiPose {
  const paint = (x: FxContext): void => {
    const w = x.rig.weapon;
    const from = add3(w.o, w.u, TIP - 12);
    const foot = x.proj([x.rig.pelvis.o[0], 0, x.rig.pelvis.o[2]])[1] + 4;
    let L = len + 12;
    for (let i = 0; i < 40 && L > 8; i++) {
      const end = add3(from, w.u, L);
      if (end[1] > radius * 0.5 + 1 && x.proj(end)[1] <= foot) break;
      L *= 0.92;
    }
    const to = add3(from, w.u, L);
    swirl(x, from, to, k, { radius, taper: 0.55, turns: 1 + L / 26, spin, strands: 3 });
    // A white-hot core along the first stretch past the point, fading as it goes.
    const a = x.proj(add3(w.o, w.u, TIP));
    const b = x.proj(add3(from, w.u, L * 0.7));
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const behind = x.behind(to);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      x.c.glow(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, t < 0.4 ? x.aura.hot : x.aura.core, clamp(k, 0, 1) * 0.7 * (1 - t), behind);
    }
  };
  return withExtra(p, paint);
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
 * gives them), `k` their strength: a few thin lines running parallel to the path either side of
 * it, white-hot toward the point, violet behind, fading toward where the point started (each starts
 * at its own seeded place), with a faint violet wash between them. A thrust's smear: a swoosh is an
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
    // The lines: two either side, of seeded lengths, stopping a little short of the point.
    const lines = [-width, -width * 0.45, width * 0.4, width];
    lines.forEach((s, i) => {
      const t0 = 0.05 + x.hash(i, 151) * 0.4;
      const t1 = 0.92 - x.hash(i, 152) * 0.12;
      const n = Math.ceil(len * (t1 - t0));
      for (let j = 0; j <= n; j++) {
        const t = t0 + ((t1 - t0) * j) / Math.max(1, n);
        const f = (t - t0) / (t1 - t0);
        const col: RGB = f > 0.7 ? x.aura.hot : f > 0.3 ? mixc(x.aura.hot, x.aura.core, 0.5) : x.aura.core;
        const p = at(t, s);
        x.c.glow(p[0], p[1], col, k * (0.25 + 0.75 * f), behind);
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
 * Sparks shed off the glowing point as it rests or moves (strength k): `n` motes of violet light
 * that leave the point's channel and drift back along the lance and up, fading as they go, each
 * a white-hot heart in a violet cross; `phase` (turns: advance it frame by frame) carries them on,
 * each wrapping back to the point when it fades. The trail the reference's lance leaves.
 */
export const sparks =
  (k: number, phase: number, n = 5) =>
  (x: FxContext): void => {
    const { c, aura, hash } = x;
    for (let i = 0; i < n; i++) {
      const t = (((hash(i, 181) + phase * (0.8 + 0.4 * hash(i, 182))) % 1) + 1) % 1;
      const back = 3 + t * 16 + hash(i, 183) * 8;
      const p3 = add3(add3(x.tip, x.dir, -back), [0, 1, 0], t * 12 + (hash(i, 184) - 0.5) * 5);
      const q = x.proj([p3[0], p3[1], p3[2] + (hash(i, 185) - 0.5) * 4]);
      const a = k * Math.min(1, (1 - t) * 1.6) * (0.7 + 0.3 * hash(i, 186));
      const under = x.behind(p3);
      c.glow(q[0], q[1], aura.hot, a, under);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(q[0] + dx, q[1] + dy, aura.core, a * 0.55, under);
    }
  };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles exactly one pixel for the second half of the
  // loop (a whole pixel, so the hair's clumps do not shimmer), the hands with it, while the cape
  // and the ponytail sway slowly round and he blinks once.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 1 + out,
    handF: [5, 3 + out * 0.4, 8.4],
    handB: [0, 17 + out * 0.4, 6.5],
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.16 + wave(i, 8) * 0.14,
    face: i === 6 ? 'closed' : 'smirk',
    fx: { rune: 0.25 + wave(i, 8) * 0.2, extra: sparks(0.55, i / 8, 4) },
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
    fx: { rune: 0.45 + bounce(i - 2) * 0.3, extra: sparks(0.8, i / BOUNCE) },
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
    // The lance trails low behind him in his right hand, held near the butt; the left arm pumps against the legs.
    handF: [-5 - swing * 2, 15 - Math.abs(swing), 9],
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    weapon: -94 + swing * 4,
    roll: 0,
    yaw: -16,
    grip: -26,
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

/** Adds a streak along the path of the point from pose `a`'s tip to pose `b`'s, to b's effects. */
const thrust = (a: ChibiPose, b: ChibiPose, k = 1, width = 3): ChibiPose => withExtra(b, streak(tipOf(a), tipOf(b), k, width));

/**
 * The head's own tip for a pose leaning `lean`, so that the head pitches `pitch` in all (the rig
 * tips the head by half the torso's lean on its own): in a lunge he keeps his head up and his eyes
 * on the foe, and toward the viewer his face stays as open as in the stance rather than showing
 * the crown.
 */
export const headUp = (lean: number, pitch = 3): number => pitch - lean * 0.5;

// Every thrust is drawn back first: the hands pulled to the rear hip and the point lifted, so the
// strike visibly travels in every view (side on the point rises and drops level; toward the
// viewer it lifts beside his shoulder, then drives out and down the screen). The struck point
// ends a little above the line of the stance's guard: toward the viewer that lands it at knee
// to waist height in front of him with the haft's whole length showing across him, not down by
// his feet. Each strike frame gets a white-hot flash at the point and a wide spiral of violet energy.

// atk1: a straight, low thrust. Drawn back, weight on the rear foot, the point up; then the lead
// foot stamps forward, the rear hand drives the haft through and the lead hand slides up it.
const A1_DRAW = pose(READY, { x: -5, y: 7, lean: 2, twist: 30, head: headUp(2, 4), look: -6, footF: [-13, 0, 5], footB: [8, -1, 5.4], handF: [-12, 15, 8], weapon: 48, yaw: -28, grip: -8, grip2: 10, wind: 0.3, lift: 0.1, sway: 0.2, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A1_DRIVE = pose(READY, { x: 3, y: 7, lean: 12, twist: 14, head: headUp(12), look: -4, footF: [-12, 0, 5], footB: [15, 0, 5.4], handF: [2, 13, 6], weapon: 78, yaw: -30, grip: -12, grip2: 20, wind: 0.5, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A1_HIT = pose(READY, { x: 7, y: 8, lean: 18, twist: 6, head: headUp(18), look: -2, footF: [-13, 0, 5], footB: [18, 0, 5.6], handF: [11, 11.5, 4.5], weapon: 83, yaw: -27, grip: -18, grip2: 26, wind: 0.8, phase: 0.4, face: 'shout', fx: { rune: 1 } });
const A1_HOLD = pose(A1_HIT, { y: 8.5, lean: 19, head: headUp(19), handF: [11, 12, 4.5], wind: 0.9, lift: 0.15, phase: 0.55, face: 'grit', fx: { rune: 0.7 } });

const atk1: ChibiPose[] = [
  fromReady(A1_DRAW, 0.85),
  drill(thrust(A1_DRAW, A1_DRIVE, 0.8, 4), 0.7, 0.1, 22),
  drill(withExtra(thrust(A1_DRIVE, A1_HIT, 1, 5), flash(1)), 1.3, 0.3, 40, 11),
  drill(thrust(A1_DRIVE, A1_HOLD, 0.4, 5), 0.7, 0.55, 40, 11),
  pose(A1_HOLD, { x: 5, y: 7.5, lean: 15, head: headUp(15), handF: [6, 13.5, 5.5], weapon: 78, grip: -14, grip2: 22, wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A1_HOLD, 0.6, { wind: 0.68, lift: 0.25, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A1_HOLD, 0.9, { wind: 0.78, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: an overhand thrust. The haft cocked high by his right ear, rear elbow up, the point
// angled steeply down at the foe (steeply enough that the haft runs below his face side on and
// beside it toward the viewer); then driven forward and down from above.
const A2_RAISE = pose(READY, { x: -3, y: 4, lean: -2, twist: 18, head: headUp(-2, 1), look: -6, footF: [-12, 0, 5], footB: [10, 0, 5.4], handF: [-7, -11, 13], weapon: 58, roll: 0, yaw: -6, grip: -4, grip2: 12, wind: 0.3, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.5 } });
const A2_DRIVE = pose(READY, { x: 3, y: 6, lean: 12, twist: 8, head: headUp(12), look: -4, footF: [-12, 0, 5], footB: [15, 0, 5.4], handF: [1, 0, 10], weapon: 104, yaw: -18, grip: -12, grip2: 18, wind: 0.5, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A2_HIT = pose(READY, { x: 7, y: 8, lean: 20, twist: 2, head: headUp(20), look: -2, footF: [-13, 0, 5], footB: [18, 0, 5.6], handF: [8, 6, 8], weapon: 98, yaw: -32, grip: -12, grip2: 26, wind: 0.85, phase: 0.4, face: 'shout', fx: { rune: 1 } });
const A2_HOLD = pose(A2_HIT, { y: 8.5, lean: 21, head: headUp(21), handF: [8, 6.5, 8], wind: 0.9, lift: 0.2, phase: 0.55, face: 'grit', fx: { rune: 0.7 } });

const atk2: ChibiPose[] = [
  fromReady(A2_RAISE, 0.9),
  drill(thrust(A2_RAISE, A2_DRIVE, 0.8, 4), 0.7, 0.15, 22),
  drill(withExtra(thrust(A2_RAISE, A2_HIT, 1, 5), flash(1)), 1.3, 0.35, 36, 11),
  drill(thrust(A2_RAISE, A2_HOLD, 0.4, 5), 0.7, 0.6, 36, 11),
  pose(A2_HOLD, { x: 5, y: 7.5, lean: 15, head: headUp(15), handF: [4, 10, 8], weapon: 88, grip2: 20, wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A2_HOLD, 0.6, { wind: 0.68, lift: 0.25, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A2_HOLD, 0.9, { wind: 0.78, lift: 0.05, phase: 1, fx: undefined }),
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
  drill(thrust(A3_COIL2, A3_LEAP, 0.7, 4), 0.7, 0.1, 24),
  drill(withExtra(withExtra(thrust(A3_COIL2, A3_LUNGE, 1, 5.5), flash(1.2)), burst(1)), 1.4, 0.35, 48, 12),
  drill(withExtra(thrust(A3_COIL2, A3_HOLD, 0.45, 5.5), burst(0.6)), 0.8, 0.6, 48, 12),
  drill(pose(A3_HOLD, { y: 11, lean: 22, head: headUp(22), handF: [10, 12, 5], wind: 0.6, lift: 0.4, phase: 0.7, face: 'stern', fx: { rune: 0.4, dust: 0.3 } }), 0.3, 0.85, 48, 12),
  pose(A3_HOLD, { x: 9, y: 9.5, lean: 18, head: headUp(18), handF: [6, 13.5, 6], weapon: 72, grip: -18, grip2: 16, wind: 0.45, lift: 0.3, phase: 0.85, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.7, { wind: 0.68, lift: 0.15, phase: 1, face: 'stern', fx: undefined }),
  settle(A3_HOLD, 0.92, { wind: 0.78, lift: 0.05, phase: 1.1, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
