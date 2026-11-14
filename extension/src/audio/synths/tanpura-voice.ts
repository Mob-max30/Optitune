/**
 * Earth Jukebox (EJB) — Acoustic Tanpura Synthesizer Voice
 *
 * Synthesizes an authentic 4-string Indian Tanpura drone providing the fundamental
 * acoustic foundation (Sa-Pa drone) with rich jawari buzzing overtones.
 *
 * 4-String Strumming Cycle:
 * - String 1: Pa (or Ma) — Fifth/Fourth above tonic (e.g. G2 or F2)
 * - String 2: Sa — Middle tonic (e.g. C3)
 * - String 3: Sa — Middle tonic with subtle jawari acoustic beating (+1.5 Hz)
 * - String 4: Kharaj Sa — Deep bass tonic (e.g. C2)
 *
 * Strums sequentially at a meditative cadence, grounding the planetary dataset in acoustic resonance.
 *
 * Authored by Pranav K & Ujwal A.
 */

import { midiToFrequency } from '../scales';

export class TanpuraVoice {
  private ctx: AudioContext;
  private outputNode: GainNode;
  private isStarted = false;
  private timerId: number | null = null;
  private rootMidi = 48; // C3 (Middle Sa)
  private hasPancham = true; // Pa (Fifth) vs Ma (Fourth)
  private currentStringIndex = 0;
  private masterGain = 0.28;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.outputNode = ctx.createGain();
    this.outputNode.gain.setValueAtTime(0.0, ctx.currentTime);
    this.outputNode.connect(destination);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    this.outputNode.gain.setTargetAtTime(this.masterGain, this.ctx.currentTime, 0.1);
    this.scheduleNextPluck();
  }

  stop(): void {
    this.isStarted = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.outputNode.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
  }

  setRootMidi(midi: number, useMadhyam = false): void {
    this.rootMidi = midi;
    this.hasPancham = !useMadhyam;
  }

  setGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(0.6, gain));
    if (this.isStarted) {
      this.outputNode.gain.setTargetAtTime(this.masterGain, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Strums individual Tanpura strings with authentic jawari harmonic overtones.
   */
  private pluckString(stringNum: number): void {
    if (!this.isStarted || this.ctx.state === 'closed') return;

    const now = this.ctx.currentTime;
    let freq = midiToFrequency(this.rootMidi);

    switch (stringNum) {
      case 0: // String 1: Pa (Fifth below) or Ma
        freq = this.hasPancham
          ? midiToFrequency(this.rootMidi - 5) // Pa (G2 if Sa is C3)
          : midiToFrequency(this.rootMidi - 7); // Ma (F2 if Sa is C3)
        break;
      case 1: // String 2: Sa (Middle)
        freq = midiToFrequency(this.rootMidi);
        break;
      case 2: // String 3: Sa (Middle) with +1.5 Hz jawari detune for acoustic shimmer
        freq = midiToFrequency(this.rootMidi) + 1.5;
        break;
      case 3: // String 4: Kharaj Sa (Deep Bass octave)
        freq = midiToFrequency(this.rootMidi - 12);
        break;
    }

    // 1. Dual Oscillators for Jawari string buzz (Sawtooth body + Triangle overtone)
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now); // First overtone shimmer

    // 2. Jawari resonant filter (Bandpass highlighting 1.2 kHz - 2.8 kHz jawari bridge buzz)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 4.5, now);
    filter.Q.setValueAtTime(2.2, now);

    // 3. String gain envelope (quick soft pluck attack, long natural acoustic decay over 3.2s)
    const stringGain = this.ctx.createGain();
    const peakGain = stringNum === 3 ? 0.38 : 0.28; // Kharaj Sa gets extra deep resonance
    stringGain.gain.setValueAtTime(0.001, now);
    stringGain.gain.linearRampToValueAtTime(peakGain, now + 0.04);
    stringGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

    // Audio routing
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(stringGain);
    stringGain.connect(this.outputNode);

    osc1.start(now);
    osc2.start(now);

    const stopTime = now + 3.3;
    osc1.stop(stopTime);
    osc2.stop(stopTime);

    setTimeout(() => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        stringGain.disconnect();
      } catch {
        // Disconnected
      }
    }, 3400);
  }

  private scheduleNextPluck(): void {
    if (!this.isStarted) return;

    this.pluckString(this.currentStringIndex);
    this.currentStringIndex = (this.currentStringIndex + 1) % 4;

    // Strum cadence: 1.1 seconds between strings (total 4.4s full Tanpura cycle)
    this.timerId = window.setTimeout(() => {
      this.scheduleNextPluck();
    }, 1100);
  }

  dispose(): void {
    this.stop();
    try {
      this.outputNode.disconnect();
    } catch {
      // Disconnected
    }
  }
}
