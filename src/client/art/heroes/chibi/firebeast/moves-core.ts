/**
 * The Firebeast's core moves: stances, its loping run and the three claw strikes the Warden's
 * basic attack becomes (each potency 1000). Poses use the chibi pose format (rig.ts, ChibiPose)
 * with the beast's own `fire` (fire.ts `BeastPose`): side-plane points, hands from the base of the
 * neck, the claws' angle (`weapon` for the right hand's, `weaponB` for the left's: 0 up, 90
 * forward, 180 down), and the fire, cloth and tail's `wind`/`lift`/`phase`.
 *
 *   idle    8  hunched and hulking, arms hanging, claws loose: the body held still between two
 *              breaths (the shoulders a pixel higher on the in-breath), a puff of flame and smoke at
 *              its lips on the out-breath; only its fire flickers every frame
 *   battle  8  a low crouched snarl, both claws up at its chest either side of the snarl, bouncing
 *              on its hocks
 *   move    8  a loping run on two legs, the body pitched forward, the arms swinging long, the mane
 *              and tail streaming
 *   atk1    7  (1 wind-up) the right claw reared back high, then raked down across in front: a
 *              falling crescent over it
 *   atk2    7  (1 wind-up) a rising backhand with the left claw, scooped from low behind its hip
 *              along the floor and up ahead of it: a crescent under and ahead of it, rising
 *   atk3    9  (2 wind-up) rearing up and back, both arms high over its head, then a lunging maul:
 *              both claws raked down from above its shoulders into the floor, fire bursting up
 *              there with a pale violet shock ring
 *
 * Each strike has an anticipation, a smear frame, an impact frame and a recovery into the battle
 * stance's first frame, short enough that the chain can run a strike every 0.45 s. Its slash of
 * fire (`swipe`, fire.ts `slash`) sweeps round the striking shoulder from where the claws were at
 * the start of the swing to where they are, so the whole stroke shows as one great arc of fire
 * that then fades. The fire burns higher as it strikes (`fire`).
 */
import type { RGB, Vec } from '../../paint.js';
import { puff as puffC } from '../fx.js';
import { add3, type ChibiPose, type FxContext, mix, norm3, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { FIREBEAST } from './design.js';
import { type BeastPose, dither, FIRE_RAMP, flare, lick as lickC, slash } from './fire.js';

/** The fire ramp (the Warden's), hottest first, and the smoke a gout breaks up into. */
const [W_HOT_C, GOLD_C, FLAME_C, ORANGE_C, RED_C] = FIRE_RAMP;
const SMOKE_C: RGB = [110, 100, 104];

const BUILD = FIREBEAST.build;
const REACH = FIREBEAST.weapon.reach[1];

/** A pose with some fields changed (as rig.ts `pose`, for the beast's own). */
export const beast = (base: BeastPose, over: Partial<BeastPose>): BeastPose => ({ ...base, ...over });

/** In-betweens of two of the beast's poses (rig.ts `mix`, with its fire blended too). */
export const blend = (a: BeastPose, b: BeastPose, k: number): BeastPose => ({ ...mix(a, b, k), fire: (a.fire ?? 1) + ((b.fire ?? 1) - (a.fire ?? 1)) * k });

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * Where a smear starts for a blow struck from pose `a` to pose `b` with one hand's claws (the
 * right's, or the left's with `off`): the angle, roll and yaw that point from b's hand (the
 * smear's centre) at the claws' reach in pose a, so the arc of fire begins where the claws were,
 * on the side of a's own angle. For the left hand the angles come out mirrored, as `weaponB`'s are.
 */
export function trail(a: ChibiPose, b: ChibiPose, off = false): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, 0);
  const rb = solveRig(BUILD, b, 0);
  const ga = off ? ra.offhand : ra.weapon;
  const gb = off ? rb.offhand : rb.weapon;
  const tip = turnPoint(add3(ga.o, ga.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  let d = norm3(sub3(tip, gb.o));
  // The left hand's angles are mirrored: solve for its mirror image on the right.
  if (off) d = [d[0], d[1], -d[2]];
  const wrap = (x: number, near: number): number => x + 360 * Math.round((near - x) / 360);
  const a0 = off ? { from: a.weaponB ?? 160, roll: a.rollB ?? 0, yaw: a.yawB ?? 0 } : { from: a.weapon, roll: a.roll ?? 0, yaw: a.yaw ?? 0 };
  let best = { ...a0, cost: Infinity };
  for (let yaw = -80; yaw <= 80; yaw += 2) {
    const cy = Math.cos(rad(yaw));
    if (Math.abs(d[0]) > cy) continue;
    const st = d[0] / cy;
    for (const sign of [1, -1]) {
      const ct = sign * Math.sqrt(1 - st * st);
      const from = wrap((Math.atan2(st, ct) * 180) / Math.PI, a0.from);
      const roll = wrap(((Math.atan2(d[2], d[1]) - Math.atan2(st * Math.sin(rad(yaw)), ct)) * 180) / Math.PI, a0.roll);
      const cost = Math.abs(from - a0.from) + Math.abs(roll - a0.roll) + Math.abs(yaw - a0.yaw);
      if (cost < best.cost) best = { from, roll, yaw, cost };
    }
  }
  return { from: best.from, roll: best.roll, yaw: best.yaw };
}

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/** Hunched at ease: arms hanging long, claws loose by its knees, its weight back on its hocks. */
export const AT_EASE: BeastPose = {
  x: 0,
  y: 3,
  lean: 26,
  twist: 4,
  head: -18,
  look: 2,
  footF: [3, 0, 7.4],
  footB: [-7, 0, 6.6],
  handF: [10, 20, 14],
  handB: [7, 21, 13],
  weapon: 150,
  roll: 10,
  weaponB: 150,
  rollB: 10,
  wind: 0.08,
};

/**
 * The battle stance: crouched low and wide, pitched forward, both claws up and spread ahead of it
 * (the right a little higher), snarling. The skill and state clips start and end on it.
 */
export const READY: BeastPose = {
  x: 0,
  y: 7,
  lean: 32,
  twist: -4,
  head: -24,
  look: -2,
  footF: [9, 0, 8],
  footB: [-9, 0, 7.4],
  handF: [16, 3, 12],
  handB: [14, 5, 11],
  weapon: 30,
  roll: 30,
  yaw: 0,
  weaponB: 34,
  rollB: 30,
  yawB: 0,
  face: 'grit',
  wind: 0.2,
  fire: 1.1,
};

/**
 * Into the battle stance: k of the way from a pose to the battle loop's first frame (where the
 * loop takes over), then `over` on top. The strikes' recoveries and the skill and state clips that
 * give way to the stance end with it.
 */
export const settle = (p: BeastPose, k: number, over: Partial<BeastPose> = {}): BeastPose => beast(blend(p, battle[0] as BeastPose, k), over);

/** Out of the battle stance: k of the way from the battle loop's first frame to a pose, then `over` on top. */
export const fromReady = (p: BeastPose, k: number, over: Partial<BeastPose> = {}): BeastPose => beast(blend(battle[0] as BeastPose, p, k), over);

// ── Fire from its jaws ───────────────────────────────────────────────────────────────────────

/** Where its mouth is and which way its breath leaves it (hero space). */
function mouthOf(x: FxContext): { mouth: V3; fwd: V3 } {
  const h = x.rig.head;
  return { mouth: add3(add3(h.o, h.f, 15.5), h.u, -8), fwd: norm3(add3(h.f, h.u, -0.15)) };
}

/**
 * Fire from its jaws, `k` 0 to 1 (`len` long): a billowing gout, narrow and white-hot at the
 * jaws, widening into rolling puffs of gold and orange with a ragged, flickering red edge, and
 * breaking up into embers and smoke at its end. Seen side on it pours out ahead of it; coming at
 * the viewer it is a broad round flare under the face (the mouth white-hot); going away from the
 * viewer it is behind the head, its glow and tongues spilling out on both sides of it.
 */
export const jaws =
  (k: number, len = 30) =>
  (x: FxContext): void => {
    if (k <= 0) return;
    const { c, proj, cam, hash, rig } = x;
    const { mouth, fwd } = mouthOf(x);
    const ph = (rig.pose.phase ?? 0) * Math.PI * 2;
    const base = proj(mouth);
    const toward = cam.facing(fwd);
    const L = len * (0.55 + 0.45 * k);
    const R = 2.5 + L * 0.25;
    // Each puff: a ragged disc in bands, its edge licking with the phase.
    const disc = (cx: number, cy: number, r: number, t: number, a: number, under: boolean): void => {
      const ring = (d: number, ang: number): number => d / (r * (0.82 + 0.18 * Math.sin(ang * 5 + ph * 3 + t * 7)));
      for (let dy = -Math.ceil(r * 1.1); dy <= Math.ceil(r * 1.1); dy++) {
        for (let dx = -Math.ceil(r * 1.1); dx <= Math.ceil(r * 1.1); dx++) {
          const f = ring(Math.hypot(dx, dy), Math.atan2(dy, dx));
          if (f > 1) continue;
          const heat = f * 0.6 + t * 0.7;
          const col = heat < 0.3 ? W_HOT_C : heat < 0.55 ? GOLD_C : heat < 0.8 ? FLAME_C : heat < 1.05 ? ORANGE_C : RED_C;
          if (t > 0.75 && dither(Math.floor(cx + dx), Math.floor(cy + dy)) > a * (1.6 - t)) continue;
          c.glow(cx + dx, cy + dy, col, 1, under);
        }
      }
    };
    if (toward > 0.55) {
      // Coming at the viewer: a broad flare under the face, the mouth white-hot at its heart.
      const r = R * 1.5;
      disc(base[0], base[1] + r * 0.55, r, 0.15, k, false);
      for (let i = 0; i < 9; i++) {
        const th = (i / 9) * Math.PI * 2 + ph;
        lickC(c, base[0] + Math.cos(th) * r * 0.9, base[1] + r * 0.55 + Math.sin(th) * r * 0.7, 4 + hash(i, 61) * 6 * k, 1.5, Math.cos(th) * 1.5, 0.9, false);
      }
      disc(base[0], base[1] + 1, 2.2, 0, 1, false);
      return;
    }
    if (toward < -0.55) {
      // Going away: behind the head, only what spills out round it shows.
      const r = R * 1.3;
      const p = proj(add3(mouth, fwd, L * 0.3));
      for (const s of [-1, 0, 1]) disc(p[0] + s * r * 0.9, p[1] + Math.abs(s) * 2, r, 0.25 + Math.abs(s) * 0.25, k, true);
      return;
    }
    // Side on: puffs along the way it faces, each larger and cooler than the last.
    const under = x.behind(add3(mouth, fwd, 8)) && x.behind(rig.head.o);
    const n = 10;
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      const along = proj(add3(mouth, fwd, L * Math.pow(t, 0.9)));
      const d: Vec = [along[0] - base[0], along[1] - base[1]];
      const dl = Math.hypot(d[0], d[1]) || 1;
      const wob = Math.sin(ph * 3 + i * 1.7) * R * 0.35 * t;
      const r = (1.4 + R * Math.pow(t, 0.8)) * (0.85 + 0.3 * hash(i, 63));
      disc(along[0] - (d[1] / dl) * wob, along[1] + (d[0] / dl) * wob - t * t * 4, r, t, k, under);
    }
    // Embers and smoke where it breaks up.
    const end = proj(add3(mouth, fwd, L));
    for (let i = 0; i < 8; i++) {
      const ex = end[0] + (hash(i, 64) - 0.3) * R * 2.4;
      const ey = end[1] - hash(i, 65) * R * 2 - 2;
      if (i % 3 === 0) puffC(c, ex, ey - 3, 2 + hash(i, 66) * 2, SMOKE_C, 0.35 * k, under);
      else c.glow(ex, ey, i % 2 ? GOLD_C : ORANGE_C, 0.9 * k, under);
    }
  };

/** A small puff of flame and smoke at its lips (the idle's out-breath), `k` its strength. */
export const puff =
  (k: number) =>
  (x: FxContext): void => {
    const { c, proj, rig, cam } = x;
    const { mouth, fwd } = mouthOf(x);
    if (cam.facing(fwd) < -0.3) return;
    const p = proj(add3(mouth, fwd, 2));
    const ph = (rig.pose.phase ?? 0) * Math.PI * 2;
    puffC(c, p[0] + 1, p[1], 1.8 * k + 0.6, ORANGE_C, 0.95, false);
    puffC(c, p[0] + 1, p[1], 1 * k, GOLD_C, 1, false);
    for (let i = 0; i < 3; i++) puffC(c, p[0] + 2 + Math.sin(ph + i) * 1.5, p[1] - 4 - i * 4 * k, 1.4 + i * 0.8, SMOKE_C, 0.32 * k, false);
  };

/** How far along the claws their points are, from the fist. */
const CLAW_TIP = 17;

/**
 * The slash of fire a strike leaves (fire.ts `slash`): round the striking shoulder through where
 * the claws' points were in each pose of `path` (the swing's start, then on to this pose, last),
 * the right hand's or the left's (`off`), `k` its strength and `thick` its depth.
 */
export const swipe =
  (path: readonly ChibiPose[], k: number, off = false, thick = 15, over = 1.3) =>
  (x: FxContext): void => {
    const last = path[path.length - 1] as ChibiPose;
    const tips = path.map((p) => {
      const r = solveRig(BUILD, p, 0);
      const g = off ? r.offhand : r.weapon;
      return turnPoint(add3(g.o, g.u, CLAW_TIP), (p.turn ?? 0) - (last.turn ?? 0));
    });
    const arm = off ? x.rig.armL : x.rig.armR;
    const head = x.proj(x.rig.head.o);
    slash(x, arm.root, tips, { k, thick, over, seed: off ? 7 : 0, skip: (px, py) => Math.hypot(px - head[0], py - head[1]) < 12.5 });
  };

/** Paints several effects painters in turn. */
export const both =
  (...fs: ((x: FxContext) => void)[]) =>
  (x: FxContext): void => {
    for (const f of fs) f(x);
  };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): BeastPose => {
  // The body holds still between two breaths, the shoulders a pixel higher on the in-breath (the
  // first four frames) than on the out-breath, which ends in a puff of flame and smoke at its lips;
  // only its fire flickers every frame.
  const b = i < 4 ? 1 : 0;
  return beast(AT_EASE, {
    y: 4 - b,
    lean: 26 - b * 1.5,
    head: -18 - b * 2,
    phase: i / 8,
    wind: 0.1,
    face: i === 6 || i === 7 ? 'shout' : 'stern',
    fire: 1 + b * 0.12,
    fx: i === 6 || i === 7 ? { extra: puff(i === 6 ? 1 : 0.6) } : undefined,
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): BeastPose => {
  // Down on the beat and springing back on its hocks, the claws flexing; the head and the fire
  // lag a frame behind.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return beast(READY, {
    y: 6 + b * 3,
    lean: 31 + b * 2,
    head: -25 + bounce(i - 1) * 3,
    handF: [16, 2 + b * 2, 12],
    handB: [14, 4 + b * 2, 11],
    weapon: 28 + b * 8,
    weaponB: 32 + b * 8,
    wind: 0.2 + Math.max(0, lag) * 0.2,
    lift: lag * 0.8,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
  });
});

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [13, 0], b: [-11, -7], y: 3 },
  { f: [7, 0], b: [-9, -12], y: 5 },
  { f: [-1, 0], b: [3, -10], y: 2 },
  { f: [-8, -2], b: [11, -5], y: -2 },
];

const move = Array.from({ length: 8 }, (_, i): BeastPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 3,
    y: k.y,
    lean: 40 + (i % 4 === 1 ? 3 : 0),
    twist: swing * 12,
    head: -32,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 6.6] : [k.b[0], k.b[1], 6.6],
    footB: right ? [k.b[0], k.b[1], 6.2] : [k.f[0], k.f[1], 6.2],
    // The arms swing long against the legs, the claws trailing.
    handF: [6 - swing * 10, 21 - Math.abs(swing) * 3, 12],
    handB: [6 + swing * 10, 21 - Math.abs(swing) * 3, 11],
    weapon: 160 - swing * 40,
    weaponB: 160 + swing * 40,
    wind: 1,
    phase: i / 8,
    sway: swing * 0.25,
    fire: 1.1,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The strikes ──────────────────────────────────────────────────────────────────────────────

/** A strike's frame: its slash of fire swept from the swing's start (`path`) to this pose. */
const strike = (path: readonly BeastPose[], p: BeastPose, k: number, off = false, thick = 15): BeastPose => ({ ...p, fx: { ...p.fx, rune: 1, runeB: 1, extra: swipe([...path, p], k, off, thick) } });

// atk1: the right claw reared back high behind its shoulder, raked down across in front.
const A1_COCK = beast(READY, { x: -2, y: 6, lean: 18, twist: 28, head: -20, look: 4, handF: [-4, -4, 16], handB: [14, 12, 8], weapon: -30, roll: 30, yaw: 0, wind: 0.25, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fire: 1.2 });
const A1_SWING = beast(READY, { x: 3, y: 7, lean: 30, twist: 0, head: -24, handF: [16, 4, 10], handB: [12, 15, 8], weapon: 70, roll: 36, yaw: 0, wind: 0.5, phase: 0.25, face: 'shout', fire: 1.35 });
const A1_HIT = beast(READY, { x: 7, y: 10, lean: 40, twist: -22, head: -30, look: -4, footF: [15, 0, 8.4], footB: [-11, 0, 7.4], handF: [20, 20, -2], handB: [10, 16, 9], weapon: 140, roll: 40, yaw: 0, wind: 0.85, phase: 0.4, face: 'shout', fire: 1.45, fx: { impact: 1.1, dust: 0.7 } });
const A1_FOLLOW = beast(A1_HIT, { y: 11, lean: 42, twist: -26, handF: [19, 23, -4], weapon: 152, wind: 0.95, lift: 0.2, phase: 0.55, face: 'grit', fire: 1.3, fx: { dust: 0.4 } });

const atk1: BeastPose[] = [
  A1_COCK,
  strike([A1_COCK], A1_SWING, 0.9, false, 16),
  strike([A1_COCK, A1_SWING], A1_HIT, 1, false, 24),
  strike([A1_COCK, A1_SWING, A1_HIT], A1_FOLLOW, 0.55, false, 20),
  beast(A1_FOLLOW, { y: 10, lean: 38, twist: -18, handF: [18, 19, 0], weapon: 140, wind: 0.6, lift: 0.4, phase: 0.7, face: 'grit', fire: 1.2, fx: undefined }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, fx: undefined }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: a rising backhand with the left claw: from low behind its hip, scooped forward along the
// floor and flung up ahead of it, so its slash is a bowl under and ahead of it rising to its head
// (atk1's is a dome over it, falling).
const A2_COCK = beast(READY, { x: -1, y: 10, lean: 36, twist: -24, head: -26, look: -4, handF: [14, 10, 14], handB: [-8, 26, 8], weaponB: 210, rollB: -20, yawB: 0, weapon: 40, wind: 0.25, lift: 0.1, sway: -0.3, phase: 0.1, face: 'grit', fire: 1.2 });
const A2_SWING = beast(READY, { x: 4, y: 11, lean: 40, twist: -4, head: -26, handF: [12, 12, 13], handB: [12, 30, 8], weaponB: 120, rollB: -20, yawB: 0, weapon: 50, wind: 0.5, phase: 0.25, face: 'shout', fire: 1.35 });
const A2_HIT = beast(READY, { x: 7, y: 6, lean: 22, twist: 22, head: -22, look: 4, footF: [15, 0, 8.4], footB: [-11, -1, 7.4], handF: [10, 14, 13], handB: [20, 2, 12], weaponB: 40, rollB: -20, yawB: 0, weapon: 60, wind: 0.8, lift: 0.3, phase: 0.4, face: 'shout', fire: 1.45, fx: { impactB: 1 } });
const A2_FOLLOW = beast(A2_HIT, { y: 5, lean: 16, twist: 26, handB: [14, -8, 14], weaponB: 10, wind: 0.9, lift: 0.5, phase: 0.55, face: 'grit', fire: 1.3 });

const atk2: BeastPose[] = [
  A2_COCK,
  strike([A2_COCK], A2_SWING, 0.9, true, 16),
  strike([A2_COCK, A2_SWING], A2_HIT, 1, true, 24),
  strike([A2_COCK, A2_SWING, A2_HIT], A2_FOLLOW, 0.55, true, 20),
  beast(A2_FOLLOW, { y: 7, lean: 24, twist: 20, handB: [12, 0, 14], weaponB: 30, wind: 0.55, lift: 0.5, phase: 0.7, face: 'grit', fire: 1.2, fx: undefined }),
  settle(A2_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, fx: undefined }),
  settle(A2_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: rearing up and back on its haunches, both arms raised high over its head, elbows out and
// claws spread, then a lunging maul: both claws raked down together from above its shoulders into
// the floor ahead of it, fire bursting up there with the Warden's pale violet shock ring.
const A3_REAR = beast(READY, { x: -4, y: 4, lean: 2, twist: 0, head: -16, look: 0, footF: [7, 0, 8], footB: [-10, 0, 7.4], handF: [-8, -25, 16], handB: [-8, -25, 16], elbowF: [-0.3, 0.2, 1], elbowB: [-0.3, 0.2, 1], weapon: -8, roll: 34, yaw: 0, weaponB: -12, rollB: 24, yawB: 0, wind: 0.3, lift: 0.3, phase: 0.05, face: 'shout', fire: 1.3 });
const A3_TOP = beast(A3_REAR, { x: -5, y: 2, lean: -6, head: -10, handF: [-10, -28, 16], handB: [-10, -28, 16], weapon: -20, weaponB: -20, roll: 40, rollB: 40, lift: 0.5, phase: 0.15, fire: 1.5, fx: { aura: 0.3 } });
const A3_DIVE = beast(READY, { x: 5, y: 5, lean: 30, twist: 0, head: -24, footF: [14, 0, 8.4], footB: [-12, -2, 7.4], handF: [12, -6, 14], handB: [12, -6, 14], elbowF: [-0.3, -0.4, 1], elbowB: [-0.3, -0.4, 1], weapon: 50, roll: 20, yaw: 0, weaponB: 50, rollB: 20, yawB: 0, wind: 0.7, lift: 0.1, phase: 0.3, face: 'shout', fire: 1.5 });
const A3_SLAM = beast(READY, { x: 10, y: 12, lean: 48, twist: 0, head: -34, footF: [18, 0, 8.6], footB: [-12, 0, 7.4], handF: [22, 24, 9], handB: [22, 24, 9], weapon: 150, roll: 10, yaw: 0, weaponB: 150, rollB: 10, yawB: 0, wind: 0.9, lift: 0.4, phase: 0.45, face: 'shout', fire: 1.6, fx: { impact: 1.5, shock: 0.05, dust: 1 } });
const A3_HOLD = beast(A3_SLAM, { y: 13, lean: 50, handF: [22, 26, 9], handB: [22, 26, 9], weapon: 156, weaponB: 156, wind: 0.6, lift: 0.2, phase: 0.6, face: 'grit', fire: 1.4, fx: { shock: 0.45, dust: 0.7 } });

/** Both claws' slashes at once, and (`burst`, 0 to 1 as it flies out) fire bursting up where they strike the floor. */
const maul = (path: readonly BeastPose[], p: BeastPose, k: number, thick: number, burst = 0): BeastPose => ({
  ...p,
  fx: { ...p.fx, rune: 1, runeB: 1, extra: both(swipe([...path, p], k, false, thick, 1.14), swipe([...path, p], k, true, thick, 1.14), struck(burst)) },
});

/** Fire bursting up from the floor between its claws as they strike it (fire.ts `flare`), `k` 0 to 1 as it flies out. */
const struck =
  (k: number) =>
  (x: FxContext): void => {
    if (k <= 0) return;
    const { armR, armL } = x.rig;
    const head = x.proj(x.rig.head.o);
    flare(x, [(armR.end[0] + armL.end[0]) / 2 + 4, 3, (armR.end[2] + armL.end[2]) / 2], k, { n: 12, len: 44, ring: 1, skip: (px, py) => Math.hypot(px - head[0], py - head[1]) < 12 });
  };

const atk3: BeastPose[] = [
  A3_REAR,
  A3_TOP,
  maul([A3_TOP], A3_DIVE, 0.9, 16),
  maul([A3_TOP, A3_DIVE], A3_SLAM, 1, 24, 0.12),
  maul([A3_TOP, A3_DIVE, A3_SLAM], A3_HOLD, 0.5, 20, 0.42),
  beast(A3_HOLD, { y: 12, lean: 46, phase: 0.75, face: 'grit', fire: 1.3, fx: { shock: 0.85, dust: 0.3, extra: struck(0.75) } }),
  settle(A3_HOLD, 0.45, { phase: 0.85, wind: 0.35, lift: 0.2, fx: undefined }),
  settle(A3_HOLD, 0.75, { phase: 0.95, wind: 0.28, lift: 0.1, fx: undefined }),
  settle(A3_HOLD, 0.92, { phase: 1.05, wind: 0.22, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
