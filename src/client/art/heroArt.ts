/**
 * Hero artwork ids: `hero-` and the hero's name in kebab case, such as `hero-dark-knight`. The
 * artwork files in creatures/, their metrics, the older painter's designs (heroes/designs.ts) and
 * the chibi heroes (heroes/chibi/index.ts) are all keyed by them.
 */
import { HERO_ORDER, type HeroId } from '../../shared/content/classes.js';

/** A camel-case id in kebab case: `darkKnight` becomes `dark-knight`. */
type Kebab<S extends string> = S extends `${infer C}${infer Rest}` ? `${C extends Lowercase<C> ? C : `-${Lowercase<C>}`}${Kebab<Rest>}` : S;

export type HeroArtId = `hero-${Kebab<HeroId>}`;

/**
 * Heroes painted only as chibis: they have no artwork in creatures/ and no design for the older
 * painter. Until their chibi is registered (CHIBI_HEROES), another hero stands in for them (see
 * heroLook.ts).
 */
export const CHIBI_ONLY = ['flameWarden'] as const satisfies readonly HeroId[];

/** Heroes with artwork in creatures/ and a design for the older painter. */
export type PaintedHeroId = Exclude<HeroId, (typeof CHIBI_ONLY)[number]>;
export type PaintedArtId = `hero-${Kebab<PaintedHeroId>}`;

export function isPainted(hero: HeroId): hero is PaintedHeroId {
  return !(CHIBI_ONLY as readonly HeroId[]).includes(hero);
}

/** A hero's artwork id. */
export function heroArtId<H extends HeroId>(hero: H): `hero-${Kebab<H>}` {
  return `hero-${hero.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}` as `hero-${Kebab<H>}`;
}

/** The hero an artwork id belongs to, or undefined for a monster's. */
export function heroOfArt(id: string): HeroId | undefined {
  return HERO_ORDER.find((hero) => heroArtId(hero) === id);
}
