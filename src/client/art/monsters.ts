/** Monsters and bosses for the three clans: Orcs, Dragons and their cultists, and the Undead. */
import type { BossKind, MobKind, ThemeId } from '../../shared/content/monsters.js';
import { arm, circ, ell, eyes, flat, glow, legs, limb, line, OL, part, RIGS, shade, svgDoc, torsoPath, type Build, type Rig, type SpriteDef } from './kit.js';

// ── Shared parts ───────────────────────────────────────────────────────────────────────────

type HeadKind = 'orc' | 'goblin' | 'skull' | 'human' | 'drakonid' | 'void' | 'helm';
type Hat = 'none' | 'mohawk' | 'skullMask' | 'dragonMask' | 'crown' | 'hood' | 'hornHelm' | 'tuskCrown' | 'horns' | 'bigHood' | 'priestess';
type Weapon = 'none' | 'axe' | 'cleaver' | 'dagger' | 'bow' | 'crossbow' | 'staffSkull' | 'staffFlame' | 'staffGreen' | 'sword' | 'greatsword' | 'club' | 'greataxe' | 'scythe' | 'claws';
type Torso = 'bare' | 'leather' | 'armor' | 'robe' | 'ribs' | 'rags' | 'scales' | 'rock';

interface HumanoidOpts {
  build: Build;
  skin: string;
  head: HeadKind;
  headColor?: string;
  hat?: Hat;
  hatColor?: string;
  eyeGlow?: string;
  torso: Torso;
  torsoColor: string;
  trim?: string;
  legsColor?: string;
  boots?: string;
  sleeves?: string;
  pauldrons?: string;
  spikes?: string;
  cape?: string;
  fur?: string;
  weapon?: Weapon;
  offhand?: 'shield' | 'none' | 'dagger';
  shieldColor?: string;
  floating?: boolean;
  hunched?: boolean;
  extra?: string;
}

const BONE = '#e6dcc4';
const BONE_D = '#b9ab8d';

function headSvg(r: Rig, o: HumanoidOpts): string {
  const { hx, hy, hr } = r;
  const c = o.headColor ?? o.skin;
  switch (o.head) {
    case 'orc':
    case 'goblin': {
      const goblin = o.head === 'goblin';
      let s = '';
      // Ears.
      s += part(`M ${hx - hr + 2} ${hy - 3} L ${hx - hr - (goblin ? 14 : 8)} ${hy - (goblin ? 10 : 7)} L ${hx - hr + 3} ${hy + 5} Z`, c, { shadeX: hx - hr - 2 });
      if (goblin) s += part(`M ${hx + hr - 2} ${hy - 4} L ${hx + hr + 13} ${hy - 11} L ${hx + hr - 1} ${hy + 4} Z`, c, { shadeX: hx + hr + 4 });
      // A broad jaw.
      s += part(`M ${hx - hr} ${hy - 1} Q ${hx - hr} ${hy - hr} ${hx + 1} ${hy - hr} Q ${hx + hr + 1} ${hy - hr} ${hx + hr + 2} ${hy} Q ${hx + hr + 3} ${hy + hr * 0.95} ${hx + 2} ${hy + hr + 1} Q ${hx - hr - 1} ${hy + hr * 0.9} ${hx - hr} ${hy - 1} Z`, c, { shadeX: hx + hr * 0.5 });
      s += eyes(hx, hy - 1, { size: goblin ? 2.8 : 2.2, angry: true, color: goblin ? '#3a2a00' : '#2a0c08' });
      if (goblin) s += `<ellipse cx="${hx + 2}" cy="${hy - 1}" rx="2.5" ry="2.8" fill="#ffe23a" opacity="0.55"/><ellipse cx="${hx + 9}" cy="${hy - 1}" rx="2.5" ry="2.8" fill="#ffe23a" opacity="0.55"/>`;
      // Nose and tusks.
      s += flat(`M ${hx + 6} ${hy + 2} Q ${hx + 11} ${hy + 5} ${hx + 6} ${hy + 7} Z`, shade(c, -0.25), true, 1.2);
      if (!goblin) s += flat(`M ${hx + 1} ${hy + hr - 4} L ${hx + 2.5} ${hy + 4} L ${hx + 4.5} ${hy + hr - 4} Z`, BONE, true, 1.2) + flat(`M ${hx + 10} ${hy + hr - 5} L ${hx + 12} ${hy + 4} L ${hx + 13.5} ${hy + hr - 6} Z`, BONE, true, 1.2);
      else s += line(`M ${hx + 3} ${hy + 9} Q ${hx + 7} ${hy + 11} ${hx + 11} ${hy + 8}`, OL, 1.3);
      return s;
    }
    case 'skull': {
      let s = part(`M ${hx - hr} ${hy} Q ${hx - hr} ${hy - hr - 1} ${hx + 1} ${hy - hr - 1} Q ${hx + hr + 1} ${hy - hr - 1} ${hx + hr + 1} ${hy} Q ${hx + hr} ${hy + 7} ${hx + 7} ${hy + 9} L ${hx - 5} ${hy + 9} Q ${hx - hr} ${hy + 7} ${hx - hr} ${hy} Z`, BONE, { shadeX: hx + hr * 0.5 });
      s += part(`M ${hx - 5} ${hy + 8} L ${hx + 9} ${hy + 8} L ${hx + 8} ${hy + 14} L ${hx - 3} ${hy + 14} Z`, BONE_D, { shadeX: hx + 5 });
      s += line(`M ${hx - 1} ${hy + 9} L ${hx - 1} ${hy + 13} M ${hx + 2.5} ${hy + 9} L ${hx + 2.5} ${hy + 13} M ${hx + 6} ${hy + 9} L ${hx + 6} ${hy + 13}`, OL, 1);
      s += flat(`M ${hx - 4} ${hy - 5} Q ${hx + 1} ${hy - 7} ${hx + 2} ${hy - 1} Q ${hx - 1} ${hy + 3} ${hx - 4} ${hy - 1} Z`, '#120d0b', false);
      s += flat(`M ${hx + 6} ${hy - 5} Q ${hx + 12} ${hy - 7} ${hx + 12} ${hy - 1} Q ${hx + 9} ${hy + 3} ${hx + 6} ${hy - 1} Z`, '#120d0b', false);
      s += flat(`M ${hx + 4} ${hy + 2} L ${hx + 6} ${hy + 6} L ${hx + 2} ${hy + 6} Z`, '#120d0b', false);
      if (o.eyeGlow) s += glow(hx - 1, hy - 3, 4.5, o.eyeGlow) + glow(hx + 9, hy - 3, 4.5, o.eyeGlow);
      s += line(`M ${hx - 8} ${hy - 10} L ${hx - 5} ${hy - 6} L ${hx - 7} ${hy - 3}`, OL, 1, 0.6);
      return s;
    }
    case 'drakonid': {
      let s = '';
      s += part(`M ${hx - 6} ${hy - 9} Q ${hx - 16} ${hy - 16} ${hx - 22} ${hy - 26} Q ${hx - 12} ${hy - 20} ${hx - 2} ${hy - 13} Z`, BONE_D, { shadeX: hx - 12 });
      s += part(`M ${hx - hr + 1} ${hy + 2} Q ${hx - hr} ${hy - hr} ${hx} ${hy - hr} Q ${hx + 10} ${hy - hr} ${hx + 14} ${hy - 4} L ${hx + hr + 13} ${hy + 1} Q ${hx + hr + 15} ${hy + 6} ${hx + hr + 9} ${hy + 9} L ${hx + 4} ${hy + 11} Q ${hx - hr} ${hy + 11} ${hx - hr + 1} ${hy + 2} Z`, c, { shadeX: hx + 8 });
      s += part(`M ${hx + 2} ${hy + 6} L ${hx + hr + 10} ${hy + 6} Q ${hx + hr + 8} ${hy + 10} ${hx + 4} ${hy + 12} Z`, shade(c, 0.35), { shadeX: hx + 14 });
      s += `<ellipse cx="${hx + 6}" cy="${hy - 3}" rx="3.2" ry="2.6" fill="#ffd23a" stroke="${OL}" stroke-width="1.2"/><rect x="${hx + 5.4}" y="${hy - 5.4}" width="1.3" height="4.8" fill="${OL}"/>`;
      s += circ(hx + hr + 10, hy + 1, 1.1, OL, { shade: false, stroke: false });
      s += flat(`M ${hx - 4} ${hy - 12} L ${hx - 1} ${hy - 19} L ${hx + 2} ${hy - 12} Z M ${hx + 3} ${hy - 13} L ${hx + 7} ${hy - 19} L ${hx + 8} ${hy - 12} Z`, shade(c, -0.3), true, 1.2);
      return s;
    }
    case 'void':
      return part(`M ${hx - hr} ${hy + 4} Q ${hx - hr} ${hy - hr - 2} ${hx + 1} ${hy - hr - 2} Q ${hx + hr + 1} ${hy - hr - 2} ${hx + hr + 1} ${hy + 4} Q ${hx} ${hy + hr + 2} ${hx - hr} ${hy + 4} Z`, '#0c0910', { hi: false }) + glow(hx + 1, hy, 4.5, o.eyeGlow ?? '#6dffb0') + glow(hx + 9, hy, 4.5, o.eyeGlow ?? '#6dffb0');
    case 'helm': {
      const m = o.headColor ?? '#3a3f4a';
      let s = part(`M ${hx - hr} ${hy + 3} Q ${hx - hr - 1} ${hy - hr - 2} ${hx + 1} ${hy - hr - 2} Q ${hx + hr + 2} ${hy - hr - 2} ${hx + hr + 1} ${hy + 3} L ${hx + hr - 1} ${hy + 12} Q ${hx} ${hy + 16} ${hx - hr + 1} ${hy + 12} Z`, m, { shadeX: hx + 6 });
      s += flat(`M ${hx - 6} ${hy - 1} L ${hx + hr + 1} ${hy - 2} L ${hx + hr} ${hy + 2} L ${hx - 6} ${hy + 3} Z`, '#09070a', false);
      s += glow(hx + 1, hy + 0.5, 4, o.eyeGlow ?? '#7fdcff') + glow(hx + 9, hy, 4, o.eyeGlow ?? '#7fdcff');
      s += line(`M ${hx + 1} ${hy - hr - 2} L ${hx + 1} ${hy - 4}`, OL, 1.4, 0.7);
      return s;
    }
    default: {
      let s = part(`M ${hx - hr + 1} ${hy + 1} Q ${hx - hr + 1} ${hy - hr} ${hx + 1} ${hy - hr} Q ${hx + hr + 1} ${hy - hr} ${hx + hr + 1} ${hy + 1} Q ${hx + hr + 1} ${hy + hr} ${hx + 1} ${hy + hr} Q ${hx - hr + 1} ${hy + hr} ${hx - hr + 1} ${hy + 1} Z`, c, { shadeX: hx + 8 });
      s += o.eyeGlow ? glow(hx + 1, hy + 1, 4, o.eyeGlow) + glow(hx + 9, hy + 1, 4, o.eyeGlow) : eyes(hx, hy + 1, { size: 2.1, angry: true });
      return s;
    }
  }
}

function hatSvg(r: Rig, o: HumanoidOpts): string {
  const { hx, hy, hr } = r;
  const col = o.hatColor ?? '#5a3a24';
  switch (o.hat) {
    case 'mohawk':
      return part(`M ${hx - 8} ${hy - hr + 3} L ${hx - 6} ${hy - hr - 8} L ${hx - 1} ${hy - hr - 2} L ${hx + 2} ${hy - hr - 11} L ${hx + 6} ${hy - hr - 2} L ${hx + 10} ${hy - hr - 8} L ${hx + 10} ${hy - hr + 3} Q ${hx + 1} ${hy - hr - 1} ${hx - 8} ${hy - hr + 3} Z`, col, { shadeX: hx + 4 });
    case 'hood':
      return part(`M ${hx - hr - 3} ${hy + 10} Q ${hx - hr - 5} ${hy - hr - 6} ${hx + 3} ${hy - hr - 6} Q ${hx + hr + 6} ${hy - hr - 4} ${hx + hr + 4} ${hy - 2} Q ${hx + 4} ${hy - hr + 2} ${hx - hr + 4} ${hy + 10} Z`, col, { shadeX: hx + 4 });
    case 'bigHood':
      return part(`M ${hx - hr - 5} ${hy + 14} Q ${hx - hr - 7} ${hy - hr - 9} ${hx + 3} ${hy - hr - 11} Q ${hx + hr + 9} ${hy - hr - 6} ${hx + hr + 6} ${hy + 4} Q ${hx + hr + 1} ${hy - hr + 3} ${hx + 2} ${hy - hr + 3} Q ${hx - hr + 2} ${hy - hr + 4} ${hx - hr + 1} ${hy + 14} Z`, col, { shadeX: hx + 6 });
    case 'skullMask': {
      let s = '';
      for (const [dx, h, c] of [[-10, 18, '#c8342a'], [-4, 24, '#2f6fb3'], [3, 22, '#e7c15c'], [9, 17, '#c8342a']] as const) s += part(`M ${hx + dx - 3} ${hy - hr + 2} Q ${hx + dx - 2} ${hy - hr - h} ${hx + dx + 3} ${hy - hr - h + 2} Q ${hx + dx + 3} ${hy - hr - 4} ${hx + dx + 3} ${hy - hr + 2} Z`, c, { shadeX: hx + dx });
      s += part(`M ${hx - hr + 1} ${hy - 6} Q ${hx} ${hy - hr - 3} ${hx + hr + 2} ${hy - 6} L ${hx + hr} ${hy + 5} Q ${hx + 3} ${hy + 9} ${hx - hr + 3} ${hy + 4} Z`, BONE, { shadeX: hx + 7 });
      s += flat(`M ${hx - 3} ${hy - 3} L ${hx + 3} ${hy - 4} L ${hx + 2} ${hy + 1} Z M ${hx + 7} ${hy - 4} L ${hx + 13} ${hy - 3} L ${hx + 8} ${hy + 1} Z`, '#120d0b', false);
      s += glow(hx + 1, hy - 2, 3.5, '#ff9a3a') + glow(hx + 10, hy - 2, 3.5, '#ff9a3a');
      s += line(`M ${hx - 7} ${hy - 8} L ${hx - 7} ${hy + 2} M ${hx + 5} ${hy - 9} L ${hx + 5} ${hy + 4}`, '#c8342a', 1.4, 0.8);
      return s;
    }
    case 'dragonMask': {
      let s = part(`M ${hx - hr - 3} ${hy + 12} Q ${hx - hr - 5} ${hy - hr - 6} ${hx + 3} ${hy - hr - 7} Q ${hx + hr + 6} ${hy - hr - 4} ${hx + hr + 4} ${hy + 2} Q ${hx + 4} ${hy - hr + 2} ${hx - hr + 4} ${hy + 12} Z`, col, { shadeX: hx + 4 });
      s += part(`M ${hx - 2} ${hy - 8} Q ${hx + 8} ${hy - 12} ${hx + hr + 4} ${hy - 6} L ${hx + hr + 8} ${hy + 2} Q ${hx + 8} ${hy + 6} ${hx - 2} ${hy + 4} Z`, '#c23a24', { shadeX: hx + 10 });
      s += flat(`M ${hx + 2} ${hy - 4} L ${hx + 7} ${hy - 5} L ${hx + 5} ${hy - 1} Z M ${hx + 10} ${hy - 5} L ${hx + 15} ${hy - 4} L ${hx + 11} ${hy - 1} Z`, '#ffd23a', true, 1);
      s += flat(`M ${hx} ${hy - 9} L ${hx - 6} ${hy - 20} L ${hx + 4} ${hy - 11} Z M ${hx + 8} ${hy - 11} L ${hx + 10} ${hy - 22} L ${hx + 13} ${hy - 10} Z`, '#e6c15c', true, 1.2);
      return s;
    }
    case 'priestess': {
      let s = part(`M ${hx - hr - 4} ${hy + 16} Q ${hx - hr - 6} ${hy - hr - 6} ${hx + 3} ${hy - hr - 6} Q ${hx + hr + 6} ${hy - hr - 4} ${hx + hr + 5} ${hy + 6} Q ${hx + hr} ${hy - hr + 4} ${hx + 2} ${hy - hr + 3} Q ${hx - hr + 2} ${hy - hr + 4} ${hx - hr} ${hy + 16} Z`, col, { shadeX: hx + 6 });
      s += part(`M ${hx - 10} ${hy - hr - 2} Q ${hx - 20} ${hy - hr - 18} ${hx - 14} ${hy - hr - 30} Q ${hx - 10} ${hy - hr - 16} ${hx - 2} ${hy - hr - 4} Z`, '#e6c15c', { shadeX: hx - 12 });
      s += part(`M ${hx + 6} ${hy - hr - 3} Q ${hx + 16} ${hy - hr - 18} ${hx + 12} ${hy - hr - 32} Q ${hx + 22} ${hy - hr - 16} ${hx + 12} ${hy - hr - 1} Z`, '#e6c15c', { shadeX: hx + 12 });
      s += glow(hx + 1, hy - hr - 4, 4, '#ff7a2a');
      return s;
    }
    case 'crown':
    case 'tuskCrown': {
      const tusk = o.hat === 'tuskCrown';
      const base = tusk ? '#7a4a2a' : '#e2b84a';
      let s = part(`M ${hx - hr + 1} ${hy - hr + 6} L ${hx - hr - 1} ${hy - hr - 8} L ${hx - 5} ${hy - hr - 1} L ${hx + 1} ${hy - hr - 12} L ${hx + 7} ${hy - hr - 1} L ${hx + hr + 3} ${hy - hr - 9} L ${hx + hr + 1} ${hy - hr + 6} Q ${hx + 1} ${hy - hr + 1} ${hx - hr + 1} ${hy - hr + 6} Z`, base, { shadeX: hx + 6 });
      if (tusk) s += flat(`M ${hx - hr + 2} ${hy - hr - 1} Q ${hx - hr - 6} ${hy - hr - 14} ${hx - hr - 2} ${hy - hr - 18} Q ${hx - hr} ${hy - hr - 8} ${hx - hr + 5} ${hy - hr + 1} Z M ${hx + hr} ${hy - hr - 1} Q ${hx + hr + 8} ${hy - hr - 14} ${hx + hr + 4} ${hy - hr - 18} Q ${hx + hr + 2} ${hy - hr - 8} ${hx + hr - 3} ${hy - hr + 1} Z`, BONE, true, 1.4);
      else s += circ(hx + 1, hy - hr - 1, 2, '#c8342a') + circ(hx - 7, hy - hr + 1, 1.5, '#2f6fb3');
      return s;
    }
    case 'hornHelm': {
      let s = part(`M ${hx - hr - 1} ${hy - 1} Q ${hx - hr - 2} ${hy - hr - 4} ${hx + 1} ${hy - hr - 4} Q ${hx + hr + 3} ${hy - hr - 4} ${hx + hr + 2} ${hy - 1} Z`, col, { shadeX: hx + 6 });
      s += part(`M ${hx - hr} ${hy - 6} Q ${hx - hr - 10} ${hy - 10} ${hx - hr - 12} ${hy - 22} Q ${hx - hr - 4} ${hy - 14} ${hx - hr + 4} ${hy - 12} Z`, BONE, { shadeX: hx - hr - 6 });
      s += part(`M ${hx + hr} ${hy - 7} Q ${hx + hr + 10} ${hy - 12} ${hx + hr + 10} ${hy - 25} Q ${hx + hr + 15} ${hy - 12} ${hx + hr + 2} ${hy - 2} Z`, BONE, { shadeX: hx + hr + 6 });
      return s;
    }
    case 'horns':
      return part(`M ${hx - 6} ${hy - hr + 2} Q ${hx - 16} ${hy - hr - 6} ${hx - 14} ${hy - hr - 16} Q ${hx - 8} ${hy - hr - 6} ${hx - 1} ${hy - hr + 1} Z`, '#1f1a1a', { shadeX: hx - 10 }) + part(`M ${hx + 6} ${hy - hr + 1} Q ${hx + 16} ${hy - hr - 6} ${hx + 16} ${hy - hr - 17} Q ${hx + 20} ${hy - hr - 4} ${hx + 10} ${hy - hr + 4} Z`, '#1f1a1a', { shadeX: hx + 13 });
    default:
      return '';
  }
}

function weaponSvg(w: Weapon, h: { x: number; y: number }): string {
  const { x, y } = h;
  const wood = '#6b4527';
  const iron = '#b9c0cb';
  switch (w) {
    case 'axe':
      return limb(`M ${x - 3} ${y + 6} L ${x + 8} ${y - 22}`, wood, 3.5) + part(`M ${x + 4} ${y - 16} Q ${x + 18} ${y - 26} ${x + 20} ${y - 12} Q ${x + 14} ${y - 10} ${x + 7} ${y - 8} Z`, iron, { shadeX: x + 14 });
    case 'greataxe':
      return limb(`M ${x - 6} ${y + 12} L ${x + 12} ${y - 40}`, wood, 4.5) + part(`M ${x + 6} ${y - 32} Q ${x + 30} ${y - 46} ${x + 30} ${y - 20} Q ${x + 20} ${y - 22} ${x + 10} ${y - 20} Z`, iron, { shadeX: x + 20 }) + part(`M ${x + 9} ${y - 32} Q ${x - 8} ${y - 44} ${x - 6} ${y - 24} Q ${x} ${y - 26} ${x + 7} ${y - 22} Z`, iron, { shadeX: x });
    case 'cleaver':
      return limb(`M ${x - 2} ${y + 4} L ${x + 4} ${y - 6}`, wood, 4) + part(`M ${x + 1} ${y - 4} L ${x + 8} ${y - 36} Q ${x + 22} ${y - 34} ${x + 24} ${y - 22} L ${x + 9} ${y - 2} Z`, iron, { shadeX: x + 16 }) + circ(x + 12, y - 28, 2, '#5a3a24');
    case 'dagger':
      return limb(`M ${x} ${y + 2} L ${x + 3} ${y - 3}`, '#3a2618', 3) + part(`M ${x + 2} ${y - 3} L ${x + 12} ${y - 15} L ${x + 5} ${y - 1} Z`, iron, { shadeX: x + 7 });
    case 'sword':
      return part(`M ${x - 1} ${y - 4} L ${x + 3} ${y - 36} L ${x + 7} ${y - 4} Z`, iron, { shadeX: x + 3 }) + limb(`M ${x - 4} ${y - 3} L ${x + 10} ${y - 5}`, '#7a5a2a', 3) + limb(`M ${x + 2} ${y - 2} L ${x + 2} ${y + 5}`, '#3a2618', 3.5);
    case 'greatsword':
      return part(`M ${x - 2} ${y - 6} L ${x + 4} ${y - 52} L ${x + 10} ${y - 6} Z`, o_gs, { shadeX: x + 4 }) + limb(`M ${x - 7} ${y - 5} L ${x + 15} ${y - 7}`, '#3a3030', 4) + limb(`M ${x + 3} ${y - 3} L ${x + 3} ${y + 8}`, '#2a1a12', 4);
    case 'club':
      return limb(`M ${x - 3} ${y + 6} L ${x + 9} ${y - 18}`, wood, 5) + part(`M ${x + 2} ${y - 14} Q ${x + 4} ${y - 40} ${x + 18} ${y - 36} Q ${x + 24} ${y - 20} ${x + 12} ${y - 10} Z`, '#7a5230', { shadeX: x + 12 }) + flat(`M ${x + 6} ${y - 30} L ${x + 2} ${y - 33} L ${x + 7} ${y - 26} Z M ${x + 17} ${y - 28} L ${x + 22} ${y - 30} L ${x + 17} ${y - 23} Z`, BONE, true, 1);
    case 'scythe':
      return limb(`M ${x - 4} ${y + 18} L ${x + 6} ${y - 44}`, '#3a2b22', 3.5) + part(`M ${x + 5} ${y - 42} Q ${x - 22} ${y - 52} ${x - 34} ${y - 26} Q ${x - 18} ${y - 40} ${x + 4} ${y - 34} Z`, iron, { shadeX: x - 14 });
    case 'bow':
      return line(`M ${x - 1} ${y - 30} L ${x - 1} ${y + 18}`, 'rgba(240,240,230,0.8)', 0.9) + limb(`M ${x - 1} ${y - 30} Q ${x + 14} ${y - 6} ${x - 1} ${y + 18}`, '#7a4e2a', 3);
    case 'crossbow':
      return limb(`M ${x - 8} ${y + 2} L ${x + 18} ${y - 4}`, wood, 4) + limb(`M ${x + 10} ${y - 16} Q ${x + 16} ${y - 4} ${x + 10} ${y + 8}`, '#555b66', 3) + line(`M ${x + 10} ${y - 16} L ${x + 4} ${y - 3} L ${x + 10} ${y + 8}`, '#ddd', 0.8);
    case 'staffSkull':
    case 'staffFlame':
    case 'staffGreen': {
      const top = { x: x + 4, y: y - 44 };
      let s = limb(`M ${x - 1} ${y + 20} L ${top.x} ${top.y + 4}`, w === 'staffGreen' ? '#2d2a30' : wood, 3.5);
      if (w === 'staffSkull') s += circ(top.x, top.y, 6, BONE) + flat(`M ${top.x - 3} ${top.y - 1} L ${top.x} ${top.y - 2} L ${top.x - 1} ${top.y + 1} Z M ${top.x + 2} ${top.y - 2} L ${top.x + 5} ${top.y - 1} L ${top.x + 2} ${top.y + 1} Z`, '#120d0b', false) + glow(top.x, top.y - 6, 7, '#ff9a3a') + flat(`M ${top.x - 6} ${top.y + 2} L ${top.x - 12} ${top.y + 8} L ${top.x - 5} ${top.y + 6} Z`, '#c8342a', true, 1);
      else if (w === 'staffFlame') s += part(`M ${top.x - 7} ${top.y + 6} Q ${top.x - 8} ${top.y - 4} ${top.x} ${top.y - 2} Q ${top.x + 8} ${top.y - 4} ${top.x + 7} ${top.y + 6} Z`, '#3a2a2a') + glow(top.x, top.y - 6, 11, '#ff6a2a') + flat(`M ${top.x - 4} ${top.y} Q ${top.x - 2} ${top.y - 14} ${top.x + 1} ${top.y - 18} Q ${top.x + 2} ${top.y - 10} ${top.x + 5} ${top.y - 8} Q ${top.x + 5} ${top.y} ${top.x - 4} ${top.y} Z`, '#ffb23a', false);
      else s += flat(`M ${top.x} ${top.y - 12} L ${top.x + 5} ${top.y} L ${top.x} ${top.y + 6} L ${top.x - 5} ${top.y} Z`, '#3dd68c', true, 1.4) + glow(top.x, top.y - 2, 10, '#6dffb0');
      return s;
    }
    case 'claws':
      return flat(`M ${x + 3} ${y - 2} L ${x + 12} ${y - 7} L ${x + 5} ${y + 1} Z M ${x + 4} ${y + 1} L ${x + 13} ${y} L ${x + 5} ${y + 4} Z`, BONE, true, 1);
    default:
      return '';
  }
}
const o_gs = '#5a6272';

function torsoSvg(r: Rig, o: HumanoidOpts): string {
  const t = torsoPath(r);
  const c = o.torsoColor;
  switch (o.torso) {
    case 'bare':
      return part(t, o.skin, { shadeX: 58 }) + line('M 44 62 Q 50 65 56 62', shade(o.skin, -0.35), 1.4, 0.7) + line('M 46 70 Q 50 72 54 70', shade(o.skin, -0.35), 1.3, 0.6) + (o.trim ? line(`M ${50 - r.sw + 3} ${r.sy + 2} L ${50 + r.ww - 2} ${r.wy - 4}`, o.trim, 4) + line(`M ${50 - r.sw + 3} ${r.sy + 2} L ${50 + r.ww - 2} ${r.wy - 4}`, OL, 1, 0.5) : '');
    case 'ribs': {
      let s = part(`M ${50 - r.sw + 4} ${r.sy + 2} Q 50 ${r.sy - 4} ${50 + r.sw - 4} ${r.sy + 2} L ${50 + r.ww - 2} ${r.wy - 8} Q 50 ${r.wy - 3} ${50 - r.ww + 2} ${r.wy - 8} Z`, '#151012', { hi: false });
      s += limb(`M 50 ${r.sy} L 50 ${r.wy}`, BONE, 3.5);
      for (let i = 0; i < 4; i++) {
        const y = r.sy + 6 + i * 6;
        const w = r.sw - 4 - i * 1.5;
        s += line(`M ${50 - w} ${y + 3} Q 50 ${y - 3} ${50 + w} ${y + 3}`, BONE, 2.6) + line(`M ${50 - w} ${y + 3} Q 50 ${y - 3} ${50 + w} ${y + 3}`, OL, 0.6, 0.5);
      }
      s += part(`M ${50 - r.ww - 2} ${r.wy - 6} Q 50 ${r.wy - 10} ${50 + r.ww + 2} ${r.wy - 6} L ${50 + r.ww} ${r.wy + 1} Q 50 ${r.wy + 4} ${50 - r.ww} ${r.wy + 1} Z`, BONE_D, { shadeX: 56 });
      return s;
    }
    case 'robe':
      return part(`M ${50 - r.sw + 3} ${r.sy} Q 50 ${r.sy - 5} ${50 + r.sw - 3} ${r.sy} L ${50 + r.sw + 9} ${r.fy - 2} Q ${50 + 12} ${r.fy + 4} 50 ${r.fy - 1} Q ${50 - 12} ${r.fy + 4} ${50 - r.sw - 9} ${r.fy - 2} Z`, c, { shadeX: 57 }) + (o.trim ? line(`M 50 ${r.sy} L 50 ${r.fy - 1}`, o.trim, 2.4) + line(`M ${50 - r.sw - 8} ${r.fy - 3} Q 50 ${r.fy + 3} ${50 + r.sw + 8} ${r.fy - 3}`, o.trim, 2.4) : '');
    case 'rags':
      return part(`M ${50 - r.sw} ${r.sy + 2} Q 50 ${r.sy - 5} ${50 + r.sw} ${r.sy + 2} L ${50 + r.ww + 2} ${r.wy + 6} L ${50 + 6} ${r.wy + 1} L 50 ${r.wy + 8} L ${50 - 6} ${r.wy + 1} L ${50 - r.ww - 2} ${r.wy + 6} Z`, c, { shadeX: 58 }) + line('M 44 60 L 47 66 M 55 68 L 58 74', shade(c, -0.4), 1.2);
    case 'scales': {
      let s = part(t, c, { shadeX: 58 });
      s += part(`M 44 ${r.sy + 4} L 56 ${r.sy + 4} L 55 ${r.wy - 2} L 45 ${r.wy - 2} Z`, shade(c, 0.4), { shadeX: 53 });
      for (let y = r.sy + 9; y < r.wy - 3; y += 6) s += line(`M 45 ${y} L 55 ${y}`, shade(c, -0.2), 1.2, 0.7);
      return s;
    }
    case 'armor': {
      let s = part(t, c, { shadeX: 58 });
      s += line(`M ${50 - r.sw + 3} ${r.sy + 13} Q 50 ${r.sy + 19} ${50 + r.sw - 3} ${r.sy + 13}`, OL, 1.4, 0.5) + line(`M ${50 - r.ww} ${r.wy - 10} Q 50 ${r.wy - 5} ${50 + r.ww} ${r.wy - 10}`, OL, 1.4, 0.5);
      if (o.trim) s += part(`M 45 ${r.sy + 6} L 56 ${r.sy + 6} L 57 ${r.wy + 10} L 50 ${r.wy + 14} L 44 ${r.wy + 10} Z`, o.trim, { shadeX: 53 });
      return s;
    }
    case 'rock': {
      let s = part(t, c, { shadeX: 58 });
      s += line('M 40 58 L 46 64 L 44 72 M 56 56 L 54 66 L 60 74', '#ff7a2a', 2.2) + line('M 40 58 L 46 64 L 44 72 M 56 56 L 54 66 L 60 74', '#ffe0a0', 0.8);
      return s;
    }
    default:
      return part(t, c, { shadeX: 58 }) + line('M 40 60 L 42 70 M 58 60 L 60 70', shade(c, -0.35), 1, 0.7);
  }
}

function humanoid(o: HumanoidOpts, view: { height: number }): SpriteDef {
  const r = { ...RIGS[o.build] };
  if (o.hunched) {
    r.hy += 8;
    r.hx += 6;
    r.sy += 4;
  }
  const sleeve = o.sleeves ?? o.skin;
  let s = '';
  if (o.cape) s += part(`M ${50 - r.sw + 2} ${r.sy} Q 50 ${r.sy - 6} ${50 + r.sw - 2} ${r.sy} L ${50 + r.sw + 10} ${r.fy - 6} Q ${50 + 8} ${r.fy} 50 ${r.fy - 5} Q ${50 - 8} ${r.fy} ${50 - r.sw - 10} ${r.fy - 6} Z`, o.cape, { shadeX: 60 });
  if (o.hat === 'priestess' || o.hat === 'dragonMask' || o.hat === 'bigHood') s += part(`M ${r.hx - r.hr - 4} ${r.hy} Q ${r.hx - r.hr - 10} ${r.sy + 20} ${50 - r.sw} ${r.sy + 26} L ${50 + r.sw - 4} ${r.sy + 4} Z`, o.hatColor ?? '#3a2a2a', { shadeX: 50 });
  // Back arm (and shield).
  s += arm(r, 'back', sleeve, o.skin, { width: r.lw - 0.5 });
  if (o.weapon === 'bow') s += weaponSvg('bow', r.handB);
  if (o.offhand === 'shield') s += ell(r.handB.x - 2, r.handB.y - 6, 11, 14, o.shieldColor ?? '#6b4527') + circ(r.handB.x - 2, r.handB.y - 6, 3.5, '#b9c0cb') + line(`M ${r.handB.x - 12} ${r.handB.y - 6} L ${r.handB.x + 8} ${r.handB.y - 6}`, OL, 1.2, 0.4);
  if (o.offhand === 'dagger') s += weaponSvg('dagger', r.handB);
  // Legs or a floating hem.
  if (o.floating) {
    s += part(`M ${50 - r.ww - 4} ${r.wy - 6} L ${50 + r.ww + 4} ${r.wy - 6} L ${50 + r.ww + 8} ${r.fy - 6} L ${50 + 6} ${r.fy - 12} L 50 ${r.fy - 2} L ${50 - 6} ${r.fy - 12} L ${50 - r.ww - 8} ${r.fy - 6} Z`, o.torsoColor, { shadeX: 56, opacity: 0.85 });
  } else if (o.torso !== 'robe') {
    s += legs(r, o.legsColor ?? '#4a3a2a', o.boots ?? '#2a1e16', { bootH: 8 });
  }
  s += torsoSvg(r, o);
  if (o.pauldrons) {
    s += part(`M ${50 - r.sw - 6} ${r.sy + 6} Q ${50 - r.sw - 6} ${r.sy - 7} ${50 - r.sw + 7} ${r.sy - 7} Q ${50 - r.sw + 16} ${r.sy - 4} ${50 - r.sw + 14} ${r.sy + 5} Q ${50 - r.sw + 4} ${r.sy + 10} ${50 - r.sw - 6} ${r.sy + 6} Z`, o.pauldrons, { shadeX: 50 - r.sw + 6 });
    if (o.spikes) s += flat(`M ${50 - r.sw - 1} ${r.sy - 4} L ${50 - r.sw - 4} ${r.sy - 16} L ${50 - r.sw + 4} ${r.sy - 6} Z`, o.spikes, true, 1.3);
  }
  if (o.fur) s += part(`M ${50 - r.sw + 1} ${r.sy + 2} Q ${50 - r.sw + 3} ${r.sy - 8} ${50 - 8} ${r.sy - 4} Q 50 ${r.sy - 10} ${50 + 8} ${r.sy - 4} Q ${50 + r.sw - 3} ${r.sy - 8} ${50 + r.sw - 1} ${r.sy + 2} Q 50 ${r.sy + 8} ${50 - r.sw + 1} ${r.sy + 2} Z`, o.fur, { shadeX: 58 });
  if (o.torso !== 'ribs' && o.torso !== 'robe' && !o.floating) s += part(`M ${50 - r.ww - 1} ${r.wy - 6} L ${50 + r.ww + 1} ${r.wy - 6} L ${50 + r.ww + 1} ${r.wy - 1} L ${50 - r.ww - 1} ${r.wy - 1} Z`, '#3a2618', { shadeX: 58 });
  s += headSvg(r, o);
  s += hatSvg(r, o);
  // Front arm and weapon.
  if (o.weapon && o.weapon !== 'bow' && o.weapon !== 'none') s += weaponSvg(o.weapon, r.handF);
  s += arm(r, 'front', sleeve, o.skin, { width: r.lw - 0.5 });
  if (o.pauldrons) {
    s += part(`M ${50 + r.sw - 14} ${r.sy + 5} Q ${50 + r.sw - 16} ${r.sy - 5} ${50 + r.sw - 4} ${r.sy - 7} Q ${50 + r.sw + 9} ${r.sy - 6} ${50 + r.sw + 8} ${r.sy + 7} Q ${50 + r.sw - 3} ${r.sy + 11} ${50 + r.sw - 14} ${r.sy + 5} Z`, o.pauldrons, { shadeX: 50 + r.sw });
    if (o.spikes) s += flat(`M ${50 + r.sw - 4} ${r.sy - 6} L ${50 + r.sw - 1} ${r.sy - 19} L ${50 + r.sw + 4} ${r.sy - 5} Z`, o.spikes, true, 1.3);
  }
  if (o.weapon === 'claws') s += weaponSvg('claws', r.handF);
  s += o.extra ?? '';
  // view.height is the figure's height (about 100 units from crown to feet) in tiles.
  const vx = -8;
  const vy = -26;
  const w = 124;
  const hh = 148;
  return { svg: svgDoc(s, vx, vy, w, hh), vx, vy, w, h: hh, ax: 50, ay: r.fy + 1, height: (view.height * hh) / 100, floats: o.floating };
}

// ── Creatures ──────────────────────────────────────────────────────────────────────────────

/** A dragon in profile: wyrmlings, drakes, wyverns and the elder dragon. */
function dragon(o: { color: string; belly: string; wings: boolean; horns: string; height: number; elder?: boolean; small?: boolean }): SpriteDef {
  const c = o.color;
  let s = '';
  // Far wing.
  if (o.wings) s += part('M 70 52 Q 50 6 20 -2 Q 34 18 30 30 Q 40 30 44 42 Q 54 40 58 52 Z', shade(c, -0.35), { shadeX: 50, opacity: 0.95 });
  // Tail.
  s += part('M 46 78 Q 20 88 8 70 Q 4 62 -4 66 Q 6 56 14 66 Q 24 78 44 68 Z', c, { shadeX: 999, shadeY: 72 });
  s += flat('M -4 66 L -12 58 L -2 60 Z', o.horns, true, 1.2);
  // Far legs.
  s += limb('M 56 84 L 52 104', shade(c, -0.3), 9) + limb('M 92 82 L 96 104', shade(c, -0.3), 9);
  // Body.
  s += part('M 40 76 Q 42 52 74 54 Q 104 54 108 72 Q 108 92 76 94 Q 44 96 40 76 Z', c, { shadeY: 80 });
  s += part('M 52 86 Q 76 98 102 84 Q 100 92 76 95 Q 54 96 52 86 Z', o.belly, { shadeX: 999 });
  // Back spikes.
  for (let i = 0; i < 5; i++) s += flat(`M ${52 + i * 10} ${56 - (i === 2 ? 2 : 0)} L ${56 + i * 10} ${44 - (i % 2) * 3} L ${60 + i * 10} ${56} Z`, o.horns, true, 1.2);
  // Neck and head.
  s += part('M 96 66 Q 106 40 118 30 L 130 38 Q 116 52 112 72 Z', c, { shadeX: 120 });
  s += part('M 112 22 Q 124 14 136 22 L 154 30 Q 158 36 152 40 L 134 44 Q 116 46 112 34 Z', c, { shadeX: 140 });
  s += part('M 120 40 L 152 39 Q 148 46 132 48 Q 122 48 120 40 Z', o.belly, { shadeX: 142 });
  s += `<ellipse cx="126" cy="28" rx="4" ry="3" fill="#ffd23a" stroke="${OL}" stroke-width="1.3"/><rect x="125.3" y="25.3" width="1.5" height="5.4" fill="${OL}"/>` + glow(126, 28, 5, '#ffb23a');
  s += circ(150, 32, 1.3, OL, { shade: false, stroke: false });
  s += flat('M 140 41 L 142 45 L 144 41 Z M 146 40 L 148 44 L 150 40 Z', '#fff', true, 0.8);
  s += part(`M 118 22 Q 108 ${o.elder ? 0 : 8} ${o.elder ? 92 : 98} ${o.elder ? -6 : 2} Q 110 14 116 28 Z`, o.horns, { shadeX: 108 });
  if (o.elder) s += part('M 126 18 Q 124 2 114 -8 Q 130 4 132 20 Z', o.horns, { shadeX: 124 });
  // Near legs.
  s += limb('M 64 86 Q 70 96 62 108', c, 11) + limb('M 98 84 Q 104 96 102 108', c, 11);
  s += flat('M 56 108 L 70 108 L 66 112 Z M 96 108 L 110 108 L 106 112 Z', o.horns, true, 1.2);
  // Near wing.
  if (o.wings) {
    s += part('M 78 56 Q 70 0 34 -16 Q 48 6 46 20 Q 58 22 62 36 Q 70 38 72 52 Z', shade(c, -0.12), { shadeX: 58 });
    s += line('M 78 56 Q 64 14 36 -14 M 76 52 Q 62 30 46 20 M 74 54 Q 66 42 62 36', shade(c, -0.45), 2);
  }
  if (o.small) s += '';
  return { svg: svgDoc(s, -20, -30, 190, 150), vx: -20, vy: -30, w: 190, h: 150, ax: 80, ay: 109, height: o.height };
}

/** A four-legged beast: the war boar and the bone hound. */
function beast(o: { kind: 'boar' | 'hound'; height: number }): SpriteDef {
  const boar = o.kind === 'boar';
  const c = boar ? '#6a4a35' : BONE;
  let s = '';
  s += limb('M 40 76 L 34 100', shade(c, -0.3), 10) + limb('M 92 76 L 98 100', shade(c, -0.3), 10);
  if (boar) {
    s += part('M 24 66 Q 26 34 64 32 Q 104 32 112 58 Q 114 84 76 86 Q 30 88 24 66 Z', c, { shadeY: 70 });
    for (let i = 0; i < 7; i++) s += flat(`M ${38 + i * 9} ${40 - (i % 2) * 2} L ${40 + i * 9} ${26 - (i % 3) * 3} L ${46 + i * 9} ${38} Z`, '#2a1a12', true, 1);
    s += part('M 96 40 Q 120 34 134 52 L 146 60 Q 150 70 140 72 L 112 74 Q 96 66 96 40 Z', c, { shadeX: 126 });
    s += ell(142, 64, 6, 5, '#c9907a');
    s += circ(140, 63, 1, OL, { shade: false, stroke: false }) + circ(144, 63, 1, OL, { shade: false, stroke: false });
    s += part('M 126 70 Q 134 74 136 60 Q 140 72 128 78 Z', BONE, { shadeX: 132 }) + part('M 116 72 Q 122 76 124 64 Q 128 76 118 80 Z', BONE, { shadeX: 120 });
    s += glow(120, 50, 5, '#ff4a2a') + `<ellipse cx="120" cy="50" rx="2" ry="1.6" fill="#fff"/>`;
    s += part('M 104 38 L 108 24 L 114 40 Z', c, { shadeX: 110 });
    // War paint and a saddle of armour.
    s += line('M 70 40 L 66 60 M 80 40 L 78 60', '#c8342a', 3, 0.8);
    s += part('M 52 36 Q 70 28 88 36 L 86 50 Q 70 56 54 50 Z', '#4a4f5a', { shadeX: 76 });
  } else {
    s += part('M 28 62 Q 30 40 60 40 Q 96 38 104 56 Q 104 76 76 78 Q 34 80 28 62 Z', '#16110f', { hi: false });
    s += limb('M 30 56 L 104 54', BONE, 4);
    for (let i = 0; i < 6; i++) s += line(`M ${48 + i * 8} 50 Q ${52 + i * 8} 64 ${46 + i * 8} 74`, BONE, 3) + line(`M ${48 + i * 8} 50 Q ${52 + i * 8} 64 ${46 + i * 8} 74`, OL, 0.7, 0.5);
    s += part('M 20 58 Q 4 50 -2 34 Q 10 46 26 54 Z', BONE_D, { shadeX: 10 });
    s += part('M 96 40 Q 116 30 132 42 L 148 50 Q 150 58 142 60 L 120 66 Q 100 62 96 40 Z', BONE, { shadeX: 128 });
    s += flat('M 118 46 Q 124 42 128 48 Q 124 52 118 50 Z', '#120d0b', false) + glow(123, 48, 6, '#6dffb0');
    s += flat('M 126 60 L 128 64 L 130 59 M 134 58 L 136 62 L 138 57', '#fff', true, 0.8);
    s += flat('M 104 36 L 106 20 L 112 36 Z', BONE_D, true, 1.2);
    s += line('M 100 56 Q 110 64 124 62', OL, 1, 0.6);
    s += glow(70, 60, 16, '#4ad98a');
  }
  s += limb('M 52 78 L 48 104', c, 11) + limb('M 82 78 L 86 104', c, 11);
  s += flat('M 42 104 L 56 104 L 52 108 Z M 80 104 L 94 104 L 90 108 Z', boar ? '#2a1a12' : BONE_D, true, 1.2);
  return { svg: svgDoc(s, -10, -10, 170, 125), vx: -10, vy: -10, w: 170, h: 125, ax: 68, ay: 106, height: o.height };
}

/** Sentries: an orc war totem, a dragon idol and a cursed obelisk. */
function totem(clan: ThemeId): SpriteDef {
  let s = '';
  if (clan === 'orc') {
    s += part('M 42 116 L 44 6 L 58 6 L 60 116 Z', '#6b4527', { shadeX: 53 });
    for (const [y, c] of [[18, '#8a5a32'], [48, '#7a4e2a'], [78, '#8a5a32']] as const) {
      s += part(`M 36 ${y} L 66 ${y} L 64 ${y + 26} L 38 ${y + 26} Z`, c, { shadeX: 56 });
      s += flat(`M 42 ${y + 8} L 49 ${y + 6} L 48 ${y + 11} Z M 54 ${y + 6} L 61 ${y + 8} L 55 ${y + 11} Z`, '#120d0b', false) + glow(46, y + 9, 4, '#ff6a2a') + glow(57, y + 9, 4, '#ff6a2a');
      s += flat(`M 43 ${y + 17} L 59 ${y + 17} L 57 ${y + 22} L 45 ${y + 22} Z`, '#120d0b', false) + flat(`M 46 ${y + 17} L 47 ${y + 21} L 48 ${y + 17} Z M 53 ${y + 17} L 54 ${y + 21} L 55 ${y + 17} Z`, BONE, false);
      s += line(`M 38 ${y + 3} L 64 ${y + 3}`, '#c8342a', 2.4, 0.9);
    }
    s += part('M 36 16 Q 18 10 14 -6 Q 24 6 40 8 Z', BONE, { shadeX: 26 }) + part('M 66 16 Q 84 10 88 -6 Q 78 6 62 8 Z', BONE, { shadeX: 78 });
    s += part('M 30 116 L 72 116 L 66 108 L 36 108 Z', '#4a3020');
    return { svg: svgDoc(s, 0, -12, 100, 134), vx: 0, vy: -12, w: 100, h: 134, ax: 51, ay: 116, height: 2.6 };
  }
  if (clan === 'dragon') {
    s += part('M 26 116 L 76 116 L 70 80 L 32 80 Z', '#3a2b2b', { shadeX: 56 });
    s += line('M 32 92 L 70 92 M 30 104 L 72 104', '#1a1212', 1.4, 0.7);
    s += part('M 34 80 Q 30 52 44 40 Q 56 30 70 38 L 86 44 Q 92 50 86 54 L 70 58 Q 64 70 68 80 Z', '#4a3838', { shadeX: 62 });
    s += part('M 48 42 Q 40 26 28 22 Q 42 36 44 46 Z', '#2a1e1e', { shadeX: 38 });
    s += flat('M 58 44 L 66 42 L 62 48 Z', '#ff7a2a', true, 1) + glow(62, 45, 6, '#ff7a2a');
    s += part('M 38 20 Q 50 8 62 20 L 60 26 L 40 26 Z', '#2a1e1e') + glow(50, 10, 16, '#ff6a2a');
    s += flat('M 44 20 Q 46 4 51 -4 Q 52 6 56 8 Q 58 16 56 20 Z', '#ffb23a', false) + flat('M 47 20 Q 49 10 51 6 Q 52 12 54 20 Z', '#fff2c0', false);
    return { svg: svgDoc(s, 0, -12, 100, 134), vx: 0, vy: -12, w: 100, h: 134, ax: 51, ay: 116, height: 2.6 };
  }
  s += part('M 34 116 L 40 16 L 51 2 L 62 16 L 68 116 Z', '#1d2628', { shadeX: 53 });
  s += line('M 51 22 L 47 34 L 55 46 L 49 58 M 46 70 L 56 82 L 48 96', '#6dffb0', 2.4) + line('M 51 22 L 47 34 L 55 46 L 49 58 M 46 70 L 56 82 L 48 96', '#e6fff0', 0.9);
  s += glow(51, 40, 18, '#6dffb0');
  s += circ(51, 108, 8, BONE) + flat('M 46 106 L 50 105 L 49 109 Z M 52 105 L 56 106 L 53 109 Z', '#120d0b', false);
  s += part('M 26 118 L 76 118 L 70 110 L 32 110 Z', '#2a3436');
  return { svg: svgDoc(s, 0, -12, 100, 134), vx: 0, vy: -12, w: 100, h: 134, ax: 51, ay: 117, height: 2.7 };
}

/** The Wailing Warden: a hooded, floating spirit in chains. */
function wraith(height: number): SpriteDef {
  let s = '';
  s += part('M 22 40 Q 50 22 78 40 L 86 104 L 74 92 L 66 110 L 58 94 L 50 114 L 42 94 L 34 110 L 26 92 L 14 104 Z', '#26323a', { shadeX: 58, opacity: 0.92 });
  s += part('M 28 44 Q 16 62 10 80 L 20 84 Q 26 66 36 56 Z', '#26323a', { shadeX: 24, opacity: 0.92 });
  s += part('M 72 44 Q 86 60 94 78 L 84 82 Q 78 66 66 56 Z', '#26323a', { shadeX: 86, opacity: 0.92 });
  s += circ(14, 84, 4, '#9fb7b0') + circ(90, 80, 4, '#9fb7b0');
  s += line('M 14 86 Q 20 100 36 98 Q 50 96 60 104', '#7a8a8a', 2.4) + line('M 14 86 Q 20 100 36 98 Q 50 96 60 104', OL, 0.8, 0.5);
  s += part('M 30 34 Q 30 4 52 2 Q 74 4 74 34 Q 72 48 52 50 Q 32 48 30 34 Z', '#1b2328', { shadeX: 60 });
  s += part('M 38 38 Q 38 18 52 16 Q 66 18 66 38 Q 60 46 52 46 Q 44 46 38 38 Z', '#06090a', { hi: false });
  s += glow(46, 30, 6, '#9cffe0') + glow(58, 30, 6, '#9cffe0');
  s += flat('M 44 40 Q 52 46 60 40 Q 56 44 52 44 Q 48 44 44 40 Z', '#9cffe0', false);
  s += glow(52, 64, 30, '#6dffb0');
  return { svg: svgDoc(s, -10, -12, 120, 134), vx: -10, vy: -12, w: 120, h: 134, ax: 50, ay: 112, height, floats: true };
}

/** The Bone Abomination: a stitched hulk with a cleaver and a hook. */
function abomination(height: number): SpriteDef {
  const skin = '#9aab8a';
  let s = '';
  s += limb('M 38 92 L 34 110', shade(skin, -0.25), 13) + limb('M 66 92 L 70 110', shade(skin, -0.25), 13);
  s += limb('M 22 58 Q 6 72 12 92', skin, 12) + line('M 10 92 Q 2 100 10 106 Q 16 104 14 98', '#9aa2ad', 3);
  s += part('M 20 70 Q 18 34 52 32 Q 86 34 84 70 Q 86 100 52 100 Q 18 100 20 70 Z', skin, { shadeX: 62 });
  s += line('M 34 46 L 40 74 M 32 54 L 38 54 M 34 62 L 40 61 M 35 70 L 41 69 M 62 50 Q 70 64 64 84 M 60 58 L 68 57 M 62 66 L 70 66 M 61 75 L 68 76', '#4a3a3a', 1.6);
  s += ell(54, 78, 12, 9, '#7a4a4a') + line('M 46 76 Q 54 84 62 76', '#3a1a1a', 1.4);
  s += circ(52, 26, 10, shade(skin, 0.1)) + eyes(50, 26, { size: 1.6 }) + line('M 50 32 L 58 31', OL, 1.2);
  s += flat('M 46 18 L 48 12 L 50 18 M 54 17 L 57 11 L 58 18', BONE, true, 1);
  s += limb('M 80 56 Q 94 70 86 86', skin, 12);
  s += weaponSvg('cleaver', { x: 86, y: 90 });
  s += line('M 30 40 L 74 42', '#6a6e78', 3) + line('M 30 40 L 74 42', OL, 0.8, 0.6);
  return { svg: svgDoc(s, -20, -2, 140, 122), vx: -20, vy: -2, w: 140, h: 122, ax: 52, ay: 112, height: (height * 122) / 100 };
}

// ── The roster ─────────────────────────────────────────────────────────────────────────────

const ORC = '#6f9a4a';
const ORC_D = '#5a7f3c';

export const MOB_HEIGHT: Record<MobKind, number> = { brute: 2.4, skirmisher: 1.6, archer: 2.15, caster: 2.3, elite: 3.3, sentry: 2.6 };

function mobSprite(clan: ThemeId, kind: MobKind): SpriteDef {
  const h = { height: MOB_HEIGHT[kind] };
  if (kind === 'sentry') return totem(clan);
  if (clan === 'orc') {
    switch (kind) {
      case 'brute':
        return humanoid({ build: 'heavy', skin: ORC, head: 'orc', hat: 'mohawk', hatColor: '#1d1b20', torso: 'bare', torsoColor: ORC, trim: '#5a3a24', legsColor: '#5a3a24', boots: '#3a2618', fur: '#7a5634', weapon: 'axe' }, h);
      case 'skirmisher':
        return humanoid({ build: 'lean', skin: '#a3b84a', head: 'goblin', hat: 'none', torso: 'rags', torsoColor: '#6a5a3a', legsColor: '#4a3a2a', weapon: 'dagger', offhand: 'dagger' }, h);
      case 'archer':
        return humanoid({ build: 'normal', skin: ORC_D, head: 'orc', hat: 'hood', hatColor: '#4a3a2a', torso: 'leather', torsoColor: '#6b4a2c', sleeves: '#6b4a2c', legsColor: '#4a3a2a', weapon: 'bow' }, h);
      case 'caster':
        return humanoid({ build: 'normal', skin: ORC, head: 'orc', hat: 'skullMask', torso: 'robe', torsoColor: '#5a4630', trim: '#c8342a', sleeves: '#5a4630', weapon: 'staffSkull' }, h);
      default:
        return humanoid({ build: 'heavy', skin: ORC_D, head: 'orc', hat: 'hornHelm', hatColor: '#3d424d', torso: 'armor', torsoColor: '#4a4f5a', trim: '#8e1f22', sleeves: ORC_D, pauldrons: '#3d424d', spikes: BONE, legsColor: '#3d424d', boots: '#25282f', weapon: 'greataxe' }, h);
    }
  }
  if (clan === 'dragon') {
    switch (kind) {
      case 'brute':
        return humanoid({ build: 'heavy', skin: '#b5452c', head: 'drakonid', torso: 'scales', torsoColor: '#b5452c', sleeves: '#b5452c', pauldrons: '#3a2b2b', spikes: '#e6c15c', legsColor: '#8e3522', boots: '#2a1e1e', weapon: 'sword', offhand: 'shield', shieldColor: '#5a2a22' }, h);
      case 'skirmisher':
        return dragon({ color: '#c9532d', belly: '#f0b25a', wings: false, horns: '#3a2a22', height: 1.4, small: true });
      case 'archer':
        return humanoid({ build: 'normal', skin: '#e0b08a', head: 'human', hat: 'dragonMask', hatColor: '#4a1e1e', torso: 'leather', torsoColor: '#5a1e1e', sleeves: '#3a1e1e', legsColor: '#2a1e1e', weapon: 'crossbow' }, h);
      case 'caster':
        return humanoid({ build: 'normal', skin: '#e0b08a', head: 'human', hat: 'dragonMask', hatColor: '#6a1e1a', torso: 'robe', torsoColor: '#7a1e1a', trim: '#e6c15c', sleeves: '#7a1e1a', weapon: 'staffFlame' }, h);
      default:
        return dragon({ color: '#a8321f', belly: '#f0a24a', wings: false, horns: '#2a1e1e', height: 2.8 });
    }
  }
  switch (kind) {
    case 'brute':
      return humanoid({ build: 'heavy', skin: BONE, head: 'skull', eyeGlow: '#6dffb0', torso: 'ribs', torsoColor: '#151012', sleeves: BONE, pauldrons: '#6a5a4a', legsColor: BONE, boots: '#4a4440', weapon: 'sword', offhand: 'shield', shieldColor: '#4a4440' }, h);
    case 'skirmisher':
      return humanoid({ build: 'lean', skin: '#9ab09a', head: 'human', eyeGlow: '#e6ff6a', hunched: true, torso: 'rags', torsoColor: '#4a4a3e', legsColor: '#5a5a4a', boots: '#3a3a30', weapon: 'claws' }, h);
    case 'archer':
      return humanoid({ build: 'normal', skin: BONE, head: 'skull', eyeGlow: '#6dffb0', hat: 'hood', hatColor: '#2a3436', torso: 'ribs', torsoColor: '#151012', sleeves: BONE, legsColor: BONE, boots: '#4a4440', weapon: 'bow' }, h);
    case 'caster':
      return humanoid({ build: 'normal', skin: '#c9d2c6', head: 'void', eyeGlow: '#6dffb0', hat: 'bigHood', hatColor: '#1e2426', torso: 'robe', torsoColor: '#1e2426', trim: '#3dd68c', sleeves: '#1e2426', weapon: 'staffGreen' }, h);
    default:
      return abomination(MOB_HEIGHT.elite);
  }
}

export const BOSS_HEIGHT: Record<BossKind, number> = { juggernaut: 5, hexer: 4.8, beast: 4.2, warden: 5, sovereign: 5.8 };

function bossSprite(clan: ThemeId, kind: BossKind): SpriteDef {
  const h = { height: BOSS_HEIGHT[kind] };
  if (clan === 'orc') {
    switch (kind) {
      case 'juggernaut':
        return humanoid({ build: 'heavy', skin: ORC_D, head: 'orc', hat: 'hornHelm', hatColor: '#2e2a26', torso: 'bare', torsoColor: ORC_D, trim: '#3a2618', sleeves: ORC_D, pauldrons: '#4a3a2a', spikes: BONE, fur: '#4a3020', legsColor: '#4a3020', boots: '#2a1a12', weapon: 'cleaver' }, h);
      case 'hexer':
        return humanoid({ build: 'normal', skin: '#7aa25a', head: 'orc', hat: 'skullMask', torso: 'robe', torsoColor: '#4a3a2a', trim: '#e6c15c', sleeves: '#4a3a2a', fur: '#7a5634', weapon: 'staffSkull' }, h);
      case 'beast':
        return beast({ kind: 'boar', height: BOSS_HEIGHT.beast });
      case 'warden':
        return humanoid({ build: 'heavy', skin: '#8a8f86', head: 'orc', hat: 'none', torso: 'bare', torsoColor: '#8a8f86', trim: '#4a3020', sleeves: '#8a8f86', fur: '#5a4030', legsColor: '#4a3a2a', boots: '#2a1e16', weapon: 'club' }, h);
      default:
        return humanoid({ build: 'heavy', skin: ORC_D, head: 'orc', hat: 'tuskCrown', torso: 'armor', torsoColor: '#3a3f4a', trim: '#8e1f22', sleeves: '#3a3f4a', pauldrons: '#2e3238', spikes: BONE, fur: '#4a3020', cape: '#7a1a1a', legsColor: '#2e3238', boots: '#1e2024', weapon: 'greataxe' }, h);
    }
  }
  if (clan === 'dragon') {
    switch (kind) {
      case 'juggernaut':
        return humanoid({ build: 'heavy', skin: '#8e2e22', head: 'drakonid', hat: 'horns', torso: 'scales', torsoColor: '#8e2e22', sleeves: '#8e2e22', pauldrons: '#2a1e1e', spikes: '#e6c15c', cape: '#2a1e1e', legsColor: '#6a2418', boots: '#1e1414', weapon: 'greatsword' }, h);
      case 'hexer':
        return humanoid({ build: 'normal', skin: '#e0b08a', head: 'human', eyeGlow: '#ff9a3a', hat: 'priestess', hatColor: '#5a1414', torso: 'robe', torsoColor: '#8a1a16', trim: '#e6c15c', sleeves: '#8a1a16', weapon: 'staffFlame' }, h);
      case 'beast':
        return dragon({ color: '#5a6a3a', belly: '#c9b46a', wings: true, horns: '#2a2418', height: BOSS_HEIGHT.beast });
      case 'warden':
        return humanoid({ build: 'heavy', skin: '#2a2222', head: 'helm', headColor: '#2a2222', eyeGlow: '#ff7a2a', torso: 'rock', torsoColor: '#2e2626', sleeves: '#2e2626', pauldrons: '#3a3030', legsColor: '#2e2626', boots: '#1e1818', weapon: 'club' }, h);
      default:
        return dragon({ color: '#7a1e14', belly: '#e8a040', wings: true, horns: '#e6c15c', height: BOSS_HEIGHT.sovereign, elder: true });
    }
  }
  switch (kind) {
    case 'juggernaut':
      return humanoid({ build: 'heavy', skin: '#3a3f4a', head: 'helm', headColor: '#2a2e36', eyeGlow: '#7fdcff', hat: 'horns', torso: 'armor', torsoColor: '#2e323a', trim: '#2a4a5a', sleeves: '#2e323a', pauldrons: '#22262c', spikes: '#9fb7c0', cape: '#16242a', legsColor: '#2a2e36', boots: '#16181c', weapon: 'greatsword' }, h);
    case 'hexer':
      return humanoid({ build: 'normal', skin: BONE, head: 'skull', eyeGlow: '#6dffb0', hat: 'crown', torso: 'robe', torsoColor: '#2a1e3a', trim: '#3dd68c', sleeves: '#2a1e3a', weapon: 'staffGreen' }, h);
    case 'beast':
      return beast({ kind: 'hound', height: BOSS_HEIGHT.beast });
    case 'warden':
      return wraith(BOSS_HEIGHT.warden);
    default:
      return humanoid({ build: 'heavy', skin: BONE, head: 'skull', eyeGlow: '#6dffb0', hat: 'crown', torso: 'armor', torsoColor: '#2a2e36', trim: '#3a2a4a', sleeves: '#2a2e36', pauldrons: '#22262c', spikes: BONE, cape: '#2a1a3a', legsColor: '#2a2e36', boots: '#16181c', weapon: 'scythe' }, h);
  }
}

const cache = new Map<string, SpriteDef>();

export function monsterArt(clan: ThemeId, kind: MobKind): SpriteDef {
  const key = `${clan}:${kind}`;
  let d = cache.get(key);
  if (!d) {
    d = mobSprite(clan, kind);
    cache.set(key, d);
  }
  return d;
}

export function bossArt(clan: ThemeId, kind: BossKind): SpriteDef {
  const key = `${clan}:boss:${kind}`;
  let d = cache.get(key);
  if (!d) {
    d = bossSprite(clan, kind);
    cache.set(key, d);
  }
  return d;
}

/** Every monster and boss, for the gallery. */
export function allMonsterSprites(): Record<string, SpriteDef> {
  const out: Record<string, SpriteDef> = {};
  for (const clan of ['orc', 'dragon', 'undead'] as ThemeId[]) {
    for (const kind of ['brute', 'skirmisher', 'archer', 'caster', 'elite', 'sentry'] as MobKind[]) out[`${clan} ${kind}`] = monsterArt(clan, kind);
    for (const kind of ['juggernaut', 'hexer', 'beast', 'warden', 'sovereign'] as BossKind[]) out[`${clan} boss ${kind}`] = bossArt(clan, kind);
  }
  return out;
}
