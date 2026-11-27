import { describe, expect, it } from 'vitest';
import { hex, type Raster, type RGB } from '../src/client/art/heroes/paint.js';
import { blade } from '../src/client/art/heroes/chibi/blade.js';
import { arrow, bow, nocked } from '../src/client/art/heroes/chibi/bow.js';
import { crossbow } from '../src/client/art/heroes/chibi/crossbow.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { NO_WEAPON } from '../src/client/art/heroes/chibi/held.js';
import { CHIBI_VIEWS, type ChibiView } from '../src/client/art/heroes/chibi/index.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { pole } from '../src/client/art/heroes/chibi/pole.js';
import { flat } from '../src/client/art/heroes/chibi/raster.js';
import { add3, camera, type ChibiPose, dot3, type FxContext, len3, mix, norm3, pose, solveRig, sub3, type V3 } from '../src/client/art/heroes/chibi/rig.js';
import { heaterOutline, roundOutline, shield, towerOutline } from '../src/client/art/heroes/chibi/shield.js';
import { ARCHER, ARCHER_CLIPS, ARROW_SPEC, BOLT_SPEC, CROSSBOW, CROSSBOW_CLIPS, CROSSBOWMAN, KIT, KIT_BOX as BOX, KITE, KITE_SPEC, ORB_STAFF, RECURVE, SABRE, SABRE_CLIPS, SABRE_SPEC, SHIELD_CLIPS, SHIELD_KNIGHT, STAFF_CLIPS, STAFF_MAGE, TWIN_SABRES } from './chibi-kit-mannequins.js';
import { darkKnightFrames, timeAgainst } from './paint-timing.js';

/** A quick checksum of a frame's pixels (as in chibi.test.ts). */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

const alpha = (r: Raster, x: number, y: number): number => r.data[(y * r.w + x) * 4 + 3] as number;
const rgb = (r: Raster, x: number, y: number): RGB => [r.data[(y * r.w + x) * 4] as number, r.data[(y * r.w + x) * 4 + 1] as number, r.data[(y * r.w + x) * 4 + 2] as number];
const same = (a: RGB, b: RGB): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** How many pixels differ between two frames, and how many of those were part of the figure in `a`. */
function diff(a: Raster, b: Raster): { n: number; onFigure: number; inAir: number } {
  let n = 0;
  let onFigure = 0;
  let inAir = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    let eq = true;
    for (let k = 0; k < 4; k++) if (a.data[i * 4 + k] !== b.data[i * 4 + k]) eq = false;
    if (eq) continue;
    n++;
    if ((a.data[i * 4 + 3] as number) === 255) onFigure++;
    else inAir++;
  }
  return { n, onFigure, inAir };
}

function bounds(r: Raster): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = r.w;
  let y0 = r.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (!alpha(r, x, y)) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x0, y0, x1, y1 };
}

/** How many pixels of a frame are exactly a colour, within a box round a point (or anywhere). */
function count(r: Raster, col: RGB, around?: readonly [number, number], rad = Infinity): number {
  let n = 0;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if (around && (Math.abs(x - around[0]) > rad || Math.abs(y - around[1]) > rad)) continue;
      if (alpha(r, x, y) === 255 && same(rgb(r, x, y), col)) n++;
    }
  }
  return n;
}

/** The FxContext a pose's effects are painted with (caught through `fx.extra`). */
function fxContext(d: ChibiDesign, p: ChibiPose, view: ChibiView = 'side'): FxContext {
  let got: FxContext | undefined;
  paintChibi(d, { ...p, fx: { ...p.fx, extra: (x) => (got = x) } }, view, BOX);
  if (!got) throw new Error('fx.extra was not called');
  return got;
}

const near = (a: V3, b: V3, tol = 1e-6): boolean => len3(sub3(a, b)) < tol;
const rigOf = (d: ChibiDesign, p: ChibiPose) => solveRig(d.build, p, d.weapon.grip2, d.weapon.haft, d.offhand?.strap);
const clip = (c: Record<string, readonly ChibiPose[]>, name: string, i = 0): ChibiPose => (c[name] as readonly ChibiPose[])[i] as ChibiPose;

// Flat, unique colours, so a test can find exactly what painted a pixel.
const FACE = hex('#ff00ff');
const BACK = hex('#00ffff');
const STRING = hex('#ff0080');
const SHAFT = hex('#80ff00');
/** The kite shield painted in flat colours: its face magenta, its back cyan, no emblem or boss. */
const MARKED_SHIELD = shield({ ...KITE_SPEC, face: flat(FACE), back: flat(BACK), emblem: undefined, boss: undefined });

describe('a shield', () => {
  const D = SHIELD_KNIGHT;
  const block = clip(SHIELD_CLIPS, 'block', 1);

  it('is strapped to the forearm: its back on it, its face square to it', () => {
    for (const p of [...(SHIELD_CLIPS.stand as ChibiPose[]), ...(SHIELD_CLIPS.block as ChibiPose[]), ...(SHIELD_CLIPS.bash as ChibiPose[]), ...(SHIELD_CLIPS.walk as ChibiPose[])]) {
      const rig = rigOf(D, p);
      const g = rig.offhand;
      const fore = norm3(sub3(rig.armL.end, rig.armL.mid));
      // Square to the forearm, and a proper frame (n = u × v).
      expect(Math.abs(dot3(g.n, fore))).toBeLessThan(1e-9);
      expect(len3(g.n)).toBeCloseTo(1);
      expect(Math.abs(dot3(g.u, g.n))).toBeLessThan(1e-9);
      expect(Math.abs(dot3(g.u, g.v))).toBeLessThan(1e-9);
      // Its grip is on the forearm, `at` of the way down it, `out` clear of it along its face.
      const s = KITE.strap as NonNullable<typeof KITE.strap>;
      const on = add3(rig.armL.mid, sub3(rig.armL.end, rig.armL.mid), s.at);
      expect(near(g.o, add3(on, g.n, s.out), 1e-9)).toBe(true);
    }
    // Without the strap, the same pose holds it in the fist at its angles.
    const loose = solveRig(D.build, block, D.weapon.grip2);
    expect(near(loose.offhand.o, loose.armL.end)).toBe(true);
  });

  it('faces ahead in a block with the forearm across the chest, and turns with yawB, rollB and the forearm', () => {
    const rig = rigOf(D, block);
    expect(rig.offhand.n[0]).toBeGreaterThan(0.8);
    // Upright on its face.
    expect(rig.offhand.u[1]).toBeGreaterThan(0.9);
    // With the arm low by his side, yawB turns it out to his left (with the forearm across his chest it cannot: its face stays square to the forearm).
    const stand = clip(SHIELD_CLIPS, 'stand');
    const ahead = rigOf(D, pose(stand, { yawB: 0 }));
    const out = rigOf(D, pose(stand, { yawB: 50 }));
    expect(out.offhand.n[2]).toBeLessThan(ahead.offhand.n[2] - 0.3);
    const up = rigOf(D, pose(block, { rollB: 50 }));
    expect(up.offhand.n[1]).toBeGreaterThan(rig.offhand.n[1] + 0.3);
    const lean = rigOf(D, pose(block, { weaponB: 30 }));
    expect(lean.offhand.u[2]).toBeLessThan(rig.offhand.u[2] - 0.3);
    // Moving the forearm turns it, its face still square to the new forearm.
    const raised = rigOf(D, pose(block, { handB: [8, -2, -1] }));
    expect(len3(sub3(raised.offhand.n, rig.offhand.n))).toBeGreaterThan(0.1);
    expect(Math.abs(dot3(raised.offhand.n, norm3(sub3(raised.armL.end, raised.armL.mid))))).toBeLessThan(1e-9);
  });

  it('hides the arm behind it while its face is toward the viewer, and lies under the arm seen from behind', () => {
    const d: ChibiDesign = { ...D, offhand: MARKED_SHIELD };
    const p = pose(block, { fx: undefined });
    const rig = rigOf(d, p);
    // Front on, the face covers the left hand.
    const front = paintChibi(d, p, 'front', BOX);
    const hand = camera('front', 0, BOX.ax, BOX.ay).proj(rig.armL.end);
    expect(same(rgb(front, Math.floor(hand[0]), Math.floor(hand[1])), FACE)).toBe(true);
    expect(count(front, FACE)).toBeGreaterThan(250);
    // From behind, the hand lies over the inside of the shield.
    const back = paintChibi(d, p, 'back', BOX);
    const handB = camera('back', 0, BOX.ax, BOX.ay).proj(rig.armL.end);
    const px = rgb(back, Math.floor(handB[0]), Math.floor(handB[1]));
    expect(same(px, BACK) || same(px, FACE)).toBe(false);
  });

  it('shows its inside (and the straps) when it faces away, and its face when it faces the viewer', () => {
    const d: ChibiDesign = { ...D, offhand: MARKED_SHIELD };
    const stand = pose(clip(SHIELD_CLIPS, 'stand'), { fx: undefined });
    expect(count(paintChibi(d, stand, 'front', BOX), FACE)).toBeGreaterThan(150);
    const slung = pose(clip(SHIELD_CLIPS, 'slung'), { fx: undefined });
    expect(count(paintChibi(d, slung, 'back', BOX), FACE)).toBeGreaterThan(250);
    expect(count(paintChibi(d, slung, 'front', BOX), FACE)).toBeLessThan(20);
  });

  it('can be slung on the back, leaving the left hand free', () => {
    const p = clip(SHIELD_CLIPS, 'slung', 1);
    const rig = rigOf(D, p);
    const g = rig.offhand;
    // Behind the chest, facing out behind him, upright but for its tilt.
    expect(dot3(sub3(g.o, rig.chest.o), rig.chest.f)).toBeLessThan(-6);
    expect(dot3(g.n, rig.chest.f)).toBeLessThan(-0.99);
    expect(g.u[2]).toBeLessThan(0);
    expect(near(rig.armL.end, g.o, 3)).toBe(false);
    // Where the pose puts it.
    const at = rigOf(D, pose(p, { slingAtB: [-10, 12, 1], weaponB: 0 }));
    expect(dot3(sub3(at.offhand.o, at.chest.o), at.chest.f)).toBeCloseTo(-10);
    expect(at.offhand.u[1]).toBeGreaterThan(0.95);
    // Any off-hand item can be slung.
    const bowRig = solveRig(ARCHER.build, pose(clip(ARCHER_CLIPS, 'stand'), { slingB: true }), 0);
    expect(dot3(bowRig.offhand.n, bowRig.chest.f)).toBeLessThan(-0.99);
  });

  it('glows only when it blazes (a block, a light skill), over its face and round its rim', () => {
    const p = pose(block, { fx: {} });
    const rest = paintChibi(D, p, 'front', BOX);
    expect(sum(paintChibi({ ...D, offhand: { ...KITE, glow: undefined } }, p, 'front', BOX))).toBe(sum(rest));
    const lit = diff(rest, paintChibi(D, pose(p, { fx: { runeB: 1 } }), 'front', BOX));
    expect(lit.onFigure).toBeGreaterThan(200);
    expect(lit.inAir).toBeGreaterThan(40);
  });

  it('leaves its effects from the middle of its face, out of it: an impact for a bash, a clang for a block', () => {
    const x = fxContext(D, block, 'front');
    const rig = rigOf(D, block);
    expect(near(x.dirB, rig.offhand.n)).toBe(true);
    expect(dot3(sub3(x.tipB, rig.offhand.o), rig.offhand.n)).toBeGreaterThan(2);
    const quiet = paintChibi(D, pose(block, { fx: { runeB: 1 } }), 'front', BOX);
    expect(diff(quiet, paintChibi(D, block, 'front', BOX)).n).toBeGreaterThan(40);
    // Seen from behind, the clang is on the far side of him: it goes under the figure.
    const backQuiet = paintChibi(D, pose(block, { fx: { runeB: 1 } }), 'back', BOX);
    const backClang = diff(backQuiet, paintChibi(D, block, 'back', BOX));
    const frontClang = diff(quiet, paintChibi(D, block, 'front', BOX));
    expect(backClang.onFigure).toBe(0);
    expect(frontClang.onFigure).toBeGreaterThan(10);
  });

  it('has round, heater (kite) and tower outlines', () => {
    for (const [u, v] of roundOutline(10)) expect(Math.hypot(u, v)).toBeCloseTo(10);
    const kite = heaterOutline({ w: 9, top: 10, bottom: -20 });
    expect(Math.min(...kite.map((p) => p[0]))).toBe(-20);
    expect(Math.max(...kite.map((p) => p[0]))).toBeCloseTo(11);
    expect(Math.max(...kite.map((p) => Math.abs(p[1])))).toBe(9);
    const tower = towerOutline({ w: 8, top: 12, bottom: -18 });
    expect(Math.max(...tower.map((p) => Math.abs(p[1])))).toBe(8);
    expect(Math.min(...tower.map((p) => p[0]))).toBeLessThan(-18);
    for (const k of KIT) {
      if (!k.design.offhand?.strap) continue;
      for (const view of CHIBI_VIEWS) expect(diff(paintChibi({ ...k.design, offhand: undefined }, clip(SHIELD_CLIPS, 'block'), view, BOX), paintChibi(k.design, clip(SHIELD_CLIPS, 'block'), view, BOX)).n, `${k.design.id} ${view}`).toBeGreaterThan(20);
    }
  });
});

describe('a bow', () => {
  const D: ChibiDesign = { ...ARCHER, offhand: bow({ limb: { len: 20, w0: 1.5, w1: 0.8, mat: flat(hex('#806040')) }, grip: { len: 6, r: 1.6, mat: flat(hex('#406020')) }, string: flat(STRING), arrow: { ...ARROW_SPEC, shaft: flat(SHAFT) } }), weapon: NO_WEAPON };
  const shoot = ARCHER_CLIPS.shoot as readonly ChibiPose[];
  const full = pose(shoot[2] as ChibiPose, { fx: undefined });

  it('runs its string through the drawing hand when drawn, and straight from tip to tip when slack', () => {
    const rig = rigOf(D, full);
    const cam = camera('side', 0, BOX.ax, BOX.ay);
    const hand = cam.proj(rig.armR.end);
    expect(count(paintChibi(D, full, 'side', BOX), STRING, hand, 5)).toBeGreaterThan(2);
    const slack = pose(full, { draw: 0, nock: false, handF: [2, 14, 7] });
    const handS = cam.proj(rigOf(D, slack).armR.end);
    expect(count(paintChibi(D, slack, 'side', BOX), STRING, handS, 5)).toBe(0);
    expect(count(paintChibi(D, slack, 'side', BOX), STRING)).toBeGreaterThan(20);
    // The limbs bend with the draw.
    const half = diff(paintChibi({ ...D, weapon: NO_WEAPON }, pose(full, { draw: 0.2 }), 'side', BOX), paintChibi(D, full, 'side', BOX));
    expect(half.n).toBeGreaterThan(30);
  });

  it('nocks an arrow while drawn (unless the pose says not), from the hand past the grip', () => {
    expect(nocked(full)).toBe(true);
    expect(nocked(pose(full, { nock: false }))).toBe(false);
    expect(nocked(pose(full, { draw: 0 }))).toBe(false);
    expect(nocked(pose(full, { draw: 0, nock: true }))).toBe(true);
    expect(count(paintChibi(D, full, 'side', BOX), SHAFT)).toBeGreaterThan(12);
    // Slack with one on the string, it lies from the string's middle, ahead past the grip.
    expect(count(paintChibi(D, pose(full, { draw: 0, nock: true }), 'side', BOX), SHAFT)).toBeGreaterThan(12);
    for (const view of CHIBI_VIEWS) expect(count(paintChibi(D, pose(full, { nock: false }), view, BOX), SHAFT), view).toBe(0);
  });

  it('never runs its string across the face', () => {
    const p = pose(full, { handF: [2, -3, 2] });
    for (const view of ['side', 'front'] as const) {
      const r = paintChibi(D, p, view, BOX);
      const head = camera(view, 0, BOX.ax, BOX.ay).proj(rigOf(D, p).head.o);
      expect(count(r, STRING, [head[0], head[1] + 1], 4), view).toBe(0);
    }
  });

  it('leaves its shots from the arrow head along the arrow, or just ahead of the grip once loosed', () => {
    const x = fxContext(D, full);
    const rig = rigOf(D, full);
    const dir = norm3(sub3(rig.offhand.o, rig.armR.end));
    expect(near(x.dirB, dir)).toBe(true);
    expect(near(x.tipB, add3(rig.armR.end, dir, ARROW_SPEC.len))).toBe(true);
    const loosed = pose(shoot[3] as ChibiPose, { fx: undefined });
    const y = fxContext(D, loosed);
    const r2 = rigOf(D, loosed);
    expect(len3(sub3(y.tipB, r2.offhand.o))).toBeLessThan(3);
  });

  it('takes an arrow in the drawing hand that hides while one is on the string', () => {
    const held = arrow({ ...ARROW_SPEC, shaft: flat(SHAFT) });
    const withArrow: ChibiDesign = { ...D, weapon: held };
    // Nocked, the arrow in hand paints nothing (the bow paints the one on the string).
    const empty: ChibiDesign = { ...D, weapon: { ...held, paint: () => {} } };
    expect(sum(paintChibi(withArrow, full, 'side', BOX))).toBe(sum(paintChibi(empty, full, 'side', BOX)));
    const stand = clip(ARCHER_CLIPS, 'stand');
    expect(count(paintChibi(withArrow, stand, 'side', BOX), SHAFT)).toBeGreaterThan(8);
    expect(count(paintChibi(empty, stand, 'side', BOX), SHAFT)).toBe(0);
  });

  it('shows in every view, drawn and slack', () => {
    // Held out ahead of him it is behind him seen from behind; hanging at his side it shows past him.
    for (const p of [full, clip(ARCHER_CLIPS, 'stand'), pose(full, { draw: 0 })]) {
      for (const view of CHIBI_VIEWS) {
        if (view === 'back' && p !== clip(ARCHER_CLIPS, 'stand')) continue;
        const bare = paintChibi({ ...D, offhand: undefined }, p, view, BOX);
        expect(diff(bare, paintChibi(D, p, view, BOX)).n, view).toBeGreaterThan(view === 'back' ? 4 : 30);
      }
    }
    expect(RECURVE.reach[1]).toBeGreaterThan(20);
  });
});

describe('a crossbow', () => {
  const D = CROSSBOWMAN;
  const aim = pose(clip(CROSSBOW_CLIPS, 'shot'), { fx: undefined });

  it('shoots from its bolt point along the stock', () => {
    const x = fxContext(D, aim);
    const rig = rigOf(D, aim);
    expect(CROSSBOW.tip).toBe(3 + BOLT_SPEC.len);
    expect(near(x.tip, add3(rig.weapon.o, rig.weapon.u, CROSSBOW.tip as number))).toBe(true);
    expect(near(x.dir, rig.weapon.u)).toBe(true);
  });

  it('is spanned and loaded by default, loosed with draw 0 and empty with nock false', () => {
    const marked: ChibiDesign = { ...D, weapon: crossbow({ ...CROSSBOW_SPEC_FOR_TEST, string: flat(STRING), bolt: { ...BOLT_SPEC, shaft: flat(SHAFT) } }) };
    for (const view of CHIBI_VIEWS) {
      const spanned = paintChibi(marked, aim, view, BOX);
      const loosed = paintChibi(marked, pose(aim, { draw: 0 }), view, BOX);
      expect(sum(spanned), view).not.toBe(sum(loosed));
      // Loosed, it is empty unless the pose loads it.
      expect(count(loosed, SHAFT), view).toBe(0);
      expect(count(paintChibi(marked, pose(aim, { nock: false }), view, BOX), SHAFT), view).toBe(0);
      expect(count(spanned, STRING), view).toBeGreaterThan(2);
    }
    expect(count(paintChibi(marked, aim, 'side', BOX), SHAFT)).toBeGreaterThan(4);
  });

  it('shows its prod across the front toward the viewer, where the stock is end on', () => {
    const p = pose(aim, { yaw: 0, fx: undefined });
    const front = diff(paintChibi({ ...D, weapon: NO_WEAPON }, p, 'front', BOX), paintChibi(D, p, 'front', BOX));
    expect(front.n).toBeGreaterThan(60);
    const r = paintChibi(D, p, 'front', BOX);
    const b = bounds(r);
    const bare = bounds(paintChibi({ ...D, weapon: NO_WEAPON }, p, 'front', BOX));
    // Wider than the figure alone: the prod's arms reach out past the arms.
    expect(b.x1 - b.x0).toBeGreaterThan(bare.x1 - bare.x0 + 2);
  });
});

/** The crossbow's spec, rebuilt for the marked copy (the mannequin keeps only the built weapon). */
const CROSSBOW_SPEC_FOR_TEST = {
  stock: { pts: [[-13, -1.8], [23, -2.2], [24.5, 1.6], [-13, 5]] as const, mat: flat(hex('#604020')) },
  prod: { at: 21.5, span: 14, sweep: 3.5, w: [1.7, 1] as const, mat: flat(hex('#c0c0c8')) },
  string: flat(STRING),
  latch: 3,
  trigger: { at: 0.5, mat: flat(hex('#303030')) },
  bolt: BOLT_SPEC,
  grip2: 9,
};

describe('a staff head', () => {
  const D = STAFF_MAGE;
  const stand = clip(STAFF_CLIPS, 'stand');

  it('makes a pole arm with no point a staff: its tip at the top of the stone', () => {
    expect(ORB_STAFF.tip).toBe(40.5 + 5);
    expect(ORB_STAFF.reach[0]).toBeLessThan(35);
    expect(ORB_STAFF.reach[1]).toBe(45.5);
    const crystal = pole({ haft: { from: -30, to: 30, r: 1.3, mat: flat(hex('#806040')) }, metal: flat(hex('#ffd060')), edge: flat(hex('#ffffff')), grip2: -8, orb: { at: 36, r: 3, len: 12, mat: flat(hex('#a060ff')), glow: hex('#d0b0ff') } });
    expect(crystal.tip).toBe(42);
  });

  it('burns with fx.rune: brighter, with a halo', () => {
    for (const view of CHIBI_VIEWS) {
      const cold = paintChibi(D, pose(stand, { fx: {} }), view, BOX);
      const hot = paintChibi(D, pose(stand, { fx: { rune: 1 } }), view, BOX);
      const d = diff(cold, hot);
      expect(d.onFigure, view).toBeGreaterThan(15);
      expect(d.inAir, view).toBeGreaterThan(15);
    }
  });

  it('holds its stone in a ring, claws or a crook that show in every view', () => {
    for (const kind of ['ring', 'claws', 'crook'] as const) {
      const spec = { haft: { from: -36, to: 33, r: 1.35, mat: flat(hex('#806040')) }, metal: flat(hex('#ffd060')), edge: flat(hex('#ffffff')), grip2: -10, orb: { at: 39, r: 4.5, mat: flat(hex('#60a0ff')), glow: hex('#a0d0ff') } };
      const bare = { ...D, weapon: pole(spec) };
      const held = { ...D, weapon: pole({ ...spec, orb: { ...spec.orb, holder: { kind, mat: flat(hex('#ffd060')) } } }) };
      for (const view of CHIBI_VIEWS) {
        const p = pose(stand, { fx: undefined });
        expect(diff(paintChibi(bare, p, view, BOX), paintChibi(held, p, view, BOX)).n, `${kind} ${view}`).toBeGreaterThan(view === 'back' ? 3 : 12);
      }
    }
  });

  it('runs its rune channel up the haft when it has no point', () => {
    const D2: ChibiDesign = { ...D, weapon: KIT.find((k) => k.design.id === 'mannequin-crystal-mage')?.design.weapon as ChibiDesign['weapon'] };
    const p = pose(stand, { fx: {} });
    const lit = diff(paintChibi(D2, p, 'side', BOX), paintChibi(D2, pose(p, { fx: { rune: 1 } }), 'side', BOX));
    expect(lit.onFigure).toBeGreaterThan(30);
  });
});

describe('a curved blade', () => {
  it('bends back from the guard so the tip moves toward its back, the edge on the outside', () => {
    const straight = blade({ ...SABRE_SPEC, curve: 0 });
    // Held out level ahead of him, its edge down and its back up.
    const p = pose(clip(SABRE_CLIPS, 'guard'), { handF: [14, 10, 6], weapon: 90, roll: 0, yaw: 0, fx: undefined });
    const d: ChibiDesign = { ...TWIN_SABRES, offhand: undefined };
    const a = paintChibi({ ...d, weapon: straight }, p, 'side', BOX);
    const b = paintChibi(d, p, 'side', BOX);
    const rig = rigOf(d, p);
    const cam = camera('side', 0, BOX.ax, BOX.ay);
    const at = cam.proj(add3(rig.weapon.o, rig.weapon.u, 33));
    const col = (r: Raster): number => {
      const ys: number[] = [];
      for (let y = Math.floor(at[1]) - 10; y <= at[1] + 10; y++) if (alpha(r, Math.floor(at[0]), y) === 255) ys.push(y);
      return ys.reduce((s, y) => s + y, 0) / Math.max(1, ys.length);
    };
    // Near the tip the curved blade lies higher (toward its back) than the straight one.
    expect(col(a) - col(b)).toBeGreaterThan(2);
    expect(SABRE.reach[1]).toBe(40);
  });

  it('reads as two blades in every view, twin sabres crossing', () => {
    const cross = clip(SABRE_CLIPS, 'cross', 1);
    for (const view of CHIBI_VIEWS) {
      const p = pose(clip(SABRE_CLIPS, 'guard'), { fx: undefined });
      const none = paintChibi({ ...TWIN_SABRES, weapon: NO_WEAPON, offhand: undefined }, p, view, BOX);
      const one = paintChibi({ ...TWIN_SABRES, offhand: undefined }, p, view, BOX);
      const two = paintChibi(TWIN_SABRES, p, view, BOX);
      expect(diff(none, one).n, view).toBeGreaterThan(view === 'back' ? 25 : 40);
      expect(diff(one, two).n, view).toBeGreaterThan(view === 'back' ? 25 : 40);
      expect(diff(paintChibi(TWIN_SABRES, pose(cross, { fx: undefined }), view, BOX), paintChibi(TWIN_SABRES, cross, view, BOX)).inAir, view).toBeGreaterThan(80);
    }
  });
});

describe('elbows', () => {
  it('point where the pose says, and blend between poses', () => {
    const p = clip(ARCHER_CLIPS, 'shoot', 2);
    const up = rigOf(ARCHER, p);
    const down = rigOf(ARCHER, pose(p, { elbowF: undefined }));
    // The drawing arm's elbow raised up and back.
    expect(up.armR.mid[1]).toBeGreaterThan(down.armR.mid[1] + 2);
    expect(near(up.armR.end, down.armR.end, 1e-9)).toBe(true);
    // Out to his left for a shield arm.
    const block = clip(SHIELD_CLIPS, 'block');
    expect(rigOf(SHIELD_KNIGHT, block).armL.mid[2]).toBeLessThan(rigOf(SHIELD_KNIGHT, pose(block, { elbowB: undefined })).armL.mid[2] - 1);
    const m = mix(pose(p, { elbowF: [0, 1, 0] }), pose(p, { elbowF: [0, -1, 0] }), 0.25);
    expect(m.elbowF?.[1]).toBeCloseTo(0.5);
    expect(mix(p, pose(p, { elbowF: undefined }), 0.75).elbowF).toBeUndefined();
    expect(mix(pose(p, { draw: 0 }), pose(p, { draw: 1 }), 0.5).draw).toBeCloseTo(0.5);
  });
});

describe('the roster effects', () => {
  it('flashes at the tip of a shot and trails it out along the aim', () => {
    const d = ARCHER;
    const p = clip(ARCHER_CLIPS, 'shoot', 3);
    const plain = paintChibi(d, pose(p, { fx: {} }), 'side', BOX);
    const x = fxContext(d, p);
    const tip = x.proj(x.tipB);
    const flash = diff(plain, paintChibi(d, pose(p, { fx: { flash: { k: 1 } } }), 'side', BOX));
    expect(flash.n).toBeGreaterThan(40);
    const trailed = paintChibi(d, pose(p, { fx: { trail: { k: 1 } } }), 'side', BOX);
    // Out ahead of the tip, the way the arrow flew.
    let ahead = 0;
    for (let y = 0; y < BOX.h; y++) for (let xx = Math.ceil(tip[0]) + 15; xx < BOX.w; xx++) if (alpha(trailed, xx, y) && !alpha(plain, xx, y)) ahead++;
    expect(ahead).toBeGreaterThan(40);
    // Shot at the viewer, it opens out down the screen rather than shrinking to a dot.
    const front = diff(paintChibi(d, pose(p, { fx: {} }), 'front', BOX), paintChibi(d, pose(p, { fx: { trail: { k: 1 } } }), 'front', BOX));
    expect(front.n).toBeGreaterThan(60);
    // A crossbow's bolt trails from the main weapon.
    const c = clip(CROSSBOW_CLIPS, 'shot', 1);
    expect(diff(paintChibi(CROSSBOWMAN, pose(c, { fx: {} }), 'side', BOX), paintChibi(CROSSBOWMAN, c, 'side', BOX)).inAir).toBeGreaterThan(60);
  });

  it('bursts light rays from behind him round his chest, or over him from an item, never over the face', () => {
    const d = SHIELD_KNIGHT;
    const p = pose(clip(SHIELD_CLIPS, 'guard'), { fx: {} });
    const plain = paintChibi(d, p, 'front', BOX);
    const body = diff(plain, paintChibi(d, pose(p, { fx: { rays: { k: 1 } } }), 'front', BOX));
    expect(body.onFigure).toBe(0);
    expect(body.inAir).toBeGreaterThan(200);
    const staff = pose(clip(STAFF_CLIPS, 'raise'), { fx: {} });
    const fromTip = diff(paintChibi(STAFF_MAGE, staff, 'side', BOX), paintChibi(STAFF_MAGE, pose(staff, { fx: { rays: { k: 1, at: 'main' } } }), 'side', BOX));
    expect(fromTip.inAir).toBeGreaterThan(150);
    // A column of light: behind him and over him, softly, but not over his face.
    for (const view of CHIBI_VIEWS) {
      const s = pose(clip(STAFF_CLIPS, 'stand'), { fx: {} });
      const a = paintChibi(STAFF_MAGE, s, view, BOX);
      const b = paintChibi(STAFF_MAGE, pose(s, { fx: { rays: { k: 1, column: true } } }), view, BOX);
      const dd = diff(a, b);
      expect(dd.inAir, view).toBeGreaterThan(400);
      if (view === 'front') {
        const head = camera(view, 0, BOX.ax, BOX.ay).proj(rigOf(STAFF_MAGE, s).head.o);
        for (let y = Math.floor(head[1]) - 2; y <= head[1] + 3; y++) for (let x = Math.floor(head[0]) - 4; x <= head[0] + 4; x++) expect(same(rgb(a, x, y), rgb(b, x, y)), `${x},${y}`).toBe(true);
      }
    }
  });

  it('raises motes of light that climb with rise', () => {
    const d = STAFF_MAGE;
    const p = pose(clip(STAFF_CLIPS, 'stand'), { fx: {} });
    const a = paintChibi(d, pose(p, { fx: { motes: { k: 1, rise: 0 } } }), 'side', BOX);
    const b = paintChibi(d, pose(p, { fx: { motes: { k: 1, rise: 0.2 } } }), 'side', BOX);
    expect(diff(paintChibi(d, p, 'side', BOX), a).n).toBeGreaterThan(40);
    expect(sum(a)).not.toBe(sum(b));
  });
});

describe('the kit mannequins', () => {
  it('paint every pose in every view inside the frame, the same pixels every time', () => {
    for (const { design: d, clips } of KIT) {
      for (const [name, poses] of Object.entries(clips)) {
        for (const [i, p] of poses.entries()) {
          for (const view of CHIBI_VIEWS) {
            const r = paintChibi(d, p, view, BOX);
            const b = bounds(r);
            const at = `${d.id} ${name} ${i} ${view}`;
            expect(b.x0, at).toBeGreaterThan(0);
            expect(b.y0, at).toBeGreaterThan(0);
            expect(b.x1, at).toBeLessThan(BOX.w - 1);
            expect(b.y1, at).toBeLessThan(BOX.h - 1);
            if (i === 0) expect(sum(paintChibi(d, p, view, BOX)), at).toBe(sum(r));
          }
        }
      }
    }
  });

  it('paint fast enough with the new gear and effects (well within what the Dark Knight takes)', () => {
    // Against the Dark Knight painted in the same breath, so a busy machine slows both alike; they
    // paint at about 0.8 of his time today, so this fails if they come to take nearly twice as long.
    const box = { w: 256, h: 232, ax: 112, ay: 180 };
    const all = KIT.flatMap(({ design, clips }) => Object.values(clips).flatMap((poses) => poses.map((p) => [design, p] as const)));
    const work = all.flatMap(([d, p]) => CHIBI_VIEWS.map((view) => () => paintChibi(d, p, view, box)));
    const t = timeAgainst(work, darkKnightFrames());
    expect(t.ratio, `${t.ratio.toFixed(2)} of the Dark Knight's time (${t.ms.toFixed(2)} ms a frame against his ${t.refMs.toFixed(2)} ms)`).toBeLessThan(1.5);
  });
});
