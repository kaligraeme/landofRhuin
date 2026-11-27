/**
 * The Sage's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of their own
 * painted through `fx.extra`. Wind-up frames come first: they stretch over the server's wind-up
 * (Mending Light's 0.4 s, Resurrection's 1.5 s) or take 0.06 s each where there is none, and the
 * rest share the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special  7  (2 wind-up) Mending Light: the staff raised in his right hand and tilted toward the
 *               aim, out to his right, the left hand open beneath it, while the orb turns
 *               gold-green, swells and gathers a soft halo and motes of light; then the staff
 *               pushed on toward the aim, still raised, the left hand opening toward it, and a
 *               broad soft crescent of healing light leaving the orb for the aim, motes rising
 *   q        7  (1 wind-up: the server fires at once) Arcane Orb: the staff swung back over his
 *               shoulder while a great teal orb forms at its head, then swung forward in a broad
 *               teal arc, pushing the orb away along the aim (the game draws it flying)
 *   e       10  (2 wind-up) Sanctuary: the staff lifted in both hands and struck down upright ahead
 *               of him and across to his left, one hand over the other on it; a ring of his teal
 *               runes pulses out over the floor from its foot and soft columns of gold-green light
 *               rise from it while he bows his head
 *   r       10  (2 wind-up) Meteor: the staff thrust at the sky, his arm up beside his head and the
 *               staff angled up toward the aim, the free hand raised, a fiery sigil opening above the
 *               orb; then the staff swept down at the aim, the sigil pulled after it from the orb to
 *               high ahead of him and a ball of fire bursting out of it to fly off ahead toward the
 *               aim, embers drifting down where it passed (the game draws where it lands)
 *   ult     16  (8 wind-up, stretched over the server's 1.5 s) Resurrection: a long chant, the
 *               staff raised overhead in both hands, held up behind his head so its orb blazes
 *               above him at the top of a pillar of gold light, eyes closed; rings of light climb
 *               slowly round him below his chin and motes and feathers of light rise; then the
 *               staff thrust higher in a burst of warm white and gold rays and a ring of light
 *               rolling out over the floor
 *   cast     8  (2 wind-up) role skills (Arcane Blink, Mana Font) and the Elixir: a quick twirl
 *               of the staff beside his head in a teal arc, then planted ahead of him with the orb
 *               flaring and the left hand lifted open, a teal circle on the floor under him and
 *               sparkles spiralling up
 *
 * Each starts from the battle stance (`fromReady`) and ends in it (`settle`). Side on the figure
 * is turned toward the viewer, so what he holds on his right is drawn back over his head: a staff
 * held upright there stands behind his face (over his hair) side on and beside his head toward
 * the viewer; one planted ahead of his face is planted across to his left, as the battle stance
 * holds it, so it stands clear of his face in both views. Forward-aimed poses yaw the staff across
 * to his left, so toward and away from the viewer it angles out past his shoulder. His heals glow
 * gold-green (LIFE), his Meteor burns orange (FIRE) and Resurrection shines gold (GOLD_LIGHT); the
 * rest is his own teal.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { column, flash, glowLine, motes, rays } from '../fx.js';
import { add3, type ChibiPose, type FxContext, lerp3, pose, rad, type V3 } from '../rig.js';
import { AIM, ARCANE, type Aura, ball, both, type Extra, swoosh, withExtra, FIRE, footAt, fromOrb, fromReady, gather, GOLD_LIGHT, LIFE, orbOf, plant, pool, READY, settle, tinted } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

/** The middle of the floor under him (hero space). */
const under = (x: FxContext): V3 => [x.rig.pelvis.o[0], 0, x.rig.pelvis.o[2]];

/** A level ring of light round a point (hero space), `r` in radius, `k` its strength, `rows` pixels thick on screen; the half behind him passes behind him. */
function ringAt(x: FxContext, c: V3, r: number, col: RGB, k: number, rows = 1): void {
  const n = Math.max(12, Math.ceil(r * 6.5));
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    const p3: V3 = [c[0] + Math.cos(th) * r, c[1], c[2] + Math.sin(th) * r];
    const p = x.proj(p3);
    for (let j = 0; j < rows; j++) x.c.glow(p[0], p[1] + j, col, k, x.behind(p3));
  }
}

/** A glow on an effects layer, softened over the figure so he shows through it. */
function soft(x: FxContext, px: number, py: number, col: RGB, a: number, back: boolean): void {
  x.c.glow(px, py, col, !back && x.c.opaque(Math.floor(px), Math.floor(py)) ? a * 0.35 : a, back);
}

/** A soft halo round the orb, `r` across, in the aura's colours (its inner part the core colour, fading to the edge colour), `k` its strength. */
const halo =
  (r: number, k: number, aura: Aura): Extra =>
  (x) => {
    if (k <= 0) return;
    const P = x.proj(x.tip);
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const d = Math.hypot(dx, dy) / r;
        if (d > 1) continue;
        soft(x, P[0] + dx, P[1] + dy, d < 0.55 ? aura.core : aura.edge, k * 0.42 * (1 - d * d), false);
      }
    }
  };

/**
 * A soft crescent of healing light (Mending Light) `d` pixels on from the orb along the aim, `k`
 * its strength, `half` its half-height: side on a crescent across the way it flies, bowed toward
 * the aim, 4 pixels thick with a cream-white core; toward or away from the viewer, where it flies
 * along the camera, a ring opening round that point.
 */
const crescent =
  (d: number, k: number, half = 10): Extra =>
  (x) => {
    if (k <= 0) return;
    const c3 = add3(x.tip, AIM, d);
    const P = x.proj(c3);
    const v = x.cam.vec(AIM);
    const L = Math.hypot(v[0], v[1]);
    const back = x.behind(c3);
    const bands: [number, RGB, number][] = [
      [-1.6, LIFE.edge, 0.5],
      [-0.8, LIFE.core, 0.9],
      [0, LIFE.hot, 1],
      [0.8, LIFE.core, 0.9],
      [1.6, LIFE.edge, 0.5],
    ];
    if (L > 0.5) {
      const u: Vec = [v[0] / L, v[1] / L];
      const nrm: Vec = [-u[1], u[0]];
      const n = Math.ceil(half * 4);
      for (let i = 0; i <= n; i++) {
        const s = (2 * i) / n - 1;
        const bow = (1 - s * s) * 4;
        const taper = 1 - Math.pow(Math.abs(s), 4);
        for (const [o, col, a] of bands) soft(x, P[0] + nrm[0] * s * half + u[0] * (bow + o), P[1] + nrm[1] * s * half + u[1] * (bow + o), col, k * a * taper, back);
      }
    } else {
      const R = half * 0.8;
      const n = Math.ceil(R * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        for (const [o, col, a] of bands) soft(x, P[0] + Math.cos(th) * (R + o), P[1] + Math.sin(th) * (R + o) * 0.85, col, k * a, back);
      }
    }
  };

/** His runes: bold abstract signs, five pixels square (a ringed point, a diamond, a sheaf, a tree, a lattice, a crossed bar), none of them a letter. */
const RUNES: readonly (readonly string[])[] = [
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['..#..', '.#.#.', '#...#', '.#.#.', '..#..'],
  ['#.#.#', '.###.', '..#..', '.###.', '#.#.#'],
  ['..#..', '#.#.#', '.###.', '..#..', '.#.#.'],
  ['#...#', '.#.#.', '#.#.#', '.#.#.', '#...#'],
  ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
];

/**
 * Sanctuary's ward on the floor round a point (the staff's foot), `r` in radius and `k` its
 * strength, turned `spin` degrees: a bright teal ring two pixels thick with a fainter one outside
 * it, a gold-green ring inside, and his runes standing on the floor between them, each a teal
 * glyph with a white heart, the ones behind him passing behind him.
 */
const runeRing =
  (at: (x: FxContext) => V3, r: number, k: number, spin: number): Extra =>
  (x) => {
    if (k <= 0 || r <= 0) return;
    const c0 = at(x);
    const g: V3 = [c0[0], 0, c0[2]];
    ringAt(x, g, r, ARCANE.hot, k, 2);
    ringAt(x, g, r + 1.4, ARCANE.core, k * 0.7);
    ringAt(x, g, r * 0.66, LIFE.core, k * 0.75, 2);
    const n = Math.max(3, Math.min(8, Math.round(r / 4)));
    for (let i = 0; i < n; i++) {
      const th = rad(spin) + (i / n) * Math.PI * 2;
      const p3: V3 = [g[0] + Math.cos(th) * r * 0.83, 0, g[2] + Math.sin(th) * r * 0.83];
      const p = x.proj(p3);
      const glyph = RUNES[i % RUNES.length] as readonly string[];
      const back = x.behind(p3);
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] !== '#') continue;
          const px = Math.round(p[0]) - 2 + gx;
          const py = Math.round(p[1]) - 6 + gy;
          x.c.glow(px, py, gy === 2 && gx === 2 ? [255, 255, 255] : ARCANE.hot, k, back);
          x.c.glow(px + 1, py + 1, ARCANE.core, k * 0.55, back);
        }
      });
    }
  };

/**
 * Light rising from a ring on the floor (Sanctuary's hallowed ground): soft columns of gold-green
 * light standing round it, each three pixels wide with a cream-white core, brightest at the floor
 * and fading as it climbs, `t` how high they have risen (0 to 1), `k` their strength, with motes
 * climbing them.
 */
const rising =
  (at: (x: FxContext) => V3, r: number, t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    const c0 = at(x);
    for (let i = 0; i < 7; i++) {
      const th = (i / 7) * Math.PI * 2 + x.hash(i, 611) * 0.5;
      const rr = r * (0.6 + 0.35 * x.hash(i, 612));
      const p3: V3 = [c0[0] + Math.cos(th) * rr, 0, c0[2] + Math.sin(th) * rr];
      const back = x.behind(p3);
      const foot = x.proj(p3);
      const H = (14 + 22 * x.hash(i, 613)) * (0.35 + 0.65 * t);
      for (let h = 0; h <= H; h++) {
        const a = k * (1 - h / H) * (0.6 + 0.4 * Math.min(1, h / 3));
        const y = foot[1] - h;
        soft(x, foot[0], y, LIFE.hot, a, back);
        soft(x, foot[0] - 1, y, LIFE.core, a * 0.75, back);
        soft(x, foot[0] + 1, y, LIFE.core, a * 0.75, back);
        soft(x, foot[0] - 2, y, LIFE.edge, a * 0.3, back);
        soft(x, foot[0] + 2, y, LIFE.edge, a * 0.3, back);
      }
      // A mote climbing the column.
      const m = ((x.hash(i, 614) + t * 1.3) % 1) * (H + 6);
      soft(x, foot[0], foot[1] - m - 2, [255, 255, 255], k * 0.9, back);
      soft(x, foot[0], foot[1] - m - 3, LIFE.hot, k * 0.6, back);
    }
  };

/**
 * The Meteor's sigil, opening in the air above the orb: a wheel of fire facing the viewer, `k` how
 * far it has opened (0 a spark, 1 full size) and `spin` turning it: a bright rim with a ring inside
 * it, spokes between them, a ring of small marks round the rim and a hot heart. It rides above the
 * orb as the staff rises; `t` is how far it has since been pulled from there to high ahead of him
 * (0 to 1).
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
 * A streak of fire from `from` to `to` (hero space, or worked out from the frame), `k` its
 * strength: brightest and widest at its head, where a ball of fire `r` across is (none at 0),
 * fading back toward where it started, with embers shed along it; softened where it passes over him.
 */
const streak =
  (from: V3 | ((x: FxContext) => V3), to: V3, k: number, r = 3): Extra =>
  (x) => {
    if (k <= 0) return;
    const A = x.proj(typeof from === 'function' ? from(x) : from);
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
    if (r > 0) ball(to, r, k, FIRE)(x);
  };

/** The sigil pulled from over the orb toward high ahead of him, `t` of the way: its fire trails from the orb to where the sigil now is. */
const pull = (t: number, k: number): Extra => streak((x) => x.tip, lerp3(SIGIL, ABOVE_AIM, t), k * 0.8, 0);

/** A point `t` of the way from the sigil high ahead of him to where its fire leaves his frame, far off toward the aim and still high. */
const onDive = (t: number): V3 => lerp3(ABOVE_AIM, AIM_FAR, t);

/**
 * The Meteor sent on its way: a ball of fire `r` across bursting out of the sigil and flying off
 * ahead toward the aim, falling as it goes, its head `t` of the way (it is gone from his frame by
 * about 0.9) and its streak burning `tail` back along its path; `k` its strength.
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
      const r = 13 + x.hash(i, 652) * 12;
      const h = ((x.hash(i, 653) + t * (0.6 + 0.4 * x.hash(i, 654))) % 1) * 84;
      const p3: V3 = [g[0] + Math.cos(th) * r, 4 + h, g[2] + Math.sin(th) * r];
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * (h / 84));
      const flip = i % 2 ? 1 : -1;
      for (const [dx, dy, tone] of FEATHER) x.c.glow(p[0] + dx * flip, p[1] + dy, GOLD_LIGHT[tone], a, x.behind(p3));
    }
  };

/** Rings of gold light climbing slowly round him (Resurrection), from the floor to his chest, never as high as his face: `t` how far they have climbed, `k` their strength. */
const halos =
  (t: number, k: number): Extra =>
  (x) => {
    if (k <= 0) return;
    const g = x.rig.pelvis.o;
    for (let j = 0; j < 3; j++) {
      const h = ((t + j / 3) % 1) * 36;
      const a = k * Math.sin(Math.PI * (h / 36));
      const r = 19 - h * 0.1;
      ringAt(x, [g[0], 2 + h, g[2]], r, GOLD_LIGHT.core, a * 0.85);
      ringAt(x, [g[0], 2 + h + 0.8, g[2]], r, GOLD_LIGHT.hot, a * 0.5);
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
    ringAt(x, g, r, aura.hot, fade, 2);
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
const MEND_UP: ChibiPose = pose(S, { x: -1, y: 3, lean: -2, twist: 8, head: -5, look: -2, handF: [16, 5, 10], handB: [10, 9, 4], grip: -4, weapon: 30, roll: 18, yaw: 0, wind: 0.2, lift: 0.2, face: 'stern' });
/** Pushed on toward the aim, still raised and tilted (not levelled like a bolt), the left hand opening toward the aim. */
const MEND_OUT: ChibiPose = pose(S, { x: 2, y: 3.5, lean: 6, twist: 2, head: -2, look: -2, handF: [20, 4, 9], handB: [15, 9, 6], grip: -4, weapon: 38, roll: 16, yaw: 0, wind: 0.4, lift: 0.2, face: 'shout' });

const lifeMotes =
  (k: number, rise: number): Extra =>
  (x) =>
    motes({ ...x, aura: LIFE }, k, { rise });

const special: ChibiPose[] = [
  // The orb turns gold-green and swells, a halo round it, motes drawn in.
  fromReady(MEND_UP, 0.9, { fx: { rune: 0.8, extra: both(halo(9, 0.7, LIFE), ball(fromOrb(0.5), 4, 0.9, LIFE), gather(0.8, 0, 15, LIFE)) } }),
  pose(MEND_UP, { y: 3.5, lean: -3, head: -6, phase: 0.1, face: 'closed', fx: { rune: 1, aura: 0.2, extra: both(halo(12, 1, LIFE), orbRays(0.5, LIFE, 10, 16), ball(fromOrb(0.5), 6, 1, LIFE), gather(1, 0.5, 9, LIFE)) } }),
  // Released: a soft crescent of light leaves the orb for the aim.
  pose(MEND_OUT, { phase: 0.25, fx: { rune: 1, extra: both(burst(1.1, LIFE), halo(10, 0.6, LIFE), crescent(9, 1, 9), lifeMotes(0.8, 0)) } }),
  pose(MEND_OUT, { y: 4, lean: 7, weapon: 40, wind: 0.45, phase: 0.4, face: 'stern', fx: { rune: 0.8, extra: both(ball(fromOrb(0.5), 3.5, 0.7, LIFE), crescent(24, 0.9, 11), lifeMotes(0.9, 0.15)) } }),
  pose(MEND_OUT, { y: 4, lean: 6, weapon: 38, wind: 0.35, lift: 0.15, phase: 0.55, fx: { rune: 0.6, extra: both(crescent(39, 0.5, 12), lifeMotes(0.8, 0.3)) } }),
  settle(MEND_OUT, 0.5, { weapon: 52, yaw: -30, wind: 0.25, lift: 0.15, phase: 0.7, fx: { rune: 0.45, extra: lifeMotes(0.5, 0.45) } }),
  settle(MEND_OUT, 0.88, { wind: 0.18, phase: 0.85, fx: { rune: 0.35, extra: lifeMotes(0.25, 0.6) } }),
];

// ── Arcane Orb ───────────────────────────────────────────────────────────────────────────────

/** The staff swung back over his right shoulder in both hands, the orb high behind him. */
const ORB_BACK: ChibiPose = pose(S, { x: -2, y: 4, lean: -6, twist: -16, head: -2, look: 2, footF: [9, 0, 5.2], footB: [-9, 0, 4.6], handF: [-2, 7, 9], grip: -4, grip2: 9, weapon: -34, roll: 14, yaw: -4, wind: 0.25, lift: 0.2, sway: 0.2, phase: 0.1, face: 'grit' });
/** Swung forward, both arms driving it out at the aim, across to his left. */
const ORB_PUSH: ChibiPose = pose(S, { x: 4, y: 5.5, lean: 16, twist: 10, head: 3, look: -2, footF: [12, 0, 5.4], footB: [-9, 0, 4.6], handF: [11, 11, 6], grip: -4, grip2: 9, weapon: 64, roll: -4, yaw: -38, wind: 0.6, lift: 0, phase: 0.25, face: 'shout' });

const q: ChibiPose[] = [
  // The one wind-up frame: the great orb forming at the staff's head, swung back.
  fromReady(ORB_BACK, 0.9, { fx: { rune: 1, aura: 0.3, extra: both(ball(fromOrb(1), 6.5, 1), gather(1, 0.3, 12)) } }),
  // Pushed away: the game draws it flying from here.
  pose(ORB_PUSH, { fx: { rune: 1, flash: { k: 1.3, from: 'main', dir: AIM }, trail: { k: 1, from: 'main', dir: AIM, len: 18 }, smear: { from: -34, roll: 14, yaw: -4, width: 1, alpha: 1 } } }),
  pose(ORB_PUSH, { y: 6, lean: 17, weapon: 66, wind: 0.7, phase: 0.4, face: 'grit', fx: { rune: 0.7, trail: { k: 0.45, from: 'main', dir: AIM, len: 14 }, smear: { from: 46, width: 0.7, alpha: 0.55 } } }),
  pose(ORB_PUSH, { y: 5.5, lean: 15, weapon: 62, wind: 0.5, lift: 0.2, phase: 0.55, face: 'stern', fx: { rune: 0.5 } }),
  settle(ORB_PUSH, 0.4, { wind: 0.35, lift: 0.2, phase: 0.7, face: 'stern', fx: { rune: 0.4 } }),
  settle(ORB_PUSH, 0.72, { wind: 0.25, lift: 0.1, phase: 0.85, fx: { rune: 0.35 } }),
  settle(ORB_PUSH, 0.92, { wind: 0.18, phase: 1, fx: { rune: 0.35 } }),
];

// ── Sanctuary ────────────────────────────────────────────────────────────────────────────────

/**
 * The staff planted upright ahead of him and across to his left, both hands on it, the left over
 * the right, his head bowed: side on it stands ahead of his face, toward the viewer beside his head
 * on his left.
 */
const PLANTED: ChibiPose = plant({ ...S, x: 0, y: 4, lean: 10, twist: -22, head: 8, look: 0, footF: [6, 0, 5.4], footB: [-7, 0, 4.8], handF: [13, 7, -5.5], grip: 0, grip2: 8, weapon: 4, roll: -23, yaw: 0, wind: 0.2, face: 'closed' });

/** Where the staff strikes the floor: the ward and the light come from there, and stay there as he lifts it away. */
const SPOT: V3 = footAt(PLANTED);
const spot = (): V3 => SPOT;

const e: ChibiPose[] = [
  // The staff lifted in both hands, its foot off the floor.
  fromReady(pose(PLANTED, { y: 3, lean: 4, head: -2, handF: [13, 2, -5.5], weapon: 8, face: 'grit' }), 0.8, { fx: { rune: 0.6 } }),
  pose(PLANTED, { y: 1.5, lean: 0, head: -4, handF: [13, -1, -5.5], weapon: 6, wind: 0.25, lift: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.9, extra: gather(0.8, 0.2, 10, LIFE) } }),
  // Struck down: the ward leaps out from its foot.
  pose(PLANTED, { y: 5, lean: 12, head: 6, wind: 0.45, lift: -0.1, phase: 0.2, face: 'shout', fx: { rune: 1, dust: 0.5, extra: both(pool(spot, 11, 1, LIFE), runeRing(spot, 8, 1, 0), burst(0.8, ARCANE, [0, 1, 0])) } }),
  pose(PLANTED, { y: 4.5, phase: 0.3, fx: { rune: 1, extra: both(pool(spot, 16, 0.8, LIFE), runeRing(spot, 14, 1, 8), rising(spot, 12, 0, 0.8)) } }),
  pose(PLANTED, { phase: 0.4, fx: { rune: 0.9, extra: both(pool(spot, 21, 0.7, LIFE), runeRing(spot, 20, 1, 16), runeRing(spot, 9, 0.7, -10), rising(spot, 17, 0.25, 1)) } }),
  pose(PLANTED, { y: 4.5, lean: 11, phase: 0.5, fx: { rune: 0.9, extra: both(pool(spot, 25, 0.6, LIFE), runeRing(spot, 25, 0.95, 24), runeRing(spot, 14, 0.8, -20), rising(spot, 21, 0.5, 1)) } }),
  pose(PLANTED, { y: 4, lean: 10, phase: 0.6, fx: { rune: 0.8, extra: both(pool(spot, 27, 0.5, LIFE), runeRing(spot, 28, 0.8, 32), runeRing(spot, 19, 0.7, -30), rising(spot, 23, 0.75, 0.85)) } }),
  pose(PLANTED, { y: 4.5, phase: 0.7, face: 'stern', head: 4, fx: { rune: 0.6, extra: both(runeRing(spot, 30, 0.55, 40), runeRing(spot, 23, 0.5, -40), rising(spot, 24, 1, 0.5)) } }),
  // Lifted back out into the stance, which holds the staff across to his left as it stood.
  settle(PLANTED, 0.35, { wind: 0.2, phase: 0.8, face: 'stern', fx: { rune: 0.45, extra: runeRing(spot, 31, 0.25, 48) } }),
  settle(PLANTED, 0.92, { wind: 0.16, phase: 0.9, fx: { rune: 0.35 } }),
];

// ── Meteor ───────────────────────────────────────────────────────────────────────────────────

/**
 * The staff thrust at the sky in both hands, ahead of him and across to his left, angled up toward
 * the aim, the left hand high on the haft over the right: side on it rises ahead of his face, toward
 * the viewer beside his head on his left. (His arms are too short to lift his hands above his head,
 * and a staff angled forward from a hand raised on his right would cross his face side on.)
 */
const SKY: ChibiPose = pose(S, { x: -1, y: 2.5, lean: -6, twist: -12, head: -8, look: -4, handF: [9, 6, -4], grip: -12, grip2: 7, weapon: 26, roll: -26, yaw: -6, wind: 0.3, lift: 0.35, face: 'shout' });

/** How high over the orb the sigil opens. */
const SIGIL_UP = 14;
/** Where the sigil is once open, in the air above the orb thrust at the sky. */
const SIGIL: V3 = add3(orbOf(pose(SKY, { y: 2, lean: -8, head: -9 })), [0, 1, 0], SIGIL_UP);
/**
 * Where the staff sweeping down at the aim pulls it to, high ahead of him and across to his left;
 * and where its fire leaves his frame, far off toward the aim and still high, so that away from
 * the viewer it flies on up the screen beyond him (it falls on the aim off his frame) and toward
 * the viewer it comes down beside him, never over him.
 */
const ABOVE_AIM: V3 = [40, 104, -24];
const AIM_FAR: V3 = [150, 80, -24];
/** The staff swept down at the aim, the fire following it, the staff yawed across to his left. */
const CALL: ChibiPose = pose(S, { x: 3, y: 5, lean: 14, twist: 8, head: 3, look: -2, footF: [11, 0, 5.4], handF: [10, 10, 6], handB: [6, 14, 7], grip: -6, weapon: 66, roll: -4, yaw: -38, wind: 0.5, lift: 0.1, face: 'grit' });

const fireRays =
  (at: V3 | 'orb', k: number, len: number, spin: number): Extra =>
  (x) =>
    rays({ ...x, aura: FIRE }, at === 'orb' ? add3(x.tip, [0, 1, 0], SIGIL_UP) : at, k, { n: 10, len, spin });

const r: ChibiPose[] = [
  fromReady(pose(SKY, { handF: [9, 9, -2], weapon: 36, head: -4 }), 0.8, { fx: { rune: 0.8, extra: sigil(0.25, 0) } }),
  pose(SKY, { phase: 0.1, fx: { rune: 1, extra: sigil(0.6, 15) } }),
  pose(SKY, { y: 2, lean: -8, head: -9, phase: 0.2, wind: 0.35, lift: 0.45, fx: { rune: 1, aura: 0.3, extra: both(sigil(1, 30), fireRays('orb', 0.6, 26, 10)) } }),
  pose(SKY, { y: 2, lean: -8, head: -9, phase: 0.3, fx: { rune: 1, extra: both(sigil(1, 45), fireRays('orb', 0.4, 22, 20)) } }),
  // Swept down at the aim: the sigil is pulled after it, its fire trailing from the orb.
  pose(CALL, { phase: 0.4, fx: { rune: 1, extra: both(pull(0.6, 1), sigil(0.9, 60, 0.6)) } }),
  // The fire bursts out of the sigil and flies off toward the aim.
  pose(CALL, { y: 5.5, lean: 15, phase: 0.5, fx: { rune: 0.8, extra: both(sigil(0.75, 75, 1), fireRays(ABOVE_AIM, 0.7, 20, 8), dive(0.22, 0.22, 1, 5.5)) } }),
  pose(CALL, { y: 5.5, lean: 15, phase: 0.6, face: 'stern', fx: { rune: 0.7, extra: both(sigil(0.4, 90, 1), dive(0.52, 0.4, 1, 5)) } }),
  settle(CALL, 0.4, { phase: 0.7, wind: 0.3, face: 'stern', fx: { rune: 0.5, extra: both(sigil(0.15, 105, 1), dive(0.8, 0.35, 0.6, 3.5), cinders(0, 0.9)) } }),
  settle(CALL, 0.72, { phase: 0.85, wind: 0.22, fx: { rune: 0.4, extra: cinders(0.45, 0.65) } }),
  settle(CALL, 0.92, { phase: 1, wind: 0.16, fx: { rune: 0.35, extra: cinders(0.9, 0.3) } }),
];

// ── Resurrection ─────────────────────────────────────────────────────────────────────────────

/**
 * The chant: the staff raised overhead in both hands, held up behind his head, so its orb blazes
 * above him at the top of the pillar of light, his elbows out; chin up and eyes closed.
 */
const CHANT: ChibiPose = pose(S, { x: 0, y: 2, lean: -4, twist: 0, head: -8, look: 0, footF: [6, 0, 5.4], footB: [-6, 0, 5], handF: [-7, -11, 2], elbowF: [0, 0.3, 1], elbowB: [0, 0.3, 1], grip: -2, grip2: -9, weapon: 0, roll: 0, yaw: 0, wind: 0.2, lift: 0.4, face: 'closed' });

/** The light of the burst: warm white beams with a bright gold edge. */
const BURST: Aura = { core: [255, 206, 64], edge: [255, 224, 120], hot: [255, 250, 228] };

/** The chant's frame `i` of 8: the light growing, the rings and feathers rising. */
const chant = (i: number): ChibiPose => {
  const t = i / 7;
  const breath = Math.sin(i * 0.9) * 0.6;
  return pose(CHANT, {
    y: 2 + breath * 0.5,
    lean: -4 + breath,
    head: -8 - t * 2,
    handF: [-7, -11 - t, 2],
    lift: 0.3 + t * 0.4,
    sway: Math.sin(i * 0.8) * 0.2,
    phase: i / 8,
    fx: {
      rune: 0.7 + t * 0.4,
      aura: t * 0.4,
      extra: both(
        tinted(GOLD_LIGHT, (x) => column(x, x.rig.pelvis.o, 0.3 + t * 0.75, { radius: 9 + t * 5 })),
        halos(i / 8, 0.4 + t * 0.6),
        feathers(i / 8, 0.5 + t * 0.5),
        tinted(GOLD_LIGHT, (x) => motes(x, 0.5 + t * 0.5, { rise: i / 8 })),
        halo(7 + t * 5, 0.5 + t * 0.5, GOLD_LIGHT),
        ball(fromOrb(0.5, [0, 1, 0]), 2.5 + t * 3, 0.7 + t * 0.3, GOLD_LIGHT),
      ),
    },
  });
};

/** The release: the staff thrust higher, chin up, a burst of gold. */
const RAISE: ChibiPose = pose(CHANT, { y: 1, lean: -7, head: -10, handF: [-6, -13, 2], weapon: -2, wind: 0.5, lift: 0.8, face: 'shout' });

/** Brought down out of the burst: the staff lowered before him in both hands and across to his left, as the stance holds it. */
const LOWERED: ChibiPose = pose(S, { x: 1, y: 3, lean: 2, twist: 14, head: -1, look: -2, handF: [7, 9, 5], grip: -4, grip2: 9, weapon: 36, roll: -16, yaw: -34, wind: 0.4, lift: 0.4, face: 'stern' });

const ult: ChibiPose[] = [
  ...Array.from({ length: 8 }, (_, i) => (i === 0 ? fromReady(chant(0), 0.75) : chant(i))),
  pose(RAISE, { phase: 1, fx: { rune: 1.2, aura: 0.6, extra: both(tinted(BURST, (x) => rays(x, x.rig.chest.o, 1.5, { n: 14, behind: true, len: 54 })), burst(1.4, BURST, [0, 1, 0]), swell(0, 1, GOLD_LIGHT), feathers(1, 1), ball(fromOrb(0.5, [0, 1, 0]), 6, 1, GOLD_LIGHT)) } }),
  pose(RAISE, { y: 1.5, phase: 1.1, fx: { rune: 1, aura: 0.45, extra: both(tinted(BURST, (x) => rays(x, x.rig.chest.o, 1.25, { n: 14, behind: true, len: 54, spin: 6 })), swell(0.35, 1, GOLD_LIGHT), feathers(1.12, 1), tinted(GOLD_LIGHT, (x) => motes(x, 1, { rise: 1.1 }))) } }),
  pose(RAISE, { y: 2, lean: -5, head: -8, phase: 1.2, face: 'closed', fx: { rune: 0.9, extra: both(tinted(BURST, (x) => rays(x, x.rig.chest.o, 0.75, { n: 14, behind: true, len: 54, spin: 12 })), swell(0.7, 0.8, GOLD_LIGHT), feathers(1.24, 0.8), tinted(GOLD_LIGHT, (x) => motes(x, 0.8, { rise: 1.2 }))) } }),
  pose(LOWERED, { phase: 1.3, fx: { rune: 0.7, extra: both(swell(1, 0.5, GOLD_LIGHT), feathers(1.36, 0.6), tinted(GOLD_LIGHT, (x) => motes(x, 0.6, { rise: 1.3 }))) } }),
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

/** The twirl's two spun frames, each with a broad arc of about a hundred degrees behind the orb (`swoosh`). */
export const twirled = (p: ChibiPose, i: 1 | 2): ChibiPose =>
  i === 1
    ? withExtra(pose(p, { weapon: 160, phase: 0.1, wind: 0.4, fx: { ...p.fx, rune: 0.8 } }), swoosh(50))
    : withExtra(pose(p, { weapon: 350, phase: 0.2, wind: 0.45, fx: { ...p.fx, rune: 1 } }), swoosh(240));

/** Planted ahead of him and across to his left in his right hand, the orb flaring, the left hand lifted open out to his left. */
const FLARE: ChibiPose = plant(pose(S, { x: 0, y: 2.5, lean: 4, twist: -16, head: -3, look: -2, footF: [6, 0, 5.4], footB: [-6, 0, 5], handF: [14, 4, -4], handB: [5, 6, 13], grip: 0, weapon: 6, roll: -23, yaw: 0, wind: 0.3, lift: 0.3, face: 'stern' }));

const cast: ChibiPose[] = [
  fromReady(TWIRL, 0.85, { fx: { rune: 0.6 } }),
  twirled(TWIRL, 1),
  twirled(TWIRL, 2),
  pose(FLARE, { phase: 0.3, fx: { rune: 1, circle: 0.4, extra: both(burst(0.9, ARCANE, [0, 1, 0]), sparkles(0, 1)) } }),
  pose(FLARE, { y: 3, phase: 0.45, fx: { rune: 1, circle: 0.8, extra: both(orbRays(0.5, ARCANE, 15), sparkles(0.15, 1)) } }),
  pose(FLARE, { y: 3, phase: 0.6, face: 'smirk', fx: { rune: 0.8, circle: 1, extra: sparkles(0.3, 0.8) } }),
  settle(FLARE, 0.35, { phase: 0.75, wind: 0.25, face: 'stern', fx: { rune: 0.5, circle: 0.6, extra: sparkles(0.45, 0.5) } }),
  settle(FLARE, 0.92, { phase: 0.9, wind: 0.18, fx: { rune: 0.35, circle: 0.2, extra: sparkles(0.6, 0.2) } }),
];

/** The skill clips' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
