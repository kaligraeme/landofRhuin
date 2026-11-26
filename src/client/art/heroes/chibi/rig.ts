/**
 * The chibi rig: the pose format the choreography files write, the 3D skeleton solved from a pose,
 * and the camera that turns hero space into frame pixels for each view.
 *
 * Hero space is a right-handed frame `[f, u, r]` in pixels: f forward (where he faces), u up from
 * the ground under him, r toward his right hand. The main weapon is in his right hand.
 *
 * The camera looks down a little: a pixel of depth toward the viewer shows `DEPTH` pixels lower on
 * screen (as in turned.ts), heights stay true and the ground anchor stays put. A view is a yaw of
 * the whole figure: side on he faces right and turns `SIDE_YAW` degrees toward the viewer (his
 * right side, the sword side, is the near side), front on he faces the viewer, back on he faces
 * away. A pose's `turn` adds to that yaw, so one choreography serves all three views.
 *
 * A design may also give an item for the left hand (`ChibiDesign.offhand`: a wand, a second
 * blade); the pose then sets its angles as it does the main weapon's (`weaponB`, `rollB`, `yawB`).
 */
import type { Vec } from '../skeleton.js';
import type { Canvas, RGB } from '../paint.js';

export type V3 = readonly [number, number, number];

export const add3 = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len3 = (a: V3): number => Math.sqrt(dot3(a, a));
export const norm3 = (a: V3): V3 => {
  const n = len3(a) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** An orthonormal frame in hero space: an origin and its forward, up and right axes. */
export interface Frame3 {
  o: V3;
  f: V3;
  u: V3;
  r: V3;
}

/** A point given in a frame's own axes. */
export const at3 = (fr: Frame3, f: number, u: number, r: number): V3 => [
  fr.o[0] + fr.f[0] * f + fr.u[0] * u + fr.r[0] * r,
  fr.o[1] + fr.f[1] * f + fr.u[1] * u + fr.r[1] * r,
  fr.o[2] + fr.f[2] * f + fr.u[2] * u + fr.r[2] * r,
];
/** A direction given in a frame's own axes. */
export const dirIn = (fr: Frame3, f: number, u: number, r: number): V3 => [
  fr.f[0] * f + fr.u[0] * u + fr.r[0] * r,
  fr.f[1] * f + fr.u[1] * u + fr.r[1] * r,
  fr.f[2] * f + fr.u[2] * u + fr.r[2] * r,
];

/** Rotates a frame's axes: pitch about its r axis (+ tips forward), roll about f (+ toward its right), yaw about u (+ turns toward its right). */
export function rotate(fr: Frame3, pitch: number, roll = 0, yaw = 0): Frame3 {
  let { f, u, r } = fr;
  if (pitch) {
    const c = Math.cos(rad(pitch));
    const s = Math.sin(rad(pitch));
    [f, u] = [add3(mul3(f, c), u, -s), add3(mul3(u, c), f, s)];
  }
  if (roll) {
    const c = Math.cos(rad(roll));
    const s = Math.sin(rad(roll));
    [u, r] = [add3(mul3(u, c), r, s), add3(mul3(r, c), u, -s)];
  }
  if (yaw) {
    const c = Math.cos(rad(yaw));
    const s = Math.sin(rad(yaw));
    [f, r] = [add3(mul3(f, c), r, s), add3(mul3(r, c), f, -s)];
  }
  return { o: fr.o, f, u, r };
}

// ── The pose format ──────────────────────────────────────────────────────────────────────────

/**
 * A side-plane point: `[forward, down]`, with an optional third value `out` that moves it sideways
 * (see the fields that use it). Feet use `[forward, y]` where negative y lifts the foot off the ground.
 */
export type P2 = readonly [number, number] | readonly [number, number, number];

/** What a choreographer's `fx.extra` painter is given. */
export interface FxContext {
  c: Canvas;
  cam: Camera;
  rig: Rig;
  /** Hero space to frame pixels, and to depth toward the viewer. */
  proj: (p: V3) => Vec;
  depth: (p: V3) => number;
  /** Where the main weapon's tip is (its `tip`, or the end of its reach), in hero space (its grip is `rig.weapon.o`). */
  tip: V3;
  /**
   * Where the off-hand item's tip is (its grip is `rig.offhand.o`): where its spells leave it. A
   * design with nothing in the off hand has it at the left hand.
   */
  tipB: V3;
  /**
   * Is a point behind the figure (farther from the viewer than the middle of the body)? An
   * effect painted there goes on the canvas's under layer, so the figure hides it.
   */
  behind: (p: V3) => boolean;
  /**
   * The hero's aura colours (the design's `aura`): core, edge, and hot, the white-hot of a
   * smear's cutting edge (crimson, violet and a pale pink-white for the Dark Knight).
   */
  aura: { core: RGB; edge: RGB; hot: RGB };
  /** A seeded noise in [0, 1): the same arguments always give the same value. */
  hash: (a: number, b?: number) => number;
}

/**
 * Effects on a frame. Numbers are strengths from 0 (off) to 1 unless stated; angles are degrees.
 *
 *  - `smear`: a swoosh arc behind the blade, swept from where the blade was to where it is now.
 *    `from` is the weapon angle it swept from (same convention as `weapon`), `roll`/`yaw` that
 *    angle's plane (they default to the pose's), `width` how far down the blade the arc reaches
 *    (0 to 1, default 0.55), `alpha` its strength. The arc is white-hot (the aura's hot colour)
 *    along the cutting edge, fading through the aura's core colour to nothing; parts of it behind the body show only around it,
 *    and it never covers the head.
 *  - `ring`: a level ring around him at blade height, for spins: `from` and `to` are angles round
 *    him in degrees in the same frame as `turn` (0 is the way he faces at `turn: 0`, 90 his right
 *    there), so a ring stays put in the world while he spins inside it. It runs from its faint
 *    tail (`from`) to its bright head (`to`); a blade held out to his right is at `turn + 90`.
 *    `height` above the ground (default the height of the middle of the weapon's reach: the
 *    blade, or a pole arm's head), `radius` (default the blade's reach + 4).
 *    Smears are turned to show their face when a swing comes straight at the viewer; rings are
 *    not (they stay level).
 *  - `impact`: a starburst at the blade's tip (or at `impactAt`, a hero-space point), size 1 = 10 px.
 *  - `clang`: a guard's clang: a hard white flash and sparks on the blade, 0 to 1.
 *  - `dust`: dust kicked up at the feet. `speed`: speed lines trailing behind him.
 *  - `aura`: a rim of power around the figure in the aura's core colour, with its edge colour
 *    outermost (crimson and violet for the Dark Knight).
 *  - `circle`: a rune circle on the ground under him (its size grows with the value).
 *  - `shock`: a shockwave ring rolling out along the ground, 0 (just landed) to 1 (spread out).
 *    `shockAt` moves its centre (hero space, on the ground; default under the blade's tip).
 *  - `wisps`: wisps in the aura's colours drawn in toward him from all around: 0 far out, 1 arrived.
 *  - `blood`: a red mist of blood around him (Ruination's price), 0 to 1.
 *  - `rune`: how brightly the weapon's rune channel glows: at 0 it smoulders in its rest colour
 *    with barely a glow, toward 1 it blazes (an aura makes it glow a little too).
 *  - `glow`: the body glows from within (Drain), 0 to 1.
 *  - `smearB`, `runeB`, `impactB`: the same for the off-hand item (the design's `offhand`): a
 *    smear it sweeps (`from`, `roll` and `yaw` given as `weaponB`, `rollB` and `yawB` are, so
 *    mirrored), its glow (a wand's crystal) and a starburst at its tip.
 *  - `lightning`: a jagged, forking bolt with a white-hot core, from the off-hand item's tip
 *    (`from: 'off'`, the default when the design has one), the main weapon's (`'main'`) or a
 *    hero-space point, to the point `to`, or `len` (default 56) along `dir` (default the item's
 *    own axis, so a wand thrust forward throws it forward). `seed` reshapes it (change it every
 *    frame and it crackles), `forks` is how many branches split off (default 3), `alpha` its
 *    strength. Bolts going away from the viewer pass behind him.
 *  - `ward`: a ring of runes round him, `k` from 0 (just rising off the floor, faint) to 1 (at
 *    full height, bright); `radius` (default 24) and `height` above the ground (default 26), `spin`
 *    turns the runes round him (degrees: advance it every frame), `runes` how many (default 10).
 *    `dome: true` makes it a dome of hexagons over him instead, brightest at its rim. The half
 *    nearer the viewer is painted over him (faintly, so he shows through), the far half behind.
 *  - `swirl`: a spiral of wind streaks round a line, `k` its strength: a drill of wind along the
 *    main weapon from its head to well past its tip (`on: 'main'`, the default: a thrust), along
 *    the off-hand item (`'off'`), or round him from his knees to his chest (`'body'`: a spin).
 *    `from` and `to` (hero space) set the line outright; `radius` (default 8 along a weapon, 26
 *    round him), `taper` (the radius at `to` as a share of it at `from`, default 0.3 along a
 *    weapon, 1 round him), `turns` (default 1.6 along a weapon, 1 round him) and `spin` (turns:
 *    advance it every frame so the streaks run on). Streaks behind the line pass behind whatever is there.
 *  - `ghosts`: afterimages of the whole figure (as painted, before effects) trailing behind a
 *    dash, in the aura's colours, fading with distance: `k` their strength, `n` how many (default
 *    2), `gap` pixels between them on screen (default 10; down to half that when the dash runs
 *    toward or away from the viewer), `dir` the hero-space way they trail (default behind him).
 *    They lie under the figure, so only what sticks out of it shows.
 *  - `extra`: paints anything else, after the built-in effects, from the choreography's own file.
 */
export interface ChibiFx {
  smear?: { from: number; roll?: number; yaw?: number; width?: number; alpha?: number };
  ring?: { from: number; to: number; height?: number; radius?: number };
  impact?: number;
  impactAt?: V3;
  clang?: number;
  dust?: number;
  speed?: number;
  aura?: number;
  circle?: number;
  shock?: number;
  shockAt?: V3;
  wisps?: number;
  blood?: number;
  rune?: number;
  glow?: number;
  smearB?: { from: number; roll?: number; yaw?: number; width?: number; alpha?: number };
  runeB?: number;
  impactB?: number;
  lightning?: { from?: 'main' | 'off' | V3; to?: V3; dir?: V3; len?: number; seed?: number; forks?: number; alpha?: number };
  ward?: { k: number; radius?: number; height?: number; spin?: number; runes?: number; dome?: boolean };
  swirl?: { k: number; on?: 'main' | 'off' | 'body'; from?: V3; to?: V3; radius?: number; taper?: number; turns?: number; spin?: number };
  ghosts?: { k: number; n?: number; gap?: number; dir?: V3 };
  extra?: (ctx: FxContext) => void;
}

/** Facial expressions. */
export type Face = 'stern' | 'shout' | 'grit' | 'hurt' | 'closed' | 'smirk';

/**
 * One frame of choreography, authored side on (as in moves.ts) and lifted into 3D by the rig.
 * Distances are pixels of a figure about 84 px tall (the head with its hair is about 29 of them);
 * angles are degrees.
 *
 * Body
 *  - `x`, `y`: the pelvis moved from standing: + forward, + down (a crouch); negative y is in the
 *    air (a leap). Standing relaxed is about `y: 1`; a low battle crouch `y: 4` to `6`.
 *  - `lean`: the torso leans forward (+) or back (-) from the hips.
 *  - `twist`: the chest turns on the hips: + turns it toward his right, taking the right shoulder
 *    back (as when winding a right-handed cut up behind him); - brings the right shoulder forward
 *    (the follow-through of such a cut). About 25 either way is a strong turn.
 *  - `tilt`: the torso leans sideways, + toward his right.
 *  - `turn`: the WHOLE body turns about the vertical, + toward his right. Side on, +58 turns him to
 *    face the viewer and 180 turns him to face left; Eclipse spins through 0..360.
 *  - `head`: the head tips down (+) or up (-). `look`: the head turns, + toward his right (side on,
 *    toward the viewer). The head follows half the torso's lean on its own.
 *  - `face`: the expression (default 'stern').
 *
 * Limbs (side-plane points; the rig moves them out to their side of the body in 3D)
 *  - `footF`, `footB`: his right foot (the near one side on) and his left foot, `[forward, y]`
 *    relative to the ground point under him; negative y lifts the foot. A third value moves the
 *    foot outward from his centre line (default: hip width). Knees are solved, bending forward.
 *  - `kneel`: 'F' or 'B' turns that foot back onto its toes, as a kneeling leg's is. To kneel,
 *    put that foot about 12 behind the pelvis at y 0 and drop the pelvis to `y` 12 or 13: the
 *    knee then rests on the ground.
 *  - `handF`, `handB`: his right hand (sword hand) and left hand, `[forward, down]` from the base
 *    of the neck. A third value moves the hand outward from his centre line (+) or across his
 *    body (-); without it, hands sit beside the shoulders and come in toward the middle as they
 *    reach forward or up. Leave `handB` out for a two-handed grip: the left hand then takes the
 *    weapon's second grip below the right. Elbows are solved, bending down, back and out.
 *
 * Weapon (in the right hand)
 *  - `weapon`: the blade's angle in the side plane: 0 points up, 90 forward, 180 down, -90 (or
 *    270) back. Angles beyond ±180 are fine (a full swing over the top goes -120 → 0 → 150).
 *  - `roll`: tips the blade's plane about his forward axis, + carrying the tip toward his right
 *    when it is up (and toward his left when it is down): a diagonal cut from high on his right
 *    to low on his left is `weapon` running -70 → 110 with `roll` about 40; a rising backhand back
 *    up the same diagonal keeps the roll and runs `weapon` the other way; `roll: -40` is the other
 *    diagonal. Seen from the front this is what makes blows sweep across the body rather than
 *    straight at the viewer.
 *  - `yaw`: turns the blade about the vertical like `turn` does the body (clockwise seen from
 *    above): a blade pointing ahead swings to his right, one pointing behind him swings to his
 *    left (so a blade resting back over his right shoulder takes a negative yaw to stand clear of
 *    his head seen from the front). A level blade held out to his right for Eclipse is
 *    `weapon: 90, yaw: 90`.
 *  - `grip`: slides the right hand along the grip (+ toward the guard); `drop`: the sword is not
 *    held (ko, kneel) and lies where `dropAt` (hero space `[f, u, r]` of the grip) puts it, at
 *    `weapon`/`roll`/`yaw` as usual.
 *  - `grip2`: where the left hand holds a two-handed weapon, along it from the weapon's origin
 *    (+ toward the tip; the design's `grip2` when left out). With `grip` it sets both hands'
 *    places on a pole arm's haft (pole.ts; its origin is where the right hand holds it at rest,
 *    the butt below at negative values, the head above): a thrust slides the front hand up
 *    toward the head, a spin holds the haft with both hands near its middle, a vault grips it
 *    near the butt (`grip` and `grip2` both well below 0, so the weapon reaches far past the
 *    hands). The weapon still hangs from the right hand at `weapon`/`roll`/`yaw`; the left hand
 *    reaches for its place, so keep that place within its arm's reach (about 18 from the left
 *    shoulder) or the hand falls short of the haft.
 *
 * Off-hand item (in the left hand, when the design has one: a wand, a second blade, later a bow)
 *  - `weaponB`, `rollB`, `yawB`: its angles, as `weapon`, `roll` and `yaw` are for the main
 *    weapon but mirrored, so the same numbers in both hands make a symmetrical pose: `weaponB`
 *    0 points up, 90 forward, 180 down (default 160, hanging forward from a lowered hand);
 *    `rollB` + carries its tip out to his left when it is up; `yawB` + swings an item pointing
 *    ahead out to his left. A wand thrust straight ahead is `weaponB: 90` with `handB` reaching
 *    forward; raised overhead, `weaponB: 0` to `-20`.
 *  - `handB` is its hand: give it in every pose. Leaving it out puts the left hand (item and all)
 *    on the main weapon's second grip, as for a two-handed blow: point the item down and back out
 *    of the way then (`weaponB` about 200).
 *  - `dropB`, `dropAtB`: the item is not held and lies at `dropAtB` (as `drop` and `dropAt`).
 *
 * Cloth and hair (coat tails and skirts, a cape, scarf tails, a pole arm's ribbon, long hair and
 * a ponytail all answer to these)
 *  - `wind`: they stream back (0 hanging, 1 flying flat behind him). Down to -0.8 flicks the
 *    cloth forward instead (a flinch thrown back); the hair stays put. Coat tails, a cape, scarf
 *    tails and long hair blown straight at or away from the viewer open out a little to their
 *    side, so they still show their length.
 *  - `lift`: an updraft: they rise and spread (falling, leaping, a burst of power), -1 to 1.
 *  - `flare`: they swing out around him (spins), 0 to 1.
 *  - `sway`: they swing sideways, -1 (to his left) to 1 (to his right). Nothing remembers the
 *    frame before, so for hair and cloth that lag behind a turn, sway them against the turn (a
 *    turn toward his right sways them to his left) and give them some wind and flare.
 *  - `phase`: where the ripple running down them is, in turns (advance it ~1/n per frame of an
 *    n-frame loop so the cloth flows; 0 if you do not care).
 *
 * Effects
 *  - `fx`: see ChibiFx.
 *
 * Working notes for choreographers
 *  - Every pose is drawn in all three views, so check each clip side on, front and back
 *    (`npx tsx scripts/chibi-sheet.ts` paints contact sheets of them). Side on he faces right and 32 degrees toward the
 *    viewer: things on his right (+r) are nearer, and a blade pointing ahead is a little
 *    foreshortened; front on, anything held straight ahead points at the viewer, so give swings
 *    a `roll` and keep resting blades out to his right (a third `handF` value of 8 to 10).
 *  - Proportions come from the design's `build`. For the Dark Knight's (darkKnight/design.ts):
 *    standing (`y: 1`) the base of his neck is about 50 px up and his shoulders sit 3.6 below it,
 *    8.6 to either side; arms reach about 18 from the shoulder and legs 24 from the hip. His
 *    greatsword's tip is 64 px from the grip. The part of a blade below the floor is hidden (it
 *    bites into the ground); the tip's height is about `hand height + reach·cos(weapon)·cos(roll)`:
 *    keep it near 0 for a blow that stops at the floor.
 *  - Pole arms (pole.ts): both hands on a haft must be within reach of their shoulders, so the
 *    haft crosses in front of the body: put the rear (right) hand by the hip, `yaw` the haft
 *    across toward his left (-15 to -30) and turn the left shoulder forward with a positive
 *    `twist` for a thrust (the left hand then leads). The rig slides a left hand that cannot reach
 *    its place toward one it can (`rig.grip2` says where it ended up). A haft pointing straight
 *    at the viewer shrinks to a stub front on: tip it up, down or across in the poses that must
 *    read toward the viewer. The head's reach (not the haft's) makes smears, rings and impacts.
 *  - An off-hand item hides behind the body side on when its hand is on his far (left) side,
 *    and behind the head when raised close beside it: hold it out (a third `handB` value of 14
 *    to 16 overhead) or forward where it must show. Spells leave from its tip (`fx.lightning`
 *    from `'off'`, `FxContext.tipB`).
 *  - Helpers: `pose(base, changes)` for a variation on a stance, `mix(a, b, t)` for in-betweens,
 *    `wave(i, n)` for a smooth loop. A hero's stances live in its own moves files (the Dark
 *    Knight's READY, GUARD_STANCE and AT_EASE in darkKnight/moves-core.ts).
 *  - A clip must have exactly as many poses as the hero's timing says (the hero factory throws
 *    otherwise); wind-up frames come first.
 */
export interface ChibiPose {
  x: number;
  y: number;
  lean: number;
  twist?: number;
  tilt?: number;
  turn?: number;
  head?: number;
  look?: number;
  face?: Face;
  footF: P2;
  footB: P2;
  kneel?: 'F' | 'B';
  handF: P2;
  handB?: P2;
  weapon: number;
  roll?: number;
  yaw?: number;
  grip?: number;
  grip2?: number;
  drop?: boolean;
  dropAt?: V3;
  weaponB?: number;
  rollB?: number;
  yawB?: number;
  dropB?: boolean;
  dropAtB?: V3;
  wind?: number;
  lift?: number;
  flare?: number;
  sway?: number;
  phase?: number;
  fx?: ChibiFx;
}

/** A smooth 0 → 1 → 0 cycle over a loop of n frames (frame i). */
export const wave = (i: number, n: number): number => (1 - Math.cos((2 * Math.PI * i) / n)) / 2;

/** A pose from a base with some fields changed (fx and the like replace the base's). */
export const pose = (base: ChibiPose, over: Partial<ChibiPose>): ChibiPose => ({ ...base, ...over });

/** Linear blend of two poses, for in-betweens (fx, face and the like come from the nearer one). */
export function mix(a: ChibiPose, b: ChibiPose, k: number): ChibiPose {
  const n = (x: number | undefined, y: number | undefined): number => (x ?? 0) + ((y ?? 0) - (x ?? 0)) * k;
  // A sideways offset blends only when both points give one.
  const p = (x: P2, y: P2): P2 => (x[2] !== undefined && y[2] !== undefined ? [n(x[0], y[0]), n(x[1], y[1]), n(x[2], y[2])] : [n(x[0], y[0]), n(x[1], y[1])]);
  const near = k < 0.5 ? a : b;
  // Fields a pose may leave to the design (an off-hand item's angles, the second grip) blend only when both give them.
  const o = (x: number | undefined, y: number | undefined, nearer: number | undefined): number | undefined => (x !== undefined && y !== undefined ? n(x, y) : nearer);
  const extra: Partial<ChibiPose> = {};
  for (const key of ['grip2', 'weaponB', 'rollB', 'yawB'] as const) {
    const v = o(a[key], b[key], near[key]);
    if (v !== undefined) extra[key] = v;
  }
  return {
    ...near,
    ...extra,
    x: n(a.x, b.x),
    y: n(a.y, b.y),
    lean: n(a.lean, b.lean),
    twist: n(a.twist, b.twist),
    tilt: n(a.tilt, b.tilt),
    turn: n(a.turn, b.turn),
    head: n(a.head, b.head),
    look: n(a.look, b.look),
    footF: p(a.footF, b.footF),
    footB: p(a.footB, b.footB),
    handF: p(a.handF, b.handF),
    handB: a.handB && b.handB ? p(a.handB, b.handB) : near.handB,
    weapon: n(a.weapon, b.weapon),
    roll: n(a.roll, b.roll),
    yaw: n(a.yaw, b.yaw),
    wind: n(a.wind, b.wind),
    lift: n(a.lift, b.lift),
    flare: n(a.flare, b.flare),
    sway: n(a.sway, b.sway),
    phase: n(a.phase, b.phase),
  };
}

// ── The skeleton ─────────────────────────────────────────────────────────────────────────────

/** Body proportions, in pixels (a design's `build`). */
export interface Build {
  /** Pelvis height standing (pose y 0), and the leg bones (ankle to sole is `ankle`). */
  hip: number;
  thigh: number;
  shin: number;
  ankle: number;
  /** Pelvis to the base of the neck, and the neck up to the pivot the head turns on. */
  torso: number;
  neck: number;
  /** Half the shoulder and hip widths. */
  shoulder: number;
  hipWidth: number;
  /** Below the neck base, where the shoulders sit. */
  shoulderDrop: number;
  upperArm: number;
  foreArm: number;
  /** From the head's pivot (top of the neck) up to the centre of the head. */
  headUp: number;
}

export interface Limb {
  root: V3;
  mid: V3;
  end: V3;
}

/** A weapon in hand: the grip point and its axes (u toward the tip, v toward the cutting edge, n the flat). */
export interface Grip {
  o: V3;
  u: V3;
  v: V3;
  n: V3;
}

/** A solved pose, in hero space. */
export interface Rig {
  pose: ChibiPose;
  build: Build;
  pelvis: Frame3;
  chest: Frame3;
  neck: V3;
  head: Frame3;
  armR: Limb;
  armL: Limb;
  legR: Limb;
  legL: Limb;
  /** Which way each foot points. */
  toeR: V3;
  toeL: V3;
  weapon: Grip;
  /** The left hand is on the weapon's second grip. */
  twoHanded: boolean;
  /** Where along the weapon that second grip is (the pose's `grip2` or the design's, slid along a haft to within reach). */
  grip2: number;
  /** The off-hand item, if the design has one: in the left hand (or where `dropAtB` puts it), at `weaponB`/`rollB`/`yawB`. */
  offhand: Grip;
}

/** Two-bone IK in 3D: the joint bends toward `bend`. */
export function ik(root: V3, target: V3, a: number, b: number, bend: V3): Limb {
  let d = sub3(target, root);
  let dist = len3(d);
  if (dist < 1e-3) {
    d = [0, -1, 0];
    dist = 1;
  }
  const dir = mul3(d, 1 / dist);
  const reach = Math.min(dist, a + b - 0.01);
  const end = add3(root, dir, reach);
  const x = (a * a - b * b + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  let n = sub3(bend, mul3(dir, dot3(bend, dir)));
  if (len3(n) < 1e-3) n = [1, 0, 0];
  return { root, mid: add3(add3(root, dir, x), norm3(n), h), end };
}

/** A weapon direction from the side-plane angle, the plane's roll and the yaw. */
export function weaponAxes(deg: number, roll = 0, yaw = 0): { u: V3; v: V3; n: V3 } {
  const th = rad(deg);
  const base: Frame3 = { o: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1] };
  // Roll the swing plane about the forward axis, then yaw it about the vertical.
  const fr = rotate(rotate(base, 0, roll), 0, 0, yaw);
  const u = dirIn(fr, Math.sin(th), Math.cos(th), 0);
  const v = dirIn(fr, Math.cos(th), -Math.sin(th), 0);
  return { u, v, n: cross3(u, v) };
}

const HERO: Frame3 = { o: [0, 0, 0], f: [1, 0, 0], u: [0, 1, 0], r: [0, 0, 1] };

/**
 * Solves a pose. `grip2` is where the second hand holds a two-handed weapon, along it from the
 * weapon's origin (negative: toward the pommel); the pose's own `grip2` overrides it. `haft` is
 * the stretch of a pole arm either hand may hold (the weapon design's `haft`): a left hand that
 * cannot reach its place there slides along it to the nearest place it can reach.
 */
export function solveRig(b: Build, pose: ChibiPose, grip2: number, haft?: readonly [number, number]): Rig {
  const pelvisO: V3 = [pose.x, b.hip - pose.y, 0];
  const pelvis: Frame3 = rotate({ ...HERO, o: pelvisO }, (pose.lean ?? 0) * 0.35, (pose.tilt ?? 0) * 0.3, (pose.twist ?? 0) * 0.25);
  const chest: Frame3 = rotate({ ...HERO, o: pelvisO }, pose.lean, pose.tilt ?? 0, pose.twist ?? 0);
  const neck = at3(chest, 0, b.torso, 0);
  // The head keeps itself more upright than the torso.
  const headBase = rotate({ ...HERO, o: neck }, pose.lean * 0.5 + (pose.head ?? 0), (pose.tilt ?? 0) * 0.5, (pose.twist ?? 0) * 0.6 + (pose.look ?? 0));
  const pivot = at3(chest, 0, b.torso + b.neck, 0);
  const head: Frame3 = { ...headBase, o: add3(pivot, headBase.u, b.headUp) };

  // Legs reach for the ankles.
  const foot = (p: P2, side: number): V3 => [p[0], -p[1] + b.ankle, side * (p[2] ?? b.hipWidth)];
  const hipR = at3(pelvis, 0, 0, b.hipWidth);
  const hipL = at3(pelvis, 0, 0, -b.hipWidth);
  const legR = ik(hipR, foot(pose.footF, 1), b.thigh, b.shin, [1, 0, 0.3]);
  const legL = ik(hipL, foot(pose.footB, -1), b.thigh, b.shin, [1, 0, -0.3]);
  const toe = (leg: Limb, side: number): V3 => {
    // A kneeling leg's foot is turned back onto its toes.
    if ((pose.kneel === 'F' && side === 1) || (pose.kneel === 'B' && side === -1)) return norm3([-0.92, -0.25, side * 0.12]);
    // Feet point ahead, splayed a little; a foot in the air hangs toward the shin's direction.
    const shin = norm3(sub3(leg.end, leg.mid));
    const flat = norm3([1, 0, side * 0.22]);
    const up = clamp((leg.end[1] - b.ankle) / 10, 0, 1);
    return norm3(add3(mul3(flat, 1 - up * 0.5), [shin[0] * 0.2, shin[1] * up * 0.6, 0]));
  };

  // Arms reach for the hands.
  const shoulderR = at3(chest, 0, b.torso - b.shoulderDrop, b.shoulder);
  const shoulderL = at3(chest, 0, b.torso - b.shoulderDrop, -b.shoulder);
  const handAt = (p: P2, side: number, sh: V3): V3 => {
    const h: V3 = [neck[0] + p[0], neck[1] - p[1], 0];
    if (p[2] !== undefined) return [h[0], h[1], side * p[2]];
    const rf = h[0] - sh[0];
    const ru = h[1] - sh[1];
    const inward = Math.max(clamp(rf / 18, 0, 1) * 0.8, clamp((ru - 2) / 14, 0, 1) * 0.5);
    return [h[0], h[1], side * (b.shoulder + 1) * (1 - inward)];
  };
  const elbow = (side: number): V3 => [-0.35, -1, side * 0.75];
  const ax = weaponAxes(pose.weapon, pose.roll ?? 0, pose.yaw ?? 0);
  const armR = ik(shoulderR, handAt(pose.handF, 1, shoulderR), b.upperArm, b.foreArm, elbow(1));
  // A dropped weapon lies where the pose puts it; a held one is in the right hand.
  const gripO: V3 = pose.drop ? (pose.dropAt ?? [pose.x + 14, 2, 4]) : add3(armR.end, ax.u, -(pose.grip ?? 0));
  const twoHanded = !pose.handB && !pose.drop;
  let at2 = pose.grip2 ?? grip2;
  if (twoHanded && haft) {
    // Along a haft the left hand slides toward the shoulder until it can reach.
    const reach = b.upperArm + b.foreArm - 0.3;
    const far = (u: number): boolean => len3(sub3(add3(gripO, ax.u, u), shoulderL)) > reach;
    if (far(at2)) {
      const nearest = clamp(dot3(sub3(shoulderL, gripO), ax.u), haft[0], haft[1]);
      let to = nearest;
      for (let i = 1; i <= 32; i++) {
        const u = lerp(at2, nearest, i / 32);
        if (!far(u)) {
          to = u;
          break;
        }
      }
      at2 = to;
    }
  }
  const targetL = twoHanded ? add3(gripO, ax.u, at2) : pose.handB ? handAt(pose.handB, -1, shoulderL) : add3(shoulderL, [-1, -(b.upperArm + b.foreArm - 2), -1.5]);
  const armL = ik(shoulderL, targetL, b.upperArm, b.foreArm, elbow(-1));
  // The off-hand item: its angles mirror the main weapon's (roll and yaw + carry it out to his left).
  const axB = weaponAxes(pose.weaponB ?? 160, -(pose.rollB ?? 0), -(pose.yawB ?? 0));
  const offO: V3 = pose.dropB ? (pose.dropAtB ?? [pose.x + 10, 1.5, -7]) : armL.end;
  return {
    pose,
    build: b,
    pelvis,
    chest,
    neck,
    head,
    armR,
    armL,
    legR,
    legL,
    toeR: toe(legR, 1),
    toeL: toe(legL, -1),
    weapon: { o: gripO, ...ax },
    twoHanded,
    grip2: at2,
    offhand: { o: offO, ...axB },
  };
}

// ── The camera ───────────────────────────────────────────────────────────────────────────────

export type ChibiView = 'side' | 'front' | 'back';

/** How far down the screen a pixel of depth toward the viewer shows. */
export const DEPTH = 0.32;
/** Side on, the figure faces right and this far toward the viewer. */
export const SIDE_YAW = 32;
const VIEW_YAW: Record<ChibiView, number> = { side: SIDE_YAW, front: 90, back: -90 };
/**
 * Side on, heads turn a little further toward the viewer than the body, as sprite heads do. The
 * cheat fades out as a pose's `turn` grows (gone by 45 degrees), so a spinning head keeps pace with
 * the body.
 */
export const SIDE_LOOK = 20;

/** The light: from the upper left, a little in front (world axes: X right, Y up, Z toward the viewer). */
export const LIGHT: V3 = norm3([-0.5, 0.62, 0.6]);
/** The direction toward the camera (world axes). */
export const TO_CAMERA: V3 = norm3([0, DEPTH, 1]);

export interface Camera {
  view: ChibiView;
  /** The figure's yaw in radians: 0 faces screen right, π/2 faces the viewer. */
  yaw: number;
  /** The ground anchor in the frame. */
  ax: number;
  ay: number;
  /** Hero space to world axes (X right, Y up, Z toward the viewer), and back. */
  world: (p: V3) => V3;
  local: (w: V3) => V3;
  /** Hero space to frame pixels. */
  proj: (p: V3) => Vec;
  /** A hero-space direction on screen (pixels per unit). */
  vec: (d: V3) => Vec;
  /** Depth toward the viewer. */
  depth: (p: V3) => number;
  /** How much a hero-space direction faces the camera (-1 to 1). */
  facing: (n: V3) => number;
  /** Lambert light for a hero-space normal (-1 to 1). */
  light: (n: V3) => number;
}

export function camera(view: ChibiView, turn: number, ax: number, ay: number): Camera {
  const yaw = rad(VIEW_YAW[view] + turn);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const world = (p: V3): V3 => [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
  const local = (w: V3): V3 => [w[0] * c + w[2] * s, w[1], -w[0] * s + w[2] * c];
  return {
    view,
    yaw,
    ax,
    ay,
    world,
    local,
    proj: (p) => [ax + p[0] * c - p[2] * s, ay - p[1] + (p[0] * s + p[2] * c) * DEPTH],
    vec: (d) => [d[0] * c - d[2] * s, -d[1] + (d[0] * s + d[2] * c) * DEPTH],
    depth: (p) => p[0] * s + p[2] * c,
    facing: (n) => dot3(world(n), TO_CAMERA),
    light: (n) => dot3(world(n), LIGHT),
  };
}
