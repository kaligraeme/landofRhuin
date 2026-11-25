/**
 * Loads sprite images the renderer can draw, plus a white silhouette for hit flashes and a grey
 * copy for knocked-out heroes. Once a sprite has loaded, its animation frames are built in the
 * background (one sprite at a time, so the game never stalls) and packed into an atlas.
 */
import { DEFAULT_LOOK, type RoleId } from '../../shared/content/classes.js';
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import { HERO_LOOKS, type EntitySpawn, type HeroLook } from '../../shared/protocol.js';
import { equipmentArt, WEAPON_IDS, type WeaponArt } from './weapons.js';
import { creatureArt, type CreatureArt } from './creature-art.js';
import { buildFrames, CLIP_LENGTH, CLIPS, rigSprite, type Clip, type Pose, type Raster, type Rig } from './animation.js';
import { auraFor, RIG_HINTS } from './rigs.js';

/** A sprite's animation: every clip's frames in one atlas (a row per clip), and their poses. */
export interface SpriteAnim {
  atlas: HTMLCanvasElement;
  fw: number;
  fh: number;
  pad: number;
  rig: Rig;
  poses: Record<Clip, Pose[]>;
  rows: Record<Clip, number>;
}

export interface Sprite {
  id: string;
  def: CreatureArt;
  img: HTMLImageElement;
  white: HTMLCanvasElement | null;
  grey: HTMLCanvasElement | null;
  ready: boolean;
  /** Null until the frames are built; the renderer draws the still image meanwhile. */
  anim: SpriteAnim | null;
}

const sprites = new Map<string, Sprite>();

function load(key: string, id: Parameters<typeof creatureArt>[0]): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  const def = creatureArt(id);
  const img = new Image();
  const sprite: Sprite = { id, def, img, white: null, grey: null, ready: false, anim: null };
  img.onload = () => {
    sprite.ready = true;
    queueFrames(sprite);
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

const pending: Sprite[] = [];
let pumping = false;

function queueFrames(sprite: Sprite): void {
  pending.push(sprite);
  if (!pumping) {
    pumping = true;
    setTimeout(pump, 0);
  }
}

function pump(): void {
  const sprite = pending.shift();
  if (sprite) {
    try {
      sprite.anim = buildAnim(sprite);
    } catch (err) {
      // Animation is a nicety: a sprite whose frames fail to build is drawn still.
      console.warn(`No animation for ${sprite.id}:`, err);
    }
  }
  if (pending.length) setTimeout(pump, 0);
  else pumping = false;
}

/** Rigs the sprite, renders every clip and packs the frames into an atlas. */
function buildAnim(sprite: Sprite): SpriteAnim {
  const { img, def } = sprite;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  g.drawImage(img, 0, 0);
  const src: Raster = { w, h, data: g.getImageData(0, 0, w, h).data };
  const rig = rigSprite(src, def.ax, { floats: def.floats, hint: RIG_HINTS[sprite.id] });
  const set = buildFrames(src, rig, auraFor(sprite.id));
  const cols = Math.max(...CLIPS.map((clip) => CLIP_LENGTH[clip]));
  const atlas = document.createElement('canvas');
  atlas.width = set.fw * cols;
  atlas.height = set.fh * CLIPS.length;
  const ag = atlas.getContext('2d') as CanvasRenderingContext2D;
  const rows = {} as Record<Clip, number>;
  CLIPS.forEach((clip, row) => {
    rows[clip] = row;
    set.frames[clip].forEach((f, i) => ag.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), i * set.fw, row * set.fh));
  });
  return { atlas, fw: set.fw, fh: set.fh, pad: set.pad, rig, poses: set.poses, rows };
}

export function defaultHeroLook(role: RoleId): HeroLook {
  return DEFAULT_LOOK[role];
}

export function heroSprite(role: RoleId, look = defaultHeroLook(role)): Sprite {
  const id = `hero-${role}-${look}` as const;
  return load(id, id);
}

export function spriteFor(spawn: EntitySpawn, clan: ThemeId): Sprite {
  if (spawn.kind === 'player') return heroSprite(spawn.role ?? 'tank', spawn.look);
  if (spawn.kind === 'boss') {
    const kind = spawn.boss ?? 'juggernaut';
    return load(`boss:${clan}:${kind}`, `${clan}-boss-${kind}`);
  }
  const kind = spawn.mob ?? 'brute';
  return load(`mob:${clan}:${kind}`, `${clan}-${kind}`);
}

/** Starts loading every sprite a dungeon of this clan can show. */
export function preloadClan(clan: ThemeId): void {
  for (const role of ['tank', 'mage', 'ranger', 'melee'] as RoleId[]) {
    for (const look of HERO_LOOKS) heroSprite(role, look);
  }
  for (const weapon of WEAPON_IDS) weaponSprite(weapon);
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

function loadWeapon(key: string, art: WeaponArt): WeaponSprite {
  const hit = weapons.get(key);
  if (hit) return hit;
  const img = new Image();
  const sprite: WeaponSprite = { art, img, ready: false };
  img.onload = () => {
    sprite.ready = true;
  };
  img.src = art.url;
  weapons.set(key, sprite);
  return sprite;
}

/** The pixel image of a hero's weapon, or null for an unknown weapon. */
export function weaponSprite(weapon: string): WeaponSprite | null {
  const art = equipmentArt(weapon);
  return art ? loadWeapon(weapon, art) : null;
}

export function shieldSprite(): WeaponSprite {
  const art = equipmentArt('shield');
  if (!art) throw new Error('Missing shield sprite');
  return loadWeapon('shield', art);
}

/** A hero's sprite as an image URL, for the lobby and title screen. */
export function heroImageUrl(role: RoleId, look = defaultHeroLook(role)): string {
  return creatureArt(`hero-${role}-${look}`).url;
}
