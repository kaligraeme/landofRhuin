/**
 * Every frame of every chibi hero, pinned pixel for pixel.
 *
 * `chibi-frames.json` holds a checksum of every frame of every clip in every view of every
 * registered hero (and form), so engine work for one hero cannot change another by accident: a
 * change to head.ts made for one hero's hair, say, fails here for every other hero it touches.
 * When a change to a hero's pixels is meant, repaint the checksums with
 *
 *   UPDATE_CHIBI_FRAMES=1 npx vitest run test/chibi-pinned.test.ts
 *
 * and say in the commit which heroes changed and why. (A run limited to some heroes with -t only
 * repaints theirs.)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiHero } from '../src/client/art/heroes/chibi/index.js';
import type { Raster } from '../src/client/art/heroes/paint.js';

const FILE = new URL('./chibi-frames.json', import.meta.url);
const UPDATE = !!process.env.UPDATE_CHIBI_FRAMES;

/** Hero id, then `clip/view`, then the frames' checksums in order, separated by spaces. */
type Pins = Record<string, Record<string, string>>;

function load(): Pins {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Pins;
  } catch (e) {
    if (UPDATE) return {};
    throw e;
  }
}

const pinned = load();
const HEROES = Object.values(CHIBI_HEROES).filter((h): h is ChibiHero => !!h);

/** A checksum of a frame's pixels (32-bit FNV-1a over its RGBA bytes), as eight hex digits. */
function checksum(r: Raster): string {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Every frame of a hero, painted and summed, keyed as in the file. */
function paintAll(hero: ChibiHero): Record<string, string> {
  const out: Record<string, string> = {};
  for (const clip of CHIBI_CLIPS) {
    for (const view of CHIBI_VIEWS) {
      out[`${clip}/${view}`] = Array.from({ length: hero.timing[clip].frames }, (_, i) => checksum(hero.paint(clip, i, view))).join(' ');
    }
  }
  return out;
}

afterAll(() => {
  if (!UPDATE) return;
  // Only registered heroes are kept, in the registry's order.
  const out: Pins = {};
  for (const hero of HEROES) if (pinned[hero.id]) out[hero.id] = pinned[hero.id] as Record<string, string>;
  writeFileSync(FILE, `${JSON.stringify(out, null, 2)}\n`);
});

describe('the pinned chibi frames', () => {
  it.skipIf(UPDATE)('pin every registered hero and nothing else', () => {
    expect(Object.keys(pinned)).toEqual(HEROES.map((h) => h.id));
  });

  it.each(HEROES.map((h) => [h.id, h] as const))('%s paints every frame as pinned', (id, hero) => {
    const now = paintAll(hero);
    if (UPDATE) {
      pinned[id] = now;
      return;
    }
    const was = pinned[id];
    expect(was, `${id} has no pinned frames: run with UPDATE_CHIBI_FRAMES=1 to pin them`).toBeDefined();
    const changed: string[] = [];
    for (const [key, sums] of Object.entries(now)) {
      const a = sums.split(' ');
      const b = (was?.[key] ?? '').split(' ');
      if (a.length !== b.length) changed.push(`${key}: ${a.length} frames, ${b.length} pinned`);
      else a.forEach((s, i) => s !== b[i] && changed.push(`${key} ${i}`));
    }
    expect(changed, `${id}: ${changed.length} frames differ from test/chibi-frames.json (${changed.slice(0, 12).join(', ')}). If the change is meant, repaint the checksums (see the top of this file).`).toEqual([]);
  });
});
