/**
 * The instruments, built from Web Audio oscillators, filters and noise: a plucked lute and harp,
 * a reedy duduk-like lead that slides between notes, a hurdy-gurdy drone, a choir, low strings,
 * bass, bells, brass and a folk percussion section; and a heavier kit for driving music: a drum
 * kit, hammered metal, staccato and plucked strings, ensemble horns, a saturated power synth,
 * sub bass, a pad and a cinematic boom. All share a hall reverb.
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
  private readonly curves = new Map<number, Float32Array>();

  constructor(readonly ctx: BaseAudioContext) {
    this.out = ctx.createGain();
    // Glue the mix together, then catch the peaks so loud passages stay loud without clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3;
    limit.ratio.value = 20;
    limit.attack.value = 0.001;
    limit.release.value = 0.08;
    this.out.connect(comp).connect(limit).connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.hall(2.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.26;
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

  /** A soft-clipping curve for saturation; `drive` 1 is gentle, 10 is fuzz. */
  private shaper(drive: number): WaveShaperNode {
    let curve = this.curves.get(drive);
    if (!curve) {
      curve = new Float32Array(1024);
      const k = Math.tanh(drive);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * drive) / k;
      }
      this.curves.set(drive, curve);
    }
    const w = this.ctx.createWaveShaper();
    w.curve = curve as Float32Array<ArrayBuffer>;
    w.oversample = '2x';
    return w;
  }

  /** A burst of filtered noise. */
  private hiss(dest: AudioNode, t: number, peak: number, decay: number, type: BiquadFilterType, freq: number, q = 0.7, attack = 0.002): void {
    const n = this.noiseSrc(t, t + attack + decay + 0.02);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    n.connect(this.filter(type, freq, q)).connect(g).connect(dest);
  }

  /** A pitched body that sweeps down: the thump of a kick or a boom. */
  private sweep(dest: AudioNode, t: number, peak: number, f0: number, f1: number, fall: number, decay: number, type: OscillatorType = 'sine', drive = 0): void {
    const o = this.osc(type, f0, t, t + decay + 0.05);
    o.frequency.exponentialRampToValueAtTime(f1, t + fall);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    if (drive > 0) o.connect(this.shaper(drive)).connect(g).connect(dest);
    else o.connect(g).connect(dest);
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
      case 'kick':
        // A punchy thump with a beater click.
        this.sweep(dest, t, vel * 1.05, 165, 44, 0.11, 0.42, 'sine', 1.6);
        this.hiss(dest, t, vel * 0.32, 0.014, 'highpass', 2800);
        break;
      case 'snare':
        this.sweep(dest, t, vel * 0.42, 230, 165, 0.05, 0.13, 'triangle');
        this.hiss(dest, t, vel * 0.5, 0.17, 'bandpass', 3200, 0.55);
        this.hiss(dest, t, vel * 0.22, 0.09, 'highpass', 6500);
        break;
      case 'hat':
        this.hiss(dest, t, vel * 0.2, 0.04, 'highpass', 8200);
        break;
      case 'openHat':
        this.hiss(dest, t, vel * 0.17, 0.3, 'highpass', 7600, 0.7, 0.004);
        break;
      case 'crash': {
        this.hiss(dest, t, vel * 0.26, 1.7, 'highpass', 4800, 0.6, 0.003);
        // A metallic shimmer of inharmonic square waves.
        const ring = this.ctx.createGain();
        ring.gain.setValueAtTime(vel * 0.05, t);
        ring.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
        const hp = this.filter('highpass', 6000);
        hp.connect(ring).connect(dest);
        for (const r of [1, 1.483, 1.932, 2.546, 3.11]) this.osc('square', 410 * r, t, t + 1.25).connect(hp);
        break;
      }
      case 'anvil':
        // Hammered metal: bright inharmonic partials and a sharp strike.
        for (const [ratio, amp, decay] of [[1, 0.22, 0.9], [2.31, 0.14, 0.6], [3.87, 0.09, 0.4], [5.12, 0.06, 0.25]] as [number, number, number][]) {
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vel * amp, t + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          this.osc('sine', 1180 * ratio, t, t + decay + 0.05).connect(g).connect(dest);
        }
        this.hiss(dest, t, vel * 0.25, 0.03, 'bandpass', 5000, 1.5);
        break;
      case 'spiccato':
        // Bowed short and hard: the engine of a driving ostinato.
        for (const n of notes) {
          const len = Math.min(dur * 0.85, 0.22);
          const { g, end } = this.envelope(t, vel * 0.2, 0.004, len * 0.4, len * 0.8);
          const lp = this.filter('lowpass', 4200, 1.2);
          lp.frequency.setValueAtTime(4800, t);
          lp.frequency.exponentialRampToValueAtTime(1500, t + 0.09);
          lp.connect(g).connect(dest);
          this.osc('sawtooth', mtof(n), t, end, -7).connect(lp);
          this.osc('sawtooth', mtof(n), t, end, 7).connect(lp);
        }
        break;
      case 'pizz':
        for (const n of notes) this.pluck(dest, t, mtof(n), vel * 0.9, 0.45, 2200, true);
        break;
      case 'horns':
        // An ensemble: three detuned voices, the filter swelling open on the attack, a little growl.
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.12, 0.035, dur * 0.92, 0.22);
          const lp = this.filter('lowpass', 600, 1.4);
          lp.frequency.setValueAtTime(600, t);
          lp.frequency.linearRampToValueAtTime(2800 * (0.6 + vel * 0.5), t + 0.07);
          lp.frequency.exponentialRampToValueAtTime(1500, t + 0.45);
          const drive = this.shaper(1.8);
          lp.connect(drive).connect(g).connect(dest);
          for (const d of [-11, 0, 10]) this.osc('sawtooth', mtof(n), t, end, d).connect(lp);
        }
        break;
      case 'power': {
        // Saturated power chords: a fifth and an octave below, through fuzz.
        const fuzz = this.shaper(7);
        const tone = this.filter('lowpass', 3300, 0.9);
        const low = this.filter('highpass', 90);
        const len = dur * 0.94;
        const { g, end } = this.envelope(t, vel * 0.11, 0.004, len, 0.07);
        fuzz.connect(tone).connect(low).connect(g).connect(dest);
        for (const n of notes) {
          this.osc('sawtooth', mtof(n), t, end, -6).connect(fuzz);
          this.osc('sawtooth', mtof(n), t, end, 6).connect(fuzz);
        }
        break;
      }
      case 'sub':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.5, 0.006, dur * 0.85, 0.08);
          const o = this.osc('sine', mtof(n), t, end);
          o.connect(this.shaper(1.4)).connect(g).connect(dest);
          // A touch of edge so it reads on small speakers.
          const edge = this.ctx.createGain();
          edge.gain.value = 0.12;
          this.osc('sawtooth', mtof(n), t, end).connect(this.filter('lowpass', 420)).connect(edge).connect(g);
        }
        break;
      case 'pad':
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.07, 0.6, dur, 1);
          const lp = this.filter('lowpass', 1150, 0.5);
          lp.connect(g).connect(dest);
          for (const d of [-12, 12]) this.osc('sawtooth', mtof(n), t, end, d).connect(lp);
        }
        break;
      case 'boom':
        // A cinematic impact: a deep falling thud and a rumble.
        this.sweep(dest, t, vel * 1.1, 95, 26, 0.5, 2.2, 'sine', 1.3);
        this.hiss(dest, t, vel * 0.35, 1.1, 'lowpass', 260, 0.7, 0.005);
        break;
      case 'chant':
        // A choir that can bark short syllables: a quick onset, a consonant, three formants.
        for (const n of notes) {
          const { g, end } = this.envelope(t, vel * 0.075, 0.025, dur * 0.88, Math.min(0.14, dur * 0.5));
          const mix = this.ctx.createGain();
          for (const [f, q, a] of [[650, 4, 1], [1080, 5, 0.8], [2450, 6, 0.35]] as [number, number, number][]) {
            const bp = this.filter('bandpass', f, q);
            const level = this.ctx.createGain();
            level.gain.value = a;
            bp.connect(level).connect(mix);
            for (const d of [-9, 0, 8]) this.osc('sawtooth', mtof(n), t, end, d + (n % 2 ? 2 : -2)).connect(bp);
          }
          mix.connect(this.filter('lowpass', 3400)).connect(g).connect(dest);
        }
        if (notes.length) this.hiss(dest, t, vel * 0.06, 0.035, 'highpass', 3200);
        break;
      case 'piano':
        for (const n of notes) {
          const f = mtof(n);
          // Lower notes ring longer; partials fade faster the higher they are.
          const ring = Math.max(0.5, 2.6 - (n - 48) * 0.035);
          const stop = Math.min(ring, dur + 0.25);
          for (const [h, amp, k] of [[1, 0.3, 1], [2, 0.14, 0.7], [3, 0.07, 0.5], [4, 0.035, 0.35], [5.02, 0.02, 0.25]] as [number, number, number][]) {
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vel * amp, t + 0.003);
            g.gain.exponentialRampToValueAtTime(vel * amp * 0.35, t + 0.12 * k);
            g.gain.exponentialRampToValueAtTime(0.0001, t + stop * k + 0.05);
            this.osc(h === 1 ? 'triangle' : 'sine', f * h, t, t + stop * k + 0.1, h * 1.5).connect(g).connect(dest);
          }
        }
        if (notes.length) this.hiss(dest, t, vel * 0.05, 0.02, 'bandpass', 2400, 1);
        break;
      case 'timpani':
        for (const n of notes.length ? notes : [43]) {
          const o = this.osc('sine', mtof(n) * 1.03, t, t + 1.3);
          o.frequency.exponentialRampToValueAtTime(mtof(n), t + 0.08);
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(vel * 0.75, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
          o.connect(g).connect(dest);
          const o2 = this.osc('sine', mtof(n) * 1.5, t, t + 0.6);
          const g2 = this.ctx.createGain();
          g2.gain.setValueAtTime(vel * 0.2, t);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          o2.connect(g2).connect(dest);
        }
        this.hiss(dest, t, vel * 0.25, 0.08, 'lowpass', 900);
        break;
      case 'violin':
      case 'cello':
        for (const n of notes) this.bowed(dest, t, n, dur, vel, opts.from, inst === 'violin');
        break;
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

  /** A bowed solo string: a bright violin or a dark cello, with vibrato and slides. */
  private bowed(dest: AudioNode, t: number, note: number, dur: number, vel: number, from: number | undefined, violin: boolean): void {
    const f = mtof(note);
    const { g, end } = this.envelope(t, vel * (violin ? 0.15 : 0.2), violin ? 0.05 : 0.08, dur * 0.96, violin ? 0.16 : 0.22);
    const body = this.filter('lowpass', violin ? 5200 : 2300, 0.8);
    const bridge = this.ctx.createBiquadFilter();
    bridge.type = 'peaking';
    bridge.frequency.value = violin ? 2900 : 1100;
    bridge.Q.value = 1.6;
    bridge.gain.value = 6;
    body.connect(bridge).connect(g).connect(dest);
    const oscs = [this.osc('sawtooth', f, t, end, -4), this.osc('sawtooth', f, t, end, 4)];
    for (const o of oscs) {
      if (from !== undefined && from !== note) {
        o.frequency.setValueAtTime(mtof(from), t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      }
      o.connect(body);
    }
    const lfo = this.osc('sine', violin ? 5.9 : 5.2, t, end);
    const depth = this.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * (violin ? 0.007 : 0.005), t + Math.min(0.4, dur * 0.5) + 0.05);
    lfo.connect(depth);
    for (const o of oscs) depth.connect(o.frequency);
    // Bow noise on the attack.
    this.hiss(g, t, vel * 0.04, 0.07, 'bandpass', violin ? 4000 : 1800, 1.2);
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
