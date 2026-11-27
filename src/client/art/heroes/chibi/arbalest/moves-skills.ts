/**
 * The Arbalest's skills, in the chibi pose format (rig.ts, ChibiPose). Each starts from the battle
 * stance (moves-core.ts `STANCE`) and hands back to it (`settle`), spanned and loaded. Every shot
 * is loosed on the first frame after the wind-up, when the game fires the bolt: `draw: 0, nock:
 * false` with a flash at the bolt's point and a trail along the aim; the lever is then racked
 * (moves-core.ts `onLever`) to span it again. His skills have no wind-up on the server, so each
 * wind-up frame takes 0.06 s while the bolt is already flying: they are kept to one (two for the
 * Explosive Bolt's loading), so the flash comes close behind the game's own bolt.
 *
 *   special  8  (1 wind-up) Piercing Bolt: a steadied aim, cheek to the stock, the bolt's head
 *               glowing; a white-hot streak on release and a strong kick
 *   q        9  (2 wind-up) Explosive Bolt: a glowing amber bolt drawn from the bandolier and laid
 *               in the groove, shouldered and fired with a fiery muzzle burst; he rocks back on
 *               his heels in the smoke
 *   e        9  (1 wind-up) Tumble Shot: a snap shot from a crouch as he springs back into a
 *               backward roll (the server moves him), coming up on one knee with the crossbow
 *               levelled again
 *   r        8  (1 wind-up) Scattershot: braced low and wide, a blast of shrapnel fanning out of
 *               the prod in a cone of sparks, a heavy kick that skids him back
 *   ult      16 (1 wind-up) Siege Barrage: feet planted, he fires a rapid string of bolts across a
 *               narrow arc, racking the lever between shots, with repeated flashes, gathering
 *               smoke and spent sparks, the last shot the heaviest
 *   cast     8  (2 wind-up) Vault, Field Dressing and the Elixir: the crossbow slung on his back,
 *               a bandage bound round his left forearm in a glow of motes, then the crossbow
 *               taken back and shouldered
 */
import { all, bandage, charged, fireburst, goldTrail, shrapnel, smoke, spentSparks, streak } from './effects.js';
import { ARBALEST } from './design.js';
import { AIM, fromStance, loosed, onLever, settle, shotOf, STANCE } from './moves-core.js';
import { at3, type ChibiPose, mix, pose, solveRig } from '../rig.js';

const BUILD = ARBALEST.build;
const GRIP2 = ARBALEST.weapon.grip2;

/** A lever rack k of the way from one pose to another: the lever thrown (`draw` about 0.2) or hauled back (about 0.75). */
const rack = (a: ChibiPose, b: ChibiPose, k: number, draw: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  onLever(pose(mix(a, b, k), { draw, nock: false, wink: undefined, face: 'stern', fx: undefined, ...over }));

// ── Piercing Bolt ────────────────────────────────────────────────────────────────────────────

/** Steadied: lower and stiller than a quick shot, his cheek pressed to the stock. */
const STEADY = pose(AIM, { y: 5.5, lean: 8, head: 8, look: -9, footF: [11, 0, 6], footB: [-12, 0, 5.4], handF: [9.5, 1.5, 4], yaw: 0 });
const P_SHOT = shotOf(STEADY);
const P_FIRE = pose(STEADY, { x: -2.5, y: 5, lean: 4, head: 5, handF: [7, 0.5, 4], weapon: 86, draw: 0, nock: false, face: 'grit', wind: 0.55, lift: 0.2, phase: 0.2, fx: { flash: { k: 1.5, from: P_SHOT.tip, dir: P_SHOT.dir }, extra: all(streak(1, 110, P_SHOT), goldTrail(0.9, 60, P_SHOT)), dust: 0.7 } });
const P_RIDE = pose(P_FIRE, { x: -3, lean: -2, head: 2, handF: [6, -1, 4], weapon: 78, wink: undefined, face: 'stern', wind: 0.45, lift: 0.35, phase: 0.35, fx: { extra: all(streak(0.45, 120, P_SHOT), smoke(0.2, 0, 0.6)), dust: 0.3 } });

const special: ChibiPose[] = [
  // Wind-up: settled lower, cheek to the stock, the bolt's head glowing pale gold.
  pose(STEADY, { fx: { rune: 1.1, extra: charged(0.9, [255, 236, 190]) } }),
  P_FIRE,
  P_RIDE,
  pose(P_RIDE, { x: -2.5, lean: 2, weapon: 86, handF: [7.5, 0.5, 4], wind: 0.3, lift: 0.2, phase: 0.5, fx: { extra: smoke(0.55, 0, 0.5) } }),
  rack(P_RIDE, STANCE, 0.45, 0.2, { x: -1.5, phase: 0.62, fx: { extra: smoke(0.85, 0, 0.35) } }),
  rack(P_RIDE, STANCE, 0.75, 0.75, { x: -0.6, phase: 0.75 }),
  settle(P_RIDE, 0.9, { phase: 0.88 }),
  settle(P_RIDE, 1, { phase: 1 }),
];

// ── Explosive Bolt ───────────────────────────────────────────────────────────────────────────

/** Loading: the crossbow lowered a little, spanned and empty, his left hand at the bandolier. */
const LOAD = pose(STANCE, { y: 5, lean: 10, twist: 12, head: 9, look: 0, handF: [8, 6, 5], handB: [2, 7, 1], weapon: 104, yaw: -4, nock: false, face: 'stern' });
const Q_AIM = pose(AIM, { y: 5, lean: 7, head: 7, footF: [11, 0, 6], footB: [-12, 0, 5.4], fx: { rune: 1, extra: charged(1) } });
const Q_SHOT = shotOf(Q_AIM);
const Q_FIRE = pose(Q_AIM, { x: -2.5, y: 4.5, lean: 2, head: 3, look: -4, handF: [7, 0, 4], weapon: 85, draw: 0, nock: false, face: 'shout', wink: undefined, wind: 0.7, lift: 0.4, phase: 0.2, fx: { flash: { k: 1.5, from: Q_SHOT.tip, dir: Q_SHOT.dir }, rays: { k: 0.7, at: Q_SHOT.tip, n: 10, len: 22 }, extra: all(fireburst(1.3, Q_SHOT), goldTrail(1, 56, Q_SHOT)) } });
const Q_ROCK = pose(Q_FIRE, { x: -4, y: 3.5, lean: -12, head: -5, footF: [9, -3, 6], handF: [4.5, -3, 4], weapon: 70, face: 'grit', wind: 0.5, lift: 0.5, phase: 0.35, fx: { extra: all(fireburst(0.6), smoke(0.15, 3), goldTrail(0.4, 70, Q_SHOT)) } });

const q: ChibiPose[] = [
  // Wind-up: a glowing amber bolt from the bandolier laid in the groove...
  pose(LOAD, { y: 5.5, head: 10, handF: [8.5, 5, 5], handB: [11, 6, -2], weapon: 98, nock: true, fx: { rune: 1, extra: charged(0.75) } }),
  // ...and shouldered, glowing.
  Q_AIM,
  Q_FIRE,
  Q_ROCK,
  // Rocking forward onto both feet again in the smoke.
  pose(Q_ROCK, { x: -3, y: 5, lean: 0, head: 2, footF: [10, 0, 6], handF: [6.5, -0.5, 4], weapon: 80, wind: 0.3, lift: 0.3, phase: 0.5, fx: { extra: smoke(0.45, 3) } }),
  rack(Q_ROCK, STANCE, 0.45, 0.2, { x: -2, footF: [10, 0, 6], phase: 0.62, fx: { extra: smoke(0.7, 3, 0.7) } }),
  rack(Q_ROCK, STANCE, 0.7, 0.75, { x: -1, footF: [10, 0, 6], phase: 0.75, fx: { extra: smoke(0.95, 3, 0.4) } }),
  settle(Q_ROCK, 0.9, { footF: STANCE.footF, phase: 0.88 }),
  settle(Q_ROCK, 1, { phase: 1 }),
];

// ── Tumble Shot ──────────────────────────────────────────────────────────────────────────────
// The server moves him five tiles back while he rolls, so the roll stays about where he stands in
// the frame: the game slides the whole sprite back.

/** A crouch, the crossbow levelled low from the hip, about to spring back. */
const CROUCH = pose(AIM, { x: 1, y: 9, lean: 16, twist: 12, head: 2, look: -4, footF: [9, 0, 5.6], footB: [-8, 0, 5], handF: [8, 7, 5], elbowF: undefined, weapon: 92, yaw: -10, wink: undefined, face: 'grit' });
/** Sat back into the roll, knees up, the crossbow hugged to his chest. */
const ROLL_SIT = { x: -2, y: 15, lean: -40, twist: 0, head: 12, look: 0, footF: [8, -8, 5], footB: [5, -5, 4.6], handF: [5, 10, 6], handB: [6, 12, 2], weapon: 25, roll: 20, yaw: -20, draw: 0, nock: false, face: 'grit', wind: -0.4, lift: 0.5, phase: 0.3 } as const satisfies ChibiPose;
/** Over on his shoulders, his knees tucked and his boots swinging up over his head. */
const ROLL_OVER = pose(ROLL_SIT, { x: -3, y: 17, lean: -100, head: 34, footF: [-18, -24, 5], footB: [-15, -21, 4.6], handF: [6, 8, 6], handB: [7, 10, 2], weapon: 0, roll: 30, wind: -0.2, lift: 0.8, flare: 0.3, phase: 0.45 });
/** Coming over onto his right knee, the crossbow coming round. */
const ROLL_UP = { x: -2, y: 13, lean: 30, twist: 6, head: 14, look: 0, footF: [-14, -1, 5], footB: [4, -3, 5], kneel: 'F', handF: [7, 10, 6], weapon: 60, roll: 10, yaw: -20, grip2: 11, draw: 0.8, nock: false, face: 'grit', wind: -0.3, lift: 0.3, phase: 0.6 } as const satisfies ChibiPose;
/** Up on his right knee, the crossbow levelled at the shoulder. */
const KNEE_AIM = pose(AIM, { x: 0, y: 12, lean: 8, twist: 20, head: 6, footF: [-12, 0, 6], footB: [8, 0, 6.5], kneel: 'F', handF: [9, 1.5, 4], face: 'stern', wink: 'L', wind: 0.1, phase: 0.75 });
const GHOSTS = { k: 0.45, n: 2, gap: 9, dir: [1, 0, 0] as const };

const e: ChibiPose[] = [
  fromStance(CROUCH, 0.75),
  // The snap shot as he springs back.
  pose(CROUCH, { x: -1, y: 8, lean: 8, head: 0, footF: [10, -2, 5.6], footB: [-8, 0, 5], handF: [7, 6, 5], weapon: 90, draw: 0, nock: false, wind: -0.3, lift: 0.3, phase: 0.15, fx: { ...loosed(CROUCH), dust: 0.6 } }),
  pose(ROLL_SIT, { fx: { ghosts: GHOSTS, dust: 0.5 } }),
  pose(ROLL_OVER, { fx: { ghosts: GHOSTS, speed: 0.5 } }),
  pose(ROLL_UP, { fx: { ghosts: { ...GHOSTS, k: 0.3, n: 1 }, dust: 0.7 } }),
  pose(KNEE_AIM, { draw: 1, nock: true }),
  pose(KNEE_AIM, { y: 11.5, head: 5, wink: undefined, phase: 0.85 }),
  // Up off the knee into the stance.
  pose(mix(KNEE_AIM, STANCE, 0.55), { kneel: undefined, footF: [7, 0, 5.8], footB: [-8, 0, 5.2], face: 'stern', wink: undefined, phase: 0.92 }),
  settle(KNEE_AIM, 0.9, { kneel: undefined, footF: STANCE.footF, footB: STANCE.footB, phase: 1 }),
];

// ── Scattershot ──────────────────────────────────────────────────────────────────────────────

/** Braced low and wide, the crossbow levelled at the hip-shoulder. */
const BRACED = pose(AIM, { y: 9, lean: 14, twist: 18, head: 6, look: -6, footF: [14, 0, 6.6], footB: [-14, 0, 6], handF: [9.5, 4, 4.5], weapon: 93, face: 'grit', wink: undefined });
const R_SHOT = shotOf(BRACED);
const R_FIRE = pose(BRACED, { x: -3, y: 8, lean: 6, head: 2, footF: [13, -1, 6.6], handF: [7, 2.5, 4.5], weapon: 86, draw: 0, nock: false, face: 'shout', wind: 0.8, lift: 0.4, phase: 0.2, fx: { flash: { k: 1.5, from: R_SHOT.tip, dir: R_SHOT.dir }, rays: { k: 0.55, at: R_SHOT.tip, n: 8, len: 18 }, extra: all(fireburst(1.2, R_SHOT), shrapnel(0.15, R_SHOT)), dust: 1 } });
const R_SKID = pose(R_FIRE, { x: -5, y: 8.5, lean: -4, head: -1, footF: [12, 0, 6.6], footB: [-15, 0, 6], handF: [6, 1, 4.5], weapon: 74, face: 'grit', wind: 0.55, lift: 0.3, phase: 0.35, fx: { extra: all(shrapnel(0.55, R_SHOT), smoke(0.2, 7)), dust: 0.8 } });

const r: ChibiPose[] = [
  // Wind-up: dropped low and wide, braced.
  pose(BRACED, { y: 9.5, fx: { rune: 1 } }),
  R_FIRE,
  R_SKID,
  pose(R_SKID, { x: -5, lean: 6, weapon: 86, handF: [7.5, 2.5, 4.5], face: 'stern', wind: 0.35, lift: 0.2, phase: 0.5, fx: { extra: all(shrapnel(1, R_SHOT), smoke(0.55, 7)) } }),
  rack(R_SKID, STANCE, 0.45, 0.2, { x: -3.5, phase: 0.62, fx: { extra: smoke(0.85, 7, 0.6) } }),
  rack(R_SKID, STANCE, 0.75, 0.75, { x: -2, phase: 0.75 }),
  settle(R_SKID, 0.9, { x: -0.8, phase: 0.88 }),
  settle(R_SKID, 1, { phase: 1 }),
];

// ── Siege Barrage ────────────────────────────────────────────────────────────────────────────

/** Planted wide for the barrage, the crossbow shouldered. */
const PLANTED = pose(AIM, { y: 6, lean: 8, head: 6, footF: [12, 0, 6.4], footB: [-13, 0, 5.8] });

/** One shot of the barrage, `i` of five, swinging the aim across a narrow arc (`yaw`), the last the heaviest. */
function volley(i: number): ChibiPose[] {
  const last = i === 4;
  const yaw = -10 + i * 5;
  const back = i * 0.4;
  const aim = pose(PLANTED, { x: -back, yaw, phase: 0.1 + i * 0.16 });
  const line = shotOf(aim);
  const fire = pose(aim, {
    x: -back - (last ? 3 : 1.2),
    lean: last ? 0 : 4,
    head: last ? 2 : 5,
    handF: last ? [7, 0, 4] : [8, 0.5, 4],
    weapon: last ? 84 : 87,
    draw: 0,
    nock: false,
    face: last ? 'shout' : 'grit',
    wink: last ? undefined : 'L',
    wind: last ? 0.7 : 0.4,
    lift: 0.2,
    fx: {
      flash: { k: last ? 1.5 : 1.1, from: line.tip, dir: line.dir },
      dust: last ? 0.8 : 0.3,
      rays: last ? { k: 0.6, at: line.tip, n: 10, len: 20 } : undefined,
      extra: all(goldTrail(1, last ? 64 : 48, line), smoke(0.1 + i * 0.12, i, 0.5 + i * 0.1), ...(i > 0 ? [spentSparks(0.5, i)] : [])),
    },
  });
  if (last) return [fire];
  // Between shots the lever is thrown and hauled back in one stroke, the smoke thickening.
  const crank = onLever(pose(aim, { x: -back - 0.6, weapon: 88, draw: 0.25, nock: false, wink: undefined, wind: 0.3, fx: { extra: all(smoke(0.25 + i * 0.12, i + 10, 0.6 + i * 0.1), spentSparks(0.2 + i * 0.1, i + 20)) } }));
  return [fire, crank];
}

const U_LAST = pose(PLANTED, { x: -4.6, lean: 2, head: 3, handF: [6.5, -0.5, 4], weapon: 80, yaw: 8, draw: 0, nock: false, face: 'grit', wink: undefined, wind: 0.5, lift: 0.4, phase: 0.85 });

const ult: ChibiPose[] = [
  // Wind-up: feet planted wide, the aim at the left end of the arc.
  pose(PLANTED, { yaw: -10, face: 'grit', fx: { rune: 0.6 } }),
  ...volley(0),
  ...volley(1),
  ...volley(2),
  ...volley(3),
  ...volley(4),
  pose(U_LAST, { x: -4.5, lean: -2, weapon: 76, phase: 0.8, fx: { extra: all(goldTrail(0.4, 76, shotOf(pose(PLANTED, { x: -1.6, yaw: 10 }))), smoke(0.45, 5, 0.9), spentSparks(0.7, 9)) } }),
  pose(U_LAST, { fx: { extra: all(smoke(0.65, 5, 0.8), spentSparks(0.95, 9)) } }),
  rack(U_LAST, STANCE, 0.45, 0.2, { x: -2.4, phase: 0.92, fx: { extra: smoke(0.85, 5, 0.6) } }),
  rack(U_LAST, STANCE, 0.75, 0.75, { x: -1, phase: 1, fx: { extra: smoke(1, 5, 0.35) } }),
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
  slung(pose(BIND, { phase: 0.3, fx: { extra: bandage(0.3), motes: { k: 0.5, rise: 0 } } })),
  slung(pose(BIND, { handF: [9, 7, 3], phase: 0.45, fx: { extra: bandage(0.6), motes: { k: 0.7, rise: 0.15 } } })),
  slung(pose(BIND, { handF: [5, 12, 0], face: 'closed', phase: 0.6, fx: { extra: bandage(0.85), motes: { k: 0.8, rise: 0.3 }, glow: 0.3 } })),
  // Bound: a tug on the knot, a glow of health.
  slung(pose(BIND, { head: 6, handF: [5, 7, 6], handB: [9, 11, 0], face: 'smirk', phase: 0.75, fx: { extra: bandage(1, false), motes: { k: 0.9, rise: 0.45 }, glow: 0.5 } })),
  // The crossbow taken back over his right shoulder...
  pose(STANCE, { y: 3, lean: 3, twist: 8, head: 3, handF: [-1, 1, 11], handB: [6, 10, 2], weapon: -58, roll: 14, yaw: -14, face: 'stern', phase: 0.9, fx: { extra: bandage(1, false), motes: { k: 0.5, rise: 0.6 } } }),
  // ...and shouldered.
  settle(pose(STANCE, { y: 3.5, twist: 14, handF: [6, 2, 6], weapon: 70 }), 0.75, { phase: 1, fx: { extra: bandage(1, false) } }),
];

/** The skill clips' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
