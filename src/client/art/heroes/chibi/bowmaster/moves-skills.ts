/**
 * The Bowmaster's skills, in the chibi pose format (rig.ts, ChibiPose), with a few effects of
 * their own painted through `fx.extra`. Wind-up frames come first: Charged Shot's stretch over the
 * server's 0.6 s draw; the others have no server wind-up and take 0.06 s each, then the rest share
 * the clip's seconds. A weapon skill's clip is named after its hotbar slot.
 *
 *   special  8  (3 wind-up) Charged Shot: planted wide, a slow full draw while green-gold light
 *               gathers at the arrowhead and her cape lifts; loosed with a huge flash and a long
 *               streak, the recoil rocking her back and throwing the cape out behind her; then
 *               to the quiver and back into the stance
 *   q        9  (2 wind-up) Volley: leaning back, the bow tilted high, three arrows loosed at the
 *               sky one after another, each a little steeper, their streaks climbing out of the
 *               frame; the game rains them on her aim
 *   e        7  (2 wind-up) Snare Trap: a crouch, the coiled snare unhooked from her belt and
 *               swung back, then tossed underarm in a long, low arc toward her aim
 *   r        8  (1 wind-up) Fan of Arrows: five arrows on the string, the bow canted flat; loosed
 *               together in a level fan of five streaks
 *   ult     12  (3 wind-up) Rain of Ruin: a crouch gathering violet-black power, a leap, the dark
 *               arrow drawn steeply skyward at the top of it and loosed with a burst of dark
 *               light and a violet streak; she lands in a crouch watching the sky as green
 *               sparks fall, then nocks an arrow of her own again
 *   cast     8  (1 wind-up) role skills (Vault, Field Dressing) and the Elixir: a light backflip,
 *               the bow kept out to her side, landing in a crouch and rising
 *
 * The snare, the fan of arrows and the dark arrow are her design's variants (design.ts), which
 * hero.ts paints these clips with. Each clip's last frames ease into the battle stance with
 * moves-core's `settle`.
 */
import { type Canvas, hex, type RGB } from '../../paint.js';
import type { Vec } from '../../skeleton.js';
import { flash, motes, rays, rim, trail } from '../fx.js';
import { add3, type ChibiPose, cross3, type FxContext, mix, norm3, pose, rad, sub3, type V3 } from '../rig.js';
import { BATTLE0, DRAW_ARROW, FULL_DRAW, fromReady, LOOSED, REACH_QUIVER, READY, settle, withFx } from './moves-core.js';

type Extra = (x: FxContext) => void;

/** Runs several extra painters in turn. */
const both =
  (...fs: Extra[]): Extra =>
  (x) => {
    for (const f of fs) f(x);
  };

/** Turns a direction `deg` degrees toward `side` (both unit, square to each other). */
const swing = (d: V3, side: V3, deg: number): V3 => norm3(add3([d[0] * Math.cos(rad(deg)), d[1] * Math.cos(rad(deg)), d[2] * Math.cos(rad(deg))], side, Math.sin(rad(deg))));

/** The bow's own length, squared to a direction: across the fan its arrows make. */
function across(x: FxContext, d: V3): V3 {
  const n = norm3(cross3(d, x.rig.offhand.u));
  return norm3(cross3(n, d));
}

/**
 * Streaks of shots already loosed, from the bow along its aim turned `deg` degrees across the bow
 * (in its plane), each `k` strong and `len` long: the flurry of Volley and the fan of five.
 */
const streaks =
  (shots: readonly { deg: number; k: number; len?: number }[]): Extra =>
  (x) => {
    const side = across(x, x.dirB);
    for (const s of shots) trail(x, x.tipB, swing(x.dirB, side, s.deg), s.k, { len: s.len });
  };

// ── Charged Shot ─────────────────────────────────────────────────────────────────────────────

/** Her charged light: a verdant green core, a pale gold edge, a white heart. */
const CHARGED = { core: hex('#9ef08a'), edge: hex('#ffe27a'), hot: hex('#f6ffe0') };
const WHITE: RGB = [255, 255, 255];

/** A round glow on screen: white at its heart, then green, a pale gold ring, a soft green halo. */
function orb(c: Canvas, P: Vec, R: number, k: number, under: boolean): void {
  const n = Math.ceil(R);
  for (let dy = -n; dy <= n; dy++) {
    for (let dx = -n; dx <= n; dx++) {
      const d = Math.hypot(dx, dy) / R;
      if (d > 1) continue;
      const [col, a] = d < 0.28 ? [WHITE, 1] : d < 0.5 ? [CHARGED.core, 0.95] : d < 0.68 ? [CHARGED.edge, 0.8] : [CHARGED.core, 0.55 * (1 - d) / 0.32];
      c.glow(P[0] + dx, P[1] + dy, col as RGB, (a as number) * Math.min(1, k), under);
    }
  }
}

/**
 * Light gathering at the arrowhead, `k` (0 to 1) how far it has grown: a ball of green light with
 * a pale gold ring and a white heart, and green-gold rays wheeling round it (`spin` degrees). Seen
 * from behind, the arrowhead is on the far side of her: the light spreads out behind her, past
 * her outline beside the hood and the shoulder.
 */
const gather =
  (k: number, spin: number): Extra =>
  (x) => {
    const back = x.cam.view === 'back';
    rays({ ...x, aura: CHARGED }, x.tipB, k, { n: 10, len: (back ? 26 : 12) + 16 * k, spin, behind: back });
    orb(x.c, x.proj(x.tipB), back ? 9 + 11 * k : 2.5 + 4.5 * k, 0.4 + 0.6 * k, back);
  };

/** Which way a shot runs on screen, opened out down the screen (toward the viewer) or up it (away) when it runs nearly end on. */
function seen(x: FxContext, at: V3, dir: V3): Vec {
  const v = x.cam.vec(dir);
  const l = Math.hypot(v[0], v[1]);
  if (l >= 0.6) return [v[0] / l, v[1] / l];
  const toward = x.depth(add3(at, dir)) >= x.depth(at) ? 1 : -1;
  const w = l / 0.6;
  const d: Vec = l > 1e-3 ? [(v[0] / l) * w, (v[1] / l) * w + toward * (1 - w)] : [0, toward];
  const dl = Math.hypot(d[0], d[1]) || 1;
  return [d[0] / dl, d[1] / dl];
}

/**
 * The Charged Shot's streak: a broad beam from the bow along the shot, `len` long and `half` its
 * half-width, white down its middle, verdant green, a pale gold edge, brightest at its far end
 * where the arrow now is, with sparks shed beside it; `k` its strength. With `ring`, a shock ring
 * round the shot at the bow, that size.
 */
const beam =
  (k: number, len: number, half: number, ring = 0): Extra =>
  (x) => {
    const { c } = x;
    const at = x.tipB;
    const dir = x.dirB;
    const A = x.proj(at);
    const d = seen(x, at, dir);
    const L = len * Math.max(0.6, Math.hypot(...x.cam.vec(dir)));
    const B: Vec = [A[0] + d[0] * L, A[1] + d[1] * L];
    const under = (t: number): boolean => x.behind(add3(at, dir, len * t));
    const x0 = Math.floor(Math.min(A[0], B[0]) - half - 2);
    const x1 = Math.ceil(Math.max(A[0], B[0]) + half + 2);
    const y0 = Math.floor(Math.min(A[1], B[1]) - half - 2);
    const y1 = Math.ceil(Math.max(A[1], B[1]) + half + 2);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const rx = px + 0.5 - A[0];
        const ry = py + 0.5 - A[1];
        const t = (rx * d[0] + ry * d[1]) / L;
        if (t < 0 || t > 1) continue;
        const r = Math.abs(rx * -d[1] + ry * d[0]);
        // Narrowing to a point at the near end, full width from a fifth of the way on.
        const w = half * Math.min(1, 0.35 + t * 3.2);
        if (r > w + 0.5) continue;
        const a = k * (0.25 + 0.75 * Math.pow(t, 0.8));
        const u = under(t);
        if (r < w * 0.34) c.glow(px, py, WHITE, Math.min(1, a * 1.1), u);
        else if (r < w * 0.72) c.glow(px, py, CHARGED.core, Math.min(1, a), u);
        else c.glow(px, py, CHARGED.edge, Math.min(1, a * 0.85), u);
      }
    }
    for (let i = 0; i < 10; i++) {
      const t = 0.15 + 0.85 * x.hash(i, 141);
      const side = (x.hash(i, 142) - 0.5) * (half * 2 + 8);
      c.glow(A[0] + (B[0] - A[0]) * t - d[1] * side, A[1] + (B[1] - A[1]) * t + d[0] * side, i % 2 ? CHARGED.edge : CHARGED.core, k * 0.8, under(t));
    }
    if (ring > 0) {
      // The shock ring round the shot, just ahead of the bow.
      const ref: V3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const e1 = norm3(cross3(dir, ref));
      const e2 = cross3(dir, e1);
      for (const [R, col, a] of [[ring, CHARGED.edge, 0.9], [ring * 0.7, CHARGED.core, 0.7]] as [number, RGB, number][]) {
        for (let i = 0; i < 40; i++) {
          const th = (i / 40) * Math.PI * 2;
          const p3 = add3(add3(add3(at, dir, 2), e1, Math.cos(th) * R), e2, Math.sin(th) * R);
          const p = x.proj(p3);
          c.glow(p[0], p[1], col, a * Math.min(1, k), x.behind(p3));
        }
      }
    }
  };

/** Planted wide and low, the bow arm out straight, drawing slowly to the cheek. */
const CHARGE = pose(FULL_DRAW, { y: 5, lean: 3, twist: 28, head: 1, look: -12, footF: [11, 0, 5.6], footB: [-12, 0, 5], handF: [0, 1.5, 0.5], handB: [17, -1.5, 1], face: 'grit', wind: 0.3, lift: 0.25 });
const C_LOOSE = pose(LOOSED, { x: -3, y: 5, lean: -6, twist: 26, head: -4, look: -12, footF: [11, 0, 5.6], footB: [-12, 0, 5], handF: [-4, -1, 4], handB: [17, -2, 1], wind: 0.95, lift: 0.35, flare: 0.2, phase: 0.4 });

const special: ChibiPose[] = [
  // The draw begins: the bow up, an arrow nocked, half drawn.
  fromReady(pose(CHARGE, { draw: 0.45, handF: [7, 3, 0], elbowF: [-1, 0, 0.6], wind: 0.25, lift: 0.1, phase: 0.05, face: 'stern', fx: { runeB: 0.25, extra: gather(0.25, 0) } }), 0.6),
  // Drawn on, light gathering at the arrowhead.
  pose(CHARGE, { draw: 0.8, handF: [3, 2, 0.5], phase: 0.15, fx: { runeB: 0.6, aura: 0.15, extra: gather(0.6, 10) } }),
  // Full draw: the arrowhead ablaze, rays wheeling round it, the cape lifting.
  pose(CHARGE, { draw: 1, lift: 0.45, phase: 0.25, fx: { runeB: 1, aura: 0.45, extra: gather(1, 24) } }),
  // Loosed: a huge flash, a broad beam and a shock ring, the recoil rocking her back, the cape flung out.
  withFx(C_LOOSE, { flash: { k: 1.5 }, aura: 0.3, dust: 0.5, extra: beam(1.2, 100, 3.4, 7) }),
  withFx(pose(C_LOOSE, { x: -4, lean: -4, handF: [-5, 0, 5], wind: 0.7, lift: 0.4, phase: 0.55, face: 'stern' }), { dust: 0.3, extra: beam(0.8, 114, 2, 9) }),
  // The bow arm held out as the beam thins away, the right hand already at the quiver.
  withFx(pose(C_LOOSE, { x: -3, lean: -2, ...REACH_QUIVER, wind: 0.45, lift: 0.25, phase: 0.7, face: 'stern' }), { extra: beam(0.4, 124, 1.2) }),
  pose(mix(C_LOOSE, BATTLE0, 0.6), { ...DRAW_ARROW, wind: 0.3, lift: 0.1, phase: 0.85, face: 'stern' }),
  settle(C_LOOSE, 0.88, { handF: [7, 7, 0], weapon: 90, drop: true, nock: true, draw: 0.1, phase: 1, face: 'stern' }),
];

// ── Volley ──────────────────────────────────────────────────────────────────────────────────

/**
 * Leaning back, the bow raised ahead of her brow and laid back nearly square to a steep shot, its
 * upper limb canted toward her right (the viewer's side, side on) so it passes over the top front
 * of her hood rather than behind it, and clears the hood above her right shoulder from behind; an
 * arrow drawn to her cheek. `k` (0 to 2) raises the bow hand for each steeper shot.
 */
const sky = (k: number, over: Partial<ChibiPose> = {}): ChibiPose =>
  pose(FULL_DRAW, { y: 4, lean: -6, twist: 16, head: -6, look: -6, footF: [9, 0, 5.4], footB: [-10, 0, 5], handF: [2, 0.5, 2], elbowF: [-1, 0.2, 0.7], handB: [10 - k, -14 - k, 4], weaponB: -30 - 3 * k, rollB: -30, yawB: 0, draw: 1, nock: true, wind: 0.3, lift: 0.2, ...over });
/** Loosed: the fingers open where they drew, the string snapped forward, the bow held where it was. */
const skyLoose = (k: number, phase: number): ChibiPose => sky(k, { handF: [0.6, 2.4, 3.2], draw: 0, nock: false, wind: 0.45, lift: 0.3, phase, face: 'shout' });
const skyDraw = (k: number, phase: number): ChibiPose => sky(k, { draw: 0.9, phase });

/**
 * The way a Volley arrow flies: from her drawing hand at the cheek through the bow's grip (the
 * pose keeps both where the last arrow was drawn), steeply up and ahead.
 */
const skyDir = (x: FxContext): V3 => {
  const hand = add3(x.rig.neck, [2, -0.5, 2], 1);
  return norm3(sub3(x.rig.offhand.o, hand));
};

/**
 * Volley's shots, painted on their own along the line the arrow was drawn on: a flash at the bow
 * (`flashK`, 0 for none) and a little fan of streaks (`fan`: degrees across the bow, strength,
 * length), so each release reads as a flurry of arrows climbing away. Side on they leave just
 * ahead of the grip; toward and away from the viewer the grip is in front of her face or hidden
 * behind her hood, so they show from where the arrows clear the hood.
 */
const volley =
  (flashK: number, fan: readonly { deg: number; k: number; len: number }[]): Extra =>
  (x) => {
    const d = skyDir(x);
    const at = add3(x.rig.offhand.o, d, x.cam.view === 'side' ? 3 : 18);
    const side = norm3(cross3(d, [0, 0, 1]));
    for (const f of fan) trail(x, at, swing(d, side, f.deg), f.k, { len: f.len });
    if (flashK > 0) flash(x, at, d, flashK);
  };
/** A release: three streaks fanned a little, the middle one brightest. */
const RELEASE = (k: number): { deg: number; k: number; len: number }[] => [
  { deg: 0, k, len: 66 },
  { deg: -7, k: k * 0.7, len: 54 },
  { deg: 7, k: k * 0.7, len: 58 },
];
/** The streaks of the last release, fading as they climb. */
const FADING = (k: number): { deg: number; k: number; len: number }[] => [
  { deg: 0, k, len: 90 },
  { deg: -7, k: k * 0.6, len: 80 },
  { deg: 7, k: k * 0.6, len: 84 },
];

const q: ChibiPose[] = [
  fromReady(sky(0, { draw: 0.5, handF: [7, 4, 1], phase: 0.05, face: 'stern' }), 0.6),
  sky(0, { phase: 0.12, face: 'grit', fx: { runeB: 0.4 } }),
  // Three flurries at the sky in quick succession, each a little steeper.
  withFx(skyLoose(0, 0.2), { extra: volley(1.1, RELEASE(1)) }),
  withFx(skyDraw(1, 0.3), { extra: volley(0, FADING(0.5)) }),
  withFx(skyLoose(1, 0.4), { extra: volley(1.1, RELEASE(1)) }),
  withFx(skyDraw(2, 0.5), { extra: volley(0, FADING(0.5)) }),
  withFx(skyLoose(2, 0.6), { extra: volley(1.2, RELEASE(1.1)) }),
  // The bow still raised as the last streaks climb away, the drawing hand dropping.
  withFx(pose(skyLoose(2, 0.75), { handF: [3, 8, 6], elbowF: undefined, lean: -6, head: -8, phase: 0.75, face: 'stern' }), { extra: volley(0, FADING(0.4)) }),
  settle(skyLoose(2, 0.9), 0.92, { phase: 1, face: 'stern' }),
];

// ── Snare Trap ───────────────────────────────────────────────────────────────────────────────

/** Crouched low, the bow held out to her left, the coiled snare in her right hand. */
const CROUCH: ChibiPose = pose(READY, { y: 9, lean: 16, twist: 8, head: 6, look: 0, footF: [10, 0, 5.4], footB: [-10, 0, 5], handB: [9, 12, 7], weaponB: 38, rollB: 30, draw: 0, nock: false, weapon: 180, roll: 0, yaw: 0, drop: false, face: 'stern' });
/** The snare in flight: where its grip is (hero space) and how it tumbles. */
const flying = (at: V3, weapon: number): Partial<ChibiPose> => ({ drop: true, dropAt: at, weapon, roll: 30, yaw: 0 });

const e: ChibiPose[] = [
  // The snare unhooked from her belt.
  fromReady(pose(CROUCH, { handF: [2, 19, 9], elbowF: [-0.6, -1, 0.6], weapon: 175, phase: 0.05 }), 0.6, { drop: false }),
  // Swung back past her hip.
  pose(CROUCH, { y: 10, lean: 18, twist: 20, handF: [-9, 17, 8], weapon: 230, wind: 0.25, phase: 0.15, face: 'grit' }),
  // Tossed underarm: it leaves her hand low and ahead, a streak behind it.
  pose(CROUCH, { y: 8, lean: 12, twist: -10, handF: [12, 11, 4], elbowF: [0.2, -1, 0.6], ...flying([20, 18, 2], 120), wind: 0.45, phase: 0.3, face: 'shout', fx: { trail: { k: 0.5, from: [10, 20, 4], dir: [0.8, -0.1, -0.2], len: 9 } } }),
  // Arcing on toward her aim, the arm following through.
  pose(CROUCH, { y: 6, lean: 8, twist: -12, handF: [12, 5, 5], elbowF: [0.2, -1, 0.6], ...flying([38, 30, 1], 250), wind: 0.4, lift: 0.1, phase: 0.45, face: 'stern', fx: { trail: { k: 0.45, from: [20, 22, 2], dir: norm3([18, 10, -1]), len: 18 } } }),
  pose(CROUCH, { y: 6, lean: 8, twist: -6, handF: [9, 8, 5], ...flying([58, 34, 0], 400), wind: 0.3, lift: 0.15, phase: 0.6, face: 'stern', fx: { trail: { k: 0.35, from: [38, 32, 1], dir: norm3([20, 3, -1]), len: 20 } } }),
  settle(pose(CROUCH, { y: 6, handF: [7, 9, 4], drop: true, dropAt: undefined }), 0.6, { drop: true, dropAt: undefined, nock: true, phase: 0.75 }),
  settle(pose(CROUCH, { y: 6, handF: [7, 9, 4], drop: true }), 0.9, { drop: true, dropAt: undefined, phase: 0.9 }),
];

// ── Fan of Arrows ────────────────────────────────────────────────────────────────────────────

/** Five arrows drawn together, the bow canted flat so they fan out level. */
const FAN_DRAW = pose(FULL_DRAW, { y: 5, lean: 6, twist: 26, head: 2, look: -10, footF: [10, 0, 5.6], footB: [-11, 0, 5], handF: [2, 3, 0.5], handB: [17, 1.5, 1], weaponB: -8, rollB: 78, draw: 1, nock: true, wind: 0.25, phase: 0.1, face: 'grit' });
const FAN_LOOSE = pose(FAN_DRAW, { handF: [-2, 1, 3.5], elbowF: [-1, 0.6, 0.8], draw: 0, nock: false, wind: 0.5, lift: 0.1, phase: 0.2, face: 'shout' });
/** Five streaks: the middle one is the bow's own trail, two either side of it. */
const FAN = [-25, -12.5, 12.5, 25];

const r: ChibiPose[] = [
  withFx(FAN_DRAW, { runeB: 0.5 }),
  withFx(FAN_LOOSE, { flash: { k: 1.2 }, trail: { k: 1, len: 56 }, extra: streaks(FAN.map((deg) => ({ deg, k: 0.95, len: 52 }))) }),
  withFx(pose(FAN_LOOSE, { handF: [-4, 1, 5], wind: 0.4, lift: 0.2, phase: 0.35, face: 'stern' }), { trail: { k: 0.45, len: 70 }, extra: streaks(FAN.map((deg) => ({ deg, k: 0.4, len: 66 }))) }),
  pose(mix(FAN_LOOSE, BATTLE0, 0.35), { ...REACH_QUIVER, wind: 0.3, lift: 0.15, phase: 0.5, face: 'stern' }),
  pose(mix(FAN_LOOSE, BATTLE0, 0.55), { ...DRAW_ARROW, wind: 0.25, phase: 0.62, face: 'stern' }),
  settle(FAN_LOOSE, 0.75, { handF: [7, 7, 0], weapon: 90, drop: true, nock: true, draw: 0.05, phase: 0.75, face: 'stern' }),
  settle(FAN_LOOSE, 0.9, { phase: 0.88, face: 'stern' }),
  settle(FAN_LOOSE, 0.98, { phase: 1, face: 'stern' }),
];

// ── Rain of Ruin ─────────────────────────────────────────────────────────────────────────────

/**
 * The dark arrow drawn steeply up at the sky, the bow raised over her head as for Volley (the
 * Rain of Ruin design sorts it against her hood the same way), its upper limb canted toward the
 * viewer over the top front of the hood.
 */
const UP_DRAW = pose(FULL_DRAW, { lean: -8, twist: 16, head: -8, look: -4, handF: [2, 0.5, 0], elbowF: [-1, 0.2, 0.7], handB: [10, -15, 4], weaponB: -28, rollB: -30, yawB: 0, draw: 1, nock: true, face: 'grit' });
const UP_LOOSE = pose(UP_DRAW, { handF: [0.8, 3, 0.4], elbowF: [-1, 0.6, 0.8], draw: 0, nock: false, face: 'shout' });

/** The ultimate's colours: a deep violet rim fading to black-violet, a violet flare, a green-white heart and green sparks. */
const RUIN = { rim: hex('#4a1a7a'), rimHot: hex('#6a2aa8'), dark: hex('#1a0a2a'), smoke: hex('#2c1048'), violet: hex('#7a34c8'), heart: hex('#e4ffd0'), spark: hex('#9ef08a'), sparkDeep: hex('#4ec860') };

/**
 * Violet-black power wreathing her, `k` strong: a deep violet rim round her outline fading to
 * black-violet, and smoky wisps of black-violet curling up round her (behind her).
 */
const darkAura =
  (k: number, rise: number): Extra =>
  (x) => {
    rim(x.c, RUIN.rim, RUIN.dark, k, RUIN.rimHot);
    const g = x.rig.pelvis.o;
    for (let i = 0; i < 7; i++) {
      const th = x.hash(i, 151) * Math.PI * 2;
      const rr = 11 + x.hash(i, 152) * 6;
      const h0 = 6 + ((x.hash(i, 153) * 56 + rise * 40) % 60);
      let prev: Vec | null = null;
      for (let s = 0; s <= 8; s++) {
        const t = s / 8;
        const p3: V3 = [g[0] + Math.cos(th) * rr + Math.sin(t * 5 + i) * 2.4, h0 + t * 16, g[2] + Math.sin(th) * rr];
        const p = x.proj(p3);
        if (prev) {
          const a = k * 0.8 * Math.sin(Math.PI * t);
          const n = Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]));
          for (let j = 0; j <= n; j++) {
            const q: Vec = [prev[0] + ((p[0] - prev[0]) * j) / n, prev[1] + ((p[1] - prev[1]) * j) / n];
            x.c.glow(q[0], q[1], i % 2 ? RUIN.smoke : RUIN.dark, a, true);
            if (t < 0.6) x.c.glow(q[0] + 1, q[1], RUIN.smoke, a * 0.6, true);
          }
        }
        prev = p;
      }
    }
  };

/** Green sparks drifting round her, `rise` (0 to 1, advanced each frame) lifting them. */
const sparks =
  (k: number, rise: number): Extra =>
  (x) =>
    motes({ ...x, aura: { core: RUIN.sparkDeep, edge: RUIN.dark, hot: RUIN.spark } }, k, { n: 12, rise });

/**
 * The dark arrow ablaze on the string, `k` how far its power has gathered: a small violet glow
 * round its head with a green-white heart, and a few thin violet rays, leaving its black shaft
 * and the face clear.
 */
const darkGather =
  (k: number, spin: number): Extra =>
  (x) => {
    rays({ ...x, aura: { core: RUIN.violet, edge: RUIN.dark, hot: RUIN.heart } }, x.tipB, k * 0.8, { n: 8, len: 10 + 10 * k, spin, behind: x.cam.view === 'back' });
    const P = x.proj(x.tipB);
    const R = 2 + 2.5 * k;
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dy) / R;
        if (d > 1) continue;
        x.c.glow(P[0] + dx, P[1] + dy, d < 0.4 ? RUIN.heart : RUIN.violet, (d < 0.4 ? 1 : 0.75) * k, x.cam.view === 'back');
      }
    }
  };

/** The way the dark arrow flies: from her drawing hand at the chin through the bow's grip, steeply up. */
const upDir = (x: FxContext): V3 => norm3(sub3(x.rig.offhand.o, add3(x.rig.neck, [2, -0.5, 0], 1)));
/** Where its streak shows from: just ahead of the grip side on; toward or away from the viewer, where it clears her hood. */
const upFrom = (x: FxContext): V3 => add3(x.rig.offhand.o, upDir(x), x.cam.view === 'side' ? 3 : 18);

/**
 * The dark arrow's streak into the sky: a broad beam of violet with a green-white core and a
 * black-violet fringe, from `from` `len` along `dir` (by default where it leaves the bow, along
 * the line it was drawn on), widest and brightest at its far end where the arrow now is,
 * shedding green sparks; `k` its strength. `from` and `dir` hold it in place once the bow has
 * moved on.
 */
const darkStreak =
  (k: number, len: number, from?: (x: FxContext) => V3, dir: V3 | null = null): Extra =>
  (x) => {
    const { c, hash } = x;
    const at = from ? from(x) : upFrom(x);
    const d = dir ?? upDir(x);
    const A = x.proj(at);
    const B = x.proj(add3(at, d, len));
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const ux = (B[0] - A[0]) / L;
    const uy = (B[1] - A[1]) / L;
    const x0 = Math.floor(Math.min(A[0], B[0]) - 6);
    const x1 = Math.ceil(Math.max(A[0], B[0]) + 6);
    const y0 = Math.floor(Math.min(A[1], B[1]) - 6);
    const y1 = Math.ceil(Math.max(A[1], B[1]) + 6);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const rx = px + 0.5 - A[0];
        const ry = py + 0.5 - A[1];
        const t = (rx * ux + ry * uy) / L;
        if (t < 0 || t > 1.04) continue;
        const r = Math.abs(rx * -uy + ry * ux);
        const w = 1.4 + 2.6 * Math.min(1, t);
        if (r > w + 1.2) continue;
        const a = k * (0.2 + 0.8 * Math.pow(Math.min(1, t), 1.1));
        if (r < w * 0.28) c.glow(px, py, RUIN.heart, Math.min(1, a * 1.1));
        else if (r < w * 0.8) c.glow(px, py, RUIN.violet, Math.min(1, a));
        else c.glow(px, py, RUIN.dark, Math.min(1, a * 0.9));
      }
    }
    // Green sparks shed along it.
    for (let i = 0; i < 10; i++) {
      const t = 0.2 + 0.8 * hash(i, 61);
      const side = (hash(i, 62) - 0.5) * 14;
      const px = A[0] + (B[0] - A[0]) * t - uy * side;
      const py = A[1] + (B[1] - A[1]) * t + ux * side;
      c.glow(px, py, RUIN.spark, k * 0.95);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) c.glow(px + dx, py + dy, RUIN.sparkDeep, k * 0.6);
    }
  };

/** The release: a violet flare with a green-white heart where the dark arrow leaves. */
const darkFlash =
  (k: number): Extra =>
  (x) =>
    flash({ ...x, aura: { core: RUIN.violet, edge: RUIN.dark, hot: RUIN.heart } }, upFrom(x), upDir(x), k);

/** The way the dark arrow flew once the bow has come down: up and a little ahead, as it was drawn. */
const SKYWARD: V3 = norm3([0.25, 0.92, -0.25]);

/** Where the streak climbs on from once the bow has come down: `k` along the arrow's flight from ahead of her brow. */
const upAhead =
  (k: number) =>
  (x: FxContext): V3 =>
    add3(add3(x.rig.head.o, [6, 8, -2], 1), SKYWARD, k);

const ult: ChibiPose[] = [
  // Crouched, gathering violet-black power, the dark arrow on the string.
  fromReady(pose(READY, { y: 9, lean: 14, twist: 14, head: 6, handF: [6, 10, 0], handB: [12, 12, 2], weaponB: 30, draw: 0.7, nock: true, wind: 0.2, lift: 0.3, phase: 0.05, face: 'grit', fx: { runeB: 0.5, extra: both(darkAura(0.5, 0), sparks(0.5, 0)) } }), 0.7),
  // The leap, the bow coming up over her head as she draws.
  pose(UP_DRAW, { x: -1, y: -10, footF: [5, -6, 5], footB: [-6, -3, 4.6], draw: 0.6, handF: [5, 2, 0], wind: 0.1, lift: 0.4, phase: 0.15, fx: { runeB: 0.8, extra: both(darkAura(0.75, 0.15), sparks(0.7, 0.12), darkGather(0.45, 0)) } }),
  // At the top of the leap: full draw straight up, the dark arrow's head ablaze.
  pose(UP_DRAW, { x: -2, y: -15, footF: [5, -10, 5], footB: [-6, -7, 4.6], wind: 0.1, lift: 0.45, phase: 0.25, fx: { runeB: 1, extra: both(darkAura(1, 0.3), sparks(0.9, 0.24), darkGather(1, 18)) } }),
  // Loosed at the sky with a burst of dark light.
  pose(UP_LOOSE, { x: -2, y: -15, footF: [5, -10, 5], footB: [-6, -7, 4.6], wind: 0.2, lift: 0.5, flare: 0.2, phase: 0.35, fx: { extra: both(darkAura(0.85, 0.45), darkStreak(1.2, 80), darkFlash(1.5)) } }),
  // Falling, the streak fading high above.
  pose(UP_LOOSE, { x: -2, y: -7, lean: -8, head: -12, footF: [6, -4, 5], footB: [-6, -2, 4.6], handF: [3, 2, 6], handB: [11, -8, 3], weaponB: -20, rollB: -10, wind: -0.2, lift: 0.6, phase: 0.45, face: 'stern', fx: { extra: both(darkAura(0.5, 0.6), sparks(0.8, 0.5), darkStreak(0.75, 70, upAhead(30), SKYWARD)) } }),
  // Landed in a crouch.
  pose(READY, { x: -2, y: 10, lean: 12, twist: 14, head: -6, look: -4, footF: [10, 0, 5.6], footB: [-11, 0, 5], handF: [4, 10, 5], drop: true, handB: [12, 10, 3], weaponB: 30, draw: 0, nock: false, wind: 0.2, lift: 0.5, phase: 0.55, face: 'stern', fx: { dust: 0.8, extra: both(darkAura(0.3, 0.75), sparks(0.9, 0.62), darkStreak(0.4, 60, upAhead(64), SKYWARD)) } }),
  // Watching the sky darken, sparks falling.
  pose(READY, { x: -2, y: 8, lean: 4, twist: 12, head: -12, look: -4, handF: [4, 11, 6], drop: true, handB: [11, 11, 3], weaponB: 26, draw: 0, nock: false, wind: 0.15, lift: 0.35, phase: 0.65, face: 'stern', fx: { extra: both(darkAura(0.15, 0.9), sparks(0.8, 0.74)) } }),
  pose(READY, { x: -2, y: 7, lean: 4, twist: 12, head: -10, look: -4, handF: [4, 11, 6], drop: true, handB: [11, 11, 3], weaponB: 24, draw: 0, nock: false, wind: 0.12, lift: 0.25, phase: 0.75, face: 'stern', fx: { extra: sparks(0.6, 0.86) } }),
  pose(mix(READY, BATTLE0, 0.3), { x: -1.4, ...REACH_QUIVER, phase: 0.82, fx: { extra: sparks(0.4, 0.98) } }),
  pose(mix(READY, BATTLE0, 0.55), { x: -0.9, ...DRAW_ARROW, phase: 0.88 }),
  settle(pose(READY, { x: -1, drop: true }), 0.8, { handF: [7, 7, 0], weapon: 90, nock: true, draw: 0.1, phase: 0.94 }),
  settle(pose(READY, { x: -0.5 }), 0.95, { phase: 1 }),
];

// ── Cast: a light backflip ───────────────────────────────────────────────────────────────────

/** The bow kept out to her left through the flip, the right hand free. */
const FLIP = { handB: [6, 6, 10] as const, weaponB: 20, rollB: 40, yawB: 0, drop: true, draw: 0, nock: false };

const cast: ChibiPose[] = [
  // A quick dip to spring from.
  fromReady(pose(READY, { y: 9, lean: 16, twist: 4, head: 4, footF: [7, 0, 5], footB: [-7, 0, 4.6], handF: [-4, 12, 9], ...FLIP, handB: [4, 12, 9], wind: 0.2, phase: 0.05, face: 'grit' }), 0.7),
  // Up and back, arching.
  pose(READY, { x: -4, y: -11, lean: -60, twist: 0, head: -30, footF: [7, -6, 5], footB: [4, -4, 4.6], handF: [-10, -4, 12], ...FLIP, handB: [-6, -2, 12], wind: -0.6, lift: 0.6, phase: 0.2, face: 'stern', fx: { dust: 0.6 } }),
  // Over the top, tucked.
  pose(READY, { x: -8, y: -20, lean: -150, twist: 0, head: -80, footF: [-4, -46, 5], footB: [-8, -44, 4.6], handF: [-14, 4, 12], ...FLIP, handB: [-10, 6, 12], wind: -0.4, lift: 0.9, flare: 0.3, phase: 0.35, face: 'closed' }),
  // Coming round.
  pose(READY, { x: -10, y: -12, lean: -280, twist: 0, head: 150, footF: [-16, -20, 5], footB: [-20, -22, 4.6], handF: [-6, 6, 12], ...FLIP, handB: [-4, 8, 12], wind: 0.2, lift: 0.8, flare: 0.2, phase: 0.5, face: 'stern' }),
  // Landing in a crouch, a hand to the floor.
  pose(READY, { x: -10, y: 12, lean: 26, twist: 6, head: 2, footF: [-6, 0, 5.6], footB: [-26, 0, 5], kneel: 'B', handF: [10, 22, 8], ...FLIP, handB: [8, 10, 9], wind: 0.6, lift: 0.4, phase: 0.65, face: 'stern', fx: { dust: 0.9 } }),
  pose(READY, { x: -9, y: 9, lean: 18, twist: 10, head: 2, footF: [-4, 0, 5.6], footB: [-24, 0, 5], handF: [8, 16, 6], ...FLIP, handB: [10, 9, 6], wind: 0.35, lift: 0.2, phase: 0.8, face: 'stern', fx: { dust: 0.4 } }),
  settle(pose(READY, { x: -8, y: 7, drop: true }), 0.6, { phase: 0.9 }),
  settle(pose(READY, { x: -2 }), 0.92, { phase: 1 }),
];

/** The skills' poses, by clip. */
export const SKILL_MOVES = { special, q, e, r, ult, cast };
