/**
 * The instruments, built from Web Audio oscillators, filters and noise: a plucked lute and harp,
 * a reedy duduk-like lead that slides between notes, a hurdy-gurdy drone, a choir, low strings,
 * bass, bells, brass and a folk percussion section, all into a shared hall reverb.
 *
 * Works with a live AudioContext or an OfflineAudioContext (to render previews).
 */
import type { Inst } from './score.js';

const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);

export interface PlayOpts {
  /** Previous note of the same line, for slides. */
  from?: number;
}

export class Synth {
  /** Everything ends up here; connect it to the speakers. */
  readonly out: GainNode;
  private readonly reverb: ConvolverNode;
  private readonly noise: AudioBuffer;

  constructor(readonly ctx: BaseAudioContext) {
    this.out = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.out.connect(comp).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.hall(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    this.reverb.connect(wet).connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** A stereo impulse response: decaying noise, darker as it fades. */
  private hall(seconds: number): AudioBuffer {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const k = 0.25 + 0.7 * t;
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * (1 - t) ** 2.4;
      }
    }
    return buf;
  }

  /**
   * A channel for one part: its own level and a send to the reverb. Returns the node notes
   * should connect to.
   */
  channel(dest: AudioNode, gain: number, reverb = 0.35): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = gain;
    g.connect(dest);
    const send = this.ctx.createGain();
    send.gain.value = reverb;
    g.connect(send).connect(this.reverb);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, end: number, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.value = detune;
    o.start(t);
    o.stop(end);
    return o;
  }

  private noiseSrc(t: number, end: number): AudioBufferSourceNode {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    n.start(t, Math.random() * 0.5);
    n.stop(end);
    return n;
  }

  private filter(type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  /** A gain with a classic attack/hold/release shape; returns the node and when the sound ends. */
  private envelope(t: number, peak: number, attack: number, hold: number, release: number): { g: GainNode; end: number } {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, hold) + release);
    return { g, end: t + Math.max(attack, hold) + release + 0.05 };
  }

  /** A plucked string: bright at first, fading fast. */
  private pluck(dest: AudioNode, t: number, freq: number, vel: number, decay: number, bright: number, harp: boolean): void {
    const end = t + decay + 0.1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const lp = this.filter('lowpass', bright, harp ? 0.5 : 2);
    lp.frequency.setValueAtTime(bright, t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, bright * 0.18), t + decay * 0.6);
    lp.connect(g).connect(dest);
    if (harp) {
      this.osc('triangle', freq, t, end).connect(lp);
      const o2 = this.osc('sine', freq * 2, t, end);
      const g2 = this.ctx.createGain();
      g2.gain.value = 0.25;
      o2.connect(g2).connect(lp);
    } else {
      this.osc('sawtooth', freq, t, end).connect(lp);
      this.osc('triangle', freq, t, end, 5).connect(lp);
    }
    // The pick against the string.
    const n = this.noiseSrc(t, t + 0.03);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.12, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    n.connect(this.filter('highpass', 2500)).connect(ng).connect(dest);
  }

  /** Plays one note (or drum hit) at time `t` for `dur` seconds. */
  play(inst: Inst, dest: AudioNode, t: number, notes: number[], dur: number, vel: number, opts: PlayOpts = {}): void {
    switch (inst) {
      case 'lute':
        for (const n of notes) this.pluck(dest, t, mtof(n), vel, 1.3, 3200 * (0.6 + vel * 0.5), false);
        break;
      case 'harp':
        for (const n of notes) this.pluck(dest, t, mtof(n), vel, 2.4, 4200, true);
        break;
      case 'reed':
        for (const n of notes) this.reed(dest, t, n, dur, vel, opts.from);
        break;
      case 'drone':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.16, 0.35, dur, 0.5);
          const lp = this.filter('lowpass', 900, 1.2);
          lp.connect(g).connect(dest);
          this.osc('sawtooth', mtof(n), t, end).connect(lp);
          this.osc('square', mtof(n), t, end, 7).connect(lp);
        }
        break;
      case 'choir':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.1, 0.7, dur, 0.9);
          // Two formants for an "ah".
          const f1 = this.filter('bandpass', 720, 3.5);
          const f2 = this.filter('bandpass', 1150, 5);
          const mix = this.ctx.createGain();
          f1.connect(mix);
          f2.connect(mix);
          mix.connect(this.filter('lowpass', 2600)).connect(g).connect(dest);
          for (const d of [-9, 0, 8]) {
            const o = this.osc('sawtooth', mtof(n), t, end, d);
            o.connect(f1);
            o.connect(f2);
          }
        }
        break;
      case 'strings':
        for (const n of notes) {
          const short = dur < 0.6;
          const { g, end } = this.envelope(t, vel * (short ? 0.22 : 0.14), short ? 0.02 : 0.35, dur * (short ? 0.7 : 1), short ? 0.12 : 0.6);
          const lp = this.filter('lowpass', short ? 1800 : 1300, 0.9);
          lp.connect(g).connect(dest);
          this.osc('sawtooth', mtof(n), t, end, -6).connect(lp);
          this.osc('sawtooth', mtof(n), t, end, 6).connect(lp);
        }
        break;
      case 'bass':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.45, 0.008, dur * 0.8, 0.15);
          const lp = this.filter('lowpass', 700, 1);
          lp.connect(g).connect(dest);
          this.osc('triangle', mtof(n), t, end).connect(lp);
          this.osc('sawtooth', mtof(n), t, end).connect(this.filter('lowpass', 300)).connect(lp);
        }
        break;
      case 'bell':
        for (const n of notes) {
          const f = mtof(n);
          for (const [ratio, amp, decay] of [[1, 0.5, 2.6], [2.76, 0.18, 1.2], [5.4, 0.07, 0.6], [2, 0.12, 1.8]] as [number, number, number][]) {
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vel * amp, t + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
            this.osc('sine', f * ratio, t, t + decay + 0.05).connect(g).connect(dest);
          }
        }
        break;
      case 'brass':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.16, 0.05, dur * 0.9, 0.2);
          const lp = this.filter('lowpass', 500, 1.5);
          lp.frequency.setValueAtTime(500, t);
          lp.frequency.linearRampToValueAtTime(2600, t + 0.09);
          lp.frequency.exponentialRampToValueAtTime(1400, t + 0.5);
          lp.connect(g).connect(dest);
          this.osc('sawtooth', mtof(n), t, end).connect(lp);
          this.osc('sawtooth', mtof(n), t, end, 9).connect(lp);
        }
        break;
      case 'frameDrum':
        this.drum(dest, t, vel, 150, 52, 0.42, 900, 0.09);
        break;
      case 'taiko':
        this.drum(dest, t, vel * 1.3, 95, 38, 0.9, 380, 0.22);
        break;
      case 'tom':
        this.drum(dest, t, vel * 0.8, 260, 140, 0.22, 1600, 0.05);
        break;
      case 'shaker': {
        const n = this.noiseSrc(t, t + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vel * 0.16, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        n.connect(this.filter('highpass', 6500)).connect(g).connect(dest);
        break;
      }
    }
  }

  /** A drum: a pitched thump that drops in pitch, and a slap of filtered noise. */
  private drum(dest: AudioNode, t: number, vel: number, f0: number, f1: number, decay: number, slapFreq: number, slapDecay: number): void {
    const o = this.osc('sine', f0, t, t + decay + 0.05);
    o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.9, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g).connect(dest);
    const n = this.noiseSrc(t, t + slapDecay + 0.02);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + slapDecay);
    n.connect(this.filter('bandpass', slapFreq, 1.2)).connect(ng).connect(dest);
  }

  /** The lead: a reedy, breathy tone with slow vibrato that can glide from the last note. */
  private reed(dest: AudioNode, t: number, note: number, dur: number, vel: number, from?: number): void {
    const f = mtof(note);
    const { g, end } = this.envelope(t, vel * 0.2, 0.06, dur * 0.95, 0.18);
    const body = this.filter('lowpass', 1900, 1.1);
    const nasal = this.ctx.createBiquadFilter();
    nasal.type = 'peaking';
    nasal.frequency.value = 1250;
    nasal.Q.value = 2;
    nasal.gain.value = 7;
    body.connect(nasal).connect(g).connect(dest);
    const o = this.osc('sawtooth', f, t, end);
    const sq = this.osc('square', f, t, end, 4);
    if (from !== undefined && from !== note) {
      o.frequency.setValueAtTime(mtof(from), t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.11);
      sq.frequency.setValueAtTime(mtof(from), t);
      sq.frequency.exponentialRampToValueAtTime(f, t + 0.11);
    }
    const sqg = this.ctx.createGain();
    sqg.gain.value = 0.35;
    o.connect(body);
    sq.connect(sqg).connect(body);
    // Vibrato that blooms on longer notes.
    const lfo = this.osc('sine', 5.3, t, end);
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.5, dur * 0.6) + 0.05);
    lfo.connect(depth);
    depth.connect(o.frequency);
    depth.connect(sq.frequency);
    // Breath.
    const n = this.noiseSrc(t, end);
    const ng = this.ctx.createGain();
    ng.gain.value = vel * 0.018;
    n.connect(this.filter('bandpass', 1600, 0.8)).connect(ng).connect(g);
  }
}
