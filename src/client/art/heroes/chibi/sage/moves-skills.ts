/**
 * The Sage's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of their own
 * painted through `fx.extra`. Wind-up frames come first: they stretch over the server's wind-up
 * (Mending Light's 0.4 s, Resurrection's 1.5 s) or take 0.06 s each where there is none, and the
 * rest share the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special  7  (2 wind-up) Mending Light: the staff raised in his right hand and tilted toward the
 *               aim, out to his right, the left hand open beneath it, while gold-green light
 *               gathers in the orb; then both hands tip it forward to release it: a burst at the
 *               orb, a soft wave of light rolling out over the floor toward the aim and motes
 *               rising round him
 *   q        8  (2 wind-up) Arcane Orb: the staff swung back over his shoulder while a great teal
 *               orb forms at its head, then swung forward in a teal arc, pushing the orb away
 *               along the aim
 *   e       10  (2 wind-up) Sanctuary: the staff lifted in both hands and struck down upright
 *               before him on his right, one hand over the other on it; a ring of his runes pulses
 *               out over the floor from its foot and light rises from it while he bows his head
 *   r       10  (2 wind-up) Meteor: the staff thrust at the sky, a fiery sigil opening above the
 *               orb; then the staff swept down at the aim, the sigil pulled after it to high ahead
 *               of him and a ball of fire bursting out of it to dive off ahead and down toward the
 *               aim, embers drifting down where it passed (the game draws where it lands)
 *   ult     16  (8 wind-up, stretched over the server's 1.5 s) Resurrection: a long chant, the
 *               staff raised high on his right and the left hand lifted open on his left, eyes
 *               closed; a pillar of gold light pours down on him, rings of light climb slowly round
 *               him and motes and feathers of light rise; then the staff thrust up in a burst of
 *               gold rays and a ring of light rolling out over the floor
 *   cast     8  (2 wind-up) role skills (Arcane Blink, Mana Font) and the Elixir: a quick twirl
 *               of the staff beside his head in a teal arc, then planted with the orb flaring, a
 *               teal circle on the floor under him and sparkles spiralling up
 *
 * Each starts from the battle stance (`fromReady`) and ends in it (`settle`). Raised hands go out
 * beside his head, never across his face: his head is too big for a hand to get over it. The
 * staff is long (about 100 px), so where it stands upright it is held well ahead of him (clear of
 * his face side on) and out to his right (beside his head toward the viewer); on the way back to
 * the stance, which holds it across to his left, its head is dipped so that toward the viewer it
 * passes under his chin. His heals glow gold-green (LIFE), his Meteor burns orange (FIRE) and
 * Resurrection shines gold (GOLD_LIGHT); the rest is his own teal.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { column, flash, glowLine, motes, rays } from '../fx.js';
import { add3, type ChibiPose, clamp, type FxContext, lerp3, pose, rad, type V3 } from '../rig.js';
import { AIM, ARCANE, type Aura, ball, both, dipped, type Extra, FIRE, footAt, fromOrb, fromReady, gather, GOLD_LIGHT, LIFE, orbOf, plant, pool, READY, settle, tinted } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

/** The middle of the floor under him (hero space). */
const under = (x: FxContext): V3 => [x.rig.pelvis.o[0], 0, x.rig.pelvis.o[2]];

/** A level ring of light round a point (hero space), `r` in radius, `k` its strength; the half behind him passes behind him. */
function ringAt(x: FxContext, c: V3, r: number, col: RGB, k: number): void {
  const n = Math.max(12, Math.ceil(r * 6.5));
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const p3: V3 = [c[0] + Math.cos(th) * r, c[1], c[2] + Math.sin(th) * r];
    const p = x.proj(p3);
    x.c.glow(p[0], p[1], col, k, x.behind(p3));
  }
}

/** A glow on an effects layer, softened over the figure so he shows through it. */
function soft(x: FxContext, px: number, py: number, col: RGB, a: number, back: boolean): void {
  x.c.glow(px, py, col, !back && x.c.opaque(Math.floor(px), Math.floor(py)) ? a * 0.35 : a, back);
}

/**
 * A soft wave of healing light rolling out over the floor ahead of him toward the aim (Mending
 * Light): three broad arcs of gold-green bowing out toward the aim, `t` how far they have rolled
 * (0 just ahead of his feet to 1 well out ahead), `k` their strength, the leading one brightest and
 * each fading as it goes.
 */
const wave =
  (t: number, k: number): Extra =>
  (x) => {
    const g = under(x);
    const bands: [number, RGB, number][] = [
      [-2.2, LIFE.edge, 0.35],
      [-1.1, LIFE.core, 0.8],
      [0, LIFE.hot, 1],
      [1.1, LIFE.core, 0.8],
      [2.2, LIFE.edge, 0.35],
    ];
    for (let j = 0; j < 3; j++) {
      const d = 10 + t * 46 - j * 10;
      if (d < 8) continue;
      const fade = k * (1 - j * 0.3) * clamp(1.2 - d / 64, 0, 1);
      // An arc of a circle round the middle of the floor under him, bowing out toward the aim.
      const half = 0.85;
      const n = Math.ceil(d * 3.4);
      for (let i = 0; i <= n; i++) {
        const th = -half + (2 * half * i) / n;
        const ends = 1 - Math.pow(Math.abs(th) / half, 3);
        for (const [dr, col, a] of bands) {
          const p3: V3 = [g[0] + Math.cos(th) * (d + dr), 0.5, g[2] + Math.sin(th) * (d + dr)];
          const p = x.proj(p3);
          soft(x, p[0], p[1], col, fade * a * ends, x.behind(p3));
        }
      }
    }
  };

/** His runes: small abstract signs, three pixels wide and five tall (a stroke, a fork, a hook, a diamond, a cross-bar, a split), none of them a letter. */
const RUNES: readonly (readonly string[])[] = [
  ['.#.', '##.', '.#.', '.##', '.#.'],
  ['#.#', '#.#', '.#.', '.#.', '.#.'],
  ['##.', '#.#', '#..', '#..', '#..'],
  ['.#.', '#.#', '.#.', '#.#', '.#.'],
  ['.#.', '###', '.#.', '###', '.#.'],
  ['.#.', '.#.', '#.#', '#.#', '.#.'],
];

/**
 * A ring of runes on the floor round a point (Sanctuary, round the staff's foot), `r` in radius and
 * `k` its strength, turned `spin` degrees: a bright line with a fainter one inside it, and runes
 * standing on the floor between them, the ones behind him passing behind him.
 */
const runeRing =
  (at: (x: FxContext) => V3, r: number, k: number, spin: number, aura: Aura): Extra =>
  (x) => {
    if (k <= 0 || r <= 0) return;
    const c0 = at(x);
    const g: V3 = [c0[0], 0, c0[2]];
    ringAt(x, g, r, aura.hot, k);
    ringAt(x, g, r + 1, aura.core, k * 0.6);
    ringAt(x, g, r * 0.72, aura.core, k * 0.55);
    const n = Math.max(4, Math.min(10, Math.round(r / 3)));
    for (let i = 0; i < n; i++) {
      const th = rad(spin) + (i / n) * Math.PI * 2;
      const p3: V3 = [g[0] + Math.cos(th) * r * 0.86, 0, g[2] + Math.sin(th) * r * 0.86];
      const p = x.proj(p3);
      const glyph = RUNES[i % RUNES.length] as readonly string[];
      const back = x.behind(p3);
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) if (row[gx] === '#') x.c.glow(p[0] - 1 + gx, p[1] - 5 + gy, gy < 2 ? aura.hot : aura.core, k, back);
      });
    }
  };

/** Light rising from a ring on the floor (Sanctuary's hallowed ground): thin streaks climbing from it, `t` how far they have climbed, `k` their strength. */
const rising =
  (at: (x: FxContext) => V3, r: number, t: number, k: number, aura: Aura): Extra =>
  (x) => {
    if (k <= 0) return;
    const c0 = at(x);
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + x.hash(i, 611) * 0.4;
      const rr = r * (0.55 + 0.45 * x.hash(i, 612));
      const h0 = ((x.hash(i, 613) * 20 + t * 40) % 40) + 2;
      const len = 5 + x.hash(i, 614) * 6;
      const p3: V3 = [c0[0] + Math.cos(th) * rr, h0, c0[2] + Math.sin(th) * rr];
      const a = x.proj(p3);
      const b = x.proj([p3[0], h0 + len, p3[2]]);
      const fade = k * Math.sin(Math.PI * clamp(h0 / 42, 0, 1));
      glowLine(x.c, a, b, aura.core, fade * 0.8, x.behind(p3));
      x.c.glow(b[0], b[1], aura.hot, fade, x.behind(p3));
    }
  };

/**
 * The Meteor's sigil, opening in the air above the orb: a wheel of fire facing the viewer, `k` how
 * far it has opened (0 a spark, 1 full size) and `spin` turning it: a bright rim with a ring inside
 * it, spokes between them, a ring of small marks round the rim and a hot heart. It rides above the
 * orb as the staff rises; `t` is how far it has since been pulled from over his head to high ahead
 * of him (0 to 1).
 */
const sigil =
  (k: number, spin: number, t = 0): Extra =>
  (x) => {
    if (k <= 0) return;
    const where = t > 0 ? lerp3(SIGIL, ABOVE_AIM, t) : add3(x.tip, [0, 1, 0], SIGIL_UP);
    const P = x.proj(where);
    const R = 4 + 10 * k;
    const sq = 0.62;
    const at = (r: number, th: number): Vec => [P[0] + Math.cos(th) * r, P[1] + Math.sin(th) * r * sq];
    const circle = (r: number, col: RGB, a: number): void => {
      const n = Math.ceil(r * 7);
      for (let i = 0; i < n; i++) {
        const p = at(r, (i / n) * Math.PI * 2);
        x.c.glow(p[0], p[1], col, a);
      }
    };
    // A faint disc of fire inside it.
    for (let dy = -Math.ceil(R * sq); dy <= Math.ceil(R * sq); dy++) {
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        const d = (dx / R) ** 2 + (dy / (R * sq)) ** 2;
        if (d < 1) x.c.glow(P[0] + dx, P[1] + dy, FIRE.edge, 0.22 * k);
      }
    }
    circle(R + 1, FIRE.edge, 0.6 * k);
    circle(R, FIRE.hot, k);
    circle(R * 0.62, FIRE.core, 0.9 * k);
    const s = rad(spin);
    for (let i = 0; i < 8; i++) {
      const th = s + (i / 8) * Math.PI * 2;
      glowLine(x.c, at(R * 0.62, th), at(R, th), i % 2 ? FIRE.core : FIRE.hot, 0.85 * k);
      // A mark beyond the rim between the spokes.
      const m = at(R + 2.5, th + Math.PI / 8);
      x.c.glow(m[0], m[1], FIRE.hot, 0.8 * k);
    }
    ball(where, 2 + 1.5 * k, k, FIRE)(x);
  };

/**
 * A streak of fire from `from` to `to` (hero space), `k` its strength: brightest and widest at its
 * head, where a ball of fire `r` across is (none at 0), fading back toward where it started, with
 * embers shed along it; softened where it passes over him.
 */
const streak =
  (from: V3, to: V3, k: number, r = 3): Extra =>
  (x) => {
    if (k <= 0) return;
    const A = x.proj(from);
    const B = x.proj(to);
    const back = x.behind(to);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const nx = -(B[1] - A[1]) / L;
    const ny = (B[0] - A[0]) / L;
    const n = Math.ceil(L);
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const w = 0.5 + s * 1.5;
      for (const [o, col, a] of [[0, FIRE.hot, 1], [1, FIRE.core, 0.85], [-1, FIRE.core, 0.85], [2, FIRE.edge, 0.45], [-2, FIRE.edge, 0.45]] as [number, RGB, number][]) {
        soft(x, A[0] + (B[0] - A[0]) * s + nx * o * w * 0.8, A[1] + (B[1] - A[1]) * s + ny * o * w * 0.8, col, a * k * (0.15 + 0.85 * s), back);
      }
    }
    for (let i = 0; i < 8; i++) {
      const s = x.hash(i, 631);
      const p: Vec = [A[0] + (B[0] - A[0]) * s + nx * (x.hash(i, 632) - 0.5) * 8, A[1] + (B[1] - A[1]) * s + ny * (x.hash(i, 632) - 0.5) * 8 + x.hash(i, 633) * 3];
      soft(x, p[0], p[1], i % 2 ? FIRE.hot : FIRE.core, k * 0.9 * s, back);
    }
    ball(to, r, k, FIRE)(x);
  };

/** The sigil's fire pulled from over his head toward high over the aim, `t` of the way (its head where the sigil now is). */
const pull = (t: number, k: number): Extra => streak(SIGIL, lerp3(SIGIL, ABOVE_AIM, t), k * 0.8, 2.5);

/** A point `t` of the way from the sigil high ahead of him to the floor far off along the aim. */
const onDive = (t: number): V3 => lerp3(ABOVE_AIM, AIM_FAR, t);

/**
 * The Meteor sent on its way: a ball of fire `r` across bursting out of the sigil and diving off
 * ahead and down toward the aim, its head `t` of the way (it is gone from his frame by about 0.8)
 * and its streak burning `tail` back along its path; `k` its strength.
 */
const dive = (t: number, tail: number, k: number, r = 3.5): Extra => streak(onDive(Math.max(0, t - tail)), onDive(t), k, r);

/** Embers drifting down from where the Meteor's fire passed, `t` how far they have fallen (0 to 1), `k` their strength. */
const cinders =
  (t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    for (let i = 0; i < 12; i++) {
      const p0 = onDive(0.05 + 0.7 * x.hash(i, 641));
      const p3: V3 = [p0[0] + (x.hash(i, 642) - 0.5) * 8, p0[1] - t * (8 + 12 * x.hash(i, 643)), p0[2]];
      const P = x.proj(p3);
      const back = x.behind(p3);
      const a = k * (0.5 + 0.5 * x.hash(i, 644));
      x.c.glow(P[0], P[1], i % 3 ? FIRE.core : FIRE.hot, a, back);
      x.c.glow(P[0], P[1] - 1, FIRE.edge, a * 0.5, back);
    }
  };

/** A small feather of light: [dx, dy, tone], its quill to the lower left. */
const FEATHER: [number, number, 'hot' | 'core' | 'edge'][] = [
  [0, 0, 'core'],
  [1, -1, 'hot'],
  [2, -2, 'hot'],
  [1, -2, 'edge'],
  [2, -3, 'edge'],
  [3, -3, 'hot'],
  [3, -4, 'edge'],
];

/** Feathers of gold light rising round him and turning as they climb (Resurrection), `t` how far they have risen, `k` their strength. */
const feathers =
  (t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    const g = x.rig.pelvis.o;
    for (let i = 0; i < 7; i++) {
      const th = x.hash(i, 651) * Math.PI * 2 + t * 1.5;
      const r = 12 + x.hash(i, 652) * 12;
      const h = ((x.hash(i, 653) + t * (0.6 + 0.4 * x.hash(i, 654))) % 1) * 84;
      const p3: V3 = [g[0] + Math.cos(th) * r, 4 + h, g[2] + Math.sin(th) * r];
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * (h / 84));
      const flip = i % 2 ? 1 : -1;
      for (const [dx, dy, tone] of FEATHER) x.c.glow(p[0] + dx * flip, p[1] + dy, GOLD_LIGHT[tone], a, x.behind(p3));
    }
  };

/** Rings of gold light climbing slowly round him (Resurrection): `t` how far they have climbed, `k` their strength. */
const halos =
  (t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    const g = x.rig.pelvis.o;
    for (let j = 0; j < 3; j++) {
      const h = ((t + j / 3) % 1) * 90;
      const a = k * Math.sin(Math.PI * (h / 90));
      const r = 20 - h * 0.08;
      ringAt(x, [g[0], 2 + h, g[2]], r, GOLD_LIGHT.core, a * 0.8);
      ringAt(x, [g[0], 2 + h + 0.8, g[2]], r, GOLD_LIGHT.hot, a * 0.45);
    }
  };

/** A ring of light rolling out over the floor from under him, `t` how far it has rolled (0 to 1), `k` its strength, in the aura given. */
const swell =
  (t: number, k: number, aura: Aura, reach = 40): Extra =>
  (x) => {
    if (k <= 0) return;
    const g = under(x);
    const r = 6 + t * reach;
    const fade = k * (1 - t * 0.6);
    ringAt(x, g, r, aura.hot, fade);
    ringAt(x, g, r - 1.2, aura.core, fade * 0.7);
    ringAt(x, g, r + 1.2, aura.edge, fade * 0.4);
  };

/** Sparkles spiralling up round him (the cast), `t` how far up they have climbed, `k` their strength. */
const sparkles =
  (t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, aura, hash } = x;
    for (let i = 0; i < 10; i++) {
      const th = hash(i, 661) * Math.PI * 2 + t * 4;
      const r = 13 + hash(i, 662) * 8;
      const h = (hash(i, 663) * 30 + t * 50) % 72;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * r, 4 + h, rig.pelvis.o[2] + Math.sin(th) * r];
      const back = x.behind(p3);
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * (h / 72));
      c.glow(p[0], p[1], aura.hot, a, back);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(p[0] + dx, p[1] + dy, i % 3 ? aura.core : aura.edge, a * 0.7, back);
    }
  };

/** A burst of light at the orb in the aura given (the engine's release flash, sent along `dir`). */
const burst =
  (k: number, aura: Aura, dir: V3 = AIM): Extra =>
  (x) =>
    flash({ ...x, aura }, x.tip, dir, k);

/** Light rays round the orb in the aura given. */
const orbRays =
  (k: number, aura: Aura, spin = 0, len = 22): Extra =>
  (x) =>
    rays({ ...x, aura }, x.tip, k, { n: 10, len, spin });

// ── Mending Light ────────────────────────────────────────────────────────────────────────────

/** The staff raised and tilted toward the aim in his right hand, out to his right, the orb above his brow ahead of him, the left hand open beneath it, his chin up to watch it. */
const MEND_UP: ChibiPose = pose(S, { x: -1, y: 3, lean: -2, twist: 8, head: -5, look: -2, handF: [16, 5, 10], handB: [10, 9, 4], grip: -4, weapon: 30, roll: 12, yaw: 0, wind: 0.2, lift: 0.2, face: 'stern' });
/** Tipped forward to release it. */
const MEND_OUT: ChibiPose = pose(S, { x: 2, y: 4, lean: 12, twist: 12, head: 2, look: -2, handF: [9, 12, 6], grip: -4, grip2: 9, weapon: 56, roll: -6, yaw: -28, wind: 0.45, lift: 0.1, face: 'stern' });

const special: ChibiPose[] = [
  fromReady(MEND_UP, 0.9, { fx: { rune: 0.6, extra: both(ball(fromOrb(0.5), 2.5, 0.8, LIFE), gather(0.7, 0, 9, LIFE)) } }),
  pose(MEND_UP, { y: 3.5, lean: -3, head: -6, weapon: 30, phase: 0.1, face: 'closed', fx: { rune: 1, extra: both(orbRays(0.6, LIFE, 10, 18), ball(fromOrb(0.5), 4, 1, LIFE), gather(1, 0.5, 10, LIFE)) } }),
  pose(MEND_OUT, { phase: 0.25, fx: { rune: 1, extra: both(burst(1.3, LIFE), ball(fromOrb(2), 4.5, 1, LIFE), wave(0, 1.2), tinted(LIFE, (x) => motes(x, 0.7, { rise: 0 }))) } }),
  pose(MEND_OUT, { y: 4.5, lean: 13, weapon: 58, wind: 0.5, phase: 0.4, fx: { rune: 0.8, extra: both(ball(fromOrb(0.5), 3, 0.8, LIFE), wave(0.35, 1.2), tinted(LIFE, (x) => motes(x, 0.9, { rise: 0.15 }))) } }),
  pose(MEND_OUT, { y: 4.5, lean: 11, weapon: 54, wind: 0.35, lift: 0.2, phase: 0.55, fx: { rune: 0.6, extra: both(wave(0.7, 0.8), tinted(LIFE, (x) => motes(x, 0.8, { rise: 0.3 }))) } }),
  settle(MEND_OUT, 0.5, { wind: 0.25, lift: 0.15, phase: 0.7, fx: { rune: 0.45, extra: both(wave(1, 0.45), tinted(LIFE, (x) => motes(x, 0.5, { rise: 0.45 }))) } }),
  settle(MEND_OUT, 0.88, { wind: 0.18, phase: 0.85, fx: { rune: 0.35, extra: tinted(LIFE, (x) => motes(x, 0.25, { rise: 0.6 })) } }),
];

// ── Arcane Orb ───────────────────────────────────────────────────────────────────────────────

/** The staff swung back over his right shoulder in both hands, the orb high behind him. */
const ORB_BACK: ChibiPose = pose(S, { x: -2, y: 4, lean: -6, twist: -16, head: -2, look: 2, footF: [9, 0, 5.2], footB: [-9, 0, 4.6], handF: [-2, 7, 9], grip: -4, grip2: 9, weapon: -34, roll: 14, yaw: -4, wind: 0.25, lift: 0.2, sway: 0.2, face: 'grit' });
/** Swung forward, both arms driving it out at the aim. */
const ORB_PUSH: ChibiPose = pose(S, { x: 4, y: 5.5, lean: 16, twist: 10, head: 3, look: -2, footF: [12, 0, 5.4], footB: [-9, 0, 4.6], handF: [11, 11, 6], grip: -4, grip2: 9, weapon: 64, roll: 0, yaw: -22, wind: 0.6, lift: 0, phase: 0.25, face: 'shout' });

const q: ChibiPose[] = [
  fromReady(pose(ORB_BACK, { weapon: -20, handF: [0, 9, 8.5] }), 0.6, { fx: { rune: 0.8, extra: ball(fromOrb(1), 3, 0.9) } }),
  pose(ORB_BACK, { phase: 0.1, fx: { rune: 1, aura: 0.3, extra: both(ball(fromOrb(1), 6, 1), gather(1, 0.3, 12)) } }),
  pose(ORB_PUSH, { fx: { rune: 1, flash: { k: 1, from: 'main', dir: AIM }, smear: { from: -34, roll: 14, yaw: -4, width: 0.85, alpha: 1 }, extra: ball(fromOrb(12), 7, 1) } }),
  pose(ORB_PUSH, { y: 6, lean: 17, weapon: 66, wind: 0.7, phase: 0.4, face: 'grit', fx: { rune: 0.7, trail: { k: 0.6, from: 'main', dir: AIM, len: 22 }, smear: { from: -34, roll: 14, yaw: -4, width: 0.7, alpha: 0.45 }, extra: ball(fromOrb(30), 6.5, 1) } }),
  pose(ORB_PUSH, { y: 5.5, lean: 15, weapon: 62, wind: 0.5, lift: 0.2, phase: 0.55, face: 'stern', fx: { rune: 0.5, trail: { k: 0.35, from: 'main', dir: AIM, len: 44 }, extra: ball(fromOrb(50), 6, 0.75) } }),
  settle(ORB_PUSH, 0.4, { wind: 0.35, lift: 0.2, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(ORB_PUSH, 0.72, { wind: 0.25, lift: 0.1, phase: 0.85, fx: { rune: 0.35 } }),
  settle(ORB_PUSH, 0.92, { wind: 0.18, phase: 1, fx: { rune: 0.35 } }),
];

// ── Sanctuary ────────────────────────────────────────────────────────────────────────────────

/**
 * The staff planted upright before him on his right, both hands on it, one over the other, his
 * head bowed and turned a little away from it: side on it stands ahead of his face, toward the
 * viewer beside it.
 */
const PLANTED: ChibiPose = plant({ ...S, x: 0, y: 4, lean: 12, twist: 20, head: 8, look: -6, footF: [7, 0, 5.4], footB: [-8, 0, 4.8], handF: [16, 3, 6], grip: 0, grip2: 3, weapon: 8, roll: 14, yaw: -4, wind: 0.2, face: 'closed' });

/** Where the staff strikes the floor: the ring and the light come from there, and stay there as he lifts it away. */
const SPOT: V3 = footAt(PLANTED);
const spot = (): V3 => SPOT;

const e: ChibiPose[] = [
  // The staff lifted in both hands, its foot off the floor.
  fromReady(pose(PLANTED, { y: 3, lean: 6, head: -2, handF: [15, 0, 6.5], weapon: 7, face: 'grit' }), 0.8, { fx: { rune: 0.6 } }),
  pose(PLANTED, { y: 1.5, lean: 2, head: -4, handF: [15, -2, 6.5], weapon: 8, wind: 0.25, lift: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.9, extra: gather(0.8, 0.2, 10, LIFE) } }),
  // Struck down: the ring leaps out from its foot.
  pose(PLANTED, { y: 5, lean: 14, head: 6, wind: 0.45, lift: -0.1, phase: 0.2, face: 'shout', fx: { rune: 1, dust: 0.5, extra: both(runeRing(spot, 7, 1, 0, LIFE), pool(spot, 10, 1, LIFE), burst(0.7, LIFE, [0, 1, 0])) } }),
  pose(PLANTED, { y: 4.5, phase: 0.3, fx: { rune: 1, extra: both(runeRing(spot, 13, 1, 8, LIFE), pool(spot, 15, 0.8, LIFE), rising(spot, 12, 0, 0.8, LIFE)) } }),
  pose(PLANTED, { phase: 0.4, fx: { rune: 0.9, extra: both(runeRing(spot, 19, 1, 16, LIFE), runeRing(spot, 8, 0.7, -10, LIFE), pool(spot, 20, 0.7, LIFE), rising(spot, 17, 0.2, 1, LIFE)) } }),
  pose(PLANTED, { y: 4.5, lean: 13, phase: 0.5, fx: { rune: 0.9, extra: both(runeRing(spot, 24, 0.95, 24, LIFE), runeRing(spot, 13, 0.8, -20, LIFE), pool(spot, 24, 0.6, LIFE), rising(spot, 21, 0.4, 1, LIFE)) } }),
  pose(PLANTED, { y: 4, lean: 12, phase: 0.6, fx: { rune: 0.8, extra: both(runeRing(spot, 27, 0.75, 32, LIFE), runeRing(spot, 18, 0.7, -30, LIFE), pool(spot, 26, 0.5, LIFE), rising(spot, 23, 0.6, 0.8, LIFE)) } }),
  pose(PLANTED, { y: 4.5, phase: 0.7, face: 'stern', head: 4, fx: { rune: 0.6, extra: both(runeRing(spot, 29, 0.5, 40, LIFE), runeRing(spot, 22, 0.5, -40, LIFE), rising(spot, 24, 0.8, 0.5, LIFE)) } }),
  // Lifted back out into the stance, its head dipped so that toward the viewer it passes under his chin.
  settle(dipped(PLANTED), 0.3, { wind: 0.2, phase: 0.8, face: 'stern', fx: { rune: 0.45, extra: runeRing(spot, 30, 0.25, 48, LIFE) } }),
  settle(dipped(PLANTED), 0.85, { wind: 0.16, phase: 0.9, fx: { rune: 0.35 } }),
];

// ── Meteor ───────────────────────────────────────────────────────────────────────────────────

/** The staff thrust at the sky in his right hand, out beside his head; the left hand points ahead at the aim. */
const SKY: ChibiPose = pose(S, { x: -1, y: 3, lean: -6, twist: -6, head: -8, look: 0, handF: [-7, -8, 13], handB: [12, 8, 6], grip: -6, weapon: 4, roll: 10, yaw: 0, wind: 0.3, lift: 0.35, face: 'shout' });

/** How high over the orb the sigil opens. */
const SIGIL_UP = 14;
/** Where the sigil is once open, in the air above the orb thrust at the sky. */
const SIGIL: V3 = add3(orbOf(pose(SKY, { y: 2.5, lean: -8, head: -9 })), [0, 1, 0], SIGIL_UP);
/**
 * Where the staff sweeping down at the aim pulls it to, high ahead of him, a little to his left (so
 * that toward the viewer its fire dives down beside him rather than down his face); and where that
 * fire dives toward, the floor far off along the aim, out of his frame.
 */
const ABOVE_AIM: V3 = [42, 100, -16];
const AIM_FAR: V3 = [150, 0, -16];
/** The staff swept down at the aim, the fire following it. */
const CALL: ChibiPose = pose(S, { x: 3, y: 5, lean: 14, twist: 4, head: 3, look: -2, footF: [11, 0, 5.4], handF: [10, 10, 7], handB: [6, 14, 7], grip: -6, weapon: 66, roll: 4, yaw: -8, wind: 0.5, lift: 0.1, face: 'grit' });

const r: ChibiPose[] = [
  fromReady(pose(SKY, { handF: [0, 0, 11], weapon: 10, head: -4 }), 0.6, { fx: { rune: 0.8, extra: sigil(0.25, 0) } }),
  pose(SKY, { phase: 0.1, fx: { rune: 1, extra: sigil(0.6, 15) } }),
  pose(SKY, { y: 2.5, lean: -8, head: -9, phase: 0.2, wind: 0.35, lift: 0.45, fx: { rune: 1, aura: 0.3, extra: both(sigil(1, 30), tinted(FIRE, (x) => rays(x, add3(x.tip, [0, 1, 0], 14), 0.6, { n: 10, len: 26, spin: 10 }))) } }),
  pose(SKY, { y: 2.5, lean: -8, head: -9, phase: 0.3, fx: { rune: 1, extra: both(sigil(1, 45), tinted(FIRE, (x) => rays(x, add3(x.tip, [0, 1, 0], 14), 0.4, { n: 10, len: 22, spin: 20 }))) } }),
  pose(CALL, { phase: 0.4, fx: { rune: 1, extra: both(pull(0.6, 1), sigil(0.9, 60, 0.6)) } }),
  // The fire bursts out of the sigil and dives off toward the aim.
  pose(CALL, { y: 5.5, lean: 15, phase: 0.5, fx: { rune: 0.8, extra: both(sigil(0.75, 75, 1), tinted(FIRE, (x) => rays(x, ABOVE_AIM, 0.7, { n: 10, len: 20, spin: 8 })), dive(0.22, 0.22, 1, 5.5)) } }),
  pose(CALL, { y: 5.5, lean: 15, phase: 0.6, face: 'stern', fx: { rune: 0.7, extra: both(sigil(0.4, 90, 1), dive(0.52, 0.4, 1, 5)) } }),
  settle(CALL, 0.4, { phase: 0.7, wind: 0.3, face: 'stern', fx: { rune: 0.5, extra: both(sigil(0.15, 105, 1), dive(0.78, 0.35, 0.6, 3.5), cinders(0, 0.9)) } }),
  settle(CALL, 0.72, { phase: 0.85, wind: 0.22, fx: { rune: 0.4, extra: cinders(0.45, 0.65) } }),
  settle(CALL, 0.92, { phase: 1, wind: 0.16, fx: { rune: 0.35, extra: cinders(0.9, 0.3) } }),
];

// ── Resurrection ─────────────────────────────────────────────────────────────────────────────

/** The chant: the staff raised high on his right, the left hand lifted open on his left, chin up and eyes closed. */
const CHANT: ChibiPose = pose(S, { x: 0, y: 2, lean: -6, twist: 0, head: -8, look: 0, footF: [6, 0, 5.4], footB: [-6, 0, 5], handF: [-8, -8, 13], handB: [-6, -8, 13], grip: -4, weapon: 2, roll: 8, yaw: 0, wind: 0.2, lift: 0.4, face: 'closed' });

/** The chant's frame `i` of 8: the light growing, the rings and feathers rising. */
const chant = (i: number): ChibiPose => {
  const t = i / 7;
  const breath = Math.sin(i * 0.9) * 0.6;
  return pose(CHANT, {
    y: 2 + breath * 0.5,
    lean: -6 + breath,
    head: -8 - t * 2,
    handF: [-8, -8 - t, 13],
    handB: [-6, -8 - t, 13],
    lift: 0.3 + t * 0.4,
    sway: Math.sin(i * 0.8) * 0.2,
    phase: i / 8,
    fx: {
      rune: 0.6 + t * 0.4,
      aura: t * 0.4,
      extra: both(
        tinted(GOLD_LIGHT, (x) => column(x, x.rig.pelvis.o, 0.25 + t * 0.75, { radius: 9 + t * 5 })),
        halos(i / 8, 0.4 + t * 0.6),
        feathers(i / 8, 0.5 + t * 0.5),
        tinted(GOLD_LIGHT, (x) => motes(x, 0.5 + t * 0.5, { rise: i / 8 })),
        ball(fromOrb(0.5, [0, 1, 0]), 2 + t * 3, 0.6 + t * 0.4, GOLD_LIGHT),
      ),
    },
  });
};

/** The release: the staff thrust up, the arms flung wide, a burst of gold. */
const RAISE: ChibiPose = pose(CHANT, { y: 1, lean: -8, head: -10, handF: [-8, -10, 14], handB: [-4, -6, 15], weapon: -2, wind: 0.5, lift: 0.8, face: 'shout' });

/**
 * On the way back to the stance: the staff lowered and tipped forward on his right, so that toward
 * the viewer its head passes under his chin as it crosses to his left.
 */
const LOWERED: ChibiPose = pose(dipped(CHANT), { handB: [2, 10, 9] });

const ult: ChibiPose[] = [
  ...Array.from({ length: 8 }, (_, i) => (i === 0 ? fromReady(chant(0), 0.7) : chant(i))),
  pose(RAISE, { phase: 1, fx: { rune: 1, aura: 0.6, extra: both(tinted(GOLD_LIGHT, (x) => rays(x, x.rig.chest.o, 1.3, { n: 14, behind: true, len: 52 })), burst(1.3, GOLD_LIGHT, [0, 1, 0]), swell(0, 1, GOLD_LIGHT), feathers(1, 1)) } }),
  pose(RAISE, { y: 1.5, phase: 1.1, fx: { rune: 1, aura: 0.4, extra: both(tinted(GOLD_LIGHT, (x) => rays(x, x.rig.chest.o, 1, { n: 14, behind: true, len: 52, spin: 6 })), swell(0.35, 1, GOLD_LIGHT), feathers(1.12, 1), tinted(GOLD_LIGHT, (x) => motes(x, 1, { rise: 1.1 }))) } }),
  pose(RAISE, { y: 2, lean: -6, head: -8, phase: 1.2, face: 'closed', fx: { rune: 0.9, extra: both(tinted(GOLD_LIGHT, (x) => rays(x, x.rig.chest.o, 0.6, { n: 14, behind: true, len: 52, spin: 12 })), swell(0.7, 0.8, GOLD_LIGHT), feathers(1.24, 0.8), tinted(GOLD_LIGHT, (x) => motes(x, 0.8, { rise: 1.2 }))) } }),
  pose(CHANT, { y: 2.5, lean: -2, head: -4, handF: [0, 0, 11], handB: [-2, 2, 11], weapon: 6, wind: 0.35, lift: 0.4, phase: 1.3, face: 'stern', fx: { rune: 0.7, extra: both(swell(1, 0.5, GOLD_LIGHT), feathers(1.36, 0.6), tinted(GOLD_LIGHT, (x) => motes(x, 0.6, { rise: 1.3 }))) } }),
  settle(LOWERED, 0.35, { wind: 0.3, lift: 0.25, phase: 1.4, face: 'stern', fx: { rune: 0.55, extra: both(feathers(1.48, 0.4), tinted(GOLD_LIGHT, (x) => motes(x, 0.4, { rise: 1.4 }))) } }),
  settle(LOWERED, 0.65, { wind: 0.22, lift: 0.15, phase: 1.5, fx: { rune: 0.45, extra: feathers(1.6, 0.25) } }),
  settle(LOWERED, 0.85, { wind: 0.18, lift: 0.05, phase: 1.6, fx: { rune: 0.4 } }),
  settle(LOWERED, 0.96, { wind: 0.16, phase: 1.7, fx: { rune: 0.35 } }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The twirl: the staff held at its middle in his right hand raised beside his head, spun round in
 * the side plane: toward the viewer it wheels beside his head.
 */
export const TWIRL: ChibiPose = pose(S, { x: 0, y: 3, lean: 2, twist: 10, head: -2, look: 4, handF: [-2, -6, 15], handB: [4, 13, 9], grip: 6, weapon: -10, roll: -5, yaw: 0, wind: 0.3, face: 'stern' });
/** Planted beside him, the orb flaring, the left hand lifted open. */
const FLARE: ChibiPose = plant(pose(S, { x: 0, y: 2.5, lean: 4, twist: 14, head: -3, look: -2, footF: [6, 0, 5.4], footB: [-6, 0, 5], handF: [19, 3, 6], handB: [8, 8, 11], grip: 0, weapon: 10, roll: 10, yaw: 0, wind: 0.3, lift: 0.3, face: 'stern' }));

const cast: ChibiPose[] = [
  fromReady(TWIRL, 0.6, { fx: { rune: 0.6 } }),
  pose(TWIRL, { weapon: 160, phase: 0.1, wind: 0.4, fx: { rune: 0.8, smear: { from: -10, width: 0.45 } } }),
  pose(TWIRL, { weapon: 350, phase: 0.2, wind: 0.45, fx: { rune: 1, smear: { from: 160, width: 0.45 } } }),
  pose(FLARE, { phase: 0.3, fx: { rune: 1, circle: 0.4, extra: both(burst(0.9, ARCANE, [0, 1, 0]), sparkles(0, 1)) } }),
  pose(FLARE, { y: 3, phase: 0.45, fx: { rune: 1, circle: 0.8, extra: both(orbRays(0.5, ARCANE, 15), sparkles(0.15, 1)) } }),
  pose(FLARE, { y: 3, phase: 0.6, face: 'smirk', fx: { rune: 0.8, circle: 1, extra: sparkles(0.3, 0.8) } }),
  settle(dipped(FLARE), 0.3, { phase: 0.75, wind: 0.25, face: 'stern', fx: { rune: 0.5, circle: 0.6, extra: sparkles(0.45, 0.5) } }),
  settle(dipped(FLARE), 0.85, { phase: 0.9, wind: 0.18, fx: { rune: 0.35, circle: 0.2, extra: sparkles(0.6, 0.2) } }),
];

/** The skill clips' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };

