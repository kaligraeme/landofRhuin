import { describe, expect, it } from 'vitest';
import { CHIBI_VIEWS, type ChibiView } from '../src/client/art/heroes/chibi/index.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { add3, camera, type ChibiPose, lerp3, solveRig, type V3 } from '../src/client/art/heroes/chibi/rig.js';
import type { Raster } from '../src/client/art/heroes/paint.js';
import { COMBINED, COMBINED_BOX as BOX, POLEARM, POLEARM_CLIPS, SWORD_WAND, SWORD_WAND_CLIPS } from './chibi-combined-mannequins.js';

/** The colour of a pixel, as one number (0 where nothing is painted). */
const at = (r: Raster, x: number, y: number): number => {
  const i = (Math.round(y) * r.w + Math.round(x)) * 4;
  return (r.data[i + 3] as number) === 0 ? 0 : (r.data[i] as number) * 65536 + (r.data[i + 1] as number) * 256 + (r.data[i + 2] as number);
};

/** How many pixels differ between two frames. */
function diff(a: Raster, b: Raster): number {
  let n = 0;
  for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
}

/** Where a hero-space point lands in a view. */
const onScreen = (p: ChibiPose, view: ChibiView, q: V3): [number, number] => {
  const s = camera(view, p.turn ?? 0, BOX.ax, BOX.ay).proj(q);
  return [s[0], s[1]];
};

const pick = (clips: Record<string, readonly ChibiPose[]>, clip: string, i: number): ChibiPose => clips[clip]?.[i] as ChibiPose;

describe('hair, cloth and gear together', () => {
  it('paint every pose in every view, the same pixels every time, inside the frame', () => {
    for (const { design, clips } of COMBINED) {
      for (const [clip, poses] of Object.entries(clips)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const a = paintChibi(design, p, view, BOX);
            expect(diff(a, paintChibi(design, p, view, BOX)), `${design.id} ${clip} ${i} ${view}`).toBe(0);
            let n = 0;
            for (let y = 0; y < a.h; y++) {
              for (let x = 0; x < a.w; x++) {
                if ((a.data[(y * a.w + x) * 4 + 3] as number) === 0) continue;
                n++;
                // Ribbons, tails, hair and effects all stay clear of the frame's edges.
                expect(x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1, `${design.id} ${clip} ${i} ${view}: touches the edge at ${x},${y}`).toBe(true);
              }
            }
            expect(n, `${design.id} ${clip} ${i} ${view}`).toBeGreaterThan(500);
          }
        });
      }
    }
  });

  it('paint a clean figure: no stray pixels, hardly a pinhole', () => {
    for (const { design, clips } of COMBINED) {
      let holes = 0;
      for (const [clip, poses] of Object.entries(clips)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const r = paintChibi(design, { ...p, fx: undefined }, view, BOX);
            const op = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.w && y < r.h && (r.data[(y * r.w + x) * 4 + 3] as number) > 0;
            for (let y = 0; y < r.h; y++) {
              for (let x = 0; x < r.w; x++) {
                if (op(x, y)) {
                  let n = 0;
                  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && op(x + dx, y + dy)) n++;
                  expect(n, `${design.id} ${clip} ${i} ${view}: a stray pixel at ${x},${y}`).toBeGreaterThan(2);
                } else if (op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) holes++;
              }
            }
          }
        });
      }
      expect(holes, design.id).toBeLessThanOrEqual(8);
    }
  });

  it('keep a raised far arm in front of the cape and the long hair behind the back', () => {
    // Front on, the wand arm is raised beside her head, a little behind her shoulders: the cape
    // and the curtain of hair hang further back still, so neither may cover it.
    const p: ChibiPose = { ...pick(SWORD_WAND_CLIPS, 'cast', 0), handB: [-3, -6, 14] };
    const rig = solveRig(SWORD_WAND.build, p, SWORD_WAND.weapon.grip2);
    const bare: ChibiDesign = { ...SWORD_WAND, outfit: SWORD_WAND.outfit.slice(0, 1), head: { ...SWORD_WAND.head, long: { ...SWORD_WAND.head.long, back: undefined } } };
    const full = paintChibi(SWORD_WAND, { ...p, fx: undefined }, 'front', BOX);
    const without = paintChibi(bare, { ...p, fx: undefined }, 'front', BOX);
    for (let t = 0.2; t <= 1.8; t += 0.1) {
      const [x, y] = onScreen(p, 'front', t < 1 ? lerp3(rig.armL.root, rig.armL.mid, t) : lerp3(rig.armL.mid, rig.armL.end, t - 1));
      expect(at(full, x, y), `along the arm at ${t.toFixed(1)}`).toBe(at(without, x, y));
    }
    // Held further out, the wand shows in every view, clear of the hair.
    const out = pick(SWORD_WAND_CLIPS, 'cast', 0);
    for (const view of CHIBI_VIEWS) {
      const withWand = paintChibi(SWORD_WAND, { ...out, fx: undefined }, view, BOX);
      const noWand = paintChibi({ ...SWORD_WAND, offhand: undefined }, { ...out, fx: undefined }, view, BOX);
      expect(diff(withWand, noWand), view).toBeGreaterThan(15);
    }
  });

  it('hide a drill of wind thrust away from the viewer behind the figure', () => {
    // Seen from behind, a thrust points away from the viewer: its swirl may show round the
    // figure, but not over it.
    for (const [design, p] of [
      [POLEARM, pick(POLEARM_CLIPS, 'thrust', 2)],
      [SWORD_WAND, pick(SWORD_WAND_CLIPS, 'thrust', 1)],
    ] as const) {
      const bare = paintChibi(design, { ...p, fx: undefined }, 'back', BOX);
      const swirl = paintChibi(design, { ...p, fx: { swirl: { k: 1, spin: 0.2 } } }, 'back', BOX);
      let over = 0;
      for (let i = 0; i < bare.data.length; i += 4) {
        const same = bare.data[i] === swirl.data[i] && bare.data[i + 1] === swirl.data[i + 1] && bare.data[i + 2] === swirl.data[i + 2];
        if ((bare.data[i + 3] as number) === 255 && !same) over++;
      }
      expect(over, design.id).toBe(0);
      // Side on, the same swirl shows plainly ahead of the point.
      expect(diff(paintChibi(design, { ...p, fx: undefined }, 'side', BOX), paintChibi(design, { ...p, fx: { swirl: { k: 1, spin: 0.2 } } }, 'side', BOX)), design.id).toBeGreaterThan(60);
    }
  });

  it('lay the ponytail over the scarf tails from behind, and the haft over the scarf side on', () => {
    // From behind, the middle of his upper back is the ponytail's hair, over the scarf's tails.
    const p = pick(POLEARM_CLIPS, 'stand', 0);
    const rig = solveRig(POLEARM.build, p, POLEARM.weapon.grip2, POLEARM.weapon.haft);
    const hair = new Set([...POLEARM.head.hair.tones, POLEARM.head.hair.line].map((c) => c[0] * 65536 + c[1] * 256 + c[2]));
    const back = paintChibi(POLEARM, { ...p, fx: undefined }, 'back', BOX);
    const [bx, by] = onScreen(p, 'back', add3(rig.chest.o, rig.chest.u, POLEARM.build.torso - 6));
    let hairy = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (hair.has(at(back, bx + dx, by + dy))) hairy++;
    expect(hairy).toBeGreaterThan(4);
    // Side on, the haft in front of his body is never covered by the scarf (its wrap or its tails).
    const noScarf: ChibiDesign = { ...POLEARM, headPieces: [], outfit: POLEARM.outfit.slice(0, 2) };
    for (const [clip, i] of [['stand', 0], ['dash', 1], ['thrust', 1], ['spin', 2]] as const) {
      const q = pick(POLEARM_CLIPS, clip, i);
      const r = solveRig(POLEARM.build, q, POLEARM.weapon.grip2, POLEARM.weapon.haft);
      const a = paintChibi(POLEARM, { ...q, fx: undefined }, 'side', BOX);
      const b = paintChibi(noScarf, { ...q, fx: undefined }, 'side', BOX);
      for (let u = r.grip2 + 4; u < 38; u += 2) {
        const [x, y] = onScreen(q, 'side', add3(r.weapon.o, r.weapon.u, u));
        expect(at(a, x, y), `${clip} ${i} at ${u}`).toBe(at(b, x, y));
      }
    }
  });

  it('paint fast enough', () => {
    // In a hero-sized frame, as the game paints them (the box above is larger, for the vault).
    const box = { w: 224, h: 240, ax: 112, ay: 172 };
    for (const { design, clips } of COMBINED) {
      for (const p of Object.values(clips).flat()) paintChibi(design, p, 'side', box);
      let n = 0;
      const t0 = performance.now();
      for (const poses of Object.values(clips)) {
        for (const p of poses) {
          for (const view of CHIBI_VIEWS) {
            paintChibi(design, p, view, box);
            n++;
          }
        }
      }
      const ms = (performance.now() - t0) / n;
      expect(ms, `${design.id}: ${ms.toFixed(2)} ms a frame`).toBeLessThan(12);
    }
  });
});
