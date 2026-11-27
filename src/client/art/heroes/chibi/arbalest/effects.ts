/**
 * The Arbalest's own effects, as `fx.extra` painters for his moves: the pale gold trail his bolts
 * leave, the white-hot streak of a piercing bolt, the fiery burst of an explosive one, a cone of
 * shrapnel sparks, powder smoke and spent sparks, the bandage he binds round his forearm and the
 * sweat and dust of the low-health and knocked-out clips. They are painted in his colours (the
 * design's amber-orange aura, a pale gold, a white core), from the crossbow's tip (`FxContext.tip`,
 * the bolt's point) along its aim (`FxContext.dir`), so they follow the crossbow in every view.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { DUST, DUST_DARK, glowLine, motes, puff, rays, starburst, trail } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, cross3, type FxContext, lerp3, norm3, rad, type V3 } from '../rig.js';

const WHITE: RGB = [255, 255, 255];
const GOLD: RGB = [255, 230, 160];
const AMBER: RGB = [255, 178, 74];
const EMBER: RGB = [255, 120, 40];
const SMOKE: RGB = [150, 140, 132];
const SMOKE_DARK: RGB = [96, 88, 84];

/** Several painters on one frame. */
export const all =
  (...fs: ((x: FxContext) => void)[]) =>
  (x: FxContext): void => {
    for (const f of fs) f(x);
  };

/**
 * Where a shot left the crossbow and which way it flew (hero space): see moves-core.ts `shotOf`.
 * Without a `tip` it leaves from the bolt's point on the crossbow as it is drawn in this frame
 * (the release frame: the flash sits on the nose, wherever the kick has thrown it), along `dir`.
 */
export interface Shot {
  tip?: V3;
  dir: V3;
}

/** A shot's line in this frame: its own, or the crossbow's bolt and aim. */
const lineOf = (x: FxContext, shot?: Shot): { tip: V3; dir: V3 } => ({ tip: shot?.tip ?? x.tip, dir: shot?.dir ?? x.dir });

/**
 * Is a shot flying at the viewer (seen from in front, where a line along it would run down the
 * screen over his legs)? Such effects are kept short: a burst and a quick streak toward the viewer.
 */
function atViewer(x: FxContext, at: V3, dir: V3): boolean {
  const v = x.cam.vec(dir);
  return Math.hypot(v[0], v[1]) < 0.6 && x.depth(add3(at, dir)) > x.depth(at);
}

/** A shot's direction on screen, opened out to a short drop toward the viewer or a rise away when it flies end on. */
function screenDir(x: FxContext, at: V3, dir: V3): Vec {
  const v = x.cam.vec(dir);
  const l = Math.hypot(v[0], v[1]);
  if (l > 0.45) return [v[0] / l, v[1] / l];
  const toward = x.depth(add3(at, dir)) > x.depth(at) ? 1 : -1;
  const d: Vec = [v[0], v[1] + toward * (0.45 - l)];
  const dl = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / dl, d[1] / dl];
}

/**
 * A bolt's trail in pale gold: the engine's shot trail (fx.ts `trail`) with a white-hot line in a
 * sheath of pale gold and a fringe of amber, `len` long from where the shot left along its line
 * (`shot`, or the crossbow's bolt and aim in this frame); `k` its strength (fade it over two or
 * three frames, keeping the shot's own line while the crossbow kicks up). Flying at the viewer it
 * is a short streak that fades fast, not a line down over his legs.
 */
export const goldTrail =
  (k: number, len = 52, shot?: Shot) =>
  (x: FxContext): void => {
    const { tip, dir } = lineOf(x, shot);
    trail({ ...x, aura: { hot: WHITE, core: GOLD, edge: AMBER } }, tip, dir, k, { len: atViewer(x, tip, dir) ? Math.min(len, 22) : len });
  };

/**
 * A piercing bolt's white-hot streak: a long, hard white line along the shot's line (`shot`, or
 * the crossbow's aim), `core` pixels thick, in a thin gold sheath, much longer than a common
 * trail; `k` its strength. Flying at the viewer it is cut short, as the trail is.
 */
export const streak =
  (k: number, len = 100, shot?: Shot, core = 1) =>
  (x: FxContext): void => {
    const { tip, dir } = lineOf(x, shot);
    const L = atViewer(x, tip, dir) ? Math.min(len, 40) : len;
    const a = x.proj(tip);
    const b = x.proj(add3(tip, dir, L));
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const under = x.behind(add3(tip, dir, L)) && x.behind(tip);
    // Thickened across the line: up and down the screen when it runs along it, else sideways.
    const flat = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const off = (px: number, py: number, o: number): Vec => (flat ? [px, py + o] : [px + o, py]);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      const fade = k * (0.35 + 0.65 * t);
      for (let o = 0; o < core; o++) x.c.glow(...off(px, py, o), WHITE, fade, under);
      x.c.glow(...off(px, py, -1), GOLD, fade * 0.6, under);
      x.c.glow(...off(px, py, core), GOLD, fade * 0.6, under);
    }
  };

/**
 * A charged bolt's head in the groove: a pulsing glow round the bolt's point with a hot white
 * heart and sparks spitting off it, `k` its strength (1 about 5 px across), `col` its colour
 * (amber for an explosive bolt, a pale gold for a piercing one), `seed` varying the sparks, with a
 * `ring` of charge round it if asked. Hidden behind him when the bolt is.
 */
export const charged =
  (k: number, col: RGB = AMBER, seed = 0, ring = false) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const p3 = add3(x.tip, x.dir, -1.5);
    const under = x.behind(p3);
    const p = x.proj(p3);
    if (ring) {
      // A ring of charge round the bolt's head, broken in places.
      for (let i = 0; i < 24; i++) {
        if (hash(i, 24 + seed) < 0.2) continue;
        const th = (i / 24) * Math.PI * 2;
        c.glow(p[0] + Math.cos(th) * 6.5 * k, p[1] + Math.sin(th) * 5.5 * k, i % 3 ? col : WHITE, 0.9 * k, under);
      }
    }
    puff(c, p[0], p[1], 5.5 * k, col, 0.5 * k, under);
    puff(c, p[0], p[1], 3 * k, GOLD, 0.85 * k, under);
    puff(c, p[0], p[1], 1.4 * k, WHITE, 1, under);
    for (let i = 0; i < 6; i++) {
      const ang = hash(i, 21 + seed) * Math.PI * 2;
      const r0 = 3 + hash(i, 23 + seed) * 2;
      const r1 = r0 + (2 + hash(i, 22 + seed) * 4) * k;
      glowLine(c, [p[0] + Math.cos(ang) * r0, p[1] + Math.sin(ang) * r0], [p[0] + Math.cos(ang) * r1, p[1] + Math.sin(ang) * r1 - 1], i % 2 ? col : EMBER, 0.8 * k, under);
      c.glow(p[0] + Math.cos(ang) * r1, p[1] + Math.sin(ang) * r1 - 1, WHITE, 0.95 * k, under);
    }
  };

/**
 * A fiery muzzle burst where a shot leaves (`shot`, or the crossbow's bolt and aim): a white heart,
 * amber and ember-orange tongues of flame licking forward along the aim and out to the sides, `k`
 * its size (1 about 9 px across). Behind him (seen from behind) it goes under him, so only its glow
 * round his outline shows.
 */
export const fireburst =
  (k: number, shot?: Shot) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const { tip, dir } = lineOf(x, shot);
    const p3 = add3(tip, dir, 2);
    const under = x.behind(p3);
    const p = x.proj(p3);
    const fwd = screenDir(x, tip, dir);
    puff(c, p[0], p[1], 6 * k, EMBER, 0.55, under);
    puff(c, p[0] + fwd[0] * 3 * k, p[1] + fwd[1] * 3 * k, 4.5 * k, AMBER, 0.8, under);
    puff(c, p[0], p[1], 2.4 * k, WHITE, 1, under);
    for (let i = 0; i < 9; i++) {
      const ang = Math.atan2(fwd[1], fwd[0]) + (hash(i, 31) - 0.5) * 2.6;
      const r0 = 3 * k;
      const r1 = r0 + (5 + hash(i, 32) * 7) * k;
      glowLine(c, [p[0] + Math.cos(ang) * r0, p[1] + Math.sin(ang) * r0], [p[0] + Math.cos(ang) * r1, p[1] + Math.sin(ang) * r1 - hash(i, 33) * 2], i % 3 ? AMBER : EMBER, 0.85, under);
    }
  };

/**
 * A burst of light rays round the crossbow's nose (fx.ts `rays`, `n` beams about `len` long, `k`
 * their strength), hidden behind him when the nose is, so seen from behind they shine out round his
 * outline rather than over his head.
 */
export const muzzleRays =
  (k: number, n = 10, len = 20) =>
  (x: FxContext): void => {
    const at = add3(x.tip, x.dir, 2);
    rays(x, at, k, { n, len, behind: x.behind(at) });
  };

/** Healing motes rising round him in his warm colours: the engine's motes (fx.ts `motes`) in pale gold and amber. */
export const warmMotes =
  (k: number, rise: number) =>
  (x: FxContext): void =>
    motes({ ...x, aura: { hot: GOLD, core: AMBER, edge: EMBER } }, k, { rise });

/**
 * Powder smoke round the crossbow's nose, rising and spreading as `k` runs from 0 (just fired: a
 * tight grey puff) to 1 (a thin haze drifting up and back); `seed` varies the puffs.
 */
export const smoke =
  (k: number, seed = 0, strength = 1) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    for (let i = 0; i < 5; i++) {
      const along = 2 + hash(i, 41 + seed) * 6;
      const p3 = add3(add3(x.tip, x.dir, along - 6 - k * 8), [0, 1, 0], 1 + k * (6 + hash(i, 42 + seed) * 8));
      const p = x.proj(p3);
      const r = 2 + k * 3 + hash(i, 43 + seed) * 1.5;
      const a = strength * (0.5 - k * 0.32);
      puff(c, p[0] + (hash(i, 44 + seed) - 0.5) * 6, p[1], r, i % 2 ? SMOKE : SMOKE_DARK, a, x.behind(p3));
    }
  };

/**
 * Spent sparks spilling from the crossbow's nose and falling, hot orange with white heads: `k`
 * runs them out and down (0 just thrown, 1 near the floor), `seed` varies them.
 */
export const spentSparks =
  (k: number, seed = 0) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    for (let i = 0; i < 7; i++) {
      const side = (hash(i, 51 + seed) - 0.5) * 2;
      const out = 3 + hash(i, 52 + seed) * 8;
      const p3: V3 = [x.tip[0] - 4 + side * 3 - k * 3, Math.max(1, x.tip[1] + 2 - k * k * (20 + hash(i, 53 + seed) * 18)), x.tip[2] + side * out];
      const p = x.proj(p3);
      const under = x.behind(p3);
      c.glow(p[0], p[1], WHITE, 1 - k * 0.4, under);
      c.glow(p[0], p[1] - 1, EMBER, 0.9 - k * 0.4, under);
      c.glow(p[0] + (side > 0 ? -1 : 1), p[1] - 2, AMBER, 0.6 - k * 0.3, under);
    }
  };

/**
 * A cone of shrapnel blasted out of the prod, opening on screen from the crossbow's nose along the
 * shot (`shot`, or the crossbow's bolt and aim): `k` 0 is the blast itself, a solid fan about 36 px
 * long rooted at the prod, white-hot at its apex, then amber, then ember; as `k` runs on to 1 the
 * fan fades and its sparks fly out from the prod (no gap at the apex), each a white or gold head
 * two pixels wide with an amber streak behind it, falling a little and thinning out. The 70-degree
 * spread is level, so side on it would fold into the depth: it is opened on screen instead, the
 * same cone in every view, and flying at the viewer it is a star burst round the nose.
 */
export const shrapnel =
  (k: number, shot?: Shot) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const { tip, dir } = lineOf(x, shot);
    const under = x.behind(tip);
    const A = x.proj(tip);
    const star = atViewer(x, tip, dir);
    const d = screenDir(x, tip, dir);
    const base = Math.atan2(d[1], d[0]);
    // Half the cone's opening on screen; a full round seen end on.
    const half = star ? Math.PI : rad(33);
    if (k < 0.3) {
      // The blast: a fan (or a disc seen end on) of light, hottest at its apex.
      const R = (star ? 16 : 40) * (0.9 + k);
      const fade = 1 - k / 0.3;
      const ri = Math.ceil(R);
      for (let dy = -ri; dy <= ri; dy++) {
        for (let dx = -ri; dx <= ri; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > R) continue;
          let off = Math.atan2(dy, dx) - base;
          off = Math.atan2(Math.sin(off), Math.cos(off));
          if (Math.abs(off) > half) continue;
          const t = r / R;
          // Ragged at its rim: tongues of flame along the cone.
          if (t > 0.7 && hash(Math.round(off * 9) + 40, 65) < (t - 0.7) * 2.5) continue;
          const col = t < 0.18 ? WHITE : t < 0.45 ? mixc(GOLD, AMBER, (t - 0.18) / 0.27) : mixc(AMBER, EMBER, (t - 0.45) / 0.55);
          c.glow(A[0] + dx, A[1] + dy, col, fade * (t < 0.18 ? 1 : 1 - t * 0.45) * (1 - (Math.abs(off) / half) * 0.3), under);
        }
      }
      if (star) starburst(c, A, 1.6, WHITE, AMBER, fade, under);
    }
    // The sparks: flying out from the prod along the cone, some still close to it.
    const reach = (star ? 10 : 16) + k * (star ? 26 : 62);
    const n = k > 0.8 ? 18 : 40;
    for (let i = 0; i < n; i++) {
      const ang = base + (hash(i, 61) * 2 - 1) * half * (star ? 1 : 0.95);
      const speed = 0.15 + 0.85 * hash(i, 63);
      const r = reach * speed;
      const drop = k * k * 9 * hash(i, 64);
      const head: Vec = [A[0] + Math.cos(ang) * r, A[1] + Math.sin(ang) * r + drop];
      const back = k < 0.15 ? 0 : Math.min(r, 5 + 10 * k);
      const tail: Vec = [A[0] + Math.cos(ang) * (r - back), A[1] + Math.sin(ang) * (r - back) + drop * 0.6];
      const fade = Math.max(0, 1 - k * 0.6);
      glowLine(c, tail, head, i % 3 ? AMBER : EMBER, 0.85 * fade, under);
      c.glow(head[0], head[1], i % 2 ? WHITE : GOLD, fade, under);
      c.glow(head[0] + (Math.cos(ang) > 0 ? 1 : -1), head[1], i % 2 ? GOLD : WHITE, fade * 0.9, under);
    }
  };

/**
 * A bandage being bound round his left forearm: a white band wound in turns from the elbow side
 * toward the wrist, `k` of the way (0 none, 1 bound), the loose end trailing to his right hand
 * while he winds it (`loose`).
 */
export const bandage =
  (k: number, loose = true) =>
  (x: FxContext): void => {
    const { c, rig } = x;
    const a = lerp3(rig.armL.mid, rig.armL.end, 0.2);
    const b = lerp3(rig.armL.mid, rig.armL.end, 0.2 + 0.6 * k);
    const axis = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const ref: V3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm3(cross3(axis, ref));
    const e2 = cross3(axis, e1);
    const turns = Math.max(1, Math.round(k * 4));
    const n = turns * 16;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const th = t * turns * Math.PI * 2;
      const p3 = add3(add3(lerp3(a, b, t), e1, Math.cos(th) * 3.2), e2, Math.sin(th) * 3.2);
      if (x.depth(p3) < x.depth(lerp3(a, b, t)) - 0.5) continue;
      const p = x.proj(p3);
      c.glow(p[0], p[1], WHITE, 1);
      c.glow(p[0], p[1] + 1, [222, 214, 200], 1);
    }
    if (loose && k < 1) {
      const from = x.proj(b);
      const to = x.proj(rig.armR.end);
      glowLine(c, from, to, [240, 236, 226], 0.95);
    }
  };

/**
 * The sweep of a backward roll: two arcs of pale gold and amber round his middle in the plane he
 * rolls in (forward and up), from `a0` to `a1` degrees (0 ahead of him, 90 overhead, 180 behind),
 * brightest at the leading end, `k` their strength, side on only. The part behind him goes under
 * him.
 */
export const rollArc =
  (k: number, a0: number, a1: number) =>
  (x: FxContext): void => {
    const { c, rig } = x;
    // Seen from in front or behind he rolls toward or away from the viewer, and the arcs would
    // fold into a line up his middle: they are left out then.
    const side = x.cam.vec([1, 0, 0]);
    if (Math.hypot(side[0], side[1]) < 0.6) return;
    const centre = add3(rig.pelvis.o, [0, 1, 0], 7);
    const steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 3));
    for (const [R, col, w] of [
      [21, GOLD, 1],
      [16, AMBER, 0.75],
    ] as const) {
      let prev: Vec | null = null;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const th = rad(a0 + (a1 - a0) * t);
        const p3: V3 = [centre[0] + Math.cos(th) * R, Math.max(0.5, centre[1] + Math.sin(th) * R), centre[2]];
        const p = x.proj(p3);
        if (prev) glowLine(c, prev, p, col, k * w * (0.15 + 0.85 * t), x.behind(p3));
        prev = p;
      }
    }
  };

/** A bead of sweat running down his temple, on the side of his head away from the viewer's centre: `k` runs it down, 0 to 1. */
export const sweat =
  (k: number) =>
  ({ c, cam, rig, proj }: FxContext): void => {
    const h = proj(rig.head.o);
    const dir = cam.view === 'back' ? -1 : 1;
    const px = Math.round(h[0] + dir * 11);
    const py = Math.round(h[1] - 6 + k * 4);
    const ink: RGB = [36, 52, 86];
    const blue: RGB = [190, 230, 252];
    const mid: RGB = [110, 168, 222];
    const rows = ['..K..', '.KBK.', 'KBBBK', 'KWBMK', 'KBMMK', '.KKK.'];
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx];
        const col = ch === 'K' ? ink : ch === 'B' ? blue : ch === 'M' ? mid : ch === 'W' ? WHITE : null;
        if (col) c.glow(px + dx - 2, py + dy, col, 1);
      }
    });
  };

/** Dust thrown up along him as he lands flat on his back: puffs beside his hips, his back and his head. */
export const thud = ({ c, rig, proj, hash }: FxContext): void => {
  const along = [rig.pelvis.o, lerp3(rig.pelvis.o, rig.head.o, 0.5), rig.head.o];
  along.forEach((p, i) => {
    for (const side of [-1, 1]) {
      const g = proj([p[0] + (hash(i, 81 + side) - 0.5) * 8, 0, p[2] + side * 10]);
      const r = 3 + hash(i, 83 + side) * 2;
      puff(c, g[0], g[1] - r * 0.7, r, side < 0 ? DUST_DARK : DUST, 0.5, side < 0);
    }
  });
};

/**
 * Dust and a scrape where the crossbow skids along the floor, behind it as it slides (`k` its
 * strength): at the dropped crossbow's grip, trailing back toward where it fell.
 */
export const skid =
  (k: number) =>
  ({ c, rig, proj, hash }: FxContext): void => {
    const g = rig.weapon.o;
    for (let i = 0; i < 4; i++) {
      const p = proj([g[0] - 4 - i * 4, 0, g[2] + (hash(i, 91) - 0.5) * 4]);
      puff(c, p[0], p[1] - 2, 2.5 + i * 0.6, i % 2 ? DUST : DUST_DARK, k * (0.6 - i * 0.1));
    }
  };
