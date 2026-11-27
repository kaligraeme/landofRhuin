/**
 * The Sage's core moves: stances, running and the three-bolt combo. Poses use the chibi pose
 * format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the staff's
 * angle (0 up, 90 forward), its plane's `roll` and `yaw`, both hands' places along the haft
 * (`grip` the right hand's, `grip2` the left's) and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  stooped a little and leaning on the staff planted ahead of him on his right, the
 *              left hand tucked behind his back: a slow breath, a blink, the beard and the robe
 *              swaying, the orb glowing softly
 *   battle  8  straightened, the staff in both hands slanted forward and up across his body, the
 *              orb ahead of him at his brow, pulsing; a slow, steady sway rather than a bounce
 *   move    8  an old man's hurried run: short strides under the robe, a forward lean, the staff
 *              carried slanted ahead in his right hand, the beard, hair and robe streaming
 *   atk1    7  (1 wind-up) Arcane Bolt I: the staff drawn back upright, then flicked forward at
 *              the aim and a spark of teal light leaves the orb
 *   atk2    7  (1 wind-up) Arcane Bolt II: a backhand, the staff in his right hand cocked low
 *              across to his left, then swept up and out to the aim in a short teal arc, the left
 *              hand thrown open after the spark as it leaves the orb
 *   atk3    9  (2 wind-up) Arcane Bolt III: the staff raised in both hands while a ball of light
 *              swells in the orb, then a two-handed thrust that hurls it at the aim
 *
 * The bolt leaves the orb on the first frame after the wind-up (the frame the game fires the
 * projectile on), with a flash at the orb and a trail along the aim (`release`), which fades over
 * the next frames; the last frames ease back into the battle stance (`settle`). The skill and
 * state clips (moves-skills.ts, moves-states.ts) start from the stance (`fromReady`) and those
 * that hand back to it end in it.
 *
 * Side on the staff is held well ahead of him (the right hand about 15 forward of the neck) so
 * it stands clear of his face; front on its head is carried out to one side of his head (a roll
 * out to his right, or a yaw across to his left) so it never covers his face.
 */
import type { RGB } from '../../paint.js';
import { hex } from '../../paint.js';
import { add3, type ChibiPose, clamp, type FxContext, mix, pose, solveRig, type V3, wave } from '../rig.js';
import { SAGE } from './design.js';

const BUILD = SAGE.build;
const W = SAGE.weapon;
const GRIP2 = W.grip2;
const WHITE: RGB = [255, 255, 255];

/** The end of the staff's butt cap, along it from the right hand's place at rest. */
export const FOOT = -43.6;

/** Which way his bolts fly: straight ahead of him (hero space), a touch down toward the floor. */
export const AIM: V3 = [1, -0.04, 0];

// ── His colours ──────────────────────────────────────────────────────────────────────────────

/** The aura an effect is painted in: its core, its outer edge and its white-hot heart. */
export type Aura = FxContext['aura'];

/** His arcane light, for bolts, orbs and wards: the design's teal-green with a pale mint edge. */
export const ARCANE: Aura = SAGE.aura;
/** Healing light: a soft gold-green with a warm gold edge and a cream-white heart. */
export const LIFE: Aura = { core: hex('#bfe27a'), edge: hex('#f2d27c'), hot: hex('#fffbe6') };
/** The Meteor's fire: orange with a red fringe and a yellow-white heart. */
export const FIRE: Aura = { core: hex('#ff8a2e'), edge: hex('#e2402c'), hot: hex('#fff0b0') };
/** Resurrection's light: warm gold with a pale cream edge and a white heart. */
export const GOLD_LIGHT: Aura = { core: hex('#ffd468'), edge: hex('#fff2c4'), hot: hex('#ffffff') };

// ── Effects shared by his clips ──────────────────────────────────────────────────────────────

export type Extra = (x: FxContext) => void;

/** Runs several extra painters in turn. */
export const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** Adds a painter to a pose's own `fx.extra` (after whatever it paints already). */
export const withExtra = (p: ChibiPose, f: Extra): ChibiPose => {
  const prev = p.fx?.extra;
  return { ...p, fx: { ...p.fx, extra: prev ? both(prev, f) : f } };
};

/** A painter run in other colours than his own (the engine's painters take theirs from the context). */
export const tinted =
  (aura: Aura, f: Extra): Extra =>
  (x) =>
    f({ ...x, aura });

/** A point `ahead` pixels from the orb along the aim. */
export const fromOrb =
  (ahead: number, dir: V3 = AIM) =>
  (x: FxContext): V3 =>
    add3(x.tip, dir, ahead);

/**
 * A ball of light `r` pixels in radius at a point (hero space, or worked out from the frame), in
 * the aura's colours: a white heart, the hot colour round it, the core colour out to its edge and a
 * soft fringe of the edge colour; `k` its strength. Behind the figure it passes behind him.
 */
export const ball =
  (at: V3 | ((x: FxContext) => V3), r: number, k = 1, aura?: Aura): Extra =>
  (x) => {
    if (k <= 0 || r <= 0) return;
    const a3 = typeof at === 'function' ? at(x) : at;
    const col = aura ?? x.aura;
    const P = x.proj(a3);
    const under = x.behind(a3);
    const R = r + 2.5;
    for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) {
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const d = Math.hypot(dx, dy);
        if (d > R) continue;
        const c: RGB = d < r * 0.4 ? WHITE : d < r * 0.7 ? col.hot : d < r ? col.core : col.edge;
        const a = d < r ? clamp(k, 0, 1) * (d < r * 0.7 ? 1 : 0.85) : clamp(k, 0, 1) * 0.45 * (1 - (d - r) / 2.5);
        x.c.glow(P[0] + dx, P[1] + dy, c, a, under);
      }
    }
  };

/**
 * Sparkles round the orb (`k` their strength, `t` turning them): a few tiny four-point stars
 * circling it a little way out, in the aura's colours, for the frames it gathers power.
 */
export const gather =
  (k: number, t: number, r = 9, aura?: Aura): Extra =>
  (x) => {
    if (k <= 0) return;
    const col = aura ?? x.aura;
    const P = x.proj(x.tip);
    for (let i = 0; i < 6; i++) {
      const th = (i / 6) * Math.PI * 2 + t * 2.4 + x.hash(i, 501);
      const rr = r * (0.6 + 0.5 * ((x.hash(i, 502) + t) % 1));
      const px = P[0] + Math.cos(th) * rr;
      const py = P[1] + Math.sin(th) * rr * 0.85;
      x.c.glow(px, py, WHITE, k);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) x.c.glow(px + dx, py + dy, i % 2 ? col.core : col.hot, k * 0.6);
    }
  };

/**
 * A bolt leaving the orb (the frame after the wind-up): the engine's release flash at the orb and
 * the trail of the spark flying on along the aim, `k` their strength and `len` how far the spark
 * has flown. On the frames after, call it again with the flash at 0 and the trail fading.
 */
export const release = (p: ChibiPose, flash: number, trail: number, len = 44): ChibiPose => ({
  ...p,
  fx: { ...p.fx, flash: flash > 0 ? { k: flash, from: 'main', dir: AIM } : undefined, trail: trail > 0 ? { k: trail, from: 'main', dir: AIM, len } : undefined },
});

/** A point `along` the staff from his right hand in a pose, in hero space (its `turn` taken into account, as the camera does). */
function onStaff(p: ChibiPose, along: number): V3 {
  const rig = solveRig(BUILD, p, GRIP2, W.haft);
  const t = add3(rig.weapon.o, rig.weapon.u, along);
  const a = ((p.turn ?? 0) * Math.PI) / 180;
  return [t[0] * Math.cos(a) - t[2] * Math.sin(a), t[1], t[0] * Math.sin(a) + t[2] * Math.cos(a)];
}

/** Where a pose's orb is, in hero space. */
export const orbOf = (p: ChibiPose): V3 => onStaff(p, W.tip ?? W.reach[1]);

/** Where a pose's staff stands on the floor (the end of its butt cap), in hero space. */
export const footAt = (p: ChibiPose): V3 => onStaff(p, FOOT);

/**
 * Plants the staff: moves the right hand (and with it a left hand on the haft) up or down until the
 * staff's foot rests on the floor, so a staff leaned on or struck down stands on the ground rather
 * than hovering or sinking into it.
 */
export function plant(p: ChibiPose): ChibiPose {
  let q = p;
  for (let i = 0; i < 4; i++) {
    const rig = solveRig(BUILD, q, GRIP2, W.haft);
    const foot = add3(rig.weapon.o, rig.weapon.u, FOOT)[1];
    if (Math.abs(foot) < 0.05) break;
    const h = q.handF;
    q = { ...q, handF: h[2] === undefined ? [h[0], h[1] + foot] : [h[0], h[1] + foot, h[2]] };
  }
  return q;
}

/** A soft glow of colour over a patch of floor round a point (hero space, on the ground), `r` across, under the figure. */
export const pool =
  (at: (x: FxContext) => V3, r: number, k: number, aura?: Aura): Extra =>
  (x) => {
    if (k <= 0) return;
    const col = aura ?? x.aura;
    const g = at(x);
    const P = x.proj([g[0], 0, g[2]]);
    for (let dy = -Math.ceil(r * 0.45); dy <= Math.ceil(r * 0.45); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = (dx / r) ** 2 + (dy / (r * 0.42)) ** 2;
        if (d < 1) x.c.glow(P[0] + dx, P[1] + dy, d < 0.3 ? col.hot : col.core, k * (0.4 - d * 0.3), true);
      }
    }
  };

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * At rest: a little stooped, his weight on the staff planted ahead of him on his right, the right
 * hand high on it at his chest, the left hand tucked behind his back. Side on the staff stands
 * ahead of his face, front on out to his right beside his head.
 */
export const AT_EASE: ChibiPose = plant({
  x: 0,
  y: 1.5,
  lean: 11,
  twist: 8,
  head: 3,
  look: 3,
  footF: [3, 0, 4.6],
  footB: [-4, 0, 4.2],
  handF: [18, 6, 6],
  handB: [-7, 15, 3],
  weapon: 8,
  roll: 8,
  yaw: 0,
  wind: 0.05,
  face: 'stern',
});

/**
 * The battle stance: straightened, the staff in both hands slanted forward and up, its head at
 * his brow well ahead of him. The right hand holds it low by his hip, the left forward and up the
 * haft with the left shoulder turned forward (a positive `twist`), and the haft yawed across
 * toward his left, so side on it shows its length ahead of him and toward the viewer its head
 * stands out past his left shoulder, clear of his face.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 3,
  lean: 6,
  twist: 20,
  head: 1,
  look: -4,
  footF: [8, 0, 5],
  footB: [-8, 0, 4.4],
  handF: [5, 14, 7],
  grip: -4,
  grip2: 9,
  weapon: 46,
  roll: -10,
  yaw: -40,
  wind: 0.15,
  face: 'stern',
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A slow breath: everything above the knees settles one whole pixel for the second half of the
  // loop (the staff stays planted, the hand on it sliding with him), the beard and the robe sway
  // slowly round, and he blinks once.
  const out = i >= 4 ? 1 : 0;
  return plant(
    pose(AT_EASE, {
      y: 1.5 + out,
      head: 3 + out * 0.6,
      sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
      phase: i / 8,
      wind: 0.05 + wave(i, 8) * 0.08,
      face: i === 6 ? 'closed' : 'stern',
      fx: { rune: 0.15 + wave(i, 8) * 0.15 },
    }),
  );
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const SWAY = 8;
const sway = (i: number): number => wave(((i % SWAY) + SWAY) % SWAY, SWAY);

const battle = Array.from({ length: SWAY }, (_, i): ChibiPose => {
  // A slow, steady sway from the knees rather than a bounce: down on the beat and back up, the
  // staff's head dipping with him, the head nodding a frame behind, the orb pulsing.
  const b = sway(i);
  const lag = b - sway(i - 1);
  return pose(READY, {
    y: 3 + b * 1.6,
    lean: 6 + b * 1.5,
    head: 1 + sway(i - 1) * 2,
    handF: [5, 14 + b * 1.2, 7],
    weapon: 46 + b * 3,
    wind: 0.15 + Math.max(0, lag) * 0.15,
    lift: lag * 0.5,
    sway: Math.sin((2 * Math.PI * (i - 1)) / SWAY) * 0.2,
    phase: i / SWAY,
    fx: { rune: 0.35 + b * 0.25 },
  });
});

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride, short under the robe: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [8, 0], b: [-7, -4], y: 2 },
  { f: [4, 0], b: [-5, -7], y: 3.2 },
  { f: [0, 0], b: [2, -6], y: 1.2 },
  { f: [-4, -1], b: [7, -3], y: -0.8 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 1,
    y: k.y,
    lean: 16 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 7,
    head: -4,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.2] : [k.b[0], k.b[1], 4.2],
    footB: right ? [k.b[0], k.b[1], 4] : [k.f[0], k.f[1], 4],
    // The staff carried slanted ahead in his right hand, held low on the haft; the left arm pumps.
    handF: [4 - swing * 1.5, 15 - Math.abs(swing), 8],
    grip: -14,
    weapon: 34 + swing * 3,
    roll: 14,
    yaw: -6,
    handB: [1 + swing * 6, 13 - Math.abs(swing) * 2, 7.5],
    wind: 0.85,
    phase: i / 8,
    sway: swing * 0.2,
    face: 'grit',
    fx: { speed: 0.6, dust: i % 4 === 0 ? 0.6 : 0, rune: 0.25 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top. The combo's recoveries use it, and so do the skill and state clips that hand back to the
 * battle stance.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, battle[0] as ChibiPose, k), over);

/**
 * A pose with the staff tipped forward and down on his right, his hand at his chest. The way back
 * to the battle stance from a staff held upright on his right goes through it, so that toward the
 * viewer the orb passes under his chin on its way across to his left, never over his face.
 */
export const dipped = (p: ChibiPose): ChibiPose => pose(p, { handF: [12, 10, 8], grip: -4, weapon: 74, roll: 8, yaw: -6 });

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. A skill or state clip that the battle loop hands over to starts with it, so its first frame
 * carries the staff on from where the loop holds it. Keep k at 0.5 or more: the hands, face and
 * effects then come from the pose.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(battle[0] as ChibiPose, p, k), over);

// atk1: the staff drawn back upright, then flicked forward at the aim, its head stopping at his
// brow well ahead of him (a staff, not a spear: it never comes down level).
const A1_DRAW = pose(READY, { x: -1, y: 3, lean: 0, twist: 24, head: -2, handF: [2, 11, 9], grip: -4, grip2: 9, weapon: 4, roll: 10, yaw: -4, wind: 0.2, face: 'grit', fx: { rune: 0.8, extra: gather(0.8, 0) } });
const A1_FLICK = pose(READY, { x: 2, y: 4, lean: 13, twist: 12, head: 3, handF: [9, 13, 6], grip: -4, grip2: 9, weapon: 60, roll: -8, yaw: -30, wind: 0.45, phase: 0.2, face: 'shout', fx: { rune: 1 } });
const A1_HOLD = pose(A1_FLICK, { y: 4.5, lean: 14, handF: [9, 13.5, 6], weapon: 62, wind: 0.55, phase: 0.35, face: 'grit', fx: { rune: 0.7 } });

const atk1: ChibiPose[] = [
  A1_DRAW,
  release(A1_FLICK, 1, 1, 30),
  release(A1_HOLD, 0, 0.7, 56),
  release(pose(A1_HOLD, { lean: 12, weapon: 58, wind: 0.4, lift: 0.2, phase: 0.5, face: 'stern', fx: { rune: 0.5 } }), 0, 0.3, 70),
  settle(A1_HOLD, 0.45, { wind: 0.3, lift: 0.2, phase: 0.65, face: 'stern', fx: { rune: 0.4 } }),
  settle(A1_HOLD, 0.75, { wind: 0.22, lift: 0.1, phase: 0.8, fx: { rune: 0.35 } }),
  settle(A1_HOLD, 0.92, { wind: 0.16, phase: 0.95, fx: { rune: 0.35 } }),
];

// atk2: a backhand: the staff, in his right hand alone, cocked low across to his left, then
// swept up and out to his right in a short teal arc, the left hand thrown open toward the aim.
const A2_COCK = pose(READY, { x: 0, y: 4, lean: 8, twist: 28, head: 1, look: -8, handF: [4, 15, 2], handB: [3, 13, 8], grip: -2, weapon: 112, roll: 0, yaw: -58, wind: 0.2, sway: -0.3, face: 'grit', fx: { rune: 0.8, extra: gather(0.8, 0.5) } });
const A2_SWEEP = pose(READY, { x: 2, y: 4, lean: 12, twist: -2, head: 2, look: 0, handF: [10, 12, 9], handB: [12, 9, 5], grip: -2, weapon: 56, roll: 10, yaw: 4, wind: 0.5, sway: 0.3, phase: 0.2, face: 'shout', fx: { rune: 1, smear: { from: 112, roll: 0, yaw: -58, width: 0.45, alpha: 0.9 } } });
const A2_HOLD = pose(A2_SWEEP, { y: 4.5, lean: 13, weapon: 54, yaw: 6, wind: 0.55, phase: 0.35, face: 'grit', fx: { rune: 0.7, smear: { from: 112, roll: 0, yaw: -58, width: 0.4, alpha: 0.35 } } });

const atk2: ChibiPose[] = [
  A2_COCK,
  release(A2_SWEEP, 1, 1, 30),
  release(A2_HOLD, 0, 0.7, 56),
  release(pose(A2_HOLD, { lean: 11, weapon: 52, wind: 0.4, lift: 0.2, phase: 0.5, face: 'stern', fx: { rune: 0.5 } }), 0, 0.3, 70),
  // Back across to the stance, the staff's head dipped so that toward the viewer it passes under
  // his chin rather than across his face.
  settle(A2_HOLD, 0.45, { weapon: 70, wind: 0.3, lift: 0.2, phase: 0.65, face: 'stern', fx: { rune: 0.4 } }),
  settle(A2_HOLD, 0.75, { weapon: 58, wind: 0.22, lift: 0.1, phase: 0.8, fx: { rune: 0.35 } }),
  settle(A2_HOLD, 0.92, { wind: 0.16, phase: 0.95, fx: { rune: 0.35 } }),
];

// atk3: the staff raised in both hands while a ball of light swells in the orb, then a lunging
// two-handed thrust that hurls it at the aim.
const A3_RAISE = pose(READY, { x: -2, y: 4, lean: -4, twist: 18, head: -4, look: -2, footF: [9, 0, 5.2], footB: [-9, 0, 4.6], handF: [1, 6, 9], grip: -4, grip2: 9, weapon: 14, roll: 2, yaw: -26, wind: 0.25, lift: 0.3, face: 'grit', fx: { rune: 0.9, extra: both(ball(fromOrb(1, [0, 1, 0]), 3, 0.9), gather(0.7, 0)) } });
const A3_HIGH = pose(A3_RAISE, { y: 4.5, lean: -6, head: -6, handF: [0, 4, 9], weapon: 10, wind: 0.3, lift: 0.45, phase: 0.1, fx: { rune: 1, aura: 0.3, extra: both(ball(fromOrb(1, [0, 1, 0]), 5, 1), gather(1, 0.4, 11)) } });
const A3_THRUST = pose(READY, { x: 4, y: 6, lean: 17, twist: 10, head: 3, look: -2, footF: [12, 0, 5.4], footB: [-9, 0, 4.6], handF: [11, 11, 6], grip: -4, grip2: 9, weapon: 64, roll: -6, yaw: -26, wind: 0.6, lift: 0, phase: 0.25, face: 'shout', fx: { rune: 1 } });
const A3_HOLD = pose(A3_THRUST, { y: 6.5, lean: 18, handF: [11, 11.5, 6], weapon: 66, wind: 0.7, phase: 0.4, face: 'grit', fx: { rune: 0.7 } });

const atk3: ChibiPose[] = [
  A3_RAISE,
  A3_HIGH,
  withExtra(release(A3_THRUST, 1.4, 1, 20), ball(fromOrb(12), 6, 1)),
  withExtra(release(A3_HOLD, 0, 0.8, 40), ball(fromOrb(36), 5.5, 1)),
  withExtra(release(pose(A3_HOLD, { lean: 15, weapon: 62, wind: 0.5, lift: 0.25, phase: 0.55, face: 'stern', fx: { rune: 0.5 } }), 0, 0.4, 60), ball(fromOrb(60), 5, 0.7)),
  settle(A3_HOLD, 0.35, { wind: 0.4, lift: 0.25, phase: 0.7, face: 'stern', fx: { rune: 0.45 } }),
  settle(A3_HOLD, 0.6, { wind: 0.3, lift: 0.15, phase: 0.85, fx: { rune: 0.4 } }),
  settle(A3_HOLD, 0.82, { wind: 0.22, lift: 0.05, phase: 1, fx: { rune: 0.35 } }),
  settle(A3_HOLD, 0.95, { wind: 0.16, phase: 1.1, fx: { rune: 0.35 } }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
