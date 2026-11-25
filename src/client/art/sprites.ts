/**
 * Loads sprite images the renderer can draw, plus a white silhouette for hit flashes
 * and a grey copy for knocked-out heroes.
 */
import type { RoleId } from '../../shared/content/classes.js';
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import { HERO_LOOKS, type EntitySpawn, type HeroLook } from '../../shared/protocol.js';
import { shieldArt, WEAPON_ART, type WeaponArt } from './weapons.js';
import { creatureArt, type CreatureArt } from './creature-art.js';

export interface Sprite {
  def: CreatureArt;
  img: HTMLImageElement;
  white: HTMLCanvasElement | null;
  grey: HTMLCanvasElement | null;
  ready: boolean;
}

const sprites = new Map<string, Sprite>();

function load(key: string, make: () => CreatureArt): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  const def = make();
  const img = new Image();
  const sprite: Sprite = { def, img, white: null, grey: null, ready: false };
  img.onload = () => {
    sprite.ready = true;
    try {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const white = document.createElement('canvas');
      white.width = w;
      white.height = h;
      const wg = white.getContext('2d') as CanvasRenderingContext2D;
      wg.drawImage(img, 0, 0);
      wg.globalCompositeOperation = 'source-in';
      wg.fillStyle = '#fff';
      wg.fillRect(0, 0, w, h);
      sprite.white = white;
      const grey = document.createElement('canvas');
      grey.width = w;
      grey.height = h;
      const gg = grey.getContext('2d') as CanvasRenderingContext2D;
      gg.drawImage(img, 0, 0);
      const data = gg.getImageData(0, 0, w, h);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = (data.data[i] as number) * 0.3 + (data.data[i + 1] as number) * 0.59 + (data.data[i + 2] as number) * 0.11;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v * 0.8;
      }
      gg.putImageData(data, 0, 0);
      sprite.grey = grey;
    } catch {
      // Silhouettes are a nicety; the sprite still draws without them.
    }
  };
  img.src = def.url;
  sprites.set(key, sprite);
  return sprite;
}

export function defaultHeroLook(role: RoleId): HeroLook {
  return role === 'mage' || role === 'ranger' ? 'female' : 'male';
}

export function heroSprite(role: RoleId, look = defaultHeroLook(role)): Sprite {
  const id = `hero-${role}-${look}` as const;
  return load(id, () => creatureArt(id));
}

export function spriteFor(spawn: EntitySpawn, clan: ThemeId): Sprite {
  if (spawn.kind === 'player') return heroSprite(spawn.role ?? 'tank', spawn.look);
  if (spawn.kind === 'boss') {
    const kind = spawn.boss ?? 'juggernaut';
    return load(`boss:${clan}:${kind}`, () => creatureArt(`${clan}-boss-${kind}`));
  }
  const kind = spawn.mob ?? 'brute';
  return load(`mob:${clan}:${kind}`, () => creatureArt(`${clan}-${kind}`));
}

/** Starts loading every sprite a dungeon of this clan can show. */
export function preloadClan(clan: ThemeId): void {
  for (const role of ['tank', 'mage', 'ranger', 'melee'] as RoleId[]) {
    for (const look of HERO_LOOKS) heroSprite(role, look);
  }
  for (const weapon of Object.keys(WEAPON_ART)) weaponSprite(weapon);
  shieldSprite();
  for (const mob of ['brute', 'skirmisher', 'archer', 'caster', 'elite', 'sentry'] as MobKind[]) spriteFor({ id: 0, kind: 'mob', team: 'enemy', name: '', radius: 1, mob }, clan);
  for (const boss of ['juggernaut', 'hexer', 'beast', 'warden', 'sovereign'] as BossKind[]) spriteFor({ id: 0, kind: 'boss', team: 'enemy', name: '', radius: 1, boss }, clan);
}

export interface WeaponSprite {
  art: WeaponArt;
  img: HTMLImageElement;
  ready: boolean;
}

const weapons = new Map<string, WeaponSprite>();

function loadWeapon(key: string, make: () => WeaponArt): WeaponSprite {
  const hit = weapons.get(key);
  if (hit) return hit;
  const art = make();
  const img = new Image();
  const sprite: WeaponSprite = { art, img, ready: false };
  img.onload = () => {
    sprite.ready = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`;
  weapons.set(key, sprite);
  return sprite;
}

/** The pixel image of a hero's weapon, or null for an unknown weapon. */
export function weaponSprite(weapon: string): WeaponSprite | null {
  const make = WEAPON_ART[weapon];
  return make ? loadWeapon(weapon, make) : null;
}

export function shieldSprite(): WeaponSprite {
  return loadWeapon('shield', shieldArt);
}

/** A hero's sprite as an image URL, for the lobby and title screen. */
export function heroImageUrl(role: RoleId, look = defaultHeroLook(role)): string {
  return creatureArt(`hero-${role}-${look}`).url;
}
