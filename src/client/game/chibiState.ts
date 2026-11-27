/**
 * Which clip, and which frame of it, a chibi hero shows: a pure function of what the hero is
 * doing, so the choice can be tested without a browser. In order of priority: knocked out, an
 * attack or skill playing out, a dodge roll, running, the victory pose once the dungeon is
 * cleared, a flinch, kneeling at low health, then a battle stance near a fight or idling.
 *
 * How each clip plays is fixed here: idle, battle and kneel loop; move follows the stride; ko and
 * victory play once and hold their last frame; the combo, the skills and the flinch play once.
 */
import { SKILLS } from '../../shared/content/classes.js';
import { COMBO_CLIPS, SLOT_CLIPS, type ChibiClip, type ClipTiming } from '../art/heroes/chibi/index.js';

/** Below this share of their health a hero drops to one knee. */
export const KNEEL_BELOW = 0.25;
/** Seconds each wind-up frame takes when the server times no wind-up. */
export const WINDUP_FRAME = 0.06;

/** An attack or skill: when it began, its kind, the server's wind-up, the skill and the combo hit. */
export interface ChibiAct {
  at: number;
  k: 'atk' | 'sk';
  d: number;
  s?: string;
  c?: number;
}

export interface ChibiInput {
  timing: Readonly<Record<ChibiClip, ClipTiming>>;
  /** The client clock (seconds); every other time is on the same clock. */
  now: number;
  /** The entity id: staggers the loops so a party does not breathe in step. */
  id: number;
  /** Knocked out, and when they went down (null when unknown, e.g. they were down when we joined). */
  down: boolean;
  downAt: number | null;
  /** The dungeon is complete, and since when (null when unknown). */
  complete: boolean;
  completeAt: number | null;
  /** Their latest attack or skill, if any. */
  act: ChibiAct | null;
  /** Mid dodge roll. */
  rolling: boolean;
  moving: boolean;
  /** Stride phase (radians): the move clip runs through once every 2π. */
  phase: number;
  /** When a blow last got through to them (null if never). */
  hurtAt: number | null;
  hp: number;
  maxHp: number;
  /** A fight is on nearby. */
  fighting: boolean;
}

export interface ChibiPick {
  clip: ChibiClip;
  frame: number;
}

const mod = (a: number, n: number): number => ((a % n) + n) % n;
const lastFrame = (t: ClipTiming): number => Math.max(0, t.frames - 1);

/** A clip played once from `elapsed` seconds ago, holding its last frame after; null elapsed shows the last frame. */
function held(t: ClipTiming, elapsed: number | null): number {
  if (elapsed === null) return lastFrame(t);
  if (elapsed <= 0) return 0;
  return Math.min(lastFrame(t), Math.floor((elapsed / t.seconds) * t.frames));
}

/** A looping clip, offset per hero. */
function looped(t: ClipTiming, now: number, id: number): number {
  const frames = Math.max(1, t.frames);
  return mod(Math.floor((now / t.seconds + id * 0.37) * frames), frames);
}

/** The move clip by stride phase. */
function stride(t: ClipTiming, phase: number): number {
  const frames = Math.max(1, t.frames);
  return mod(Math.floor((phase / (Math.PI * 2)) * frames), frames);
}

/**
 * The clip an attack or skill plays: the combo hit for the basic attack, the clip of a weapon
 * skill's hotbar slot (special, q, e, r, ult), or `cast` for role skills, items and unknown skills.
 */
export function actClip(act: Pick<ChibiAct, 'k' | 's' | 'c'>): ChibiClip {
  if (act.k === 'atk') return COMBO_CLIPS[mod(act.c ?? 0, COMBO_CLIPS.length)] ?? 'atk1';
  const slot = act.s !== undefined && Object.hasOwn(SKILLS, act.s) ? SKILLS[act.s]?.slot : undefined;
  return SLOT_CLIPS.find((clip) => clip === slot) ?? 'cast';
}

/**
 * The frame of an act's clip `elapsed` seconds in, or null once it has played out. The wind-up
 * frames are stretched over the server's wind-up `d` (or take WINDUP_FRAME each without one); the
 * rest play over the clip's seconds.
 */
export function actFrame(t: ClipTiming, elapsed: number, d: number): number | null {
  const wind = Math.min(Math.max(0, t.windup), t.frames);
  const windTime = d > 0 ? d : wind * WINDUP_FRAME;
  const at = Math.max(0, elapsed);
  if (at < windTime) return wind > 0 ? Math.min(wind - 1, Math.floor((at / windTime) * wind)) : 0;
  const rest = t.frames - wind;
  const r = (at - windTime) / t.seconds;
  if (rest <= 0 || r >= 1) return null;
  return wind + Math.min(rest - 1, Math.floor(r * rest));
}

/** Which clip and frame a chibi hero shows now. */
export function chibiClip(input: ChibiInput): ChibiPick {
  const { timing: T, now } = input;
  if (input.down) return { clip: 'ko', frame: held(T.ko, input.downAt === null ? null : now - input.downAt) };
  if (input.act) {
    const clip = actClip(input.act);
    const frame = actFrame(T[clip], now - input.act.at, input.act.d);
    if (frame !== null) return { clip, frame };
  }
  if (input.rolling || input.moving) return { clip: 'move', frame: stride(T.move, input.phase) };
  // Once the dungeon is cleared the hero strikes the victory pose whenever standing still (and
  // holds its last frame after); attacks and running still show.
  if (input.complete) return { clip: 'victory', frame: held(T.victory, input.completeAt === null ? null : now - input.completeAt) };
  if (input.hurtAt !== null && now - input.hurtAt >= 0 && now - input.hurtAt < T.hurt.seconds) {
    return { clip: 'hurt', frame: held(T.hurt, now - input.hurtAt) };
  }
  if (input.maxHp > 0 && input.hp / input.maxHp < KNEEL_BELOW) return { clip: 'kneel', frame: looped(T.kneel, now, input.id) };
  if (input.fighting) return { clip: 'battle', frame: looped(T.battle, now, input.id) };
  return { clip: 'idle', frame: looped(T.idle, now, input.id) };
}

// ── Forms ────────────────────────────────────────────────────────────────────────────────────

/** A hero's form (the Firebeast) as the client saw it: when it began, and when it ended (null while it lasts). */
export interface FormSeen {
  id: string;
  at: number;
  endedAt: number | null;
}

/** Seconds a form takes to collapse back into the hero when it ends. */
export const FORM_COLLAPSE = 0.45;

export interface FormShowInput {
  now: number;
  seen: FormSeen | null;
  /** The hero's latest attack or skill. */
  act: ChibiAct | null;
  down: boolean;
  /** The hero's clip timing, and the form's (null until the form's chibi is painted). */
  hero: Readonly<Record<ChibiClip, ClipTiming>>;
  form: Readonly<Record<ChibiClip, ClipTiming>> | null;
  /**
   * Seconds the form takes to take shape (FormDef.emerge): flames engulf the hero in the first
   * half (the hero's `ult`), the form emerges in the second (the form's `ult`).
   */
  emerge: number;
}

/** How a hero who has taken a form shows now. */
export interface FormShow {
  /** Draw the form's sprite, else the hero's own. */
  form: boolean;
  /** The act that drives the clip: once the form shows, only its own blows (acts from before it began are dropped). */
  act: ChibiAct | null;
  /** The form never flinches, kneels or falls. */
  steady: boolean;
  /** A clip of the transformation, played through in its moment, over whatever else applies. */
  force: ChibiPick | null;
}

/** The frame `k` (0 to 1) of the way through a clip played in one go. */
function through(t: ClipTiming, k: number): number {
  return Math.min(lastFrame(t), Math.max(0, Math.floor(k * t.frames)));
}

/**
 * Which sprite and clip a hero who takes forms shows. When the form begins, the hero's `ult` clip
 * plays (flames engulf them), then the form's `ult` once (it emerges); then the form fights with
 * its own clips (stances, running and its attack chain, never a flinch, kneel or fall). When it
 * ends, the form's `cast` clip plays (it collapses into flame) and the hero returns, at once if
 * they act. Until the form's chibi is painted, the hero keeps their own look throughout.
 */
export function formShow(input: FormShowInput): FormShow {
  const { now, seen, act, down, hero, form, emerge } = input;
  const plain: FormShow = { form: false, act, steady: false, force: null };
  if (!seen || down) return plain;
  if (seen.endedAt === null) {
    if (!form) return { ...plain, steady: true };
    const since = now - seen.at;
    const half = Math.max(0.05, emerge / 2);
    if (since < half) return { form: false, act: null, steady: true, force: { clip: 'ult', frame: through(hero.ult, since / half) } };
    if (since < half * 2) return { form: true, act: null, steady: true, force: { clip: 'ult', frame: through(form.ult, (since - half) / half) } };
    // Its own blows only: the server refuses a form every skill, so nothing else is its own.
    return { form: true, act: act && act.at > seen.at && act.k === 'atk' ? act : null, steady: true, force: null };
  }
  const after = now - seen.endedAt;
  if (form && after >= 0 && after < FORM_COLLAPSE && !(act && act.at > seen.endedAt)) {
    return { form: true, act: null, steady: true, force: { clip: 'cast', frame: through(form.cast, after / FORM_COLLAPSE) } };
  }
  return plain;
}

/**
 * The clips a form ever shows (see `formShow`): it stands, runs and strikes with its own combo,
 * emerges in its `ult`, collapses in its `cast` and cheers a cleared dungeon, but takes no skills
 * and never flinches, kneels or falls, so the game paints only these (sprites.ts).
 */
export const FORM_CLIPS: readonly ChibiClip[] = ['idle', 'battle', 'move', ...COMBO_CLIPS, 'ult', 'cast', 'victory'];

/**
 * The clip and frame a hero shows, given how their form shows now (`formShow`, or null for a hero
 * with no form): a moment of the transformation over everything, else `chibiClip` on the act the
 * form allows, without a flinch or a kneel while the form holds steady.
 */
export function shownClip(input: ChibiInput, show: FormShow | null): ChibiPick {
  if (!show) return chibiClip(input);
  if (show.force) return show.force;
  return chibiClip({ ...input, act: show.act, hurtAt: show.steady ? null : input.hurtAt, hp: show.steady ? input.maxHp : input.hp });
}
