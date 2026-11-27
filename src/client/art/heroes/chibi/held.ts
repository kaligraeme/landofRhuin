/**
 * What every held item shares (blade.ts, pole.ts, wand.ts, shield.ts, bow.ts, crossbow.ts, or a
 * design's own): its axes on screen, how brightly its glowing parts burn in a pose, a glowing
 * channel's colour and soft glow, where its effects leave it, an empty hand (`NO_WEAPON`), and
 * sinking whatever of it is below the floor into the ground. An item is painted at whichever
 * grip it is given (`Held`), so the same item serves as the main weapon or the off-hand item.
 */
import type { Canvas, RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { type Held, type HeldItem, type PieceContext, WEAPON_TAG, type WeaponDesign } from './design.js';
import { mixc, type Part } from './raster.js';
import { add3, type Grip, type V3 } from './rig.js';

/**
 * A held item's screen axes: the grip, along it and across it (with a floor on how thin it looks).
 * The main weapon's unless another grip (the off-hand item's) is given.
 */
export function heldAxes(ctx: PieceContext, grip: Grip = ctx.rig.weapon): { o: Vec; u: Vec; v: Vec; flip: number } {
  const w = grip;
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

/**
 * How brightly the rune blazes in a pose (0 smouldering at rest, 1 ablaze): the main weapon's from
 * `fx.rune`, the off-hand item's (`off`) from `fx.runeB`, either a little brighter in an aura.
 */
export function blaze(ctx: PieceContext, off = false): number {
  const fx = ctx.pose.fx ?? {};
  return Math.max(0, Math.min(1, ((off ? fx.runeB : fx.rune) ?? 0) + (fx.aura ?? 0) * 0.35));
}

/** How the main weapon is held when a painter is not told otherwise. */
export const mainHeld = (ctx: PieceContext): Held => ({ grip: ctx.rig.weapon, blaze: blaze(ctx), tag: WEAPON_TAG });

/**
 * An empty main hand: a weapon that paints nothing (an archer's drawing hand, whose arrow the bow
 * paints, or a fist). Its short reach puts smears and impacts at the fist.
 */
export const NO_WEAPON: WeaponDesign = { grip2: 0, reach: [0, 3], paint: () => {} };

/**
 * Where effects leave an item and which way they fly (hero space): its own `aim` if it has one
 * (a bow's arrow, a shield's face), else its `tip` (or the end of its reach) along it.
 */
export function aimOf(item: HeldItem, ctx: PieceContext, held: Held): { tip: V3; dir: V3 } {
  return item.aim ? item.aim(ctx, held) : { tip: add3(held.grip.o, held.grip.u, item.tip ?? item.reach[1]), dir: held.grip.u };
}

/** A glowing channel's colour as it blazes: its rest colour, through its colour, to its glow's. */
export const runeColour = (r: { rest: RGB; colour: RGB; glow: RGB }, k: number): RGB => (k < 0.6 ? mixc(r.rest, r.colour, k / 0.6) : mixc(r.colour, r.glow, (k - 0.6) / 0.4));

/**
 * A soft glow along a channel of a held item (from `from` to `to` along it, `v` across), only
 * where the item's own pixels show (not through a head or an arm in front of it). `sag` bends the
 * channel back along a curved blade (how far toward -v it lies at a point along it).
 */
export function channelGlow(ctx: PieceContext, held: Held, r: { v: number; from: number; to: number; glow: RGB }, strength: number, sag?: (u: number) => number): void {
  if (strength <= 0) return;
  const ax = heldAxes(ctx, held.grip);
  const c: Canvas = ctx.c;
  const at = (u: number, v: number): Vec => [ax.o[0] + ax.u[0] * u + ax.v[0] * v, ax.o[1] + ax.u[1] * u + ax.v[1] * v];
  const n = Math.ceil(Math.abs(r.to - r.from) * Math.hypot(ax.u[0], ax.u[1]));
  for (let i = 0; i <= n; i++) {
    const u = r.from + ((r.to - r.from) * i) / Math.max(1, n);
    const p = at(u, sag ? r.v - sag(u) : r.v);
    const mine = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < c.w && y < c.h && ctx.owner[y * c.w + x] === held.tag;
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
}

/**
 * Clips a part to what of a held item stands above the ground: whatever of it is below the floor
 * is sunk into it (a blade's point, a planted butt).
 */
export function clipToGround(part: Part, ax: { o: Vec; u: Vec; v: Vec }, w: Grip): void {
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
}
