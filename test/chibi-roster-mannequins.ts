/**
 * Test mannequins that wear the body and head options (beards, hoods and cowls, helms, circlets,
 * an upright lock, scales, straps, quivers, capes) and carry the roster gear (bows, crossbows,
 * staves, shields, sabres, a lance) together on one figure (not registered heroes), to check how
 * pieces from the two sets sort against each other in every view:
 *
 *  - HOODED_ARCHER: the hooded archer (chibi-body-mannequins.ts HOODED: a hood worn up, a cowl
 *    over the shoulders, a quiver on the back on a strap across the chest) with the recurve bow in
 *    her left hand and an arrow in her right (chibi-kit-mannequins.ts): a full draw and release,
 *    a shot at the sky, a walk, a spin, the bow slung over the quiver, a gust and a fall;
 *  - BEARDED_SAGE: the old man in the full-length robe with a full white beard and a moustache
 *    and his hood worn down (ELDER) with the orb staff: planted, raised and blazing, swung, a
 *    walk, a spin, a gust and a fall;
 *  - CIRCLET_KNIGHT: the Dark Knight's body and head without his coat, with a circlet over his
 *    hair, a long cape, a slender sword and the kite shield strapped to his forearm: on guard, a
 *    walk, a spin, a block, a bash, the shield slung over the cape, a holy light and a fall;
 *  - BANDOLIER_CROSSBOWMAN: the same body with a short beard, a bandolier of bolts across the
 *    chest and the crossbow: shouldered and shot, a reload, a hip shot and a walk;
 *  - AHOGE_SABRES: the same body with a springy upright lock on the crown and a curved sabre in
 *    each hand: on guard, twin cuts crossing, a spin and a walk;
 *  - CREST_LANCER: the armoured figure (WARDEN: an open-faced helm with a finned crest, scaled
 *    plates and breastplate, a gorget, a short beard) with long hair down his back coming out
 *    from under the helm, a cape, and a lance in both hands: a stance, a run, a spin, a charge, a
 *    thrust, a gust and a fall.
 *
 * Used by chibi-roster.test.ts; a scratch script can paint them into contact sheets (ROSTER lists
 * the mannequins and their clips).
 */
import { hex } from '../src/client/art/heroes/paint.js';
import { strap } from '../src/client/art/heroes/chibi/back.js';
import { arrow } from '../src/client/art/heroes/chibi/bow.js';
import { DARK_KNIGHT } from '../src/client/art/heroes/chibi/darkKnight/design.js';
import type { ChibiDesign, Lock } from '../src/client/art/heroes/chibi/design.js';
import { beard, curtain } from '../src/client/art/heroes/chibi/head.js';
import { circlet } from '../src/client/art/heroes/chibi/headgear.js';
import { cape } from '../src/client/art/heroes/chibi/pieces.js';
import { pole } from '../src/client/art/heroes/chibi/pole.js';
import { flat, mat4 } from '../src/client/art/heroes/chibi/raster.js';
import { type ChibiPose, pose } from '../src/client/art/heroes/chibi/rig.js';
import { BODY_CLIPS, ELDER, GUST, HOODED, WARDEN } from './chibi-body-mannequins.js';
import { POLEARM_CLIPS } from './chibi-combined-mannequins.js';
import { SLENDER_SWORD } from './chibi-gear-mannequin.js';
import { ARCHER_CLIPS, ARROW_SPEC, CROSSBOW, CROSSBOW_CLIPS, KITE, ORB_STAFF, RECURVE, SABRE, SABRE_CLIPS, SHIELD_CLIPS, STAFF_CLIPS } from './chibi-kit-mannequins.js';
import { FALL } from './chibi-mannequins.js';

const GOLD = mat4('#fff2c4', '#f2d68a', '#c8a050', '#7e6030', '#3e2c12', 0.05);
const ROYAL = { ...mat4('#6f9bf0', '#3f6fd0', '#284ea0', '#18306a', '#0c1838', 0), gain: 0.6 };
const ROYAL_IN = mat4('#2a3e78', '#1e2e5e', '#142044', '#0c142c', '#060a18');
const LEATHER = mat4('#9a6a48', '#76502f', '#52361e', '#321f11', '#180c07', -0.05);
const BRASS = mat4('#fff2c4', '#e8c86a', '#b08a3a', '#6e5220', '#382808', 0.05);
const CRIMSON = { ...mat4('#ff8a8a', '#e04848', '#a82830', '#6a141c', '#30080c', 0.02), gain: 0.6 };
const CRIMSON_IN = mat4('#6a141c', '#541018', '#3c0a12', '#28060c', '#140306');
const SAPPHIRE = mat4('#e8f4ff', '#8ed0ff', '#3e8ee0', '#1c4e9c', '#0c2250', 0.05);

const HOLY = { core: hex('#ffd66e'), edge: hex('#fff4c8'), hot: hex('#ffffff') };

/** The Dark Knight's body and head without his coat and collar. */
const BARE: ChibiDesign = { ...DARK_KNIGHT, headPieces: [], outfit: [] };
const DK_SHELL = DARK_KNIGHT.head.shell;
const DK_BODY = DARK_KNIGHT.body;

// ── The hooded archer ────────────────────────────────────────────────────────────────────────

/** The hooded archer (hood up, cowl, quiver) with a recurve bow and an arrow. */
export const HOODED_ARCHER: ChibiDesign = { ...HOODED, id: 'mannequin-hooded-archer', weapon: arrow(ARROW_SPEC), offhand: RECURVE };

const ARCHER_ROSTER_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: ARCHER_CLIPS.stand as readonly ChibiPose[],
  shoot: ARCHER_CLIPS.shoot as readonly ChibiPose[],
  sky: ARCHER_CLIPS.sky as readonly ChibiPose[],
  walk: ARCHER_CLIPS.walk as readonly ChibiPose[],
  spin: ARCHER_CLIPS.spin as readonly ChibiPose[],
  // The bow slung across her back over the quiver and the cowl: pushed out behind them.
  slung: (ARCHER_CLIPS.slung as readonly ChibiPose[]).map((p) => ({ ...p, slingAtB: [-11, 13, 0] as const })),
  gust: GUST.map((p) => ({ ...p, handB: [3, 14, 8] as const, weaponB: 170, rollB: 10, handF: [3, 14, 7] as const, weapon: 170, roll: 6, yaw: 0 })),
  fall: BODY_CLIPS.fall,
};

// ── The bearded sage ─────────────────────────────────────────────────────────────────────────

/** The old man (a full beard, a moustache, a full-length robe, his hood down) with the orb staff. */
export const BEARDED_SAGE: ChibiDesign = { ...ELDER, id: 'mannequin-bearded-sage', weapon: ORB_STAFF, aura: HOLY };

const SAGE_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: STAFF_CLIPS.stand as readonly ChibiPose[],
  raise: STAFF_CLIPS.raise as readonly ChibiPose[],
  swing: STAFF_CLIPS.swing as readonly ChibiPose[],
  walk: STAFF_CLIPS.walk as readonly ChibiPose[],
  spin: STAFF_CLIPS.spin as readonly ChibiPose[],
  gust: GUST.map((p) => ({ ...p, handF: [5, 11, 8] as const, weapon: 2, roll: 0, yaw: 0, grip: 0, handB: [2, 14, 7] as const })),
  fall: FALL,
};

// ── The knight with a circlet, a cape and a kite shield ──────────────────────────────────────

/** A long royal-blue cape with a gold hem, from the shoulders to the backs of the knees. */
const ROYAL_CAPE = cape({ outer: ROYAL, inner: ROYAL_IN, top: 21, ring: [5.4, 8.4], from: 108, to: 252, len: 32, jag: 2, taper: 1.2, folds: true, trim: GOLD, over: { chest: DK_BODY.chest, hips: DK_BODY.hips, pad: 0.9 } });

/** The bare body with a gold circlet over his hair, a long cape, a slender sword and the kite shield on his forearm. */
export const CIRCLET_KNIGHT: ChibiDesign = {
  ...BARE,
  id: 'mannequin-circlet-knight',
  headPieces: [circlet({ mat: GOLD, shell: DK_SHELL, front: 5.2, back: 8.6, w: 1.5, gem: { mat: SAPPHIRE, r: 1.4 } })],
  outfit: [ROYAL_CAPE],
  weapon: SLENDER_SWORD,
  offhand: KITE,
  aura: HOLY,
};

const KNIGHT_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: SHIELD_CLIPS.stand as readonly ChibiPose[],
  guard: SHIELD_CLIPS.guard as readonly ChibiPose[],
  walk: SHIELD_CLIPS.walk as readonly ChibiPose[],
  spin: SHIELD_CLIPS.spin as readonly ChibiPose[],
  block: SHIELD_CLIPS.block as readonly ChibiPose[],
  bash: SHIELD_CLIPS.bash as readonly ChibiPose[],
  // Slung over the cape: pushed out behind it.
  slung: (SHIELD_CLIPS.slung as readonly ChibiPose[]).map((p) => ({ ...p, slingAtB: [-10.5, 14, 0] as const })),
  light: SHIELD_CLIPS.light as readonly ChibiPose[],
  fall: SHIELD_CLIPS.fall as readonly ChibiPose[],
};

// ── The crossbowman with a bandolier ─────────────────────────────────────────────────────────

const BOLT = mat4('#e8e0d0', '#c8b898', '#98866a', '#5e5040', '#2a241c', 0);

/** The bare body with a short beard, a bandolier of bolts across his chest (over his left shoulder) and the crossbow. */
export const BANDOLIER_CROSSBOWMAN: ChibiDesign = {
  ...BARE,
  id: 'mannequin-bandolier-crossbowman',
  head: { ...BARE.head, beard: beard({ kind: 'short', cheek: -5.4, side: -1.6 }), moustache: { len: 4, w: 1.2, droop: 1.4 } },
  outfit: [strap({ mat: LEATHER, side: -1, w: 1.3, over: { chest: DK_BODY.chest, hips: DK_BODY.hips }, studs: { every: 2.6, r: 0.7, len: 3.2, mat: BOLT, from: 0.2, to: 0.75, across: true } })],
  weapon: CROSSBOW,
  aura: { core: hex('#ffb04a'), edge: hex('#ffe9b0'), hot: hex('#ffffff') },
};

const CROSSBOWMAN_CLIPS: Record<string, readonly ChibiPose[]> = {
  shot: CROSSBOW_CLIPS.shot as readonly ChibiPose[],
  reload: CROSSBOW_CLIPS.reload as readonly ChibiPose[],
  hip: CROSSBOW_CLIPS.hip as readonly ChibiPose[],
  walk: CROSSBOW_CLIPS.walk as readonly ChibiPose[],
};

// ── Twin sabres and an upright lock ──────────────────────────────────────────────────────────

/** A single springy lock standing up from the crown, bobbing as he runs. */
const UPRIGHT: Lock = { yaw: 14, pitch: 78, dir: [0.2, 1, 0.05], len: 11, w: 2.4, curl: [0.55, -0.25, 0], give: 0.7, belly: 0.5, bob: 0.8 };

/** The bare body with an upright lock on his crown and a sabre in each hand. */
export const AHOGE_SABRES: ChibiDesign = {
  ...BARE,
  id: 'mannequin-ahoge-sabres',
  head: { ...BARE.head, locks: [...BARE.head.locks, UPRIGHT] },
  weapon: SABRE,
  offhand: SABRE,
  aura: { core: hex('#ff6a7a'), edge: hex('#ffd0e0'), hot: hex('#ffffff') },
};

// ── The crested lancer ───────────────────────────────────────────────────────────────────────

const STEEL = mat4('#f2f4fa', '#c8ccd8', '#8e94a6', '#5a5f70', '#262833', 0.05);
const DARK_STEEL = mat4('#9aa0b4', '#6c7286', '#4a4e60', '#2c2f3c', '#14161c', 0);
const ASH = mat4('#d8b88a', '#b08c60', '#80623e', '#4e3a22', '#221708', 0);

/** A lance about 100 px long: a pale haft with a leather grip and steel bands, a long conical point, and a flared guard (lugs) below it. */
export const LANCE = pole({
  haft: { from: -40, to: 44, r: 1.4, mat: ASH },
  butt: { len: 3, r: 1.7, mat: DARK_STEEL },
  bands: { at: [-30, 16, 38], len: 1.6, mat: DARK_STEEL },
  wraps: [{ from: -8, to: 6, mat: LEATHER, cord: flat(hex('#1a0e08')) }],
  metal: STEEL,
  edge: STEEL,
  socket: { from: 40, to: 46, r: 1.9 },
  point: { from: 45, len: 22, w: 2.6, belly: 0.12 },
  lugs: { at: 42, len: 5, w: 1.3 },
  grip2: -12,
});

/** Long hair down his back, grown under the helm: it comes out from under the helm's back edge. */
const LONG_UNDER_HELM = curtain({ from: 118, to: 242, count: 5, pitch: 6, len: 20, w: 3.2, jag: 0.3, taper: 0.5 });

/** A crimson cape from the shoulders to the knees, over the scaled armour. */
const LANCER_CAPE = cape({ outer: CRIMSON, inner: CRIMSON_IN, top: 21.5, ring: [5.6, 8.4], from: 110, to: 250, len: 30, jag: 2.5, taper: 1.2, folds: true, trim: BRASS, over: { chest: WARDEN.body.chest, hips: WARDEN.body.hips, pad: 1 } });

/** The armoured warden with long hair down his back under his finned helm, a cape in place of his slung sword, and a lance. */
export const CREST_LANCER: ChibiDesign = {
  ...WARDEN,
  id: 'mannequin-crest-lancer',
  head: { ...WARDEN.head, long: { back: LONG_UNDER_HELM, lie: 1.6 } },
  outfit: [...WARDEN.outfit.slice(0, 2), LANCER_CAPE],
  weapon: LANCE,
  aura: { core: hex('#ff8a5a'), edge: hex('#ffe0c8'), hot: hex('#ffffff') },
};

const LANCER_CLIPS: Record<string, readonly ChibiPose[]> = {
  stand: POLEARM_CLIPS.stand as readonly ChibiPose[],
  run: POLEARM_CLIPS.run as readonly ChibiPose[],
  spin: POLEARM_CLIPS.spin as readonly ChibiPose[],
  dash: POLEARM_CLIPS.dash as readonly ChibiPose[],
  thrust: POLEARM_CLIPS.thrust as readonly ChibiPose[],
  gust: GUST.map((p) => pose(p, { y: 5, lean: 10, twist: -14, head: 3, footF: [12, 0, 5.2], footB: [-12, 0, 4.8], handF: [-2, 16, 5], weapon: 56, roll: 10, yaw: -32, grip: -6, grip2: 6 })),
  fall: POLEARM_CLIPS.fall as readonly ChibiPose[],
};

/** A frame big enough for the long weapons, the shots and the effects round the mannequins. */
export const ROSTER_BOX = { w: 320, h: 300, ax: 160, ay: 215 };

export const ROSTER: readonly { design: ChibiDesign; clips: Record<string, readonly ChibiPose[]> }[] = [
  { design: HOODED_ARCHER, clips: ARCHER_ROSTER_CLIPS },
  { design: BEARDED_SAGE, clips: SAGE_CLIPS },
  { design: CIRCLET_KNIGHT, clips: KNIGHT_CLIPS },
  { design: BANDOLIER_CROSSBOWMAN, clips: CROSSBOWMAN_CLIPS },
  { design: AHOGE_SABRES, clips: SABRE_CLIPS },
  { design: CREST_LANCER, clips: LANCER_CLIPS },
];
