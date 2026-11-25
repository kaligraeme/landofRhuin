import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTION_WINDUP, buildFrames, CLIP_LENGTH, CLIPS, posePoint, poseFor, rigSprite, SKILL_CHARGE, type Raster } from '../src/client/art/animation.js';
import { auraFor, RIG_HINTS } from '../src/client/art/rigs.js';

/** A blank raster with rectangles painted in an opaque colour. */
function raster(w: number, h: number, rects: [number, number, number, number][]): Raster {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x0, y0, x1, y1] of rects) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * w + x) * 4;
        data.set([120, 80, 60, 255], i);
      }
    }
  }
  return { w, h, data };
}

const opaque = (r: Raster): number => {
  let n = 0;
  for (let i = 3; i < r.data.length; i += 4) if ((r.data[i] as number) > 0) n++;
  return n;
};

// A body on two legs, and a figure in a floor-length robe.
const biped = raster(40, 60, [[12, 5, 27, 34], [13, 35, 18, 57], [21, 35, 26, 57]]);
const robed = raster(40, 60, [[12, 5, 27, 34], [10, 35, 29, 57]]);

describe('rigging', () => {
  it('finds the hip and the gap between two legs', () => {
    const rig = rigSprite(biped, 20);
    expect(rig.kind).toBe('biped');
    expect(Math.abs(rig.hipY - 35)).toBeLessThanOrEqual(1);
    expect(rig.splitX).toBeGreaterThanOrEqual(19);
    expect(rig.splitX).toBeLessThanOrEqual(20);
    expect(rig.backX).toBeLessThan(rig.splitX);
    expect(rig.frontX).toBeGreaterThan(rig.splitX);
  });

  it('treats a figure without separate legs as robed, and honours hints', () => {
    expect(rigSprite(robed, 20).kind).toBe('robed');
    expect(rigSprite(robed, 20, { floats: true }).kind).toBe('floater');
    const hinted = rigSprite(robed, 20, { hint: { kind: 'quadruped', hip: 0.5 } });
    expect(hinted.kind).toBe('quadruped');
    expect(hinted.hipY).toBe(Math.round(5 + 0.5 * 53));
  });

  it('has a rig and a skill glow for every hero, monster and boss', () => {
    const metrics = JSON.parse(readFileSync('src/client/art/creatures/metrics.json', 'utf8')) as Record<string, unknown>;
    for (const id of Object.keys(metrics)) {
      expect(RIG_HINTS[id], id).toBeDefined();
      expect(['biped', 'robed', 'quadruped', 'floater', 'object']).toContain(RIG_HINTS[id]!.kind);
      expect(auraFor(id)).toHaveLength(3);
    }
    expect(Object.keys(RIG_HINTS).sort()).toEqual(Object.keys(metrics).sort());
  });
});

describe('frames', () => {
  const rig = rigSprite(biped, 20);
  const set = buildFrames(biped, rig, [255, 200, 80]);

  it('builds every clip at one frame size', () => {
    for (const clip of CLIPS) {
      expect(set.frames[clip]).toHaveLength(CLIP_LENGTH[clip]);
      expect(set.poses[clip]).toHaveLength(CLIP_LENGTH[clip]);
      for (const f of set.frames[clip]) {
        expect(f.w).toBe(set.fw);
        expect(f.h).toBe(set.fh);
        expect(opaque(f)).toBeGreaterThan(opaque(biped) * 0.8);
      }
    }
    expect(set.fw).toBe(biped.w + set.pad * 2);
    expect(ACTION_WINDUP).toBeLessThan(CLIP_LENGTH.action);
    expect(SKILL_CHARGE).toBeLessThan(CLIP_LENGTH.skill);
  });

  it('keeps the first idle frame identical to the artwork', () => {
    const f = set.frames.idle[0]!;
    for (let y = 0; y < biped.h; y++) {
      for (let x = 0; x < biped.w; x++) {
        const a = biped.data[(y * biped.w + x) * 4 + 3];
        const b = f.data[((y + set.pad) * f.w + x + set.pad) * 4 + 3];
        expect(b).toBe(a);
      }
    }
  });

  it('steps the legs, smears the blow and glows for a skill', () => {
    const same = (a: Raster, b: Raster) => a.data.every((v, i) => v === b.data[i]);
    expect(same(set.frames.move[0]!, set.frames.move[2]!)).toBe(false);
    // The lunge leaves a faint afterimage behind the figure.
    const strike = set.frames.action[ACTION_WINDUP]!;
    let faint = 0;
    for (let i = 3; i < strike.data.length; i += 4) if ((strike.data[i] as number) > 0 && (strike.data[i] as number) < 120) faint++;
    expect(faint).toBeGreaterThan(20);
    // The release frame glows in the aura colour around the silhouette.
    const release = set.frames.skill[SKILL_CHARGE]!;
    let glow = 0;
    for (let i = 0; i < release.data.length; i += 4) if (release.data[i] === 255 && release.data[i + 1] === 200 && release.data[i + 2] === 80) glow++;
    expect(glow).toBeGreaterThan(40);
  });

  it('moves the weapon hand with the pose', () => {
    const hand = { x: 27, y: 20 };
    expect(posePoint(rig, poseFor(rig, 'idle', 0), set.pad, hand)).toEqual({ x: hand.x + set.pad, y: hand.y + set.pad });
    const strike = posePoint(rig, poseFor(rig, 'action', ACTION_WINDUP + 1), set.pad, hand);
    expect(strike.x).toBeGreaterThan(hand.x + set.pad + 2);
  });
});
