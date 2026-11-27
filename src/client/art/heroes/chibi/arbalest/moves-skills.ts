/**
 * The Arbalest's skills, in the chibi pose format (rig.ts, ChibiPose). Each starts from the battle
 * stance (moves-core.ts `STANCE`) and hands back to it (`settle`), spanned and loaded. Every shot
 * is loosed on the first frame after the wind-up, when the game fires the bolt: `draw: 0, nock:
 * false` with a flash at the bolt's point and a trail along the aim; the lever is then racked
 * (moves-core.ts `onLever`) to span it again. His skills have no wind-up on the server, so each
 * wind-up frame takes 0.06 s while the bolt is already flying: they are kept to one, so the flash
 * comes close behind the game's own bolt (loading a fresh bolt comes after a shot, never before).
 *
 *   special  8  (1 wind-up) Piercing Bolt: a steadied aim, cheek to the stock, the bolt's head
 *               glowing; a white-hot streak on release and a strong kick
 *   q        9  (1 wind-up) Explosive Bolt: shouldered, the loaded bolt's head burning amber, and
 *               fired with a fiery muzzle burst; he rocks back on his heels in the smoke, racks
 *               the lever and lays the next glowing bolt in the groove from the bandolier
 *   e        9  (1 wind-up) Tumble Shot: a snap shot from a crouch as he springs back into a
 *               backward roll (the server moves him), coming up on one knee with the crossbow
 *               levelled again
 *   r        8  (1 wind-up) Scattershot: braced low and wide, a blast of shrapnel fanning out of
 *               the prod in a cone of sparks, a heavy kick that skids him back
 *   ult      16 (1 wind-up) Siege Barrage: feet planted, he fires a rapid string of bolts across a
 *               narrow arc, racking the lever between shots, with repeated flashes, gathering
 *               smoke and spent sparks, the last shot the heaviest
 *   cast     8  (2 wind-up) Vault, Field Dressing and the Elixir: the crossbow slung on his back,
 *               a bandage bound round his left forearm in a glow of warm motes, then the crossbow
 *               taken back and shouldered
 */
import { all, bandage, charged, fireburst, goldTrail, muzzleRays, rollArc, shrapnel, smoke, spentSparks, streak, warmMotes } from './effects.js';
import { ARBALEST } from './design.js';
import { AIM, fromStance, loosed, onLever, releaseOf, settle, STANCE } from './moves-core.js';
import { at3, type ChibiPose, mix, pose, solveRig } from '../rig.js';

const BUILD = ARBALEST.build;
const GRIP2 = ARBALEST.weapon.grip2;
/** A pale gold, for the Piercing Bolt's charge. */
const PALE: [number, number, number] = [255, 236, 190];

/** A lever rack k of the way from one pose to another: the lever thrown (`draw` about 0.2) or hauled back (about 0.75). */
const rack = (a: ChibiPose, b: ChibiPose, k: number, draw: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  onLever(pose(mix(a, b, k), { draw, nock: false, wink: undefined, face: 'stern', fx: undefined, ...over }));

// ── Piercing Bolt ────────────────────────────────────────────────────────────────────────────

/** Steadied: lower and stiller than a quick shot, his head down on the stock and his cheek pressed to it. */
const STEADY = pose(AIM, { y: 7, lean: 11, head: 12, look: -10, footF: [12, 0, 6.2], footB: [-12.5, 0, 5.6], handF: [9.5, 2.5, 4], yaw: 0, face: 'grit', wink: 'L' });
const P_KICK = pose(STEADY, { x: -2.5, y: 6, lean: 5, head: 7, handF: [7, 1.5, 4], weapon: 85 });
const P_SHOT = releaseOf(STEADY, P_KICK);
const P_FIRE = pose(P_KICK, { draw: 0, nock: false, face: 'grit', wind: 0.55, lift: 0.2, phase: 0.2, fx: { flash: { k: 1.5, from: P_SHOT.tip, dir: P_SHOT.dir }, extra: all(streak(1, 110, P_SHOT, 2), goldTrail(0.9, 60, P_SHOT)), dust: 0.7 } });
const P_RIDE = pose(P_FIRE, { x: -3, lean: -1, head: 3, handF: [6, 0, 4], weapon: 79, wink: undefined, face: 'stern', wind: 0.45, lift: 0.35, phase: 0.35, fx: { extra: all(streak(0.5, 120, P_SHOT, 2), smoke(0.2, 0, 0.6)), dust: 0.3 } });

const special: ChibiPose[] = [
  // Wind-up: settled low, head down on the stock, the bolt's head glowing pale gold in a ring.
  pose(STEADY, { fx: { rune: 1.1, extra: charged(1, PALE, 0, true) } }),
  P_FIRE,
  P_RIDE,
  pose(P_RIDE, { x: -2.5, lean: 2, weapon: 86, handF: [7.5, 1, 4], wind: 0.3, lift: 0.2, phase: 0.5, fx: { extra: smoke(0.55, 0, 0.5) } }),
  rack(P_RIDE, STANCE, 0.45, 0.2, { x: -1.5, phase: 0.62, fx: { extra: smoke(0.85, 0, 0.35) } }),
  rack(P_RIDE, STANCE, 0.75, 0.75, { x: -0.6, phase: 0.75 }),
  settle(P_RIDE, 0.9, { phase: 0.88 }),
  settle(P_RIDE, 1, { phase: 1 }),
];

// ── Explosive Bolt ───────────────────────────────────────────────────────────────────────────

/** Shouldered with the explosive bolt already in the groove, its head burning amber. */
const Q_AIM = pose(AIM, { y: 5, lean: 7, head: 7, footF: [11, 0, 6], footB: [-12, 0, 5.4] });
const Q_KICK = pose(Q_AIM, { x: -2.5, y: 4.5, lean: 2, head: 3, look: -4, handF: [7, 0, 4], weapon: 84 });
const Q_SHOT = releaseOf(Q_AIM, Q_KICK);
const Q_FIRE = pose(Q_KICK, { draw: 0, nock: false, face: 'shout', wink: undefined, wind: 0.7, lift: 0.4, phase: 0.2, fx: { flash: { k: 1.5, from: Q_SHOT.tip, dir: Q_SHOT.dir }, extra: all(muzzleRays(0.75, 10, 22), fireburst(1.35, Q_SHOT), goldTrail(1, 56, Q_SHOT)) } });
const Q_ROCK = pose(Q_FIRE, { x: -4, y: 3.5, lean: -12, head: -5, footF: [9, -3, 6], handF: [4.5, -3, 4], weapon: 72, face: 'grit', wind: 0.5, lift: 0.5, phase: 0.35, fx: { extra: all(fireburst(0.6, { dir: Q_SHOT.dir }), smoke(0.15, 3), goldTrail(0.4, 70, Q_SHOT)) } });
/** The next explosive bolt drawn from the bandolier while the smoke clears, his left hand at his chest. */
const Q_LOAD = pose(STANCE, { x: -2, y: 5, lean: 8, twist: 14, head: 8, look: 0, handF: [8, 5, 5], handB: [3, 7, 1], weapon: 100, yaw: -4, nock: false, face: 'stern' });

const q: ChibiPose[] = [
  // Wind-up: shouldered, the explosive bolt's head glowing hot.
  pose(Q_AIM, { fx: { rune: 1.2, extra: charged(1.2) } }),
  Q_FIRE,
  Q_ROCK,
  // Rocking forward onto both feet again in the smoke.
  pose(Q_ROCK, { x: -3, y: 5, lean: 0, head: 2, footF: [10, 0, 6], handF: [6.5, -0.5, 4], weapon: 80, wind: 0.3, lift: 0.3, phase: 0.5, fx: { extra: smoke(0.45, 3) } }),
  // The lever thrown and the string hauled to the nut...
  rack(Q_ROCK, STANCE, 0.45, 0.2, { x: -2, footF: [10, 0, 6], phase: 0.62, fx: { extra: smoke(0.7, 3, 0.7) } }),
  rack(Q_ROCK, STANCE, 0.7, 0.75, { x: -1.5, footF: [10, 0, 6], phase: 0.72, fx: { extra: smoke(0.9, 3, 0.45) } }),
  // ...and the next glowing bolt laid in the groove from the bandolier.
  pose(Q_LOAD, { handB: [11, 6, -2], weapon: 98, nock: true, phase: 0.82, fx: { rune: 0.7, extra: all(charged(0.6, undefined, 5), smoke(1, 3, 0.25)) } }),
  settle(Q_LOAD, 0.75, { nock: true, phase: 0.92, fx: { rune: 0.4 } }),
  settle(Q_LOAD, 1, { phase: 1 }),
];

// ── Tumble Shot ──────────────────────────────────────────────────────────────────────────────
// The server moves him five tiles back while he rolls, so the roll stays about where he stands in
// the frame: the game slides the whole sprite back.

/** A crouch, the crossbow levelled low from the hip, about to spring back. */
const CROUCH = pose(AIM, { x: 1, y: 9, lean: 16, twist: 12, head: 2, look: -4, footF: [9, 0, 5.6], footB: [-8, 0, 5], handF: [8, 7, 5], elbowF: undefined, weapon: 92, yaw: -10, wink: undefined, face: 'grit' });
const E_KICK = pose(CROUCH, { x: -1, y: 8, lean: 8, head: 0, footF: [10, -2, 5.6], footB: [-8, 0, 5], handF: [7, 6, 5], weapon: 88 });
const E_SHOT = releaseOf(CROUCH, E_KICK);
/** Sat back into the roll, knees up, the crossbow hugged to his chest, the coat spreading on the floor. */
const ROLL_SIT = { x: -2, y: 15, lean: -48, twist: 0, head: 14, look: 0, footF: [8, -10, 5], footB: [5, -7, 4.6], handF: [5, 10, 6], handB: [6, 12, 2], weapon: 25, roll: 20, yaw: -20, draw: 0, nock: false, face: 'grit', wind: -0.4, lift: 0.5, flare: 0.5, phase: 0.3 } as const satisfies ChibiPose;
/** Upside down over his shoulders: the head tucked low behind him, his boots swung up over it, the coat tails flaring. */
const ROLL_OVER = pose(ROLL_SIT, { x: 0, y: -1, lean: -135, head: -10, footF: [-24, -38, 5], footB: [-19, -36, 4.6], handF: [6, 8, 6], handB: [7, 10, 2], weapon: 0, roll: 30, wind: -0.2, lift: 0.9, flare: 0.7, phase: 0.45 });
/** Coming over onto his right knee, the crossbow coming round. */
const ROLL_UP = { x: -2, y: 13, lean: 30, twist: 6, head: 14, look: 0, footF: [-14, -1, 5], footB: [4, -3, 5], kneel: 'F', handF: [7, 10, 6], weapon: 60, roll: 10, yaw: -20, grip2: 11, draw: 0.8, nock: false, face: 'grit', wind: -0.3, lift: 0.3, phase: 0.6 } as const satisfies ChibiPose;
/** Up on his right knee, the crossbow levelled at the shoulder. */
const KNEE_AIM = pose(AIM, { x: 0, y: 12, lean: 8, twist: 20, head: 6, footF: [-12, 0, 6], footB: [8, 0, 6.5], kneel: 'F', handF: [9, 1.5, 4], face: 'stern', wink: 'L', wind: 0.1, phase: 0.75 });

const e: ChibiPose[] = [
  fromStance(CROUCH, 0.75),
  // The snap shot as he springs back.
  pose(E_KICK, { draw: 0, nock: false, wind: -0.3, lift: 0.3, phase: 0.15, fx: { ...loosed(E_SHOT), dust: 0.6 } }),
  pose(ROLL_SIT, { fx: { dust: 0.7, extra: rollArc(0.7, -50, 50) } }),
  pose(ROLL_OVER, { fx: { extra: rollArc(1, 10, 170) } }),
  pose(ROLL_UP, { fx: { dust: 0.8, extra: rollArc(0.55, 120, 250) } }),
  pose(KNEE_AIM, { draw: 1, nock: true }),
  pose(KNEE_AIM, { y: 11.5, head: 5, wink: undefined, phase: 0.85 }),
  // Up off the knee into the stance.
  pose(mix(KNEE_AIM, STANCE, 0.55), { kneel: undefined, footF: [7, 0, 5.8], footB: [-8, 0, 5.2], face: 'stern', wink: undefined, phase: 0.92 }),
  settle(KNEE_AIM, 1, { kneel: undefined, phase: 1 }),
];

// ── Scattershot ──────────────────────────────────────────────────────────────────────────────

/** Braced low and wide, the crossbow levelled at the hip-shoulder, his head tucked down behind it. */
const BRACED = pose(AIM, { y: 12, lean: 15, twist: 18, head: 10, look: -6, footF: [16, 0, 7.2], footB: [-16, 0, 6.6], handF: [9.5, 6, 4.5], weapon: 93, face: 'grit', wink: undefined });
const R_KICK = pose(BRACED, { x: -3, y: 11, lean: 7, head: 4, footF: [15, -1, 7.2], handF: [7, 4.5, 4.5], weapon: 85 });
const R_SHOT = releaseOf(BRACED, R_KICK);
/** The shrapnel keeps flying along the aim from wherever the prod has skidded to, so there is never a gap at the cone's apex. */
const R_LINE = { dir: R_SHOT.dir };
const R_FIRE = pose(R_KICK, { draw: 0, nock: false, face: 'shout', wind: 0.8, lift: 0.4, phase: 0.2, fx: { flash: { k: 1.5, from: R_SHOT.tip, dir: R_SHOT.dir }, extra: all(shrapnel(0, R_SHOT), muzzleRays(0.6, 8, 18), fireburst(1.1, R_SHOT)), dust: 1 } });
const R_SKID = pose(R_FIRE, { x: -5, y: 10.5, lean: -3, head: 0, footF: [14, 0, 7.2], footB: [-17, 0, 6.6], handF: [6, 3, 4.5], weapon: 76, face: 'grit', wind: 0.55, lift: 0.3, phase: 0.35, fx: { extra: all(shrapnel(0.4, R_LINE), smoke(0.2, 7)), dust: 0.8 } });

const r: ChibiPose[] = [
  // Wind-up: dropped low and wide, braced, the head tucked down behind the stock.
  pose(BRACED, { fx: { rune: 1 } }),
  R_FIRE,
  R_SKID,
  pose(R_SKID, { x: -5, y: 9, lean: 4, head: 4, weapon: 84, handF: [7.5, 3.5, 4.5], face: 'stern', wind: 0.35, lift: 0.2, phase: 0.5, fx: { extra: all(shrapnel(0.75, R_LINE), smoke(0.55, 7)) } }),
  rack(R_SKID, STANCE, 0.45, 0.2, { x: -3.5, phase: 0.62, fx: { extra: all(shrapnel(1, R_LINE), smoke(0.85, 7, 0.6)) } }),
  rack(R_SKID, STANCE, 0.75, 0.75, { x: -2, phase: 0.75 }),
  settle(R_SKID, 0.9, { x: -0.8, phase: 0.88 }),
  settle(R_SKID, 1, { phase: 1 }),
];

// ── Siege Barrage ────────────────────────────────────────────────────────────────────────────

/** Planted wide and low for the barrage, the crossbow shouldered. */
const PLANTED = pose(AIM, { y: 7, lean: 9, head: 6, footF: [14, 0, 6.8], footB: [-14, 0, 6.2] });

/** The barrage's spread: each shot's swing across the arc (`yaw`) and its rise or dip (`weapon`), so the trails fan out. */
const FAN: readonly (readonly [number, number])[] = [
  [-10, 94],
  [5, 85],
  [-4, 92],
  [10, 86],
  [0, 89],
];

/** One shot of the barrage, `i` of five, the last the heaviest. */
function volley(i: number): ChibiPose[] {
  const last = i === 4;
  const [yaw, weapon] = FAN[i] as readonly [number, number];
  const back = i * 0.4;
  const aim = pose(PLANTED, { x: -back, yaw, weapon, phase: 0.1 + i * 0.16 });
  const kick = pose(aim, { x: -back - (last ? 3 : 1.2), lean: last ? 0 : 5, head: last ? 2 : 5, handF: last ? [7, 0, 4] : [8, 0.5, 4], weapon: weapon - (last ? 7 : 3) });
  const line = releaseOf(aim, kick);
  const fire = pose(kick, {
    draw: 0,
    nock: false,
    face: last ? 'shout' : 'grit',
    wink: last ? undefined : 'L',
    wind: last ? 0.7 : 0.4,
    lift: 0.2,
    fx: {
      flash: { k: last ? 1.5 : 1.15, from: line.tip, dir: line.dir },
      dust: last ? 0.9 : 0.35,
      aura: 0.25,
      extra: all(goldTrail(1.1, last ? 70 : 52, line), smoke(0.1 + i * 0.14, i, 0.55 + i * 0.12), ...(last ? [muzzleRays(0.7, 10, 22), fireburst(0.9, line)] : []), ...(i > 0 ? [spentSparks(0.5, i)] : [])),
    },
  });
  if (last) return [fire];
  // Between shots the lever is thrown out and hauled back in one stroke, the rear elbow pumping,
  // the last trail still fading and the smoke thickening.
  const crank = onLever(
    pose(aim, {
      x: -back - 0.6,
      lean: 7,
      weapon: weapon - 1,
      elbowF: [-0.6, 0.5, 1],
      draw: 0.12,
      nock: false,
      wink: undefined,
      wind: 0.3,
      fx: { aura: 0.15, extra: all(goldTrail(0.4, 66, line), smoke(0.25 + i * 0.14, i + 10, 0.65 + i * 0.12), spentSparks(0.2 + i * 0.1, i + 20)) },
    }),
  );
  return [fire, crank];
}

const U_LAST = pose(PLANTED, { x: -4.6, lean: 2, head: 3, handF: [6.5, -0.5, 4], weapon: 80, yaw: 0, draw: 0, nock: false, face: 'grit', wink: undefined, wind: 0.5, lift: 0.4, phase: 0.85 });

const ult: ChibiPose[] = [
  // Wind-up: dropped low into a wide crouch, the nose dipped and the lever thrown right open over
  // the prod under his left hand, a glow gathering round him; he rises into the first shot.
  onLever(pose(PLANTED, { y: 11, lean: 15, head: 10, footF: [17, 0, 7.4], footB: [-16, 0, 6.8], elbowF: [-0.6, 0.5, 1], yaw: -12, weapon: 102, draw: 0.2, face: 'grit', fx: { rune: 0.8, aura: 0.6 } })),
  ...volley(0),
  ...volley(1),
  ...volley(2),
  ...volley(3),
  ...volley(4),
  pose(U_LAST, { x: -4.5, lean: -2, weapon: 76, phase: 0.8, fx: { extra: all(smoke(0.6, 5, 1.1), smoke(0.35, 15, 0.9), spentSparks(0.7, 9)) } }),
  pose(U_LAST, { fx: { extra: all(smoke(0.8, 5, 0.9), smoke(0.6, 15, 0.7), spentSparks(0.95, 9)) } }),
  rack(U_LAST, STANCE, 0.45, 0.2, { x: -2.4, phase: 0.92, fx: { extra: smoke(0.95, 5, 0.6) } }),
  rack(U_LAST, STANCE, 0.75, 0.75, { x: -1, phase: 1, fx: { extra: smoke(1, 5, 0.3) } }),
  settle(U_LAST, 0.9, { x: -0.4, phase: 1.05 }),
  settle(U_LAST, 1, { phase: 1.1 }),
];

// ── Cast: the crossbow slung, a bandage bound ────────────────────────────────────────────────

/**
 * The crossbow slung on his back for a frame: it hangs nose down behind him, tilted across his
 * back, the butt up by his right shoulder (laid there as a dropped weapon, at a place on his back
 * worked out from the pose's torso).
 */
function slung(p: ChibiPose): ChibiPose {
  const rig = solveRig(BUILD, { ...p, drop: false }, GRIP2);
  return { ...p, drop: true, dropAt: at3(rig.chest, -8.5, 17, 2), weapon: 196, roll: 24, yaw: 0, draw: 1, nock: true };
}

/** Both hands free: the left forearm held across his chest, the right hand winding a bandage round it. */
const BIND: ChibiPose = { x: 0, y: 2, lean: 6, twist: -6, head: 12, look: 8, footF: [5, 0, 5.2], footB: [-6, 0, 4.8], handF: [7, 11, 2], handB: [8, 9, 1], elbowB: [0.3, -0.3, 1], weapon: 0, face: 'grit', wind: 0.1 };

const cast: ChibiPose[] = [
  // Wind-up: the crossbow swung up onto his right shoulder...
  fromStance(pose(STANCE, { y: 3, lean: 3, twist: 6, head: 2, handF: [-1, 1, 11], handB: [3, 14, 6], weapon: -58, roll: 14, yaw: -14, face: 'stern' }), 0.8),
  // ...and slung on his back; his hands come together.
  slung(pose(BIND, { handF: [4, 9, 6], handB: [8, 11, 2], face: 'stern', phase: 0.15 })),
  slung(pose(BIND, { phase: 0.3, fx: { extra: all(bandage(0.3), warmMotes(0.5, 0)) } })),
  slung(pose(BIND, { handF: [9, 7, 3], phase: 0.45, fx: { extra: all(bandage(0.6), warmMotes(0.7, 0.15)) } })),
  slung(pose(BIND, { handF: [5, 12, 0], face: 'closed', phase: 0.6, fx: { extra: all(bandage(0.85), warmMotes(0.8, 0.3)), glow: 0.3 } })),
  // Bound: a tug on the knot, a glow of health.
  slung(pose(BIND, { head: 6, handF: [5, 7, 6], handB: [9, 11, 0], face: 'smirk', phase: 0.75, fx: { extra: all(bandage(1, false), warmMotes(0.9, 0.45)), glow: 0.5 } })),
  // The crossbow taken back over his right shoulder...
  pose(STANCE, { y: 3, lean: 3, twist: 8, head: 3, handF: [-1, 1, 11], handB: [6, 10, 2], weapon: -58, roll: 14, yaw: -14, face: 'stern', phase: 0.9, fx: { extra: all(bandage(1, false), warmMotes(0.5, 0.6)) } }),
  // ...and shouldered.
  settle(pose(STANCE, { y: 3.5, twist: 14, handF: [6, 2, 6], weapon: 70 }), 1, { phase: 1, fx: { extra: bandage(1, false) } }),
];

/** The skill clips' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
