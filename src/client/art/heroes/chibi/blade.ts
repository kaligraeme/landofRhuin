/**
 * Bladed weapons from a profile: the blade, guard, grip and pommel are drawn in the weapon's own
 * plane (u along it from the grip, v across it toward the cutting edge) and laid onto the screen
 * through the camera. A blade seen edge on keeps at least part of its breadth, as sprite blades
 * do, so a broad sword still reads when swung toward the viewer. A rune channel down the blade
 * smoulders in its rest colour and blazes (brighter, with its marks and a soft glow) as the pose's
 * `fx.rune` or `fx.aura` rises.
 *
 * A blade is a held item (design.ts `HeldItem`): the main weapon, or a second blade or dagger in
 * the off hand (then it lies along `rig.offhand` and blazes with `fx.runeB`).
 *
 * A blade can curve (`curve`): its outline, edge, spine and rune are bent back from the guard to
 * the tip, the tip carried toward the back, so the cutting edge runs along the outside of the
 * curve, as a sabre's or a scimitar's does. Seen edge on it keeps its breadth (and so its curve),
 * so twin sabres read in every view.
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import type { Held, PieceContext, WeaponDesign } from './design.js';
import { channelGlow, clipToGround, heldAxes, mainHeld, runeColour } from './held.js';
import type { Mat, Part } from './raster.js';
import { add3, cross3, norm3 } from './rig.js';

export interface BladeSpec {
  /** The blade's outline in [u, v] (v + toward the cutting edge), from the guard round to the tip and back. */
  blade: readonly (readonly [number, number])[];
  /** A pale band inside the cutting edge: its width, and where along the blade (`from`) it starts, running to the tip. */
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
  /**
   * How far the blade curves back: its tip this far toward its back (-v) from where a straight
   * blade's would be, bending more toward the tip (default 0, straight). About a fifth of its
   * length makes a sabre; the outline is given straight and bent as a whole.
   */
  curve?: number;
}

/** Points along a polygon's edges about every 1.5 px, so a bend follows a curve rather than cutting corners. */
function resample(pts: readonly (readonly [number, number])[], closed: boolean): [number, number][] {
  const out: [number, number][] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const a = pts[i] as readonly [number, number];
    const b = pts[(i + 1) % pts.length] as readonly [number, number];
    const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
    for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
  }
  if (!closed) out.push([...(pts[pts.length - 1] as readonly [number, number])]);
  return out;
}

export function blade(spec: BladeSpec): WeaponDesign {
  const curve = spec.curve ?? 0;
  const rootU = Math.min(...spec.blade.map((p) => p[0]));
  const topU = Math.max(...spec.blade.map((p) => p[0]));
  /** How far the curve carries a point of the blade back (toward -v), by how far up the blade it is. */
  const sag = (u: number): number => {
    const t = Math.max(0, Math.min(1, (u - rootU) / (topU - rootU || 1)));
    return curve * t * t;
  };
  /** A polygon of the blade's plane bent along the curve (left as it is on a straight blade). */
  const bent = (pts: readonly (readonly [number, number])[], closed = true): readonly (readonly [number, number])[] => (curve ? resample(pts, closed).map(([u, v]): [number, number] => [u, v - sag(u)]) : pts);
  return {
    grip2: spec.grip2,
    reach: spec.reach,
    paint: (ctx: PieceContext, part: Part, held: Held = mainHeld(ctx)) => {
      const { cam } = ctx;
      const w = held.grip;
      const ax = heldAxes(ctx, w);
      const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
      const z = (u: number): number => ctx.depth(add3(w.o, w.u, u));
      let n = norm3(cross3(w.u, w.v));
      if (cam.facing(n) < 0) n = [-n[0], -n[1], -n[2]];
      const flatLight = cam.light(n);
      // Depth along the blade for each pixel: from its projection onto the blade's axis.
      const ul2 = ax.u[0] * ax.u[0] + ax.u[1] * ax.u[1] || 1;
      const zAt = (x: number, y: number): number => z(((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2) + 0.4;
      // Whatever of the weapon is below the ground is sunk into it.
      clipToGround(part, ax, w);
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
      const bladePts = bent(spec.blade).map(([u, v]) => at(u, v));
      part.poly(bladePts, spec.steel, (x, y) => {
        // A bevel: the half toward the cutting edge catches a little more light.
        const rel = ((x + 0.5 - ax.o[0]) * ax.v[0] + (y + 0.5 - ax.o[1]) * ax.v[1]) / (ax.v[0] * ax.v[0] + ax.v[1] * ax.v[1]);
        // On a curved blade, measured from the bent middle line.
        const back = curve ? sag(((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2) : 0;
        return flatLight * 0.6 + (rel + back > 0.5 ? 0.18 : -0.12);
      }, zAt, 3);
      const edge = spec.edge;
      const tipU = Math.max(...spec.blade.map((p) => p[0]));
      const edgePts: Vec[] = [];
      const inner: Vec[] = [];
      for (const [u, v] of spec.blade) if (u >= edge.from && v >= 0) edgePts.push([u, v]);
      edgePts.sort((a, b) => a[0] - b[0]);
      for (const [u, v] of edgePts) inner.push([u + (u >= tipU - 4 ? -edge.width * 1.2 : 0), v - edge.width]);
      if (edgePts.length > 1) {
        part.poly(bent([...edgePts, ...inner.reverse()]).map(([u, v]) => at(u, v)), edge.mat, (x, y) => {
          const rel = ((x + 0.5 - ax.o[0]) * ax.u[0] + (y + 0.5 - ax.o[1]) * ax.u[1]) / ul2;
          return flatLight * 0.4 + 0.25 + (rel > tipU * 0.7 ? 0.25 : 0);
        }, (x, y) => zAt(x, y) + 0.01, 3);
      }
      if (spec.spine) {
        const sp = spec.spine;
        if (!curve) part.line(at(sp.from, sp.v), at(sp.to, sp.v), sp.mat, 0.7, z(sp.from) + 0.6, 3, true);
        else {
          const pts = bent([[sp.from, sp.v], [sp.to, sp.v]], false);
          for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i] as readonly [number, number];
            const b = pts[i + 1] as readonly [number, number];
            part.line(at(a[0], a[1]), at(b[0], b[1]), sp.mat, 0.7, z(sp.from) + 0.6, 3, true);
          }
        }
      }
      if (spec.rune) {
        // A thin channel smouldering at rest; ablaze it brightens toward the glow's colour and its marks show.
        const r = spec.rune;
        const k = held.blaze;
        const col = runeColour(r, k);
        const runeMat: Mat = { tones: [col, col, col, col], line: col, flat: true };
        const n2 = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(ax.u[0], ax.u[1]));
        for (let i = 0; i <= n2; i++) {
          const u = r.from + ((r.to - r.from) * i) / Math.max(1, n2);
          const p = at(u, r.v - (curve ? sag(u) : 0));
          if (part.idAt(Math.floor(p[0]), Math.floor(p[1])) === 3) part.plot(p[0], p[1], runeMat, 0, z(u) + 0.7, 3, true);
        }
        if (k > 0.3) {
          for (const u of r.marks ?? []) {
            for (const dv of [-1, 1]) {
              const p = at(u, r.v + dv - (curve ? sag(u) : 0));
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
    glow: (ctx: PieceContext, strength: number, held: Held = mainHeld(ctx)) => {
      if (spec.rune) channelGlow(ctx, held, spec.rune, strength, curve ? sag : undefined);
    },
  };
}
