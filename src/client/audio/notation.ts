/**
 * A compact way to write music in code. A melody is a line of tokens:
 *
 *   A4:1.5   a note and its length in beats (default 1)
 *   r:2      a rest
 *   D3+A3:3  notes sounding together
 *   ~A4      slide into the note from the one before (for the reed)
 *   ^A4      a quick grace note a step above, stolen from the start of the note
 *   !A4      accented
 *   |        a bar line (ignored; it just keeps the score readable)
 *
 * Chord symbols (Dm, Bb, F#m, C#dim, Gsus, E5, Am7, Fmaj7, Cadd9) and a few pattern helpers
 * build accompaniment.
 */

export interface NoteEvent {
  /** Start, in beats from the top of the track. */
  beat: number;
  /** MIDI note numbers; empty for an unpitched drum hit. */
  notes: number[];
  dur: number;
  vel: number;
  /** Glide into this note from the previous one. */
  slide: boolean;
}

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a note name like C4, F#3 or Bb2. */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`Bad note: ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + (STEP[m[1] as string] as number) + acc;
}

/** Parses a melody line into notes. Returns the notes and the line's total length in beats. */
export function parse(line: string, vel = 0.8, offset = 0): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let beat = offset;
  for (const raw of line.trim().split(/\s+/)) {
    if (!raw || raw === '|') continue;
    let tok = raw;
    let slide = false;
    let grace = false;
    let accent = false;
    while (/^[~^!]/.test(tok)) {
      if (tok[0] === '~') slide = true;
      else if (tok[0] === '^') grace = true;
      else accent = true;
      tok = tok.slice(1);
    }
    const [pitch, durText] = tok.split(':') as [string, string | undefined];
    const dur = durText === undefined ? 1 : Number(durText);
    if (!(dur > 0)) throw new Error(`Bad length in ${raw}`);
    if (pitch !== 'r') {
      const notes = pitch.split('+').map(midi);
      const v = Math.min(1, vel * (accent ? 1.25 : 1));
      if (grace) {
        const g = Math.min(0.12, dur / 4);
        events.push({ beat, notes: notes.map((n) => n + 2), dur: g, vel: v * 0.8, slide: false });
        events.push({ beat: beat + g, notes, dur: dur - g, vel: v, slide: true });
      } else {
        events.push({ beat, notes, dur, vel: v, slide });
      }
    }
    beat += dur;
  }
  return { events, length: beat - offset };
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  sus: [0, 5, 7],
  // A power chord: root, fifth, octave.
  '5': [0, 7, 12],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};

/** The tones of a chord symbol (root, third, fifth and any extension), the root in the given octave. */
export function chord(symbol: string, octave: number): number[] {
  const m = /^([A-G][#b]?)(maj7|madd9|add9|m7|dim|sus|m|5|7)?$/.exec(symbol);
  if (!m) throw new Error(`Bad chord: ${symbol}`);
  const root = midi(`${m[1]}${octave}`);
  return (QUALITY[m[2] ?? ''] as number[]).map((i) => root + i);
}

/** Chord tones going up: root, third, fifth (and extension), then the same an octave higher. */
function tone(symbol: string, octave: number, i: number): number {
  const c = chord(symbol, octave);
  return (c[i % c.length] as number) + 12 * Math.floor(i / c.length);
}

/** A broken chord per bar, `shape` picking chord tones (0 root, 1 third, 2 fifth, 3 octave...). */
export function arpeggio(chords: string[], octave: number, shape: number[], step: number, beatsPerBar: number, vel = 0.6, offset = 0): NoteEvent[] {
  const out: NoteEvent[] = [];
  chords.forEach((c, bar) => {
    for (let k = 0; k * step < beatsPerBar - 1e-6; k++) {
      const i = shape[k % shape.length] as number;
      if (i < 0) continue;
      out.push({ beat: offset + bar * beatsPerBar + k * step, notes: [tone(c, octave, i)], dur: step * 1.6, vel: vel * (k === 0 ? 1.15 : 1), slide: false });
    }
  });
  return out;
}

/** One sustained chord per bar. */
export function sustain(chords: string[], octave: number, beatsPerBar: number, vel = 0.5, offset = 0, voicing = [0, 1, 2]): NoteEvent[] {
  return chords.map((c, bar) => ({ beat: offset + bar * beatsPerBar, notes: voicing.map((i) => tone(c, octave, i)), dur: beatsPerBar, vel, slide: false }));
}

/**
 * A bass, string or riff figure: semitone offsets from each bar's root, one per step (null is a
 * rest). `accents` marks steps to hit harder.
 */
export function ostinato(chords: string[], octave: number, offsets: (number | null)[], step: number, beatsPerBar: number, vel = 0.6, offset = 0, accents: number[] = [0]): NoteEvent[] {
  const out: NoteEvent[] = [];
  chords.forEach((c, bar) => {
    const root = chord(c, octave)[0] as number;
    for (let k = 0; k * step < beatsPerBar - 1e-6; k++) {
      const o = offsets[k % offsets.length];
      if (o === null || o === undefined) continue;
      out.push({ beat: offset + bar * beatsPerBar + k * step, notes: [root + o], dur: step * 0.9, vel: vel * (accents.includes(k % offsets.length) ? 1.2 : 1), slide: false });
    }
  });
  return out;
}

/** Power or full chords struck on a rhythm: one pattern character per step (X accent, x hit, - hold, . rest). */
export function stabs(chords: string[], octave: number, pattern: string, step: number, beatsPerBar: number, vel = 0.7, offset = 0, voicing?: number[]): NoteEvent[] {
  const out: NoteEvent[] = [];
  chords.forEach((c, bar) => {
    const notes = voicing ? voicing.map((i) => tone(c, octave, i)) : chord(c, octave);
    for (let k = 0; k < pattern.length && k * step < beatsPerBar - 1e-6; k++) {
      const ch = pattern[k];
      if (ch !== 'X' && ch !== 'x') continue;
      let len = 1;
      while (pattern[k + len] === '-') len++;
      out.push({ beat: offset + bar * beatsPerBar + k * step, notes, dur: step * len * 0.92, vel: vel * (ch === 'X' ? 1.2 : 1), slide: false });
    }
  });
  return out;
}

/**
 * A drum part: one pattern string per bar (or one repeated), a character per step: X loud,
 * x normal, o ghost, . rest.
 */
export function drums(patterns: string[], bars: number, step: number, beatsPerBar: number, vel = 0.8, offset = 0): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const p = patterns[bar % patterns.length] as string;
    for (let k = 0; k < p.length; k++) {
      const ch = p[k];
      const v = ch === 'X' ? 1 : ch === 'x' ? 0.65 : ch === 'o' ? 0.32 : 0;
      if (v > 0) out.push({ beat: offset + bar * beatsPerBar + k * step, notes: [], dur: step, vel: vel * v, slide: false });
    }
  }
  return out;
}

/**
 * One chord per bar, each voiced as close as it can get to the one before (the smallest total
 * movement over every inversion), so pads, strings and horn chords glide rather than jump. The
 * first chord sits just under `center`.
 */
export function voiced(chords: string[], center: number, beatsPerBar: number, vel = 0.5, offset = 0): NoteEvent[] {
  let prev: number[] | null = null;
  return chords.map((c, bar) => {
    const pcs = [...new Set(chord(c, 4).map((n) => n % 12))];
    let best: number[] = [];
    let bestCost = Infinity;
    for (let inv = 0; inv < pcs.length; inv++) {
      const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
      for (let low = center - 12; low < center; low++) {
        if (low % 12 !== order[0]) continue;
        const notes = [low];
        for (const pc of order.slice(1)) {
          let x = (notes[notes.length - 1] as number) + 1;
          while (x % 12 !== pc) x++;
          notes.push(x);
        }
        const p = prev;
        const cost = p ? notes.reduce((sum, n, i) => sum + Math.abs(n - (p[Math.min(i, p.length - 1)] as number)), 0) : Math.abs(low - (center - 7));
        if (cost < bestCost) {
          bestCost = cost;
          best = notes;
        }
      }
    }
    prev = best;
    return { beat: offset + bar * beatsPerBar, notes: best, dur: beatsPerBar, vel, slide: false };
  });
}

