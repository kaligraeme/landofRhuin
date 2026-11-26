/**
 * Contact sheets of a chibi hero's clips, for whoever choreographs one: every frame of each clip
 * in the three views (a row each: side on, toward the viewer, away), all on one ground line,
 * scaled up with nearest-neighbour on a dark floor, one PNG per clip.
 *
 * Usage: npx tsx scripts/chibi-sheet.ts [--hero hero-tank-male] [--out dir] [--scale 3] [clip ...]
 * With no clips named it draws them all. Sheets go to a chibi-sheets folder in the system's
 * temporary directory unless --out says otherwise.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiClip } from '../src/client/art/heroes/chibi/index.js';
import type { Raster } from '../src/client/art/heroes/paint.js';

const FLOOR = [34, 31, 28];
const GAP = 4;

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  let c = 0xffffffff;
  for (const b of body) c = (CRC[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([head, body, tail]);
}

/** Writes RGB pixels as a PNG. */
function writePng(path: string, w: number, h: number, rgb: Uint8Array): void {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

const heroId = option('hero', 'hero-tank-male');
const hero = CHIBI_HEROES[heroId];
if (!hero) throw new Error(`${heroId} is not a chibi hero (see CHIBI_HEROES)`);
const out = option('out', join(tmpdir(), 'chibi-sheets'));
const scale = Number(option('scale', '3'));
const named = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
const clips = named.length ? (named as ChibiClip[]) : [...CHIBI_CLIPS];
mkdirSync(out, { recursive: true });

for (const clip of clips) {
  if (!hero.timing[clip]) throw new Error(`no clip ${clip}: the clips are ${CHIBI_CLIPS.join(', ')}`);
  const rows = CHIBI_VIEWS.map((view) => Array.from({ length: hero.timing[clip].frames }, (_, i) => ({ r: hero.paint(clip, i, view), box: hero.frame[view] })));
  // One window for every frame, placed by the ground point: as far as any frame reaches from it.
  let left = 0;
  let right = 0;
  let up = 0;
  let down = 0;
  for (const { r, box } of rows.flat()) {
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if ((r.data[(y * r.w + x) * 4 + 3] as number) === 0) continue;
        left = Math.max(left, box.ax - x);
        right = Math.max(right, x - box.ax);
        up = Math.max(up, box.ay - y);
        down = Math.max(down, y - box.ay);
      }
    }
  }
  const cw = left + right + 1 + GAP;
  const ch = up + down + 1 + GAP;
  const cols = Math.max(...rows.map((row) => row.length));
  const W = cw * cols * scale;
  const H = ch * rows.length * scale;
  const rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set(FLOOR, i * 3);
  rows.forEach((row, ry) =>
    row.forEach(({ r, box }: { r: Raster; box: { ax: number; ay: number } }, cx) => {
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          const a = (r.data[(y * r.w + x) * 4 + 3] as number) / 255;
          if (!a) continue;
          const px = cx * cw + GAP / 2 + left + x - box.ax;
          const py = ry * ch + GAP / 2 + up + y - box.ay;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const o = ((py * scale + dy) * W + px * scale + dx) * 3;
              for (let c = 0; c < 3; c++) rgb[o + c] = Math.round((r.data[(y * r.w + x) * 4 + c] as number) * a + (rgb[o + c] as number) * (1 - a));
            }
          }
        }
      }
    }),
  );
  const path = join(out, `${heroId}-${clip}.png`);
  writePng(path, W, H, rgb);
  console.log(`${clip}: ${hero.timing[clip].frames} frames -> ${path}`);
}
