/**
 * The Firebeast's core moves: stances, its loping run and the three claw strikes the Warden's
 * basic attack becomes (each potency 1000). Poses use the chibi pose format (rig.ts, ChibiPose)
 * with the beast's own `fire` (fire.ts `BeastPose`): side-plane points, hands from the base of the
 * neck, the claws' angle (`weapon` for the right hand's, `weaponB` for the left's: 0 up, 90
 * forward, 180 down), and the fire, cloth and tail's `wind`/`lift`/`phase`.
 *
 *   idle    8  hunched and hulking, arms hanging, claws loose: a slow heaving breath that lifts its
 *              shoulders, and on the out-breath a lick of fire from its jaws; the mane flickers
 *   battle  8  a low crouched snarl, both claws up and spread ahead of it, bouncing on its hocks
 *   move    8  a loping run on two legs, the body pitched forward, the arms swinging long, the mane
 *              and tail streaming
 *   atk1    7  (1 wind-up) the right claw reared back high, then raked down across in front
 *   atk2    7  (1 wind-up) the left claw swept up from low on its right, a backhand rake
 *   atk3    9  (2 wind-up) up on its haunches, both claws raised, then a lunging maul: both
 *              claws driven down together, a burst of fire and a shockwave
 *
 * Each strike has an anticipation, a smear frame, an impact frame and a recovery into the battle
 * stance's first frame, short enough that the chain can run a strike every 0.45 s. Its slash of
 * fire (`swipe`, fire.ts `slash`) sweeps round the striking shoulder from where the claws were at
 * the start of the swing to where they are, so the whole stroke shows as one great arc of fire
 * that then fades. The fire burns higher as it strikes (`fire`).
 */
import { add3, type ChibiPose, type FxContext, mix, norm3, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { FIREBEAST } from './design.js';
import { type BeastPose, flare, glowTongue, slash } from './fire.js';

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
  handF: [7, 22, 11],
  handB: [3, 23, 10],
  weapon: 168,
  roll: 6,
  weaponB: 168,
  rollB: 6,
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
  handF: [13, 10, 17],
  handB: [10, 13, 16],
  weapon: 18,
  roll: 46,
  yaw: 0,
  weaponB: 24,
  rollB: 46,
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

/**
 * Fire from its jaws, `k` 0 to 1 (a lick of flame on the out-breath; a gout in a roar, `len`
 * long): a cone of flame tongues out of the muzzle along the way it faces, flickering with the
 * pose's phase.
 */
export const jaws =
  (k: number, len = 10) =>
  (x: FxContext): void => {
    const { rig, proj } = x;
    if (k <= 0) return;
    const h = rig.head;
    const mouth = add3(add3(h.o, h.f, 13.5), h.u, -7.4);
    const fwd = norm3(add3(h.f, h.u, -0.1));
    const ph = (rig.pose.phase ?? 0) * Math.PI * 2;
    const base = proj(mouth);
    // Seen from behind, the fire pours out beyond the head, behind the beast; seen face on, it
    // keeps off the eyes.
    const under = x.behind(add3(mouth, fwd, 6)) && x.behind(h.o);
    const eyes = proj(add3(h.o, h.f, 9));
    const skip = x.cam.facing(h.f) > 0.3 ? (px: number, py: number): boolean => py < base[1] - 2 && Math.hypot(px - eyes[0], (py - eyes[1]) * 1.3) < 11 : undefined;
    for (const [spread, kl, w] of [[-0.3, 0.7, 0.7], [0.3, 0.75, 0.7], [0, 1, 1]] as const) {
      const tip = proj(add3(mouth, norm3(add3(add3(fwd, h.r, spread), h.u, spread * 0.5)), 10));
      const flick = 0.85 + 0.15 * Math.sin(ph * 3 + spread * 9);
      glowTongue(x, base, [tip[0] - base[0], tip[1] - base[1]], len * k * kl * flick, (3 + len * 0.18) * w * (0.6 + 0.4 * k), Math.sin(ph * 2 + spread * 5) * 0.4, Math.min(1, k * 1.3), skip, under);
    }
  };

/** How far along the claws their points are, from the fist. */
const CLAW_TIP = 15.5;

/**
 * The slash of fire a strike leaves (fire.ts `slash`): round the striking shoulder through where
 * the claws' points were in each pose of `path` (the swing's start, then on to this pose, last),
 * the right hand's or the left's (`off`), `k` its strength and `thick` its depth.
 */
export const swipe =
  (path: readonly ChibiPose[], k: number, off = false, thick = 15) =>
  (x: FxContext): void => {
    const last = path[path.length - 1] as ChibiPose;
    const tips = path.map((p) => {
      const r = solveRig(BUILD, p, 0);
      const g = off ? r.offhand : r.weapon;
      return turnPoint(add3(g.o, g.u, CLAW_TIP), (p.turn ?? 0) - (last.turn ?? 0));
    });
    const arm = off ? x.rig.armL : x.rig.armR;
    const head = x.proj(x.rig.head.o);
    slash(x, arm.root, tips, { k, thick, seed: off ? 7 : 0, skip: (px, py) => Math.hypot(px - head[0], py - head[1]) < 12.5 });
  };

/** Paints several effects painters in turn. */
export const both =
  (...fs: ((x: FxContext) => void)[]) =>
  (x: FxContext): void => {
    for (const f of fs) f(x);
  };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): BeastPose => {
  // A heaving breath: the shoulders rise a pixel and the head lifts on the in-breath, then sink
  // as it breathes out a lick of fire.
  const b = wave(i, 8);
  return beast(AT_EASE, {
    y: 3 - b * 1,
    lean: 26 - b * 2,
    head: -18 - b * 3,
    handF: [7, 22 + b * 0.6, 11],
    handB: [3, 23 + b * 0.6, 10],
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.08 + b * 0.06,
    face: i === 6 || i === 7 ? 'shout' : 'stern',
    fire: 1 + b * 0.15,
    fx: i === 6 || i === 7 ? { extra: jaws(i === 6 ? 1 : 0.55, 16) } : undefined,
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
    handF: [13, 9 + b * 2, 17],
    handB: [10, 12 + b * 2, 16],
    weapon: 16 + b * 8,
    weaponB: 22 + b * 8,
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
  strike([A1_COCK], A1_SWING, 0.9, false, 14),
  strike([A1_COCK, A1_SWING], A1_HIT, 1, false, 21),
  strike([A1_COCK, A1_SWING, A1_HIT], A1_FOLLOW, 0.55, false, 18),
  beast(A1_FOLLOW, { y: 10, lean: 38, twist: -18, handF: [18, 19, 0], weapon: 140, wind: 0.6, lift: 0.4, phase: 0.7, face: 'grit', fire: 1.2, fx: undefined }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, fx: undefined }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk2: the left claw swept up and out from low across its right side, a backhand rake.
const A2_COCK = beast(READY, { x: 1, y: 9, lean: 34, twist: -26, head: -24, look: -4, handF: [14, 12, 13], handB: [12, 22, -6], weaponB: 160, rollB: -30, yawB: 0, weapon: 70, wind: 0.25, lift: 0.1, sway: -0.3, phase: 0.1, face: 'grit', fire: 1.2 });
const A2_SWING = beast(READY, { x: 4, y: 7, lean: 30, twist: 0, head: -24, handF: [12, 14, 12], handB: [17, 8, 8], weaponB: 80, rollB: -30, yawB: 0, weapon: 76, wind: 0.5, phase: 0.25, face: 'shout', fire: 1.35 });
const A2_HIT = beast(READY, { x: 7, y: 6, lean: 24, twist: 24, head: -26, look: 4, footF: [15, 0, 8.4], footB: [-11, -1, 7.4], handF: [10, 16, 12], handB: [8, -6, 16], weaponB: 10, rollB: -30, yawB: 0, weapon: 90, wind: 0.8, lift: 0.1, phase: 0.4, face: 'shout', fire: 1.45, fx: { impactB: 1 } });
const A2_FOLLOW = beast(A2_HIT, { y: 6, lean: 22, twist: 28, handB: [4, -8, 16], weaponB: -10, wind: 0.9, lift: 0.4, phase: 0.55, face: 'grit', fire: 1.3 });

const atk2: BeastPose[] = [
  A2_COCK,
  strike([A2_COCK], A2_SWING, 0.9, true, 14),
  strike([A2_COCK, A2_SWING], A2_HIT, 1, true, 21),
  strike([A2_COCK, A2_SWING, A2_HIT], A2_FOLLOW, 0.55, true, 18),
  beast(A2_FOLLOW, { y: 7, lean: 26, twist: 20, handB: [8, 2, 14], weaponB: 30, wind: 0.55, lift: 0.5, phase: 0.7, face: 'grit', fire: 1.2, fx: undefined }),
  settle(A2_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, fx: undefined }),
  settle(A2_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: undefined }),
];

// atk3: rearing up on its haunches with both claws raised high, then a lunging maul: both claws
// driven down together in front of it, a burst of fire and a shockwave.
const A3_REAR = beast(READY, { x: -3, y: 4, lean: 8, twist: 0, head: -12, look: 0, footF: [6, 0, 8], footB: [-10, 0, 7.4], handF: [-3, -6, 15], handB: [-3, -6, 15], weapon: -20, roll: 20, yaw: 0, weaponB: -20, rollB: 20, yawB: 0, wind: 0.3, lift: 0.3, phase: 0.05, face: 'shout', fire: 1.3 });
const A3_TOP = beast(A3_REAR, { x: -2, y: 2, lean: 2, head: -8, handF: [-5, -9, 15], handB: [-5, -9, 15], weapon: -34, weaponB: -34, lift: 0.5, phase: 0.15, fire: 1.5, fx: { aura: 0.3 } });
const A3_DIVE = beast(READY, { x: 6, y: 5, lean: 34, twist: 0, head: -24, footF: [14, 0, 8.4], footB: [-12, -2, 7.4], handF: [16, 2, 11], handB: [16, 2, 11], weapon: 76, roll: 16, yaw: 0, weaponB: 76, rollB: 16, yawB: 0, wind: 0.7, lift: 0.1, phase: 0.3, face: 'shout', fire: 1.5 });
const A3_SLAM = beast(READY, { x: 10, y: 12, lean: 48, twist: 0, head: -34, footF: [18, 0, 8.6], footB: [-12, 0, 7.4], handF: [22, 24, 9], handB: [22, 24, 9], weapon: 150, roll: 10, yaw: 0, weaponB: 150, rollB: 10, yawB: 0, wind: 0.9, lift: 0.4, phase: 0.45, face: 'shout', fire: 1.6, fx: { impact: 1.5, shock: 0.05, dust: 1 } });
const A3_HOLD = beast(A3_SLAM, { y: 13, lean: 50, handF: [22, 26, 9], handB: [22, 26, 9], weapon: 156, weaponB: 156, wind: 0.6, lift: 0.2, phase: 0.6, face: 'grit', fire: 1.4, fx: { shock: 0.45, dust: 0.7 } });

/** Both claws' slashes at once, and (`burst`, 0 to 1 as it flies out) fire bursting up where they strike the floor. */
const maul = (path: readonly BeastPose[], p: BeastPose, k: number, thick: number, burst = 0): BeastPose => ({
  ...p,
  fx: { ...p.fx, rune: 1, runeB: 1, extra: both(swipe([...path, p], k, false, thick), swipe([...path, p], k, true, thick), struck(burst)) },
});

/** Fire bursting up from the floor between its claws as they strike it (fire.ts `flare`), `k` 0 to 1 as it flies out. */
const struck =
  (k: number) =>
  (x: FxContext): void => {
    if (k <= 0) return;
    const { armR, armL } = x.rig;
    const head = x.proj(x.rig.head.o);
    flare(x, [(armR.end[0] + armL.end[0]) / 2 + 4, 3, (armR.end[2] + armL.end[2]) / 2], k, { n: 12, len: 44, skip: (px, py) => Math.hypot(px - head[0], py - head[1]) < 12 });
  };

const atk3: BeastPose[] = [
  A3_REAR,
  A3_TOP,
  maul([A3_TOP], A3_DIVE, 0.9, 12),
  maul([A3_TOP, A3_DIVE], A3_SLAM, 1, 18, 0.12),
  maul([A3_TOP, A3_DIVE, A3_SLAM], A3_HOLD, 0.45, 15, 0.42),
  beast(A3_HOLD, { y: 12, lean: 46, phase: 0.75, face: 'grit', fire: 1.3, fx: { shock: 0.85, dust: 0.3, extra: struck(0.75) } }),
  settle(A3_HOLD, 0.45, { phase: 0.85, wind: 0.35, lift: 0.2, fx: undefined }),
  settle(A3_HOLD, 0.75, { phase: 0.95, wind: 0.28, lift: 0.1, fx: undefined }),
  settle(A3_HOLD, 0.92, { phase: 1.05, wind: 0.22, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
