/**
 * Chibi heads: a skull and jaw under a shell of hair, ray-cast through the camera so they turn
 * smoothly through every angle, with locks of hair (clumps raked over the head, a fringe, locks at
 * the nape) laid over the shell as leaf-shaped clumps, clumps painted onto the back of the shell
 * fanning from the crown, and the face's features stamped on as small pixel glyphs chosen by how
 * squarely each one faces the viewer, from the design's face style (FACE_PLAIN, FACE_SOFT,
 * FACE_SHARP or its own). Everything is drawn into one part with a depth test, so locks pass in
 * front of and behind the head as they should, and a coloured line parts each clump from the hair
 * behind it; a last pass tidies lone pixels out of the hair.
 *
 * Long hair (a curtain down the back, locks over the shoulders, a ponytail) hangs from the head
 * but is sorted with the body (`hairItems`, which the painter adds to its list): each tress is a
 * strand (pieces.ts `strand`) that lies over the head and the torso and streams with the pose,
 * painted as a long clump that grows out of the head's hair without a line between them.
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { type BodyDesign, type DrawItem, type FaceDesign, type FaceGlyph, type FaceStyle, HAIR_TAG, HEAD_TAG, type HeadDesign, type HeadPiece, type Lock, type PieceContext, type Tress } from './design.js';
import { hash, type Obstacle, strand, torsoObstacles } from './pieces.js';
import { flat, type Hit, type Mat, type Part, shade, toneLight } from './raster.js';
import { add3, at3, cross3, dirIn, dot3, type Face, type Frame3, lerp, mul3, norm3, rad, TO_CAMERA, type V3 } from './rig.js';

/** Shape ids inside the head's part. */
const SKIN = 1;
const EAR = 2;
const SHELL = 3;
const LOCK0 = 10;

/** A direction in hero space, in a frame's own axes. */
const inFrame = (fr: Frame3, d: V3): V3 => [dot3(d, fr.f), dot3(d, fr.u), dot3(d, fr.r)];

/** Is a point on the shell (head space) bare, letting the face, ears or neck show? */
function bare(d: HeadDesign, p: V3): boolean {
  const h = d.hairline;
  const yaw = Math.abs((Math.atan2(p[2], p[0]) * 180) / Math.PI);
  if (yaw < h.faceYaw) {
    const k = yaw / h.faceYaw;
    return p[1] < h.brow + (h.temple - h.brow) * k * k;
  }
  if (yaw < 120) {
    const k = (yaw - h.faceYaw) / (120 - h.faceYaw);
    return p[1] < h.temple + (h.ear - h.temple) * Math.min(1, k * 1.6) + (h.nape - h.ear) * Math.max(0, k - 0.6) * 2.5;
  }
  return p[1] < h.nape;
}

// ── Face glyphs ──────────────────────────────────────────────────────────────────────────────
// Rows of cells, the inner corner (toward the nose) on the left; mirrored for the other side.
// K lash, I iris, i iris (light), D iris (deep), W white, h shine, l lid crease (skin shadow),
// B brow, M mouth, r mouth inside, T teeth (see FaceGlyph in design.ts).

type Glyph = FaceGlyph;

/**
 * The plain style (the default): small, level eyes under a heavy brow that slants down toward the
 * nose, and a firm, straight mouth: a stern young man's face.
 */
export const FACE_PLAIN: FaceStyle = {
  eyes: {
    full: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '..ii.'], ax: 2, ay: 1 },
    mid: { rows: ['KKKK', 'IhIW', 'iIIK', '.ii.'], ax: 1, ay: 1 },
    narrow: { rows: ['KKK', 'IhK', 'iIK', 'i..'], ax: 1, ay: 1 },
    // A blink: the lid shut in a line at the eye's middle, a lash at its outer corner, the crease under it.
    closed: { rows: ['KKKKK', '.lllK'], ax: 2, ay: 0 },
    // Squeezed shut in pain: a chevron pointing in toward the nose.
    squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '.KKK.'], ax: 2, ay: 1 },
  },
  brows: {
    full: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
    mid: { rows: ['.BBB', 'BB..'], ax: 1, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
  // Brows knitted up at their inner ends (pain).
  browsUp: {
    full: { rows: ['BB...', '.BBBB'], ax: 2, ay: 1 },
    mid: { rows: ['BB..', '.BBB'], ax: 1, ay: 1 },
    narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
  },
  // Mouths are laid out across the face (left to right on screen), centred on the anchor.
  mouths: {
    stern: { rows: ['MMM'], ax: 1, ay: 0 },
    shout: { rows: ['MMM', 'MrM', '.M.'], ax: 1, ay: 0 },
    grit: { rows: ['MTTM'], ax: 2, ay: 0 },
    hurt: { rows: ['.MMM.', 'MTTTM', 'MrrrM', '.MMM.'], ax: 2, ay: 1 },
    closed: { rows: ['MM'], ax: 1, ay: 0 },
    smirk: { rows: ['..M', 'MM.'], ax: 1, ay: 0 },
  },
};

/**
 * The soft style: large eyes, mostly iris (deep at the top, light at the bottom, a big shine),
 * under a heavy upper lash that flicks out past the outer corner, with a short lower lash; thin,
 * gently arched brows; a small mouth. Calm when closed (a curved lash line), with a smile for a smirk.
 */
export const FACE_SOFT: FaceStyle = {
  eyes: {
    full: { rows: ['.KKKKK', 'KDhDDK', 'KIhIIW', 'KiIIiW', '.liil.'], ax: 2, ay: 2 },
    mid: { rows: ['KKKKK', 'DhDDK', 'IhIIW', 'iIIiK', '.lil.'], ax: 1, ay: 2 },
    narrow: { rows: ['KKKK', 'DhDK', 'IIiK', 'il..'], ax: 1, ay: 2 },
    // Closed: a curved lash line, its outer end flicking out, and a lash crease under it.
    closed: { rows: ['.....K', 'KKKKK.', '.lll..'], ax: 2, ay: 1 },
    squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
    wide: { rows: ['.KKKKK', 'KDhDDK', 'KIhIIW', 'KiIIiW', '.KKKK.'], ax: 2, ay: 2 },
  },
  brows: {
    full: { rows: ['.BBB.', 'B...B'], ax: 2, ay: 1 },
    mid: { rows: ['.BBB', 'B...'], ax: 1, ay: 1 },
    narrow: { rows: ['BBB'], ax: 1, ay: 0 },
  },
  browsUp: {
    full: { rows: ['BB...', '..BBB'], ax: 2, ay: 1 },
    mid: { rows: ['BB..', '..BB'], ax: 1, ay: 1 },
    narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
  },
  mouths: {
    stern: { rows: ['MM'], ax: 1, ay: 0 },
    shout: { rows: ['.MM.', 'MrrM', '.MM.'], ax: 2, ay: 1 },
    grit: { rows: ['MTTM'], ax: 2, ay: 0 },
    hurt: { rows: ['.MM.', 'MrrM', 'M..M'], ax: 2, ay: 1 },
    closed: { rows: ['M.M', '.M.'], ax: 1, ay: 0 },
    smirk: { rows: ['M..M', '.MM.'], ax: 2, ay: 0 },
  },
};

/**
 * The sharp style: narrow eyes under a heavy lid that sweeps up to the outer corner, a slit of
 * iris with a bright shine; straight brows angled down a little toward the nose; a lopsided smirk.
 */
export const FACE_SHARP: FaceStyle = {
  eyes: {
    full: { rows: ['...KKK', 'KKKhIK', '.KiIIW', '...ll.'], ax: 3, ay: 1 },
    mid: { rows: ['..KKK', 'KKhIK', '.iIIK', '..l..'], ax: 2, ay: 1 },
    narrow: { rows: ['.KKK', 'KhIK', 'iIK.'], ax: 1, ay: 1 },
    closed: { rows: ['...KKK', 'KKKK..'], ax: 3, ay: 1 },
    squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
    wide: { rows: ['..KKKK', 'KKhIIK', 'KiIIIW', '.KKKK.'], ax: 3, ay: 1 },
  },
  brows: {
    full: { rows: ['...BBB', 'BBBB..'], ax: 3, ay: 1 },
    mid: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
    narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
  },
  browsUp: {
    full: { rows: ['BB....', '.BBBBB'], ax: 3, ay: 1 },
    mid: { rows: ['BB...', '.BBBB'], ax: 2, ay: 1 },
    narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
  },
  mouths: {
    stern: { rows: ['MMM'], ax: 1, ay: 0 },
    shout: { rows: ['MMMM', 'MrrM', '.MM.'], ax: 2, ay: 0 },
    grit: { rows: ['MTTTM'], ax: 2, ay: 0 },
    hurt: { rows: ['.MMM.', 'MTTTM', '.MMM.'], ax: 2, ay: 1 },
    closed: { rows: ['MM.'], ax: 1, ay: 0 },
    smirk: { rows: ['...M', 'MMM.'], ax: 1, ay: 0 },
  },
};

/** Stamps a glyph into the part where the face shows (not over hair), mirrored when `dir` is -1. */
function stamp(part: Part, g: Glyph, x: number, y: number, dir: number, colours: Record<string, Mat>, z: number, onlyOn: (id: number) => boolean): void {
  g.rows.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      const ch = row[gx] as string;
      const m = colours[ch];
      if (!m) continue;
      const px = Math.round(x) + (gx - g.ax) * dir;
      const py = Math.round(y) + gy - g.ay;
      if (!onlyOn(part.idAt(px, py))) continue;
      part.plot(px, py, m, 0, z, SKIN, true);
    }
  });
}

/** How far clear of the hair's shell a lock lies, as a share of its radii. */
const LIE = 0.04;

/**
 * A lock's points along its length, in head space. It grows from just under the shell and never
 * sinks back into it: a lock swept over the head lies on the hair under it, so long clumps can
 * flow over the crown and down the back.
 */
function lockPath(d: HeadDesign, lk: Lock, push: V3): V3[] {
  const s = d.shell;
  const cp = Math.cos(rad(lk.pitch));
  const root: V3 = [s.c[0] + Math.cos(rad(lk.yaw)) * cp * s.r[0] * 0.9, s.c[1] + Math.sin(rad(lk.pitch)) * s.r[1] * 0.9, s.c[2] + Math.sin(rad(lk.yaw)) * cp * s.r[2] * 0.9];
  const dir = norm3(add3(norm3(lk.dir), push, lk.give ?? 1));
  const curl = lk.curl ?? [0, 0, 0];
  const pts: V3[] = [root];
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = add3(add3(root, dir, lk.len * t), curl, lk.len * t * t);
    const q: V3 = [(p[0] - s.c[0]) / s.r[0], (p[1] - s.c[1]) / s.r[1], (p[2] - s.c[2]) / s.r[2]];
    const ql = Math.hypot(q[0], q[1], q[2]);
    const k = ql < 1 + LIE ? (1 + LIE) / Math.max(1e-3, ql) : 1;
    pts.push([s.c[0] + q[0] * k * s.r[0], s.c[1] + q[1] * k * s.r[1], s.c[2] + q[2] * k * s.r[2]]);
  }
  return pts;
}

/**
 * Paints a head (and any head pieces: a high collar) into one part. `fr` is the head's frame in
 * hero space; the face's expression comes from the pose.
 */
export function paintHead(ctx: PieceContext, d: HeadDesign, fr: Frame3, pieces: readonly HeadPiece[], under?: (part: Part) => void): void {
  const { cam, pose } = ctx;
  const part = ctx.part(HEAD_TAG);
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);

  // Skull, jaw, ears and the shell of hair: the mass under the locks, a tone darker than them so
  // the gaps between clumps read as recesses, and darkest on its underside at the nape. The shell
  // and the locks share one material, parted by the hair's coloured line.
  const hair: Mat = { ...d.hair, line: d.lockLine ?? shade(d.hair.tones[3], -0.3), clear: 1 };
  part.blobs(fr, [{ c: d.skull.c, r: d.skull.r, id: SKIN }, { c: d.jaw.c, r: d.jaw.r, id: SKIN }], () => ({ m: d.skin }));
  part.blobs(fr, [{ c: d.ear.c, r: d.ear.r, id: EAR }, { c: [d.ear.c[0], d.ear.c[1], -d.ear.c[2]], r: d.ear.r, id: EAR }], () => ({ m: d.skin, light: -0.05 }));
  const whorl = d.whorl ? norm3(dirIn(HEAD_AXES, Math.cos(rad(d.whorl.yaw)) * Math.cos(rad(d.whorl.pitch)), Math.sin(rad(d.whorl.pitch)), Math.sin(rad(d.whorl.yaw)) * Math.cos(rad(d.whorl.pitch)))) : null;
  part.blobs(fr, [{ c: d.shell.c, r: d.shell.r, id: SHELL }], (h: Hit) => {
    if (h.back) return { m: hair, light: toneLight(hair, 3) };
    if (bare(d, h.p)) return null;
    const l = cam.light(dirIn(fr, h.n[0], h.n[1], h.n[2]));
    let tone = h.n[1] < -0.5 ? 3 : l > 0.45 ? 1 : l > -0.15 ? 2 : 3;
    if (whorl && d.whorl) {
      const c = clump(d, whorl, d.whorl, h.p);
      if (c >= 0) tone = Math.min(3, c + (l < -0.2 ? 1 : 0) + (h.n[1] < -0.55 ? 1 : 0));
    }
    // Dark hair: the whole mass a tone deeper.
    if (d.darkHair) tone = Math.min(3, tone + 1);
    return { m: hair, light: toneLight(hair, tone) };
  });
  for (const piece of pieces) for (const b of piece.blobs(ctx)) part.blobs(b.frame, b.blobs, b.shade);
  under?.(part);

  // Locks: wind streams them back and sideways, in the head's own axes (never forward: a
  // negative wind flicks only the coat, or the fringe would fall over his eyes).
  const wind = Math.max(0, pose.wind ?? 0);
  const push = inFrame(fr, mul3([-1, 0.3 + (pose.lift ?? 0) * 0.6, (pose.sway ?? 0) * 0.6], wind * 0.55 + Math.abs(pose.sway ?? 0) * 0.2));
  const lift = inFrame(fr, [0, (pose.lift ?? 0) * 0.4, 0]);
  const centre = ctx.proj(hero(d.shell.c));
  d.locks.forEach((lk, li) => paintLock(ctx, part, d, fr, lk, LOCK0 + li, add3(push, lift), hair, centre));

  // The fringe casts a shadow on the brow.
  const cx = Math.round(ctx.proj(hero(d.skull.c))[0]);
  const cy = Math.round(ctx.proj(hero(d.skull.c))[1]);
  for (let y = cy - 16; y <= cy + 16; y++) {
    for (let x = cx - 16; x <= cx + 16; x++) {
      if (part.idAt(x, y) !== SKIN) continue;
      const above = part.idAt(x, y - 1);
      const above2 = part.idAt(x, y - 2);
      if (above >= SHELL || above2 >= SHELL) part.darken(x, y, 0.45);
    }
  }

  paintFace(ctx, part, d.face, d.skin, fr, pose.face ?? d.face.rest ?? 'stern');
  part.commit();
  despeckle(ctx, [...hair.tones, hair.line], cx - 24, cy - 24, cx + 24, cy + 24, HEAD_TAG);
}

/**
 * Tidies the hair once it is painted: a pixel of one hair tone with at most one neighbour of its
 * own tone (a lone speck, or the stub end of a line) takes the tone most of its hair neighbours
 * have, so the clumps read as a few clean shapes. Only pixels in the box that the part tagged
 * `tag` painted are hair.
 */
function despeckle(ctx: PieceContext, tones: readonly RGB[], x0: number, y0: number, x1: number, y1: number, tag: number): void {
  const { c, owner } = ctx;
  const w = c.w;
  const key = (i: number): number => (c.data[i * 4] as number) * 65536 + (c.data[i * 4 + 1] as number) * 256 + (c.data[i * 4 + 2] as number);
  const hairKeys = tones.map((t) => t[0] * 65536 + t[1] * 256 + t[2]);
  const isHair = (i: number): boolean => owner[i] === tag && (c.data[i * 4 + 3] as number) > 0 && hairKeys.includes(key(i));
  const fix: number[] = [];
  for (let y = Math.max(1, y0); y <= Math.min(c.h - 2, y1); y++) {
    for (let x = Math.max(1, x0); x <= Math.min(w - 2, x1); x++) {
      const i = y * w + x;
      if (!isHair(i)) continue;
      const k = key(i);
      let same = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && isHair(i + dy * w + dx) && key(i + dy * w + dx) === k) same++;
      if (same > 1) continue;
      // The tone most of its four hair neighbours share.
      let best = -1;
      let bestN = 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (!isHair(j)) continue;
        const kj = key(j);
        let n = 0;
        for (const q of [i - 1, i + 1, i - w, i + w]) if (isHair(q) && key(q) === kj) n++;
        if (n > bestN) {
          bestN = n;
          best = j;
        }
      }
      if (best >= 0 && bestN >= 2) fix.push(i, best);
    }
  }
  for (let k = 0; k < fix.length; k += 2) {
    const i = fix[k] as number;
    const j = fix[k + 1] as number;
    c.data[i * 4] = c.data[j * 4] as number;
    c.data[i * 4 + 1] = c.data[j * 4 + 1] as number;
    c.data[i * 4 + 2] = c.data[j * 4 + 2] as number;
  }
}

const HEAD_AXES: Frame3 = { o: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1] };

/**
 * The clumps painted on the back of the hair's shell: sectors fanning out from the crown's whorl,
 * twisting a little as they fall, each with a parting line on one side, a lit band beside it, the
 * light tone and a darker far side. Gives the tone (0 highlight to 3 shadow) at a point of the
 * shell (head space), or -1 outside the fan.
 */
function clump(d: HeadDesign, w: V3, spec: NonNullable<HeadDesign['whorl']>, p: V3): number {
  const s = d.shell;
  const n = norm3([(p[0] - s.c[0]) / s.r[0], (p[1] - s.c[1]) / s.r[1], (p[2] - s.c[2]) / s.r[2]]);
  const cosT = dot3(n, w);
  const theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
  if (theta > rad(spec.reach)) return -1;
  // The crown itself: a small dark point where the clumps part.
  if (theta < rad(9)) return 2;
  // Azimuth round the whorl, measured from the way down the back.
  const ref = norm3(add3([0, -1, 0], w, cosT === 1 ? 0 : -dot3([0, -1, 0], w)));
  const side = cross3(w, ref);
  const phi = Math.atan2(dot3(n, side), dot3(n, ref)) + theta * spec.twist;
  const k = (((phi / (Math.PI * 2)) * spec.clumps) % 1 + 1) % 1;
  if (k < 0.1) return 3;
  if (k < 0.36) return 0;
  return k < 0.8 ? 1 : 2;
}

/** Where a lock is widest along its length (0 root to 1 tip) by default. */
const BELLY = 0.3;
/** Light falls from the upper left on screen. */
const LIGHT_2D: Vec = [-0.6, -0.8];

/**
 * Paints one lock as a clump: a leaf that swells from its root and tapers to a point, the light
 * tone with a highlight streak along its lit side (on locks that face the light), its shadow side
 * and tip a tone darker. It stands a little clear of the hair it lies on, so a coloured line parts
 * it from the mass and from the clumps behind it, except at its root where it grows out of them.
 * A lock seen end on (pointing at the viewer or away) would shrink to a nub: as a pixel artist
 * would, it is splayed out from the middle of the head and left to droop.
 */
function paintLock(ctx: PieceContext, part: Part, d: HeadDesign, fr: Frame3, lk: Lock, id: number, push: V3, m: Mat, centre: Vec): void {
  const pts3 = lockPath(d, lk, push).map((p) => at3(fr, p[0], p[1], p[2]));
  const n = pts3.length - 1;
  const Z = pts3.map((p) => ctx.depth(p));
  let P: Vec[] = pts3.map((p) => ctx.proj(p));
  const p0 = P[0] as Vec;
  const seen = Math.hypot((P[n] as Vec)[0] - p0[0], (P[n] as Vec)[1] - p0[1]);
  const want = lk.len * 0.7;
  if (seen < want) {
    const k = 1 - seen / want;
    let ox = p0[0] - centre[0];
    let oy = p0[1] - centre[1] + 3;
    const ol = Math.hypot(ox, oy) || 1;
    ox /= ol;
    oy /= ol;
    let dx = ((P[n] as Vec)[0] - p0[0]) * (1 - k) + ox * 0.55 * want * k;
    let dy = ((P[n] as Vec)[1] - p0[1]) * (1 - k) + (oy * 0.3 + 1) * want * k;
    const dl = Math.hypot(dx, dy) || 1;
    dx = (dx / dl) * want;
    dy = (dy / dl) * want;
    P = P.map((p, i) => [p[0] + (p0[0] + (dx * i) / n - p[0]) * k, p[1] + (p0[1] + (dy * i) / n - p[1]) * k]);
  }
  const belly = lk.belly ?? BELLY;
  const width = (t: number): number => lk.w * (t < belly ? 0.8 + (0.2 * t) / belly : Math.pow((1 - t) / (1 - belly), 0.9));
  // How squarely the lock's root faces the light: locks on the shadowed side of the head are a tone darker.
  const rootN = norm3(dirIn(fr, Math.cos(rad(lk.yaw)) * Math.cos(rad(lk.pitch)), Math.sin(rad(lk.pitch)), Math.sin(rad(lk.yaw)) * Math.cos(rad(lk.pitch))));
  const rootLit = ctx.cam.light(rootN);
  const zAt = (t: number): number => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return (Z[i] as number) + ((Z[i + 1] as number) - (Z[i] as number)) * (f - i);
  };
  leaf(
    part,
    P,
    width,
    m,
    (mt, ma) => {
      let tone = ma > 0.42 && mt > 0.08 && mt < 0.55 && rootLit > -0.1 ? 0 : ma < -0.28 || mt > 0.78 ? 2 : 1;
      // Dark hair: the base tone over the clump and the light tone along its lit side, keeping the
      // highlight for the brightest streaks.
      if (d.darkHair) tone = tone === 0 && ma > 0.66 && mt < 0.45 && rootLit > 0.2 ? 0 : tone + 1;
      if (rootLit < -0.45) tone = Math.min(3, tone + 1);
      return toneLight(m, tone);
    },
    (mt, ma) => zAt(mt) - 0.6 + 3 * Math.min(1, mt * 1.4) + (1 - Math.min(1, ma * ma)) * 0.6,
    id,
  );
}

/**
 * Paints a leaf-shaped clump along a spine of screen points, `width(t)` either side of it (t from
 * 0 at the root to 1 at the tip). Each pixel's light and depth come from `light` and `z`, given
 * how far along the spine its nearest point is (t) and how far across it toward its lit side (a,
 * -1 to 1, the lit side facing the upper left of the screen).
 */
function leaf(part: Part, P: readonly Vec[], width: (t: number) => number, m: Mat, light: (t: number, a: number) => number, z: (t: number, a: number) => number, id: number): void {
  const n = P.length - 1;
  // The outline: down one side and back up the other.
  const left: Vec[] = [];
  const right: Vec[] = [];
  for (let i = 0; i <= n; i++) {
    const a = P[Math.max(0, i - 1)] as Vec;
    const b = P[Math.min(n, i + 1)] as Vec;
    const tl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / tl;
    const ny = (b[0] - a[0]) / tl;
    const w = width(i / n);
    const p = P[i] as Vec;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  }
  // The nearest point on the spine to a pixel: how far along it (0 to 1) and how far across it
  // toward its lit side (-1 to 1).
  let mx = -1;
  let my = -1;
  let mt = 0;
  let ma = 0;
  const near = (x: number, y: number): void => {
    if (x === mx && y === my) return;
    mx = x;
    my = y;
    const qx = x + 0.5;
    const qy = y + 0.5;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const a = P[i] as Vec;
      const b = P[i + 1] as Vec;
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const l2 = ex * ex + ey * ey || 1;
      const tt = Math.max(0, Math.min(1, ((qx - a[0]) * ex + (qy - a[1]) * ey) / l2));
      const px = qx - a[0] - ex * tt;
      const py = qy - a[1] - ey * tt;
      const d2 = px * px + py * py;
      if (d2 < best) {
        best = d2;
        mt = (i + tt) / n;
        const l = Math.sqrt(l2);
        const across = (ex * (qy - a[1]) - ey * (qx - a[0])) / l;
        const lit = Math.sign(-ey * LIGHT_2D[0] + ex * LIGHT_2D[1]) || 1;
        ma = (across * lit) / Math.max(0.8, width(mt));
      }
    }
  };
  part.poly(
    [...left, ...right.reverse()],
    m,
    (x, y) => {
      near(x, y);
      return light(mt, ma);
    },
    (x, y) => {
      near(x, y);
      return z(mt, ma);
    },
    id,
  );
}

function paintFace(ctx: PieceContext, part: Part, f: FaceDesign, skin: Mat, fr: Frame3, face: Face): void {
  const { cam } = ctx;
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);
  // Which way his right is on screen.
  const rightX = Math.sign(cam.vec(fr.r)[0]) || 1;
  const m = (c: RGB): Mat => flat(c);
  const style = f.style ?? FACE_PLAIN;
  const eyeCols: Record<string, Mat> = { K: m(f.lash), I: m(f.iris), i: m(f.irisLight), D: m(f.irisDeep ?? shade(f.iris, -0.35)), W: m(f.white), h: m(f.shine), l: m(skin.tones[3]) };
  const browCols: Record<string, Mat> = { B: m(f.brow) };
  const onFace = (id: number): boolean => id === SKIN;
  for (const side of [1, -1]) {
    const at: V3 = [f.eye[0], f.eye[1], f.eye[2] * side];
    const n = norm3(dirIn(fr, Math.cos(rad(28)), 0.05, Math.sin(rad(28)) * side));
    const facing = cam.facing(n);
    if (facing < 0.08) continue;
    const p = ctx.proj(hero(at));
    const z = ctx.depth(hero(at)) + 0.4;
    const dir = side * rightX;
    const kind = facing > 0.7 ? 'full' : facing > 0.42 ? 'mid' : 'narrow';
    const eye = face === 'closed' ? style.eyes.closed : face === 'hurt' ? style.eyes.squeeze : face === 'shout' && kind === 'full' ? style.eyes.wide : style.eyes[kind];
    stamp(part, eye, p[0], p[1], dir, eyeCols, z, onFace);
    const brow = (face === 'hurt' ? style.browsUp : style.brows)[kind];
    const lift = face === 'hurt' || face === 'shout' ? 1 : face === 'smirk' && side === 1 ? 1 : 0;
    // Brows show through the fringe, as drawn brows do.
    stamp(part, brow, p[0], p[1] - f.browUp - lift, dir, browCols, z + 20, (id) => id >= 0 && id !== EAR);
  }
  // Mouth and nose.
  const mouthN = norm3(dirIn(fr, 1, -0.25, 0));
  const mf = cam.facing(mouthN);
  if (mf > 0.05) {
    const mp = ctx.proj(hero([f.mouthAt[0], f.mouthAt[1], 0]));
    const glyph = style.mouths[face];
    const shrink = mf < 0.5 && glyph.rows[0]!.length > 2 ? { rows: glyph.rows.map((r) => r.slice(0, -1)), ax: Math.max(0, glyph.ax - 1), ay: glyph.ay } : glyph;
    stamp(part, shrink, mp[0], mp[1], rightX > 0 ? -1 : 1, { M: m(f.mouth), r: m([70, 16, 20]), T: m([236, 226, 214]) }, ctx.depth(hero([f.mouthAt[0], f.mouthAt[1], 0])) + 0.4, onFace);
  }
  const nose = ctx.proj(hero([f.noseAt[0], f.noseAt[1], 0]));
  if (cam.facing(norm3(dirIn(fr, 1, 0, 0))) > 0.35) stamp(part, { rows: ['n'], ax: 0, ay: 0 }, nose[0], nose[1], 1, { n: m(skin.tones[3]) }, ctx.depth(hero([f.noseAt[0], f.noseAt[1], 0])) + 0.4, onFace);
  // The scar across his cheek: a pale welt with a darker edge under it, so it reads at a glance.
  if (f.scar) {
    const at = f.scar.at;
    const n = norm3(dirIn(fr, 0.7, -0.1, Math.sign(at[2]) * 0.7));
    if (cam.facing(n) > 0.15) {
      const p = ctx.proj(hero(at));
      const dir = Math.sign(at[2]) * rightX;
      stamp(part, { rows: ['..s', '.sd', 'sd.'], ax: 1, ay: 1 }, p[0], p[1], dir, { s: m(f.scar.colour), d: m(skin.tones[2]) }, ctx.depth(hero(at)) + 0.4, onFace);
    }
  }
}

// ── Long hair ────────────────────────────────────────────────────────────────────────────────

/** A point on the hair's shell (head space) at a yaw and pitch, `k` of the way out from its centre. */
function onShell(d: HeadDesign, yaw: number, pitch: number, k: number): V3 {
  const s = d.shell;
  const cp = Math.cos(rad(pitch));
  return [s.c[0] + Math.cos(rad(yaw)) * cp * s.r[0] * k, s.c[1] + Math.sin(rad(pitch)) * s.r[1] * k, s.c[2] + Math.sin(rad(yaw)) * cp * s.r[2] * k];
}

/**
 * A curtain of long hair: `count` tresses rooted in a row round the back of the hair's shell, from
 * `from` to `to` degrees (as a tress's yaw: 90 the right, 180 the back, 270 the left) at height
 * `pitch`, falling down the back and a little out toward their own side. They are `len` long, the
 * middle ones longest (by `jag`, a share of the length, with a seeded raggedness so the ends make
 * an uneven hem), and `w` wide.
 */
export function curtain(o: { from: number; to: number; count: number; pitch: number; len: number; w: number; jag?: number; stiff?: number; give?: number; taper?: number; seed?: number }): Tress[] {
  const n = Math.max(1, Math.round(o.count));
  return Array.from({ length: n }, (_, i): Tress => {
    const k = n === 1 ? 0.5 : i / (n - 1);
    const yaw = lerp(o.from, o.to, k);
    const side = Math.sin(rad(yaw));
    const len = o.len * (1 - (o.jag ?? 0) * (0.6 * Math.abs(2 * k - 1) + 0.4 * hash(i + 1, o.seed ?? 7)));
    return { yaw, pitch: o.pitch, dir: [-0.5, -1, -side * 0.3], len, w: o.w, stiff: o.stiff, give: o.give, taper: o.taper };
  });
}

/** How many segments a strand of hair this long is solved in. */
const segments = (len: number): number => Math.max(5, Math.min(10, Math.round(len / 3.5)));

/** The shape id of the head's own hair taken into a long-hair part (see `rootIn`). */
const ROOT = 1;
const ROOT_MATS = new Map<number, Mat>();

/**
 * Where long hair grows out of the head's own hair, nothing should part them: the head's hair
 * pixels are taken into the part as they are (flat, far behind anything the part paints), so no
 * line or rim of light is drawn between the two. Returns the pixels taken, to hand back to the
 * head once the part is down.
 */
function rootIn(ctx: PieceContext, part: Part, keys: readonly number[], x0: number, y0: number, x1: number, y1: number): number[] {
  const { c, owner } = ctx;
  const taken: number[] = [];
  for (let y = Math.max(0, y0); y <= Math.min(c.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(c.w - 1, x1); x++) {
      const i = y * c.w + x;
      if (owner[i] !== HEAD_TAG || (c.data[i * 4 + 3] as number) === 0) continue;
      const k = (c.data[i * 4] as number) * 65536 + (c.data[i * 4 + 1] as number) * 256 + (c.data[i * 4 + 2] as number);
      if (!keys.includes(k)) continue;
      let m = ROOT_MATS.get(k);
      if (!m) {
        m = flat([c.data[i * 4] as number, c.data[i * 4 + 1] as number, c.data[i * 4 + 2] as number]);
        ROOT_MATS.set(k, m);
      }
      part.plot(x, y, m, 0, -1e6, ROOT);
      taken.push(i);
    }
  }
  return taken;
}

interface HairStrand {
  pts: V3[];
  w: number;
  taper: number;
}

/**
 * Paints a tress as a long clump: the breadth of `w` along most of it, narrowing to a point over
 * the last `taper` of it. Its tone comes from how the hair there faces the light (out from the
 * head's upright axis, so a curtain is lit on the side toward the light and in shadow seen from
 * the front, where it hangs behind), a tone lighter along each tress's lit side and darker along
 * its shadowed side and at its tip, with a streak of highlight high up on lit tresses.
 */
function paintTress(ctx: PieceContext, part: Part, d: HeadDesign, axis: V3, s: HairStrand, m: Mat, id: number): void {
  const pts = s.pts;
  const n = pts.length - 1;
  const P = pts.map((p) => ctx.proj(p));
  const Z = pts.map((p) => ctx.depth(p));
  const lit = pts.map((p) => ctx.cam.light(norm3([p[0] - axis[0], 0.35, p[2] - axis[2]])));
  const along = (arr: readonly number[], t: number): number => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return (arr[i] as number) + ((arr[i + 1] as number) - (arr[i] as number)) * (f - i);
  };
  const taper = s.taper;
  const width = (t: number): number => s.w * (t < 0.15 ? 0.75 + (0.25 * t) / 0.15 : t < 1 - taper ? 1 : Math.max(0.15, Math.pow((1 - t) / taper, 0.8)));
  leaf(
    part,
    P,
    width,
    m,
    (t, a) => {
      // Lit where it faces the light, darker down its length and across to its shadowed side.
      const l = along(lit, t) - 0.4 * t + 0.22 * a;
      let tone = l > 0.62 && t < 0.4 && a > 0 ? 0 : l > 0.28 ? 1 : l > -0.12 ? 2 : 3;
      if (t > 0.88) tone = Math.min(3, tone + 1);
      if (d.darkHair && tone > 0) tone = Math.min(3, tone + 1);
      return toneLight(m, tone);
    },
    (t, a) => along(Z, t) + (1 - Math.min(1, a * a)) * 0.6,
    id,
  );
}

/**
 * The draw items of a head's long hair (`head.long`), for the painter to sort with the body: the
 * curtain down the back as one, each lock over the shoulders on its own and the ponytail as one,
 * each at the depth of its hanging part (with the upper body's lift, as arms are). `fr` is the
 * head's frame as painted. Each is solved as strands (pieces.ts `strand`) that grow out of the
 * hair's shell and lie over the head, the jaw and the torso.
 */
export function hairItems(ctx: PieceContext, d: HeadDesign, body: BodyDesign, fr: Frame3): DrawItem[] {
  const long = d.long;
  if (!long) return [];
  const { rig, pose } = ctx;
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);
  const avoid: Obstacle[] = [{ fr, c: d.shell.c, r: d.shell.r, pad: 0.4 }, { fr, c: d.jaw.c, r: d.jaw.r, pad: 1 }, ...torsoObstacles(rig, body.chest, body.hips)];
  const lie = long.lie ?? 1.5;
  const axis = hero(d.shell.c);
  const view = norm3(ctx.cam.local(TO_CAMERA));
  const hair: Mat = { ...d.hair, line: d.lockLine ?? shade(d.hair.tones[3], -0.3), clear: 1 };
  const keys = [...hair.tones, hair.line].map((t) => t[0] * 65536 + t[1] * 256 + t[2]);
  const solve = (t: { yaw: number; pitch: number; dir: V3; len: number; w: number; stiff?: number; give?: number; taper?: number }, seed: number, out = 0.9): HairStrand => ({
    pts: strand(pose, { root: hero(onShell(d, t.yaw, t.pitch, out)), dir: dirIn(fr, t.dir[0], t.dir[1], t.dir[2]), len: t.len, n: segments(t.len), stiff: t.stiff ?? 0.3, give: t.give ?? 1, seed, avoid, pad: lie, axis: rig.pelvis.o, view, side: dirIn(fr, Math.cos(rad(t.yaw)), 0, Math.sin(rad(t.yaw))) }),
    w: t.w,
    taper: t.taper ?? 0.35,
  });
  // The head's box on screen, where long hair may grow out of its hair.
  const hc = ctx.proj(axis);
  const hr = Math.ceil(Math.max(d.shell.r[0], d.shell.r[1], d.shell.r[2]) + 3);
  // One item: the strands painted into one part (and anything else `more` adds), sorted at the
  // depth of their hanging parts.
  const item = (strands: HairStrand[], more?: (part: Part) => void): DrawItem => {
    let zs = 0;
    let zn = 0;
    for (const s of strands) {
      for (let i = Math.ceil((s.pts.length - 1) * 0.3); i < s.pts.length; i++) {
        zs += ctx.depth(s.pts[i] as V3);
        zn++;
      }
    }
    return {
      z: zs / Math.max(1, zn) + ctx.upper,
      draw: () => {
        const part = ctx.part(HAIR_TAG);
        const taken = rootIn(ctx, part, keys, Math.round(hc[0]) - hr, Math.round(hc[1]) - hr, Math.round(hc[0]) + hr, Math.round(hc[1]) + hr);
        strands.forEach((s, i) => paintTress(ctx, part, d, axis, s, hair, 10 + i));
        more?.(part);
        const back = taken.filter((i) => part.idAt(i % ctx.c.w, Math.floor(i / ctx.c.w)) === ROOT);
        part.commit();
        for (const i of back) ctx.owner[i] = HEAD_TAG;
        // Tidy the hair, over the box the strands cover.
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const s of strands) {
          for (const p of s.pts) {
            const q = ctx.proj(p);
            x0 = Math.min(x0, q[0] - s.w - 2);
            y0 = Math.min(y0, q[1] - s.w - 2);
            x1 = Math.max(x1, q[0] + s.w + 2);
            y1 = Math.max(y1, q[1] + s.w + 2);
          }
        }
        despeckle(ctx, [...hair.tones, hair.line], Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1), HAIR_TAG);
      },
    };
  };
  const items: DrawItem[] = [];
  long.back?.forEach((t, i) => items.push(item([solve(t, i * 1.9)])));
  long.front?.forEach((t, i) => items.push(item([solve(t, 3.1 + i * 2.3)])));
  const tail = long.tail;
  if (tail) {
    // The tail: a thick tress from the tie with a thinner one either side of it, and the tie
    // round its root with the cord's loose ends.
    const across = norm3(cross3(dirIn(fr, tail.dir[0], tail.dir[1], tail.dir[2]), fr.u));
    const main = solve(tail, 0.4, 1.02);
    const side = (k: number, seed: number): HairStrand => {
      const s = solve({ ...tail, len: tail.len * 0.86, w: tail.w * 0.62 }, seed, 1.02);
      return { ...s, pts: s.pts.map((p, i) => add3(p, across, k * tail.w * 0.55 * Math.min(1, i / 2))) };
    };
    const strands = [side(-1, 2.2), side(1, 4.1), main];
    const root = main.pts[0] as V3;
    items.push(
      item(strands, (part) => {
        const tie = tail.tie;
        const p = ctx.proj(root);
        const z = ctx.depth(root) + 6;
        if (tie.ends) {
          for (const k of [-1, 1]) {
            const end = strand(pose, { root, dir: add3(dirIn(fr, 0, -1, 0), across, k * 0.6), len: tie.ends, n: 3, stiff: 0.3, give: 1.2, seed: 5 + k, avoid, pad: lie + 0.5, axis: rig.pelvis.o });
            leaf(part, end.map((q) => ctx.proj(q)), (t) => (t < 0.8 ? 1.1 : 0.8), tie.mat, () => 0.4, (t) => z - 1 + t, 40 + k);
          }
        }
        part.ellipse(p[0], p[1], tie.r, tie.r * 0.9, tie.mat, 0.15, z, 39);
      }),
    );
  }
  return items;
}
