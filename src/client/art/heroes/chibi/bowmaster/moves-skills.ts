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
import { motes, rays, trail } from '../fx.js';
import { add3, type ChibiPose, cross3, type FxContext, mix, norm3, pose, rad, type V3 } from '../rig.js';
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

/**
 * Light gathering at the arrowhead: rays wheeling round it, `k` strong and `len` long. Seen from
 * behind, the arrowhead is on the far side of her, so they shine out from behind her.
 */
const gather =
  (k: number, len: number, spin: number): Extra =>
  (x) =>
    rays(x, x.tipB, k, { n: 10, len, spin, behind: x.cam.view === 'back' });

/** Planted wide and low, the bow arm out straight, drawing slowly to the cheek. */
const CHARGE = pose(FULL_DRAW, { y: 5, lean: 3, twist: 28, head: 1, look: -12, footF: [11, 0, 5.6], footB: [-12, 0, 5], handF: [0, 1.5, 0.5], handB: [17, -1.5, 1], face: 'grit', wind: 0.3, lift: 0.25 });
const C_LOOSE = pose(LOOSED, { x: -3, y: 5, lean: -6, twist: 26, head: -4, look: -12, footF: [11, 0, 5.6], footB: [-12, 0, 5], handF: [-4, -1, 4], handB: [17, -2, 1], wind: 0.95, lift: 0.35, flare: 0.2, phase: 0.4 });

const special: ChibiPose[] = [
  // The draw begins: the bow up, an arrow nocked, half drawn.
  fromReady(pose(CHARGE, { draw: 0.45, handF: [7, 3, 0], elbowF: [-1, 0, 0.6], wind: 0.25, lift: 0.1, phase: 0.05, face: 'stern', fx: { runeB: 0.25 } }), 0.6),
  // Drawn on, light gathering at the arrowhead.
  pose(CHARGE, { draw: 0.8, handF: [3, 2, 0.5], phase: 0.15, fx: { runeB: 0.6, aura: 0.15, extra: gather(0.45, 18, 0) } }),
  // Full draw: the arrowhead ablaze, rays wheeling round it, the cape lifting.
  pose(CHARGE, { draw: 1, lift: 0.45, phase: 0.25, fx: { runeB: 1, aura: 0.45, extra: gather(0.95, 26, 18) } }),
  // Loosed: a huge flash and a long streak, the recoil rocking her back, the cape flung out.
  withFx(C_LOOSE, { flash: { k: 1.5 }, trail: { k: 1.4, len: 96 }, aura: 0.3, dust: 0.5 }),
  withFx(pose(C_LOOSE, { x: -4, lean: -4, handF: [-5, 0, 5], wind: 0.7, lift: 0.4, phase: 0.55, face: 'stern' }), { trail: { k: 0.75, len: 112 }, dust: 0.3 }),
  // The bow arm held out as the streak fades, the right hand already at the quiver.
  withFx(pose(C_LOOSE, { x: -3, lean: -2, ...REACH_QUIVER, wind: 0.45, lift: 0.25, phase: 0.7, face: 'stern' }), { trail: { k: 0.3, len: 122 } }),
  pose(mix(C_LOOSE, BATTLE0, 0.6), { ...DRAW_ARROW, wind: 0.3, lift: 0.1, phase: 0.85, face: 'stern' }),
  settle(C_LOOSE, 0.88, { handF: [7, 7, 0], weapon: 90, drop: true, nock: true, draw: 0.1, phase: 1, face: 'stern' }),
];

// ── Volley ───────────────────────────────────────────────────────────────────────────────────

/** Leaning back, the bow tilted high (its back to the sky), an arrow drawn to the chin. */
const SKY = pose(FULL_DRAW, { y: 4, lean: -10, twist: 18, head: -12, look: -6, footF: [9, 0, 5.4], footB: [-10, 0, 5], handF: [3, 3, 1], elbowF: [-1, 0.2, 0.7], handB: [12, -13, 3], weaponB: -56, rollB: 22, draw: 1, nock: true, wind: 0.3, lift: 0.2 });
/** Loosed at the sky: the slack bow faces up and ahead, where the streak goes. */
const skyLoose = (weaponB: number, phase: number): ChibiPose => pose(SKY, { weaponB, handF: [1, 0, 4], elbowF: [-1, 0.6, 0.8], draw: 0, nock: false, wind: 0.45, lift: 0.3, phase, face: 'shout' });
const skyDraw = (weaponB: number, phase: number): ChibiPose => pose(SKY, { weaponB, handB: [12 + (56 + weaponB) * 0.12, -13 + (56 + weaponB) * 0.1, 3], draw: 0.9, phase });

const q: ChibiPose[] = [
  fromReady(pose(SKY, { draw: 0.5, handF: [7, 4, 1], phase: 0.05, face: 'stern' }), 0.6),
  pose(SKY, { phase: 0.12, face: 'grit', fx: { runeB: 0.4 } }),
  // Three arrows at the sky in quick succession, each a little steeper.
  withFx(skyLoose(-56, 0.2), { flash: { k: 1 }, trail: { k: 1, len: 64 } }),
  withFx(skyDraw(-64, 0.3), { extra: streaks([{ deg: 0, k: 0.5, len: 86 }]) }),
  withFx(skyLoose(-64, 0.4), { flash: { k: 1 }, trail: { k: 1, len: 64 }, extra: streaks([{ deg: 8, k: 0.3, len: 100 }]) }),
  withFx(skyDraw(-72, 0.5), { extra: streaks([{ deg: 8, k: 0.45, len: 88 }]) }),
  withFx(skyLoose(-72, 0.6), { flash: { k: 1.1 }, trail: { k: 1.1, len: 66 }, extra: streaks([{ deg: 8, k: 0.25, len: 100 }]) }),
  // The bow still raised as the last streak climbs away, the drawing hand dropping.
  withFx(pose(skyLoose(-72, 0.75), { handF: [3, 8, 6], elbowF: undefined, lean: -6, head: -8, phase: 0.75, face: 'stern' }), { trail: { k: 0.45, len: 92 } }),
  settle(skyLoose(-72, 0.9), 0.92, { phase: 1, face: 'stern' }),
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
 * The dark arrow drawn steeply up at the sky, the bow raised high ahead of her face (any higher and
 * its drawn limbs would pass through her hood), canted so its upper limb clears the hood from behind.
 */
const UP_DRAW = pose(FULL_DRAW, { lean: -12, twist: 16, head: -12, look: -4, handF: [3, 3, 1], elbowF: [-1, 0.2, 0.7], handB: [12, -13, 3], weaponB: -64, rollB: 22, yawB: 0, draw: 1, nock: true, face: 'grit' });
const UP_LOOSE = pose(UP_DRAW, { handF: [1, 0, 4], elbowF: [-1, 0.6, 0.8], weaponB: -66, draw: 0, nock: false, face: 'shout' });
/** Green sparks falling round her (motes in the ultimate's hot colour). */
const sparks = (k: number, rise: number): Extra => (x) => motes(x, k, { n: 12, rise });

/**
 * The dark arrow's streak into the sky: a broad beam of the ultimate's violet with a green-white
 * core, from `from` (default the bow's arrowhead) `len` along `dir` (default the bow's aim),
 * widest and brightest at its far end where the arrow now is, shedding green sparks; `k` its
 * strength. `from` and `dir` hold it in place once the bow has moved on.
 */
const darkStreak =
  (k: number, len: number, from?: (x: FxContext) => V3, dir: V3 | null = null): Extra =>
  (x) => {
    const { c, aura, hash } = x;
    const at = from ? from(x) : x.tipB;
    const d = dir ?? x.dirB;
    const A = x.proj(at);
    const B = x.proj(add3(at, d, len));
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
    const ux = (B[0] - A[0]) / L;
    const uy = (B[1] - A[1]) / L;
    const x0 = Math.floor(Math.min(A[0], B[0]) - 5);
    const x1 = Math.ceil(Math.max(A[0], B[0]) + 5);
    const y0 = Math.floor(Math.min(A[1], B[1]) - 5);
    const y1 = Math.ceil(Math.max(A[1], B[1]) + 5);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const rx = px + 0.5 - A[0];
        const ry = py + 0.5 - A[1];
        const t = (rx * ux + ry * uy) / L;
        if (t < 0 || t > 1.04) continue;
        const r = Math.abs(rx * -uy + ry * ux);
        const w = 1.2 + 2.4 * Math.min(1, t);
        if (r > w + 1) continue;
        const a = k * (0.15 + 0.85 * Math.pow(Math.min(1, t), 1.2));
        if (r < w * 0.3) c.glow(px, py, aura.hot, Math.min(1, a * 1.1));
        else if (r < w * 0.75) c.glow(px, py, aura.core, Math.min(1, a));
        else c.glow(px, py, aura.edge, Math.min(1, a * 0.8));
      }
    }
    // Green sparks shed along it.
    for (let i = 0; i < 9; i++) {
      const t = 0.2 + 0.8 * hash(i, 61);
      const side = (hash(i, 62) - 0.5) * 12;
      c.glow(A[0] + (B[0] - A[0]) * t - uy * side, A[1] + (B[1] - A[1]) * t + ux * side, i % 2 ? aura.hot : [255, 255, 255], k * 0.9);
    }
  };

/** The way the dark arrow flew: up and ahead, as the slack bow faced when it was loosed. */
const SKYWARD: V3 = norm3([0.42, 0.9, -0.15]);

/** Where the streak climbs on from once the bow has come down: `k` along the arrow's flight from ahead of her brow. */
const upAhead =
  (k: number) =>
  (x: FxContext): V3 =>
    add3(add3(x.rig.head.o, [8, 4, 0], 1), SKYWARD, k);

const ult: ChibiPose[] = [
  // Crouched, gathering violet-black power, the dark arrow on the string.
  fromReady(pose(READY, { y: 9, lean: 14, twist: 14, head: 6, handF: [6, 10, 0], handB: [12, 12, 2], weaponB: 30, draw: 0.7, nock: true, wind: 0.2, lift: 0.3, phase: 0.05, face: 'grit', fx: { aura: 0.45, runeB: 0.5, motes: { k: 0.6, rise: 0 } } }), 0.7),
  // The leap, the bow coming up over her head as she draws.
  pose(UP_DRAW, { x: -1, y: -10, footF: [5, -6, 5], footB: [-6, -3, 4.6], draw: 0.6, handF: [7, 1, 1], wind: 0.1, lift: 0.4, phase: 0.15, fx: { aura: 0.7, runeB: 0.8, motes: { k: 0.8, rise: 0.12 }, extra: gather(0.45, 18, 0) } }),
  // At the top of the leap: full draw straight up, the arrowhead blazing.
  pose(UP_DRAW, { x: -2, y: -15, footF: [5, -10, 5], footB: [-6, -7, 4.6], wind: 0.1, lift: 0.45, phase: 0.25, fx: { aura: 0.9, runeB: 1, motes: { k: 1, rise: 0.24 }, extra: gather(0.95, 26, 18) } }),
  // Loosed at the sky with a burst of dark light.
  pose(UP_LOOSE, { x: -2, y: -15, footF: [5, -10, 5], footB: [-6, -7, 4.6], wind: 0.2, lift: 0.5, flare: 0.2, phase: 0.35, fx: { flash: { k: 1.5 }, aura: 0.8, extra: both(gather(0.6, 30, 40), darkStreak(1.2, 80)) } }),
  // Falling, the streak fading high above.
  pose(UP_LOOSE, { x: -2, y: -7, lean: -8, head: -12, footF: [6, -4, 5], footB: [-6, -2, 4.6], handF: [3, 2, 6], handB: [11, -8, 3], weaponB: -50, wind: -0.2, lift: 0.6, phase: 0.45, face: 'stern', fx: { aura: 0.5, extra: both(sparks(0.8, 0.5), darkStreak(0.75, 70, upAhead(30), SKYWARD)) } }),
  // Landed in a crouch.
  pose(READY, { x: -2, y: 10, lean: 12, twist: 14, head: -6, look: -4, footF: [10, 0, 5.6], footB: [-11, 0, 5], handF: [4, 10, 5], drop: true, handB: [12, 10, 3], weaponB: 30, draw: 0, nock: false, wind: 0.2, lift: 0.5, phase: 0.55, face: 'stern', fx: { dust: 0.8, aura: 0.3, extra: both(sparks(0.9, 0.62), darkStreak(0.4, 60, upAhead(64), SKYWARD)) } }),
  // Watching the sky darken, sparks falling.
  pose(READY, { x: -2, y: 8, lean: 4, twist: 12, head: -12, look: -4, handF: [4, 11, 6], drop: true, handB: [11, 11, 3], weaponB: 26, draw: 0, nock: false, wind: 0.15, lift: 0.35, phase: 0.65, face: 'stern', fx: { aura: 0.2, extra: sparks(0.8, 0.74) } }),
  pose(READY, { x: -2, y: 7, lean: 4, twist: 12, head: -10, look: -4, handF: [4, 11, 6], drop: true, handB: [11, 11, 3], weaponB: 24, draw: 0, nock: false, wind: 0.12, lift: 0.25, phase: 0.75, face: 'stern', fx: { aura: 0.1, extra: sparks(0.6, 0.86) } }),
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
