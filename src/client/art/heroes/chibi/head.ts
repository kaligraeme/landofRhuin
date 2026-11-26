/**
 * Chibi heads: a skull and jaw under a shell of hair, ray-cast through the camera so they turn
 * smoothly through every angle, with locks of hair (clumps raked over the head, a fringe, locks at
 * the nape) laid over the shell as leaf-shaped clumps, clumps painted onto the back of the shell
 * fanning from the crown, and the face's features stamped on as small pixel glyphs chosen by how
 * squarely each one faces the viewer. Everything is drawn into one part with a depth test, so
 * locks pass in front of and behind the head as they should, and a coloured line parts each clump
 * from the hair behind it; a last pass tidies lone pixels out of the hair.
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import { type FaceDesign, HEAD_TAG, type HeadDesign, type HeadPiece, type Lock, type PieceContext } from './design.js';
import { flat, type Hit, type Mat, type Part, shade, toneLight } from './raster.js';
import { add3, at3, cross3, dirIn, dot3, type Face, type Frame3, mul3, norm3, rad, type V3 } from './rig.js';

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
// K lash, I iris, i iris (light), W white, h shine, l lid crease (skin shadow), B brow, M mouth,
// r mouth inside, T teeth.

interface Glyph {
  rows: readonly string[];
  /** The cell that sits on the anchor. */
  ax: number;
  ay: number;
}

const EYES: Record<'full' | 'mid' | 'narrow' | 'closed' | 'squeeze' | 'wide', Glyph> = {
  full: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '..ii.'], ax: 2, ay: 1 },
  mid: { rows: ['KKKK', 'IhIW', 'iIIK', '.ii.'], ax: 1, ay: 1 },
  narrow: { rows: ['KKK', 'IhK', 'iIK', 'i..'], ax: 1, ay: 1 },
  // A blink: the lid shut in a line at the eye's middle, a lash at its outer corner, the crease under it.
  closed: { rows: ['KKKKK', '.lllK'], ax: 2, ay: 0 },
  // Squeezed shut in pain: a chevron pointing in toward the nose.
  squeeze: { rows: ['..KKK', 'KK...', '..KKK'], ax: 2, ay: 1 },
  wide: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '.KKK.'], ax: 2, ay: 1 },
};
const BROWS: Record<'full' | 'mid' | 'narrow', Glyph> = {
  full: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
  mid: { rows: ['.BBB', 'BB..'], ax: 1, ay: 1 },
  narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
};
/** Brows knitted up at their inner ends (pain). */
const BROWS_UP: Record<'full' | 'mid' | 'narrow', Glyph> = {
  full: { rows: ['BB...', '.BBBB'], ax: 2, ay: 1 },
  mid: { rows: ['BB..', '.BBB'], ax: 1, ay: 1 },
  narrow: { rows: ['B..', '.BB'], ax: 1, ay: 1 },
};
// Mouths are laid out across the face (left to right on screen), centred on the anchor.
const MOUTHS: Record<Face, Glyph> = {
  stern: { rows: ['MMM'], ax: 1, ay: 0 },
  shout: { rows: ['MMM', 'MrM', '.M.'], ax: 1, ay: 0 },
  grit: { rows: ['MTTM'], ax: 2, ay: 0 },
  hurt: { rows: ['.MMM.', 'MTTTM', 'MrrrM', '.MMM.'], ax: 2, ay: 1 },
  closed: { rows: ['MM'], ax: 1, ay: 0 },
  smirk: { rows: ['..M', 'MM.'], ax: 1, ay: 0 },
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

  paintFace(ctx, part, d.face, d.skin, fr, pose.face ?? 'stern');
  part.commit();
  despeckle(ctx, [...hair.tones, hair.line], cx, cy, 24);
}

/**
 * Tidies the hair once it is painted: a pixel of one hair tone with at most one neighbour of its
 * own tone (a lone speck, or the stub end of a line) takes the tone most of its hair neighbours
 * have, so the clumps read as a few clean shapes.
 */
function despeckle(ctx: PieceContext, tones: readonly RGB[], cx: number, cy: number, r: number): void {
  const { c, owner } = ctx;
  const w = c.w;
  const key = (i: number): number => (c.data[i * 4] as number) * 65536 + (c.data[i * 4 + 1] as number) * 256 + (c.data[i * 4 + 2] as number);
  const hairKeys = tones.map((t) => t[0] * 65536 + t[1] * 256 + t[2]);
  const isHair = (i: number): boolean => owner[i] === HEAD_TAG && (c.data[i * 4 + 3] as number) > 0 && hairKeys.includes(key(i));
  const fix: number[] = [];
  for (let y = Math.max(1, cy - r); y <= Math.min(c.h - 2, cy + r); y++) {
    for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
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
  // How squarely the lock's root faces the light: locks on the shadowed side of the head are a tone darker.
  const rootN = norm3(dirIn(fr, Math.cos(rad(lk.yaw)) * Math.cos(rad(lk.pitch)), Math.sin(rad(lk.pitch)), Math.sin(rad(lk.yaw)) * Math.cos(rad(lk.pitch))));
  const rootLit = ctx.cam.light(rootN);
  // The nearest point on the lock's spine to a pixel: how far along it (0 to 1) and how far across
  // it toward its lit side (-1 to 1).
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
  const zAt = (t: number): number => {
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    return (Z[i] as number) + ((Z[i + 1] as number) - (Z[i] as number)) * (f - i);
  };
  part.poly(
    [...left, ...right.reverse()],
    m,
    (x, y) => {
      near(x, y);
      let tone = ma > 0.42 && mt > 0.08 && mt < 0.55 && rootLit > -0.1 ? 0 : ma < -0.28 || mt > 0.78 ? 2 : 1;
      if (rootLit < -0.45) tone = Math.min(3, tone + 1);
      return toneLight(m, tone);
    },
    (x, y) => {
      near(x, y);
      return zAt(mt) - 0.6 + 3 * Math.min(1, mt * 1.4) + (1 - Math.min(1, ma * ma)) * 0.6;
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
  const eyeCols: Record<string, Mat> = { K: m(f.lash), I: m(f.iris), i: m(f.irisLight), W: m(f.white), h: m(f.shine), l: m(skin.tones[3]) };
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
    const eye = face === 'closed' ? EYES.closed : face === 'hurt' ? EYES.squeeze : face === 'shout' && kind === 'full' ? EYES.wide : EYES[kind];
    stamp(part, eye, p[0], p[1], dir, eyeCols, z, onFace);
    const brow = (face === 'hurt' ? BROWS_UP : BROWS)[kind];
    const lift = face === 'hurt' || face === 'shout' ? 1 : face === 'smirk' && side === 1 ? 1 : 0;
    // Brows show through the fringe, as drawn brows do.
    stamp(part, brow, p[0], p[1] - f.browUp - lift, dir, browCols, z + 20, (id) => id >= 0 && id !== EAR);
  }
  // Mouth and nose.
  const mouthN = norm3(dirIn(fr, 1, -0.25, 0));
  const mf = cam.facing(mouthN);
  if (mf > 0.05) {
    const mp = ctx.proj(hero([f.mouthAt[0], f.mouthAt[1], 0]));
    const glyph = MOUTHS[face];
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
