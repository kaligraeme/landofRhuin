/**
 * The chibi effects kit, painted on the soft effects layers of the Canvas after the figure is
 * outlined: swoosh arcs swept by the blade (or the off-hand item) in 3D (and a level ring for
 * spins), impact bursts, a guard's clang, dust, speed lines, a rim of power, rune circles and
 * shockwaves on the ground, wisps drawn in from all around, a mist of blood, the blade's glowing
 * runes, lightning, a ward of runes or hexagons, spiralling wind and afterimages, a clang on a
 * shield, a shot's release flash and its trail, light rays (a burst of beams or a column of
 * light) and rising motes of light, all in the design's aura colours. Parts of an effect behind
 * the hero go on the under layer, so the figure hides them. `glowLine`, `puff`, `starburst`,
 * `lightning`, `ward`, `swirl`, `afterimages`, `clang`, `flash`, `trail`, `rays`, `column`,
 * `motes` and the dust colours are exported for a hero's own `fx.extra` painters.
 */
import type { Canvas, RGB, Vec } from '../paint.js';
import { type ChibiDesign, HEAD_TAG, type Held, OFFHAND_TAG, type PieceContext } from './design.js';
import { aimOf, blaze, mainHeld } from './held.js';
import { hash } from './pieces.js';
import { mixc, scanPoly } from './raster.js';
import { add3, at3, type ChibiFx, clamp, cross3, DEPTH, dot3, type FxContext, len3, lerp, lerp3, mul3, norm3, rad, sub3, TO_CAMERA, type V3, weaponAxes } from './rig.js';

const WHITE: RGB = [255, 255, 255];
/** Dust kicked up off the floor: its light and dark puffs. */
export const DUST: RGB = [196, 182, 160];
export const DUST_DARK: RGB = [120, 108, 92];

/** Fills a screen polygon on an effects layer, leaving alone the pixels `skip` rejects. */
function glowPoly(c: Canvas, pts: readonly Vec[], col: RGB, a: number, under: boolean, skip?: (x: number, y: number) => boolean): void {
  scanPoly(pts, c.w, c.h, (x, y) => {
    if (!skip?.(x, y)) c.glow(x, y, col, a, under);
  });
}

/** A soft round puff on an effects layer (`under`: on the layer under the figure). */
export function puff(c: Canvas, x: number, y: number, r: number, col: RGB, a: number, under = false): void {
  for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
    for (let dx = -Math.ceil(r * 1.3); dx <= Math.ceil(r * 1.3); dx++) {
      const d = Math.hypot(dx / 1.3, dy) / Math.max(0.5, r);
      if (d > 1) continue;
      c.glow(x + dx, y + dy, col, a * (d < 0.6 ? 1 : 0.6), under);
    }
  }
}

/**
 * A swoosh: a crescent swept between two sets of blade directions about the grip, in the design's
 * aura colours: white-hot (`aura.hot`) along its outer (cutting) edge, through the core colour to a
 * faint inner edge with a hint of the edge colour (crimson and violet for the Dark Knight), fading
 * toward its tail. `dirs` gives the blade's axis at each step from tail (0) to head (1).
 */
function crescent(ctx: PieceContext, d: ChibiDesign, centre: V3, dirs: V3[], rOut: number, thick: number, alpha: number, behindZ: number, level = false): void {
  const { c } = ctx;
  const n = dirs.length - 1;
  if (n < 1) return;
  // A level ring stays level; a blade's swing is turned to show its face.
  if (!level) dirs = faceCamera(ctx, dirs);
  const bands: [number, number, RGB, number][] = [
    [0, 0.14, d.aura.hot, 1],
    [0.14, 0.34, mixc(d.aura.hot, d.aura.core, 0.45), 0.92],
    [0.34, 0.8, d.aura.core, 0.78],
    [0.8, 1, mixc(d.aura.core, d.aura.edge, 0.4), 0.3],
  ];
  // A blade's arc never covers his head: the face and hair stay readable through the swing.
  const onHead = level ? undefined : (x: number, y: number): boolean => ctx.owner[y * c.w + x] === HEAD_TAG;
  // The arc stops at the ground.
  const at = (dir: V3, r: number): Vec => {
    const p = add3(centre, dir, r);
    return ctx.proj(p[1] < 0.5 ? [p[0], 0.5, p[2]] : p);
  };
  for (let i = 0; i < n; i++) {
    const k0 = i / n;
    const k1 = (i + 1) / n;
    const th = (k: number): number => thick * Math.pow(Math.sin((Math.min(1, k * 1.08) * Math.PI) / 2), 0.9);
    const fade = 0.2 + 0.8 * Math.pow(k1, 1.2);
    const da = dirs[i] as V3;
    const db = dirs[i + 1] as V3;
    const mid = add3(centre, add3(da, db), rOut / 2);
    const under = ctx.depth(mid) < behindZ;
    for (const [f0, f1, col, a] of bands) {
      const pa0 = at(da, rOut - f0 * th(k0));
      const pb0 = at(db, rOut - f0 * th(k1));
      const pb1 = at(db, rOut - f1 * th(k1));
      const pa1 = at(da, rOut - f1 * th(k0));
      glowPoly(c, [pa0, pb0, pb1, pa1], col, a * alpha * fade, under, onHead);
    }
  }
}

/**
 * A swing seen edge on (a cut straight at the viewer) would smear into a sliver. As sprite artists
 * do, open it up on screen: the arc runs from where the blade started to where it ended as seen,
 * round the grip at full reach, the way the swing turns on screen (or, when it passes straight
 * through the grip, over the top for a falling cut and under for a rising one). Its depth runs from
 * the start's to the end's, so the parts behind him still go behind.
 */
function faceCamera(ctx: PieceContext, dirs: V3[]): V3[] {
  const end = dirs[dirs.length - 1] as V3;
  const start = dirs[0] as V3;
  let nrm = cross3(start, end);
  if (len3(nrm) < 0.05) nrm = cross3(dirs[Math.floor(dirs.length / 2)] as V3, end);
  if (len3(nrm) < 0.05) return dirs;
  nrm = norm3(nrm);
  const cam = ctx.cam;
  if (Math.abs(dot3(nrm, norm3(cam.local(TO_CAMERA)))) >= 0.55) return dirs;
  // The swing as seen: its angles round the grip and its reach.
  const seen = dirs.map((d) => cam.vec(d));
  const rs = seen.map((v) => Math.hypot(v[0], v[1]));
  const rMax = Math.max(...rs);
  const S = seen[0] as Vec;
  const E = seen[seen.length - 1] as Vec;
  const aS = Math.atan2(S[1], S[0]);
  let sweep = Math.atan2(Math.sin(Math.atan2(E[1], E[0]) - aS), Math.cos(Math.atan2(E[1], E[0]) - aS));
  const other = sweep - Math.sign(sweep || 1) * Math.PI * 2;
  if (Math.min(...rs) > rMax * 0.35) {
    // It turns round the grip on screen: follow it.
    let turned = 0;
    for (let i = 1; i < seen.length; i++) {
      const a = seen[i - 1] as Vec;
      const b = seen[i] as Vec;
      turned += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    }
    if (Math.sign(turned) !== Math.sign(sweep)) sweep = other;
  } else {
    // It passes through the grip: a falling cut goes over the top (screen y grows downward).
    const midY = (sw: number): number => Math.sin(aS + sw / 2);
    const falling = E[1] > S[1];
    if (falling === midY(other) < midY(sweep)) sweep = other;
  }
  const zS = cam.world(start)[2];
  const zE = cam.world(end)[2];
  const rS = rs[0] as number;
  const rE = rs[rs.length - 1] as number;
  return dirs.map((_, i) => {
    const t = i / (dirs.length - 1);
    const a = aS + sweep * t;
    const r = Math.max(lerp(rS, rE, t), rMax * (0.55 + 0.45 * Math.sin(Math.PI * t)));
    const Z = lerp(zS, zE, t);
    const sx = Math.cos(a) * r;
    const sy = Math.sin(a) * r;
    // Back from the screen to hero space: screen x is world X, screen y is -Y + Z * DEPTH.
    return cam.local([sx, Z * DEPTH - sy, Z]);
  });
}

/** A starburst: four long rays, four short ones, a white core and a coloured fringe. */
export function starburst(c: Canvas, p: Vec, size: number, core: RGB, fringe: RGB, a = 1, under = false): void {
  const r = 10 * size;
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    const len = k % 2 ? r * 0.5 : r;
    for (let i = 0; i <= len; i++) {
      const t = i / Math.max(1, len);
      const x = p[0] + Math.cos(ang) * i;
      const y = p[1] + Math.sin(ang) * i;
      c.glow(x, y, t < 0.5 ? core : fringe, a * (1 - t * 0.8), under);
      if (k % 2 === 0 && i < len * 0.45) {
        c.glow(x - Math.sin(ang), y + Math.cos(ang), fringe, a * 0.6 * (1 - t), under);
        c.glow(x + Math.sin(ang), y - Math.cos(ang), fringe, a * 0.6 * (1 - t), under);
      }
    }
  }
  const cr = Math.max(1.5, 2.6 * size);
  for (let dy = -Math.ceil(cr); dy <= Math.ceil(cr); dy++) for (let dx = -Math.ceil(cr); dx <= Math.ceil(cr); dx++) if (dx * dx + dy * dy <= cr * cr) c.glow(p[0] + dx, p[1] + dy, WHITE, a, under);
}

/**
 * A rim of light around the figure: the core colour warmed toward `hot` hugging it, the core colour
 * beyond, and the edge colour only as a faint outermost ring (crimson and violet for the Dark
 * Knight).
 */
export function rim(c: Canvas, core: RGB, edge: RGB, k: number, hot: RGB = core): void {
  const w = c.w;
  const h = c.h;
  const dist = new Uint8Array(w * h).fill(9);
  // The figure's bounds: the rim reaches 3 pixels past them.
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!c.opaque(x, y)) continue;
      dist[y * w + x] = 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return;
  x0 = Math.max(0, x0 - 3);
  y0 = Math.max(0, y0 - 3);
  x1 = Math.min(w - 1, x1 + 3);
  y1 = Math.min(h - 1, y1 + 3);
  // Three passes of a chessboard distance, out to 3 pixels.
  for (let pass = 1; pass <= 3; pass++) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((dist[y * w + x] as number) <= pass) continue;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1 && !near; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && dist[yy * w + xx] === pass - 1) near = true;
        }
        if (near) dist[y * w + x] = pass;
      }
    }
  }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dd = dist[y * w + x] as number;
      if (dd === 0 || dd > 3) continue;
      c.glow(x, y, dd === 1 ? mixc(core, hot, 0.25) : dd === 2 ? core : edge, k * (dd === 1 ? 0.9 : dd === 2 ? 0.6 : 0.28));
    }
  }
}

/** Paints a pose's effects. */
export function paintFx(ctx: PieceContext, d: ChibiDesign, fx: ChibiFx, behindZ: number): void {
  const { c, rig, pose, cam } = ctx;
  const w = rig.weapon;
  const [r0, r1] = d.weapon.reach;
  const main = aimOf(d.weapon, ctx, mainHeld(ctx));
  const tip = main.tip;
  const aura = d.aura;
  const ground = (p: V3): V3 => [p[0], 0, p[2]];
  // The off-hand item, and where its spells leave it (the bare hand if it holds nothing).
  const off = d.offhand;
  const wB = rig.offhand;
  const heldB: Held = { grip: wB, blaze: blaze(ctx, true), tag: OFFHAND_TAG };
  const offAim = off ? aimOf(off, ctx, heldB) : null;
  const tipB = offAim ? offAim.tip : rig.armL.end;
  const dirB = offAim ? offAim.dir : norm3(sub3(rig.armL.end, rig.armL.mid));
  const bodyZ = ctx.depth(rig.pelvis.o);
  const fctx: FxContext = { c, cam, rig, proj: ctx.proj, depth: ctx.depth, tip, tipB, dir: main.dir, dirB, aura, hash, behind: (p) => ctx.depth(p) < bodyZ };
  // Where a shot leaves (an item's tip, or a point) and which way it flies.
  const source = (from: 'main' | 'off' | V3 | undefined, dir: V3 | undefined): { at: V3; dir: V3 } => {
    const src = from ?? (off ? 'off' : 'main');
    const at = src === 'off' ? tipB : src === 'main' ? tip : src;
    return { at, dir: norm3(dir ?? (src === 'off' ? dirB : main.dir)) };
  };
  const onHead = (x: number, y: number): boolean => ctx.owner[y * c.w + x] === HEAD_TAG;

  // The blade's rune: barely a glow at rest, blazing as the pose calls on it.
  if (d.weapon.glow) d.weapon.glow(ctx, clamp(0.06 + (fx.rune ?? 0) * 1.1 + (fx.aura ?? 0) * 0.35, 0, 1.4));
  if (off?.glow) off.glow(ctx, clamp(0.06 + (fx.runeB ?? 0) * 1.1 + (fx.aura ?? 0) * 0.35, 0, 1.4), heldB);

  if (fx.ghosts && fx.ghosts.k > 0) {
    // Copies of the figure trailing behind it on screen (however the dash runs in this view).
    const g = fx.ghosts;
    const k = clamp(g.k, 0, 1);
    const n = g.n ?? 2;
    let v = cam.vec(norm3(g.dir ?? [-1, 0, 0]));
    const vl = Math.hypot(v[0], v[1]);
    // A dash toward or away from the viewer is foreshortened: its trail is shorter on screen (down to half).
    const short = clamp(vl / 0.85, 0.5, 1);
    v = vl > 1e-3 ? [(v[0] / vl) * short, (v[1] / vl) * short] : [0, -short];
    const list: { dx: number; dy: number; colour: RGB; alpha: number }[] = [];
    // The farthest first, so the nearer copies lie over them.
    for (let i = n; i >= 1; i--) {
      const t = n > 1 ? (i - 1) / (n - 1) : 0;
      const off2 = (g.gap ?? 10) * i * (0.5 + 0.5 * k);
      list.push({ dx: Math.round(v[0] * off2), dy: Math.round(v[1] * off2), colour: mixc(aura.core, mixc(aura.edge, [0, 0, 0], 0.3), t * 0.6), alpha: k * lerp(0.55, 0.3, t) });
    }
    afterimages(c, list);
  }

  if (fx.circle) {
    const g = ground(rig.pelvis.o);
    const R = 16 + 16 * fx.circle;
    for (const [rr, a, wdt] of [[1, 0.85, 1.2], [0.78, 0.55, 0.8], [0.5, 0.3, 0.7]] as [number, number, number][]) {
      const n = Math.ceil(R * rr * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        const p = ctx.proj([g[0] + Math.cos(th) * R * rr, 0, g[2] + Math.sin(th) * R * rr]);
        for (let t = -wdt; t <= wdt; t += 0.5) c.glow(p[0], p[1] + t * 0.5, rr === 1 ? aura.core : aura.edge, a * fx.circle, true);
      }
    }
    // Rune ticks around the outer ring.
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + 0.2;
      const a = ctx.proj([g[0] + Math.cos(th) * R * 0.82, 0, g[2] + Math.sin(th) * R * 0.82]);
      const b = ctx.proj([g[0] + Math.cos(th) * R * 0.96, 0, g[2] + Math.sin(th) * R * 0.96]);
      glowLine(c, a, b, aura.hot, 0.7 * fx.circle, true);
    }
    for (let y = -Math.ceil(R * 0.42); y <= Math.ceil(R * 0.42); y++) {
      for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) {
        const p0 = ctx.proj(g);
        if ((x / R) ** 2 + (y / (R * 0.42)) ** 2 < 0.9) c.glow(p0[0] + x, p0[1] + y, aura.core, 0.12 * fx.circle, true);
      }
    }
  }

  if (fx.smear) {
    const s = fx.smear;
    const from = s.from;
    const to = pose.weapon;
    // A step every 4 degrees of the swing, whether it swings by its angle, its roll or its yaw.
    const turn = Math.max(Math.abs(to - from), Math.abs((pose.roll ?? 0) - (s.roll ?? pose.roll ?? 0)), Math.abs((pose.yaw ?? 0) - (s.yaw ?? pose.yaw ?? 0)));
    const n = Math.max(2, Math.ceil(turn / 4));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      dirs.push(weaponAxes(lerp(from, to, k), lerp(s.roll ?? pose.roll ?? 0, pose.roll ?? 0, k), lerp(s.yaw ?? pose.yaw ?? 0, pose.yaw ?? 0, k)).u);
    }
    crescent(ctx, d, w.o, dirs, r1 + 2, (r1 - r0) * (s.width ?? 0.55), s.alpha ?? 1, behindZ);
  }

  if (fx.smearB && off) {
    // The off-hand item's sweep: its angles are mirrored (see weaponB in rig.ts).
    const s = fx.smearB;
    const to = pose.weaponB ?? 160;
    const turn = Math.max(Math.abs(to - s.from), Math.abs((pose.rollB ?? 0) - (s.roll ?? pose.rollB ?? 0)), Math.abs((pose.yawB ?? 0) - (s.yaw ?? pose.yawB ?? 0)));
    const n = Math.max(2, Math.ceil(turn / 4));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      dirs.push(weaponAxes(lerp(s.from, to, k), -lerp(s.roll ?? pose.rollB ?? 0, pose.rollB ?? 0, k), -lerp(s.yaw ?? pose.yawB ?? 0, pose.yawB ?? 0, k)).u);
    }
    const [b0, b1] = off.reach;
    crescent(ctx, d, wB.o, dirs, b1 + 2, (b1 - b0) * (s.width ?? 0.55), s.alpha ?? 1, behindZ);
  }

  if (fx.ring) {
    const g = fx.ring;
    // By default at the height of the middle of the weapon's reach (a pole arm's head, not its grip).
    const centre: V3 = [rig.pelvis.o[0], g.height ?? Math.max(2, add3(w.o, w.u, (r0 + r1) / 2)[1]), rig.pelvis.o[2]];
    const R = g.radius ?? r1 + 4;
    const turn = pose.turn ?? 0;
    const n = Math.max(2, Math.ceil(Math.abs(g.to - g.from) / 5));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = rad(lerp(g.from, g.to, i / n) - turn);
      dirs.push([Math.cos(a), 0, Math.sin(a)]);
    }
    crescent(ctx, d, centre, dirs, R, R * 0.5, 1, ctx.depth(centre) + ctx.upper - 2, true);
  }

  if (fx.speed) {
    // Streaks trailing behind him, beside and behind the body (the figure hides what is behind it).
    const back: V3 = [-1, 0, 0];
    for (let k = 0; k < 6; k++) {
      const u = 8 + k * 11 + (k % 2) * 3;
      const r = ((k % 3) - 1) * 12;
      const start: V3 = [rig.pelvis.o[0] - 8 - (k % 2) * 4, u, r];
      const len = (16 + ((k * 7) % 11)) * fx.speed;
      const a = ctx.proj(start);
      const b = ctx.proj(add3(start, back, len));
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let i = 0; i <= n; i++) c.glow(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n), WHITE, 0.55 * (1 - i / n) * Math.min(1, fx.speed), true);
    }
  }

  if (fx.dust) {
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      const g = ground(leg.end);
      if (leg.end[1] > rig.build.ankle + 6) continue;
      for (let i = 0; i < 4; i++) {
        const off: V3 = [-4 - i * 4 * (0.6 + hash(i, s) * 0.6), 0, (hash(i, s + 5) - 0.5) * 8];
        const p = ctx.proj(add3(g, off));
        const r = (3.2 - i * 0.55) * (0.5 + fx.dust * 0.6);
        puff(c, p[0], p[1] - r * 0.6 - i * 0.6, r, i % 2 ? DUST_DARK : DUST, 0.55 * fx.dust);
      }
    }
  }

  if (fx.shock) {
    // A ring of force in the aura's colours rolling out over the floor, hot at its front, with rubble.
    const k = clamp(fx.shock, 0, 1);
    const g = fx.shockAt ? ground(fx.shockAt) : ground(tip);
    const R = 8 + 46 * k;
    const n = Math.ceil(R * 8);
    const fade = 1 - k * 0.65;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const front = Math.sin(th + cam.yaw) > 0;
      for (const [rr, col, a] of [[1, aura.hot, 0.95], [0.94, aura.core, 0.85], [0.86, aura.core, 0.5], [0.76, aura.edge, 0.3]] as [number, RGB, number][]) {
        const p = ctx.proj([g[0] + Math.cos(th) * R * rr, 0, g[2] + Math.sin(th) * R * rr]);
        c.glow(p[0], p[1], col, a * fade, !front);
      }
      // A lip of force standing up off the floor at the front of the ring.
      if (i % 2 === 0) {
        const p = ctx.proj([g[0] + Math.cos(th) * R, (1 - k) * 3, g[2] + Math.sin(th) * R]);
        c.glow(p[0], p[1], aura.core, 0.6 * fade, !front);
      }
    }
    // Rubble thrown up near the centre.
    for (let i = 0; i < 10; i++) {
      const th = hash(i, 11) * Math.PI * 2;
      const rr = R * (0.25 + 0.6 * hash(i, 12));
      const hgt = (1 - k) * (5 + 12 * hash(i, 13)) * Math.sin(Math.PI * Math.min(1, k * 1.6 + 0.2));
      const p = ctx.proj([g[0] + Math.cos(th) * rr, hgt, g[2] + Math.sin(th) * rr]);
      const col: RGB = i % 2 ? DUST_DARK : [70, 60, 56];
      c.glow(p[0], p[1], col, 0.95 * fade);
      c.glow(p[0] + 1, p[1], col, 0.95 * fade);
      if (i % 3 === 0) c.glow(p[0], p[1] - 1, DUST, 0.9 * fade);
    }
    for (let i = 0; i < 4; i++) {
      const th = hash(i, 21) * Math.PI * 2;
      const p = ctx.proj([g[0] + Math.cos(th) * R * 0.6, 0, g[2] + Math.sin(th) * R * 0.6]);
      puff(c, p[0], p[1] - 2, 2 + 2 * k, DUST, 0.25 * (1 - k * 0.6));
    }
  }

  if (fx.wisps) {
    const k = clamp(fx.wisps, 0, 1);
    const centre: V3 = [rig.pelvis.o[0], 30, 0];
    const centreZ = ctx.depth(centre) + ctx.upper;
    for (let i = 0; i < 10; i++) {
      const th0 = hash(i, 31) * Math.PI * 2;
      const h0 = 6 + hash(i, 32) * 58;
      const delay = hash(i, 33) * 0.35;
      const t = clamp((k - delay) / (1 - delay), 0, 1);
      if (t >= 0.98) continue;
      const R = 70 * (1 - t) + 6;
      const pts: Vec[] = [];
      const deep: number[] = [];
      for (let s = 0; s <= 8; s++) {
        // Each wisp spirals in, its tail trailing further out.
        const rr = R + s * 3.2;
        const th = th0 + s * 0.11 + t * 1.2;
        const p: V3 = [centre[0] + Math.cos(th) * rr, lerp(h0, centre[1], t * 0.7) + Math.sin(s * 0.9 + i) * 1.5, centre[2] + Math.sin(th) * rr];
        pts.push(ctx.proj(p));
        deep.push(ctx.depth(p));
      }
      for (let s = 0; s < pts.length - 1; s++) {
        const a = pts[s] as Vec;
        const b = pts[s + 1] as Vec;
        const fade = 1 - s / pts.length;
        const col = s === 0 ? aura.hot : s < 6 ? aura.core : aura.edge;
        const behind = (deep[s] as number) < centreZ - 4;
        glowLine(c, a, b, col, 0.9 * fade * Math.min(1, t * 4 + 0.3), behind);
        if (s < 5) glowLine(c, [a[0], a[1] + 1], [b[0], b[1] + 1], s < 2 ? aura.core : mixc(aura.core, [0, 0, 0], 0.66), 0.75 * fade, behind);
        if (s === 0) puff(c, a[0], a[1], 1.2, aura.hot, 0.9, behind);
      }
    }
  }

  if (fx.blood) {
    const k = clamp(fx.blood, 0, 1);
    const head = ctx.proj(rig.head.o);
    for (let i = 0; i < 34; i++) {
      const th = hash(i, 41) * Math.PI * 2;
      const rr = 6 + hash(i, 42) * 24 * (0.6 + k * 0.6);
      const u = rig.pelvis.o[1] + (hash(i, 43) - 0.3) * 52 + k * 6;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * rr, u, Math.sin(th) * rr];
      const p = ctx.proj(p3);
      // The mist hangs around and behind him (under the figure, which hides it); droplets fly in front.
      const r = 2 + hash(i, 44) * 3.5 * k;
      const col: RGB = i % 3 === 0 ? [150, 10, 26] : i % 3 === 1 ? [96, 6, 18] : [190, 24, 40];
      puff(c, p[0], p[1], r, col, (0.35 + 0.35 * hash(i, 45)) * k, true);
      // Droplets fly in front of him, but never across his face.
      if (i % 2 === 0 && Math.hypot(p[0] + 2 - head[0], p[1] - 3 - head[1]) > 13) {
        c.glow(p[0] + 2, p[1] - 3, [236, 44, 60], 0.95 * k);
        c.glow(p[0] + 2, p[1] - 2, [140, 8, 24], 0.8 * k);
      }
    }
  }

  if (fx.ward) {
    const g = fx.ward;
    ward(fctx, g.k, g);
  }

  if (fx.swirl) {
    const g = fx.swirl;
    const on = g.on ?? 'main';
    let a: V3;
    let b: V3;
    if (on === 'body') {
      a = add3(ground(rig.pelvis.o), [0, 16, 0]);
      b = add3(a, [0, 26, 0]);
    } else {
      const grip = on === 'off' ? wB : w;
      const [q0, q1] = on === 'off' ? (off?.reach ?? [0, 4]) : d.weapon.reach;
      a = add3(grip.o, grip.u, lerp(q0, q1, 0.5));
      b = add3(grip.o, grip.u, q1 + 24);
    }
    swirl(fctx, g.from ?? a, g.to ?? b, g.k, { radius: g.radius ?? (on === 'body' ? 26 : 8), taper: g.taper ?? (on === 'body' ? 1 : 0.3), turns: g.turns ?? (on === 'body' ? 1 : 1.6), spin: g.spin });
  }

  if (fx.lightning) {
    const g = fx.lightning;
    const src = g.from ?? (off ? 'off' : 'main');
    const from = src === 'off' ? tipB : src === 'main' ? tip : src;
    const along = src === 'off' ? wB.u : w.u;
    const to = g.to ?? add3(from, norm3(g.dir ?? along), g.len ?? 56);
    lightning(fctx, from, to, { seed: g.seed, forks: g.forks, alpha: g.alpha });
  }

  if (fx.impact) {
    const p = ctx.proj(fx.impactAt ?? tip);
    starburst(c, p, fx.impact, aura.hot, aura.core, 1);
  }

  if (fx.impactB) starburst(c, ctx.proj(tipB), fx.impactB, aura.hot, aura.core, 1);

  if (fx.clang) clang(c, ctx.proj(add3(w.o, w.u, r0 + (r1 - r0) * 0.45)), fx.clang);
  if (fx.clangB) clang(c, ctx.proj(tipB), fx.clangB, fctx.behind(tipB));

  if (fx.trail && fx.trail.k > 0) {
    const s = source(fx.trail.from, fx.trail.dir);
    trail(fctx, s.at, s.dir, fx.trail.k, { len: fx.trail.len });
  }
  if (fx.flash && fx.flash.k > 0) {
    const s = source(fx.flash.from, fx.flash.dir);
    flash(fctx, s.at, s.dir, fx.flash.k);
  }
  if (fx.rays && fx.rays.k > 0) {
    const g = fx.rays;
    const at = g.at ?? 'body';
    if (g.column) {
      column(fctx, typeof at === 'string' ? (at === 'main' ? tip : at === 'off' ? tipB : rig.pelvis.o) : at, g.k, { radius: g.radius, skip: onHead });
    } else {
      const p = typeof at === 'string' ? (at === 'main' ? tip : at === 'off' ? tipB : at3(rig.chest, 0, 15, 0)) : at;
      rays(fctx, p, g.k, { n: g.n, len: g.len, spin: g.spin, behind: at === 'body', skip: onHead });
    }
  }
  if (fx.motes && fx.motes.k > 0) motes(fctx, fx.motes.k, { n: fx.motes.n, rise: fx.motes.rise });

  if (fx.glow) {
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.opaque(x, y) && (x + y) % 2 === 0) c.glow(x, y, aura.core, 0.18 * fx.glow);
  }
  if (fx.aura) {
    rim(c, aura.core, aura.edge, clamp(fx.aura, 0, 1), aura.hot);
    // Embers drifting up off him, from his knees to above his head: placed from the pelvis, so
    // they rise with him in a leap rather than hanging below his feet.
    const hip = rig.pelvis.o;
    for (let i = 0; i < 8; i++) {
      const p = ctx.proj([hip[0] + (hash(i, 61) - 0.5) * 30, hip[1] - 8 + hash(i, 62) * 60, hip[2] + (hash(i, 63) - 0.5) * 20]);
      c.glow(p[0], p[1], i % 4 === 3 ? aura.edge : aura.core, 0.9 * fx.aura);
      c.glow(p[0], p[1] - 1, aura.hot, 0.5 * fx.aura);
    }
  }

  if (fx.extra) fx.extra(fctx);
}

/** A one-pixel line on an effects layer (`under`: on the layer under the figure). */
export function glowLine(c: Canvas, a: Vec, b: Vec, col: RGB, alpha: number, under = false): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
  for (let i = 0; i <= n; i++) c.glow(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, col, alpha, under);
}

// ── Generic effects for any hero (also for `fx.extra` painters) ──────────────────────────────

/**
 * Afterimages: copies of the figure's silhouette (as painted so far, before effects) shifted by
 * `dx`, `dy` screen pixels, each in one colour at its strength, on the under layer so the figure
 * itself stays clean and only what sticks out of it shows. List the farthest copy first.
 */
export function afterimages(c: Canvas, ghosts: readonly { dx: number; dy: number; colour: RGB; alpha: number }[]): void {
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (!c.opaque(x, y)) continue;
      for (const g of ghosts) c.glow(x + g.dx, y + g.dy, g.colour, g.alpha, true);
    }
  }
}

/**
 * Strokes a set of screen polylines as one soft glowing band: each pixel takes the colour of the
 * nearest line's band it falls in (`bands`: out to a distance, a colour and a strength, from the
 * core out), so crossing and touching strokes blend into one shape instead of stacking up.
 * `alpha` scales each line (from 0 at its start to 1 at its end: a fade along it); `under` says
 * which of its points lie behind the figure.
 */
function strokeBands(c: Canvas, lines: readonly { pts: readonly Vec[]; alpha: (t: number) => number; width?: number }[], bands: readonly (readonly [number, RGB, number])[], under: (x: number, y: number) => boolean): void {
  const R = (bands[bands.length - 1] as readonly [number, RGB, number])[0];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const l of lines) {
    for (const p of l.pts) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
  }
  const pad = Math.ceil(R * 2.2) + 1;
  const bx = Math.max(0, Math.floor(x0) - pad);
  const by = Math.max(0, Math.floor(y0) - pad);
  const bw = Math.min(c.w - 1, Math.ceil(x1) + pad) - bx + 1;
  const bh = Math.min(c.h - 1, Math.ceil(y1) + pad) - by + 1;
  if (bw <= 0 || bh <= 0) return;
  // Each pixel's distance to the nearest stroke (scaled by that stroke's width) and its strength there.
  const dist = new Float32Array(bw * bh).fill(Infinity);
  const str = new Float32Array(bw * bh);
  for (const l of lines) {
    const wd = l.width ?? 1;
    const n = l.pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = l.pts[i] as Vec;
      const b = l.pts[i + 1] as Vec;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy || 1;
      const rr = R * wd + 1;
      const xa = Math.max(bx, Math.floor(Math.min(a[0], b[0]) - rr));
      const xb = Math.min(bx + bw - 1, Math.ceil(Math.max(a[0], b[0]) + rr));
      const ya = Math.max(by, Math.floor(Math.min(a[1], b[1]) - rr));
      const yb = Math.min(by + bh - 1, Math.ceil(Math.max(a[1], b[1]) + rr));
      for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
          const px = x + 0.5 - a[0];
          const py = y + 0.5 - a[1];
          const t = clamp((px * dx + py * dy) / len2, 0, 1);
          const d = Math.hypot(px - dx * t, py - dy * t) / wd;
          const j = (y - by) * bw + (x - bx);
          if (d < (dist[j] as number)) {
            dist[j] = d;
            str[j] = l.alpha((i + t) / Math.max(1, n));
          }
        }
      }
    }
  }
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const j = y * bw + x;
      const d = dist[j] as number;
      if (d > R) continue;
      for (const [r, col, a] of bands) {
        if (d > r) continue;
        c.glow(bx + x, by + y, col, a * (str[j] as number), under(bx + x, by + y));
        break;
      }
    }
  }
}

/** A jagged path from a to b: midpoint displacement, `jag` the first kink's size as a share of the length. */
function jagged(a: Vec, b: Vec, jag: number, seed: number, levels: number): Vec[] {
  let pts: Vec[] = [a, b];
  for (let l = 0; l < levels; l++) {
    const next: Vec[] = [a];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i] as Vec;
      const q = pts[i + 1] as Vec;
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const off = (hash(seed * 31 + l * 7 + 3, i) - 0.5) * 2 * jag * len;
      next.push([(p[0] + q[0]) / 2 - (dy / len) * off, (p[1] + q[1]) / 2 + (dx / len) * off], q);
    }
    pts = next;
  }
  return pts;
}

/**
 * A lightning bolt from one hero-space point to another: a jagged white-hot core in the aura's
 * hot colour, wrapped in its core colour with a faint fringe of its edge colour, forking (`forks`
 * branches, default 3), with a flash where it leaves and a small burst where it strikes. `seed`
 * reshapes it (change it every frame and it crackles); `alpha` its strength. The part of it
 * behind the figure is hidden by it.
 */
export function lightning(x: FxContext, from: V3, to: V3, o: { seed?: number; forks?: number; alpha?: number; jag?: number } = {}): void {
  const { c, aura } = x;
  const seed = o.seed ?? 0;
  const alpha = o.alpha ?? 1;
  const A = x.proj(from);
  let B = x.proj(to);
  // A bolt flying at the viewer or away would shrink to a stub: as a sprite artist would, open it
  // out on screen to at least 0.6 of its length (straight down the screen if it flies right at the viewer).
  const full = len3(sub3(to, from));
  const seen = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (seen < full * 0.6) {
    const dir: Vec = seen > 1 ? [(B[0] - A[0]) / seen, (B[1] - A[1]) / seen] : [0, x.depth(to) >= x.depth(from) ? 1 : -1];
    B = [A[0] + dir[0] * full * 0.6, A[1] + dir[1] * full * 0.6];
  }
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (len < 1) return;
  const levels = clamp(Math.ceil(Math.log2(len / 2.5)), 2, 6);
  const main = jagged(A, B, o.jag ?? 0.2, seed, levels);
  // Which screen points lie behind the figure: along the bolt's depth, by nearness to its ends.
  const behindA = x.behind(from);
  const behindB = x.behind(to);
  const under = (px: number, py: number): boolean => {
    if (behindA === behindB) return behindA;
    const t = clamp(((px - A[0]) * (B[0] - A[0]) + (py - A[1]) * (B[1] - A[1])) / (len * len), 0, 1);
    return x.behind(lerp3(from, to, t));
  };
  const lines: { pts: Vec[]; alpha: (t: number) => number; width?: number }[] = [{ pts: main, alpha: (t) => alpha * (0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, t * 1.3))) }];
  const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
  const forks = o.forks ?? 3;
  for (let i = 0; i < forks; i++) {
    const at = 0.2 + 0.6 * hash(seed * 13 + 5, i);
    const p = main[Math.round(at * (main.length - 1))] as Vec;
    const side = hash(seed * 13 + 6, i) < 0.5 ? -1 : 1;
    const th = ang + side * rad(22 + 30 * hash(seed * 13 + 7, i));
    const fl = len * (1 - at) * (0.3 + 0.3 * hash(seed * 13 + 8, i));
    const q: Vec = [p[0] + Math.cos(th) * fl, p[1] + Math.sin(th) * fl];
    const pts = jagged(p, q, 0.26, seed * 17 + i + 1, Math.max(2, levels - 2));
    lines.push({ pts, alpha: (t) => alpha * 0.85 * (1 - t * 0.7), width: 0.75 });
    // A twig off the fork.
    if (i === 0 && pts.length > 4) {
      const p2 = pts[Math.floor(pts.length / 2)] as Vec;
      const th2 = th - side * rad(35);
      const q2: Vec = [p2[0] + Math.cos(th2) * fl * 0.45, p2[1] + Math.sin(th2) * fl * 0.45];
      lines.push({ pts: jagged(p2, q2, 0.3, seed * 19 + 3, 2), alpha: (t) => alpha * 0.7 * (1 - t * 0.8), width: 0.6 });
    }
  }
  strokeBands(c, lines, [[0.75, aura.hot, 1], [1.7, aura.core, 0.9], [2.7, aura.edge, 0.4]], under);
  // A flash where it leaves, a burst where it strikes.
  puff(c, A[0], A[1], 3.2, aura.core, 0.5 * alpha, behindA);
  puff(c, A[0], A[1], 1.6, aura.hot, 0.95 * alpha, behindA);
  starburst(c, B, 0.42, aura.hot, aura.core, 0.9 * alpha, behindB);
}

/** Rune glyphs, five pixels square, for wards and circles. */
const RUNES: readonly (readonly string[])[] = [
  ['..#..', '.#.#.', '#.#.#', '..#..', '..#..'],
  ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  ['###..', '#.#..', '###..', '#..#.', '#...#'],
  ['..#..', '#.#.#', '.###.', '..#..', '.#.#.'],
  ['.###.', '#...#', '..#..', '..#..', '.###.'],
  ['#.#.#', '#.#.#', '.###.', '..#..', '..#..'],
];

/**
 * A ward round the figure, `k` from 0 (just rising off the floor, faint) to 1 (at full height,
 * bright). By default a ring of runes between two bands of light, `radius` out (default 24) and
 * `height` up (default 26), the runes turned `spin` degrees round him (`runes` of them, default
 * 10, drawn in turn from `glyphs`, five rows of five cells with `#` lit, or else the set above),
 * with a faint curtain of light between the bands. `dome: true` makes it a dome of hexagons
 * over him instead, brightest where it curves away at its rim. The half nearer the viewer is
 * painted over him (faintly, so he shows through), the far half behind him.
 */
export function ward(x: FxContext, k: number, o: { radius?: number; height?: number; spin?: number; runes?: number; dome?: boolean; glyphs?: readonly (readonly string[])[] } = {}): void {
  const { c, aura, rig } = x;
  k = clamp(k, 0, 1);
  if (k <= 0) return;
  const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
  const R = (o.radius ?? 24) * (0.85 + 0.15 * k);
  const spin = rad(o.spin ?? 0);
  const ease = k * k * (3 - 2 * k);
  // Over the figure it is fainter than behind it, so he stays readable through it.
  const FRONT = 0.55;
  if (o.dome) {
    const H = (o.height ?? 26) * 2.4 * (0.35 + 0.65 * ease);
    const rows = 5;
    for (let j = 0; j < rows; j++) {
      const e0 = (j / rows) * (Math.PI / 2) * 0.92;
      const m = Math.max(3, Math.round(14 * Math.cos(e0)));
      for (let i = 0; i < m; i++) {
        const az = ((i + (j % 2) * 0.5) / m) * Math.PI * 2 + spin;
        const cell = (Math.PI / m) * 0.92;
        const de = (Math.PI / 2 / rows) * 0.55;
        const corner = (q: number): V3 => {
          const th = (q / 6) * Math.PI * 2;
          const a = az + Math.cos(th) * cell;
          const e = e0 + de + Math.sin(th) * de;
          return [g[0] + Math.cos(a) * Math.cos(e) * R, Math.sin(e) * H, g[2] + Math.sin(a) * Math.cos(e) * R];
        };
        const mid: V3 = [g[0] + Math.cos(az) * Math.cos(e0 + de) * R, Math.sin(e0 + de) * H, g[2] + Math.sin(az) * Math.cos(e0 + de) * R];
        const nrm = norm3(sub3(mid, [g[0], 0, g[2]]));
        // Brightest at the dome's rim, where it turns away from the viewer.
        const rimK = 1 - Math.abs(x.cam.facing(nrm));
        const back = x.behind(mid);
        const a = k * (0.25 + 0.75 * rimK * rimK) * (back ? 0.85 : FRONT);
        for (let q = 0; q < 6; q++) glowLine(c, x.proj(corner(q)), x.proj(corner(q + 1)), rimK > 0.6 ? aura.hot : aura.core, a, back);
      }
    }
    // Where the dome meets the floor.
    ringLine(x, g, R, 0.5, aura.core, k * 0.8, FRONT);
    return;
  }
  const h = lerp(3, o.height ?? 26, ease);
  const n = o.runes ?? 10;
  // The bands, and a faint curtain of light between them.
  ringLine(x, g, R, h + 5, aura.core, k * 0.9, FRONT);
  ringLine(x, g, R, h - 5, aura.core, k * 0.9, FRONT);
  ringLine(x, g, R, h + 6, aura.edge, k * 0.4, FRONT);
  const steps = Math.ceil(R * 8);
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const p: V3 = [g[0] + Math.cos(th) * R, h, g[2] + Math.sin(th) * R];
    const back = x.behind(p);
    const a = x.proj([p[0], h - 4, p[2]]);
    for (let dy = 0; dy < 8; dy++) c.glow(a[0], a[1] - dy, aura.core, k * 0.14 * (back ? 1 : FRONT), back);
  }
  // The runes, each a glyph facing out from him (squeezed as it turns side on to the viewer).
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2 + spin;
    const p: V3 = [g[0] + Math.cos(th) * R, h, g[2] + Math.sin(th) * R];
    const back = x.behind(p);
    const face = Math.abs(x.cam.facing([Math.cos(th), 0, Math.sin(th)]));
    const q = x.proj(p);
    const set = o.glyphs?.length ? o.glyphs : RUNES;
    const rows = set[i % set.length] as readonly string[];
    const sx = Math.max(0.35, face);
    for (let ry = 0; ry < 5; ry++) {
      for (let rx = 0; rx < 5; rx++) {
        if ((rows[ry] as string)[rx] !== '#') continue;
        const px = q[0] + (rx - 2) * sx;
        const py = q[1] + ry - 2;
        c.glow(px, py, aura.hot, k * (back ? 0.9 : 0.8), back);
        c.glow(px + 1, py, aura.core, k * 0.35, back);
      }
    }
  }
}

/** A level ring of light round a ground point at a height: its near half over the figure (at `front` strength), its far half under it. */
function ringLine(x: FxContext, g: V3, R: number, h: number, col: RGB, a: number, front: number): void {
  const n = Math.ceil(R * 8);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const p: V3 = [g[0] + Math.cos(th) * R, h, g[2] + Math.sin(th) * R];
    const back = x.behind(p);
    const q = x.proj(p);
    x.c.glow(q[0], q[1], col, a * (back ? 1 : front), back);
  }
}

/**
 * Wind spiralling round a line from `from` to `to` (hero space), a drill of wind: strands wound
 * round it `turns` times (default 1.6), `radius` out at `from` (default 8) narrowing to `taper` of
 * that at `to` (default 0.3). Along each strand run bright streaks, white-hot at their heads in the
 * aura's hot colour, its core colour behind and fading through its edge colour at their tails;
 * they run on toward `to` as `spin` (turns) advances, and the whole drill brightens toward `to`.
 * The half of it behind the line, and any of it behind the figure, goes behind whatever is there
 * (the weapon it wraps, the figure).
 */
export function swirl(x: FxContext, from: V3, to: V3, k: number, o: { radius?: number; taper?: number; turns?: number; spin?: number; strands?: number } = {}): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  const axis = sub3(to, from);
  const L = len3(axis);
  if (L < 1) return;
  const ax = mul3(axis, 1 / L);
  const ref: V3 = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm3(cross3(ax, ref));
  const e2 = cross3(ax, e1);
  const radius = o.radius ?? 8;
  const taper = o.taper ?? 0.3;
  const turns = o.turns ?? 1.6;
  const spin = o.spin ?? 0;
  const strands = o.strands ?? 3;
  const steps = Math.ceil(turns * 40 + L);
  for (let s = 0; s < strands; s++) {
    let prev: Vec | null = null;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const th = Math.PI * 2 * (turns * t + spin + s / strands);
      const r = radius * lerp(1, taper, t);
      const centre = add3(from, ax, L * t);
      const p3 = add3(add3(centre, e1, Math.cos(th) * r), e2, Math.sin(th) * r);
      // Behind the line it wraps, or behind the figure (a drill off a point thrust away from the viewer).
      const back = x.depth(p3) < x.depth(centre) || x.behind(p3);
      const p = x.proj(p3);
      if (prev) {
        // A streak's head where the run comes round to 1, its tail fading out behind it.
        const run = (((t * turns * 0.9 - spin * 0.9 + s * 0.41) % 1) + 1) % 1;
        const head = Math.pow(run, 1.4);
        const a = k * (0.25 + 0.75 * t) * head * (back ? 0.8 : 1);
        const col = head > 0.72 ? aura.hot : head > 0.3 ? aura.core : mixc(aura.core, aura.edge, 0.6);
        glowLine(c, prev, p, col, a, back);
        if (head > 0.55) glowLine(c, [prev[0], prev[1] + 1], [p[0], p[1] + 1], aura.core, a * 0.5, back);
      }
      prev = p;
    }
  }
}

/**
 * A guard's clang at a screen point: a hard white flash and sparks flying out of it, 0 to 1 (the
 * main weapon's `fx.clang`, a shield's `fx.clangB`); `under` puts it under the figure (a shield
 * seen from behind him), so only the sparks flying clear of him show.
 */
export function clang(c: Canvas, p: Vec, k: number, under = false): void {
  starburst(c, p, 0.8 * k, WHITE, [255, 236, 190], 1, under);
  for (let i = 0; i < 7; i++) {
    const ang = hash(i, 51) * Math.PI * 2;
    const len = 6 + hash(i, 52) * 9;
    const a: Vec = [p[0] + Math.cos(ang) * 4, p[1] + Math.sin(ang) * 4];
    const b: Vec = [p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len + 2];
    glowLine(c, a, b, [255, 220, 150], 0.95 * k, under);
  }
}

/**
 * A direction on screen for an effect running from a hero-space point along `dir`: as seen, or,
 * when it runs nearly straight at the viewer or away (and would shrink to a stub), opened out to
 * at least `least` of its length, down the screen toward the viewer and up it away from them.
 */
function seenDir(x: FxContext, at: V3, dir: V3, least: number): { d: Vec; k: number } {
  const v = x.cam.vec(dir);
  const l = Math.hypot(v[0], v[1]);
  if (l >= least) return { d: [v[0] / l, v[1] / l], k: l };
  const toward = x.depth(add3(at, dir)) >= x.depth(at) ? 1 : -1;
  // Blend the little it shows on screen with straight down (or up) the screen.
  const w = l / least;
  const d: Vec = l > 1e-3 ? [(v[0] / l) * w, (v[1] / l) * w + toward * (1 - w)] : [0, toward];
  const dl = Math.hypot(d[0], d[1]) || 1;
  return { d: [d[0] / dl, d[1] / dl], k: least };
}

/**
 * A release flash where a shot leaves `at` (hero space) flying along `dir`: a white-hot core, a
 * long spike of light along the shot with two shorter ones raked back beside it, a ring round the
 * shot just ahead of the tip and a few sparks thrown forward, in the aura's colours; `k` its
 * strength. A shot flying at the viewer opens out on screen rather than shrinking to a point.
 */
export function flash(x: FxContext, at: V3, dir: V3, k: number): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  dir = norm3(dir);
  const A = x.proj(at);
  const under = x.behind(at) && x.behind(add3(at, dir, 6));
  const { d } = seenDir(x, at, dir, 0.55);
  const n: Vec = [-d[1], d[0]];
  const L = 15 * Math.min(1.2, 0.6 + k * 0.5);
  const lines: { pts: Vec[]; alpha: (t: number) => number; width?: number }[] = [{ pts: [A, [A[0] + d[0] * L, A[1] + d[1] * L]], alpha: (t) => k * (1 - t * 0.85) }];
  for (const s of [1, -1]) {
    const e: Vec = [d[0] * 0.8 + n[0] * s * 0.6, d[1] * 0.8 + n[1] * s * 0.6];
    lines.push({ pts: [A, [A[0] + e[0] * L * 0.5, A[1] + e[1] * L * 0.5]], alpha: (t) => k * 0.85 * (1 - t), width: 0.7 });
  }
  lines.push({ pts: [A, [A[0] - d[0] * 4, A[1] - d[1] * 4]], alpha: (t) => k * 0.6 * (1 - t), width: 0.6 });
  strokeBands(c, lines, [[0.7, aura.hot, 1], [1.6, aura.core, 0.85], [2.6, aura.edge, 0.35]], () => under);
  // The ring round the shot, a little ahead of the tip.
  const ref: V3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = norm3(cross3(dir, ref));
  const e2 = cross3(dir, e1);
  const centre = add3(at, dir, 3);
  const R = 3.2 + 2 * Math.min(1, k);
  for (let i = 0; i < 28; i++) {
    const th = (i / 28) * Math.PI * 2;
    const p3 = add3(add3(centre, e1, Math.cos(th) * R), e2, Math.sin(th) * R);
    const p = x.proj(p3);
    c.glow(p[0], p[1], i % 2 ? aura.core : aura.hot, 0.7 * Math.min(1, k), x.behind(p3) && under);
  }
  puff(c, A[0], A[1], 3.4, aura.core, 0.55 * Math.min(1, k), under);
  puff(c, A[0], A[1], 1.7, WHITE, Math.min(1, k), under);
  // Sparks thrown forward.
  for (let i = 0; i < 6; i++) {
    const ang = Math.atan2(d[1], d[0]) + (hash(i, 81) - 0.5) * 2.2;
    const r0 = 4 + hash(i, 82) * 4;
    const r1 = r0 + 3 + hash(i, 83) * 4;
    glowLine(c, [A[0] + Math.cos(ang) * r0, A[1] + Math.sin(ang) * r0], [A[0] + Math.cos(ang) * r1, A[1] + Math.sin(ang) * r1], i % 2 ? aura.hot : aura.core, 0.85 * Math.min(1, k), under);
  }
}

/**
 * The trail a shot leaves as it flies from `at` (hero space) along `dir`, `len` long (default
 * 52): a white-hot line brightest at its far end, where the shot now is, fading back toward where
 * it left, sheathed in the aura's core colour with a fringe of its edge colour, and sparks shed
 * along it; `k` its strength. Seen end on it opens out down the screen (toward the viewer) or up
 * it (away), as lightning does; the part of it behind the figure is hidden by it.
 */
export function trail(x: FxContext, at: V3, dir: V3, k: number, o: { len?: number } = {}): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  dir = norm3(dir);
  const len = o.len ?? 52;
  const to = add3(at, dir, len);
  const A = x.proj(at);
  const seen = seenDir(x, at, dir, 0.6);
  const B: Vec = [A[0] + seen.d[0] * len * seen.k, A[1] + seen.d[1] * len * seen.k];
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const bA = x.behind(at);
  const bB = x.behind(to);
  const under = (px: number, py: number): boolean => {
    if (bA === bB) return bA;
    const t = clamp(((px - A[0]) * (B[0] - A[0]) + (py - A[1]) * (B[1] - A[1])) / (L * L), 0, 1);
    return x.behind(lerp3(at, to, t));
  };
  const fade = (t: number): number => k * (0.12 + 0.88 * Math.pow(t, 1.3));
  // A thin second streak beside the first, a little behind it, so the trail has some body.
  const n: Vec = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
  const lines = [
    { pts: [A, B], alpha: fade },
    { pts: [[A[0] + n[0] * 1.2, A[1] + n[1] * 1.2] as Vec, [B[0] - (B[0] - A[0]) * 0.18 + n[0] * 1.2, B[1] - (B[1] - A[1]) * 0.18 + n[1] * 1.2] as Vec], alpha: (t: number) => fade(t) * 0.55, width: 0.6 },
  ];
  strokeBands(c, lines, [[0.6, aura.hot, 1], [1.5, aura.core, 0.8], [2.5, aura.edge, 0.3]], under);
  // Sparks shed along it, drifting off to either side.
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + 0.8 * hash(i, 91);
    const side = (hash(i, 92) - 0.5) * 7;
    const px = A[0] + (B[0] - A[0]) * t + n[0] * side;
    const py = A[1] + (B[1] - A[1]) * t + n[1] * side + hash(i, 93) * 2;
    c.glow(px, py, i % 3 ? aura.core : aura.hot, fade(t) * 0.9, under(px, py));
  }
}

/**
 * A burst of light rays round `at` (hero space): `n` beams (default 12), every other one shorter,
 * about `len` long (default 34, or 46 shining out from behind him), turned `spin` degrees, each a
 * wedge of the aura's core colour widening and fading as it goes out, with a white-hot line down
 * its middle, round a bright heart; `k` their strength. With
 * `behind` they shine out from behind the figure (on the under layer: a burst at his chest);
 * otherwise they lie over it, softly where they cross it, leaving alone any pixel `skip` names
 * (his face).
 */
export function rays(x: FxContext, at: V3, k: number, o: { n?: number; len?: number; spin?: number; behind?: boolean; skip?: (x: number, y: number) => boolean } = {}): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  const P = x.proj(at);
  const n = o.n ?? 12;
  const len = (o.len ?? (o.behind ? 46 : 34)) * (0.55 + 0.45 * Math.min(1, k));
  const spin = rad(o.spin ?? 0);
  const under = !!o.behind;
  const put = (px: number, py: number, col: RGB, a: number): void => {
    if (o.skip?.(px, py)) return;
    // Over the figure, softly, so he shows through.
    c.glow(px, py, col, !under && c.opaque(px, py) ? a * 0.4 : a, under);
  };
  for (let i = 0; i < n; i++) {
    const th = spin + (i / n) * Math.PI * 2;
    const L = len * (i % 2 ? 0.62 : 1) * (0.9 + 0.2 * hash(i, 101));
    const d: Vec = [Math.cos(th), Math.sin(th)];
    const m: Vec = [-d[1], d[0]];
    // Each beam widens as it goes out, as sunbeams do.
    const w0 = 0.7;
    const w1 = L * (i % 2 ? 0.07 : 0.1);
    const r0 = 3;
    const pts: Vec[] = [
      [P[0] + d[0] * r0 + m[0] * w0, P[1] + d[1] * r0 + m[1] * w0],
      [P[0] + d[0] * L + m[0] * w1, P[1] + d[1] * L + m[1] * w1],
      [P[0] + d[0] * L - m[0] * w1, P[1] + d[1] * L - m[1] * w1],
      [P[0] + d[0] * r0 - m[0] * w0, P[1] + d[1] * r0 - m[1] * w0],
    ];
    scanPoly(pts, c.w, c.h, (px, py) => {
      const t = clamp(((px + 0.5 - P[0]) * d[0] + (py + 0.5 - P[1]) * d[1]) / L, 0, 1);
      put(px, py, t < 0.4 ? mixc(aura.hot, aura.core, t / 0.4) : aura.core, k * 0.6 * (1 - t * 0.85));
    });
    const steps = Math.ceil(L * 0.8);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = P[0] + d[0] * (r0 + (L - r0) * t * 0.85);
      const py = P[1] + d[1] * (r0 + (L - r0) * t * 0.85);
      put(px, py, aura.hot, k * 0.85 * (1 - t));
    }
  }
  // The heart of the burst.
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const r = Math.hypot(dx, dy);
      if (r > 6) continue;
      put(P[0] + dx, P[1] + dy, r < 2.5 ? WHITE : r < 4.2 ? aura.hot : aura.core, k * (r < 2.5 ? 0.95 : r < 4.2 ? 0.7 : 0.35));
    }
  }
}

/**
 * A column of light pouring down onto a point on the ground (the ground under `at`), `radius`
 * wide (default 13) from high above (about 120 px): white-hot down its middle, the aura's core
 * colour out to its edges and its edge colour at the rim, fading in at the top, faint streaks
 * running down it and a pool of light where it lands; `k` its strength. Behind the figure it goes
 * on the under layer; over it, a softer veil so he shows through, leaving alone any pixel `skip`
 * names (his face).
 */
export function column(x: FxContext, at: V3, k: number, o: { radius?: number; height?: number; skip?: (x: number, y: number) => boolean } = {}): void {
  const { c, aura } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  const g: V3 = [at[0], 0, at[2]];
  const R = o.radius ?? 13;
  const H = o.height ?? 120;
  const foot = x.proj(g);
  const top = x.proj([g[0], H, g[2]]);
  const y0 = Math.max(0, Math.floor(top[1]));
  const y1 = Math.min(c.h - 1, Math.ceil(foot[1]));
  for (let y = y0; y <= y1; y++) {
    const ty = (y - top[1]) / Math.max(1, foot[1] - top[1]);
    const fadeIn = clamp(ty / 0.3, 0, 1);
    for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
      const px = Math.floor(foot[0]) + dx;
      const r = Math.abs(dx + 0.5) / R;
      if (r > 1) continue;
      if (o.skip?.(px, y)) continue;
      // Faint streaks down it.
      const streak = hash(dx + 40, 111) > 0.78 ? 0.18 : 0;
      const col = r < 0.3 ? mixc(aura.hot, WHITE, 0.3) : r < 0.75 ? aura.core : aura.edge;
      const a = k * fadeIn * ((r < 0.3 ? 0.6 : r < 0.75 ? 0.4 : 0.22) + streak);
      // Behind him in full; over him a softer veil.
      if (c.opaque(px, y)) c.glow(px, y, col, a * 0.32);
      else c.glow(px, y, col, a, true);
    }
  }
  // The pool of light where it lands, and a bright rim to it.
  const pool = R * 1.6;
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * Math.PI * 2;
    for (const [rr, col, a] of [[1, aura.hot, 0.7], [0.82, aura.core, 0.5], [0.55, aura.core, 0.3]] as [number, RGB, number][]) {
      const p3: V3 = [g[0] + Math.cos(th) * pool * rr, 0, g[2] + Math.sin(th) * pool * rr];
      const p = x.proj(p3);
      c.glow(p[0], p[1], col, a * Math.min(1, k), x.behind(p3) || c.opaque(Math.floor(p[0]), Math.floor(p[1])));
    }
  }
}

/**
 * Motes of light rising round him (a blessing, a heal): `n` of them (default 14), each a small
 * cross of light with a white-hot heart, scattered round him from his feet to above his head and
 * lifted by `rise` (0 to 1: advance it every frame; each wraps round to the floor at the top),
 * fading in and out at the ends of their climb; `k` their strength. Those behind him pass behind
 * him.
 */
export function motes(x: FxContext, k: number, o: { n?: number; rise?: number } = {}): void {
  const { c, aura, rig } = x;
  k = clamp(k, 0, 1.5);
  if (k <= 0) return;
  const n = o.n ?? 14;
  const rise = o.rise ?? 0;
  const g = rig.pelvis.o;
  for (let i = 0; i < n; i++) {
    const th = hash(i, 71) * Math.PI * 2;
    const rr = 9 + hash(i, 72) * 16;
    const t = (((hash(i, 73) + rise * (0.7 + 0.6 * hash(i, 74))) % 1) + 1) % 1;
    const p3: V3 = [g[0] + Math.cos(th) * rr, 2 + t * 72, g[2] + Math.sin(th) * rr];
    const p = x.proj(p3);
    const a = k * Math.sin(Math.PI * t);
    const back = x.behind(p3);
    const big = i % 3 === 0;
    c.glow(p[0], p[1], WHITE, a, back);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      c.glow(p[0] + dx, p[1] + dy, aura.hot, a * 0.75, back);
      if (big) c.glow(p[0] + dx * 2, p[1] + dy * 2, aura.core, a * 0.45, back);
    }
  }
}
