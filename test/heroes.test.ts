import { describe, expect, it } from 'vitest';
import { HERO_DESIGNS } from '../src/client/art/heroes/designs.js';
import { HERO_CHARGE, HERO_CLIP_LENGTH, HERO_WINDUP, heroClips, type HeroClip } from '../src/client/art/heroes/moves.js';
import { renderHero } from '../src/client/art/heroes/render.js';
import { renderTurned, TURNED_H, TURNED_W, TURNED_Y } from '../src/client/art/heroes/turned.js';
import { FRAME_H, FRAME_W, GROUND_Y, solveLimb } from '../src/client/art/heroes/skeleton.js';
import { heroArtId, isPainted } from '../src/client/art/heroArt.js';
import { HERO_ORDER, WEAPONS, weaponFor } from '../src/shared/content/classes.js';

const CLIPS: HeroClip[] = ['idle', 'battle', 'move', 'action', 'skill'];
const designs = Object.values(HERO_DESIGNS);

/** Which painted weapon each hero's weapon kit is drawn as. */
const DRAWN_AS: Record<string, string> = {
  tank_greatsword: 'greatsword',
  sword_shield: 'knightSword',
  staff: 'branchStaff',
  mystic_sword: 'mysticSword',
  crossbow: 'crossbow',
  bow: 'longbow',
  spear: 'halberd',
  twin_blades: 'blade',
};

describe('hero designs', () => {
  it('dresses and arms every hero it paints, each with their own weapon', () => {
    for (const hero of HERO_ORDER.filter(isPainted)) {
      const d = HERO_DESIGNS[heroArtId(hero)];
      expect(d, hero).toBeDefined();
      const kit = weaponFor(hero);
      expect(WEAPONS[kit]).toBeDefined();
      expect(d.weapon).toBe(DRAWN_AS[kit]);
    }
    expect(HERO_DESIGNS['hero-spellblade'].weapon2).toBe('wand');
    expect(HERO_DESIGNS['hero-guardian'].weapon2).toBe('shield');
    expect(HERO_DESIGNS['hero-blademaster'].weapon2).toBe('blade');
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
    const d = HERO_DESIGNS['hero-dark-knight'];
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

  it.each(designs.map((d) => d.id))('%s turns toward the viewer and away in every frame', (id) => {
    const d = HERO_DESIGNS[id];
    const clips = heroClips(d.moveset);
    for (const clip of CLIPS) {
      const swing = clip === 'action' || clip === 'skill';
      clips[clip].forEach((pose, i) => {
        const front = renderTurned(d, pose, 'front', swing);
        const back = renderTurned(d, pose, 'back', swing);
        for (const f of [front, back]) {
          expect(f.w).toBe(TURNED_W);
          expect(f.h).toBe(TURNED_H);
          expect(opaque(f), `${id} ${clip} ${i}`).toBeGreaterThan(600);
          if (clip === 'idle' || clip === 'battle') {
            // Standing: the boots reach the ground line. (Mid-stride, a foot planted ahead sits
            // higher or lower on screen, as it should.)
            let feet = 0;
            for (let y = TURNED_Y - 3; y <= TURNED_Y + 10; y++) for (let x = 0; x < f.w; x++) if ((f.data[(y * f.w + x) * 4 + 3] as number) === 255) feet++;
            expect(feet, `${id} ${clip} ${i}`).toBeGreaterThan(8);
          }
        }
        // Front and back are different pictures, not a mirror of each other.
        let differ = 0;
        for (let k = 0; k < front.data.length; k += 4) if (front.data[k] !== back.data[k] || front.data[k + 3] !== back.data[k + 3]) differ++;
        expect(differ).toBeGreaterThan(300);
      });
    }
  });

  it('paints a face from the front and the back of the head from behind', () => {
    const d = HERO_DESIGNS['hero-sage'];
    const pose = heroClips(d.moveset).idle[0]!;
    const count = (f: { data: Uint8ClampedArray }, rgb: readonly number[]) => {
      let n = 0;
      for (let i = 0; i < f.data.length; i += 4) if (f.data[i] === rgb[0] && f.data[i + 1] === rgb[1] && f.data[i + 2] === rgb[2] && f.data[i + 3] === 255) n++;
      return n;
    };
    const front = renderTurned(d, pose, 'front', false);
    const back = renderTurned(d, pose, 'back', false);
    // Eyes from the front only; more grey hair from behind (his beard aside).
    expect(count(front, [34, 24, 30])).toBe(2);
    expect(count(back, [34, 24, 30])).toBe(0);
    expect(count(back, d.hairdo.ramp[1])).toBeGreaterThan(count(front, d.hairdo.ramp[1]) - 20);
  });

  it('keeps limb lengths when solving knees and elbows', () => {
    for (const target of [[30, 10], [0, 40], [-12, 20], [5, 5]] as [number, number][]) {
      const { mid, end } = solveLimb([0, 0], target, 22, 21, -1);
      expect(Math.hypot(mid[0], mid[1])).toBeCloseTo(22, 4);
      expect(Math.hypot(end[0] - mid[0], end[1] - mid[1])).toBeCloseTo(21, 4);
    }
  });
});
