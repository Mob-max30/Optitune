/**
 * Earth Jukebox (EJB) — Indian Classical Melodic Swara Voice (Bansuri & Sitar)
 *
 * Sings the authentic swara phrases of classical Indian Raagas:
 * - Meend (Continuous vocal pitch glide / portamento between swaras)
 * - Gamaka ornamentation (microtonal oscillation around key swaras like Vadi)
 * - Timbres: Bamboo Bansuri (flute) or Plucked Sitar with jawari harmonics
 * - Direct scientific data mapping: Physical variables traverse Mandra to Taar Saptak
 *
 * Authored by Pranav K & Ujwal A for NASA Space Apps Challenge 2026.
 */

import { RaagaProfile, SwaraName, quantizeToRaagaSwara, RAAGA_PROFILES } from '../raagas';

export class IndianMelodicVoice {
  private ctx: AudioContext;
  private osc1: OscillatorNode;
  private osc2: OscillatorNode;
  private filter: BiquadFilterNode;
  private gainNode: GainNode;
  private pannerNode: StereoPannerNode | null = null;
  private isStarted = false;
  private activeRaaga: RaagaProfile = RAAGA_PROFILES['gedi-forest-height'];
  private rootMidi = 48; // C3 (Sa)
  private currentSwara: SwaraName = 'S';
  private currentFrequency = 130.81;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.osc1 = ctx.createOscillator();
    this.osc2 = ctx.createOscillator();
    this.filter = ctx.createBiquadFilter();
    this.gainNode = ctx.createGain();

    // Default configuration (Bansuri)
    this.osc1.type = 'triangle';
    this.osc2.type = 'sine';
    this.osc2.detune.value = 5; // Subtle natural chorus

    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1600, ctx.currentTime);
    this.filter.Q.setValueAtTime(1.8, ctx.currentTime);

    this.gainNode.gain.setValueAtTime(0.0, ctx.currentTime);

    if (typeof ctx.createStereoPanner === 'function') {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0.0, ctx.currentTime);
      this.filter.connect(this.gainNode);
      this.gainNode.connect(this.pannerNode);
      this.pannerNode.connect(destination);
    } else {
      this.filter.connect(this.gainNode);
      this.gainNode.connect(destination);
    }

    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    const now = this.ctx.currentTime;
    this.osc1.start(now);
    this.osc2.start(now);
  }

  setRaaga(raaga: RaagaProfile): void {
    this.activeRaaga = raaga;
    this.setTimbre(raaga.timbre);
  }

  setRootMidi(midi: number): void {
    this.rootMidi = midi;
  }

  setTimbre(timbre: 'bansuri' | 'sitar' | 'sarod' | 'veena' | 'esraj'): void {
    if (timbre === 'sitar') {
      // Sitar: Sawtooth body + bright jawari bridge resonance
      this.osc1.type = 'sawtooth';
      this.osc2.type = 'triangle';
      this.filter.type = 'bandpass';
      this.filter.frequency.setTargetAtTime(2400, this.ctx.currentTime, 0.05);
      this.filter.Q.setTargetAtTime(3.2, this.ctx.currentTime, 0.05);
    } else {
      // Bansuri (Bamboo flute): Warm triangle + sine with open lowpass breath
      this.osc1.type = 'triangle';
      this.osc2.type = 'sine';
      this.filter.type = 'lowpass';
      this.filter.frequency.setTargetAtTime(1800, this.ctx.currentTime, 0.05);
      this.filter.Q.setTargetAtTime(1.5, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Silences the melodic voice immediately.
   */
  silence(): void {
    if (this.ctx.state !== 'closed') {
      this.gainNode.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Updates melodic phrase in real time from normalized scientific data [0.0, 1.0].
   * Glides gracefully between swaras via Meend.
   */
  update(
    normalizedValue: number,
    gain: number,
    pan = 0.0,
    motion = 0.04
  ): { frequency: number; swara: SwaraName; midiNote: number } {
    const now = this.ctx.currentTime;

    // Organic phrasing contour: Traverses Arohana and Avarohana modulated by spatial pan, time, and motion
    // Prevents static drone even when input video values are stable!
    const phraseLaya = 1.0 + motion * 3.0; // Speeds up phrase progression with visual motion
    const phraseContour = Math.sin(now * phraseLaya + pan * 1.8) * 0.22;
    const dynamicValue = Math.max(0.0, Math.min(1.0, normalizedValue + phraseContour));

    const quantized = quantizeToRaagaSwara(dynamicValue, this.activeRaaga, this.rootMidi);
    const isNewSwara = quantized.swara !== this.currentSwara;

    this.currentSwara = quantized.swara;
    this.currentFrequency = quantized.frequency;

    // Meend duration: 60ms to 120ms depending on distance
    const meendDuration = isNewSwara ? 0.075 : 0.035;

    // Microtonal Gamaka vibrato on key Vadi/Samvadi swaras
    const isVadi = quantized.swara === this.activeRaaga.vadi;
    const gamakaVibrato = isVadi ? (Math.sin(now * 12) * 2.5) : 0;
    const targetFreq = quantized.frequency + gamakaVibrato;

    this.osc1.frequency.setTargetAtTime(targetFreq, now, meendDuration);
    this.osc2.frequency.setTargetAtTime(targetFreq, now, meendDuration);

    // On new swara attack: Pluck articulate envelope if Sitar, gentle breath swell if Bansuri
    const safeGain = Math.max(0.08, Math.min(0.65, gain));
    if (isNewSwara) {
      if (this.activeRaaga.timbre === 'sitar') {
        // Sitar pluck: Sharp transient attack
        try {
          this.gainNode.gain.cancelScheduledValues(now);
          this.gainNode.gain.setValueAtTime(0.05, now);
          this.gainNode.gain.linearRampToValueAtTime(safeGain, now + 0.02);
          this.gainNode.gain.exponentialRampToValueAtTime(safeGain * 0.70, now + 0.18);
        } catch {
          this.gainNode.gain.setValueAtTime(safeGain, now);
        }
      } else {
        // Bansuri breath: Smooth linear swell
        this.gainNode.gain.setTargetAtTime(safeGain, now, 0.04);
      }
    } else {
      this.gainNode.gain.setTargetAtTime(safeGain, now, 0.06);
    }

    if (this.pannerNode) {
      this.pannerNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, 0.05);
    }

    // Filter responds to motion / velocity
    const filterFreq = 1200 + motion * 3200;
    this.filter.frequency.setTargetAtTime(Math.min(12000, filterFreq), now, 0.05);

    return {
      frequency: Math.round(quantized.frequency),
      swara: quantized.swara,
      midiNote: quantized.midiNote
    };
  }

  getCurrentSwara(): SwaraName {
    return this.currentSwara;
  }

  getCurrentRaaga(): RaagaProfile {
    return this.activeRaaga;
  }

  dispose(): void {
    try {
      this.osc1.stop();
      this.osc2.stop();
      this.osc1.disconnect();
      this.osc2.disconnect();
      this.filter.disconnect();
      this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    } catch {
      // Disconnected
    }
  }
}
