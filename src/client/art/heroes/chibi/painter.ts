/**
 * The chibi painter: solves a pose, then paints a design's legs, torso, head, arms, hands, weapon
 * and outfit pieces far to near through the view's camera, outlines the figure in ink and lays the
 * pose's effects over it. Everything a hero looks like comes from its design; everything it does
 * comes from its poses.
 *
 * Depth order: each part sorts by its depth toward the viewer. The legs and the cloth that hangs
 * among them sort by their true depths; the torso always goes on after the legs (its hips cover
 * the tops of the thighs), and everything above it (arms, head, pauldrons, the weapon) is moved by
 * the same amount, so the upper body keeps its own order. An arm wholly on the far side keeps its
 * true depth, so it stays behind the cloth hanging on the near side.
 */
import { Canvas, INK, type Raster } from '../paint.js';
import type { ChibiClip, ChibiHero, ClipTiming, FrameBox } from './index.js';
import type { Vec } from '../skeleton.js';
import { type ChibiDesign, type DrawItem, type PieceContext, WEAPON_TAG } from './design.js';
import { paintFx } from './fx.js';
import { paintHead } from './head.js';
import { dim, Part } from './raster.js';
import { add3, at3, camera, type ChibiPose, type ChibiView, type Limb, lerp3, norm3, rotate, SIDE_LOOK, solveRig, sub3, type V3 } from './rig.js';

export interface Box {
  w: number;
  h: number;
  ax: number;
  ay: number;
}

const FAR = -0.16;

/** Paints one frame of a chibi hero in a pose, seen from a view. */
export function paintChibi(d: ChibiDesign, pose: ChibiPose, view: ChibiView, box: Box): Raster {
  const c = new Canvas(box.w, box.h);
  const rig = solveRig(d.build, pose, d.weapon.grip2);
  const cam = camera(view, pose.turn ?? 0, box.ax, box.ay);
  const owner = new Int16Array(box.w * box.h);
  const ctx: PieceContext = {
    c,
    rig,
    cam,
    pose,
    build: d.build,
    owner,
    part: (tag = 0) => new Part(c, cam, { buf: owner, id: tag }),
    proj: cam.proj,
    depth: cam.depth,
    upper: 0,
  };
  const { proj, depth } = ctx;
  const B = d.body;

  // ── Depth order ──
  const legZ = (leg: Limb): number => depth(leg.mid) * 0.7 + depth(leg.root) * 0.3;
  const zR = legZ(rig.legR);
  const zL = legZ(rig.legL);
  const chestC = at3(rig.chest, 0, 14, 0);
  const torsoTrue = depth(chestC);
  const torsoZ = Math.max(torsoTrue, Math.max(zR, zL) + 0.1);
  ctx.upper = torsoZ - torsoTrue;
  const up = ctx.upper;
  const farSide = (p: V3): boolean => depth(p) < torsoTrue - 2;

  const items: DrawItem[] = [];

  // Legs.
  for (const [leg, toe, z] of [[rig.legR, rig.toeR, zR], [rig.legL, rig.toeL, zL]] as const) {
    items.push({ z, draw: () => paintLeg(ctx, d, leg, toe, farSide(leg.mid)) });
  }

  // Torso.
  items.push({
    z: torsoZ,
    draw: () => {
      const part = ctx.part();
      part.blobs(rig.pelvis, B.hips, (h) => {
        const m = B.torso(h, 'hips');
        return m ? { m } : null;
      });
      part.blobs(rig.chest, B.chest, (h) => {
        const m = B.torso(h, 'chest');
        return m ? { m } : null;
      });
      part.commit();
    },
  });

  // Head (with the collar and the neck, in one depth-tested part).
  // Side on, the head turns a little further toward the viewer, but not while he spins (it would
  // turn ahead of the body): the cheat fades out as the body turns away from its side-on yaw.
  let headFr = rig.head;
  const turn = Math.abs(((((pose.turn ?? 0) + 180) % 360) + 360) % 360 - 180);
  if (view === 'side') headFr = rotate(headFr, 0, 0, SIDE_LOOK * Math.max(0, 1 - turn / 45));
  const headZ = torsoZ + 1;
  items.push({
    z: headZ,
    draw: () =>
      paintHead(ctx, d.head, headFr, d.headPieces, (part) => {
        const a = rig.neck;
        const b = add3(rig.neck, rig.chest.u, d.build.neck + 2);
        part.capsule(proj(a), proj(b), B.neck.r, B.neck.r, B.neck.mat, -0.25, depth(a), depth(b), 5);
      }),
  });

  // Arms and hands. A hand on the weapon goes over its grip.
  const w = rig.weapon;
  const wZ = depth(add3(w.o, w.u, d.weapon.reach[1] * 0.3)) + up;
  for (const [arm, side] of [[rig.armR, 1], [rig.armL, -1]] as const) {
    const far = farSide(arm.mid) && farSide(arm.end);
    // An arm on the far side sorts by its true depth, so a coat flap hanging nearer the viewer stays in front of it.
    const zArm = depth(lerp3(arm.mid, arm.end, 0.4)) * 0.6 + depth(arm.root) * 0.4 + (far ? 0 : up);
    items.push({ z: zArm, draw: () => paintArm(ctx, d, arm, far) });
    const holds = side === 1 ? !pose.drop : rig.twoHanded;
    const zHand = holds && farSide(arm.end) === farSide(add3(w.o, w.u, 12)) ? Math.max(zArm, wZ) + 0.05 : zArm + 0.05;
    items.push({ z: zHand, draw: () => paintHand(ctx, d, arm, far) });
  }
  items.push({
    z: wZ,
    draw: () => {
      const part = ctx.part(WEAPON_TAG);
      d.weapon.paint(ctx, part);
      part.commit();
    },
  });

  for (const piece of d.outfit) for (const it of piece(ctx)) items.push(it);

  items.sort((a, b) => a.z - b.z);
  for (const it of items) it.draw();
  c.outline(INK);
  closePinholes(c);
  paintFx(ctx, d, pose.fx ?? {}, torsoTrue + up - 3);
  return c.flatten();
}

/** Fills one-pixel pinholes and notches left between outlined parts with ink, so the silhouette stays clean. */
function closePinholes(c: Canvas): void {
  // Only within the figure's bounds.
  let x0 = c.w;
  let y0 = c.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if ((c.data[(y * c.w + x) * 4 + 3] as number) === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  x0 = Math.max(1, x0);
  y0 = Math.max(1, y0);
  x1 = Math.min(c.w - 2, x1);
  y1 = Math.min(c.h - 2, y1);
  for (let pass = 0; pass < 2; pass++) {
    const fill: number[] = [];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (c.opaque(x, y)) continue;
        const n = (c.opaque(x - 1, y) ? 1 : 0) + (c.opaque(x + 1, y) ? 1 : 0) + (c.opaque(x, y - 1) ? 1 : 0) + (c.opaque(x, y + 1) ? 1 : 0);
        if (n >= 3) fill.push(x, y);
      }
    }
    if (!fill.length) return;
    for (let i = 0; i < fill.length; i += 2) c.setPx(fill[i] as number, fill[i + 1] as number, INK);
  }
}

function paintLeg(ctx: PieceContext, d: ChibiDesign, leg: Limb, toe: V3, far: boolean): void {
  const { proj, depth } = ctx;
  const B = d.body;
  const bias = far ? FAR : 0;
  const part = ctx.part();
  const k = (m: typeof B.thigh.mat) => (far ? dim(m, -0.12) : m);
  const hip = leg.root;
  const knee = leg.mid;
  const ankle = leg.end;
  part.capsule(proj(hip), proj(knee), B.thigh.r0, B.thigh.r1, k(B.thigh.mat), bias, depth(hip), depth(knee), 1);
  part.capsule(proj(knee), proj(ankle), B.shin.r0, B.shin.r1, k(B.shin.mat), bias, depth(knee), depth(ankle), 2);
  // The boot: the lower shin and a big foot.
  const bt = B.boot;
  const top = lerp3(ankle, knee, bt.top);
  part.capsule(proj(top), proj(ankle), bt.r * 0.92, bt.r, k(bt.mat), bias, depth(top), depth(ankle), 3);
  const down: V3 = [0, -1, 0];
  const sole = (p: V3): V3 => add3(p, down, ctx.build.ankle - 3.3);
  const heel = sole(add3(ankle, toe, -bt.heel));
  const tip = sole(add3(ankle, toe, bt.toe));
  // The sole, a dark band under the foot.
  part.capsule(proj(add3(heel, down, 1)), proj(add3(tip, down, 0.9)), 2.3, 2.1, k(bt.sole), bias - 0.3, depth(heel) - 0.2, depth(tip) - 0.2, 4);
  part.capsule(proj(heel), proj(tip), 2.6, 2.4, k(bt.mat), bias, depth(heel) + 0.3, depth(tip) + 0.3, 3);
  if (bt.cap) {
    const capA = add3(lerp3(heel, tip, 0.62), [0, 0.6, 0]);
    part.capsule(proj(capA), proj(add3(tip, [0, 0.3, 0])), 2.2, 2.0, k(bt.cap), bias + 0.1, depth(capA) + 0.6, depth(tip) + 0.8, 6);
  }
  // A knee cop, a little forward of the joint.
  if (B.knee) {
    const fwd = norm3(sub3(lerp3(knee, ankle, 0.5), lerp3(hip, knee, 0.5)));
    const kc = add3(add3(knee, [toe[0], 0, toe[2]], 1.4), fwd, -0.4);
    const p = proj(kc);
    part.ellipse(p[0], p[1], B.knee.r, B.knee.r * 0.95, k(B.knee.mat), bias + 0.05, depth(kc) + 1.5, 7);
  }
  part.commit();
}

function paintArm(ctx: PieceContext, d: ChibiDesign, arm: Limb, far: boolean): void {
  const { proj, depth } = ctx;
  const B = d.body;
  const bias = far ? FAR : 0;
  const k = (m: typeof B.thigh.mat) => (far ? dim(m, -0.12) : m);
  const part = ctx.part();
  part.capsule(proj(arm.root), proj(arm.mid), B.upperArm.r0, B.upperArm.r1, k(B.upperArm.mat), bias, depth(arm.root), depth(arm.mid), 1);
  part.capsule(proj(arm.mid), proj(arm.end), B.foreArm.r0, B.foreArm.r1, k(B.foreArm.mat), bias, depth(arm.mid), depth(arm.end), 2);
  if (B.cuff) {
    const a = lerp3(arm.mid, arm.end, B.cuff.at);
    const b = lerp3(arm.mid, arm.end, Math.min(0.98, B.cuff.at + 0.42));
    part.capsule(proj(a), proj(b), B.cuff.r, B.cuff.r * 0.85, k(B.cuff.mat), bias + 0.05, depth(a) + 0.8, depth(b) + 0.8, 3);
    // A pale band round the cuff's wide end parts it from the arm above it (not when the forearm
    // points at the viewer: the band would show as a pale disc, not a ring).
    const pa = proj(a);
    const pb = proj(b);
    if (B.cuff.rim && Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 3) {
      const e = lerp3(a, b, 0.18);
      part.capsule(proj(a), proj(e), B.cuff.r * 1.02, B.cuff.r * 0.98, k(B.cuff.rim), bias + 0.05, depth(a) + 0.9, depth(e) + 0.9, 4);
    }
  }
  part.commit();
}

function paintHand(ctx: PieceContext, d: ChibiDesign, arm: Limb, far: boolean): void {
  const B = d.body;
  const p = ctx.proj(arm.end);
  const part = ctx.part();
  const m = far ? dim(B.hand.mat, -0.12) : B.hand.mat;
  part.ellipse(p[0], p[1], B.hand.r, B.hand.r * 0.92, m, far ? FAR : 0.05, ctx.depth(arm.end), 1);
  // Knuckle plates catch the light.
  const kn: Vec = [p[0] - 1, p[1] - B.hand.r * 0.45];
  const km = B.hand.knuckle ? (far ? dim(B.hand.knuckle, -0.12) : B.hand.knuckle) : m;
  for (const dx of [-1, 0, 1]) part.plot(kn[0] + dx, kn[1], km, dx ? 0.45 : 0.9, ctx.depth(arm.end) + 3, 1, true);
  part.commit();
}

/**
 * A chibi hero from a design, its poses clip by clip, its timing, its frames and its scale (tiles
 * per pixel). Every clip must have as many poses as its timing has frames.
 */
export function chibiHero(d: ChibiDesign, clips: Record<ChibiClip, readonly ChibiPose[]>, timing: Record<ChibiClip, ClipTiming>, frame: Record<ChibiView, FrameBox>, scale: number): ChibiHero {
  for (const [clip, t] of Object.entries(timing) as [ChibiClip, ClipTiming][]) {
    const n = clips[clip]?.length ?? 0;
    if (n !== t.frames) throw new Error(`${d.id}: ${clip} has ${n} poses for ${t.frames} frames`);
  }
  return {
    id: d.id,
    frame,
    scale,
    timing,
    paint: (clip, i, view) => paintChibi(d, clips[clip][Math.max(0, Math.min(i, clips[clip].length - 1))] as ChibiPose, view, frame[view]),
  };
}
