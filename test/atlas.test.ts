import { describe, expect, it } from 'vitest';
import { ATLAS_MAX, cropRaster, opaqueBounds, shelfPack } from '../src/client/art/atlas.js';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS } from '../src/client/art/heroes/chibi/index.js';
import type { Raster } from '../src/client/art/heroes/paint.js';

function raster(w: number, h: number, dots: [number, number][]): Raster {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of dots) data.set([200, 100, 50, 255], (y * w + x) * 4);
  return { w, h, data };
}

describe('cropping frames', () => {
  it('boxes the opaque pixels with a pixel of margin, even past the edge', () => {
    const r = raster(20, 10, [[4, 3], [9, 7]]);
    expect(opaqueBounds(r)).toEqual({ x: 3, y: 2, w: 8, h: 7 });
    expect(opaqueBounds(raster(20, 10, [[0, 0]]))).toEqual({ x: -1, y: -1, w: 3, h: 3 });
    expect(opaqueBounds(raster(20, 10, []), 1, { x: 7, y: 8 })).toEqual({ x: 7, y: 8, w: 1, h: 1 });
  });

  it('copies the box, transparent outside the raster', () => {
    const r = raster(5, 5, [[0, 0], [4, 4]]);
    const c = cropRaster(r, opaqueBounds(r));
    expect([c.w, c.h]).toEqual([7, 7]);
    const alpha = (x: number, y: number) => c.data[(y * c.w + x) * 4 + 3];
    expect(alpha(1, 1)).toBe(255);
    expect(alpha(5, 5)).toBe(255);
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(6, 6)).toBe(0);
    expect(alpha(3, 3)).toBe(0);
  });
});

describe('shelf packing', () => {
  const overlaps = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('packs boxes without overlap inside the atlas, roughly square', () => {
    const sizes = Array.from({ length: 120 }, (_, i) => ({ w: 40 + ((i * 37) % 120), h: 50 + ((i * 53) % 110) }));
    const p = shelfPack(sizes);
    const rects = sizes.map((s, i) => ({ ...s, ...p.at[i]! }));
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(p.w);
      expect(r.y + r.h).toBeLessThanOrEqual(p.h);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
    const area = sizes.reduce((a, s) => a + s.w * s.h, 0);
    expect(p.w * p.h).toBeLessThan(area * 1.6);
    expect(Math.max(p.w, p.h) / Math.min(p.w, p.h)).toBeLessThan(2);
  });

  it('widens rather than grow past the limit, and refuses what cannot fit', () => {
    // At the width it starts from (about the square root of the area) these stack 310 tall.
    const sizes = [{ w: 10, h: 250 }, ...Array.from({ length: 60 }, () => ({ w: 10, h: 10 }))];
    const area = sizes.reduce((a, s) => a + s.w * s.h, 0);
    const p = shelfPack(sizes, 300);
    expect(p.h).toBeLessThanOrEqual(300);
    expect(p.w).toBeLessThanOrEqual(300);
    expect(p.w).toBeGreaterThan(Math.ceil(Math.sqrt(area * 1.1)));
    const rects = sizes.map((s, i) => ({ ...s, ...p.at[i]! }));
    for (const r of rects) expect(r.y + r.h).toBeLessThanOrEqual(p.h);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
    expect(() => shelfPack(Array.from({ length: 100 }, () => ({ w: 100, h: 100 })), 300)).toThrow();
  });

  it("fits a chibi hero's every frame in one compact atlas per view", () => {
    const hero = CHIBI_HEROES['hero-dark-knight']!;
    for (const view of CHIBI_VIEWS) {
      const crops = CHIBI_CLIPS.flatMap((clip) => Array.from({ length: hero.timing[clip].frames }, (_, i) => opaqueBounds(hero.paint(clip, i, view))));
      const p = shelfPack(crops);
      expect(Math.max(p.w, p.h)).toBeLessThan(ATLAS_MAX);
      const box = hero.frame[view];
      // Cropping pays: far smaller than packing the whole frames.
      expect(p.w * p.h).toBeLessThan(crops.length * box.w * box.h * 0.75);
    }
  });
});
