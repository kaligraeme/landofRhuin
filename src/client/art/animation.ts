/**
 * Frame animation for the cast. Every hero, monster and boss is drawn as one static sprite; this
 * module rigs that sprite (an upper body over two legs, a robe, four legs, a hovering form or a
 * rigid object) and poses the rig to build frames for five clips:
 *
 *   idle    breathing, out of combat
 *   battle  a ready stance while a fight is on
 *   move    a walk cycle: legs step, the body rises and falls, robes and wraiths sway
 *   action  a basic attack: wind up, lunge into the blow with a motion smear, recover
 *   skill   a skill or spell: crouch and gather a glowing aura, release with a flash, settle
 *
 * The generator works on plain RGBA rasters so it can run anywhere (the browser builds frames
 * from each sprite as it loads; tests run it in Node). It never paints new pixels other than the
 * aura and smear: every frame is the original artwork, bent and moved, so it keeps its look.
 */

export type Clip = 'idle' | 'battle' | 'move' | 'action' | 'skill';
export const CLIPS: readonly Clip[] = ['idle', 'battle', 'move', 'action', 'skill'];
export const CLIP_LENGTH: Record<Clip, number> = { idle: 4, battle: 4, move: 8, action: 6, skill: 8 };
/** The first frames of the action clip wind up; the blow lands on the next one. */
export const ACTION_WINDUP = 2;
/** The first frames of the skill clip gather power; the release follows. */
export const SKILL_CHARGE = 3;

export type RigKind = 'biped' | 'robed' | 'quadruped' | 'floater' | 'object';

export interface Raster {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** Hand-tuned rig settings for a sprite; hip and split are fractions of the figure's bounds. */
export interface RigHint {
  kind?: RigKind;
  hip?: number;
  split?: number;
  /** Width of each leg band, as a fraction of the figure's width. */
  legs?: number;
}

export interface Rig {
  kind: RigKind;
  /** Opaque bounds of the figure. */
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Where the upper body ends and the legs (or robe, or hanging form) begin. */
  hipY: number;
  /** The column between the back legs and the front legs. */
  splitX: number;
  /** Pivots the back and front legs swing from. */
  backX: number;
  frontX: number;
  /** Each leg band's width: pixels below the hip outside the bands stay with the body. */
  legW: number;
  /** Motion scale: 1 for a figure about 90 pixels tall. */
  scale: number;
}

/** One frame's pose, in source pixels and radians. */
export interface Pose {
  /** Upper body: rise (negative) or crouch (positive). */
  bob: number;
  /** Upper body: horizontal shear at the top of the head, positive leaning forward. */
  lean: number;
  /** Upper body: vertical stretch about the hip. */
  stretch: number;
  /** Leg swings, positive moving the foot forward. */
  back: number;
  front: number;
  /** Robe or hanging form: hem sway, and a travelling ripple. */
  sway: number;
  ripple: number;
  phase: number;
  /** Whole figure: shift forward or back. */
  shiftX: number;
  /** Skill glow, 0 to 1. */
  aura: number;
  /** Brighten toward white, 0 to 1. */
  flash: number;
  /** Afterimage trailing this far behind (0 for none). */
  smear: number;
}

export interface FrameSet {
  /** Frame size: the sprite plus padding on every side. */
  fw: number;
  fh: number;
  pad: number;
  rig: Rig;
  frames: Record<Clip, Raster[]>;
  poses: Record<Clip, Pose[]>;
}

const SOLID = 96;

const neutral = (): Pose => ({ bob: 0, lean: 0, stretch: 1, back: 0, front: 0, sway: 0, ripple: 0, phase: 0, shiftX: 0, aura: 0, flash: 0, smear: 0 });

// ── Rigging ──────────────────────────────────────────────────────────────────────────────────

function alphaAt(r: Raster, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= r.w || y >= r.h) return 0;
  return r.data[(y * r.w + x) * 4 + 3] as number;
}

/**
 * Rigs a sprite. Bipeds are found by the gap between their legs near the ground anchor; anything
 * without one is treated as robed unless a hint says otherwise.
 */
export function rigSprite(src: Raster, anchorX: number, opts: { floats?: boolean; hint?: RigHint } = {}): Rig {
  let top = src.h;
  let bottom = -1;
  let left = src.w;
  let right = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (alphaAt(src, x, y) < SOLID) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (bottom < 0) {
    top = 0;
    bottom = src.h - 1;
    left = 0;
    right = src.w - 1;
  }
  const bh = bottom - top + 1;
  const bw = right - left + 1;
  const scale = bh / 90;
  const hint = opts.hint ?? {};
  let kind: RigKind | undefined = hint.kind ?? (opts.floats ? 'floater' : undefined);
  let hipY = hint.hip !== undefined ? top + hint.hip * bh : NaN;
  let splitX = hint.split !== undefined ? left + hint.split * bw : NaN;

  if (!kind || (kind === 'biped' && (Number.isNaN(hipY) || Number.isNaN(splitX)))) {
    const gap = findLegGap(src, anchorX, top, bottom, bw);
    if (gap) {
      kind = kind ?? 'biped';
      if (Number.isNaN(hipY)) hipY = gap.hipY;
      if (Number.isNaN(splitX)) splitX = gap.splitX;
    } else {
      kind = kind ?? 'robed';
    }
  }
  if (Number.isNaN(hipY)) hipY = top + bh * (kind === 'quadruped' ? 0.62 : kind === 'object' ? 1 : 0.58);
  if (Number.isNaN(splitX)) splitX = anchorX;
  hipY = Math.round(hipY);
  splitX = Math.round(splitX);

  // Leg bands either side of the split, pivoting from their middles. Quadrupeds pivot from the
  // middle of each pair of legs.
  const legW = (hint.legs ?? (kind === 'quadruped' ? 0.5 : 0.2)) * bw;
  let backX = splitX - legW / 2;
  let frontX = splitX + legW / 2;
  if (kind === 'quadruped') {
    const sums = { b: 0, bn: 0, f: 0, fn: 0 };
    for (let y = hipY; y <= bottom; y++) {
      for (let x = Math.max(left, Math.round(splitX - legW)); x <= Math.min(right, Math.round(splitX + legW)); x++) {
        if (alphaAt(src, x, y) < SOLID) continue;
        if (x < splitX) {
          sums.b += x;
          sums.bn++;
        } else {
          sums.f += x;
          sums.fn++;
        }
      }
    }
    if (sums.bn) backX = sums.b / sums.bn;
    if (sums.fn) frontX = sums.f / sums.fn;
  }
  return { kind, top, bottom, left, right, hipY, splitX, backX, frontX, legW, scale };
}

/** Looks for the run of rows near the ground where two legs stand apart around the anchor. */
function findLegGap(src: Raster, anchorX: number, top: number, bottom: number, bw: number): { hipY: number; splitX: number } | null {
  const bh = bottom - top + 1;
  const lo = Math.max(0, Math.round(anchorX - bw * 0.2));
  const hi = Math.min(src.w - 1, Math.round(anchorX + bw * 0.2));
  const centres: (number | null)[] = [];
  for (let y = bottom - 1; y >= top + bh * 0.4; y--) {
    let best: number | null = null;
    let bestLen = 0;
    let x = lo;
    let seenSolid = false;
    while (x <= hi) {
      if (alphaAt(src, x, y) >= SOLID) {
        seenSolid = true;
        x++;
        continue;
      }
      const start = x;
      while (x <= hi && alphaAt(src, x, y) < SOLID) x++;
      const closed = seenSolid && x <= hi;
      if (closed && x - start > bestLen) {
        bestLen = x - start;
        best = (start + x - 1) / 2;
      }
    }
    centres.push(best);
  }
  // From the ground up, follow the gap while it lasts (allowing short breaks).
  let lastGap = -1;
  let misses = 0;
  for (let i = 0; i < centres.length; i++) {
    if (centres[i] !== null) {
      lastGap = i;
      misses = 0;
    } else if (lastGap >= 0 && ++misses > 2) {
      break;
    } else if (lastGap < 0 && i > 4) {
      return null;
    }
  }
  if (lastGap < bh * 0.12) return null;
  const found = centres.slice(0, lastGap + 1).filter((c): c is number => c !== null).sort((a, b) => a - b);
  const splitX = found[Math.floor(found.length / 2)] as number;
  return { hipY: bottom - 1 - lastGap, splitX };
}

// ── Posing ───────────────────────────────────────────────────────────────────────────────────

/** The pose for frame `i` of a clip. */
export function poseFor(rig: Rig, clip: Clip, i: number): Pose {
  const k = rig.scale;
  const p = neutral();
  const n = CLIP_LENGTH[clip];
  const phi = (2 * Math.PI * i) / n;
  const wave = (1 - Math.cos(phi)) / 2;
  const kind = rig.kind;
  switch (clip) {
    case 'idle':
      p.bob = -0.8 * k * wave;
      p.stretch = 1 + 0.012 * wave;
      if (kind === 'floater') {
        p.bob = -2.5 * k * Math.sin(phi);
        p.ripple = 1.2 * k;
        p.phase = phi;
      }
      if (kind === 'object') p.flash = 0.06 * wave;
      break;
    case 'battle':
      p.bob = k * (0.8 + 0.7 * wave);
      p.lean = 1.4 * k;
      p.stretch = 0.995 - 0.01 * wave;
      p.back = 0.05;
      p.front = 0.05;
      if (kind === 'robed') p.sway = 1.2 * k * Math.sin(phi);
      if (kind === 'floater') {
        p.bob = -2 * k * Math.sin(phi);
        p.ripple = 1.6 * k;
        p.phase = phi;
      }
      if (kind === 'object') p.flash = 0.1 * wave;
      break;
    case 'move': {
      const stride = kind === 'quadruped' ? 0.24 : 0.3;
      p.back = stride * Math.sin(phi);
      p.front = -stride * Math.sin(phi);
      p.bob = -1.6 * k * (1 - Math.abs(Math.sin(phi)));
      p.lean = 1.5 * k;
      if (kind === 'robed') {
        p.sway = 3 * k * Math.sin(phi);
        p.bob = -1 * k * (1 - Math.abs(Math.sin(phi)));
      }
      if (kind === 'floater') {
        p.bob = -2 * k * Math.sin(phi);
        p.ripple = 2.2 * k;
        p.phase = phi * 2;
        p.lean = 2 * k;
      }
      if (kind === 'object') {
        p.bob = 0;
        p.lean = 0;
      }
      break;
    }
    case 'action': {
      const lean = [-2.5, -4, 5, 6, 3, 1][i] as number;
      const shift = [-1, -2, 3, 4, 2, 0.5][i] as number;
      p.lean = lean * k;
      p.shiftX = shift * k;
      p.stretch = ([1.02, 1.03, 0.98, 0.98, 1, 1][i] as number);
      p.bob = ([0, -0.5, 0.5, 1, 0.5, 0][i] as number) * k;
      p.front = [-0.05, -0.08, 0.22, 0.25, 0.12, 0.03][i] as number;
      p.back = [0.05, 0.06, -0.12, -0.14, -0.06, 0][i] as number;
      p.smear = ([0, 0, 7, 4, 0, 0][i] as number) * k;
      if (kind === 'robed') p.sway = ([1, 1.5, -2.5, -3, -1.5, 0][i] as number) * k;
      if (kind === 'floater') {
        p.ripple = 1.5 * k;
        p.phase = phi;
      }
      if (kind === 'object') {
        p.lean = 0;
        p.smear = 0;
        p.shiftX = ([-1, 1, -1.5, 1.5, -0.5, 0][i] as number) * k;
        p.flash = i === 2 ? 0.3 : 0;
      }
      break;
    }
    case 'skill':
      p.aura = [0.25, 0.5, 0.75, 1, 0.85, 0.6, 0.35, 0.15][i] as number;
      p.bob = ([1, 1.5, 1.8, -2, -1.2, -0.5, 0, 0][i] as number) * k;
      p.stretch = [0.98, 0.97, 0.96, 1.05, 1.03, 1.01, 1, 1][i] as number;
      p.lean = ([0, -1, -1.5, 1, 0.5, 0, 0, 0][i] as number) * k;
      p.flash = [0, 0, 0.04, 0.16, 0.07, 0, 0, 0][i] as number;
      if (i < SKILL_CHARGE) {
        p.back = 0.06;
        p.front = 0.06;
      }
      if (kind === 'robed') p.sway = ([0.5, 1, 1.5, -2, -1, 0, 0, 0][i] as number) * k;
      if (kind === 'floater') {
        p.ripple = 2 * k;
        p.phase = phi;
      }
      if (kind === 'object') {
        p.bob = 0;
        p.lean = 0;
        p.stretch = 1;
      }
      break;
  }
  if (kind === 'object' || kind === 'robed' || kind === 'floater') {
    p.back = 0;
    p.front = 0;
  }
  return p;
}

/** Where a point on the upper body (a hand, say) lands in a posed frame, in frame pixels. */
export function posePoint(rig: Rig, pose: Pose, pad: number, pt: { x: number; y: number }): { x: number; y: number } {
  const above = rig.hipY - rig.top;
  const lean = above > 0 ? (pose.lean * Math.max(0, rig.hipY - pt.y)) / above : 0;
  return {
    x: pt.x + pad + pose.shiftX + lean,
    y: rig.hipY + (pt.y - rig.hipY) * pose.stretch + pad + pose.bob,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────────────────────

type InverseMap = (ox: number, oy: number) => [number, number] | null;

/** Composites the source pixels an inverse map picks for every output pixel, over `out`. */
function blit(src: Raster, out: Raster, map: InverseMap, alphaMul = 1): void {
  const s = src.data;
  const o = out.data;
  for (let oy = 0; oy < out.h; oy++) {
    for (let ox = 0; ox < out.w; ox++) {
      const hit = map(ox, oy);
      if (!hit) continue;
      const sx = Math.round(hit[0]);
      const sy = Math.round(hit[1]);
      if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
      const si = (sy * src.w + sx) * 4;
      const sa = ((s[si + 3] as number) / 255) * alphaMul;
      if (sa <= 0) continue;
      const oi = (oy * out.w + ox) * 4;
      const da = (o[oi + 3] as number) / 255;
      const a = sa + da * (1 - sa);
      for (let c = 0; c < 3; c++) o[oi + c] = ((s[si + c] as number) * sa + (o[oi + c] as number) * da * (1 - sa)) / a;
      o[oi + 3] = a * 255;
    }
  }
}

/** Whether a source column lies in either leg band (the rest of the lower body moves with the torso). */
function inLegs(rig: Rig, x: number, y: number): boolean {
  // The bands widen toward the ground, where feet and toes stick out.
  const f = Math.min(1, Math.max(0, (y - rig.hipY) / Math.max(1, rig.bottom - rig.hipY)));
  const w = rig.legW * (1 + 0.9 * f * f);
  return x >= rig.splitX - w && x < rig.splitX + w;
}

function upperMap(rig: Rig, pose: Pose, pad: number, overlap: number, whole: boolean): InverseMap {
  const above = Math.max(1, rig.hipY - rig.top);
  return (ox, oy) => {
    const x = ox - pad - pose.shiftX;
    const y = oy - pad - pose.bob;
    const sy = rig.hipY + (y - rig.hipY) / pose.stretch;
    const sx = x - (pose.lean * Math.max(0, rig.hipY - sy)) / above;
    if (!whole && sy >= rig.hipY + overlap && inLegs(rig, sx, sy)) return null;
    return [sx, sy];
  };
}

function legMap(rig: Rig, pose: Pose, pad: number, side: 'back' | 'front'): InverseMap {
  const swing = side === 'back' ? pose.back : pose.front;
  const theta = -swing;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const foot = rig.bottom + 1;
  const hip = rig.hipY + pose.bob;
  const k = (foot - hip) / Math.max(1, foot - rig.hipY);
  const px = side === 'back' ? rig.backX : rig.frontX;
  return (ox, oy) => {
    const qx = ox - pad - pose.shiftX - px;
    const qy = oy - pad - hip;
    // Undo the swing about the hip, then the stretch that keeps the feet on the ground.
    const x = px + qx * c + qy * s;
    const y1 = hip - qx * s + qy * c;
    const sy = foot - (foot - y1) / k;
    if (sy < rig.hipY - 1) return null;
    if ((side === 'back') !== x < rig.splitX || !inLegs(rig, x, sy)) return null;
    return [x, sy];
  };
}

function lowerMap(rig: Rig, pose: Pose, pad: number): InverseMap {
  const B = rig.bottom + 1;
  const span = Math.max(1, B - rig.hipY);
  const floats = rig.kind === 'floater';
  return (ox, oy) => {
    const x = ox - pad - pose.shiftX;
    const y = oy - pad;
    // Robes: the waist moves with the body and the hem stays put. Wraiths move as one.
    const sy = floats ? y - pose.bob : (y - (pose.bob * B) / span) / (1 - pose.bob / span);
    if (sy < rig.hipY - 1) return null;
    const f = Math.min(1, Math.max(0, (sy - rig.hipY) / span));
    const sx = x - pose.sway * f ** 1.5 - pose.ripple * Math.sin(pose.phase + sy * 0.18) * f;
    return [sx, sy];
  };
}

/** Tints the figure toward the aura colour and brightens it for a flash, then glows around it. */
function shade(out: Raster, pose: Pose, aura: [number, number, number], scale: number): void {
  const d = out.data;
  const tint = pose.aura * 0.12;
  if (tint > 0 || pose.flash > 0) {
    for (let i = 0; i < out.w * out.h; i++) {
      if ((d[i * 4 + 3] as number) < 30) continue;
      for (let c = 0; c < 3; c++) {
        let v = d[i * 4 + c] as number;
        v += ((aura[c] as number) - v) * tint;
        v += (255 - v) * pose.flash;
        d[i * 4 + c] = v;
      }
    }
  }
  if (pose.aura <= 0) return;
  const r = Math.max(1, Math.round(1.6 * scale));
  const alpha = new Uint8Array(out.w * out.h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3] as number;
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = y * out.w + x;
      if ((alpha[i] as number) >= 30) continue;
      let near = r + 1;
      for (let dy = -r; dy <= r && near > 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= out.h) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= out.w || (alpha[yy * out.w + xx] as number) < 120) continue;
          near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      }
      if (near > r) continue;
      d[i * 4] = aura[0];
      d[i * 4 + 1] = aura[1];
      d[i * 4 + 2] = aura[2];
      d[i * 4 + 3] = Math.max(d[i * 4 + 3] as number, 255 * pose.aura * 0.75 * (1 - (near - 1) / (r + 1)));
    }
  }
}

/** Renders one posed frame of the sprite. */
export function renderFrame(src: Raster, rig: Rig, pose: Pose, pad: number, aura: [number, number, number]): Raster {
  const out: Raster = { w: src.w + pad * 2, h: src.h + pad * 2, data: new Uint8ClampedArray((src.w + pad * 2) * (src.h + pad * 2) * 4) };
  const overlap = Math.max(2, Math.round(2.5 * rig.scale));
  const layers = (p: Pose, alphaMul: number): void => {
    if (rig.kind === 'object') {
      blit(src, out, upperMap(rig, p, pad, overlap, true), alphaMul);
      return;
    }
    if (rig.kind === 'biped' || rig.kind === 'quadruped') {
      blit(src, out, legMap(rig, p, pad, 'back'), alphaMul);
      blit(src, out, legMap(rig, p, pad, 'front'), alphaMul);
    } else {
      blit(src, out, lowerMap(rig, p, pad), alphaMul);
    }
    blit(src, out, upperMap(rig, p, pad, overlap, false), alphaMul);
  };
  if (pose.smear > 0) layers({ ...pose, shiftX: pose.shiftX - pose.smear, lean: pose.lean - pose.smear * 0.5, aura: 0, flash: 0 }, 0.3);
  layers(pose, 1);
  shade(out, pose, aura, rig.scale);
  return out;
}

/** Builds every clip's frames for a sprite. */
export function buildFrames(src: Raster, rig: Rig, aura: [number, number, number]): FrameSet {
  const pad = Math.ceil(9 * rig.scale) + 3;
  const frames = {} as Record<Clip, Raster[]>;
  const poses = {} as Record<Clip, Pose[]>;
  for (const clip of CLIPS) {
    poses[clip] = [];
    frames[clip] = [];
    for (let i = 0; i < CLIP_LENGTH[clip]; i++) {
      const pose = poseFor(rig, clip, i);
      poses[clip].push(pose);
      frames[clip].push(renderFrame(src, rig, pose, pad, aura));
    }
  }
  return { fw: src.w + pad * 2, fh: src.h + pad * 2, pad, rig, frames, poses };
}

/** Parses '#rrggbb'. */
export function rgbOf(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)] : [255, 255, 255];
}
