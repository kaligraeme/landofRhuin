/**
 * The Arbalest's own effects, as `fx.extra` painters for his moves: the pale gold trail his bolts
 * leave, the white-hot streak of a piercing bolt, the fiery burst of an explosive one, a cone of
 * shrapnel sparks, powder smoke and spent sparks, the bandage he binds round his forearm and the
 * sweat and dust of the low-health and knocked-out clips. They are painted in his colours (the
 * design's amber-orange aura, a pale gold, a white core), from the crossbow's tip (`FxContext.tip`,
 * the bolt's point) along its aim (`FxContext.dir`), so they follow the crossbow in every view.
 */
import type { RGB } from '../../paint.js';
import { DUST, DUST_DARK, glowLine, puff, trail } from '../fx.js';
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

/** Where a shot left the crossbow and which way it flew (hero space): see moves-core.ts `shotOf`. */
export interface Shot {
  tip: V3;
  dir: V3;
}

/**
 * A bolt's trail in pale gold: the engine's shot trail (fx.ts `trail`) with a white-hot line in a
 * sheath of pale gold and a fringe of amber, `len` long from where the shot left along its line
 * (`shot`, or the crossbow's tip and aim in this frame); `k` its strength (fade it over two or
 * three frames, keeping the shot's own line while the crossbow kicks up).
 */
export const goldTrail =
  (k: number, len = 52, shot?: Shot) =>
  (x: FxContext): void =>
    trail({ ...x, aura: { hot: WHITE, core: GOLD, edge: AMBER } }, shot?.tip ?? x.tip, shot?.dir ?? x.dir, k, { len });

/**
 * A piercing bolt's white-hot streak: a long, hard white line along the shot's line (`shot`, or
 * the crossbow's aim) with a thin gold sheath, much longer than a common trail, `k` its strength.
 */
export const streak =
  (k: number, len = 100, shot?: Shot) =>
  (x: FxContext): void => {
    const tip = shot?.tip ?? x.tip;
    const dir = shot?.dir ?? x.dir;
    const a = x.proj(tip);
    const b = x.proj(add3(tip, dir, len));
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const under = x.behind(add3(tip, dir, len)) && x.behind(tip);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const px = a[0] + (b[0] - a[0]) * t;
      const py = a[1] + (b[1] - a[1]) * t;
      const fade = k * (0.35 + 0.65 * t);
      x.c.glow(px, py, WHITE, fade, under);
      x.c.glow(px, py - 1, GOLD, fade * 0.55, under);
      x.c.glow(px, py + 1, GOLD, fade * 0.55, under);
    }
  };

/**
 * A charged bolt's head in the groove: a pulsing glow round the bolt's point with a hot heart and a
 * few sparks spitting off it, `k` its strength, `col` its colour (amber for an explosive bolt, a
 * pale gold for a piercing one).
 */
export const charged =
  (k: number, col: RGB = AMBER) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const p = x.proj(add3(x.tip, x.dir, -1.5));
    puff(c, p[0], p[1], 4.5 * k, col, 0.45 * k);
    puff(c, p[0], p[1], 2.2 * k, GOLD, 0.8 * k);
    c.glow(p[0], p[1], WHITE, k);
    for (let i = 0; i < 4; i++) {
      const ang = hash(i, 21) * Math.PI * 2;
      const r = 4 + hash(i, 22) * 4 * k;
      c.glow(p[0] + Math.cos(ang) * r, p[1] + Math.sin(ang) * r - 1, i % 2 ? WHITE : col, 0.9 * k);
    }
  };

/**
 * A fiery muzzle burst where a shot leaves (`shot`, or the crossbow's tip and aim): a white heart,
 * amber and ember-orange tongues of flame licking forward along the aim and out to the sides, `k`
 * its size (1 about 9 px across).
 */
export const fireburst =
  (k: number, shot?: Shot) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const p = x.proj(add3(shot?.tip ?? x.tip, shot?.dir ?? x.dir, 2));
    const d = x.cam.vec(shot?.dir ?? x.dir);
    const dl = Math.hypot(d[0], d[1]) || 1;
    const fwd: [number, number] = dl > 0.3 ? [d[0] / dl, d[1] / dl] : [0, 1];
    puff(c, p[0], p[1], 6 * k, EMBER, 0.55);
    puff(c, p[0] + fwd[0] * 3 * k, p[1] + fwd[1] * 3 * k, 4.5 * k, AMBER, 0.8);
    puff(c, p[0], p[1], 2.4 * k, WHITE, 1);
    for (let i = 0; i < 9; i++) {
      const ang = Math.atan2(fwd[1], fwd[0]) + (hash(i, 31) - 0.5) * 2.6;
      const r0 = 3 * k;
      const r1 = r0 + (5 + hash(i, 32) * 7) * k;
      glowLine(c, [p[0] + Math.cos(ang) * r0, p[1] + Math.sin(ang) * r0], [p[0] + Math.cos(ang) * r1, p[1] + Math.sin(ang) * r1 - hash(i, 33) * 2], i % 3 ? AMBER : EMBER, 0.85);
    }
  };

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
 * A cone of shrapnel blasted out of the prod: hot sparks fanning out 35 degrees either side of the
 * shot's line (`shot`, or the crossbow's aim), each a white head with an orange streak behind it, `k` from 0 (bursting from the prod) to
 * 1 (flown far out and thinning), with a little rise and fall among them.
 */
export const shrapnel =
  (k: number, shot?: Shot) =>
  (x: FxContext): void => {
    const { c, hash } = x;
    const tip = shot?.tip ?? x.tip;
    // The aim and two axes square to it: one level (the cone's spread), one up.
    const d = norm3([(shot?.dir ?? x.dir)[0], 0, (shot?.dir ?? x.dir)[2]]);
    const side = norm3(cross3([0, 1, 0], d));
    const reach = 18 + k * 56;
    for (let i = 0; i < 44; i++) {
      const ang = rad((hash(i, 61) - 0.5) * 70);
      const el = rad((hash(i, 62) - 0.5) * 18);
      const dir = norm3(add3(add3([d[0] * Math.cos(ang), 0, d[2] * Math.cos(ang)], side, Math.sin(ang)), [0, 1, 0], Math.sin(el)));
      const r = reach * (0.45 + 0.55 * hash(i, 63));
      const head = add3(add3(tip, dir, r), [0, -1, 0], k * k * 6 * hash(i, 64));
      const tail = add3(tip, dir, Math.max(0, r - 8 - k * 6));
      const a = x.proj(tail);
      const b = x.proj(head);
      const under = x.behind(head) && x.behind(tail);
      const fade = 1 - k * 0.55;
      glowLine(c, a, b, i % 3 ? EMBER : AMBER, 0.8 * fade, under);
      c.glow(b[0], b[1], WHITE, fade, under);
      if (i % 2) c.glow(b[0] + 1, b[1], GOLD, 0.8 * fade, under);
    }
    if (k < 0.5) {
      // The blast at the prod, opening out along the aim.
      const p = x.proj(add3(tip, d, 4));
      puff(c, p[0], p[1], 9 * (1 - k), EMBER, 0.45 * (1 - k * 1.6));
      puff(c, p[0], p[1], 6 * (1 - k), AMBER, 0.6 * (1 - k * 1.6));
      puff(c, p[0], p[1], 3, WHITE, 0.9 * (1 - k * 1.6));
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
