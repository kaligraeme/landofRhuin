import { describe, expect, it } from 'vitest';
import { arpeggio, chord, drums, midi, ostinato, parse, sustain } from '../src/client/audio/notation.js';
import { dungeonScene } from '../src/client/audio/scene.js';
import { TRACKS } from '../src/client/audio/score.js';

describe('music notation', () => {
  it('reads note names', () => {
    expect(midi('A4')).toBe(69);
    expect(midi('C4')).toBe(60);
    expect(midi('F#3')).toBe(54);
    expect(midi('Bb2')).toBe(46);
    expect(chord('Dm', 3)).toEqual([50, 53, 57]);
    expect(chord('Bb', 2)).toEqual([46, 50, 53]);
  });

  it('parses melodies with rests, chords, slides, grace notes and accents', () => {
    const { events, length } = parse('A4:1.5 r:.5 | D3+A3:2 ~E4 ^G4:1 !C5:.5', 0.8);
    expect(length).toBe(1.5 + 0.5 + 2 + 1 + 1 + 0.5);
    expect(events[0]).toMatchObject({ beat: 0, notes: [69], dur: 1.5 });
    expect(events[1]).toMatchObject({ beat: 2, notes: [50, 57] });
    expect(events[2]).toMatchObject({ beat: 4, slide: true });
    // A grace note a step above, then the note itself.
    expect(events[3]).toMatchObject({ beat: 5, notes: [69] });
    expect(events[4]?.beat).toBeCloseTo(5.12);
    expect(events[5]?.vel).toBeCloseTo(1);
  });

  it('builds accompaniment bar by bar', () => {
    expect(arpeggio(['Dm', 'G'], 3, [0, 2, 3], 1, 3)).toHaveLength(6);
    expect(sustain(['Dm', 'G'], 3, 4)[1]).toMatchObject({ beat: 4, notes: [55, 59, 62] });
    expect(ostinato(['Em'], 2, [0, 12], 0.5, 4).map((e) => e.notes[0])).toEqual([40, 52, 40, 52, 40, 52, 40, 52]);
    expect(drums(['X.x.'], 2, 0.25, 1).map((e) => e.beat)).toEqual([0, 0.5, 1, 1.5]);
  });
});

describe('the soundtrack', () => {
  it.each(Object.values(TRACKS).map((t) => [t.id, t] as const))('%s keeps time: every part fits the bars and every melody fills them', (_id, track) => {
    const length = track.bars * track.beatsPerBar;
    expect(track.parts.some((p) => p.stem === 'melody')).toBe(true);
    for (const part of track.parts) {
      expect(part.events.length).toBeGreaterThan(0);
      for (const e of part.events) {
        expect(e.beat).toBeGreaterThanOrEqual(0);
        expect(e.beat + e.dur).toBeLessThanOrEqual(length + 2.5);
        for (const n of e.notes) {
          expect(n).toBeGreaterThanOrEqual(23);
          expect(n).toBeLessThanOrEqual(96);
        }
      }
    }
    // Melodies end exactly on the last bar line, so loops are seamless.
    for (const part of track.parts.filter((p) => p.stem === 'melody')) {
      const last = Math.max(...part.events.map((e) => e.beat + e.dur));
      expect(last).toBeLessThanOrEqual(length);
    }
  });

  it('has a theme for every clan, a boss theme and the stingers', () => {
    expect(Object.keys(TRACKS).sort()).toEqual(['boss', 'explore-dragon', 'explore-orc', 'explore-undead', 'lament', 'title', 'victory']);
    for (const id of ['explore-orc', 'explore-dragon', 'explore-undead'] as const) {
      expect(TRACKS[id].loop).toBe(true);
      expect(TRACKS[id].parts.some((p) => p.stem === 'drive'), id).toBe(true);
    }
    expect(TRACKS.victory.loop).toBe(false);
    expect(TRACKS.lament.loop).toBe(false);
  });
});

describe('music scene', () => {
  const me = { x: 10, y: 10 };
  it('plays the clan theme, with drums only while a fight is near', () => {
    expect(dungeonScene('orc', me, [])).toEqual({ track: 'explore-orc', combat: false });
    expect(dungeonScene('orc', me, [{ boss: false, x: 12, y: 10, engaged: false }])).toEqual({ track: 'explore-orc', combat: false });
    expect(dungeonScene('undead', me, [{ boss: false, x: 12, y: 10, engaged: true }])).toEqual({ track: 'explore-undead', combat: true });
    expect(dungeonScene('dragon', me, [{ boss: false, x: 80, y: 10, engaged: true }])).toEqual({ track: 'explore-dragon', combat: false });
  });
  it('switches to the boss theme only once the boss is fighting', () => {
    expect(dungeonScene('orc', me, [{ boss: true, x: 20, y: 10, engaged: false }]).track).toBe('explore-orc');
    expect(dungeonScene('orc', me, [{ boss: true, x: 20, y: 10, engaged: true }])).toEqual({ track: 'boss', combat: true });
  });
});
