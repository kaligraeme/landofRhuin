/**
 * The music director. The game says what is going on (title, exploring a clan's dungeon, a
 * fight, a boss, a victory or a wipe); the director plays the right track, crossfading between
 * them, and fades each dungeon theme's drums in when a fight starts and out when it ends.
 *
 * Notes are scheduled a little ahead on the audio clock, so timing stays tight even if a frame
 * runs long. Browsers only allow sound after the player interacts, so nothing plays until then.
 */
import type { Inst, Stem, Track, TrackId } from './score.js';
import { TRACKS } from './score.js';
import { Synth } from './synth.js';

const LOOKAHEAD = 0.35;
const STEMS: Stem[] = ['base', 'melody', 'drive'];

interface Note {
  beat: number;
  notes: number[];
  dur: number;
  vel: number;
  /** The previous note in the line, for slides. */
  from?: number;
}

interface PreparedPart {
  inst: Inst;
  stem: Stem;
  gain: number;
  notes: Note[];
}

/** Sorts each part's notes and links slides to the note before. */
function prepare(track: Track): PreparedPart[] {
  return track.parts.map((p) => {
    const sorted = [...p.events].sort((a, b) => a.beat - b.beat);
    return {
      inst: p.inst,
      stem: p.stem,
      gain: p.gain,
      notes: sorted.map((e, i) => {
        const prev = i > 0 ? sorted[i - 1] : track.loop ? sorted[sorted.length - 1] : undefined;
        return { beat: e.beat, notes: e.notes, dur: e.dur, vel: e.vel, from: e.slide ? prev?.notes[0] : undefined };
      }),
    };
  });
}

interface Playing {
  track: Track;
  parts: PreparedPart[];
  /** Audio-clock time of beat 0. */
  start: number;
  /** Scheduled up to this beat. */
  cursor: number;
  fader: GainNode;
  stems: Record<Stem, GainNode>;
  channels: GainNode[];
  /** Stops scheduling after this audio time (fading out). */
  stopAt: number | null;
}

/**
 * Schedules every note of a playing track that starts in [from, to) beats (counting up across
 * loops). Exported so previews can render a track offline.
 */
export function scheduleSpan(synth: Synth, p: Playing, from: number, to: number): void {
  const spb = 60 / p.track.bpm;
  const length = p.track.bars * p.track.beatsPerBar;
  const loops = p.track.loop ? [Math.floor(from / length), Math.floor((to - 1e-9) / length)] : [0, 0];
  p.parts.forEach((part, pi) => {
    const dest = p.channels[pi] as GainNode;
    for (let k = loops[0] as number; k <= (loops[1] as number); k++) {
      for (const n of part.notes) {
        const b = k * length + n.beat;
        if (b < from || b >= to) continue;
        synth.play(part.inst, dest, p.start + b * spb, n.notes, n.dur * spb, n.vel, { from: n.from });
      }
    }
  });
}

/** Sets up a track's faders and channels on a synth, starting at `start`. */
export function startTrack(synth: Synth, dest: AudioNode, id: TrackId, start: number, fadeIn: number): Playing {
  const ctx = synth.ctx;
  const track = TRACKS[id];
  const fader = ctx.createGain();
  fader.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, start);
  if (fadeIn > 0) fader.gain.exponentialRampToValueAtTime(1, start + fadeIn);
  fader.connect(dest);
  const stems = {} as Record<Stem, GainNode>;
  for (const s of STEMS) {
    stems[s] = ctx.createGain();
    stems[s].connect(fader);
  }
  const parts = prepare(track);
  const channels = parts.map((p) => synth.channel(stems[p.stem], p.gain, p.stem === 'drive' ? 0.18 : 0.38));
  return { track, parts, start, cursor: 0, fader, stems, channels, stopAt: null };
}

interface Settings {
  volume: number;
  muted: boolean;
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('rhuin.music');
    if (raw) {
      const s = JSON.parse(raw) as Partial<Settings>;
      return { volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : 0.6, muted: !!s.muted };
    }
  } catch {
    // Storage can be unavailable (private windows); the defaults are fine.
  }
  return { volume: 0.6, muted: false };
}

export class Music {
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private master: GainNode | null = null;
  private playing: Playing[] = [];
  private current: Playing | null = null;
  private want: TrackId = 'title';
  private combat = false;
  /** A one-off track (victory, lament) playing over everything; afterwards `want` resumes. */
  private stingerTrack: Playing | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();
  private settings = loadSettings();

  get volume(): number {
    return this.settings.volume;
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  /** The scene the game last asked for. */
  get scene(): { track: TrackId; combat: boolean } {
    return { track: this.want, combat: this.combat };
  }

  /** What is playing, for the curious. */
  get nowPlaying(): string | null {
    return (this.stingerTrack ?? this.current)?.track.title ?? null;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setVolume(v: number): void {
    this.settings.volume = Math.min(1, Math.max(0, v));
    if (this.settings.volume > 0) this.settings.muted = false;
    this.applyVolume();
  }

  toggleMute(): void {
    this.settings.muted = !this.settings.muted;
    this.applyVolume();
  }

  private applyVolume(): void {
    try {
      localStorage.setItem('rhuin.music', JSON.stringify(this.settings));
    } catch {
      // Not saved; it still applies for this visit.
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.08);
    for (const fn of this.listeners) fn();
  }

  private level(): number {
    return this.settings.muted ? 0 : this.settings.volume ** 2 * 0.9;
  }

  /** Starts the audio on the player's first click or key press. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.synth = new Synth(this.ctx);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.level();
      this.master.connect(this.synth.out);
      this.timer = setInterval(() => this.tick(), 50);
      this.transition(this.want);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** What should be playing: a track, and whether a fight is on (for the dungeon themes). */
  setScene(track: TrackId, combat = false): void {
    const changed = track !== this.want;
    this.want = track;
    if (combat !== this.combat) {
      this.combat = combat;
      this.applyStems();
    }
    if (changed && !this.stingerTrack) this.transition(track);
  }

  /** Plays a one-off cue over the music (which ducks out), then carries on with `then`. */
  stinger(id: TrackId, then?: TrackId): void {
    if (then) this.want = then;
    if (!this.ctx || !this.synth || !this.master) return;
    const now = this.ctx.currentTime;
    if (this.current) this.fadeOut(this.current, now, 1.2);
    this.current = null;
    if (this.stingerTrack) this.fadeOut(this.stingerTrack, now, 0.5);
    this.stingerTrack = startTrack(this.synth, this.master, id, now + 0.05, 0);
    this.playing.push(this.stingerTrack);
  }

  private transition(id: TrackId): void {
    if (!this.ctx || !this.synth || !this.master) return;
    if (this.current?.track.id === id) return;
    const now = this.ctx.currentTime;
    if (this.current) this.fadeOut(this.current, now, id === 'boss' ? 1.2 : 2.5);
    this.current = startTrack(this.synth, this.master, id, now + 0.08, id === 'boss' ? 0.6 : 1.8);
    this.playing.push(this.current);
    this.applyStems();
  }

  private fadeOut(p: Playing, now: number, seconds: number): void {
    p.fader.gain.cancelScheduledValues(now);
    p.fader.gain.setValueAtTime(Math.max(0.0001, p.fader.gain.value), now);
    p.fader.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    p.stopAt = now + seconds;
  }

  /** Dungeon themes bring their drums in for fights; everything else plays in full. */
  private applyStems(): void {
    const p = this.current;
    if (!p || !this.ctx) return;
    const now = this.ctx.currentTime;
    const dungeon = p.track.id.startsWith('explore-');
    p.stems.drive.gain.setTargetAtTime(!dungeon || this.combat ? 1 : 0, now, 0.7);
    p.stems.base.gain.setTargetAtTime(dungeon && this.combat ? 0.85 : 1, now, 0.7);
  }

  private tick(): void {
    const ctx = this.ctx;
    const synth = this.synth;
    if (!ctx || !synth || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const p of this.playing) {
      const spb = 60 / p.track.bpm;
      const length = p.track.bars * p.track.beatsPerBar;
      // After the tab was hidden the timer may have slept: skip what was missed.
      const nowBeat = (now - p.start) / spb;
      if (p.cursor < nowBeat - 0.5) p.cursor = Math.max(0, nowBeat);
      let to = (now + LOOKAHEAD - p.start) / spb;
      if (!p.track.loop) to = Math.min(to, length);
      if (p.stopAt !== null) to = Math.min(to, (p.stopAt - p.start) / spb);
      if (to > p.cursor) {
        scheduleSpan(synth, p, p.cursor, to);
        p.cursor = to;
      }
    }
    // Drop tracks that have finished or faded out.
    this.playing = this.playing.filter((p) => {
      const spb = 60 / p.track.bpm;
      const ended = (p.stopAt !== null && now > p.stopAt + 3) || (!p.track.loop && now > p.start + (p.track.bars * p.track.beatsPerBar) * spb + 4);
      if (ended) p.fader.disconnect();
      return !ended;
    });
    // When a stinger has played out, the scene's music returns.
    const s = this.stingerTrack;
    if (s && now > s.start + s.track.bars * s.track.beatsPerBar * (60 / s.track.bpm) + 0.5) {
      this.stingerTrack = null;
      this.transition(this.want);
    }
  }
}

/** The one music director for the page. */
export const music = new Music();
