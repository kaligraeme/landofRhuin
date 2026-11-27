/**
 * The Bowmaster's core moves: stances, running and the three Quick Arrows. Poses use the chibi
 * pose format (rig.ts, ChibiPose): side-plane points, hands from the base of the neck, the bow's
 * angles in the off hand (`weaponB`, `rollB`, `yawB`), how far it is drawn (`draw`) and whether an
 * arrow is on its string (`nock`); the main weapon is the arrow in her drawing hand, which shows
 * only while she holds one off the string (design.ts `heldArrow`: `drop` hides it).
 *
 *   idle    8  at ease, the bow held upright in her left hand a little ahead of her, its lower
 *              tip by her boot, the right hand resting on her belt: a slow breath, a blink, a
 *              glance toward the viewer, the cape swaying
 *   battle  8  a light, bladed stance, the left shoulder leading, the bow canted forward and low
 *              with an arrow nocked and the string just taken up; a springy bounce, the head
 *              and the cape a frame behind
 *   move    8  a light, quick run, the bow carried low ahead of her in the left hand, the right
 *              arm pumping, the cape streaming back and down over her hips
 *   atk1    7  (1 wind-up) Quick Arrow I: a snap to full draw, the string to her chin; loosed
 *              with a flash at the arrowhead and a streak, the string snapping straight; the
 *              drawing hand flicked back past her ear, then to the quiver, an arrow drawn over
 *              her shoulder and nocked again
 *   atk2    7  (1 wind-up) Quick Arrow II: a snap shot, a shuffle forward into a low crouch,
 *              the bow canted well over with its upper limb tipped toward the target
 *   atk3    9  (1 wind-up) Quick Arrow III: a skip back and a full draw, loosed hard as she lands
 *              (a bigger flash, a longer streak, dust, the cape flung out behind her), then the
 *              same reload
 *
 * Every shot is loosed on the first frame after the wind-up (`draw: 0, nock: false` with
 * `fx.flash` and `fx.trail` from the bow), where the game launches its own arrow. A drawn shot
 * aims from the drawing hand through the bow's grip, so both sit on her centre line at about the
 * same height; loosed, the slack bow faces where its angles point it, so it stands nearly upright
 * for a level shot, tipped back a little (`weaponB` -8 to -10) with the drawing hand a little
 * below the grip: side on the view looks down on her, so a shot aimed a touch upward runs level
 * across the screen, as the game's own arrow does. Seen from behind, a bow held out ahead is
 * hidden by her body, so it is canted (`rollB` 18 to 35) to show its upper limb beside her hood.
 */
import { flash, trail } from '../fx.js';
import { add3, type ChibiPose, type FxContext, mix, norm3, pose, sub3, type V3, wave } from '../rig.js';

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/** Standing at ease: the bow upright at her left side, the right hand resting on her belt. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 6,
  head: 0,
  look: 4,
  footF: [4, 0, 4.6],
  footB: [-5, 0, 4.2],
  handF: [1, 15, 9],
  handB: [7, 13, 7],
  weapon: 170,
  drop: true,
  weaponB: 8,
  rollB: 20,
  yawB: 65,
  face: 'stern',
  wind: 0.08,
};

/**
 * The battle stance: light and bladed, the left shoulder leading (a positive `twist`), the bow
 * held forward and low, canted over, with an arrow nocked and the string just taken up; both
 * hands near her centre line so the arrow points ahead.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 4,
  lean: 8,
  twist: 20,
  head: 2,
  look: -8,
  footF: [8, 0, 5],
  footB: [-9, 0, 4.6],
  handF: [6, 8, 0],
  elbowF: [-1, -0.3, 0.6],
  handB: [14, 9, 1],
  weaponB: 14,
  rollB: 34,
  yawB: 0,
  weapon: 90,
  draw: 0.2,
  nock: true,
  wind: 0.2,
};

/** Full draw for a level shot: the bow arm out straight, the string to her chin, the elbow up and back. */
export const FULL_DRAW: ChibiPose = pose(READY, {
  y: 3,
  lean: 4,
  twist: 24,
  head: 0,
  look: -10,
  footF: [8, 0, 5],
  footB: [-10, 0, 4.4],
  handF: [1, 1.5, 0.5],
  elbowF: [-1, 0.5, 0.5],
  handB: [17, -1.5, 1],
  weaponB: -8,
  rollB: 18,
  draw: 1,
  face: 'grit',
});

/** The frame a shot is loosed: the string snapped straight, the drawing hand flicked back past her ear. */
export const LOOSED: ChibiPose = pose(FULL_DRAW, {
  handF: [-2, -1, 3],
  elbowF: [-1, 0.6, 0.8],
  draw: 0,
  nock: false,
  wind: 0.35,
  face: 'shout',
});

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

/** Adds effects to a pose (on top of its own). */
export const withFx = (p: ChibiPose, fx: ChibiPose['fx']): ChibiPose => ({ ...p, fx: { ...p.fx, ...fx } });

/**
 * The drawing hand at the quiver behind her right shoulder, taking the next arrow (shown in the
 * hand, its head still down in the quiver), and that arrow brought forward over the shoulder.
 */
export const REACH_QUIVER: Partial<ChibiPose> = { handF: [-5, -2, 6], elbowF: [0.2, 0.8, 0.6], weapon: 196, roll: 10, yaw: 0, drop: false, draw: 0, nock: false };
export const DRAW_ARROW: Partial<ChibiPose> = { handF: [0, -5, 6], elbowF: [-0.2, 0.9, 0.6], weapon: 40, roll: 0, yaw: -10, drop: false, draw: 0, nock: false };

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles a whole pixel for the second half of the loop
  // while the cape sways round slowly; a blink, and a glance toward the viewer and back.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: 0.6 + out,
    look: i >= 2 && i <= 4 ? 12 : 4,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.25,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.08,
    face: i === 6 ? 'closed' : 'stern',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Down on the beat and springing back; the head nods a frame behind, the cape lifts as she
  // drops and settles as she rises.
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 3 + b * 2.6,
    lean: 7 + b * 2,
    head: 1 + bounce(i - 1) * 2.4,
    handF: [6, 8 + b * 1.2, 0],
    handB: [14, 9 + b * 1.4, 1],
    wind: 0.2 + Math.max(0, lag) * 0.2,
    lift: lag * 0.8,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
  });
});

/** The first battle frame: where the stance clips hand back to. */
export const BATTLE0 = battle[0] as ChibiPose;

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top. The clips that hand back to the stance end with it.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, BATTLE0, k), over);

/** Out of the battle stance: k of the way from the first battle frame to a pose (keep k at 0.5 or more). */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(BATTLE0, p, k), over);

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [11, 0], b: [-9, -6], y: 2 },
  { f: [6, 0], b: [-7, -10], y: 3.6 },
  { f: [0, 0], b: [2, -8.5], y: 1 },
  { f: [-6, -1.5], b: [9, -4], y: -2.4 },
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
    footF: right ? [k.f[0], k.f[1], 4.2] : [k.b[0], k.b[1], 4.2],
    footB: right ? [k.b[0], k.b[1], 4] : [k.f[0], k.f[1], 4],
    // The bow carried low ahead of her, upper limb forward; the right arm pumps against the legs.
    handF: [2 - swing * 7, 12 - Math.abs(swing) * 2.5, 8],
    weapon: 170,
    drop: true,
    handB: [6 + swing * 3, 13, 6],
    weaponB: 34 + swing * 6,
    rollB: 14,
    yawB: 0,
    // The cape streams back and down from her shoulders over her back and hips, not level, its
    // hem fluttering.
    wind: 0.6,
    lift: -0.5 + Math.sin((2 * Math.PI * i) / 4) * 0.1,
    phase: i / 8,
    sway: swing * 0.2,
    fx: { speed: 0.7, dust: i % 4 === 0 ? 0.7 : 0 },
  };
});

// ── The Quick Arrows ─────────────────────────────────────────────────────────────────────────

/** The release flash and the streak, then the streak fading. */
const SHOT = { flash: { k: 1 }, trail: { k: 1 } };
const SHOT_FADE = { trail: { k: 0.45, len: 64 } };

/**
 * A shot's flash and streak along the line its arrow was drawn on, from `hand` (where the drawing
 * hand was at full draw: a side-plane point from the base of her neck, as the pose's `handF`)
 * through the bow's grip, which stays where it was: for a bow canted so far that, slack, it faces
 * well away from the shot, so its own aim would send the streak astray. `flashK` 0 paints no flash.
 */
export const alongDraw =
  (hand: V3, flashK: number, k: number, len?: number) =>
  (x: FxContext): void => {
    const d = norm3(sub3(x.rig.offhand.o, add3(x.rig.neck, [hand[0], -hand[1], hand[2]], 1)));
    const at = add3(x.rig.offhand.o, d, 2);
    trail(x, at, d, k, { len });
    if (flashK > 0) flash(x, at, d, flashK);
  };

/**
 * A shot from a stance: full draw (the wind-up), loosed, the hand flicked back, to the quiver, an
 * arrow drawn over the shoulder, nocked and settled back into the battle stance. `shot` and `fade`
 * are the release's effects and the next frame's.
 */
function quick(draw: ChibiPose, loosed: ChibiPose, shot: ChibiPose['fx'] = SHOT, fade: ChibiPose['fx'] = SHOT_FADE): ChibiPose[] {
  return [
    draw,
    withFx(loosed, shot),
    withFx(pose(loosed, { handF: [-4, 0, 5], wind: 0.3, lift: 0.15, phase: 0.3, face: 'stern' }), fade),
    pose(mix(loosed, BATTLE0, 0.3), { ...REACH_QUIVER, wind: 0.24, lift: 0.1, phase: 0.45, face: 'stern' }),
    pose(mix(loosed, BATTLE0, 0.55), { ...DRAW_ARROW, wind: 0.2, phase: 0.6, face: 'stern' }),
    settle(loosed, 0.8, { handF: [7, 7, 1], weapon: 90, nock: true, draw: 0.05, drop: true, phase: 0.75, face: 'stern' }),
    settle(loosed, 0.95, { phase: 0.9 }),
  ];
}

// atk1: a level shot from the stance.
const atk1 = quick(pose(FULL_DRAW, { wind: 0.2, phase: 0.1, fx: { runeB: 0.3 } }), pose(LOOSED, { phase: 0.15 }));

/**
 * atk2: a snap shot, quite unlike the first: a shuffle forward into a low crouch, the bow canted
 * well over with its upper limb tipped toward the target, drawn and loosed from there.
 */
const A2_HAND: V3 = [1, 3, 0];
const A2_DRAW = pose(FULL_DRAW, { x: 3, y: 11, lean: 14, twist: 26, head: 3, footF: [12, 0, 5.6], footB: [-11, 0, 5], handF: A2_HAND, handB: [17, 1, 1], weaponB: 30, rollB: 40, yawB: -10, wind: 0.25, phase: 0.1, fx: { runeB: 0.3 } });
const atk2 = quick(
  A2_DRAW,
  pose(A2_DRAW, { handF: [-2, 2, 3], elbowF: [-1, 0.6, 0.8], draw: 0, nock: false, wind: 0.4, phase: 0.15, face: 'shout', fx: undefined }),
  { extra: alongDraw(A2_HAND, 1, 1) },
  { extra: alongDraw(A2_HAND, 0, 0.45, 64) },
);

// atk3: a skip back with a full draw, loosed hard as she lands.
const A3_SKIP = pose(FULL_DRAW, { x: -4, y: -6, lean: -2, footF: [5, -6, 5], footB: [-8, -5, 4.4], wind: -0.2, lift: 0.3, flare: 0.1, phase: 0.1, face: 'grit', fx: { runeB: 0.9, aura: 0.25 } });
const A3_LOOSE = pose(LOOSED, { x: -6, y: 6, lean: -4, head: -2, footF: [9, 0, 5.4], footB: [-12, 0, 4.8], handF: [-4, -1, 4], wind: 0.75, lift: 0.2, flare: 0.1, phase: 0.2, fx: { flash: { k: 1.4 }, trail: { k: 1.25, len: 74 }, dust: 0.8 } });
const atk3: ChibiPose[] = [
  A3_SKIP,
  A3_LOOSE,
  withFx(pose(A3_LOOSE, { handF: [-4, 0, 5], wind: 0.5, lift: 0.2, phase: 0.35, face: 'stern', fx: undefined }), { trail: { k: 0.6, len: 82 }, dust: 0.3 }),
  withFx(pose(A3_LOOSE, { handF: [-5, -1, 5], wind: 0.35, lift: 0.25, phase: 0.45, face: 'stern', fx: undefined }), { trail: { k: 0.25, len: 92 } }),
  pose(mix(A3_LOOSE, BATTLE0, 0.25), { ...REACH_QUIVER, wind: 0.25, lift: 0.1, phase: 0.55, face: 'stern', fx: undefined }),
  pose(mix(A3_LOOSE, BATTLE0, 0.45), { ...DRAW_ARROW, wind: 0.22, phase: 0.65, face: 'stern', fx: undefined }),
  settle(A3_LOOSE, 0.7, { handF: [7, 7, 1], weapon: 90, nock: true, draw: 0.05, drop: true, phase: 0.75, face: 'stern', fx: undefined }),
  settle(A3_LOOSE, 0.88, { phase: 0.85, fx: undefined }),
  settle(A3_LOOSE, 0.97, { phase: 0.95, fx: undefined }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
