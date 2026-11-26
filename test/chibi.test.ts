import { describe, expect, it } from 'vitest';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiClip } from '../src/client/art/heroes/chibi/index.js';
import { CORE_CLIPS } from '../src/client/art/heroes/chibi/moves-core.js';
import { SKILL_CLIPS_DK } from '../src/client/art/heroes/chibi/moves-skills.js';
import { STATE_CLIPS } from '../src/client/art/heroes/chibi/moves-states.js';
import { DARK_KNIGHT } from '../src/client/art/heroes/chibi/darkKnight.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { type ChibiPose, solveRig } from '../src/client/art/heroes/chibi/rig.js';
import type { Raster } from '../src/client/art/heroes/paint.js';

const hero = CHIBI_HEROES['hero-tank-male']!;
const POSES = { ...CORE_CLIPS, ...SKILL_CLIPS_DK, ...STATE_CLIPS } as Record<ChibiClip, readonly ChibiPose[]>;

/** Clips where he stands on the ground in every frame. */
const STANDING: ChibiClip[] = ['idle', 'battle', 'guard', 'kneel', 'cast'];

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

describe('the chibi Dark Knight', () => {
  it('is registered for the male Warrior, about 2.1 tiles tall', () => {
    expect(hero.id).toBe('hero-tank-male');
    const r = hero.paint('idle', 0, 'side');
    const b = bounds(r);
    const tall = hero.frame.side.ay - b.y0 + 1;
    expect(tall).toBeGreaterThan(78);
    expect(tall).toBeLessThan(96);
    expect(tall * hero.scale).toBeGreaterThan(1.95);
    expect(tall * hero.scale).toBeLessThan(2.3);
  });

  it('has a pose for every frame its timing promises', () => {
    for (const clip of CHIBI_CLIPS) {
      const t = hero.timing[clip];
      expect(POSES[clip]?.length, clip).toBe(t.frames);
      expect(t.windup).toBeLessThan(t.frames);
      expect(t.seconds).toBeGreaterThan(0);
    }
    expect(hero.timing.ruination.frames).toBe(16);
    expect(hero.timing.eclipse.frames).toBe(10);
  });

  it('paints every frame of every clip in every view, the same pixels every time', () => {
    for (const view of CHIBI_VIEWS) {
      const box = hero.frame[view];
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i++) {
          const a = hero.paint(clip, i, view);
          expect(a.w).toBe(box.w);
          expect(a.h).toBe(box.h);
          expect(bounds(a).n, `${clip} ${i} ${view}`).toBeGreaterThan(600);
          if (i % 3 === 0) expect(Buffer.from(hero.paint(clip, i, view).data).equals(Buffer.from(a.data)), `${clip} ${i} ${view}`).toBe(true);
        }
      }
    }
  });

  it('stands on the ground anchor and stays inside the frame in standing clips', () => {
    for (const view of CHIBI_VIEWS) {
      const box = hero.frame[view];
      for (const clip of STANDING) {
        for (let i = 0; i < hero.timing[clip].frames; i++) {
          // The figure alone: effects (a rune circle on the floor) may spread past it.
          const r = paintChibi(DARK_KNIGHT, { ...(POSES[clip][i] as ChibiPose), fx: undefined }, view, box);
          const b = bounds(r);
          // A foot is planted on the ground, and its boot is painted on the ground line under him: at
          // the anchor's row, or a few pixels below it for a foot nearer the viewer (the camera
          // looks down a little).
          const rig = solveRig(DARK_KNIGHT.build, POSES[clip][i] as ChibiPose, DARK_KNIGHT.weapon.grip2);
          const lowest = Math.min(rig.legR.end[1], rig.legL.end[1]) - DARK_KNIGHT.build.ankle;
          expect(Math.abs(lowest), `${clip} ${i}: lowest foot ${lowest.toFixed(1)} above the ground`).toBeLessThan(1.2);
          expect(solidIn(r, box.ax - 16, box.ax + 18, box.ay - 1, box.ay + 6), `${clip} ${i} ${view}: boots on the ground`).toBe(true);
          // Inside the frame with a margin, and centred on the anchor.
          expect(b.x0, `${clip} ${i} ${view}`).toBeGreaterThan(0);
          expect(b.y0, `${clip} ${i} ${view}`).toBeGreaterThan(0);
          expect(b.x1, `${clip} ${i} ${view}`).toBeLessThan(box.w - 1);
          expect(b.y1, `${clip} ${i} ${view}`).toBeLessThan(box.h - 1);
        }
      }
    }
  });

  it('keeps even the leaps, swings and shockwaves inside the frame', () => {
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
      const box = hero.frame[view];
      for (const clip of CHIBI_CLIPS) {
        for (let i = 0; i < hero.timing[clip].frames; i += 2) {
          const r = paintChibi(DARK_KNIGHT, { ...(POSES[clip][i] as ChibiPose), fx: undefined }, view, box);
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
    const side = hero.paint('battle', 0, 'side');
    const front = hero.paint('battle', 0, 'front');
    const back = hero.paint('battle', 0, 'back');
    expect(Buffer.from(side.data).equals(Buffer.from(front.data))).toBe(false);
    expect(Buffer.from(front.data).equals(Buffer.from(back.data))).toBe(false);
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
