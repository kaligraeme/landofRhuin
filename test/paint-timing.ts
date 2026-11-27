/**
 * Paint-time checks that hold on a busy machine.
 *
 * A budget in milliseconds a frame (say 12 ms) fails whenever other work shares the machine, and
 * passes a real slowdown on a fast one. These checks time the work against a reference painted in
 * the same breath instead: frame by frame, a frame of the work and then a frame of the reference,
 * in a few rounds that each take every so-many frame of both (so each round is a fair sample of
 * all of them), and keep the median of the rounds' ratios. A machine busy throughout slows both
 * sides alike, a stall in one round is outvoted by the others, and a real slowdown of the work
 * (or of the engine, against a reference that does not use it) still shows as a larger ratio.
 */
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS } from '../src/client/art/heroes/chibi/index.js';

/** A frame to paint: called once a time it is timed. */
export type Paint = () => unknown;

/** How the work compared with the reference: the median ratio of the rounds, and the median milliseconds a frame of each. */
export interface Timing {
  ratio: number;
  ms: number;
  refMs: number;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};

/**
 * Times frames of `work` against frames of `reference`, interleaved one for one, in `rounds`
 * rounds (an odd number: each round takes every `rounds`-th frame of the work, starting at its
 * own offset, and as many of the reference, cycling through it). A round's worth of each is
 * painted first, untimed, so neither side pays alone for warming up.
 */
export function timeAgainst(work: readonly Paint[], reference: readonly Paint[], rounds = 5): Timing {
  for (let i = 0; i < work.length; i += rounds) (work[i] as Paint)();
  for (let i = 0; i < reference.length; i += rounds) (reference[i] as Paint)();
  const ratios: number[] = [];
  const mss: number[] = [];
  const refs: number[] = [];
  let r = 0;
  for (let k = 0; k < rounds; k++) {
    let tw = 0;
    let tr = 0;
    let n = 0;
    for (let i = k; i < work.length; i += rounds) {
      const t0 = performance.now();
      (work[i] as Paint)();
      const t1 = performance.now();
      (reference[r++ % reference.length] as Paint)();
      const t2 = performance.now();
      tw += t1 - t0;
      tr += t2 - t1;
      n++;
    }
    if (!n) continue;
    ratios.push(tw / tr);
    mss.push(tw / n);
    refs.push(tr / n);
  }
  return { ratio: median(ratios), ms: median(mss), refMs: median(refs) };
}

/**
 * Frames of the Dark Knight to compare engine work against: every `stride`-th frame of every
 * clip in every view, so the sample spans his stances, blows, skills and falls.
 */
export function darkKnightFrames(stride = 3): Paint[] {
  const hero = CHIBI_HEROES['hero-dark-knight'];
  if (!hero) throw new Error('the Dark Knight is not registered');
  const out: Paint[] = [];
  let i = 0;
  for (const view of CHIBI_VIEWS) {
    for (const clip of CHIBI_CLIPS) {
      for (let f = 0; f < hero.timing[clip].frames; f++) if (i++ % stride === 0) out.push(() => hero.paint(clip, f, view));
    }
  }
  return out;
}

/**
 * A frame's worth of plain work that does not use the engine, to time the engine itself against:
 * shading a hero-sized frame pixel by pixel (a little float maths, a depth buffer and RGBA writes
 * a pixel, as a painter does), the same every call. `count` copies, for a reference to cycle.
 */
export function machineFrames(count = 8): Paint[] {
  const w = 224;
  const h = 240;
  const px = new Uint8ClampedArray(w * h * 4);
  const depth = new Float32Array(w * h);
  const paint = (): number => {
    let s = 0;
    depth.fill(-1e9);
    for (let disc = 0; disc < 24; disc++) {
      const cx = 50 + (disc % 8) * 18;
      const cy = 60 + (disc % 5) * 30;
      const r = 36 + (disc % 4) * 8;
      for (let y = Math.max(0, cy - r); y < Math.min(h, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x < Math.min(w, cx + r); x++) {
          const dx = (x - cx) / r;
          const dy = (y - cy) / r;
          const d2 = dx * dx + dy * dy;
          if (d2 > 1) continue;
          const z = Math.sqrt(1 - d2) * r + disc;
          const i = y * w + x;
          if (z <= (depth[i] as number)) continue;
          depth[i] = z;
          const lit = Math.max(0, -dx * 0.5 - dy * 0.6 + Math.sqrt(1 - d2) * 0.6);
          const tone = lit > 0.75 ? 230 : lit > 0.45 ? 180 : lit > 0.2 ? 120 : 70;
          px[i * 4] = tone;
          px[i * 4 + 1] = (tone * 0.8) | 0;
          px[i * 4 + 2] = (tone * 0.6) | 0;
          px[i * 4 + 3] = 255;
          s += tone;
        }
      }
    }
    return s;
  };
  return Array.from({ length: count }, () => paint);
}
