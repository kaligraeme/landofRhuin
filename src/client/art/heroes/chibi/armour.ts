/**
 * Patterns for armour: overlapping scales, for dragon-styled or scale armour. A pattern says,
 * for a point on a surface given as two coordinates in pixels (across it, and down it), which
 * part of the pattern it falls on; a design's `torso` function, a pauldron (pieces.ts `plates`
 * with `scales`) or a helm (headgear.ts `helm` with `scales`) then picks a material for each part.
 */

/** Which part of a scale a point falls on: its face, the pale rim along its lower edge, or the shadowed gap under it (the top of the scales below peeking out). */
export type ScalePart = 'face' | 'rim' | 'under';

/**
 * Overlapping scales hanging point down, in rows `h` pixels apart, each `w` wide, every other row
 * offset by half a scale, like roof tiles or a dragon's scales: each scale's lower edge is a
 * rounded point (a U), with a rim `rim` pixels deep (default 1) along it, and below the U, between
 * two scales, the shadowed top of the row below. `x` runs across the surface and `y` down it, in
 * pixels (for a body, `x` the distance round it and `y` the height down it).
 */
export function scaleAt(x: number, y: number, w: number, h: number, rim = 1): ScalePart {
  const row = Math.floor(y / h);
  const fy = y / h - row;
  const xs = x / w + (row & 1 ? 0.5 : 0);
  const lx = xs - Math.floor(xs) - 0.5;
  // The U of the scale's lower edge: deepest at its middle, rising toward its sides.
  const edge = 0.34 + 0.62 * Math.sqrt(Math.max(0, 1 - 4 * lx * lx));
  // Below it (and in the seam between two scales of a row) lies the shadowed row below.
  if (fy > edge || Math.abs(lx) > 0.5 - 0.5 / w) return 'under';
  if (fy > edge - rim / h) return 'rim';
  return 'face';
}
