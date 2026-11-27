/**
 * The Spellblade's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of their own
 * painted through `fx.extra`. Wind-up frames come first; with no server wind-up they take 0.06 s
 * each and the rest share the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special  7  (1 wind-up) Runic Ward: the wand drawn in, then raised up ahead of her face, its
 *               tip drawing a circle of light in the air; a ring of her own gold runes spins up
 *               round her off the floor and closes over her as a dome of light
 *   q        8  (1 wind-up) Spellblade Rush: coiled low, the sword drawn back, then a dash with the
 *               point thrust ahead and down, angled out to her right so it shows in every view;
 *               side on violet afterimages and speed lines trail her, toward and away from the
 *               viewer streaks burst out round her; a braced skid to a stop, thrown back with the
 *               sword trailing low, boots ploughing the floor
 *   e        8  (1 wind-up) Arc Lightning: the wand drawn back by her shoulder, then thrust ahead as
 *               lightning crackles from its crystal, the sword held back low
 *   r       10  (2 wind-up) Lifebinding Sigil: the sword driven point down into the floor before her,
 *               she bends over it, the wand held low pointing at the floor; a green-gold rosette
 *               of six petals blooms on the ground round her and petals of light spiral up from it
 *               as she breathes
 *   ult     14  (4 wind-up, stretched over the server's half second) Astral Cleave: the sword
 *               raised high on her right while the wand, raised ahead of her face, pours light over
 *               her head into it and a translucent astral blade grows from its point; then both
 *               hands on the hilt, a cleave down and forward, the astral blade slammed along the
 *               floor and a rift of light running on from it the way she faces (level side on,
 *               straight down or up the screen toward or away from the viewer), where the
 *               server's long blade of force lands
 *   cast     8  (2 wind-up) role skills (Arcane Blink, Mana Font) and the Elixir: the wand twirled
 *               in a short arc of light, then flung up high ahead of her in a flourish, her back
 *               arched and the sword hand swept open behind her; a quick spell circle under her
 *               and sparkles spiralling up
 *
 * Each starts from the battle stance (`fromReady`) and the clips that give way to it end in it
 * (`settle`), so the sword and wand are where the loop holds them. Raised hands go out beside her
 * head, never across her face. A wand raised for a spell goes up and forward ahead of her face
 * (`handB` about `[11, -9, 8]`): side on, the main view, it then stands clear of her hair above
 * and ahead of her head, where held out to her left it would hide behind her hair.
 */
import { hex, type RGB, type Vec } from '../../paint.js';
import { afterimages, DUST, DUST_DARK, glowLine, lightning, puff, ward } from '../fx.js';
import { mixc } from '../raster.js';
import { add3, type ChibiPose, clamp, type FxContext, len3, lerp, type P2, pose, rad, sub3, type V3, weaponAxes } from '../rig.js';
import { fromReady, READY, settle } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

type Extra = (x: FxContext) => void;

/** A deep violet: the farther of the dash's afterimages, and the inner rim of the ultimate's great arc. */
const GHOST_FAR: RGB = [74, 44, 140];

/** Runs several extra painters in turn. */
const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** Fills a screen polygon (convex or not, even-odd) on an effects layer. */
function fill(c: FxContext['c'], q: readonly Vec[], col: RGB, a: number, under = false): void {
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
    for (let j = 0; j + 1 < xs.length; j += 2) for (let x = Math.ceil((xs[j] as number) - 0.5); x <= Math.floor((xs[j + 1] as number) - 0.5); x++) c.glow(x, y, col, clamp(a, 0, 1), under);
  }
}

/** The ward's colours: pale gold runes and bands with a violet fringe. */
const WARD_AURA = { core: hex('#f4d888'), edge: hex('#b98cff'), hot: hex('#fffbea') };

/** Her own runes for the ward: abstract signs (a diamond, a ringed point, a triangle, an arrow, an hourglass, a star), none of them a letter. */
const SIGNS: readonly (readonly string[])[] = [
  ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
  ['.###.', '#...#', '#.#.#', '#...#', '.###.'],
  ['..#..', '.#.#.', '.#.#.', '#...#', '#####'],
  ['..#..', '.###.', '#.#.#', '..#..', '..#..'],
  ['#####', '.#.#.', '..#..', '.#.#.', '#####'],
  ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
];

/** The ward (fx.ts `ward`) in gold and violet rather than her aura's colours, with her own runes. */
const goldWard =
  (k: number, spin: number, dome = false): Extra =>
  (x) =>
    ward({ ...x, aura: WARD_AURA }, k, { radius: 22, height: 22, spin, runes: 8, dome, glyphs: SIGNS });

/** Healing light: a soft green-gold, warm at its heart. */
const LIFE = { core: hex('#bfe38a'), edge: hex('#f2d27c'), hot: hex('#fbfff0') };

/**
 * The Lifebinding Sigil on the floor round her, `k` from 0 (a spark) to 1 (in full bloom): a
 * double outer ring and, inside it, a rosette of six petals made of six overlapping circles (each
 * through the middle), turning slowly (`spin` degrees), with a small ring at its heart, all
 * green-gold. It lies on the floor, so it shows round her feet and not over her.
 */
const sigil =
  (k: number, spin = 0): Extra =>
  (x) => {
    const { c, rig } = x;
    if (k <= 0) return;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const ease = k * k * (3 - 2 * k);
    const R = 8 + 22 * ease;
    const ring = (cx: number, cz: number, r: number, col: RGB, a: number, inside = Infinity): void => {
      const n = Math.ceil(r * 7);
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        const px = cx + Math.cos(th) * r;
        const pz = cz + Math.sin(th) * r;
        if (Math.hypot(px - g[0], pz - g[2]) > inside) continue;
        const p = x.proj([px, 0, pz]);
        c.glow(p[0], p[1], col, a, true);
      }
    };
    ring(g[0], g[2], R, LIFE.core, k);
    ring(g[0], g[2], R + 1.2, LIFE.edge, 0.7 * k);
    ring(g[0], g[2], R * 0.86, LIFE.edge, 0.55 * k);
    // The rosette: six circles of half the rosette's radius, centred on a ring of that radius, so
    // each passes through the middle and their overlaps make six petals.
    const rr = R * 0.4;
    for (let i = 0; i < 6; i++) {
      const a0 = rad(spin + i * 60);
      ring(g[0] + Math.cos(a0) * rr, g[2] + Math.sin(a0) * rr, rr, i % 2 ? LIFE.core : LIFE.hot, 0.95 * k, R * 0.84);
    }
    ring(g[0], g[2], R * 0.12, LIFE.hot, k);
    // A faint wash of light inside it.
    const p0 = x.proj(g);
    for (let y = -Math.ceil(R * 0.42); y <= Math.ceil(R * 0.42); y++) for (let xx = -Math.ceil(R); xx <= Math.ceil(R); xx++) if ((xx / R) ** 2 + (y / (R * 0.4)) ** 2 < 0.92) c.glow(p0[0] + xx, p0[1] + y, LIFE.core, 0.12 * k, true);
  };

/** A petal of light, two pixels wide and three tall: a white heart in green-gold. */
const PETAL: [number, number, 'core' | 'edge' | 'hot'][] = [
  [0, -1, 'core'],
  [1, -1, 'edge'],
  [0, 0, 'hot'],
  [1, 0, 'core'],
  [0, 1, 'core'],
];

/**
 * Petals of healing light rising off the sigil, `t` how far they have risen (each takes its own
 * path and rate) and `k` their strength, spiralling slowly up round her as they climb; the ones
 * behind her pass behind her.
 */
const petals =
  (t: number, k: number): Extra =>
  (x) => {
    const { c, rig, hash } = x;
    if (k <= 0) return;
    for (let i = 0; i < 10; i++) {
      const rise = ((t * (0.7 + hash(i, 203) * 0.5) + hash(i, 204)) % 1) * 58;
      const th = hash(i, 201) * Math.PI * 2 + rise * 0.05;
      const r = 12 + hash(i, 202) * 13 - rise * 0.08;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * r, 3 + rise, rig.pelvis.o[2] + Math.sin(th) * r];
      // Fading in off the floor and out near the top: shrinking to a single mote first.
      const life = Math.sin(Math.PI * Math.min(1, rise / 58)) * k;
      if (life < 0.15) continue;
      const under = x.behind(p3);
      const p = x.proj(p3);
      for (const [dx, dy, tone] of PETAL) {
        if (life < 0.45 && tone !== 'hot') continue;
        c.glow(p[0] + dx, p[1] + dy, LIFE[tone], 1, under);
      }
    }
  };

/** Sparkles spiralling up round her (the cast), `t` how far up they have climbed, `k` their strength. */
const sparkles =
  (t: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, hash } = x;
    for (let i = 0; i < 10; i++) {
      const th = hash(i, 301) * Math.PI * 2 + t * 4;
      const r = 14 + hash(i, 302) * 8;
      const h = (hash(i, 303) * 30 + t * 50) % 70;
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * r, 4 + h, rig.pelvis.o[2] + Math.sin(th) * r];
      const under = x.behind(p3);
      const p = x.proj(p3);
      const a = k * Math.sin(Math.PI * (h / 70));
      // A tiny four-point star.
      c.glow(p[0], p[1], aura.hot, a, under);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(p[0] + dx, p[1] + dy, i % 3 ? aura.core : aura.edge, a * 0.7, under);
    }
  };

/**
 * The astral blade: a great translucent blade of violet light grown from the sword's point along
 * its line, `len` pixels past the tip at full growth, `k` its strength; a white-hot spine, the
 * aura's violet body and a pale cyan rim, tapering to a point, with a glow sheathing the sword.
 * It is drawn on screen along the sword's line, so it reads in every view.
 */
const astral =
  (len: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, tip } = x;
    if (k <= 0 || len <= 0) return;
    const w = rig.weapon;
    // From two thirds of the way up the sword (clear of the hand and the face beside it raised).
    const A = x.proj(add3(w.o, w.u, 26));
    const B = x.proj(tip);
    let dx = B[0] - A[0];
    let dy = B[1] - A[1];
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    const nx = -dy;
    const ny = dx;
    const end: Vec = [B[0] + dx * len, B[1] + dy * len];
    // Half-width along it: as broad as a greatsword where it leaves the sword, then a long taper.
    const W = 4.5 + len * 0.04;
    const pts = (scale: number): Vec[] => [
      [A[0] + nx * 2 * scale, A[1] + ny * 2 * scale],
      [B[0] + nx * W * scale, B[1] + ny * W * scale],
      [B[0] + dx * len * 0.72 + nx * W * 0.8 * scale, B[1] + dy * len * 0.72 + ny * W * 0.8 * scale],
      [end[0] + dx * 2 * scale, end[1] + dy * 2 * scale],
      [B[0] + dx * len * 0.72 - nx * W * 0.8 * scale, B[1] + dy * len * 0.72 - ny * W * 0.8 * scale],
      [B[0] - nx * W * scale, B[1] - ny * W * scale],
      [A[0] - nx * 2 * scale, A[1] - ny * 2 * scale],
    ];
    const under = x.behind(add3(tip, w.u, len * 0.5));
    fill(c, pts(1.25), aura.edge, 0.35 * k, under);
    fill(c, pts(1), aura.core, 0.45 * k, under);
    fill(c, pts(0.45), mixc(aura.core, aura.hot, 0.6), 0.6 * k, under);
    glowLine(c, A, end, aura.hot, 0.9 * k, under);
  };

/**
 * The astral blade's great swoosh: a broad crescent swept about the grip by a blade `reach`
 * pixels long, from the sword's angle `from` to the pose's own (as a smear's are given, in the
 * same roll and yaw), white-hot along its outer edge and violet within, deepening toward its
 * inner rim, near solid, fading a little toward its tail.
 */
const greatArc =
  (from: number, reach: number, k: number): Extra =>
  (x) => {
    const { c, rig, aura, cam } = x;
    const w = rig.weapon;
    const p = rig.pose;
    const to = p.weapon;
    const roll = rad(p.roll ?? 0);
    const yaw = rad(p.yaw ?? 0);
    // The swing's plane from its roll and yaw, as weaponAxes builds a weapon's direction.
    const dir = (deg: number): V3 => {
      const th = rad(deg);
      const f0 = Math.sin(th);
      const u0 = Math.cos(th);
      const u1 = u0 * Math.cos(roll);
      const r1 = u0 * Math.sin(roll);
      return [f0 * Math.cos(yaw) - r1 * Math.sin(yaw), u1, f0 * Math.sin(yaw) + r1 * Math.cos(yaw)];
    };
    const n = Math.max(4, Math.ceil(Math.abs(to - from) / 5));
    // Near solid, so it reads violet rather than a grey smear over a dark floor: a white cutting
    // edge, the aura's violet, and a deeper violet at its inner rim (a pale cyan there, thinned
    // over the floor, would read grey).
    const bands: [number, number, RGB, number][] = [
      [0, 0.1, aura.hot, 1],
      [0.1, 0.3, mixc(aura.hot, aura.core, 0.5), 1],
      [0.3, 0.72, aura.core, 0.92],
      [0.72, 1, mixc(aura.core, GHOST_FAR, 0.5), 0.7],
    ];
    const at = (deg: number, r: number): Vec => {
      const q = add3(w.o, dir(deg), r);
      return x.proj(q[1] < 0.5 ? [q[0], 0.5, q[2]] : q);
    };
    const under = cam.view === 'back';
    for (let i = 0; i < n; i++) {
      const a0 = lerp(from, to, i / n);
      const a1 = lerp(from, to, (i + 1) / n);
      const fade = 0.55 + 0.45 * ((i + 1) / n);
      const th = reach * 0.55 * Math.sin(((i + 1) / n) * (Math.PI / 2));
      for (const [f0, f1, col, a] of bands) fill(c, [at(a0, reach - f0 * th), at(a1, reach - f0 * th), at(a1, reach - f1 * th), at(a0, reach - f1 * th)], col, a * k * fade, under);
    }
  };

/**
 * Which way her blow runs on screen, along the floor: the way she faces, made level side on and
 * straight down or up the screen toward or away from the viewer, so the slammed blade and the rift
 * show where the server's long blade of force lands. Also how long a stretch of floor looks on
 * screen that way (foreshortened toward and away from the viewer, but never to a stub).
 */
function facing(x: FxContext): { d: Vec; k: number } {
  const fv = x.cam.vec([1, 0, 0]);
  if (Math.abs(fv[0]) > 0.4) return { d: [Math.sign(fv[0]), 0], k: 1 };
  // Away from the viewer it runs up behind her and on past her head, drawn longer so that most
  // of it shows beyond her.
  return fv[1] >= 0 ? { d: [0, 1], k: 0.6 } : { d: [0, -1], k: 1.6 };
}

/** Where the sword's point meets the floor (or the floor under it), on screen. */
const pointOnFloor = (x: FxContext): Vec => x.proj([x.tip[0], 0, x.tip[2]]);

/**
 * The astral blade slammed down along the floor ahead of her: a great translucent blade of light
 * from where the sword's point meets the floor, `len` pixels along the way she faces (see
 * `facing`), `k` its strength; a white-hot spine, the aura's violet body and a pale cyan rim,
 * tapering to a point. Away from the viewer it lies beyond her, so it passes behind her and shows
 * running on up the screen past her head.
 */
const slam =
  (len: number, k: number): Extra =>
  (x) => {
    const { c, aura } = x;
    if (k <= 0 || len <= 0) return;
    const { d, k: fk } = facing(x);
    const L = len * fk;
    const S = pointOnFloor(x);
    const n: Vec = [-d[1], d[0]];
    const W = 4.5 + len * 0.03;
    const at = (t: number, w: number): Vec => [S[0] + d[0] * L * t + n[0] * w, S[1] + d[1] * L * t + n[1] * w];
    const pts = (s: number): Vec[] => [at(-0.04, W * 0.5 * s), at(0.18, W * s), at(0.72, W * 0.75 * s), at(1 + 2 / Math.max(1, L), 0), at(0.72, -W * 0.75 * s), at(0.18, -W * s), at(-0.04, -W * 0.5 * s)];
    const under = x.cam.view === 'back';
    fill(c, pts(1.25), aura.edge, 0.4 * k, under);
    fill(c, pts(1), aura.core, 0.55 * k, under);
    fill(c, pts(0.45), mixc(aura.core, aura.hot, 0.6), 0.7 * k, under);
    glowLine(c, at(0, 0), at(1, 0), aura.hot, 0.95 * k, under);
  };

/**
 * A rift of light running on along the floor beyond the slammed blade, the way she faces (see
 * `facing`): `k` how far it has run (0 to 1) and `a` its strength. A jagged crack of white-hot
 * light three pixels wide with a violet glow either side, and shards of light thrown up along it;
 * away from the viewer it passes behind her, as the slammed blade does.
 */
const rift =
  (k: number, a: number): Extra =>
  (x) => {
    const { c, aura, hash } = x;
    const { d, k: fk } = facing(x);
    const n: Vec = [-d[1], d[0]];
    const S = pointOnFloor(x);
    const len = (22 + 58 * k) * fk;
    const under = x.cam.view === 'back';
    let prev: Vec | null = null;
    for (let s = 0; s <= 24; s++) {
      const t = s / 24;
      const along = 6 + len * t;
      const off = (hash(s, 401) - 0.5) * 3;
      const p: Vec = [S[0] + d[0] * along + n[0] * off, S[1] + d[1] * along + n[1] * off];
      if (prev) {
        const fade = a * (1 - t * 0.55);
        // Across the crack: its glow either side of a white-hot core.
        for (const [o, col, f] of [[-2, aura.edge, 0.35], [-1, aura.core, 0.85], [0, aura.hot, 1], [1, aura.core, 0.85], [2, aura.edge, 0.35]] as [number, RGB, number][]) {
          const w: Vec = d[1] === 0 ? [0, o] : [o, 0];
          glowLine(c, [prev[0] + w[0], prev[1] + w[1]], [p[0] + w[0], p[1] + w[1]], col, fade * f, under);
        }
      }
      prev = p;
      if (s % 3 === 1) {
        // A shard of light standing up off the crack.
        const h = (3 + hash(s, 402) * 9) * a * (1 - t * 0.5);
        glowLine(c, p, [p[0], p[1] - h], aura.core, a * 0.8, under);
        c.glow(p[0], p[1] - h, aura.hot, a, under);
      }
    }
  };

/**
 * Light poured from the wand's crystal into the sword's point: a thin crackling arc between them
 * over her head (`seed` reshapes it), both raised high either side of her so it never crosses her face.
 */
const pour =
  (seed: number, a = 0.7): Extra =>
  (x) =>
    lightning(x, x.tipB, x.tip, { seed, forks: 1, alpha: a, jag: 0.25 });

/** A skid (strength k): furrows ploughed behind her boots, and a bank of dust and grit thrown up ahead of them. */
const skid =
  (k: number): Extra =>
  (x) => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 18 * k, 0, g[2]]);
      glowLine(x.c, a, b, [70, 60, 66], 0.8 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.5 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3 - i * 0.6) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.55 * k);
      }
      for (let i = 0; i < 6; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 12 * k, hash(i, s + 81) * 9 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        x.c.glow(p[0], p[1], i % 2 ? DUST : DUST_DARK, 0.9 * k);
      }
    }
  };

// ── Runic Ward ───────────────────────────────────────────────────────────────────────────────

/**
 * The wand raised up and forward, ahead of her face (side on it stands clear of her hair above
 * and in front of her head; toward the viewer it rises beside her head on her left), the sword
 * lowered point down and forward at her right, her chin up to watch the crystal.
 */
const WARD_UP: ChibiPose = pose(S, { x: 0, y: 3, lean: -4, twist: 4, head: -9, look: -4, footF: [8, 0, 5.2], footB: [-7, 0, 4.6], handF: [5, 13, 9], weapon: 150, roll: 10, yaw: 10, handB: [10, -10, 13], weaponB: 22, rollB: 36, yawB: 0, face: 'stern', wind: 0.25, lift: 0.15 });

/** The wand's angles round the circle its tip draws (its middle and how far out), as `weaponB` and `rollB`. */
const CIRCLE = { w: 16, r: 36, a: 26 };
/** The wand's angles `t` turns round that circle (0 at its top-forward point). */
const onCircle = (t: number): Partial<ChibiPose> => ({ weaponB: CIRCLE.w + Math.cos(t * Math.PI * 2) * CIRCLE.a, rollB: CIRCLE.r + Math.sin(t * Math.PI * 2) * CIRCLE.a });

/**
 * The circle of light the wand's tip draws in the air ahead of her, from where it began (`t0`
 * turns round) to where the tip is now (`t1`): a line three pixels wide, white-hot at its head by
 * the crystal and violet behind, fading toward its tail, drawn about her hand where it is now.
 */
const circleTrail =
  (t0: number, t1: number, a = 1): Extra =>
  (x) => {
    const { c, rig, aura } = x;
    const reach = len3(sub3(x.tipB, rig.offhand.o));
    const at = (t: number): Vec => {
      const ang = onCircle(t);
      return x.proj(add3(rig.offhand.o, weaponAxes(ang.weaponB as number, -(ang.rollB as number), 0).u, reach));
    };
    const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) * 40));
    for (let i = 0; i < n; i++) {
      const k = (i + 1) / n;
      const p = at(lerp(t0, t1, i / n));
      const q = at(lerp(t0, t1, k));
      const fade = a * (0.35 + 0.65 * k);
      glowLine(c, [p[0], p[1] - 1], [q[0], q[1] - 1], aura.core, fade * 0.9);
      glowLine(c, [p[0], p[1] + 1], [q[0], q[1] + 1], aura.core, fade * 0.9);
      glowLine(c, p, q, k > 0.7 ? aura.hot : mixc(aura.hot, aura.core, 0.4), fade);
    }
  };

/**
 * A star of light on the wand's crystal, `k` its size (1: rays four pixels long): a white-hot
 * heart with a violet halo, so the raised crystal reads at a glance.
 */
const beacon =
  (k: number): Extra =>
  (x) => {
    const { c, aura } = x;
    const [px, py] = x.proj(x.tipB);
    const r = Math.max(1, Math.round(4 * k));
    for (let i = -r; i <= r; i++) {
      const f = 1 - Math.abs(i) / (r + 1);
      c.glow(px + i, py, i === 0 ? aura.hot : mixc(aura.hot, aura.core, 1 - f), Math.min(1, 0.4 + f));
      c.glow(px, py + i, i === 0 ? aura.hot : mixc(aura.hot, aura.core, 1 - f), Math.min(1, 0.4 + f));
    }
    for (const [i, j] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) c.glow(px + i, py + j, aura.core, 0.75);
  };

const runicWard: ChibiPose[] = [
  // Wind-up: the wand drawn in to her chest, its crystal gathering light, the sword lowering.
  fromReady(pose(S, { y: 5, lean: 6, twist: 4, head: 3, look: 0, handF: [6, 13, 9], weapon: 120, roll: 14, yaw: 0, handB: [6, 5, 3], weaponB: 10, rollB: 0, yawB: 0, face: 'closed', fx: { runeB: 0.8, aura: 0.2 } }), 0.6),
  // The wand thrown up ahead of her: a flash at its crystal, the runes rising off the floor.
  pose(WARD_UP, { phase: 0.1, ...onCircle(0), fx: { runeB: 1, impactB: 0.7, aura: 0.4, extra: goldWard(0.25, 0) } }),
  // Its tip draws a circle of light in the air as the ring rises and spins up round her.
  pose(WARD_UP, { y: 2.5, head: -10, lift: 0.2, phase: 0.25, ...onCircle(0.35), fx: { runeB: 1, aura: 0.5, extra: both(goldWard(0.6, 30), circleTrail(0, 0.35), beacon(0.7)) } }),
  pose(WARD_UP, { y: 2.5, head: -10, lift: 0.22, phase: 0.4, ...onCircle(0.7), fx: { runeB: 1, aura: 0.45, extra: both(goldWard(0.9, 62), circleTrail(0, 0.7), beacon(0.8)) } }),
  // The circle closed: the ring closes over her as a dome of light, the barrier.
  pose(WARD_UP, { y: 3, head: -8, lift: 0.2, phase: 0.55, ...onCircle(1), fx: { runeB: 0.8, aura: 0.3, extra: both(goldWard(0.7, 90), goldWard(1, 10, true), circleTrail(0, 1, 0.8), beacon(1)) } }),
  // Back into her guard, the dome fading round her.
  settle(pose(WARD_UP, { handB: [8, 4, 9], weaponB: 70, rollB: 0, handF: [8, 11, 9], weapon: 70 }), 0.5, { lift: 0.3, phase: 0.7, face: 'stern', fx: { runeB: 0.5, extra: goldWard(0.55, 20, true) } }),
  settle(S, 0.9, { phase: 0.85, fx: { runeB: 0.35, extra: goldWard(0.2, 30, true) } }),
];

// ── Spellblade Rush ──────────────────────────────────────────────────────────────────────────

/**
 * The rush of the dash (strength k). Side on, violet afterimages of her trail behind (copies of
 * her silhouette, under the figure); toward or away from the viewer, where copies would only stack
 * up over her head, streaks burst out all round her instead.
 */
const dash =
  (k: number): Extra =>
  (x) => {
    const { c, cam, rig, aura, hash } = x;
    const fv = cam.vec([1, 0, 0]);
    if (Math.abs(fv[0]) > 0.4) {
      const dir = fv[0] >= 0 ? 1 : -1;
      const ghosts: [number, RGB, number][] = [
        [22, GHOST_FAR, 0.45],
        [11, aura.core, 0.55],
      ];
      afterimages(
        c,
        ghosts.map(([off, colour, a]) => ({ dx: -dir * Math.round(off * k), dy: 0, colour, alpha: a * k })),
      );
      return;
    }
    const C = x.proj(add3(rig.pelvis.o, [0, 16, 0]));
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2 + hash(i, 71) * 0.3;
      const r0 = 22 + hash(i, 72) * 7;
      const r1 = r0 + (8 + hash(i, 73) * 10) * k;
      const a: Vec = [C[0] + Math.cos(th) * r0, C[1] + Math.sin(th) * r0 * 1.25];
      const b: Vec = [C[0] + Math.cos(th) * r1, C[1] + Math.sin(th) * r1 * 1.25];
      glowLine(c, a, b, i % 2 ? aura.core : aura.hot, 0.85 * k, true);
      glowLine(c, [a[0] + 1, a[1]], [b[0] + 1, b[1]], aura.edge, 0.4 * k, true);
    }
  };

/**
 * The dash: low and long, the point thrust ahead and down in her right hand, angled out to her
 * right so that toward and away from the viewer it shows most of its length beside her rather
 * than pointing straight at him; the wand trailing back.
 */
const DASH: ChibiPose = pose(S, { x: 8, y: 5, lean: 30, twist: -14, head: -14, look: -4, handF: [14, 12, 10], weapon: 128, roll: -34, yaw: 24, handB: [-8, 12, 10], weaponB: 215, rollB: 10, yawB: 0, face: 'grit', wind: 1.1, lift: 0.1 });

const rush: ChibiPose[] = [
  // Coiled low, the sword drawn back to her hip, point forward, the wand forward to balance.
  fromReady(pose(S, { x: -3, y: 9, lean: 20, twist: 18, head: -2, footF: [9, 0, 4.8], footB: [-12, 0, 4.4], handF: [-3, 15, 9], weapon: 100, roll: -10, yaw: 10, handB: [9, 9, 6], weaponB: 70, rollB: 0, yawB: 20, face: 'grit', wind: 0.3, fx: { rune: 0.7, aura: 0.5, dust: 0.4 } }), 0.6),
  // Launch: the back leg drives off, the point shoots forward.
  pose(DASH, { x: 5, y: 5, footF: [14, -6, 4.6], footB: [-15, 0, 4.4], phase: 0.1, fx: { rune: 1, aura: 0.8, dust: 1, speed: 0.8, extra: dash(0.6) } }),
  // The dash: long, light strides, barely touching the floor.
  pose(DASH, { y: 1, footF: [20, -4, 4.6], footB: [-13, -9, 4.4], phase: 0.3, fx: { rune: 1, aura: 0.8, speed: 1, swirl: { k: 0.9, spin: 0.1 }, extra: dash(1) } }),
  pose(DASH, { y: 5, footF: [7, 0, 4.6], footB: [12, -11, 4.4], phase: 0.5, fx: { rune: 1, aura: 0.8, speed: 1, dust: 0.6, swirl: { k: 1, spin: 0.35 }, extra: dash(1) } }),
  pose(DASH, { y: 1, footF: [-13, -9, 4.6], footB: [20, -4, 4.4], phase: 0.7, fx: { rune: 1, aura: 0.7, speed: 1, swirl: { k: 0.8, spin: 0.6 }, extra: dash(0.9) } }),
  // The skid: thrown back, the lead leg braced out well ahead with its heel dug in, both knees
  // bent, the coat flung forward, the sword trailing low behind her on her right.
  pose(S, { x: 9, y: 11, lean: -10, twist: 10, head: -2, look: -4, footF: [26, 0, 5.4], footB: [0, 0, 4.6], handF: [-3, 13, 12], weapon: -150, roll: -36, yaw: -36, handB: [9, 8, 6], weaponB: 120, rollB: 0, yawB: 40, face: 'grit', wind: -0.55, lift: 0.4, sway: 0.4, phase: 0.85, fx: { rune: 0.6, aura: 0.4, dust: 1, speed: 0.3, extra: both(skid(1), dash(0.3)) } }),
  pose(S, { x: 8, y: 8, lean: 4, twist: 2, head: 1, footF: [19, 0, 5], footB: [-4, 0, 4.6], handF: [6, 12, 10], weapon: 100, roll: 10, yaw: 10, handB: [6, 10, 7], weaponB: 105, rollB: -10, yawB: 45, face: 'stern', wind: 0.15, lift: 0.2, phase: 1, fx: { rune: 0.3, dust: 0.4, extra: skid(0.4) } }),
  settle(pose(S, { x: 3, y: 5, lean: 10 }), 0.8, { phase: 1.1 }),
];

// ── Arc Lightning ────────────────────────────────────────────────────────────────────────────

/** The wand thrust out ahead at shoulder height, a little out to her left; the sword held back low. */
const BOLT: ChibiPose = pose(S, { x: 3, y: 6, lean: 12, twist: 24, head: 0, look: -8, footF: [12, 0, 5], footB: [-10, 0, 4.6], handF: [-5, 14, 10], weapon: -128, roll: 8, yaw: -20, handB: [15, 3, 4], weaponB: 86, rollB: 0, yawB: 10, face: 'shout', wind: 0.55 });

const arc: ChibiPose[] = [
  // Wind-up: the wand drawn back by her left shoulder, crackling, the sword swung back.
  fromReady(pose(S, { x: -2, y: 5, lean: 2, twist: -14, head: 2, look: 2, footF: [10, 0, 5], footB: [-10, 0, 4.6], handF: [2, 13, 10], weapon: 160, roll: 10, yaw: -10, handB: [-3, 2, 11], weaponB: 20, rollB: 30, yawB: 0, face: 'grit', wind: 0.3, fx: { runeB: 1, aura: 0.3, lightning: { from: 'off', dir: [0, 1, -0.4], len: 8, seed: 1, forks: 1, alpha: 0.6 } } }), 0.6),
  // Thrust: the bolt leaves the crystal.
  pose(BOLT, { phase: 0.1, fx: { runeB: 1, impactB: 0.6, aura: 0.4, lightning: { seed: 2, len: 64 } } }),
  pose(BOLT, { x: 4, lean: 13, phase: 0.25, fx: { runeB: 1, aura: 0.4, lightning: { seed: 3, len: 72 } } }),
  pose(BOLT, { x: 4, lean: 13, phase: 0.4, wind: 0.5, fx: { runeB: 1, aura: 0.3, lightning: { seed: 4, len: 72, alpha: 0.85 } } }),
  pose(BOLT, { x: 3, lean: 12, phase: 0.55, wind: 0.45, face: 'grit', fx: { runeB: 0.8, lightning: { seed: 5, len: 60, forks: 2, alpha: 0.55 } } }),
  // The last crackle off the crystal as she draws back.
  pose(BOLT, { x: 2, lean: 10, twist: 16, handB: [12, 5, 5], weaponB: 80, phase: 0.7, wind: 0.35, face: 'stern', fx: { runeB: 0.5, lightning: { seed: 6, len: 16, forks: 1, alpha: 0.4 } } }),
  settle(pose(BOLT, { handB: [10, 8, 7], weaponB: 95, handF: [4, 12, 10], weapon: 120 }), 0.55, { phase: 0.85, face: 'stern', fx: { runeB: 0.35 } }),
  settle(BOLT, 0.9, { phase: 1, fx: { runeB: 0.3 } }),
];

// ── Lifebinding Sigil ────────────────────────────────────────────────────────────────────────

/** Feet planted wide for the sigil. */
const PLANT = { footF: [10, 0, 6] as P2, footB: [-9, 0, 5.6] as P2 };

/**
 * Bent over the sword she has driven point down into the floor before her (its lower blade sunk
 * in), her hand on its grip; the wand held low out to her left pointing at the floor, its crystal
 * pouring light into the sigil.
 */
const BLOOM: ChibiPose = pose(S, { x: 1, y: 7, lean: 24, twist: 4, head: 8, look: -2, ...PLANT, handF: [10, 12, 6], weapon: 182, roll: 0, yaw: 0, handB: [5, 15, 12], weaponB: 150, rollB: 24, yawB: 0, face: 'closed', wind: 0.15, lift: 0.2 });

/** The sigil in bloom, `k` how far, `t` how far the petals have risen; she breathes (`b` 0 to 1) and the light lifts her hair. */
const bloom = (k: number, t: number, b: number, phase: number): ChibiPose =>
  pose(BLOOM, { y: 7 - b * 0.8, lean: 24 - b * 3, head: 8 - b * 3, handB: [5, 15 - b, 12], phase, lift: 0.1 + k * 0.06 + b * 0.08, face: b > 0.6 ? 'stern' : 'closed', fx: { runeB: 1, rune: 0.6, extra: both(sigil(k, t * 40), petals(t, k), beacon(0.5 + b * 0.3)) } });

const lifebinding: ChibiPose[] = [
  // Wind-up: the sword turned point down and drawn up high before her, the wand lowered, a green glow gathering.
  fromReady(pose(S, { y: 4, lean: 4, twist: 4, head: 0, ...PLANT, handF: [8, 2, 6], weapon: 182, roll: 0, yaw: 0, handB: [4, 12, 11], weaponB: 140, rollB: 20, yawB: 0, face: 'grit', fx: { runeB: 0.6, rune: 0.5 } }), 0.6),
  // Driven down into the floor: the sigil sparks from the point.
  pose(BLOOM, { y: 8, lean: 27, head: 10, face: 'grit', fx: { runeB: 0.9, rune: 0.9, impact: 0.7, impactAt: [19, 1, 6], dust: 0.6, extra: both(sigil(0.15), beacon(0.4)) } }),
  // The sigil blooms out round her and petals of light rise from it.
  pose(BLOOM, { phase: 0.1, fx: { runeB: 1, rune: 0.8, extra: both(sigil(0.35), petals(0, 0.5), beacon(0.6)) } }),
  bloom(0.6, 0.1, 0.3, 0.2),
  bloom(0.85, 0.2, 0.7, 0.3),
  bloom(1, 0.3, 1, 0.4),
  bloom(1, 0.4, 0.7, 0.5),
  bloom(0.95, 0.5, 0.3, 0.6),
  // The light settles; she draws the sword out and comes back up into her guard.
  settle(pose(BLOOM, { y: 6, lean: 14, head: 4, handB: [6, 9, 9], weaponB: 110, handF: [9, 10, 8], weapon: 120 }), 0.45, { phase: 0.75, face: 'stern', fx: { runeB: 0.5, extra: both(sigil(0.6, 25), petals(0.6, 0.5)) } }),
  settle(S, 0.9, { phase: 0.9, fx: { runeB: 0.3, extra: sigil(0.25, 28) } }),
];

// ── Astral Cleave ────────────────────────────────────────────────────────────────────────────

/**
 * The sword raised high out to her right, tip up and back, her hand beside and behind her head so
 * that side on her arm passes over her hair rather than her cheek; the wand raised up ahead of
 * her face on her left (clear of her hair side on), pouring light from its crystal over her head
 * into the sword's point.
 */
const RAISE: ChibiPose = pose(S, { x: -1, y: 4, lean: -6, twist: 10, head: -6, look: 4, footF: [9, 0, 5.4], footB: [-10, 0, 5], handF: [-10, -8, 12], weapon: -18, roll: 26, yaw: -8, handB: [9, -11, 15], weaponB: 4, rollB: 38, yawB: 0, face: 'grit', wind: 0.3, lift: 0.18 });

/**
 * The cleave lands: both hands on the hilt, low and forward, the sword's point driven to the floor
 * ahead of her along the way she faces, the astral blade slammed down along the floor beyond it.
 */
const CLEAVE: ChibiPose = pose(S, { x: 8, y: 11, lean: 22, twist: 6, head: 4, look: -2, footF: [17, 0, 5.6], footB: [-12, 0, 5], handF: [15, 13, 3], handB: undefined, grip: 0, weapon: 124, roll: 0, yaw: 4, weaponB: 200, rollB: 20, yawB: 0, face: 'shout', wind: 0.85, lift: -0.1 });

const astralCleave: ChibiPose[] = [
  // Wind-up over the server's half second: the sword swept up high on her right...
  fromReady(pose(RAISE, { y: 6, lean: 2, handF: [2, 2, 13], weapon: 20, handB: [4, 2, 12], weaponB: 20, rollB: 0, face: 'grit', fx: { rune: 0.8, runeB: 0.8, aura: 0.3 } }), 0.6),
  // ...the wand pours light into it and the astral blade grows from its point...
  pose(RAISE, { phase: 0.1, fx: { rune: 1, runeB: 1, aura: 0.5, extra: both(pour(1, 0.9), astral(18, 0.7), beacon(0.7)) } }),
  pose(RAISE, { y: 5, lean: -8, head: -7, phase: 0.2, lift: 0.22, fx: { rune: 1, runeB: 1, aura: 0.7, extra: both(pour(2, 0.9), astral(40, 0.85), beacon(0.9)) } }),
  pose(RAISE, { y: 6, lean: -10, twist: 14, head: -8, handF: [-10, -9, 12.5], weapon: -26, weaponB: 0, phase: 0.3, lift: 0.25, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, extra: both(pour(3, 0.7), astral(58, 1), beacon(1)) } }),
  // The cleave: down through the front of her, both hands on the hilt...
  pose(CLEAVE, { x: 4, y: 6, lean: 14, handF: [13, 3, 10], weapon: 40, roll: 30, wind: 0.6, phase: 0.4, fx: { rune: 1, aura: 1, extra: both(greatArc(-24, 96, 0.9), astral(56, 1)) } }),
  // ...and slammed along the floor ahead: the rift runs on from it.
  pose(CLEAVE, { phase: 0.5, fx: { rune: 1, aura: 0.9, impact: 1.4, dust: 1, extra: both(greatArc(-24, 96, 0.7), slam(56, 1), rift(0.1, 1)) } }),
  pose(CLEAVE, { y: 11.5, lean: 23, phase: 0.6, wind: 0.7, face: 'grit', fx: { rune: 1, aura: 0.7, dust: 0.8, extra: both(slam(54, 0.75), rift(0.4, 1)) } }),
  pose(CLEAVE, { y: 11, lean: 22, phase: 0.7, wind: 0.5, face: 'grit', fx: { rune: 0.9, aura: 0.5, dust: 0.5, extra: both(slam(46, 0.5), rift(0.7, 0.85)) } }),
  pose(CLEAVE, { y: 10.5, lean: 21, phase: 0.8, wind: 0.35, fx: { rune: 0.8, aura: 0.3, dust: 0.3, extra: both(slam(34, 0.28), rift(1, 0.6)) } }),
  pose(CLEAVE, { y: 10, lean: 20, phase: 0.9, wind: 0.25, lift: 0.1, face: 'stern', fx: { rune: 0.6, extra: rift(1, 0.35) } }),
  // Rising out of it, the wand hand letting go of the hilt.
  pose(CLEAVE, { x: 6, y: 8, lean: 20, head: 3, handF: [13, 12, 5], handB: [6, 11, 8], weaponB: 120, rollB: 0, weapon: 96, phase: 1, wind: 0.2, lift: 0.2, face: 'stern', fx: { rune: 0.5, extra: rift(1, 0.15) } }),
  settle(pose(CLEAVE, { x: 4, y: 6, lean: 14, handF: [11, 11, 7], handB: [6, 10, 8], weaponB: 105, weapon: 80, roll: 20 }), 0.4, { phase: 1.1, face: 'stern', fx: { rune: 0.4 } }),
  settle(pose(CLEAVE, { x: 2, y: 5, lean: 12, handF: [10, 11, 8], handB: [6, 10, 8], weaponB: 100, weapon: 60, roll: 30 }), 0.7, { phase: 1.2, fx: { rune: 0.3 } }),
  settle(S, 0.95, { phase: 1.3 }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/**
 * The wand's twirl: a short arc of light round her hand traced by its crystal from angle `from` to
 * the pose's own (`weaponB`, in the pose's `rollB` and `yawB`), opaque and two pixels wide, pale
 * violet at its tail turning white at its head, with a sparkle or two along it.
 */
const twirlArc =
  (from: number): Extra =>
  (x) => {
    const { c, rig, aura } = x;
    const p = rig.pose;
    const to = p.weaponB ?? 160;
    const reach = len3(sub3(x.tipB, rig.offhand.o));
    const at = (deg: number): Vec => x.proj(add3(rig.offhand.o, weaponAxes(deg, -(p.rollB ?? 0), -(p.yawB ?? 0)).u, reach));
    const n = Math.max(3, Math.ceil(Math.abs(to - from) / 6));
    const pale = mixc(aura.core, aura.hot, 0.45);
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      const a = at(lerp(from, to, i / n));
      const b = at(lerp(from, to, t));
      const col = mixc(pale, aura.hot, t);
      glowLine(c, a, b, col, 1);
      glowLine(c, [a[0], a[1] + 1], [b[0], b[1] + 1], t > 0.5 ? pale : aura.core, 1);
      if (i % 3 === 1) {
        for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]] as const) c.glow(b[0] + dx, b[1] + dy, aura.hot, 0.9);
      }
    }
  };

/**
 * A flourish: the wand flung up high ahead of her, her arm at full stretch, the sword hand swept
 * open out behind her, her back arched and her weight on her front foot, the back heel lifted.
 */
const FLOURISH: ChibiPose = pose(S, { x: 2, y: 2, lean: -8, twist: -6, tilt: -3, head: -10, look: -2, footF: [6, 0, 4.6], footB: [-9, -3, 4.4], handF: [-9, 10, 12], weapon: 228, roll: -20, yaw: 10, handB: [9, -12, 16], weaponB: 8, rollB: 40, yawB: 0, face: 'smirk', wind: 0.35, lift: 0.18 });

const cast: ChibiPose[] = [
  // Wind-up: the wand twirled in close, the sword lowering.
  fromReady(pose(S, { y: 5, lean: 6, twist: 0, head: 2, handF: [6, 12, 9], weapon: 120, roll: 14, yaw: 0, handB: [7, 6, 4], weaponB: 170, rollB: 0, yawB: 20, face: 'closed', fx: { runeB: 0.6, extra: twirlArc(90) } }), 0.6),
  pose(S, { y: 6, lean: 4, twist: 4, head: 1, handF: [6, 13, 9], weapon: 130, roll: 14, yaw: 6, handB: [4, 0, 9], weaponB: 290, rollB: 10, yawB: 0, face: 'closed', lift: 0.2, fx: { runeB: 0.9, circle: 0.3, extra: twirlArc(190) } }),
  // Up with a flourish: a flash at the crystal, the circle under her, sparkles spiralling up; the
  // cape lifts and ripples.
  pose(FLOURISH, { phase: 0.1, lift: 0.2, fx: { runeB: 1, impactB: 0.8, aura: 0.6, circle: 1, extra: both(twirlArc(-40), sparkles(0, 1)) } }),
  pose(FLOURISH, { y: 1.5, head: -11, lift: 0.18, wind: 0.45, phase: 0.3, fx: { runeB: 1, aura: 0.8, circle: 1, extra: both(sparkles(0.2, 1), beacon(1)) } }),
  pose(FLOURISH, { y: 1.5, head: -11, lift: 0.15, wind: 0.42, phase: 0.5, fx: { runeB: 1, aura: 0.6, circle: 0.9, extra: both(sparkles(0.4, 0.9), beacon(0.8)) } }),
  pose(FLOURISH, { y: 2.5, head: -8, handB: [9, -9, 16], lift: 0.12, wind: 0.3, phase: 0.7, face: 'stern', fx: { runeB: 0.8, aura: 0.35, circle: 0.7, extra: both(sparkles(0.6, 0.7), beacon(0.5)) } }),
  settle(pose(FLOURISH, { handB: [5, 5, 10], weaponB: 60, handF: [8, 11, 9], weapon: 70, roll: 0 }), 0.5, { lift: 0.2, phase: 0.85, fx: { runeB: 0.5, circle: 0.4, extra: sparkles(0.8, 0.4) } }),
  settle(S, 0.92, { phase: 1, fx: { runeB: 0.35, circle: 0.12 } }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special: runicWard, q: rush, e: arc, r: lifebinding, ult: astralCleave, cast };
