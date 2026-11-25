/**
 * Heads seen from the front and from behind. Side on, a hero's face is cut from their artwork;
 * turned toward or away from the viewer it is painted here, pixel by pixel, from the hero's skin
 * and hairdo, so every hero keeps their hair colour, cut and beard all the way round.
 *
 * A head is laid out on a small grid: the face spans columns 1 to 11 (centre 6) and rows 1 to 15,
 * with the chin's bottom row (15) sitting on the neck. Long hair runs on below the chin.
 */
import type { Canvas, Ramp, RGB } from './paint.js';

export type HairStyle = 'short' | 'messy' | 'medium' | 'long' | 'ponytail' | 'bun';

export interface Hairdo {
  style: HairStyle;
  ramp: Ramp;
  /** A full beard and moustache, or a short beard along the jaw. */
  beard?: 'full' | 'short';
  beardRamp?: Ramp;
  /** Pointed ears. */
  elf?: boolean;
  /** How far long hair or a ponytail falls below the chin, in pixels. */
  length?: number;
}

/** Grid columns run from -3 to 15; rows from -3 down. */
const COL0 = -3;
const COLS = 19;
const ROW0 = -3;
const ROWS = 44;
/** The grid point that sits on top of the neck. */
export const CHIN: readonly [number, number] = [6, 15];

type Cell = 'H' | 'h' | 'd' | 'S' | 's' | 'k' | 'e' | 'm' | 'B' | 'b' | 'D';
type Span = [number, number, number];

class Grid {
  readonly cells: (Cell | null)[] = new Array(COLS * ROWS).fill(null);
  set(x: number, y: number, c: Cell): void {
    const gx = Math.round(x) - COL0;
    const gy = Math.round(y) - ROW0;
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return;
    this.cells[gy * COLS + gx] = c;
  }
  get(x: number, y: number): Cell | null {
    const gx = x - COL0;
    const gy = y - ROW0;
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return null;
    return this.cells[gy * COLS + gx] ?? null;
  }
  span(y: number, x0: number, x1: number, c: Cell): void {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  /** Fills spans with a hair (or beard) ramp: lit on the upper left, shadowed on the right. */
  mass(spans: readonly Span[], light: Cell, base: Cell, dark: Cell): void {
    const top = Math.min(...spans.map((s) => s[0]));
    for (const [y, x0, x1] of spans) {
      for (let x = x0; x <= x1; x++) {
        let c = base;
        if (x === x1 || (x === x1 - 1 && x1 - x0 > 5 && y > top + 2)) c = dark;
        else if ((y <= top + 2 && x <= x0 + 3 && x > x0) || (x === x0 + 1 && y <= top + 6)) c = light;
        this.set(x, y, c);
      }
    }
  }
}

// ── The face ─────────────────────────────────────────────────────────────────────────────────

/** Rows of the skull and face: [row, first column, last column]. Eleven pixels across. */
const FACE: Span[] = [
  [1, 4, 8],
  [2, 3, 9],
  [3, 2, 10],
  [4, 1, 11],
  [5, 1, 11],
  [6, 1, 11],
  [7, 1, 11],
  [8, 1, 11],
  [9, 1, 11],
  [10, 1, 11],
  [11, 2, 10],
  [12, 2, 10],
  [13, 3, 9],
  [14, 4, 8],
  [15, 5, 7],
];

function ears(g: Grid, elf: boolean): void {
  g.set(0, 9, 's');
  g.set(0, 10, 'S');
  g.set(12, 9, 'k');
  g.set(12, 10, 'k');
  if (elf) {
    g.set(-1, 8, 's');
    g.set(-2, 7, 'S');
    g.set(13, 8, 'k');
    g.set(14, 7, 'k');
  }
}

function face(g: Grid, elf: boolean): void {
  for (const [y, x0, x1] of FACE) {
    g.span(y, x0, x1, 's');
    if (y >= 5 && y <= 12) g.set(x0, y, 'S');
    g.set(x1, y, 'k');
    if (y >= 11) g.set(x1 - 1, y, 'k');
  }
  ears(g, elf);
  // Brows, eyes, nose and mouth.
  g.span(8, 3, 4, 'b');
  g.span(8, 8, 9, 'b');
  g.set(4, 9, 'e');
  g.set(8, 9, 'e');
  g.set(3, 9, 'S');
  g.set(9, 9, 'S');
  g.set(6, 11, 'k');
  g.span(13, 5, 7, 'm');
}

/** The crown of the head, down to the hairline at row 7. */
const CAP: Span[] = [
  [0, 4, 8],
  [1, 3, 9],
  [2, 2, 10],
  [3, 1, 11],
  [4, 1, 11],
  [5, 0, 12],
  [6, 0, 12],
];

function frontHair(g: Grid, h: Hairdo): void {
  switch (h.style) {
    case 'short':
      g.mass([...CAP, [7, 0, 1], [7, 11, 12], [7, 4, 8], [8, 0, 0], [8, 12, 12]], 'H', 'h', 'd');
      g.set(3, 7, 'd');
      g.set(9, 7, 'd');
      break;
    case 'messy':
      g.mass([[-1, 4, 5], [-1, 8, 8], ...CAP, [7, 0, 12], [8, 0, 1], [8, 11, 12], [9, 0, 0], [9, 12, 12]], 'H', 'h', 'd');
      // Tufts falling over the forehead.
      g.set(2, 8, 'h');
      g.set(6, 8, 'd');
      g.set(10, 8, 'h');
      g.set(-1, 6, 'h');
      g.set(13, 7, 'd');
      break;
    case 'medium':
      // Swept to one side, falling past the ears to the jaw.
      g.mass([...CAP, [7, 0, 6], [7, 10, 12], [8, 0, 3], [8, 10, 12], ...[9, 10, 11, 12, 13].flatMap((y): Span[] => [[y, -1, 1], [y, 11, 13]]), [14, 0, 1], [14, 11, 12]], 'H', 'h', 'd');
      g.set(5, 8, 'd');
      g.set(-1, 11, 'd');
      g.set(13, 12, 'd');
      break;
    case 'long': {
      // Parted in the middle, falling past the shoulders on either side of the face.
      g.mass([...CAP.slice(0, 5), [5, 0, 5], [5, 7, 12], [6, 0, 3], [6, 9, 12], [7, 0, 2], [7, 10, 12]], 'H', 'h', 'd');
      const bottom = 15 + Math.round((h.length ?? 22) * 0.3);
      for (let y = 8; y <= bottom; y++) {
        const out = y > 13 ? 1 : 0;
        g.span(y, -1 - out, 1, y % 3 === 0 ? 'H' : 'h');
        g.span(y, 11, 13 + out, y % 3 === 1 ? 'd' : 'h');
      }
      g.set(-2, bottom, 'd');
      g.set(14, bottom, 'd');
      break;
    }
    case 'ponytail':
    case 'bun':
      // Pulled back tight, a little swept over the brow.
      g.mass([...CAP, [7, 0, 5], [7, 10, 12], [8, 0, 1], [8, 11, 12], [9, 0, 0], [9, 12, 12]], 'H', 'h', 'd');
      g.set(6, 7, 'd');
      if (h.style === 'ponytail') {
        // The tail swings out behind one side of the head.
        g.mass([[2, 12, 14], [3, 13, 15], [4, 13, 15], [5, 13, 15], [6, 14, 15], [7, 14, 15], [8, 14, 14]], 'h', 'h', 'd');
      }
      break;
  }
}

function beard(g: Grid, h: Hairdo): void {
  if (!h.beard) return;
  if (h.beard === 'full') {
    // Moustache over the mouth, beard from cheek to cheek and below the chin.
    g.mass([[11, 1, 2], [11, 10, 11], [12, 1, 11], [13, 1, 4], [13, 8, 11], [14, 2, 10], [15, 3, 9], [16, 4, 8], [17, 5, 7]], 'B', 'b', 'D');
    g.span(12, 4, 8, 'D');
    g.span(13, 5, 7, 'm');
  } else {
    g.mass([[12, 1, 2], [12, 10, 11], [13, 2, 4], [13, 8, 10], [14, 2, 10], [15, 4, 8]], 'B', 'b', 'D');
    g.span(12, 4, 8, 'b');
  }
}

// ── The back of the head ─────────────────────────────────────────────────────────────────────

/** The back of the skull down to the nape. */
const SKULL: Span[] = [...CAP, [7, 0, 12], [8, 1, 11], [9, 1, 11], [10, 1, 11], [11, 2, 10], [12, 2, 10], [13, 3, 9]];

function nape(g: Grid): void {
  g.span(14, 4, 8, 's');
  g.set(8, 14, 'k');
  g.span(15, 5, 7, 'k');
}

function backHead(g: Grid, h: Hairdo, wind: number): void {
  const sway = Math.round(Math.sin(wind * 3) * wind * 2);
  switch (h.style) {
    case 'short':
    case 'messy':
      g.mass([...(h.style === 'messy' ? ([[-1, 4, 5], [-1, 8, 8]] as Span[]) : []), ...SKULL], 'H', 'h', 'd');
      ears(g, !!h.elf);
      nape(g);
      if (h.style === 'messy') {
        g.set(3, 14, 'h');
        g.set(9, 14, 'd');
        g.set(6, 14, 'h');
      }
      break;
    case 'medium':
      g.mass([...SKULL.slice(0, 7), ...[7, 8, 9, 10, 11, 12, 13].map((y): Span => [y, -1, 13]), [14, 0, 12], [15, 1, 11]], 'H', 'h', 'd');
      g.set(3, 15, 'd');
      g.set(9, 15, 'd');
      break;
    case 'long': {
      // Falling down the back in a tapering sheet, with strands and a wavy end.
      const len = Math.round((h.length ?? 22) * 0.62);
      const rows: Span[] = [...SKULL.slice(0, 7), ...[7, 8, 9, 10, 11, 12, 13, 14].map((y): Span => [y, 0, 12])];
      const bottom = 15 + len;
      for (let y = 15; y <= bottom; y++) {
        const t = (y - 15) / len;
        const half = Math.round(6 - t * 1.5);
        const off = Math.round(sway * t);
        if (y >= bottom - 1) {
          // Ends in locks.
          for (const x of [-4, -1, 2, 5]) if (x + 1 <= half || y < bottom) rows.push([y, 6 + x + off - (y === bottom ? 0 : 1), 6 + x + off]);
        } else rows.push([y, 6 - half + off, 6 + half + off]);
      }
      g.mass(rows, 'H', 'h', 'd');
      for (let y = 6; y < bottom; y++) {
        const off = Math.round(sway * Math.max(0, (y - 15) / len));
        if (y % 6 < 4) g.set(3 + off, y, 'd');
        if ((y + 3) % 6 < 4) g.set(9 + off, y, 'd');
        if (y % 7 < 3 && y > 2) g.set(6 + off, y, 'H');
      }
      if (h.elf) {
        g.set(-1, 8, 's');
        g.set(-2, 7, 'S');
        g.set(13, 8, 'k');
        g.set(14, 7, 'k');
      }
      break;
    }
    case 'ponytail': {
      g.mass(SKULL, 'H', 'h', 'd');
      ears(g, false);
      nape(g);
      // Tied high, the tail falls down the back and swings.
      const len = h.length ?? 20;
      const rows: Span[] = [];
      for (let y = 3; y <= 3 + len; y++) {
        const t = (y - 3) / len;
        const half = y < 7 ? 2 : t > 0.8 ? 0 : 1;
        const off = Math.round(sway * t + Math.sin(t * 3) * 0.6);
        rows.push([y, 6 - half + off, 6 + half + off]);
      }
      g.mass(rows, 'h', 'h', 'd');
      g.span(4, 5, 7, 'd');
      g.set(6, 7, 'H');
      g.set(6 + Math.round(sway * 0.4), 12, 'H');
      break;
    }
    case 'bun':
      g.mass(SKULL, 'H', 'h', 'd');
      ears(g, false);
      nape(g);
      // A knot of hair at the back of the head.
      g.mass([[4, 5, 7], [5, 4, 8], [6, 3, 9], [7, 3, 9], [8, 4, 8], [9, 5, 7]], 'H', 'h', 'd');
      g.set(4, 6, 'd');
      g.set(8, 5, 'd');
      g.set(6, 9, 'd');
      g.set(6, 3, 'd');
      break;
  }
}

/**
 * Long hair seen from the front falls behind the shoulders; this is the part that shows around
 * the head and neck, painted before the body.
 */
function frontBackHair(g: Grid, h: Hairdo, wind: number): void {
  if (h.style !== 'long') return;
  const len = Math.round((h.length ?? 22) * 0.5);
  const fly = Math.round(wind * 3);
  const rows: Span[] = [];
  for (let y = 2; y <= 15 + len; y++) {
    const t = Math.max(0, (y - 9) / (len + 6));
    const half = 7 + Math.round(t * 2) + Math.round(fly * t);
    rows.push([y, 6 - half, 6 + half]);
  }
  g.mass(rows, 'h', 'h', 'd');
  for (let y = 11; y <= 15 + len; y += 3) {
    g.set(-2, y, 'd');
    g.set(14, y, 'd');
  }
}

// ── Painting a grid ──────────────────────────────────────────────────────────────────────────

const EYE: RGB = [34, 24, 30];

function draw(c: Canvas, g: Grid, h: Hairdo, skin: Ramp, chin: readonly [number, number]): void {
  const beardRamp = h.beardRamp ?? h.ramp;
  const mouth: RGB = [Math.round(skin[2][0] * 0.82), Math.round(skin[2][1] * 0.72), Math.round(skin[2][2] * 0.72)];
  const colour = (cell: Cell): RGB => {
    switch (cell) {
      case 'H':
        return h.ramp[0];
      case 'h':
        return h.ramp[1];
      case 'd':
        return h.ramp[2];
      case 'S':
        return skin[0];
      case 's':
        return skin[1];
      case 'k':
        return skin[2];
      case 'e':
        return EYE;
      case 'm':
        return mouth;
      case 'B':
        return beardRamp[0];
      case 'b':
        return h.beard ? beardRamp[2] : h.ramp[2];
      case 'D':
        return beardRamp[2];
    }
  };
  const ox = Math.round(chin[0]) - CHIN[0];
  const oy = Math.round(chin[1]) - CHIN[1];
  for (let y = ROW0; y < ROW0 + ROWS; y++) {
    for (let x = COL0; x < COL0 + COLS; x++) {
      const cell = g.get(x, y);
      if (cell) c.setPx(ox + x, oy + y, colour(cell));
    }
  }
}

/** Paints a head facing the viewer, its chin at `chin`. */
export function paintFrontHead(c: Canvas, h: Hairdo, skin: Ramp, chin: readonly [number, number], elf = false): void {
  const g = new Grid();
  face(g, elf || !!h.elf);
  frontHair(g, h);
  beard(g, h);
  draw(c, g, h, skin, chin);
}

/** Paints the hair that shows behind a head facing the viewer (long hair), before the body. */
export function paintFrontBackHair(c: Canvas, h: Hairdo, skin: Ramp, chin: readonly [number, number], wind: number): void {
  if (h.style !== 'long') return;
  const g = new Grid();
  frontBackHair(g, h, wind);
  draw(c, g, h, skin, chin);
}

/** Paints the back of a head, its chin (the nape) at `chin`. */
export function paintBackHead(c: Canvas, h: Hairdo, skin: Ramp, chin: readonly [number, number], wind: number): void {
  const g = new Grid();
  backHead(g, h, wind);
  draw(c, g, h, skin, chin);
}
