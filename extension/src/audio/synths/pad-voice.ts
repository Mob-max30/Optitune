/**
 * Earth Jukebox (EJB) — Ambient Pad & Regional Multi-Voice Synthesizer
 *
 * Implements a 4-voice polyphonic harmonic synthesizer representing the 4 latitudinal
 * rows of the 4x8 spatial grid matrix.
 *
 * Authored by Pranav K.
 */

import { midiToFrequency } from '../scales';

interface VoiceNode {
  osc: OscillatorNode;
  gain: GainNode;
  panner: StereoPannerNode | null;
}

export class PadVoice {
  private ctx: AudioContext;
  private voices: VoiceNode[] = [];
  private masterGain: GainNode;
  private filter: BiquadFilterNode;
  private isStarted = false;

  // Root note frequencies for the 4 latitudinal bands (Row 0: North, Row 3: South)
  // Row 0 = North (Soprano, G4 / 67)
  // Row 1 = Mid-North (Alto, E4 / 64)
  // Row 2 = Mid-South (Tenor, C4 / 60)
  // Row 3 = South (Bass Fundamental, C3 / 48)
  private baseMidiNotes = [67, 64, 60, 48];

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1400, ctx.currentTime);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, ctx.currentTime);

    this.filter.connect(this.masterGain);
    this.masterGain.connect(destination);

    // Instantiate 4 voices for the 4 rows
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(midiToFrequency(this.baseMidiNotes[i]), ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0, ctx.currentTime);

      let panner: StereoPannerNode | null = null;
      if (typeof ctx.createStereoPanner === 'function') {
        panner = ctx.createStereoPanner();
        // Spread 4 voices across stereo field: left, mid-left, mid-right, right
        const panPos = -0.6 + (i * 0.4);
        panner.pan.setValueAtTime(panPos, ctx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.filter);
      } else {
        osc.connect(gain);
        gain.connect(this.filter);
      }

      this.voices.push({ osc, gain, panner });
    }
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    const now = this.ctx.currentTime;
    for (const voice of this.voices) {
      voice.osc.start(now);
    }
  }

  /**
   * Updates regional voices based on row energies and overall brightness/hue.
   *
   * @param rowEnergies Array of 4 floats representing row activity [Row 0 (N) .. Row 3 (S)]
   * @param hue Normalized color hue [0.0, 1.0] to modulate harmonic brightness
   * @param masterPadGain Overall pad presence [0.0, 1.0]
   * @param timeConstant Smoothing rate
   */
  update(
    rowEnergies: number[],
    hue: number,
    masterPadGain: number,
    timeConstant = 0.08
  ): void {
    const now = this.ctx.currentTime;
    const safeMasterGain = Math.max(0, Math.min(0.5, masterPadGain * 0.4));
    this.masterGain.gain.setTargetAtTime(safeMasterGain, now, timeConstant);

    // Modulate filter cutoff with hue (color temperature)
    // Cool blues (0.55-0.70) = darker oceanic filter (600 Hz)
    // Warm yellows/greens (0.10-0.40) = brighter open filter (2200 Hz)
    const filterFreq = 600 + (1.0 - Math.abs(hue - 0.25) * 1.5) * 1600;
    this.filter.frequency.setTargetAtTime(Math.max(400, filterFreq), now, timeConstant);

    for (let r = 0; r < 4; r++) {
      const energy = rowEnergies[r] ?? 0.2;
      const voice = this.voices[r];
      if (voice) {
        // Individual voice gain proportional to that row's scientific activity
        const voiceGain = Math.max(0, Math.min(0.4, energy * 0.35));
        voice.gain.gain.setTargetAtTime(voiceGain, now, timeConstant);
      }
    }
  }

  fadeTo(targetGain: number, duration = 0.1): void {
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(Math.max(0, targetGain), now, duration / 3);
  }

  dispose(): void {
    try {
      for (const voice of this.voices) {
        voice.osc.stop();
        voice.osc.disconnect();
        voice.gain.disconnect();
        if (voice.panner) voice.panner.disconnect();
      }
      this.filter.disconnect();
      this.masterGain.disconnect();
    } catch {
      // Already stopped
    }
  }
}
