/**
 * The Arbalest's core moves: stances, running and the three shots of his basic attack. Poses use
 * the chibi pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck,
 * the crossbow's angle (90 pointing ahead), its `roll` and `yaw`, its `draw` (1 spanned, 0 just
 * loosed) and `nock` (a bolt in the groove), and the cloth's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, the crossbow carried at his right hip pointing ahead and down, his left
 *              thumb hooked in his belt: a slow breath, a glance aside, a blink
 *   battle  8  the crossbow shouldered, nose a little down, feet planted wide and braced: a
 *              soldier's steady breathing, the nose rising and falling a pixel
 *   move    8  a heavy run, the crossbow carried at his right hip, the left arm pumping, the coat
 *              streaming
 *   atk1    6  (1 wind-up) Bolt I: his cheek down to the stock, a squint, then the trigger: the
 *              string snaps forward with a flash at the bolt's point and a trail, a kick, and the
 *              lever racked forward and back to span and load it again
 *   atk2    6  (1 wind-up) Bolt II: the same from a lower, steadier crouch, a little to his left
 *   atk3    7  (1 wind-up) Bolt III: a heavier shot that kicks him back a step
 *
 * The release always comes on the first frame after the wind-up, as the game fires the bolt then:
 * `draw: 0, nock: false` with `fx.flash` and `fx.trail` leaving from the bolt's point. Every shot
 * ends back in the battle stance (`settle`), spanned and loaded, so the loop takes over cleanly.
 */
import { all, fireburst, goldTrail, type Shot } from './effects.js';
import { leverEnds } from './gear.js';
import { ARBALEST, BOLT_V, LEVER } from './design.js';
import { add3, type ChibiPose, mix, pose, solveRig, wave } from '../rig.js';

const BUILD = ARBALEST.build;
const GRIP2 = ARBALEST.weapon.grip2;
const TIP = ARBALEST.weapon.tip ?? ARBALEST.weapon.reach[1];

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

/**
 * Puts the left hand on the cocking lever's grip, wherever the pose's `draw` throws it (see
 * gear.ts `leverAngle`): folded along the fore-stock when spanned, thrown forward and up over the
 * prod as he racks it, hauled back as the string comes to the nut. The right hand keeps the
 * crossbow where the pose holds it.
 */
export function onLever(p: ChibiPose): ChibiPose {
  const rig = solveRig(BUILD, { ...p, handB: undefined }, GRIP2);
  const { end } = leverEnds(rig.weapon, LEVER, p.draw);
  return { ...p, handB: [end[0] - rig.neck[0], rig.neck[1] - end[1], -end[2]] };
}

/**
 * Where a shot leaves the crossbow held as in pose `p` (the point of the bolt as it lies in the
 * groove) and the line it flies along (the stock's), in hero space: the release frame's flash and
 * the trail in the frames after keep to the line of the aim it was loosed from, while the crossbow
 * kicks up.
 */
export function shotOf(p: ChibiPose): Required<Shot> {
  const w = solveRig(BUILD, p, GRIP2).weapon;
  return { tip: add3(add3(w.o, w.u, TIP), w.v, BOLT_V), dir: w.u };
}

/**
 * A shot loosed from pose `aim` on the release frame `fire`: it leaves from the bolt's point on the
 * crossbow as it is drawn in that frame (the kick has already thrown the nose up a little, and the
 * flash belongs on the nose) and flies along the line of the aim, where the game's bolt goes. The
 * trail keeps to that line in the frames after, while the crossbow rides the kick.
 */
export function releaseOf(aim: ChibiPose, fire: ChibiPose): Required<Shot> {
  return { tip: shotOf(fire).tip, dir: shotOf(aim).dir };
}

/** A release frame's effects for a shot: a flash at the bolt's point, a fiery burst and a gold trail along the aim. */
export const loosed = (shot: Required<Shot>, flash = 1, len = 52, burst = 0.5): ChibiPose['fx'] => ({
  flash: { k: flash, from: shot.tip, dir: shot.dir },
  extra: all(fireburst(burst, shot), goldTrail(1.2, len, shot)),
});

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * Shouldered and aiming: the butt in his right shoulder, his cheek on the stock and his left eye
 * shut, the left hand on the fore-stock, the right elbow out; feet planted wide and braced.
 */
export const AIM: ChibiPose = {
  x: 0,
  y: 4,
  lean: 6,
  twist: 22,
  head: 6,
  look: -8,
  footF: [10, 0, 5.8],
  footB: [-11, 0, 5.2],
  handF: [9, 1, 4],
  elbowF: [-0.8, -0.2, 1],
  weapon: 90,
  roll: 0,
  yaw: 2,
  grip2: 11,
  face: 'grit',
  wink: 'L',
  wind: 0.15,
};

/** The battle stance: shouldered, the nose a little down, his head up to watch over the prod. */
export const READY: ChibiPose = pose(AIM, { y: 4.5, head: 1, look: -4, handF: [9, 5, 4.4], weapon: 96, face: 'stern', wink: undefined });

/** At ease: the crossbow at his right hip, pointing ahead and down, the left thumb in his belt. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 6,
  head: -2,
  look: 4,
  footF: [4, 0, 5],
  footB: [-5, 0, 4.6],
  handF: [3, 15.5, 8.5],
  handB: [3, 15, 4],
  weapon: 118,
  roll: 0,
  yaw: -12,
  wind: 0.05,
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath (everything above the knees settles a whole pixel for the second half of the loop),
  // the crossbow dipping with it, a glance aside and back and a blink.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 1 + out,
    weapon: 118 + out * 2,
    look: i >= 2 && i <= 4 ? -6 : 4,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.15,
    phase: i / 8,
    wind: 0.05 + wave(i, 8) * 0.05,
    face: i === 6 ? 'closed' : 'stern',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const battle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // Steady breathing behind the stock: down a pixel and a half and up again, the nose dipping a
  // little with it and the head a frame behind; the coat settles a frame after the body.
  const b = wave(i, 8);
  const lag = b - wave(i - 1, 8);
  return pose(READY, {
    y: 4 + b * 1.5,
    lean: 6 + b,
    head: 1 + wave(i - 1, 8) * 1.5,
    handF: [9, 5 + b * 0.8, 4.4],
    weapon: 95 + b * 2,
    wind: 0.15 + Math.max(0, lag) * 0.15,
    lift: lag * 0.5,
    sway: Math.sin((2 * Math.PI * (i - 1)) / 8) * 0.15,
    phase: i / 8,
  });
});

/** The first battle frame, where shots and skills start from and end. */
export const STANCE = battle[0] as ChibiPose;

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over`
 * on top. Shots and skills that hand back to the battle stance end with it, spanned and loaded.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, STANCE, k), { draw: undefined, nock: undefined, handB: undefined, ...over });

/** Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on top. */
export const fromStance = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(STANCE, p, k), over);

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [10, 0], b: [-9, -5], y: 2 },
  { f: [5, 0], b: [-7, -9], y: 3.6 },
  { f: [0, 0], b: [2, -8], y: 1 },
  { f: [-6, -1.5], b: [8, -4], y: -2 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 2,
    y: k.y,
    lean: 20 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 5,
    head: -8,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4.4] : [k.b[0], k.b[1], 4.4],
    footB: right ? [k.b[0], k.b[1], 4.2] : [k.f[0], k.f[1], 4.2],
    // Carried at his right hip, pointing ahead and down, rocking with the stride; the left arm
    // pumps against the legs.
    handF: [1 - swing, 15 - Math.abs(swing) * 0.6, 8.5],
    weapon: 112 + swing * 5,
    roll: 0,
    yaw: -12,
    handB: [2 + swing * 7, 12 - Math.abs(swing) * 2.5, 8.5],
    wind: 1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.7, dust: i % 4 === 0 ? 0.8 : 0 },
  };
});

// ── The shots ────────────────────────────────────────────────────────────────────────────────

/**
 * A shot from the shoulder: the wind-up frame (`aim`), then the release (`kick`: the string
 * forward, the flash and trail leaving the bolt's point), the trail fading as he rides the kick,
 * the lever thrown forward and hauled back (the string to the nut, a fresh bolt), and the
 * battle stance. `heavy` adds to the kick and the frames that follow it.
 */
function shot(aim: ChibiPose, kick: Partial<ChibiPose>, flash: number, heavy = 0): ChibiPose[] {
  const kicked = pose(aim, kick);
  const line = releaseOf(aim, kicked);
  const fire = pose(kicked, { draw: 0, nock: false, face: kick.face ?? 'grit', wind: 0.3 + heavy * 0.2, phase: 0.2, fx: { ...loosed(line, flash, 52, 0.55 + heavy * 0.5), dust: heavy ? 0.9 : 0 } });
  const ride = pose(fire, { x: fire.x - 0.5 - heavy, lean: fire.lean - heavy * 5, weapon: fire.weapon - 3 - heavy * 2, handF: [(fire.handF[0] as number) - 0.5 - heavy, (fire.handF[1] as number) - 0.3 - heavy, 4], wink: undefined, face: 'stern', wind: 0.35, lift: 0.2, phase: 0.35, fx: { extra: goldTrail(0.5, 70, line), dust: heavy * 0.4 } });
  const out: ChibiPose[] = [aim, fire, ride];
  if (heavy) out.push(pose(ride, { x: ride.x - 0.5, lean: ride.lean + 2, weapon: ride.weapon + 4, wind: 0.25, lift: 0.3, phase: 0.45, fx: undefined }));
  out.push(
    onLever(pose(mix(ride, STANCE, 0.4), { draw: 0.2, nock: false, face: 'stern', wink: undefined, wind: 0.2, lift: 0.15, phase: 0.55, fx: undefined })),
    onLever(pose(mix(ride, STANCE, 0.75), { draw: 0.75, nock: false, face: 'stern', wink: undefined, wind: 0.18, lift: 0, phase: 0.7, fx: undefined })),
    settle(ride, 1, { phase: 0.85 }),
  );
  return out;
}

const atk1 = shot(AIM, { x: -1, lean: 4, handF: [7.5, 0.5, 4], weapon: 87 }, 1.25);
// The second after a half step in with the lead foot, from a lower crouch, his shoulders turned a
// little more to the target and the stock canted to his left: the chain has a rhythm.
const AIM2 = pose(AIM, { x: 1, y: 6, lean: 9, twist: 30, head: 7, footF: [13, 0, 6.2], footB: [-10, 0, 5.4], handF: [9.5, 2.5, 4], yaw: -6, phase: 0.1 });
const atk2 = shot(AIM2, { x: 0, lean: 6, twist: 27, handF: [8, 1.5, 4], weapon: 86 }, 1.3);
// The third kicks hardest: the nose jumps ten degrees more, he rocks back a half step onto his
// rear foot, a bigger flash and dust at his boots.
const AIM3 = pose(AIM, { y: 5, lean: 9, head: 7, footF: [11, 0, 6], footB: [-12, 0, 5.4] });
const atk3 = shot(AIM3, { x: -3.5, y: 4.5, lean: 0, head: 3, footF: [10, -1.5, 6], footB: [-13, 0, 5.4], handF: [6, -0.5, 4], weapon: 79, face: 'shout' }, 1.6, 1);

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
