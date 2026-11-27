/**
 * The Arbalest's own gear, built on the chibi engine's parts: brass goggles worn on his head (up on
 * his forehead, or down over his eyes), a strap with a brass buckle round each of his heavy boots,
 * and the cocking lever on the side of his crossbow that a pose racks to span it again. design.ts
 * puts them on him.
 */
import { GEAR_ID, type HeadPiece, type Piece, type PieceContext, type WeaponDesign } from '../design.js';
import { clipToGround, mainHeld } from '../held.js';
import type { Blob, Hit, Mat, Part } from '../raster.js';
import { add3, at3, clamp, cross3, dirIn, dot3, type Frame3, type Grip, lerp3, norm3, rad, sub3, type V3 } from '../rig.js';

// ── Goggles ──────────────────────────────────────────────────────────────────────────────────

/** An ellipsoid in head space (the design's skull or hair shell). */
interface Shell {
  c: V3;
  r: V3;
}

export interface GogglesSpec {
  /** The strap round his head, the lenses' brass cups and the lenses' glass. */
  strap: Mat;
  brass: Mat;
  glass: Mat;
  /** The hair's shell (worn up, the goggles sit on the hair) and the skull (worn down, on the face). */
  shell: Shell;
  skull: Shell;
  /** Worn up: the strap's height (head space) at the front and at the back, and the lenses' height and how far round from the middle of the face each sits (degrees). */
  up: { front: number; back: number; lens: number; yaw: number };
  /** Worn down over the eyes: the same. */
  down: { front: number; back: number; lens: number; yaw: number };
  /** The lenses' radius across and how far the cups stand out. */
  r: number;
  depth: number;
}

/** Shape ids: gear over the head, so his brows do not show through them. */
const STRAP = GEAR_ID + 40;
const CUP = GEAR_ID + 41;
const GLASS = GEAR_ID + 42;
const BRIDGE = GEAR_ID + 43;
/** Stand proud of the locks of hair (drawn up to 3 px over the hair) in the head's depth test. */
const LIFT = 3.5;

/** A point on an ellipsoid at a yaw round it (0 the front, 90 his right) and a height, with its outward normal. */
function onSurface(s: Shell, yaw: number, u: number, out: number): { p: V3; n: V3 } {
  const ku = clamp((u - s.c[1]) / s.r[1], -0.98, 0.98);
  const k = Math.sqrt(1 - ku * ku);
  const q: V3 = [s.c[0] + s.r[0] * k * Math.cos(rad(yaw)), u, s.c[2] + s.r[2] * k * Math.sin(rad(yaw))];
  const n = norm3([(q[0] - s.c[0]) / (s.r[0] * s.r[0]), (q[1] - s.c[1]) / (s.r[1] * s.r[1]), (q[2] - s.c[2]) / (s.r[2] * s.r[2])]);
  return { p: add3(q, n, out), n };
}

/**
 * Brass goggles on a leather strap round his head: two round cups with amber lenses and a short
 * bridge between them. The pose's `hood` says where they are: 'up' (his default), pushed up on his
 * forehead over the hairline, or 'down' over his eyes (the victory pose), where they hide the eyes
 * and the brows. Painted with the head, in its depth test, so they turn with it and stand over the
 * hair; they hide no hair.
 */
export function goggles(spec: GogglesSpec): HeadPiece {
  const S = spec.shell;
  return {
    blobs: (ctx, head) => {
      const down = ctx.pose.hood === 'down';
      const g = down ? spec.down : spec.up;
      const base = down ? spec.skull : S;
      const cam = ctx.cam;
      const yawOf = (p: V3): number => Math.abs((Math.atan2(p[2], p[0] - S.c[0]) * 180) / Math.PI);
      const height = (yaw: number): number => g.front + (g.back - g.front) * ((1 - Math.cos(rad(yaw))) / 2);
      // The strap: a band round a shell a little clear of the hair, cut where the cups sit.
      const ease = down ? 0.9 : 0.6;
      const band: Blob[] = [{ c: base.c, r: [base.r[0] + ease, base.r[1] + ease, base.r[2] + ease], id: STRAP }];
      const list: { frame: Frame3; blobs: readonly Blob[]; shade: (h: Hit) => { m: Mat; light?: number; id?: number; lift?: number } | null }[] = [
        {
          frame: head,
          blobs: band,
          shade: (h) => {
            if (h.back) return null;
            const d = h.p[1] - height(yawOf(h.p));
            if (Math.abs(d) > 0.95) return null;
            const l = cam.light(dirIn(head, h.n[0], h.n[1], h.n[2]));
            return { m: spec.strap, light: l + (d > 0.3 ? 0.3 : d < -0.45 ? -0.25 : 0), lift: down ? 1 : LIFT };
          },
        },
      ];
      // The cups, each in its own frame facing out from the head where it sits.
      for (const side of [1, -1]) {
        const at = onSurface(base, g.yaw * side, g.lens, down ? 0.4 : 0.8);
        const f = at.n;
        const r = norm3(cross3(f, [0, 1, 0]));
        const u = cross3(r, f);
        const fr: Frame3 = { o: at3(head, at.p[0], at.p[1], at.p[2]), f: dirIn(head, f[0], f[1], f[2]), u: dirIn(head, u[0], u[1], u[2]), r: dirIn(head, r[0], r[1], r[2]) };
        list.push({
          frame: fr,
          blobs: [{ c: [spec.depth * 0.35, 0, 0], r: [spec.depth, spec.r, spec.r * 1.05], id: CUP }],
          shade: (h) => {
            if (h.back) return null;
            const across = Math.hypot(h.p[1], h.p[2]) / spec.r;
            const light = cam.light(dirIn(fr, h.n[0], h.n[1], h.n[2]));
            if (across < 0.7) {
              // The glass: deep amber, its upper half a shade brighter, a single white glint in its
              // upper corner toward the light (the glass's highlight tone).
              const glint = h.p[1] > spec.r * 0.2 && h.p[2] * side < 0 && across > 0.2 && across < 0.45;
              return { m: spec.glass, light: glint ? 1.3 : h.p[1] > 0 ? Math.min(0.7, light + 0.1) : Math.min(0.35, light - 0.2), id: GLASS, lift: LIFT };
            }
            // A thin, dull rim round it, never at its brightest.
            return { m: spec.brass, light: Math.min(0.7, light + (h.p[1] > 0 ? 0.1 : -0.15)), id: CUP, lift: LIFT };
          },
        });
      }
      // The bridge between the cups, over the middle of the brow.
      const mid = onSurface(base, 0, g.lens + 0.4, down ? 0.4 : 0.5);
      list.push({ frame: head, blobs: [{ c: mid.p, r: [0.9, 0.8, 1.6], id: BRIDGE }], shade: (h) => (h.back ? null : { m: spec.brass, lift: LIFT }) });
      return list;
    },
  };
}

// ── Boot buckles ─────────────────────────────────────────────────────────────────────────────

/**
 * A strap round each boot's shaft, `at` of the way up the boot from the ankle, with a brass buckle
 * on its outer side: painted over the leg it is on, in the leg's place in the depth order.
 */
export function buckles(o: { strap: Mat; buckle: Mat; at: number; top: number; r: number }): Piece {
  return (ctx: PieceContext) => {
    const { rig, depth } = ctx;
    const out = [];
    for (const [leg, side] of [[rig.legR, 1], [rig.legL, -1]] as const) {
      const z = depth(leg.mid) * 0.7 + depth(leg.root) * 0.3 + 0.01;
      out.push({ z, draw: () => paintBuckle(ctx, leg.mid, leg.end, side, o) });
    }
    return out;
  };
}

function paintBuckle(ctx: PieceContext, knee: V3, ankle: V3, side: number, o: { strap: Mat; buckle: Mat; at: number; top: number; r: number }): void {
  const { cam, proj, depth } = ctx;
  // Up the boot's shaft from the ankle, `at` of its height.
  const c = lerp3(ankle, knee, o.top * o.at);
  const axis = norm3(sub3(knee, ankle));
  // Round the shaft: its forward side and his outward side, square to the shin.
  const fwd0: V3 = [1, 0, 0];
  const fwd = norm3(sub3(fwd0, [axis[0] * dot3(fwd0, axis), axis[1] * dot3(fwd0, axis), axis[2] * dot3(fwd0, axis)]));
  const outw = norm3(cross3(axis, fwd));
  const outward: V3 = dot3(outw, [0, 0, side]) >= 0 ? outw : [-outw[0], -outw[1], -outw[2]];
  const part = ctx.part();
  const n = 18;
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const dir = norm3(add3([fwd[0] * Math.cos(th), fwd[1] * Math.cos(th), fwd[2] * Math.cos(th)], outward, Math.sin(th)));
    if (cam.facing(dir) < 0.05) continue;
    const p = add3(c, dir, o.r + 0.25);
    const q = proj(p);
    part.plot(q[0], q[1], o.strap, cam.light(dir) - 0.2, depth(p), 1, true);
    part.plot(q[0], q[1] + 1, o.strap, cam.light(dir) - 0.45, depth(p), 1, true);
  }
  // The buckle: a brass square on the outer side, a little forward.
  const bdir = norm3(add3(outward, fwd, 0.55));
  if (cam.facing(bdir) > 0.05) {
    const p = add3(c, bdir, o.r + 0.5);
    const q = proj(p);
    part.ellipse(q[0], q[1] + 0.5, 1.15, 1.1, o.buckle, 0.25, depth(p) + 1, 2);
  }
  part.commit({ lines: false });
}

// ── The crossbow's cocking lever ─────────────────────────────────────────────────────────────

export interface LeverSpec {
  /** Where it hinges on the stock (along it) and how long it is. */
  hinge: number;
  len: number;
  /** How far out from the stock's middle it lies, and how high up its side. */
  out: number;
  v: number;
  /** Its iron arm and the grip across its end. */
  mat: Mat;
  grip: Mat;
}

/**
 * The metal bands round a stock whose top and underside are not where the engine's crossbow puts
 * its bands (crossbow.ts runs them from the groove to a fixed depth): each at `u` along the stock
 * from its top (`v0`) to its underside (`v1`), in `mat`.
 */
export interface BandSpec {
  at: readonly (readonly [number, number, number])[];
  mat: Mat;
}

/**
 * How far the lever is thrown, in degrees (0 folded back along the stock), from the pose's `draw`:
 * spanned (1) or just loosed (0) it lies folded; between, a rack throws it forward and up (just
 * above 0, the string still forward) and pulls it back (toward 1, the string coming back to the
 * nut), so a reload is `draw` about 0.15 and then about 0.7, then 1.
 */
export function leverAngle(draw: number | undefined): number {
  const d = draw ?? 1;
  if (d <= 0.02 || d >= 0.98) return 0;
  return 150 * (1 - d);
}

/** Where the lever's hinge and its grip are, in hero space, on a crossbow held at this grip: on its right side (his right). */
export function leverEnds(grip: Grip, spec: LeverSpec, draw: number | undefined): { hinge: V3; end: V3; side: number } {
  const side = dot3(grip.n, [0, 0, 1]) >= 0 ? 1 : -1;
  const a = rad(leverAngle(draw));
  const p = (u: number, v: number, n: number): V3 => add3(add3(add3(grip.o, grip.u, u), grip.v, v), grip.n, n);
  const hinge = p(spec.hinge, spec.v, side * spec.out);
  const end = p(spec.hinge - spec.len * Math.cos(a), spec.v - spec.len * Math.sin(a), side * spec.out);
  return { hinge, end, side };
}

/**
 * A crossbow with a cocking lever on its right side and metal bands round its stock, painted over
 * it. Its effects leave from the point of the bolt as it lies in the groove (`boltV` across the
 * stock from the grip, toward its top), so a flash and a trail start at the bolt and not under it.
 */
export function withLever(bow: WeaponDesign, spec: LeverSpec, bands: BandSpec, boltV: number): WeaponDesign {
  const tipU = bow.tip ?? bow.reach[1];
  return {
    ...bow,
    aim: (_ctx, held) => ({ tip: add3(add3(held.grip.o, held.grip.u, tipU), held.grip.v, boltV), dir: held.grip.u }),
    paint: (ctx, part: Part, held = mainHeld(ctx)) => {
      bow.paint(ctx, part, held);
      const { proj, depth } = ctx;
      const w = held.grip;
      const ax = { o: proj(w.o), u: ctx.cam.vec(w.u), v: ctx.cam.vec(w.v) };
      clipToGround(part, ax, w);
      const p3 = (u: number, v: number): V3 => add3(add3(w.o, w.u, u), w.v, v);
      // The bands: a line across the stock's side from its top to its underside, a little proud.
      // Seen end on (the stock pointing at the viewer or away) they would stack into one bright
      // line up its middle, so they are left out then.
      const along = Math.hypot(ax.u[0], ax.u[1]);
      for (const [u, v0, v1] of along > 0.55 ? bands.at : []) {
        const a = p3(u, v0);
        const b = p3(u, v1);
        part.line(proj(a), proj(b), bands.mat, 0.5, Math.max(depth(a), depth(b)) + 0.6, 2, true);
      }
      const { hinge, end, side } = leverEnds(w, spec, ctx.pose.draw);
      // Over the stock where it lies on the near side, behind it on the far side.
      const near = ctx.cam.facing(norm3([w.n[0] * side, w.n[1] * side, w.n[2] * side])) > 0;
      const lift = near ? 0.9 : -0.6;
      part.capsule(proj(hinge), proj(end), 0.75, 0.6, spec.mat, 0.1, depth(hinge) + lift, depth(end) + lift, 7);
      // The grip across its end.
      const g0 = add3(end, w.n, side * 0.2);
      const g1 = add3(end, w.n, side * 2.6);
      part.capsule(proj(g0), proj(g1), 0.95, 0.95, spec.grip, 0.1, depth(g0) + lift + 0.2, depth(g1) + lift + 0.2, 8);
      part.ellipse(proj(hinge)[0], proj(hinge)[1], 0.9, 0.9, spec.grip, 0.3, depth(hinge) + lift + 0.3, 8);
      part.clip = null;
    },
  };
}
