/**
 * Paints one frame of a hero: a solved skeleton dressed in the hero's design, the head cut from
 * the hero artwork, the weapon in hand, then outlined, with smears, glows and dust on top.
 */
import { ANCHOR_X, FRAME_H, FRAME_W, GROUND_Y, solve, weaponVec, type Body, type Pose, type Vec } from './skeleton.js';
import { Canvas, hex, INK, type Raster, type Ramp, type RGB, shiftRamp } from './paint.js';
import { paintWeapon, WEAPON_SHAPES, weaponPoint, type WeaponKind } from './weapons.js';
import type { HeroDesign } from './designs.js';

/** A hero's head cut from their artwork, with the point under the chin that sits on the neck. */
export interface Head extends Raster {
  ax: number;
  ay: number;
}

/** Cuts the head out of a hero sprite. Soft edges become hard so the outline stays crisp. */
export function cropHead(src: Raster, d: HeroDesign): Head {
  const { x0, y0, x1, y1, neckX, neckY } = d.head;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((y + y0) * src.w + x + x0) * 4;
      const di = (y * w + x) * 4;
      const a = src.data[si + 3] as number;
      if (a < 96) continue;
      data[di] = src.data[si] as number;
      data[di + 1] = src.data[si + 1] as number;
      data[di + 2] = src.data[si + 2] as number;
      data[di + 3] = 255;
    }
  }
  return { w, h, data, ax: neckX - x0, ay: neckY - y0 };
}

const far = (r: Ramp): Ramp => shiftRamp(r, -0.24);
const lerp = (a: Vec, b: Vec, t: number): Vec => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const at = (p: Vec, dx: number, dy: number): Vec => [p[0] + dx, p[1] + dy];

/** A point in the torso's frame (f forward, u up from the pelvis). */
const torso = (b: Body, f: number, u: number): Vec => [b.pelvis[0] + b.fwd[0] * f + b.up[0] * u, b.pelvis[1] + b.fwd[1] * f + b.up[1] * u];

function paintLeg(c: Canvas, d: HeroDesign, hip: Vec, knee: Vec, ankle: Vec, back: boolean): void {
  const k = back ? far : (r: Ramp) => r;
  const s = d.build;
  c.paint(c.mask().capsule(hip[0], hip[1], knee[0], knee[1], 4.4 * s, 3.6 * s), k(d.pants), { shade: 2 });
  c.paint(c.mask().capsule(knee[0], knee[1], ankle[0], ankle[1], 3.5 * s, 2.8 * s), k(d.pants), { shade: 2 });
  // Boot: the lower shin and a foot pointing forward.
  const top = lerp(knee, ankle, 0.42);
  const boot = c.mask().capsule(top[0], top[1], ankle[0], ankle[1], 3.5 * s, 3.1 * s);
  boot.poly([at(ankle, -3, -1.5), at(ankle, 2, -2.5), at(ankle, 7, 1), at(ankle, 7, 3.2), at(ankle, -3.2, 3.2)]);
  c.paint(boot, k(d.boot), { shade: 2 });
  c.line(top[0] - 3, top[1], top[0] + 3, top[1], k(d.boot)[0]);
  if (d.kneepad) c.paint(c.mask().ellipse(knee[0] + 0.5, knee[1], 3 * s, 2.8 * s), k(d.kneepad));
}

function paintArm(c: Canvas, d: HeroDesign, shoulder: Vec, elbow: Vec, hand: Vec, back: boolean, robed: boolean): void {
  const k = back ? far : (r: Ramp) => r;
  const s = d.build;
  c.paint(c.mask().capsule(shoulder[0], shoulder[1], elbow[0], elbow[1], 3.3 * s, 2.9 * s), k(d.sleeve), { shade: 1 });
  if (robed) {
    // Wide sleeves that flare at the wrist.
    c.paint(c.mask().capsule(elbow[0], elbow[1], hand[0], hand[1], 3 * s, 4.4 * s), k(d.sleeve), { shade: 1 });
    const cuff = lerp(elbow, hand, 0.82);
    c.paint(c.mask().capsule(cuff[0], cuff[1], hand[0], hand[1], 4.4 * s, 4.4 * s).filter((x, y) => Math.hypot(x + 0.5 - hand[0], y + 0.5 - hand[1]) > 3), k(d.trim), { line: false });
  } else {
    c.paint(c.mask().capsule(elbow[0], elbow[1], hand[0], hand[1], 2.9 * s, 2.5 * s), k(d.sleeve), { shade: 1 });
    const cuff = lerp(elbow, hand, 0.45);
    c.paint(c.mask().capsule(cuff[0], cuff[1], hand[0], hand[1], 3.1 * s, 2.7 * s), k(d.glove), { shade: 1 });
  }
}

function paintHand(c: Canvas, d: HeroDesign, hand: Vec, back: boolean): void {
  const r = d.glove === d.skin || d.sleeve === d.skin ? d.skin : d.glove;
  c.paint(c.mask().ellipse(hand[0], hand[1], 2.5 * d.build, 2.4 * d.build), back ? far(r) : r);
}

function paintPauldron(c: Canvas, d: HeroDesign, b: Body, shoulder: Vec, back: boolean): void {
  if (!d.pauldron) return;
  const p = at(shoulder, b.up[0] * 1.5, b.up[1] * 1.5);
  c.paint(c.mask().ellipse(p[0], p[1], 5.4 * d.build, 4.4 * d.build), back ? far(d.pauldron) : d.pauldron, { shade: 2 });
  c.line(p[0] - 4, p[1] + 2, p[0] + 4, p[1] + 2, (back ? far(d.pauldron) : d.pauldron)[2]);
}

function paintTorso(c: Canvas, d: HeroDesign, b: Body): void {
  const s = d.build;
  const pts: [number, number][] = [[-6.2 * s, 0], [-7 * s, 14], [-6.8 * s, 22], [-3, 26.5], [3, 26.5], [6.4 * s, 23], [7.4 * s, 15], [6 * s, 0]];
  // Hips under the belt join the thighs.
  c.paint(c.mask().poly([torso(b, -6.4 * s, 1), torso(b, 6.2 * s, 1), torso(b, 5.6 * s, -6), torso(b, -5.8 * s, -6)]), d.pants, { shade: 2 });
  c.paint(c.mask().poly(pts.map(([f, u]) => torso(b, f, u))), d.chest, { shade: 2 });
  if (d.front) c.paint(c.mask().poly([torso(b, 1.2, 25), torso(b, 4.8 * s, 24), torso(b, 4.4 * s, 1), torso(b, 1, 1)]), d.front, { line: false });
  // Plate seams or stitching across the chest.
  c.line(...torso(b, -6 * s, 16), ...torso(b, 6.8 * s, 17), d.chest[2]);
  c.paint(c.mask().poly([torso(b, -6.5 * s, 4), torso(b, 6.3 * s, 4), torso(b, 6.1 * s, 0.5), torso(b, -6.3 * s, 0.5)]), d.belt, { line: false });
  c.dots([torso(b, 3.5, 2.5), torso(b, 4.5, 2.5)], d.trim[0]);
  c.line(...torso(b, -2.5, 26), ...torso(b, 3, 26), d.trim[1]);
}

function paintSkirt(c: Canvas, d: HeroDesign, b: Body, pose: Pose): void {
  const s = d.build;
  const wind = pose.wind ?? 0;
  const r = d.skirt.ramp;
  switch (d.skirt.kind) {
    case 'tassets': {
      c.paint(c.mask().poly([torso(b, -6.6 * s, 1), torso(b, 6.6 * s, 1), torso(b, 7.4 * s, -11), torso(b, 0.5, -10), torso(b, -7.6 * s, -11)]), r, { shade: 2 });
      c.line(...torso(b, 0.4, 0), ...torso(b, 0.5, -10), r[2]);
      if (d.front) c.paint(c.mask().poly([torso(b, 1, 1), torso(b, 4.6, 1), torso(b, 4.4, -15), torso(b, 2.8, -17), torso(b, 1.2, -15)]), d.front, { shade: 1 });
      break;
    }
    case 'tunic':
      c.paint(c.mask().poly([torso(b, -6.6 * s, 1), torso(b, 6.4 * s, 1), torso(b, 7.2 * s, -9), torso(b, 4, -11), torso(b, 1, -9), torso(b, -2, -11), torso(b, -7.4 * s, -9)]), r, { shade: 2 });
      break;
    case 'coat': {
      // Coat tails behind the legs, blown back when running.
      const back0 = torso(b, -6.4 * s, 1);
      const back1: Vec = [back0[0] - 3 - wind * 12, back0[1] + 18 - wind * 6];
      const mid1: Vec = [back0[0] + 4 - wind * 9, back0[1] + 20 - wind * 5];
      c.paint(c.mask().poly([back0, torso(b, 6.2 * s, 1), torso(b, 6.6 * s, -7), mid1, at(back1, 2, 1), back1]), r, { shade: 2 });
      break;
    }
    case 'robe': {
      // Floor-length robes: the hem spans both feet and trails behind.
      const waistB = torso(b, -6.4 * s, 2);
      const waistF = torso(b, 6.2 * s, 2);
      const hemY = Math.max(b.ankleF[1], b.ankleB[1]) + 1;
      const backX = Math.min(b.ankleB[0], b.ankleF[0], waistB[0]) - 5 - wind * 7;
      const frontX = Math.max(b.ankleF[0], b.ankleB[0], waistF[0]) + 4 - wind * 2;
      const kneeY = (waistB[1] + hemY) / 2;
      const robe = c.mask().poly([waistB, waistF, [frontX - 1, kneeY], [frontX + 1, hemY], [(frontX + backX) / 2, hemY + 1], [backX, hemY - 1 - wind * 3], [backX + 2, kneeY]]);
      c.paint(robe, r, { shade: 2 });
      c.line(frontX + 1, hemY, backX, hemY - 1 - wind * 3, d.trim[1]);
      if (d.front) {
        const top = torso(b, 3.5, 2);
        c.paint(c.mask().poly([top, at(top, 2.5, 0), [frontX - 1, hemY - 1], [frontX - 5, hemY]]), d.front, { line: false });
        c.line(top[0], top[1], frontX - 5, hemY, d.trim[1]);
      }
      break;
    }
  }
}

function paintCape(c: Canvas, d: HeroDesign, b: Body, pose: Pose): void {
  if (!d.cape) return;
  // Even at rest a cape swings a little behind the body, so it shows.
  const wind = Math.max(0.12, pose.wind ?? 0);
  const ang = (wind * 74 * Math.PI) / 180;
  const dir: Vec = [-Math.sin(ang), Math.cos(ang)];
  const side: Vec = [dir[1], -dir[0]];
  const L = d.cape.length;
  const a1 = at(b.shoulderB, -2, -1);
  const a2 = at(b.neck, 1.5, 1.5);
  const spread = 4 + wind * 4;
  const b1: Vec = [a1[0] + dir[0] * L - side[0] * spread, a1[1] + dir[1] * L - side[1] * spread];
  const b2: Vec = [a2[0] + dir[0] * (L - 4) + side[0] * spread, a2[1] + dir[1] * (L - 4) + side[1] * spread];
  const hem: Vec[] = [];
  for (let i = 0; i <= 6; i++) {
    const p = lerp(b2, b1, i / 6);
    const ripple = (i % 2 ? 2.5 : 0) + Math.sin(i * 1.7 + wind * 5) * wind * 2.5;
    hem.push([p[0] + dir[0] * ripple, p[1] + dir[1] * ripple]);
  }
  c.paint(c.mask().poly([a2, a1, ...hem.reverse()]), d.cape.ramp, { shade: 2 });
  for (const t of [0.35, 0.7]) {
    const top = lerp(a1, a2, t);
    const bottom = lerp(b1, b2, t);
    c.line(top[0], top[1] + 2, (top[0] + bottom[0]) / 2, (top[1] + bottom[1]) / 2, d.cape.ramp[2]);
  }
}

function paintHair(c: Canvas, d: HeroDesign, b: Body, pose: Pose): void {
  if (!d.hair) return;
  const wind = pose.wind ?? 0;
  const ang = ((10 + wind * 70) * Math.PI) / 180;
  const dir: Vec = [-Math.sin(ang), Math.cos(ang)];
  const root = at(b.neck, -4.5, -8);
  const L = d.hair.length;
  const end: Vec = [root[0] + dir[0] * L, root[1] + dir[1] * L];
  const mid: Vec = [(root[0] + end[0]) / 2 + Math.sin(wind * 5) * 1.5, (root[1] + end[1]) / 2];
  c.paint(c.mask().capsule(root[0], root[1], mid[0], mid[1], 5, 4.4).capsule(mid[0], mid[1], end[0], end[1], 4.4, 2), d.hair.ramp, { shade: 2 });
  c.line(root[0], root[1] + 2, end[0] + 1, end[1] - 2, d.hair.ramp[2]);
}

function paintScarf(c: Canvas, d: HeroDesign, b: Body, pose: Pose, wrap: boolean): void {
  if (!d.scarf) return;
  const wind = pose.wind ?? 0;
  const knot = at(b.neck, -3, 2);
  if (!wrap) {
    const ang = ((30 + wind * 60) * Math.PI) / 180;
    const dir: Vec = [-Math.sin(ang), Math.cos(ang)];
    const L = 15 + wind * 7;
    const pts: Vec[] = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const wave = Math.sin(t * 5 + wind * 3) * 2 * t;
      pts.push([knot[0] + dir[0] * L * t - dir[1] * wave, knot[1] + dir[1] * L * t + dir[0] * wave]);
    }
    const m = c.mask();
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i] as Vec;
      const q = pts[i + 1] as Vec;
      m.capsule(p[0], p[1], q[0], q[1], 2.6 - i * 0.35, 2.2 - i * 0.35);
    }
    c.paint(m, d.scarf, { shade: 1 });
    return;
  }
  c.paint(c.mask().ellipse(b.neck[0] + 0.5, b.neck[1] + 1, 5.6, 3), d.scarf, { shade: 2 });
}

function paintQuiver(c: Canvas, b: Body): void {
  const top = torso(b, -6, 25);
  const bottom = torso(b, -9, 5);
  c.paint(c.mask().capsule(top[0], top[1], bottom[0], bottom[1], 3.2, 2.8), shiftRamp(hexRamp('#8a5c36', '#5e3c22', '#382212'), 0), { shade: 1 });
  const dir: Vec = [top[0] - bottom[0], top[1] - bottom[1]];
  const len = Math.hypot(dir[0], dir[1]);
  const u: Vec = [dir[0] / len, dir[1] / len];
  for (let i = -1; i <= 1; i++) {
    const base = at(top, -u[1] * i * 2, u[0] * i * 2);
    const tip = at(base, u[0] * 5, u[1] * 5);
    c.line(base[0], base[1], tip[0], tip[1], hex('#c8b08a'));
    c.dots([tip, at(tip, -1, 0)], i === 0 ? hex('#ffffff') : hex('#d84040'));
  }
}

const hexRamp = (a: string, b: string, cc: string): Ramp => [hex(a), hex(b), hex(cc)];

// ── Effects ──────────────────────────────────────────────────────────────────────────────────

const SMEAR: RGB = hex('#f4f8ff');

function smear(c: Canvas, kind: WeaponKind, hand: Vec, from: number, to: number, tint: RGB): void {
  const [r0, r1] = WEAPON_SHAPES[kind].reach;
  const span = to - from;
  const step = Math.max(1, (57 / Math.max(10, r1)) * 0.9);
  const n = Math.max(2, Math.ceil(Math.abs(span) / step));
  const color: RGB = [Math.round((SMEAR[0] + tint[0]) / 2), Math.round((SMEAR[1] + tint[1]) / 2), Math.round((SMEAR[2] + tint[2]) / 2)];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const dir = weaponVec(from + span * t);
    const a = weaponPoint(hand, dir, r0 + (r1 - r0) * 0.35 * (1 - t), 0);
    const b = weaponPoint(hand, dir, r1 + 2, 0);
    const alpha = 0.12 + 0.6 * t * t;
    const len = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (let k = 0; k <= len; k++) {
      const x = a[0] + ((b[0] - a[0]) * k) / len;
      const y = a[1] + ((b[1] - a[1]) * k) / len;
      // Brightest along the outer edge of the arc.
      const edge = k / len;
      c.glow(x, y, edge > 0.85 ? SMEAR : color, alpha * (0.45 + 0.55 * edge));
    }
  }
}

function burst(c: Canvas, p: Vec, r: number, col: RGB, a = 0.9): void {
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4 + 0.3;
    const len = k % 2 ? r : r * 0.55;
    for (let i = 1; i <= len; i++) c.glow(p[0] + Math.cos(ang) * i, p[1] + Math.sin(ang) * i, col, a * (1 - i / (len + 1)));
  }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) c.glow(p[0] + x, p[1] + y, hex('#ffffff'), a);
}

function auraRim(c: Canvas, col: RGB, k: number): void {
  const r = 2;
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (c.opaque(x, y)) continue;
      let near = 9;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (c.opaque(x + dx, y + dy)) near = Math.min(near, Math.max(Math.abs(dx), Math.abs(dy)));
      if (near <= r) c.glow(x, y, col, k * (near === 1 ? 0.8 : 0.4));
    }
  }
}

function effects(c: Canvas, d: HeroDesign, b: Body, pose: Pose): void {
  const fx = pose.fx;
  if (!fx) return;
  const tint = d.aura;
  if (fx.smear !== undefined) smear(c, d.weapon, b.handF, fx.smear, pose.weapon, tint);
  if (fx.smear2 !== undefined && d.weapon2) smear(c, d.weapon2, b.handB, fx.smear2, pose.weapon2 ?? pose.weapon, tint);
  const tip = weaponPoint(b.handF, b.weaponDir, WEAPON_SHAPES[d.weapon].reach[1], 0);
  if (fx.impact) burst(c, tip, 9, hex('#fff2b0'));
  if (fx.flash) burst(c, weaponPoint(b.handF, b.weaponDir, WEAPON_SHAPES[d.weapon].reach[1] + 2, 0), 6, hex('#fff6c8'));
  if (fx.dust) {
    for (const [dx, r] of [[-6, 3], [-11, 2.4], [-15, 1.8]] as [number, number][]) {
      const foot = b.ankleB[1] > b.ankleF[1] ? b.ankleB : b.ankleF;
      for (let y = -r; y <= r; y++) for (let x = -r * 1.4; x <= r * 1.4; x++) if ((x / 1.4) ** 2 + y * y <= r * r) c.glow(foot[0] + dx + x, GROUND_Y - 1 + y - r * 0.4, hex('#d8cdb8'), 0.45);
    }
  }
  if (fx.speed) {
    for (let k = 0; k < 5; k++) {
      const y = b.pelvis[1] - 28 + k * 8 + (k % 2) * 2;
      const x0 = b.pelvis[0] - 14 - (k % 3) * 3;
      const len = 14 + ((k * 7) % 11);
      for (let i = 0; i < len; i++) c.glow(x0 - i, y, hex('#ffffff'), 0.4 * (1 - i / len));
    }
  }
  if (fx.circle) {
    const cx = ANCHOR_X + pose.x;
    const rx = 24 * fx.circle;
    const ry = 6.5 * fx.circle;
    for (let y = -ry - 1; y <= ry + 1; y++) {
      for (let x = -rx - 1; x <= rx + 1; x++) {
        const e = Math.hypot(x / rx, y / ry);
        if (e > 1.08) continue;
        const ring = Math.abs(e - 0.92) < 0.08 || Math.abs(e - 0.6) < 0.06;
        c.glow(cx + x, GROUND_Y + y, d.aura, ring ? 0.85 : 0.14, true);
      }
    }
  }
  if (fx.quake) {
    for (let k = 0; k < 4; k++) {
      const cx = ANCHOR_X + pose.x + 18 + k * 9;
      const rx = 5 + k * 1.5;
      for (let x = -rx; x <= rx; x++) c.glow(cx + x, GROUND_Y - Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) * (3 + k) , hex('#ffe2a0'), 0.7 - k * 0.12, true);
      c.glow(cx - 2, GROUND_Y - 5 - k, hex('#b8a888'), 0.9);
      c.glow(cx + 3, GROUND_Y - 7 - k * 2, hex('#9a8a6c'), 0.9);
    }
  }
  if (fx.aura) auraRim(c, d.aura, fx.aura);
}

// ── The hero ─────────────────────────────────────────────────────────────────────────────────

/** Paints one posed frame of a hero. */
export function renderHero(d: HeroDesign, pose: Pose, head: Head | null): Raster {
  const c = new Canvas(FRAME_W, FRAME_H);
  const shape = WEAPON_SHAPES[d.weapon];
  const twoHanded = shape.grip2 !== null && !pose.handB;
  const b = solve(pose, twoHanded ? shape.grip2 : null);
  const robed = d.skirt.kind === 'robe';

  paintCape(c, d, b, pose);
  paintHair(c, d, b, pose);
  if (d.quiver) paintQuiver(c, b);
  paintScarf(c, d, b, pose, false);
  if (d.weapon2 && !pose.front2) paintWeapon(c, d.weapon2, b.handB, b.weapon2Dir);
  paintArm(c, d, b.shoulderB, b.elbowB, b.handB, true, robed);
  if (!twoHanded || pose.behind) paintHand(c, d, b.handB, true);
  paintPauldron(c, d, b, b.shoulderB, true);
  paintLeg(c, d, b.hipB, b.kneeB, b.ankleB, true);
  if (pose.behind) {
    paintWeapon(c, d.weapon, b.handF, b.weaponDir, pose.draw ? b.handB : undefined);
    if (twoHanded) paintHand(c, d, b.handB, true);
  }
  paintTorso(c, d, b);
  paintLeg(c, d, b.hipF, b.kneeF, b.ankleF, false);
  paintSkirt(c, d, b, pose);
  // Neck and head.
  const neckTop = at(b.neck, b.up[0] * 3, b.up[1] * 3);
  c.paint(c.mask().capsule(b.neck[0], b.neck[1], neckTop[0], neckTop[1], 2.4, 2.2), d.skin, { line: false });
  paintScarf(c, d, b, pose, true);
  if (head) c.stamp(head, Math.round(b.neck[0] + b.up[0] * 2.5 - head.ax + 0.5), Math.round(b.neck[1] + b.up[1] * 2.5 - head.ay));
  else c.paint(c.mask().ellipse(b.neck[0] + 1, b.neck[1] - 8, 6, 7), d.skin, { shade: 2 });
  if (d.weapon2 && pose.front2) paintWeapon(c, d.weapon2, b.handB, b.weapon2Dir);
  paintArm(c, d, b.shoulderF, b.elbowF, b.handF, false, robed);
  paintPauldron(c, d, b, b.shoulderF, false);
  if (!pose.behind) {
    paintWeapon(c, d.weapon, b.handF, b.weaponDir, pose.draw ? b.handB : undefined);
    if (twoHanded) paintHand(c, d, b.handB, false);
  }
  paintHand(c, d, b.handF, false);
  c.outline(INK);
  effects(c, d, b, pose);
  return c.flatten();
}
