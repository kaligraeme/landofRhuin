/**
 * Chibi heads: a skull and jaw under a shell of hair, ray-cast through the camera so they turn
 * smoothly through every angle, with locks of hair (spikes, a fringe, tufts at the nape) laid over
 * the shell as tapered, curling ribbons, and the face's features stamped on as small pixel glyphs
 * chosen by how squarely each one faces the viewer. Everything is drawn into one part with a depth
 * test, so locks pass in front of and behind the head as they should, and a coloured line marks
 * each lock where it crosses the hair or face behind it.
 */
import type { RGB } from '../paint.js';
import type { Vec } from '../skeleton.js';
import type { FaceDesign, HeadDesign, HeadPiece, Lock, PieceContext } from './design.js';
import { flat, type Hit, type Mat, type Part } from './raster.js';
import { add3, at3, cross3, dirIn, dot3, type Face, type Frame3, mul3, norm3, rad, TO_CAMERA, type V3 } from './rig.js';

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
// K lash, I iris, i iris (light), W white, h shine, B brow, M mouth, r mouth inside, T teeth.

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
  closed: { rows: ['....', 'KKKK', '.KK.'], ax: 2, ay: 1 },
  squeeze: { rows: ['K...', '.KKK', 'K...'], ax: 2, ay: 1 },
  wide: { rows: ['.KKKK', 'KIhIW', 'KiIIW', '.KKK.'], ax: 2, ay: 1 },
};
const BROWS: Record<'full' | 'mid' | 'narrow', Glyph> = {
  full: { rows: ['..BBB', 'BBB..'], ax: 2, ay: 1 },
  mid: { rows: ['.BBB', 'BB..'], ax: 1, ay: 1 },
  narrow: { rows: ['.BB', 'BB.'], ax: 1, ay: 1 },
};
// Mouths are laid out across the face (left to right on screen), centred on the anchor.
const MOUTHS: Record<Face, Glyph> = {
  stern: { rows: ['MMM'], ax: 1, ay: 0 },
  shout: { rows: ['MMM', 'MrM', '.M.'], ax: 1, ay: 0 },
  grit: { rows: ['MTTM'], ax: 2, ay: 0 },
  hurt: { rows: ['M.M', '.M.'], ax: 1, ay: 0 },
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

/** A lock's points along its length, in head space. */
function lockPath(d: HeadDesign, lk: Lock, push: V3): V3[] {
  const s = d.shell;
  const cp = Math.cos(rad(lk.pitch));
  const root: V3 = [s.c[0] + Math.cos(rad(lk.yaw)) * cp * s.r[0] * 0.9, s.c[1] + Math.sin(rad(lk.pitch)) * s.r[1] * 0.9, s.c[2] + Math.sin(rad(lk.yaw)) * cp * s.r[2] * 0.9];
  const dir = norm3(add3(norm3(lk.dir), push, lk.give ?? 1));
  const curl = lk.curl ?? [0, 0, 0];
  const pts: V3[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(add3(add3(root, dir, lk.len * t), curl, lk.len * t * t));
  }
  return pts;
}

/**
 * Paints a head (and any head pieces: a high collar) into one part. `fr` is the head's frame in
 * hero space; the face's expression comes from the pose.
 */
export function paintHead(ctx: PieceContext, d: HeadDesign, fr: Frame3, pieces: readonly HeadPiece[], under?: (part: Part) => void): void {
  const { cam, pose } = ctx;
  const part = ctx.part();
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);
  const toCam = norm3(cam.local(TO_CAMERA));

  // Skull, jaw, ears and the shell of hair.
  part.blobs(fr, [{ c: d.skull.c, r: d.skull.r, id: SKIN }, { c: d.jaw.c, r: d.jaw.r, id: SKIN }], () => ({ m: d.skin }));
  part.blobs(fr, [{ c: d.ear.c, r: d.ear.r, id: EAR }, { c: [d.ear.c[0], d.ear.c[1], -d.ear.c[2]], r: d.ear.r, id: EAR }], () => ({ m: d.skin, light: -0.05 }));
  part.blobs(fr, [{ c: d.shell.c, r: d.shell.r, id: SHELL }], (h: Hit) => {
    if (h.back) return { m: d.hair, light: -0.7 };
    if (bare(d, h.p)) return null;
    // Strands: grooves running from the crown down over the back of the head.
    const yaw = (Math.atan2(h.p[2] - d.shell.c[2], h.p[0] - d.shell.c[0]) * 180) / Math.PI;
    const up = (h.p[1] - d.shell.c[1]) / d.shell.r[1];
    if (Math.abs(yaw) > 95 && up < 0.9 && up > -0.85) {
      const g = (((yaw + 13 * up) % 26) + 26) % 26;
      if (g < 3.4) return { m: d.hair, light: cam.light(dirIn(fr, h.n[0], h.n[1], h.n[2])) - 0.62 };
    }
    return { m: d.hair };
  });
  for (const piece of pieces) for (const b of piece.blobs(ctx)) part.blobs(b.frame, b.blobs, b.shade);
  under?.(part);

  // Locks: wind streams them back and sideways, in the head's own axes.
  const wind = pose.wind ?? 0;
  const push = inFrame(fr, mul3([-1, 0.3 + (pose.lift ?? 0) * 0.6, (pose.sway ?? 0) * 0.6], wind * 0.55 + Math.abs(pose.sway ?? 0) * 0.2));
  const lift = inFrame(fr, [0, (pose.lift ?? 0) * 0.4, 0]);
  const lightDir: Vec = [-0.6, -0.8];
  d.locks.forEach((lk, li) => {
    const pts = lockPath(d, lk, add3(push, lift)).map(hero);
    // A lock seen end on would show as a ringed blob: it blends into the hair instead.
    const a0 = ctx.proj(pts[0] as V3);
    const a1 = ctx.proj(pts[pts.length - 1] as V3);
    const id = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) < lk.len * 0.45 ? SHELL : LOCK0 + li;
    const rootN = norm3(dirIn(fr, Math.cos(rad(lk.yaw)) * Math.cos(rad(lk.pitch)), Math.sin(rad(lk.pitch)), Math.sin(rad(lk.yaw)) * Math.cos(rad(lk.pitch))));
    const base = cam.light(rootN) * 0.55 + 0.05;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i] as V3;
      const b = pts[i + 1] as V3;
      const tan = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      let side = cross3(tan, toCam);
      if (Math.hypot(side[0], side[1], side[2]) < 0.15) side = cross3(tan, [0, 1, 0]);
      side = norm3(side);
      const wa = lk.w * Math.pow(1 - i / (pts.length - 1), 0.85);
      const wb = lk.w * Math.pow(1 - (i + 1) / (pts.length - 1), 0.85);
      const pa = ctx.proj(a);
      const pb = ctx.proj(b);
      const sv = cam.vec(side);
      const quad: Vec[] = [
        [pa[0] + sv[0] * wa, pa[1] + sv[1] * wa],
        [pb[0] + sv[0] * wb, pb[1] + sv[1] * wb],
        [pb[0] - sv[0] * wb, pb[1] - sv[1] * wb],
        [pa[0] - sv[0] * wa, pa[1] - sv[1] * wa],
      ];
      // The side of the lock toward the light is lit.
      const sl = Math.sign(sv[0] * lightDir[0] + sv[1] * lightDir[1]) || 1;
      const za = ctx.depth(a);
      const zb = ctx.depth(b);
      const dx = pb[0] - pa[0];
      const dy = pb[1] - pa[1];
      const l2 = dx * dx + dy * dy || 1;
      part.poly(
        quad,
        d.hair,
        (x, y) => {
          const ox = x + 0.5 - pa[0];
          const oy = y + 0.5 - pa[1];
          const across = (ox * sv[0] + oy * sv[1]) * sl;
          return base + (across > 0.4 ? 0.32 : across < -0.4 ? -0.4 : 0);
        },
        (x, y) => za + ((zb - za) * Math.max(0, Math.min(1, ((x + 0.5 - pa[0]) * dx + (y + 0.5 - pa[1]) * dy) / l2))) + 0.6,
        id,
      );
    }
  });

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

  paintFace(ctx, part, d.face, fr, pose.face ?? 'stern');
  part.commit();
}

function paintFace(ctx: PieceContext, part: Part, f: FaceDesign, fr: Frame3, face: Face): void {
  const { cam } = ctx;
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);
  // Which way his right is on screen.
  const rightX = Math.sign(cam.vec(fr.r)[0]) || 1;
  const m = (c: RGB): Mat => flat(c);
  const eyeCols: Record<string, Mat> = { K: m(f.lash), I: m(f.iris), i: m(f.irisLight), W: m(f.white), h: m(f.shine) };
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
    const brow = BROWS[kind];
    const lift = face === 'hurt' ? -1 : face === 'smirk' && side === 1 ? 1 : 0;
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
  if (cam.facing(norm3(dirIn(fr, 1, 0, 0))) > 0.35) stamp(part, { rows: ['n'], ax: 0, ay: 0 }, nose[0], nose[1], 1, { n: m(noseColour(f)) }, ctx.depth(hero([f.noseAt[0], f.noseAt[1], 0])) + 0.4, onFace);
  // The scar across his cheek.
  if (f.scar) {
    const at = f.scar.at;
    const n = norm3(dirIn(fr, 0.6, -0.1, Math.sign(at[2]) * 0.8));
    if (cam.facing(n) > 0.2) {
      const p = ctx.proj(hero(at));
      const dir = Math.sign(at[2]) * rightX;
      stamp(part, { rows: ['..s', '.s.', 's..'], ax: 1, ay: 1 }, p[0], p[1], dir, { s: m(f.scar.colour) }, ctx.depth(hero(at)) + 0.4, onFace);
    }
  }
}

/** The nose's shadow: the mouth colour, lightened toward skin. */
function noseColour(f: FaceDesign): RGB {
  return [Math.min(255, f.mouth[0] + 70), Math.min(255, f.mouth[1] + 50), Math.min(255, f.mouth[2] + 40)];
}
