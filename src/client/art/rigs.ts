/**
 * Per-monster rig settings for the frame animator, and each clan's skill glow. (Heroes are chibis,
 * painted frame by frame: see heroes/chibi/.) Sprites not listed here are rigged automatically:
 * a figure with a gap between its legs walks on two legs, anything else sways like a robe.
 */
import { rgbOf, type RigHint } from './animation.js';

export const RIG_HINTS: Record<string, RigHint> = {
  // Orcs.
  'orc-brute': { kind: 'biped', hip: 0.62 },
  'orc-skirmisher': { kind: 'biped', hip: 0.6 },
  'orc-archer': { kind: 'biped', hip: 0.62 },
  'orc-caster': { kind: 'biped', hip: 0.62 },
  'orc-elite': { kind: 'biped', hip: 0.62 },
  'orc-sentry': { kind: 'object' },
  'orc-boss-juggernaut': { kind: 'biped', hip: 0.64 },
  'orc-boss-hexer': { kind: 'robed', hip: 0.6 },
  'orc-boss-beast': { kind: 'quadruped', hip: 0.6 },
  'orc-boss-warden': { kind: 'biped', hip: 0.64 },
  'orc-boss-sovereign': { kind: 'biped', hip: 0.66 },
  // Dragons and their cult.
  'dragon-brute': { kind: 'biped', hip: 0.62 },
  'dragon-skirmisher': { kind: 'quadruped', hip: 0.62 },
  'dragon-archer': { kind: 'biped', hip: 0.62 },
  'dragon-caster': { kind: 'robed', hip: 0.58 },
  'dragon-elite': { kind: 'quadruped', hip: 0.62 },
  'dragon-sentry': { kind: 'object' },
  'dragon-boss-juggernaut': { kind: 'biped', hip: 0.64 },
  'dragon-boss-hexer': { kind: 'robed', hip: 0.58 },
  'dragon-boss-beast': { kind: 'biped', hip: 0.66, legs: 0.16 },
  'dragon-boss-warden': { kind: 'biped', hip: 0.64, legs: 0.24 },
  'dragon-boss-sovereign': { kind: 'biped', hip: 0.68, legs: 0.16 },
  // The undead.
  'undead-brute': { kind: 'biped', hip: 0.58 },
  'undead-skirmisher': { kind: 'biped', hip: 0.58 },
  'undead-archer': { kind: 'biped', hip: 0.62 },
  'undead-caster': { kind: 'floater', hip: 0.55 },
  'undead-elite': { kind: 'biped', hip: 0.64, legs: 0.24 },
  'undead-sentry': { kind: 'object' },
  'undead-boss-juggernaut': { kind: 'biped', hip: 0.62 },
  'undead-boss-hexer': { kind: 'robed', hip: 0.58 },
  'undead-boss-beast': { kind: 'quadruped', hip: 0.58 },
  'undead-boss-warden': { kind: 'floater', hip: 0.5 },
  'undead-boss-sovereign': { kind: 'floater', hip: 0.55 },
};

const AURA: Record<string, string> = {
  orc: '#ff7a3d',
  dragon: '#ffb347',
  undead: '#5dffb0',
};

/** The colour a monster or boss glows when it uses a skill: its clan's (the first part of its id). */
export function auraFor(id: string): [number, number, number] {
  return rgbOf(AURA[id.split('-')[0] as string] ?? '#ffffff');
}
