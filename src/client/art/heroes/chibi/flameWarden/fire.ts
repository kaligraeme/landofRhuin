/**
 * The Flame Warden's fire: the effects his moves paint through `fx.extra`, on top of the engine's
 * own (fx.ts). Everything burns in one ramp: a white-hot heart, gold, his orange and a deep red at
 * the tips, cooling to smoke-grey as it dies (fire fades by cooling, not by going see-through, so
 * it stays bright on any floor); the shock of an explosion rings pale violet, and his buff is a
 * gold starburst. Each painter takes a strength (and where it is), so a clip runs it on from frame
 * to frame, and most take a `seed` that changes their flicker: advance it every frame.
 *
 *   fireArc    a slash's swoosh: a blazing crescent swept by the blade, white at its cutting edge,
 *              cooling through gold, orange and red to smoke at its tail, with embers shed off it
 *   fireRing   the same laid level round him, for his spinning slash
 *   flames     tongues of fire licking up off the blade, and embers shed from it
 *   embers     sparks drifting up round a point or round him
 *   ghosts     afterimages of him in his fire, trailing a dash
 *   crescent   the Blazing Crescent: a crescent of flame flying off ahead of him
 *   fireball   Inferno Burst: a fireball blooming at a point, its pale violet shock ring and smoke
 *   trailFire  Flashfire: a lane of fire on the floor behind him
 *   kindle     Kindle: a gold starburst of rays round him and a ring of fire at his feet
 *   pillar     Firebeast: fire rising from the floor up his body into a pillar that swallows him
 *   flare      the cast: a flare in his hand, warm fire ringed with green light of healing
 */
import type { Canvas, RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { afterimages, motes, puff, rays } from '../fx.js';
import { add3, at3, clamp, cross3, DEPTH, dot3, type FxContext, len3, lerp, norm3, rad, TO_CAMERA, type V3, weaponAxes } from '../rig.js';

/** The fire ramp, hottest first. */
export const WHITE_HOT: RGB = [255, 251, 232];
export const GOLD: RGB = [255, 224, 138];
export const FLAME: RGB = [255, 180, 60];
export const ORANGE: RGB = [255, 126, 38];
export const RED: RGB = [214, 66, 22];
export const DEEP: RGB = [132, 30, 12];
export const SMOKE: RGB = [104, 96, 100];
export const SMOKE_DARK: RGB = [64, 58, 62];
/** The shock of an explosion: pale violet, as in a flash of heat. */
export const VIOLET_PALE: RGB = [222, 214, 255];
export const VIOLET: RGB = [164, 146, 238];
/** Second Wind's light of healing. */
const GREEN: RGB = [120, 236, 132];
const GREEN_PALE: RGB = [214, 255, 190];

/** The ramp a swoosh cools through from its hot edge, by band. */
const RAMP: readonly RGB[] = [WHITE_HOT, GOLD, FLAME, ORANGE, RED, SMOKE];

/** His sword's working length (design.ts): where a swoosh reaches from and to along it. */
const REACH: readonly [number, number] = [8, 44.5];

type Extra = (x: FxContext) => void;

/** Runs several effect painters in turn. */
export const both =
  (...fs: (Extra | undefined)[]): Extra =>
  (x) => {
    for (const f of fs) f?.(x);
  };

/** The fire ramp at `t` (0 its white-hot root, 1 its deep-red tip). */
export function fireAt(t: number): RGB {
  if (t < 0.18) return WHITE_HOT;
  if (t < 0.4) return GOLD;
  if (t < 0.66) return FLAME;
  if (t < 0.86) return ORANGE;
  return RED;
}

/** Fills a screen polygon on an effects layer, leaving alone the pixels `skip` names. */
function fill(c: Canvas, q: readonly Vec[], col: RGB, a: number, under = false, skip?: (x: number, y: number) => boolean): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of q) {
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const xs: number[] = [];
    const yy = y + 0.5;
    for (let i = 0; i < q.length; i++) {
      const p = q[i] as Vec;
      const r = q[(i + 1) % q.length] as Vec;
      if ((p[1] <= yy && r[1] > yy) || (r[1] <= yy && p[1] > yy)) xs.push(p[0] + ((yy - p[1]) / (r[1] - p[1])) * (r[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      for (let px = Math.ceil((xs[j] as number) - 0.5); px <= Math.floor((xs[j + 1] as number) - 0.5); px++) if (!skip?.(px, y)) c.glow(px, y, col, clamp(a, 0, 1), under);
    }
  }
}

/** Is a screen pixel on his head (the face and hair stay readable through his swooshes)? */
const headSkip = (x: FxContext): ((px: number, py: number) => boolean) => {
  const h = x.proj(x.rig.head.o);
  return (px, py) => ((px + 0.5 - h[0]) / 12.5) ** 2 + ((py + 0.5 - h[1] + 2.5) / 15) ** 2 < 1;
};

/**
 * A swing seen edge on (a cut straight at the viewer) would smear into a sliver: as the engine's
 * own swooshes do (fx.ts), open it up on screen, round the grip at full reach the way the swing
 * turns as seen (or, through the grip, over the top for a falling cut and under for a rising one),
 * its depth running from the start's to the end's.
 */
function faceCamera(x: FxContext, dirs: V3[]): V3[] {
  const cam = x.cam;
  const end = dirs[dirs.length - 1] as V3;
  const start = dirs[0] as V3;
  let nrm = cross3(start, end);
  if (len3(nrm) < 0.05) nrm = cross3(dirs[Math.floor(dirs.length / 2)] as V3, end);
  if (len3(nrm) < 0.05) return dirs;
  nrm = norm3(nrm);
  if (Math.abs(dot3(nrm, norm3(cam.local(TO_CAMERA)))) >= 0.55) return dirs;
  const seen = dirs.map((d) => cam.vec(d));
  const rs = seen.map((v) => Math.hypot(v[0], v[1]));
  const rMax = Math.max(...rs);
  const S = seen[0] as Vec;
  const E = seen[seen.length - 1] as Vec;
  const aS = Math.atan2(S[1], S[0]);
  let sweep = Math.atan2(Math.sin(Math.atan2(E[1], E[0]) - aS), Math.cos(Math.atan2(E[1], E[0]) - aS));
  const other = sweep - Math.sign(sweep || 1) * Math.PI * 2;
  if (Math.min(...rs) > rMax * 0.35) {
    let turned = 0;
    for (let i = 1; i < seen.length; i++) {
      const a = seen[i - 1] as Vec;
      const b = seen[i] as Vec;
      turned += Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
    }
    if (Math.sign(turned) !== Math.sign(sweep)) sweep = other;
  } else {
    const midY = (sw: number): number => Math.sin(aS + sw / 2);
    if (E[1] > S[1] === midY(other) < midY(sweep)) sweep = other;
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
    return cam.local([Math.cos(a) * r, Z * DEPTH - Math.sin(a) * r, Z]);
  });
}

/**
 * Paints a blazing crescent swept round `centre` through the directions `dirs` (tail first), `rOut`
 * out and `thick` deep at its fullest: in bands from its outer (cutting) edge in, white-hot, gold,
 * orange and red, the whole of it cooling toward its tail (the bands shift down the ramp to red and
 * smoke) and fading a little. Parts behind him (`behind`) go under the figure.
 */
function blazeBands(x: FxContext, centre: V3, dirs: readonly V3[], rOut: number, thick: number, alpha: number, behind: (p: V3) => boolean, skip?: (px: number, py: number) => boolean): void {
  const n = dirs.length - 1;
  if (n < 1) return;
  const at = (dir: V3, r: number): Vec => {
    const p = add3(centre, dir, r);
    return x.proj(p[1] < 0.5 ? [p[0], 0.5, p[2]] : p);
  };
  const edges = [0, 0.13, 0.3, 0.52, 0.76, 1];
  const th = (k: number): number => thick * Math.pow(Math.sin((Math.min(1, k * 1.08) * Math.PI) / 2), 0.9);
  for (let i = 0; i < n; i++) {
    const k0 = i / n;
    const k1 = (i + 1) / n;
    const da = dirs[i] as V3;
    const db = dirs[i + 1] as V3;
    const under = behind(add3(centre, add3(da, db), rOut / 2));
    // Toward the tail the fire has cooled: its bands slide down the ramp.
    const cool = (1 - k1) * 2.6;
    const a = alpha * (0.55 + 0.45 * Math.pow(k1, 0.7));
    for (let b = 0; b < 5; b++) {
      const idx = Math.min(RAMP.length - 1, Math.floor(b + cool));
      const col = RAMP[idx] as RGB;
      const f0 = edges[b] as number;
      const f1 = edges[b + 1] as number;
      const q = [at(da, rOut - f0 * th(k0)), at(db, rOut - f0 * th(k1)), at(db, rOut - f1 * th(k1)), at(da, rOut - f1 * th(k0))];
      fill(x.c, q, col, a * (idx === RAMP.length - 1 ? 0.45 : b === 4 ? 0.8 : 1), under, skip);
    }
  }
}

/**
 * A slash's swoosh: the blazing crescent the blade's tip sweeps from the blade angle `from` (its
 * plane's `roll` and `yaw`, by default the pose's) to where it is in the pose, round the grip just
 * past its point, `width` of the blade deep (0 to 1, default 0.55), `alpha` its strength; opened
 * out on screen when the swing comes at the viewer, stopped at the floor, never over his head,
 * behind the figure where it passes behind him. Embers and smoke are shed off it (`seed`).
 */
export const fireArc =
  (s: { from: number; roll?: number; yaw?: number; width?: number; alpha?: number }, seed = 0): Extra =>
  (x) => {
    const p = x.rig.pose;
    const roll1 = p.roll ?? 0;
    const yaw1 = p.yaw ?? 0;
    const roll0 = s.roll ?? roll1;
    const yaw0 = s.yaw ?? yaw1;
    const turn = Math.max(Math.abs(p.weapon - s.from), Math.abs(roll1 - roll0), Math.abs(yaw1 - yaw0));
    const n = Math.max(2, Math.ceil(turn / 4));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      dirs.push(weaponAxes(lerp(s.from, p.weapon, k), lerp(roll0, roll1, k), lerp(yaw0, yaw1, k)).u);
    }
    const seen = faceCamera(x, dirs);
    const alpha = s.alpha ?? 1;
    blazeBands(x, x.rig.weapon.o, seen, REACH[1] + 2, (REACH[1] - REACH[0]) * (s.width ?? 0.55), alpha, x.behind, headSkip(x));
    // Embers thrown off the arc's outer edge, and smoke curling off its tail.
    const { c, hash } = x;
    for (let i = 0; i < 12; i++) {
      const t = hash(i, 131 + seed);
      const d = seen[Math.min(seen.length - 1, Math.round(t * (seen.length - 1)))] as V3;
      const q = x.proj(add3(x.rig.weapon.o, d, REACH[1] + 3 + hash(i, 132 + seed) * 7));
      const drift = hash(i, 133 + seed) * 4;
      if (t < 0.3) {
        puff(c, q[0], q[1] - drift, 1.4 + hash(i, 134) * 1.4, i % 2 ? SMOKE : SMOKE_DARK, 0.5 * alpha * (1 - t));
        continue;
      }
      c.glow(q[0], q[1] - drift, i % 3 ? GOLD : WHITE_HOT, Math.min(1, alpha * (0.5 + 0.6 * t)));
      c.glow(q[0], q[1] - drift + 1, ORANGE, Math.min(1, alpha * (0.35 + 0.5 * t)));
    }
  };

/**
 * A blazing ring laid level round him at `height`, `radius` out, from the angle `from` round him
 * to `to` (degrees in the frame of the pose's `turn`, as the engine's `fx.ring`: 0 the way he faces
 * at turn 0, 90 his right there), its faint tail at `from` and its hot head at `to`.
 */
export const fireRing =
  (from: number, to: number, height = 36, radius = 48, alpha = 1): Extra =>
  (x) => {
    const turn = x.rig.pose.turn ?? 0;
    const n = Math.max(2, Math.ceil(Math.abs(to - from) / 5));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = rad(lerp(from, to, i / n) - turn);
      dirs.push([Math.cos(a), 0, Math.sin(a)]);
    }
    const centre: V3 = [x.rig.pelvis.o[0], height, x.rig.pelvis.o[2]];
    const mid = x.depth(centre);
    blazeBands(x, centre, dirs, radius, radius * 0.42, alpha, (p) => x.depth(p) < mid - 1);
  };

/**
 * A tongue of fire `h` pixels tall rising from a screen point, `w` wide at its root and
 * wavering to its tip (`sway` -1 to 1 bends it), coloured hottest at the root.
 */
export function tongue(c: Canvas, x: number, y: number, h: number, w: number, sway: number, a: number, under = false): void {
  const n = Math.max(1, Math.round(h));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const half = w * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 2 + 0.3)));
    const cx = x + sway * t * t * h * 0.35;
    const cy = y - i;
    for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
      const edge = Math.abs(dx) / Math.max(0.5, half);
      if (edge > 1) continue;
      c.glow(cx + dx, cy, fireAt(Math.min(1, t * 0.85 + edge * 0.35)), a * (1 - t * 0.3), under);
    }
  }
}

/**
 * Flames licking up off the blade (strength k): tongues rising from its length (fire rises up the
 * screen whichever way the blade points), taller toward the point, with a soft orange halo under
 * the figure round the blade and embers drifting up off it.
 */
export const flames =
  (k: number, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const w = rig.weapon;
    for (let i = 0; i <= 12; i++) {
      const p = x.proj(add3(w.o, w.u, 9 + i * 3));
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) c.glow(p[0] + dx, p[1] + dy, dx * dx + dy * dy <= 1 ? FLAME : ORANGE, 0.35 * Math.min(1, k), true);
    }
    for (let i = 0; i < 11; i++) {
      const along = 10 + i * 3.3 + hash(i, 90 + seed) * 2;
      const p = x.proj(add3(add3(w.o, w.u, along), w.v, (hash(i, 91 + seed) - 0.3) * 2.5));
      const h = (3.5 + hash(i, 92 + seed) * 8) * k * (0.55 + 0.45 * (along / 44));
      tongue(c, p[0], p[1], h, 1.4 + hash(i, 94 + seed) * 1, hash(i, 93 + seed) * 2 - 1, Math.min(1, k * 1.5));
    }
    embers(Math.min(1, k * 0.9), seed, x.tip, 12)(x);
  };

/**
 * Embers (strength k): sparks drifting up round a point (hero space; by default round him, from
 * his knees to his head), `spread` pixels about it, each a hot pixel with a fainter one below it.
 */
export const embers =
  (k: number, seed = 0, at?: V3, spread = 22, n = 10): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const centre = at ?? add3(rig.pelvis.o, [0, 12, 0]);
    for (let i = 0; i < n; i++) {
      const rise = ((hash(i, 121) + seed * 0.13 * (0.6 + hash(i, 122))) % 1) * spread * 1.4;
      const p3: V3 = [centre[0] + (hash(i, 123) - 0.5) * spread, centre[1] - spread * 0.3 + rise, centre[2] + (hash(i, 124) - 0.5) * spread];
      const p = x.proj(p3);
      const a = Math.min(1, k * (1 - rise / (spread * 1.4)) * 1.2);
      const under = x.behind(p3) && Math.abs(p3[2] - centre[2]) > 4;
      c.glow(p[0], p[1], i % 3 === 0 ? WHITE_HOT : GOLD, a, under);
      c.glow(p[0], p[1] + 1, i % 2 ? ORANGE : RED, a * 0.7, under);
    }
  };

/**
 * Afterimages of him in his fire trailing a dash (strength k): copies of his silhouette behind him
 * on screen, the nearest orange, then red, the farthest a deep ember red, under the figure. Toward
 * or away from the viewer they trail up or down the screen, closer together.
 */
export const ghosts =
  (k: number, gap = 12): Extra =>
  (x) => {
    if (k <= 0) return;
    let v = x.cam.vec([-1, 0, 0]);
    const vl = Math.hypot(v[0], v[1]);
    const short = clamp(vl / 0.85, 0.5, 1);
    v = vl > 1e-3 ? [(v[0] / vl) * short, (v[1] / vl) * short] : [0, -short];
    const list: [RGB, number][] = [
      [DEEP, 0.45],
      [RED, 0.5],
      [ORANGE, 0.55],
    ];
    afterimages(
      x.c,
      list.map(([colour, a], i) => {
        const off = gap * (3 - i) * (0.5 + 0.5 * k);
        return { dx: Math.round(v[0] * off), dy: Math.round(v[1] * off), colour, alpha: a * k };
      }),
    );
  };

/** How a view sees his forward axis: side on, toward the viewer or away from them. */
function facing(x: FxContext): { side: boolean; away: boolean; dir: Vec } {
  const fv = x.cam.vec([1, 0, 0]);
  const fl = Math.hypot(fv[0], fv[1]);
  const side = fl > 0.45;
  return { side, away: !side && fv[1] < 0, dir: side ? [fv[0] / fl, fv[1] / fl] : [0, -1] };
}

/**
 * The Blazing Crescent: a great crescent of flame `d` pixels out ahead of his hips, `k` its
 * strength (1 as it leaves the blade, thinning as it flies on and the game's own crescent takes
 * over). It bows the way it flies: a white-hot leading edge, gold, his orange and a red inner edge,
 * flames licking back off it and embers behind. As a sprite artist would, it is drawn opened out
 * on screen in every view: side on it bows ahead of him at the sword's height; toward the viewer
 * it is an arch over his legs at hip height; away from the viewer a smaller arch beyond his head.
 * It is always painted over him.
 */
export const crescent =
  (d: number, k: number, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const { side, away, dir } = facing(x);
    const h = side ? 32 : away ? 62 + d * 0.1 : 22 + d * 0.26;
    const C = x.proj([rig.pelvis.o[0] + d, h, rig.pelvis.o[2]]);
    const across: Vec = [-dir[1], dir[0]];
    const R = (side ? 26 + d * 0.05 : away ? 17 - d * 0.04 : 21 + d * 0.08) * (0.7 + 0.3 * k);
    const wide = side ? 1.05 : 1.3;
    const thick = 0.45 + 0.55 * k;
    const at = (t: number, f: number): Vec => {
      const a = rad(lerp(-80, 80, t));
      const r = R * (1 - 0.4 * f * thick);
      const back = R * 0.55 + R * 0.16 * f * thick;
      const along = Math.cos(a) * r - back;
      const off = Math.sin(a) * r * wide;
      return [C[0] + dir[0] * along + across[0] * off, C[1] + dir[1] * along + across[1] * off];
    };
    const bands: [number, number, RGB][] = [
      [0, 0.14, WHITE_HOT],
      [0.14, 0.34, GOLD],
      [0.34, 0.62, FLAME],
      [0.62, 0.84, ORANGE],
      [0.84, 1, RED],
    ];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const th = (t: number): number => Math.pow(Math.sin(Math.PI * t), 0.7);
      for (const [f0, f1, col] of bands) fill(c, [at(t0, f0 * th(t0)), at(t1, f0 * th(t1)), at(t1, f1 * th(t1)), at(t0, f1 * th(t0))], col, Math.min(1, 0.45 + k));
    }
    // Flames licking back off its inner edge, embers trailing behind.
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + hash(i, 140 + seed) * 0.76;
      const p = at(t, Math.pow(Math.sin(Math.PI * t), 0.7) * 0.9);
      const len = (4 + hash(i, 141 + seed) * 13) * (0.5 + 0.5 * k) * (0.5 + Math.sin(Math.PI * t));
      const wd = 1.5 + hash(i, 143 + seed) * 2;
      const tip: Vec = [p[0] - dir[0] * len - across[0] * (t - 0.5) * 6, p[1] - dir[1] * len - across[1] * (t - 0.5) * 6 - hash(i, 142 + seed) * 3];
      fill(c, [[p[0] - across[0] * wd, p[1] - across[1] * wd], [p[0] + across[0] * wd, p[1] + across[1] * wd], tip], i % 2 ? ORANGE : RED, 0.9 * Math.min(1, k + 0.3));
      c.glow(tip[0] - dir[0] * 3, tip[1] - 2, GOLD, 0.9 * k);
      c.glow(tip[0] - dir[0] * 6, tip[1] - 3, ORANGE, 0.7 * k);
    }
  };

/**
 * Inferno Burst's fireball at a point (hero space), `k` how far it has bloomed (0 a spark, 1 full
 * size), `fade` (0 to 1) how far it has burnt out into smoke, `R` its full radius in pixels: a
 * white-hot heart, gold, orange and a ragged red rim of licking flame, a pale violet shock ring
 * flying out round it (`ring` 0 to 1 how far; a ring standing square to his forward axis, so side
 * on it is a tall ellipse and front on a circle), embers and smoke. Behind him (seen from behind)
 * it goes under the figure.
 */
export const fireball =
  (at: V3, k: number, fade = 0, R = 22, ring = -1): Extra =>
  (x) => {
    const { c, hash } = x;
    const P = x.proj(at);
    const under = x.behind(at);
    const r = R * (0.35 + 0.65 * clamp(k, 0, 1)) * (1 + fade * 0.25);
    const hot = 1 - fade;
    const reach = Math.ceil(r * 1.35);
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const d = Math.hypot(dx, dy * 1.08);
        const ang = Math.atan2(dy, dx);
        const lick = 1 + 0.2 * Math.sin(ang * 7 + k * 5) + 0.12 * (hash(Math.round(ang * 9) + 40, 151) - 0.5) + (dy < 0 ? 0.08 : 0);
        const t = d / (r * lick);
        if (t > 1) continue;
        // Burning out, the heart cools first and the ball goes to smoke from the inside.
        const tt = clamp(t + fade * 0.7, 0, 1.2);
        const col: RGB = tt < 0.28 ? WHITE_HOT : tt < 0.5 ? GOLD : tt < 0.72 ? FLAME : tt < 0.9 ? ORANGE : tt < 1 ? RED : SMOKE;
        const a = fade > 0.55 ? (1 - fade) * 2.2 : 1;
        c.glow(P[0] + dx, P[1] + dy, col, clamp(a * (t > 0.92 ? 0.75 : 1), 0, 1), under);
      }
    }
    const ringK = ring >= 0 ? ring : clamp(k * 0.6 + fade * 0.7, 0, 1);
    if (ringK > 0.05) {
      const { side } = facing(x);
      const ex = side ? 0.42 : 1;
      const rr = R * (0.9 + 1.0 * ringK);
      const ra = 1 - ringK * 0.75;
      const n = Math.ceil(rr * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        for (const [dr, col, al] of [[0, VIOLET_PALE, 0.95], [1, VIOLET, 0.7], [-1, WHITE_HOT, 0.5], [2, VIOLET, 0.3]] as [number, RGB, number][]) {
          c.glow(P[0] + Math.cos(th) * (rr + dr) * ex, P[1] + Math.sin(th) * (rr + dr), col, al * ra, under);
        }
      }
      // A pale haze inside the ring as the heat flashes out.
      if (fade > 0) {
        for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
          for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
            if (Math.hypot(dx / ex, dy) > rr || Math.hypot(dx, dy) < r * 0.9) continue;
            if ((dx + dy) % 2 === 0) c.glow(P[0] + dx, P[1] + dy, VIOLET_PALE, 0.16 * ra, under);
          }
        }
      }
    }
    for (let i = 0; i < 14; i++) {
      const th = hash(i, 152) * Math.PI * 2;
      const d = r * (0.9 + hash(i, 153) * 0.8) + fade * 10;
      const px = P[0] + Math.cos(th) * d;
      const py = P[1] + Math.sin(th) * d * 0.9 - fade * 5;
      const a = clamp(1.2 * hot * Math.min(1, k * 2), 0, 1);
      c.glow(px, py, i % 3 ? GOLD : WHITE_HOT, a, under);
      c.glow(px, py + 1, ORANGE, a * 0.7, under);
    }
    if (fade > 0) {
      for (let i = 0; i < 6; i++) {
        const px = P[0] + (hash(i, 154) - 0.5) * r * 1.6;
        const py = P[1] - r * (0.5 + 0.6 * hash(i, 155)) - fade * 8;
        puff(c, px, py, 2.5 + hash(i, 156) * 2.5 + fade * 2, i % 2 ? SMOKE : SMOKE_DARK, 0.55 * fade * (1.3 - fade), under);
      }
    }
  };

/**
 * Flashfire's wake (strength k): a lane of fire on the floor behind him (`len` pixels back from
 * his feet, burning lower toward its far end), tongues of flame standing up off it, and embers.
 * What of it is behind him goes under the figure.
 */
export const trailFire =
  (k: number, len = 70, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const g: V3 = [rig.pelvis.o[0] - 4, 0, rig.pelvis.o[2]];
    const n = Math.ceil(len / 1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p3: V3 = [g[0] - t * len, 0, g[2] + Math.sin(t * 9 + seed) * 2];
      const p = x.proj(p3);
      const under = x.behind(p3);
      const a = Math.min(1, k * (1.1 - t * 0.7));
      const fade = 1 - t * 0.6;
      for (let w = -2; w <= 2; w++) c.glow(p[0], p[1] + w * 0.7, Math.abs(w) < 1 ? WHITE_HOT : Math.abs(w) < 2 ? GOLD : ORANGE, a * (Math.abs(w) < 2 ? 0.95 : 0.6), under);
      // A low, rolling band of flame along it, and now and then a tall tongue.
      const low = (2.5 + 2 * Math.sin(t * 23 + seed * 1.7) + 1.5 * Math.sin(t * 57 - seed)) * fade * Math.min(1, k * 1.2);
      if (i % 2 === 0) tongue(c, p[0], p[1], Math.max(1, low), 1.3, -0.4, a, under);
      if (hash(i, 162 + seed) > 0.86) tongue(c, p[0], p[1], (8 + hash(i, 163 + seed) * 11) * fade * Math.min(1, k * 1.2), 1.9, -0.7 + hash(i, 164 + seed) * 0.5, a, under);
    }
  };

/**
 * Kindle (strength k): a gold starburst of rays round him, turned `spin` degrees, embers rising
 * and a ring of fire running round his feet.
 */
export const kindle =
  (k: number, spin = 0, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const gold = { core: [255, 206, 84] as RGB, edge: [255, 150, 40] as RGB, hot: [255, 250, 220] as RGB };
    const neckY = x.proj(x.rig.neck)[1];
    const skip = (px: number, py: number): boolean => x.c.opaque(px, py) && py < neckY;
    rays({ ...x, aura: gold }, at3(x.rig.chest, 0, 14, 0), k, { n: 16, len: 52, spin, behind: true, skip });
    rays({ ...x, aura: gold }, at3(x.rig.chest, 0, 14, 0), k * 0.5, { n: 8, len: 40, spin: spin + 11, skip });
    const { c, rig, hash } = x;
    const g = rig.pelvis.o;
    for (let i = 0; i < 20; i++) {
      const th = (i / 20) * Math.PI * 2 + rad(spin);
      const p3: V3 = [g[0] + Math.cos(th) * 15, 0, g[2] + Math.sin(th) * 15];
      const p = x.proj(p3);
      tongue(c, p[0], p[1], (3 + hash(i, 171 + seed) * 7) * Math.min(1.2, k), 1.4, hash(i, 172 + seed) - 0.5, 0.9 * Math.min(1, k), x.behind(p3));
    }
    embers(Math.min(1, k), seed, undefined, 30, 14)(x);
  };

/**
 * Firebeast (k 0 to about 1.3): fire rises from the floor up his body, `k` how high it has climbed
 * (1 just over the top of his hair), into a pillar of flame that swallows him: a column of fire
 * behind him as wide as he is, ragged and flickering, and over him the flame thickening the longer
 * it has burnt there, from a veil he shows through to, past k 1, nearly solid flame. Tongues lick
 * up off its top, a ring of fire burns round his feet, embers fly.
 */
export const pillar =
  (k: number, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    // His extent on screen, as painted.
    let x0 = c.w;
    let x1 = -1;
    let y0 = c.h;
    let y1 = -1;
    for (let y = 0; y < c.h; y++) {
      for (let px = 0; px < c.w; px++) {
        if (!c.opaque(px, y)) continue;
        if (px < x0) x0 = px;
        if (px > x1) x1 = px;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const foot = x.proj(g);
    const cx = lerp((x0 + x1) / 2, foot[0], 0.3);
    const half = Math.max(16, Math.min(26, (x1 - x0) / 2 + 3));
    const bottom = Math.max(y1, foot[1]) + 1;
    const tall = bottom - y0 + 8;
    // The fire line: everything below it burns. Over the last 30 pixels below it the pillar
    // narrows to a rounded, flickering point, as a flame does.
    const line = bottom - tall * k;
    const w = (y: number): number => {
      const top = clamp((y - line) / Math.max(8, Math.min(30, tall * k * 0.6)), 0, 1);
      const flick = 0.9 + 0.08 * Math.sin(y * 0.21 + seed * 2.1) + 0.06 * Math.sin(y * 0.53 - seed * 1.3);
      return half * flick * (0.12 + 0.88 * Math.sqrt(top)) * (y > bottom - 6 ? 1.12 : 1);
    };
    for (let y = Math.floor(line); y <= Math.ceil(bottom); y++) {
      const hw = w(y);
      const depthIn = clamp((y - line) / 22, 0, 1);
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const px = Math.round(cx + dx);
        const flick = hash(Math.floor(px / 2) + 60, Math.floor((y + seed * 5) / 3) + seed * 7);
        const r = Math.abs(dx + 0.5) / hw + (flick - 0.5) * 0.16;
        if (r > 1) continue;
        const col = r < 0.22 ? WHITE_HOT : r < 0.45 ? GOLD : r < 0.68 ? FLAME : r < 0.88 ? ORANGE : RED;
        if (c.opaque(px, y)) {
          // Over him: a veil where it has just caught, thickening to nearly solid flame.
          const a = clamp(0.25 + depthIn * (k - 0.1) * 0.95 + (flick - 0.5) * 0.2, 0.2, 0.97);
          c.glow(px, y, col, a);
        } else {
          c.glow(px, y, col, clamp(0.7 + depthIn * 0.3, 0, 1) * Math.min(1, k * 2.5), true);
        }
      }
    }
    // Tongues licking up off its rounded top and its sides.
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.5) / 11;
      const dx = (t - 0.5) * 2 * half * 0.85;
      let by = line;
      while (by < bottom && w(by) < Math.abs(dx) + 1) by++;
      const h = (8 + hash(i, 183 + seed) * 14) * (1.1 - Math.abs(t - 0.5));
      tongue(c, cx + dx, by + 3, h, 2 + hash(i, 184) * 1.8, (t - 0.5) * 1.2 + (hash(i, 185 + seed) - 0.5), 0.95);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const yy = lerp(line + 26, bottom - 4, hash(i, 188 + seed));
      tongue(c, cx + side * (w(yy) - 1), yy, 5 + hash(i, 189 + seed) * 8, 1.6, side * 0.8, 0.9);
    }
    // The ring of fire on the floor round him where it began.
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * Math.PI * 2;
      const p3: V3 = [g[0] + Math.cos(th) * (half + 2), 0, g[2] + Math.sin(th) * (half + 2)];
      const p = x.proj(p3);
      tongue(c, p[0], p[1], (4 + hash(i, 186 + seed) * 8) * Math.min(1, k * 2), 1.6, hash(i, 187 + seed) - 0.5, 0.9, x.behind(p3));
    }
    embers(Math.min(1, k), seed, [g[0], 40, g[2]], 46, 16)(x);
  };

/**
 * The cast's flare (k 0 to 1) in his left hand: a burst of warm fire round his fist (Bloodrush),
 * ringed in green light of healing (`green` 0 to 1: Second Wind, the Elixir), with green motes
 * rising round him (`rise` lifts them: advance it every frame).
 */
export const flare =
  (k: number, rise = 0, green = 1): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const P = x.proj(rig.armL.end);
    const under = x.behind(rig.armL.end);
    const r = 3 + 4.5 * Math.min(1, k);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1) continue;
        c.glow(P[0] + dx, P[1] + dy, d < 0.3 ? WHITE_HOT : d < 0.6 ? GOLD : FLAME, (d < 0.6 ? 0.95 : 0.6) * Math.min(1, k * 1.5), under);
      }
    }
    for (let i = 0; i < 6; i++) tongue(c, P[0] + (hash(i, 191) - 0.5) * r * 1.4, P[1] - r * 0.4, (5 + hash(i, 192) * 8) * k, 1.4, hash(i, 193) - 0.5, 0.95, under);
    if (green > 0) {
      const rr = r + 3 + 5 * k;
      for (let i = 0; i < 44; i++) {
        const th = (i / 44) * Math.PI * 2;
        const a = green * Math.min(1, k * 1.4);
        c.glow(P[0] + Math.cos(th) * rr, P[1] + Math.sin(th) * rr, GREEN_PALE, 0.85 * a, under);
        c.glow(P[0] + Math.cos(th) * (rr + 1), P[1] + Math.sin(th) * (rr + 1), GREEN, 0.55 * a, under);
      }
      motes({ ...x, aura: { core: GREEN, edge: GREEN, hot: GREEN_PALE } }, green * Math.min(1, k * 1.2), { n: 16, rise });
    }
  };
