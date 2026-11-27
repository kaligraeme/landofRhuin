/**
 * The Blademaster's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of her own
 * painted through `fx.extra` (moves-core.ts has the shared ones: her cut arcs, the crimson splash,
 * X and floor shock, the violet-blue whirlwind). Wind-up frames come first: Executioner's and
 * Cataclysm Blades' stretch over the server's wind-up (0.4 and 0.6 s), the others take 0.06 s
 * each, and the rest share the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special   7  (1 wind-up) Rising Slash: dropped into a deep crouch with both sabres low
 *                behind her, then both ripped up through the foe in rising crimson arcs as she
 *                springs off the floor (face on, two tall crescents either side of her like wings),
 *                speed lines under her feet, a splash of sparks at the top, and a light landing
 *   q        10  (1 wind-up) Whirlwind: coiled to her left, then two full turns with both arms
 *                flung out and the blades level, inside three broad bands of violet-blue wind with
 *                crimson streaks whipping round in it and crimson trails behind both blade tips,
 *                then she slows into her stance as the wind dies
 *   e         8  (1 wind-up) Blademaster's Lunge: a coil, then a long lunge so low her body is
 *                nearly level, the lead knee far forward, the back leg straight, both blades
 *                trailing low like wings; afterimages of her washed crimson and long speed lines
 *                behind her; at the end both blades whip forward in a scissor as she skids to a
 *                stop, boots ploughing the floor. The server moves her, so it plays in place.
 *   r        10  (3 wind-up) Executioner: both blades raised high and crossed over her head on her
 *                toes, then a hop up off the floor, a crimson glow gathering where they cross (the
 *                wind-up); then she drops and brings both down at once: a giant crimson X from over
 *                her head to under the floor, white-hot where its strokes cross, a spray of crimson
 *                and a shock rolling out along the floor; she holds the slam, then rises
 *   ult      14  (4 wind-up) Cataclysm Blades: arms spread low with the blades pointing out, she
 *                gathers a huge violet-blue funnel of wind that lifts her coat and hair (the
 *                wind-up), then a ruinous spin inside it, a ring of wind whirling on the floor and
 *                long crimson slash marks cut all round her; she ends crouched wide with both blades
 *                swept out low to either side, the coat-tails flaring, as a shock rolls out and the
 *                wind dies
 *   cast      8  (2 wind-up) role skills (Bloodrush, Second Wind) and the Elixir: the blades
 *                crossed before her chest under her chin, a crimson flare climbing her body from a
 *                sigil on the floor past her head, motes rising, then the blades swept apart and
 *                lowered back into her stance
 *
 * The poses build on the battle stance (moves-core.ts READY); each clip starts from it
 * (`fromReady`) and its last frames ease back into it (`settle`), so the loop takes over smoothly.
 */
import type { RGB, Vec } from '../../paint.js';
import { DUST, DUST_DARK, glowLine, puff } from '../fx.js';
import { type ChibiPose, type FxContext, lerp, pose, type V3 } from '../rig.js';
import { BLOOD, both, crossMark, cut, fromReady, mixRGB, quake, READY, settle, smear, smearB, splash, tipTrails, vortex } from './moves-core.js';

const S = READY;

// ── Effects of the skills' own ───────────────────────────────────────────────────────────────

const FURROW: RGB = [62, 54, 50];

/** A skid (strength k): furrows ploughed behind her boots and a bank of dust and grit thrown up ahead of them. */
const skid =
  (k: number) =>
  (x: FxContext): void => {
    const { rig, hash } = x;
    for (const [leg, s] of [[rig.legR, 1], [rig.legL, 2]] as const) {
      if (leg.end[1] > rig.build.ankle + 3) continue;
      const g: V3 = [leg.end[0], 0, leg.end[2]];
      const a = x.proj([g[0] - 3, 0, g[2]]);
      const b = x.proj([g[0] - 3 - 22 * k, 0, g[2]]);
      glowLine(x.c, a, b, FURROW, 0.85 * k, true);
      glowLine(x.c, [a[0], a[1] + 1], [b[0], b[1] + 1], DUST_DARK, 0.55 * k, true);
      for (let i = 0; i < 3; i++) {
        const p = x.proj([g[0] + 5 + i * 3.5, 0, g[2] + (hash(i, s + 84) - 0.5) * 4]);
        const r = (3.2 - i * 0.7) * (0.6 + 0.5 * k);
        puff(x.c, p[0], p[1] - r * 0.7 - i, r, i % 2 ? DUST_DARK : DUST, 0.6 * k);
      }
      for (let i = 0; i < 6; i++) {
        const p = x.proj([g[0] + 4 + hash(i, s + 80) * 12 * k, hash(i, s + 81) * 9 * k, g[2] + (hash(i, s + 82) - 0.5) * 6]);
        x.c.glow(p[0], p[1], i % 2 ? DUST : DUST_DARK, 0.95 * k);
      }
    }
  };

/**
 * Crimson slash marks cut in the air all round her (Cataclysm Blades): `n` long, deliberate strokes
 * (28 to 36 px) set evenly round her inside the whirlwind at heights from her knees to over her
 * head, each slanting its own way and bowed a little, a white-hot core down its middle, hot crimson
 * either side, a deep crimson shadow under it and a pale pink fringe, pointed at both ends; `k`
 * their strength (they thin and fade as it falls), `seed` sets them anew (change it every frame).
 * Strokes behind her pass behind her; none crosses her face.
 */
const slashes =
  (k: number, seed: number, n = 5, radius = 50) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const head = x.proj(rig.head.o);
    const zc = x.depth(rig.pelvis.o);
    for (let i = 0; i < n; i++) {
      const th = ((i + hash(i, 171 + seed) * 0.5) / n) * Math.PI * 2 + seed * 0.7;
      const rr = radius * (0.55 + 0.4 * hash(i, 172 + seed));
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * rr, 16 + ((i * 0.37 + hash(i, 173 + seed) * 0.5) % 1) * 62, rig.pelvis.o[2] + Math.sin(th) * rr];
      const C = x.proj(p3);
      if (Math.hypot(C[0] - head[0], C[1] - head[1]) < 18) continue;
      const under = x.depth(p3) < zc;
      // Steep or shallow diagonals, never flat or upright, so each reads as a cut.
      const ang = (i % 2 ? 0.55 : -0.55) + (hash(i, 174 + seed) - 0.5) * 0.7 + (i % 2 ? 0 : Math.PI);
      const len = (28 + hash(i, 175 + seed) * 8) * (0.75 + 0.25 * k);
      const bend = (hash(i, 176 + seed) - 0.5) * 3;
      const d: Vec = [Math.cos(ang), Math.sin(ang)];
      const nrm: Vec = [-d[1], d[0]];
      const steps = Math.ceil(len * 1.5);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps - 0.5;
        const w = (0.7 + 1 * k) * Math.pow(Math.cos(Math.PI * t), 1.2);
        const off = bend * (1 - 4 * t * t);
        const px = C[0] + d[0] * t * len + nrm[0] * off;
        const py = C[1] + d[1] * t * len + nrm[1] * off;
        for (let o = -Math.ceil(w + 1); o <= Math.ceil(w + 1); o++) {
          const q: Vec = [Math.round(px + nrm[0] * o), Math.round(py + nrm[1] * o)];
          if (!under && Math.hypot(q[0] - head[0], (q[1] - head[1]) * 1.1) < 11) continue;
          const a = Math.abs(o);
          const col: RGB = a <= Math.max(0.5, w * 0.4) ? aura.hot : a <= w ? aura.core : o > 0 ? BLOOD : aura.edge;
          const al = a <= w ? 1 : 0.6;
          c.glow(q[0], q[1], col, al * Math.min(1, k * 1.3), under);
        }
      }
    }
  };

/**
 * A crimson gleam where the two blades cross over her head (Executioner's wind-up): a small
 * four-pointed star, white at its heart, `k` its size.
 */
const crossGleam =
  (k: number) =>
  (x: FxContext): void => {
    const { c, rig, aura } = x;
    // Where the blades cross: about two-thirds of the way up each, between them.
    const a = add(rig.weapon.o, rig.weapon.u, 16);
    const b = add(rig.offhand.o, rig.offhand.u, 16);
    const at: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const [px, py] = x.proj(at);
    // Behind her head (seen from behind) it shines out round it rather than over it.
    const under = x.depth(at) < x.depth(rig.head.o);
    const r = Math.round(3 + 5 * k);
    for (let i = -r; i <= r; i++) {
      const f = 1 - Math.abs(i) / (r + 1);
      c.glow(px + i, py, i === 0 ? aura.hot : aura.core, f, under);
      c.glow(px, py + i, i === 0 ? aura.hot : aura.core, f, under);
    }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) c.glow(px + dx, py + dy, Math.abs(dx) + Math.abs(dy) === 0 ? aura.hot : mixRGB(aura.hot, aura.core, 0.5), 0.9 * k, under);
  };

/**
 * A crimson flare pouring up her body (her role skills): tongues of crimson fire licking up round
 * her from her feet to over her head, white at their roots, crimson, fraying pale pink at their
 * tips, `k` their strength and `rise` (0 to 1, advance it every frame) how far up they have run.
 * Those behind her pass behind her; those before her are laid over her lightly and never over her face.
 */
const flare =
  (k: number, rise: number) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const g = rig.pelvis.o;
    const zc = x.depth(g);
    const head = x.proj(rig.head.o);
    for (let i = 0; i < 24; i++) {
      const th = (i / 24) * Math.PI * 2 + hash(i, 181) * 0.3;
      const R = 9 + hash(i, 182) * 6;
      const h = ((hash(i, 183) * 0.8 + rise) % 1) * 70;
      const p3: V3 = [g[0] + Math.cos(th) * R, h, g[2] + Math.sin(th) * R];
      const behind = x.depth(p3) < zc;
      const p = x.proj(p3);
      const len = Math.round((8 + hash(i, 184) * 10) * k);
      for (let t = 0; t <= len; t++) {
        const f = t / Math.max(1, len);
        const q: Vec = [Math.round(p[0] + (f > 0.6 ? (i % 2 ? 1 : -1) : 0)), Math.round(p[1] - t)];
        if (!behind && Math.hypot(q[0] - head[0], (q[1] - head[1]) * 1.1) < 12) continue;
        const col: RGB = f < 0.2 ? aura.hot : f < 0.7 ? aura.core : aura.edge;
        c.glow(q[0], q[1], col, (behind ? 1 : 0.75) * k * (1 - f * 0.5), behind);
        if (f < 0.6) c.glow(q[0] + 1, q[1], f < 0.3 ? aura.core : BLOOD, 0.7 * k, behind);
      }
    }
  };

/**
 * Afterimages of her lunge: `n` copies of her as painted so far (before effects), each keeping its
 * own shapes and shading, washed toward crimson and fading with distance, set `gap` pixels apart
 * on screen behind her (the farthest first, so the nearer lie over them), under the figure so only
 * what sticks out of it shows: each reads as her silhouette, head, coat-tail and trailing blade.
 * When the lunge runs toward or away from the viewer the copies close up and shrink a little toward
 * her feet, as farther ones would.
 */
const echoes =
  (k: number, n = 3, gap = 13) =>
  (x: FxContext): void => {
    const { c, cam, rig } = x;
    const v = cam.vec([-1, 0, 0]);
    const vl = Math.hypot(v[0], v[1]);
    const side = vl > 0.6;
    const d: Vec = side ? [v[0] / vl, v[1] / vl] : [0, -1];
    const step = side ? gap : gap * 0.45;
    const foot = x.proj([rig.pelvis.o[0], 0, rig.pelvis.o[2]]);
    const pix: [number, number, RGB][] = [];
    for (let y = 0; y < c.h; y++) {
      for (let px = 0; px < c.w; px++) {
        if (!c.opaque(px, y)) continue;
        const i = (y * c.w + px) * 4;
        pix.push([px, y, [c.data[i] as number, c.data[i + 1] as number, c.data[i + 2] as number]]);
      }
    }
    // Toward or away from the viewer the copies would stack over her head: one faint one will do.
    const m = side ? n : 1;
    for (let i = m; i >= 1; i--) {
      const f = (i - 1) / Math.max(1, n - 1);
      const a = k * lerp(0.75, 0.3, f) * (side ? 1 : 0.6);
      const wash = 0.45 + 0.25 * f;
      const sc = side ? 1 : 1 - 0.07 * i;
      const ox = d[0] * step * i;
      const oy = d[1] * step * i;
      for (const [px, py, col] of pix) {
        const gx = Math.round(foot[0] + (px - foot[0]) * sc + ox);
        const gy = Math.round(foot[1] + (py - foot[1]) * sc + oy);
        c.glow(gx, gy, mixRGB(col, mixRGB(CRIMSON_GHOST, BLOOD, f), wash), a, true);
      }
    }
  };

const CRIMSON_GHOST: RGB = [232, 74, 92];

/**
 * Speed lines streaming back from her: `n` long, thin lines at different heights along her body,
 * white-hot at their heads by her and fading pink toward their tails, behind her on screen. `k`
 * their strength.
 */
const streaks =
  (k: number, n = 4) =>
  (x: FxContext): void => {
    const { c, cam, rig, aura } = x;
    // Seen end on they would only stand up over her head.
    const v = cam.vec([-1, 0, 0]);
    if (Math.hypot(v[0], v[1]) < 0.6) return;
    for (let i = 0; i < n; i++) {
      const h = 10 + i * (52 / n) + (i % 2) * 4;
      const r = ((i % 3) - 1) * 6;
      const start: V3 = [rig.pelvis.o[0] - 6 - (i % 2) * 5, h, r];
      const len = (34 + ((i * 13) % 14)) * k;
      const a = x.proj(start);
      const b = x.proj([start[0] - len, h, r]);
      const m = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let j = 0; j <= m; j++) {
        const t = j / m;
        c.glow(lerp(a[0], b[0], t), lerp(a[1], b[1], t), t < 0.25 ? aura.hot : aura.edge, k * 0.85 * (1 - t), true);
      }
    }
  };

/** Short speed lines streaming down under her feet as she springs up (strength k). */
const upLines =
  (k: number) =>
  (x: FxContext): void => {
    const { c, rig, aura } = x;
    for (let i = 0; i < 3; i++) {
      const at: V3 = [rig.pelvis.o[0] + (i - 1) * 5, Math.max(0, Math.min(rig.legR.end[1], rig.legL.end[1]) - 3 - (i % 2) * 2), rig.pelvis.o[2] + (i - 1) * 4];
      const a = x.proj(at);
      const len = (10 + (i % 2) * 5) * k;
      for (let j = 0; j <= len; j++) c.glow(a[0], a[1] + j, j < 3 ? aura.hot : aura.edge, k * 0.85 * (1 - j / (len + 1)), true);
    }
  };

/**
 * The flare climbing her body (her role skills): four long crimson streaks rising from the floor
 * sigil round her past her head, each a white-hot head, a crimson body and a deep crimson tail
 * fading out, with a mote shed beside it; `k` their strength, `rise` (0 to 1, advance it every
 * frame) how far up they have climbed. Those behind her pass behind her; none crosses her face.
 */
const risers =
  (k: number, rise: number) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const g = rig.pelvis.o;
    const zc = x.depth(g);
    for (let i = 0; i < 4; i++) {
      const th = (i / 4) * Math.PI * 2 + 0.5;
      const R = 19 + hash(i, 185) * 4;
      const head = (rise + i * 0.13) * 100 - 6;
      const len = 22 + hash(i, 186) * 8;
      const base: V3 = [g[0] + Math.cos(th) * R, 0, g[2] + Math.sin(th) * R];
      const behind = x.depth(base) < zc;
      for (let t = 0; t <= len; t++) {
        const h = head - t;
        if (h < 0) break;
        const p = x.proj([base[0], h, base[2]]);
        if (!behind && onFaceAt(x, p)) continue;
        const f = t / len;
        c.glow(p[0], p[1], f < 0.15 ? aura.hot : f < 0.6 ? aura.core : BLOOD, k * (1 - f * 0.85), behind);
        c.glow(p[0] + 1, p[1], f < 0.3 ? aura.core : BLOOD, k * 0.85 * (1 - f), behind);
        if (f < 0.5) c.glow(p[0] - 1, p[1], aura.edge, k * 0.6 * (1 - f), behind);
      }
      const m = x.proj([base[0] + 3, head + 4, base[2]]);
      c.glow(m[0], m[1], aura.edge, k * 0.8, behind);
    }
  };

/** Is a screen point on her face (a circle round her head's middle)? */
const onFaceAt = (x: FxContext, p: Vec): boolean => {
  const h = x.proj(x.rig.head.o);
  return Math.hypot(p[0] - h[0], (p[1] - h[1]) * 1.1) < 12;
};

const add = (o: V3, u: V3, k: number): V3 => [o[0] + u[0] * k, o[1] + u[1] * k, o[2] + u[2] * k];

// ── Rising Slash ─────────────────────────────────────────────────────────────────────────────

/** Coiled deep, both blades low behind her, points trailing near the floor. */
const RS_CROUCH = pose(S, { x: -2, y: 13, lean: 24, twist: 6, head: 8, look: -2, footF: [11, 0, 6], footB: [-12, 0, 5.6], handF: [0, 17, 10], weapon: 236, roll: 26, yaw: -24, handB: [0, 17, 10], weaponB: 236, rollB: 26, yawB: -24, face: 'grit', wind: 0.2, lift: 0.1, fx: { rune: 0.7, runeB: 0.7, aura: 0.25 } });
/** Ripped up through the foe as she springs: both blades up in front, arms high. */
const RS_RIP = pose(S, { x: 5, y: 2, lean: 2, twist: -4, head: -6, look: -2, footF: [13, -2, 5.6], footB: [-6, 0, 5], handF: [9, -3, 11], weapon: 22, roll: 28, yaw: 0, handB: [9, -3, 11], weaponB: 22, rollB: 28, yawB: 0, face: 'shout', wind: 0.5, lift: 0.5, fx: { rune: 1, runeB: 1, impact: 0.8, dust: 1 } });
/** In the air at the top of the hop, the blades thrown high, legs tucked. */
const RS_HOP = pose(S, { x: 6, y: -10, lean: -6, twist: -2, head: -8, look: 0, footF: [10, -18, 5.4], footB: [-3, -13, 5], handF: [0, -8, 12], weapon: -8, roll: 28, yaw: 0, handB: [0, -8, 12], weaponB: -8, rollB: 28, yawB: 0, face: 'shout', wind: 0.4, lift: 1, phase: 0.2, fx: { rune: 1, runeB: 1 } });

const special: ChibiPose[] = [
  fromReady(RS_CROUCH, 0.7),
  smear(RS_CROUCH, smearB(RS_CROUCH, RS_RIP, 0.65), 0.65),
  smear(RS_CROUCH, smearB(RS_CROUCH, pose(RS_HOP, { fx: { ...RS_HOP.fx, extra: both(upLines(1), splash(0, undefined, 7), splash(0, 'off', 8)) } }), 0.55), 0.55),
  smear(RS_CROUCH, smearB(RS_CROUCH, pose(RS_HOP, { y: -12, footF: [9, -19, 5.4], footB: [-4, -15, 5], handF: [-2, -9, 12], handB: [-2, -9, 12], weapon: -14, weaponB: -14, lift: 1, phase: 0.35, face: 'grit', fx: { rune: 0.8, runeB: 0.8, extra: both(upLines(0.6), splash(0.6, undefined, 7), splash(0.6, 'off', 8)) } }), 0.45, 0.35), 0.45, 0.35),
  // Landing light on her toes, the blades coming down.
  pose(S, { x: 6, y: 9, lean: 14, twist: -6, head: 3, footF: [13, 0, 5.6], footB: [-9, 0, 5], handF: [9, 6, 10], weapon: 50, roll: 16, yaw: 10, handB: [9, 6, 10], weaponB: 50, rollB: 16, yawB: 0, face: 'grit', wind: 0.3, lift: 0.6, phase: 0.5, fx: { dust: 0.9, rune: 0.5, runeB: 0.5, extra: both(splash(1, [26, 40, 6], 7)) } }),
  settle(pose(S, { x: 5, y: 8, lean: 14, handF: [10, 9, 9], weapon: 70, handB: [10, 7, 8], weaponB: 46 }), 0.55, { wind: 0.3, lift: 0.3, phase: 0.65, face: 'smirk', fx: { dust: 0.3 } }),
  settle(pose(S, { x: 3, y: 7, lean: 14 }), 0.9, { wind: 0.22, lift: 0.08, phase: 0.8, face: 'smirk' }),
];

// ── Whirlwind ────────────────────────────────────────────────────────────────────────────────

/** The spin's turns, frame by frame: two full turns, then slowing. */
const WHIRL = [50, 140, 230, 320, 410, 500, 590, 670];

/** Frame i of the spin: arms flung out, both blades level out to either side, inside the vortex. */
function whirl(i: number, k = 1): ChibiPose {
  const turn = WHIRL[i] as number;
  return pose(S, {
    x: 0,
    y: 5,
    lean: 4,
    twist: 0,
    turn,
    head: 0,
    // Side on the head turns ahead of the body anyway; keep it from leading the spin.
    look: -12,
    footF: [8, i % 2 ? -2 : 0, 5.6],
    footB: [-8, i % 2 ? 0 : -1.5, 5.2],
    handF: [3, 7, 15],
    weapon: 90,
    roll: 0,
    yaw: 84,
    handB: [3, 7, 15],
    weaponB: 90,
    rollB: 0,
    yawB: 84,
    face: 'shout',
    wind: 0.5,
    flare: 1,
    lift: 0.4,
    sway: -0.4,
    phase: i / 8,
    fx: { rune: 1, runeB: 1, extra: both(vortex(k, i * 0.13, { r0: 22, r1: 46, top: 80, n: 3, thick: 5, streaks: k * 0.8 }), tipTrails(turn + 90, 120 * k, 1, 38, 48)) },
  });
}

const q: ChibiPose[] = [
  // Wind-up: coiled to her left, the right blade drawn across her body, the left back behind her.
  fromReady(pose(S, { y: 8, lean: 10, twist: -26, turn: -40, head: 3, look: 14, footF: [9, 0, 6], footB: [-9, 0, 5.6], handF: [9, 11, -3], weapon: 90, roll: 0, yaw: -64, handB: [-2, 11, 11], weaponB: 110, rollB: 0, yawB: -30, face: 'grit', wind: 0.3, sway: -0.4, fx: { rune: 0.7, runeB: 0.7, extra: vortex(0.3, 0, { r0: 20, r1: 34, top: 60, n: 2, thick: 4 }) } }), 0.7),
  whirl(0, 0.7),
  whirl(1),
  whirl(2),
  whirl(3),
  whirl(4),
  whirl(5),
  whirl(6),
  // Slowing as the wind dies.
  pose(whirl(7, 0.5), { lean: 8, y: 6, face: 'grit', fx: { rune: 0.6, runeB: 0.6, extra: both(vortex(0.5, 7 * 0.13, { r0: 26, r1: 50, top: 76, n: 3, thick: 4 }), tipTrails(670 + 90, 90, 0.6, 38, 48)) } }),
  settle(pose(S, { y: 6, lean: 10, turn: 720, flare: 0.4 }), 0.7, { turn: 720, flare: 0.4, wind: 0.3, lift: 0.2, phase: 1.1, face: 'smirk' }),
];

// ── Blademaster's Lunge ──────────────────────────────────────────────────────────────────────

/** The lunge: long and low, her body nearly level, the lead knee far forward and the back leg straight out behind, both blades trailing low like wings. */
const LUNGE: ChibiPose = pose(S, { x: 15, y: 17, lean: 58, twist: 6, head: -30, look: -4, footF: [33, 0, 6], footB: [-22, -1, 5], handF: [-10, 17, 10], weapon: -104, roll: 0, yaw: -36, handB: [-10, 17, 10], weaponB: -104, rollB: 0, yawB: -36, face: 'shout', wind: 1.2, lift: 0.1 });
/** The stop: both blades whipped forward in a scissor as her boots skid. */
const STOP: ChibiPose = pose(S, { x: 14, y: 13, lean: 18, twist: -6, head: 0, look: -2, footF: [28, 0, 6], footB: [0, 0, 5.4], handF: [14, 13, 4], weapon: 118, roll: 30, yaw: 0, handB: [14, 11, 4], weaponB: 104, rollB: 30, yawB: 0, face: 'shout', wind: 0.3, lift: 0.5, sway: 0.3, phase: 0.6 });

const e: ChibiPose[] = [
  // Coiled low, both blades swept back behind her.
  fromReady(pose(S, { x: -3, y: 13, lean: 26, twist: 10, head: -2, footF: [8, 0, 5.6], footB: [-15, 0, 5.2], handF: [-4, 15, 10], weapon: -116, roll: 0, yaw: -30, handB: [-4, 15, 10], weaponB: -116, rollB: 0, yawB: -30, face: 'grit', wind: 0.3, fx: { rune: 0.6, runeB: 0.6, aura: 0.4, dust: 0.4 } }), 0.75),
  // Launch: the back leg drives off the floor.
  pose(LUNGE, { x: 9, y: 12, lean: 46, head: -22, footF: [22, -5, 5.6], footB: [-22, 0, 5], phase: 0.1, fx: { rune: 1, runeB: 1, dust: 1, extra: both(echoes(0.55, 2, 14), streaks(0.7)) } }),
  pose(LUNGE, { phase: 0.25, fx: { rune: 1, runeB: 1, extra: both(echoes(1, 3, 16), streaks(1)) } }),
  pose(LUNGE, { x: 16, y: 16, footF: [34, 0, 6], footB: [-20, -4, 5], phase: 0.4, fx: { rune: 1, runeB: 1, dust: 0.6, extra: both(echoes(0.85, 3, 16), streaks(0.9)) } }),
  // The stop: both blades whipped forward, boots ploughing the floor.
  smear(LUNGE, smearB(LUNGE, pose(STOP, { fx: { rune: 1, runeB: 1, dust: 1, extra: both(echoes(0.35, 2, 12), skid(1), splash(0, undefined, 9)) } }), 0.42, 0.8), 0.42, 0.8),
  smear(LUNGE, smearB(LUNGE, pose(STOP, { y: 12, lean: 16, handF: [13, 14, 3], weapon: 124, weaponB: 110, wind: 0.15, lift: 0.4, phase: 0.75, face: 'grit', fx: { rune: 0.6, runeB: 0.6, dust: 0.6, extra: both(skid(0.6), splash(0.6, undefined, 9)) } }), 0.36, 0.3), 0.36, 0.3),
  settle(pose(STOP, { x: 10, y: 9 }), 0.5, { wind: 0.2, lift: 0.3, phase: 0.9, face: 'smirk', fx: { dust: 0.3, extra: skid(0.3) } }),
  settle(pose(STOP, { x: 4, y: 7 }), 0.88, { wind: 0.22, lift: 0.08, phase: 1, face: 'smirk' }),
];

// ── Executioner ──────────────────────────────────────────────────────────────────────────────

/** Both blades raised high and crossed over her head, up on her toes. */
const RAISED: ChibiPose = pose(S, { x: -1, y: 1, lean: -8, twist: 0, head: -6, look: 0, footF: [11, -2, 5.6], footB: [-10, -1, 5.2], handF: [-3, -11, 12], weapon: -2, roll: -32, yaw: 0, handB: [-3, -11, 12], weaponB: -2, rollB: -32, yawB: 0, face: 'grit', wind: 0.3, lift: 0.5 });
/** Brought down: both blades crossing low in front of her, crouched deep from the drop. */
const CHOP: ChibiPose = pose(S, { x: 8, y: 13, lean: 32, twist: 0, head: 4, look: -2, footF: [18, 0, 6.5], footB: [-13, 0, 5.8], handF: [13, 16, 2], weapon: 138, roll: 40, yaw: 0, handB: [13, 16, 2], weaponB: 138, rollB: 40, yawB: 0, face: 'shout', wind: 0.9, lift: -0.1 });
/** Where the X hangs: well ahead of her, its middle at her chest, its arms from over her head to under the floor. */
const X_AHEAD = 56;
const X_SIZE = 120;
const XO = { high: 40, thick: 5, flash: 1 };

const r: ChibiPose[] = [
  // Wind-up: the blades swept up from her stance...
  fromReady(pose(S, { y: 4, lean: 2, twist: 0, head: -2, handF: [6, 3, 11], weapon: 20, roll: -10, yaw: 0, handB: [6, 3, 11], weaponB: 20, rollB: -10, yawB: 0, face: 'grit', wind: 0.25, fx: { rune: 0.6, runeB: 0.6 } }), 0.65),
  // ...raised and crossed over her head on her toes, a gleam where they cross...
  pose(RAISED, { phase: 0.1, fx: { rune: 0.9, runeB: 0.9, aura: 0.5, extra: crossGleam(0.5) } }),
  // ...and a hop up off the floor, stretched tall, the gleam and the aura gathering.
  pose(RAISED, { y: -4, lean: -10, head: -8, footF: [10, -6, 5.6], footB: [-8, -5, 5.2], handF: [-3, -12, 12], handB: [-3, -12, 12], weapon: -6, weaponB: -6, lift: 0.8, phase: 0.2, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, extra: crossGleam(1) } }),
  // The chop: dropped from the hop, both at once, a giant crimson X from over her head to under
  // the floor, white-hot where its strokes cross, a spray of crimson and a shock along the floor.
  smear(RAISED, smearB(RAISED, pose(CHOP, { phase: 0.35, fx: { rune: 1, runeB: 1, dust: 1, impact: 1.4, impactAt: [X_AHEAD, 34, 0], extra: both(crossMark(1, X_SIZE, X_AHEAD, XO), splash(0, [X_AHEAD, 40, 0], 11, 2.2), quake(0.12, [X_AHEAD - 6, 0, 0], 80)) } }), 0.4, 0.65), 0.4, 0.65),
  // Held in the slam as the X burns and the spray flies.
  smear(RAISED, smearB(RAISED, pose(CHOP, { y: 13.5, lean: 33, handF: [12, 16.5, 3], weapon: 140, handB: [12, 16.5, 3], weaponB: 140, wind: 0.7, lift: 0.2, phase: 0.5, face: 'shout', fx: { rune: 0.9, runeB: 0.9, dust: 0.7, extra: both(crossMark(0.85, X_SIZE, X_AHEAD, { ...XO, flash: 0.5 }), splash(0.5, [X_AHEAD, 40, 0], 11, 2.2), quake(0.45, [X_AHEAD - 6, 0, 0], 80)) } }), 0.35, 0.25), 0.35, 0.25),
  pose(CHOP, { y: 13.5, lean: 33, handF: [12, 16.5, 3], weapon: 140, handB: [12, 16.5, 3], weaponB: 140, wind: 0.5, lift: 0.3, phase: 0.62, face: 'grit', fx: { rune: 0.7, runeB: 0.7, dust: 0.4, extra: both(crossMark(0.6, X_SIZE, X_AHEAD, { ...XO, flash: 0 }), splash(0.9, [X_AHEAD, 40, 0], 11, 2.2), quake(0.75, [X_AHEAD - 6, 0, 0], 80)) } }),
  // Rising out of it as the X fades.
  pose(CHOP, { y: 12, lean: 28, handF: [12, 14, 4], weapon: 132, handB: [12, 14, 4], weaponB: 128, wind: 0.3, lift: 0.3, phase: 0.8, face: 'stern', fx: { rune: 0.3, runeB: 0.3, extra: both(crossMark(0.25, X_SIZE, X_AHEAD, { ...XO, flash: 0 }), quake(1, [X_AHEAD - 6, 0, 0], 80)) } }),
  settle(CHOP, 0.45, { wind: 0.3, lift: 0.25, phase: 0.9, face: 'stern' }),
  settle(CHOP, 0.72, { wind: 0.25, lift: 0.15, phase: 1, face: 'smirk' }),
  settle(CHOP, 0.92, { wind: 0.22, lift: 0.05, phase: 1.1, face: 'smirk' }),
];

// ── Cataclysm Blades ─────────────────────────────────────────────────────────────────────────

/** Gathering: arms spread low and wide, both blades pointing out and down, rising as the wind lifts her. */
const gather = (k: number, phase: number): ChibiPose =>
  pose(S, {
    x: 0,
    y: lerp(9, 4, k),
    lean: lerp(14, 2, k),
    twist: 0,
    turn: lerp(0, -30, k),
    head: lerp(6, -4, k),
    look: 0,
    footF: [10, 0, 6.5],
    footB: [-10, 0, 6],
    handF: [4, lerp(14, 10, k), 14],
    weapon: lerp(150, 120, k),
    roll: 0,
    yaw: 60,
    handB: [4, lerp(14, 10, k), 14],
    weaponB: lerp(150, 120, k),
    rollB: 0,
    yawB: 60,
    face: k > 0.6 ? 'shout' : 'grit',
    wind: 0.2 + k * 0.3,
    lift: 0.3 + k * 0.7,
    flare: k * 0.6,
    phase,
    fx: { rune: 0.5 + k * 0.5, runeB: 0.5 + k * 0.5, aura: 0.2 + k * 0.4, extra: vortex(0.4 + k * 0.6, phase * 1.6, { r0: 22 + k * 12, r1: 40 + k * 42, top: 70 + k * 42, n: k > 0.5 ? 5 : 4, thick: 5 + k, ground: k }) },
  });

/** The ruinous spin: frame i, both blades out level inside the full whirlwind, slash marks everywhere. */
const ULT_TURNS = [75, 185, 295, 405, 515, 625];
const ruin = (i: number): ChibiPose => {
  const turn = ULT_TURNS[i] as number;
  return pose(whirl(i % 8), {
    y: 3,
    turn,
    lean: 2,
    lift: 0.8,
    phase: 0.4 + i * 0.1,
    fx: { rune: 1, runeB: 1, aura: 0.35, extra: both(vortex(1, 0.7 + i * 0.13, { r0: 34, r1: 82, top: 112, n: 5, thick: 6, ground: 1 }), tipTrails(turn + 90, 140, 1, 40, 48), slashes(1, i * 13, 5, 64)) },
  });
};

/** The final pose: both blades swept out low to either side, crouched wide, the coat-tails flaring, as the wind dies. */
const SWEPT: ChibiPose = pose(S, { x: 2, y: 12, lean: 14, twist: 0, turn: 735, head: 2, look: -4, footF: [12, 0, 8], footB: [-11, 0, 7.5], handF: [4, 13, 15], weapon: 118, roll: 0, yaw: 78, handB: [4, 13, 15], weaponB: 118, rollB: 0, yawB: 78, face: 'shout', wind: 0.4, lift: 0.6, flare: 0.9 });

const ult: ChibiPose[] = [
  gather(0, 0),
  gather(0.35, 0.1),
  gather(0.7, 0.2),
  gather(1, 0.3),
  ruin(0),
  ruin(1),
  ruin(2),
  ruin(3),
  ruin(4),
  ruin(5),
  pose(SWEPT, { phase: 1, fx: { rune: 1, runeB: 1, aura: 0.6, impact: 1.3, impactAt: [0, 30, 0], shock: 0.1, shockAt: [0, 0, 0], dust: 1, extra: both(vortex(0.7, 1.5, { r0: 40, r1: 82, top: 104, n: 5, thick: 5, ground: 0.8 }), slashes(0.75, 91, 5, 60)) } }),
  pose(SWEPT, { y: 12.5, phase: 1.1, wind: 0.35, lift: 0.4, flare: 0.7, face: 'grit', fx: { rune: 0.8, runeB: 0.8, aura: 0.3, shock: 0.5, shockAt: [0, 0, 0], dust: 0.5, extra: both(vortex(0.35, 1.63, { r0: 46, r1: 88, top: 90, n: 4, thick: 4, ground: 0.5 }), slashes(0.35, 91, 5, 60)) } }),
  // Held wide as the ring on the floor fades and the coat-tails settle.
  pose(SWEPT, { y: 12.5, phase: 1.2, wind: 0.25, lift: 0.2, flare: 0.45, face: 'stern', fx: { rune: 0.5, runeB: 0.5, shock: 0.85, shockAt: [0, 0, 0] } }),
  settle(SWEPT, 0.75, { turn: 720, wind: 0.22, lift: 0.08, phase: 1.3, face: 'smirk' }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** The blades crossed before her chest, angled forward, crossing under her chin so her eyes show over them, the tips out past either side of her face. */
const CROSSED: ChibiPose = pose(S, { x: 0, y: 4, lean: 2, twist: 0, head: 0, look: 0, footF: [9, 0, 6.5], footB: [-9, 0, 6], handF: [11, 14, -1], weapon: 30, roll: -30, yaw: 0, handB: [11, 14, -1], weaponB: 30, rollB: -30, yawB: 0, face: 'grit', wind: 0.2 });

const cast: ChibiPose[] = [
  fromReady(pose(CROSSED, { y: 5, handF: [10, 12, 4], weapon: 50, roll: 0, handB: [10, 12, 4], weaponB: 50, rollB: 0, fx: { rune: 0.5, runeB: 0.5 } }), 0.6),
  pose(CROSSED, { phase: 0.1, fx: { rune: 0.9, runeB: 0.9, aura: 0.5, circle: 0.3 } }),
  // The flare: crimson light climbing her body from the sigil, brightest on the middle frame.
  pose(CROSSED, { y: 3, lean: -2, head: -2, phase: 0.2, lift: 0.8, wind: 0.3, face: 'shout', fx: { rune: 1, runeB: 1, aura: 0.8, glow: 0.4, circle: 0.7, motes: { k: 0.8, rise: 0 }, extra: both(flare(0.6, 0), risers(0.75, 0.05)) } }),
  pose(CROSSED, { y: 3, lean: -3, head: -3, phase: 0.3, lift: 0.9, wind: 0.3, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, glow: 0.6, circle: 1, motes: { k: 1, rise: 0.25 }, extra: both(flare(1, 0.3), risers(1, 0.35)) } }),
  pose(CROSSED, { y: 3.5, lean: -1, head: -1, phase: 0.4, lift: 0.7, wind: 0.25, face: 'grit', fx: { rune: 0.8, runeB: 0.8, aura: 0.6, circle: 0.8, motes: { k: 0.8, rise: 0.5 }, extra: both(flare(0.5, 0.6), risers(0.6, 0.65)) } }),
  // Lowered: the blades swung apart and down.
  pose(S, { y: 5, lean: 8, twist: 0, head: 1, footF: [10, 0, 6], footB: [-10, 0, 5.5], handF: [8, 12, 11], weapon: 110, roll: 0, yaw: 40, handB: [8, 12, 11], weaponB: 110, rollB: 0, yawB: 40, face: 'stern', wind: 0.3, lift: 0.4, phase: 0.55, fx: { rune: 0.5, runeB: 0.5, aura: 0.3, circle: 0.4, motes: { k: 0.5, rise: 0.75 }, extra: both(cut('main', { from: 30, roll: -30, yaw: 0 }, 0.4, 0.5), cut('off', { from: 30, roll: -30, yaw: 0 }, 0.4, 0.5)) } }),
  settle(pose(S, { y: 5, lean: 10, handF: [9, 12, 10], weapon: 100, yaw: 34, handB: [9, 9, 9], weaponB: 70, yawB: 10 }), 0.55, { wind: 0.25, lift: 0.2, phase: 0.7, face: 'smirk', fx: { circle: 0.15 } }),
  settle(S, 0.9, { phase: 0.85, face: 'smirk' }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
