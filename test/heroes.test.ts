import { describe, expect, it } from 'vitest';
import { HERO_DESIGNS } from '../src/client/art/heroes/designs.js';
import { HERO_CHARGE, HERO_CLIP_LENGTH, HERO_WINDUP, heroClips, type HeroClip } from '../src/client/art/heroes/moves.js';
import { renderHero } from '../src/client/art/heroes/render.js';
import { FRAME_H, FRAME_W, GROUND_Y, solveLimb } from '../src/client/art/heroes/skeleton.js';
import { HERO_LOOKS, ROLE_ORDER, WEAPONS, weaponFor } from '../src/shared/content/classes.js';

const CLIPS: HeroClip[] = ['idle', 'battle', 'move', 'action', 'skill'];
const designs = Object.values(HERO_DESIGNS);

/** Which painted weapon each hero's weapon kit is drawn as. */
const DRAWN_AS: Record<string, string> = {
  tank_greatsword: 'greatsword',
  battleaxe: 'battleaxe',
  staff: 'branchStaff',
  mystic_sword: 'mysticSword',
  crossbow: 'crossbow',
  bow: 'longbow',
  spear: 'halberd',
  greatsword: 'blade',
};

describe('hero designs', () => {
  it('dresses and arms every hero: a man and a woman for each role, each with their own weapon', () => {
    for (const role of ROLE_ORDER) {
      for (const look of HERO_LOOKS) {
        const d = HERO_DESIGNS[`hero-${role}-${look}`];
        expect(d, `${role} ${look}`).toBeDefined();
        const kit = weaponFor(role, look);
        expect(WEAPONS[kit]).toBeDefined();
        expect(d.weapon).toBe(DRAWN_AS[kit]);
      }
    }
    expect(HERO_DESIGNS['hero-mage-female'].weapon2).toBe('wand');
    expect(HERO_DESIGNS['hero-melee-female'].weapon2).toBe('blade');
  });

  it('choreographs every clip at its length, with a wind-up before the blow', () => {
    for (const d of designs) {
      const clips = heroClips(d.moveset);
      for (const clip of CLIPS) expect(clips[clip], `${d.id} ${clip}`).toHaveLength(HERO_CLIP_LENGTH[clip]);
    }
    expect(HERO_WINDUP).toBeLessThan(HERO_CLIP_LENGTH.action);
    expect(HERO_CHARGE).toBeLessThan(HERO_CLIP_LENGTH.skill);
  });
});

describe('hero frames', () => {
  const opaque = (f: { data: Uint8ClampedArray }) => {
    let n = 0;
    for (let i = 3; i < f.data.length; i += 4) if ((f.data[i] as number) === 255) n++;
    return n;
  };

  it.each(designs.map((d) => d.id))('%s paints every frame as a whole figure standing on the ground', (id) => {
    const d = HERO_DESIGNS[id];
    const clips = heroClips(d.moveset);
    for (const clip of CLIPS) {
      for (const pose of clips[clip]) {
        const f = renderHero(d, pose, null);
        expect(f.w).toBe(FRAME_W);
        expect(f.h).toBe(FRAME_H);
        expect(opaque(f)).toBeGreaterThan(600);
        // Feet on the ground unless leaping.
        if (pose.y >= 0 && pose.footF[1] === 0) {
          let ground = 0;
          for (let x = 0; x < f.w; x++) if ((f.data[((GROUND_Y - 2) * f.w + x) * 4 + 3] as number) > 0) ground++;
          expect(ground, `${id} ${clip}`).toBeGreaterThan(2);
        }
      }
    }
  });

  it('smears the swing and glows for a skill', () => {
    const d = HERO_DESIGNS['hero-tank-male'];
    const clips = heroClips(d.moveset);
    const strike = clips.action.find((p) => p.fx?.smear !== undefined)!;
    const f = renderHero(d, strike, null);
    let soft = 0;
    for (let i = 3; i < f.data.length; i += 4) if ((f.data[i] as number) > 0 && (f.data[i] as number) < 250) soft++;
    expect(soft).toBeGreaterThan(80);
    const charged = renderHero(d, { ...clips.skill[2]!, fx: { aura: 1 } }, null);
    const plain = renderHero(d, { ...clips.skill[2]!, fx: {} }, null);
    let glow = 0;
    for (let i = 3; i < charged.data.length; i += 4) if ((charged.data[i] as number) > 0 && (plain.data[i] as number) === 0) glow++;
    expect(glow).toBeGreaterThan(100);
  });

  it('keeps limb lengths when solving knees and elbows', () => {
    for (const target of [[30, 10], [0, 40], [-12, 20], [5, 5]] as [number, number][]) {
      const { mid, end } = solveLimb([0, 0], target, 22, 21, -1);
      expect(Math.hypot(mid[0], mid[1])).toBeCloseTo(22, 4);
      expect(Math.hypot(end[0] - mid[0], end[1] - mid[1])).toBeCloseTo(21, 4);
    }
  });
});
