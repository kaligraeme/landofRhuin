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
import type { Canvas, RGB, Vec } from '../../paint.js';
import { motes, puff, starburst } from '../fx.js';
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
const REACH: readonly [number, number] = [9, 45.5];

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

/**
 * Fills a screen polygon on an effects layer, leaving alone the pixels `skip` names; `veil` (0 to
 * 1) thins it where it lies over the figure, so he shows through fire passing in front of him.
 */
function fill(c: Canvas, q: readonly Vec[], col: RGB, a: number, under = false, skip?: (x: number, y: number) => boolean, veil = 1): void {
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
      for (let px = Math.ceil((xs[j] as number) - 0.5); px <= Math.floor((xs[j + 1] as number) - 0.5); px++) {
        if (skip?.(px, y)) continue;
        c.glow(px, y, col, clamp(veil < 1 && !under && c.opaque(px, y) ? a * veil : a, 0, 1), under);
      }
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
 * smoke) and fading a little. Parts behind him (`behind`) go under the figure; `veil` thins what
 * passes in front of him.
 */
function blazeBands(x: FxContext, centre: V3, dirs: readonly V3[], rOut: number, thick: number, alpha: number, behind: (p: V3) => boolean, skip?: (px: number, py: number) => boolean, veil = 1): void {
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
      fill(x.c, q, col, a * (idx === RAMP.length - 1 ? 0.45 : b === 4 ? 0.8 : 1), under, skip, veil);
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
      const q3 = add3(x.rig.weapon.o, d, REACH[1] + 3 + hash(i, 132 + seed) * 7);
      // Nothing is shed below the floor.
      if (q3[1] < 1) continue;
      const q = x.proj(q3);
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
 * The finisher's great sweep: a broad blazing band round him from the angle `from` to `to` (as
 * `fireRing`: degrees in the frame of the pose's turn, its tail at `from` and its hot head at
 * `to`), `radius` out at `height`, `thick` of the radius deep, its plane tipped `dip` degrees down
 * on the side toward the viewer (in every view) and `bank` degrees up on his right, so it reads as a tall slanted ellipse rather
 * than a flat line at his hips. White-hot along its leading (outer) edge, gold and orange through
 * its body, cooling to red and smoke at its tail; tongues of flame and embers stream off its
 * trailing (inner) edge, and a ring of embers and scorch smoulders on the floor under it.
 */
export const sweep =
  (from: number, to: number, o: { height?: number; radius?: number; thick?: number; dip?: number; bank?: number; alpha?: number; seed?: number } = {}): Extra =>
  (x) => {
    const { c, rig, hash } = x;
    const turn = rig.pose.turn ?? 0;
    const radius = o.radius ?? 50;
    const alpha = o.alpha ?? 1;
    const seed = o.seed ?? 0;
    const dip = rad(o.dip ?? 0);
    const bank = rad(o.bank ?? 0);
    // Which way the viewer is, level: the band tips down on that side in every view.
    const cv = x.cam.local(TO_CAMERA);
    const hl = Math.hypot(cv[0], cv[2]) || 1;
    const hx = cv[0] / hl;
    const hz = cv[2] / hl;
    const tip = (d: V3): V3 => {
      // Tipped down on the side toward the viewer, then banked up on his right (about his forward axis).
      const along = d[0] * hx + d[2] * hz;
      const k = along * (1 - Math.cos(dip));
      const a: V3 = [d[0] - hx * k, -along * Math.sin(dip), d[2] - hz * k];
      return [a[0], a[1] * Math.cos(bank) + a[2] * Math.sin(bank), -a[1] * Math.sin(bank) + a[2] * Math.cos(bank)];
    };
    const n = Math.max(2, Math.ceil(Math.abs(to - from) / 4));
    const dirs: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const a = rad(lerp(from, to, i / n) - turn);
      dirs.push(tip([Math.cos(a), 0, Math.sin(a)]));
    }
    const centre: V3 = [rig.pelvis.o[0], o.height ?? 34, rig.pelvis.o[2]];
    const mid = x.depth(centre);
    const behind = (p: V3): boolean => x.depth(p) < mid - 1;
    blazeBands(x, centre, dirs, radius, radius * (o.thick ?? 0.7), alpha, behind, headSkip(x), 0.5);
    // Tongues of flame and embers streaming off the trailing edge, more toward the hot head.
    const inner = radius * (1 - (o.thick ?? 0.7) * 0.85);
    for (let i = 0; i < 14; i++) {
      const t = 0.25 + 0.75 * hash(i, 221 + seed);
      const d = dirs[Math.round(t * n)] as V3;
      const p3 = add3(centre, d, inner + hash(i, 222 + seed) * 4);
      const p = x.proj(p3[1] < 1 ? [p3[0], 1, p3[2]] : p3);
      tongue(c, p[0], p[1], (4 + hash(i, 223 + seed) * 9) * t * alpha, 1.5 + hash(i, 224 + seed), hash(i, 225 + seed) * 2 - 1, Math.min(1, alpha * 1.2), behind(p3));
      const q = x.proj(add3(centre, d, radius + 2 + hash(i, 226 + seed) * 6));
      c.glow(q[0], q[1] - hash(i, 227 + seed) * 3, i % 3 ? GOLD : WHITE_HOT, alpha * t, behind(p3));
    }
    // Embers and scorch on the floor where it swept.
    for (let i = 0; i < 22; i++) {
      const a = rad(lerp(from, to, hash(i, 228 + seed)) - turn);
      const r = radius * (0.55 + 0.35 * hash(i, 229 + seed));
      const g: V3 = [rig.pelvis.o[0] + Math.cos(a) * r, 0, rig.pelvis.o[2] + Math.sin(a) * r];
      const p = x.proj(g);
      const under = behind(g);
      if (i % 3 === 0) puff(c, p[0], p[1], 1.6 + hash(i, 230 + seed), SMOKE_DARK, 0.45 * alpha, true);
      c.glow(p[0], p[1], i % 2 ? ORANGE : RED, 0.85 * alpha, under);
      c.glow(p[0] + 1, p[1], i % 4 ? RED : GOLD, 0.6 * alpha, under);
    }
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
 * Flames licking up off the blade (strength k): tongues rising from its edge (fire rises up the
 * screen whichever way the blade points), taller toward the point, and embers drifting up off it.
 * Ablaze (k over about 0.6, in his moves) a soft orange halo burns under the figure round the
 * blade and the tongues run its whole length; at rest only a few flicker near the point, so the
 * dark steel still reads as a sword.
 */
export const flames =
  (k: number, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const w = rig.weapon;
    const halo = clamp((k - 0.55) * 0.7, 0, 0.32);
    if (halo > 0) {
      for (let i = 0; i <= 12; i++) {
        const p = x.proj(add3(add3(w.o, w.u, 10 + i * 3), w.v, 2));
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5) c.glow(p[0] + dx, p[1] + dy, dx * dx + dy * dy <= 1 ? FLAME : ORANGE, halo, true);
      }
    }
    // At rest the tongues keep to the outer half of the blade.
    const from = k < 0.6 ? 24 : 11;
    const n = k < 0.6 ? 6 : 11;
    for (let i = 0; i < n; i++) {
      const along = from + i * ((44 - from) / n) + hash(i, 90 + seed) * 2;
      const p = x.proj(add3(add3(w.o, w.u, along), w.v, 2.2 + hash(i, 91 + seed) * 1.2));
      const h = (3.5 + hash(i, 92 + seed) * 8) * k * (0.55 + 0.45 * (along / 44));
      // Off a blade held beyond him (seen from behind, raised in front of him) the figure hides
      // them, but where they lick out past him.
      tongue(c, p[0], p[1], h, 1.3 + hash(i, 94 + seed) * 1, hash(i, 93 + seed) * 2 - 1, Math.min(1, k * 1.5), x.behind(add3(w.o, w.u, along)));
    }
    embers(Math.min(1, k * 0.9), seed, x.tip, 12)(x);
  };

/**
 * The blade's point scraping the floor (strength k): a short curved streak of white-hot and gold
 * sparks along the floor behind where the point now is (`back` pixels of it, curving up at its
 * start), and a few sparks thrown up and forward off it.
 */
export const scrape =
  (k: number, back = 16, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, hash, tip } = x;
    const g: V3 = [tip[0], Math.max(0.5, tip[1]), tip[2]];
    const n = Math.ceil(back * 1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p3: V3 = [g[0] - t * back, 0.5 + t * t * 6, g[2] + Math.sin(t * 2.2) * 2];
      const p = x.proj(p3);
      const a = k * (1 - t * 0.75);
      c.glow(p[0], p[1], t < 0.3 ? WHITE_HOT : t < 0.6 ? GOLD : ORANGE, a);
      c.glow(p[0], p[1] + 1, t < 0.5 ? FLAME : RED, a * 0.6);
    }
    for (let i = 0; i < 8; i++) {
      const p = x.proj([g[0] + hash(i, 241 + seed) * 6, 1 + hash(i, 242 + seed) * 9, g[2] + (hash(i, 243 + seed) - 0.5) * 6]);
      c.glow(p[0], p[1], i % 2 ? GOLD : WHITE_HOT, k);
    }
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
 * Afterimages of him in his fire trailing a dash (strength k): two or three copies of his outline
 * spaced out behind him on screen, each an ember edge (gold on the nearest, then orange, then red)
 * round a dark, see-through inside, each fainter than the one before, under the figure so he stays
 * clean. Toward or away from the viewer the dash runs along the screen's depth, so two small, faint
 * copies are set off to one side and a little back, clear of his head, rather than stacked over it.
 */
export const ghosts =
  (k: number, gap = 15): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c } = x;
    const { side } = facing(x);
    const v = x.cam.vec([-1, 0, 0]);
    const vl = Math.hypot(v[0], v[1]) || 1;
    // On screen: straight back side on; toward or away from the viewer off to his right and up.
    const step: Vec = side ? [(v[0] / vl) * gap, (v[1] / vl) * gap] : [gap * 0.62 * (x.cam.vec([0, 0, 1])[0] > 0 ? 1 : -1), -gap * 0.2];
    const copies: [RGB, RGB, number][] = side
      ? [
          [GOLD, ORANGE, 0.9],
          [ORANGE, RED, 0.62],
          [RED, DEEP, 0.4],
        ]
      : [
          [GOLD, ORANGE, 0.55],
          [ORANGE, RED, 0.34],
        ];
    // How deep inside the silhouette each pixel lies: 1 on its edge, 2 just inside, 3 deeper.
    const W = c.w;
    const H = c.h;
    const inside = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) if (c.opaque(px, y)) inside[y * W + px] = 3;
    for (let pass = 1; pass <= 2; pass++) {
      for (let y = 0; y < H; y++) {
        for (let px = 0; px < W; px++) {
          const i = y * W + px;
          if ((inside[i] as number) < 3) continue;
          const nb = [px > 0 ? inside[i - 1] : 0, px < W - 1 ? inside[i + 1] : 0, y > 0 ? inside[i - W] : 0, y < H - 1 ? inside[i + W] : 0];
          if (nb.some((q) => (q as number) < pass)) inside[i] = pass;
        }
      }
    }
    const inner: RGB = [44, 18, 14];
    for (let j = copies.length - 1; j >= 0; j--) {
      const [edge, mid, a] = copies[j] as [RGB, RGB, number];
      const dx = Math.round(step[0] * (j + 1) * (0.55 + 0.45 * k));
      const dy = Math.round(step[1] * (j + 1) * (0.55 + 0.45 * k));
      for (let y = 0; y < H; y++) {
        for (let px = 0; px < W; px++) {
          const d = inside[y * W + px] as number;
          if (!d) continue;
          const col = d === 1 ? edge : d === 2 ? mid : inner;
          c.glow(px + dx, y + dy, col, a * k * (d === 1 ? 1 : d === 2 ? 0.7 : 0.32), true);
        }
      }
    }
  };

/** How a view sees his forward axis: side on, toward the viewer or away from them, and which way it runs on screen. */
function facing(x: FxContext): { side: boolean; away: boolean; dir: Vec } {
  const fv = x.cam.vec([1, 0, 0]);
  const fl = Math.hypot(fv[0], fv[1]);
  const side = fl > 0.45;
  return { side, away: !side && fv[1] < 0, dir: side ? [fv[0] / fl, fv[1] / fl] : fv[1] < 0 ? [0, -1] : [0, 1] };
}

/**
 * The Blazing Crescent just as it leaves the blade, `out` pixels on from where it is born and `k`
 * its strength (1 as it is born, thinning as it flies on): the game draws the crescent in flight,
 * so the sprite shows only its birth and first moment. A crescent of flame bowed the way it flies,
 * a white-hot leading edge, gold, his orange and a red inner edge, flames trailing back off its
 * inner edge. Drawn as a sprite artist would in each view: side on it stands ahead of him, born
 * off the end of the rising slash; toward the viewer it is a flat, bright sliver leaving low and
 * toward them below his feet; away from them a smaller arch flying off beyond his head. It is
 * always painted over him.
 */
export const crescent =
  (out: number, k: number, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const { side, away, dir } = facing(x);
    const g = rig.pelvis.o;
    // Where it is centred (hero space), its size, how wide it spreads across and how flat it
    // lies along its flight on screen (seen end on, a crescent flying at or from the viewer is
    // foreshortened to a sliver).
    const C = side ? x.proj([g[0] + 44 + out, 40, g[2]]) : away ? x.proj([g[0] + 12 + out, 86, g[2]]) : x.proj([g[0] + 22 + out, 0, g[2]]);
    const R = (side ? 25 : away ? 15 : 21) * (0.8 + 0.2 * k);
    const wide = side ? 1.05 : away ? 1.25 : 1.45;
    const flatten = side ? 1 : away ? 0.6 : 0.42;
    const thick = side ? 0.35 + 0.65 * k : 0.22 + 0.4 * k;
    const across: Vec = [-dir[1], dir[0]];
    const at = (t: number, f: number): Vec => {
      const a = rad(lerp(-80, 80, t));
      const r = R * (1 - 0.4 * f * thick);
      const back = R * 0.55 + R * 0.16 * f * thick;
      const along = (Math.cos(a) * r - back) * flatten;
      const off = Math.sin(a) * r * wide;
      return [C[0] + dir[0] * along + across[0] * off, C[1] + dir[1] * along + across[1] * off];
    };
    const bands: [number, number, RGB][] = [
      [0, 0.16, WHITE_HOT],
      [0.16, 0.36, GOLD],
      [0.36, 0.62, FLAME],
      [0.62, 0.84, ORANGE],
      [0.84, 1, RED],
    ];
    const n = 28;
    const th = (t: number): number => Math.pow(Math.sin(Math.PI * t), 0.7);
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      for (const [f0, f1, col] of bands) fill(c, [at(t0, f0 * th(t0)), at(t1, f0 * th(t1)), at(t1, f1 * th(t1)), at(t0, f1 * th(t0))], col, Math.min(1, 0.5 + k));
    }
    // Flames trailing back off its inner edge (shorter seen end on; none flying away from the
    // viewer, where they would hang under it as drips), embers behind them.
    const trailK = side ? 1 : away ? 0 : 0.45;
    for (let i = 0; i < 7 && trailK > 0; i++) {
      const t = 0.14 + hash(i, 140 + seed) * 0.72;
      const p = at(t, th(t) * 0.9);
      const len = (4 + hash(i, 141 + seed) * 12) * (0.5 + 0.5 * k) * (0.5 + Math.sin(Math.PI * t)) * trailK;
      const wd = 1.4 + hash(i, 143 + seed) * 1.8;
      const tip: Vec = [p[0] - dir[0] * len - across[0] * (t - 0.5) * 6, p[1] - dir[1] * len - across[1] * (t - 0.5) * 6 - (side ? hash(i, 142 + seed) * 3 : 0)];
      fill(c, [[p[0] - across[0] * wd, p[1] - across[1] * wd], [p[0] + across[0] * wd, p[1] + across[1] * wd], tip], i % 2 ? ORANGE : FLAME, 0.9 * Math.min(1, k + 0.3));
      c.glow(tip[0] - dir[0] * 3, tip[1] - dir[1] * 3 - 1, GOLD, 0.9 * k);
      c.glow(tip[0] - dir[0] * 5, tip[1] - dir[1] * 5 - 2, ORANGE, 0.7 * k);
    }
  };

/**
 * Inferno Burst's fireball, blooming at the sword's point, `k` how far it has bloomed (0 a spark, 1
 * full size), `fade` (0 to 1) how far it has burnt out into smoke, `R` its full radius in pixels: a
 * white-hot heart, gold, orange and a ragged red rim of licking flame, a pale violet shock ring
 * flying out round it (`ring` 0 to 1 how far), embers and smoke. Side on it blooms at `at` (hero
 * space) ahead of the thrust, its ring standing square to his forward axis (a tall ellipse). The
 * game draws the great blast at the target itself, so in the other views this is the smaller bloom
 * at the point, placed where it never covers him: toward the viewer low and just below his feet,
 * its ring a wide ellipse on the floor; away from them over and beyond his head, painted over him.
 */
export const fireball =
  (at: V3, k: number, fade = 0, R0 = 22, ring = -1): Extra =>
  (x) => {
    const { c, hash, rig } = x;
    const { side, away } = facing(x);
    const g = rig.pelvis.o;
    const spot: V3 = side ? at : away ? [g[0] + (at[0] - g[0]) * 0.55, at[1] + 58, at[2]] : [g[0] + (at[0] - g[0]) * 0.72, 7, at[2]];
    const R = side ? R0 : R0 * 0.62;
    const P = x.proj(spot);
    const under = side && x.behind(spot);
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
      const ex = side ? 0.42 : 1;
      const ey = side ? 1 : away ? 0.62 : 0.42;
      const rr = R * (0.9 + 1.0 * ringK) * (side ? 1 : 1.35);
      const ra = 1 - ringK * 0.75;
      const n = Math.ceil(rr * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        for (const [dr, col, al] of [[0, VIOLET_PALE, 0.95], [1, VIOLET, 0.7], [-1, WHITE_HOT, 0.5], [2, VIOLET, 0.3]] as [number, RGB, number][]) {
          c.glow(P[0] + Math.cos(th) * (rr + dr) * ex, P[1] + Math.sin(th) * (rr + dr) * ey, col, al * ra, under);
        }
      }
      // A pale haze inside the ring as the heat flashes out.
      if (fade > 0) {
        for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
          for (let dx = -Math.ceil(rr); dx <= Math.ceil(rr); dx++) {
            if (Math.hypot(dx / ex, dy / ey) > rr || Math.hypot(dx, dy) < r * 0.9) continue;
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
 * Flashfire's wake (strength k): a straight lane of small flames on the floor behind him (`len`
 * pixels back from his feet, burning lower toward its far end), each standing on a glowing scorch,
 * now and then a tall one. What of it is behind him goes under the figure.
 */
export const trailFire =
  (k: number, len = 70, seed = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const g: V3 = [rig.pelvis.o[0] - 4, 0, rig.pelvis.o[2]];
    // Toward or away from the viewer the lane is seen end on: there it is a broader patch of
    // burning floor, so it never reads as a line trailing from his feet.
    const { side } = facing(x);
    const spread = side ? 3 : 13;
    const n = Math.ceil(len / (side ? 3.5 : 2.5));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p3: V3 = [g[0] - t * len * (side ? 1 : 0.7), 0, g[2] + (hash(i, 161 + seed) - 0.5) * spread];
      const p = x.proj(p3);
      const under = x.behind(p3);
      const a = Math.min(1, k * (1.1 - t * 0.7));
      const fade = 1 - t * 0.6;
      // A glowing scorch on the floor, and a small flame standing up off it; now and then a tall one.
      c.glow(p[0], p[1], ORANGE, a * 0.7, under);
      c.glow(p[0] + 1, p[1], RED, a * 0.5, under);
      tongue(c, p[0], p[1], (3 + hash(i, 165 + seed) * 4) * fade * Math.min(1, k * 1.2), 1.3, -0.5 + hash(i, 166 + seed) * 0.4, a, under);
      if (hash(i, 162 + seed) > 0.8) tongue(c, p[0], p[1], (7 + hash(i, 163 + seed) * 9) * fade * Math.min(1, k * 1.2), 1.8, -0.7 + hash(i, 164 + seed) * 0.5, a, under);
    }
  };

/**
 * Kindle (strength k): a gold starburst round him, `push` (0 to 1) how far its rays have pushed
 * out from him: ten long, tapering rays of opaque gold alternating with ten short ones, white-hot
 * near him, turned `spin` degrees and shining out from behind him (so they never cross his face),
 * a white flash at his chest, a ring of fire running round his feet and embers rising.
 */
export const kindle =
  (k: number, spin = 0, seed = 0, push = 0.5): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const heart = at3(rig.chest, 0, 14, 0);
    const P = x.proj(heart);
    const n = 20;
    for (let i = 0; i < n; i++) {
      const long = i % 2 === 0;
      const ang = rad(spin + (i * 360) / n + (long ? 0 : 4));
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const r0 = 7 + push * 8;
      const len = (long ? 40 : 22) * (0.75 + 0.25 * Math.min(1, k)) * (0.85 + 0.3 * push);
      const w0 = long ? 3.4 : 2.4;
      for (let t = 0; t <= len; t += 0.5) {
        const f = t / len;
        const half = w0 * (1 - f) + 0.3;
        for (let s2 = -half; s2 <= half; s2 += 0.5) {
          const edge = Math.abs(s2) > half - 0.9;
          const col = f < 0.22 && !edge ? WHITE_HOT : edge && f > 0.3 ? FLAME : GOLD;
          c.glow(P[0] + ca * (r0 + t) - sa * s2, P[1] + sa * (r0 + t) + ca * s2, col, Math.min(1, k) * (1 - 0.3 * f), true);
        }
      }
    }
    // The flash at his chest.
    if (x.cam.view !== 'back') starburst(c, P, 0.55 * Math.min(1, k), WHITE_HOT, GOLD, Math.min(1, k));
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
 * A tongue of fire as `tongue` paints it, but no hotter at its root than `heat` along the fire
 * ramp (0 white-hot, 0.2 gold, 0.45 his orange core): the tongues that climb over him burn gold
 * and orange, and only the pillar's heart is white.
 */
function lick(c: Canvas, x: number, y: number, h: number, w: number, sway: number, a: number, heat: number, under = false): void {
  const n = Math.max(1, Math.round(h));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const half = w * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 2 + 0.3)));
    const cx = x + sway * t * t * h * 0.35;
    for (let dx = -Math.ceil(half); dx <= Math.ceil(half); dx++) {
      const edge = Math.abs(dx) / Math.max(0.5, half);
      if (edge > 1) continue;
      c.glow(cx + dx, y - i, fireAt(Math.min(1, heat + t * 0.7 + edge * 0.3)), a * (1 - t * 0.25), under);
    }
  }
}

/** Smooth seeded noise in [0, 1) over the plane (value noise on a unit grid). */
function noise2(hash: FxContext['hash'], x: number, y: number, salt: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const sx = (x - xi) * (x - xi) * (3 - 2 * (x - xi));
  const sy = (y - yi) * (y - yi) * (3 - 2 * (y - yi));
  const h = (i: number, j: number): number => hash(i * 7919 + j * 104729, salt);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), sx), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), sx), sy);
}

/**
 * Firebeast (k 0 to about 1.3): fire rises from a ring on the floor up his body, `k` how high it
 * has climbed (1 just over the top of his hair), into a pillar of flame that swallows him. The ring
 * is a thin ellipse of fire on the floor with flames standing up off it. As it climbs, separate
 * tongues of gold and orange lick up over him from the floor to the fire line, his dark figure and
 * its outline showing between them in the warm light, and behind him a column of flame rises as
 * wide as he is. From about k 0.85 the pillar closes over him: a body of flame that streams upward
 * (a field of noise drawn out tall and carried up a few pixels every frame, so its tongues and
 * streaks change with `seed`: advance it every frame), gold inside, orange then red toward its
 * ragged edges, with a narrow white-hot heart; tongues lick up off its rounded top and its sides,
 * embers fly.
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
    // The fire line: everything below it burns. Over the last pixels below it the pillar narrows
    // to a rounded, flickering point, as a flame does.
    const line = bottom - tall * k;
    const w = (y: number): number => {
      const top = clamp((y - line) / Math.max(8, Math.min(30, tall * k * 0.6)), 0, 1);
      const flick = 0.9 + 0.08 * Math.sin(y * 0.21 + seed * 2.1) + 0.06 * Math.sin(y * 0.53 - seed * 1.3);
      return half * flick * (0.12 + 0.88 * Math.sqrt(top));
    };
    // How far the column behind him has grown, and how far the pillar has closed over him.
    const grown = clamp((k - 0.45) / 0.5, 0, 1);
    const engulf = clamp((k - 0.8) / 0.32, 0, 1);
    const rise = seed * 6;
    // The body of flame: hot in the middle, cooling to its edges and toward the fire line, broken
    // up by the streaming noise into tongues and streaks.
    for (let y = Math.floor(line); y <= Math.ceil(bottom) - 1; y++) {
      const hw = w(y) * (0.75 + 0.25 * grown);
      const nearTop = 1 - clamp((y - line) / 16, 0, 1);
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const px = Math.round(cx + dx);
        const r = Math.abs(dx + 0.5) / hw;
        if (r > 1) continue;
        const broad = noise2(hash, px * 0.24, (y + rise) * 0.085, 61);
        const n = broad * 0.65 + noise2(hash, px * 0.55, (y + rise * 1.4) * 0.2, 62) * 0.35;
        const heat = 1.08 - r * r * 0.75 - n * 0.55 - nearTop * 0.45;
        if (heat < 0.06 && r > 0.6) continue;
        const core = r < 0.12 + 0.05 * Math.sin(y * 0.3 + seed) && heat > 0.55 && engulf > 0.6;
        const colr: RGB = core ? WHITE_HOT : heat > 0.62 ? GOLD : heat > 0.4 ? FLAME : heat > 0.2 ? ORANGE : RED;
        if (c.opaque(px, y)) {
          if (engulf <= 0) continue;
          // Closing over him from his feet up: his head and shoulders still show dark through
          // gaps in the flame at first, then it is solid.
          if (broad > engulf * 1.4 - 0.15 + clamp((y - y0) / Math.max(1, bottom - y0), 0, 1) * 0.7) continue;
          c.glow(px, y, colr, 0.86 + 0.12 * engulf);
        } else if (grown > 0) {
          c.glow(px, y, colr, Math.min(1, grown * 2.2), true);
        }
      }
    }
    // Tongues climbing over him from the floor toward the fire line, gold at their roots and red at
    // their tips, his dark figure between them: taller toward his middle, new every frame.
    const climb = bottom - line;
    const nt = Math.round(7 + 4 * Math.min(1, k));
    for (let i = 0; i < nt && engulf < 0.6; i++) {
      const t = (i + 0.2 + hash(i, 300 + seed) * 0.6) / nt;
      const ox = (t - 0.5) * 2 * half * 0.85;
      const mid = 1 - Math.abs(t - 0.5) * 1.2;
      const h = climb * (0.45 + 0.45 * hash(i, 301 + seed)) * (0.6 + 0.4 * mid);
      const base = bottom - climb * 0.08 * hash(i, 302 + seed);
      lick(c, cx + ox, base, h, 3 + 2 * hash(i, 303 + seed), (hash(i, 304 + seed) - 0.5) * 1.4, 0.92 * (1 - engulf * 1.6), 0.22);
    }
    // Tongues licking up off its rounded top and its sides.
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.5) / 11;
      const dx = (t - 0.5) * 2 * half * 0.85;
      let by = line;
      while (by < bottom && w(by) < Math.abs(dx) + 1) by++;
      const h = (8 + hash(i, 183 + seed) * 14) * (1.1 - Math.abs(t - 0.5)) * Math.min(1, k * 1.5);
      lick(c, cx + dx, by + 3, h, 2 + hash(i, 184) * 1.8, (t - 0.5) * 1.2 + (hash(i, 185 + seed) - 0.5), 0.95, 0.12);
    }
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const yy = lerp(line + 26, bottom - 4, hash(i, 188 + seed));
      if (yy > bottom - 4) continue;
      lick(c, cx + side * (w(yy) - 1), yy, 5 + hash(i, 189 + seed) * 8, 1.6, side * 0.8, 0.9, 0.3);
    }
    // The ring of fire on the floor round him where it began: a thin ellipse of flame, and flames
    // standing up off it (those behind him under the figure).
    const R = half + 3;
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const p3: V3 = [g[0] + Math.cos(th) * R, 0, g[2] + Math.sin(th) * R];
      const p = x.proj(p3);
      const under = x.behind(p3);
      c.glow(p[0], p[1], i % 2 ? ORANGE : GOLD, 0.9, under);
      c.glow(p[0], p[1] - 1, RED, 0.5, under);
    }
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + hash(i, 190 + seed) * 0.3;
      const p3: V3 = [g[0] + Math.cos(th) * R, 0, g[2] + Math.sin(th) * R];
      const p = x.proj(p3);
      tongue(c, p[0], p[1], (4 + hash(i, 186 + seed) * 8) * Math.min(1, k * 2.5), 1.5, hash(i, 187 + seed) - 0.5, 0.9, x.behind(p3));
    }
    embers(Math.min(1, k), seed, [g[0], 40, g[2]], 46, 16)(x);
  };

/**
 * The cast's flare (k 0 to 1) in his raised left hand: a burst of warm fire round his fist with a
 * white-hot heart and flames licking up off it (Bloodrush), ringed in a solid ring of green light
 * of healing with a pale inner edge (`green` 0 to 1: Second Wind, the Elixir), with green motes
 * rising round him (`rise` lifts them: advance it every frame).
 */
export const flare =
  (k: number, rise = 0, green = 1): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, hash } = x;
    const P = x.proj(rig.armL.end);
    // Behind him side on, and from behind while the hand is still drawn in at his chest (raised
    // beside his head it shows over his shoulder from every side).
    const low = rig.armL.end[1] < rig.head.o[1] - 20;
    const under = x.behind(rig.armL.end) && (x.cam.view === 'side' || (x.cam.view === 'back' && low));
    const r = 4 + 6 * Math.min(1, k);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1) continue;
        c.glow(P[0] + dx, P[1] + dy, d < 0.35 ? WHITE_HOT : d < 0.62 ? GOLD : d < 0.85 ? FLAME : ORANGE, (d < 0.62 ? 1 : 0.75) * Math.min(1, k * 1.5), under);
      }
    }
    for (let i = 0; i < 7; i++) tongue(c, P[0] + (hash(i, 191) - 0.5) * r * 1.4, P[1] - r * 0.5, (6 + hash(i, 192) * 9) * k, 1.6, hash(i, 193) - 0.5, 0.95, under);
    if (green > 0) {
      const rr = r + 4 + 4 * k;
      const a = green * Math.min(1, k * 1.4);
      const n = Math.ceil(rr * 9);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        c.glow(P[0] + cs * (rr - 1), P[1] + sn * (rr - 1), GREEN_PALE, 0.9 * a, under);
        c.glow(P[0] + cs * rr, P[1] + sn * rr, GREEN, 0.95 * a, under);
        c.glow(P[0] + cs * (rr + 1), P[1] + sn * (rr + 1), GREEN, 0.8 * a, under);
      }
      motes({ ...x, aura: { core: GREEN, edge: GREEN, hot: GREEN_PALE } }, green * Math.min(1, k * 1.3), { n: 20, rise });
    }
  };
