/**
 * Test mannequins for the chibi engine's roster gear (not registered heroes): the Dark Knight's
 * body and head without his coat and collar, so the hands and gear show, carrying each new kind
 * of item, with clips that put it to use:
 *
 *  - SHIELD_KNIGHT: a sword and a kite shield strapped to the left forearm (a painted field, an
 *    embossed star, a boss): standing, a walk, a spin, a block with a clang and a bash with an
 *    impact, a holy light (the shield ablaze, a burst of rays behind him, rising motes), the
 *    shield slung on his back (standing and kneeling) and a fall;
 *  - CAPED_SHIELD: the same gear on the robed figure (chibi-mannequins.ts: a cape, a robe-coat and
 *    long hair), slung over the cape;
 *  - ROUND_SHIELD and TOWER_SHIELD: the other outlines;
 *  - ARCHER: a recurve bow in the left hand and an arrow in the right: a full draw and release
 *    with its flash and trail, a shot at the sky, a walk, a spin and the bow slung on his back;
 *  - CROSSBOWMAN: a crossbow in both hands: shouldered, a shot with its flash and trail, a reload,
 *    a hip shot, a walk;
 *  - STAFF_MAGE (an orb in claws), CRYSTAL_MAGE (a crystal in a ring) and CROOK_MAGE (an orb in a
 *    crook): a staff raised with its head ablaze, planted, swung, and a walk, with light rays, a
 *    column of light and rising motes;
 *  - TWIN_SABRES: a curved sabre in each hand: a guard, twin cuts crossing, a spin and a walk.
 *
 * Used by chibi-kit.test.ts; a scratch script can paint them into contact sheets (KIT lists the
 * mannequins and their clips).
 */
import { hex } from '../src/client/art/heroes/paint.js';
import { blade, type BladeSpec } from '../src/client/art/heroes/chibi/blade.js';
import { DARK_KNIGHT } from '../src/client/art/heroes/chibi/darkKnight/design.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { pole, type PoleSpec } from '../src/client/art/heroes/chibi/pole.js';
import { flat, mat4 } from '../src/client/art/heroes/chibi/raster.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';
import { arrow, type ArrowSpec, bow } from '../src/client/art/heroes/chibi/bow.js';
import { crossbow } from '../src/client/art/heroes/chibi/crossbow.js';
import { heaterOutline, roundOutline, shield, type ShieldSpec, starOutline, towerOutline } from '../src/client/art/heroes/chibi/shield.js';
import { SLENDER_SWORD } from './chibi-gear-mannequin.js';
import { FALL, ROBED, RUN, SPIN, STAND } from './chibi-mannequins.js';

const GOLD = mat4('#fff2c4', '#f2d68a', '#c8a050', '#7e6030', '#3e2c12', 0.05);
const ROYAL = { ...mat4('#6f9bf0', '#3f6fd0', '#284ea0', '#18306a', '#0c1838', 0), gain: 0.8 };
const PALE = mat4('#ffffff', '#eef2fa', '#c8d0e2', '#8e98b0', '#3a4258', 0.1);
const OAK = mat4('#8a6446', '#6a4a32', '#4a3222', '#2c1c12', '#140c06', -0.05);
const SILVER = mat4('#ffffff', '#dfe4ee', '#a8b0c2', '#6c7488', '#2a2e3a', 0.08);
const IRON = mat4('#b8bcc8', '#8c909e', '#62667a', '#3c3f4e', '#181a22', 0);
const CRIMSON = mat4('#ff8a8a', '#e04848', '#a82830', '#6a141c', '#30080c', 0.02);

/** The aura of the shield and staff mannequins: a warm holy gold. */
const HOLY = { core: hex('#ffd66e'), edge: hex('#fff4c8'), hot: hex('#ffffff') };

/** The Dark Knight's body and head without his coat and collar. */
const BARE: ChibiDesign = { ...DARK_KNIGHT, headPieces: [], outfit: [] };

// ── Shields ──────────────────────────────────────────────────────────────────────────────────

/** A kite shield about 30 px tall: a blue face with a pale chief, a gold rim, an embossed gold star and a gold boss. */
export const KITE_SPEC: ShieldSpec = {
  outline: heaterOutline({ w: 9.5, top: 10, bottom: -20, waist: 0.22, arch: 1.2, belly: 1.5 }),
  face: ROYAL,
  back: OAK,
  rim: { w: 1.6, mat: GOLD },
  boss: { r: 2.2, mat: GOLD, at: [1, 0] },
  emblem: [
    // A pale band across its top (a chief), then an embossed star over the boss.
    { pts: [[11.5, -10], [11.5, 10], [5, 10], [5, -10]], mat: PALE },
    { pts: starOutline(4, 8, 2.6, [1, 0]), mat: GOLD, raise: 0.9 },
  ],
  glow: hex('#ffe08a'),
};
export const KITE = shield(KITE_SPEC);

/** A round shield of iron-bound oak with a crimson ring and a spiked boss. */
export const ROUND = shield({
  outline: roundOutline(10),
  face: OAK,
  back: OAK,
  rim: { w: 1.4, mat: IRON },
  boss: { r: 2.8, mat: IRON, spike: 2.5 },
  emblem: [{ pts: roundOutline(6.5), mat: CRIMSON }, { pts: roundOutline(4.6), mat: OAK }],
  glow: hex('#ffb070'),
});

/** A tall tower shield: silver with a crimson cross painted down it. */
export const TOWER = shield({
  outline: towerOutline({ w: 8.5, top: 13, bottom: -19 }),
  face: SILVER,
  back: OAK,
  rim: { w: 1.3, mat: GOLD },
  emblem: [{ pts: [[9, -1.6], [9, 1.6], [-15, 1.6], [-15, -1.6]], mat: CRIMSON }, { pts: [[1.6, -6], [1.6, 6], [-1.6, 6], [-1.6, -6]], mat: CRIMSON }],
  glow: hex('#ffe08a'),
});

/** The robed figure (a cape and a robe-coat, long hair) with the sword and the kite shield, to check the shield among cloth and hair. */
export const CAPED_SHIELD: ChibiDesign = { ...ROBED, id: 'mannequin-caped-shield', weapon: SLENDER_SWORD, offhand: KITE, aura: HOLY };

export const SHIELD_KNIGHT: ChibiDesign = { ...BARE, id: 'mannequin-shield-knight', weapon: SLENDER_SWORD, offhand: KITE, aura: HOLY };
export const ROUND_SHIELD: ChibiDesign = { ...SHIELD_KNIGHT, id: 'mannequin-round-shield', offhand: ROUND };
export const TOWER_SHIELD: ChibiDesign = { ...SHIELD_KNIGHT, id: 'mannequin-tower-shield', offhand: TOWER };

/** On guard: the sword up and ready, the shield up in front of him. */
const SH_GUARD: ChibiPose = { x: 0, y: 4, lean: 8, twist: -8, head: 2, footF: [9, 0, 5], footB: [-9, 0, 4.6], handF: [5, 12, 9], weapon: 50, roll: 20, yaw: -6, handB: [8, 9, 5], yawB: 10, wind: 0.2, phase: 0.1 };

export const SHIELD_CLIPS: Record<string, readonly ChibiPose[]> = {
  // At ease, the shield low at his side, the sword point down.
  stand: [pose(STAND, { handB: [3, 15, 9], yawB: 25 }), pose(STAND, { y: 1.4, handB: [3, 15.4, 9], yawB: 25, phase: 0.5, face: 'closed' })],
  guard: [SH_GUARD],
  // Walking with the shield carried forward.
  walk: RUN.map((p, i) => ({ ...p, lean: 12, handB: [6 + Math.cos((2 * Math.PI * i) / 8) * 2, 10, 6], yawB: 10, weapon: -100, yaw: -20 })),
  // A spin, the shield held out.
  spin: SPIN.map((p) => ({ ...p, handB: [6, 6, 13], yawB: 50 })),
  // A block: the shield raised before his face, a blow ringing on it; then braced.
  block: [
    pose(SH_GUARD, { y: 5, lean: 2, twist: -14, head: 4, face: 'grit', handB: [9, 7, -1], elbowB: [0.4, -0.3, 1], rollB: 12, yawB: 0, fx: { runeB: 0.4 } }),
    pose(SH_GUARD, { x: -2, y: 6, lean: -2, twist: -16, head: 5, face: 'grit', handB: [9, 6, -2], elbowB: [0.4, -0.2, 1], rollB: 16, yawB: 0, wind: -0.3, fx: { runeB: 1, clangB: 1 } }),
    pose(SH_GUARD, { x: -3, y: 6, lean: 0, twist: -14, head: 4, face: 'grit', handB: [9, 7, -1], elbowB: [0.4, -0.3, 1], rollB: 12, yawB: 0, fx: { runeB: 0.6, dust: 0.6 } }),
  ],
  // A bash: the shield drawn back, then driven forward and across with a burst on its face.
  bash: [
    pose(SH_GUARD, { x: -2, y: 5, lean: 2, twist: -16, head: 2, face: 'grit', handB: [3, 9, 9], elbowB: [-0.6, -0.3, 1], yawB: 50, handF: [-4, 12, 9], weapon: -40 }),
    pose(SH_GUARD, { x: 6, y: 6, lean: 18, twist: 24, head: 0, face: 'shout', footF: [16, 0, 5], footB: [-12, 0, 4.6], handB: [11, 8, -3], elbowB: [0.1, -0.2, 1], yawB: -10, handF: [-2, 12, 9], weapon: -60, wind: 0.6, fx: { runeB: 0.8, impactB: 0.8, ghosts: { k: 0.5 } } }),
    pose(SH_GUARD, { x: 5, y: 6, lean: 14, twist: 18, head: 1, face: 'grit', footF: [16, 0, 5], footB: [-12, 0, 4.6], handB: [10, 8, -2], elbowB: [0.1, -0.2, 1], yawB: -6, handF: [-2, 12, 9], weapon: -50, wind: 0.3, fx: { runeB: 0.4, dust: 0.8 } }),
  ],
  // The shield slung on his back: standing at ease with the sword held up in both hands (victory), and kneeling.
  slung: [
    pose(STAND, { slingB: true, handB: undefined, handF: [6, 2, 6], weapon: 10, roll: 6, yaw: 10, face: 'smirk' }),
    pose(STAND, { slingB: true, weaponB: 20, handB: [2, 8, 8], handF: [6, 13, 8], weapon: 160, roll: 0, yaw: 10 }),
    { x: 0, y: 12, lean: 14, twist: 4, head: 6, footF: [9, 0, 4.6], footB: [-12, 0, 4.2], kneel: 'B', handF: [9, 10, 6], weapon: 178, roll: 4, yaw: 0, handB: [6, 13, 9], slingB: true, face: 'grit', wind: 0.1 },
  ],
  // A holy light: the shield raised and blazing, a burst of rays behind him and motes of light rising round him.
  light: [
    pose(SH_GUARD, { y: 3, lean: -2, head: -4, face: 'closed', handB: [9, 4, -1], elbowB: [0.4, -0.2, 1], rollB: 10, yawB: 0, handF: [3, 13, 9], weapon: 160, roll: 6, yaw: 0, lift: 0.3, fx: { runeB: 1, aura: 0.5, rays: { k: 1, spin: 0 }, motes: { k: 1, rise: 0 } } }),
    pose(SH_GUARD, { y: 3, lean: -2, head: -4, face: 'closed', handB: [9, 4, -1], elbowB: [0.4, -0.2, 1], rollB: 10, yawB: 0, handF: [3, 13, 9], weapon: 160, roll: 6, yaw: 0, lift: 0.3, phase: 0.4, fx: { runeB: 1, aura: 0.5, rays: { k: 0.8, spin: 15 }, motes: { k: 1, rise: 0.25 } } }),
  ],
  // Knocked down, the shield still on his arm.
  fall: FALL.map((p) => ({ ...p, yawB: 40 })),
};

// ── Bow and arrow ────────────────────────────────────────────────────────────────────────────

const YEW = mat4('#c89a64', '#9c6e40', '#6e4a2a', '#432c18', '#1e140a', 0);
const GREEN_WRAP = mat4('#8ccf7a', '#5c9c4c', '#3c6e32', '#22441c', '#10220c', 0);
const HORN = mat4('#fff6e0', '#e8dcc0', '#b4a486', '#7a6c52', '#3a3224', 0.1);

/** A hunting arrow about 26 px: a pale shaft, a steel head that glows gold when charged, green fletching. */
export const ARROW_SPEC: ArrowSpec = {
  len: 26,
  shaft: mat4('#f2e2c0', '#e0c896', '#b49868', '#7a643e', '#3a2e1a'),
  head: { len: 4, w: 1.8, mat: SILVER, glow: hex('#ffd66e') },
  fletch: { len: 4.5, w: 1.6, mat: GREEN_WRAP },
};

/** A recurve bow about 48 px tip to tip: yew limbs curling forward at the tips, a green-wrapped grip, horn tips. */
export const RECURVE = bow({
  limb: { len: 20, w0: 1.5, w1: 0.8, mat: YEW },
  grip: { len: 6, r: 1.6, mat: GREEN_WRAP },
  brace: 4,
  bend: 7,
  recurve: 3,
  tips: HORN,
  string: mat4('#f4f0e4', '#f4f0e4', '#f4f0e4', '#f4f0e4', '#f4f0e4'),
  arrow: ARROW_SPEC,
});

const WILD = { core: hex('#9cf07a'), edge: hex('#e6ffd0'), hot: hex('#ffffff') };

/** The bare body with an arrow in the right hand and the recurve bow in the left. */
export const ARCHER: ChibiDesign = { ...BARE, id: 'mannequin-archer', weapon: arrow(ARROW_SPEC), offhand: RECURVE, aura: WILD };

/** Side on, ready to shoot: the bow arm out ahead at shoulder height, the bow upright. */
const AIM: ChibiPose = { x: 0, y: 3, lean: 2, twist: 18, head: 0, look: -10, footF: [8, 0, 5], footB: [-9, 0, 4.4], handF: [10, 4, 3], elbowF: [-1, 0.5, 0.5], handB: [17, 3, 3], weaponB: 4, rollB: 16, yawB: 0, weapon: 90, wind: 0.15, phase: 0.1 };

export const ARCHER_CLIPS: Record<string, readonly ChibiPose[]> = {
  // At ease: the bow low in the left hand, an arrow held point down in the right.
  stand: [pose(STAND, { handB: [3, 14, 8], weaponB: 170, rollB: 10, handF: [3, 14, 7], weapon: 170, roll: 6, yaw: 0 })],
  // A full draw and a release: nocked, half drawn, full draw (the head glowing), loosed (a flash and a trail), and the follow-through.
  shoot: [
    pose(AIM, { draw: 0, nock: true, handF: [14, 4, 2], elbowF: [-1, -0.2, 0.6] }),
    pose(AIM, { draw: 0.5, handF: [8, 3, 3] }),
    pose(AIM, { draw: 1, handF: [2, -2, 4], face: 'grit', fx: { runeB: 1 } }),
    pose(AIM, { draw: 0, nock: false, handF: [0, -3, 6], elbowF: [-1, 0.6, 0.8], face: 'shout', wind: 0.4, fx: { flash: { k: 1 }, trail: { k: 1 } } }),
    pose(AIM, { draw: 0, nock: false, handF: [-1, -1, 7], elbowF: [-1, 0.4, 0.8], wind: 0.2, fx: { trail: { k: 0.45, len: 60 } } }),
  ],
  // A shot at the sky: the bow tipped back, drawn, then loosed upward.
  sky: [
    pose(AIM, { lean: -10, head: -14, handB: [12, -8, 3], weaponB: -40, draw: 1, handF: [2, -4, 4], face: 'grit', fx: { runeB: 0.8 } }),
    pose(AIM, { lean: -10, head: -14, handB: [12, -8, 3], weaponB: -40, draw: 0, nock: false, handF: [-1, -5, 6], face: 'shout', fx: { flash: { k: 1 }, trail: { k: 1, len: 70 } } }),
  ],
  // Running with the bow held low and forward, the arrow trailing.
  walk: RUN.map((p, i) => ({ ...p, lean: 14, handB: [6 + Math.cos((2 * Math.PI * i) / 8) * 3, 11, 7], weaponB: 150, rollB: 10, weapon: -100, yaw: -20 })),
  // A spin with the bow held out, drawn.
  spin: SPIN.map((p) => ({ ...p, handB: [14, 4, 6], weaponB: 0, yawB: 10, handF: [6, 0, 4], draw: 0.7 })),
  // The bow slung across his back, both hands free.
  slung: [pose(STAND, { slingB: true, slingAtB: [-8, 14, 0], weaponB: 35, handB: [2, 14, 7], handF: [3, 14, 7], weapon: 170, roll: 6, yaw: 0, face: 'smirk' })],
};

// ── Crossbow ─────────────────────────────────────────────────────────────────────────────────

const WALNUT = mat4('#a87650', '#80583a', '#5a3c26', '#382416', '#180e08', -0.02);
const STEEL = mat4('#f2f4fa', '#c8ccd8', '#8e94a6', '#5a5f70', '#262833', 0.05);

/** A heavy bolt about 21 px: a dark shaft, a broad steel head that glows when charged, crimson vanes. */
export const BOLT_SPEC: ArrowSpec = {
  len: 21,
  shaft: mat4('#6e5038', '#6e5038', '#6e5038', '#6e5038', '#2a1c10'),
  head: { len: 3.5, w: 1.6, mat: STEEL, glow: hex('#ffcf7a') },
  fletch: { len: 3, w: 1.3, mat: CRIMSON },
};

/** A crossbow about 38 px long: a walnut stock with a deep butt, a steel prod, iron bands, a trigger and a stirrup. */
export const CROSSBOW = crossbow({
  stock: {
    pts: [
      [-13, -1.8],
      [-4, -1.6],
      [1, -2.2],
      [23, -2.2],
      [24.5, -1],
      [24.5, 1.6],
      [6, 2.2],
      [2, 1.8],
      [-1.5, 2],
      [-6, 3.4],
      [-13, 5],
      [-14.2, 1.6],
    ],
    mat: WALNUT,
  },
  bands: { at: [4, 15, 22.5], mat: IRON },
  prod: { at: 21.5, span: 14, sweep: 3.5, w: [1.7, 1], mat: STEEL },
  string: mat4('#efe6d2', '#efe6d2', '#efe6d2', '#efe6d2', '#efe6d2'),
  latch: 3,
  groove: 2.2,
  trigger: { at: 0.5, len: 4, mat: IRON },
  stirrup: IRON,
  bolt: BOLT_SPEC,
  grip2: 9,
});

const EMBER = { core: hex('#ffb04a'), edge: hex('#ffe9b0'), hot: hex('#ffffff') };

/** The bare body with a crossbow in both hands. */
export const CROSSBOWMAN: ChibiDesign = { ...BARE, id: 'mannequin-crossbowman', weapon: CROSSBOW, aura: EMBER };

/** Shouldered and aiming: the butt at his right shoulder, the left hand on the fore-stock, his cheek down to it. */
const SHOULDER: ChibiPose = { x: 0, y: 3, lean: 6, twist: 22, head: 4, look: -8, footF: [8, 0, 5], footB: [-9, 0, 4.4], handF: [9, 1, 4], elbowF: [-0.8, -0.2, 1], weapon: 90, roll: 0, yaw: -8, grip2: 9, wind: 0.15, phase: 0.1 };

export const CROSSBOW_CLIPS: Record<string, readonly ChibiPose[]> = {
  // Shouldered, then a shot (the string forward, a flash and a trail from the bolt's point, a kick), then the trail fading.
  shot: [
    pose(SHOULDER, { fx: { rune: 0.6 } }),
    pose(SHOULDER, { x: -1.5, lean: 1, handF: [5, 3, 4], weapon: 84, draw: 0, face: 'shout', wind: 0.3, fx: { flash: { k: 1 }, trail: { k: 1 } } }),
    pose(SHOULDER, { x: -1, lean: 3, handF: [6, 4, 4], weapon: 88, draw: 0, wind: 0.2, fx: { trail: { k: 0.45, len: 64 } } }),
  ],
  // A reload: the nose down to the floor and the string hauled back, then the bolt laid in.
  reload: [
    pose(SHOULDER, { y: 5, lean: 18, twist: 4, head: 8, look: 0, handF: [8, 12, 6], weapon: 160, roll: 0, yaw: 0, grip2: undefined, handB: [9, 14, 3], draw: 0, face: 'grit' }),
    pose(SHOULDER, { y: 5, lean: 14, twist: 4, head: 8, look: 0, handF: [8, 12, 6], weapon: 150, roll: 0, yaw: 0, grip2: undefined, handB: [6, 8, 3], draw: 1, nock: false }),
    pose(SHOULDER, { y: 4, lean: 8, twist: 8, head: 6, look: 0, handF: [6, 13, 6], weapon: 100, roll: 0, yaw: -10, grip2: undefined, handB: [8, 8, 2], draw: 1, nock: true }),
  ],
  // From the hip: held low, pointing ahead.
  hip: [pose(SHOULDER, { twist: 10, head: 1, look: 0, handF: [5, 14, 6], elbowF: undefined, weapon: 92, yaw: -14, fx: { flash: { k: 0.8 } }, draw: 0 })],
  // Walking with it carried across the chest.
  walk: RUN.map((p, i) => ({ ...p, lean: 12, handF: [4, 10, 7], handB: undefined, weapon: 60, roll: 30, yaw: -30, grip2: 9, twist: Math.cos((2 * Math.PI * i) / 8) * 4 })),
};

// ── Staves ───────────────────────────────────────────────────────────────────────────────────

const ASH = mat4('#d8b88a', '#b08c60', '#80623e', '#4e3a22', '#221708', 0);
const SAPPHIRE = mat4('#e8f4ff', '#8ed0ff', '#3e8ee0', '#1c4e9c', '#0c2250', 0.05);
const AMETHYST = mat4('#f4e8ff', '#c89cff', '#8a52e0', '#4e2696', '#24104a', 0.05);
const SUNSTONE = mat4('#fff8e0', '#ffd88a', '#f0a040', '#a8601c', '#4a2808', 0.05);

/** A staff's haft about 74 px from the butt to the head, in pale ash with gold bands and a gold butt cap. */
const STAFF_HAFT: Pick<PoleSpec, 'haft' | 'butt' | 'bands' | 'metal' | 'edge' | 'grip2'> = {
  haft: { from: -36, to: 34, r: 1.35, mat: ASH },
  butt: { len: 1.5, r: 1.6, mat: GOLD },
  bands: { at: [-20, 8, 31], len: 1.6, mat: GOLD },
  metal: GOLD,
  edge: GOLD,
  grip2: -10,
};

/** An orb held in four gold claws, blazing pale blue. */
export const ORB_STAFF = pole({ ...STAFF_HAFT, orb: { at: 40.5, r: 5, mat: SAPPHIRE, glow: hex('#9ad8ff'), holder: { kind: 'claws', mat: GOLD, n: 4 } } });
/** A long crystal in a gold ring, with carved runes up the haft that glow with it. */
export const CRYSTAL_STAFF = pole({
  ...STAFF_HAFT,
  orb: { at: 42, r: 3.6, len: 14, mat: AMETHYST, glow: hex('#d8b0ff'), holder: { kind: 'ring', mat: GOLD } },
  rune: { from: 10, to: 30, rest: hex('#6a4a9a'), colour: hex('#c89cff'), glow: hex('#e8d4ff'), marks: [14, 20, 26] },
});
/** An orb cradled in the haft's own top, curled over into a crook. */
export const CROOK_STAFF = pole({ ...STAFF_HAFT, haft: { ...STAFF_HAFT.haft, to: 33 }, bands: { at: [-20, 8, 30], len: 1.6, mat: GOLD }, orb: { at: 38.5, r: 4.4, mat: SUNSTONE, glow: hex('#ffd070'), holder: { kind: 'crook', mat: ASH, w: 1.2 } } });

/** The robed figure (chibi-mannequins.ts) with a staff. */
export const STAFF_MAGE: ChibiDesign = { ...ROBED, id: 'mannequin-staff-mage', weapon: ORB_STAFF, aura: HOLY };
export const CRYSTAL_MAGE: ChibiDesign = { ...ROBED, id: 'mannequin-crystal-mage', weapon: CRYSTAL_STAFF, aura: { core: hex('#c89cff'), edge: hex('#f0e4ff'), hot: hex('#ffffff') } };
export const CROOK_MAGE: ChibiDesign = { ...BARE, id: 'mannequin-crook-mage', weapon: CROOK_STAFF, aura: { core: hex('#ffb84a'), edge: hex('#fff0c0'), hot: hex('#ffffff') } };

/** Standing with the staff planted upright beside him in his right hand. */
const ST_STAND: ChibiPose = pose(STAND, { handF: [5, 11, 8], weapon: 2, roll: 0, yaw: 0, grip: 0, handB: [2, 14, 7], face: 'stern' });

export const STAFF_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: [ST_STAND, pose(ST_STAND, { y: 1.4, phase: 0.5, face: 'closed' })],
  // The staff raised high in both hands, the head ablaze, a burst of rays from it; then struck down and planted with a column of light, and the light lingering with motes rising.
  raise: [
    pose(ST_STAND, { y: 3, lean: -4, head: -10, handF: [4, -8, 7], weapon: -6, roll: 4, handB: undefined, grip2: -9, face: 'shout', wind: 0.3, lift: 0.4, fx: { rune: 1, aura: 0.5, rays: { k: 1, at: 'main', spin: 8 } } }),
    pose(ST_STAND, { y: 5, lean: 10, head: 4, handF: [9, 8, 6], weapon: 8, roll: 0, handB: [6, 12, 2], face: 'grit', wind: 0.2, lift: 0.2, fx: { rune: 1, rays: { k: 1, column: true }, shock: 0.3 } }),
    pose(ST_STAND, { y: 4, lean: 6, head: 2, handF: [8, 9, 6], weapon: 6, roll: 0, handB: [5, 12, 2], face: 'closed', fx: { rune: 0.7, rays: { k: 0.5, column: true }, motes: { k: 1, rise: 0.3 } } }),
  ],
  // A swing of the staff head round in front of him, with its smear.
  swing: [
    pose(ST_STAND, { y: 4, lean: 4, twist: 20, handF: [-2, 4, 9], weapon: -60, roll: 30, yaw: -10, handB: undefined, grip2: -10, face: 'grit' }),
    pose(ST_STAND, { x: 4, y: 5, lean: 14, twist: -20, handF: [10, 10, 2], weapon: 110, roll: 30, yaw: -10, handB: undefined, grip2: -10, face: 'shout', wind: 0.5, fx: { rune: 0.8, smear: { from: -50, roll: 30 } } }),
  ],
  // Walking, the staff swinging along in his right hand.
  walk: RUN.map((p, i) => ({ ...p, lean: 10, handF: [3 + Math.cos((2 * Math.PI * i) / 8) * 3, 11, 8], weapon: 14, roll: 0, yaw: 0, grip: 0 })),
  // A turn with the staff held out level.
  spin: SPIN.map((p) => ({ ...p, handB: undefined, grip2: -12, handF: [6, 6, 10], weapon: 90, yaw: 80, fx: { rune: 0.6 } })),
};

// ── Twin sabres ──────────────────────────────────────────────────────────────────────────────

const BLUED = mat4('#e8eefa', '#b4c0d8', '#7c88a4', '#4c5670', '#1c2232', 0.04);
const EDGE_PALE = mat4('#ffffff', '#f2f6ff', '#cad4e8', '#94a0bc', '#2a3042', 0.1);
const BLACK_GRIP = mat4('#5a5464', '#3c3646', '#28232f', '#18141e', '#0a080e');

/** A sabre about 42 px: a single-edged blade widening a little toward its clipped point, curved back by `curve`, a short brass guard. */
export const SABRE_SPEC: BladeSpec = {
  blade: [
    [3, 2],
    [26, 2.5],
    [33, 2.4],
    [40, -0.6],
    [34, -1.5],
    [3, -1.5],
  ],
  edge: { from: 5, width: 1, mat: EDGE_PALE },
  spine: { v: -0.9, from: 5, to: 32, mat: EDGE_PALE },
  steel: BLUED,
  guard: { pts: [[3, -4], [3.4, -1], [3.4, 1], [3, 4.4], [1.4, 4.6], [0.8, 1.6], [0.8, -1.6], [1.4, -4.4]], mat: GOLD },
  grip: { from: -6, to: 0.8, r: 1.2, mat: BLACK_GRIP, wrap: flat(hex('#141018')) },
  pommel: { u: -7, r: 1.5, mat: GOLD },
  grip2: -4,
  reach: [6, 40],
  curve: 7,
};
export const SABRE = blade(SABRE_SPEC);

/** The bare body with a sabre in each hand. */
export const TWIN_SABRES: ChibiDesign = { ...BARE, id: 'mannequin-twin-sabres', weapon: SABRE, offhand: SABRE, aura: { core: hex('#ff6a7a'), edge: hex('#ffd0e0'), hot: hex('#ffffff') } };

const SB_GUARD: ChibiPose = { x: 0, y: 4, lean: 8, twist: -4, head: 2, footF: [9, 0, 5], footB: [-9, 0, 4.6], handF: [7, 11, 8], weapon: 40, roll: 22, yaw: -6, handB: [6, 10, 8], weaponB: 52, rollB: 22, yawB: -6, wind: 0.2, phase: 0.1 };

export const SABRE_CLIPS: Record<string, readonly ChibiPose[]> = {
  guard: [SB_GUARD],
  // Both blades raised high and spread, then cut down across each other in an X, each with its own smear, then the follow-through.
  cross: [
    pose(SB_GUARD, { y: 3, lean: -2, head: -2, face: 'grit', handF: [2, -4, 9], weapon: -60, roll: 40, yaw: 0, handB: [2, -4, 9], weaponB: -60, rollB: 40, yawB: 0, wind: 0.3, lift: 0.3 }),
    pose(SB_GUARD, { x: 4, y: 6, lean: 16, head: 2, face: 'shout', handF: [12, 12, 2], weapon: 120, roll: 40, yaw: 0, handB: [12, 12, 2], weaponB: 120, rollB: 40, yawB: 0, wind: 0.6, fx: { smear: { from: -60 }, smearB: { from: -60 } } }),
    pose(SB_GUARD, { x: 4, y: 6, lean: 14, head: 2, face: 'grit', handF: [10, 14, 4], weapon: 150, roll: 40, yaw: 0, handB: [10, 14, 4], weaponB: 150, rollB: 40, yawB: 0, wind: 0.3, fx: { smear: { from: 100, alpha: 0.4 }, smearB: { from: 100, alpha: 0.4 } } }),
  ],
  // A whirl with both arms out, the blades level, a ring of steel.
  spin: SPIN.map((p, i) => ({ ...p, handF: [4, 5, 14], handB: [4, 5, 14], weapon: 90, roll: 0, yaw: 80, weaponB: 90, rollB: 0, yawB: 80, fx: i % 2 ? undefined : { ring: { from: p.turn ?? 0, to: (p.turn ?? 0) + 120 } } })),
  // Running, both blades trailing low behind him.
  walk: RUN.map((p) => ({ ...p, weapon: -120, roll: 0, yaw: -20, weaponB: -120, rollB: 0, yawB: -20 })),
};

/** A frame big enough for the long weapons, the shots and the effects round the mannequins. */
export const KIT_BOX = { w: 320, h: 300, ax: 160, ay: 215 };

export const KIT: readonly { design: ChibiDesign; clips: Record<string, readonly ChibiPose[]> }[] = [
  { design: SHIELD_KNIGHT, clips: SHIELD_CLIPS },
  {
    design: CAPED_SHIELD,
    clips: {
      stand: SHIELD_CLIPS.stand as readonly ChibiPose[],
      block: SHIELD_CLIPS.block as readonly ChibiPose[],
      // Slung over the cape: pushed out behind it.
      slung: (SHIELD_CLIPS.slung as readonly ChibiPose[]).map((p) => ({ ...p, slingAtB: [-10.5, 14, 0] as const })),
      walk: SHIELD_CLIPS.walk as readonly ChibiPose[],
    },
  },
  { design: ROUND_SHIELD, clips: { stand: SHIELD_CLIPS.stand as readonly ChibiPose[], block: SHIELD_CLIPS.block as readonly ChibiPose[], slung: SHIELD_CLIPS.slung as readonly ChibiPose[] } },
  { design: TOWER_SHIELD, clips: { stand: SHIELD_CLIPS.stand as readonly ChibiPose[], block: SHIELD_CLIPS.block as readonly ChibiPose[], slung: SHIELD_CLIPS.slung as readonly ChibiPose[] } },
  { design: ARCHER, clips: ARCHER_CLIPS },
  { design: CROSSBOWMAN, clips: CROSSBOW_CLIPS },
  { design: STAFF_MAGE, clips: STAFF_CLIPS },
  { design: CRYSTAL_MAGE, clips: { raise: STAFF_CLIPS.raise as readonly ChibiPose[], stand: STAFF_CLIPS.stand as readonly ChibiPose[] } },
  { design: TWIN_SABRES, clips: SABRE_CLIPS },
  { design: CROOK_MAGE, clips: { raise: STAFF_CLIPS.raise as readonly ChibiPose[], walk: STAFF_CLIPS.walk as readonly ChibiPose[] } },
];
