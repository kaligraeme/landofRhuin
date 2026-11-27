/**
 * The forms a hero can take, such as the Flame Warden's Firebeast: each is a chibi of its own
 * (registered in CHIBI_HEROES under its sprite id), drawn in the hero's place while the form's
 * status lasts.
 */
import { FORMS, SKILLS, WEAPONS, weaponFor, type HeroId } from '../../shared/content/classes.js';
import { STATUSES } from '../../shared/content/statuses.js';
import { CHIBI_HEROES, type ChibiHero } from './heroes/chibi/index.js';

/** The sprite id of each form's chibi (FORMS in classes.ts), by the form's status id. */
export const FORM_ART: Readonly<Record<string, string>> = { firebeast: 'hero-firebeast' };

/** A form's chibi hero, or null if it has none (the hero then keeps their own look). */
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
