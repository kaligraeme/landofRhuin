/**
 * Packing painted frames into atlases: each frame is cropped to its opaque pixels (painted frames
 * are mostly empty space left for swings and leaps), and the crops are shelf-packed into one
 * compact image. Pure functions on rasters, so they can be tested without a browser.
 */
import type { Raster } from './heroes/paint.js';

/** The largest atlas side we build: comfortably inside every browser's canvas limits. */
export const ATLAS_MAX = 4096;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The box around a raster's opaque pixels, grown by `margin` on every side (it may reach past the
 * raster's edges; those pixels are transparent). A blank raster gives a 1 x 1 box at `fallback`.
 */
export function opaqueBounds(r: Raster, margin = 1, fallback: { x: number; y: number } = { x: 0, y: 0 }): Rect {
  let x0 = r.w;
  let x1 = -1;
  let y0 = r.h;
  let y1 = -1;
  for (let y = 0; y < r.h; y++) {
    const row = y * r.w * 4;
    for (let x = 0; x < r.w; x++) {
      if ((r.data[row + x * 4 + 3] as number) === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y0 > y) y0 = y;
      y1 = y;
    }
  }
  if (x1 < 0) return { x: Math.round(fallback.x), y: Math.round(fallback.y), w: 1, h: 1 };
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 1 + margin * 2, h: y1 - y0 + 1 + margin * 2 };
}

/** Copies a box out of a raster; the parts of the box outside the raster come out transparent. */
export function cropRaster(r: Raster, box: Rect): Raster {
  const data = new Uint8ClampedArray(box.w * box.h * 4);
  const xa = Math.max(0, box.x);
  const xb = Math.min(r.w, box.x + box.w);
  if (xb > xa) {
    for (let y = Math.max(0, box.y); y < Math.min(r.h, box.y + box.h); y++) {
      const from = (y * r.w + xa) * 4;
      data.set(r.data.subarray(from, from + (xb - xa) * 4), ((y - box.y) * box.w + (xa - box.x)) * 4);
    }
  }
  return { w: box.w, h: box.h, data };
}

export interface Packing {
  w: number;
  h: number;
  /** Where each input box goes, in input order. */
  at: { x: number; y: number }[];
}

function shelves(sizes: readonly { w: number; h: number }[], order: number[], width: number): Packing {
  const at: { x: number; y: number }[] = sizes.map(() => ({ x: 0, y: 0 }));
  let x = 0;
  let y = 0;
  let shelf = 0;
  let used = 0;
  for (const i of order) {
    const s = sizes[i] as { w: number; h: number };
    if (x > 0 && x + s.w > width) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    at[i] = { x, y };
    x += s.w;
    used = Math.max(used, x);
    shelf = Math.max(shelf, s.h);
  }
  return { w: Math.max(1, used), h: Math.max(1, y + shelf), at };
}

/**
 * Shelf-packs boxes, tallest first, into an image about as wide as it is tall. Widens the image
 * if it would run past `max` tall; throws if the boxes cannot fit in `max` x `max`.
 */
export function shelfPack(sizes: readonly { w: number; h: number }[], max = ATLAS_MAX): Packing {
  if (!sizes.length) return { w: 1, h: 1, at: [] };
  const order = sizes.map((_, i) => i).sort((a, b) => (sizes[b] as { h: number }).h - (sizes[a] as { h: number }).h || a - b);
  const area = sizes.reduce((sum, s) => sum + s.w * s.h, 0);
  const widest = Math.max(...sizes.map((s) => s.w));
  let width = Math.min(max, Math.max(widest, Math.ceil(Math.sqrt(area * 1.1))));
  for (;;) {
    const packed = shelves(sizes, order, width);
    if (packed.h <= max && packed.w <= max) return packed;
    if (width >= max) throw new Error(`Frames do not fit in a ${max} x ${max} atlas`);
    width = Math.min(max, Math.ceil(width * 1.2));
  }
}
