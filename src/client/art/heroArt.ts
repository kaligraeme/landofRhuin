/**
 * Hero artwork ids: `hero-` and the hero's name in kebab case, such as `hero-dark-knight`. The
 * artwork files in creatures/, their metrics, the older painter's designs (heroes/designs.ts) and
 * the chibi heroes (heroes/chibi/index.ts) are all keyed by them.
 */
import { HERO_ORDER, type HeroId } from '../../shared/content/classes.js';

/** A camel-case id in kebab case: `darkKnight` becomes `dark-knight`. */
type Kebab<S extends string> = S extends `${infer C}${infer Rest}` ? `${C extends Lowercase<C> ? C : `-${Lowercase<C>}`}${Kebab<Rest>}` : S;

export type HeroArtId = `hero-${Kebab<HeroId>}`;

/** A hero's artwork id. */
export function heroArtId(hero: HeroId): HeroArtId {
  return `hero-${hero.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}` as HeroArtId;
}

/** The hero an artwork id belongs to, or undefined for a monster's. */
export function heroOfArt(id: string): HeroId | undefined {
  return HERO_ORDER.find((hero) => heroArtId(hero) === id);
}
