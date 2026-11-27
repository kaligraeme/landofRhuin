/**
 * Which artwork a hero is drawn with, and the forms they take. A hero painted only as a chibi
 * (heroArt.ts: CHIBI_ONLY) is drawn as a stand-in until their chibi is registered in
 * CHIBI_HEROES; a form (the Firebeast) is drawn with its own chibi once that is registered, and
 * until then the hero keeps their own look.
 */
import { FORMS, SKILLS, WEAPONS, weaponFor, type HeroId } from '../../shared/content/classes.js';
import { STATUSES } from '../../shared/content/statuses.js';
import { heroArtId, isPainted } from './heroArt.js';
import { CHIBI_HEROES, type ChibiHero } from './heroes/chibi/index.js';

/** Who stands in for a chibi-only hero whose chibi is not painted yet: a hero with a blade. */
const STAND_INS: Partial<Record<HeroId, HeroId>> = { flameWarden: 'spellblade' };

/** The sprite id of each form's chibi (FORMS in classes.ts), by the form's status id. */
export const FORM_ART: Readonly<Record<string, string>> = { firebeast: 'hero-firebeast' };

/**
 * The artwork a hero is drawn with: their own when it is painted (a registered chibi, or artwork
 * in creatures/ for the older painter), otherwise their stand-in's, or failing that the first
 * registered chibi hero.
 */
export function heroLook(hero: HeroId): string {
  const own = heroArtId(hero);
  if (CHIBI_HEROES[own] || isPainted(hero)) return own;
  const stand = STAND_INS[hero];
  if (stand && stand !== hero && (CHIBI_HEROES[heroArtId(stand)] || isPainted(stand))) return heroArtId(stand);
  return Object.keys(CHIBI_HEROES)[0] ?? heroArtId(stand ?? 'spellblade');
}

/** Whether a hero is drawn as someone else for now. */
export function standingIn(hero: HeroId): boolean {
  return heroLook(hero) !== heroArtId(hero);
}

/** A form's chibi hero, or null until it is painted (the hero then keeps their own look). */
export function formHero(form: string): ChibiHero | null {
  const id = FORM_ART[form];
  return (id && CHIBI_HEROES[id]) || null;
}

/** The forms a hero can take: those their weapon's skills put them in. */
export function heroForms(hero: HeroId): string[] {
  const skills = WEAPONS[weaponFor(hero)]?.skills ?? [];
  const forms = skills.flatMap((id) => (SKILLS[id]?.effects ?? []).flatMap((e) => (e.kind === 'status' && STATUSES[e.status]?.form && FORMS[e.status] ? [e.status] : [])));
  return [...new Set(forms)];
}
