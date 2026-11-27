/**
 * The Blademaster's skills, in the chibi pose format (rig.ts, ChibiPose), with effects of her own
 * painted through `fx.extra` (moves-core.ts has the shared ones: the crimson splash and X, the
 * violet-blue whirlwind). Wind-up frames come first: Executioner's and Cataclysm Blades' stretch
 * over the server's wind-up (0.4 and 0.6 s), the others take 0.06 s each, and the rest share the
 * clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special   7  (1 wind-up) Rising Slash: dropped into a deep crouch with both sabres low
 *                behind her, then both ripped up through the foe in a rising crimson arc as she
 *                springs off the floor, a splash of sparks at the top, and a light landing
 *   q        10  (1 wind-up) Whirlwind: coiled to her left, then two full turns with both arms
 *                flung out and the blades level, inside a violet-blue vortex with crimson streaks
 *                whipping round in it and crimson trails behind both blade tips, then she slows into
 *                her stance as the wind dies
 *   e         8  (1 wind-up) Blademaster's Lunge: a coil, then a long, low lunge, both blades
 *                trailing back like wings, crimson afterimages and speed lines behind her; at the
 *                end both blades whip forward in a scissor as she skids to a stop, boots ploughing
 *                the floor. The server moves her, so it plays in place.
 *   r        10  (3 wind-up) Executioner: both blades raised high and crossed over her head,
 *                drawn up on her toes, a crimson glow gathering where they cross (the wind-up), then
 *                both brought down at once: a great crimson X cut into the air, a splash of sparks
 *                and a shock on the floor
 *   ult      14  (4 wind-up) Cataclysm Blades: arms spread low with the blades pointing out, she
 *                gathers a huge violet-blue whirlwind that lifts her coat and hair (the wind-up),
 *                then a ruinous spin inside it, crimson slash marks cut everywhere round her, and a
 *                final pose with both blades swept out low as a shock rolls out and the wind dies
 *   cast      8  (2 wind-up) role skills (Bloodrush, Second Wind) and the Elixir: the blades
 *                crossed before her, tips up past her face, a crimson flare pouring up her body
 *                and motes rising, then the blades lowered back into her stance
 *
 * The poses build on the battle stance (moves-core.ts READY); each clip starts from it
 * (`fromReady`) and its last frames ease back into it (`settle`), so the loop takes over smoothly.
 */
import type { RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { DUST, DUST_DARK, glowLine, puff } from '../fx.js';
import { type ChibiPose, type FxContext, lerp, pose, type V3 } from '../rig.js';
import { BLOOD, both, crossMark, fromReady, mixRGB, READY, settle, smear, smearB, splash, tipTrails, vortex } from './moves-core.js';

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
 * Crimson slash marks cut in the air all round her (Cataclysm Blades): `n` short curved strokes at
 * scattered places within `radius` of her, each white-hot along its middle, crimson, with a pale
 * fringe, thick in the middle and pointed at both ends; `k` their strength (they thin as it falls),
 * `seed` scatters them anew (change it every frame). Strokes behind her pass behind her; none
 * crosses her face.
 */
const slashes =
  (k: number, seed: number, n = 7, radius = 46) =>
  (x: FxContext): void => {
    const { c, rig, aura, hash } = x;
    const head = x.proj(rig.head.o);
    const zc = x.depth(rig.pelvis.o);
    for (let i = 0; i < n; i++) {
      const th = hash(i, 171 + seed) * Math.PI * 2;
      const rr = radius * (0.45 + 0.55 * hash(i, 172 + seed));
      const p3: V3 = [rig.pelvis.o[0] + Math.cos(th) * rr, 8 + hash(i, 173 + seed) * 58, rig.pelvis.o[2] + Math.sin(th) * rr];
      const C = x.proj(p3);
      if (Math.hypot(C[0] - head[0], C[1] - head[1]) < 16) continue;
      const under = x.depth(p3) < zc;
      const ang = hash(i, 174 + seed) * Math.PI;
      const len = (16 + hash(i, 175 + seed) * 12) * (0.7 + 0.3 * k);
      const bend = (hash(i, 176 + seed) - 0.5) * 6;
      const d: Vec = [Math.cos(ang), Math.sin(ang)];
      const nrm: Vec = [-d[1], d[0]];
      const steps = Math.ceil(len);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps - 0.5;
        const w = (0.8 + 1.2 * k) * Math.pow(Math.cos(Math.PI * t), 0.8);
        const off = bend * (1 - 4 * t * t);
        const px = C[0] + d[0] * t * len + nrm[0] * off;
        const py = C[1] + d[1] * t * len + nrm[1] * off;
        for (let o = -Math.ceil(w + 1); o <= Math.ceil(w + 1); o++) {
          const a = Math.abs(o);
          const col: RGB = a <= w * 0.4 ? aura.hot : a <= w ? aura.core : o > 0 ? BLOOD : aura.edge;
          const al = a <= w ? 1 : 0.5;
          c.glow(Math.round(px + nrm[0] * o), Math.round(py + nrm[1] * o), col, al * Math.min(1, k * 1.3), under);
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
  smear(RS_CROUCH, smearB(RS_CROUCH, pose(RS_HOP, { fx: { ...RS_HOP.fx, extra: both(splash(0, undefined, 7), splash(0, 'off', 8)) } }), 0.55), 0.55),
  smear(RS_CROUCH, smearB(RS_CROUCH, pose(RS_HOP, { y: -12, footF: [9, -19, 5.4], footB: [-4, -15, 5], handF: [-2, -9, 12], handB: [-2, -9, 12], weapon: -14, weaponB: -14, lift: 1, phase: 0.35, face: 'grit', fx: { rune: 0.8, runeB: 0.8, extra: both(splash(0.6, undefined, 7), splash(0.6, 'off', 8)) } }), 0.45, 0.35), 0.45, 0.35),
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
    fx: { rune: 1, runeB: 1, extra: both(vortex(k, i * 0.13, { r0: 24, r1: 46, top: 80, streaks: k }), tipTrails(turn + 90, 120 * k, 1, 38, 48)) },
  });
}

const q: ChibiPose[] = [
  // Wind-up: coiled to her left, the right blade drawn across her body, the left back behind her.
  fromReady(pose(S, { y: 8, lean: 10, twist: -26, turn: -40, head: 3, look: 14, footF: [9, 0, 6], footB: [-9, 0, 5.6], handF: [9, 11, -3], weapon: 90, roll: 0, yaw: -64, handB: [-2, 11, 11], weaponB: 110, rollB: 0, yawB: -30, face: 'grit', wind: 0.3, sway: -0.4, fx: { rune: 0.7, runeB: 0.7, extra: vortex(0.25, 0, { r0: 20, r1: 34, top: 60 }) } }), 0.7),
  whirl(0, 0.7),
  whirl(1),
  whirl(2),
  whirl(3),
  whirl(4),
  whirl(5),
  whirl(6),
  // Slowing as the wind dies.
  pose(whirl(7, 0.5), { lean: 8, y: 6, face: 'grit', fx: { rune: 0.6, runeB: 0.6, extra: both(vortex(0.45, 7 * 0.13, { r0: 26, r1: 50, top: 76 }), tipTrails(670 + 90, 90, 0.6, 38, 48)) } }),
  settle(pose(S, { y: 6, lean: 10, turn: 720, flare: 0.4 }), 0.7, { turn: 720, flare: 0.4, wind: 0.3, lift: 0.2, phase: 1.1, face: 'smirk', fx: { extra: vortex(0.15, 8 * 0.13, { r0: 30, r1: 56, top: 70 }) } }),
];

// ── Blademaster's Lunge ──────────────────────────────────────────────────────────────────────

/** The lunge: long and low, the lead leg far ahead, both blades trailing back like wings. */
const LUNGE: ChibiPose = pose(S, { x: 14, y: 13, lean: 42, twist: 6, head: -18, look: -4, footF: [30, 0, 5.6], footB: [-15, -2, 5], handF: [-8, 13, 10], weapon: -100, roll: 0, yaw: -40, handB: [-8, 13, 10], weaponB: -100, rollB: 0, yawB: -40, face: 'shout', wind: 1.2, lift: 0.1 });
/** The stop: both blades whipped forward in a scissor as her boots skid. */
const STOP: ChibiPose = pose(S, { x: 14, y: 13, lean: 18, twist: -6, head: 0, look: -2, footF: [28, 0, 6], footB: [0, 0, 5.4], handF: [14, 13, 4], weapon: 118, roll: 30, yaw: 0, handB: [14, 11, 4], weaponB: 104, rollB: 30, yawB: 0, face: 'shout', wind: 0.3, lift: 0.5, sway: 0.3, phase: 0.6 });

const e: ChibiPose[] = [
  // Coiled low, both blades swept back behind her.
  fromReady(pose(S, { x: -3, y: 13, lean: 26, twist: 10, head: -2, footF: [8, 0, 5.6], footB: [-15, 0, 5.2], handF: [-4, 15, 10], weapon: -116, roll: 0, yaw: -30, handB: [-4, 15, 10], weaponB: -116, rollB: 0, yawB: -30, face: 'grit', wind: 0.3, fx: { rune: 0.6, runeB: 0.6, aura: 0.4, dust: 0.4 } }), 0.75),
  // Launch: the back leg drives off the floor.
  pose(LUNGE, { x: 8, y: 9, lean: 38, footF: [20, -5, 5.6], footB: [-20, 0, 5], phase: 0.1, fx: { rune: 1, runeB: 1, dust: 1, speed: 0.8, ghosts: { k: 0.6 } } }),
  pose(LUNGE, { phase: 0.25, fx: { rune: 1, runeB: 1, speed: 1, ghosts: { k: 1, n: 3, gap: 12 } } }),
  pose(LUNGE, { x: 15, y: 12, footF: [31, 0, 5.6], footB: [-13, -4, 5], phase: 0.4, fx: { rune: 1, runeB: 1, speed: 1, dust: 0.6, ghosts: { k: 0.9, n: 3, gap: 12 } } }),
  // The stop: both blades whipped forward, boots ploughing the floor.
  smear(LUNGE, smearB(LUNGE, pose(STOP, { fx: { rune: 1, runeB: 1, dust: 1, ghosts: { k: 0.4 }, extra: both(skid(1), splash(0, undefined, 9)) } }), 0.42, 0.8), 0.42, 0.8),
  smear(LUNGE, smearB(LUNGE, pose(STOP, { y: 12, lean: 16, handF: [13, 14, 3], weapon: 124, weaponB: 110, wind: 0.15, lift: 0.4, phase: 0.75, face: 'grit', fx: { rune: 0.6, runeB: 0.6, dust: 0.6, extra: both(skid(0.6), splash(0.6, undefined, 9)) } }), 0.36, 0.3), 0.36, 0.3),
  settle(pose(STOP, { x: 10, y: 9 }), 0.5, { wind: 0.2, lift: 0.3, phase: 0.9, face: 'smirk', fx: { dust: 0.3, extra: skid(0.3) } }),
  settle(pose(STOP, { x: 4, y: 7 }), 0.88, { wind: 0.22, lift: 0.08, phase: 1, face: 'smirk' }),
];

// ── Executioner ──────────────────────────────────────────────────────────────────────────────

/** Both blades raised high and crossed over her head, up on her toes. */
const RAISED: ChibiPose = pose(S, { x: -1, y: 2, lean: -8, twist: 0, head: -6, look: 0, footF: [11, -1, 5.6], footB: [-10, 0, 5.2], handF: [-3, -11, 12], weapon: -2, roll: -32, yaw: 0, handB: [-3, -11, 12], weaponB: -2, rollB: -32, yawB: 0, face: 'grit', wind: 0.3, lift: 0.5 });
/** Brought down: both blades crossing low in front of her. */
const CHOP: ChibiPose = pose(S, { x: 7, y: 12, lean: 30, twist: 0, head: 4, look: -2, footF: [17, 0, 6], footB: [-12, 0, 5.4], handF: [13, 15, 2], weapon: 136, roll: 40, yaw: 0, handB: [13, 15, 2], weaponB: 136, rollB: 40, yawB: 0, face: 'shout', wind: 0.9, lift: -0.1 });
/** Where the X hangs: ahead of her at chest height. */
const X_AHEAD = 30;

const r: ChibiPose[] = [
  // Wind-up: the blades swept up from her stance...
  fromReady(pose(S, { y: 4, lean: 2, twist: 0, head: -2, handF: [6, 3, 11], weapon: 20, roll: -10, yaw: 0, handB: [6, 3, 11], weaponB: 20, rollB: -10, yawB: 0, face: 'grit', wind: 0.25, fx: { rune: 0.6, runeB: 0.6 } }), 0.65),
  // ...raised and crossed over her head, a gleam where they cross...
  pose(RAISED, { phase: 0.1, fx: { rune: 0.9, runeB: 0.9, aura: 0.5, extra: crossGleam(0.5) } }),
  // ...and held, drawn up on her toes, the gleam and the aura gathering.
  pose(RAISED, { y: 1, lean: -10, head: -8, footF: [11, -2, 5.6], handF: [-3, -12, 12], handB: [-3, -12, 12], weapon: -4, weaponB: -4, lift: 0.7, phase: 0.2, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, extra: crossGleam(1) } }),
  // The chop: both at once, a great crimson X.
  smear(RAISED, smearB(RAISED, pose(CHOP, { phase: 0.35, fx: { rune: 1, runeB: 1, dust: 1, impact: 1.2, impactAt: [X_AHEAD, 22, 0], shock: 0.06, shockAt: [X_AHEAD, 0, 0], extra: both(crossMark(1, 52, X_AHEAD), splash(0, [X_AHEAD, 24, 0], 11)) } }), 0.6), 0.6),
  smear(RAISED, smearB(RAISED, pose(CHOP, { y: 13, lean: 32, handF: [12, 16, 3], weapon: 140, handB: [12, 16, 3], weaponB: 140, wind: 0.7, lift: 0.2, phase: 0.5, face: 'grit', fx: { rune: 0.8, runeB: 0.8, dust: 0.6, shock: 0.4, shockAt: [X_AHEAD, 0, 0], extra: both(crossMark(0.75, 52, X_AHEAD), splash(0.6, [X_AHEAD, 24, 0], 11)) } }), 0.5, 0.35), 0.5, 0.35),
  pose(CHOP, { y: 12.5, lean: 30, handF: [12, 15, 3], weapon: 138, handB: [12, 15, 3], weaponB: 138, wind: 0.4, lift: 0.3, phase: 0.65, face: 'grit', fx: { rune: 0.5, runeB: 0.5, shock: 0.7, shockAt: [X_AHEAD, 0, 0], extra: both(crossMark(0.45, 52, X_AHEAD), splash(1, [X_AHEAD, 24, 0], 11)) } }),
  pose(CHOP, { y: 12, lean: 28, handF: [12, 14, 4], weapon: 132, handB: [12, 14, 4], weaponB: 128, wind: 0.3, lift: 0.3, phase: 0.8, face: 'stern', fx: { rune: 0.3, runeB: 0.3, shock: 0.9, shockAt: [X_AHEAD, 0, 0], extra: crossMark(0.2, 52, X_AHEAD) } }),
  settle(CHOP, 0.4, { wind: 0.3, lift: 0.25, phase: 0.9, face: 'stern' }),
  settle(CHOP, 0.7, { wind: 0.25, lift: 0.15, phase: 1, face: 'smirk' }),
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
    fx: { rune: 0.5 + k * 0.5, runeB: 0.5 + k * 0.5, aura: 0.2 + k * 0.4, extra: vortex(0.3 + k * 0.7, phase * 1.6, { r0: 22 + k * 6, r1: 36 + k * 16, top: 64 + k * 26, n: 6, streaks: k * 0.6 }) },
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
    fx: { rune: 1, runeB: 1, aura: 0.35, extra: both(vortex(1, 0.7 + i * 0.13, { r0: 28, r1: 56, top: 94, n: 6, streaks: 1 }), tipTrails(turn + 90, 140, 1, 40, 48), slashes(1, i * 13)) },
  });
};

/** The final pose: both blades swept out low to either side, crouched, as the wind dies. */
const SWEPT: ChibiPose = pose(S, { x: 2, y: 11, lean: 18, twist: 0, turn: 720, head: 2, look: -2, footF: [12, 0, 6.5], footB: [-11, 0, 6], handF: [5, 12, 14], weapon: 124, roll: 0, yaw: 64, handB: [5, 12, 14], weaponB: 124, rollB: 0, yawB: 64, face: 'shout', wind: 0.6, lift: 0.5, flare: 0.5 });

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
  pose(SWEPT, { phase: 1, fx: { rune: 1, runeB: 1, aura: 0.6, impact: 1.3, impactAt: [0, 30, 0], shock: 0.1, shockAt: [0, 0, 0], dust: 1, extra: both(vortex(0.6, 1.5, { r0: 34, r1: 60, top: 84, n: 6, streaks: 0.5 }), slashes(0.7, 91)) } }),
  pose(SWEPT, { y: 11.5, phase: 1.1, wind: 0.4, lift: 0.3, face: 'grit', fx: { rune: 0.7, runeB: 0.7, aura: 0.3, shock: 0.55, shockAt: [0, 0, 0], dust: 0.5, extra: both(vortex(0.3, 1.63, { r0: 40, r1: 66, top: 76 }), slashes(0.35, 91)) } }),
  settle(SWEPT, 0.5, { turn: 720, wind: 0.3, lift: 0.2, phase: 1.2, face: 'stern', fx: { shock: 0.85, shockAt: [0, 0, 0] } }),
  settle(SWEPT, 0.85, { turn: 720, wind: 0.22, lift: 0.08, phase: 1.3, face: 'smirk' }),
];

// ── Cast ─────────────────────────────────────────────────────────────────────────────────────

/** The blades crossed before her, tips up past either side of her face, crossing under her chin. */
const CROSSED: ChibiPose = pose(S, { x: 0, y: 4, lean: 2, twist: 0, head: 2, look: 0, footF: [9, 0, 6.5], footB: [-9, 0, 6], handF: [9, 11, -1], weapon: 12, roll: -26, yaw: 0, handB: [9, 11, -1], weaponB: 12, rollB: -26, yawB: 0, face: 'grit', wind: 0.2 });

const cast: ChibiPose[] = [
  fromReady(pose(CROSSED, { y: 5, handF: [10, 12, 4], weapon: 40, roll: 0, handB: [10, 12, 4], weaponB: 40, rollB: 0, fx: { rune: 0.5, runeB: 0.5 } }), 0.6),
  pose(CROSSED, { phase: 0.1, fx: { rune: 0.9, runeB: 0.9, aura: 0.5, circle: 0.3 } }),
  // The flare: crimson light pouring up her body.
  pose(CROSSED, { y: 3, lean: -2, head: -2, phase: 0.2, lift: 0.8, wind: 0.3, face: 'shout', fx: { rune: 1, runeB: 1, aura: 1, glow: 0.6, circle: 0.7, motes: { k: 1, rise: 0 }, extra: flare(1, 0) } }),
  pose(CROSSED, { y: 3, lean: -3, head: -3, phase: 0.3, lift: 0.9, wind: 0.3, face: 'shout', fx: { rune: 1, runeB: 1, aura: 0.9, glow: 0.4, circle: 1, motes: { k: 1, rise: 0.25 }, extra: flare(1, 0.3) } }),
  pose(CROSSED, { y: 3.5, lean: -1, head: -1, phase: 0.4, lift: 0.7, wind: 0.25, face: 'grit', fx: { rune: 0.8, runeB: 0.8, aura: 0.6, circle: 0.8, motes: { k: 0.8, rise: 0.5 }, extra: flare(0.6, 0.6) } }),
  // Lowered: the blades swung apart and down.
  pose(S, { y: 5, lean: 8, twist: 0, head: 1, footF: [10, 0, 6], footB: [-10, 0, 5.5], handF: [8, 12, 11], weapon: 110, roll: 0, yaw: 40, handB: [8, 12, 11], weaponB: 110, rollB: 0, yawB: 40, face: 'stern', wind: 0.3, lift: 0.4, phase: 0.55, fx: { smear: { from: 12, roll: -26, yaw: 0, width: 0.5, alpha: 0.5 }, smearB: { from: 12, roll: -26, yaw: 0, width: 0.5, alpha: 0.5 }, rune: 0.5, runeB: 0.5, aura: 0.3, circle: 0.4, motes: { k: 0.5, rise: 0.75 } } }),
  settle(pose(S, { y: 5, lean: 10, handF: [9, 12, 10], weapon: 100, yaw: 34, handB: [9, 9, 9], weaponB: 70, yawB: 10 }), 0.55, { wind: 0.25, lift: 0.2, phase: 0.7, face: 'smirk', fx: { circle: 0.15 } }),
  settle(S, 0.9, { phase: 0.85, face: 'smirk' }),
];

/** The skill clips' poses, by clip: each weapon skill's clip is named after its hotbar slot. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
