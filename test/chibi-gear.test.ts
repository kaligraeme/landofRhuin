import { describe, expect, it } from 'vitest';
import { CHIBI_VIEWS, type ChibiView } from '../src/client/art/heroes/chibi/index.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { add3, camera, type ChibiPose, dot3, type FxContext, len3, mix, pose, solveRig, sub3, type V3 } from '../src/client/art/heroes/chibi/rig.js';
import type { Raster } from '../src/client/art/heroes/paint.js';
import { pole } from '../src/client/art/heroes/chibi/pole.js';
import { HALBERD, HALBERD_MANNEQUIN, HALBERD_POSES, HALBERD_SPEC, SLENDER_SWORD, SPELLBLADE_MANNEQUIN, SWORD_WAND_POSES, WAND } from './chibi-gear-mannequin.js';
import { darkKnightFrames, timeAgainst } from './paint-timing.js';

/** A frame big enough for the halberd's vault and the effects round the mannequins. */
const BOX = { w: 320, h: 300, ax: 160, ay: 215 };

/** A quick checksum of a frame's pixels (as in chibi.test.ts). */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

const alpha = (r: Raster, x: number, y: number): number => r.data[(y * r.w + x) * 4 + 3] as number;

/** How many pixels differ between two frames, and how many of those were part of the figure in `a`. */
function diff(a: Raster, b: Raster): { n: number; onFigure: number; inAir: number } {
  let n = 0;
  let onFigure = 0;
  let inAir = 0;
  for (let i = 0; i < a.w * a.h; i++) {
    let same = true;
    for (let k = 0; k < 4; k++) if (a.data[i * 4 + k] !== b.data[i * 4 + k]) same = false;
    if (same) continue;
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

/** The FxContext a pose's effects are painted with (caught through `fx.extra`). */
function fxContext(d: ChibiDesign, p: ChibiPose, view: ChibiView = 'side'): FxContext {
  let got: FxContext | undefined;
  paintChibi(d, { ...p, fx: { ...p.fx, extra: (x) => (got = x) } }, view, BOX);
  if (!got) throw new Error('fx.extra was not called');
  return got;
}

const near = (a: V3, b: V3, tol = 1e-6): boolean => len3(sub3(a, b)) < tol;

describe('an off-hand item', () => {
  const D = SPELLBLADE_MANNEQUIN;
  const P = SWORD_WAND_POSES;

  it('is held in the left hand at its own mirrored angles', () => {
    const base = P.guard as ChibiPose;
    const rig = solveRig(D.build, base, D.weapon.grip2);
    expect(near(rig.offhand.o, rig.armL.end)).toBe(true);
    // Straight up, forward, and down.
    for (const [deg, want] of [[0, [0, 1, 0]], [90, [1, 0, 0]], [180, [0, -1, 0]]] as [number, V3][]) {
      const r = solveRig(D.build, pose(base, { weaponB: deg, rollB: 0, yawB: 0 }), D.weapon.grip2);
      expect(len3(sub3(r.offhand.u, want)), `weaponB ${deg}`).toBeLessThan(1e-9);
    }
    // Roll and yaw carry it out to his left (negative r), mirroring the main weapon's.
    expect(solveRig(D.build, pose(base, { weaponB: 0, rollB: 30, yawB: 0 }), D.weapon.grip2).offhand.u[2]).toBeLessThan(-0.4);
    expect(solveRig(D.build, pose(base, { weaponB: 90, rollB: 0, yawB: 30 }), D.weapon.grip2).offhand.u[2]).toBeLessThan(-0.4);
    expect(solveRig(D.build, pose(base, { weapon: 0, roll: 30, yaw: 0 }), D.weapon.grip2).weapon.u[2]).toBeGreaterThan(0.4);
    // Dropped, it lies where the pose puts it.
    const dropped = solveRig(D.build, pose(base, { dropB: true, dropAtB: [12, 1, -6] }), D.weapon.grip2);
    expect(near(dropped.offhand.o, [12, 1, -6])).toBe(true);
  });

  it('is painted in every view, and leaving handB out puts that hand on the sword', () => {
    for (const view of CHIBI_VIEWS) {
      const p = pose(P.guard as ChibiPose, { weaponB: 40 });
      const withWand = paintChibi(D, p, view, BOX);
      const bare = paintChibi({ ...D, offhand: undefined }, p, view, BOX);
      expect(diff(bare, withWand).n, view).toBeGreaterThan(12);
    }
    const two = solveRig(D.build, P.overhead as ChibiPose, D.weapon.grip2);
    expect(two.twoHanded).toBe(true);
    expect(len3(sub3(two.armL.end, add3(two.weapon.o, two.weapon.u, D.weapon.grip2)))).toBeLessThan(1);
  });

  it('gives effects its tip, as tipB beside the main weapon tip', () => {
    const p = P.bolt as ChibiPose;
    const x = fxContext(D, p);
    const rig = solveRig(D.build, p, D.weapon.grip2);
    expect(near(x.tipB, add3(rig.offhand.o, rig.offhand.u, WAND.tip ?? WAND.reach[1]))).toBe(true);
    expect(near(x.tip, add3(rig.weapon.o, rig.weapon.u, D.weapon.reach[1]))).toBe(true);
    // Without an off-hand item, tipB is the bare left hand.
    const bare = fxContext({ ...D, offhand: undefined }, p);
    expect(near(bare.tipB, rig.armL.end)).toBe(true);
    // `behind` splits the world at the middle of the body, toward and away from the viewer.
    const front = fxContext(D, p, 'front');
    expect(front.behind([rig.pelvis.o[0] - 10, 30, 0])).toBe(true);
    expect(front.behind([rig.pelvis.o[0] + 10, 30, 0])).toBe(false);
  });

  it('glows with its own strength (fx.runeB) and sweeps its own smear (fx.smearB)', () => {
    const p = pose(P.guard as ChibiPose, { fx: {} });
    const rest = paintChibi(D, p, 'side', BOX);
    expect(diff(rest, paintChibi(D, pose(p, { fx: { runeB: 1 } }), 'side', BOX)).n).toBeGreaterThan(10);
    // The main weapon's rune does not light it.
    const swordOnly = paintChibi(D, pose(p, { fx: { rune: 1 } }), 'side', BOX);
    const both = paintChibi(D, pose(p, { fx: { rune: 1, runeB: 1 } }), 'side', BOX);
    expect(diff(swordOnly, both).n).toBeGreaterThan(10);
    const flick = P.flick as ChibiPose;
    const noSmear = paintChibi(D, pose(flick, { fx: { runeB: 0.8 } }), 'side', BOX);
    expect(diff(noSmear, paintChibi(D, flick, 'side', BOX)).inAir).toBeGreaterThan(20);
  });

  it('can be a second blade (twin blades)', () => {
    const twin: ChibiDesign = { ...D, offhand: SLENDER_SWORD };
    const p = pose(P.guard as ChibiPose, { weaponB: 70, fx: { runeB: 1, smearB: { from: -20 } } });
    const r = paintChibi(twin, p, 'front', BOX);
    expect(diff(paintChibi({ ...D, offhand: undefined }, p, 'front', BOX), r).n).toBeGreaterThan(60);
  });

  it('blends between poses only when both give its angles', () => {
    const a = P.guard as ChibiPose;
    const b = P.bolt as ChibiPose;
    const m = mix(a, b, 0.5);
    expect(m.weaponB).toBeCloseTo(((a.weaponB as number) + (b.weaponB as number)) / 2);
    expect(m.grip2).toBeUndefined();
    const c = mix(pose(a, { weaponB: undefined }), b, 0.25);
    expect(c.weaponB).toBeUndefined();
    expect(mix(pose(a, { weaponB: undefined }), b, 0.75).weaponB).toBe(b.weaponB);
  });
});

describe('a pole arm', () => {
  const D = HALBERD_MANNEQUIN;
  const P = HALBERD_POSES;

  it('reaches from its butt to the tip of its head, and smears use the head', () => {
    expect(HALBERD.tip).toBe(66);
    expect(HALBERD.reach[1]).toBe(66);
    // The head's reach starts below its lowest part (the axe's beard), well up the haft.
    expect(HALBERD.reach[0]).toBeLessThan(42);
    expect(HALBERD.reach[0]).toBeGreaterThan(30);
    const haft = HALBERD.haft as readonly [number, number];
    expect(haft[0]).toBeLessThan(-30);
    expect(haft[1]).toBeLessThan(HALBERD.reach[0]);
  });

  it('is held where the pose says along the haft', () => {
    const base = P.thrustBack as ChibiPose;
    for (const [grip, grip2] of [[-14, -3], [-14, 0], [-20, -8], [-8, 2]] as const) {
      const p = pose(base, { grip, grip2 });
      const rig = solveRig(D.build, p, D.weapon.grip2, D.weapon.haft);
      // The right hand at `grip` along it, the left at `grip2`.
      expect(near(add3(rig.weapon.o, rig.weapon.u, grip), rig.armR.end, 1e-6), `grip ${grip}`).toBe(true);
      expect(rig.grip2, `grip2 ${grip2}`).toBe(grip2);
      expect(len3(sub3(rig.armL.end, add3(rig.weapon.o, rig.weapon.u, grip2))), `grip2 ${grip2}`).toBeLessThan(0.3);
    }
  });

  it('keeps both hands on the haft in every pose of the mannequin, sliding one that cannot reach', () => {
    for (const [name, p] of Object.entries(P)) {
      const rig = solveRig(D.build, p, D.weapon.grip2, D.weapon.haft);
      expect(rig.twoHanded, name).toBe(true);
      const on = add3(rig.weapon.o, rig.weapon.u, rig.grip2);
      expect(len3(sub3(rig.armL.end, on)), name).toBeLessThan(0.6);
      // A hand that had to slide stays on the haft (between the butt and the head).
      const haft = D.weapon.haft as readonly [number, number];
      if (rig.grip2 !== (p.grip2 ?? D.weapon.grip2)) {
        expect(rig.grip2, name).toBeGreaterThanOrEqual(haft[0] - 1e-9);
        expect(rig.grip2, name).toBeLessThanOrEqual(haft[1] + 1e-9);
      }
    }
    // Asked for a place far out of reach, the left hand slides along the haft toward his shoulder.
    const far = pose(P.stance as ChibiPose, { grip2: 40 });
    const rig = solveRig(D.build, far, D.weapon.grip2, D.weapon.haft);
    expect(rig.grip2).toBeLessThan(40);
    expect(len3(sub3(rig.armL.end, add3(rig.weapon.o, rig.weapon.u, rig.grip2)))).toBeLessThan(0.3);
    // A sword (no haft) does not slide: its hand reaches for its place, as before.
    expect(solveRig(D.build, far, D.weapon.grip2).grip2).toBe(40);
  });

  it('streams its ribbon with the wind and turns with the pose in every view', () => {
    const calm = pose(P.stance as ChibiPose, { wind: 0, phase: 0, fx: undefined });
    const windy = pose(calm, { wind: 1 });
    // The wind stirs his hair too: the ribbon is what the weapon adds to that.
    const plain: ChibiDesign = { ...D, weapon: pole({ ...HALBERD_SPEC, ribbon: undefined }) };
    for (const view of CHIBI_VIEWS) {
      const hair = diff(paintChibi(plain, calm, view, BOX), paintChibi(plain, windy, view, BOX)).n;
      expect(diff(paintChibi(D, calm, view, BOX), paintChibi(D, windy, view, BOX)).n, view).toBeGreaterThan(hair + 12);
    }
  });

  it('sinks a planted butt into the ground', () => {
    const p = pose(P.plant as ChibiPose, { fx: undefined });
    const rig = solveRig(D.build, p, D.weapon.grip2, D.weapon.haft);
    const butt = add3(rig.weapon.o, rig.weapon.u, -42.5);
    expect(butt[1]).toBeLessThan(0);
    // Nothing of the weapon is painted far below the ground line under the butt.
    const r = paintChibi(D, p, 'side', BOX);
    const cam = camera('side', p.turn ?? 0, BOX.ax, BOX.ay);
    const g = cam.proj([butt[0], 0, butt[2]]);
    for (let y = Math.ceil(g[1]) + 3; y < r.h; y++) for (let x = Math.floor(g[0]) - 3; x <= Math.ceil(g[0]) + 3; x++) expect(alpha(r, x, y), `${x},${y}`).toBe(0);
  });
});

describe('the generic effects', () => {
  it('throws lightning from the wand tip, crackling with its seed', () => {
    const D = SPELLBLADE_MANNEQUIN;
    const p = SWORD_WAND_POSES.bolt as ChibiPose;
    const quiet = paintChibi(D, pose(p, { fx: { runeB: 1 } }), 'side', BOX);
    const bolt = paintChibi(D, p, 'side', BOX);
    const d = diff(quiet, bolt);
    expect(d.inAir).toBeGreaterThan(120);
    // It runs ahead of him, toward where the wand points.
    const x = fxContext(D, p);
    const tip = x.proj(x.tipB);
    let ahead = 0;
    for (let y = 0; y < BOX.h; y++) for (let xx = Math.ceil(tip[0]) + 20; xx < BOX.w; xx++) if (alpha(bolt, xx, y) && !alpha(quiet, xx, y)) ahead++;
    expect(ahead).toBeGreaterThan(40);
    const other = paintChibi(D, pose(p, { fx: { runeB: 1, lightning: { seed: 4 } } }), 'side', BOX);
    expect(sum(other)).not.toBe(sum(bolt));
    expect(sum(paintChibi(D, p, 'side', BOX))).toBe(sum(bolt));
    // Flying at the viewer it is opened out down the screen rather than shrinking to a stub.
    const front = diff(paintChibi(D, pose(p, { fx: { runeB: 1 } }), 'front', BOX), paintChibi(D, p, 'front', BOX));
    expect(front.n).toBeGreaterThan(100);
  });

  it('rings him with a ward, the near half over him and the far half behind', () => {
    const D = SPELLBLADE_MANNEQUIN;
    for (const dome of [false, true]) {
      const p = pose(SWORD_WAND_POSES.ward as ChibiPose, { fx: { ward: { k: 1, dome } } });
      for (const view of CHIBI_VIEWS) {
        const d = diff(paintChibi(D, pose(p, { fx: {} }), view, BOX), paintChibi(D, p, view, BOX));
        expect(d.onFigure, `${view} dome ${dome}`).toBeGreaterThan(20);
        expect(d.inAir, `${view} dome ${dome}`).toBeGreaterThan(150);
      }
    }
    // It grows in: faint and low at the start.
    const p0 = paintChibi(D, pose(SWORD_WAND_POSES.ward as ChibiPose, { fx: { ward: { k: 0.2 } } }), 'side', BOX);
    const p1 = paintChibi(D, SWORD_WAND_POSES.ward as ChibiPose, 'side', BOX);
    expect(sum(p0)).not.toBe(sum(p1));
  });

  it('winds a swirl of wind round a thrust and round a spin, running on with its spin', () => {
    const D = HALBERD_MANNEQUIN;
    for (const name of ['lunge', 'spin']) {
      const p = HALBERD_POSES[name] as ChibiPose;
      const bare = paintChibi(D, pose(p, { fx: { rune: 1 } }), 'side', BOX);
      const swirled = paintChibi(D, pose(p, { fx: { rune: 1, swirl: p.fx?.swirl } }), 'side', BOX);
      expect(diff(bare, swirled).n, name).toBeGreaterThan(60);
      const on = p.fx?.swirl as NonNullable<NonNullable<ChibiPose['fx']>['swirl']>;
      const later = paintChibi(D, pose(p, { fx: { rune: 1, swirl: { ...on, spin: (on.spin ?? 0) + 0.3 } } }), 'side', BOX);
      expect(sum(later), name).not.toBe(sum(swirled));
    }
    // A thrust's swirl runs out past the point.
    const p = HALBERD_POSES.lunge as ChibiPose;
    const x = fxContext(D, p);
    const tip = x.proj(x.tip);
    const r = paintChibi(D, p, 'side', BOX);
    let past = 0;
    for (let y = 0; y < BOX.h; y++) for (let xx = Math.ceil(tip[0]) + 4; xx < BOX.w; xx++) if (alpha(r, xx, y)) past++;
    expect(past).toBeGreaterThan(20);
  });

  it('trails afterimages behind a dash, never over the figure', () => {
    const D = SPELLBLADE_MANNEQUIN;
    const p = SWORD_WAND_POSES.dash as ChibiPose;
    const plain = paintChibi(D, pose(p, { fx: {} }), 'side', BOX);
    const ghosts = paintChibi(D, pose(p, { fx: { ghosts: { k: 1 } } }), 'side', BOX);
    const d = diff(plain, ghosts);
    expect(d.onFigure).toBe(0);
    expect(d.inAir).toBeGreaterThan(200);
    // Behind him: side on he faces right, so they lie to his left.
    const b = bounds(plain);
    const g = bounds(ghosts);
    expect(g.x0).toBeLessThan(b.x0 - 8);
    expect(g.x1).toBe(b.x1);
    // In the other views they still show.
    for (const view of ['front', 'back'] as const) expect(diff(paintChibi(D, pose(p, { fx: {} }), view, BOX), paintChibi(D, pose(p, { fx: { ghosts: { k: 1 } } }), view, BOX)).inAir, view).toBeGreaterThan(100);
  });
});

describe('the gear mannequins', () => {
  const all: [ChibiDesign, Record<string, ChibiPose>][] = [
    [SPELLBLADE_MANNEQUIN, SWORD_WAND_POSES],
    [HALBERD_MANNEQUIN, HALBERD_POSES],
  ];

  it('paint every pose in every view inside the frame, the same pixels every time', () => {
    for (const [d, poses] of all) {
      for (const [name, p] of Object.entries(poses)) {
        for (const view of CHIBI_VIEWS) {
          const r = paintChibi(d, p, view, BOX);
          const b = bounds(r);
          expect(b.x0, `${d.id} ${name} ${view}`).toBeGreaterThan(0);
          expect(b.y0, `${d.id} ${name} ${view}`).toBeGreaterThan(0);
          expect(b.x1, `${d.id} ${name} ${view}`).toBeLessThan(BOX.w - 1);
          expect(b.y1, `${d.id} ${name} ${view}`).toBeLessThan(BOX.h - 1);
          expect(sum(paintChibi(d, p, view, BOX)), `${d.id} ${name} ${view}`).toBe(sum(r));
        }
      }
    }
  });

  it('paint fast enough with the new gear and effects (well within what the Dark Knight takes)', () => {
    // Against the Dark Knight painted in the same breath, so a busy machine slows both alike; they
    // paint at about 0.65 of his time today, so this fails if they come to take twice as long.
    const box = { w: 256, h: 232, ax: 112, ay: 180 };
    const work = all.flatMap(([d, poses]) => Object.values(poses).flatMap((p) => CHIBI_VIEWS.map((view) => () => paintChibi(d, p, view, box))));
    const t = timeAgainst([...work, ...work], darkKnightFrames());
    expect(t.ratio, `${t.ratio.toFixed(2)} of the Dark Knight's time (${t.ms.toFixed(2)} ms a frame against his ${t.refMs.toFixed(2)} ms)`).toBeLessThan(1.25);
  });

  it('keep the off-hand item and the pole arm on their own axes (u along, v across, n the flat)', () => {
    for (const [d, poses] of all) {
      for (const p of Object.values(poses)) {
        const rig = solveRig(d.build, p, d.weapon.grip2, d.weapon.haft);
        for (const g of [rig.weapon, rig.offhand]) {
          expect(len3(g.u)).toBeCloseTo(1);
          expect(Math.abs(dot3(g.u, g.v))).toBeLessThan(1e-9);
          expect(Math.abs(dot3(g.u, g.n))).toBeLessThan(1e-9);
        }
      }
    }
  });
});
