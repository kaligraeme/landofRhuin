/**
 * The soundtrack: original tunes in a dark-folk fantasy style — modal melodies on a reedy lead
 * over drones, lutes and harps, chanting choirs and frame drums.
 *
 * Each dungeon theme has three stems: `base` (drones, pads, accompaniment), `melody`, and
 * `drive` (drums and a driving figure) that fades in when a fight starts and out when it ends.
 */
import { arpeggio, chord, drums, type NoteEvent, ostinato, parse, stabs, sustain, voiced } from './notation.js';

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
/**
 * Keeps a bar-by-bar figure in one register. The helpers place each chord's root by its letter
 * name, so A and B chords sit nearly an octave above C and D; this moves each bar by whole octaves
 * so its root (as built at `octave`) lands between `lo` and `lo + 11`.
 */
const settle = (events: NoteEvent[], chords: string[], beatsPerBar: number, octave: number, lo: number): NoteEvent[] =>
  events.map((e) => {
    const root = chord(chords[Math.floor(e.beat / beatsPerBar) % chords.length] as string, octave)[0] as number;
    const k = Math.ceil((lo - root) / 12) * 12;
    return k ? { ...e, notes: e.notes.map((x) => x + k) } : e;
  });
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
  const low = (ev: NoteEvent[], octave: number, lo: number): NoteEvent[] => settle(ev, chords, 3, octave, lo);
  // The guitar keeps moving through its phrase ends: a plucked note dies away, so the holds run on.
  const guitar = [
    `r:${at.a * 3}`,
    'B4:2 E5:1 | G5:1.5 F#5:.5 E5:1 | C5:2 E5:1 | D#5:2 B4:1 | E5:1 F#5:1 G5:1 | A5:2 G5:1 | F#5:1.5 E5:.5 D5:1 | B4:1.5 A4:.5 G4:.5 B4:.5',
    'C5:1 E5:1 G5:1 | A5:1.5 G5:.5 E5:1 | F#5:2 D#5:1 | E5:1.5 B4:.5 E5:.5 F#5:.5 | G5:1 E5:1 C5:1 | E5:1.5 D5:.5 C5:1 | B4:1 C5:1 D#5:1 | F#5:.5 F#5:.5 F#5:.5 F#5:.5 D#5:.5 B4:.5',
    `r:${(n - at.a2) * 3}`,
  ].join(' ');
  const violin = [
    `r:${at.a2 * 3}`,
    'E5:2 A5:1 | C6:1.5 B5:.5 A5:1 | F5:2 A5:1 | G#5:2 E5:1 | A5:1 B5:1 C6:1 | D6:2 C6:1 | B5:1.5 A5:.5 G5:1 | E5:3',
    'F5:1 A5:1 C6:1 | D6:1.5 C6:.5 A5:1 | B5:2 G#5:1 | A5:3 | G5:1 E5:1 C5:1 | F#5:1.5 E5:.5 D5:1 | D#5:1 F#5:1 A5:1 | B5:3',
    'E5:2 B5:1 | C6:2 B5:1 | D6:2 B5:1 | A5:3 | G5:1 A5:1 B5:1 | E6:2 C6:1 | C6:1.5 B5:.5 A5:1 | B5:3',
    'E6:2 D6:1 | C6:2 G5:1 | B5:1 D6:1 G6:1 | F#6:2 D6:1 | E6:1.5 D6:.5 C6:1 | C6:2 A5:1 | B5:1 C6:1 D#6:1 | E6:3',
    // A tag that turns the dominant back home to the top of the loop.
    'G5:2 E5:1 | F#5:2 A5:1 | D#5:1 F#5:1 B5:1 | A5:1.5 F#5:.5 D#5:1',
  ].join(' ');
  const tune = parse(violin, 0.8).events;
  const harp = low(arpeggio(chords, 4, [0, 1, 2, 3, 4, 5], 0.5, 3, 0.5), 4, 57);
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
      part('piano', 'base', 0.55, low(arpeggio(chords, 2, [0, 2, 4, 2, 3, 2], 0.5, 3, 0.62), 2, 33)),
      part('piano', 'base', 0.45, low(stabs(chords, 4, 'x.xx.x', 0.5, 3, 0.55, 0, [0, 1, 2]), 4, 57)),
      // The harp steps aside while the guitar has the tune, and returns with the violin.
      part('harp', 'base', 0.42, [...between(harp, 0, at.a * 3), ...between(harp, at.a2 * 3, n * 3)]),
      part('pizz', 'base', 0.45, low(ostinato(chords, 3, [0, null, 7, null, 12, null], 0.5, 3, 0.6), 3, 45)),
      part('timpani', 'base', 0.5, low(ostinato(chords, 2, [0, null, null, null, 0, null], 0.5, 3, 0.7), 2, 33)),
      part('frameDrum', 'base', 0.45, drums(['X...x.', 'X...x.', 'X...x.', 'X.x.xx'], n, 0.5, 3, 0.75), 0.15),
      part('shaker', 'base', 0.3, drums(plan([[at.a2, ['......']], [n - at.a2, ['xoxoxo']]]), n, 0.5, 3, 0.6), 0.05),
      part('strings', 'base', 0.4, voiced(chords, 64, 3, 0.55)),
      part('bass', 'base', 0.4, low(ostinato(chords, 2, [0, null, null, 0, 7, null], 0.5, 3, 0.65), 2, 33)),
      // Snare rolls into each section and over the loop's seam; a crash on every arrival.
      part('snare', 'base', 0.4, drums(onBars(n, [at.a - 1, at.a2 - 1, at.b - 1, at.b + 7, n - 1], 'x.xxXX', '......'), n, 0.5, 3, 0.7), 0.2),
      part('crash', 'base', 0.45, drums(onBars(n, [0, at.a, at.a2, at.b, at.b + 8, at.out - 1], 'X.....', '......'), n, 0.5, 3), 0.25),
      // The climax: open horn chords, a kick on the gallop and a light backbeat.
      part('horns', 'base', 0.28, low(between(sustain(chords, 3, 3, 0.55, 0, [0, 2, 3]), at.b * 3, n * 3), 3, 45)),
      part('kick', 'base', 0.45, drums(plan([[at.b, ['......']], [16, ['X..x..']], [4, ['X.....']]]), n, 0.5, 3, 0.7), 0.05),
      part('snare', 'base', 0.3, drums(plan([[at.b, ['......']], [16, ['..x...']], [4, ['......']]]), n, 0.5, 3, 0.6), 0.2),
      melody(guitar, 'lute', 0.7, 0.85),
      melody(violin, 'violin', 0.72, 0.8),
      // The horns sing the climax and the tag an octave under the violin.
      part('horns', 'melody', 0.42, shift(between(tune, at.b * 3, n * 3), -12)),
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
  const low = (ev: NoteEvent[], octave: number, lo: number): NoteEvent[] => settle(ev, chords, 4, octave, lo);
  const tune = [
    `r:${at.verse * 4}`,
    'D4:1.5 E4:.5 F4:1 A4:1 | Bb4:2 A4:1 F4:1 | G4:1.5 F4:.5 E4:1 C4:1 | D4:3 r:1',
    'A4:1.5 G4:.5 F4:1 D4:1 | F4:1 G4:1 Bb4:2 | C5:1.5 Bb4:.5 A4:1 G4:1 | A4:2 E4:1 C#4:1',
    'D4:1.5 E4:.5 F4:1 A4:1 | D5:2 C5:1 Bb4:1 | C5:1.5 Bb4:.5 G4:1 E4:1 | F4:2 D4:2',
    'A4:1 D5:1 F5:1 D5:1 | Bb4:1 D5:1 F5:2 | E5:1.5 D5:.5 C5:1 G4:1 | A4:3 r:1',
    // The stomp: the horns answer each bar's blows in the gap they leave.
    'r:3 D4:.5 A4:.5 | r:2.75 D4:.25 F4:.5 A4:.5 | r:3 Eb4:.5 Bb4:.5 | r:2.75 Eb4:.25 G4:.5 Bb4:.5 | r:3 D4:.5 A4:.5 | r:2.75 D4:.25 F4:.5 A4:.5 | r:3 Eb4:.5 G4:.5 | r:2.75 C4:.25 E4:.5 G4:.5',
    'F5:2 D5:1 F5:1 | G5:2 E5:1 C5:1 | A5:3 F5:1 | D5:4 | F5:2 D5:1 Bb4:1 | E5:2 G5:1 E5:1 | C#5:2 E5:1 A5:1 | !A5:3 r:1',
    // A tag that carries the tune over the seam into the intro's riff.
    'D4:1.5 E4:.5 F4:1 A4:1 | Bb4:2 G4:1 Eb4:1 | F4:1 A4:1 D5:2 | C#5:2 E5:1 A4:1',
  ].join(' ');
  // The riff: palm-muted gallops on the root; the Phrygian snarl on D, a Phrygian-dominant twist on A.
  const TAIL: Record<string, (number | null)[]> = { Dm: [0, 1, 3, 1], A: [0, 1, 4, 1] };
  const riffNotes = low(
    chords.flatMap((c, bar) => ostinato([c], 2, [0, 0, 12, null, 0, 0, 12, null, 0, 0, 12, null, ...(TAIL[c] ?? [0, 0, 7, 0])], 0.25, 4, 0.8, bar * 4, [0, 4, 8])),
    2,
    38,
  );
  const sect = (introP: string[], riffP: string[], verseP: string[], stompP: string[], chorusP: string[], outP: string[]): string[] =>
    plan([[4, introP], [8, riffP], [16, verseP], [8, stompP], [8, chorusP], [4, outP]]);
  /** Seven bars of a groove and a fill on the eighth. */
  const fill = (groove: string, last: string): string[] => [...Array.from({ length: 7 }, () => groove), last];
  const kick = sect(['X...............', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.XXXXXXXX'], ['X.X...X.X.X...X.'], ['X.....X.X.X...X.'], ['X.......X..X....'], ['X.X.X.X.X.X.X.X.'], ['X.X...X.X.X...X.', 'X.X...X.X.X...X.', 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX']);
  const snare = sect([REST16, REST16, '........X.......', 'X.X.X.X.XXXXXXXX'], fill('....X.......X...', '....X...X.X.XXXX'), fill('....X.......X...', '....X.....X.XXXX'), fill('........X.......', '........X.X.XXXX'), fill('....X.......X...', '....X.......XXXX'), ['....X.......X...', '....X.......X...', '....X.......X.x.', 'XxXxXxXxXXXXXXXX']);
  const hats = sect([REST16, REST16, 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], [REST16], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.']);
  const anvil = sect([REST16, REST16, REST16, '............X...'], ['....x.......x...'], ['....x.......x...'], ['X.......X.......'], ['....X.......X...'], ['....x.......x...']);
  const shouts = sect(['X...............', REST16, 'X...............', 'X.X.X...........'], [REST16], [REST16], ['X.......X..X....'], ['X...............'], [REST16, REST16, REST16, 'X.X.X...........']);
  /** A shout on the bar's root and fifth, low in a male choir's range. */
  const bark = (events: NoteEvent[]): NoteEvent[] => low(events.map((e) => ({ ...e, notes: chord(power([chords[Math.floor(e.beat / 4)] as string])[0] as string, 3).slice(0, 2), dur: 0.35 })), 3, 45);
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
      part('crash', 'base', 0.5, drums(onBars(n, [0, at.riff, at.verse, at.verse + 8, at.stomp, at.stomp + 2, at.stomp + 4, at.stomp + 6, at.chorus, at.chorus + 4, at.out], 'X...............', REST16), n, 0.25, 4), 0.2),
      part('taiko', 'base', 0.7, drums(plan([[4, ['X.......X.......', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.XXXX']], [24, [REST16]], [8, ['X.......X..X....']], [12, [REST16]]]), n, 0.25, 4), 0.2),
      part('boom', 'base', 0.6, drums(onBars(n, [0, at.riff, at.stomp, at.chorus], 'X...............', REST16), n, 0.25, 4), 0.3),
      // The riff alone is loud; under the verse's tune it backs off.
      part('power', 'base', 0.7, [...between(riffNotes, 0, at.verse * 4), ...between(riffNotes, at.out * 4, n * 4)], 0.08),
      part('power', 'base', 0.5, between(riffNotes, at.verse * 4, at.stomp * 4), 0.08),
      part('power', 'base', 0.7, low(stabs(power(stomp), 2, 'X-------X--x....', 0.25, 4, 0.85, at.stomp * 4, [0, 1, 2]), 2, 38), 0.08),
      part('power', 'base', 0.62, low(stabs(power(chorus), 2, 'X--x..x.X--x..x.', 0.25, 4, 0.8, at.chorus * 4, [0, 1, 2]), 2, 38), 0.08),
      part('sub', 'base', 0.5, low(ostinato(chords, 1, [0, null, 0, 0, 0, null, 0, 0], 0.5, 4, 0.8), 1, 28), 0.02),
      part('spiccato', 'base', 0.4, low(between(ostinato(chords, 3, [0, 0, 7, 0, 12, 0, 7, 0], 0.25, 4, 0.7, 0, [0, 4]), at.verse * 4, n * 4), 3, 50), 0.2),
      part('chant', 'base', 0.55, bark(drums(shouts, n, 0.25, 4)), 0.3),
      part('pad', 'base', 0.45, voiced(chords, 62, 4, 0.55)),
      melody(tune, 'horns', 0.8, 0.85),
      part('chant', 'melody', 0.45, shift(between(parse(tune, 0.65).events, at.chorus * 4, at.out * 4), -12)),
      // In a fight: double-kick, war drums, more shouts and horn stabs under the tune.
      part('kick', 'drive', 0.4, drums(plan([[at.verse, [REST16]], [16, ['xxxxxxxx........', 'xxxxxxxxxxxxxxxx']], [8, [REST16]], [12, ['xxxxxxxxxxxxxxxx']]]), n, 0.25, 4, 0.65), 0.03),
      part('taiko', 'drive', 0.6, drums(['X..x..X.X..x..X.'], n, 0.25, 4), 0.15),
      part('chant', 'drive', 0.45, bark(drums(['X...............', REST16], n, 0.25, 4)), 0.3),
      part('horns', 'drive', 0.35, low(stabs(chords, 2, 'X.....X.X.......', 0.25, 4, 0.8, 0, [0, 2, 3]), 2, 38)),
    ],
  };
}

// ── Dragons: "The Cinder Sanctum" — G minor, 4/4, 168 bpm ───────────────────────────────────
// Full-throttle battle-anthem energy in the spirit of modern Final Fantasy: a choppy chanted
// hook over a march, a rock kit under galloping staccato strings and power chords, horns
// carrying the tune and the choir lifting it into a bright major-key turn.

function dragon(): Track {
  const intro = ['Gm', 'Gm', 'Eb', 'F'];
  const verse = ['Gm', 'Eb', 'Bb', 'F', 'Cm', 'Dm', 'Eb', 'F'];
  const pre = ['Gm', 'F', 'Eb', 'Bb', 'Gm', 'F', 'Dm', 'F'];
  const chorus = ['Bb', 'F', 'Gm', 'Eb', 'Bb', 'F', 'Eb', 'F'];
  const chorus2 = ['Bb', 'F', 'Gm', 'Eb', 'Cm', 'Dm', 'Eb', 'F'];
  const turn = ['Cm', 'Dm', 'Eb', 'F'];
  const chords = [...intro, ...verse, ...verse, ...pre, ...chorus, ...chorus2, ...turn];
  const n = chords.length; // 48 bars
  const at = { verse: 4, pre: 20, chorus: 28, turn: 44 };
  const low = (ev: NoteEvent[], octave: number, lo: number): NoteEvent[] => settle(ev, chords, 4, octave, lo);
  const tune = parse(
    [
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
    ].join(' '),
    0.85,
  ).events;
  // The climax's top notes go to a violin; the horns take them an octave down.
  const peak = [at.chorus + 8, at.chorus + 12].map((bar) => bar * 4) as [number, number];
  const hornLine = [...tune.filter((e) => e.beat < peak[0] || e.beat >= peak[1]), ...shift(between(tune, peak[0], peak[1]), -12)];
  // The choir climbs through the march into the chorus.
  const climb = `r:${at.pre * 4} D5:4 | F5:4 | G5:4 | F5:4 | G5:4 | A5:4 | A5:4 | C6:4 r:${(n - at.pre - 8) * 4}`;
  const sect = (introP: string[], verseP: string[], preP: string[], chorusP: string[], turnP: string[]): string[] =>
    plan([[4, introP], [16, verseP], [8, preP], [16, chorusP], [4, turnP]]);
  const march = 'X.xxX.x.X.xxX.x.';
  const kick = sect(['X.......X.......', 'X.......X.......', 'X...X...X...X...', 'X.X.X.X.XXXXXXXX'], ['X.....x.X.....x.', 'X.....x.X...x.x.'], ['X...X...X...X...'], ['X..x..x.X..x..x.', 'X..x..x.X..x.xx.'], ['X.....x.X.....x.', 'X.....x.X.....x.', 'X.x.X.x.X.x.X.x.', 'X...X...X.X.XXXX']);
  const snare = sect(['........X.......', '........X.......', '........X.......', 'x.x.x.x.XxXxXXXX'], ['....X.......X...', '....X.......X.o.'], [march, march, march, march, march, march, march, 'XxXxXxXxXXXXXXXX'], ['....X.......X...', '....X.......X.xx'], ['....X.......X...', '....X.......X...', '....X.......X.x.', '..X...X.XXXXXXXX']);
  const hats = sect(['x...x...x...x...', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x.x.x.x.x.x.x.x.'], ['x...x...x...x...'], ['x.x.x.x.x.x.x.x.']);
  // The hook: short, clipped chanted chords over the intro, the march and the turn back.
  const hookBars = [0, 1, 2, 3, ...Array.from({ length: 8 }, (_, i) => at.pre + i), at.turn, at.turn + 1, at.turn + 2, at.turn + 3];
  const hook = low(chords.flatMap((c, bar) => (hookBars.includes(bar) ? stabs([c], 4, bar % 2 ? 'X.X...X.X...X.X.' : 'X.X...X.X.X.....', 0.25, 4, 0.85, bar * 4, [0, 1, 2]) : [])), 4, 55);
  const galop = [0, null, 0, 7, 12, null, 7, 0, 0, null, 0, 7, 12, 7, 12, 7];
  // Verse two answers the guitars' figure with a pushed one.
  const powerLine = [
    ...stabs(power(chords.slice(0, 12)), 2, 'X--x..x.X--x..x.', 0.25, 4, 0.75, 0),
    ...stabs(power(chords.slice(12, 20)), 2, 'X--x..x.X..x..x.', 0.25, 4, 0.75, 12 * 4),
    ...stabs(power(chords.slice(20)), 2, 'X--x..x.X--x..x.', 0.25, 4, 0.75, 20 * 4),
  ];
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
      part('crash', 'base', 0.55, drums(onBars(n, [0, at.verse, at.verse + 8, at.pre, at.chorus, at.chorus + 8, at.turn], 'X...............', REST16), n, 0.25, 4), 0.2),
      part('boom', 'base', 0.6, drums(onBars(n, [0, at.verse, at.chorus], 'X...............', REST16), n, 0.25, 4), 0.3),
      part('timpani', 'base', 0.5, low(between(ostinato(chords, 2, [0, null, null, null, 0, null, 0, null], 0.5, 4, 0.75), at.pre * 4, n * 4), 2, 38), 0.2),
      part('spiccato', 'base', 0.55, low(ostinato(chords, 3, galop, 0.25, 4, 0.75, 0, [0, 8]), 3, 50), 0.25),
      part('sub', 'base', 0.45, low(ostinato(chords, 1, [0, null, 0, 0, 0, null, 0, 0], 0.5, 4, 0.8), 1, 28), 0.02),
      part('power', 'base', 0.55, low(powerLine, 2, 38), 0.1),
      part('pad', 'base', 0.45, voiced(chords, 64, 4, 0.6)),
      part('chant', 'base', 0.6, hook, 0.3),
      part('choir', 'base', 0.55, parse(climb, 0.7).events),
      part('horns', 'melody', 0.62, hornLine),
      part('violin', 'melody', 0.6, between(tune, peak[0], peak[1])),
      part('chant', 'melody', 0.4, shift(between(tune, at.chorus * 4, at.turn * 4), -12), 0.3),
      // In a fight: double-time hats, taiko, crashes between the base's, horn stabs on the kicks.
      part('hat', 'drive', 0.42, drums(['xoxoxoxoxoxoxoxo'], n, 0.25, 4), 0.05),
      part('taiko', 'drive', 0.6, drums(['X.......X..x....', 'X.......X..x..x.'], n, 0.25, 4), 0.15),
      part('crash', 'drive', 0.38, drums(onBars(n, [8, 16, 24, 32, 40], 'X...............', REST16), n, 0.25, 4), 0.2),
      part('horns', 'drive', 0.42, low(stabs(chords, 3, 'X.......X..x....', 0.25, 4, 0.75, 0, [0, 1, 2]), 3, 50)),
    ],
  };
}

// ── Undead: "The Barrow of Sorrows" — C minor, 6/8 (a beat is an eighth), 300 bpm ──────────
// One big, singable modal theme in a rolling 6/8, in the manner of a dark fantasy RPG's main
// theme: first on a cello over an oud's ostinato and war drums, then on low horns with the
// choir, a duduk-like reed over the bridge and the turn back.

function undead(): Track {
  const intro = ['Cm', 'Cm', 'Ab', 'Bb'];
  const theme = ['Cm', 'Ab', 'Fm', 'Gm', 'Cm', 'Ab', 'Bb', 'Bb', 'Ab', 'Bb', 'Cm', 'Gm', 'Ab', 'Fm', 'Gm', 'Cm'];
  const bridge = ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'Gm', 'Gm'];
  const out = ['Fm', 'Gm', 'Bb', 'Gm'];
  const chords = [...intro, ...theme, ...theme, ...bridge, ...out];
  const n = chords.length; // 48 bars
  const at = { a: 4, a2: 20, bridge: 36, out: 44 };
  const low = (ev: NoteEvent[], octave: number, lo: number): NoteEvent[] => settle(ev, chords, 6, octave, lo);
  const melodyLine = [
    'G4:3 C5:2 D5:1 | Eb5:3 C5:2 Bb4:1 | Ab4:2 C5:1 F5:3 | D5:5 r:1 | G4:3 C5:2 D5:1 | Eb5:2 F5:1 Eb5:2 C5:1 | D5:3 F5:2 D5:1 | Bb4:5 r:1',
    'C5:3 Eb5:2 Ab5:1 | G5:3 F5:2 D5:1 | Eb5:2 D5:1 C5:3 | Bb4:3 D5:3 | C5:2 Eb5:1 Ab5:2 G5:1 | F5:3 Eb5:2 C5:1 | D5:2 C5:1 D5:2 Bb4:1 | C5:5 r:1',
  ].join(' ');
  const statement = parse(melodyLine, 0.8).events;
  const at6 = (events: NoteEvent[], bar: number): NoteEvent[] => events.map((e) => ({ ...e, beat: e.beat + bar * 6 }));
  // The reed's bridge sings in the theme's own rhythm, then turns the music back home.
  const reed = [
    `r:${at.bridge * 6}`,
    'C5:3 Eb5:2 F5:1 | D5:3 F5:2 D5:1 | Eb5:2 D5:1 C5:2 Eb5:1 | G5:5 r:1 | Ab5:3 Eb5:2 C5:1 | D5:2 Eb5:1 F5:3 | D5:3 Bb4:2 C5:1 | D5:5 r:1',
    'C5:3 Ab4:2 C5:1 | D5:3 Bb4:2 G4:1 | F5:3 D5:2 Bb4:1 | D5:5 r:1',
  ].join(' ');
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
      // The gallop: an oud's broken chords on every eighth, war drums on every dotted quarter,
      // and a low long-short pulse under it.
      part('lute', 'base', 0.45, low(arpeggio(chords, 3, [0, 1, 2, 3, 2, 1], 1, 6, 0.65), 3, 45)),
      part('bass', 'base', 0.4, low(ostinato(chords, 2, [0, null, 0, 0, null, 7], 1, 6, 0.7, 0, [0, 3]), 2, 33)),
      part('taiko', 'base', 0.65, drums(sect(['X.....', 'X.....', 'X..x..', 'X..xXX'], ['X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X..x..', 'X.xXXX'], ['X..X..', 'X..X..', 'X..X..', fill], ['X..x..', 'X.....'], ['X..x..', 'X..x..', 'X..X..', 'XXXXXX']), n, 1, 6), 0.2),
      part('kick', 'base', 0.55, drums(sect(['......'], ['X.....'], ['X..X..'], ['X.....'], ['X..X..']), n, 1, 6), 0.05),
      part('snare', 'base', 0.5, drums(sect(['......', '......', '......', 'xxxXXX'], ['...X..', '...X..', '...X..', '...X..', '...X..', '...X..', '...X..', '..xXXX'], ['...X..', '...X.x'], ['......', '...X..'], ['...X..', '...X..', '...X..', 'XXXXXX']), n, 1, 6), 0.15),
      part('frameDrum', 'base', 0.4, drums(['x.xx.x'], n, 1, 6, 0.6), 0.1),
      part('shaker', 'base', 0.3, drums(['.x..x.'], n, 1, 6, 0.6), 0.05),
      part('crash', 'base', 0.45, drums(onBars(n, [0, at.a, at.a2, at.a2 + 8, at.bridge, at.out], 'X.....', '......'), n, 1, 6), 0.25),
      part('boom', 'base', 0.55, drums(onBars(n, [0, at.a, at.a2, at.bridge], 'X.....', '......'), n, 1, 6), 0.3),
      part('bell', 'base', 0.3, drums(onBars(n, Array.from({ length: n / 4 }, (_, i) => i * 4), 'X.....', '......'), n, 1, 6, 0.5).map((e) => ({ ...e, notes: [72], dur: 6 })), 0.5),
      part('sub', 'base', 0.45, low(ostinato(chords, 1, [0, null, null, 0, null, null], 1, 6, 0.8), 1, 28), 0.02),
      part('spiccato', 'base', 0.45, low(between(ostinato(chords, 3, [0, 0, 7, 0, 7, 0], 1, 6, 0.7, 0, [0, 3]), at.a2 * 6, n * 6), 3, 48), 0.25),
      part('pad', 'base', 0.45, voiced(chords, 62, 6, 0.55)),
      part('choir', 'base', 0.45, between(voiced(chords, 70, 6, 0.6), at.bridge * 6, at.out * 6)),
      // The theme: a cello first, in its singing tenor register; then low horns with the choir.
      part('cello', 'melody', 0.7, at6(statement, at.a)),
      part('horns', 'melody', 0.6, shift(at6(statement, at.a2), -12)),
      part('chant', 'melody', 0.45, at6(statement, at.a2)),
      melody(reed, 'reed', 0.62, 0.8),
      // In a fight: the drums double up, sixteenth hats, low horn fifths on the dotted quarters,
      // the choir barking on the downbeat.
      part('taiko', 'drive', 0.55, drums(['X.xX.x'], n, 1, 6), 0.15),
      part('hat', 'drive', 0.3, drums(['xoxoxoxoxoxo'], n, 0.5, 6, 0.7), 0.05),
      part('tom', 'drive', 0.45, drums(['......', '......', '......', 'xxXxXX'], n, 1, 6), 0.1),
      part('horns', 'drive', 0.42, low(stabs(chords, 2, 'X..X..', 1, 6, 0.75, 0, [0, 2, 3]), 2, 36)),
      part('chant', 'drive', 0.4, low(stabs(chords, 3, 'X.....', 1, 6, 0.8, 0, [0, 1, 2]), 3, 48), 0.3),
    ],
  };
}

// ── Bosses: "The Last Sovereign" — D minor, 6/8 (a beat is an eighth), 312 bpm ─────────────
// The most intense track: the theme over a sixteenth-note gallop, a build with an answering horn
// phrase over war drums, then the theme again with everything thrown at it.

function boss(): Track {
  const a = ['Dm', 'Bb', 'F', 'Dm', 'Dm', 'Gm', 'A', 'Dm', 'Bb', 'C', 'Dm', 'A', 'Gm', 'A', 'Dm', 'A'];
  const build = ['Gm', 'Eb', 'Bb', 'A', 'Gm', 'Eb', 'C', 'A'];
  const chords = [...a, ...build, ...a];
  const n = chords.length; // 40 bars
  const at = { build: 16, a2: 24 };
  const low = (ev: NoteEvent[], octave: number, lo: number): NoteEvent[] => settle(ev, chords, 6, octave, lo);
  const theme = [
    '!D5:3 C5:2 A4:1 | Bb4:3 A4:2 G4:1 | A4:2 G4:1 F4:2 E4:1 | D4:6',
    'F4:2 G4:1 A4:2 Bb4:1 | C5:3 Bb4:2 A4:1 | G4:2 A4:1 Bb4:2 C#5:1 | !D5:6',
    '!F5:3 D5:2 F5:1 | E5:3 D5:2 C5:1 | D5:2 C5:1 A4:2 F4:1 | E4:3 C#5:3',
    'D5:2 Bb4:1 G4:2 Bb4:1 | C#5:2 A4:1 E4:2 A4:1 | D5:2 F5:1 A5:2 F5:1 | !E5:2 D5:1 C#5:3',
  ].join(' ');
  const answer = 'G4:3 Bb4:2 D5:1 | Eb5:3 D5:2 Bb4:1 | D5:2 C5:1 Bb4:2 F4:1 | E4:3 C#5:3 | G4:3 Bb4:2 D5:1 | G5:3 Eb5:2 Bb4:1 | C5:2 E5:1 G5:2 E5:1 | C#5:3 E5:2 A5:1';
  const tune = parse(`${theme} ${answer} ${theme}`, 0.85).events;
  const sect = (aP: string[], buildP: string[], a2P: string[]): string[] => plan([[16, aP], [8, buildP], [16, a2P]]);
  const four = (groove: string, fill: string): string[] => [groove, groove, groove, fill];
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
      part('kick', 'base', 0.65, drums(sect(four('X..X..', 'X.XX.X'), ['X.....', 'X.....', 'X..X..', 'XXXXXX'], four('X.XX.X', 'XXXXXX')), n, 1, 6), 0.05),
      part('snare', 'base', 0.55, drums(sect(four('...X..', '..xXXX'), ['......', '...X..', '......', 'xxxXXX'], four('...X.x', '..xXXX')), n, 1, 6), 0.14),
      part('hat', 'base', 0.4, drums(sect(['xxxxxx'], ['x..x..'], ['xxxxxx']), n, 1, 6, 0.7), 0.05),
      part('crash', 'base', 0.45, drums(onBars(n, [0, 4, 8, 12, at.build, at.a2, at.a2 + 4, at.a2 + 8, at.a2 + 12], 'X.....', '......'), n, 1, 6), 0.2),
      part('boom', 'base', 0.6, drums(onBars(n, [0, at.build, at.a2], 'X.....', '......'), n, 1, 6), 0.3),
      part('taiko', 'base', 0.7, drums(sect(['......'], ['X..x..', 'X..x..', 'X..X..', 'X.xX.x'], ['......']), n, 1, 6), 0.15),
      // A sixteenth-note gallop in the strings, galloping power chords under it.
      part('spiccato', 'base', 0.55, low(ostinato(chords, 3, [0, 0, 7, 0, 0, 7, 0, 0, 7, 0, 12, 7], 0.5, 6, 0.75, 0, [0, 6]), 3, 50), 0.25),
      part('power', 'base', 0.55, low([...between(stabs(power(chords), 2, 'X.xX.xX.xX.x', 0.5, 6, 0.75), 0, at.build * 6), ...between(stabs(power(chords), 2, 'X-----', 1, 6, 0.8), at.build * 6, (at.build + 6) * 6), ...between(stabs(power(chords), 2, 'X.xX.xX.xX.x', 0.5, 6, 0.75), (at.build + 6) * 6, n * 6)], 2, 38), 0.08),
      part('sub', 'base', 0.45, low(ostinato(chords, 1, [0, null, null, 0, null, null], 1, 6, 0.8), 1, 31), 0.02),
      part('strings', 'base', 0.45, voiced(chords, 62, 6, 0.6)),
      part('chant', 'base', 0.45, low(stabs(chords, 3, 'X.X...', 1, 6, 0.8, 0, [0, 1, 2]), 3, 48), 0.3),
      part('horns', 'melody', 0.65, tune),
      // The violin soars an octave over the theme; the choir sings the theme's return.
      part('violin', 'melody', 0.42, shift([...between(tune, 0, at.build * 6), ...between(tune, at.a2 * 6, n * 6)], 12)),
      part('chant', 'melody', 0.4, shift(between(tune, at.a2 * 6, n * 6), -12), 0.3),
      // On top in the fight: war drums, sixteenth hats, rolls and a tom run into every fourth bar.
      part('taiko', 'drive', 0.7, drums(['X.x.x.', 'X.x.x.', 'X.x.x.', 'X.xX.x'], n, 1, 6), 0.15),
      part('hat', 'drive', 0.32, drums(['xoxoxoxoxoxo'], n, 0.5, 6, 0.7), 0.05),
      part('snare', 'drive', 0.4, drums(['............', '............', '............', '......oxxXXX'], n, 0.5, 6), 0.14),
      part('tom', 'drive', 0.45, drums(['............', '............', '............', 'x.x.xxXxXxXX'], n, 0.5, 6), 0.1),
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
