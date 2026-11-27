/**
 * Chibi heads: a skull and jaw under a shell of hair (with any volume joined to it: a pompadour's
 * lift, a fuller crown), ray-cast through the camera so they turn smoothly through every angle,
 * with locks of hair (clumps raked over the head, a fringe, locks at the nape) laid over the
 * shell as leaf-shaped clumps, clumps painted onto the back of the shell fanning from the crown,
 * and the face's features stamped on as small pixel glyphs chosen by how
 * squarely each one faces the viewer, from the design's face style (FACE_PLAIN, FACE_SOFT,
 * FACE_SHARP or its own). Everything is drawn into one part with a depth test, so locks pass in
 * front of and behind the head as they should, and a coloured line parts each clump from the hair
 * behind it; a last pass tidies lone pixels out of the hair.
 *
 * Long hair (a curtain down the back, locks over the shoulders, a ponytail) hangs from the head
 * but is sorted with the body (`hairItems`, which the painter adds to its list): each tress is a
 * strand (pieces.ts `strand`) that lies over the head and the torso and streams with the pose,
 * painted as a long clump that grows out of the head's hair without a line between them. Short
 * layers at the nape (`long.nape`) are strands too, but painted with the head in its depth test,
 * so they lie over a high collar and pass behind the jaw as they should.
 *
 * Facial hair and hair worn up are painted with the head too: a beard's growth over the jaw and
 * up the cheeks (its hanging tresses sort with the body, as long hair does), a moustache under the
 * nose, and buns, twists and updos standing on the hair. Gear over the head (a hood worn up, a
 * helm: see headgear.ts) can cover hair (`HeadPiece.covers`), which is then not painted, but for
 * long hair, which comes out from under the gear's edge (`hairItems`).
 */
import type { RGB, Vec } from '../paint.js';
import { type Beard, type BodyDesign, type Bun, type DrawItem, type FaceDesign, type FaceGlyph, type FaceStyle, GEAR_ID, HAIR_TAG, HEAD_TAG, type HeadDesign, type HeadPiece, type Lock, type PieceContext, type Tress } from './design.js';
import { FLIP_FROM, hash, type Obstacle, strand, torsoObstacles } from './pieces.js';
import { type Blob, flat, type Hit, type Mat, type Part, shade, toneLight, toneOf } from './raster.js';
import { add3, at3, clamp, cross3, dirIn, dot3, type Face, type Frame3, lerp, mul3, norm3, rad, sub3, TO_CAMERA, type V3 } from './rig.js';

/** Shape ids inside the head's part. */
const SKIN = 1;
const EAR = 2;
const SHELL = 3;
const LOCK0 = 10;
const NAPE0 = 200;
/** A beard, a moustache and buns (two ids each: the bun and its tie). The neck, painted into the head's part, is 5. */
const BEARD = 450;
const MOUSTACHE = 451;
const BUN0 = 460;
/** How far down a nape layer (0 root to 1 tip) the shadow of the hair above it reaches. */
const NAPE_SHADE = 0.45;

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
 * nose, and a firm, straight mouth: a stern young face.
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
    let p = add3(add3(root, dir, lk.len * t), curl, lk.len * t * t);
    for (const e of [s, ...(d.volume ?? [])]) {
      const q: V3 = [(p[0] - e.c[0]) / e.r[0], (p[1] - e.c[1]) / e.r[1], (p[2] - e.c[2]) / e.r[2]];
      const ql = Math.hypot(q[0], q[1], q[2]);
      const k = ql < 1 + LIE ? (1 + LIE) / Math.max(1e-3, ql) : 1;
      p = [e.c[0] + q[0] * k * e.r[0], e.c[1] + q[1] * k * e.r[1], e.c[2] + q[2] * k * e.r[2]];
    }
    pts.push(p);
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

  // Skull, jaw, ears and the shell of hair (any volume joined to it as one shape with it): the
  // mass under the locks, a tone darker than them so the gaps between clumps read as recesses, and
  // darkest on its underside at the nape. The shell and the locks share one material, parted by
  // the hair's coloured line.
  const hair: Mat = { ...d.hair, line: d.lockLine ?? shade(d.hair.tones[3], -0.3), clear: 1 };
  part.blobs(fr, [{ c: d.skull.c, r: d.skull.r, id: SKIN }, { c: d.jaw.c, r: d.jaw.r, id: SKIN }], () => ({ m: d.skin }));
  part.blobs(fr, [{ c: d.ear.c, r: d.ear.r, id: EAR }, { c: [d.ear.c[0], d.ear.c[1], -d.ear.c[2]], r: d.ear.r, id: EAR }], () => ({ m: d.skin, light: -0.05 }));
  const fan = d.whorl ? fanOf(d.whorl) : null;
  part.blobs(fr, [{ c: d.shell.c, r: d.shell.r, id: SHELL }, ...(d.volume ?? []).map((v) => ({ c: v.c, r: v.r, id: SHELL }))], (h: Hit) => {
    if (h.back) return { m: hair, light: toneLight(hair, 3) };
    if (bare(d, h.p)) return null;
    const l = cam.light(dirIn(fr, h.n[0], h.n[1], h.n[2]));
    let tone = h.n[1] < -0.5 ? 3 : l > 0.45 ? 1 : l > -0.15 ? 2 : 3;
    if (fan) {
      const k = clumpAt(d, fan, h.p);
      if (fan.spec.comb) {
        // Combed: the tone the light gives (as the raster would shade the material, its bias and
        // gain included; the underside stays in shadow), each clump parted from the next by a dark
        // line, with a streak a tone lighter along its lit side where the hair faces the light.
        if (h.n[1] >= -0.5) tone = toneOf(l * (hair.gain ?? 1) + (hair.bias ?? 0));
        if (k >= 0 && k < COMB_LINE) tone = 3;
        else if (k >= 0 && k < COMB_STREAK && l > 0.05) tone = Math.max(0, tone - 1);
      } else if (k !== -1) tone = Math.min(3, banded(k) + (l < -0.2 ? 1 : 0) + (h.n[1] < -0.55 ? 1 : 0));
    }
    // Dark hair: the whole mass a tone deeper.
    if (d.darkHair) tone = Math.min(3, tone + 1);
    return { m: hair, light: toneLight(hair, tone) };
  });
  // Hair under gear worn over the head (a hood up, a helm) is not painted.
  const covered = coverTest(ctx, pieces, fr);
  // A beard over the jaw and up the cheeks, and hair worn up.
  const bd = d.beard;
  const beardMat = bd ? { ...(bd.mat ?? d.hair), line: bd.mat?.line ?? hair.line, clear: 1 } : hair;
  if (bd) part.blobs(fr, beardShell(d, bd), (h) => beardShade(ctx, d, bd, beardMat, fr, h));
  d.buns?.forEach((bn, i) => {
    if (covered(onShell(d, bn.yaw, bn.pitch, 0.9), [0, 1, 0])) return;
    paintBun(ctx, part, d, fr, bn, hair, BUN0 + i * 2);
  });
  const held = pieces.flatMap((piece) => piece.blobs?.(ctx, fr) ?? []);
  for (const b of held) part.blobs(b.frame, b.blobs, b.shade);
  under?.(part);

  // Locks: wind streams them back and sideways, in the head's own axes (never forward: a
  // negative wind flicks only the coat, or the fringe would fall over his eyes).
  const wind = Math.max(0, pose.wind ?? 0);
  const push = inFrame(fr, mul3([-1, 0.3 + (pose.lift ?? 0) * 0.6, (pose.sway ?? 0) * 0.6], wind * 0.55 + Math.abs(pose.sway ?? 0) * 0.2));
  const lift = inFrame(fr, [0, (pose.lift ?? 0) * 0.4, 0]);
  const centre = ctx.proj(hero(d.shell.c));
  // A springy lock (`bob`) sways to and fro as the ripple runs (the pose's `phase`).
  const bob = Math.sin((pose.phase ?? 0) * Math.PI * 2);
  d.locks.forEach((lk, li) => {
    if (covered(onShell(d, lk.yaw, lk.pitch, 0.9), lk.dir)) return;
    const sway: V3 = lk.bob ? add3(add3(push, lift), [0.35 * bob, -0.25 * Math.abs(bob), bob], lk.bob) : add3(push, lift);
    paintLock(ctx, part, d, fr, lk, LOCK0 + li, sway, hair, centre);
  });
  // Short layers at the nape: long hair, but painted here in the head's depth test, so they lie
  // over a high collar (see LongHair.nape), by default a tone deeper where they grow out from under
  // the hair above, in its shadow.
  const long = d.long;
  if (long?.nape) {
    const over = held.flatMap((b) => b.blobs.map((o): Obstacle => ({ fr: b.frame, c: o.c, r: o.r, pad: long.lie ?? 1.5 })));
    long.nape.forEach((t, i) => {
      if (covered(onShell(d, t.yaw, t.pitch, 0.9), t.dir)) return;
      paintTress(ctx, part, d, hero(d.shell.c), napeStrand(ctx, d, fr, t, i, over), hair, NAPE0 + i, long.napeDeep ?? 1, NAPE_SHADE);
    });
  }
  if (d.moustache) paintMoustache(ctx, part, d, fr, d.moustache.mat ? { ...d.moustache.mat, clear: 1 } : beardMat);
  for (const piece of pieces) piece.paint?.(ctx, part, fr);

  // The fringe casts a shadow on the brow, `hairline.shadow` pixels deep.
  const cx = Math.round(ctx.proj(hero(d.skull.c))[0]);
  const cy = Math.round(ctx.proj(hero(d.skull.c))[1]);
  const deep = d.hairline.shadow ?? 2;
  for (let y = cy - 16; y <= cy + 16; y++) {
    for (let x = cx - 16; x <= cx + 16; x++) {
      if (part.idAt(x, y) !== SKIN) continue;
      let under = false;
      for (let k = 1; k <= deep && !under; k++) under = part.idAt(x, y - k) >= SHELL;
      if (under) part.darken(x, y, 0.45);
    }
  }

  paintFace(ctx, part, d.face, d.skin, fr, pose.face ?? d.face.rest ?? 'stern', pose.wink);
  part.commit();
  const tones = [...hair.tones, hair.line];
  if (beardMat !== hair) tones.push(...beardMat.tones, beardMat.line);
  despeckle(ctx, tones, cx - 24, cy - 24, cx + 24, cy + 24, HEAD_TAG);
}

/** Whether a point on the hair's shell (head space) is under any of the head pieces' gear this frame. */
function coverTest(ctx: PieceContext, pieces: readonly HeadPiece[], fr: Frame3): (p: V3, dir: V3) => boolean {
  const tests = pieces.map((piece) => piece.covers?.(ctx, fr) ?? null).filter((t): t is (p: V3, dir: V3) => boolean => t !== null);
  return tests.length ? (p, dir) => tests.some((t) => t(p, dir)) : () => false;
}

// ── Facial hair ──────────────────────────────────────────────────────────────────────────────

/**
 * The beard's growth: shells `thick` clear of the jaw and a little clear of the skull (which
 * carries it up the cheeks to the sideburns), cut to where it grows by `beardShade`.
 */
function beardShell(d: HeadDesign, b: Beard): Blob[] {
  const t = b.thick;
  return [
    { c: d.jaw.c, r: [d.jaw.r[0] + t, d.jaw.r[1] + t, d.jaw.r[2] + t], id: BEARD },
    { c: d.skull.c, r: [d.skull.r[0] + t * 0.8, d.skull.r[1] + t * 0.8, d.skull.r[2] + t * 0.8], id: BEARD },
  ];
}

const smooth01 = (x: number): number => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * Where the beard grows and how it is lit: below the line from the sideburns to beside the mouth,
 * within `round` degrees of the chin, not over the lips; lit as the hair's shell is, its underside
 * in shadow, with a darker parting every few pixels round the jaw and a lit streak beside each.
 */
function beardShade(ctx: PieceContext, d: HeadDesign, b: Beard, m: Mat, fr: Frame3, h: Hit): { m: Mat; light: number } | null {
  if (h.back) return null;
  const p = h.p;
  const yawS = (Math.atan2(p[2], p[0] - d.jaw.c[0]) * 180) / Math.PI;
  const yaw = Math.abs(yawS);
  if (yaw > (b.round ?? 90)) return null;
  const top = b.cheek + (b.side - b.cheek) * smooth01((yaw - 30) / 60);
  if (p[1] > top) return null;
  const mo = d.face.mouthAt;
  if (b.mouth[0] > 0 && b.mouth[1] > 0 && p[0] > d.jaw.c[0] && (p[2] / b.mouth[0]) ** 2 + ((p[1] - mo[1]) / b.mouth[1]) ** 2 < 1) return null;
  const l = ctx.cam.light(dirIn(fr, h.n[0], h.n[1], h.n[2]));
  let tone = h.n[1] < -0.62 ? 3 : l > 0.45 ? 1 : l > -0.15 ? 2 : 3;
  // Strands running down it: a parting every 24 degrees or so round the jaw, slanting a little.
  const k = (((yawS / 24 + p[1] * 0.05) % 1) + 1) % 1;
  if (k < 0.16) tone = Math.min(3, tone + 1);
  else if (k < 0.42 && l > 0.3 && h.n[1] > -0.4) tone = Math.max(0, tone - 1);
  if (d.darkHair) tone = Math.min(3, tone + 1);
  return { m, light: toneLight(m, tone) };
}

/**
 * The moustache: from under the nose out to either side over the corners of the mouth, following
 * the face round, its tips drooping (or curling up), as a clump each side, in front of the face.
 */
function paintMoustache(ctx: PieceContext, part: Part, d: HeadDesign, fr: Frame3, m: Mat): void {
  const ms = d.moustache;
  if (!ms) return;
  const at = ms.at ?? [d.face.noseAt[0] - 0.3, d.face.noseAt[1] - 1.3];
  const j = d.jaw;
  const lie = 1 + (ms.w * 0.45) / Math.min(j.r[0], j.r[2]);
  // On the jaw's surface, standing a little clear of it.
  const onJaw = (u: number, r: number): V3 => {
    const q: V3 = [Math.max(0.05, 1 - ((u - j.c[1]) / j.r[1]) ** 2 - (r / j.r[2]) ** 2), (u - j.c[1]) / j.r[1], r / j.r[2]];
    const f = Math.sqrt(q[0]);
    return [j.c[0] + f * j.r[0] * lie, j.c[1] + q[1] * j.r[1] * lie, j.c[2] + q[2] * j.r[2] * lie];
  };
  const n = 4;
  for (const s of [1, -1]) {
    const pts: V3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(at3(fr, ...onJaw(at[1] - ms.droop * t * t, s * ms.len * t)));
    }
    const P = pts.map((q) => ctx.proj(q));
    const Z = pts.map((q) => ctx.depth(q) + 1.2);
    // A side seen from behind the face is hidden by it (its root faces away): skip it.
    if (ctx.cam.facing(norm3(sub3(pts[n] as V3, at3(fr, j.c[0], j.c[1], j.c[2])))) < -0.35) continue;
    leaf(
      part,
      P,
      (t) => ms.w * (t < 0.3 ? 0.85 + t * 0.5 : Math.max(0.35, 1 - (t - 0.3) * 0.9)),
      m,
      (t, a) => toneLight(m, a > 0.35 && t < 0.6 ? (d.darkHair ? 1 : 0) : t > 0.85 || a < -0.3 ? (d.darkHair ? 3 : 2) : d.darkHair ? 2 : 1),
      (t) => {
        const f = t * n;
        const i = Math.min(n - 1, Math.floor(f));
        return (Z[i] as number) + ((Z[i + 1] as number) - (Z[i] as number)) * (f - i);
      },
      MOUSTACHE,
    );
  }
}

/** A point on the beard's jaw shell (head space) at a yaw and pitch, `k` of the way out. */
function onBeard(d: HeadDesign, b: Beard, yaw: number, pitch: number, k: number): V3 {
  const j = d.jaw;
  const cp = Math.cos(rad(pitch));
  return [j.c[0] + Math.cos(rad(yaw)) * cp * (j.r[0] + b.thick) * k, j.c[1] + Math.sin(rad(pitch)) * (j.r[1] + b.thick) * k, j.c[2] + Math.sin(rad(yaw)) * cp * (j.r[2] + b.thick) * k];
}

/**
 * A beard laid out by kind, for a head about the Dark Knight's size (the mouth about 6.6 under the
 * head's centre; move `cheek` and `side` with it on another head):
 *
 *  - 'full': thick over the jaw and cheeks up to the sideburns, with `count` tresses (default 5)
 *    hanging from under the chin and the jaw `len` long (default 14: to mid-chest), the middle ones
 *    longest, flaring out a little at the sides so it shows beside the neck from behind;
 *  - 'short': close over the jaw and up the cheeks, with short tufts under the chin (`len` default 4);
 *  - 'pointed': over the chin and along the jaw, narrowing to one point under the chin (`len`
 *    default 10, a goatee's point jutting a little forward) with two short tufts beside it.
 *
 * `w` sets the tresses' half-width (default 2.8), `give` how readily they sway (default 0.35),
 * `thick` the growth's depth over the jaw, `mouth` the bare patch round the lips (half-sizes,
 * default [2.4, 1.3]), `cheek` and `side` where it grows up to (see Beard); `seed` varies the
 * tresses' lengths.
 */
export function beard(o: { kind: 'full' | 'short' | 'pointed'; len?: number; w?: number; count?: number; give?: number; thick?: number; mouth?: readonly [number, number]; cheek?: number; side?: number; mat?: Mat; seed?: number }): Beard {
  const give = o.give ?? 0.35;
  const w = o.w ?? 2.8;
  const mouth = o.mouth ?? [2.4, 1.3];
  if (o.kind === 'short') {
    const len = o.len ?? 4;
    return {
      mat: o.mat,
      thick: o.thick ?? 1.1,
      side: o.side ?? -1.5,
      cheek: o.cheek ?? -5.6,
      mouth,
      hang: [-40, 0, 40].map((yaw): Tress => ({ yaw, pitch: yaw ? -50 : -62, dir: [0.35, -1, Math.sin(rad(yaw)) * 0.4], len: len * (yaw ? 0.75 : 1), w: w * 0.9, stiff: 0.3, give, taper: 0.6 })),
    };
  }
  if (o.kind === 'pointed') {
    const len = o.len ?? 10;
    return {
      mat: o.mat,
      thick: o.thick ?? 1.2,
      side: o.side ?? -3,
      cheek: o.cheek ?? -6,
      round: 80,
      mouth,
      hang: [
        { yaw: -34, pitch: -50, dir: [0.4, -1, -0.25], len: len * 0.45, w: w * 0.8, stiff: 0.4, give, taper: 0.7 },
        { yaw: 34, pitch: -50, dir: [0.4, -1, 0.25], len: len * 0.45, w: w * 0.8, stiff: 0.4, give, taper: 0.7 },
        { yaw: 0, pitch: -62, dir: [0.55, -1, 0], len, w: w * 1.05, stiff: 0.55, give, taper: 0.95 },
      ],
    };
  }
  const len = o.len ?? 14;
  const n = Math.max(3, Math.round(o.count ?? 5));
  return {
    mat: o.mat,
    thick: o.thick ?? 1.6,
    side: o.side ?? -1.5,
    cheek: o.cheek ?? -5.4,
    mouth,
    hang: Array.from({ length: n }, (_, i): Tress => {
      const k = (i / (n - 1)) * 2 - 1;
      const yaw = k * 72;
      // The middle ones longest and rooted lowest (under the chin, clear of the mouth).
      const l = len * (1 - 0.32 * Math.abs(k) - 0.08 * hash(i + 3, o.seed ?? 11));
      return { yaw, pitch: -62 + Math.abs(k) * 24, dir: [0.25, -1, k * 0.45], len: l, w: w * (1 - 0.15 * Math.abs(k)), stiff: 0.25, give, taper: 0.55 };
    }),
  };
}

// ── Hair worn up ─────────────────────────────────────────────────────────────────────────────

/** How far a bun stands toward the viewer in the head's depth test, over the locks (which are drawn up to 3 proud of the hair). */
const BUN_LIFT = 3;

/**
 * A bun (or a twist, or a high updo) standing on the hair: an ellipsoid in its own frame, its u
 * axis out of the head (leaning as the design says), with clumps of hair wound round it and
 * twisting toward its top, a parting line between them and a lit band beside it, darker where it
 * meets the head; and a tie round its root.
 */
function paintBun(ctx: PieceContext, part: Part, d: HeadDesign, fr: Frame3, bn: Bun, m: Mat, id: number): void {
  const s = d.shell;
  const cp = Math.cos(rad(bn.pitch));
  const dir: V3 = [Math.cos(rad(bn.yaw)) * cp, Math.sin(rad(bn.pitch)), Math.sin(rad(bn.yaw)) * cp];
  const base: V3 = [s.c[0] + dir[0] * s.r[0], s.c[1] + dir[1] * s.r[1], s.c[2] + dir[2] * s.r[2]];
  const nrm = norm3([dir[0] / s.r[0], dir[1] / s.r[1], dir[2] / s.r[2]]);
  const axis = norm3(add3(nrm, bn.lean ?? [0, 0, 0]));
  // Its own frame (head space): u out along the axis, f as near the face's way as it can be.
  let f = sub3([1, 0, 0], mul3(axis, axis[0]));
  if (Math.hypot(f[0], f[1], f[2]) < 0.2) f = sub3([0, 1, 0], mul3(axis, axis[1]));
  f = norm3(f);
  const r = cross3(f, axis);
  const o = add3(base, axis, bn.r[1] * 0.7);
  const frame: Frame3 = { o: at3(fr, o[0], o[1], o[2]), f: dirIn(fr, f[0], f[1], f[2]), u: dirIn(fr, axis[0], axis[1], axis[2]), r: dirIn(fr, r[0], r[1], r[2]) };
  const clumps = bn.clumps ?? 5;
  const twist = bn.twist ?? 0.3;
  part.blobs(frame, [{ c: [0, 0, 0], r: bn.r, id }], (h) => {
    if (h.back) return null;
    const l = ctx.cam.light(dirIn(frame, h.n[0], h.n[1], h.n[2]));
    let tone = l > 0.45 ? 1 : l > -0.15 ? 2 : 3;
    const hu = h.p[1] / bn.r[1];
    const phi = Math.atan2(h.p[2] / bn.r[2], h.p[0] / bn.r[0]) / (Math.PI * 2);
    const k = ((((phi + twist * (hu + 1) * 0.5) * clumps) % 1) + 1) % 1;
    if (k < 0.14) tone = Math.min(3, tone + 1);
    else if (k < 0.42 && l > 0.15) tone = Math.max(0, tone - 1);
    // In the shadow where it meets the head.
    if (hu < -0.55) tone = Math.min(3, tone + 1);
    if (d.darkHair) tone = Math.min(3, tone + 1);
    // It sits over the locks drawn up into it, which stand a little proud of the hair.
    return { m, light: toneLight(m, tone), lift: BUN_LIFT };
  });
  if (bn.tie) {
    const t = bn.tie;
    part.blobs(frame, [{ c: [0, -bn.r[1] * 0.6, 0], r: [bn.r[0] * 0.72 + t.r, t.r, bn.r[2] * 0.72 + t.r], id: id + 1 }], (h) => (h.back ? null : { m: t.mat, lift: BUN_LIFT + 0.5 }));
  }
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

/** The unit direction (head space) at degrees round the head (0 the face, 90 the right) and up. */
const onSphere = (yaw: number, pitch: number): V3 => [Math.cos(rad(yaw)) * Math.cos(rad(pitch)), Math.sin(rad(pitch)), Math.sin(rad(yaw)) * Math.cos(rad(pitch))];

/**
 * The clumps painted on the back of the hair's shell: sectors fanning out from the crown's whorl,
 * twisting a little as they fall, and meeting again at the point opposite it or at its sink. What
 * `clumpAt` needs of them, worked out once a head: the whorl (unit, head space), the way down the
 * back from it and the way across, and for a sink, the frame of a stereographic projection from it.
 */
interface Fan {
  spec: NonNullable<HeadDesign['whorl']>;
  w: V3;
  ref: V3;
  side: V3;
  sink: { v: V3; at: V3; e1: V3; e2: V3 } | null;
}

/** A point of the unit sphere seen in a stereographic projection from `s` (onto the plane through the centre, square to it). */
const fromPole = (v: V3, s: V3): V3 => mul3(add3(v, s, -dot3(v, s)), 1 / Math.max(1e-6, 1 - dot3(v, s)));

function fanOf(spec: NonNullable<HeadDesign['whorl']>): Fan {
  const w = norm3(dirIn(HEAD_AXES, Math.cos(rad(spec.yaw)) * Math.cos(rad(spec.pitch)), Math.sin(rad(spec.pitch)), Math.sin(rad(spec.yaw)) * Math.cos(rad(spec.pitch))));
  // The way down the back from the whorl, where its azimuth is measured from.
  const ref = norm3(add3([0, -1, 0], w, -dot3([0, -1, 0], w)));
  let sink: Fan['sink'] = null;
  if (spec.sink) {
    // The clumps run along the circles through the whorl and the sink. Seen in a stereographic
    // projection from the sink those are straight lines out from the whorl's image, so the angle
    // round it there places a point among them (the projection keeps angles, so it is measured
    // from the way down the back, as round the whorl).
    const v = onSphere(spec.sink.yaw, spec.sink.pitch);
    const at = fromPole(w, v);
    const e1 = norm3(sub3(fromPole(norm3(add3(w, ref, 0.01)), v), at));
    sink = { v, at, e1, e2: cross3(e1, v) };
  }
  return { spec, w, ref, side: cross3(w, ref), sink };
}

/**
 * Where a point of the shell (head space) falls among the whorl's clumps: how far across its clump
 * it lies (0 at the parting on one side to 1 at the next), CROWN at the whorl itself or where the
 * clumps meet at its sink (a small point where they part), or -1 outside the fan.
 */
function clumpAt(d: HeadDesign, fan: Fan, p: V3): number {
  const s = d.shell;
  const n = norm3([(p[0] - s.c[0]) / s.r[0], (p[1] - s.c[1]) / s.r[1], (p[2] - s.c[2]) / s.r[2]]);
  const theta = Math.acos(Math.max(-1, Math.min(1, dot3(n, fan.w))));
  if (theta > rad(fan.spec.reach)) return -1;
  if (theta < rad(9)) return CROWN;
  let phi: number;
  if (fan.sink) {
    if (dot3(n, fan.sink.v) > Math.cos(rad(9))) return CROWN;
    const q = sub3(fromPole(n, fan.sink.v), fan.sink.at);
    phi = Math.atan2(dot3(q, fan.sink.e2), dot3(q, fan.sink.e1));
  } else phi = Math.atan2(dot3(n, fan.side), dot3(n, fan.ref));
  phi += theta * fan.spec.twist;
  return (((phi / (Math.PI * 2)) * fan.spec.clumps) % 1 + 1) % 1;
}

/** `clumpAt` at the whorl itself, or where the clumps meet at its sink. */
const CROWN = -2;
/** A combed whorl's clumps: the share of each that is its parting line, and where its lit streak ends. */
const COMB_LINE = 0.08;
const COMB_STREAK = 0.24;

/**
 * The tone (0 highlight to 3 shadow) of a fan's clump at a place across it (`clumpAt`): a parting
 * line on one side, a lit band beside it, the light tone and a darker far side; the crown a small
 * dark point.
 */
function banded(k: number): number {
  if (k === CROWN) return 2;
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
 * would, it is splayed out from the middle of the head and left to droop (or, for a stiff spike,
 * left standing straight out: `Lock.stand`).
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
    // A soft lock droops; a stiff spike (`stand`) stands out from the middle of the head.
    const stand = lk.stand ?? 0;
    let dx = ((P[n] as Vec)[0] - p0[0]) * (1 - k) + ox * (0.55 + 0.45 * stand) * want * k;
    let dy = ((P[n] as Vec)[1] - p0[1]) * (1 - k) + (oy * (0.3 + 0.7 * stand) + 1 - stand) * want * k;
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

function paintFace(ctx: PieceContext, part: Part, f: FaceDesign, skin: Mat, fr: Frame3, face: Face, wink?: 'R' | 'L'): void {
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
    // A wink shuts one eye alone (side 1 is his right).
    const winked = wink !== undefined && (wink === 'R') === (side === 1);
    const eye = face === 'closed' || winked ? style.eyes.closed : face === 'hurt' ? style.eyes.squeeze : face === 'shout' && kind === 'full' ? style.eyes.wide : style.eyes[kind];
    stamp(part, eye, p[0], p[1], dir, eyeCols, z, onFace);
    const brow = (face === 'hurt' ? style.browsUp : style.brows)[kind];
    const lift = face === 'hurt' || face === 'shout' ? 1 : face === 'smirk' && side === 1 ? 1 : 0;
    // Brows show through the fringe, as drawn brows do.
    stamp(part, brow, p[0], p[1] - f.browUp - lift, dir, browCols, z + 20, (id) => id >= 0 && id !== EAR && id < GEAR_ID);
  }
  // Mouth and nose.
  const mouthN = norm3(dirIn(fr, 1, -0.25, 0));
  const mf = cam.facing(mouthN);
  if (mf > 0.05) {
    const mp = ctx.proj(hero([f.mouthAt[0], f.mouthAt[1], 0]));
    const glyph = style.mouths[face];
    const shrink = mf < 0.5 && glyph.rows[0]!.length > 2 ? { rows: glyph.rows.map((r) => r.slice(0, -1)), ax: Math.max(0, glyph.ax - 1), ay: glyph.ay } : glyph;
    // The mouth reads through a beard and under a moustache.
    stamp(part, shrink, mp[0], mp[1], rightX > 0 ? -1 : 1, { M: m(f.mouth), r: m([70, 16, 20]), T: m([236, 226, 214]) }, ctx.depth(hero([f.mouthAt[0], f.mouthAt[1], 0])) + 0.4, (id) => id === SKIN || id === BEARD || id === MOUSTACHE);
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
 * `pitch`, falling down the back and drawing in a little toward its middle. They are `len` long, the
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
  /** Lifts its lighting (a ponytail's `sheen`). */
  sheen?: number;
  /** How far its end flips out (Tress.flip). */
  flip?: number;
}

/**
 * Paints a tress as a long clump: the breadth of `w` along most of it, narrowing to a point over
 * the last `taper` of it. Its tone comes from how the hair there faces the light (out from the
 * head's upright axis, so a curtain is lit on the side toward the light and in shadow seen from
 * the front, where it hangs behind), a tone lighter along each tress's lit side and darker along
 * its shadowed side and at its tip, with a streak of highlight high up on lit tresses. `deep`
 * darkens it by that many tones over the first `deepTo` of its length (nape layers grow out from
 * under the hair above them, in its shadow). A flipped end catches the light where it turns up
 * (the light tone, a tone darker along its shadowed side) rather than darkening to its tip.
 */
function paintTress(ctx: PieceContext, part: Part, d: HeadDesign, axis: V3, s: HairStrand, m: Mat, id: number, deep = 0, deepTo = 1): void {
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
  // How far a flipped end has turned up out of the fall there: 0 hanging straight down, 1 level
  // or rising (only over the flipped part of it).
  const turn = pts.map((p, i) => {
    if (!s.flip || i / n <= FLIP_FROM) return 0;
    const a = pts[Math.max(0, i - 1)] as V3;
    const b = pts[Math.min(n, i + 1)] as V3;
    const up = (b[1] - a[1]) / (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1);
    return Math.min(1, Math.max(0, 1 + up)) * Math.min(1, s.flip);
  });
  leaf(
    part,
    P,
    width,
    m,
    (t, a) => {
      // Lit where it faces the light, darker down its length and across to its shadowed side.
      const l = along(lit, t) - 0.4 * t + 0.22 * a + (s.sheen ?? 0);
      let tone = l > 0.62 && t < 0.4 && a > 0 ? 0 : l > 0.28 ? 1 : l > -0.12 ? 2 : 3;
      const up = s.flip ? along(turn, t) : 0;
      if (t > 0.88 && up < 0.3) tone = Math.min(3, tone + 1);
      if (d.darkHair && tone > 0) tone = Math.min(3, tone + 1);
      if (t < deepTo) tone = Math.min(3, tone + deep);
      // A flipped end turning up catches the light.
      if (up > 0.4) tone = Math.min(tone, a > -0.3 ? 1 : 2);
      return toneLight(m, tone);
    },
    (t, a) => along(Z, t) + (1 - Math.min(1, a * a)) * 0.6,
    id,
  );
}

/** The hair's shell and any volume joined to it, as obstacles long hair lies over. */
const hairMass = (d: HeadDesign, fr: Frame3): Obstacle[] => [d.shell, ...(d.volume ?? [])].map((e) => ({ fr, c: e.c, r: e.r, pad: 0.4 }));

/**
 * A layer at the nape (`long.nape`) in a pose: a strand that grows out of the hair's shell as a
 * tress does and lies over the head, the jaw and `over` (the head's pieces: a high collar). `fr`
 * is the head's frame as painted.
 */
function napeStrand(ctx: PieceContext, d: HeadDesign, fr: Frame3, t: Tress, i: number, over: readonly Obstacle[]): HairStrand {
  const avoid: Obstacle[] = [...hairMass(d, fr), { fr, c: d.jaw.c, r: d.jaw.r, pad: 1 }, ...over];
  const root = at3(fr, ...onShell(d, t.yaw, t.pitch, 0.9));
  const side = dirIn(fr, Math.cos(rad(t.yaw)), 0, Math.sin(rad(t.yaw)));
  const spec = { root, dir: dirIn(fr, t.dir[0], t.dir[1], t.dir[2]), len: t.len, n: segments(t.len), stiff: t.stiff ?? 0.3, give: t.give ?? 1, seed: 0.7 + i * 1.9, avoid, axis: ctx.rig.pelvis.o, view: norm3(ctx.cam.local(TO_CAMERA)), side, flip: t.flip };
  return { pts: strand(ctx.pose, spec), w: t.w, taper: t.taper ?? 0.35, flip: t.flip };
}

/**
 * The draw items of a head's long hair (`head.long`), for the painter to sort with the body: each
 * tress of the curtain and each lock over the shoulders on its own, and the ponytail (its strands
 * and its tie) as one, each at the depth of its hanging part (sorted with the upper body, as arms
 * are: see `PieceContext.upperZ`). `fr` is the head's frame as painted. Each is solved as strands (pieces.ts `strand`) that
 * grow out of the hair's shell and lie over the head, the jaw and the torso. The nape layers are
 * not among them: `paintHead` paints those.
 */
export function hairItems(ctx: PieceContext, d: HeadDesign, body: BodyDesign, fr: Frame3, pieces: readonly HeadPiece[] = []): DrawItem[] {
  const long = d.long;
  if (!long && !d.beard?.hang?.length) return [];
  const { rig, pose } = ctx;
  // Hair under gear worn over the head (a hood up, a helm) is not painted.
  const covered = coverTest(ctx, pieces, fr);
  const hero = (p: V3): V3 => at3(fr, p[0], p[1], p[2]);
  const avoid: Obstacle[] = [...hairMass(d, fr), { fr, c: d.jaw.c, r: d.jaw.r, pad: 1 }, ...torsoObstacles(rig, body.chest, body.hips)];
  const lie = long?.lie ?? 1.5;
  const axis = hero(d.shell.c);
  const view = norm3(ctx.cam.local(TO_CAMERA));
  const hair: Mat = { ...d.hair, line: d.lockLine ?? shade(d.hair.tones[3], -0.3), clear: 1 };
  const keys = [...hair.tones, hair.line].map((t) => t[0] * 65536 + t[1] * 256 + t[2]);
  // `side` is the way it opens out when the wind would carry it straight at the viewer or away
  // (see StrandSpec): out from the head where it grows, unless given.
  const solve = (t: { yaw: number; pitch: number; dir: V3; len: number; w: number; stiff?: number; give?: number; taper?: number; flip?: number }, seed: number, out = 0.9, side?: V3): HairStrand => ({
    pts: strand(pose, { root: hero(onShell(d, t.yaw, t.pitch, out)), dir: dirIn(fr, t.dir[0], t.dir[1], t.dir[2]), len: t.len, n: segments(t.len), stiff: t.stiff ?? 0.3, give: t.give ?? 1, seed, avoid, pad: lie, axis: rig.pelvis.o, view, side: side ?? dirIn(fr, Math.cos(rad(t.yaw)), 0, Math.sin(rad(t.yaw))), flip: t.flip }),
    w: t.w,
    taper: t.taper ?? 0.35,
    flip: t.flip,
  });
  // The head's box on screen, where long hair may grow out of its hair.
  const hc = ctx.proj(axis);
  const hr = Math.ceil(Math.max(d.shell.r[0], d.shell.r[1], d.shell.r[2]) + 3);
  // One item: the strands painted into one part (and anything else `more` adds), sorted at the
  // depth of their hanging parts.
  // A beard's tresses take their own material (and its colours where they grow out of the
  // head's part) and are lit out from the jaw.
  const item = (strands: HairStrand[], more?: (part: Part) => void, look: { m: Mat; keys: readonly number[]; axis: V3 } = { m: hair, keys, axis }): DrawItem => {
    let zs = 0;
    let zn = 0;
    for (const s of strands) {
      for (let i = Math.ceil((s.pts.length - 1) * 0.3); i < s.pts.length; i++) {
        zs += ctx.depth(s.pts[i] as V3);
        zn++;
      }
    }
    return {
      z: ctx.upperZ(zs / Math.max(1, zn)),
      draw: () => {
        const part = ctx.part(HAIR_TAG);
        const taken = rootIn(ctx, part, look.keys, Math.round(hc[0]) - hr, Math.round(hc[1]) - hr, Math.round(hc[0]) + hr, Math.round(hc[1]) + hr);
        strands.forEach((s, i) => paintTress(ctx, part, d, look.axis, s, look.m, 10 + i));
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
        despeckle(ctx, [...look.m.tones, look.m.line], Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1), HAIR_TAG);
      },
    };
  };
  const items: DrawItem[] = [];
  // Long hair rooted under gear worn over the head comes out from under its edge: its root slides
  // down the hair's shell until it is clear of the gear (below a helm's edge), or, if it never is
  // (under a hood worn up), it is not painted.
  const rooted = <T extends { yaw: number; pitch: number; dir: V3 }>(t: T): T | null => {
    for (let pitch = t.pitch; pitch >= -60; pitch -= 3) if (!covered(onShell(d, t.yaw, pitch, 0.9), t.dir)) return pitch === t.pitch ? t : { ...t, pitch };
    return null;
  };
  long?.back?.forEach((t, i) => {
    const r = rooted(t);
    if (r) items.push(item([solve(r, i * 1.9)]));
  });
  long?.front?.forEach((t, i) => {
    const r = rooted(t);
    if (r) items.push(item([solve(r, 3.1 + i * 2.3)]));
  });
  const bd = d.beard;
  if (bd?.hang?.length) {
    // A beard's tresses hang from the jaw's shell and lie over the chest, each sorted on its own.
    const m: Mat = { ...(bd.mat ?? d.hair), line: bd.mat?.line ?? hair.line, clear: 1 };
    const look = { m, keys: [...m.tones, m.line].map((t) => t[0] * 65536 + t[1] * 256 + t[2]), axis: hero(d.jaw.c) };
    const over: Obstacle[] = [{ fr, c: d.jaw.c, r: d.jaw.r, pad: bd.thick * 0.6 }, ...torsoObstacles(rig, body.chest, body.hips), ...pieces.flatMap((pc) => pc.blobs?.(ctx, fr) ?? []).flatMap((b) => b.blobs.map((o): Obstacle => ({ fr: b.frame, c: o.c, r: o.r })))];
    bd.hang.forEach((t, i) => {
      const root = hero(onBeard(d, bd, t.yaw, t.pitch, 0.9));
      const side = dirIn(fr, Math.cos(rad(t.yaw)) * 0.4, 0, Math.sin(rad(t.yaw)));
      const pts = strand(pose, { root, dir: dirIn(fr, t.dir[0], t.dir[1], t.dir[2]), len: t.len, n: segments(t.len), stiff: t.stiff ?? 0.3, give: t.give ?? 0.35, seed: 0.5 + i * 2.7, avoid: over, pad: bd.lie ?? 1.2, axis: rig.pelvis.o, view, side, flip: t.flip });
      // Sorted against a held item where it crosses one (see DrawItem.cross).
      items.push({ ...item([{ pts, w: t.w, taper: t.taper ?? 0.5, flip: t.flip }], undefined, look), cross: { pts, w: t.w } });
    });
  }
  const tail = long?.tail ? rooted(long.tail) : null;
  if (tail) {
    // The tail: a thick tress from the tie with a thinner one either side of it, and the tie
    // round its root with the cord's loose ends.
    const across = norm3(cross3(dirIn(fr, tail.dir[0], tail.dir[1], tail.dir[2]), fr.u));
    // The tie sits on the hair, standing clear of it, so it shows on the head's outline side on.
    const out = 1 + (tail.tie.r * 0.8) / ((d.shell.r[0] + d.shell.r[1] + d.shell.r[2]) / 3);
    // A tail at the back of the head would hide behind it from the front as he runs: it flicks
    // out to one side instead (the same side every frame).
    const flick = add3(dirIn(fr, Math.cos(rad(tail.yaw)), 0, Math.sin(rad(tail.yaw))), across, 0.8);
    const main = { ...solve(tail, 0.4, out, flick), sheen: tail.sheen };
    const side = (k: number, seed: number): HairStrand => {
      const s = solve({ ...tail, len: tail.len * 0.86, w: tail.w * 0.62 }, seed, out, flick);
      return { ...s, sheen: tail.sheen, pts: s.pts.map((p, i) => add3(p, across, k * tail.w * 0.55 * Math.min(1, i / 2))) };
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
