/**
 * The Halberdier's skills, in the chibi pose format (rig.ts, ChibiPose), with a few effects of
 * their own painted through `fx.extra`. Wind-up frames come first; none of his skills has a
 * server wind-up, so they take 0.06 s each and the rest share the clip's seconds. A weapon skill's
 * clip is named after its hotbar slot.
 *
 *   special   7  (1 wind-up) Sweeping Strike: wound up to his right with the haft held low and
 *                level, then swung round low and wide through 200 degrees in front of him, a level
 *                arc of wind trailing the head and a gust kicked up off the floor
 *   q         8  (2 wind-up) Piercing Thrust: drawn far back and low while the point gathers its
 *                glow, then a deep lunge, the front hand sliding up the haft, a long drill of wind
 *                spiralling off the point well past it
 *   e        11  (1 wind-up) Vault Strike: the butt swung down and planted just ahead of him, a
 *                spring up the haft and over its top (scarf and ponytail streaming), the halberd
 *                pulled up and flipped point down in a wheel of wind, then driven into the floor
 *                beside him as he lands: a burst of wind, a shockwave, dust. The server moves him to
 *                his aim at once, so it plays in place.
 *   r        10  (1 wind-up) Whirling Halberd: two fast turns with the haft held level at its
 *                middle in both hands, a ring of wind round him that trails the head, the scarf,
 *                ribbon and ponytail flung out
 *   ult      12  (2 wind-up) Skewer: the lance couched low under his arm, a crouch while the wind
 *                gathers, then a charge in long bounding strides with jade afterimages and a cone
 *                of wind round the point, a burst at the point, and a skidding stop. The server
 *                moves him, so it plays in place.
 *   cast      8  (2 wind-up) role skills (Bloodrush, Second Wind) and the Elixir: the halberd spun
 *                once in front of him and planted upright beside him, a burst of wind round him
 *
 * The poses build on the battle stance (moves-core.ts READY); each clip starts from it
 * (`fromReady`) and its last frames ease back into it (`settle`), so the loop takes over smoothly.
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK, glowLine, puff } from '../fx.js';
import { add3, type ChibiPose, type FxContext, pose, solveRig, type V3, weaponAxes } from '../rig.js';
import { BUTT, HALBERDIER } from './design.js';
import { drill, fromReady, gust, READY, settle, streak, tipOf } from './moves-core.js';

const S = READY;
const BUILD = HALBERDIER.build;
const W = HALBERDIER.weapon;
const TIP = W.tip ?? W.reach[1];

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

const FURROW: RGB = [62, 54, 50];

/**
 * A skid (strength k): furrows ploughed behind his boots, a bank of dust and grit thrown up ahead
 * of them.
 */
const skid =
  (k: number) =>
  (x: FxContext): void => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 22 * k, 0, g[2]]);
      glowLine(x.c, a, b, FURROW, 0.85 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.55 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3.4 - i * 0.7) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.6 * k);
      }
      for (let i = 0; i < 7; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 13 * k, hash(i, s + 81) * 10 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        const col: RGB = i % 3 === 0 ? x.aura.core : i % 3 === 1 ? DUST : DUST_DARK;
        x.c.glow(p[0], p[1], col, 0.95 * k);
        x.c.glow(p[0] + 1, p[1], col, 0.7 * k);
      }
    }
  };

/** A puff of dust where the butt bites the floor (the plant of the vault). */
const plantDust =
  (k: number) =>
  (x: FxContext): void => {
    const w = x.rig.weapon;
    if (w.u[1] > -0.2) return;
    // Where the haft meets the floor, going down from the grip toward the butt.
    const t = (w.o[1] - 0.5) / -w.u[1];
    const g = x.proj([w.o[0] + w.u[0] * t, 0, w.o[2] + w.u[2] * t]);
    for (let i = 0; i < 5; i++) {
      const dx = (x.hash(i, 121) - 0.5) * 12;
      const r = 2 + x.hash(i, 122) * 2.5;
      puff(x.c, g[0] + dx, g[1] - r * 0.6 - x.hash(i, 123) * 3, r * k, i % 2 ? DUST_DARK : DUST, 0.6 * k);
    }
  };

/** A burst of wind at the point: white streaks thrown out round it (strength k). */
const burstAt =
  (at: 'tip' | V3, k: number) =>
  (x: FxContext): void => {
    const p = x.proj(at === 'tip' ? x.tip : at);
    for (let i = 0; i < 10; i++) {
      const th = (i / 10) * Math.PI * 2 + x.hash(i, 131) * 0.4;
      const r0 = 6 + 4 * k;
      const r1 = r0 + (6 + x.hash(i, 132) * 8) * k;
      glowLine(x.c, [p[0] + Math.cos(th) * r0, p[1] + Math.sin(th) * r0 * 0.7], [p[0] + Math.cos(th) * r1, p[1] + Math.sin(th) * r1 * 0.7], i % 2 ? x.aura.core : x.aura.hot, 0.85 * k);
    }
  };

// ── Sweeping Strike ──────────────────────────────────────────────────────────────────────────

/**
 * The sweep: the haft held low and level in both hands, its head out at shin height; `sweep` is
 * where the head points, in degrees round him in the turn-0 frame (90 his right, 0 ahead, -90 his
 * left). The body turns into it and the haft's yaw does the rest.
 */
const sweepPose = (sweep: number, turn: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(S, {
    x: 1,
    y: 11,
    lean: 14,
    twist: (sweep - turn) * 0.12,
    turn,
    head: 4,
    look: -6,
    footF: [-13, 0, 6.5],
    footB: [12, 0, 7],
    handF: [3, 18, 8],
    weapon: 104,
    roll: 0,
    yaw: sweep - turn,
    grip: -16,
    grip2: 2,
    wind: 0.6,
    flare: 0.5,
    face: 'shout',
    ...over,
  });

const special: ChibiPose[] = [
  // Wound up: the haft drawn back round to his right, low, the head behind him.
  fromReady(sweepPose(128, 40, { y: 9, lean: 10, twist: 20, handF: [0, 17, 10], wind: 0.3, flare: 0, sway: 0.4, face: 'grit', fx: { rune: 0.6 } }), 0.85),
  sweepPose(60, 20, { phase: 0.15, sway: 0.3, fx: { rune: 1, ring: { from: 128, to: 60, height: 14 }, dust: 0.4 } }),
  sweepPose(-15, -10, { phase: 0.3, wind: 0.8, sway: -0.2, fx: { rune: 1, ring: { from: 128, to: -15, height: 14 }, dust: 0.8, extra: gust(0.1) } }),
  sweepPose(-72, -30, { phase: 0.45, wind: 0.9, flare: 0.8, sway: -0.5, fx: { rune: 1, ring: { from: 60, to: -72, height: 14 }, dust: 1, extra: gust(0.45) } }),
  // Follow-through, the gust blowing out.
  sweepPose(-96, -34, { y: 10, lean: 12, phase: 0.6, wind: 0.6, flare: 0.6, sway: -0.6, face: 'grit', fx: { rune: 0.6, ring: { from: -40, to: -96, height: 14 }, extra: gust(0.8) } }),
  settle(sweepPose(-90, -30, { y: 9, face: 'stern', wind: 0.4, flare: 0.3 }), 0.55, { turn: -14, phase: 0.8, face: 'stern', fx: { extra: gust(1) } }),
  settle(sweepPose(-90, -30), 0.9, { turn: -3, phase: 1, wind: 0.6, fx: undefined }),
];

// ── Piercing Thrust ──────────────────────────────────────────────────────────────────────────

const Q_DRAW = pose(S, { x: -5, y: 9, lean: 2, twist: 32, head: 5, look: -8, footF: [-15, 0, 5.2], footB: [9, 0, 5.6], handF: [-13, 15, 8], weapon: 70, yaw: -42, grip: -10, grip2: 20, wind: 0.3, lift: 0.2, sway: 0.3, face: 'grit', fx: { rune: 0.6, aura: 0.2 } });
const Q_COIL = pose(Q_DRAW, { x: -6, y: 11, lean: 4, twist: 36, head: 6, handF: [-14, 16, 8.5], weapon: 74, grip2: 18, wind: 0.35, lift: 0.35, phase: 0.1, fx: { rune: 1, aura: 0.55 } });
const Q_LUNGE = pose(S, { x: 14, y: 12, lean: 28, twist: 0, head: 0, look: -2, footF: [-12, 0, 5], footB: [26, 0, 6], handF: [13, 11, 4], weapon: 84, yaw: -24, grip: -24, grip2: 36, wind: 1.2, phase: 0.3, face: 'shout', fx: { rune: 1, aura: 0.5, impact: 1, dust: 1, speed: 0.6 } });
const q: ChibiPose[] = [
  fromReady(Q_DRAW, 0.85),
  Q_COIL,
  drill(pose(Q_LUNGE, { x: 8, y: 9, lean: 20, footB: [20, -2, 6], handF: [7, 12, 5], grip2: 28, wind: 0.9, phase: 0.2, fx: { rune: 1, aura: 0.6, speed: 0.4, extra: streak(tipOf(Q_COIL), tipOf(pose(Q_LUNGE, { x: 8, handF: [7, 12, 5] })), 0.8) } }), 0.6, 0.05, 30, 9),
  drill(pose(Q_LUNGE, { fx: { ...Q_LUNGE.fx, extra: streak(tipOf(Q_COIL), tipOf(Q_LUNGE), 1, 3.6) } }), 1.3, 0.2, 70, 9),
  drill(pose(Q_LUNGE, { y: 12.5, lean: 29, wind: 1, lift: 0.15, phase: 0.45, face: 'grit', fx: { rune: 1, aura: 0.4, dust: 0.6, extra: streak(tipOf(Q_COIL), tipOf(Q_LUNGE), 0.4, 3.6) } }), 1.1, 0.45, 70, 9),
  drill(pose(Q_LUNGE, { y: 12, lean: 26, handF: [11, 12, 5], wind: 0.7, lift: 0.35, phase: 0.6, face: 'grit', fx: { rune: 0.7 } }), 0.55, 0.7, 70, 9),
  drill(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, handF: [5, 14, 6], grip: -16, grip2: 26, wind: 0.5, lift: 0.3, phase: 0.75, face: 'stern', fx: { rune: 0.4 } }), 0.2, 0.9, 70, 9),
  settle(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, handF: [5, 14, 6], grip: -16, grip2: 26 }), 0.9, { wind: 0.6, lift: 0.1, phase: 0.9, face: 'stern', fx: undefined }),
];

// ── Vault Strike ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets the haft's angle and the right hand's place along it so that the haft runs through the
 * right hand where the pose puts it (`handF`) with one end at a point: its butt (`end` 'butt', the
 * haft rising from there up through the hand, the left hand a little below it) or its point
 * (`end` 'tip', the point there and the left hand a little above the right). The vault plants the
 * butt and springs up beside the haft; the strike drives the point into the floor.
 */
function through(p: ChibiPose, end: 'butt' | 'tip', at: V3): ChibiPose {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const h = rig.armR.end;
  // u runs from the butt toward the point.
  const d: V3 = end === 'butt' ? [h[0] - at[0], h[1] - at[1], h[2] - at[2]] : [at[0] - h[0], at[1] - h[1], at[2] - h[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const u: V3 = [d[0] / len, d[1] / len, d[2] / len];
  const deg = (r: number): number => (r * 180) / Math.PI;
  const flat = Math.hypot(u[1], u[2]) * (u[1] < 0 ? -1 : 1);
  const weapon = deg(Math.atan2(u[0], flat));
  const roll = u[1] < 0 ? deg(Math.atan2(-u[2], -u[1])) : deg(Math.atan2(u[2], u[1]));
  const grip = end === 'butt' ? len + BUTT : TIP - len;
  return { ...p, weapon, roll, yaw: 0, grip, grip2: grip + (end === 'butt' ? -9 : 9) };
}

/** The butt planted on the floor `ahead` pixels in front of the right hand (or at `at`), the haft rising up through the hand. */
const planted = (p: ChibiPose, ahead = 3, at?: V3): ChibiPose => {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const h = rig.armR.end;
  return through(p, 'butt', at ?? [h[0] + ahead, 0, h[2]]);
};

/** In the air: the cloth and hair streaming, the face set. */
const air = (y: number, over: Partial<ChibiPose>): ChibiPose => pose(S, { x: 4, y, lean: 4, twist: 4, head: -2, look: -4, footF: [-4, y - 12, 5], footB: [8, y - 15, 5], wind: 0.7, lift: 0.4, face: 'shout', ...over });

/** Where the point strikes the floor on landing. */
const STRIKE: V3 = [24, -7, 12];
/** The burst on the floor round it. */
const BURST: V3 = [24, 0, 12];

const e: ChibiPose[] = [
  // Wind-up: a quick step in, the halberd swung forward and down beside him, its butt dropping toward the floor.
  fromReady(planted(pose(S, { x: 0, y: 7, lean: 12, twist: 10, head: -2, look: -4, footF: [-11, 0, 5], footB: [9, 0, 5.4], handF: [3, 2, 12], wind: 0.5, lift: 0.1, face: 'grit', fx: { rune: 0.5 } }), 0, [9, 7, 12]), 0.9),
  // The plant: the butt bites the floor; he crouches to spring, hands high on the haft.
  planted(pose(S, { x: 2, y: 10, lean: 16, twist: 8, head: 2, look: -4, footF: [-10, 0, 5], footB: [9, 0, 5.4], handF: [1, 0, 12.5], wind: 0.4, lift: 0.2, phase: 0.1, face: 'grit', fx: { rune: 0.7, dust: 0.6, extra: plantDust(1) } }), 4),
  // He springs up the haft, pulling himself up it, legs stretched down.
  planted(air(-14, { x: 5, lean: 4, twist: 8, head: -6, footF: [-4, -2, 5], footB: [-7, -6, 5], handF: [1, -6, 12.5], wind: 0.6, lift: -0.5, phase: 0.2, fx: { rune: 0.8, aura: 0.3, speed: 0.3, extra: plantDust(0.5) } }), 1),
  // The top of the vault: up over his hands at the top of the haft, legs tucked, pushing off it.
  planted(air(-36, { x: 9, lean: 14, twist: 4, head: 2, footF: [8, -44, 5], footB: [2, -46, 5], handF: [1, 19, 12], wind: 0.6, lift: 0, phase: 0.3, fx: { rune: 1, aura: 0.6 } }), -1),
  // The flip: off the ground, the halberd swung up over and round in front of him, point coming down.
  air(-40, { x: 12, lean: -4, twist: -4, head: -6, footF: [8, -50, 5], footB: [2, -48, 5], handF: [-2, -8, 12], weapon: 100, roll: 10, yaw: 0, grip: 4, grip2: 16, wind: 0.6, lift: 0.2, phase: 0.4, fx: { rune: 1, aura: 0.8, smear: { from: -14, roll: 0, yaw: 0, width: 0.6 } } }),
  // Falling, the point leading, both hands high on the haft.
  through(air(-32, { x: 13, lean: 12, twist: 0, head: 4, footF: [2, -40, 5], footB: [-6, -38, 5], handF: [6, 2, 14], wind: 0.6, lift: 0.3, phase: 0.5, fx: { rune: 1, aura: 1, smear: { from: 100, roll: 10, yaw: 0, width: 0.5, alpha: 0.5 }, swirl: { k: 0.6, spin: 0.1 } } }), 'tip', [36, 26, 11]),
  through(air(-16, { x: 10, lean: 20, twist: 0, head: 6, footF: [2, -22, 5], footB: [-6, -20, 5], handF: [7, 6, 14], wind: 0.6, lift: 0.35, phase: 0.6, fx: { rune: 1, aura: 1, swirl: { k: 1, spin: 0.3 } } }), 'tip', [33, 6, 11]),
  // The strike: the point driven into the floor as he lands, a burst of wind.
  through(pose(S, { x: 6, y: 13, lean: 30, twist: 2, head: 8, look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10, 15], wind: 0.8, lift: 0.4, phase: 0.7, face: 'shout', fx: { rune: 1, aura: 0.8, impact: 1.4, impactAt: BURST, shock: 0.06, shockAt: BURST, dust: 1, extra: gust(0.05, 26) } }), 'tip', STRIKE),
  through(pose(S, { x: 6, y: 12, lean: 28, twist: 2, head: 7, look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10.5, 15], wind: 0.5, lift: 0.3, phase: 0.8, face: 'grit', fx: { rune: 0.8, aura: 0.4, shock: 0.45, shockAt: BURST, dust: 0.6, extra: gust(0.5, 26) } }), 'tip', STRIKE),
  // Pulled free, rising toward the stance as the wind blows out.
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, head: 4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [8, 10, 6], weapon: 120, roll: 0, yaw: -10, grip: -12, grip2: 10 }), 0.45, { wind: 0.4, lift: 0.2, phase: 0.9, face: 'stern', fx: { shock: 0.85, shockAt: BURST, extra: gust(0.9, 26) } }),
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, handF: [8, 10, 6], weapon: 120, yaw: -10, grip: -12, grip2: 10 }), 0.88, { phase: 1, fx: undefined }),
];

// ── Whirling Halberd ─────────────────────────────────────────────────────────────────────────

/** Where the spin starts (the wind-up's turn) and how far round each spin frame is: two fast turns. */
const WHIRL_FROM = -45;
const WHIRL = [45, 135, 225, 315, 405, 495, 585, 665];

function whirl(i: number): ChibiPose {
  const turn = WHIRL[i - 1] as number;
  // The head is out to his right: the ring trails it round.
  const to = turn + 90;
  return pose(S, {
    x: 0,
    y: 6,
    lean: 6,
    twist: 4,
    turn,
    head: 1,
    look: -14,
    footF: [-8, 0, 6.5],
    footB: [8, 0, 6.5],
    handF: [6, 12, 4],
    weapon: 90,
    roll: 0,
    yaw: 88,
    grip: 4,
    grip2: -6,
    face: 'shout',
    wind: 0.5,
    flare: 1,
    sway: -0.6,
    phase: i / 8,
    fx: { ring: { from: Math.max(WHIRL_FROM + 90, to - 300), to, height: 40 }, rune: 1, aura: 0.3, swirl: { k: 0.8, on: 'body', spin: i / 6 } },
  });
}

const r: ChibiPose[] = [
  // Wind-up: coiled to his left, the haft drawn level across in front of him.
  fromReady(pose(S, { y: 8, lean: 10, twist: -20, turn: WHIRL_FROM, head: 3, look: 12, footF: [-8, 0, 6.5], footB: [8, 0, 6.5], handF: [8, 12, -2], weapon: 90, roll: 0, yaw: -50, grip: 4, grip2: -6, face: 'grit', wind: 0.3, sway: 0.4, fx: { rune: 0.7, aura: 0.2 } }), 0.85),
  whirl(1),
  whirl(2),
  whirl(3),
  whirl(4),
  whirl(5),
  whirl(6),
  whirl(7),
  // The ring closes; the slowing wind rolls out over the floor.
  pose(whirl(8), { fx: { ring: { from: (WHIRL[7] as number) + 90 - 320, to: (WHIRL[7] as number) + 90, height: 40 }, rune: 0.8, aura: 0.2, shock: 0.25, shockAt: [0, 0, 0], extra: gust(0.3, 24) } }),
  settle(pose(S, { y: 6, lean: 8, twist: 10, turn: 720, handF: [2, 15, 7], weapon: 70, yaw: -20, flare: 0.5, wind: 0.4 }), 0.85, { turn: 720, flare: 0.3, wind: 0.6, fx: { shock: 0.6, shockAt: [0, 0, 0], extra: gust(0.8, 24) } }),
];

// ── Skewer ───────────────────────────────────────────────────────────────────────────────────

/** The charge: low, the lance couched under his right arm, the point forward and a little down. */
const COUCH: ChibiPose = pose(S, { x: 10, y: 6, lean: 30, twist: 14, head: -14, look: -4, handF: [0, 17, 6], weapon: 92, roll: 0, yaw: -16, grip: -20, grip2: 16, face: 'shout', wind: 1.2, lift: 0.1 });

/** The cone of wind round the point: from just past the tip back along the haft, opening out. */
const cone = (k: number, spin: number): ChibiPose['fx'] => {
  const tip = tipOf(COUCH);
  const back = tipOf(pose(COUCH, { grip: (COUCH.grip as number) + 40 }));
  const d: V3 = [(tip[0] - back[0]) / 40, (tip[1] - back[1]) / 40, (tip[2] - back[2]) / 40];
  return { swirl: { k, spin, from: [tip[0] + d[0] * 14, tip[1] + d[1] * 14, tip[2] + d[2] * 14], to: back, radius: 2.5, taper: 6, turns: 1.2 } };
};

const ult: ChibiPose[] = [
  // Couched and crouching, the wind gathering round the point.
  fromReady(pose(COUCH, { x: -3, y: 11, lean: 22, twist: 22, head: -6, footF: [-15, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17, 7], face: 'grit', wind: 0.3, lift: 0.2, fx: { rune: 0.8, aura: 0.6, dust: 0.4 } }), 0.85),
  pose(COUCH, { x: -4, y: 13, lean: 24, twist: 24, head: -6, footF: [-16, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17.5, 7], face: 'grit', wind: 0.4, lift: 0.5, phase: 0.1, fx: { rune: 1, aura: 1, dust: 0.6, ...cone(0.4, 0) } }),
  // Launch: the back leg drives off, the front knee comes through.
  pose(COUCH, { x: 6, y: 6, footF: [-18, 0, 5], footB: [14, -7, 5], phase: 0.2, fx: { rune: 1, aura: 0.5, dust: 1, speed: 0.8, ghosts: { k: 0.6, n: 2 }, ...cone(0.8, 0.1) } }),
  // The charge: long bounding strides, barely touching the floor.
  pose(COUCH, { y: 1, footF: [-16, -10, 5], footB: [24, -4, 5], phase: 0.3, fx: { rune: 1, aura: 0.45, speed: 1, ghosts: { k: 1, n: 3 }, ...cone(1.1, 0.25) } }),
  pose(COUCH, { y: 6, footF: [12, -12, 5], footB: [8, 0, 5], phase: 0.4, fx: { rune: 1, aura: 0.45, speed: 1, dust: 0.7, ghosts: { k: 1, n: 3 }, ...cone(1.1, 0.4) } }),
  pose(COUCH, { y: 1, footF: [24, -4, 5], footB: [-16, -10, 5], phase: 0.5, fx: { rune: 1, aura: 0.45, speed: 1, ghosts: { k: 1, n: 3 }, ...cone(1.1, 0.55) } }),
  pose(COUCH, { y: 6, footF: [8, 0, 5], footB: [12, -12, 5], phase: 0.6, fx: { rune: 1, aura: 0.45, speed: 1, dust: 0.7, ghosts: { k: 1, n: 3 }, ...cone(1.1, 0.7) } }),
  // Skewered: a burst at the point.
  pose(COUCH, { y: 2, footF: [-14, -8, 5], footB: [22, -3, 5], phase: 0.7, fx: { rune: 1, aura: 0.45, speed: 0.8, impact: 1.2, ghosts: { k: 0.8, n: 3 }, ...cone(1, 0.85), extra: burstAt('tip', 1) } }),
  // The braced, skidding stop: the lead leg thrust out, the body thrown back, the point still up.
  pose(S, { x: 12, y: 12, lean: -4, twist: 10, head: -2, look: -4, footF: [2, 0, 5.6], footB: [26, 0, 6], handF: [-2, 15, 8], weapon: 78, roll: 0, yaw: -30, grip: -16, grip2: 18, face: 'grit', wind: -0.2, lift: 0.5, sway: 0.4, phase: 0.85, fx: { aura: 0.5, dust: 1, speed: 0.3, extra: skid(1) } }),
  pose(S, { x: 10, y: 9, lean: 6, twist: 14, head: 1, footF: [-4, 0, 5.6], footB: [20, 0, 6], handF: [-3, 16, 7.5], weapon: 64, yaw: -38, grip: -10, grip2: 16, face: 'stern', wind: 0.1, lift: 0.3, phase: 1, fx: { aura: 0.2, dust: 0.5, extra: skid(0.45) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.6, { phase: 1.1, fx: { extra: skid(0.15) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.92, { phase: 1.2 }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** Planted upright beside his right foot, his left fist raised, the wind bursting round him. */
const PLANTED: ChibiPose = pose(S, { x: 0, y: 4, lean: -4, twist: 4, head: -8, look: 4, footF: [-6, 0, 8], footB: [8, 0, 7.5], handF: [-11, 2, 13], handB: [2, -8, 15], weapon: 0, roll: -4, yaw: 0, grip: 10, face: 'shout', wind: 0.6, lift: 0.3, sway: -0.4 });

const cast: ChibiPose[] = [
  // Gather: the halberd brought up upright in front of him in both hands.
  fromReady(pose(S, { y: 7, lean: 6, twist: 6, head: 3, handF: [6, 12, 6], weapon: 12, roll: 0, yaw: -20, grip: -2, grip2: 22, face: 'grit', wind: 0.3, fx: { rune: 0.6, aura: 0.3 } }), 0.85),
  // The spin: whirled round once in his right hand before him, gripped at its middle, in a wheel
  // turned half toward his right so it shows its round side on and toward the viewer alike.
  pose(S, { y: 7, lean: 4, twist: 10, head: 1, handF: [8, 9, 10], handB: [4, 12, 8], weapon: 100, roll: 0, yaw: 50, grip: 12, face: 'grit', wind: 0.4, lift: 0.2, phase: 0.1, fx: { rune: 1, aura: 0.6, smear: { from: 12, roll: 0, yaw: 50, width: 0.7 } } }),
  pose(S, { y: 6, lean: 2, twist: 8, head: 0, handF: [8, 7, 11], handB: [4, 12, 8], weapon: 215, roll: 0, yaw: 50, grip: 12, face: 'grit', wind: 0.4, lift: 0.3, phase: 0.2, fx: { rune: 1, aura: 0.8, smear: { from: 100, roll: 0, yaw: 50, width: 0.7 } } }),
  // Planted: the butt struck into the floor, the burst of wind.
  pose(PLANTED, { phase: 0.3, fx: { rune: 1, aura: 1, circle: 1, impact: 1, impactAt: [-8, 2, 13], shock: 0.08, shockAt: [0, 0, 0], dust: 1, extra: gust(0.1, 24) } }),
  pose(PLANTED, { y: 4.5, lean: -6, head: -9, phase: 0.45, lift: 0.4, fx: { rune: 1, aura: 1, circle: 1, shock: 0.45, shockAt: [0, 0, 0], extra: gust(0.5, 24) } }),
  pose(PLANTED, { y: 4, lean: -5, head: -8, phase: 0.6, lift: 0.3, face: 'smirk', fx: { rune: 0.8, aura: 0.7, circle: 0.8, shock: 0.8, shockAt: [0, 0, 0], extra: gust(0.9, 24) } }),
  // Back into the stance, the circle fading.
  settle(pose(PLANTED, { handB: undefined, weapon: 30, grip: 4, grip2: 20, face: 'stern' }), 0.5, { phase: 0.8, fx: { aura: 0.3, circle: 0.4 } }),
  settle(PLANTED, 0.92, { phase: 1, fx: { circle: 0.12 } }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
