/**
 * The Spellblade's core moves: stances, running and the three-hit combo of her basic attack.
 * Poses use the chibi pose format (rig.ts, ChibiPose): side-plane points, hands from the base of
 * the neck, the sword's angle (0 up, 90 forward), its plane's `roll` and `yaw`, the wand's own
 * angles (`weaponB`, `rollB`, `yawB`, mirrored) and the cloth's and hair's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, weight on her back foot, the sword hanging point down at her right, the
 *              wand idling in her left hand: a slow breath, a blink, a little twirl of the wand,
 *              the hair and coat swaying
 *   battle  8  a light fencer's guard, side on to the foe: the sword up and forward on her right,
 *              the wand forward and low out to her left, its crystal pulsing; she bounces on the
 *              balls of her feet, hair, coat and cape a frame behind
 *   move    8  a quick, light sprint, the sword trailing low behind in her right hand and the wand
 *              held ahead in her left, the hair streaming
 *   atk1    7  (1 wind-up) a diagonal cut from high behind her right shoulder to low in front
 *   atk2    7  (1 wind-up) a flat backhand sweep from her left round to her right, the wand flicked
 *              back for balance
 *   atk3    9  (2 wind-up) the wand charges the blade, then a lunging forehand sweep that throws a
 *              crescent wave of violet force forward (the game flies the wave on from there)
 *
 * Each blow has an anticipation, a smear frame, a hit frame and a recovery into the battle stance,
 * the hair and coat streaming hardest a frame after the blow and floating up as she stops. Its
 * swoosh starts where the sword was (`trail`): the frame before on the smear frame, the start of
 * the swing on the hit frame, so the whole stroke shows as one arc that then fades. Raised sword
 * hands go beside her head, out to her right (`handF` about `[-7, -7, 12]`), clear of her face
 * side on and from the front.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { glowLine } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, type FxContext, lerp, mix, norm3, pose, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { SPELLBLADE } from './design.js';

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BUILD = SPELLBLADE.build;
const GRIP2 = SPELLBLADE.weapon.grip2;
const REACH = SPELLBLADE.weapon.reach[1];

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * Where a smear starts for a blow swung from pose `a` to pose `b`: the sword angle, roll and yaw
 * that point from b's grip (the smear's centre) at a's tip, so the swoosh begins where the sword
 * was in pose a even when the hand has travelled. The angle comes out on the side of a's own
 * angle, so the arc sweeps the way the sword went.
 */
export function trail(a: ChibiPose, b: ChibiPose): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, GRIP2);
  const rb = solveRig(BUILD, b, GRIP2);
  const tip = turnPoint(add3(ra.weapon.o, ra.weapon.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  const d = norm3(sub3(tip, rb.weapon.o));
  // weaponAxes gives u = (sinθ·cosψ, cosθ·cosρ − sinθ·sinψ·sinρ, cosθ·sinρ + sinθ·sinψ·cosρ):
  // for each yaw ψ that can reach d there are two (θ, ρ); keep the one nearest a's own.
  const wrap = (x: number, near: number): number => x + 360 * Math.round((near - x) / 360);
  const a0 = { from: a.weapon, roll: a.roll ?? 0, yaw: a.yaw ?? 0 };
  let best = { ...a0, cost: Infinity };
  for (let yaw = -88; yaw <= 88; yaw += 2) {
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

/**
 * Adds a smear to a pose's effects, starting where the sword was in pose `start`: the frame
 * before for a smear frame, or the start of the swing so the hit and follow-through frames show
 * the whole stroke as one arc, fading as it goes. `width` is how far down the blade it reaches.
 */
export const smear = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1): ChibiPose => ({ ...p, fx: { ...p.fx, smear: { ...trail(start, p), width, alpha } } });

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The battle stance, and the guard the skill and state clips build on: side on to the foe, knees
 * soft, the sword up and forward on her right (tipped out so that from the front it stands beside
 * her rather than pointing at the viewer), the wand forward and low out to her left with its
 * crystal glowing. Side on both point ahead; toward and away from the viewer they frame her.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 4,
  lean: 10,
  twist: -10,
  head: 2,
  look: -2,
  footF: [9, 0, 4.6],
  footB: [-9, 0, 4.2],
  handF: [9, 10, 9],
  weapon: 45,
  roll: 35,
  yaw: -15,
  handB: [7, 10, 8],
  weaponB: 100,
  rollB: -10,
  yawB: 45,
  wind: 0.2,
  fx: { runeB: 0.3 },
};

/** Standing at ease: the sword hanging point down at her right side, the wand loose in her left hand. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 6,
  tilt: -3,
  head: -2,
  look: 4,
  footF: [3, 0, 4.2],
  footB: [-4, 0, 3.6],
  handF: [3, 14, 7.5],
  weapon: 165,
  roll: 8,
  yaw: 12,
  handB: [4, 10, 7.5],
  weaponB: 30,
  rollB: 30,
  yawB: 10,
  wind: 0.06,
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles one whole pixel for the second half of the loop
  // (whole pixels, so the hair does not shimmer), while the hair and coat sway slowly round and
  // she blinks once. Idly, she twirls the wand once round in her fingers (frames 2 to 5), its
  // crystal brightening as it turns.
  const out = i >= 4 ? 1 : 0;
  const twirl = i >= 2 && i <= 5;
  return pose(AT_EASE, {
    y: -0.4 + out,
    weaponB: twirl ? 30 + (i - 1) * 90 : 30 + Math.sin((2 * Math.PI * i) / 8) * 10,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.22,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.06,
    face: i === 6 ? 'closed' : 'stern',
    fx: { runeB: twirl ? 0.35 : 0.12 },
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Light on the balls of her feet: down on the beat and springing back, the head nodding a frame
  // behind, the hair and cloth lagging (lifting as she drops, settling as she rises), the wand's
  // crystal pulsing.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 3 + b * 3,
    lean: 9 + b * 2,
    head: 1 + bounce(i - 1) * 3,
    handF: [9, 10 + b * 1.2, 9],
    weapon: 45 + b * 4,
    handB: [7, 10 + b, 8],
    weaponB: 100 + b * 6,
    wind: 0.2 + Math.max(0, lag) * 0.2,
    lift: lag * 0.45,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
    fx: { runeB: 0.25 + wave(i, BOUNCE) * 0.2 },
  });
});

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (pass `turn` for a pose that has spun round, and any effects: from k 0.5 they come from the
 * battle frame). The combo's recoveries and the skill and state clips that hand back to the
 * battle stance end with it, so the sword and wand are already where the loop holds them.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, battle[0] as ChibiPose, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. Clips the battle loop hands over to start with it, so their first frame carries the sword
 * on from where the loop holds it. Keep k at 0.5 or more: the face and effects then come from the
 * pose. Give the pose's angles on the side the swing goes round, since the angles blend straight.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(battle[0] as ChibiPose, p, k), over);

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [10, 0], b: [-8, -5.5], y: 2 },
  { f: [5.5, 0], b: [-6.5, -9], y: 3.4 },
  { f: [0, 0], b: [2, -7.5], y: 1 },
  { f: [-5.5, -1.5], b: [8, -3.5], y: -2.4 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 20 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 8,
    head: -8,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 3.6] : [k.b[0], k.b[1], 3.6],
    footB: right ? [k.b[0], k.b[1], 3.4] : [k.f[0], k.f[1], 3.4],
    // The sword trails low behind her in her right hand; the wand leads in her left, pumping with the stride.
    handF: [-4 - swing * 3, 14 - Math.abs(swing) * 1.5, 9],
    weapon: -112 + swing * 6,
    roll: 0,
    yaw: -30,
    handB: [4 + swing * 6, 11 - Math.abs(swing) * 2, 8],
    weaponB: 105 + swing * 12,
    rollB: 10,
    yawB: 25,
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.7, dust: i % 4 === 0 ? 0.7 : 0, runeB: 0.2 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

// atk1: high behind her right shoulder, down across to low in front on her left; the wand swings
// back for balance.
const A1_COCK = pose(READY, { x: -2, y: 4, lean: -4, twist: -26, head: -2, look: 2, footF: [9, -1, 4.6], footB: [-9, 0, 4.2], handF: [-7, -7, 12], weapon: -40, roll: 42, yaw: -6, handB: [9, 8, 7], weaponB: 70, rollB: 0, yawB: 30, wind: 0.25, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.6, runeB: 0.3 } });
const A1_SWING = pose(READY, { x: 3, y: 4, lean: 10, twist: -4, head: 2, look: -2, footF: [13, 0, 4.8], handF: [11, 3, 6], weapon: 72, roll: 40, yaw: 0, handB: [5, 11, 9], weaponB: 130, rollB: 0, yawB: 20, wind: 0.45, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A1_HIT = pose(READY, { x: 6, y: 7, lean: 22, twist: 14, head: 1, look: -4, footF: [15, 0, 5], footB: [-11, 0, 4.4], handF: [15, 13, -2], weapon: 116, roll: 40, yaw: 0, handB: [-2, 10, 11], weaponB: 200, rollB: 10, yawB: 0, wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impact: 0.7, dust: 0.5, rune: 1 } });
const A1_FOLLOW = pose(A1_HIT, { y: 8, lean: 24, twist: 18, head: 2, handF: [14, 15, -3], weapon: 126, wind: 0.85, lift: 0.1, phase: 0.55, face: 'grit', fx: { dust: 0.3, rune: 0.6 } });

const atk1: ChibiPose[] = [
  A1_COCK,
  smear(A1_COCK, A1_SWING, 0.7),
  smear(A1_COCK, A1_HIT, 0.55),
  smear(A1_COCK, A1_FOLLOW, 0.5, 0.4),
  pose(A1_FOLLOW, { y: 7, lean: 20, twist: 12, head: 1, handF: [13, 14, -1], weapon: 120, wind: 0.6, lift: 0.3, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'stern', fx: { runeB: 0.25 } }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: { runeB: 0.3 } }),
];

// atk2: a flat backhand sweep from across on her left, round in front of her to out on her right.
const A2_COCK = pose(READY, { x: 1, y: 6, lean: 8, twist: -24, head: 1, look: 4, footF: [11, 0, 4.8], footB: [-9, 0, 4.4], handF: [8, 9, -5], weapon: 90, roll: 4, yaw: -96, handB: [-2, 10, 11], weaponB: 190, rollB: 20, yawB: 0, wind: 0.25, lift: 0.1, sway: -0.3, phase: 0.1, face: 'grit', fx: { rune: 0.6 } });
const A2_SWING = pose(READY, { x: 4, y: 5, lean: 12, twist: 0, head: 2, look: -2, footF: [13, 0, 5], handF: [13, 8, 4], weapon: 90, roll: 4, yaw: -10, handB: [0, 11, 11], weaponB: 200, rollB: 20, yawB: 0, wind: 0.45, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A2_HIT = pose(READY, { x: 5, y: 5, lean: 10, twist: 22, head: 1, look: -6, footF: [14, 0, 5.2], footB: [-10, 0, 4.4], handF: [9, 8, 14], weapon: 92, roll: 0, yaw: 72, handB: [6, 10, 6], weaponB: 120, rollB: 0, yawB: 30, wind: 0.75, lift: 0.1, sway: 0.4, phase: 0.4, face: 'shout', fx: { impact: 0.6, rune: 1 } });
const A2_FOLLOW = pose(A2_HIT, { twist: 26, handF: [6, 9, 15], weapon: 96, yaw: 92, wind: 0.8, lift: 0.25, sway: 0.5, phase: 0.55, face: 'grit', fx: { rune: 0.6 } });

/**
 * A flat sweep's swoosh: a level arc round her at the sword's height (fx `ring`), from where the
 * sword pointed at the start of the swing (`from`, degrees round her: -90 her left, 90 her right)
 * to where it points now, so it stays level in every view instead of folding up edge on.
 */
const sweep = (p: ChibiPose, from: number, height = 33): ChibiPose => ({ ...p, fx: { ...p.fx, ring: { from, to: p.yaw ?? 0, height, radius: 40 } } });

const atk2: ChibiPose[] = [
  A2_COCK,
  sweep(A2_SWING, -96),
  sweep(A2_HIT, -96),
  sweep(A2_FOLLOW, -40),
  pose(A2_FOLLOW, { twist: 20, handF: [7, 9, 13], weapon: 80, yaw: 70, roll: 14, wind: 0.55, lift: 0.3, sway: 0.3, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(A2_FOLLOW, 0.55, { wind: 0.35, lift: 0.2, phase: 0.85, face: 'stern', fx: { runeB: 0.25 } }),
  settle(A2_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, fx: { runeB: 0.3 } }),
];

// ── atk3: the crescent wave ──────────────────────────────────────────────────────────────────

/**
 * A crescent wave of force flying ahead of her, `d` pixels out from her chest at the sword's
 * height `h`, `k` its strength: a crescent bowed the way it flies, with a white-hot leading edge,
 * the aura's violet body and a fringe of its pale edge colour, and streaks trailing behind it. As
 * a sprite artist would, it is drawn opened out on screen (a flat crescent lying level would show
 * only as a sliver): side on it bows ahead of her, toward the viewer it bows down the screen at
 * him, and away from him it bows up the screen, behind her.
 */
const crescentWave =
  (d: number, k: number, h = 26): ((x: FxContext) => void) =>
  (x) => {
    const { c, cam, rig, aura } = x;
    const o: V3 = [rig.pelvis.o[0] + d, h, rig.pelvis.o[2]];
    const C = x.proj(o);
    const fv = cam.vec([1, 0, 0]);
    const fl = Math.hypot(fv[0], fv[1]);
    const dir: Vec = fl > 0.45 ? [fv[0] / fl, fv[1] / fl] : [0, fv[1] >= 0 ? 1 : -1];
    const side: Vec = [-dir[1], dir[0]];
    const behind = x.behind(o);
    // Its radius grows a little as it flies; seen toward or away from the viewer it is wider than tall.
    const R = 14 + d * 0.08;
    const n = 24;
    const at = (t: number, f: number): Vec => {
      const a = rad(lerp(-72, 72, t));
      // f: 0 the leading (outer) edge, 1 the inner edge; the inner arc is smaller and set back.
      const r = R * (1 - 0.3 * f);
      const back = R * 0.55 + R * 0.12 * f;
      const along = Math.cos(a) * r - back;
      const across = Math.sin(a) * r * (fl > 0.45 ? 1 : 1.25);
      return [C[0] + dir[0] * along + side[0] * across, C[1] + dir[1] * along + side[1] * across];
    };
    const bands: [number, number, RGB, number][] = [
      [0, 0.2, aura.hot, 1],
      [0.2, 0.45, mixc(aura.hot, aura.core, 0.5), 0.95],
      [0.45, 0.82, aura.core, 0.85],
      [0.82, 1, aura.edge, 0.45],
    ];
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      // Thickest in the middle, tapering to points at its horns.
      const th = (t: number): number => Math.pow(Math.sin(Math.PI * t), 0.7);
      for (const [f0, f1, col, a] of bands) fillQuad(c, [at(t0, f0 * th(t0)), at(t1, f0 * th(t1)), at(t1, f1 * th(t1)), at(t0, f1 * th(t0))], col, a * k, behind);
    }
    // Streaks trailing behind it.
    for (let i = 0; i < 5; i++) {
      const t = 0.18 + i * 0.16;
      const p = at(t, 0.9);
      const len = (8 + (i % 2) * 6) * k;
      glowLine(c, p, [p[0] - dir[0] * len, p[1] - dir[1] * len], i % 2 ? aura.core : aura.edge, 0.6 * k, behind);
    }
  };

const lerp3v = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Fills a screen quad on an effects layer. */
function fillQuad(c: FxContext['c'], q: readonly Vec[], col: RGB, a: number, under: boolean): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of q) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs: number[] = [];
    for (let i = 0; i < q.length; i++) {
      const p = q[i] as Vec;
      const r = q[(i + 1) % q.length] as Vec;
      const yy = y + 0.5;
      if ((p[1] <= yy && r[1] > yy) || (r[1] <= yy && p[1] > yy)) xs.push(p[0] + ((yy - p[1]) / (r[1] - p[1])) * (r[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.ceil((xs[j] as number) - 0.5); x <= Math.floor((xs[j + 1] as number) - 0.5); x++) c.glow(x, y, col, clamp(a, 0, 1), under);
  }
}

/** Sparks the wand sheds onto the blade as it charges it: motes drawn from the wand's tip along the sword (k 0 to 1). */
const charge =
  (k: number): ((x: FxContext) => void) =>
  (x) => {
    const { c, rig, aura, tipB, hash } = x;
    const w = rig.weapon;
    for (let i = 0; i < 7; i++) {
      const t = (k * 0.8 + i / 7) % 1;
      const on = add3(w.o, w.u, 10 + hash(i, 5) * 30);
      const p = x.proj(lerp3v(tipB, on, t));
      const col = i % 3 === 0 ? aura.hot : i % 3 === 1 ? aura.core : aura.edge;
      c.glow(p[0], p[1], col, 0.9 * Math.sin(Math.PI * t));
      c.glow(p[0] + 1, p[1], aura.core, 0.5 * Math.sin(Math.PI * t));
    }
  };

const A3_COIL = pose(READY, { x: -2, y: 7, lean: 6, twist: 26, head: 3, look: -4, footF: [10, 0, 5], footB: [-11, 0, 4.4], handF: [-2, 12, 12], weapon: 100, roll: -6, yaw: 96, handB: [8, 6, 3], weaponB: 70, rollB: 0, yawB: -40, wind: 0.25, sway: -0.3, phase: 0.1, face: 'grit', fx: { rune: 0.7, runeB: 0.9, extra: charge(0.2) } });
const A3_CHARGE = pose(A3_COIL, { y: 8, twist: 30, turn: -8, handF: [-4, 12, 12], yaw: 104, handB: [7, 7, 2], wind: 0.3, lift: 0.2, phase: 0.15, fx: { rune: 1, runeB: 1, aura: 0.35, extra: charge(0.7) } });
const A3_SWEEP = pose(READY, { x: 5, y: 7, lean: 16, twist: 2, turn: 0, head: 2, look: -2, footF: [15, 0, 5.2], footB: [-11, 0, 4.4], handF: [14, 9, 4], weapon: 92, roll: -4, yaw: 0, handB: [1, 10, 11], weaponB: 200, rollB: 20, yawB: 0, wind: 0.6, phase: 0.3, face: 'shout', fx: { rune: 1, aura: 0.3 } });
const A3_RELEASE = pose(A3_SWEEP, { x: 8, y: 9, lean: 20, twist: -22, head: 3, look: 2, footF: [18, 0, 5.4], footB: [-12, 0, 4.4], handF: [11, 10, -7], weapon: 94, yaw: -72, handB: [-3, 10, 12], wind: 0.95, lift: 0.1, sway: -0.4, phase: 0.45, fx: { rune: 1, aura: 0.4, dust: 0.6, extra: crescentWave(24, 1) } });
const A3_FLY = pose(A3_RELEASE, { y: 9.5, lean: 21, twist: -26, handF: [10, 11, -8], yaw: -84, wind: 0.8, lift: 0.3, sway: -0.5, phase: 0.6, face: 'grit', fx: { rune: 0.7, dust: 0.3, extra: crescentWave(54, 0.95) } });

const atk3: ChibiPose[] = [
  A3_COIL,
  A3_CHARGE,
  sweep(A3_SWEEP, 104, 30),
  sweep(A3_RELEASE, 104, 29),
  sweep(A3_FLY, 30, 29),
  pose(A3_FLY, { y: 8, lean: 16, twist: -18, handF: [10, 11, -5], weapon: 88, yaw: -60, roll: 10, wind: 0.5, lift: 0.4, sway: -0.3, phase: 0.75, face: 'stern', fx: { rune: 0.4, extra: crescentWave(84, 0.6) } }),
  pose(A3_FLY, { y: 7, lean: 14, twist: -10, handF: [11, 11, 1], weapon: 70, yaw: -30, roll: 24, handB: [3, 10, 10], weaponB: 150, wind: 0.35, lift: 0.3, sway: -0.15, phase: 0.85, face: 'stern', fx: { rune: 0.3 } }),
  settle(A3_FLY, 0.6, { wind: 0.3, lift: 0.15, phase: 0.95, face: 'stern', fx: { runeB: 0.25 } }),
  settle(A3_FLY, 0.9, { wind: 0.24, lift: 0.05, phase: 1.05, fx: { runeB: 0.3 } }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
