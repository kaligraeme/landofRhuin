/**
 * Loads the cast and builds their animation frames. Monsters animate their artwork (see
 * animation.ts); heroes are painted frame by frame from a skeleton, wielding their weapons, with
 * faces cut from their artwork (see heroes/), side on and also turned toward and away from the
 * viewer. Frames are built in the background a little at a time (a few milliseconds per tick), so
 * the game never stalls, and packed into an atlas per sprite and facing: a row per clip. Chibi
 * heroes (see heroes/chibi/) are painted frame by frame, side on first; their views toward and
 * away from the viewer wait until every other queued sprite has its frames. Each chibi frame is
 * cropped to the figure and its effects and the crops are shelf-packed, an atlas per view.
 */
import { DEFAULT_LOOK, HERO_LOOKS, type HeroLook, type RoleId } from '../../shared/content/classes.js';
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import type { EntitySpawn } from '../../shared/protocol.js';
import { cropRaster, opaqueBounds, shelfPack } from './atlas.js';
import { creatureArt, type CreatureArt } from './creature-art.js';
import { ACTION_WINDUP, buildFrames, CLIP_LENGTH, CLIPS, rigSprite, SKILL_CHARGE, type Clip, type Raster } from './animation.js';
import { auraFor, RIG_HINTS } from './rigs.js';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiClip, type ChibiHero, type ChibiView } from './heroes/chibi/index.js';
import { HERO_DESIGNS } from './heroes/designs.js';
import { HERO_CHARGE, HERO_CLIP_LENGTH, HERO_WINDUP, heroClips } from './heroes/moves.js';
import { cropHead, renderHero } from './heroes/render.js';
import { ANCHOR_X, GROUND_Y } from './heroes/skeleton.js';
import { renderTurned, TURNED_X, TURNED_Y } from './heroes/turned.js';

/** Tiles per pixel of hero art: heroes stand about 2 tiles tall. */
export const HERO_TILE = 2.17 / 96;

/** Every clip's frames for one facing, in one atlas: a row per clip. */
export interface Sheet {
  atlas: HTMLCanvasElement;
  fw: number;
  fh: number;
  /** The feet, in frame pixels. */
  ax: number;
  ay: number;
  rows: Record<Clip, number>;
}

/** Which way a sprite is drawn: side on (mirrored to face left), toward the viewer or away. */
export type Facing = 'side' | 'front' | 'back';

/** A sprite's animation: every clip's frames in one atlas, a row per clip. */
export interface SpriteAnim extends Sheet {
  /** Tiles per frame pixel. */
  scale: number;
  /** Heroes also face toward the viewer and away; these arrive once painted. */
  turned?: Partial<Record<'front' | 'back', Sheet>>;
  lengths: Record<Clip, number>;
  /** Frames of the attack that wind up, and of the skill that gather power. */
  windup: number;
  charge: number;
  /** Seconds the blow and the skill's release take to play out. */
  strike: number;
  release: number;
  /** A grey still for a knocked-out hero. */
  grey: HTMLCanvasElement | null;
}

/**
 * One chibi frame, cropped to its opaque pixels plus a pixel of margin: where it sits in its view's
 * atlas, and where its top-left corner sits relative to the ground point under the feet (frame
 * pixels, facing right).
 */
export interface ChibiFrame {
  sx: number;
  sy: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/** Every frame of every clip of a chibi hero in one view, shelf-packed into one atlas. */
export interface ChibiSheet {
  atlas: HTMLCanvasElement;
  frames: Record<ChibiClip, ChibiFrame[]>;
}

/**
 * A chibi hero's animation: a sheet per view, each arriving once painted. Side on comes first; the
 * views toward and away from the viewer follow once every other queued sprite has its frames (the
 * renderer draws him side on meanwhile).
 */
export interface ChibiAnim {
  hero: ChibiHero;
  views: Partial<Record<ChibiView, ChibiSheet>>;
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
  /** Chibi heroes animate from these instead of `anim`. */
  chibi: ChibiAnim | null;
}

type CreatureId = Parameters<typeof creatureArt>[0];
const sprites = new Map<string, Sprite>();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D];
}

function rasterOf(img: HTMLImageElement): Raster {
  const [, g] = canvas(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, 0, 0);
  return { w: img.naturalWidth, h: img.naturalHeight, data: g.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data };
}

/** A grey, darkened copy, for knocked-out heroes. */
function greyOf(src: CanvasImageSource, w: number, h: number, sx = 0, sy = 0): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  g.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  const data = g.getImageData(0, 0, w, h);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = (data.data[i] as number) * 0.3 + (data.data[i + 1] as number) * 0.59 + (data.data[i + 2] as number) * 0.11;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v * 0.8;
  }
  g.putImageData(data, 0, 0);
  return c;
}

function load(key: string, id: CreatureId): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  const def = creatureArt(id);
  const img = new Image();
  const sprite: Sprite = { id, def, img, white: null, grey: null, ready: false, anim: null, chibi: null };
  img.onload = () => {
    sprite.ready = true;
    const chibi = CHIBI_HEROES[id];
    queue(chibi ? chibiSteps(sprite, chibi) : id in HERO_DESIGNS ? heroSteps(sprite) : monsterSteps(sprite));
    try {
      const [white, wg] = canvas(img.naturalWidth, img.naturalHeight);
      wg.drawImage(img, 0, 0);
      wg.globalCompositeOperation = 'source-in';
      wg.fillStyle = '#fff';
      wg.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      sprite.white = white;
      sprite.grey = greyOf(img, img.naturalWidth, img.naturalHeight);
    } catch {
      // Silhouettes are a nicety; the sprite still draws without them.
    }
  };
  img.src = def.url;
  sprites.set(key, sprite);
  return sprite;
}

// ── Building frames in the background ────────────────────────────────────────────────────────

const jobs: Iterator<void>[] = [];
let pumping = false;

function queue(steps: Iterator<void>): void {
  jobs.push(steps);
  if (!pumping) {
    pumping = true;
    setTimeout(pump, 0);
  }
}

/** Milliseconds of building per tick: short enough that a frame of the game is never held up long. */
const SLICE_MS = 12;

/** Runs steps of the oldest job, then the next, for up to SLICE_MS per tick. */
function pump(): void {
  const end = performance.now() + SLICE_MS;
  do {
    const job = jobs[0];
    if (!job) break;
    try {
      if (job.next().done) jobs.shift();
    } catch (err) {
      // Animation is a nicety: a sprite whose frames fail to build is drawn still.
      console.warn('Could not build animation frames:', err);
      jobs.shift();
    }
  } while (jobs.length && performance.now() < end);
  if (jobs.length) setTimeout(pump, 0);
  else pumping = false;
}

function pack(frames: Record<Clip, Raster[]>, fw: number, fh: number): { atlas: HTMLCanvasElement; rows: Record<Clip, number> } {
  const cols = Math.max(...CLIPS.map((clip) => frames[clip].length));
  const [atlas, g] = canvas(fw * cols, fh * CLIPS.length);
  const rows = {} as Record<Clip, number>;
  CLIPS.forEach((clip, row) => {
    rows[clip] = row;
    frames[clip].forEach((f, i) => g.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), i * fw, row * fh));
  });
  return { atlas, rows };
}

/** Monsters: rig the artwork and bend it through every clip. */
function* monsterSteps(sprite: Sprite): Generator<void> {
  const { def } = sprite;
  const src = rasterOf(sprite.img);
  const rig = rigSprite(src, def.ax, { floats: def.floats, hint: RIG_HINTS[sprite.id] });
  yield;
  const set = buildFrames(src, rig, auraFor(sprite.id));
  yield;
  const { atlas, rows } = pack(set.frames, set.fw, set.fh);
  sprite.anim = {
    atlas,
    fw: set.fw,
    fh: set.fh,
    ax: def.ax + set.pad,
    ay: def.ay + set.pad,
    scale: def.height / def.h,
    rows,
    lengths: CLIP_LENGTH,
    windup: ACTION_WINDUP,
    charge: SKILL_CHARGE,
    strike: 0.32,
    release: 0.5,
    grey: null,
  };
}

/**
 * Heroes: paint every pose of every clip, one clip per step: side on first (the hero animates as
 * soon as that is done), then turned toward the viewer and away.
 */
function* heroSteps(sprite: Sprite): Generator<void> {
  const design = HERO_DESIGNS[sprite.id as keyof typeof HERO_DESIGNS];
  const head = cropHead(rasterOf(sprite.img), design);
  const clips = heroClips(design.moveset);
  const frames = {} as Record<Clip, Raster[]>;
  for (const clip of CLIPS) {
    yield;
    frames[clip] = clips[clip].map((pose) => renderHero(design, pose, head));
  }
  yield;
  const first = frames.idle[0] as Raster;
  const { atlas, rows } = pack(frames, first.w, first.h);
  const anim: SpriteAnim = {
    atlas,
    fw: first.w,
    fh: first.h,
    ax: ANCHOR_X,
    ay: GROUND_Y,
    scale: HERO_TILE,
    rows,
    lengths: HERO_CLIP_LENGTH,
    windup: HERO_WINDUP,
    charge: HERO_CHARGE,
    strike: 0.4,
    release: 0.7,
    grey: greyOf(atlas, first.w, first.h, 0, rows.idle * first.h),
    turned: {},
  };
  sprite.anim = anim;
  for (const facing of ['front', 'back'] as const) {
    const turned = {} as Record<Clip, Raster[]>;
    for (const clip of CLIPS) {
      yield;
      // Attacks and skills swing on a slant across the body.
      const swing = clip === 'action' || clip === 'skill';
      turned[clip] = clips[clip].map((pose) => renderTurned(design, pose, facing, swing));
    }
    yield;
    const f = turned.idle[0] as Raster;
    const packed = pack(turned, f.w, f.h);
    (anim.turned ??= {})[facing] = { atlas: packed.atlas, rows: packed.rows, fw: f.w, fh: f.h, ax: TURNED_X, ay: TURNED_Y };
  }
}

/** Paints one chibi frame and crops it to the figure and its effects, a pixel of margin around. */
function chibiCrop(hero: ChibiHero, clip: ChibiClip, frame: number, view: ChibiView): { raster: Raster; ox: number; oy: number } {
  const box = hero.frame[view];
  const painted = hero.paint(clip, frame, view);
  const crop = opaqueBounds(painted, 1, { x: box.ax, y: box.ay });
  return { raster: cropRaster(painted, crop), ox: crop.x - box.ax, oy: crop.y - box.ay };
}

/**
 * Chibi heroes: paint every frame of every clip, one frame per step, view by view. Side on comes
 * first (the hero animates as soon as that is done); the views toward and away from the viewer are
 * queued again behind every other sprite, so the rest of the party and the monsters animate
 * sooner. Each view's crops are shelf-packed into one atlas.
 */
function* chibiSteps(sprite: Sprite, hero: ChibiHero, views: readonly ChibiView[] = CHIBI_VIEWS, anim: ChibiAnim = { hero, views: {} }): Generator<void> {
  for (const view of views) {
    const crops: { clip: ChibiClip; raster: Raster; ox: number; oy: number }[] = [];
    for (const clip of CHIBI_CLIPS) {
      for (let i = 0; i < hero.timing[clip].frames; i++) {
        yield;
        crops.push({ clip, ...chibiCrop(hero, clip, i, view) });
      }
    }
    yield;
    const packed = shelfPack(crops.map((c) => c.raster));
    const [atlas, g] = canvas(packed.w, packed.h);
    const frames = Object.fromEntries(CHIBI_CLIPS.map((clip) => [clip, [] as ChibiFrame[]])) as Record<ChibiClip, ChibiFrame[]>;
    crops.forEach((c, i) => {
      const at = packed.at[i] as { x: number; y: number };
      g.putImageData(new ImageData(new Uint8ClampedArray(c.raster.data), c.raster.w, c.raster.h), at.x, at.y);
      frames[c.clip].push({ sx: at.x, sy: at.y, w: c.raster.w, h: c.raster.h, ox: c.ox, oy: c.oy });
    });
    anim.views[view] = { atlas, frames };
    sprite.chibi = anim;
    if (view === 'side' && views.length > 1) {
      queue(chibiSteps(sprite, hero, views.slice(1), anim));
      return;
    }
  }
}

// ── The cast ─────────────────────────────────────────────────────────────────────────────────

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

/** Starts loading every sprite a dungeon can show: the party's heroes first, then the clan. */
export function preloadClan(clan: ThemeId, heroes: { role: RoleId; look?: HeroLook }[] = []): void {
  for (const h of heroes) heroSprite(h.role, h.look);
  for (const mob of ['brute', 'skirmisher', 'archer', 'caster', 'elite', 'sentry'] as MobKind[]) spriteFor({ id: 0, kind: 'mob', team: 'enemy', name: '', radius: 1, mob }, clan);
  for (const boss of ['juggernaut', 'hexer', 'beast', 'warden', 'sovereign'] as BossKind[]) spriteFor({ id: 0, kind: 'boss', team: 'enemy', name: '', radius: 1, boss }, clan);
}

// ── Portraits ────────────────────────────────────────────────────────────────────────────────

const portraits = new Map<string, Promise<string>>();

/**
 * A painted frame cropped to the figure, as an image URL: the bottom edge sits just under the feet
 * (`groundY`), or under the lowest painted pixel if that is lower (a chibi hero's near boot is
 * painted a few pixels below the ground point, as the camera looks down).
 */
function portraitOf(f: Raster, groundY: number): string {
  let x0 = f.w;
  let x1 = 0;
  let y0 = f.h;
  let y1 = 0;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if ((f.data[(y * f.w + x) * 4 + 3] as number) === 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  const w = x1 - x0 + 3;
  const h = Math.max(groundY + 2, y1 + 1) - y0 + 2;
  const [c, g] = canvas(w, h);
  g.putImageData(new ImageData(new Uint8ClampedArray(f.data), f.w, f.h), 1 - x0, 1 - y0);
  return c.toDataURL('image/png');
}

/**
 * A hero in their battle stance, weapon in hand, as an image URL for the lobby and title screen.
 * Resolves once painted; `heroImageUrl` gives the plain artwork meanwhile.
 */
export function heroPortrait(role: RoleId, look: HeroLook = defaultHeroLook(role)): Promise<string> {
  const id = `hero-${role}-${look}` as const;
  let hit = portraits.get(id);
  if (!hit) {
    const chibi = CHIBI_HEROES[id];
    hit = chibi
      ? Promise.resolve().then(() => portraitOf(chibi.paint('battle', 0, 'side'), chibi.frame.side.ay))
      : new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            try {
              const design = HERO_DESIGNS[id];
              resolve(portraitOf(renderHero(design, heroClips(design.moveset).battle[0]!, cropHead(rasterOf(img), design)), GROUND_Y));
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = reject;
          img.src = creatureArt(id).url;
        });
    portraits.set(id, hit);
  }
  return hit;
}

/** The hero's plain artwork, shown until their portrait is painted. */
export function heroImageUrl(role: RoleId, look: HeroLook = defaultHeroLook(role)): string {
  return creatureArt(`hero-${role}-${look}`).url;
}

/** Sets an image to a hero's portrait, starting with the plain artwork. */
export function showHero(img: HTMLImageElement, role: RoleId, look: HeroLook = defaultHeroLook(role)): void {
  const want = `${role}-${look}`;
  img.dataset.hero = want;
  if (!img.src) img.src = heroImageUrl(role, look);
  heroPortrait(role, look).then(
    (url) => {
      if (img.dataset.hero === want) img.src = url;
    },
    () => undefined,
  );
}

export { HERO_LOOKS };
