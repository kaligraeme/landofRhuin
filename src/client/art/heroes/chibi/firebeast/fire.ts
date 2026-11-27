/**
 * The Firebeast's own pieces, built on the chibi engine: tongues of living flame (the mane round
 * its head and shoulders, the fire on its tail), its horns and brow ridges, its thick tail, its
 * digitigrade feet with their claws, glowing cracks down its limbs, the long claws on both hands
 * (held items, so the engine's impacts leave from them) and the glow its fire, its magma seams
 * and its eyes throw over everything near them, with embers rising off it and heat shimmer over
 * its flames. And its own effects: slashes of fire for its strikes, a pillar of fire to emerge
 * from and collapse into, bursts of flame, and smoke as its fire dies.
 *
 * How high the fire burns is the pose's `fire` (`BeastPose`): the flames grow and shrink with it,
 * and below `EMBERS` the mane's locks die back and its flame chars to embers.
 * Every flame flickers with the pose's `phase`: a flame's length and sway are periodic in it (a
 * whole number of flickers a turn), so a loop that runs `phase` from 0 to 1 loops cleanly, and a
 * clip that advances it every frame never shows the same fire twice.
 */
import type { Canvas, RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { type DrawItem, type Held, type HeadPiece, type HeldItem, type Piece, type PieceContext } from '../design.js';
import { mainHeld } from '../held.js';
import { hash } from '../pieces.js';
import { dim, type Mat, mixc, type Part, scanPoly, toneLight } from '../raster.js';
import { add3, at3, type ChibiPose, clamp, cross3, dirIn, dot3, type FxContext, type Limb, lerp, lerp3, mul3, norm3, rad, sub3, TO_CAMERA, type V3 } from '../rig.js';

/**
 * A pose of the beast: a chibi pose with how high its fire burns (`fire`, default 1): the mane,
 * the flames off its shoulders and its tail, and the glow they throw, grow with it (about 1.4
 * blazing in a roar) and die down toward 0 (smouldering embers as it falls).
 */
export interface BeastPose extends ChibiPose {
  fire?: number;
}

/** How high a pose's fire burns. */
export const fireOf = (pose: ChibiPose): number => Math.max(0, (pose as BeastPose).fire ?? 1);

/** Below this the fire has sunk to embers: the mane's locks are gone and its flame darkens. */
const EMBERS = 0.4;

// ── Flame ────────────────────────────────────────────────────────────────────────────────────

/**
 * Paints a tongue of flame along a spine of screen points (root to tip), `width(t)` either side
 * of it: white-hot down its heart near the root, gold around that, orange to its edges and red
 * at its very tip, in the flame material's four tones (highlight, light, base, shadow).
 */
export function tongue(part: Part, P: readonly Vec[], width: (t: number) => number, m: Mat, z: (t: number) => number, id: number): void {
  const n = P.length - 1;
  if (n < 1) return;
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = P[Math.max(0, i - 1)] as Vec;
    const b = P[Math.min(n, i + 1)] as Vec;
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / tl;
    const ny = (b[0] - a[0]) / tl;
    const w = width(i / n);
    const p = P[i] as Vec;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  // The nearest point on the spine to a pixel: how far along it (t) and how far across it (a, 0 on the spine to 1 at the edge).
  let mx = -1;
  let my = -1;
  let mt = 0;
  let ma = 0;
  const near = (x: number, y: number): void => {
    if (x === mx && y === my) return;
    mx = x;
    my = y;
    const qx = x + 0.5;
    const qy = y + 0.5;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const a = P[i] as Vec;
      const b = P[i + 1] as Vec;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const l2 = ex * ex + ey * ey || 1;
      const tt = clamp(((qx - a[0]) * ex + (qy - a[1]) * ey) / l2, 0, 1);
      const d2 = (qx - a[0] - ex * tt) ** 2 + (qy - a[1] - ey * tt) ** 2;
      if (d2 < best) {
        best = d2;
        mt = (i + tt) / n;
        ma = Math.sqrt(d2) / Math.max(0.8, width(mt));
      }
    }
  };
  const tone = (t: number, a: number): number => (t > 0.84 ? 3 : a < 0.3 && t < 0.55 ? 0 : a < 0.66 && t < 0.76 ? 1 : 2);
  part.poly(
    [...left, ...right.reverse()],
    m,
    (x, y) => {
      near(x, y);
      return toneLight(m, tone(mt, ma));
    },
    (x, y) => {
      near(x, y);
      return z(mt);
    },
    id,
  );
}

/** How wide a tongue of flame is along it: swelling from its root, then licking up to a point. */
const flameWidth =
  (w: number) =>
  (t: number): number =>
    w * (t < 0.28 ? 0.75 + (0.25 * t) / 0.28 : Math.pow((1 - t) / 0.72, 0.85));

/**
 * The flicker of one flame at a phase: how much longer or shorter than its rest it burns (a
 * share) and how far its tip sways (-1 to 1), periodic in the phase so loops close.
 */
export function flicker(phase: number, seed: number): { len: number; sway: number } {
  const a = Math.PI * 2 * phase;
  const s = seed * 2.39;
  return {
    len: 0.82 + 0.13 * Math.sin(a * 3 + s) + 0.07 * Math.sin(a * 5 + s * 1.7),
    sway: Math.sin(a * 2 + s * 1.3) * 0.7 + Math.sin(a * 4 + s) * 0.3,
  };
}

/**
 * The points of a flame rising from `root` (hero space): it leaves along `dir`, bends up as fire
 * does (and back in the wind, up in an updraft), its tip swaying across `across` as it flickers.
 */
function flamePath(ctx: PieceContext, root: V3, dir: V3, len: number, across: V3, seed: number, n = 5): V3[] {
  const { pose } = ctx;
  const fl = flicker(pose.phase ?? 0, seed);
  const wind = Math.max(0, pose.wind ?? 0);
  const rise = norm3([-wind * 1.4, 1 + Math.max(0, pose.lift ?? 0), (pose.sway ?? 0) * 0.5]);
  const d0 = norm3(dir);
  const L = len * fl.len * (1 + Math.max(0, pose.lift ?? 0) * 0.25) * Math.min(1.6, fireOf(pose));
  const pts: V3[] = [root];
  let p = root;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const d = norm3(add3(mul3(d0, 1 - t * 0.45), rise, t * t * 0.7));
    p = add3(add3(p, d, L / n), across, (fl.sway * L * 0.16 * t * t) / n * 3);
    pts.push(p);
  }
  return pts;
}

/** A tongue of flame in hero space, painted into a part with its true depth (lifted `lift` toward the viewer along it). */
function paintFlame(ctx: PieceContext, part: Part, pts: readonly V3[], w: number, m: Mat, id: number, lift = 0): void {
  // A fire burning low licks thinner, and goes out.
  const k = Math.min(1.25, fireOf(ctx.pose));
  if (k < 0.12) return;
  w *= 0.55 + 0.45 * Math.min(1, k) + Math.max(0, k - 1) * 0.4;
  const P = pts.map((p) => ctx.proj(p));
  const Z = pts.map((p) => ctx.depth(p));
  const n = pts.length - 1;
  tongue(part, P, flameWidth(w), m, (t) => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return lerp(Z[i] as number, Z[i + 1] as number, f - i) + lift * Math.min(1, t * 1.5);
  }, id);
}

// ── The mane ─────────────────────────────────────────────────────────────────────────────────

/** A tongue of the mane, rooted on the hair's shell as a lock is (yaw 0 the face, 90 its right, 180 the back; pitch up from the ears). */
export interface ManeFlame {
  yaw: number;
  pitch: number;
  len: number;
  w: number;
  /** How far it leaves the head back (+) toward the nape before it rises. */
  back?: number;
}

/**
 * The mane's living flame, painted with the head (in its depth test, so the head hides the
 * tongues behind it): tongues rooted round the hair's shell, leaving it outward and back and
 * rising, each flickering on its own.
 */
export function mane(spec: { shell: { c: V3; r: V3 }; flames: readonly ManeFlame[]; mat: Mat }): HeadPiece {
  const s = spec.shell;
  return {
    // A fire burning low has died back from the mane's locks: only the glowing mass is left.
    covers: (ctx) => (fireOf(ctx.pose) < EMBERS ? () => true : null),
    paint: (ctx, part, head) => {
      spec.flames.forEach((fl, i) => {
        const cp = Math.cos(rad(fl.pitch));
        const out: V3 = [Math.cos(rad(fl.yaw)) * cp, Math.sin(rad(fl.pitch)), Math.sin(rad(fl.yaw)) * cp];
        const rootH: V3 = [s.c[0] + out[0] * s.r[0] * 0.86, s.c[1] + out[1] * s.r[1] * 0.86, s.c[2] + out[2] * s.r[2] * 0.86];
        const dirH = norm3(add3(add3(out, [0, 1, 0], 0.4), [-1, 0, 0], fl.back ?? 0.4));
        const root = at3(head, rootH[0], rootH[1], rootH[2]);
        const dir = dirIn(head, dirH[0], dirH[1], dirH[2]);
        const across = dirIn(head, 0, 0, Math.sign(out[2]) || 1);
        paintFlame(ctx, part, flamePath(ctx, root, dir, fl.len, across, i * 1.37 + 0.5), fl.w, spec.mat, 300 + i, 2.5);
      });
    },
  };
}

/**
 * Flames rising off the shoulders and the upper back, round behind the neck: each sorted with the
 * upper body on its own, so they rise behind the head and the shoulders seen from the front and
 * the side, and over the back seen from behind.
 */
export function shoulderFlames(spec: { top: number; ring: readonly [number, number]; flames: readonly { at: number; len: number; w: number }[]; mat: Mat }): Piece {
  return (ctx) => {
    const { rig } = ctx;
    const cf = rig.chest;
    // Never over the head (the painter sorts it just over the torso).
    const headZ = ctx.depth(at3(cf, 0, 14, 0)) + ctx.upper + 1;
    const paths = spec.flames.map((fl, i) => {
      const phi = rad(fl.at);
      const out = dirIn(cf, Math.cos(phi), 0, Math.sin(phi));
      const root = at3(cf, Math.cos(phi) * spec.ring[0], spec.top, Math.sin(phi) * spec.ring[1]);
      const dir = add3(add3(out, cf.u, 0.8), cf.f, -0.7);
      return flamePath(ctx, root, dir, fl.len, dirIn(cf, 0, 0, Math.sign(Math.sin(phi)) || 1), i * 2.11 + 7);
    });
    // Sorted together, at the middle of the back of the shoulders.
    const back = at3(cf, -spec.ring[0], spec.top, 0);
    return [
      {
        z: Math.min(ctx.upperZ(ctx.depth(back)) - 0.2, headZ - 0.2),
        draw: () => {
          const part = ctx.part();
          paths.forEach((pts, i) => paintFlame(ctx, part, pts, (spec.flames[i] as { w: number }).w, spec.mat, 1 + i));
          part.commit();
        },
      },
    ];
  };
}

// ── The tail ─────────────────────────────────────────────────────────────────────────────────

export interface TailSpec {
  /** Where it grows from, in the pelvis frame, its length and its radius at the root and the tip. */
  root: V3;
  len: number;
  r: readonly [number, number];
  hide: Mat;
  /** The plates along its top, and the seams that glow between its segments. */
  plate: Mat;
  seam: Mat;
  flame: Mat;
}

/**
 * The tail: thick at the root, sweeping back and down from the base of the spine and curling up
 * toward its burning tip, plated along its top with glowing seams between its segments, flames
 * licking off its back and a great flame at its tip. It sways and ripples with the pose (`sway`,
 * `phase`), streams back and up in the wind and rises in an updraft; seen end on (toward or away
 * from the viewer) it curls out to its right, so it still shows its length.
 */
export function tail(spec: TailSpec): Piece {
  return (ctx) => {
    const { rig, pose, cam } = ctx;
    const pf = rig.pelvis;
    const back = norm3([-pf.f[0], 0, -pf.f[2]]);
    const side = norm3([pf.r[0], 0, pf.r[2]]);
    const root = at3(pf, spec.root[0], spec.root[1], spec.root[2]);
    const wind = clamp(pose.wind ?? 0, 0, 1.3);
    const lift = pose.lift ?? 0;
    const ph = Math.PI * 2 * (pose.phase ?? 0);
    // Seen end on, it curls out to its side.
    const view = norm3(cam.local(TO_CAMERA));
    const endOn = clamp((Math.abs(dot3(back, norm3([view[0], 0, view[2]]))) - 0.55) / 0.45, 0, 1);
    const n = 10;
    const pts: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const b = spec.len * t * (1 - wind * 0.08);
      // Down from the root, then curling up to the tip; the wind and an updraft raise it.
      const u = -9 * Math.sin(Math.PI * t * 0.85) + 13 * t * t * t + wind * 9 * t + lift * 10 * t * t;
      const r = (Math.sin(ph - t * 3.2) * 2.6 + (pose.sway ?? 0) * 7 + (pose.flare ?? 0) * 6) * t + endOn * 16 * t * t;
      const p = add3(add3(add3(root, back, b), [0, 1, 0], u), side, r);
      pts.push(p[1] < 2 ? [p[0], 2, p[2]] : p);
    }
    const z = ctx.depth(lerp3(pts[2] as V3, pts[3] as V3, 0.5));
    return [{ z, draw: () => paintTail(ctx, spec, pts) }];
  };
}

function paintTail(ctx: PieceContext, spec: TailSpec, pts: readonly V3[]): void {
  const { proj, depth } = ctx;
  const n = pts.length - 1;
  const part = ctx.part();
  const rAt = (t: number): number => lerp(spec.r[0], spec.r[1], Math.pow(t, 0.8));
  for (let i = 0; i < n; i++) {
    const a = pts[i] as V3;
    const b = pts[i + 1] as V3;
    part.capsule(proj(a), proj(b), rAt(i / n), rAt((i + 1) / n), spec.hide, 0, depth(a), depth(b), 1);
  }
  // Plates along its top: a ridge of short spines leaning back.
  for (let i = 1; i < n - 1; i++) {
    const t = i / n;
    const a = pts[i] as V3;
    const b = pts[i + 1] as V3;
    const along = norm3(sub3(b, a));
    const up = norm3(sub3([0, 1, 0], mul3(along, along[1])));
    const r = rAt(t);
    const base = add3(a, up, r * 0.7);
    const tip = add3(add3(base, up, 2.2 + r * 0.3), along, 2.2);
    part.poly([proj(add3(base, along, -1.8)), proj(tip), proj(add3(base, along, 1.6))], spec.plate, 0.5, depth(base) + 0.6, 2);
  }
  // Glowing seams between its segments.
  for (const t of [0.22, 0.4, 0.57, 0.72]) {
    const f = t * n;
    const i = Math.floor(f);
    const a = pts[i] as V3;
    const b = pts[i + 1] as V3;
    const c = lerp3(a, b, f - i);
    const along = norm3(sub3(b, a));
    const across = norm3(cross3(along, [0, 1, 0]));
    const up = norm3(cross3(across, along));
    const r = rAt(t) * 0.9;
    const ends = [add3(c, up, r), add3(c, across, r), add3(c, up, -r), add3(c, across, -r)];
    for (let k = 0; k < 4; k++) {
      const p = ends[k] as V3;
      const q = ends[(k + 1) % 4] as V3;
      part.line(proj(p), proj(q), spec.seam, 0, Math.max(depth(p), depth(q)) + 0.5, 3, false);
    }
  }
  // Flames licking off its back toward the tip, and the great flame at the tip.
  const across = norm3(cross3(norm3(sub3(pts[n] as V3, pts[n - 2] as V3)), [0, 1, 0]));
  for (const [t, len, w, seed] of [[0.6, 9, 2.4, 3], [0.78, 12, 2.8, 5]] as const) {
    const f = t * n;
    const i = Math.floor(f);
    const c = lerp3(pts[i] as V3, pts[i + 1] as V3, f - i);
    const root = add3(c, [0, 1, 0], rAt(t) * 0.6);
    paintFlame(ctx, part, flamePath(ctx, root, [-0.5, 1, 0], len, across, seed), w, spec.flame, 10 + seed, 1);
  }
  const tip = pts[n] as V3;
  const out = norm3(sub3(tip, pts[n - 1] as V3));
  paintFlame(ctx, part, flamePath(ctx, add3(tip, out, -2), add3(out, [0, 1, 0], 0.6), 20, across, 11, 6), 5, spec.flame, 20, 1.5);
  paintFlame(ctx, part, flamePath(ctx, add3(tip, out, -3), add3(out, [0, 1, 0], 1.5), 14, across, 13), 3.4, spec.flame, 21, 2);
  part.commit();
}

// ── The feet ─────────────────────────────────────────────────────────────────────────────────

/**
 * Digitigrade feet: the rig's ankle is the beast's hock, standing `build.ankle` off the floor; the
 * engine paints the shin down to it and a pad on the floor ahead of it (the design's boot), and
 * this paints the long bone from the hock down to the pad and three clawed toes at its front. Each
 * is sorted just after its own leg, as the painter sorts the leg.
 */
export function paws(spec: { hide: Mat; claw: Mat; hot: Mat; r: number }): Piece {
  return (ctx) => {
    const { rig, depth } = ctx;
    const torsoTrue = depth(at3(rig.chest, 0, 14, 0));
    const legZ = (leg: Limb): number => depth(leg.mid) * 0.7 + depth(leg.root) * 0.3;
    return [
      [rig.legR, rig.toeR],
      [rig.legL, rig.toeL],
    ].map(([leg, toe]): DrawItem => {
      const l = leg as Limb;
      const far = depth(l.mid) < torsoTrue - 2;
      return { z: legZ(l) + 0.01, draw: () => paintPaw(ctx, spec, l, toe as V3, far) };
    });
  };
}

function paintPaw(ctx: PieceContext, spec: { hide: Mat; claw: Mat; hot: Mat; r: number }, leg: Limb, toe: V3, far: boolean): void {
  const { proj, depth } = ctx;
  const k = (m: Mat): Mat => (far ? dim(m, -0.12) : m);
  const bias = far ? -0.16 : 0;
  const hock = leg.end;
  const drop = ctx.build.ankle - 3.4;
  const ball = add3(add3(hock, toe, 3), [0, -1, 0], drop);
  const part = ctx.part();
  part.capsule(proj(hock), proj(ball), spec.r, spec.r * 0.85, k(spec.hide), bias, depth(hock), depth(ball), 1);
  // Three toes, each ending in a claw curving down to the floor.
  const across = norm3(cross3(toe, [0, 1, 0]));
  for (const s of [-1, 0, 1]) {
    const a = add3(add3(ball, across, s * 1.7), toe, 1.5);
    const b = add3(add3(a, toe, 3.2 - Math.abs(s) * 0.6), across, s * 0.6);
    const c = add3(add3(b, toe, 2.4), [0, -1, 0], 1.6);
    part.capsule(proj(a), proj(b), 1.7, 1.5, k(spec.hide), bias, depth(a) + 0.5, depth(b) + 0.5, 2);
    part.capsule(proj(b), proj(c), 1.1, 0.5, k(spec.claw), bias, depth(b) + 1, depth(c) + 1, 3);
    const pc = proj(c);
    part.plot(pc[0], pc[1], spec.hot, 0, depth(c) + 2, 4, true);
  }
  part.commit();
}

// ── The claws ────────────────────────────────────────────────────────────────────────────────

export interface ClawSpec {
  /** How long the claws are, how thick at the root, how far apart they fan at the knuckles, and how far they hook. */
  len: number;
  w: number;
  spread: number;
  hook: number;
  /** The claw's dark horn, the glowing edge along its inside curve and its white-hot point. */
  mat: Mat;
  edge: Mat;
  hot: Mat;
  /** The glow round them as they blaze. */
  glow: RGB;
  /** The reach of the swipes they make (smears and impacts): wider than the claws, as a blazing arc is. */
  reach: readonly [number, number];
  tip: number;
}

/**
 * Three long claws from a fist, fanning out from the knuckles along the item's axis (the pose's
 * `weapon` angles, or the off hand's), hooking toward its edge (v), dark horn with a glowing inside
 * edge and white-hot points, like the Warden's blade. Painted in screen space from the grip's
 * axes, so they fan apart in every view.
 */
export function claws(spec: ClawSpec): HeldItem & { grip2: number } {
  const paint = (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)): void => {
    const g = held.grip;
    const o = ctx.proj(g.o);
    let u = ctx.cam.vec(g.u);
    let ul = Math.hypot(u[0], u[1]);
    // Seen end on, claws still show some length (as a blade keeps its breadth).
    if (ul < 0.7) {
      const v = ctx.cam.vec(g.v);
      u = ul > 0.05 ? u : [v[0] * 0.3, Math.abs(v[1]) * 0.3 + 0.2];
      ul = Math.hypot(u[0], u[1]) || 1;
      u = [(u[0] / ul) * 0.7, (u[1] / ul) * 0.7];
      ul = 0.7;
    }
    const perp: Vec = [-u[1] / ul, u[0] / ul];
    const v = ctx.cam.vec(g.v);
    const hookSign = Math.sign(v[0] * perp[0] + v[1] * perp[1]) || 1;
    const z0 = ctx.depth(g.o);
    const zU = ctx.depth(add3(g.o, g.u, 1)) - z0;
    const n = 4;
    for (let c = 0; c < 3; c++) {
      const off = (c - 1) * spec.spread;
      const len = spec.len * (c === 1 ? 1 : 0.86);
      const pts: Vec[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const s = 2.5 + len * t;
        const across = off * (1 + t * 0.25) + hookSign * spec.hook * t * t;
        pts.push([o[0] + u[0] * s + perp[0] * across, o[1] + u[1] * s + perp[1] * across]);
      }
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 1) / n;
        const za = z0 + zU * (2.5 + len * t0) + 0.3;
        const zb = z0 + zU * (2.5 + len * t1) + 0.3;
        part.capsule(pts[i] as Vec, pts[i + 1] as Vec, spec.w * (1 - t0 * 0.7), spec.w * (1 - t1 * 0.75), t1 > 0.8 ? spec.edge : spec.mat, 0, za, zb, 1 + c);
      }
      // The inside of the hook glows, hotter toward the point, and the point is white-hot.
      for (let i = 1; i < n; i++) {
        const p = pts[i] as Vec;
        const t = i / n;
        const q: Vec = [p[0] + perp[0] * hookSign * spec.w * (1 - t * 0.7) * 0.7, p[1] + perp[1] * hookSign * spec.w * (1 - t * 0.7) * 0.7];
        part.plot(q[0], q[1], t > 0.6 ? spec.hot : spec.edge, 0, z0 + zU * (2.5 + len * t) + 2, 1 + c, true);
      }
      const tip = pts[n] as Vec;
      part.plot(tip[0], tip[1], spec.hot, 0, z0 + zU * (2.5 + len) + 2, 1 + c, true);
    }
  };
  return {
    grip2: 0,
    reach: spec.reach,
    tip: spec.tip,
    paint,
    glow: (ctx, strength, held = mainHeld(ctx)) => {
      // The points glow, brighter as the pose calls on them.
      if (strength <= 0.1) return;
      const g = held.grip;
      const c = ctx.c;
      const tip = ctx.proj(add3(g.o, g.u, 2.5 + spec.len * 0.8));
      const R = 4 + strength * 3;
      for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) {
        for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
          const d = Math.hypot(dx, dy) / R;
          if (d > 1) continue;
          const x = Math.floor(tip[0] + dx);
          const y = Math.floor(tip[1] + dy);
          if (x < 0 || y < 0 || x >= c.w || y >= c.h) continue;
          c.glow(x, y, spec.glow, clamp(strength, 0, 1) * 0.35 * (1 - d));
        }
      }
    },
  };
}

// ── The glow ─────────────────────────────────────────────────────────────────────────────────

/**
 * Heat shimmer over the fire: the rows of the frame above the head (the tips of the mane's
 * flames) waver a pixel to either side, each row by its own amount, running up with the phase.
 */
function shimmer(x: FxContext): void {
  const { c, rig, proj } = x;
  const fire = fireOf(rig.pose);
  if (fire < EMBERS) return;
  const top = proj(add3(rig.head.o, rig.head.u, 8));
  const d = c.data;
  const w = c.w;
  const ph = (rig.pose.phase ?? 0) * Math.PI * 2;
  const x0 = Math.max(1, Math.floor(top[0] - 40));
  const x1 = Math.min(w - 2, Math.ceil(top[0] + 40));
  const row = new Uint8ClampedArray((x1 - x0 + 1) * 4);
  for (let y = Math.max(0, Math.floor(top[1] - 34)); y < Math.min(c.h, Math.floor(top[1])); y++) {
    const s = Math.round(Math.sin(y * 0.9 - ph * 2) * 0.55 * Math.min(1.4, fire));
    if (!s) continue;
    row.set(d.subarray((y * w + x0) * 4, (y * w + x1 + 1) * 4));
    for (let xx = x0; xx <= x1; xx++) {
      const from = xx - s;
      const j = (y * w + xx) * 4;
      if (from < x0 || from > x1) continue;
      for (let k = 0; k < 4; k++) d[j + k] = row[(from - x0) * 4 + k] as number;
    }
  }
}

const EMBER: RGB = [255, 96, 24];
const ASH: RGB = [58, 32, 34];

/**
 * The glow of the beast's fire: every pixel painted in one of the `hot` colours (its flames, its
 * magma seams, its eyes) throws a soft halo over the pixels round it (two pixels out, in `core`,
 * strength `k`), so the ink line round its flames burns orange and the seams bloom; and embers
 * rise off it, looping with the pose's `phase`. Painted from a pose's `fx.extra`.
 */
export function burn(hot: readonly RGB[], core: RGB, ember: readonly RGB[], flame: readonly RGB[], strength = 1): (x: FxContext) => void {
  // Pixels as 32-bit words (alpha, blue, green, red from the top byte down, as the canvas holds
  // them on a little-endian machine): painted pixels are opaque, so a colour is one word.
  const word = (c: RGB): number => (0xff000000 | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  const keys = new Set(hot.map(word));
  const flames = new Set(flame.map(word));
  return (x) => {
    let k = strength;
    const { c, rig } = x;
    const fire = fireOf(rig.pose);
    k *= Math.min(1.4, 0.25 + 0.75 * fire);
    // Sinking to embers, its flame darkens to a dull red glow.
    const ash = clamp((EMBERS + 0.15 - fire) * 2.4, 0, 0.9);
    shimmer(x);
    const w = c.w;
    const h = c.h;
    const d = c.data;
    const px = new Uint32Array(d.buffer, d.byteOffset, w * h);
    const near = buffer(w * h);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let xx = 0; xx < w; xx++) {
        const i = y * w + xx;
        const v = px[i] as number;
        if (v === 0) continue;
        if (ash > 0 && flames.has(v)) c.glow(xx, y, hash(xx, y * 7 + 3) < 0.16 ? EMBER : ASH, hash(xx, y * 7 + 3) < 0.16 ? ash * 0.6 : ash);
        if (!keys.has(v)) continue;
        near[i] = 1;
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 >= 0) {
      // Two rings out from the hot pixels: the first brighter.
      for (let pass = 2; pass <= 3; pass++) {
        const ya = Math.max(1, y0 - pass);
        const yb = Math.min(h - 2, y1 + pass);
        const xa = Math.max(1, x0 - pass);
        const xb = Math.min(w - 2, x1 + pass);
        for (let y = ya; y <= yb; y++) {
          for (let xx = xa; xx <= xb; xx++) {
            const i = y * w + xx;
            if (near[i]) continue;
            if (near[i - 1] === pass - 1 || near[i + 1] === pass - 1 || near[i - w] === pass - 1 || near[i + w] === pass - 1) near[i] = 4;
          }
        }
        for (let y = ya; y <= yb; y++) {
          for (let xx = xa; xx <= xb; xx++) {
            const i = y * w + xx;
            if (near[i] !== 4) continue;
            near[i] = pass;
            c.glow(xx, y, core, k * (pass === 2 ? 0.42 : 0.16), (d[i * 4 + 3] as number) === 0);
          }
        }
      }
      // Leave the buffer clear for the next frame.
      for (let y = Math.max(0, y0 - 3); y <= Math.min(h - 1, y1 + 3); y++) near.fill(0, y * w + Math.max(0, x0 - 3), y * w + Math.min(w - 1, x1 + 3) + 1);
    }
    // Embers rising off it: each climbs a whole number of times a turn of the phase, so they loop.
    const phase = rig.pose.phase ?? 0;
    const g = rig.pelvis.o;
    for (let i = 0; i < 12; i++) {
      const th = hash(i, 201) * Math.PI * 2;
      const rr = 10 + hash(i, 202) * 22;
      const t = (((hash(i, 203) + phase * (1 + (i % 2))) % 1) + 1) % 1;
      const p3: V3 = [g[0] + Math.cos(th) * rr + Math.sin(t * 6 + i) * 3, 8 + t * 100, g[2] + Math.sin(th) * rr];
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * t) * 0.95;
      const col = mixc(ember[0] as RGB, ember[1] as RGB, t);
      const behind = x.behind(p3);
      c.glow(p[0], p[1], col, a, behind);
      if (i % 3 === 0) c.glow(p[0], p[1] + 1, ember[1] as RGB, a * 0.6, behind);
    }
  };
}

/** A cleared scratch buffer of a size, kept between frames (`burn` clears what it used). */
const BUFFERS = new Map<number, Uint8Array>();
function buffer(n: number): Uint8Array {
  let b = BUFFERS.get(n);
  if (!b) {
    b = new Uint8Array(n);
    BUFFERS.set(n, b);
  }
  return b;
}

// ── Slashes ──────────────────────────────────────────────────────────────────────────────────

/** The Warden's own fire ramp (his fire.ts), hottest first: the column the beast becomes and leaves is painted in it, so the two sprites match where the game swaps them. */
const W_HOT: RGB = [255, 251, 232];
const W_GOLD: RGB = [255, 224, 138];
const W_FLAME: RGB = [255, 180, 60];
const W_ORANGE: RGB = [255, 126, 38];
const W_RED: RGB = [214, 66, 22];

/** The Warden's fire ramp at `t` (0 its white-hot root, 1 its deep-red tip). */
const rampAt = (t: number): RGB => (t < 0.18 ? W_HOT : t < 0.4 ? W_GOLD : t < 0.66 ? W_FLAME : t < 0.86 ? W_ORANGE : W_RED);

const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [255, 228, 120];
const ORANGE: RGB = [255, 140, 34];
const RED: RGB = [216, 64, 26];
/** The shock of a blow on the floor rings pale violet, as the Warden's explosions do. */
const VIOLET_PALE: RGB = [222, 214, 255];
const VIOLET: RGB = [164, 146, 238];

/** A slash's ramp, from its white-hot leading edge back to the dark embers of its trailing edge. */
const SLASH_RAMP: readonly RGB[] = [W_HOT, W_GOLD, W_FLAME, W_ORANGE, W_RED, [150, 38, 14], [92, 22, 10]];
/** How deep each band of the ramp is, as a share of the slash's depth (the last two dithered out). */
const SLASH_BANDS = [0.09, 0.14, 0.2, 0.2, 0.15, 0.12, 0.1];

/** A 4x4 ordered dither threshold in [0, 1): a pixel shows where its strength is over it. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const dither = (px: number, py: number): number => BAYER[(py & 3) * 4 + (px & 3)] as number;

/**
 * A slash of fire: a great crescent swept round a centre (the striking shoulder, hero space)
 * through the points the claws passed (`tips`, from where the swing began to where the claws are
 * now), its leading edge `over` beyond them. It tapers to a point at both ends, its head at the
 * claws and its body thickest just behind them (`thick` deep there): a white-hot leading edge, then
 * gold, flame and orange, and a ragged trailing edge licking back into flame that cools through red
 * and dark embers to nothing, dithered out rather than blended. Toward its tail it cools and thins
 * the same way. `k` its strength. Seen edge on, it is opened up on screen round the centre at full
 * reach, the way the swing turns, as the engine's swooshes are; the parts of it behind the figure go
 * under it (only what sticks out shows), and it never covers the head (`skip`). Sparks fly off its head.
 */
export function slash(x: FxContext, centre: V3, tips: readonly V3[], o: { k: number; thick: number; over?: number; seed?: number; skip?: (px: number, py: number) => boolean }): void {
  const { c, proj, cam } = x;
  if (o.k <= 0 || tips.length < 2) return;
  const over = o.over ?? 1.3;
  const n = 24;
  // Round the centre from tip to tip, in hero space.
  const offs = tips.map((t) => sub3(t, centre));
  const way: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * (offs.length - 1);
    const j = Math.min(offs.length - 2, Math.floor(f));
    const t = f - j;
    const a = offs[j] as V3;
    const b = offs[j + 1] as V3;
    const na = norm3(a);
    const nb = norm3(b);
    const om = Math.acos(clamp(dot3(na, nb), -1, 1));
    const d = om < 1e-3 ? na : norm3(add3(mul3(na, Math.sin((1 - t) * om) / Math.sin(om)), nb, Math.sin(t * om) / Math.sin(om)));
    way.push(mul3(d, lerp(Math.hypot(...a), Math.hypot(...b), t)));
  }
  const C = proj(centre);
  const first = way[0] as V3;
  const last = way[n] as V3;
  const at3d = way.map((d) => add3(centre, d, over));
  let P = at3d.map((p) => proj([p[0], Math.max(0.5, p[1]), p[2]]));
  // Seen edge on (on screen it is hardly a curve at all): open it up round the centre, as the
  // engine does a blade's swing, round the outside of the body where it would cross it.
  const A0 = P[0] as Vec;
  const B0 = P[n] as Vec;
  const chord = Math.hypot(B0[0] - A0[0], B0[1] - A0[1]);
  let bulge = 0;
  let path = 0;
  P.forEach((p, i) => {
    bulge = Math.max(bulge, Math.abs((p[0] - A0[0]) * (B0[1] - A0[1]) - (p[1] - A0[1]) * (B0[0] - A0[0])) / (chord || 1));
    if (i) path += Math.hypot(p[0] - (P[i - 1] as Vec)[0], p[1] - (P[i - 1] as Vec)[1]);
  });
  // Nearly straight on screen, or folding back on itself (swung toward or away from the viewer).
  if (bulge < Math.max(6, chord * 0.3) || path > chord * 1.8 + 6) {
    const seen = way.map((d) => cam.vec(d));
    const rs = seen.map((v) => Math.hypot(v[0], v[1]));
    const rMax = Math.max(...rs);
    const S = seen[0] as Vec;
    const E = seen[n] as Vec;
    const aS = Math.atan2(S[1], S[0]);
    let sweep = Math.atan2(Math.sin(Math.atan2(E[1], E[0]) - aS), Math.cos(Math.atan2(E[1], E[0]) - aS));
    const other = sweep - Math.sign(sweep || 1) * Math.PI * 2;
    const body = proj(x.rig.chest.o);
    const R = rMax * over;
    // Round the outside of the body: the way whose middle lies farther from the chest on screen.
    const out = (sw: number): number => Math.abs(C[0] + Math.cos(aS + sw / 2) * R - body[0]);
    let turned = 0;
    for (let i = 1; i <= n; i++) {
      const a = seen[i - 1] as Vec;
      const b = seen[i] as Vec;
      turned += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    }
    if (Math.min(...rs) > rMax * 0.35 && Math.abs(turned) > 0.6) {
      // It turns round the centre on screen: follow it.
      if (Math.sign(turned) !== Math.sign(sweep)) sweep = other;
    } else if (out(other) > out(sweep) && Math.abs(other) < Math.PI * 1.3) sweep = other;
    // Never less than a third of a turn, so it reads as a sweep (round the outside when it barely turns).
    if (Math.abs(sweep) < 2.1) sweep = Math.abs(sweep) > 0.6 ? Math.sign(sweep) * 2.1 : out(2.1) >= out(-2.1) ? 2.1 : -2.1;
    const rS = rs[0] as number;
    const rE = rs[n] as number;
    P = way.map((_, i) => {
      const t = i / n;
      const a = aS + sweep * t;
      const r = Math.max(lerp(rS, rE, t), rMax * (0.8 + 0.2 * Math.sin(Math.PI * t))) * over;
      return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r];
    });
  }
  // Which parts lie behind the figure: those go under it.
  const deep = at3d.map((p, i) => x.behind(lerp3(add3(centre, first, over), add3(centre, last, over), i / n)) && x.behind(p));
  // Its inner edge: toward the centre (or across the chord where it is opened up).
  const A = P[0] as Vec;
  const B = P[n] as Vec;
  const mid = P[n >> 1] as Vec;
  const inward = (i: number): Vec => {
    const p = P[i] as Vec;
    const a = P[Math.max(0, i - 1)] as Vec;
    const b = P[Math.min(n, i + 1)] as Vec;
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / tl;
    let ny = (b[0] - a[0]) / tl;
    const tx = (A[0] + B[0]) / 2 - mid[0] || C[0] - p[0];
    const ty = (A[1] + B[1]) / 2 - mid[1] || C[1] - p[1];
    if (nx * tx + ny * ty < 0) {
      nx = -nx;
      ny = -ny;
    }
    return [nx, ny];
  };
  const inn = P.map((_, i) => inward(i));
  const seed = o.seed ?? 0;
  // Thickest just behind its head, tapering to a point at both ends; its trailing edge ragged with
  // tongues of flame leaning back toward its tail.
  const depthAt = (i: number): number => {
    const t = i / n;
    const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 2.1)), 0.7);
    const lick = 0.82 + 0.38 * ((i + seed) % 3) / 2 + 0.12 * hash(i, 91 + seed);
    return o.thick * body * (i > 0 && i < n ? lick : 1);
  };
  for (let i = 0; i < n; i++) {
    const t1 = (i + 1) / n;
    // Toward its tail it cools (its hot bands give way to the cooler ones) and dithers out.
    const cool = Math.pow(clamp((0.6 - t1) / 0.6, 0, 1), 1.2) * 3;
    const presence = clamp(o.k * (0.25 + 1.6 * t1), 0, 1);
    const pa = P[i] as Vec;
    const pb = P[i + 1] as Vec;
    const na = inn[i] as Vec;
    const nb = inn[i + 1] as Vec;
    const da = depthAt(i);
    const db = depthAt(i + 1);
    const under = deep[i] as boolean;
    let f0 = 0;
    SLASH_BANDS.forEach((bw, band) => {
      const f1 = f0 + bw;
      const quad: Vec[] = [
        [pa[0] + na[0] * da * f0, pa[1] + na[1] * da * f0],
        [pb[0] + nb[0] * db * f0, pb[1] + nb[1] * db * f0],
        [pb[0] + nb[0] * db * f1, pb[1] + nb[1] * db * f1],
        [pa[0] + na[0] * da * f1, pa[1] + na[1] * da * f1],
      ];
      f0 = f1;
      const step = band + cool;
      if (step >= SLASH_RAMP.length) return;
      const col = SLASH_RAMP[Math.min(SLASH_RAMP.length - 1, Math.round(step))] as RGB;
      // The trailing embers and the cooling tail dither out; the rest is solid.
      const solid = band < 5 ? presence : presence * (band === 5 ? 0.6 : 0.3);
      scanPoly(quad, c.w, c.h, (px, py) => {
        if (solid < 1 && dither(px, py) > solid) return;
        if (!o.skip?.(px, py)) c.glow(px, py, col, 1, under);
      });
    });
  }
  // Sparks thrown off its head, ahead of the claws.
  const head = P[n] as Vec;
  const hn = inn[n] as Vec;
  const under = deep[n] as boolean;
  for (let i = 0; i < 9; i++) {
    const d = 3 + hash(i, 97 + seed) * 14;
    const th = (hash(i, 98 + seed) - 0.5) * 2.6;
    const dx = -hn[0] * Math.cos(th) - hn[1] * Math.sin(th);
    const dy = -hn[1] * Math.cos(th) + hn[0] * Math.sin(th);
    const px = head[0] + dx * d;
    const py = head[1] + dy * d + d * d * 0.02;
    if (o.skip?.(Math.floor(px), Math.floor(py))) continue;
    c.glow(px, py, i % 3 ? W_GOLD : W_HOT, o.k * 0.95, under);
    c.glow(px - dx, py - dy, W_ORANGE, o.k * 0.8, under);
  }
}

// ── Cracks ───────────────────────────────────────────────────────────────────────────────────

/**
 * Glowing cracks down the limbs: a jagged seam of magma down the side of each upper arm, forearm
 * and thigh that faces the viewer, forking once, each sorted just over its own limb (as the
 * painter sorts the limb), so whatever passes in front of the limb hides it too.
 */
export function cracks(spec: { seam: Mat; arms: readonly [number, number]; thigh: number }): Piece {
  return (ctx) => {
    const { rig, depth } = ctx;
    const torsoTrue = depth(at3(rig.chest, 0, 14, 0));
    const farSide = (p: V3): boolean => depth(p) < torsoTrue - 2;
    const items: DrawItem[] = [];
    for (const [arm, s] of [[rig.armR, 1], [rig.armL, -1]] as const) {
      const far = farSide(arm.mid) && farSide(arm.end);
      const z = depth(lerp3(arm.mid, arm.end, 0.4)) * 0.6 + depth(arm.root) * 0.4 + (far ? 0 : ctx.upper) + 0.02;
      items.push({ z, draw: () => crackLimb(ctx, spec.seam, [[arm.root, arm.mid, spec.arms[0]], [arm.mid, arm.end, spec.arms[1]]], 3 + s) });
    }
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, -1]] as const) {
      const z = depth(leg.mid) * 0.7 + depth(leg.root) * 0.3 + 0.005;
      items.push({ z, draw: () => crackLimb(ctx, spec.seam, [[leg.root, leg.mid, spec.thigh]], 11 + s) });
    }
    return items;
  };
}

function crackLimb(ctx: PieceContext, seam: Mat, bones: readonly (readonly [V3, V3, number])[], seed: number): void {
  const { proj, cam } = ctx;
  const view = norm3(cam.local(TO_CAMERA));
  const part = ctx.part();
  bones.forEach(([a, b, r], k) => {
    const axis = norm3(sub3(b, a));
    // The side of the limb toward the viewer, and across it.
    let out = sub3(view, mul3(axis, dot3(view, axis)));
    if (Math.hypot(...out) < 0.2) return;
    out = norm3(out);
    const across = norm3(cross3(axis, out));
    const pts: Vec[] = [];
    for (let i = 0; i <= 5; i++) {
      const t = 0.18 + (i / 5) * 0.64;
      const zig = (i % 2 ? 1 : -1) * 0.32 + (hash(i, seed + k * 7) - 0.5) * 0.3;
      pts.push(proj(add3(add3(lerp3(a, b, t), out, r * 0.7), across, r * zig)));
    }
    for (let i = 0; i < pts.length - 1; i++) part.line(pts[i] as Vec, pts[i + 1] as Vec, seam, 0, 100, 1, true);
    // A fork off its middle.
    const m = pts[2] as Vec;
    const f = proj(add3(add3(lerp3(a, b, 0.62), out, r * 0.6), across, -r * 0.55 * Math.sign(hash(seed, k) - 0.5 || 1)));
    part.line(m, f, seam, 0, 100, 1, true);
  });
  part.commit();
}

// ── Horns and brow ───────────────────────────────────────────────────────────────────────────

/**
 * Heavy brow ridges over the eyes and two horns rising from the temples, out and up through the
 * mane, their points standing clear of it in every view: obsidian, a crack of magma up each horn,
 * painted with the head (in its depth test) as gear over the hair (ids from GEAR_ID, so the drawn
 * brows do not show through them). The horns run through `path` (head space, the right one; the
 * left mirrors it), `r` thick at the root and the tip.
 */
export function horns(spec: { path: readonly V3[]; r: readonly [number, number]; mat: Mat; seam: Mat; brow: { c: V3; r: V3 } }): HeadPiece {
  return {
    blobs: (_ctx, head) => [
      {
        frame: head,
        blobs: [
          { c: spec.brow.c, r: spec.brow.r, id: 510 },
          { c: [spec.brow.c[0], spec.brow.c[1], -spec.brow.c[2]], r: spec.brow.r, id: 511 },
        ],
        shade: (h) => (h.back ? null : { m: spec.mat }),
      },
    ],
    paint: (ctx, part, head) => {
      const { proj, depth } = ctx;
      const n = spec.path.length - 1;
      for (const side of [1, -1]) {
        const pts = spec.path.map((p) => at3(head, p[0], p[1], p[2] * side));
        for (let i = 0; i < n; i++) {
          const a = pts[i] as V3;
          const b = pts[i + 1] as V3;
          part.capsule(proj(a), proj(b), lerp(spec.r[0], spec.r[1], i / n), lerp(spec.r[0], spec.r[1], (i + 1) / n), spec.mat, 0.1, depth(a), depth(b), 520 + (side > 0 ? 0 : 1));
        }
        // A crack of magma up its middle, short of the tip.
        for (let i = 0; i < n - 1; i++) {
          const a = proj(pts[i] as V3);
          const b = proj(pts[i + 1] as V3);
          const m = depth(lerp3(pts[i] as V3, pts[i + 1] as V3, 0.5));
          part.line([a[0], a[1] - 0.5], [b[0], b[1] - 0.5], spec.seam, 0, m + 2.6, 520 + (side > 0 ? 0 : 1), false);
        }
      }
    },
  };
}

// ── Pillars and bursts of flame ──────────────────────────────────────────────────────────────

/** One tongue of flame on the effects layer: a filled outline from its base along `dir` (screen), `w` wide, in nested bands (red, orange, gold, white at its heart), `a` its strength. */
export function glowTongue(x: FxContext, base: Vec, dir: Vec, len: number, w: number, sway: number, a: number, skip?: (px: number, py: number) => boolean, under = false): void {
  const { c } = x;
  if (len < 2 || a <= 0) return;
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  const d: Vec = [dir[0] / dl, dir[1] / dl];
  const m: Vec = [-d[1], d[0]];
  const n = 8;
  for (const [k, col, alpha] of [[1, RED, 0.85], [0.68, ORANGE, 0.95], [0.36, GOLD, 1], [0.14, WHITE, 1]] as const) {
    const left: Vec[] = [];
    const right: Vec[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const half = w * k * (t < 0.25 ? 0.7 + 1.2 * t : Math.pow((1 - t) / 0.75, 0.9));
      const bend = sway * len * 0.25 * t * t;
      const L = len * (0.35 + 0.65 * k) * t;
      const p: Vec = [base[0] + d[0] * L + m[0] * bend, base[1] + d[1] * L + m[1] * bend];
      left.push([p[0] + m[0] * half, p[1] + m[1] * half]);
      right.push([p[0] - m[0] * half, p[1] - m[1] * half]);
    }
    scanPoly([...left, ...right.reverse()], c.w, c.h, (px, py) => {
      if (!skip?.(px, py)) c.glow(px, py, col, a * alpha, under);
    });
  }
}

/**
 * A thin flickering tongue of flame standing up from (x, y) on the screen, `h` tall and `w` wide at
 * its root, its tip swaying `sway` (as the Warden's own tongues do): white-hot at its root, through
 * gold and orange to red at its tip.
 */
export function lick(c: Canvas, x: number, y: number, h: number, w: number, sway: number, a: number, under = false): void {
  const n = Math.max(1, Math.round(h));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const half = w * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 2 + 0.3)));
    const cx = x + sway * t * t * h * 0.35;
    for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
      const edge = Math.abs(dx) / Math.max(0.5, half);
      if (edge > 1) continue;
      c.glow(cx + dx, y - i, rampAt(Math.min(1, t * 0.85 + edge * 0.35)), a * (1 - t * 0.3), under);
    }
  }
}

/**
 * The column of fire in each view, in the beast's frame pixels: its height above the floor, its
 * half-width and how far its middle stands from the anchor. As tall and as wide in tiles as the
 * column the Warden's `ult` ends on (about 3.6 tiles by 1.5; a little lower seen from behind, as
 * his is), so the game can swap one sprite for the other without a jump.
 */
const COLUMN: Record<'side' | 'front' | 'back', { h: number; half: number; dx: number }> = {
  side: { h: 138, half: 29, dx: -3.5 },
  front: { h: 141, half: 27.5, dx: -0.5 },
  back: { h: 122, half: 27.5, dx: -0.5 },
};

/**
 * The column of fire it emerges from and collapses back into, standing on the anchor: `k` from 0
 * (flames rising off a ring on the floor round its feet) through the fire climbing its body (its
 * dark shape showing between separate tongues, a column rising behind it) to 1, a tall rounded
 * column with a domed top, a narrow white-hot heart, gold streaked with flame, a red-orange crown
 * and flickering tongues licking off its top and sides, that hides all of it (the Warden's last
 * `ult` frame, in his colours, so the swap does not show). Between 0.75 and 1 the parts of the
 * beast outside the column burn away. `open` (0 to 1) bursts it: it no longer covers the beast,
 * its tongues are flung outward round its silhouette and the column breaks into streaks.
 * `seed` reshapes its flicker: advance it every frame.
 */
export function column(x: FxContext, k: number, o: { open?: number; seed?: number } = {}): void {
  if (k <= 0) return;
  const { c, hash, cam } = x;
  const spec = COLUMN[cam.view];
  const seed = o.seed ?? 0;
  const open = clamp(o.open ?? 0, 0, 1);
  const cx = cam.ax + spec.dx;
  const bottom = cam.ay + 1;
  // How far the beast is lost in it: from 0.75 its outlying parts burn away, at 1 it is gone.
  const engulf = open > 0 ? 0 : clamp((k - 0.75) / 0.25, 0, 1);
  const w = c.w;
  if (engulf >= 1) {
    c.data.fill(0);
    c.fx.fill(0);
    c.under.fill(0);
  }
  const half = spec.half * (1 + open * 0.35);
  const line = bottom - spec.h * Math.min(1, k) - open * 6;
  const dome = Math.max(8, Math.min(30, spec.h * k * 0.6));
  const width = (y: number): number => {
    const top = clamp((y - line) / dome, 0, 1);
    const flick = 0.9 + 0.08 * Math.sin(y * 0.21 + seed * 2.1) + 0.06 * Math.sin(y * 0.53 - seed * 1.3);
    return half * flick * (0.12 + 0.88 * Math.sqrt(top));
  };
  // Each column of two pixels is a tongue of its own streaming up, its tip a flickering way under
  // the top: red at the tip, orange, then flame and gold, white only in the narrow heart.
  const grown = clamp((k - 0.45) / 0.5, 0, 1);
  const tipOf = (lane: number): number => line + hash(lane + 300, Math.floor(seed) * 7 + 3) * (8 + 14 * (1.3 - Math.min(1, k))) + (k < 0.6 ? 6 : 0);
  const figure = (px: number, y: number): boolean => (c.data[(y * w + px) * 4 + 3] as number) > 0;
  const ink = (px: number, y: number): boolean => {
    const i = (y * w + px) * 4;
    return (c.data[i] as number) < 40 && (c.data[i + 1] as number) < 32 && (c.data[i + 2] as number) < 40;
  };
  // The parts of the beast outside the column burn away as it closes.
  if (engulf > 0 && engulf < 1) {
    for (let y = 0; y < c.h; y++) {
      const hw = y >= line ? width(y) : 0;
      for (let px = 0; px < w; px++) {
        if (!figure(px, y) || Math.abs(px + 0.5 - cx) < hw - 1) continue;
        c.glow(px, y, hash(px, y * 5 + Math.floor(seed)) < 0.5 ? W_ORANGE : W_RED, 0.35 + engulf * 0.6);
      }
    }
  }
  for (let y = Math.max(0, Math.floor(line)); y <= Math.min(c.h - 1, Math.ceil(bottom) - 1); y++) {
    const hw = width(y) * (0.75 + 0.25 * grown);
    for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
      const px = Math.round(cx + dx);
      if (px < 0 || px >= w) continue;
      const lane = Math.floor((px + 400) / 2);
      const tip = tipOf(lane);
      if (y < tip) continue;
      const r = Math.abs(dx + 0.5) / hw;
      if (r > 1) continue;
      const into = clamp((y - tip) / (10 + 26 * grown), 0, 1);
      const core = r < 0.13 + 0.05 * Math.sin(y * 0.3 + seed) && into > 0.7 && k > 0.85;
      let col: RGB = core ? W_HOT : into < 0.15 ? W_RED : into < 0.4 ? W_ORANGE : into < 0.72 || r > 0.7 ? W_FLAME : W_GOLD;
      // Some tongues burn lower than others, so it is streaked as it streams.
      const streak = hash(lane, Math.floor(seed) * 3 + 11);
      if (!core && streak < 0.4 && col === W_GOLD) col = W_FLAME;
      if (open > 0) {
        // Bursting: the beast stands clear, the column round it breaks into streaks.
        if (figure(px, y) || streak < open * 0.55) continue;
        c.glow(px, y, col, 0.95 - open * 0.2, true);
      } else if (engulf >= 1) {
        c.glow(px, y, col, 1);
      } else if (figure(px, y)) {
        // Over it: separate tongues at first (its dark shape between them), thickening to solid
        // flame as the fire takes it.
        const burnt = Math.max(engulf, clamp((k - 0.5) * 1.6, 0, 1) * clamp((y - line) / 30, 0, 1));
        if (streak < 0.55 - burnt * 0.6) continue;
        if (ink(px, y) && burnt < 0.7) continue;
        if (burnt < 0.8 && (col === W_GOLD || col === W_HOT)) col = W_FLAME;
        c.glow(px, y, col, clamp(0.6 + burnt * 0.4, 0, 1));
      } else {
        // Behind it, the column rises once the fire has climbed past its waist.
        if (grown <= 0 || streak < 0.35 - grown * 0.35) continue;
        c.glow(px, y, col, clamp(0.75 + into * 0.25, 0, 1) * Math.min(1, grown * 2), true);
      }
    }
  }
  const under = open > 0;
  // Tongues licking up off its rounded top and its sides (flung outward as it bursts).
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11;
    const dx = (t - 0.5) * 2 * half * 0.85;
    let by = line;
    while (by < bottom && width(by) < Math.abs(dx) + 1) by++;
    const h = (8 + hash(i, 183 + seed) * 14) * (1.1 - Math.abs(t - 0.5)) * Math.min(1, k * 1.5) * (1 + open * 0.6);
    lick(c, cx + dx, by + 3, h, 2 + hash(i, 184) * 1.8, (t - 0.5) * (1.2 + open * 3) + (hash(i, 185 + seed) - 0.5), 0.95, under);
  }
  for (let i = 0; i < 10 + Math.round(open * 8); i++) {
    const side = i % 2 ? 1 : -1;
    const yy = lerp(line + 26, bottom - 4, hash(i, 188 + seed));
    if (yy > bottom - 4) continue;
    lick(c, cx + side * (width(yy) - 1), yy, (5 + hash(i, 189 + seed) * 8) * (1 + open * 1.4), 1.6 + open, side * (0.8 + open * 2.5), 0.9, under);
  }
  // The ring of fire on the floor round it, and flames standing up off it (those behind it under the figure).
  const R = spec.half + 3;
  const g: V3 = [0, 0, 0];
  for (let i = 0; i < 72; i++) {
    const th = (i / 72) * Math.PI * 2;
    const p3: V3 = [g[0] + Math.cos(th) * R, 0, g[2] + Math.sin(th) * R];
    const p = x.proj(p3);
    const behind = engulf < 1 && x.behind(p3);
    c.glow(p[0] + spec.dx, p[1], i % 2 ? W_ORANGE : W_GOLD, 0.9, behind);
    c.glow(p[0] + spec.dx, p[1] - 1, W_RED, 0.5, behind);
  }
  for (let i = 0; i < 16; i++) {
    const th = (i / 16) * Math.PI * 2 + hash(i, 190 + seed) * 0.3;
    const p3: V3 = [Math.cos(th) * R, 0, Math.sin(th) * R];
    const p = x.proj(p3);
    lick(c, p[0] + spec.dx, p[1], (4 + hash(i, 186 + seed) * 8) * Math.min(1, k * 2.5), 1.5, hash(i, 187 + seed) - 0.5, 0.9, engulf < 1 && x.behind(p3));
  }
  // Embers flying up round it.
  for (let i = 0; i < 14; i++) {
    const t = hash(i, 191 + Math.floor(seed));
    const px = cx + (hash(i, 192 + Math.floor(seed)) - 0.5) * (half * 2 + 24);
    const py = bottom - 10 - t * spec.h * Math.min(1, k) * 1.05;
    c.glow(px, py, i % 3 ? W_GOLD : W_HOT, 0.9);
    c.glow(px, py + 1, W_ORANGE, 0.6);
  }
}

/**
 * A ring of fire round its feet on the floor, seen in perspective: tongues standing up round an
 * ellipse, taller at its back than its front and shorter toward its ends, their roots on the floor;
 * the far half behind the figure. `k` 0 to 1 its strength: low, a few small tongues and embers.
 */
export function ringOfFire(x: FxContext, k: number, o: { radius?: number; height?: number; seed?: number } = {}): void {
  if (k <= 0) return;
  const { c, hash, rig, cam } = x;
  const R = o.radius ?? 20;
  const H = (o.height ?? 26) * Math.min(1.2, k);
  const seed = o.seed ?? 0;
  const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
  const n = Math.round(10 + 14 * Math.min(1, k));
  // The far ones first, so the near ones stand over them.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => Math.sin((a / n) * Math.PI * 2 + cam.yaw) - Math.sin((b / n) * Math.PI * 2 + cam.yaw));
  for (const i of order) {
    const th = (i / n) * Math.PI * 2 + hash(i, 441 + seed) * 0.25;
    const p3: V3 = [g[0] + Math.cos(th) * R, 0, g[2] + Math.sin(th) * R];
    const p = x.proj(p3);
    // How near the viewer it stands: -1 at the back of the ring, 1 at the front.
    const near = Math.sin(th + cam.yaw);
    // Shorter toward the ends of the ellipse (seen from the side), taller at the back.
    const ends = Math.abs(Math.cos(th + cam.yaw));
    const h = H * (0.55 + 0.45 * hash(i, 442 + seed)) * (1 - near * 0.3) * (1 - ends * 0.35);
    if (h < 2.5) continue;
    lick(c, p[0], p[1], h, 1.6 + 1.6 * Math.min(1, k), (hash(i, 443 + seed) - 0.5) * 1.4, 0.95, x.behind(p3));
  }
  // Embers flying up off it.
  for (let i = 0; i < 8; i++) {
    const th = hash(i, 444 + seed) * Math.PI * 2;
    const p = x.proj([g[0] + Math.cos(th) * R, 4 + hash(i, 445 + seed) * H * 1.4, g[2] + Math.sin(th) * R]);
    c.glow(p[0], p[1], i % 2 ? W_GOLD : W_FLAME, 0.9 * Math.min(1, k * 1.5));
  }
}

/**
 * A burst of flame from a point (hero space): `n` tongues flung out round it on screen, `k`
 * from 0 (just bursting) to 1 (flung out to `len` and fading), the hot heart of it fading first.
 * A burst behind the figure (seen from behind, ahead of it) goes under it, so only the tongues
 * flung out past its silhouette show. `ring` adds the Warden's pale violet shock ring round it on
 * the floor, rolling out with `k`.
 */
export function flare(x: FxContext, at: V3, k: number, o: { n?: number; len?: number; spin?: number; ring?: number; skip?: (px: number, py: number) => boolean } = {}): void {
  if (k <= 0 || k >= 1) return;
  const { c, proj, hash } = x;
  const P = proj(at);
  const under = x.behind(at);
  const n = o.n ?? 12;
  const L = (o.len ?? 40) * (0.35 + 0.65 * Math.sqrt(k));
  const a = 1 - Math.pow(k, 2.2);
  if (o.ring) {
    // The shock ring: pale violet, its front over the figure and its back under it.
    const R = (10 + 40 * Math.sqrt(k)) * o.ring;
    const m = Math.ceil(R * 7);
    for (let i = 0; i < m; i++) {
      const th = (i / m) * Math.PI * 2;
      const p3: V3 = [at[0] + Math.cos(th) * R, 0, at[2] + Math.sin(th) * R];
      const p = proj(p3);
      const back = x.behind(p3);
      c.glow(p[0], p[1], VIOLET_PALE, 0.95 * a, back);
      c.glow(p[0], p[1] + 1, VIOLET, 0.7 * a, back);
      c.glow(p[0], p[1] - 1, VIOLET, 0.4 * a, back);
    }
  }
  for (let i = 0; i < n; i++) {
    const th = rad(o.spin ?? 0) + (i / n) * Math.PI * 2 + (hash(i, 411) - 0.5) * 0.4;
    const d: Vec = [Math.cos(th), Math.sin(th) * 0.8 - 0.25];
    const r0 = 6 + 10 * k;
    glowTongue(x, [P[0] + d[0] * r0, P[1] + d[1] * r0], d, L * (0.6 + 0.4 * hash(i, 412)) * (i % 2 ? 0.7 : 1), 4 + 3 * (1 - k), Math.sin(i * 2.3) * 0.5, a, o.skip, under);
  }
  // The white-hot heart.
  const R = 10 * (1 - k);
  for (let dy = -Math.ceil(R); dy <= Math.ceil(R); dy++) {
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      const r = Math.hypot(dx, dy);
      if (r > R || o.skip?.(Math.floor(P[0] + dx), Math.floor(P[1] + dy))) continue;
      c.glow(P[0] + dx, P[1] + dy, r < R * 0.5 ? WHITE : GOLD, a * (r < R * 0.5 ? 0.9 : 0.6), under);
    }
  }
}

/** Smoke rising off the beast as its fire dies (a KO): grey puffs drifting up from it, `k` their strength, looping with the phase. */
export function smoke(x: FxContext, k: number): void {
  if (k <= 0) return;
  const { c, rig, proj, hash } = x;
  const g = rig.pelvis.o;
  const ph = rig.pose.phase ?? 0;
  for (let i = 0; i < 10; i++) {
    const t = (((hash(i, 421) + ph) % 1) + 1) % 1;
    const p = proj([g[0] + (hash(i, 422) - 0.5) * 40, g[1] + 4 + t * 46, (hash(i, 423) - 0.5) * 16]);
    const r = 2.5 + t * 5;
    const a = k * 0.4 * Math.sin(Math.PI * t);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        c.glow(p[0] + dx + Math.sin(t * 6 + i) * 2, p[1] + dy, i % 2 ? [92, 84, 90] : [128, 118, 120], a);
      }
    }
  }
}
