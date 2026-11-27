/**
 * The Blademaster's core moves: stances, running and the three-hit combo of her basic attack, and
 * the helpers and effects her other moves files share. Poses use the chibi pose format (rig.ts,
 * ChibiPose): side-plane points, hands from the base of the neck, the right sabre's angle (0 up,
 * 90 forward), its plane's `roll` and `yaw`, the left sabre's own angles (`weaponB`, `rollB`,
 * `yawB`, mirrored, so the same numbers in both hands make a symmetrical pose) and the cloth's and
 * hair's `wind`/`lift`/`phase`.
 *
 *   idle    8  at ease, her weight on her back foot and a hip cocked, the right sabre resting back
 *              on her shoulder and the left hanging point down beside her: a slow breath, a blink,
 *              the upright lock on her crown bobbing, the coat-tails swaying
 *   battle  8  low and coiled like a cat about to spring: knees deep, the right sabre held low and
 *              forward, the left raised ahead of her chest, the two crossing in a scissor; she
 *              rocks on the balls of her feet, hair and coat a frame behind
 *   move    8  a fast, low sprint, both sabres trailing back from her hips like wings, the coat-tails
 *              streaming flat and the upright lock springing
 *   atk1    7  (1 wind-up) Twin Slash I: the right sabre wound up high behind her right shoulder and
 *              ripped down across her body, a crimson arc, a splash of crimson sparks
 *   atk2    7  (1 wind-up) Twin Slash II: the left sabre the same way from high over her left
 *              shoulder, down across to her right, her body turning through
 *   atk3    9  (2 wind-up) Twin Slash III: coiled, a full turn with both sabres held out level
 *              (a ring of crimson round her), both raised high and spread, then cut down crossing in
 *              an X in front of her: a crimson X, a burst of sparks, dust
 *
 * Each blow has an anticipation, a smear frame, a hit frame and a recovery into the battle stance,
 * the coat and hair streaming hardest a frame after the blow and floating up as she stops. A cut
 * leaves a swoosh that starts where the sabre was (`trail`, `trailB`): the frame before on the
 * smear frame, the start of the swing on the hit frame, so the whole stroke shows as one arc that
 * then fades. Raised sword hands go beside her head and out to that side (`handF` about
 * `[-7, -8, 13]`), clear of her face side on and from the front.
 *
 * Her effects: her cuts burn crimson (the design's aura: a white-hot edge, a crimson body and a
 * pale pink fringe), with crimson splashes of sparks where they land (`splash`) and a crimson X
 * where both blades cross (`crossMark`); her spins raise a violet-blue whirlwind (`vortex`).
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { glowLine } from '../fx.js';
import { add3, type ChibiPose, clamp, type FxContext, lerp, mix, norm3, pose, rad, solveRig, sub3, type V3, wave } from '../rig.js';
import { BLADEMASTER } from './design.js';

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────

const BUILD = BLADEMASTER.build;
const GRIP2 = BLADEMASTER.weapon.grip2;
const REACH = BLADEMASTER.weapon.reach[1];

/** Turns a hero-space point about the vertical by `deg` (as a change of `turn` does). */
function turnPoint(p: V3, deg: number): V3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
}

/**
 * The blade angle, roll and yaw (weaponAxes' convention) that point along `d`, nearest `a0` (so
 * the angle comes out on the side the swing went round).
 */
function aimAt(d: V3, a0: { from: number; roll: number; yaw: number }): { from: number; roll: number; yaw: number } {
  // weaponAxes gives u = (sinθ·cosψ, cosθ·cosρ − sinθ·sinψ·sinρ, cosθ·sinρ + sinθ·sinψ·cosρ):
  // for each yaw ψ that can reach d there are two (θ, ρ); keep the one nearest a0.
  const wrap = (x: number, near: number): number => x + 360 * Math.round((near - x) / 360);
  let best = { ...a0, cost: Infinity };
  for (let yaw = -88; yaw <= 88; yaw += 2) {
    const cy = Math.cos(rad(yaw));
    if (Math.abs(d[0]) > cy) continue;
    const st = d[0] / cy;
    for (const sign of [1, -1]) {
      const ct = sign * Math.sqrt(1 - st * st);
      const from = wrap((Math.atan2(st, ct) * 180) / Math.PI, a0.from);
      const roll = wrap(((Math.atan2(d[2], d[1]) - Math.atan2(st * Math.sin(rad(yaw)), ct)) * 180) / Math.PI, a0.roll);
      const cost = Math.abs(from - a0.from) + Math.abs(roll - a0.roll) + Math.abs(yaw - a0.yaw);
      if (cost < best.cost) best = { from, roll, yaw, cost };
    }
  }
  return { from: best.from, roll: best.roll, yaw: best.yaw };
}

/**
 * Where the right sabre's smear starts for a blow swung from pose `a` to pose `b`: the angle,
 * roll and yaw that point from b's grip (the smear's centre) at a's tip, so the swoosh begins
 * where the blade was in pose a even when the hand has travelled.
 */
export function trail(a: ChibiPose, b: ChibiPose): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, GRIP2);
  const rb = solveRig(BUILD, b, GRIP2);
  const tip = turnPoint(add3(ra.weapon.o, ra.weapon.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  return aimAt(norm3(sub3(tip, rb.weapon.o)), { from: a.weapon, roll: a.roll ?? 0, yaw: a.yaw ?? 0 });
}

/** The same for the left sabre, whose angles are mirrored (rig.ts: its roll and yaw carry it out to her left). */
export function trailB(a: ChibiPose, b: ChibiPose): { from: number; roll: number; yaw: number } {
  const ra = solveRig(BUILD, a, GRIP2);
  const rb = solveRig(BUILD, b, GRIP2);
  const tip = turnPoint(add3(ra.offhand.o, ra.offhand.u, REACH), (a.turn ?? 0) - (b.turn ?? 0));
  const s = aimAt(norm3(sub3(tip, rb.offhand.o)), { from: a.weaponB ?? 160, roll: -(a.rollB ?? 0), yaw: -(a.yawB ?? 0) });
  return { from: s.from, roll: -s.roll, yaw: -s.yaw };
}

/**
 * Adds the right sabre's smear to a pose, starting where it was in pose `start`: the frame before
 * for a smear frame, or the start of the swing so the hit and follow-through frames show the whole
 * stroke as one arc, fading as it goes. `width` is how far down the blade the arc reaches.
 */
export const smear = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1): ChibiPose => ({ ...p, fx: { ...p.fx, smear: { ...trail(start, p), width, alpha } } });

/** The same for the left sabre. */
export const smearB = (start: ChibiPose, p: ChibiPose, width: number, alpha = 1): ChibiPose => ({ ...p, fx: { ...p.fx, smearB: { ...trailB(start, p), width, alpha } } });

type Extra = (x: FxContext) => void;

/** Runs several extra painters in turn. */
export const both =
  (...fs: (Extra | undefined)[]): Extra =>
  (x) => {
    for (const f of fs) f?.(x);
  };

/** Adds an extra painter to a pose's effects, after any it has. */
export const withExtra = (p: ChibiPose, f: Extra): ChibiPose => ({ ...p, fx: { ...p.fx, extra: p.fx?.extra ? both(p.fx.extra, f) : f } });

// ── Her effects ──────────────────────────────────────────────────────────────────────────────

/** The violet-blue of her whirlwinds: a deep body, the core, a pale lilac-white edge and a white-hot head. */
export const WIND = { deep: [70, 62, 178] as RGB, core: [154, 150, 255] as RGB, edge: [226, 222, 255] as RGB, hot: [255, 255, 255] as RGB };

/** A deep blood crimson for the far side of her crimson effects. */
export const BLOOD: RGB = [120, 12, 30];

/** Is a screen point on the face (a circle round the head's middle), where effects over her must not go? */
const onFace = (x: FxContext, p: Vec): boolean => {
  const h = x.proj(add3(x.rig.head.o, x.rig.head.u, -1.5));
  return Math.hypot(p[0] - h[0], (p[1] - h[1]) * 1.1) < 11;
};

/**
 * A splash of crimson sparks where a cut lands (`at`, hero space; by default the right sabre's tip):
 * drops thrown out in a fan, each a hot two-pixel head and a short tail, falling as they fly. `k`
 * runs 0 (the instant of the blow, a tight bright burst) to 1 (flung out and falling).
 */
export const splash =
  (k: number, at?: V3 | 'off', seed = 0): Extra =>
  (x) => {
    const { c, aura, hash } = x;
    const p = x.proj(at === 'off' ? x.tipB : (at ?? x.tip));
    for (let i = 0; i < 12; i++) {
      const th = (i / 12) * Math.PI * 2 + hash(i, 141 + seed) * 0.5;
      const d = 4 + (6 + hash(i, 142 + seed) * 12) * (0.35 + k * 0.65);
      const fall = (d * d * k) / 70;
      const sx = Math.round(p[0] + Math.cos(th) * d);
      const sy = Math.round(p[1] + Math.sin(th) * d * 0.75 + fall);
      const fade = 1 - k * 0.45;
      c.glow(sx, sy, i % 3 === 0 ? aura.hot : aura.core, fade);
      c.glow(sx + 1, sy, aura.core, 0.9 * fade);
      c.glow(sx, sy + 1, BLOOD, 0.8 * fade);
      for (let t = 1; t <= 2 + (i % 2); t++) c.glow(sx - Math.cos(th) * t * 1.3, sy - (Math.sin(th) * 0.75 + k * 0.4) * t * 1.3, t === 1 ? aura.core : aura.edge, (0.85 - t * 0.2) * fade);
    }
  };

/**
 * A crimson X cut into the air where both blades crossed: two strokes, thick in the middle and
 * pointed at their ends, white-hot along their middles, crimson, with a pale pink fringe and a
 * deep crimson shadow under them. `k` 1 is the instant of the cut; toward 0 it thins and fades.
 * Side on it hangs ahead of her at her chest; toward the viewer it is cut over her (below her
 * face, so it never covers it); away from the viewer it is ahead of her, beyond her, so it lies
 * under her and shows round her. `size` is a stroke's length.
 */
export const crossMark =
  (k: number, size = 40, ahead = 20): Extra =>
  (x) => {
    const { c, cam, rig, aura } = x;
    const fv = cam.vec([1, 0, 0]);
    const side = Math.hypot(fv[0], fv[1]) > 0.45;
    const away = !side && fv[1] < 0;
    const C = x.proj([rig.pelvis.o[0] + ahead, side ? 26 : away ? 34 : 18, rig.pelvis.o[2]]);
    const half = (size / 2) * (0.75 + 0.25 * k);
    const thick = 1 + 2.2 * k;
    for (const s of [1, -1]) {
      // Each stroke runs corner to corner, a little steeper than 45 degrees.
      const a: Vec = [C[0] - half * 0.8 * s, C[1] - half * 0.9];
      const b: Vec = [C[0] + half * 0.8 * s, C[1] + half * 0.9];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const n = Math.ceil(len);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const w = thick * Math.pow(Math.sin(Math.PI * t), 0.6);
        const px = lerp(a[0], b[0], t);
        const py = lerp(a[1], b[1], t);
        const bands: [number, RGB, number][] = [
          [w + 1.6, aura.edge, 0.45],
          [w + 0.8, aura.core, 0.95],
          [w * 0.45, aura.hot, 1],
        ];
        for (let o = -Math.ceil(w + 2); o <= Math.ceil(w + 2); o++) {
          const q: Vec = [Math.round(px + nx * o), Math.round(py + ny * o)];
          if (!away && onFace(x, q)) continue;
          // The shadow side, a deep crimson, under the stroke.
          let col: RGB | null = null;
          let al = 0;
          for (const [r, cc, aa] of bands) if (Math.abs(o) <= r) [col, al] = [cc, aa];
          if (o > 0 && Math.abs(o) > w * 0.45 && Math.abs(o) <= w + 0.8) col = mixRGB(aura.core, BLOOD, 0.45);
          if (col) c.glow(q[0], q[1], col, al * clamp(k * 1.4, 0, 1), away);
        }
      }
    }
  };

/** A blend of two colours. */
export const mixRGB = (a: RGB, b: RGB, t: number): RGB => [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];

/**
 * A violet-blue whirlwind round her: a funnel of wind from the floor to well over her head, `k`
 * its strength, wider at the top (`r0` at the floor, `r1` at `top`), made of `n` bands of wind
 * spiralling up round it, each a thick band of the wind's violet-blue (a deep tone under it, a pale
 * lilac-white edge along its upper side and a white-hot streak at its head), fading along its tail;
 * `spin` (turns) runs them round (advance it every frame). Crimson streaks whip round inside it when
 * `streaks` is given (their strength). The half behind her passes behind her; the half before her
 * is laid over her lightly and never over her face. Each band is laid down pixel by pixel, once,
 * so it reads as one smooth sweep of wind.
 */
export const vortex =
  (k: number, spin: number, o: { r0?: number; r1?: number; top?: number; n?: number; streaks?: number; base?: number } = {}): Extra =>
  (x) => {
    if (k <= 0) return;
    const { c, rig, aura, hash } = x;
    const r0 = o.r0 ?? 20;
    const r1 = o.r1 ?? 38;
    const top = o.top ?? 70;
    const base = o.base ?? 2;
    const n = o.n ?? 5;
    const g: V3 = [rig.pelvis.o[0], 0, rig.pelvis.o[2]];
    const zc = x.depth(add3(g, [0, 30, 0]));
    const tones: RGB[] = [WIND.hot, WIND.edge, mixRGB(WIND.core, WIND.edge, 0.45), WIND.core, WIND.deep];
    for (let s = 0; s < n; s++) {
      // Each band climbs about two-fifths of the funnel as it winds most of the way round.
      const h0 = base + (top - base) * (s / n) * 0.7 + hash(s, 150) * 4;
      const h1 = Math.min(top, h0 + (top - base) * (0.32 + hash(s, 154) * 0.14));
      const th0 = Math.PI * 2 * (spin + hash(s, 151) + s * 0.37);
      const sweep = Math.PI * (1.1 + hash(s, 152) * 0.45);
      const thick = (2.4 + hash(s, 153) * 1.4) * (0.7 + 0.3 * k);
      // Pixel -> [tone, alpha, behind]: each pixel of the band once, at its strongest.
      const px = new Map<number, [number, number, boolean]>();
      const steps = Math.ceil(sweep * r1 * 1.6);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const h = lerp(h0, h1, t);
        const R = lerp(r0, r1, (h - base) / Math.max(1, top - base)) * (0.82 + 0.18 * k);
        const th = th0 + sweep * t;
        const p3: V3 = [g[0] + Math.cos(th) * R, h, g[2] + Math.sin(th) * R];
        const behind = x.depth(p3) < zc;
        const p = x.proj(p3);
        // Brightest toward its head (t 1), fading along its tail, thinning at both ends.
        const a = k * Math.pow(t, 0.6) * (behind ? 1 : 0.7);
        const w = thick * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, t * 1.1)));
        const X = Math.round(p[0]);
        const top0 = Math.round(p[1] - w);
        const bot = Math.round(p[1] + w * 0.6);
        for (let y = top0; y <= bot; y++) {
          if (!behind && onFace(x, [X, y])) continue;
          const tone = y === top0 ? (t > 0.84 ? 0 : 1) : y === top0 + 1 ? 2 : y === bot ? 4 : 3;
          const key = y * 4096 + X;
          const was = px.get(key);
          if (!was || was[1] < a) px.set(key, [tone, a, behind]);
        }
      }
      for (const [key, [tone, a, behind]] of px) c.glow(key % 4096, Math.floor(key / 4096), tones[tone] as RGB, tone === 4 ? a * 0.85 : a, behind);
    }
    // Crimson streaks caught up in it: short arcs at blade height and above, white-hot at their heads.
    const st = o.streaks ?? 0;
    if (st <= 0) return;
    for (let i = 0; i < 7; i++) {
      const h = 14 + hash(i, 161) * 44;
      const R = lerp(r0, r1, h / top) * (0.65 + hash(i, 162) * 0.25);
      const th0 = Math.PI * 2 * (spin * 1.3 + hash(i, 163));
      let prev: Vec | null = null;
      for (let j = 0; j <= 10; j++) {
        const th = th0 + j * 0.09;
        const p3: V3 = [g[0] + Math.cos(th) * R, h + j * 0.4, g[2] + Math.sin(th) * R];
        const behind = x.depth(p3) < zc;
        const p = x.proj(p3);
        if (prev && (behind || !onFace(x, p))) glowLine(c, prev, p, j > 7 ? aura.hot : j > 3 ? aura.core : BLOOD, st * (0.4 + j * 0.06), behind);
        prev = p;
      }
    }
  };

/**
 * The trails the two blades' tips leave as she spins: level arcs round her at `height`, `radius`
 * out, each running from its faint tail to its head at the tip (`to`, degrees round her in the
 * frame `turn` uses, as fx `ring` takes them; the left blade's is opposite), `len` degrees long:
 * a white-hot line at the head fading through crimson to a deep blood red at the tail, two pixels
 * thick. The half behind her passes behind her.
 */
export const tipTrails =
  (to: number, len: number, k = 1, height = 34, radius = 44): Extra =>
  (x) => {
    const { c, rig, aura } = x;
    const turn = x.rig.pose.turn ?? 0;
    const g: V3 = [rig.pelvis.o[0], height, rig.pelvis.o[2]];
    const zc = x.depth(g);
    for (const off of [0, 180]) {
      let prev: Vec | null = null;
      const n = Math.ceil(len / 3);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const a = rad(to + off - len * (1 - t) - turn);
        const p3: V3 = [g[0] + Math.cos(a) * radius, height, g[2] + Math.sin(a) * radius];
        const p = x.proj(p3);
        const behind = x.depth(p3) < zc;
        if (prev && (behind || !onFace(x, p))) {
          const col = t > 0.85 ? aura.hot : t > 0.4 ? aura.core : BLOOD;
          glowLine(c, prev, p, col, k * (0.3 + 0.7 * t), behind);
          glowLine(c, [prev[0], prev[1] + 1], [p[0], p[1] + 1], t > 0.6 ? aura.core : BLOOD, k * 0.8 * t, behind);
          if (t > 0.55) glowLine(c, [prev[0], prev[1] - 1], [p[0], p[1] - 1], aura.edge, k * 0.6 * t, behind);
        }
        prev = p;
      }
    }
  };

// ── Stances ──────────────────────────────────────────────────────────────────────────────────

/**
 * The battle stance, and the guard the skill and state clips build on: low and coiled, knees deep
 * and feet wide, leaning in; the right sabre low and forward, angled out to her right, the left
 * raised ahead of her chest pointing up and out to her left, so side on the two cross ahead of her
 * in a scissor and toward and away from the viewer they frame her.
 */
export const READY: ChibiPose = {
  x: 0,
  y: 6,
  lean: 14,
  twist: -8,
  head: 2,
  look: -2,
  footF: [11, 0, 5.4],
  footB: [-11, 0, 5],
  handF: [10, 13, 8],
  weapon: 100,
  roll: 10,
  yaw: 30,
  handB: [11, 6, 7],
  weaponB: 40,
  rollB: 30,
  yawB: 0,
  wind: 0.2,
};

/** Standing at ease: the right sabre resting back on her shoulder, the left hanging point down beside her, a hip cocked. */
export const AT_EASE: ChibiPose = {
  x: 0,
  y: 1,
  lean: 2,
  twist: 8,
  tilt: -3,
  head: -2,
  look: 4,
  footF: [4, 0, 4.4],
  footB: [-4, 0, 3.8],
  handF: [2, 9, 9],
  weapon: -30,
  roll: 20,
  yaw: -24,
  handB: [1, 15, 8],
  weaponB: 196,
  rollB: 14,
  yawB: 10,
  wind: 0.06,
};

// ── Idle ─────────────────────────────────────────────────────────────────────────────────────

const idle = Array.from({ length: 8 }, (_, i): ChibiPose => {
  // A breath: everything above the knees settles one whole pixel for the second half of the loop
  // (whole pixels, so the hair does not shimmer), the coat sways slowly round, the upright lock
  // bobs, and she blinks once; the hanging sabre swings a little in her loose fingers.
  const out = i >= 4 ? 1 : 0;
  return pose(AT_EASE, {
    y: -0.4 + out,
    weaponB: 196 + Math.sin((2 * Math.PI * i) / 8) * 5,
    sway: Math.sin((2 * Math.PI * (i + 1)) / 8) * 0.2,
    phase: i / 8,
    wind: 0.06 + wave(i, 8) * 0.06,
    face: i === 6 ? 'closed' : 'smirk',
  });
});

// ── Battle ───────────────────────────────────────────────────────────────────────────────────

const BOUNCE = 8;
const bounce = (i: number): number => wave(((i % BOUNCE) + BOUNCE) % BOUNCE, BOUNCE);

const battle = Array.from({ length: BOUNCE }, (_, i): ChibiPose => {
  // Rocking on the balls of her feet, down on the beat and springing back; the blades rise and
  // dip a frame apart, the head nods a frame behind, the hair and cloth lag (lifting as she drops,
  // settling as she rises).
  const b = bounce(i);
  const lag = b - bounce(i - 1);
  return pose(READY, {
    y: 5 + b * 3,
    lean: 13 + b * 2.5,
    head: 1 + bounce(i - 1) * 3,
    handF: [10, 13 + b * 1.4, 8],
    weapon: 100 + b * 5,
    handB: [11, 6 + bounce(i - 1) * 1.4, 7],
    weaponB: 40 + bounce(i - 1) * 6,
    wind: 0.2 + Math.max(0, lag) * 0.2,
    lift: lag * 0.5,
    sway: Math.sin((2 * Math.PI * (i - 1)) / BOUNCE) * 0.2,
    phase: i / BOUNCE,
    fx: { rune: 0.15 + b * 0.15, runeB: 0.15 + bounce(i - 1) * 0.15 },
  });
});

/** The battle loop's first frame: where every clip that hands back to the loop ends up. */
export const STANCE0 = battle[0] as ChibiPose;

/**
 * Back into the battle stance: k of the way from a pose to the first battle frame, then `over` on
 * top (pass `turn` for a pose that has spun round, and any effects: from k 0.5 they come from the
 * battle frame). The combo's recoveries and the skill and state clips that hand back to the
 * battle stance end with it, so both sabres are already where the loop holds them.
 */
export const settle = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(p, STANCE0, k), over);

/**
 * Out of the battle stance: k of the way from the first battle frame to a pose, then `over` on
 * top. Clips the battle loop hands over to start with it, so their first frame carries the blades
 * on from where the loop holds them. Keep k at 0.5 or more: the face and effects then come from
 * the pose. Give the pose's angles on the side the swing goes round, since the angles blend straight.
 */
export const fromReady = (p: ChibiPose, k: number, over: Partial<ChibiPose> = {}): ChibiPose => pose(mix(STANCE0, p, k), over);

// ── Move ─────────────────────────────────────────────────────────────────────────────────────

/** The stride: contact, down, passing, flight, then the same with the other leg. */
const STRIDE: { f: [number, number]; b: [number, number]; y: number }[] = [
  { f: [11, 0], b: [-9, -6], y: 2.6 },
  { f: [6, 0], b: [-7, -10], y: 4.2 },
  { f: [0, 0], b: [2, -8.5], y: 1.6 },
  { f: [-6, -1.5], b: [9, -4], y: -2 },
];

const move = Array.from({ length: 8 }, (_, i): ChibiPose => {
  const k = STRIDE[i % 4] as (typeof STRIDE)[number];
  const right = i < 4;
  const swing = Math.cos((2 * Math.PI * i) / 8);
  return {
    x: 3,
    y: k.y,
    lean: 28 + (i % 4 === 1 ? 2 : 0),
    twist: swing * 7,
    head: -12,
    look: -2,
    footF: right ? [k.f[0], k.f[1], 4] : [k.b[0], k.b[1], 4],
    footB: right ? [k.b[0], k.b[1], 3.8] : [k.f[0], k.f[1], 3.8],
    // Both sabres trail back from her hips, splayed out like wings; the arms barely pump.
    handF: [-6 - swing * 1.5, 15, 9],
    weapon: -112 + swing * 4,
    roll: 0,
    yaw: -34,
    handB: [-6 + swing * 1.5, 15, 9],
    weaponB: -112 - swing * 4,
    rollB: 0,
    yawB: -34,
    wind: 1,
    phase: i / 8,
    sway: Math.cos((2 * Math.PI * (i - 1.5)) / 8) * 0.3,
    fx: { speed: 0.8, dust: i % 4 === 0 ? 0.8 : 0, rune: 0.2, runeB: 0.2 },
  };
});

// ── The combo ────────────────────────────────────────────────────────────────────────────────

// atk1: the right sabre from high behind her right shoulder, ripped down across her body to low
// in front on her left; the left sabre swings back low for balance.
const A1_COCK = pose(READY, { x: -2, y: 5, lean: -2, twist: -28, head: -1, look: 2, footF: [10, -1, 5.4], footB: [-11, 0, 5], handF: [-7, -8, 13], weapon: -40, roll: 42, yaw: -6, handB: [8, 10, 7], weaponB: 80, rollB: 10, yawB: 20, wind: 0.25, lift: 0.2, sway: 0.3, phase: 0.1, face: 'grit', fx: { rune: 0.6, runeB: 0.2 } });
const A1_SWING = pose(READY, { x: 3, y: 5, lean: 12, twist: -4, head: 2, look: -2, footF: [14, 0, 5.6], handF: [12, 3, 8], weapon: 70, roll: 52, yaw: -6, handB: [3, 12, 9], weaponB: 150, rollB: 10, yawB: 10, wind: 0.45, phase: 0.25, face: 'shout', fx: { rune: 0.9 } });
const A1_HIT = pose(READY, { x: 6, y: 8, lean: 24, twist: 14, head: 1, look: -4, footF: [16, 0, 5.8], footB: [-12, 0, 5], handF: [15, 14, -2], weapon: 118, roll: 40, yaw: 0, handB: [-3, 11, 11], weaponB: 210, rollB: 10, yawB: 0, wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impact: 0.7, dust: 0.5, rune: 1, extra: splash(0) } });
const A1_FOLLOW = pose(A1_HIT, { y: 9, lean: 26, twist: 18, head: 2, handF: [14, 15, -3], weapon: 128, wind: 0.85, lift: 0.1, phase: 0.55, face: 'grit', fx: { dust: 0.3, rune: 0.6, extra: splash(0.6) } });

const atk1: ChibiPose[] = [
  A1_COCK,
  smear(A1_COCK, A1_SWING, 0.7),
  smear(A1_COCK, A1_HIT, 0.6),
  smear(A1_COCK, A1_FOLLOW, 0.5, 0.4),
  pose(A1_FOLLOW, { y: 8, lean: 22, twist: 12, head: 1, handF: [13, 14, -1], weapon: 120, wind: 0.6, lift: 0.3, phase: 0.7, face: 'stern', fx: { rune: 0.4, extra: splash(1) } }),
  settle(A1_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'smirk' }),
  settle(A1_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, face: 'smirk' }),
];

// atk2: the left sabre the same way, from high over her left shoulder down across to her right,
// her chest turning through so the left shoulder leads; the right sabre drawn back low.
const A2_COCK = pose(READY, { x: -1, y: 5, lean: 0, twist: 24, head: -1, look: -4, footF: [11, 0, 5.4], footB: [-11, 0, 5], handF: [4, 12, 10], weapon: 150, roll: 10, yaw: 20, handB: [-8, -7, 14], weaponB: -62, rollB: 36, yawB: -6, wind: 0.25, lift: 0.2, sway: -0.3, phase: 0.1, face: 'grit', fx: { runeB: 0.6, rune: 0.2 } });
const A2_SWING = pose(READY, { x: 3, y: 5, lean: 12, twist: 6, head: 2, look: -2, footF: [14, 0, 5.6], handF: [2, 13, 10], weapon: 170, roll: 10, yaw: 10, handB: [12, 3, 8], weaponB: 70, rollB: 52, yawB: -6, wind: 0.45, phase: 0.25, face: 'shout', fx: { runeB: 0.9 } });
const A2_HIT = pose(READY, { x: 6, y: 8, lean: 24, twist: -16, head: 1, look: -2, footF: [16, 0, 5.8], footB: [-12, 0, 5], handF: [-3, 12, 11], weapon: 210, roll: 10, yaw: 0, handB: [15, 14, -2], weaponB: 118, rollB: 40, yawB: 0, wind: 0.8, lift: -0.1, phase: 0.4, face: 'shout', fx: { impactB: 0.7, dust: 0.5, runeB: 1, extra: splash(0, 'off', 3) } });
const A2_FOLLOW = pose(A2_HIT, { y: 9, lean: 26, twist: -20, head: 2, handB: [14, 15, -3], weaponB: 128, wind: 0.85, lift: 0.1, phase: 0.55, face: 'grit', fx: { dust: 0.3, runeB: 0.6, extra: splash(0.6, 'off', 3) } });

const atk2: ChibiPose[] = [
  A2_COCK,
  smearB(A2_COCK, A2_SWING, 0.7),
  smearB(A2_COCK, A2_HIT, 0.6),
  smearB(A2_COCK, A2_FOLLOW, 0.5, 0.4),
  pose(A2_FOLLOW, { y: 8, lean: 22, twist: -14, head: 1, handB: [13, 14, -1], weaponB: 120, wind: 0.6, lift: 0.3, phase: 0.7, face: 'stern', fx: { runeB: 0.4, extra: splash(1, 'off', 3) } }),
  settle(A2_FOLLOW, 0.55, { wind: 0.35, lift: 0.25, phase: 0.85, face: 'smirk' }),
  settle(A2_FOLLOW, 0.88, { wind: 0.24, lift: 0.05, phase: 1, face: 'smirk' }),
];

// atk3: coiled to her left with both blades drawn back, a full turn with both held out level (a
// ring of crimson round her), then both raised high and spread and cut down crossing in an X.
const A3_COIL = pose(READY, { x: -2, y: 9, lean: 14, twist: -30, turn: -20, head: 4, look: 6, footF: [11, 0, 6], footB: [-12, 0, 5.6], handF: [8, 12, -2], weapon: 110, roll: 0, yaw: -60, handB: [-2, 12, 11], weaponB: 120, rollB: 0, yawB: 50, wind: 0.3, sway: 0.3, face: 'grit', fx: { rune: 0.6, runeB: 0.6 } });
const A3_COIL2 = pose(A3_COIL, { y: 10, lean: 16, twist: -36, turn: -34, head: 5, handF: [7, 13, -3], wind: 0.35, lift: 0.2, phase: 0.1, fx: { rune: 0.9, runeB: 0.9, aura: 0.3 } });
/** Spinning with both arms flung out, the blades level out to either side. */
const a3Spin = (turn: number, phase: number, ring: [number, number]): ChibiPose =>
  pose(READY, { x: 0, y: 4, lean: 6, twist: 0, turn, head: 0, look: -10, footF: [8, -2, 5], footB: [-8, 0, 5], handF: [4, 6, 15], weapon: 90, roll: 0, yaw: 82, handB: [4, 6, 15], weaponB: 90, rollB: 0, yawB: 82, wind: 0.6, flare: 1, lift: 0.3, phase, face: 'shout', fx: { ring: { from: ring[0], to: ring[1], height: 34 }, rune: 1, runeB: 1 } });
const A3_RAISE = pose(READY, { x: 2, y: 3, lean: -6, twist: 0, turn: 360, head: -4, look: 0, footF: [12, 0, 5.6], footB: [-11, 0, 5], handF: [-5, -7, 13], weapon: -30, roll: 40, yaw: 0, handB: [-5, -7, 13], weaponB: -30, rollB: 40, yawB: 0, wind: 0.4, lift: 0.5, flare: 0.3, phase: 0.6, face: 'shout', fx: { rune: 1, runeB: 1, aura: 0.4 } });
const A3_HIT = pose(READY, { x: 7, y: 10, lean: 26, twist: 0, turn: 360, head: 3, look: -2, footF: [17, 0, 6], footB: [-12, 0, 5.4], handF: [13, 15, 1], weapon: 132, roll: 40, yaw: 0, handB: [13, 15, 1], weaponB: 132, rollB: 40, yawB: 0, wind: 0.9, lift: -0.1, phase: 0.75, face: 'shout', fx: { rune: 1, runeB: 1, dust: 1, impact: 1, impactAt: [28, 22, 0], extra: both(crossMark(1, 40, 28), splash(0, [28, 22, 0], 5)) } });
const A3_HOLD = pose(A3_HIT, { y: 11, lean: 28, handF: [12, 16, 2], weapon: 136, handB: [12, 16, 2], weaponB: 136, wind: 0.7, lift: 0.2, phase: 0.9, face: 'grit', fx: { rune: 0.7, runeB: 0.7, dust: 0.6, extra: both(crossMark(0.55, 40, 28), splash(0.7, [28, 22, 0], 5)) } });

const atk3: ChibiPose[] = [
  A3_COIL,
  A3_COIL2,
  a3Spin(110, 0.25, [-40, 200]),
  a3Spin(250, 0.4, [80, 340]),
  pose(A3_RAISE, { fx: { ...A3_RAISE.fx, ring: { from: 250, to: 400, height: 34 } } }),
  smear(A3_RAISE, smearB(A3_RAISE, A3_HIT, 0.6), 0.6),
  smear(A3_RAISE, smearB(A3_RAISE, A3_HOLD, 0.5, 0.4), 0.5, 0.4),
  settle(A3_HOLD, 0.5, { turn: 360, wind: 0.35, lift: 0.25, phase: 1, face: 'stern', fx: { extra: crossMark(0.2, 40, 28) } }),
  settle(A3_HOLD, 0.85, { turn: 360, wind: 0.24, lift: 0.05, phase: 1.1, face: 'smirk' }),
];

/** The core clips' poses, by clip. */
export const CORE_MOVES = { idle, battle, move, atk1, atk2, atk3 };
