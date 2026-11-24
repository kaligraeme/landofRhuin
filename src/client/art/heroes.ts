/** The four hero archetypes. Each is drawn facing right with an empty weapon hand. */
import type { RoleId } from '../../shared/content/classes.js';
import { arm, circ, ell, eyes, flat, glow, legs, limb, line, OL, part, RIGS, shade, svgDoc, torsoPath, type SpriteDef } from './kit.js';

/** Tank: a horned dark knight with a fur collar, spiked pauldrons and a crimson cape. */
function tank(): SpriteDef {
  const r = RIGS.heavy;
  const steel = '#4d5463';
  const steelD = '#353a45';
  const red = '#8e1f22';
  const gold = '#d6a94b';
  const fur = '#6f4c30';
  const bone = '#e4d8bd';
  let s = '';
  // Cape, behind everything.
  s += part('M 30 50 Q 50 43 70 50 L 81 106 Q 73 113 65 106 Q 57 114 49 107 Q 41 114 33 107 Q 24 113 19 104 Z', red, { shadeX: 60 });
  s += arm(r, 'back', steelD, '#2b2f37', { width: 11.5 });
  s += legs(r, steelD, '#24272e', { bootH: 13, kneeGuard: steel });
  s += part(torsoPath(r), steel, { shadeX: 60 });
  // Plate seams and a crimson tabard.
  s += line('M 33 64 Q 50 70 67 64', OL, 1.6, 0.55);
  s += line('M 34 74 Q 50 79 66 74', OL, 1.6, 0.45);
  s += part('M 44 60 L 58 60 L 60 99 L 51 103 L 42 99 Z', red, { shadeX: 55 });
  s += flat('M 51 66 L 55 72 L 51 78 L 47 72 Z', gold, true, 1.4);
  s += part('M 31 81 L 69 81 L 68 88 L 32 88 Z', '#3a2618', { shadeX: 60 });
  s += part('M 46 79.5 L 56 79.5 L 56 89.5 L 46 89.5 Z', gold);
  // Back pauldron.
  s += part('M 16 58 Q 15 42 30 41 Q 41 43 40 55 Q 29 62 16 58 Z', steel, { shadeX: 31 });
  s += flat('M 20 45 L 17 34 L 25 42 Z', bone, true, 1.4);
  // Fur collar.
  s += part('M 30 53 Q 32 42 40 46 Q 44 39 51 44 Q 58 38 62 46 Q 70 42 72 53 Q 62 59 51 57 Q 40 59 30 53 Z', fur, { shadeX: 60 });
  // Horned helm with a glowing T visor.
  s += part('M 64 22 Q 76 17 80 3 Q 82 16 70 28 Z', bone, { shadeX: 76 });
  s += part('M 39 22 Q 28 18 24 5 Q 22 18 33 28 Z', bone, { shadeX: 31 });
  s += part('M 36 35 Q 35 14 51 14 Q 67 14 67 35 L 65 45 Q 51 50 38 45 Z', steel, { shadeX: 57 });
  s += line('M 51 14 L 51 24', OL, 1.6, 0.7);
  s += flat('M 44 27 L 65 27 L 65 31 L 58 31 L 58 41 L 53 41 L 53 31 L 44 31 Z', '#0c0a0b', false);
  s += glow(51, 29, 4.5, '#ff3b2e') + glow(61, 29, 4.5, '#ff3b2e');
  s += line('M 37 38 Q 51 44 66 38', OL, 1.4, 0.5);
  // Front arm and pauldron.
  s += arm(r, 'front', steelD, '#2b2f37', { width: 11.5, cuff: steel });
  s += part('M 59 55 Q 58 41 72 40 Q 86 42 86 57 Q 74 63 59 55 Z', steel, { shadeX: 76 });
  s += flat('M 67 44 L 66 31 L 73 42 Z', bone, true, 1.4) + flat('M 76 44 L 80 32 L 81 46 Z', bone, true, 1.4);
  s += line('M 62 52 Q 72 56 84 52', OL, 1.4, 0.5);
  return { svg: svgDoc(s, 0, -4, 100, 124), vx: 0, vy: -4, w: 100, h: 124, ax: 51, ay: 114, height: 2.15, hand: r.handF };
}

/** Mage: deep blue robes with gold trim and a tall, crooked pointy hat. */
function mage(): SpriteDef {
  const r = RIGS.normal;
  const robe = '#3a2f8c';
  const robeD = '#2a216a';
  const gold = '#e6c15c';
  const skin = '#f1c9a3';
  const hair = '#d9dbe6';
  let s = '';
  // Long silver hair behind the head.
  s += part('M 37 30 Q 34 48 40 58 L 50 54 L 62 58 Q 68 46 66 30 Z', hair, { shadeX: 58 });
  // Back sleeve and hand.
  s += part('M 40 55 Q 29 62 25 83 L 37 86 Q 39 72 46 62 Z', robeD, { shadeX: 36 });
  s += circ(31, 86, 4.6, skin);
  // Robe with a scalloped hem.
  s += part('M 39 50 Q 50 45 61 50 L 74 109 Q 68 115 62 110 Q 56 116 50 110 Q 44 116 38 110 Q 32 115 26 109 Z', robe, { shadeX: 56 });
  s += line('M 27 108 Q 32 113 38 109 Q 44 114 50 109 Q 56 114 62 109 Q 68 113 73 108', gold, 2.4);
  s += line('M 50 52 L 50 109', gold, 2.6);
  s += line('M 50 52 L 50 109', OL, 0.8, 0.4);
  // Rope belt with a pouch.
  s += part('M 38 76 Q 50 81 62 76 L 63 80 Q 50 85 37 80 Z', '#c99f58', { shadeX: 56 });
  s += part('M 56 81 L 63 80 L 64 89 Q 60 92 56 89 Z', '#7a5230', { shadeX: 61 });
  s += line('M 41 80 L 39 92', '#c99f58', 2) + line('M 43 81 L 42 90', '#c99f58', 2);
  // High collar.
  s += part('M 38 50 Q 50 58 62 50 L 60 44 Q 50 50 40 44 Z', robeD, { shadeX: 56 });
  // Face.
  s += part('M 38 32 Q 38 17 52 17 Q 66 17 66 32 Q 66 46 52 47 Q 38 46 38 32 Z', skin, { shadeX: 60 });
  s += eyes(52, 34, { size: 2.3 });
  s += `<ellipse cx="62" cy="39" rx="2.4" ry="1.4" fill="#f08f86" opacity="0.6"/>`;
  s += line('M 55 42 Q 57.5 43.5 60 42', '#7a3f2e', 1.3);
  // Hair framing the face.
  s += part('M 37 24 Q 36 38 39 46 L 43 34 Q 45 28 48 24 Z', hair, { shadeX: 44 });
  // Wide brim and a crooked cone with a star.
  s += part('M 35 21 Q 44 -6 57 -20 Q 64 -24 72 -17 Q 64 -15 61 -8 Q 64 8 67 21 Z', robe, { shadeX: 58 });
  s += part('M 26 23 Q 51 13 76 23 Q 51 31 26 23 Z', robe, { shadeX: 60, shadeY: 24 });
  s += part('M 36 18 Q 51 23 66 18 L 67 22 Q 51 27 35 22 Z', gold, { shadeX: 60 });
  s += flat('M 55 0 L 56.8 4 L 61 4.3 L 57.8 7 L 58.9 11 L 55 8.7 L 51.1 11 L 52.2 7 L 49 4.3 L 53.2 4 Z', gold, true, 1.2);
  // Front sleeve and the staff hand.
  s += part('M 59 55 Q 71 61 77 81 L 65 84 Q 63 71 55 62 Z', robe, { shadeX: 71 });
  s += line('M 66 83 L 77 80', gold, 2);
  s += circ(72, 83, 4.6, skin);
  return { svg: svgDoc(s, 0, -26, 100, 144), vx: 0, vy: -26, w: 100, h: 144, ax: 50, ay: 112, height: 2.55, hand: { x: 72, y: 83 } };
}

/** Ranger: Lincoln green, a feathered cap, a short cowl and a quiver of arrows. */
function ranger(): SpriteDef {
  const r = RIGS.normal;
  const green = '#3e8a3b';
  const greenD = '#2b6430';
  const leather = '#6f4524';
  const skin = '#e8b88f';
  let s = '';
  // Quiver on the back with fletchings.
  s += part('M 25 45 L 33 41 L 47 82 L 39 86 Z', leather, { shadeX: 38 });
  s += line('M 28 46 L 41 83', '#4b2d16', 1.2, 0.8);
  for (const [x, y, c] of [[24, 40, '#d23b2f'], [28, 37, '#f1efe6'], [32, 38, '#d23b2f']] as const) s += flat(`M ${x} ${y + 6} L ${x - 3} ${y} L ${x + 3} ${y + 1} Z`, c, true, 1.2);
  s += arm(r, 'back', greenD, skin, { cuff: leather });
  s += legs(r, '#6b5a3a', '#5a371c', { bootH: 15 });
  s += line('M 33 98 L 47 98', '#7d4f2b', 3) + line('M 53 98 L 67 98', '#7d4f2b', 3);
  // Tunic with a zigzag skirt.
  s += part('M 34 53 Q 50 47 66 53 L 67 84 L 71 95 L 64 91 L 58 96 L 52 91 L 46 96 L 40 91 L 32 95 L 35 84 Z', green, { shadeX: 58 });
  s += part('M 33 79 L 67 79 L 67 85 L 33 85 Z', leather, { shadeX: 58 });
  s += part('M 46 78 L 54 78 L 54 86 L 46 86 Z', '#d8b25a');
  s += line('M 50 55 L 50 78', greenD, 1.6);
  // Short cowl over the shoulders.
  s += part('M 31 51 Q 50 40 69 51 L 72 64 L 66 60 L 60 66 L 54 61 L 48 66 L 42 61 L 36 66 L 29 62 Z', greenD, { shadeX: 58 });
  // Face, hair and a small beard.
  s += part('M 38 33 Q 38 18 52 18 Q 66 18 66 33 Q 66 47 52 47 Q 38 47 38 33 Z', skin, { shadeX: 60 });
  s += part('M 38 26 Q 36 40 41 46 L 44 34 Z', '#8a4a24', { shadeX: 42 });
  s += part('M 52 46 Q 58 50 64 44 Q 62 41 59 43 Q 55 44 52 46 Z', '#8a4a24', { shadeX: 60 });
  s += eyes(52, 34, { size: 2.2 });
  s += line('M 55 41.5 Q 58.5 42.5 61 40', '#6b3524', 1.3);
  // Feathered cap with an upturned brim.
  s += part('M 46 13 Q 33 2 17 -3 Q 30 10 43 19 Z', '#c8342a', { shadeX: 36 });
  s += line('M 44 17 Q 31 6 19 -1', '#7b1d17', 1);
  s += part('M 34 27 Q 39 9 56 9 Q 71 11 78 24 Q 67 21 61 24 Q 50 19 34 27 Z', green, { shadeX: 62 });
  s += part('M 33 27 Q 50 18 67 22 L 72 27 Q 53 23 36 31 Z', greenD, { shadeX: 62 });
  s += arm(r, 'front', greenD, skin, { cuff: leather });
  return { svg: svgDoc(s, 0, -8, 100, 128), vx: 0, vy: -8, w: 100, h: 128, ax: 50, ay: 112, height: 2.05, hand: r.handF };
}

/** Melee: a lean brawler in an open vest and baggy trousers, with a red headband. */
function melee(): SpriteDef {
  const r = RIGS.lean;
  const skin = '#d9a079';
  const vest = '#24242c';
  const red = '#c3302a';
  const pants = '#323950';
  const wrap = '#e2dacb';
  let s = '';
  // Headband tails streaming behind.
  s += part('M 40 22 Q 26 26 14 36 Q 22 33 28 34 Q 20 40 16 48 Q 30 38 42 28 Z', red, { shadeX: 30 });
  s += arm(r, 'back', skin, skin, { cuff: wrap, handR: 5.2 });
  // Baggy trousers gathered by wraps at the ankle.
  s += part('M 36 81 L 49 82 L 47 104 L 36 104 Q 33 92 36 81 Z', pants, { shadeX: 44 });
  s += part('M 51 82 L 64 81 Q 68 92 64 104 L 53 104 Z', pants, { shadeX: 60 });
  s += part('M 36 102 L 47 102 L 47 108 L 36 108 Z', wrap) + part('M 53 102 L 64 102 L 64 108 L 53 108 Z', wrap);
  s += part('M 34 107 L 48 107 L 49 113 L 33 113 Z', '#2b211a', { shadeX: 44 }) + part('M 52 107 L 66 107 Q 71 109 70 113 L 52 113 Z', '#2b211a', { shadeX: 62 });
  // Bare torso with an open vest.
  s += part(torsoPath(r), skin, { shadeX: 58 });
  s += line('M 47 60 Q 50 62 53 60', '#9c6a4c', 1.2, 0.7) + line('M 47 68 Q 50 70 53 68', '#9c6a4c', 1.2, 0.6) + line('M 50 58 L 50 78', '#9c6a4c', 1, 0.45);
  s += part('M 35 53 Q 40 50 45 51 L 44 82 L 39 83 Q 36 70 35 53 Z', vest, { shadeX: 42 });
  s += part('M 55 51 Q 61 50 66 53 Q 65 70 62 83 L 56 82 Z', vest, { shadeX: 61 });
  // Sash with hanging ends.
  s += part('M 38 77 L 63 77 L 63 84 L 38 84 Z', red, { shadeX: 58 });
  s += part('M 60 82 L 66 83 L 69 97 L 63 95 Z', red, { shadeX: 66 });
  // Head: spiky hair and a confident look.
  s += part('M 38 32 Q 38 18 52 18 Q 66 18 66 32 Q 66 46 52 47 Q 38 46 38 32 Z', skin, { shadeX: 60 });
  s += part('M 36 30 L 33 18 L 40 21 L 39 10 L 46 17 L 49 6 L 54 15 L 60 7 L 61 17 L 69 13 L 66 23 L 70 26 L 64 27 Q 52 20 40 28 Z', '#1d1b24', { shadeX: 58 });
  s += part('M 38 24 Q 52 19 66 23 L 66 28 Q 52 24 38 29 Z', red, { shadeX: 60 });
  s += eyes(52, 35, { size: 2.1, angry: true });
  s += line('M 55 42 L 60 41', '#6b3524', 1.4);
  s += line('M 41 36 L 44 41', '#a8584a', 1.2, 0.8);
  s += arm(r, 'front', skin, skin, { cuff: wrap, handR: 5.2 });
  return { svg: svgDoc(s, 0, -2, 100, 120), vx: 0, vy: -2, w: 100, h: 120, ax: 50, ay: 113, height: 1.95, hand: r.handF };
}

export const HERO_SPRITES: Record<RoleId, () => SpriteDef> = { tank, mage, ranger, melee };
void ell;
void limb;
void shade;
