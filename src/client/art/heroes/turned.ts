/**
 * Heroes turned toward the viewer or away from them. The side-on choreography (moves.ts) is lifted
 * into 3D: the body gets its breadth, the hands their place to either side and the weapons a slant,
 * so blows sweep across the body rather than straight at the viewer. Then it is drawn from the
 * front or from behind through the same tilted camera the dungeon uses: whatever is nearer the
 * viewer sits a little lower on screen.
 *
 * In 3D a point is { l, u, f }: l toward the hero's right hand, u up from the ground, f forward
 * from the ground anchor. The right hand holds the main weapon (the near hand side on).
 */
import type { HeroDesign } from './designs.js';
import { paintBackHead, paintFrontBackHair, paintFrontHead } from './heads.js';
import { Canvas, hex, INK, type Raster, type Ramp, type RGB, shiftRamp } from './paint.js';
import { auraRim, burst, hexRamp, SMEAR, smearColor } from './render.js';
import { BONES, rad, type Pose, type Vec } from './skeleton.js';
import { paintWeapon, WEAPON_SHAPES, type WeaponKind } from './weapons.js';

export type Facing = 'side' | 'front' | 'back';

/**
 * Front and back frames are taller than side-on ones, with the feet centred and room below them
 * for blows swung toward the viewer.
 */
export const TURNED_W = 176;
export const TURNED_H = 168;
export const TURNED_X = 88;
export const TURNED_Y = 128;
/** How far down the screen a pixel of depth toward the viewer shows. */
const DEPTH = 0.45;
/** Blows are swung on a slant: the weapon arm's plane leans this far toward its side. */
const ROLL = rad(30);

interface P3 {
  l: number;
  u: number;
  f: number;
}
const p3 = (l: number, u: number, f: number): P3 => ({ l, u, f });
const add = (a: P3, b: P3, k = 1): P3 => p3(a.l + b.l * k, a.u + b.u * k, a.f + b.f * k);
const sub = (a: P3, b: P3): P3 => p3(a.l - b.l, a.u - b.u, a.f - b.f);
const dot = (a: P3, b: P3): number => a.l * b.l + a.u * b.u + a.f * b.f;
const len = (a: P3): number => Math.sqrt(dot(a, a));
const norm = (a: P3): P3 => {
  const n = len(a) || 1;
  return p3(a.l / n, a.u / n, a.f / n);
};
const lerp3 = (a: P3, b: P3, t: number): P3 => add(a, sub(b, a), t);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Two-bone IK in 3D: the joint bends toward `bend`. */
function ik(root: P3, target: P3, a: number, b: number, bend: P3): { mid: P3; end: P3 } {
  let d = sub(target, root);
  let dist = len(d);
  if (dist < 1e-3) {
    d = p3(0, -1, 0);
    dist = 1;
  }
  const dir = p3(d.l / dist, d.u / dist, d.f / dist);
  const reach = Math.min(dist, a + b - 0.01);
  const end = add(root, dir, reach);
  const x = (a * a - b * b + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let n = sub(bend, p3(dir.l * dot(bend, dir), dir.u * dot(bend, dir), dir.f * dot(bend, dir)));
  if (len(n) < 1e-3) n = p3(0, 0, 1);
  return { mid: add(add(root, dir, x), norm(n), h), end };
}

interface Axes {
  /** Along the weapon, and across it (its flat or, for a bow, its limbs). */
  u: P3;
  v: P3;
}

/**
 * A weapon's direction in 3D from its side-on angle (0 up, 90 forward). `side` is +1 for the right
 * hand, -1 for the left. Swung, the blow's plane leans toward the weapon's side, so a cut runs from
 * high on that side to low across the body. At rest, weapons pointing ahead or behind turn out to
 * their side, and splay a little outward.
 */
function weaponAxes(kind: WeaponKind, deg: number, side: number, swing: boolean): Axes {
  const shape = WEAPON_SHAPES[kind];
  const th = rad(deg);
  // Swung, the blow leans toward its side; a bow at rest is canted outward, clear of the face.
  const roll = (swing ? ROLL : shape.aim ? rad(28) : 0) * side;
  const yaw = rad(shape.yaw) * (swing ? 0.3 : 1);
  const turn = (q: P3): P3 => {
    const l1 = q.l * Math.cos(roll) + q.u * Math.sin(roll);
    const u1 = -q.l * Math.sin(roll) + q.u * Math.cos(roll);
    return p3(l1 + side * Math.abs(q.f) * Math.sin(yaw), u1, q.f * Math.cos(yaw));
  };
  let u = norm(turn(p3(0, Math.cos(th), Math.sin(th))));
  if (!swing) u = norm(add(u, p3(side * 0.18, 0, 0)));
  let v: P3;
  if (shape.aim) v = norm(turn(p3(0, -Math.sin(th), Math.cos(th))));
  else {
    // Broad side to the viewer: across the weapon, toward its side.
    const out = p3(side, 0, 0);
    v = sub(out, p3(u.l * dot(out, u), u.u * dot(out, u), u.f * dot(out, u)));
    if (len(v) < 0.2) v = sub(p3(0, 1, 0), p3(u.l * u.u, u.u * u.u, u.f * u.u));
    v = norm(v);
  }
  return { u, v };
}

const far = (r: Ramp): Ramp => shiftRamp(r, -0.14);
const same = (r: Ramp): Ramp => r;

/** Paints one posed frame of a hero facing the viewer or facing away. */
export function renderTurned(d: HeroDesign, pose: Pose, facing: 'front' | 'back', swing: boolean): Raster {
  const c = new Canvas(TURNED_W, TURNED_H);
  const s = facing === 'front' ? 1 : -1;
  const front = s === 1;
  const proj = (p: P3): Vec => [TURNED_X - s * p.l, TURNED_Y - p.u + s * p.f * DEPTH];
  const vec = (v: P3): Vec => [-s * v.l, -v.u + s * v.f * DEPTH];
  const depth = (p: P3): number => s * p.f;
  const B = d.build;
  const wind = pose.wind ?? 0;

  // ── The skeleton in 3D ──
  const t = rad(pose.lean);
  const pelvis = p3(0, BONES.hip - pose.y, pose.x);
  const up = p3(0, Math.cos(t), Math.sin(t));
  const fwd = p3(0, -Math.sin(t), Math.cos(t));
  /** A point in the torso's frame: l across, u up the spine, f out of the chest. */
  const tp = (l: number, u: number, f = 0): P3 => p3(pelvis.l + l, pelvis.u + up.u * u + fwd.u * f, pelvis.f + up.f * u + fwd.f * f);
  const neck = tp(0, BONES.torso);
  const SH = 7 * B;
  const shoulder = (side: number): P3 => tp(side * SH, BONES.torso - 4);
  const hip = (side: number): P3 => tp(side * 3.8 * B, 0);
  const stance = 3.6 * B + Math.min(3, Math.abs(pose.footF[0] - pose.footB[0]) * 0.08);
  const ankle = (foot: Vec, side: number): P3 => p3(side * stance, 3 - foot[1], foot[0]);
  const legR = ik(hip(1), ankle(pose.footF, 1), BONES.thigh, BONES.shin, p3(0.25, 0, 1));
  const legL = ik(hip(-1), ankle(pose.footB, -1), BONES.thigh, BONES.shin, p3(-0.25, 0, 1));

  const shape = WEAPON_SHAPES[d.weapon];
  const twoHanded = shape.grip2 !== null && !pose.handB;
  /** A hand from the pose (relative to the neck), moved out to its side. */
  const handAt = (rel: Vec, side: number, holds: boolean): P3 => {
    const sh = shoulder(side);
    const h = p3(0, neck.u - rel[1], neck.f + rel[0]);
    const rf = h.f - sh.f;
    const ru = h.u - sh.u;
    // Hands reaching forward or overhead come in toward the middle.
    const inward = Math.max(clamp(rf / 22, 0, 1) * 0.85, clamp((ru - 2) / 16, 0, 1) * 0.5);
    let l = side * (SH + 1.5) * (1 - inward);
    // A blow sweeps from high on its side to low across the body.
    if (swing && holds) l += side * clamp(ru + 8, -14, 20) * Math.sin(ROLL);
    return p3(l, h.u, h.f);
  };
  const bendArm = (side: number): P3 => p3(side * 0.45, -1, -0.3);
  const armR = ik(shoulder(1), handAt(pose.handF, 1, true), BONES.upperArm, BONES.foreArm, bendArm(1));
  const axesR = weaponAxes(d.weapon, pose.weapon, 1, swing);
  const handLTarget = twoHanded
    ? add(armR.end, axesR.u, shape.grip2 as number)
    : pose.handB
      ? handAt(pose.handB, -1, !!d.weapon2)
      : p3(-(SH + 1.5), shoulder(-1).u - 24, shoulder(-1).f - 1);
  const armL = ik(shoulder(-1), handLTarget, BONES.upperArm, BONES.foreArm, bendArm(-1));
  const axesL = d.weapon2 ? weaponAxes(d.weapon2, pose.weapon2 ?? pose.weapon, -1, swing) : null;

  const torsoDepth = depth(tp(0, 14));
  const robed = d.skirt.kind === 'robe';

  // ── Parts ──
  const poly = (pts: P3[], r: Ramp, opts: { shade?: number; line?: RGB | false } = {}): void => {
    c.paint(c.mask().poly(pts.map(proj)), r, { shade: opts.shade ?? 2, line: opts.line });
  };
  /** Torso-frame outline, on the surface facing the viewer. */
  const surface = (pts: [number, number][], out = 3): P3[] => pts.map(([l, u]) => tp(l, u, s * out));
  const capsule = (a: P3, b: P3, ra: number, rb: number, r: Ramp, shade = 1): void => {
    const pa = proj(a);
    const pb = proj(b);
    c.paint(c.mask().capsule(pa[0], pa[1], pb[0], pb[1], ra, rb), r, { shade });
  };

  const paintLeg = (hipP: P3, leg: { mid: P3; end: P3 }, dim: boolean): void => {
    const k = dim ? far : same;
    capsule(hipP, leg.mid, 4.4 * B, 3.6 * B, k(d.pants), 2);
    capsule(leg.mid, leg.end, 3.5 * B, 2.8 * B, k(d.pants), 2);
    const top = lerp3(leg.mid, leg.end, 0.42);
    const pa = proj(top);
    const pb = proj(leg.end);
    const boot = c.mask().capsule(pa[0], pa[1], pb[0], pb[1], 3.5 * B, 3.1 * B);
    if (front) boot.ellipse(pb[0], pb[1] + 2.4, 3.1 * B, 2.4);
    else boot.ellipse(pb[0], pb[1] + 1.2, 2.8 * B, 2);
    c.paint(boot, k(d.boot), { shade: 2 });
    c.line(pa[0] - 3, pa[1], pa[0] + 3, pa[1], k(d.boot)[0]);
    if (d.kneepad && front) {
      const kp = proj(leg.mid);
      c.paint(c.mask().ellipse(kp[0], kp[1] + 0.5, 3 * B, 2.8 * B), k(d.kneepad));
    }
  };

  const paintArm = (side: number, arm: { mid: P3; end: P3 }): void => {
    const sh = shoulder(side);
    const k = depth(arm.end) < torsoDepth - 2 ? far : same;
    capsule(sh, arm.mid, 3.3 * B, 2.9 * B, k(d.sleeve));
    if (robed) {
      capsule(arm.mid, arm.end, 3 * B, 4.4 * B, k(d.sleeve));
      const cuff = proj(lerp3(arm.mid, arm.end, 0.82));
      const hp = proj(arm.end);
      c.paint(c.mask().capsule(cuff[0], cuff[1], hp[0], hp[1], 4.4 * B, 4.4 * B).filter((x, y) => Math.hypot(x + 0.5 - hp[0], y + 0.5 - hp[1]) > 3), k(d.trim), { line: false });
    } else {
      capsule(arm.mid, arm.end, 2.9 * B, 2.5 * B, k(d.sleeve));
      capsule(lerp3(arm.mid, arm.end, 0.45), arm.end, 3.1 * B, 2.7 * B, k(d.glove));
    }
    if (d.pauldron) {
      const p = proj(add(sh, p3(side * 1, 1.5, 0)));
      c.paint(c.mask().ellipse(p[0], p[1], 5.2 * B, 4.4 * B), d.pauldron, { shade: 2 });
      c.line(p[0] - 4, p[1] + 2, p[0] + 4, p[1] + 2, d.pauldron[2]);
    }
  };

  const paintHand = (arm: { end: P3 }): void => {
    const r = d.glove === d.skin || d.sleeve === d.skin ? d.skin : d.glove;
    const p = proj(arm.end);
    c.paint(c.mask().ellipse(p[0], p[1], 2.5 * B, 2.4 * B), r);
  };

  const paintTorso = (): void => {
    const w = (k: number): number => k * B;
    // Hips under the belt join the thighs.
    poly(surface([[-w(5.8), 1], [w(5.8), 1], [w(5.4), -6], [-w(5.4), -6]]), d.pants);
    const outline: [number, number][] = [[-w(5.6), 0], [-w(6.6), 9], [-w(7.4), 18], [-w(7.6), 23], [-w(4.4), 27.5], [w(4.4), 27.5], [w(7.6), 23], [w(7.4), 18], [w(6.6), 9], [w(5.6), 0]];
    poly(surface(outline), d.chest);
    if (front) {
      if (d.front) poly(surface([[-2.3, 26], [2.3, 26], [2.3, 1], [-2.3, 1]], 3.4), d.front, { line: false, shade: 1 });
      const seamA = proj(tp(-w(6.6), 16, 3.4));
      const seamB = proj(tp(w(6.6), 16, 3.4));
      if (!d.front || d.skirt.kind !== 'robe') c.line(seamA[0], seamA[1], seamB[0], seamB[1], d.chest[2]);
      const n0 = proj(tp(-3, 26.5, 3.4));
      const n1 = proj(tp(3, 26.5, 3.4));
      c.line(n0[0], n0[1], n1[0], n1[1], d.trim[1]);
    } else {
      const a = proj(tp(0, 25, -3.4));
      const b = proj(tp(0, 5, -3.4));
      c.line(a[0], a[1], b[0], b[1], d.chest[2]);
    }
    poly(surface([[-w(6.3), 4], [w(6.3), 4], [w(6.1), 0.5], [-w(6.1), 0.5]], 3.5), d.belt, { line: false, shade: 1 });
    if (front) {
      const b0 = proj(tp(-1, 2.3, 3.6));
      c.dots([b0, [b0[0] + 1, b0[1]], [b0[0], b0[1] - 1], [b0[0] + 1, b0[1] - 1]], d.trim[0]);
    }
  };

  const paintSkirt = (): void => {
    const r = d.skirt.ramp;
    const w = (k: number): number => k * B;
    switch (d.skirt.kind) {
      case 'tassets':
        poly(surface([[-w(6.6), 1], [w(6.6), 1], [w(7.4), -11], [0.5, -10], [-w(7.4), -11]], 4), r);
        {
          const a = proj(tp(0, 0, s * 4.2));
          const b = proj(tp(0, -10, s * 4.2));
          c.line(a[0], a[1], b[0], b[1], r[2]);
        }
        if (d.front && front) poly(surface([[-2.2, 1], [2.2, 1], [2, -15], [0, -17], [-2, -15]], 4.6), d.front, { shade: 1 });
        break;
      case 'tunic':
        poly(surface([[-w(6.6), 1], [w(6.4), 1], [w(7.4), -9], [4, -11], [1, -9], [-2, -11], [-w(7.4), -9]], 4), r);
        break;
      case 'coat': {
        // Open at the front over the legs; tails that fly back behind.
        const tail = (l: number, u: number): P3 => add(tp(l, u, s * 4), p3(0, wind * 6, -wind * 12));
        if (front) {
          for (const side of [-1, 1]) poly([tp(side * 1.5, 1, 4), tp(side * w(6.6), 1, 4), tail(side * (w(7.6) + wind * 2), -18), tail(side * 2.5, -16)], r);
        } else {
          poly([tp(-w(6.6), 1, -4), tp(w(6.6), 1, -4), tail(w(7.8) + wind * 2, -18), tail(0.5, -15), tail(-w(7.8) - wind * 2, -18)], r);
          const a = proj(tp(0.5, 0, -4.2));
          const b = proj(tail(0.5, -15));
          c.line(a[0], a[1], b[0], b[1], r[2]);
        }
        break;
      }
      case 'robe': {
        const waistL = proj(tp(-w(6.4), 2, s * 3));
        const waistR = proj(tp(w(6.4), 2, s * 3));
        const aR = proj(legR.end);
        const aL = proj(legL.end);
        const hemY = Math.max(aR[1], aL[1]) + 0.5;
        const cx = (waistL[0] + waistR[0]) / 2;
        const lo = Math.min(aR[0], aL[0], cx - 4) - 5 - wind * 2;
        const hi = Math.max(aR[0], aL[0], cx + 4) + 5 + wind * 2;
        const kneeY = (waistL[1] + hemY) / 2;
        c.paint(c.mask().poly([waistL, waistR, [hi - 1.5, kneeY], [hi, hemY], [cx, hemY + 1], [lo, hemY], [lo + 1.5, kneeY]]), r, { shade: 2 });
        c.line(lo, hemY, hi, hemY, d.trim[1]);
        if (front && d.front) {
          c.paint(c.mask().poly([[cx - 1.8, waistL[1]], [cx + 1.8, waistL[1]], [cx + 3.5, hemY], [cx - 3.5, hemY]]), d.front, { line: false, shade: 1 });
          c.line(cx - 1.8, waistL[1], cx - 3.5, hemY, d.trim[1]);
          c.line(cx + 1.8, waistL[1], cx + 3.5, hemY, d.trim[1]);
        }
        break;
      }
    }
  };

  const paintCape = (): void => {
    if (!d.cape) return;
    const w = Math.max(0.12, wind);
    const a = rad(w * 74);
    const down = p3(0, -Math.cos(a), -Math.sin(a));
    const L = d.cape.length;
    const topR = tp(SH + 1, BONES.torso - 3, -3.5);
    const topL = tp(-SH - 1, BONES.torso - 3, -3.5);
    const spread = 2.5 + w * 3;
    const botR = add(add(topR, down, L), p3(spread, 0, 0));
    const botL = add(add(topL, down, L - 2), p3(-spread, 0, 0));
    const hem: P3[] = [];
    for (let i = 0; i <= 6; i++) {
      const p = lerp3(botL, botR, i / 6);
      const ripple = (i % 2 ? 2.2 : 0) + Math.sin(i * 1.7 + w * 5) * w * 2.5;
      hem.push(add(p, down, ripple));
    }
    poly([topL, tp(0, BONES.torso - 1, -3.5), topR, ...hem.reverse()], d.cape.ramp);
    if (!front) {
      for (const k of [0.3, 0.5, 0.7]) {
        const top = proj(lerp3(topL, topR, k));
        const bot = proj(lerp3(botL, botR, k));
        c.line(top[0], top[1] + 3, (top[0] * 0.35 + bot[0] * 0.65), (top[1] * 0.35 + bot[1] * 0.65), d.cape.ramp[2]);
      }
    }
  };

  const paintQuiver = (): void => {
    if (!d.quiver) return;
    const top = tp(3 * B, 25, -6);
    const bottom = tp(-3 * B, 6, -8);
    const pt = proj(top);
    const pb = proj(bottom);
    c.paint(c.mask().capsule(pt[0], pt[1], pb[0], pb[1], 3.2, 2.8), hexRamp('#8a5c36', '#5e3c22', '#382212'), { shade: 1 });
    const dir = norm(sub(top, bottom));
    for (let i = -1; i <= 1; i++) {
      const base = add(top, p3(i * 1.8, 0, 0));
      const tip = proj(add(base, dir, 6));
      const b = proj(base);
      c.line(b[0], b[1], tip[0], tip[1], hex('#c8b08a'));
      c.dots([tip, [tip[0] - 1, tip[1]]], i === 0 ? hex('#ffffff') : hex('#d84040'));
    }
  };

  const paintScarf = (wrap: boolean): void => {
    if (!d.scarf) return;
    if (wrap) {
      const p = proj(tp(0, BONES.torso + 0.5, s * 1));
      c.paint(c.mask().ellipse(p[0], p[1], 6, 2.8), d.scarf, { shade: 2 });
      return;
    }
    // Tails hanging from a knot at the back of the neck, streaming back when running.
    const knot = tp(-2, BONES.torso, -3.5);
    const a = rad(20 + wind * 60);
    const dir = p3(-0.25, -Math.cos(a), -Math.sin(a));
    const L = 15 + wind * 7;
    const m = c.mask();
    for (const off of [0, 2.5]) {
      let prev = proj(add(knot, p3(off, 0, 0)));
      for (let i = 1; i <= 4; i++) {
        const q = i / 4;
        const p = proj(add(add(knot, p3(off + Math.sin(q * 5 + wind * 3) * 1.5 * q, 0, 0)), dir, L * q));
        m.capsule(prev[0], prev[1], p[0], p[1], 2.4 - i * 0.3, 2.1 - i * 0.3);
        prev = p;
      }
    }
    c.paint(m, d.scarf, { shade: 1 });
  };

  const paintNeckAndHead = (): void => {
    const n0 = proj(neck);
    const n1 = proj(tp(0, BONES.torso + 3));
    c.paint(c.mask().capsule(n0[0], n0[1], n1[0], n1[1], 2.4, 2.2), d.skin, { line: false });
    paintScarf(true);
    const chin = proj(tp(0, BONES.torso + 1.5));
    if (front) paintFrontHead(c, d.hairdo, d.skin, chin);
    else paintBackHead(c, d.hairdo, d.skin, chin, wind);
  };

  // ── Arms and weapons, ordered by depth around the body ──
  interface Item {
    d: number;
    draw: () => void;
  }
  const items: Item[] = [];
  const weaponMid = (hand: P3, ax: Axes, kind: WeaponKind): P3 => {
    const [r0, r1] = WEAPON_SHAPES[kind].reach;
    return add(hand, ax.u, (r0 + r1) / 2);
  };
  const drawWeapon = (kind: WeaponKind, hand: P3, ax: Axes, draw?: P3): void => {
    paintWeapon(c, kind, proj(hand), vec(ax.u), draw ? proj(draw) : undefined, vec(ax.v));
  };
  const armRD = depth(lerp3(armR.mid, armR.end, 0.6)) + 0.01;
  const armLD = depth(lerp3(armL.mid, armL.end, 0.6)) + 0.01;
  const wD = depth(weaponMid(armR.end, axesR, d.weapon));
  const before = (x: number): boolean => x < torsoDepth - 1.5;
  items.push({ d: armRD, draw: () => paintArm(1, armR) });
  items.push({ d: wD, draw: () => drawWeapon(d.weapon, armR.end, axesR, pose.draw ? armL.end : undefined) });
  // A hand goes over the grip of the weapon it holds, if both are on the same side of the body.
  items.push({ d: before(wD) === before(armRD) ? Math.max(armRD, wD) + 0.02 : armRD + 0.02, draw: () => paintHand(armR) });
  items.push({ d: armLD, draw: () => paintArm(-1, armL) });
  if (axesL && d.weapon2) {
    const w2 = d.weapon2;
    const w2D = depth(weaponMid(armL.end, axesL, w2));
    items.push({ d: w2D, draw: () => drawWeapon(w2, armL.end, axesL) });
    items.push({ d: before(w2D) === before(armLD) ? Math.max(armLD, w2D) + 0.02 : armLD + 0.02, draw: () => paintHand(armL) });
  } else {
    items.push({ d: twoHanded && before(wD) === before(armLD) ? Math.max(armLD, wD) + 0.02 : armLD + 0.02, draw: () => paintHand(armL) });
  }
  items.sort((a, b) => a.d - b.d);
  const behind = items.filter((i) => before(i.d));
  const ahead = items.filter((i) => !before(i.d));

  // Legs: the one further from the viewer first, a shade darker.
  const legs = (): void => {
    const rD = depth(legR.mid);
    const lD = depth(legL.mid);
    if (rD < lD) {
      paintLeg(hip(1), legR, true);
      paintLeg(hip(-1), legL, false);
    } else {
      paintLeg(hip(-1), legL, lD < rD - 0.5);
      paintLeg(hip(1), legR, false);
    }
  };

  const chin = proj(tp(0, BONES.torso + 1.5));
  if (front) {
    paintCape();
    paintFrontBackHair(c, d.hairdo, d.skin, chin, wind);
    paintQuiver();
    paintScarf(false);
    for (const i of behind) i.draw();
    legs();
    paintTorso();
    paintSkirt();
    paintNeckAndHead();
    for (const i of ahead) i.draw();
  } else {
    for (const i of behind) i.draw();
    legs();
    paintTorso();
    paintSkirt();
    paintCape();
    paintQuiver();
    paintNeckAndHead();
    paintScarf(false);
    for (const i of ahead) i.draw();
  }
  c.outline(INK);

  // ── Effects ──
  const fx = pose.fx;
  if (fx) {
    const tint = d.aura;
    const sweep = (kind: WeaponKind, hand: P3, from: number, to: number, side: number): void => {
      const [r0, r1] = WEAPON_SHAPES[kind].reach;
      const span = to - from;
      const n = Math.max(2, Math.ceil(Math.abs(span) / 5));
      const color = smearColor(tint);
      const h = proj(hand);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const ax = weaponAxes(kind, from + span * k, side, swing);
        const dir = vec(ax.u);
        // The part of the sweep on the far side of the body shows only around it.
        const hidden = depth(add(hand, ax.u, r1)) < torsoDepth - 2;
        const a: Vec = [h[0] + dir[0] * (r0 + (r1 - r0) * 0.35 * (1 - k)), h[1] + dir[1] * (r0 + (r1 - r0) * 0.35 * (1 - k))];
        const b: Vec = [h[0] + dir[0] * (r1 + 2), h[1] + dir[1] * (r1 + 2)];
        const alpha = 0.12 + 0.6 * k * k;
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (let j = 0; j <= steps; j++) {
          const e = j / steps;
          c.glow(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, e > 0.85 ? SMEAR : color, alpha * (0.45 + 0.55 * e), hidden);
        }
      }
    };
    if (fx.smear !== undefined) sweep(d.weapon, armR.end, fx.smear, pose.weapon, 1);
    if (fx.smear2 !== undefined && d.weapon2) sweep(d.weapon2, armL.end, fx.smear2, pose.weapon2 ?? pose.weapon, -1);
    const tip = add(armR.end, axesR.u, shape.reach[1]);
    const tipHidden = depth(tip) < torsoDepth - 2;
    const tipAt = (extra: number): Vec => proj(add(armR.end, axesR.u, shape.reach[1] + extra));
    if (fx.impact) burst(c, tipAt(0), 9, hex('#fff2b0'), 0.9, tipHidden);
    if (fx.flash) burst(c, tipAt(2), 6, hex('#fff6c8'), 0.9, tipHidden);
    const ground = (p: P3): Vec => proj(p3(p.l, 0, p.f));
    if (fx.dust) {
      for (const leg of [legR, legL]) {
        const g = ground(leg.end);
        for (const [dx, r] of [[-5, 2.6], [5, 2.2]] as [number, number][]) {
          for (let y = -r; y <= r; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) if ((x / 1.4) ** 2 + y * y <= r * r) c.glow(g[0] + dx + x, g[1] - 1 + y - r * 0.4, hex('#d8cdb8'), 0.45);
        }
      }
    }
    if (fx.speed) {
      // Streaks trail behind: up the screen facing the viewer, down it facing away.
      const p = proj(pelvis);
      for (let k = 0; k < 4; k++) {
        const x = p[0] + (k % 2 ? 1 : -1) * (13 + (k >> 1) * 5);
        const y0 = p[1] - 18 + (k >> 1) * 10;
        const n = 10 + ((k * 5) % 7);
        for (let i = 0; i < n; i++) c.glow(x, y0 - s * i, hex('#ffffff'), 0.4 * (1 - i / n));
      }
    }
    if (fx.circle) {
      const g = ground(pelvis);
      const rx = 24 * fx.circle;
      const ry = 6.5 * fx.circle;
      for (let y = -ry - 1; y <= ry + 1; y++) {
        for (let x = -rx - 1; x <= rx + 1; x++) {
          const e = Math.hypot(x / rx, y / ry);
          if (e > 1.08) continue;
          const ring = Math.abs(e - 0.92) < 0.08 || Math.abs(e - 0.6) < 0.06;
          c.glow(g[0] + x, g[1] + y, d.aura, ring ? 0.85 : 0.14, true);
        }
      }
    }
    if (fx.quake) {
      // A shockwave rolls out ahead: toward the viewer, or away behind the hero.
      for (let k = 0; k < 4; k++) {
        const g = ground(p3(0, 0, pelvis.f + 14 + k * 8));
        const rx = 7 + k * 3;
        for (let x = -rx; x <= rx; x++) {
          const arc = Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * (2 + k);
          c.glow(g[0] + x, g[1] - arc * 0.6, hex('#ffe2a0'), 0.7 - k * 0.12, !front);
        }
        c.glow(g[0] - rx * 0.6, g[1] - 3 - k, hex('#b8a888'), 0.9, !front);
        c.glow(g[0] + rx * 0.5, g[1] - 4 - k, hex('#9a8a6c'), 0.9, !front);
      }
    }
    if (fx.aura) auraRim(c, d.aura, fx.aura);
  }
  return c.flatten();
}
