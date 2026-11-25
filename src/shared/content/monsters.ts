/**
 * Monsters, bosses and dungeon themes. Monster damage is listed directly (power 100), and the
 * dungeon scales it up the deeper the party goes.
 */

export type MobKind = 'brute' | 'skirmisher' | 'archer' | 'caster' | 'elite' | 'sentry';
export type BossKind = 'juggernaut' | 'hexer' | 'beast' | 'warden' | 'sovereign';
/** The three monster clans. Every dungeon belongs to one of them. */
export type ThemeId = 'orc' | 'dragon' | 'undead';

/** What a telegraphed attack covers. */
export type Pattern =
  /** A cone from the caster toward its target, or away from it when `rear` is set. */
  | { kind: 'cleave'; radius: number; angle: number; rear?: boolean }
  /** A circle centred on the caster. */
  | { kind: 'pbaoe'; radius: number }
  /** A ring around the caster; the middle is safe. */
  | { kind: 'donut'; inner: number; radius: number }
  /** A circle where the caster's target stood when the cast began. */
  | { kind: 'targetCircle'; radius: number }
  /** A circle under every party member, placed when the cast begins. */
  | { kind: 'puddles'; radius: number }
  /** Lines from the caster toward `count` random party members. */
  | { kind: 'lines'; count: number; width: number; length: number }
  /** Two crossing lines through the caster. */
  | { kind: 'cross'; width: number; length: number }
  /** The caster charges in a line at a party member and ends up there. */
  | { kind: 'charge'; width: number }
  /** A heavy hit on the caster's target and anyone near them. */
  | { kind: 'tankbuster'; radius: number }
  /** Unavoidable damage to the whole party. */
  | { kind: 'raidwide' }
  /** Damage shared by everyone standing in the marked circle. Stack up! */
  | { kind: 'stack'; radius: number }
  /** A circle on every party member that also hits anyone else inside it. Spread out! */
  | { kind: 'spread'; radius: number }
  /** Pushes the whole party away from the caster and deals light damage. */
  | { kind: 'knockback'; distance: number }
  | { kind: 'adds'; mobs: MobKind[] }
  /** Heals the most injured ally. Interrupt it! */
  | { kind: 'healAlly' }
  /** A heavy single-target hit with no ground marker. */
  | { kind: 'bolt' }
  /** A dodgeable projectile fired at the target. */
  | { kind: 'shot'; speed: number; radius: number }
  | { kind: 'enrage' };

export interface AbilityDef {
  id: string;
  name: string;
  cast: number;
  pattern: Pattern;
  potency: number;
  /** Interruptible casts pulse on the cast bar. */
  interruptible?: boolean;
  /** Monsters only: seconds between uses, and the distance to the target at which it is used. */
  cooldown?: number;
  range?: number;
  /** A routine attack: AI companions only dodge it when hurt, and it adds no vulnerability. */
  minor?: boolean;
}

export interface MobDef {
  kind: MobKind;
  hp: number;
  radius: number;
  speed: number;
  ranged: boolean;
  attackRange: number;
  autoPotency: number;
  autoInterval: number;
  /** The routine attack, repeated every `autoInterval` seconds: a wind-up swing or a shot. */
  basic: AbilityDef;
  abilities: AbilityDef[];
  stunImmune?: boolean;
}

export interface BossStep {
  use: string[];
  /** Seconds after the step resolves before the next one starts. */
  gap: number;
}

export interface BossPhase {
  /** The phase begins once health falls to this fraction. The first phase uses 1. */
  below: number;
  intro?: BossStep[];
  steps: BossStep[];
}

export interface BossDef {
  kind: BossKind;
  title: string;
  hp: number;
  /** Crowd control needed to stagger the boss. */
  stagger: number;
  radius: number;
  speed: number;
  attackRange: number;
  autoPotency: number;
  autoInterval: number;
  abilities: Record<string, AbilityDef>;
  phases: BossPhase[];
}

export interface ThemeDef {
  id: ThemeId;
  title: string;
  palette: {
    floor: string;
    floorAlt: string;
    wall: string;
    wallTop: string;
    accent: string;
    light: string;
    fog: string;
  };
  mobNames: Record<MobKind, string>;
  bossNames: Record<BossKind, string>;
  roomNames: string[];
  arenaNames: string[];
}

const mob = (m: MobDef): MobDef => m;

const swing = (name: string, cast: number, potency: number, radius: number, degrees: number): AbilityDef => ({ id: `${name.toLowerCase().replace(/ /g, '')}`, name, cast, potency, minor: true, pattern: { kind: 'cleave', radius, angle: (degrees * Math.PI) / 180 } });
const shot = (name: string, cast: number, potency: number, speed: number, radius = 0.35): AbilityDef => ({ id: `${name.toLowerCase().replace(/ /g, '')}`, name, cast, potency, minor: true, pattern: { kind: 'shot', speed, radius } });

export const MOBS: Record<MobKind, MobDef> = {
  brute: mob({
    kind: 'brute', hp: 16200, radius: 0.7, speed: 4.4, ranged: false, attackRange: 1.4, autoPotency: 380, autoInterval: 2.2,
    basic: swing('Swing', 0.6, 380, 1.9, 110),
    abilities: [{ id: 'heavySwing', name: 'Heavy Swing', cast: 1.4, cooldown: 12, range: 4, potency: 1000, pattern: { kind: 'cleave', radius: 4.5, angle: (Math.PI * 2) / 3 } }],
  }),
  skirmisher: mob({ kind: 'skirmisher', hp: 9000, radius: 0.5, speed: 5.8, ranged: false, attackRange: 1.1, autoPotency: 230, autoInterval: 1.4, basic: swing('Claw', 0.4, 230, 1.5, 100), abilities: [] }),
  archer: mob({
    kind: 'archer', hp: 9900, radius: 0.55, speed: 4.4, ranged: true, attackRange: 16, autoPotency: 300, autoInterval: 2.4,
    basic: shot('Arrow', 0.35, 300, 16),
    abilities: [{ id: 'volley', name: 'Volley', cast: 1.8, cooldown: 13, range: 25, potency: 900, pattern: { kind: 'targetCircle', radius: 3 } }],
  }),
  caster: mob({
    kind: 'caster', hp: 11700, radius: 0.55, speed: 4.2, ranged: true, attackRange: 16, autoPotency: 280, autoInterval: 2.6,
    basic: shot('Hex Bolt', 0.45, 280, 12, 0.45),
    abilities: [
      { id: 'darkBolt', name: 'Dark Bolt', cast: 2.5, cooldown: 12, range: 25, potency: 1500, interruptible: true, pattern: { kind: 'bolt' } },
      { id: 'mendKin', name: 'Mend Kin', cast: 2.5, cooldown: 16, range: 30, potency: 2500, interruptible: true, pattern: { kind: 'healAlly' } },
    ],
  }),
  elite: mob({
    kind: 'elite', hp: 46800, radius: 1.1, speed: 4.2, ranged: false, attackRange: 1.8, autoPotency: 620, autoInterval: 2.6, stunImmune: true,
    basic: swing('Maul', 0.7, 620, 2.4, 120),
    abilities: [
      { id: 'groundSlam', name: 'Ground Slam', cast: 2.2, cooldown: 14, range: 6, potency: 1500, pattern: { kind: 'pbaoe', radius: 6 } },
      { id: 'crushingSweep', name: 'Crushing Sweep', cast: 1.8, cooldown: 11, range: 5, potency: 1300, pattern: { kind: 'cleave', radius: 6, angle: (Math.PI * 2) / 3 } },
    ],
  }),
  sentry: mob({
    kind: 'sentry', hp: 16200, radius: 0.8, speed: 0, ranged: true, attackRange: 30, autoPotency: 260, autoInterval: 2.2, stunImmune: true,
    basic: shot('Arc Shot', 0.3, 260, 14, 0.45),
    abilities: [{ id: 'pulse', name: 'Arc Pulse', cast: 2.5, cooldown: 8, range: 40, potency: 1000, pattern: { kind: 'targetCircle', radius: 3 } }],
  }),
};

const ab = (id: string, name: string, cast: number, potency: number, pattern: Pattern, extra: Partial<AbilityDef> = {}): AbilityDef => ({ id, name, cast, potency, pattern, ...extra });
const step = (gap: number, ...use: string[]): BossStep => ({ use, gap });
const byId = (...list: AbilityDef[]): Record<string, AbilityDef> => Object.fromEntries(list.map((a) => [a.id, a]));
const CONE_120 = (Math.PI * 2) / 3;

export const BOSSES: Record<BossKind, BossDef> = {
  juggernaut: {
    kind: 'juggernaut', title: 'the Juggernaut', hp: 390000, stagger: 480, radius: 2.4, speed: 4.5, attackRange: 1, autoPotency: 620, autoInterval: 3,
    abilities: byId(
      ab('rendingArc', 'Rending Arc', 3, 2800, { kind: 'cleave', radius: 12, angle: CONE_120 }),
      ab('skullsplitter', 'Skullsplitter', 4, 4600, { kind: 'tankbuster', radius: 2.5 }),
      ab('seismicStomp', 'Seismic Stomp', 3.5, 2800, { kind: 'pbaoe', radius: 7 }),
      ab('bullRush', 'Bull Rush', 3.5, 2600, { kind: 'charge', width: 5 }),
      ab('warCry', 'War Cry', 4, 1400, { kind: 'raidwide' }),
      ab('aftershock', 'Aftershock', 3, 2400, { kind: 'puddles', radius: 4 }),
    ),
    phases: [
      { below: 1, steps: [step(3, 'rendingArc'), step(3, 'skullsplitter'), step(3, 'seismicStomp'), step(3, 'bullRush'), step(4, 'warCry')] },
      {
        below: 0.5,
        intro: [step(3, 'warCry')],
        steps: [step(3, 'seismicStomp', 'aftershock'), step(1.5, 'bullRush'), step(3, 'bullRush'), step(3, 'skullsplitter'), step(3, 'rendingArc', 'aftershock'), step(4, 'warCry')],
      },
    ],
  },
  hexer: {
    kind: 'hexer', title: 'the Hexer', hp: 338000, stagger: 440, radius: 2, speed: 4.2, attackRange: 1, autoPotency: 560, autoInterval: 3,
    abilities: byId(
      ab('hexPools', 'Hex Pools', 3, 2500, { kind: 'puddles', radius: 4 }),
      ab('malediction', 'Malediction', 5, 2000, { kind: 'spread', radius: 4 }),
      ab('convergingCurse', 'Converging Curse', 5, 6800, { kind: 'stack', radius: 4 }),
      ab('witchfire', 'Witchfire', 4, 1500, { kind: 'raidwide' }),
      ab('summonThralls', 'Summon Thralls', 3, 0, { kind: 'adds', mobs: ['skirmisher', 'caster'] }),
      ab('eclipseRing', 'Eclipse Ring', 4, 3000, { kind: 'donut', inner: 9, radius: 32 }),
      ab('soulLance', 'Soul Lance', 4, 4400, { kind: 'tankbuster', radius: 2.5 }),
    ),
    phases: [
      { below: 1, steps: [step(3, 'hexPools'), step(3, 'soulLance'), step(3, 'malediction'), step(3, 'convergingCurse'), step(4, 'witchfire'), step(3, 'eclipseRing')] },
      {
        below: 0.55,
        intro: [step(3, 'summonThralls')],
        steps: [step(3, 'eclipseRing', 'malediction'), step(2, 'hexPools'), step(3, 'convergingCurse'), step(3, 'soulLance'), step(4, 'witchfire'), step(3, 'hexPools', 'convergingCurse')],
      },
    ],
  },
  beast: {
    kind: 'beast', title: 'the Beast', hp: 364000, stagger: 480, radius: 2.6, speed: 5, attackRange: 1, autoPotency: 640, autoInterval: 3,
    abilities: byId(
      ab('mawSweep', 'Maw Sweep', 2.5, 2800, { kind: 'cleave', radius: 11, angle: (Math.PI * 5) / 6 }),
      ab('tailLash', 'Tail Lash', 2.5, 2600, { kind: 'cleave', radius: 10, angle: CONE_120, rear: true }),
      ab('roar', 'Deafening Roar', 4, 900, { kind: 'knockback', distance: 12 }),
      ab('pounce', 'Pounce', 3, 2800, { kind: 'charge', width: 4 }),
      ab('coil', 'Coil', 4, 3000, { kind: 'donut', inner: 8, radius: 32 }),
      ab('gore', 'Gore', 4, 4800, { kind: 'tankbuster', radius: 2.5 }),
      ab('quills', 'Quill Storm', 3, 2300, { kind: 'puddles', radius: 3.5 }),
    ),
    phases: [
      { below: 1, steps: [step(2, 'mawSweep'), step(3, 'tailLash'), step(3, 'gore'), step(3, 'pounce'), step(3, 'coil'), step(4, 'roar')] },
      {
        below: 0.5,
        intro: [step(1, 'roar')],
        steps: [step(2, 'quills'), step(2.5, 'mawSweep', 'quills'), step(1, 'pounce'), step(3, 'pounce'), step(3, 'coil', 'tailLash'), step(3, 'gore'), step(3, 'roar')],
      },
    ],
  },
  warden: {
    kind: 'warden', title: 'the Warden', hp: 377000, stagger: 480, radius: 2.3, speed: 4.2, attackRange: 1, autoPotency: 600, autoInterval: 3,
    abilities: byId(
      ab('sentinelsCross', 'Sentinel’s Cross', 4, 3000, { kind: 'cross', width: 5, length: 40 }),
      ab('lanceBeams', 'Lance Beams', 3.5, 2600, { kind: 'lines', count: 3, width: 3, length: 34 }),
      ab('sharedJudgement', 'Shared Judgement', 5, 6600, { kind: 'stack', radius: 4 }),
      ab('callSentries', 'Call Sentries', 3, 0, { kind: 'adds', mobs: ['sentry', 'sentry'] }),
      ab('hammerOfOrder', 'Hammer of Order', 4, 4500, { kind: 'tankbuster', radius: 3 }),
      ab('decree', 'Decree', 4, 1500, { kind: 'raidwide' }),
      ab('sigilDrop', 'Sigil Drop', 3, 2400, { kind: 'puddles', radius: 4 }),
    ),
    phases: [
      { below: 1, steps: [step(3, 'sentinelsCross'), step(3, 'hammerOfOrder'), step(3, 'lanceBeams'), step(3, 'sharedJudgement'), step(4, 'decree')] },
      {
        below: 0.5,
        intro: [step(3, 'callSentries')],
        steps: [step(3, 'sentinelsCross', 'lanceBeams'), step(3, 'sharedJudgement'), step(3, 'hammerOfOrder'), step(3, 'sigilDrop', 'sentinelsCross'), step(4, 'decree')],
      },
    ],
  },
  sovereign: {
    kind: 'sovereign', title: 'the Sovereign', hp: 676000, stagger: 650, radius: 2.8, speed: 4.5, attackRange: 1, autoPotency: 700, autoInterval: 3,
    abilities: byId(
      ab('sovereignCleave', 'Sovereign’s Edge', 3, 3000, { kind: 'cleave', radius: 14, angle: CONE_120 }),
      ab('crownfall', 'Crownfall', 3, 2600, { kind: 'puddles', radius: 4.5 }),
      ab('judgment', 'Final Judgment', 4.5, 4800, { kind: 'tankbuster', radius: 3 }),
      ab('sunder', 'Sunder', 5, 1900, { kind: 'spread', radius: 4 }),
      ab('verdict', 'Verdict', 5, 6400, { kind: 'stack', radius: 4 }),
      ab('eclipse', 'Total Eclipse', 4, 3200, { kind: 'donut', inner: 9, radius: 34 }),
      ab('nova', 'Nova', 4, 3200, { kind: 'pbaoe', radius: 7 }),
      ab('dominion', 'Dominion', 4, 1500, { kind: 'raidwide' }),
      ab('crossfire', 'Crossfire', 4, 3200, { kind: 'cross', width: 6, length: 44 }),
      ab('exile', 'Exile', 4, 800, { kind: 'knockback', distance: 14 }),
      ab('heraldsCall', 'Herald’s Call', 3, 0, { kind: 'adds', mobs: ['brute', 'caster', 'archer'] }),
      ab('ascension', 'Ascension', 5, 2000, { kind: 'enrage' }),
      ab('royalCharge', 'Royal Charge', 3.5, 2800, { kind: 'charge', width: 5 }),
    ),
    phases: [
      { below: 1, steps: [step(3, 'sovereignCleave'), step(3, 'crownfall'), step(3, 'judgment'), step(3, 'sunder'), step(3, 'eclipse'), step(4, 'dominion')] },
      {
        below: 0.65,
        intro: [step(1, 'heraldsCall'), step(3, 'dominion')],
        steps: [step(3, 'crossfire', 'crownfall'), step(3, 'verdict'), step(0.5, 'exile'), step(3, 'eclipse'), step(3, 'judgment'), step(3, 'nova', 'sunder'), step(4, 'dominion')],
      },
      {
        below: 0.3,
        intro: [step(3, 'ascension')],
        steps: [step(3, 'eclipse', 'sunder'), step(1, 'royalCharge'), step(3, 'royalCharge'), step(3, 'verdict', 'crownfall'), step(3, 'judgment'), step(2, 'crossfire'), step(3, 'nova', 'crownfall'), step(4, 'dominion')],
      },
    ],
  },
};

export const THEMES: Record<ThemeId, ThemeDef> = {
  orc: {
    id: 'orc',
    title: 'The Bloodtusk Stronghold',
    palette: { floor: '#4a3626', floorAlt: '#54402c', wall: '#140c07', wallTop: '#6e4a2c', accent: '#e0562b', light: '#ffab5c', fog: '#090502' },
    mobNames: { brute: 'Orc Brute', skirmisher: 'Goblin Cutthroat', archer: 'Orc Archer', caster: 'Orc Shaman', elite: 'Orc Ravager', sentry: 'War Totem' },
    bossNames: { juggernaut: 'Grukk the Skullsplitter', hexer: 'Mother Zhura, Bone Seer', beast: 'Gnashtusk the War Boar', warden: 'Old Ironjaw the Ogre', sovereign: 'Warlord Krognar' },
    roomNames: ['Mud Pens', 'War Kennels', 'Trophy Hall', 'Grog Cellar', 'Fighting Pit', 'Spoils Cave', 'Drum Hall', 'Butcher’s Den'],
    arenaNames: ['The Blood Pit', 'Skull Ring', 'Boar Run', 'Ogre’s Gate', 'Throne of Tusks'],
  },
  dragon: {
    id: 'dragon',
    title: 'The Cinder Sanctum',
    palette: { floor: '#2b1d1d', floorAlt: '#332222', wall: '#0b0505', wallTop: '#5a2a22', accent: '#ff7a2a', light: '#ff9a50', fog: '#070202' },
    mobNames: { brute: 'Drakonid Warrior', skirmisher: 'Wyrmling', archer: 'Cult Crossbowman', caster: 'Flamecaller Cultist', elite: 'Fire Drake', sentry: 'Dragon Idol' },
    bossNames: { juggernaut: 'Scalebreaker Vorth', hexer: 'High Priestess Seraphine', beast: 'Ashwing the Wyvern', warden: 'The Obsidian Guardian', sovereign: 'Ignaroth the Elder Flame' },
    roomNames: ['Ember Halls', 'Cultist Dormitory', 'Hatchery', 'Ash Gallery', 'Scale Vault', 'Shrine of Cinders', 'Brimstone Steps', 'Offering Hall'],
    arenaNames: ['Altar of Scales', 'The Pyre', 'Wyvern Roost', 'Obsidian Court', 'Elder Flame’s Lair'],
  },
  undead: {
    id: 'undead',
    title: 'The Barrow of Sorrows',
    palette: { floor: '#252d2f', floorAlt: '#2b3437', wall: '#060909', wallTop: '#46575a', accent: '#6dffb0', light: '#9cffc8', fog: '#020504' },
    mobNames: { brute: 'Skeleton Warrior', skirmisher: 'Ghoul', archer: 'Skeleton Archer', caster: 'Necromancer', elite: 'Bone Abomination', sentry: 'Cursed Obelisk' },
    bossNames: { juggernaut: 'Sir Morgrave the Death Knight', hexer: 'Lich Vessanthe', beast: 'Grimmaw the Bone Hound', warden: 'The Wailing Warden', sovereign: 'Mortheus, the Dread King' },
    roomNames: ['Catacombs', 'Embalming Hall', 'Ossuary', 'Mourners’ Walk', 'Crypt of Names', 'Charnel Pits', 'Bone Chapel', 'Silent Nave'],
    arenaNames: ['Hall of the Fallen', 'The Lich’s Library', 'Kennel of Bones', 'The Wailing Vault', 'Throne of the Dread King'],
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const OPENING_BOSSES: BossKind[] = ['juggernaut', 'hexer', 'beast', 'warden'];
