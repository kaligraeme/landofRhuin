/**
 * The soundtrack: original tunes in a dark-folk fantasy style — modal melodies on a reedy lead
 * over drones, lutes and harps, chanting choirs and frame drums.
 *
 * Each dungeon theme has three stems: `base` (drones, pads, accompaniment), `melody`, and
 * `drive` (drums and a driving figure) that fades in when a fight starts and out when it ends.
 */
import { arpeggio, drums, type NoteEvent, ostinato, parse, stabs, sustain } from './notation.js';

export type Inst =
  | 'lute'
  | 'harp'
  | 'reed'
  | 'drone'
  | 'choir'
  | 'strings'
  | 'bass'
  | 'bell'
  | 'brass'
  | 'frameDrum'
  | 'taiko'
  | 'tom'
  | 'shaker'
  // The heavier kit: a drum kit, hammered metal, staccato and plucked strings, ensemble horns,
  // a saturated power synth, sub bass, a pad and a low cinematic boom.
  | 'kick'
  | 'snare'
  | 'hat'
  | 'openHat'
  | 'crash'
  | 'anvil'
  | 'spiccato'
  | 'pizz'
  | 'horns'
  | 'power'
  | 'sub'
  | 'pad'
  | 'boom'
  // Voices and soloists: a choir that can bark short syllables or sing a line, piano, timpani,
  // and bowed solo violin and cello.
  | 'chant'
  | 'piano'
  | 'timpani'
  | 'violin'
  | 'cello';
export type Stem = 'base' | 'melody' | 'drive';
export type TrackId = 'title' | 'explore-orc' | 'explore-dragon' | 'explore-undead' | 'boss' | 'victory' | 'lament';

export interface Part {
  inst: Inst;
  stem: Stem;
  /** Level of the part in the mix. */
  gain: number;
  events: NoteEvent[];
  /** Send to the hall reverb (defaults by stem). */
  reverb?: number;
}

export interface Track {
  id: TrackId;
  title: string;
  /** Beats per minute, where a beat is whatever unit the parts are written in. */
  bpm: number;
  beatsPerBar: number;
  bars: number;
  loop: boolean;
  parts: Part[];
  /** The harmony, a chord per bar, and the home key's natural-minor root (for checks). */
  chords?: string[];
  minorKey?: string;
}

const melody = (line: string, inst: Inst, gain: number, vel = 0.8): Part => ({ inst, stem: 'melody', gain, events: parse(line, vel).events });
const part = (inst: Inst, stem: Stem, gain: number, events: NoteEvent[], reverb?: number): Part => ({ inst, stem, gain, events, reverb });
const repeat = (bars: number, line: string): string => Array.from({ length: bars }, () => line).join(' ');
/** A list repeated: `times(4, ['Em', 'C'])` is eight bars. */
const times = <T>(n: number, xs: T[]): T[] => Array.from({ length: n }, () => xs).flat();
/** Per-bar drum patterns for a song laid out in sections: [[bars, patterns], ...]. */
const plan = (sections: [number, string[]][]): string[] => sections.flatMap(([bars, pats]) => Array.from({ length: bars }, (_, i) => pats[i % pats.length] as string));
/** An empty bar's pattern for a 16-step bar. */
const REST16 = '................';

/** The same notes moved by some semitones (a line an octave down for the cellos, say). */
const shift = (events: NoteEvent[], semis: number): NoteEvent[] => events.map((e) => ({ ...e, notes: e.notes.map((n) => n + semis) }));
/** Only the events between two beats. */
const between = (events: NoteEvent[], from: number, to: number): NoteEvent[] => events.filter((e) => e.beat >= from && e.beat < to);
/** A one-hit-per-bar pattern on the listed bars, rests elsewhere. */
const onBars = (n: number, bars: number[], hit: string, rest: string): string[] => Array.from({ length: n }, (_, bar) => (bars.includes(bar) ? hit : rest));
/** Power-chord versions of chord symbols (G5 for Gm, Eb5 for Eb). */
const power = (chords: string[]): string[] => chords.map((c) => c.replace(/(maj7|madd9|add9|m7|dim|sus|m|7)$/, '') + '5');

// ── Title and lobby: "Embers of Rhuin" — E harmonic minor, 3/4, 152 bpm ────────────────────
// A galloping piano under harp and pizzicato. A guitar states the tune; the violin takes it down
// a fifth to A minor and back, then soars with the strings and horns over timpani.

function title(): Track {
  const intro = ['Em', 'Em', 'C', 'B'];
  const a = ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'G', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B', 'B'];
  const a2 = ['Am', 'F', 'Dm', 'E', 'Am', 'F', 'G', 'C', 'F', 'Dm', 'E', 'Am', 'C', 'D', 'B', 'B'];
  const b = ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B', 'Em', 'C', 'G', 'D', 'C', 'Am', 'B', 'Em'];
  const out = ['C', 'D', 'B', 'B'];
  const chords = [...intro, ...a, ...a2, ...b, ...out];
  const n = chords.length; // 56 bars
  const at = { a: 4, a2: 20, b: 36, out: 52 };
  const guitar = [
    `r:${at.a * 3}`,
    'B4:2 E5:1 | G5:1.5 F#5:.5 E5:1 | C5:2 E5:1 | D#5:2 B4:1 | E5:1 F#5:1 G5:1 | A5:2 G5:1 | F#5:1.5 E5:.5 D5:1 | B4:3',
    'C5:1 E5:1 G5:1 | A5:1.5 G5:.5 E5:1 | F#5:2 D#5:1 | E5:3 | G5:1 E5:1 C5:1 | E5:1.5 D5:.5 C5:1 | B4:1 C5:1 D#5:1 | F#5:3',
    `r:${(n - at.a2) * 3}`,
  ].join(' ');
  const violin = [
    `r:${at.a2 * 3}`,
    'E5:2 A5:1 | C6:1.5 B5:.5 A5:1 | F5:2 A5:1 | G#5:2 E5:1 | A5:1 B5:1 C6:1 | D6:2 C6:1 | B5:1.5 A5:.5 G5:1 | E5:3',
    'F5:1 A5:1 C6:1 | D6:1.5 C6:.5 A5:1 | B5:2 G#5:1 | A5:3 | G5:1 E5:1 C5:1 | F#5:1.5 E5:.5 D5:1 | D#5:1 E5:1 F#5:1 | B5:3',
    'E5:2 B5:1 | C6:2 B5:1 | D6:2 B5:1 | A5:3 | G5:1 A5:1 B5:1 | E6:2 C6:1 | C6:1.5 B5:.5 A5:1 | B5:3',
    'E6:2 D6:1 | C6:2 G5:1 | B5:1 D6:1 G6:1 | F#6:2 D6:1 | E6:1.5 D6:.5 C6:1 | C6:2 A5:1 | B5:1 C6:1 D#6:1 | E6:3',
    `r:${(n - at.out) * 3}`,
  ].join(' ');
  const tune = parse(violin, 0.8).events;
  return {
    id: 'title',
    title: 'Embers of Rhuin',
    chords,
    minorKey: 'E',
    bpm: 152,
    beatsPerBar: 3,
    bars: n,
    loop: true,
    parts: [
      // The gallop: rolling eighths in the left hand, short-short-long chords in the right.
      part('piano', 'base', 0.55, arpeggio(chords, 2, [0, 2, 4, 2, 3, 2], 0.5, 3, 0.62)),
      part('piano', 'base', 0.45, stabs(chords, 4, 'x.xx.x', 0.5, 3, 0.55, 0, [0, 1, 2])),
      part('harp', 'base', 0.42, arpeggio(chords, 4, [0, 1, 2, 3, 4, 5], 0.5, 3, 0.5)),
      part('pizz', 'base', 0.45, ostinato(chords, 3, [0, null, 7, null, 12, null], 0.5, 3, 0.6)),
      part('timpani', 'base', 0.5, ostinato(chords, 2, [0, null, null, null, 0, null], 0.5, 3, 0.7)),
      part('frameDrum', 'base', 0.45, drums(['X...x.', 'X...x.', 'X...x.', 'X.x.xx'], n, 0.5, 3, 0.75), 0.15),
      part('shaker', 'base', 0.3, drums(plan([[at.a2, ['......']], [n - at.a2, ['xoxoxo']]]), n, 0.5, 3, 0.6), 0.05),
      part('strings', 'base', 0.4, sustain(chords, 3, 3, 0.55)),
      part('bass', 'base', 0.4, ostinato(chords, 2, [0, null, null, 0, 7, null], 0.5, 3, 0.65)),
      // The climax: snare rolls into it, strings and horns lift, a crash on every phrase.
      part('snare', 'base', 0.4, drums(onBars(n, [at.a - 1, at.a2 - 1, at.b - 1, at.b + 7, at.out - 1], 'x.xxXX', '......'), n, 0.5, 3, 0.7), 0.2),
      part('crash', 'base', 0.45, drums(onBars(n, [at.a, at.a2, at.b, at.b + 8], 'X.....', '......'), n, 0.5, 3), 0.25),
      part('horns', 'base', 0.4, between(sustain(chords, 3, 3, 0.55, 0, [0, 1, 2]), at.b * 3, at.out * 3)),
      part('kick', 'base', 0.45, drums(plan([[at.b, ['......']], [16, ['X...x.']], [4, ['X.....']]]), n, 0.5, 3, 0.7), 0.05),
      melody(guitar, 'lute', 0.62, 0.85),
      melody(violin, 'violin', 0.72, 0.8),
      // The horns sing the climax an octave under the violin.
      part('horns', 'melody', 0.32, shift(between(tune, at.b * 3, at.out * 3), -12)),
    ],
  };
}

// ── Orcs: "The Bloodtusk Stronghold" — D minor with a Phrygian edge, 4/4, 152 bpm ──────────
// A heavier, rock-driven battle anthem: fuzz riffs and double-kick under low horns, anvils on
// the backbeat, shouted chants and a half-time stomp.

function orc(): Track {
  const intro = ['Dm', 'Dm', 'Dm', 'Eb'];
  const riff = ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Eb', 'C'];
  const verse = ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A'];
  const stomp = ['Dm', 'Dm', 'Eb', 'Eb', 'Dm', 'Dm', 'Eb', 'C'];
  const chorus = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'];
  const out = ['Dm', 'Eb', 'Dm', 'A'];
  const chords = [...intro, ...riff, ...verse, ...verse, ...stomp, ...chorus, ...out];
  const n = chords.length; // 48 bars
  const at = { riff: 4, verse: 12, stomp: 28, chorus: 36, out: 44 };
  const tune = [
    `r:${at.verse * 4}`,
    'D4:1.5 E4:.5 F4:1 A4:1 | Bb4:2 A4:1 F4:1 | G4:1.5 F4:.5 E4:1 C4:1 | D4:3 r:1',
    'A4:1.5 G4:.5 F4:1 D4:1 | F4:1 G4:1 Bb4:2 | C5:1.5 Bb4:.5 A4:1 G4:1 | A4:2 E4:1 C#4:1',
    'D4:1.5 E4:.5 F4:1 A4:1 | D5:2 C5:1 Bb4:1 | C5:1.5 Bb4:.5 G4:1 E4:1 | F4:2 D4:2',
    'A4:1 D5:1 F5:1 D5:1 | Bb4:1 D5:1 F5:2 | E5:1.5 D5:.5 C5:1 G4:1 | A4:3 r:1',
    `r:${8 * 4}`,
    'F5:2 D5:1 F5:1 | G5:2 E5:1 C5:1 | A5:3 F5:1 | D5:4 | F5:2 D5:1 Bb4:1 | E5:2 G5:1 E5:1 | C#5:2 E5:1 A5:1 | !A5:3 r:1',
    `r:${4 * 4}`,
  ].join(' ');
  // The riff: palm-muted gallops on the root, the flat second snarling in on the last beat.
  const riffNotes = ostinato(chords, 2, [0, 0, 12, null, 0, 0, 12, null, 0, 0, 12, null, 0, 1, 3, 1], 0.25, 4, 0.8, 0, [0, 4, 8]);
  const sect = (introP: string[], riffP: string, verseP: string, stompP: string, chorusP: string, outP: string[]): string[] =>
    plan([[4, introP], [8, [riffP]], [16, [verseP]], [8, [stompP]], [8, [chorusP]], [4, outP]]);
  const kick = sect(['X...............', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.XXXXXXXX'], 'X.X...X.X.X...X.', 'X.....X.X.X...X.', 'X.......X.......', 'X.X.X.X.X.X.X.X.', ['X.X...X.X.X...X.', 'X.X...X.X.X...X.', 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX']);
  const snare = sect([REST16, REST16, '........X.......', 'X.X.X.X.XXXXXXXX'], '....X.......X...', '....X.......X...', '........X.......', '....X.......X...', ['....X.......X...', '....X.......X...', '....X.......X.x.', 'XxXxXxXxXXXXXXXX']);
  const hats = sect([REST16], 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.', REST16, 'x.x.x.x.x.x.x.x.', ['x.x.x.x.x.x.x.x.']);
  const anvil = sect([REST16, REST16, REST16, '............X...'], '....x.......x...', '....x.......x...', 'X.......X.......', '....X.......X...', ['....x.......x...']);
  const shouts = sect(['X...............', REST16, 'X...............', 'X.X.X...........'], REST16, REST16, 'X.......X.X.....', 'X...............', [REST16, REST16, REST16, 'X.X.X...........']);
  return {
    id: 'explore-orc',
    title: 'The Bloodtusk Stronghold',
    chords,
    minorKey: 'D',
    bpm: 152,
    beatsPerBar: 4,
    bars: n,
    loop: true,
    parts: [
      part('kick', 'base', 0.72, drums(kick, n, 0.25, 4), 0.05),
      part('snare', 'base', 0.62, drums(snare, n, 0.25, 4), 0.14),
      part('hat', 'base', 0.45, drums(hats, n, 0.25, 4), 0.05),
      part('anvil', 'base', 0.32, drums(anvil, n, 0.25, 4, 0.7), 0.25),
      part('crash', 'base', 0.5, drums(onBars(n, [at.riff, at.verse, at.verse + 8, at.stomp, at.stomp + 2, at.stomp + 4, at.stomp + 6, at.chorus, at.chorus + 4, at.out], 'X...............', REST16), n, 0.25, 4), 0.2),
      part('taiko', 'base', 0.7, drums(plan([[4, ['X.......X.......', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.XXXX']], [24, [REST16]], [8, ['X.......X..X....']], [12, [REST16]]]), n, 0.25, 4), 0.2),
      part('boom', 'base', 0.6, drums(onBars(n, [at.riff, at.stomp, at.chorus], 'X...............', REST16), n, 0.25, 4), 0.3),
      part('power', 'base', 0.7, between(riffNotes, at.riff * 4, at.stomp * 4), 0.08),
      part('power', 'base', 0.7, stabs(power(stomp), 2, 'X-------X--x....', 0.25, 4, 0.85, at.stomp * 4, [0, 1, 2]), 0.08),
      part('power', 'base', 0.7, stabs(power([...chorus, ...out]), 2, 'X--x..x.X--x..x.', 0.25, 4, 0.8, at.chorus * 4, [0, 1, 2]), 0.08),
      part('power', 'base', 0.6, between(riffNotes, 0, at.riff * 4).filter((e) => e.beat >= 2 * 4), 0.08),
      part('sub', 'base', 0.5, ostinato(chords, 1, [0, null, 0, 0, 0, null, 0, 0], 0.5, 4, 0.8), 0.02),
      part('spiccato', 'base', 0.4, between(ostinato(chords, 3, [0, 0, 7, 0, 12, 0, 7, 0], 0.25, 4, 0.7, 0, [0, 4]), at.verse * 4, at.out * 4), 0.2),
      part('chant', 'base', 0.55, drums(shouts, n, 0.25, 4).map((e) => ({ ...e, notes: [50, 57], dur: 0.35 })), 0.3),
      part('pad', 'base', 0.45, sustain(chords, 3, 4, 0.55)),
      melody(tune, 'horns', 0.65, 0.85),
      part('chant', 'melody', 0.45, shift(between(parse(tune, 0.65).events, at.chorus * 4, at.out * 4), -12)),
      // In a fight: double-kick, war drums, more shouts and horn stabs.
      part('kick', 'drive', 0.4, drums(plan([[at.verse, [REST16]], [16, ['xxxxxxxx........', 'xxxxxxxxxxxxxxxx']], [8, [REST16]], [12, ['xxxxxxxxxxxxxxxx']]]), n, 0.25, 4, 0.65), 0.03),
      part('taiko', 'drive', 0.6, drums(['X..x..X.X..x..X.'], n, 0.25, 4), 0.15),
      part('chant', 'drive', 0.45, drums(['X...............', REST16], n, 0.25, 4).map((e) => ({ ...e, notes: [50, 57], dur: 0.35 })), 0.3),
      part('horns', 'drive', 0.42, stabs(chords, 3, 'X..X..X.........', 0.25, 4, 0.8, 0, [0, 1, 2])),
    ],
  };
}

// ── Dragons: "The Cinder Sanctum" — G minor, 4/4, 168 bpm ───────────────────────────────────
// Full-throttle battle-anthem energy in the spirit of modern Final Fantasy: a choppy chanted
// hook, a rock kit under galloping staccato strings and power chords, a march into the chorus,
// horns carrying the tune and the choir lifting it into a bright major-key turn.

function dragon(): Track {
  const intro = ['Gm', 'Gm', 'Eb', 'F'];
  const verse = ['Gm', 'Eb', 'Bb', 'F', 'Cm', 'Dm', 'Eb', 'F'];
  const pre = ['Eb', 'F', 'Gm', 'Bb', 'Eb', 'F', 'Dm', 'F'];
  const chorus = ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F'];
  const chorus2 = ['Bb', 'F', 'Gm', 'Eb', 'Cm', 'Dm', 'Eb', 'F'];
  const turn = ['Cm', 'Dm', 'Eb', 'F'];
  const chords = [...intro, ...verse, ...verse, ...pre, ...chorus, ...chorus2, ...turn];
  const n = chords.length; // 48 bars
  const at = { verse: 4, pre: 20, chorus: 28, turn: 44 };
  const tune = [
    `r:${at.verse * 4}`,
    'G4:1.5 A4:.5 Bb4:1 D5:1 | C5:1.5 Bb4:.5 G4:2 | F4:1 G4:.5 A4:.5 Bb4:1 D5:1 | C5:3 A4:1',
    'Eb5:1.5 D5:.5 C5:1 G4:1 | F5:1.5 D5:.5 A4:1 D5:1 | G5:1 F5:.5 Eb5:.5 Bb4:1 Eb5:1 | F5:2 C5:1 A4:1',
    'D5:1.5 C5:.5 Bb4:1 A4:.5 G4:.5 | Bb4:1.5 C5:.5 Eb5:2 | D5:1 C5:.5 Bb4:.5 F5:1 D5:1 | C5:3 F4:1',
    'G4:1 C5:1 Eb5:1 G5:1 | F5:1.5 G5:.5 F5:1 D5:1 | Eb5:1 G5:1 F5:.5 Eb5:.5 D5:1 | C5:3 r:1',
    `r:${8 * 4}`,
    'Bb4:1 F5:2 D5:1 | C5:1.5 A4:.5 F5:2 | G5:1.5 F5:.5 D5:1 Bb4:1 | C5:1.5 Bb4:.5 G4:2',
    'Bb4:1 F5:2 D5:1 | C5:1.5 F5:.5 A5:2 | G5:1.5 F5:.5 Eb5:1 Bb4:1 | C5:2 F5:1 A5:1',
    'Bb5:2 F5:1 D5:1 | C6:1.5 A5:.5 F5:2 | G5:1 Bb5:1 D6:1.5 C6:.5 | Bb5:2 G5:2',
    'G5:1.5 Eb5:.5 C5:1 Eb5:1 | F5:1 D5:1 A5:2 | G5:1 Bb5:1 G5:1 Eb5:1 | !F5:2 r:2',
    `r:${4 * 4}`,
  ].join(' ');
  // The choir climbs through the march into the chorus.
  const climb = `r:${at.pre * 4} Eb5:4 | F5:4 | G5:4 | F5:4 | Eb5:4 | F5:4 | F5:4 | A5:4 r:${(n - at.pre - 8) * 4}`;
  const sect = (introP: string[], verseP: string[], preP: string[], chorusP: string[], turnP: string[]): string[] =>
    plan([[4, introP], [16, verseP], [8, preP], [16, chorusP], [4, turnP]]);
  const kick = sect(['X.......X.......', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.XXXXXXXX'], ['X.....x.X.....x.', 'X.....x.X...x.x.'], ['X...X...X...X...'], ['X.x...x.X.x...x.', 'X.x...x.X.x.x.x.'], ['X.....x.X.....x.', 'X.....x.X.....x.', 'X.x.X.x.X.x.X.x.', 'X...X...X.X.XXXX']);
  const snare = sect([REST16, REST16, '........X.......', 'x.x.x.x.XxXxXXXX'], ['....X.......X...', '....X.......X.o.'], ['X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'X.xxX.x.X.xxX.x.', 'XxXxXxXxXXXXXXXX'], ['....X.......X...', '....X.......X.xx'], ['....X.......X...', '....X.......X...', '....X.......X.x.', '..X...X.XXXXXXXX']);
  const hats = sect([REST16, 'x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.']);
  // The hook: short, clipped chanted chords.
  const hookBars = [0, 1, 2, 3, at.chorus, at.chorus + 4, at.chorus + 8, at.chorus + 12];
  const hook = chords.flatMap((c, bar) => (hookBars.includes(bar) ? stabs([c], 4, bar % 2 ? 'X.X...X.X...X.X.' : 'X.X...X.X.X.....', 0.25, 4, 0.85, bar * 4, [0, 1, 2]) : []));
  const galop = [0, null, 0, 7, 12, null, 7, 0, 0, null, 0, 7, 12, 7, 12, 7];
  return {
    id: 'explore-dragon',
    title: 'The Cinder Sanctum',
    chords,
    minorKey: 'G',
    bpm: 168,
    beatsPerBar: 4,
    bars: n,
    loop: true,
    parts: [
      // Always on: the band, the strings and the hook.
      part('kick', 'base', 0.7, drums(kick, n, 0.25, 4), 0.06),
      part('snare', 'base', 0.6, drums(snare, n, 0.25, 4), 0.14),
      part('hat', 'base', 0.5, drums(hats, n, 0.25, 4), 0.05),
      part('openHat', 'base', 0.4, drums(plan([[at.chorus, [REST16]], [16, ['..x...x...x...x.']], [4, [REST16]]]), n, 0.25, 4), 0.08),
      part('crash', 'base', 0.55, drums(onBars(n, [at.verse, at.verse + 8, at.pre, at.chorus, at.chorus + 8, at.turn], 'X...............', REST16), n, 0.25, 4), 0.2),
      part('boom', 'base', 0.6, drums(onBars(n, [at.verse, at.chorus], 'X...............', REST16), n, 0.25, 4), 0.3),
      part('timpani', 'base', 0.5, between(ostinato(chords, 2, [0, null, null, null, 0, null, 0, null], 0.5, 4, 0.75), at.pre * 4, at.turn * 4), 0.2),
      part('spiccato', 'base', 0.55, ostinato(chords, 3, galop, 0.25, 4, 0.75, 0, [0, 8]), 0.25),
      part('sub', 'base', 0.45, ostinato(chords, 1, [0, null, 0, 0, 0, null, 0, 0], 0.5, 4, 0.8), 0.02),
      part('power', 'base', 0.55, stabs(power(chords.slice(at.verse, at.turn)), 2, 'X--x..x.X--x..x.', 0.25, 4, 0.75, at.verse * 4), 0.1),
      part('pad', 'base', 0.45, sustain(chords, 3, 4, 0.6)),
      part('chant', 'base', 0.6, hook, 0.3),
      part('choir', 'base', 0.55, parse(climb, 0.7).events),
      melody(tune, 'horns', 0.62, 0.85),
      part('chant', 'melody', 0.4, shift(between(parse(tune, 0.6).events, at.chorus * 4, at.turn * 4), -12), 0.3),
      // In a fight: double-time hats, taiko, more crashes and horn stabs.
      part('hat', 'drive', 0.42, drums(['xoxoxoxoxoxoxoxo'], n, 0.25, 4), 0.05),
      part('taiko', 'drive', 0.6, drums(['X.......X..x....', 'X.......X..x..x.'], n, 0.25, 4), 0.15),
      part('crash', 'drive', 0.38, drums(['X...............', REST16], n, 0.25, 4), 0.2),
      part('horns', 'drive', 0.42, stabs(chords, 3, 'X.....x.....x...', 0.25, 4, 0.75, 0, [0, 1, 2, 3])),
    ],
  };
}

// ── Undead: "The Barrow of Sorrows" — C minor, 6/8 (a beat is an eighth), 300 bpm ──────────
// One big, singable modal theme in a rolling 6/8, in the manner of a dark fantasy RPG's main
// theme: first on a cello over an oud's ostinato and war drums, then on low horns with the
// choir, a duduk-like reed over the bridge.

function undead(): Track {
  const intro = ['Cm', 'Cm', 'Ab', 'Bb'];
  const theme = ['Cm', 'Ab', 'Fm', 'Gm', 'Cm', 'Ab', 'Bb', 'Bb', 'Ab', 'Bb', 'Cm', 'Gm', 'Ab', 'Fm', 'Gm', 'Cm'];
  const bridge = ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'Gm', 'Gm'];
  const out = ['Fm', 'Gm', 'Bb', 'Gm'];
  const chords = [...intro, ...theme, ...theme, ...bridge, ...out];
  const n = chords.length; // 48 bars
  const at = { a: 4, a2: 20, bridge: 36, out: 44 };
  const melodyLine = [
    'G4:3 C5:2 D5:1 | Eb5:3 D5:2 C5:1 | Ab4:2 C5:1 F5:3 | D5:5 r:1 | G4:3 C5:2 D5:1 | Eb5:2 F5:1 Eb5:2 C5:1 | D5:3 F5:2 D5:1 | Bb4:5 r:1',
    'C5:3 Eb5:2 Ab5:1 | G5:3 F5:2 D5:1 | Eb5:2 D5:1 C5:3 | Bb4:3 D5:3 | C5:2 Eb5:1 Ab5:2 G5:1 | F5:3 Eb5:2 C5:1 | D5:2 Eb5:1 D5:2 Bb4:1 | C5:5 r:1',
  ].join(' ');
  const statement = parse(melodyLine, 0.8).events;
  const tune = parse(`r:${at.a * 6} ${melodyLine} r:${(n - at.a - 16) * 6}`, 0.8).events;
  const reed = `r:${at.bridge * 6} C5:6 | D5:6 | Eb5:6 | G5:6 | Ab5:6 | F5:3 D5:3 | D5:6 | Bb4:6 r:${(n - at.bridge - 8) * 6}`;
  const sect = (introP: string[], aP: string[], a2P: string[], bridgeP: string[], outP: string[]): string[] => plan([[4, introP], [16, aP], [16, a2P], [8, bridgeP], [4, outP]]);
  const fill = 'x.xXXX';
  return {
    id: 'explore-undead',
    title: 'The Barrow of Sorrows',
    chords,
    minorKey: 'C',
    bpm: 300,
    beatsPerBar: 6,
    bars: n,
    loop: true,
    parts: [
      // The gallop: an oud's broken chords on every eighth, war drums on every dotted quarter.
      part('lute', 'base', 0.5, arpeggio(chords, 3, [0, 1, 2, 3, 2, 1], 1, 6, 0.65)),
      part('taiko', 'base', 0.65, drums(sect(['X.....', 'X.....', 'X..x..', 'X..xXX'], ['X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X.xXXX'], ['X..X..', 'X..X..', 'X..X..', fill], ['X..x..', 'X.....'], ['X..x..', 'X..x..', 'X..X..', 'XXXXXX']), n, 1, 6), 0.2),
      part('kick', 'base', 0.55, drums(sect(['......'], ['X.....'], ['X..X..'], ['X.....'], ['X..X..']), n, 1, 6), 0.05),
      part('snare', 'base', 0.5, drums(sect(['......', '......', '......', 'xxxXXX'], ['...X..', '...X..', '...X..', '...X..', '...X..', '...X..', '...X..', '..xXXX'], ['...X..', '...X.x'], ['......', '...X..'], ['...X..', '...X..', '...X..', 'XXXXXX']), n, 1, 6), 0.15),
      part('frameDrum', 'base', 0.4, drums(['x.xx.x'], n, 1, 6, 0.6), 0.1),
      part('shaker', 'base', 0.3, drums(['.x..x.'], n, 1, 6, 0.6), 0.05),
      part('crash', 'base', 0.45, drums(onBars(n, [at.a, at.a2, at.a2 + 8, at.bridge, at.out], 'X.....', '......'), n, 1, 6), 0.25),
      part('boom', 'base', 0.55, drums(onBars(n, [at.a, at.a2, at.bridge], 'X.....', '......'), n, 1, 6), 0.3),
      part('bell', 'base', 0.3, drums(onBars(n, Array.from({ length: n / 4 }, (_, i) => i * 4), 'X.....', '......'), n, 1, 6, 0.5).map((e) => ({ ...e, notes: [72], dur: 6 })), 0.5),
      part('sub', 'base', 0.45, ostinato(chords, 1, [0, null, null, 0, null, null], 1, 6, 0.8), 0.02),
      part('spiccato', 'base', 0.45, between(ostinato(chords, 3, [0, 0, 7, 0, 0, 12], 1, 6, 0.7, 0, [0, 3]), at.a2 * 6, at.out * 6), 0.25),
      part('pad', 'base', 0.45, sustain(chords, 3, 6, 0.55)),
      part('choir', 'base', 0.5, between(sustain(chords, 4, 6, 0.6), at.bridge * 6, at.out * 6)),
      // The theme: a cello first, then low horns with the choir.
      part('cello', 'melody', 0.7, shift(between(tune, at.a * 6, at.a2 * 6), -12)),
      part('horns', 'melody', 0.6, shift(statement.map((e) => ({ ...e, beat: e.beat + at.a2 * 6 })), -12)),
      part('chant', 'melody', 0.45, statement.map((e) => ({ ...e, beat: e.beat + at.a2 * 6 }))),
      melody(reed, 'reed', 0.6, 0.8),
      // In a fight: the drums double up, horns bark on the dotted quarters, the choir shouts.
      part('taiko', 'drive', 0.55, drums(['X.xX.x'], n, 1, 6), 0.15),
      part('tom', 'drive', 0.45, drums(['......', '......', '......', 'xxXxXX'], n, 1, 6), 0.1),
      part('horns', 'drive', 0.42, stabs(chords, 3, 'X..X..', 1, 6, 0.75, 0, [0, 1, 2])),
      part('chant', 'drive', 0.4, stabs(chords, 4, 'X.....', 1, 6, 0.8, 0, [0, 1, 2]), 0.3),
    ],
  };
}

// ── Bosses: "The Last Sovereign" — D minor, 6/8 (a beat is an eighth), 312 bpm ─────────────

function boss(): Track {
  const chords = ['Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'C', 'Dm', 'A', 'Gm', 'A', 'Dm', 'Dm'];
  const tune = [
    '!D5:3 C5:2 A4:1 | Bb4:3 A4:2 G4:1 | A4:2 G4:1 F4:2 E4:1 | D4:6',
    'F4:2 G4:1 A4:2 Bb4:1 | C5:3 Bb4:2 A4:1 | G4:2 A4:1 Bb4:2 C#5:1 | !D5:6',
    '!F5:3 E5:2 D5:1 | E5:3 D5:2 C5:1 | D5:2 C5:1 A4:2 F4:1 | E4:3 C#5:3',
    'D5:2 Bb4:1 G4:2 Bb4:1 | C#5:2 A4:1 E4:2 A4:1 | D5:2 F5:1 A5:2 F5:1 | !D5:6',
  ].join(' ');
  const n = chords.length;
  return {
    id: 'boss',
    title: 'The Last Sovereign',
    chords,
    minorKey: 'D',
    bpm: 312,
    beatsPerBar: 6,
    bars: n,
    loop: true,
    parts: [
      part('kick', 'base', 0.65, drums(['X..X..', 'X..X..', 'X..X..', 'X.XX.X'], n, 1, 6), 0.05),
      part('snare', 'base', 0.55, drums(['...X..', '...X..', '...X..', '..xXXX'], n, 1, 6), 0.14),
      part('hat', 'base', 0.4, drums(['xxxxxx'], n, 1, 6, 0.7), 0.05),
      part('crash', 'base', 0.45, drums(['X.....', '......', '......', '......'], n, 1, 6), 0.2),
      part('spiccato', 'base', 0.55, ostinato(chords, 3, [0, 0, 7, 0, 12, 7], 1, 6, 0.75, 0, [0, 3]), 0.25),
      part('power', 'base', 0.55, stabs(power(chords), 2, 'X--X--', 1, 6, 0.75), 0.08),
      part('sub', 'base', 0.45, ostinato(chords, 1, [0, null, null, 0, null, null], 1, 6, 0.8), 0.02),
      part('choir', 'base', 0.5, sustain(chords, 3, 6, 0.6, 0, [0, 1, 2, 3])),
      part('chant', 'base', 0.45, stabs(chords, 4, 'X.X...', 1, 6, 0.8, 0, [0, 1, 2]), 0.3),
      melody(tune, 'horns', 0.65, 0.85),
      melody(tune, 'violin', 0.4, 0.75),
      part('taiko', 'drive', 0.85, drums(['X..x..', 'X..x..', 'X..x..', 'X.xX.x'], n, 1, 6), 0.15),
      part('tom', 'drive', 0.45, drums(['......', '......', '......', '..x.xX'], n, 1, 6), 0.1),
    ],
  };
}

// ── Stingers ───────────────────────────────────────────────────────────────────────────────

function victory(): Track {
  const chords = ['D', 'G', 'A', 'D', 'D', 'D'];
  return {
    id: 'victory',
    title: 'Victory',
    bpm: 104,
    beatsPerBar: 4,
    bars: 6,
    loop: false,
    parts: [
      part('harp', 'base', 0.62, parse('D4:.25 F#4:.25 A4:.25 D5:.25 F#5:.25 A5:.25 D6:2.5', 0.7).events),
      part('strings', 'base', 0.55, sustain(chords, 3, 4, 0.6)),
      part('frameDrum', 'base', 0.7, drums(['X.......x.......', '................', '................', 'x.x.x.x.xxxxXXXX', 'X...............', '................'], 6, 0.25, 4)),
      part('timpani', 'base', 0.55, parse('D2:1 r:3 | r:4 | A1:1 r:3 | A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:.25 A1:1 | D2:4 | r:4', 0.75).events, 0.2),
      part('crash', 'base', 0.5, drums(['X...............', '................', '................', '................', 'X...............', '................'], 6, 0.25, 4), 0.3),
      melody('A4:.5 D5:.5 F#5:1 A5:2 | G5:1 F#5:.5 E5:.5 D5:2 | B4:1 C#5:1 D5:1 E5:1 | F#5:3 r:1 | !D5+F#5+A5:4 | r:4', 'horns', 0.7),
      melody('r:12 A4:.5 D5:.5 E5:.5 F#5:.5 G5:1 A5:1 | ~D5:4 | r:4', 'reed', 0.58),
    ],
  };
}

function lament(): Track {
  return {
    id: 'lament',
    title: 'Lament',
    bpm: 56,
    beatsPerBar: 3,
    bars: 6,
    loop: false,
    parts: [
      part('choir', 'base', 0.85, sustain(['Dm', 'Dm', 'Bb', 'A', 'Dm', 'Dm'], 3, 3, 0.5)),
      part('drone', 'base', 0.42, sustain(['Dsus', 'Dsus', 'Dsus', 'Dsus', 'Dsus'], 2, 3, 0.5, 0, [0, 2])),
      melody('A4:3 | G4:1.5 F4:1.5 | E4:2 F4:1 | E4:3 | ~D4:3 | r:3', 'reed', 1, 0.7),
    ],
  };
}

export const TRACKS: Record<TrackId, Track> = {
  title: title(),
  'explore-orc': orc(),
  'explore-dragon': dragon(),
  'explore-undead': undead(),
  boss: boss(),
  victory: victory(),
  lament: lament(),
};
