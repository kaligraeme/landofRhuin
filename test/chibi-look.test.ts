import { describe, expect, it } from 'vitest';
import { CHIBI_VIEWS } from '../src/client/art/heroes/chibi/index.js';
import type { ChibiDesign, FaceStyle } from '../src/client/art/heroes/chibi/design.js';
import { FACE_PLAIN, FACE_SHARP, FACE_SOFT } from '../src/client/art/heroes/chibi/head.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { pushOut, strand, torsoObstacles } from '../src/client/art/heroes/chibi/pieces.js';
import { shade } from '../src/client/art/heroes/chibi/raster.js';
import { at3, type ChibiPose, type ChibiView, camera, dot3, len3, pose, solveRig, sub3, type V3 } from '../src/client/art/heroes/chibi/rig.js';
import type { RGB, Raster } from '../src/client/art/heroes/paint.js';
import { DARK_KNIGHT } from '../src/client/art/heroes/chibi/darkKnight/design.js';
import { DARK_KNIGHT_HERO } from '../src/client/art/heroes/chibi/darkKnight/hero.js';
import { BOX, FACES, LANKY, LOOK_CLIPS, MANNEQUINS, ROBED, RUN, SPIN, STAND } from './chibi-mannequins.js';

/** A quick checksum of a frame's pixels. */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

const key = (c: RGB | readonly number[]): number => (c[0] as number) * 65536 + (c[1] as number) * 256 + (c[2] as number);

/** How many pixels of a frame are one of these colours, within a box (default the whole frame). */
function count(r: Raster, colours: readonly RGB[], box?: { x0: number; y0: number; x1: number; y1: number }): number {
  const keys = new Set(colours.map(key));
  let n = 0;
  const b = box ?? { x0: 0, y0: 0, x1: r.w - 1, y1: r.h - 1 };
  for (let y = Math.max(0, b.y0); y <= Math.min(r.h - 1, b.y1); y++) {
    for (let x = Math.max(0, b.x0); x <= Math.min(r.w - 1, b.x1); x++) {
      const i = (y * r.w + x) * 4;
      if ((r.data[i + 3] as number) > 0 && keys.has(key([r.data[i] as number, r.data[i + 1] as number, r.data[i + 2] as number]))) n++;
    }
  }
  return n;
}

/** The colour of a pixel. */
const px = (r: Raster, x: number, y: number): RGB => {
  const i = (Math.round(y) * r.w + Math.round(x)) * 4;
  return [r.data[i] as number, r.data[i + 1] as number, r.data[i + 2] as number];
};

/** Where a point of a pose's chest frame lands in a view (the painter's camera). */
function onScreen(d: ChibiDesign, p: ChibiPose, view: ChibiView, f: number, u: number, r: number): [number, number] {
  const rig = solveRig(d.build, p, d.weapon.grip2);
  const cam = camera(view, p.turn ?? 0, BOX.ax, BOX.ay);
  const q = cam.proj(at3(rig.chest, f, u, r));
  return [q[0], q[1]];
}

const hairOf = (d: ChibiDesign): RGB[] => [...d.head.hair.tones, d.head.hair.line];
/** The design without its long hair (or with other changes). */
const without = (d: ChibiDesign, over: Partial<ChibiDesign['head']>): ChibiDesign => ({ ...d, head: { ...d.head, ...over } });

describe('the look mannequins', () => {
  it('paint every pose in every view, the same pixels every time, inside the frame', () => {
    for (const d of MANNEQUINS) {
      for (const [clip, poses] of Object.entries(LOOK_CLIPS)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const a = paintChibi(d, p, view, BOX);
            const b = paintChibi(d, p, view, BOX);
            expect(Buffer.from(a.data).equals(Buffer.from(b.data)), `${d.id} ${clip} ${i} ${view}`).toBe(true);
            let n = 0;
            for (let y = 0; y < a.h; y++) {
              for (let x = 0; x < a.w; x++) {
                if ((a.data[(y * a.w + x) * 4 + 3] as number) === 0) continue;
                n++;
                expect(x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1, `${d.id} ${clip} ${i} ${view}: touches the edge`).toBe(true);
              }
            }
            expect(n, `${d.id} ${clip} ${i} ${view}`).toBeGreaterThan(500);
          }
        });
      }
    }
  });

  it('paint a clean figure: no stray pixels', () => {
    for (const d of MANNEQUINS) {
      for (const [clip, poses] of Object.entries(LOOK_CLIPS)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const r = paintChibi(d, { ...p, fx: undefined }, view, BOX);
            const op = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < r.w && y < r.h && (r.data[(y * r.w + x) * 4 + 3] as number) > 0;
            for (let y = 0; y < r.h; y++) {
              for (let x = 0; x < r.w; x++) {
                if (!op(x, y)) continue;
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && op(x + dx, y + dy)) n++;
                expect(n, `${d.id} ${clip} ${i} ${view}: a stray pixel at ${x},${y}`).toBeGreaterThan(1);
              }
            }
          }
        });
      }
    }
  });

  it('paint fast enough', () => {
    let n = 0;
    const t0 = performance.now();
    for (const d of MANNEQUINS) for (const poses of Object.values(LOOK_CLIPS)) for (const p of poses) for (const view of CHIBI_VIEWS) {
      paintChibi(d, p, view, BOX);
      n++;
    }
    const ms = (performance.now() - t0) / n;
    expect(ms, `${ms.toFixed(2)} ms a frame`).toBeLessThan(20);
  });
});

describe('long hair', () => {
  it('hangs behind her back seen from the front and over it seen from behind', () => {
    const hair = hairOf(ROBED);
    // The middle of her chest seen from the front is not hair; the middle of her back from behind is.
    const front = paintChibi(ROBED, STAND, 'front', BOX);
    const [cx, cy] = onScreen(ROBED, STAND, 'front', 5, 13, 0);
    expect(hair.map(key)).not.toContain(key(px(front, cx, cy)));
    const back = paintChibi(ROBED, STAND, 'back', BOX);
    const [bx, by] = onScreen(ROBED, STAND, 'back', -5, 16, 0);
    expect(hair.map(key)).toContain(key(px(back, bx, by)));
    // Without it, the back shows the coat there.
    const bare = paintChibi(without(ROBED, { long: undefined }), STAND, 'back', BOX);
    expect(hair.map(key)).not.toContain(key(px(bare, bx, by)));
  });

  it('frames the face from the front, below the head, and hangs down the back side on', () => {
    const hair = hairOf(ROBED);
    const long = paintChibi(ROBED, STAND, 'front', BOX);
    const short = paintChibi(without(ROBED, { long: undefined }), STAND, 'front', BOX);
    // Below the jaw, beside the neck: the locks over the shoulders.
    const [nx, ny] = onScreen(ROBED, STAND, 'front', 2, ROBED.build.torso - 2, 0);
    const box = { x0: Math.round(nx) - 12, y0: Math.round(ny) - 2, x1: Math.round(nx) + 12, y1: Math.round(ny) + 8 };
    expect(count(long, hair, box)).toBeGreaterThan(count(short, hair, box) + 20);
    // Side on there is hair behind her back, down past her shoulders.
    const side = paintChibi(ROBED, STAND, 'side', BOX);
    const [sx, sy] = onScreen(ROBED, STAND, 'side', -8, 14, 0);
    expect(count(side, hair, { x0: Math.round(sx) - 6, y0: Math.round(sy) - 4, x1: Math.round(sx) + 2, y1: Math.round(sy) + 4 })).toBeGreaterThan(8);
  });

  it('streams back in the wind and flies out in a spin', () => {
    const hair = hairOf(ROBED);
    const leftmost = (r: Raster): number => {
      const keys = new Set(hair.map(key));
      for (let x = 0; x < r.w; x++) for (let y = 0; y < r.h; y++) if ((r.data[(y * r.w + x) * 4 + 3] as number) > 0 && keys.has(key(px(r, x, y)))) return x;
      return r.w;
    };
    const still = paintChibi(ROBED, { ...STAND, wind: 0 }, 'side', BOX);
    const blown = paintChibi(ROBED, { ...STAND, wind: 1 }, 'side', BOX);
    expect(leftmost(blown)).toBeLessThan(leftmost(still) - 6);
    // A spin's flare throws it out wider than it hangs at rest.
    const width = (r: Raster): number => {
      const keys = new Set(hair.map(key));
      let x0 = r.w;
      let x1 = 0;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if ((r.data[(y * r.w + x) * 4 + 3] as number) > 0 && keys.has(key(px(r, x, y)))) [x0, x1] = [Math.min(x0, x), Math.max(x1, x)];
      return x1 - x0;
    };
    const spin = SPIN[2] as ChibiPose;
    expect(width(paintChibi(ROBED, spin, 'front', BOX))).toBeGreaterThan(width(paintChibi(ROBED, { ...spin, flare: 0, wind: 0, sway: 0 }, 'front', BOX)) + 4);
  });

  it('changes a little from frame to frame of a loop, not a lot (no flicker)', () => {
    const hair = hairOf(ROBED);
    for (const view of CHIBI_VIEWS) {
      const counts = RUN.map((p) => count(paintChibi(ROBED, p, view, BOX), hair));
      for (let i = 0; i < counts.length; i++) {
        const a = counts[i] as number;
        const b = counts[(i + 1) % counts.length] as number;
        expect(Math.abs(a - b) / Math.max(a, b), `${view} ${i}`).toBeLessThan(0.25);
      }
    }
  });

  it('grows out of the head without a line between the two', () => {
    // A short tress lying on the back of the head: seen from behind, it adds no hair line to the
    // head (no outline where it lies over the head's own hair).
    const line = [ROBED.head.lockLine ?? shade(ROBED.head.hair.tones[3], -0.3)];
    const one = without(ROBED, { long: { back: [{ yaw: 180, pitch: 30, dir: [-0.3, -1, 0], len: 9, w: 3 }] } });
    const bare = without(ROBED, { long: undefined });
    const [hx, hy] = onScreen(ROBED, STAND, 'back', 0, ROBED.build.torso + ROBED.build.neck + ROBED.build.headUp, 0);
    const box = { x0: Math.round(hx) - 14, y0: Math.round(hy) - 14, x1: Math.round(hx) + 14, y1: Math.round(hy) + 14 };
    const withTress = paintChibi(one, STAND, 'back', BOX);
    expect(sum(withTress)).not.toBe(sum(paintChibi(bare, STAND, 'back', BOX)));
    expect(count(withTress, line, box)).toBeLessThanOrEqual(count(paintChibi(bare, STAND, 'back', BOX), line, box) + 3);
  });

  it('flips its ends out to its side with `flip`, and only its ends', () => {
    const spec = { root: [-10, 40, 0] as V3, dir: [-0.6, -1, 0] as V3, len: 12, n: 6, side: [-1, 0, 0] as V3 };
    const plain = strand(STAND, { ...spec });
    const flipped = strand(STAND, { ...spec, flip: 1.2 });
    const out = (pts: V3[]): number => dot3(sub3(pts[pts.length - 1] as V3, spec.root), spec.side);
    expect(out(flipped)).toBeGreaterThan(out(plain) + 3);
    // The first half of it is not moved, and it keeps its length.
    for (let i = 0; i <= 3; i++) expect(len3(sub3(flipped[i] as V3, plain[i] as V3))).toBeLessThan(1e-9);
    for (let i = 1; i < flipped.length; i++) expect(len3(sub3(flipped[i] as V3, flipped[i - 1] as V3))).toBeCloseTo(spec.len / spec.n, 1);
  });

  it('paints short layers at the nape in the head\'s depth test: over a high collar, under what is nearer', () => {
    // The Dark Knight's nape layers as `nape`, and as tresses down the back sorted with the body.
    const nape = DARK_KNIGHT.head.long?.nape ?? [];
    expect(nape.length).toBeGreaterThan(2);
    const hair = new Set(hairOf(DARK_KNIGHT).map(key));
    const isHair = (r: Raster, i: number): boolean => (r.data[i * 4 + 3] as number) > 0 && hair.has(key([r.data[i * 4] as number, r.data[i * 4 + 1] as number, r.data[i * 4 + 2] as number]));
    // How many pixels of the figure that are not hair without the layers are hair with them.
    const over = (clip: 'idle' | 'battle', view: ChibiView, long: ChibiDesign['head']['long']): number => {
      const p = DARK_KNIGHT_HERO.poses[clip][0] as ChibiPose;
      const box = DARK_KNIGHT_HERO.frame[view];
      const bare = paintChibi(without(DARK_KNIGHT, { long: undefined }), p, view, box);
      const r = paintChibi(without(DARK_KNIGHT, { long }), p, view, box);
      let n = 0;
      for (let i = 0; i < r.w * r.h; i++) if ((bare.data[i * 4 + 3] as number) > 0 && !isHair(bare, i) && isHair(r, i)) n++;
      return n;
    };
    // From behind they lie over his collar.
    expect(over('idle', 'back', { nape })).toBeGreaterThan(40);
    // Side on his jaw and collar hide them where they are nearer; sorted with the body, the layer
    // behind his near ear would sort over his whole head and be painted over them.
    expect(over('battle', 'side', { nape }) + 5).toBeLessThan(over('battle', 'side', { back: nape }));
  });
});

describe('a ponytail', () => {
  it('shows its tie seen from behind and from the side, and hangs down the back', () => {
    const tie = LANKY.head.long?.tail?.tie.mat;
    expect(tie).toBeDefined();
    const tones = [...(tie?.tones ?? []), tie?.line ?? [0, 0, 0]] as RGB[];
    expect(count(paintChibi(LANKY, STAND, 'back', BOX), tones)).toBeGreaterThan(6);
    expect(count(paintChibi(LANKY, STAND, 'side', BOX), tones)).toBeGreaterThan(2);
    const back = paintChibi(LANKY, STAND, 'back', BOX);
    const [bx, by] = onScreen(LANKY, STAND, 'back', -6, 12, 0);
    expect(count(back, hairOf(LANKY), { x0: Math.round(bx) - 3, y0: Math.round(by) - 3, x1: Math.round(bx) + 3, y1: Math.round(by) + 3 })).toBeGreaterThan(10);
  });

  it('whips out behind him when he runs', () => {
    const hair = hairOf(LANKY);
    const run = paintChibi(LANKY, RUN[1] as ChibiPose, 'side', BOX);
    const still = paintChibi(LANKY, { ...(RUN[1] as ChibiPose), wind: 0 }, 'side', BOX);
    const left = (r: Raster): number => {
      const keys = new Set(hair.map(key));
      for (let x = 0; x < r.w; x++) for (let y = 0; y < r.h; y++) if ((r.data[(y * r.w + x) * 4 + 3] as number) > 0 && keys.has(key(px(r, x, y)))) return x;
      return r.w;
    };
    expect(left(run)).toBeLessThan(left(still) - 8);
  });
});

describe('cloth', () => {
  it('a cape hangs behind her seen from the front and covers her back seen from behind', () => {
    const noCape: ChibiDesign = { ...ROBED, head: { ...ROBED.head, long: undefined }, outfit: ROBED.outfit.slice(0, 1) };
    const withCape: ChibiDesign = { ...noCape, outfit: ROBED.outfit };
    // From behind, the cape changes the upper back; from the front, the chest is the same.
    const [bx, by] = onScreen(ROBED, STAND, 'back', -5, 12, 0);
    const b0 = paintChibi(noCape, STAND, 'back', BOX);
    const b1 = paintChibi(withCape, STAND, 'back', BOX);
    expect(key(px(b0, bx, by))).not.toBe(key(px(b1, bx, by)));
    const [fx, fy] = onScreen(ROBED, STAND, 'front', 5, 12, 0);
    expect(key(px(paintChibi(noCape, STAND, 'front', BOX), fx, fy))).toBe(key(px(paintChibi(withCape, STAND, 'front', BOX), fx, fy)));
  });

  it('a scarf hides a little of the jaw side on, and its tails stream behind', () => {
    const skin = [...LANKY.head.skin.tones];
    const noScarf: ChibiDesign = { ...LANKY, headPieces: [], outfit: LANKY.outfit.slice(0, 2) };
    const [hx, hy] = onScreen(LANKY, STAND, 'side', 0, LANKY.build.torso + 4, 0);
    const box = { x0: Math.round(hx) - 4, y0: Math.round(hy) - 6, x1: Math.round(hx) + 14, y1: Math.round(hy) + 2 };
    expect(count(paintChibi(LANKY, STAND, 'side', BOX), skin, box)).toBeLessThan(count(paintChibi(noScarf, STAND, 'side', BOX), skin, box) - 4);
  });

  it('strands lie over the body rather than through it, and keep their length', () => {
    const rig = solveRig(ROBED.build, { ...STAND, lean: 30 }, ROBED.weapon.grip2);
    const avoid = torsoObstacles(rig, ROBED.body.chest, ROBED.body.hips);
    const root = at3(rig.chest, -3, ROBED.build.torso - 1, 0);
    const pts = strand({ ...STAND, lean: 30 }, { root, dir: [0, -1, 0], len: 30, n: 8, avoid, pad: 1 });
    expect(pts).toHaveLength(9);
    for (const p of pts.slice(1)) expect(len3(sub3(pushOut(p, avoid, 0.99), p))).toBeLessThan(1e-6);
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += len3(sub3(pts[i] as V3, pts[i - 1] as V3));
    expect(total).toBeGreaterThan(24);
    expect(total).toBeLessThan(40);
    // The wind carries it back (hero space: -f).
    const blown = strand({ ...STAND, wind: 1 }, { root: [0, 60, 0], dir: [0, -1, 0], len: 30 });
    expect(dot3(sub3(blown[blown.length - 1] as V3, blown[0] as V3), [-1, 0, 0])).toBeGreaterThan(15);
  });
});

describe('face styles', () => {
  const STYLES: [string, FaceStyle][] = [
    ['plain', FACE_PLAIN],
    ['soft', FACE_SOFT],
    ['sharp', FACE_SHARP],
  ];

  it('have a glyph for every expression and width, each anchored inside it', () => {
    for (const [name, s] of STYLES) {
      const glyphs = [...Object.values(s.eyes), ...Object.values(s.brows), ...Object.values(s.browsUp), ...FACES.map((f) => s.mouths[f])];
      expect(glyphs.length, name).toBe(6 + 3 + 3 + 6);
      for (const g of glyphs) {
        expect(g.rows.length, name).toBeGreaterThan(0);
        expect(g.ay, name).toBeLessThan(g.rows.length);
        expect(g.ax, name).toBeLessThan(Math.max(...g.rows.map((r) => r.length)));
        for (const row of g.rows) expect(row, name).toMatch(/^[.KIiDWhlBMrT]+$/);
      }
    }
  });

  it('show every expression differently in every style, front on and side on', () => {
    const lash = (d: ChibiDesign): RGB[] => [d.head.face.lash];
    for (const [name, style] of STYLES) {
      for (const base of MANNEQUINS) {
        const d = without(base, { face: { ...base.head.face, style } });
        for (const view of ['front', 'side'] as const) {
          const sums = FACES.map((face) => sum(paintChibi(d, pose(STAND, { face, wind: 0 }), view, BOX)));
          expect(new Set(sums).size, `${name} ${base.id} ${view}`).toBe(FACES.length);
          // The eyes show their lashes or lids in every expression.
          for (const face of FACES) expect(count(paintChibi(d, pose(STAND, { face, wind: 0 }), view, BOX), lash(d)), `${name} ${base.id} ${view} ${face}`).toBeGreaterThan(2);
        }
      }
    }
  });

  it('differ from one another, and a design picks one (and its resting expression)', () => {
    const paint = (style: FaceStyle): number => sum(paintChibi(without(ROBED, { face: { ...ROBED.head.face, style } }), STAND, 'front', BOX));
    expect(new Set(STYLES.map(([, s]) => paint(s))).size).toBe(3);
    // A pose that gives no expression shows the design's resting one.
    const rest = paintChibi(LANKY, { ...STAND, face: undefined }, 'front', BOX);
    expect(sum(rest)).toBe(sum(paintChibi(LANKY, { ...STAND, face: 'smirk' }, 'front', BOX)));
    expect(sum(rest)).not.toBe(sum(paintChibi(LANKY, { ...STAND, face: 'stern' }, 'front', BOX)));
  });
});
