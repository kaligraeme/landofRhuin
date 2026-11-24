/**
 * A tiny SVG drawing kit for character sprites: outlined, cel-shaded shapes on a shared
 * humanoid rig. Sprites face right in a three-quarter view; the renderer mirrors them.
 */

export const OL = '#1a120d';
export const OLW = 2.6;

let uid = 0;
export const nextId = (): string => `s${++uid}`;

export function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const f = (v: string): number => {
    const n = parseInt(v, 16);
    return Math.round(Math.min(255, Math.max(0, k >= 0 ? n + (255 - n) * k : n * (1 + k))));
  };
  return `rgb(${f(m[1] as string)},${f(m[2] as string)},${f(m[3] as string)})`;
}

/**
 * A filled shape with an outline, a shadow on its right side (light comes from the upper
 * left) and a soft highlight. `shadeX` is where the shadow starts.
 */
export function part(d: string, color: string, opts: { shadeX?: number; shadeY?: number; hi?: boolean; stroke?: boolean; opacity?: number } = {}): string {
  const id = nextId();
  const shadeX = opts.shadeX ?? 999;
  const shadow = shadeX < 999 ? `<rect x="${shadeX}" y="-200" width="400" height="600" fill="rgba(0,0,0,0.26)" clip-path="url(#${id})"/>` : '';
  const shadowY = opts.shadeY !== undefined ? `<rect x="-200" y="${opts.shadeY}" width="600" height="400" fill="rgba(0,0,0,0.22)" clip-path="url(#${id})"/>` : '';
  const hi = opts.hi === false ? '' : `<path d="${d}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2" clip-path="url(#${id})" transform="translate(1.6,1.6)"/>`;
  const outline = opts.stroke === false ? '' : `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${OLW}" stroke-linejoin="round"/>`;
  return `<g${opts.opacity !== undefined ? ` opacity="${opts.opacity}"` : ''}><clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${color}"/>${shadow}${shadowY}${hi}${outline}</g>`;
}

/** A thick rounded stroke (limbs, handles) with an outline. */
export function limb(d: string, color: string, width: number, cap: 'round' | 'butt' = 'round'): string {
  return `<path d="${d}" fill="none" stroke="${OL}" stroke-width="${width + OLW * 1.6}" stroke-linecap="${cap}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="${width * 0.35}" stroke-linecap="${cap}" transform="translate(${width * 0.28},0)"/>`;
}

export function ell(cx: number, cy: number, rx: number, ry: number, color: string, opts: { shade?: boolean; stroke?: boolean } = {}): string {
  const d = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
  return part(d, color, { shadeX: opts.shade === false ? 999 : cx + rx * 0.25, stroke: opts.stroke });
}

export function circ(cx: number, cy: number, r: number, color: string, opts: { shade?: boolean; stroke?: boolean } = {}): string {
  return ell(cx, cy, r, r, color, opts);
}

/** A plain shape without shading (details, trims, eyes). */
export function flat(d: string, color: string, stroke = true, sw = 1.8): string {
  return `<path d="${d}" fill="${color}" ${stroke ? `stroke="${OL}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
}

export function line(d: string, color: string, width: number, opacity = 1): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

/** A soft radial glow (eyes, crystals, flames). */
export function glow(cx: number, cy: number, r: number, color: string): string {
  const id = nextId();
  return `<radialGradient id="${id}"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="${color}" stop-opacity="0.85"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
}

export interface SpriteDef {
  svg: string;
  /** viewBox origin, width and height. */
  vx: number;
  vy: number;
  w: number;
  h: number;
  /** Where the feet are, in viewBox units. */
  ax: number;
  ay: number;
  /** Height on screen, in tiles. */
  height: number;
  /** Hand holding the weapon (heroes), in viewBox units. */
  hand?: { x: number; y: number };
  /** Hovering creatures bob more and cast no foot shadow. */
  floats?: boolean;
  /** Pixel art: drawn with nearest-neighbour scaling so pixels stay crisp. */
  pixel?: boolean;
}

export function svgDoc(body: string, x: number, y: number, w: number, h: number, scale = 3): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * scale}" height="${h * scale}">${body}</svg>`;
}

// ── The humanoid rig ───────────────────────────────────────────────────────────────────────

export type Build = 'heavy' | 'normal' | 'lean';

export interface Rig {
  hx: number;
  hy: number;
  hr: number;
  /** Half widths at the shoulders and the waist. */
  sw: number;
  ww: number;
  sy: number;
  wy: number;
  fy: number;
  lw: number;
  hip: number;
  handB: { x: number; y: number };
  handF: { x: number; y: number };
}

export const RIGS: Record<Build, Rig> = {
  heavy: { hx: 51, hy: 31, hr: 14, sw: 22, ww: 18, sy: 51, wy: 86, fy: 112, lw: 11, hip: 9, handB: { x: 26, y: 84 }, handF: { x: 77, y: 81 } },
  normal: { hx: 52, hy: 32, hr: 15, sw: 16, ww: 13.5, sy: 52, wy: 84, fy: 112, lw: 8.5, hip: 8, handB: { x: 31, y: 82 }, handF: { x: 72, y: 80 } },
  lean: { hx: 52, hy: 31, hr: 14.5, sw: 14.5, ww: 10.5, sy: 51, wy: 83, fy: 112, lw: 7.5, hip: 7, handB: { x: 33, y: 80 }, handF: { x: 71, y: 78 } },
};

export function torsoPath(r: Rig, flare = 0): string {
  const cx = 50;
  return `M ${cx - r.sw} ${r.sy + 2} Q ${cx} ${r.sy - 5} ${cx + r.sw} ${r.sy + 2} L ${cx + r.ww + flare} ${r.wy} Q ${cx} ${r.wy + 4} ${cx - r.ww - flare} ${r.wy} Z`;
}

export function legs(r: Rig, pants: string, boots: string, opts: { bootH?: number; kneeGuard?: string } = {}): string {
  const lx = 50 - r.hip;
  const rx = 50 + r.hip;
  const top = r.wy - 3;
  const foot = r.fy - 5;
  let s = limb(`M ${lx} ${top} L ${lx - 1} ${foot}`, pants, r.lw) + limb(`M ${rx} ${top} L ${rx + 1.5} ${foot}`, pants, r.lw);
  const bh = opts.bootH ?? 9;
  // Boots: a shin piece and a foot pointing right.
  s += part(`M ${lx - r.lw / 2 - 1} ${foot - bh} L ${lx + r.lw / 2} ${foot - bh} L ${lx + r.lw / 2 + 1} ${r.fy - 2} Q ${lx + r.lw / 2 + 6} ${r.fy - 1} ${lx + r.lw / 2 + 5} ${r.fy + 2} L ${lx - r.lw / 2 - 2} ${r.fy + 2} Z`, boots, { shadeX: lx + 2 });
  s += part(`M ${rx - r.lw / 2} ${foot - bh} L ${rx + r.lw / 2 + 1} ${foot - bh} L ${rx + r.lw / 2 + 2} ${r.fy - 2} Q ${rx + r.lw / 2 + 8} ${r.fy - 1} ${rx + r.lw / 2 + 7} ${r.fy + 2.5} L ${rx - r.lw / 2 - 1} ${r.fy + 2.5} Z`, boots, { shadeX: rx + 3 });
  if (opts.kneeGuard) {
    s += circ(lx - 0.5, foot - bh - 2, r.lw * 0.45, opts.kneeGuard) + circ(rx + 1, foot - bh - 2, r.lw * 0.5, opts.kneeGuard);
  }
  return s;
}

/** An arm from the shoulder to the hand, bent at the elbow, with a hand at the end. */
export function arm(r: Rig, side: 'back' | 'front', sleeve: string, hand: string, opts: { width?: number; cuff?: string; handR?: number } = {}): string {
  const sx = side === 'back' ? 50 - r.sw + 3 : 50 + r.sw - 3;
  const sy = r.sy + 4;
  const h = side === 'back' ? r.handB : r.handF;
  const ex = side === 'back' ? sx - 5 : sx + 6;
  const ey = (sy + h.y) / 2;
  const w = opts.width ?? r.lw - 0.5;
  let s = limb(`M ${sx} ${sy} Q ${ex} ${ey} ${h.x} ${h.y - 4}`, sleeve, w);
  if (opts.cuff) s += limb(`M ${(ex + h.x) / 2} ${(ey + h.y) / 2} L ${h.x} ${h.y - 4}`, opts.cuff, w + 1);
  s += circ(h.x, h.y - 1, opts.handR ?? w * 0.62, hand);
  return s;
}

/** Simple eyes for a face turned three-quarters to the right. */
export function eyes(cx: number, cy: number, opts: { color?: string; glow?: string; size?: number; angry?: boolean; gap?: number } = {}): string {
  const s = opts.size ?? 2.4;
  const gap = opts.gap ?? 8;
  const a = cx - gap / 2 + 2;
  const b = cx + gap / 2 + 3;
  if (opts.glow) return glow(a, cy, s * 2.6, opts.glow) + glow(b, cy, s * 2.6, opts.glow) + `<ellipse cx="${a}" cy="${cy}" rx="${s * 0.7}" ry="${s * 0.55}" fill="#fff"/><ellipse cx="${b}" cy="${cy}" rx="${s * 0.7}" ry="${s * 0.55}" fill="#fff"/>`;
  const col = opts.color ?? '#1d1410';
  let out = `<ellipse cx="${a}" cy="${cy}" rx="${s * 0.75}" ry="${s}" fill="${col}"/><ellipse cx="${b}" cy="${cy}" rx="${s * 0.8}" ry="${s * 1.05}" fill="${col}"/>`;
  out += `<circle cx="${a + 0.6}" cy="${cy - 0.8}" r="${s * 0.3}" fill="#fff"/><circle cx="${b + 0.6}" cy="${cy - 0.8}" r="${s * 0.3}" fill="#fff"/>`;
  if (opts.angry) out += line(`M ${a - 3} ${cy - s - 3} L ${a + 2} ${cy - s - 1}`, OL, 1.8) + line(`M ${b + 3.5} ${cy - s - 3} L ${b - 1.5} ${cy - s - 1}`, OL, 1.8);
  return out;
}

export function head(r: Rig, skin: string, extra = ''): string {
  return circ(r.hx, r.hy, r.hr, skin) + extra;
}
