/**
 * Bladed weapons from a profile: the blade, guard, grip and pommel are drawn in the weapon's own
 * plane (u along it from the grip, v across it toward the cutting edge) and laid onto the screen
 * through the camera. A blade seen edge on keeps at least part of its breadth, as sprite blades
 * do, so a broad sword still reads when swung toward the viewer. A rune channel down the blade
 * smoulders a deep red at rest and blazes (brighter, with its marks and a soft glow) as the pose's
 * `fx.rune` or `fx.aura` rises.
 */
import type { Canvas, RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { type PieceContext, WEAPON_TAG, type WeaponDesign } from './design.js';
import { type Mat, type Part } from './raster.js';
import { add3, cross3, norm3 } from './rig.js';

export interface BladeSpec {
  /** The blade's outline in [u, v] (v + toward the cutting edge), from the guard round to the tip and back. */
  blade: readonly (readonly [number, number])[];
  /** A pale band inside the cutting edge: its width, from u0 to the tip. */
  edge: { from: number; width: number; mat: Mat };
  /** A line along the blade's spine catching the light: v and u range. */
  spine?: { v: number; from: number; to: number; mat: Mat };
  /**
   * A glowing channel down the blade: v, u range, its colour at rest and blazing, the glow's
   * colour, and marks across it that show as it blazes.
   */
  rune?: { v: number; from: number; to: number; rest: RGB; colour: RGB; glow: RGB; marks?: readonly number[] };
  steel: Mat;
  guard: { pts: readonly (readonly [number, number])[]; mat: Mat; gem?: { u: number; r: number; mat: Mat } };
  grip: { from: number; to: number; r: number; mat: Mat; wrap?: Mat };
  /** The pommel: a steel cap, and a gem set in it (`gem` the gem's material, `gemR` its radius). */
  pommel: { u: number; r: number; mat: Mat; gem?: Mat; gemR?: number };
  grip2: number;
  reach: readonly [number, number];
}

/** The weapon's screen axes: the grip, along it and across it (with a floor on how thin it looks). */
export function bladeAxes(ctx: PieceContext): { o: Vec; u: Vec; v: Vec; flip: number } {
  const w = ctx.rig.weapon;
  const o = ctx.proj(w.o);
  const u = ctx.cam.vec(w.u);
  let v = ctx.cam.vec(w.v);
  const ul = Math.hypot(u[0], u[1]) || 1;
  const perp: Vec = [-u[1] / ul, u[0] / ul];
  const comp = v[0] * perp[0] + v[1] * perp[1];
  const min = 0.62;
  let flip = 1;
  if (Math.abs(comp) < min) {
    const want = (comp >= 0 ? 1 : -1) * min;
    v = [v[0] + perp[0] * (want - comp), v[1] + perp[1] * (want - comp)];
  }
  if (comp < 0) flip = -1;
  return { o, u, v, flip };
}

const mixc = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

/** How brightly the rune blazes in a pose (0 smouldering at rest, 1 ablaze). */
export function blaze(ctx: PieceContext): number {
  const fx = ctx.pose.fx ?? {};
  return Math.max(0, Math.min(1, (fx.rune ?? 0) + (fx.aura ?? 0) * 0.35));
}

export function blade(spec: BladeSpec): WeaponDesign {
  return {
    grip2: spec.grip2,
    reach: spec.reach,
    paint: (ctx: PieceContext, part: Part) => {
      const { cam } = ctx;
      const w = ctx.rig.weapon;
      const ax = bladeAxes(ctx);
      const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
      const z = (u: number): number => ctx.depth(add3(w.o, w.u, u));
      let n = norm3(cross3(w.u, w.v));
      if (cam.facing(n) < 0) n = [-n[0], -n[1], -n[2]];
      const flatLight = cam.light(n);
      // Depth along the blade for each pixel: from its projection onto the blade's axis.
      const ul2 = ax.u[0] * ax.u[0] + ax.u[1] * ax.u[1] || 1;
      const zAt = (x: number, y: number): number => z(((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2) + 0.4;
      // Whatever of the weapon is below the ground is sunk into it.
      const det = ax.u[0] * ax.v[1] - ax.u[1] * ax.v[0];
      if (Math.abs(det) > 1e-3) {
        part.clip = (x, y) => {
          const px = x + 0.5 - ax.o[0];
          const py = y + 0.5 - ax.o[1];
          const a = (px * ax.v[1] - py * ax.v[0]) / det;
          const b = (ax.u[0] * py - ax.u[1] * px) / det;
          return w.o[1] + w.u[1] * a + w.v[1] * b > -0.5;
        };
      }
      // Grip and pommel.
      const g0 = at(spec.grip.from, 0);
      const g1 = at(spec.grip.to, 0);
      part.capsule(g0, g1, spec.grip.r, spec.grip.r, spec.grip.mat, 0, z(spec.grip.from), z(spec.grip.to), 1);
      if (spec.grip.wrap) {
        // The wrap: dark bands slanting round the grip, two pixels apart.
        for (let u = spec.grip.from + 0.8; u < spec.grip.to - 0.5; u += 2) part.line(at(u, -spec.grip.r), at(u + 1.2, spec.grip.r), spec.grip.wrap, 0, z(u) + 0.5, 1, true);
      }
      const pm = at(spec.pommel.u, 0);
      part.poly([at(spec.pommel.u + 2.2, 0), at(spec.pommel.u + 0.6, spec.pommel.r), at(spec.pommel.u - 2.6, spec.pommel.r * 0.6), at(spec.pommel.u - 2.6, -spec.pommel.r * 0.6), at(spec.pommel.u + 0.6, -spec.pommel.r)], spec.pommel.mat, flatLight, z(spec.pommel.u) + 0.5, 2);
      if (spec.pommel.gem) part.ellipse(pm[0], pm[1], spec.pommel.gemR ?? 1, spec.pommel.gemR ?? 1, spec.pommel.gem, 0.1, z(spec.pommel.u) + 2.5, 6);
      // The blade, its pale cutting edge, the bright spine and the rune channel.
      const bladePts = spec.blade.map(([u, v]) => at(u, v));
      part.poly(bladePts, spec.steel, (x, y) => {
        // A bevel: the half toward the cutting edge catches a little more light.
        const rel = ((x + 0.5 - ax.o[0]) * ax.v[0] + (y + 0.5 - ax.o[1]) * ax.v[1]) / (ax.v[0] * ax.v[0] + ax.v[1] * ax.v[1]);
        return flatLight * 0.6 + (rel > 0.5 ? 0.18 : -0.12);
      }, zAt, 3);
      const edge = spec.edge;
      const tipU = Math.max(...spec.blade.map((p) => p[0]));
      const edgePts: Vec[] = [];
      const inner: Vec[] = [];
      for (const [u, v] of spec.blade) if (u >= edge.from && v >= 0) edgePts.push([u, v]);
      edgePts.sort((a, b) => a[0] - b[0]);
      for (const [u, v] of edgePts) inner.push([u + (u >= tipU - 4 ? -edge.width * 1.2 : 0), v - edge.width]);
      if (edgePts.length > 1) {
        part.poly([...edgePts.map(([u, v]) => at(u, v)), ...inner.reverse().map(([u, v]) => at(u, v))], edge.mat, (x, y) => {
          const rel = ((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2;
          return flatLight * 0.4 + 0.25 + (rel > tipU * 0.7 ? 0.25 : 0);
        }, (x, y) => zAt(x, y) + 0.01, 3);
      }
      if (spec.spine) part.line(at(spec.spine.from, spec.spine.v), at(spec.spine.to, spec.spine.v), spec.spine.mat, 0.7, z(spec.spine.from) + 0.6, 3, true);
      if (spec.rune) {
        // A thin channel smouldering at rest; ablaze it brightens toward the glow's colour and its marks show.
        const r = spec.rune;
        const k = blaze(ctx);
        const col = k < 0.6 ? mixc(r.rest, r.colour, k / 0.6) : mixc(r.colour, r.glow, (k - 0.6) / 0.4);
        const runeMat: Mat = { tones: [col, col, col, col], line: col, flat: true };
        const n2 = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(ax.u[0], ax.u[1]));
        for (let i = 0; i <= n2; i++) {
          const u = r.from + ((r.to - r.from) * i) / Math.max(1, n2);
          const p = at(u, r.v);
          if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === 3) part.plot(p[0], p[1], runeMat, 0, z(u) + 0.7, 3, true);
        }
        if (k > 0.3) {
          for (const u of r.marks ?? []) {
            for (const dv of [-1, 1]) {
              const p = at(u, r.v + dv);
              if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === 3) part.plot(p[0], p[1], runeMat, 0, z(u) + 0.7, 3, true);
            }
          }
        }
      }
      // The guard across the blade's root, and its gem.
      part.poly(spec.guard.pts.map(([u, v]) => at(u, v)), spec.guard.mat, (x, y) => {
        const rel = ((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2;
        return flatLight * 0.5 + (rel > 3 ? 0.3 : -0.1);
      }, (x, y) => zAt(x, y) + 1.2, 4);
      const gem = spec.guard.gem;
      if (gem) {
        const gp = at(gem.u, 0);
        part.ellipse(gp[0], gp[1], gem.r, gem.r, gem.mat, 0.1, z(gem.u) + 2.5, 5);
      }
      part.clip = null;
    },
    glow: (ctx: PieceContext, strength: number) => {
      const r = spec.rune;
      if (!r || strength <= 0) return;
      const ax = bladeAxes(ctx);
      const c: Canvas = ctx.c;
      const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
      const n = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(ax.u[0], ax.u[1]));
      for (let i = 0; i <= n; i++) {
        const u = r.from + ((r.to - r.from) * i) / Math.max(1, n);
        const p = at(u, r.v);
        // Only where the blade shows: not through a head or an arm in front of it.
        const mine = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && ctx.owner[y * c.w + x] === WEAPON_TAG;
        const px = Math.floor(p[0]);
        const py = Math.floor(p[1]);
        if (!mine(px, py)) continue;
        const flick = 0.7 + 0.3 * Math.sin(u * 0.9);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > 2.2 || d < 0.5) continue;
            if (!mine(px + dx, py + dy) && c.opaque(px + dx, py + dy)) continue;
            c.glow(px + dx, py + dy, r.glow, strength * flick * (0.32 / d));
          }
        }
      }
    },
  };
}
