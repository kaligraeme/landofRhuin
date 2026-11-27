/**
 * The roster: each role offers its heroes (any number, the default first), each hero carries one
 * weapon of their own, and nothing offered to players frames the choice as a man or a woman.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { heroArtId, heroOfArt } from '../src/client/art/heroArt.js';
import { auraFor } from '../src/client/art/rigs.js';
import { Instance, seatHero, type Seat } from '../src/server/sim/instance.js';
import { defaultHero, HERO_ORDER, HEROES, heroFor, isHero, ROLE_ORDER, ROLES, SKILLS, WEAPONS, weaponFor, type HeroId } from '../src/shared/content/classes.js';
import { BOSSES, MOBS, THEMES } from '../src/shared/content/monsters.js';
import { STATUSES } from '../src/shared/content/statuses.js';

describe('the roster', () => {
  it('lists every hero under their own role, the default first, each with a weapon of that role', () => {
    expect(ROLE_ORDER.map((r) => ROLES[r].heroes)).toEqual([
      ['darkKnight', 'guardian'],
      ['sage', 'spellblade'],
      ['arbalest', 'bowmaster'],
      ['dragoon', 'blademaster'],
    ]);
    expect(ROLE_ORDER.map(defaultHero)).toEqual(['darkKnight', 'sage', 'arbalest', 'dragoon']);
    expect([...HERO_ORDER].sort()).toEqual(Object.keys(HEROES).sort());
    for (const role of ROLE_ORDER) {
      expect(ROLES[role].heroes.length, role).toBeGreaterThan(0);
      for (const hero of ROLES[role].heroes) {
        expect(HEROES[hero]).toMatchObject({ id: hero, role });
        expect(WEAPONS[weaponFor(hero)]?.role, hero).toBe(role);
      }
    }
    // No two heroes share a weapon, and every weapon has a hero.
    expect(new Set(HERO_ORDER.map(weaponFor)).size).toBe(HERO_ORDER.length);
    expect(HERO_ORDER.map(weaponFor).sort()).toEqual(Object.keys(WEAPONS).sort());
    // The default Mage heals.
    expect(WEAPONS[weaponFor(defaultHero('mage'))]?.healer).toBe(true);
  });

  it('keeps a hero only for its own role, falling back to the role’s default', () => {
    expect(heroFor('ranger', 'bowmaster')).toBe('bowmaster');
    expect(heroFor('ranger', 'blademaster')).toBe('arbalest');
    expect(heroFor('melee', undefined)).toBe('dragoon');
    for (const junk of ['male', 'female', 'toString', '', null, 7]) {
      expect(isHero(junk), String(junk)).toBe(false);
      expect(heroFor('tank', junk)).toBe('darkKnight');
    }
  });

  it('seats a dungeon player as a hero of their role', () => {
    const seat = (role: Seat['role'], weapon: string, hero?: HeroId): Seat => ({ ownerId: null, name: role, role, weapon, hero });
    expect(seatHero(seat('ranger', 'bow', 'bowmaster'))).toBe('bowmaster');
    // Another role's hero, or none, gives the role's hero with the seat's weapon.
    expect(seatHero(seat('ranger', 'bow', 'guardian'))).toBe('bowmaster');
    expect(seatHero(seat('melee', 'twin_blades'))).toBe('blademaster');
    expect(seatHero(seat('tank', 'tank_greatsword', 'nobody' as HeroId))).toBe('darkKnight');
    const inst = new Instance('t', [seat('tank', 'sword_shield', 'sage'), seat('mage', 'staff', 'sage'), seat('ranger', 'crossbow'), seat('melee', 'spear', 'blademaster')], { seed: 1, countdown: 0 });
    const spawns = inst.startFor(inst.players[0]!).entities.filter((e) => e.kind === 'player');
    expect(spawns.map((e) => e.hero)).toEqual(['guardian', 'sage', 'arbalest', 'blademaster']);
  });

  it('names each hero’s artwork after them, and keeps each role’s skill glow', () => {
    for (const hero of HERO_ORDER) {
      const kebab = HEROES[hero].name.toLowerCase().replace(/[^a-z]+/g, '-');
      expect(heroArtId(hero)).toBe(`hero-${kebab}`);
      expect(heroOfArt(heroArtId(hero))).toBe(hero);
    }
    expect(heroOfArt('orc-brute')).toBeUndefined();
    const glow: Record<string, number[]> = { tank: [255, 213, 107], mage: [185, 140, 255], ranger: [143, 227, 111], melee: [255, 111, 94] };
    for (const hero of HERO_ORDER) expect(auraFor(heroArtId(hero)), hero).toEqual(glow[HEROES[hero].role]);
  });

  it('offers players nothing that says male or female', () => {
    const gendered = /\b(fe)?males?\b|\b(wo)?man['’]s\b/i;
    const strings: string[] = [];
    const walk = (v: unknown): void => {
      if (typeof v === 'string') strings.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk([ROLES, HEROES, WEAPONS, SKILLS, STATUSES, MOBS, BOSSES, THEMES, HERO_ORDER.map(heroArtId)]);
    expect(strings.length).toBeGreaterThan(500);
    expect(strings.filter((s) => gendered.test(s))).toEqual([]);
    // The screens players see, and the messages the server sends them.
    const ui = [
      ...readdirSync('src/client/ui').map((f) => `src/client/ui/${f}`),
      'src/client/game/hud.ts',
      'src/client/index.html',
      'src/server/lobby.ts',
    ];
    for (const file of ui) expect(readFileSync(file, 'utf8').match(gendered)?.[0], file).toBeUndefined();
  });
});
