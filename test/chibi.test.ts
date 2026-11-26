import { describe, expect, it } from 'vitest';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiClip, type ChibiHero, type ChibiView } from '../src/client/art/heroes/chibi/index.js';
import { cropRaster, opaqueBounds } from '../src/client/art/atlas.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { type ChibiPose, solveRig } from '../src/client/art/heroes/chibi/rig.js';
import type { Raster } from '../src/client/art/heroes/paint.js';

/** Every registered chibi hero: each gets the generic checks below, read from its own data. */
const HEROES = Object.values(CHIBI_HEROES).filter((h): h is ChibiHero => !!h);

/** Clips every hero stands on the ground in, in every frame (a hero may add its own: see the Dark Knight's below). */
const STANDING: ChibiClip[] = ['idle', 'battle', 'kneel'];

function bounds(r: Raster): { x0: number; y0: number; x1: number; y1: number; n: number } {
  let x0 = r.w;
  let y0 = r.h;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      if ((r.data[(y * r.w + x) * 4 + 3] as number) === 0) continue;
      n++;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, n };
}

/** A quick checksum of a frame's pixels. */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

/** Does a solid (fully opaque) pixel lie in this box of the frame? */
function solidIn(r: Raster, x0: number, x1: number, y0: number, y1: number): boolean {
  for (let y = Math.max(0, y0); y <= Math.min(r.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(r.w - 1, x1); x++) if ((r.data[(y * r.w + x) * 4 + 3] as number) === 255) return true;
  }
  return false;
}

/** A frame of a hero without its effects: the figure alone. */
const figure = (hero: ChibiHero, clip: ChibiClip, i: number, view: ChibiView): Raster => paintChibi(hero.design, { ...(hero.poses[clip][i] as ChibiPose), fx: undefined }, view, hero.frame[view]);

/** Checks that a hero's planted foot is on the ground and its boots are painted on the ground line, and that the figure fits its frame. */
function expectStanding(hero: ChibiHero, clip: ChibiClip): void {
  const d = hero.design;
  for (const view of CHIBI_VIEWS) {
    const box = hero.frame[view];
    for (let i = 0; i < hero.timing[clip].frames; i++) {
      const r = figure(hero, clip, i, view);
      const b = bounds(r);
      // A foot is planted on the ground, and its boot is painted on the ground line under it: at
      // the anchor's row, or a few pixels below it for a foot nearer the viewer (the camera looks
      // down a little).
      const rig = solveRig(d.build, hero.poses[clip][i] as ChibiPose, d.weapon.grip2, d.weapon.haft);
      const lowest = Math.min(rig.legR.end[1], rig.legL.end[1]) - d.build.ankle;
      expect(Math.abs(lowest), `${hero.id} ${clip} ${i}: lowest foot ${lowest.toFixed(1)} above the ground`).toBeLessThan(1.2);
      expect(solidIn(r, box.ax - 16, box.ax + 18, box.ay - 1, box.ay + 6), `${hero.id} ${clip} ${i} ${view}: boots on the ground`).toBe(true);
      // Inside the frame with a margin.
      expect(b.x0, `${hero.id} ${clip} ${i} ${view}`).toBeGreaterThan(0);
      expect(b.y0, `${hero.id} ${clip} ${i} ${view}`).toBeGreaterThan(0);
      expect(b.x1, `${hero.id} ${clip} ${i} ${view}`).toBeLessThan(box.w - 1);
      expect(b.y1, `${hero.id} ${clip} ${i} ${view}`).toBeLessThan(box.h - 1);
    }
  }
}

describe.each(HEROES.map((h) => [h.id, h] as const))('chibi hero %s', (_id, hero) => {
  it('stands as tall as its data says, a hero-sized figure in game', () => {
    const r = hero.paint('idle', 0, 'side');
    const tall = hero.frame.side.ay - bounds(r).y0 + 1;
    expect(Math.abs(tall - hero.height), `${tall} px tall, ${hero.height} expected`).toBeLessThanOrEqual(hero.height * 0.08);
    expect(hero.height * hero.scale).toBeGreaterThan(1.6);
    expect(hero.height * hero.scale).toBeLessThan(2.6);
  });

  it('has a pose for every frame its timing promises', () => {
    for (const clip of CHIBI_CLIPS) {
      const t = hero.timing[clip];
      expect(hero.poses[clip]?.length, clip).toBe(t.frames);
      expect(t.windup).toBeLessThan(t.frames);
      expect(t.seconds).toBeGreaterThan(0);
    }
  });

  it('paints every frame of every clip in every view, the same pixels every time', () => {
    for (const view of CHIBI_VIEWS) {
      const box = hero.frame[view];
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i++) {
          const a = hero.paint(clip, i, view);
          expect(a.w).toBe(box.w);
          expect(a.h).toBe(box.h);
          // Something the size of a hero (about 600 pixels for one 84 tall).
          expect(bounds(a).n, `${clip} ${i} ${view}`).toBeGreaterThan(hero.height * 6);
          if (i % 3 === 0) expect(Buffer.from(hero.paint(clip, i, view).data).equals(Buffer.from(a.data)), `${clip} ${i} ${view}`).toBe(true);
        }
      }
    }
  });

  it('stands on the ground anchor and stays inside the frame in its standing clips', () => {
    for (const clip of STANDING) expectStanding(hero, clip);
  });

  it('keeps even the leaps, swings and effects inside the frame', () => {
    for (const view of CHIBI_VIEWS) {
      const box = hero.frame[view];
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i++) {
          const b = bounds(hero.paint(clip, i, view));
          // Nothing touches an edge, effects included: anything there would have been cut off.
          expect(b.x0, `${clip} ${i} ${view} left`).toBeGreaterThan(0);
          expect(b.y0, `${clip} ${i} ${view} top`).toBeGreaterThan(0);
          expect(b.x1, `${clip} ${i} ${view} right`).toBeLessThan(box.w - 1);
          expect(b.y1, `${clip} ${i} ${view} bottom`).toBeLessThan(box.h - 1);
        }
      }
    }
  });

  it('paints a clean figure: no stray pixels, hardly a pinhole', () => {
    let holes = 0;
    for (const view of CHIBI_VIEWS) {
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i += 2) {
          const r = figure(hero, clip, i, view);
          const op = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.w && y < r.h && (r.data[(y * r.w + x) * 4 + 3] as number) > 0;
          for (let y = 0; y < r.h; y++) {
            for (let x = 0; x < r.w; x++) {
              if (op(x, y)) {
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && op(x + dx, y + dy)) n++;
                expect(n, `${view} ${clip} ${i}: a stray pixel at ${x},${y}`).toBeGreaterThan(2);
              } else if (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) holes++;
            }
          }
        }
      }
    }
    expect(holes).toBeLessThanOrEqual(6);
  });

  it('changes pose from frame to frame (no clip is a still)', () => {
    for (const view of CHIBI_VIEWS) {
      for (const clip of CHIBI_CLIPS) {
        const sums = Array.from({ length: hero.timing[clip].frames }, (_, i) => sum(hero.paint(clip, i, view)));
        // No frame repeats the one before it, and most of the clip's frames are distinct.
        for (let i = 1; i < sums.length; i++) expect(sums[i], `${view} ${clip} ${i}`).not.toBe(sums[i - 1]);
        expect(new Set(sums).size, `${view} ${clip}`).toBeGreaterThan(Math.min(3, sums.length - 1));
      }
    }
  }, 60_000);

  it('shows the three views differently (a real turn, not one sprite)', () => {
    // Each view painted into the same box, then cropped to the figure, so like is compared with like.
    const box = hero.frame.side;
    const crop = (view: ChibiView) => {
      const r = paintChibi(hero.design, hero.poses.battle[0] as ChibiPose, view, box);
      return Buffer.from(cropRaster(r, opaqueBounds(r)).data);
    };
    const side = crop('side');
    const front = crop('front');
    const back = crop('back');
    // The comparison can tell frames apart and can match them: the same pose and view matches.
    const own = hero.paint('battle', 0, 'side');
    expect(side.equals(Buffer.from(cropRaster(own, opaqueBounds(own)).data))).toBe(true);
    expect(side.equals(front)).toBe(false);
    expect(front.equals(back)).toBe(false);
    expect(side.equals(back)).toBe(false);
  });

  it('paints fast enough to build every atlas in the background', () => {
    for (const view of CHIBI_VIEWS) {
      let n = 0;
      const t0 = performance.now();
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i++) {
          hero.paint(clip, i, view);
          n++;
        }
      }
      const ms = (performance.now() - t0) / n;
      expect(ms, `${view}: ${ms.toFixed(2)} ms a frame`).toBeLessThan(20);
    }
  });
});

describe('the chibi Dark Knight', () => {
  const hero = CHIBI_HEROES['hero-tank-male']!;

  it('is registered for the male Warrior, about 2.1 tiles tall', () => {
    expect(hero.id).toBe('hero-tank-male');
    const tall = hero.frame.side.ay - bounds(hero.paint('idle', 0, 'side')).y0 + 1;
    expect(tall).toBeGreaterThan(78);
    expect(tall).toBeLessThan(96);
    expect(tall * hero.scale).toBeGreaterThan(1.95);
    expect(tall * hero.scale).toBeLessThan(2.3);
  });

  it('has his own clip lengths', () => {
    expect(hero.timing.ult.frames).toBe(16);
    expect(hero.timing.e.frames).toBe(10);
  });

  it('stands on the ground through his parry and his cast as well', () => {
    expectStanding(hero, 'special');
    expectStanding(hero, 'cast');
  });

  it('paints these frames pixel for pixel as he always has', () => {
    // Checksums of a spread of his frames (every clip, all three views), so engine work for other
    // heroes cannot change him by accident. If a change to him is meant, update them and say so.
    const FRAMES: [ChibiClip, number, ChibiView, number][] = [
      ['idle', 0, 'side', 1886695061],
      ['battle', 3, 'front', 336219195],
      ['move', 3, 'front', 965346862],
      ['atk1', 4, 'side', 3821045740],
      ['atk2', 3, 'back', 3484555171],
      ['atk3', 5, 'back', 1412293904],
      ['atk3', 6, 'back', 326037919],
      ['special', 2, 'side', 1396846370],
      ['q', 3, 'side', 3442848922],
      ['q', 3, 'front', 1823779786],
      ['e', 4, 'side', 1448222070],
      ['r', 6, 'front', 3228004353],
      ['ult', 9, 'back', 2638144137],
      ['cast', 4, 'side', 3594663198],
      ['hurt', 1, 'front', 2264542648],
      ['kneel', 2, 'back', 3707032246],
      ['ko', 5, 'front', 2280277275],
      ['victory', 4, 'back', 3458521680],
      ['victory', 7, 'back', 707703991],
    ];
    for (const [clip, i, view, want] of FRAMES) expect(sum(hero.paint(clip, i, view)), `${clip} ${i} ${view}`).toBe(want);
  });
});
