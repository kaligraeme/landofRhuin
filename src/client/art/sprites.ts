/**
 * Loads the cast and builds their animation frames. Monsters and bosses animate their artwork in
 * creatures/: each is rigged and bent through five clips (see animation.ts and rigs.ts), packed
 * into one atlas a row per clip. Heroes, and the forms they take (the Firebeast), are chibis (see
 * heroes/chibi/), painted frame by frame in three views: side on first, then toward and away from
 * the viewer once every other queued sprite has its frames. Each chibi frame is cropped to the
 * figure and its effects and the crops are shelf-packed, an atlas per view. Frames are built in
 * the background a little at a time (a few milliseconds per tick), so the game never stalls. A
 * hero has nothing to show until their side view is painted (the renderer draws a plain figure
 * meanwhile). A form is painted only in the clips the game shows of it (FORM_CLIPS), after every
 * hero of the party.
 */
import { defaultHero, type HeroId } from '../../shared/content/classes.js';
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import type { EntitySpawn } from '../../shared/protocol.js';
import { cropRaster, opaqueBounds, shelfPack } from './atlas.js';
import { creatureArt, type CreatureArt, type CreatureId } from './creature-art.js';
import { heroArtId } from './heroArt.js';
import { FORM_ART, formHero, heroForms } from './heroForms.js';
import { ACTION_WINDUP, buildFrames, CLIP_LENGTH, CLIPS, rigSprite, SKILL_CHARGE, type Clip, type Raster } from './animation.js';
import { auraFor, RIG_HINTS } from './rigs.js';
import { CHIBI_CLIPS, CHIBI_HEROES, CHIBI_VIEWS, type ChibiClip, type ChibiHero, type ChibiView } from './heroes/chibi/index.js';
import { FORM_CLIPS } from '../game/chibiState.js';

/** A monster's frames in one atlas: a row per clip. */
export interface Sheet {
  atlas: HTMLCanvasElement;
  fw: number;
  fh: number;
  /** The feet, in frame pixels. */
  ax: number;
  ay: number;
  rows: Record<Clip, number>;
}

/** Which way a chibi is drawn: side on (mirrored to face left), toward the viewer or away. */
export type Facing = 'side' | 'front' | 'back';

/** A monster's animation: every clip's frames in one atlas, a row per clip. */
export interface SpriteAnim extends Sheet {
  /** Tiles per frame pixel. */
  scale: number;
  lengths: Record<Clip, number>;
  /** Frames of the attack that wind up, and of the skill that gather power. */
  windup: number;
  charge: number;
  /** Seconds the blow and the skill's release take to play out. */
  strike: number;
  release: number;
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
  /** A monster's artwork metrics; a chibi's are made up from its frames. */
  def: CreatureArt;
  /** A monster's artwork, drawn still until its frames are built (a chibi has none). */
  img: HTMLImageElement;
  /** The artwork as a white silhouette, for a monster's hit flash before its frames are built. */
  white: HTMLCanvasElement | null;
  /** Whether there is anything to draw: a monster's artwork has loaded, a chibi's side view is painted. */
  ready: boolean;
  /** A monster's frames, null until built (the renderer draws the still artwork meanwhile). */
  anim: SpriteAnim | null;
  /** A chibi's frames. */
  chibi: ChibiAnim | null;
}

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

/** A monster or boss: its artwork, then its frames once that has loaded. */
function loadCreature(key: string, id: CreatureId): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  const def = creatureArt(id);
  const img = new Image();
  const sprite: Sprite = { id, def, img, white: null, ready: false, anim: null, chibi: null };
  img.onload = () => {
    sprite.ready = true;
    queue(monsterSteps(sprite));
    try {
      const [white, wg] = canvas(img.naturalWidth, img.naturalHeight);
      wg.drawImage(img, 0, 0);
      wg.globalCompositeOperation = 'source-in';
      wg.fillStyle = '#fff';
      wg.fillRect(0, 0, img.naturalWidth, img.naturalHeight);
      sprite.white = white;
    } catch {
      // The silhouette is a nicety; the sprite still draws without it.
    }
  };
  img.src = def.url;
  sprites.set(key, sprite);
  return sprite;
}

/**
 * A chibi (a hero or a form) by its sprite id: its metrics come from its frames, and it is ready
 * to draw once its side view is painted. Only `clips` are painted (every clip for a hero).
 */
function loadChibi(id: string, clips: readonly ChibiClip[] = CHIBI_CLIPS): Sprite {
  const hit = sprites.get(id);
  if (hit) return hit;
  const hero = CHIBI_HEROES[id];
  if (!hero) throw new Error(`No chibi hero ${id}`);
  const box = hero.frame.side;
  const def: CreatureArt = { url: '', w: Math.round(hero.height * 0.7), h: hero.height, ax: box.ax, ay: box.ay, height: hero.height * hero.scale };
  const sprite: Sprite = { id, def, img: new Image(), white: null, ready: false, anim: null, chibi: null };
  sprites.set(id, sprite);
  queue(chibiSteps(sprite, hero, clips));
  return sprite;
}

// ── Building frames in the background ────────────────────────────────────────────────────────

const jobs: Iterator<void>[] = [];
let pumping = false;

/** Queues a job: behind the others, or ahead of them when `first` (a lobby portrait, wanted now). */
function queue(steps: Iterator<void>, first = false): void {
  if (first) jobs.unshift(steps);
  else jobs.push(steps);
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
      // Animation is a nicety: a monster whose frames fail to build is drawn still.
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
  };
}

/** Paints one chibi frame and crops it to the figure and its effects, a pixel of margin around. */
function chibiCrop(hero: ChibiHero, clip: ChibiClip, frame: number, view: ChibiView): { raster: Raster; ox: number; oy: number } {
  const box = hero.frame[view];
  const painted = hero.paint(clip, frame, view);
  const crop = opaqueBounds(painted, 1, { x: box.ax, y: box.ay });
  return { raster: cropRaster(painted, crop), ox: crop.x - box.ax, oy: crop.y - box.ay };
}

/**
 * Chibi heroes: paint every frame of every clip in `clips`, one frame per step, view by view. Side
 * on comes first (the hero animates as soon as that is done); the views toward and away from the
 * viewer are queued again behind every other sprite, so the rest of the party and the monsters
 * animate sooner. Each view's crops are shelf-packed into one atlas. A clip left out (one a form
 * never shows) gets the idle frames, so every clip still has frames to draw.
 */
function* chibiSteps(sprite: Sprite, hero: ChibiHero, clips: readonly ChibiClip[], views: readonly ChibiView[] = CHIBI_VIEWS, anim: ChibiAnim = { hero, views: {} }): Generator<void> {
  for (const view of views) {
    const crops: { clip: ChibiClip; raster: Raster; ox: number; oy: number }[] = [];
    for (const clip of CHIBI_CLIPS) {
      if (!clips.includes(clip)) continue;
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
    for (const clip of CHIBI_CLIPS) if (!clips.includes(clip)) frames[clip] = frames.idle;
    anim.views[view] = { atlas, frames };
    sprite.chibi = anim;
    sprite.ready = true;
    if (view === 'side' && views.length > 1) {
      queue(chibiSteps(sprite, hero, clips, views.slice(1), anim));
      return;
    }
  }
}

// ── The cast ─────────────────────────────────────────────────────────────────────────────────

/** A hero's sprite: their chibi. */
export function heroSprite(hero: HeroId): Sprite {
  return loadChibi(heroArtId(hero));
}

/** A form's sprite (the Firebeast), or null if it has no chibi: the hero then keeps their own look. */
export function formSprite(form: string): Sprite | null {
  const id = FORM_ART[form];
  return id && formHero(form) ? loadChibi(id, FORM_CLIPS) : null;
}

export function spriteFor(spawn: EntitySpawn, clan: ThemeId): Sprite {
  if (spawn.kind === 'player') return heroSprite(spawn.hero ?? defaultHero(spawn.role ?? 'tank'));
  if (spawn.kind === 'boss') {
    const kind = spawn.boss ?? 'juggernaut';
    return loadCreature(`boss:${clan}:${kind}`, `${clan}-boss-${kind}`);
  }
  const kind = spawn.mob ?? 'brute';
  return loadCreature(`mob:${clan}:${kind}`, `${clan}-${kind}`);
}

/**
 * Starts loading every sprite a dungeon can show: the party's heroes first, in the order given,
 * then the forms they take (so every hero of the party shows before any form is painted), then the
 * clan.
 */
export function preloadClan(clan: ThemeId, heroes: HeroId[] = []): void {
  for (const hero of heroes) heroSprite(hero);
  for (const hero of heroes) for (const form of heroForms(hero)) formSprite(form);
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

/** Paints a portrait as one step of the build queue, so a screen of portraits never stalls the page. */
function* portraitSteps(hero: ChibiHero, resolve: (url: string) => void, reject: (err: unknown) => void): Generator<void> {
  yield;
  try {
    resolve(portraitOf(hero.paint('battle', 0, 'side'), hero.frame.side.ay));
  } catch (err) {
    reject(err);
  }
}

/**
 * A hero in their battle stance, weapon in hand, as an image URL for the lobby and title screen.
 * Each is painted once, ahead of any frames being built.
 */
export function heroPortrait(hero: HeroId): Promise<string> {
  const id = heroArtId(hero);
  let hit = portraits.get(id);
  if (!hit) {
    const chibi = CHIBI_HEROES[id];
    hit = chibi ? new Promise<string>((resolve, reject) => queue(portraitSteps(chibi, resolve, reject), true)) : Promise.reject(new Error(`No chibi hero ${id}`));
    portraits.set(id, hit);
  }
  return hit;
}

/** Sets an image to a hero's portrait once it is painted. */
export function showHero(img: HTMLImageElement, hero: HeroId): void {
  img.dataset.hero = hero;
  heroPortrait(hero).then(
    (url) => {
      if (img.dataset.hero === hero) img.src = url;
    },
    () => undefined,
  );
}
