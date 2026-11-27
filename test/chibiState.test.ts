import { describe, expect, it } from 'vitest';
import { SKILLS, WEAPONS } from '../src/shared/content/classes.js';
import type { ChibiClip, ClipTiming } from '../src/client/art/heroes/chibi/index.js';
import { CHIBI_CLIPS, CHIBI_HEROES, SLOT_CLIPS } from '../src/client/art/heroes/chibi/index.js';
import { actClip, actFrame, chibiClip, type ChibiInput } from '../src/client/game/chibiState.js';

/**
 * A fixed timing table, so the tests do not move when the painter retimes its clips. The flinch
 * takes longer than any hero's does today, so its window is seen to follow the clip's own time.
 */
const T: Record<ChibiClip, ClipTiming> = {
  idle: { frames: 6, seconds: 1.6, windup: 0 },
  battle: { frames: 6, seconds: 0.9, windup: 0 },
  move: { frames: 8, seconds: 0.6, windup: 0 },
  atk1: { frames: 7, seconds: 0.35, windup: 1 },
  atk2: { frames: 7, seconds: 0.35, windup: 1 },
  atk3: { frames: 9, seconds: 0.7, windup: 2 },
  special: { frames: 4, seconds: 1, windup: 0 },
  q: { frames: 8, seconds: 0.45, windup: 1 },
  e: { frames: 10, seconds: 0.55, windup: 1 },
  r: { frames: 10, seconds: 0.8, windup: 2 },
  ult: { frames: 16, seconds: 1.5, windup: 2 },
  cast: { frames: 8, seconds: 0.6, windup: 2 },
  hurt: { frames: 3, seconds: 0.45, windup: 0 },
  kneel: { frames: 4, seconds: 1.6, windup: 0 },
  ko: { frames: 6, seconds: 0.9, windup: 0 },
  victory: { frames: 8, seconds: 1.6, windup: 0 },
};

const NOW = 100;

/** A hero standing about at full health, out of combat. */
const input = (over: Partial<ChibiInput> = {}): ChibiInput => ({
  timing: T,
  now: NOW,
  id: 3,
  down: false,
  downAt: null,
  complete: false,
  completeAt: null,
  act: null,
  rolling: false,
  moving: false,
  phase: 0,
  hurtAt: null,
  hp: 1000,
  maxHp: 1000,
  fighting: false,
  ...over,
});

const clipAt = (over: Partial<ChibiInput>) => chibiClip(input(over)).clip;

/** The frames a looping clip shows over one cycle, sampled finely. */
function cycle(over: Partial<ChibiInput>, seconds: number): Set<number> {
  const seen = new Set<number>();
  for (let t = 0; t < seconds; t += seconds / 200) seen.add(chibiClip(input({ ...over, now: NOW + t })).frame);
  return seen;
}

describe('chibi stances', () => {
  it('idles out of combat, looping every frame over the clip, staggered per hero', () => {
    expect(clipAt({})).toBe('idle');
    expect(cycle({}, T.idle.seconds)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
    // Same moment, different heroes: not every pair is in step.
    const frames = [1, 2, 3, 4, 5].map((id) => chibiClip(input({ id })).frame);
    expect(new Set(frames).size).toBeGreaterThan(1);
  });

  it('takes a battle stance near a fight', () => {
    expect(clipAt({ fighting: true })).toBe('battle');
    expect(cycle({ fighting: true }, T.battle.seconds)).toEqual(new Set([0, 1, 2, 3, 4, 5]));
  });

  it('kneels below a quarter of their health', () => {
    expect(clipAt({ hp: 249 })).toBe('kneel');
    expect(clipAt({ hp: 249, fighting: true })).toBe('kneel');
    expect(clipAt({ hp: 250 })).toBe('idle');
    expect(cycle({ hp: 100 }, T.kneel.seconds)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('flinches for as long as its hurt clip lasts after a blow gets through, playing it once', () => {
    expect(chibiClip(input({ hurtAt: NOW }))).toEqual({ clip: 'hurt', frame: 0 });
    expect(chibiClip(input({ hurtAt: NOW - 0.16 }))).toEqual({ clip: 'hurt', frame: 1 });
    expect(chibiClip(input({ hurtAt: NOW - 0.35 }))).toEqual({ clip: 'hurt', frame: 2 });
    expect(chibiClip(input({ hurtAt: NOW - 0.44 }))).toEqual({ clip: 'hurt', frame: 2 });
    expect(clipAt({ hurtAt: NOW - 0.46 })).toBe('idle');
    expect(clipAt({ hurtAt: null })).toBe('idle');
  });

  it('runs by stride phase, and cycles the run while dodging', () => {
    expect(chibiClip(input({ moving: true, phase: 0 }))).toEqual({ clip: 'move', frame: 0 });
    expect(chibiClip(input({ moving: true, phase: Math.PI }))).toEqual({ clip: 'move', frame: 4 });
    expect(chibiClip(input({ moving: true, phase: Math.PI * 2 - 0.01 }))).toEqual({ clip: 'move', frame: 7 });
    expect(chibiClip(input({ moving: true, phase: Math.PI * 2 * 3 + Math.PI / 2 }))).toEqual({ clip: 'move', frame: 2 });
    expect(chibiClip(input({ rolling: true, phase: Math.PI }))).toEqual({ clip: 'move', frame: 4 });
  });
});

describe('chibi attacks and skills', () => {
  it('plays the combo hit the server named, atk1 when it named none', () => {
    expect(actClip({ k: 'atk', c: 0 })).toBe('atk1');
    expect(actClip({ k: 'atk', c: 1 })).toBe('atk2');
    expect(actClip({ k: 'atk', c: 2 })).toBe('atk3');
    expect(actClip({ k: 'atk', c: 4 })).toBe('atk2');
    expect(actClip({ k: 'atk' })).toBe('atk1');
    expect(clipAt({ act: { at: NOW, k: 'atk', d: 0, c: 2 } })).toBe('atk3');
  });

  it("plays each weapon skill its hotbar slot's clip, and role skills and items a cast", () => {
    expect(actClip({ k: 'sk', s: 'parry' })).toBe('special');
    expect(actClip({ k: 'sk', s: 'stalwartCharge' })).toBe('q');
    expect(actClip({ k: 'sk', s: 'eclipse' })).toBe('e');
    expect(actClip({ k: 'sk', s: 'drain' })).toBe('r');
    expect(actClip({ k: 'sk', s: 'ruination' })).toBe('ult');
    // Another weapon's skills play the same slots' clips.
    expect(actClip({ k: 'sk', s: 'mendingLight' })).toBe('special');
    expect(actClip({ k: 'sk', s: 'astralCleave' })).toBe('ult');
    expect(actClip({ k: 'sk', s: 'challenge' })).toBe('cast');
    expect(actClip({ k: 'sk', s: 'rallyingBulwark' })).toBe('cast');
    expect(actClip({ k: 'sk', s: 'elixir' })).toBe('cast');
    expect(actClip({ k: 'sk', s: 'noSuchSkill' })).toBe('cast');
    expect(actClip({ k: 'sk' })).toBe('cast');
    // A skill id that happens to name an Object property is still just a role skill.
    expect(actClip({ k: 'sk', s: 'toString' })).toBe('cast');
  });

  it("gives every weapon's five skills a clip of their own", () => {
    for (const weapon of Object.values(WEAPONS)) {
      const clips = weapon.skills.map((s) => actClip({ k: 'sk', s }));
      expect(new Set(clips).size, weapon.id).toBe(5);
      for (const [i, clip] of clips.entries()) {
        expect(SLOT_CLIPS, `${weapon.id} ${weapon.skills[i]}`).toContain(clip);
        expect(clip).toBe(SKILLS[weapon.skills[i] as string]?.slot);
      }
    }
  });

  it("stretches the wind-up frames over the server's wind-up, then plays the rest in the clip's time", () => {
    const act = (t: number) => chibiClip(input({ now: NOW + t, act: { at: NOW, k: 'atk', d: 0.5, c: 2 } }));
    // atk3: two wind-up frames over 0.5s ...
    expect(act(0)).toEqual({ clip: 'atk3', frame: 0 });
    expect(act(0.24)).toEqual({ clip: 'atk3', frame: 0 });
    expect(act(0.26)).toEqual({ clip: 'atk3', frame: 1 });
    expect(act(0.49)).toEqual({ clip: 'atk3', frame: 1 });
    // ... then seven frames over 0.7s, 0.1s each ...
    expect(act(0.5)).toEqual({ clip: 'atk3', frame: 2 });
    expect(act(0.65)).toEqual({ clip: 'atk3', frame: 3 });
    expect(act(1.15)).toEqual({ clip: 'atk3', frame: 8 });
    // ... and then it is over.
    expect(act(1.21).clip).toBe('idle');
  });

  it('gives each wind-up frame 0.06s when the server times no wind-up', () => {
    const cast = (t: number) => chibiClip(input({ now: NOW + t, act: { at: NOW, k: 'sk', d: 0, s: 'challenge' } }));
    expect(cast(0.05)).toEqual({ clip: 'cast', frame: 0 });
    expect(cast(0.07)).toEqual({ clip: 'cast', frame: 1 });
    expect(cast(0.125)).toEqual({ clip: 'cast', frame: 2 });
    // The other six frames take 0.6s.
    expect(cast(0.12 + 0.55)).toEqual({ clip: 'cast', frame: 7 });
    expect(cast(0.12 + 0.61).clip).toBe('idle');
  });

  it('holds the first frame through a server wind-up when the clip has no wind-up frames', () => {
    expect(actFrame(T.special, 0.3, 0.4)).toBe(0);
    expect(actFrame(T.special, 0.4, 0.4)).toBe(0);
    expect(actFrame(T.special, 0.4 + 0.26, 0.4)).toBe(1);
    expect(actFrame(T.special, 0.4 + 0.99, 0.4)).toBe(3);
    expect(actFrame(T.special, 0.4 + 1.01, 0.4)).toBeNull();
    // Without one it starts on its first frame and plays straight through.
    expect(actFrame(T.special, 0, 0)).toBe(0);
    expect(actFrame(T.special, 0.76, 0)).toBe(3);
    expect(actFrame(T.special, 1, 0)).toBeNull();
  });
});

describe('chibi knock-outs and victory', () => {
  it('falls over the ko clip from when they went down, then lies still', () => {
    expect(chibiClip(input({ down: true, downAt: NOW }))).toEqual({ clip: 'ko', frame: 0 });
    expect(chibiClip(input({ down: true, downAt: NOW - 0.31 }))).toEqual({ clip: 'ko', frame: 2 });
    expect(chibiClip(input({ down: true, downAt: NOW - 0.89 }))).toEqual({ clip: 'ko', frame: 5 });
    expect(chibiClip(input({ down: true, downAt: NOW - 30 }))).toEqual({ clip: 'ko', frame: 5 });
  });

  it('lies on the last ko frame when nobody saw them fall', () => {
    expect(chibiClip(input({ down: true, downAt: null }))).toEqual({ clip: 'ko', frame: 5 });
  });

  it('strikes the victory pose once the dungeon is complete, holding its last frame', () => {
    expect(chibiClip(input({ complete: true, completeAt: NOW }))).toEqual({ clip: 'victory', frame: 0 });
    expect(chibiClip(input({ complete: true, completeAt: NOW - 0.9 }))).toEqual({ clip: 'victory', frame: 4 });
    expect(chibiClip(input({ complete: true, completeAt: NOW - 10 }))).toEqual({ clip: 'victory', frame: 7 });
    expect(chibiClip(input({ complete: true, completeAt: null }))).toEqual({ clip: 'victory', frame: 7 });
  });

  it('still runs, rolls and swings after the dungeon is complete', () => {
    const done = { complete: true, completeAt: NOW - 5 };
    const strides = new Set<string>();
    for (let k = 0; k < 64; k++) {
      const pick = chibiClip(input({ ...done, moving: true, phase: (k / 64) * Math.PI * 2 }));
      strides.add(`${pick.clip}:${pick.frame}`);
    }
    expect(strides).toEqual(new Set(Array.from({ length: T.move.frames }, (_, i) => `move:${i}`)));
    expect(clipAt({ ...done, rolling: true })).toBe('move');
    expect(chibiClip(input({ ...done, act: { at: NOW - 0.2, k: 'atk', d: 0, c: 2 } })).clip).toBe('atk3');
    // An ultimate still playing out when the last boss falls finishes before the pose.
    expect(clipAt({ complete: true, completeAt: NOW, act: { at: NOW - 0.5, k: 'sk', d: 0, s: 'ruination' } })).toBe('ult');
    // Standing still again, he holds the pose.
    expect(chibiClip(input(done))).toEqual({ clip: 'victory', frame: 7 });
  });
});

describe('chibi clip priority', () => {
  it('ko > act > roll > run > victory > flinch > kneel > battle > idle', () => {
    const all: Partial<ChibiInput> = {
      down: true,
      downAt: NOW - 0.1,
      complete: true,
      completeAt: NOW - 0.1,
      act: { at: NOW - 0.05, k: 'sk', d: 0, s: 'eclipse' },
      rolling: true,
      moving: true,
      phase: 1,
      hurtAt: NOW - 0.1,
      hp: 100,
      fighting: true,
    };
    const order: [ChibiClip, Partial<ChibiInput>][] = [
      ['ko', { down: false }],
      ['e', { act: null }],
      ['move', { rolling: false }],
      ['move', { moving: false }],
      ['victory', { complete: false }],
      ['hurt', { hurtAt: null }],
      ['kneel', { hp: 1000 }],
      ['battle', { fighting: false }],
      ['idle', {}],
    ];
    let state = { ...all };
    for (const [clip, peel] of order) {
      expect(clipAt(state)).toBe(clip);
      state = { ...state, ...peel };
    }
  });

  it('an act that has played out gives way to what the hero is doing', () => {
    const act = { at: NOW - 5, k: 'atk' as const, d: 0, c: 1 };
    expect(clipAt({ act, fighting: true })).toBe('battle');
    expect(clipAt({ act, moving: true })).toBe('move');
    expect(clipAt({ act, hurtAt: NOW })).toBe('hurt');
  });

  it("works with the painter's own timing for every clip", () => {
    const hero = CHIBI_HEROES['hero-dark-knight'];
    expect(hero).toBeDefined();
    for (const clip of CHIBI_CLIPS) {
      const t = hero!.timing[clip];
      expect(t.frames).toBeGreaterThan(0);
      expect(t.windup).toBeLessThanOrEqual(t.frames);
    }
    for (let i = 0; i < 3; i++) {
      for (let t = 0; t < 3; t += 0.05) {
        const pick = chibiClip({ ...input({ now: NOW + t, act: { at: NOW, k: 'atk', d: 0, c: i } }), timing: hero!.timing });
        expect(pick.frame).toBeGreaterThanOrEqual(0);
        expect(pick.frame).toBeLessThan(hero!.timing[pick.clip].frames);
      }
    }
  });
});
