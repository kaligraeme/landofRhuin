/**
 * The soundtrack: original tunes in a dark-folk fantasy style — modal melodies on a reedy lead
 * over drones, lutes and harps, chanting choirs and frame drums.
 *
 * Each dungeon theme has three stems: `base` (drones, pads, accompaniment), `melody`, and
 * `drive` (drums and a driving figure) that fades in when a fight starts and out when it ends.
 */
import { arpeggio, drums, type NoteEvent, ostinato, parse, sustain } from './notation.js';

export type Inst = 'lute' | 'harp' | 'reed' | 'drone' | 'choir' | 'strings' | 'bass' | 'bell' | 'brass' | 'frameDrum' | 'taiko' | 'tom' | 'shaker';
export type Stem = 'base' | 'melody' | 'drive';
export type TrackId = 'title' | 'explore-orc' | 'explore-dragon' | 'explore-undead' | 'boss' | 'victory' | 'lament';

export interface Part {
  inst: Inst;
  stem: Stem;
  /** Level of the part in the mix. */
  gain: number;
  events: NoteEvent[];
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
}

const melody = (line: string, inst: Inst, gain: number, vel = 0.8): Part => ({ inst, stem: 'melody', gain, events: parse(line, vel).events });
const part = (inst: Inst, stem: Stem, gain: number, events: NoteEvent[]): Part => ({ inst, stem, gain, events });
const repeat = (bars: number, line: string): string => Array.from({ length: bars }, () => line).join(' ');

// ── Title: "Ballad of Rhuin" — D Dorian, 3/4 ───────────────────────────────────────────────

function title(): Track {
  const intro = ['Dm', 'Dm', 'C', 'Dm'];
  const a1 = ['Dm', 'G', 'Dm', 'C', 'F', 'C', 'G', 'Dm'];
  const a2 = ['Dm', 'C', 'Dm', 'G', 'F', 'C', 'Am', 'Dm'];
  const outro = ['Bb', 'C', 'Dm', 'Dm'];
  const chords = [...intro, ...a1, ...a2, ...outro];
  const tune = [
    'r:12',
    '^A4:1.5 G4:.5 F4:1 | E4:1 D4:1 B3:1 | D4:2 A4:1 | C5:1 B4:.5 A4:.5 G4:1 | A4:1 F4:1 C5:1 | ^E5:1.5 D5:.5 C5:1 | B4:1 G4:1 D5:1 | A4:3',
    'D5:1 F5:1 E5:.5 D5:.5 | C5:1.5 D5:.5 E5:1 | ^F5:1 E5:.5 D5:.5 A4:1 | B4:1.5 C5:.5 D5:1 | C5:1 A4:1 F4:1 | G4:1 E4:.5 F4:.5 G4:1 | ~A4:1.5 G4:.5 E4:1 | D4:3',
    'r:12',
  ].join(' ');
  return {
    id: 'title',
    title: 'Ballad of Rhuin',
    bpm: 76,
    beatsPerBar: 3,
    bars: chords.length,
    loop: true,
    parts: [
      part('lute', 'base', 0.5, arpeggio(chords, 3, [0, 2, 3, 4, 3, 2], 0.5, 3, 0.65)),
      part('drone', 'base', 0.32, sustain(chords.map(() => 'Dsus'), 2, 3, 0.6, 0, [0, 2])),
      part('choir', 'base', 0.42, sustain([...a2, ...outro], 4, 3, 0.55, 12 * 3)),
      part('harp', 'base', 0.45, arpeggio(outro, 4, [0, 1, 2, 3, 4, 5], 0.5, 3, 0.55, 20 * 3)),
      melody(tune, 'reed', 0.75),
    ],
  };
}

// ── Orcs: "The Bloodtusk Stronghold" — E Phrygian, 4/4 ─────────────────────────────────────

function orc(): Track {
  const chords = ['Em', 'F', 'Em', 'Dm', 'Em', 'F', 'G', 'Em', 'Em', 'Dm', 'C', 'Dm', 'Em', 'F', 'Dm', 'Em'];
  const tune = [
    'B3:1 C4:.5 B3:.5 A3:1 G3:1 | F3:2 E3:1 r:1 | E3:.5 G3:.5 B3:1 C4:1 D4:1 | E4:2 D4:1 A3:1',
    'C4:1 B3:.5 A3:.5 G3:1 A3:1 | F3:1.5 G3:.5 A3:2 | B3:1 A3:.5 G3:.5 F3:1 G3:1 | E3:4',
    '^E4:1.5 F4:.5 E4:1 D4:1 | D4:1 C4:.5 D4:.5 A3:2 | C4:1 D4:1 E4:1 G4:1 | F4:2 E4:1 D4:1',
    'E4:1 B3:1 C4:1.5 B3:.5 | A3:1 C4:1 F4:2 | E4:1 D4:.5 C4:.5 D4:1 A3:1 | E4:4',
  ].join(' ');
  const n = chords.length;
  return {
    id: 'explore-orc',
    title: 'The Bloodtusk Stronghold',
    bpm: 84,
    beatsPerBar: 4,
    bars: n,
    loop: true,
    parts: [
      part('drone', 'base', 0.4, sustain(chords.map(() => 'Esus'), 2, 4, 0.7, 0, [0, 2])),
      part('strings', 'base', 0.3, sustain(chords, 3, 4, 0.5)),
      // A distant war drum even when nothing is fighting.
      part('frameDrum', 'base', 0.55, drums(['X.......x.......', '................'], n, 0.25, 4, 0.7)),
      melody(tune, 'reed', 0.7),
      part('frameDrum', 'drive', 0.75, drums(['X...x.x.X...x.xx'], n, 0.25, 4)),
      part('tom', 'drive', 0.5, drums(['....X.......X...', '....X.......X.x.'], n, 0.25, 4)),
      part('bass', 'drive', 0.55, ostinato(chords, 2, [0, 0, 12, 0, 7, 0, 12, 10], 0.5, 4, 0.7)),
      part('shaker', 'drive', 0.25, drums(['x.o.x.o.x.o.x.o.'], n, 0.25, 4, 0.6)),
    ],
  };
}

// ── Dragons: "The Cinder Sanctum" — A Phrygian dominant, 4/4 ───────────────────────────────

function dragon(): Track {
  const chords = ['A', 'Bb', 'A', 'Gm', 'A', 'Dm', 'Bb', 'A', 'Dm', 'Gm', 'A', 'Bb', 'Gm', 'A', 'Bb', 'A'];
  const tune = [
    'E4:1 F4:.5 E4:.5 D4:1 C#4:1 | D4:1.5 E4:.5 ~F4:2 | G4:1 F4:.5 E4:.5 F4:1 E4:1 | G4:1 F4:1 D4:2',
    '~A4:1 G4:.5 F4:.5 E4:1 F4:1 | D4:1.5 C#4:.5 D4:2 | Bb3:1 C#4:1 D4:1 F4:1 | E4:4',
    '^A4:1.5 Bb4:.5 A4:1 F4:1 | G4:1 Bb4:1 A4:.5 G4:.5 F4:1 | E4:1 F4:.5 G4:.5 ~A4:2 | Bb4:1 A4:1 G4:1 F4:1',
    'G4:1.5 F4:.5 E4:1 D4:1 | C#4:1 D4:1 E4:2 | F4:1 E4:.5 D4:.5 C#4:1 Bb3:1 | A3:4',
  ].join(' ');
  const n = chords.length;
  return {
    id: 'explore-dragon',
    title: 'The Cinder Sanctum',
    bpm: 72,
    beatsPerBar: 4,
    bars: n,
    loop: true,
    parts: [
      part('drone', 'base', 0.4, sustain(chords.map(() => 'Asus'), 2, 4, 0.7, 0, [0, 2])),
      part('choir', 'base', 0.4, sustain(chords, 3, 4, 0.5)),
      // A temple bell every other bar.
      part('bell', 'base', 0.35, parse(repeat(n / 2, 'A5:8'), 0.5).events),
      melody(tune, 'reed', 0.75),
      part('frameDrum', 'drive', 0.8, drums(['X.....x...X.....'], n, 0.25, 4)),
      part('tom', 'drive', 0.45, drums(['..x.x...x.x.x.xx'], n, 0.25, 4)),
      part('bass', 'drive', 0.5, ostinato(chords, 2, [0, 0, 7, 0, 12, 0, 7, 0], 0.5, 4, 0.7)),
      part('shaker', 'drive', 0.2, drums(['x.x.x.x.x.x.x.x.'], n, 0.25, 4, 0.5)),
    ],
  };
}

// ── Undead: "The Barrow of Sorrows" — B minor, 3/4 ─────────────────────────────────────────

function undead(): Track {
  const chords = ['Bm', 'G', 'D', 'A', 'Bm', 'Em', 'F#m', 'Bm', 'G', 'A', 'Bm', 'Em', 'G', 'A', 'F#m', 'Bm'];
  const tune = [
    'F#5:1 E5:1 D5:1 | B4:2 D5:1 | A4:1 D5:1 F#5:1 | E5:3 | D5:1 C#5:1 B4:1 | G4:1.5 A4:.5 B4:1 | C#5:1 A4:1 F#4:1 | B4:3',
    'D5:1 E5:1 F#5:1 | G5:1.5 F#5:.5 E5:1 | F#5:2 D5:1 | E5:1 B4:1 G4:1 | B4:1 D5:1 G5:1 | F#5:1 E5:1 C#5:1 | A4:1.5 C#5:.5 F#5:1 | B4:3',
  ].join(' ');
  const n = chords.length;
  return {
    id: 'explore-undead',
    title: 'The Barrow of Sorrows',
    bpm: 60,
    beatsPerBar: 3,
    bars: n,
    loop: true,
    parts: [
      part('drone', 'base', 0.35, sustain(chords.map(() => 'Bsus'), 1, 3, 0.6, 0, [0, 2])),
      part('choir', 'base', 0.45, sustain(chords, 3, 3, 0.45)),
      part('harp', 'base', 0.4, arpeggio(chords, 3, [0, 2, 3], 1, 3, 0.5)),
      melody(tune, 'bell', 0.55),
      part('frameDrum', 'drive', 0.7, drums(['X.......x...'], n, 0.25, 3)),
      part('tom', 'drive', 0.4, drums(['........X...', '........X.x.'], n, 0.25, 3)),
      part('lute', 'drive', 0.45, arpeggio(chords, 3, [0, 2, 3, 4, 3, 2], 0.5, 3, 0.6)),
      part('strings', 'drive', 0.3, sustain(chords, 2, 3, 0.5, 0, [0, 2])),
    ],
  };
}

// ── Bosses: "The Last Sovereign" — D minor, 6/8 (a beat is an eighth note) ─────────────────

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
    bpm: 264,
    beatsPerBar: 6,
    bars: n,
    loop: true,
    parts: [
      part('drone', 'base', 0.4, sustain(chords.map(() => 'Dsus'), 2, 6, 0.7, 0, [0, 2])),
      part('choir', 'base', 0.5, sustain(chords, 3, 6, 0.6, 0, [0, 1, 2, 3])),
      part('strings', 'base', 0.5, ostinato(chords, 2, [0, 0, 7, 0, 12, 7], 1, 6, 0.75)),
      melody(tune, 'reed', 0.72, 0.85),
      melody(tune, 'brass', 0.32, 0.7),
      part('taiko', 'drive', 0.9, drums(['X..x..', 'X..x..', 'X..x..', 'X.xX.x'], n, 1, 6)),
      part('frameDrum', 'drive', 0.6, drums(['x.xx.x'], n, 1, 6)),
      part('tom', 'drive', 0.45, drums(['......', '......', '......', '..x.xX'], n, 1, 6)),
      part('shaker', 'drive', 0.22, drums(['xoxxox'], n, 1, 6, 0.6)),
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
      melody('A4:.5 D5:.5 F#5:1 A5:2 | G5:1 F#5:.5 E5:.5 D5:2 | B4:1 C#5:1 D5:1 E5:1 | F#5:3 r:1 | !D5+F#5+A5:4 | r:4', 'brass', 0.7),
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
