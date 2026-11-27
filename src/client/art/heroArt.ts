/**
 * Hero sprite ids: `hero-` and the hero's name in kebab case, such as `hero-dark-knight`. Every
 * hero is a chibi (heroes/chibi/), registered in CHIBI_HEROES under this id.
 */
import type { HeroId } from '../../shared/content/classes.js';

/** A camel-case id in kebab case: `darkKnight` becomes `dark-knight`. */
type Kebab<S extends string> = S extends `${infer C}${infer Rest}` ? `${C extends Lowercase<C> ? C : `-${Lowercase<C>}`}${Kebab<Rest>}` : S;

export type HeroArtId = `hero-${Kebab<HeroId>}`;

/** A hero's sprite id. */
export function heroArtId<H extends HeroId>(hero: H): `hero-${Kebab<H>}` {
  return `hero-${hero.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}` as `hero-${Kebab<H>}`;
}
