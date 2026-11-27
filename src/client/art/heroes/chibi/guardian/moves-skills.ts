/**
 * The Guardian's skills, in the chibi pose format (rig.ts, ChibiPose), with a few effects of their
 * own painted through `fx.extra`. Wind-up frames come first; with no server wind-up they take
 * 0.06 s each and the rest share the clip's seconds. A weapon skill's clip is named after its
 * hotbar slot (`q` Flash, `e` Mend, `r` Shield's Up!, `ult` Luminaire; her special, Aegis, is in
 * moves-states.ts).
 *
 *   cast       8  (2 wind-up) role skills (Challenge, Rallying Bulwark) and the Elixir: the
 *                 sword's flat struck on the shield's rim with a clang and a ring of light, then a
 *                 rallying raise of the sword high out to her right, rays of light off its point
 *   q flash    8  (1 wind-up) Flash: crouched behind the shield, then a dash shield first in a
 *                 flash of light, gold afterimages and streaks of light behind her, a skid and a
 *                 braced stop
 *   e mend    10  (1 wind-up) Mend: the sword raised point up before her face, its fuller
 *                 glowing, eyes closed; a column of gold light pours down on her, motes rise round
 *                 her and a soft ring of light pulses out over the floor
 *   r         10  (1 wind-up) Shield's Up!: planted low behind the shield, a dome of gold hexagons
 *                 forms over her and holds for the three seconds of the brace; then the shield is
 *                 thrust out and the dome bursts outward in shards, a shockwave and a blaze of
 *                 rays (the burst shows from 3.0 s, when the server's lands)
 *   ult       14  (3 wind-up) Luminaire: light gathers on the sword as she raises it high beside
 *                 her head through the 0.6 s wind-up, the shield lowered at her side; then she thrusts
 *                 it up and rays of light burst out all round her and flood over the floor, and she
 *                 brings it down into her guard
 *
 * Her light is gold and white with a pale blue edge (the design's aura). Every clip that gives way
 * to the battle stance eases into it at the end (moves-core's `settle`).
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { DUST, DUST_DARK, glowLine, puff, rays } from '../fx.js';
import { add3, type ChibiPose, clamp, type FxContext, norm3, pose, type V3 } from '../rig.js';
import { fromReady, READY, settle } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

type Extra = (x: FxContext) => void;

/** The pale blue fringe of her light, along the outer edge of the rings she sends over the floor. */
const SKY: RGB = [168, 212, 255];

/** Runs several extra painters in turn. */
const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** Is a pixel on the head (within its circle on screen)? Effects over the figure keep off her face. */
const onHead = (x: FxContext, px: number, py: number): boolean => {
  const h = x.proj(x.rig.head.o);
  return Math.hypot(px - h[0], py - h[1] + 1) < 12;
};

/**
 * A ring of light rung off the sword where it strikes the shield's rim (`k` from 0, just struck,
 * to 1, spread out and fading): a white-hot ring with a gold sheath and a pale blue fringe,
 * squashed a little as it spreads, kept off her face.
 */
const ringOfLight =
  (k: number): Extra =>
  (x) => {
    const { c, rig, aura } = x;
    const w = rig.weapon;
    const p = x.proj(add3(w.o, w.u, 6 + 37 * 0.45));
    const R = 5 + 26 * k;
    const fade = 1 - k * 0.7;
    const n = Math.ceil(R * 7);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      for (const [dr, col, a] of [[0, aura.hot, 0.95], [1, aura.core, 0.75], [2.2, SKY, 0.45]] as [number, RGB, number][]) {
        const px = p[0] + Math.cos(th) * (R + dr);
        const py = p[1] + Math.sin(th) * (R + dr) * 0.78;
        if (onHead(x, px, py)) continue;
        c.glow(px, py, col, a * fade);
      }
    }
  };

/**
 * Streaks of light behind a dash (strength k). Side on, long gold-white streaks trail back from
 * her (under the figure, so they show beside it); toward or away from the viewer, streaks burst
 * out all round her.
 */
const streaks =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura, hash } = x;
    const fv = cam.vec([1, 0, 0]);
    if (Math.abs(fv[0]) > 0.4) {
      for (let i = 0; i < 9; i++) {
        const h = 6 + hash(i, 61) * 56;
        const r = (hash(i, 62) - 0.5) * 18;
        const from: V3 = [rig.pelvis.o[0] - 4 - hash(i, 63) * 6, h, r];
        const len = (22 + hash(i, 64) * 26) * k;
        const a = x.proj(from);
        const b = x.proj(add3(from, [-1, 0, 0], len));
        glowLine(c, a, b, i % 3 === 0 ? aura.hot : aura.core, 0.85 * k, true);
        glowLine(c, [a[0], a[1] + 1], [b[0], b[1] + 1], aura.edge, 0.35 * k, true);
      }
    } else {
      const C = x.proj(add3(rig.pelvis.o, [0, 12, 0]));
      for (let i = 0; i < 14; i++) {
        const th = (i / 14) * Math.PI * 2 + hash(i, 71) * 0.3;
        const r0 = 22 + hash(i, 72) * 7;
        const r1 = r0 + (8 + hash(i, 73) * 10) * k;
        const a: Vec = [C[0] + Math.cos(th) * r0, C[1] + Math.sin(th) * r0 * 1.15];
        const b: Vec = [C[0] + Math.cos(th) * r1, C[1] + Math.sin(th) * r1 * 1.15];
        glowLine(c, a, b, i % 2 ? aura.core : aura.hot, 0.8 * k, true);
        glowLine(c, [a[0] + 1, a[1]], [b[0] + 1, b[1]], aura.edge, 0.35 * k, true);
      }
    }
  };

const FURROW: RGB = [62, 52, 48];

/** A skid (strength k): furrows ploughed behind her boots and a bank of dust and grit thrown up ahead of them. */
const skid =
  (k: number): Extra =>
  (x) => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 18 * k, 0, g[2]]);
      glowLine(x.c, a, b, FURROW, 0.85 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.55 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3.2 - i * 0.7) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.6 * k);
      }
      for (let i = 0; i < 7; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 12 * k, hash(i, s + 81) * 10 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        const col: RGB = i % 3 === 0 ? [255, 236, 180] : i % 3 === 1 ? DUST : DUST_DARK;
        x.c.glow(p[0], p[1], col, 0.95 * k);
        x.c.glow(p[0] + 1, p[1], col, 0.7 * k);
      }
    }
  };

/**
 * A soft ring of light pulsing out over the floor from under her (`k` 0 to 1 as it spreads),
 * a gold band with a white-hot front, no rubble: a blessing, not a blow.
 */
const pulse =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const R = 10 + 34 * k;
    const fade = Math.sin(Math.PI * clamp(k * 0.9 + 0.1, 0, 1));
    const n = Math.ceil(R * 8);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const front = Math.sin(th + cam.yaw) > 0;
      for (const [rr, col, a] of [[1, aura.hot, 0.8], [0.93, aura.core, 0.6], [0.85, aura.core, 0.3], [1.07, SKY, 0.35]] as [number, RGB, number][]) {
        const p = x.proj([g[0] + Math.cos(th) * R * rr, 0, g[2] + Math.sin(th) * R * rr]);
        c.glow(p[0], p[1], col, a * fade, !front);
      }
    }
  };

/**
 * Light gathering on the sword's point (`k` 0, far out, to 1, arrived): motes of gold streaming
 * in toward it from all round along curving paths, each a bright head with a tapering tail; a
 * star at the point growing from a spark (about 3 pixels across) to a four-pointed star (about 9);
 * and a faint pillar of light rising over the point as the light builds.
 */
const gather =
  (k: number): Extra =>
  (x) => {
    const { c, tip, aura, hash } = x;
    const P = x.proj(tip);
    // The pillar: a soft column over the point, brightest at its foot, fading upward.
    const tall = 10 + 22 * k;
    for (let dy = 2; dy < tall; dy++) {
      const f = 1 - dy / tall;
      const a = 0.3 * k * f;
      c.glow(P[0], P[1] - dy, aura.hot, a * 1.4, true);
      c.glow(P[0] - 1, P[1] - dy, aura.core, a, true);
      c.glow(P[0] + 1, P[1] - dy, aura.core, a, true);
    }
    for (let i = 0; i < 18; i++) {
      const delay = hash(i, 121) * 0.45;
      const at = (kk: number): Vec => {
        const t = clamp((kk - delay) / (1 - delay), 0, 1);
        const th = (i / 18) * Math.PI * 2 + hash(i, 122) + t * 1.2;
        const R = 40 * Math.pow(1 - t, 0.8) + 3;
        return [P[0] + Math.cos(th) * R, P[1] + Math.sin(th) * R * 0.8];
      };
      const t = clamp((k - delay) / (1 - delay), 0, 1);
      if (t >= 0.96) continue;
      // Before it sets off a mote glimmers where it waits, far out.
      const head = at(Math.max(k, delay + 0.04));
      for (let j = 4; j >= 1; j--) {
        const q = at(k - j * 0.06);
        c.glow(q[0], q[1], j > 2 ? aura.edge : aura.core, 0.75 - j * 0.14);
      }
      c.glow(head[0], head[1], aura.hot, 1);
      c.glow(head[0] + 1, head[1], aura.core, 0.85);
      c.glow(head[0], head[1] + 1, aura.core, 0.8);
      c.glow(head[0] + 1, head[1] + 1, aura.core, 0.6);
    }
    // The star at the point: a white heart, four long rays and four short ones, a gold halo.
    const r = 1.5 + 3 * k;
    for (let d = -Math.ceil(r); d <= Math.ceil(r); d++) {
      const a = Math.max(0, 1 - Math.abs(d) / (r + 0.5));
      c.glow(P[0] + d, P[1], aura.hot, a);
      c.glow(P[0], P[1] + d, aura.hot, a);
    }
    const q = Math.round(r * 0.45);
    for (let d = 1; d <= q; d++) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) c.glow(P[0] + sx * d, P[1] + sy * d, aura.core, 0.8 * (1 - d / (q + 1)));
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) c.glow(P[0] + dx, P[1] + dy, Math.abs(dx) + Math.abs(dy) < 2 ? aura.hot : aura.core, 0.6 + 0.4 * k);
  };

/** Rays bursting from the sword's point (on top of the pose's own `fx.rays`), `k` their strength, turned `spin` degrees. */
const tipRays =
  (k: number, spin: number, len = 26): Extra =>
  (x) =>
    rays(x, x.tip, k, { n: 10, len, spin, skip: (px, py) => onHead(x, px, py) });

/**
 * Light flooding out over the floor from under her (`k` 0 to 1 as it spreads): a broad pool of
 * gold with a bright rolling front and a pale blue fringe, its near half over her feet.
 */
const flood =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const R = 14 + 46 * k;
    const fade = 1 - k * 0.55;
    const n = Math.ceil(R * 8);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const front = Math.sin(th + cam.yaw) > 0;
      for (const [rr, col, a] of [[1, aura.hot, 0.9], [0.95, aura.core, 0.8], [0.88, aura.core, 0.45], [1.05, SKY, 0.4]] as [number, RGB, number][]) {
        const p = x.proj([g[0] + Math.cos(th) * R * rr, 0, g[2] + Math.sin(th) * R * rr]);
        c.glow(p[0], p[1], col, a * fade, !front);
      }
    }
    // The pool inside the front: soft, every other pixel, so the floor shows through.
    const C = x.proj(g);
    const rx = Math.ceil(R * 0.95);
    const ry = Math.ceil(R * 0.95 * 0.32);
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if ((dx + dy) % 2 !== 0) continue;
        const d = (dx / rx) ** 2 + (dy / Math.max(1, ry)) ** 2;
        if (d > 1) continue;
        c.glow(C[0] + dx, C[1] + dy, aura.core, 0.22 * fade * (1 - d * 0.5), true);
      }
    }
  };

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** Feet planted wide for the role skills. */
const PLANT = { footF: [10, 0, 7] as const, footB: [-10, 0, 6.5] as const };

/** The strike: the sword's flat brought down across the top of the raised shield. */
const STRIKE: ChibiPose = pose(S, { y: 6, lean: 8, twist: 4, head: 3, look: -2, ...PLANT, handF: [9, 6, 6], weapon: 84, roll: -40, yaw: -50, handB: [10, 14, 14], elbowB: [0.5, -0.2, 0.4], yawB: -40, rollB: 10, weaponB: 0, face: 'shout', wind: 0.3 });

/** The rally: the sword raised high out to her right, point up, the shield arm swept down and out, head up. */
const RALLY: ChibiPose = pose(S, { y: 2, lean: -6, twist: -4, head: -8, look: 2, ...PLANT, handF: [-6, -9, 14], weapon: -4, roll: 16, yaw: 0, handB: [4, 16, 10], elbowB: [0.5, -0.2, 0.4], yawB: -40, rollB: -10, weaponB: 0, face: 'shout', wind: 0.4, lift: 0.35 });

const cast: ChibiPose[] = [
  // Gather: the shield brought up before her, the sword drawn back high on her right.
  fromReady(pose(S, { y: 5, lean: 2, twist: -10, head: 0, ...PLANT, handF: [-4, -2, 12], weapon: -30, roll: 30, yaw: -10, handB: [10, 14, 14], elbowB: [0.5, -0.2, 0.4], yawB: -40, rollB: 10, face: 'grit', fx: { runeB: 0.15, rune: 0.3 } }), 0.6),
  pose(S, { y: 5, lean: 0, twist: -16, head: -2, ...PLANT, handF: [-6, -6, 13], weapon: -40, roll: 34, yaw: -12, handB: [10, 14, 14], elbowB: [0.5, -0.2, 0.4], yawB: -40, rollB: 10, face: 'grit', lift: 0.2, fx: { runeB: 0.2, rune: 0.6, aura: 0.3 } }),
  // Struck: a clang, and a ring of light rung off the rim.
  pose(STRIKE, { phase: 0.15, fx: { clang: 1, runeB: 0.35, rune: 1, aura: 0.5, circle: 0.4, extra: ringOfLight(0) } }),
  pose(STRIKE, { y: 6.5, lean: 9, phase: 0.3, face: 'grit', fx: { clang: 0.3, runeB: 0.25, rune: 0.8, aura: 0.6, circle: 0.7, extra: ringOfLight(0.45) } }),
  // The rally: the sword swept up high, rays bursting off its point.
  pose(RALLY, { y: 3, lean: -3, head: -5, handF: [-3, -6, 13], weapon: -14, phase: 0.45, fx: { smear: { from: 84, roll: -40, yaw: -50, width: 0.5 }, rune: 1, aura: 0.8, circle: 1, extra: ringOfLight(0.85) } }),
  pose(RALLY, { phase: 0.6, fx: { rune: 1, aura: 1, circle: 1, extra: tipRays(1, 0) } }),
  pose(RALLY, { y: 2.5, head: -7, phase: 0.75, lift: 0.25, fx: { rune: 0.8, aura: 0.6, circle: 0.55, extra: tipRays(0.6, 14) } }),
  settle(pose(S, { y: 4, lean: 4, handF: [2, 6, 11], weapon: 30, roll: 24 }), 0.8, { phase: 0.9, wind: 0.3, fx: { rune: 0.3, circle: 0.15 } }),
];

// ── Flash ────────────────────────────────────────────────────────────────────────────────────

/** The dash: shield first, its shoulder leading, low, the sword held back and low. */
const DASH: ChibiPose = pose(S, {
  x: 9,
  y: 4,
  lean: 30,
  twist: 22,
  head: -14,
  look: -6,
  handF: [-3, 13, 10],
  weapon: -100,
  roll: 0,
  yaw: -24,
  handB: [11, 10, -2],
  elbowB: [0.1, -0.2, 1],
  yawB: -8,
  rollB: 0,
  weaponB: 0,
  face: 'shout',
  wind: 1.1,
  lift: 0.1,
});

const flashDash: ChibiPose[] = [
  // Crouched behind the shield, the light gathering.
  pose(S, { x: -3, y: 10, lean: 18, twist: 18, head: -4, footF: [9, 0, 5.4], footB: [-13, 0, 4.8], handF: [-1, 13, 10], weapon: -80, roll: 0, yaw: -24, handB: [9, 11, -1], elbowB: [0.2, -0.3, 1], yawB: -4, rollB: 0, face: 'grit', wind: 0.3, fx: { aura: 0.6, runeB: 0.2, dust: 0.5 } }),
  // Launch: the back leg drives off, a flash of light.
  pose(DASH, { x: 6, y: 5, footF: [14, -7, 5], footB: [-16, 0, 5], phase: 0.1, fx: { aura: 1, runeB: 0.35, dust: 1, speed: 0.8, ghosts: { k: 0.6, n: 3 }, extra: streaks(0.6) } }),
  // The dash: long bounding strides, barely touching the ground.
  pose(DASH, { y: 0, footF: [23, -4, 5], footB: [-14, -10, 5], phase: 0.3, fx: { aura: 1, runeB: 0.35, speed: 1, ghosts: { k: 1, n: 3 }, extra: streaks(1) } }),
  pose(DASH, { y: 4, footF: [8, 0, 5], footB: [12, -11, 5], phase: 0.5, fx: { aura: 1, runeB: 0.3, speed: 1, dust: 0.7, ghosts: { k: 0.9, n: 3 }, extra: streaks(0.9) } }),
  pose(DASH, { y: 0, footF: [-14, -10, 5], footB: [22, -4, 5], phase: 0.7, fx: { aura: 0.9, runeB: 0.25, speed: 1, ghosts: { k: 0.8, n: 3 }, extra: streaks(1) } }),
  // The braced stop: the lead leg thrust out straight, heel dug in, the shield still forward.
  pose(S, { x: 11, y: 11, lean: -6, twist: 8, head: -2, look: -4, footF: [26, 0, 6], footB: [3, 0, 5.4], handF: [0, 12, 11], weapon: -60, roll: 10, yaw: -20, handB: [10, 10, -1], elbowB: [0.3, -0.3, 1], yawB: -2, rollB: 4, face: 'grit', wind: 0, lift: 0.2, sway: 0.4, phase: 0.85, fx: { aura: 0.5, runeB: 0.2, dust: 1, ghosts: { k: 0.3, n: 2 }, extra: skid(1) } }),
  pose(S, { x: 8, y: 7, lean: 4, twist: 0, head: 1, footF: [19, 0, 6], footB: [-4, 0, 5.4], handF: [3, 11, 10], weapon: 30, roll: 22, face: 'stern', wind: 0.15, phase: 1, fx: { aura: 0.2, dust: 0.5, extra: skid(0.4) } }),
  settle(pose(S, { x: 3, y: 5, lean: 8, handF: [4, 11, 9.5], weapon: 44 }), 0.85, { phase: 1.1 }),
];

// ── Mend ─────────────────────────────────────────────────────────────────────────────────────

/** The salute: the sword raised point up before her, its point tipped a little ahead so it stands clear of her face side on; the shield lowered at her side. */
const SALUTE: ChibiPose = pose(S, {
  x: 0,
  y: 2.5,
  lean: -2,
  twist: -10,
  head: -3,
  look: 0,
  footF: [6, 0, 5],
  footB: [-6, 0, 4.6],
  handF: [12, 7, 6],
  weapon: 18,
  roll: 4,
  yaw: 0,
  handB: [5, 13, 7],
  elbowB: [0.1, -0.6, 1],
  yawB: 14,
  rollB: 0,
  weaponB: 0,
  face: 'closed',
  wind: 0.15,
  lift: 0.1,
});

/** Mid-heal: frame i of the column's pour, the motes rising and the pulse spreading. */
const mending = (i: number, k = 1): ChibiPose =>
  pose(SALUTE, {
    y: 2.5 - Math.sin(i * 0.9) * 0.4,
    phase: i * 0.12,
    lift: 0.1 + 0.05 * k,
    fx: { rune: 1, aura: 0.25 * k, rays: { k, column: true, radius: 13 }, motes: { k, n: 16, rise: i * 0.1 }, extra: pulse(clamp((i - 1) / 5, 0, 1)) },
  });

const mend: ChibiPose[] = [
  // Wind-up: the sword swept up out of her guard toward her face.
  fromReady(pose(SALUTE, { handF: [11, 9, 7], weapon: 34, face: 'stern', fx: { rune: 0.5 } }), 0.6),
  // Raised; the light begins to pour down.
  pose(SALUTE, { phase: 0.1, fx: { rune: 0.9, rays: { k: 0.45, column: true, radius: 11 }, motes: { k: 0.5, n: 16, rise: 0 } } }),
  mending(1),
  mending(2),
  mending(3),
  mending(4),
  mending(5),
  // The light fades; she opens her eyes.
  pose(mending(6, 0.55), { face: 'stern' }),
  // Lowering the sword into her guard.
  settle(pose(SALUTE, { handF: [7, 8, 9], weapon: 30, roll: 16, face: 'stern' }), 0.5, { phase: 0.9, fx: { rune: 0.4, motes: { k: 0.3, n: 16, rise: 0.75 } } }),
  settle(SALUTE, 0.9, { phase: 1, face: 'stern', fx: { rune: 0.15 } }),
];

// ── Shield's Up! ─────────────────────────────────────────────────────────────────────────────

/** Planted low behind the shield, its point on the floor before her, the sword ready over it. */
const PLANTED: ChibiPose = pose(S, {
  x: 0,
  y: 8,
  lean: 8,
  twist: -4,
  head: 6,
  look: 0,
  footF: [12, 0, 6.5],
  footB: [-12, 0, 6],
  handF: [1, 9, 10],
  weapon: 52,
  roll: 30,
  yaw: -8,
  handB: [2, 12, 6],
  elbowB: [0.5, -0.2, 0.4],
  yawB: -30,
  rollB: 10,
  weaponB: 0,
  face: 'grit',
  wind: 0.2,
});

/** The dome's size: over her head, wide enough to take in the shield's point. */
const DOME_R = 33;
const DOME_H = 64;
/** Rows of cells up the dome, and roughly how far apart their middles are (pixels). */
const DOME_ROWS = 11;
const CELL = 6.6;

/** A cell of the dome: where it sits (latitude, longitude, radians) and its row. */
interface Cell {
  lat: number;
  lon: number;
  row: number;
}

/** The dome's cells, row by row from the floor up, each row offset by half a cell from the one below. */
const CELLS: Cell[] = [];
for (let row = 0; row < DOME_ROWS; row++) {
  const lat = ((row + 0.5) / DOME_ROWS) * (Math.PI / 2);
  const n = Math.max(1, Math.round((2 * Math.PI * DOME_R * Math.cos(lat)) / CELL));
  for (let j = 0; j < n; j++) CELLS.push({ lat, lon: ((j + (row % 2) * 0.5) / n) * Math.PI * 2, row });
}

/** A gold-filled hexagon on the effects layer: its corners on screen, its fill and edge colours. */
function hexagon(x: FxContext, pts: Vec[], fill: RGB, fa: number, edge: RGB, ea: number, under: boolean): void {
  const { c } = x;
  if (fa > 0.01) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      x0 = Math.min(x0, p[0]);
      y0 = Math.min(y0, p[1]);
      x1 = Math.max(x1, p[0]);
      y1 = Math.max(y1, p[1]);
    }
    for (let py = Math.floor(y0); py <= Math.ceil(y1); py++) {
      for (let px = Math.floor(x0); px <= Math.ceil(x1); px++) {
        let hit = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const a = pts[j] as Vec;
          const b = pts[i] as Vec;
          if (a[1] > py + 0.5 !== b[1] > py + 0.5 && px + 0.5 < a[0] + ((py + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1])) hit = !hit;
        }
        if (hit) c.glow(px, py, fill, fa, under);
      }
    }
  }
  for (let q = 0; q < pts.length; q++) glowLine(c, pts[q] as Vec, pts[(q + 1) % pts.length] as Vec, edge, ea, under);
}

/** A cell's middle on the dome (hero space, `out` times as far out), its way outward, and the two ways along the dome at it. */
function onDome(g: V3, cell: Cell, out = 1): { p: V3; n: V3; e: V3; t: V3 } {
  const cl = Math.cos(cell.lat);
  const sl = Math.sin(cell.lat);
  const co = Math.cos(cell.lon);
  const so = Math.sin(cell.lon);
  const p: V3 = [g[0] + DOME_R * cl * co * out, DOME_H * sl * out, g[2] + DOME_R * cl * so * out];
  const n = norm3([(cl * co) / DOME_R, sl / DOME_H, (cl * so) / DOME_R]);
  const e: V3 = [-so, 0, co];
  const t = norm3([-sl * co * DOME_R, cl * DOME_H, -sl * so * DOME_R]);
  return { p, n, e, t };
}

/**
 * The dome of Shield's Up!: gold hexagons over her from the floor up (`k` how far it has formed,
 * 0 to 1, rising from the floor), each with a gold edge and a faint gold fill; the cells along the
 * dome's outline as she is seen are brighter, so its shape reads; a shimmer of pale gold runs
 * round it (`spin`, in turns, advancing every frame). Cells on the far side are behind her.
 */
const hexDome =
  (k: number, spin: number): Extra =>
  (x) => {
    const { cam, rig, aura } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const PALE: RGB = [255, 233, 168];
    for (const cell of CELLS) {
      const grow = clamp(k * (DOME_ROWS + 1.5) - cell.row, 0, 1);
      if (grow <= 0) continue;
      const { p, n, e, t } = onDome(g, cell);
      const facing = cam.facing(n);
      const back = facing < 0;
      // The outline: cells seen nearly edge on.
      const rim = 1 - clamp(Math.abs(facing) / 0.4, 0, 1);
      const shimmer = Math.max(0, Math.cos(cell.lon - spin * Math.PI * 2 + cell.lat * 1.5)) ** 6;
      const s = (CELL / 2) * 0.86 * (0.5 + 0.5 * grow);
      const pts = Array.from({ length: 6 }, (_, q): Vec => {
        const a = (q / 6) * Math.PI * 2 + Math.PI / 6;
        return x.proj(add3(add3(p, e, Math.cos(a) * s), t, Math.sin(a) * s));
      });
      const edge = shimmer > 0.3 ? PALE : aura.core;
      const ea = grow * (back ? 0.42 : 0.2) + rim * 0.5 * grow + shimmer * 0.45;
      const fa = grow * ((back ? 0.08 : 0.04) + shimmer * 0.2);
      hexagon(x, pts, shimmer > 0.3 ? PALE : aura.core, fa, edge, Math.min(1, ea), back);
    }
    // A brighter ring where the dome meets the floor.
    const n = 120;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      const q = x.proj([g[0] + Math.cos(th) * DOME_R, 0, g[2] + Math.sin(th) * DOME_R]);
      x.c.glow(q[0], q[1], aura.core, 0.7 * k, Math.sin(th + cam.yaw) <= 0);
    }
  };

/**
 * The dome bursting (`k` 0, just burst, to 1, flown and gone): its cells break away as gold
 * hexagonal shards flying outward and up in every direction, spinning as they go and shrinking
 * as they fade, with a bright ring of light rolling out over the floor from her feet. By `k` 1
 * almost nothing is left, so the battle stance can take over.
 */
const hexBurst =
  (k: number): Extra =>
  (x) => {
    const { cam, rig, aura, hash } = x;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const fade = (1 - k) ** 1.3;
    CELLS.forEach((cell, i) => {
      if (i % 2 === 1 && k > 0.3) return;
      const { p, n, e, t } = onDome(g, cell);
      // Out over the floor more than up, so they scatter round her rather than into the sky.
      const out = k * (0.8 + 0.6 * hash(i, 141));
      const lift: V3 = [p[0] + (p[0] - g[0]) * out, p[1] * (1 + k * 0.2) + k * 6 * hash(i, 142) - k * k * 8, p[2] + (p[2] - g[2]) * out];
      const back = cam.facing(n) < 0;
      const s = (CELL / 2) * 0.86 * (1 - k * 0.5);
      const spinA = hash(i, 143) * 6 + k * 5;
      const pts = Array.from({ length: 6 }, (_, q): Vec => {
        const a = (q / 6) * Math.PI * 2 + spinA;
        return x.proj(add3(add3(lift, e, Math.cos(a) * s), t, Math.sin(a) * s * (0.6 + 0.4 * Math.cos(spinA))));
      });
      hexagon(x, pts, aura.core, 0.45 * fade, i % 3 === 0 ? aura.hot : aura.core, 0.9 * fade, back);
    });
    // The ring rolling out from her feet: white-hot at its front, gold behind it, a pale blue fringe.
    const R = 12 + 46 * k;
    const m = Math.ceil(R * 8);
    for (let i = 0; i < m; i++) {
      const th = (i / m) * Math.PI * 2;
      const front = Math.sin(th + cam.yaw) > 0;
      for (const [rr, col, a] of [[1, aura.hot, 0.95], [0.95, aura.core, 0.8], [0.88, aura.core, 0.4], [1.05, SKY, 0.35]] as [number, RGB, number][]) {
        const q = x.proj([g[0] + Math.cos(th) * R * rr, 0, g[2] + Math.sin(th) * R * rr]);
        x.c.glow(q[0], q[1], col, a * fade, !front);
      }
    }
  };

/** Braced under the dome: `k` how far it has formed, `spin` the shimmer's place round it (turns). */
const braced = (k: number, spin: number, phase: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(PLANTED, { phase, wind: 0.2 + k * 0.1, lift: 0.1 + k * 0.15, ...over, fx: { runeB: 0.15 + k * 0.2, aura: 0.15 + k * 0.2, extra: hexDome(k, spin), ...over.fx } });

const shieldsUp: ChibiPose[] = [
  // Wind-up: down behind the shield.
  fromReady(pose(PLANTED, { y: 7, fx: { runeB: 0.15 } }), 0.6),
  // Set, the dome rising round her.
  braced(0.3, 0, 0.1, { fx: { dust: 0.8 } }),
  braced(0.6, 0.12, 0.2),
  braced(0.85, 0.24, 0.3),
  braced(1, 0.36, 0.4),
  braced(1, 0.48, 0.5, { y: 8.4, lean: 9 }),
  braced(1, 0.6, 0.6),
  // Straining as it fills with light.
  braced(1, 0.72, 0.7, { y: 8.6, lean: 10, face: 'shout', fx: { runeB: 0.4, aura: 0.6, extra: hexDome(1, 0.72) } }),
  // The burst: the shield thrust out, the dome breaking outward in shards of light all round her.
  pose(PLANTED, { x: 3, y: 8, lean: 14, twist: 10, head: 2, handB: [6, 12, 8], handF: [-1, 10, 10], weapon: 40, face: 'shout', wind: 0.6, lift: 0.3, phase: 0.85, fx: { runeB: 0.8, impactB: 1.2, aura: 1, rays: { k: 1, n: 14, len: 40 }, extra: hexBurst(0.22) } }),
  // The shards fly and fade as she settles back into her guard.
  settle(pose(PLANTED, { x: 3, y: 7, lean: 10, twist: 6 }), 0.7, { phase: 1, wind: 0.4, lift: 0.2, fx: { runeB: 0.15, aura: 0.15, extra: hexBurst(0.85) } }),
];

// ── Luminaire ────────────────────────────────────────────────────────────────────────────────

/**
 * The sword raised high beside her head, point up, the shield lowered at her left side with its
 * face out, so the sun on it shows toward the viewer and side on (thrown open at shoulder height
 * it would turn its oak back to both).
 */
const RAISED: ChibiPose = pose(S, {
  x: 0,
  y: 3,
  lean: -6,
  twist: -4,
  head: -8,
  look: 0,
  footF: [7, 0, 6.5],
  footB: [-7, 0, 6],
  handF: [-5, -9, 13],
  weapon: -2,
  roll: 10,
  yaw: 0,
  handB: [4, 11, 10],
  elbowB: [0.1, -0.5, 1],
  yawB: 0,
  rollB: 0,
  weaponB: 0,
  face: 'shout',
  wind: 0.3,
  lift: 0.25,
});

/** The burst, held while the rays wheel: thrust up as high as she can reach, `k` the light's strength, `spin` the rays' turn. */
const shining = (k: number, spin: number, spread: number, phase: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(RAISED, {
    y: 1.5,
    lean: -8,
    head: -10,
    handF: [-4, -11, 12],
    weapon: 0,
    lift: 0.45,
    wind: 0.4,
    phase,
    ...over,
    fx: { rune: 1.3, aura: k, rays: { k: 1.2 * k, n: 16, len: 52, spin }, extra: both(tipRays(k, -spin, 30), flood(spread)), ...over.fx },
  });

const luminaire: ChibiPose[] = [
  // Wind-up (stretched over the server's 0.6 s): she sinks and draws the sword up as light gathers on it...
  fromReady(pose(RAISED, { y: 6, lean: 6, head: 2, handF: [2, 8, 12], weapon: 20, roll: 14, handB: [6, 10.5, 7], elbowB: [0.2, -0.4, 1], yawB: 6, rollB: 2, face: 'grit', lift: 0.1, fx: { rune: 0.45, aura: 0.25, extra: gather(0.3) } }), 0.6),
  pose(RAISED, { y: 4, lean: -2, head: -4, handF: [-2, -3, 13], weapon: 0, handB: [5, 10.5, 8.5], elbowB: [0.15, -0.45, 1], yawB: 4, face: 'grit', lift: 0.15, phase: 0.1, fx: { rune: 0.9, aura: 0.45, extra: gather(0.65) } }),
  pose(RAISED, { phase: 0.2, fx: { rune: 1.4, aura: 0.7, extra: gather(1) } }),
  // Thrust up: light bursts out all round her and floods over the floor.
  shining(1.15, 0, 0.1, 0.3, { fx: { impact: 1.3, shock: 0.1, shockAt: [0, 0, 0] } }),
  shining(1, 8, 0.3, 0.4, { fx: { shock: 0.35, shockAt: [0, 0, 0] } }),
  shining(1, 16, 0.5, 0.5, { fx: { shock: 0.6, shockAt: [0, 0, 0] } }),
  shining(0.95, 24, 0.7, 0.6, { fx: { shock: 0.85, shockAt: [0, 0, 0] } }),
  shining(0.85, 32, 0.85, 0.7),
  shining(0.7, 40, 1, 0.8),
  // She brings the sword down before her as the light fades.
  pose(RAISED, { y: 4, lean: 4, head: 0, handF: [8, 3, 10], weapon: 40, roll: 20, handB: [6, 10, 6], elbowB: [0.1, -0.5, 1], yawB: 16, rollB: 0, face: 'stern', lift: 0.25, wind: 0.35, phase: 0.9, fx: { smear: { from: 0, roll: 10, yaw: 0, width: 0.5 }, rune: 0.9, aura: 0.45, rays: { k: 0.5, n: 16, len: 52, spin: 48 } } }),
  settle(pose(RAISED, { y: 4, lean: 6, head: 1, handF: [6, 8, 10], weapon: 50, roll: 22, handB: [7, 9.5, 2], elbowB: [0.35, -0.3, 1], yawB: 6, rollB: 4, face: 'stern' }), 0.3, { phase: 1, lift: 0.15, wind: 0.3, fx: { rune: 0.6, aura: 0.25, rays: { k: 0.25, n: 16, len: 52, spin: 56 } } }),
  settle(pose(RAISED, { y: 4, lean: 6, head: 1, handF: [6, 8, 10], weapon: 50, roll: 22, handB: [7, 9.5, 2], elbowB: [0.35, -0.3, 1], yawB: 6, rollB: 4, face: 'stern' }), 0.6, { phase: 1.1, lift: 0.15, wind: 0.25, fx: { rune: 0.35 } }),
  settle(pose(RAISED, { y: 4, lean: 6, head: 1, handF: [6, 8, 10], weapon: 50, roll: 22, handB: [7, 9.5, 2], elbowB: [0.35, -0.3, 1], yawB: 6, rollB: 4, face: 'stern' }), 0.85, { phase: 1.2, fx: { rune: 0.15 } }),
  settle(READY, 1, { phase: 1.3, wind: 0.22 }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { cast, q: flashDash, e: mend, r: shieldsUp, ult: luminaire };
