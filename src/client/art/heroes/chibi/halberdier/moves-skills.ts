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
 *   e        11  (1 wind-up) Vault Strike: a pole vault. The butt swung down and planted well
 *                ahead of him, the haft slanting back up to his hands at his right side; he swings
 *                up beside it, legs kicking up and over its top (scarf and ponytail streaming),
 *                then pulls the halberd up and flips it point down in a wheel of wind and falls
 *                point first, the wind gathering round the point, to drive it into the floor as he
 *                lands: a burst of wind, a shockwave, dust. The server moves him to his aim at
 *                once, so it plays in place.
 *   r        10  (1 wind-up) Whirling Halberd: two fast turns with the haft held level at its
 *                middle in both hands, a ring of wind round him that trails the head, the scarf,
 *                ribbon and ponytail flung out
 *   ult      12  (2 wind-up) Skewer: the lance couched low under his arm, a crouch while the wind
 *                gathers, then a charge in long bounding strides with jade afterimages and a cone
 *                of wind opening ahead of the point, a great burst and a ring of wind at the
 *                point, and a skidding stop. The server moves him, so it plays in place.
 *   cast      8  (2 wind-up) role skills (Bloodrush, Second Wind) and the Elixir: the halberd
 *                lifted upright beside his shoulder, spun once level round his hips and planted
 *                upright beside him, a burst of wind round him
 *
 * The poses build on the battle stance (moves-core.ts READY); each clip starts from it
 * (`fromReady`) and its last frames ease back into it (`settle`), so the loop takes over smoothly.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { DUST, DUST_DARK, glowLine, puff, swirl } from '../fx.js';
import { add3, type ChibiPose, cross3, type FxContext, norm3, pose, solveRig, type V3, weaponAxes } from '../rig.js';
import { BUTT, HALBERDIER } from './design.js';
import { both, drill, flash, fromReady, gust, headUp, READY, settle, streak, tipOf, withExtra } from './moves-core.js';

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
 * The sweep: the haft held low and nearly level in both hands, its head out at shin height, the
 * hands far enough up the haft that seen end on (coming at the viewer) the point stays by his feet
 * rather than dipping below them; `sweep` is where the head points, in degrees round him in the
 * turn-0 frame (90 his right, 0 ahead, -90 his left). The body turns into it and the haft's yaw
 * does the rest.
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
    weapon: 97,
    roll: 0,
    yaw: sweep - turn,
    grip: -3,
    grip2: 11,
    wind: 0.6,
    flare: 0.5,
    face: 'shout',
    ...over,
  });

const special: ChibiPose[] = [
  // Wound up: the haft drawn back round to his right, low, the head behind him.
  fromReady(sweepPose(128, 40, { y: 9, lean: 10, twist: 20, handF: [0, 17, 10], wind: 0.3, flare: 0, sway: 0.4, face: 'grit', fx: { rune: 0.6 } }), 0.85),
  sweepPose(60, 20, { phase: 0.15, sway: 0.3, fx: { rune: 1, ring: { from: 128, to: 60, height: 16 }, dust: 0.4 } }),
  sweepPose(-15, -10, { phase: 0.3, wind: 0.8, sway: -0.2, fx: { rune: 1, ring: { from: 128, to: -15, height: 16 }, dust: 0.8, extra: gust(0.1) } }),
  sweepPose(-72, -30, { phase: 0.45, wind: 0.9, flare: 0.8, sway: -0.5, fx: { rune: 1, ring: { from: 60, to: -72, height: 16 }, dust: 1, extra: gust(0.45) } }),
  // Follow-through, the gust blowing out.
  sweepPose(-96, -34, { y: 10, lean: 12, phase: 0.6, wind: 0.6, flare: 0.6, sway: -0.6, face: 'grit', fx: { rune: 0.6, ring: { from: -40, to: -96, height: 16 }, extra: gust(0.8) } }),
  settle(sweepPose(-90, -30, { y: 9, face: 'stern', wind: 0.4, flare: 0.3 }), 0.55, { turn: -14, phase: 0.8, face: 'stern', fx: { extra: gust(1) } }),
  settle(sweepPose(-90, -30), 0.9, { turn: -3, phase: 1, wind: 0.78, fx: undefined }),
];

// ── Piercing Thrust ──────────────────────────────────────────────────────────────────────────

// Drawn right back: the right hand far behind him and high on the haft, so the point comes in
// close in front of his lead hip and the butt reaches far behind; weight on the back foot. Then
// the lunge drives the haft out through the lead hand nearly its whole length, the right hand
// sliding back to the butt end.
const Q_DRAW = pose(S, { x: -6, y: 10, lean: 0, twist: 34, head: headUp(0, 4), look: -8, footF: [-15, 0, 5.2], footB: [8, 0, 5.6], handF: [-15, 15, 9], weapon: 82, yaw: -14, grip: 12, grip2: 30, wind: 0.3, lift: 0.2, sway: 0.3, face: 'grit', fx: { rune: 0.6, aura: 0.2 } });
const Q_COIL = pose(Q_DRAW, { x: -7, y: 12, lean: 2, twist: 38, head: headUp(2, 4), handF: [-16, 16, 9], weapon: 80, wind: 0.35, lift: 0.35, phase: 0.1, fx: { rune: 1, aura: 0.55 } });
const Q_LUNGE = pose(S, { x: 14, y: 12, lean: 26, twist: 0, head: headUp(26), look: -2, footF: [-12, 0, 5], footB: [26, 0, 6], handF: [13, 11, 4], weapon: 80, yaw: -28, grip: -24, grip2: 36, wind: 1.2, phase: 0.3, face: 'shout', fx: { rune: 1, aura: 0.5, dust: 1, speed: 0.6 } });
const Q_MID = pose(Q_LUNGE, { x: 8, y: 9, lean: 18, head: headUp(18), footB: [20, -2, 6], handF: [7, 12, 5], grip: -10, grip2: 30, wind: 0.9, phase: 0.2, fx: { rune: 1, aura: 0.6, speed: 0.4 } });
const q: ChibiPose[] = [
  fromReady(Q_DRAW, 0.85),
  Q_COIL,
  drill(withExtra(Q_MID, streak(tipOf(Q_COIL), tipOf(Q_MID), 0.8, 4)), 0.7, 0.05, 30, 10),
  drill(withExtra(withExtra(Q_LUNGE, streak(tipOf(Q_COIL), tipOf(Q_LUNGE), 1, 5.5)), flash(1.2)), 1.5, 0.2, 70, 12),
  drill(pose(Q_LUNGE, { y: 12.5, lean: 27, head: headUp(27), wind: 1, lift: 0.15, phase: 0.45, face: 'grit', fx: { rune: 1, aura: 0.4, dust: 0.6, extra: streak(tipOf(Q_COIL), tipOf(Q_LUNGE), 0.4, 5.5) } }), 1.2, 0.45, 70, 12),
  drill(pose(Q_LUNGE, { y: 12, lean: 25, head: headUp(25), handF: [11, 12, 5], wind: 0.7, lift: 0.35, phase: 0.6, face: 'grit', fx: { rune: 0.7 } }), 0.6, 0.7, 70, 12),
  drill(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, head: headUp(18), handF: [5, 14, 6], weapon: 76, grip: -16, grip2: 26, wind: 0.5, lift: 0.3, phase: 0.75, face: 'stern', fx: { rune: 0.4 } }), 0.2, 0.9, 70, 12),
  settle(pose(Q_LUNGE, { x: 9, y: 10, lean: 18, head: headUp(18), handF: [5, 14, 6], weapon: 76, grip: -16, grip2: 26 }), 0.9, { wind: 0.78, lift: 0.1, phase: 0.9, face: 'stern', fx: undefined }),
];

// ── Vault Strike ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets the haft's angle and the right hand's place along it so that the haft runs through the
 * right hand where the pose puts it (`handF`) with one end at a point: its butt (`end` 'butt', the
 * haft rising from there up through the hand, the left hand a little below it) or its point
 * (`end` 'tip', the point there and the left hand a little above the right). The vault plants the
 * butt ahead of him and swings up beside the haft; the strike drives the point into the floor.
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

/** In the air: the cloth and hair streaming, the face set. */
const air = (y: number, over: Partial<ChibiPose>): ChibiPose => pose(S, { x: 4, y, lean: 4, twist: 4, head: -2, look: -4, footF: [-4, y - 12, 5], footB: [8, y - 15, 5], wind: 0.7, lift: 0.4, face: 'shout', ...over });

/** Where the butt is planted for the vault: well ahead of him and out to his right, so he swings up beside the haft. */
const PLANT: V3 = [40, 0, -8];
/** Where the point strikes the floor on landing. */
const STRIKE: V3 = [26, -7, 12];
/** The burst on the floor round it. */
const BURST: V3 = [26, 0, 12];

/**
 * The wind round the falling point: a cone opening back up the haft from just past the point,
 * so the swirl leads the point down but never runs on under the floor before it lands.
 */
const trail = (p: ChibiPose, k: number, spin: number): ChibiPose => {
  const rig = solveRig(BUILD, p, W.grip2, W.haft);
  const w = rig.weapon;
  return { ...p, fx: { ...p.fx, swirl: { k, spin, from: add3(w.o, w.u, TIP + 2), to: add3(w.o, w.u, TIP - 26), radius: 2, taper: 4.5, turns: 1.4 } } };
};

const e: ChibiPose[] = [
  // Wind-up: a quick step in, the halberd swung forward and down out at his right side, its butt
  // dropping toward the floor well ahead of him, his hands sliding up toward its head.
  fromReady(through(pose(S, { x: 0, y: 8, lean: 10, twist: 6, head: headUp(10, 2), look: -4, footF: [-11, 0, 5], footB: [9, 0, 5.4], handF: [5, 3, 13], wind: 0.5, lift: 0.1, face: 'grit', fx: { rune: 0.5 } }), 'butt', [28, 10, 6]), 0.9),
  // The plant: the butt bites the floor ahead and the haft slants back up to his hands, raised
  // high at his right side; he drives off his left foot, the right knee coming up.
  through(pose(S, { x: 3, y: 9, lean: 4, twist: 4, head: headUp(4, -2), look: -4, footF: [2, -8, 5], footB: [-8, 0, 5.4], handF: [6, -1, 12], wind: 0.5, lift: 0.2, phase: 0.1, face: 'grit', fx: { rune: 0.7, dust: 0.6, extra: plantDust(1) } }), 'butt', PLANT),
  // The swing: off the floor and hanging from the haft, he rocks back and swings his legs up
  // and forward beside it, the haft bending him up toward its top.
  through(pose(S, { x: 12, y: -20, lean: -16, twist: 6, head: headUp(-16, -2), look: -4, footF: [24, -44, 5], footB: [18, -34, 5], handF: [6, 4, 12], wind: 0.7, lift: -0.2, phase: 0.2, face: 'shout', fx: { rune: 0.8, aura: 0.3, speed: 0.3, extra: plantDust(0.5) } }), 'butt', PLANT),
  // Over the top: the haft upright under his hands, his legs kicked up high over it in a curve,
  // the scarf and ponytail streaming down below him.
  through(pose(S, { x: 14, y: -40, lean: -64, twist: 4, head: headUp(-64, -6), look: -4, footF: [22, -94, 5], footB: [14, -90, 5], handF: [7, 4, 12], wind: 0.5, lift: -0.2, phase: 0.3, face: 'shout', fx: { rune: 1, aura: 0.6 } }), 'butt', PLANT),
  // The flip: he lets the haft go up with him and turns upright at the top of the vault, pulling
  // the halberd up and over in front of him, point coming down.
  air(-46, { x: 16, lean: -4, twist: -4, head: -6, footF: [10, -54, 5], footB: [4, -52, 5], handF: [-2, -8, 12], weapon: 100, roll: 10, yaw: 0, grip: 4, grip2: 16, wind: 0.6, lift: 0.4, phase: 0.4, fx: { rune: 1, aura: 0.8, smear: { from: -14, roll: 0, yaw: 0, width: 0.6 } } }),
  // Falling, the point leading, both hands high on the haft, the wind gathering round the point.
  trail(through(air(-32, { x: 14, lean: 12, twist: 0, head: headUp(12, 4), footF: [4, -40, 5], footB: [-4, -38, 5], handF: [8, 8, 14], wind: 0.6, lift: 0.5, phase: 0.5, fx: { rune: 1, aura: 1, smear: { from: 100, roll: 10, yaw: 0, width: 0.5, alpha: 0.5 } } }), 'tip', [46, 24, 12]), 0.7, 0.1),
  trail(through(air(-16, { x: 11, lean: 20, twist: 0, head: headUp(20, 4), footF: [3, -22, 5], footB: [-5, -20, 5], handF: [8, 10, 14], wind: 0.6, lift: 0.5, phase: 0.6, fx: { rune: 1, aura: 1 } }), 'tip', [38, 6, 12]), 1, 0.3),
  // The strike: the point driven into the floor as he lands, a burst of wind.
  through(pose(S, { x: 6, y: 13, lean: 30, twist: 2, head: headUp(30, 4), look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10, 15], wind: 0.8, lift: 0.4, phase: 0.7, face: 'shout', fx: { rune: 1, aura: 0.8, impact: 1.4, impactAt: BURST, shock: 0.06, shockAt: BURST, dust: 1, extra: gust(0.05, 26) } }), 'tip', STRIKE),
  through(pose(S, { x: 6, y: 12, lean: 28, twist: 2, head: headUp(28, 4), look: -4, footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [0, 10.5, 15], wind: 0.6, lift: 0.3, phase: 0.8, face: 'grit', fx: { rune: 0.8, aura: 0.4, shock: 0.45, shockAt: BURST, dust: 0.6, extra: gust(0.5, 26) } }), 'tip', STRIKE),
  // Pulled free, rising toward the stance as the wind blows out.
  settle(pose(S, { x: 5, y: 10, lean: 20, twist: 4, head: headUp(20, 4), footF: [-10, 0, 6], footB: [10, 0, 6.5], handF: [8, 10, 6], weapon: 120, roll: 0, yaw: -10, grip: -12, grip2: 10 }), 0.45, { wind: 0.5, lift: 0.2, phase: 0.9, face: 'stern', fx: { shock: 0.85, shockAt: BURST, extra: gust(0.9, 26) } }),
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
  // The ring closes and the slowing wind rolls out over the floor and blows out, gone before the
  // last frame so the stance takes over cleanly.
  pose(whirl(8), { fx: { ring: { from: (WHIRL[7] as number) + 90 - 320, to: (WHIRL[7] as number) + 90, height: 40 }, rune: 0.8, aura: 0.2, shock: 0.55, shockAt: [0, 0, 0], extra: gust(0.85, 24) } }),
  settle(pose(S, { y: 6, lean: 8, twist: 10, turn: 720, handF: [2, 15, 7], weapon: 70, yaw: -20, flare: 0.5, wind: 0.4 }), 0.85, { turn: 720, flare: 0.3, wind: 0.78, lift: 0.05, fx: undefined }),
];

// ── Skewer ───────────────────────────────────────────────────────────────────────────────────

/**
 * The charge: low, the lance couched under his right arm, the point forward and a little down,
 * turned a little across toward his left so that toward the viewer the lance still shows its
 * length down the screen.
 */
const COUCH: ChibiPose = pose(S, { x: 10, y: 6, lean: 30, twist: 14, head: headUp(30, 1), look: -4, handF: [0, 17, 6], weapon: 94, roll: 0, yaw: -30, grip: -20, grip2: 16, face: 'shout', wind: 1.2, lift: 0.1 });

/**
 * The cone of wind he drives ahead of the point (strength k; `spin` turns its streaks, advance it
 * frame by frame): rings of wind opening out ahead of the point, white at their rims and jade
 * within, joined to the point by bright streaks along the cone's edges, a white-hot core at the
 * point and a spiral of wind round the lance's head behind it. Seen end on it opens into rings
 * round the point.
 */
const cone =
  (k: number, spin: number) =>
  (x: FxContext): void => {
    const w = x.rig.weapon;
    const u = w.u;
    const tip = x.tip;
    const ref: V3 = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm3(cross3(u, ref));
    const e2 = cross3(u, e1);
    const at = (d: number, r: number, th: number): V3 => add3(add3(add3(tip, u, d), e1, Math.cos(th) * r), e2, Math.sin(th) * r);
    const RINGS = [
      [5, 4],
      [12, 7.5],
      [20, 11],
    ] as const;
    // A jade wash filling the cone, thickest toward its mouth.
    for (let d = 2; d <= 20; d += 1.5) {
      const r = 2 + (d / 20) * 9;
      for (let j = 0; j < Math.ceil(r * 5); j++) {
        const th = (j / Math.ceil(r * 5)) * Math.PI * 2;
        for (const f of [0.35, 0.7, 1]) {
          const p3 = at(d, r * f, th);
          const p = x.proj(p3);
          x.c.glow(p[0], p[1], f < 1 ? x.aura.core : x.aura.edge, k * (0.08 + 0.1 * (d / 20)), x.depth(p3) < x.depth(add3(tip, u, d)));
        }
      }
    }
    RINGS.forEach(([d, r], i) => {
      const n = Math.ceil(r * 7);
      let prev: Vec | null = null;
      for (let j = 0; j <= n; j++) {
        const th = (j / n) * Math.PI * 2 + spin * Math.PI * 2 * (i % 2 ? -1 : 1);
        const p3 = at(d, r, th);
        const p = x.proj(p3);
        // A streak of brighter wind runs round each ring.
        const run = (((j / n + spin * 1.3 + i * 0.37) % 1) + 1) % 1;
        if (prev) {
          const back = x.depth(p3) < x.depth(add3(tip, u, d));
          glowLine(x.c, prev, p, run > 0.6 ? x.aura.edge : x.aura.core, k * (0.55 + 0.4 * run) * (1 - i * 0.12), back);
          glowLine(x.c, [prev[0], prev[1] + 1], [p[0], p[1] + 1], x.aura.core, k * 0.35, back);
        }
        prev = p;
      }
    });
    // The cone's edges, from the point out to the widest ring.
    const [dEnd, rEnd] = RINGS[RINGS.length - 1] as readonly [number, number];
    const P = x.proj(tip);
    for (let j = 0; j < 6; j++) {
      const th = (j / 6) * Math.PI * 2 + spin * Math.PI * 2;
      const end = x.proj(at(dEnd, rEnd, th));
      const n = Math.ceil(Math.hypot(end[0] - P[0], end[1] - P[1]));
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n);
        x.c.glow(P[0] + (end[0] - P[0]) * t, P[1] + (end[1] - P[1]) * t, t < 0.35 ? x.aura.hot : x.aura.core, k * 0.7 * (1 - t * 0.6), x.depth(at(dEnd, rEnd, th)) < x.depth(tip));
      }
    }
    // The white-hot core at the point.
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) x.c.glow(P[0] + dx, P[1] + dy, x.aura.hot, k * (Math.abs(dx) + Math.abs(dy) === 0 ? 1 : 0.6));
    swirl(x, add3(tip, u, -2), add3(tip, u, -24), k * 0.8, { radius: 3, taper: 2, turns: 1.4, spin, strands: 3 });
  };

/** A ring of wind thrown out round the point (radius r on screen, strength k), white at its rim. */
const shockAt =
  (r: number, k: number) =>
  (x: FxContext): void => {
    const p = x.proj(x.tip);
    const n = Math.ceil(r * 7);
    for (let j = 0; j < n; j++) {
      const th = (j / n) * Math.PI * 2;
      for (const [dr, col, a] of [[0, x.aura.edge, 0.9], [-1, x.aura.core, 0.6], [1, x.aura.core, 0.35]] as const) {
        x.c.glow(p[0] + Math.cos(th) * (r + dr), p[1] + Math.sin(th) * (r + dr) * 0.8, col, a * k);
      }
    }
  };

const ult: ChibiPose[] = [
  // Couched and crouching, the wind gathering round the point.
  fromReady(pose(COUCH, { x: -3, y: 11, lean: 22, twist: 22, head: headUp(22, 2), footF: [-15, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17, 7], face: 'grit', wind: 0.3, lift: 0.2, fx: { rune: 0.8, aura: 0.6, dust: 0.4 } }), 0.85),
  pose(COUCH, { x: -4, y: 13, lean: 24, twist: 24, head: headUp(24, 2), footF: [-16, 0, 5.2], footB: [10, 0, 5.6], handF: [-4, 17.5, 7], face: 'grit', wind: 0.4, lift: 0.5, phase: 0.1, fx: { rune: 1, aura: 1, dust: 0.6, extra: cone(0.4, 0) } }),
  // Launch: the back leg drives off, the front knee comes through.
  pose(COUCH, { x: 6, y: 6, footF: [-18, 0, 5], footB: [14, -7, 5], phase: 0.2, fx: { rune: 1, aura: 0.5, dust: 1, speed: 0.8, ghosts: { k: 0.6, n: 2 }, extra: cone(0.8, 0.1) } }),
  // The charge: long bounding strides, barely touching the floor.
  pose(COUCH, { y: 1, footF: [-16, -10, 5], footB: [24, -4, 5], phase: 0.3, fx: { rune: 1, aura: 0.45, speed: 1, ghosts: { k: 1, n: 3 }, extra: cone(1.1, 0.25) } }),
  pose(COUCH, { y: 6, footF: [12, -12, 5], footB: [8, 0, 5], lift: 0.15, phase: 0.4, fx: { rune: 1, aura: 0.45, speed: 1, dust: 0.7, ghosts: { k: 1, n: 3 }, extra: cone(1.1, 0.4) } }),
  pose(COUCH, { y: 1, footF: [24, -4, 5], footB: [-16, -10, 5], phase: 0.5, fx: { rune: 1, aura: 0.45, speed: 1, ghosts: { k: 1, n: 3 }, extra: cone(1.1, 0.55) } }),
  pose(COUCH, { y: 6, footF: [8, 0, 5], footB: [12, -12, 5], phase: 0.6, fx: { rune: 1, aura: 0.45, speed: 1, dust: 0.7, ghosts: { k: 1, n: 3 }, extra: cone(1.1, 0.7) } }),
  // Skewered: a great burst of wind at the point, a white flash and a ring thrown out round it.
  pose(COUCH, { y: 2, footF: [-14, -8, 5], footB: [22, -3, 5], phase: 0.7, fx: { rune: 1, aura: 0.6, speed: 0.8, impact: 2, ghosts: { k: 0.8, n: 3 }, extra: both(cone(0.6, 0.85), flash(2.2), burstAt('tip', 1.8), shockAt(22, 1)) } }),
  // The braced, skidding stop: the lead leg thrust out, the body thrown back, the point still up.
  pose(S, { x: 12, y: 12, lean: -4, twist: 10, head: -2, look: -4, footF: [2, 0, 5.6], footB: [26, 0, 6], handF: [-2, 15, 8], weapon: 78, roll: 0, yaw: -30, grip: -16, grip2: 18, face: 'grit', wind: -0.2, lift: 0.5, sway: 0.4, phase: 0.85, fx: { aura: 0.5, dust: 1, speed: 0.3, extra: both(skid(1), burstAt('tip', 0.6), shockAt(30, 0.4)) } }),
  pose(S, { x: 10, y: 9, lean: 6, twist: 14, head: 1, footF: [-4, 0, 5.6], footB: [20, 0, 6], handF: [-3, 16, 7.5], weapon: 64, yaw: -38, grip: -10, grip2: 16, face: 'stern', wind: 0.3, lift: 0.3, phase: 1, fx: { aura: 0.2, dust: 0.5, extra: skid(0.45) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.6, { phase: 1.1, fx: { extra: skid(0.15) } }),
  settle(pose(S, { x: 6, y: 7, lean: 8, footF: [-8, 0, 5.4], footB: [16, 0, 5.8] }), 0.92, { phase: 1.2 }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** Planted upright beside his right foot, his left fist raised, the wind bursting round him. */
const PLANTED: ChibiPose = pose(S, { x: 0, y: 4, lean: -4, twist: 4, head: -8, look: 4, footF: [-6, 0, 8], footB: [8, 0, 7.5], handF: [-11, 2, 13], handB: [2, -8, 15], weapon: 0, roll: -4, yaw: 0, grip: 10, face: 'shout', wind: 0.6, lift: 0.3, sway: -0.4 });

/**
 * The twirl: gripped at the middle of the haft in his right hand low in front of him, the halberd
 * spun round level (`roll` 90 lays the haft's plane flat), so it sweeps round his hips and never
 * passes his face; `weapon` is where it points round him (0 his right, 90 ahead, 180 his left).
 * Its trail is a level ring of wind (a ring's angles run the other way: 90 his right, 0 ahead)
 * from where the head was, `from`.
 */
const twirl = (weapon: number, from: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(S, { y: 7, lean: 4, twist: 6, head: headUp(4, 2), look: 0, handF: [8, 17, 5], handB: [-2, 13, 12], weapon, roll: 90, yaw: 0, grip: 4, face: 'grit', wind: 0.4, lift: 0.2, flare: 0.5, fx: { rune: 1, aura: 0.6, ring: { from: 90 - from, to: 90 - weapon, height: 20, radius: 58 } }, ...over });

const cast: ChibiPose[] = [
  // Gather: the halberd lifted upright beside his right shoulder, out past his head.
  fromReady(pose(PLANTED, { y: 7, lean: 4, head: headUp(4, 2), look: 0, handF: [-6, 6, 13], handB: [2, 14, 9], weapon: 8, roll: 10, grip: 2, face: 'grit', wind: 0.3, lift: 0.1, sway: 0, fx: { rune: 0.6, aura: 0.3 } }), 0.85),
  // The spin: once round, level, round his hips.
  twirl(150, 20, { phase: 0.1 }),
  twirl(300, 40, { y: 6, phase: 0.2, sway: -0.3 }),
  // Planted: the butt struck into the floor, the burst of wind.
  pose(PLANTED, { phase: 0.3, fx: { rune: 1, aura: 1, circle: 1, impact: 1, impactAt: [-8, 2, 13], shock: 0.08, shockAt: [0, 0, 0], dust: 1, extra: gust(0.1, 24) } }),
  pose(PLANTED, { y: 4.7, lean: -6, head: -9, phase: 0.45, lift: 0.4, fx: { rune: 1, aura: 1, circle: 0.9, shock: 0.45, shockAt: [0, 0, 0], extra: gust(0.5, 24) } }),
  pose(PLANTED, { y: 4, lean: -5, head: -8, phase: 0.6, lift: 0.3, face: 'smirk', fx: { rune: 0.8, aura: 0.6, circle: 0.45, shock: 0.8, shockAt: [0, 0, 0], extra: gust(0.9, 24) } }),
  // Back into the stance: the haft swung down across him, the point out past his lead shoulder
  // clear of his face, then into the guard, the wind gone.
  settle(pose(PLANTED, { handB: undefined, handF: [-2, 15, 9], weapon: 64, roll: 0, yaw: -62, grip: -6, grip2: 14, face: 'stern' }), 0.45, { phase: 0.8, fx: { aura: 0.15 } }),
  settle(PLANTED, 0.92, { phase: 1, fx: undefined }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
