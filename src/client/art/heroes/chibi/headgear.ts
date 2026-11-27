/**
 * Gear worn on the head, for a design's head pieces: a cloth hood worn up over the hair (with an
 * opening for the face) or down (fallen back onto the shoulders behind the neck), an open-faced
 * helm or half-helm (a brow band, cheek guards, a ridge, a scale pattern and fins or wings rising
 * from it), and a circlet or headband with a gem. Each is painted with the head, in its depth
 * test, so it turns with the head and sorts pixel by pixel with the face, the hair and the collar;
 * the hood worn down is the exception, an outfit piece sorted with the body. Gear over the hair
 * says which hair it covers (`HeadPiece.covers`), and that hair is not painted: only hair at the
 * front that hangs down (a fringe, locks framing the face) comes out from under a hood or a helm.
 *
 * Every shape here is given in head space ([forward, up, right] from the head's centre, as the
 * design's skull, jaw and hair's shell are), so a piece sits on any head made to the same plan.
 */
import { scaleAt } from './armour.js';
import { GEAR_ID, type HeadPiece, type Piece, type PieceContext } from './design.js';
import { type Blob, dim, type Hit, type Mat, type Part, toneLight } from './raster.js';
import { add3, at3, clamp, cross3, dirIn, dot3, type Frame3, lerp, norm3, rad, sub3, type V3 } from './rig.js';

/** An ellipsoid in head space: the design's hair shell, which the gear sits over. */
export interface Shell {
  c: V3;
  r: V3;
}

const deg = (a: number): number => (a * 180) / Math.PI;
/** Degrees round the head from the face (0) to the back (180), either side, at a point in head space. */
const yawOf = (s: Shell, p: V3): number => Math.abs(deg(Math.atan2(p[2], p[0] - s.c[0])));
/** A point on a shell grown by `e`, at a yaw and pitch (as a lock's root is given). */
function onShell(s: Shell, e: number, yaw: number, pitch: number): V3 {
  const cp = Math.cos(rad(pitch));
  return [s.c[0] + Math.cos(rad(yaw)) * cp * (s.r[0] + e), s.c[1] + Math.sin(rad(pitch)) * (s.r[1] + e), s.c[2] + Math.sin(rad(yaw)) * cp * (s.r[2] + e)];
}
/** Does hair growing this way (head space) hang down, as a fringe does, rather than sweep up or back over the head? */
const hangs = (dir: V3): boolean => dir[1] < -0.45 * Math.hypot(dir[0], dir[1], dir[2]);
/**
 * How far gear over the hair stands toward the viewer in the head's depth test, beyond its true
 * depth: locks of hair are drawn a little proud of the hair they lie on (up to 3 pixels), so a
 * fringe coming out from under a hood's edge must not paint over the edge.
 */
const LIFT = 3.5;
/** A hero-space direction in a frame's own axes. */
const inFrame = (fr: Frame3, d: V3): V3 => [dot3(d, fr.f), dot3(d, fr.u), dot3(d, fr.r)];

// ── A hood ───────────────────────────────────────────────────────────────────────────────────

export interface HoodSpec {
  /** The cloth outside, its lining (seen inside the opening), and the band round the opening (default the cloth a shade lighter). */
  outer: Mat;
  inner: Mat;
  rim?: Mat;
  /** The hair's shell it is worn over (the design's `head.shell`), and how far clear of it the cloth stands (default 1.6). */
  shell: Shell;
  ease?: number;
  /**
   * The opening for the face, head space: its top edge (`top`, at the hairline, so the fringe
   * shows under it), its bottom (`bottom`, below the chin, where the hood closes round the
   * throat), its half-width (`side`, out past the cheeks) and how far forward it starts
   * (`front`, default 0: the front half of the head). Its top is a rounded arch.
   */
  opening: { top: number; bottom: number; side: number; front?: number };
  /** How far down it falls behind and beside the neck: the head-space height of its lower edge (default -15, about the base of the neck). */
  drape?: number;
  /** A point at its crown (where on the shell, as a lock's root: default straight back, `yaw` 180) that streams back in the wind, `size` its radius. */
  peak?: { pitch: number; size: number; yaw?: number };
  /** Creases down the cloth. */
  folds?: boolean;
  /** How readily the peak and the hood worn down stream in the wind (default 1). */
  give?: number;
  /** Up or down when a pose does not say (default up). */
  worn?: 'up' | 'down';
  /** The hood worn down, behind the neck: its size (default 1). */
  down?: { size?: number };
}

/** Shape ids of a hood: its cloth, the band round its opening, its lining. */
const HOOD = GEAR_ID;
const HOOD_RIM = GEAR_ID + 1;
const HOOD_IN = GEAR_ID + 2;

/**
 * A cloth hood with an opening for the face: worn up (`up`, a head piece) it covers the head and
 * the hair down to the shoulders, the face and fringe showing inside it, the lining in shadow
 * round them; worn down (`down`, an outfit piece) it lies bunched on the shoulders behind the
 * neck, its opening turned up. The pose's `hood` says which ('up' or 'down', default the spec's
 * `worn`): give a design both. Worn up it covers the hair but for what grows at the front (a
 * fringe, locks at the temples), so locks at the crown and the back, long hair down the back, a
 * ponytail and buns are not painted. Its peak streams back in the wind. A cowl (pieces.ts `cowl`)
 * makes a hooded cape of it.
 */
export function hood(spec: HoodSpec): { up: HeadPiece; down: Piece } {
  const s = spec.shell;
  const e = spec.ease ?? 1.6;
  const o = spec.opening;
  const fo = o.front ?? 0;
  const rim = spec.rim ?? dim(spec.outer, 0.18);
  const give = spec.give ?? 1;
  const worn = (ctx: PieceContext): 'up' | 'down' => ctx.pose.hood ?? spec.worn ?? 'up';
  // The arch over the face: its centre and its height.
  const archH = Math.min(o.side * 0.75, Math.max(1, o.top - o.bottom));
  const archC = o.top - archH;
  /** Where a point (head space) lies against the opening: below 1 inside it, a little over on the band round it, Infinity well away. */
  const opening = (p: V3): number => {
    if (p[0] < fo) return Infinity;
    if (p[1] < o.bottom) return p[1] > o.bottom - 1.2 && Math.abs(p[2]) < o.side ? 1.01 : Infinity;
    if (p[1] > archC) return Math.hypot(p[2] / o.side, (p[1] - archC) / archH);
    return Math.abs(p[2]) / o.side;
  };
  const rimK = 1 + 1.25 / o.side;
  const drape = spec.drape ?? -15;
  const up: HeadPiece = {
    blobs: (ctx, head) => {
      if (worn(ctx) !== 'up') return [];
      const { pose } = ctx;
      const blobs: Blob[] = [
        { c: s.c, r: [s.r[0] + e, s.r[1] + e, s.r[2] + e], id: HOOD },
        // Down behind and beside the neck to the shoulders.
        { c: [s.c[0] - 0.8, (s.c[1] + drape) / 2, 0], r: [s.r[0] + e - 1.4, (s.c[1] - drape) / 2, s.r[2] + e - 1.2], id: HOOD },
      ];
      if (spec.peak) {
        const pk = spec.peak;
        const wind = Math.max(0, pose.wind ?? 0) * give;
        const push = inFrame(head, [-wind * 2.6, ((pose.lift ?? 0) * 1.4 + wind * 0.6) * give, (pose.sway ?? 0) * 1.4 * give]);
        const at = add3(onShell(s, e - pk.size * 0.1, pk.yaw ?? 180, pk.pitch), push);
        blobs.push({ c: at, r: [pk.size, pk.size * 0.85, pk.size * 0.8], id: HOOD });
      }
      const shade = (h: Hit): { m: Mat; light?: number; id?: number; lift?: number } | null => {
        const p = h.p;
        const k = opening(p);
        if (k < 1) return null;
        if (h.back) return { m: spec.inner, light: toneLight(spec.inner, p[1] > archC ? 3 : 2), id: HOOD_IN };
        if (k < rimK) return { m: rim, id: HOOD_RIM, lift: LIFT };
        if (spec.folds && p[1] < s.c[1] - 3) {
          // Creases falling from the crown down the drape, a lit fold beside each.
          const a = deg(Math.atan2(p[2], -(p[0] - s.c[0]))) + 180;
          const f = ((a / 32) % 1 + 1) % 1;
          const l = ctx.cam.light(dirIn(head, h.n[0], h.n[1], h.n[2]));
          if (f < 0.13) return { m: spec.outer, light: l - 0.45, lift: LIFT };
          if (f < 0.32) return { m: spec.outer, light: l + 0.2, lift: LIFT };
        }
        return { m: spec.outer, lift: LIFT };
      };
      return [{ frame: head, blobs, shade }];
    },
    // Only hair at the front growing down (a fringe, locks at the temples) comes out of it.
    covers: (ctx) => (worn(ctx) === 'up' ? (p: V3, dir: V3) => !(p[0] > fo && Math.abs(p[2]) < o.side + 1 && hangs(dir)) : null),
  };
  const down: Piece = (ctx) => {
    if (worn(ctx) !== 'down') return [];
    const { rig, pose } = ctx;
    const cf = rig.chest;
    const T = ctx.build.torso;
    const k = spec.down?.size ?? 1;
    const wind = Math.max(0, pose.wind ?? 0) * give;
    const lift = (pose.lift ?? 0) * give;
    // The roll of cloth round the back of the neck, and the hood lying on the upper back below it,
    // its point lifting and streaming back a little in the wind.
    const bodyC: V3 = [-5.2 * k - wind * 1.2, T - 4.6 * k + lift * 1.5 + wind * 0.6, 0];
    const body: Blob = { c: bodyC, r: [2.5 * k, 5.6 * k, 5.4 * k], id: HOOD };
    const roll: Blob = { c: [-3.4 * k, T + 0.6 * k, 0], r: [3.4 * k, 2.4 * k, 6.4 * k], id: HOOD_RIM };
    const shade = (h: Hit): { m: Mat; light?: number; id?: number; lift?: number } | null => {
      const p = h.p;
      if (h.blob === body) {
        // It narrows to a point at the bottom.
        const below = (bodyC[1] - p[1]) / body.r[1];
        if (below > 0 && Math.abs(p[2]) / body.r[2] > 1.05 - below) return null;
        if (h.back) return null;
        return { m: spec.outer };
      }
      if (h.back) return null;
      // The opening, turned up: the lining in shadow along the roll's top.
      if (h.n[1] > 0.55 && p[0] < -2) return { m: spec.inner, light: toneLight(spec.inner, 3), id: HOOD_IN };
      return { m: rim };
    };
    // It lies over the back and over a cape or cowl there: sorted by its outer side.
    const mid = at3(cf, bodyC[0] - body.r[0], T - 3, 0);
    return [
      {
        z: ctx.upperZ(ctx.depth(mid)),
        draw: () => {
          const part = ctx.part();
          part.blobs(cf, [roll, body], shade);
          part.commit();
        },
      },
    ];
  };
  return { up, down };
}

// ── A helm ───────────────────────────────────────────────────────────────────────────────────

/**
 * A fin, crest or small wing rising from a helm: a flat plate whose outline is given in its own
 * plane, as points [along, up] from its root: `along` the way it sweeps (`dir`, head space: back
 * and up for fins swept back behind the temples), `up` the way it rises out of the helm (`rise`,
 * head space, default straight up; lean it out to the side so it shows its face seen from the
 * front). Rooted on the helm at a yaw and pitch (as a lock's root), painted in its material (default
 * the helm's metal) with a rim of `edge` (default the helm's trim) all round.
 */
export interface Fin {
  yaw: number;
  pitch: number;
  dir: V3;
  rise?: V3;
  shape: readonly (readonly [number, number])[];
  mat?: Mat;
  edge?: Mat;
}

export interface HelmSpec {
  /** The metal, and the paler metal of its edges (default the metal a shade lighter). */
  metal: Mat;
  trim?: Mat;
  /** The hair's shell it sits over (the design's `head.shell`), and how far clear (default 1.2). */
  shell: Shell;
  ease?: number;
  /**
   * Its lower edge, head-space heights: at the front (the brow band, above the eyes), at the
   * sides (above the ears) and at the back (a half-helm stops above the nape, so the hair and a
   * ponytail show below it). `band` is how deep the trim along that edge is (default 1.2).
   */
  edge: { front: number; side: number; back: number };
  band?: number;
  /** Cheek guards hanging from its sides past the cheekbones: down to `down` (head-space height), centred `forward` along the side of the face, `w` long front to back (default 3.4). */
  cheeks?: { down: number; forward: number; w?: number };
  /** A raised ridge along its top from the brow to the back, in this material. */
  ridge?: Mat;
  /** A pattern of overlapping scales (armour.ts `scaleAt`): their size, and the materials of their rims and of the gaps under them (default the trim and the metal two shades darker). */
  scales?: { w: number; h: number; rim?: Mat; under?: Mat };
  /** Fins or wings rising from it. */
  fins?: readonly Fin[];
  /** Hair within this many degrees of the face grows out from under it and is still painted (a fringe under the brow band; default 70). Hair above its edge further round is covered. */
  front?: number;
}

const HELM = GEAR_ID + 20;
const HELM_TRIM = GEAR_ID + 21;
const HELM_CHEEK = GEAR_ID + 22;
const FIN0 = GEAR_ID + 30;

/**
 * An open-faced helm or half-helm: a cap of metal over the hair down to its edge (a brow band
 * above the eyes, above the ears, above the nape), trimmed along that edge, with cheek guards,
 * a ridge, a scale pattern and fins if given. Hair under it but for a fringe at the front is not
 * painted; hair below its edge (at the nape, a ponytail tied low) shows.
 */
export function helm(spec: HelmSpec): HeadPiece {
  const s = spec.shell;
  const e = spec.ease ?? 1.2;
  const trim = spec.trim ?? dim(spec.metal, 0.2);
  const band = spec.band ?? 1.2;
  const sc = spec.scales;
  const scRim = sc?.rim ?? trim;
  const scUnder = sc?.under ?? dim(spec.metal, -0.45);
  const R = (s.r[0] + s.r[1] + s.r[2]) / 3 + e;
  const edgeAt = (yaw: number): number => {
    const k = yaw / 90;
    const t = k < 1 ? k : k - 1;
    const sm = t * t * (3 - 2 * t);
    return k < 1 ? lerp(spec.edge.front, spec.edge.side, sm) : lerp(spec.edge.side, spec.edge.back, sm);
  };
  /** The scales' part at a point of the cap: across it round the head, down it from the crown. */
  const scaleMat = (p: V3, m: Mat): Mat => {
    if (!sc) return m;
    const q = norm3([(p[0] - s.c[0]) / (s.r[0] + e), (p[1] - s.c[1]) / (s.r[1] + e), (p[2] - s.c[2]) / (s.r[2] + e)]);
    const lat = Math.asin(clamp(q[1], -1, 1));
    const part = scaleAt(Math.atan2(q[2], q[0]) * R * Math.cos(lat) + 64, (Math.PI / 2 - lat) * R, sc.w, sc.h);
    return part === 'face' ? m : part === 'rim' ? scRim : scUnder;
  };
  const piece: HeadPiece = {
    blobs: (_ctx, head) => {
      const cap: Blob = { c: s.c, r: [s.r[0] + e, s.r[1] + e, s.r[2] + e], id: HELM };
      const blobs: Blob[] = [cap];
      const ch = spec.cheeks;
      if (ch) {
        const top = spec.edge.side + band;
        const hh = (top - ch.down) / 2 + 0.6;
        for (const side of [1, -1]) blobs.push({ c: [ch.forward, (top + ch.down) / 2, side * (s.r[2] * 0.86 + e * 0.5)], r: [ch.w ?? 3.4, hh, 1.5], id: HELM_CHEEK });
      }
      const shade = (h: Hit): { m: Mat; light?: number; id?: number; lift?: number } | null => {
        if (h.back) return null;
        const p = h.p;
        if (h.blob.id === HELM_CHEEK) {
          const b = h.blob;
          // Its lower and front edges are trimmed.
          const du = (p[1] - b.c[1]) / b.r[1];
          const df = (p[0] - b.c[0]) / b.r[0];
          if (du < -0.62 || df > 0.66) return { m: trim, id: HELM_CHEEK, lift: LIFT };
          return { m: scaleMat(p, spec.metal), id: HELM_CHEEK, lift: LIFT };
        }
        const yaw = yawOf(s, p);
        const edge = edgeAt(yaw);
        if (p[1] < edge) return null;
        if (p[1] < edge + band) return { m: trim, id: HELM_TRIM, lift: LIFT };
        if (spec.ridge && Math.abs(p[2] - s.c[2]) < 1 && p[1] > s.c[1] - 2) return { m: spec.ridge, light: 0.7, lift: LIFT };
        return { m: scaleMat(p, spec.metal), lift: LIFT };
      };
      return [{ frame: head, blobs, shade }];
    },
    covers: () => {
      const front = spec.front ?? 70;
      return (p: V3, dir: V3) => {
        const yaw = yawOf(s, p);
        return p[1] > edgeAt(yaw) + 0.5 && (yaw > front || !hangs(dir));
      };
    },
  };
  if (spec.fins?.length) {
    piece.paint = (ctx, part, head) => spec.fins?.forEach((fin, i) => paintFin(ctx, part, head, s, e, fin, fin.mat ?? spec.metal, fin.edge ?? trim, FIN0 + i));
  }
  return piece;
}

/** Paints a fin as a flat plate with its true depth, then rims its outline. */
function paintFin(ctx: PieceContext, part: Part, head: Frame3, s: Shell, e: number, fin: Fin, m: Mat, edge: Mat, id: number): void {
  const root = onShell(s, e - 0.6, fin.yaw, fin.pitch);
  const a = norm3(fin.dir);
  const r0 = fin.rise ?? [0, 1, 0];
  let b = sub3(r0, [a[0] * dot3(r0, a), a[1] * dot3(r0, a), a[2] * dot3(r0, a)]);
  if (Math.hypot(b[0], b[1], b[2]) < 0.1) b = cross3(a, [0, 0, 1]);
  b = norm3(b);
  const pts = fin.shape.map(([u, v]) => {
    const p = add3(add3(root, a, u), b, v);
    return at3(head, p[0], p[1], p[2]);
  });
  part.facet(pts, m, 0.1, id, undefined, LIFT);
  // The rim, a pixel wide all round (so a fin seen edge on still shows as a line).
  const P = pts.map((p) => ctx.proj(p));
  const Z = pts.map((p) => ctx.depth(p) + LIFT + 0.3);
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    part.line(P[i] as [number, number], P[j] as [number, number], edge, 0.55, ((Z[i] as number) + (Z[j] as number)) / 2, id);
  }
}

// ── A circlet ────────────────────────────────────────────────────────────────────────────────

export interface CircletSpec {
  /** The band's metal, and the hair's shell it lies on (the design's `head.shell`), how far clear (default 0.5). */
  mat: Mat;
  shell: Shell;
  ease?: number;
  /** Its head-space height at the front (across the brow) and at the back (higher, as a band worn round the head sits), and its depth (default 1.4). */
  front: number;
  back: number;
  w?: number;
  /** A gem set in it at the front. */
  gem?: { mat: Mat; r: number };
}

const CIRCLET = GEAR_ID + 10;
const GEM = GEAR_ID + 11;

/** A circlet or headband: a band round the head over the hair, tilted (lower at the front), with a gem at the front if given. */
export function circlet(spec: CircletSpec): HeadPiece {
  const s = spec.shell;
  const e = spec.ease ?? 0.5;
  const w = spec.w ?? 1.4;
  const at = (yaw: number): number => lerp(spec.front, spec.back, (1 - Math.cos(rad(yaw))) / 2);
  return {
    blobs: (ctx, head) => {
      const list: { frame: Frame3; blobs: readonly Blob[]; shade: (h: Hit) => { m: Mat; light?: number; id?: number; lift?: number } | null }[] = [
        {
          frame: head,
          blobs: [{ c: s.c, r: [s.r[0] + e, s.r[1] + e, s.r[2] + e], id: CIRCLET }],
          shade: (h) => {
            if (h.back) return null;
            const hh = at(yawOf(s, h.p));
            const d = h.p[1] - hh;
            if (Math.abs(d) > w / 2) return null;
            // A bright upper edge.
            const l = ctx.cam.light(dirIn(head, h.n[0], h.n[1], h.n[2]));
            return { m: spec.mat, light: l + (d > w * 0.15 ? 0.35 : 0), lift: LIFT };
          },
        },
      ];
      if (spec.gem) {
        const g = spec.gem;
        const u = spec.front;
        const ku = clamp((u - s.c[1]) / (s.r[1] + e), -1, 1);
        const f = s.c[0] + (s.r[0] + e) * Math.sqrt(1 - ku * ku);
        list.push({ frame: head, blobs: [{ c: [f + g.r * 0.2, u, 0], r: [g.r * 0.6, g.r, g.r * 0.85], id: GEM }], shade: (h) => (h.back ? null : { m: g.mat, lift: LIFT }) });
      }
      return list;
    },
  };
}
