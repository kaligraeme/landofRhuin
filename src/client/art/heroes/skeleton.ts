/**
 * The heroes' skeleton. A pose places the pelvis, leans the torso and puts the feet, hands and
 * weapon where they belong; knees and elbows are solved from those targets (two-bone IK), so
 * poses read like a choreographer's notes rather than joint angles.
 *
 * Coordinates are frame pixels with y pointing down; heroes face right (+x).
 */

export type Vec = readonly [number, number];

/** Frame size and the ground anchor every hero stands on. */
export const FRAME_W = 176;
export const FRAME_H = 144;
export const ANCHOR_X = 72;
export const GROUND_Y = 128;

/** Bone lengths, in pixels, for a figure about 90 pixels tall. */
export const BONES = {
  thigh: 22,
  shin: 21,
  /** Pelvis height above the ground standing straight. */
  hip: 44,
  /** Pelvis to the base of the neck. */
  torso: 27,
  upperArm: 14,
  foreArm: 14,
};

export interface FxSpec {
  /** Sweep a smear from this weapon angle to the current one. */
  smear?: number;
  /** Smear the second weapon too (dual wield). */
  smear2?: number;
  /** Puffs of dust at the feet. */
  dust?: boolean;
  /** Skill glow, 0 to 1. */
  aura?: number;
  /** Speed lines streaming behind. */
  speed?: boolean;
  /** A starburst at the weapon's tip. */
  impact?: boolean;
  /** A magic circle under the feet, 0 to 1. */
  circle?: number;
  /** A flash at the crossbow's or wand's tip. */
  flash?: boolean;
  /** A shockwave along the ground ahead. */
  quake?: boolean;
}

export interface Pose {
  /** Pelvis offset from standing: + forward, + down (a crouch), negative y in the air. */
  x: number;
  y: number;
  /** Torso lean in degrees, + forward. */
  lean: number;
  /** Feet relative to the ground anchor: + forward; negative y is off the ground. */
  footF: Vec;
  footB: Vec;
  /** Hands relative to the base of the neck: + forward, + down. */
  handF: Vec;
  /** Omit for a two-handed grip (the back hand takes the weapon's second grip) or a hanging arm. */
  handB?: Vec;
  /** Elbow sides: 1 bends naturally (down when reaching forward), -1 the other way. */
  bendF?: number;
  bendB?: number;
  /** Weapon angle in degrees: 0 points up, 90 forward, 180 down, -90 back. */
  weapon: number;
  /** The off-hand weapon (twin blade, wand, bowstring hand), when there is one. */
  weapon2?: number;
  /** Draw the main weapon behind the body. */
  behind?: boolean;
  /** Draw the off-hand weapon in front of the body. */
  front2?: boolean;
  /** Cape, scarf and hair streaming back: 0 hanging, 1 flying. */
  wind?: number;
  /** Head tilt, degrees (+ looks down). */
  head?: number;
  /** The longbow's string is drawn back to the back hand. */
  draw?: boolean;
  fx?: FxSpec;
}

export interface Body {
  pelvis: Vec;
  neck: Vec;
  /** Unit vectors along the torso: up the spine and forward across it. */
  up: Vec;
  fwd: Vec;
  shoulderF: Vec;
  shoulderB: Vec;
  elbowF: Vec;
  elbowB: Vec;
  handF: Vec;
  handB: Vec;
  hipF: Vec;
  hipB: Vec;
  kneeF: Vec;
  kneeB: Vec;
  ankleF: Vec;
  ankleB: Vec;
  /** Unit vector the main weapon points along, and the off-hand weapon's. */
  weaponDir: Vec;
  weapon2Dir: Vec;
}

export const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Direction of a weapon angle (0 up, 90 forward). */
export const weaponVec = (deg: number): Vec => [Math.sin(rad(deg)), -Math.cos(rad(deg))];

const add = (a: Vec, b: Vec, k = 1): Vec => [a[0] + b[0] * k, a[1] + b[1] * k];

/** A point in the torso's frame: f forward and u up from the pelvis. */
function torsoPoint(pelvis: Vec, up: Vec, fwd: Vec, f: number, u: number): Vec {
  return [pelvis[0] + fwd[0] * f + up[0] * u, pelvis[1] + fwd[1] * f + up[1] * u];
}

/**
 * Two-bone IK: the middle joint for a limb from `root` toward `target`. `bend` picks the side:
 * 1 puts the joint clockwise of the root-to-target line (an elbow below an arm reaching forward),
 * -1 anticlockwise (a knee in front of a leg reaching down).
 */
export function solveLimb(root: Vec, target: Vec, a: number, b: number, bend: number): { mid: Vec; end: Vec } {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy);
  if (d < 1e-3) {
    dx = 0;
    dy = 1;
    d = 1e-3;
  }
  const ux = dx / d;
  const uy = dy / d;
  const reach = Math.min(d, a + b - 0.01);
  const end: Vec = [root[0] + ux * reach, root[1] + uy * reach];
  const cos = Math.max(-1, Math.min(1, (a * a + reach * reach - b * b) / (2 * a * reach)));
  const ang = Math.acos(cos) * bend;
  // Rotate the root-to-target direction by `ang` (screen coordinates: clockwise is positive).
  const rx = ux * Math.cos(ang) - uy * Math.sin(ang);
  const ry = ux * Math.sin(ang) + uy * Math.cos(ang);
  return { mid: [root[0] + rx * a, root[1] + ry * a], end };
}

/** Solves every joint of a pose. `grip2` is where a two-handed weapon's second grip sits along it. */
export function solve(pose: Pose, grip2: number | null): Body {
  const pelvis: Vec = [ANCHOR_X + pose.x, GROUND_Y - BONES.hip + pose.y];
  const t = rad(pose.lean);
  const up: Vec = [Math.sin(t), -Math.cos(t)];
  const fwd: Vec = [Math.cos(t), Math.sin(t)];
  const neck = torsoPoint(pelvis, up, fwd, 0, BONES.torso);
  const shoulderF = torsoPoint(pelvis, up, fwd, 2.5, BONES.torso - 4);
  const shoulderB = torsoPoint(pelvis, up, fwd, -3, BONES.torso - 4);
  const hipF = torsoPoint(pelvis, up, fwd, 2, 0);
  const hipB = torsoPoint(pelvis, up, fwd, -2.5, 0);

  // Legs reach for the ankles, just above where the soles touch.
  const ankle = (foot: Vec): Vec => [ANCHOR_X + foot[0], GROUND_Y + foot[1] - 3];
  const legF = solveLimb(hipF, ankle(pose.footF), BONES.thigh, BONES.shin, -1);
  const legB = solveLimb(hipB, ankle(pose.footB), BONES.thigh, BONES.shin, -1);

  const weaponDir = weaponVec(pose.weapon);
  const weapon2Dir = weaponVec(pose.weapon2 ?? pose.weapon);
  const armF = solveLimb(shoulderF, add(neck, pose.handF), BONES.upperArm, BONES.foreArm, pose.bendF ?? 1);
  let targetB: Vec;
  if (pose.handB) targetB = add(neck, pose.handB);
  else if (grip2 !== null) targetB = add(armF.end, weaponDir, grip2);
  else targetB = add(shoulderB, [-2, BONES.upperArm + BONES.foreArm - 3]);
  const armB = solveLimb(shoulderB, targetB, BONES.upperArm, BONES.foreArm, pose.bendB ?? 1);
  return {
    pelvis,
    neck,
    up,
    fwd,
    shoulderF,
    shoulderB,
    elbowF: armF.mid,
    elbowB: armB.mid,
    handF: armF.end,
    handB: armB.end,
    hipF,
    hipB,
    kneeF: legF.mid,
    kneeB: legB.mid,
    ankleF: legF.end,
    ankleB: legB.end,
    weaponDir,
    weapon2Dir,
  };
}

/** Linear blend of two poses (for in-betweens). */
export function blend(a: Pose, b: Pose, k: number): Pose {
  const n = (x: number, y: number): number => x + (y - x) * k;
  const v = (x: Vec, y: Vec): Vec => [n(x[0], y[0]), n(x[1], y[1])];
  return {
    ...(k < 0.5 ? a : b),
    x: n(a.x, b.x),
    y: n(a.y, b.y),
    lean: n(a.lean, b.lean),
    footF: v(a.footF, b.footF),
    footB: v(a.footB, b.footB),
    handF: v(a.handF, b.handF),
    handB: a.handB && b.handB ? v(a.handB, b.handB) : (k < 0.5 ? a.handB : b.handB),
    weapon: n(a.weapon, b.weapon),
    weapon2: a.weapon2 !== undefined && b.weapon2 !== undefined ? n(a.weapon2, b.weapon2) : (k < 0.5 ? a.weapon2 : b.weapon2),
    wind: n(a.wind ?? 0, b.wind ?? 0),
    head: n(a.head ?? 0, b.head ?? 0),
  };
}
