import { describe, expect, it } from 'vitest';
import { scaleAt } from '../src/client/art/heroes/chibi/armour.js';
import type { ChibiDesign } from '../src/client/art/heroes/chibi/design.js';
import { beard } from '../src/client/art/heroes/chibi/head.js';
import { strap } from '../src/client/art/heroes/chibi/back.js';
import { hood } from '../src/client/art/heroes/chibi/headgear.js';
import { CHIBI_VIEWS } from '../src/client/art/heroes/chibi/index.js';
import { paintChibi } from '../src/client/art/heroes/chibi/painter.js';
import { armObstacles, collar, plates, pushOut } from '../src/client/art/heroes/chibi/pieces.js';
import { flat, Part } from '../src/client/art/heroes/chibi/raster.js';
import { at3, camera, type ChibiPose, type ChibiView, len3, pose, solveRig, sub3, type V3 } from '../src/client/art/heroes/chibi/rig.js';
import { Canvas, type RGB, type Raster } from '../src/client/art/heroes/paint.js';
import { BODY_BOX as BOX, BODY_CLIPS, BODY_MANNEQUINS, BUNS, ELDER, HOODED, UPDO, WARDEN } from './chibi-body-mannequins.js';
import { FACES, RUN, STAND } from './chibi-mannequins.js';
import { darkKnightFrames, timeAgainst } from './paint-timing.js';

/** A quick checksum of a frame's pixels. */
function sum(r: Raster): number {
  let h = 2166136261;
  for (let i = 0; i < r.data.length; i++) h = Math.imul(h ^ (r.data[i] as number), 16777619);
  return h >>> 0;
}

const key = (c: RGB | readonly number[]): number => (c[0] as number) * 65536 + (c[1] as number) * 256 + (c[2] as number);
type Box = { x0: number; y0: number; x1: number; y1: number };

/** How many pixels of a frame are one of these colours, within a box (default the whole frame). */
function count(r: Raster, colours: readonly RGB[], box?: Box): number {
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

/** The leftmost and lowest pixel of these colours. */
function extent(r: Raster, colours: readonly RGB[]): { left: number; right: number; top: number; bottom: number } {
  const keys = new Set(colours.map(key));
  const e = { left: r.w, right: -1, top: r.h, bottom: -1 };
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const i = (y * r.w + x) * 4;
      if ((r.data[i + 3] as number) === 0 || !keys.has(key([r.data[i] as number, r.data[i + 1] as number, r.data[i + 2] as number]))) continue;
      e.left = Math.min(e.left, x);
      e.right = Math.max(e.right, x);
      e.top = Math.min(e.top, y);
      e.bottom = Math.max(e.bottom, y);
    }
  }
  return e;
}

/** Where a point of a pose's chest frame (or head frame) lands in a view. */
function onScreen(d: ChibiDesign, p: ChibiPose, view: ChibiView, f: number, u: number, r: number, frame: 'chest' | 'head' = 'chest'): [number, number] {
  const rig = solveRig(d.build, p, d.weapon.grip2);
  const cam = camera(view, p.turn ?? 0, BOX.ax, BOX.ay);
  const q = cam.proj(at3(rig[frame], f, u, r));
  return [Math.round(q[0]), Math.round(q[1])];
}

const around = (p: [number, number], rx: number, ry: number, dy = 0): Box => ({ x0: p[0] - rx, y0: p[1] - ry + dy, x1: p[0] + rx, y1: p[1] + ry + dy });
const tones = (m: { tones: readonly RGB[]; line: RGB }): RGB[] => [...m.tones, m.line];
const paint = (d: ChibiDesign, p: ChibiPose, view: ChibiView): Raster => paintChibi(d, p, view, BOX);
const withHead = (d: ChibiDesign, over: Partial<ChibiDesign['head']>): ChibiDesign => ({ ...d, head: { ...d.head, ...over } });
const still = pose(STAND, { wind: 0 });

describe('the body mannequins', () => {
  it('paint every pose in every view, the same pixels every time, inside the frame', () => {
    for (const d of BODY_MANNEQUINS) {
      for (const [clip, poses] of Object.entries(BODY_CLIPS)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const a = paint(d, p, view);
            expect(sum(a), `${d.id} ${clip} ${i} ${view}`).toBe(sum(paint(d, p, view)));
            const e = extent(a, []);
            let n = 0;
            for (let y = 0; y < a.h; y++) {
              for (let x = 0; x < a.w; x++) {
                if ((a.data[(y * a.w + x) * 4 + 3] as number) === 0) continue;
                n++;
                expect(x > 0 && y > 0 && x < a.w - 1 && y < a.h - 1, `${d.id} ${clip} ${i} ${view}: touches the edge`).toBe(true);
              }
            }
            expect(n, `${d.id} ${clip} ${i} ${view}`).toBeGreaterThan(500);
            void e;
          }
        });
      }
    }
  });

  it('paint a clean figure: no stray pixels', () => {
    for (const d of BODY_MANNEQUINS) {
      for (const [clip, poses] of Object.entries(BODY_CLIPS)) {
        poses.forEach((p, i) => {
          for (const view of CHIBI_VIEWS) {
            const r = paint(d, { ...p, fx: undefined }, view);
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

  it('paint fast enough (well within what the Dark Knight takes, timed alongside him)', () => {
    // Against the Dark Knight painted in the same breath, so a busy machine slows both alike; they
    // paint at about 0.6 of his time today, so this fails if they come to take twice as long.
    const all = Object.values(BODY_CLIPS).flat();
    const work = BODY_MANNEQUINS.flatMap((d) => all.flatMap((p) => CHIBI_VIEWS.map((view) => () => paint(d, p, view))));
    const t = timeAgainst(work, darkKnightFrames());
    expect(t.ratio, `${t.ratio.toFixed(2)} of the Dark Knight's time (${t.ms.toFixed(2)} ms a frame against his ${t.refMs.toFixed(2)} ms)`).toBeLessThan(1.25);
  });
});

describe('a beard and a moustache', () => {
  const hair = tones(ELDER.head.hair);
  const bare = withHead(ELDER, { beard: undefined, moustache: undefined });

  it('hang from the jaw over the chest, seen from the front and the side', () => {
    for (const view of ['front', 'side'] as const) {
      // Below the chin, over the chest.
      const box = around(onScreen(ELDER, still, view, 4, ELDER.build.torso - 4, 0), 6, 4);
      expect(count(paint(ELDER, still, view), hair, box), view).toBeGreaterThan(count(paint(bare, still, view), hair, box) + 25);
    }
  });

  it('show from behind at the sides of the jaw, though the body hides the rest', () => {
    const noHair = withHead(ELDER, { long: undefined });
    const back = paint(noHair, still, 'back');
    const without = paint(withHead(noHair, { beard: undefined, moustache: undefined }), still, 'back');
    // Beside the neck under the head, either side.
    for (const r of [7.5, -7.5]) {
      const box = around(onScreen(ELDER, still, 'back', 2, ELDER.build.torso + 2, r), 2, 3);
      expect(count(back, hair, box), `${r}`).toBeGreaterThan(count(without, hair, box) + 2);
    }
    // The middle of the chest is not beard from behind.
    const mid = around(onScreen(ELDER, still, 'back', -4, ELDER.build.torso - 8, 0), 2, 2);
    expect(count(back, hair, mid)).toBe(count(without, hair, mid));
  });

  it('sway back a little in the wind, less than long hair streams', () => {
    const noHair = withHead(ELDER, { long: undefined, hairline: { ...ELDER.head.hairline } });
    const at = (wind: number): number => extent(paint(noHair, pose(STAND, { wind }), 'side'), hair).bottom;
    // The beard's tip rises as it swings back.
    expect(at(1.2)).toBeLessThan(at(0));
  });

  it('leave every expression readable, front on and side on', () => {
    for (const view of ['front', 'side'] as const) {
      const sums = FACES.map((face) => sum(paint(ELDER, pose(STAND, { face, wind: 0 }), view)));
      expect(new Set(sums).size, view).toBe(FACES.length);
    }
    // The mouth's colour shows in every expression, front on.
    const mouth = [ELDER.head.face.mouth];
    for (const face of FACES) expect(count(paint(ELDER, pose(STAND, { face, wind: 0 }), 'front'), mouth), face).toBeGreaterThan(0);
  });

  it('a moustache grows under the nose', () => {
    const noMo = withHead(ELDER, { moustache: undefined });
    const front = paint(ELDER, still, 'front');
    const box = around(onScreen(ELDER, still, 'front', 9, -5.6, 0, 'head'), 4, 1);
    expect(count(front, hair, box)).toBeGreaterThan(count(paint(noMo, still, 'front'), hair, box) + 3);
  });

  it('lays out full, short and pointed beards', () => {
    const full = beard({ kind: 'full' });
    const short = beard({ kind: 'short' });
    const pointed = beard({ kind: 'pointed' });
    expect(full.hang?.length).toBe(5);
    const longest = (b: typeof full): number => Math.max(...(b.hang ?? []).map((t) => t.len));
    expect(longest(full)).toBeGreaterThan(longest(pointed));
    expect(longest(pointed)).toBeGreaterThan(longest(short));
    // A pointed beard's middle tress narrows all the way to its point.
    expect(Math.max(...(pointed.hang ?? []).map((t) => t.taper ?? 0))).toBeGreaterThan(0.9);
    // Every tress is rooted under the chin or along the jaw, clear of the mouth above.
    for (const b of [full, short, pointed]) for (const t of b.hang ?? []) expect(t.pitch).toBeLessThan(-35);
    // The short beard on a mannequin shows its colour on the face.
    const ginger = tones(WARDEN.head.hair);
    const box = around(onScreen(WARDEN, still, 'front', 9, -8, 0, 'head'), 6, 3);
    expect(count(paint(WARDEN, still, 'front'), ginger, box)).toBeGreaterThan(count(paint(withHead(WARDEN, { beard: undefined, moustache: undefined }), still, 'front'), ginger, box) + 10);
  });
});

describe('a hood and a cowl', () => {
  const hair = tones(HOODED.head.hair);
  const green: RGB[] = [[166, 220, 128], [124, 188, 90], [78, 138, 58], [46, 90, 38], [23, 48, 22]];

  it('worn up, covers the hair but the fringe, the face showing inside it', () => {
    const up = paint(HOODED, still, 'back');
    const down = paint(HOODED, pose(still, { hood: 'down' }), 'back');
    // From behind: no hair with it up, plenty with it down.
    expect(count(up, hair)).toBeLessThan(15);
    expect(count(down, hair)).toBeGreaterThan(150);
    // From the front: the fringe shows under the hood's edge, and the face inside it.
    const front = paint(HOODED, still, 'front');
    const brow = around(onScreen(HOODED, still, 'front', 9, 3.5, 0, 'head'), 6, 2);
    expect(count(front, hair, brow)).toBeGreaterThan(4);
    expect(count(front, [...HOODED.head.skin.tones], around(onScreen(HOODED, still, 'front', 9, -3, 0, 'head'), 5, 3))).toBeGreaterThan(30);
  });

  it('covers locks at the crown and the back, not hair hanging at the front', () => {
    const h = hood({ outer: flat('#00ff00'), inner: flat('#004400'), shell: { c: [-1.4, 1.2, 0], r: [11, 10.2, 10.9] }, opening: { top: 6, bottom: -12, side: 8.4 } });
    const ctx = { pose: STAND } as never;
    const covers = h.up.covers?.(ctx, { o: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1] });
    expect(covers).toBeTruthy();
    if (!covers) return;
    expect(covers([1, 10, 0], [-1, 0.2, 0])).toBe(true);
    expect(covers([-9, 2, 2], [-0.5, -1, 0])).toBe(true);
    expect(covers([8, 7, 1], [0.5, -1, 0])).toBe(false);
    expect(covers([8, 7, 1], [-1, 0.3, 0])).toBe(true);
    // Worn down it covers nothing.
    expect(h.up.covers?.({ pose: pose(STAND, { hood: 'down' }) } as never, { o: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1] })).toBeNull();
  });

  it('worn down, lies on the upper back behind the neck', () => {
    const noCowl: ChibiDesign = { ...HOODED, outfit: HOODED.outfit.filter((_, i) => i !== 1) };
    const down = pose(still, { hood: 'down' });
    const box = around(onScreen(HOODED, down, 'back', -7, HOODED.build.torso - 5, 0), 3, 3);
    expect(count(paint(noCowl, down, 'back'), green, box)).toBeGreaterThan(15);
    expect(count(paint({ ...noCowl, outfit: noCowl.outfit.slice(1) }, down, 'back'), green, box)).toBeLessThan(4);
  });

  it('streams its peak back in the wind', () => {
    // Side on: more of the hood behind and above the back of the head as its peak flies back.
    const behind = (wind: number): number => {
      const p = pose(STAND, { wind });
      const c = onScreen(HOODED, p, 'side', -4, 6, 0, 'head');
      return count(paint({ ...HOODED, outfit: [] }, p, 'side'), green, { x0: 0, y0: 0, x1: c[0], y1: c[1] });
    };
    expect(behind(1.2)).toBeGreaterThan(behind(0) + 3);
  });

  it('a cowl drapes the shoulders and upper arms in every view, and streams back', () => {
    const noCowl: ChibiDesign = { ...HOODED, outfit: HOODED.outfit.filter((_, i) => i !== 1) };
    for (const view of CHIBI_VIEWS) {
      const rig = solveRig(HOODED.build, still, HOODED.weapon.grip2);
      const cam = camera(view, 0, BOX.ax, BOX.ay);
      for (const arm of [rig.armR, rig.armL]) {
        const p = cam.proj(arm.root);
        const box = around([Math.round(p[0]), Math.round(p[1])], 3, 2, 1);
        // Seen side on the far shoulder is behind the body.
        if (view === 'side' && arm === rig.armL) continue;
        expect(count(paint(HOODED, still, view), green, box), view).toBeGreaterThan(count(paint(noCowl, still, view), green, box) + 6);
      }
    }
    const back = (wind: number): number => extent(paint({ ...HOODED, headPieces: [] }, pose(STAND, { wind }), 'side'), green).left;
    expect(back(1.2)).toBeLessThan(back(0) - 2);
  });
});

describe('hair worn up', () => {
  const hairOf = (d: ChibiDesign): RGB[] => tones(d.head.hair);

  /** How many pixels a design paints where another leaves the frame empty. */
  const added = (a: Raster, b: Raster): number => {
    let n = 0;
    for (let i = 0; i < a.w * a.h; i++) if ((a.data[i * 4 + 3] as number) > 0 && (b.data[i * 4 + 3] as number) === 0) n++;
    return n;
  };

  it('buns stand out on the head in every view, and a hood covers them', () => {
    const none = withHead(BUNS, { buns: undefined });
    for (const view of CHIBI_VIEWS) expect(added(paint(BUNS, still, view), paint(none, still, view)), view).toBeGreaterThan(12);
    // Under a hood worn up, buns are not painted.
    const hooded: ChibiDesign = { ...BUNS, headPieces: [hood({ outer: flat('#00ff00'), inner: flat('#004400'), shell: BUNS.head.shell, opening: { top: 6, bottom: -12, side: 8.4 } }).up] };
    expect(sum(paint(hooded, still, 'back'))).toBe(sum(paint({ ...hooded, head: { ...hooded.head, buns: undefined } }, still, 'back')));
  });

  it('a high updo stands above the head', () => {
    const none = withHead(UPDO, { buns: undefined });
    // It leans back over the crown, so from behind it stands mostly against the head itself.
    for (const view of CHIBI_VIEWS) expect(added(paint(UPDO, still, view), paint(none, still, view)), view).toBeGreaterThan(view === 'back' ? 2 : 15);
    // Side on it stands higher than the crown.
    const plain = withHead(none, { locks: none.head.locks.slice(0, -1) });
    expect(extent(paint(withHead(UPDO, { locks: plain.head.locks }), still, 'side'), hairOf(UPDO)).top).toBeLessThan(extent(paint(plain, still, 'side'), hairOf(UPDO)).top - 2);
  });

  it('a springy upright lock stands above the crown and bobs as the phase runs', () => {
    const lock = BUNS.head.locks[BUNS.head.locks.length - 1];
    expect(lock?.bob).toBeGreaterThan(0);
    const without = withHead(BUNS, { locks: BUNS.head.locks.slice(0, -1), buns: undefined });
    const withLock = withHead(BUNS, { buns: undefined });
    for (const view of ['front', 'back'] as const) expect(extent(paint(withLock, still, view), hairOf(BUNS)).top, view).toBeLessThan(extent(paint(without, still, view), hairOf(BUNS)).top - 2);
    const frames = RUN.map((p) => sum(paint(withLock, { ...p, wind: 0 }, 'front')));
    const fixed = RUN.map((p) => sum(paint(withHead(withLock, { locks: withLock.head.locks.map((l) => ({ ...l, bob: undefined })) }), { ...p, wind: 0 }, 'front')));
    expect(frames.some((s, i) => s !== fixed[i])).toBe(true);
  });
});

describe('back pieces', () => {
  const fletch: RGB[] = [[255, 255, 255], [244, 240, 228], [208, 200, 180]];
  const quiverWood: RGB[] = [[192, 122, 76], [154, 88, 52], [108, 58, 32], [64, 32, 15]];

  it('a quiver hangs on the back, its fletchings over the shoulder seen from the front', () => {
    const d: ChibiDesign = { ...HOODED, outfit: HOODED.outfit.slice(2) };
    const front = paint(d, still, 'front');
    const back = paint(d, still, 'back');
    expect(count(back, quiverWood)).toBeGreaterThan(40);
    // From the front the body hides the tube, but the fletchings show above the shoulder.
    expect(count(front, quiverWood)).toBeLessThan(count(back, quiverWood) / 3);
    const shoulder = onScreen(d, still, 'front', 0, d.build.torso + 2, 0);
    expect(count(front, fletch, { x0: 0, y0: 0, x1: BOX.w - 1, y1: shoulder[1] })).toBeGreaterThan(2);
  });

  it('a strap crosses the chest from the front and the back, only where it faces the viewer', () => {
    const red = flat('#ff0000');
    const d: ChibiDesign = { ...HOODED, outfit: [strap({ mat: red, side: 1, w: 1, over: { chest: HOODED.body.chest, hips: HOODED.body.hips } })] };
    const leather: RGB[] = [[255, 0, 0]];
    const none: ChibiDesign = { ...d, outfit: [] };
    for (const view of ['front', 'back'] as const) {
      const box = around(onScreen(d, still, view, view === 'front' ? 5 : -5, 13, 0), 5, 4);
      expect(count(paint(d, still, view), leather, box), view).toBeGreaterThan(count(paint(none, still, view), leather, box) + 4);
    }
  });

  it('a slung sword shows across the back and its hilt over the shoulder, hidden by the body from the front', () => {
    const sheath: RGB[] = [[106, 74, 106], [74, 46, 74], [48, 28, 48], [28, 16, 28]];
    const d: ChibiDesign = { ...WARDEN, outfit: WARDEN.outfit.slice(2) };
    expect(count(paint(d, still, 'back'), sheath)).toBeGreaterThan(40);
    expect(count(paint(d, still, 'front'), sheath)).toBeLessThan(count(paint(d, still, 'back'), sheath) / 3);
  });
});

describe('armour and helms', () => {
  it('scales: a face, a rim along each lower edge and the shadow under it, rows offset', () => {
    const parts = { face: 0, rim: 0, under: 0 };
    for (let y = 0; y < 40; y += 0.25) for (let x = 0; x < 40; x += 0.25) parts[scaleAt(x, y, 5, 4)]++;
    expect(parts.face).toBeGreaterThan(parts.rim);
    expect(parts.rim).toBeGreaterThan(0);
    expect(parts.under).toBeGreaterThan(0);
    // Every other row is offset by half a scale.
    expect(scaleAt(2.5, 1, 5, 4)).toBe('face');
    expect(scaleAt(2.5, 5, 5, 4)).not.toBe('face');
  });

  it('a helm covers the crown, shows the fringe under its brow band, and its fins rise above it', () => {
    const hair = tones(WARDEN.head.hair);
    const noHelm: ChibiDesign = { ...WARDEN, headPieces: WARDEN.headPieces.slice(1) };
    expect(count(paint(WARDEN, still, 'back'), hair, around(onScreen(WARDEN, still, 'back', -4, 6, 0, 'head'), 6, 4))).toBe(0);
    expect(count(paint(noHelm, still, 'back'), hair, around(onScreen(WARDEN, still, 'back', -4, 6, 0, 'head'), 6, 4))).toBeGreaterThan(20);
    // The fringe under the band.
    expect(count(paint(WARDEN, still, 'front'), hair, around(onScreen(WARDEN, still, 'front', 10, 1.6, 0, 'head'), 6, 2))).toBeGreaterThan(2);
    // The fins rise over the helm in every view.
    const noFins: ChibiDesign = { ...WARDEN, headPieces: WARDEN.headPieces.map((hp, i) => (i ? hp : { ...hp, paint: undefined })) };
    for (const view of CHIBI_VIEWS) expect(extent(paint(WARDEN, still, view), []).top, view).toBeLessThanOrEqual(extent(paint(noFins, still, view), []).top);
    for (const view of CHIBI_VIEWS) expect(sum(paint(WARDEN, still, view)), view).not.toBe(sum(paint(noFins, still, view)));
  });

  it('a gorget\'s lames and scaled pauldrons change the plate they are on', () => {
    const metal = WARDEN.body.shin.mat;
    const edge = WARDEN.body.knee?.mat ?? metal;
    const gorget = { outer: metal, lining: metal, c: [0, 21, 0] as const, r: [6.6, 5.6, 8] as const, bottom: 21, top: { back: 26, side: 25.4, front: 24.6 }, open: 0 };
    const withGorget = (lames?: number): ChibiDesign => ({ ...WARDEN, headPieces: [WARDEN.headPieces[0] as never, collar({ ...gorget, lames })], outfit: [] });
    // Lames add a pale rim and a shadow band per lame.
    expect(count(paint(withGorget(3), still, 'back'), [...edge.tones, ...metal.tones.slice(0, 1)])).not.toBe(count(paint(withGorget(), still, 'back'), [...edge.tones, ...metal.tones.slice(0, 1)]));
    expect(sum(paint(withGorget(3), still, 'back'))).not.toBe(sum(paint(withGorget(), still, 'back')));
    const pauldron = (scales?: { w: number; h: number }): ChibiDesign => ({ ...WARDEN, outfit: [plates({ side: 1, plates: [{ c: [0, 2, 1], r: [4.8, 3.8, 4.6] }], mat: metal, rim: edge, scales })] });
    expect(sum(paint(pauldron({ w: 4.4, h: 3.2 }), still, 'side'))).not.toBe(sum(paint(pauldron(), still, 'side')));
  });
});

describe('the engine\'s new pieces of geometry', () => {
  it('a facet is painted at its true depth: it passes behind what is nearer', () => {
    const c = new Canvas(40, 40);
    const cam = camera('front', 0, 20, 30);
    const part = new Part(c, cam);
    // A tilted square: its top leans away from the viewer.
    part.facet([[0, 0, -6], [0, 0, 6], [-8, 12, 6], [-8, 12, -6]], flat('#ff0000'), 0, 1);
    const top = cam.proj([-7, 11, 0]);
    const bottom = cam.proj([-1, 1, 0]);
    expect(part.zAt(Math.floor(top[0]), Math.floor(top[1]))).toBeLessThan(part.zAt(Math.floor(bottom[0]), Math.floor(bottom[1])) - 4);
  });

  it('a capsule obstacle pushes straight out from its axis', () => {
    const rig = solveRig(HOODED.build, STAND, 0);
    const [right] = armObstacles(rig, 3);
    expect(right).toBeDefined();
    if (!right) return;
    const mid = at3(right.fr, 0, (right.len ?? 0) / 2, 0);
    const p: V3 = [mid[0] + 0.5, mid[1], mid[2] + 0.5];
    const q = pushOut(p, [right], 0);
    expect(len3(sub3(q, mid))).toBeCloseTo(3, 1);
  });
});
