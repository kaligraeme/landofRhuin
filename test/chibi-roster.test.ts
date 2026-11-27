import { describe, expect, it } from 'vitest';
import { hex, type Raster, type RGB } from '../src/client/art/heroes/paint.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { beard } from '../src/client/art/heroes/chibi/head.js';
import { NO_WEAPON } from '../src/client/art/heroes/chibi/held.js';
import { CHIBI_VIEWS } from '../src/client/art/heroes/chibi/index.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { pole } from '../src/client/art/heroes/chibi/pole.js';
import { flat } from '../src/client/art/heroes/chibi/raster.js';
import { add3, camera, type ChibiPose, type ChibiView, mul3, pose, solveRig } from '../src/client/art/heroes/chibi/rig.js';
import { BEARDED_SAGE, CREST_LANCER, HOODED_ARCHER, ROSTER, ROSTER_BOX as BOX } from './chibi-roster-mannequins.js';
import { ARCHER_CLIPS, STAFF_CLIPS } from './chibi-kit-mannequins.js';
import { ROBED, SPIN, STAND } from './chibi-mannequins.js';
import { darkKnightFrames, timeAgainst } from './paint-timing.js';

/** A quick checksum of a frame's pixels (as in chibi.test.ts). */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

const alpha = (r: Raster, x: number, y: number): number => r.data[(y * r.w + x) * 4 + 3] as number;
const rgb = (r: Raster, x: number, y: number): RGB => [r.data[(y * r.w + x) * 4] as number, r.data[(y * r.w + x) * 4 + 1] as number, r.data[(y * r.w + x) * 4 + 2] as number];
const isAny = (c: RGB, cols: readonly RGB[]): boolean => cols.some((k) => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]);

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

/** How many opaque pixels of a frame are one of these colours (within rows `y0` to `y1` if given). */
function count(r: Raster, cols: readonly RGB[], y0 = 0, y1 = r.h - 1): number {
  let n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(r.h - 1, y1); y++) for (let x = 0; x < r.w; x++) if (alpha(r, x, y) === 255 && isAny(rgb(r, x, y), cols)) n++;
  return n;
}

const paint = (d: ChibiDesign, p: ChibiPose, view: ChibiView): Raster => paintChibi(d, p, view, BOX);
const hairOf = (d: ChibiDesign): RGB[] => [...d.head.hair.tones, d.head.hair.line];

describe('the roster mannequins (body and gear together)', () => {
  it('paint every pose in every view inside the frame, the same pixels every time', () => {
    for (const { design: d, clips } of ROSTER) {
      for (const [name, poses] of Object.entries(clips)) {
        for (const [i, p] of poses.entries()) {
          for (const view of CHIBI_VIEWS) {
            const r = paint(d, p, view);
            const b = bounds(r);
            const at = `${d.id} ${name} ${i} ${view}`;
            expect(b.x0, at).toBeGreaterThan(0);
            expect(b.y0, at).toBeGreaterThan(0);
            expect(b.x1, at).toBeLessThan(BOX.w - 1);
            expect(b.y1, at).toBeLessThan(BOX.h - 1);
            if (i === 0) expect(sum(paint(d, p, view)), at).toBe(sum(r));
          }
        }
      }
    }
  });

  it('paint fast enough (well within what the Dark Knight takes, timed alongside him)', () => {
    // In a hero-sized frame, against the Dark Knight painted in the same breath, so a busy machine
    // slows both alike: they take 0.65 to 1.1 of his time today.
    const box = { w: 224, h: 240, ax: 112, ay: 172 };
    const knight = darkKnightFrames();
    for (const { design, clips } of ROSTER) {
      const work = Object.values(clips).flat().flatMap((p) => CHIBI_VIEWS.map((view) => () => paintChibi(design, p, view, box)));
      const t = timeAgainst(work, knight);
      expect(t.ratio, `${design.id}: ${t.ratio.toFixed(2)} of the Dark Knight's time (${t.ms.toFixed(2)} ms a frame against his ${t.refMs.toFixed(2)} ms)`).toBeLessThan(1.75);
    }
  });
});

describe('a quiver worn over a cowl', () => {
  const wood: RGB[] = [[192, 122, 76], [154, 88, 52], [108, 58, 32], [64, 32, 15]];
  // The cowl is the second outfit piece (after the hood worn down).
  const noCowl: ChibiDesign = { ...HOODED_ARCHER, outfit: HOODED_ARCHER.outfit.filter((_, i) => i !== 1) };

  it('lies over the cowl from every side its back is seen from, not only straight behind', () => {
    let seen = 0;
    for (const p of ARCHER_CLIPS.spin as readonly ChibiPose[]) {
      for (const view of CHIBI_VIEWS) {
        const rig = solveRig(HOODED_ARCHER.build, p, HOODED_ARCHER.weapon.grip2);
        if (camera(view, p.turn ?? 0, BOX.ax, BOX.ay).facing(mul3(rig.chest.f, -1)) < 0.5) continue;
        const bare = count(paint(noCowl, p, view), wood);
        expect(bare, `${view} ${p.turn}`).toBeGreaterThan(30);
        expect(count(paint(HOODED_ARCHER, p, view), wood), `${view} ${p.turn}`).toBeGreaterThanOrEqual(Math.floor(bare * 0.9));
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(6);
  });
});

describe('long hair under gear on the head', () => {
  const still = pose(STAND, { wind: 0 });

  it('comes out from under a helm\'s back edge rather than vanishing under it', () => {
    const bald: ChibiDesign = { ...CREST_LANCER, head: { ...CREST_LANCER.head, long: undefined } };
    const hair = hairOf(CREST_LANCER);
    expect(count(paint(CREST_LANCER, still, 'back'), hair)).toBeGreaterThan(count(paint(bald, still, 'back'), hair) + 60);
    // Side on, streaming back in the wind.
    const gust = pose(STAND, { wind: 1, phase: 0.2 });
    expect(count(paint(CREST_LANCER, gust, 'side'), hair)).toBeGreaterThan(count(paint(bald, gust, 'side'), hair) + 10);
    // Down his back, below the base of his neck: the curtain hangs there seen from behind.
    const rig = solveRig(CREST_LANCER.build, still, CREST_LANCER.weapon.grip2);
    const neck = camera('back', 0, BOX.ax, BOX.ay).proj(add3(rig.neck, rig.chest.u, -4));
    expect(count(paint(CREST_LANCER, still, 'back'), hair, Math.round(neck[1]), BOX.h - 1)).toBeGreaterThan(count(paint(bald, still, 'back'), hair, Math.round(neck[1]), BOX.h - 1) + 20);
  });

  it('a tail tied under a helm comes out below it too', () => {
    const tail = { yaw: 180, pitch: 24, dir: [-0.6, -1, 0] as const, len: 18, w: 3, tie: { mat: flat(hex('#00ff00')), r: 1.2 } };
    const tied: ChibiDesign = { ...CREST_LANCER, head: { ...CREST_LANCER.head, long: { tail } } };
    const bald: ChibiDesign = { ...CREST_LANCER, head: { ...CREST_LANCER.head, long: undefined } };
    expect(count(paint(tied, still, 'back'), hairOf(tied))).toBeGreaterThan(count(paint(bald, still, 'back'), hairOf(tied)) + 30);
  });

  it('stays hidden under a hood worn up, and shows with the hood down', () => {
    const long: ChibiDesign = { ...HOODED_ARCHER, head: { ...HOODED_ARCHER.head, long: { back: ROBED.head.long?.back } } };
    const hair = hairOf(long);
    expect(count(paint(long, still, 'back'), hair)).toBe(count(paint(HOODED_ARCHER, still, 'back'), hair));
    const down = pose(still, { hood: 'down' });
    expect(count(paint(long, down, 'back'), hair)).toBeGreaterThan(count(paint(HOODED_ARCHER, down, 'back'), hair) + 100);
  });
});

describe('a beard and a staff', () => {
  // The sage's beard and his staff's haft in flat colours of their own, to tell them apart.
  const BEARD = hex('#ff00ff');
  const HAFT = hex('#00ff80');
  const GOLD = flat(hex('#ffd000'));
  const staff = pole({ haft: { from: -36, to: 34, r: 1.35, mat: flat(HAFT) }, metal: GOLD, edge: GOLD, grip2: -10, orb: { at: 40.5, r: 5, mat: flat(hex('#80c0ff')), glow: hex('#9ad8ff'), holder: { kind: 'claws', mat: GOLD } } });
  const d: ChibiDesign = { ...BEARDED_SAGE, weapon: staff, head: { ...BEARDED_SAGE.head, beard: beard({ kind: 'full', len: 15, mat: flat(BEARD) }) } };

  /** Where the haft runs on screen in a pose and view, at points along it. */
  const haftAt = (p: ChibiPose, view: ChibiView, u: number): [number, number] => {
    const rig = solveRig(d.build, p, d.weapon.grip2, d.weapon.haft);
    const q = camera(view, p.turn ?? 0, BOX.ax, BOX.ay).proj(add3(rig.weapon.o, rig.weapon.u, u));
    return [Math.round(q[0]), Math.round(q[1])];
  };

  it('a staff held across the chest passes behind the beard lying on it, in every view of a turn', () => {
    // Held level across his chest at the beard's depth: wherever the haft crosses the beard on
    // screen (the beard shows there without the staff, the haft without the beard's tresses), the
    // haft does not show over the beard.
    const shaven: ChibiDesign = { ...d, head: { ...d.head, beard: { ...(d.head.beard as NonNullable<ChibiDesign['head']['beard']>), hang: [] } } };
    const unarmed: ChibiDesign = { ...d, weapon: NO_WEAPON };
    let crossings = 0;
    for (const p of SPIN.map((q): ChibiPose => ({ ...q, handB: undefined, grip2: -12, handF: [6, 6, 10], weapon: 90, yaw: 80, fx: undefined }))) {
      for (const view of CHIBI_VIEWS) {
        const a = paint(d, p, view);
        const noHaft = paint(unarmed, p, view);
        const noBeard = paint(shaven, p, view);
        for (let u = -30; u <= 30; u += 0.5) {
          const [x, y] = haftAt(p, view, u);
          if (x < 0 || y < 0 || x >= BOX.w || y >= BOX.h) continue;
          if (!isAny(rgb(noHaft, x, y), [BEARD]) || !isAny(rgb(noBeard, x, y), [HAFT])) continue;
          crossings++;
          expect(isAny(rgb(a, x, y), [HAFT]), `${view} turn ${p.turn} at ${u}`).toBe(false);
        }
      }
    }
    expect(crossings).toBeGreaterThan(10);
  });

  it('a staff held out in front passes over the beard', () => {
    // Planted ahead of him and seen from the front: the haft runs up in front of his beard.
    const p = (STAFF_CLIPS.raise as readonly ChibiPose[])[1] as ChibiPose;
    const r = paint(d, { ...p, fx: undefined }, 'front');
    let over = 0;
    for (let u = -10; u <= 30; u += 0.5) {
      const [x, y] = haftAt(p, 'front', u);
      if (isAny(rgb(r, x, y), [HAFT])) over++;
      expect(isAny(rgb(r, x, y), [BEARD]), `at ${u}`).toBe(false);
    }
    expect(over).toBeGreaterThan(20);
  });
});
