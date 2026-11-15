/**
 * Earth Jukebox (EJB) — Ambient Pad & Regional Multi-Voice Synthesizer
 *
 * Implements a 4-voice polyphonic harmonic synthesizer representing the 4 latitudinal
 * rows of the 4x8 spatial grid matrix.
 *
 * Dynamically modulated in real time by regional row energies, dominant color hue, and motion.
 *
 * Authored by Pranav K & Ujwal A.
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
      osc.frequency.setValueAtTime(midiToFrequency(48), ctx.currentTime);

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
   * Updates regional voices in real time based on live row energies and dominant color hue.
   * Root musical key transposes dynamically with the video's live color temperature!
   *
   * @param rowEnergies Array of 4 floats representing row activity [Row 0 (N) .. Row 3 (S)]
   * @param hue Normalized color hue [0.0, 1.0] to modulate harmonic key and brightness
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
    const safeMasterGain = Math.max(0, Math.min(0.55, masterPadGain * 0.5));
    this.masterGain.gain.setTargetAtTime(safeMasterGain, now, timeConstant);

    // Dynamically shift root note key based on color temperature (Hue):
    // Cool ocean blues (0.55-0.70) -> deep C3 / D3
    // Forest greens (0.25-0.45) -> E3 / F3
    // Thermal reds/oranges (0.0-0.15) -> A3 / G3
    const rootMidi = 45 + Math.floor(hue * 14); // 45 (A2) to 59 (B3)

    // Harmonic chord voicing across the 4 latitudinal rows:
    // Row 0 = North (Soprano, octave + fifth)
    // Row 1 = Mid-North (Alto, octave)
    // Row 2 = Mid-South (Tenor, fifth)
    // Row 3 = South (Bass fundamental, root)
    const chordIntervals = [19, 12, 7, 0];

    for (let i = 0; i < 4; i++) {
      const voice = this.voices[i];
      const energy = rowEnergies[i] ?? 0.2;
      const targetMidi = rootMidi + chordIntervals[i];
      // Subtle pitch bend based on local regional density
      const targetFreq = midiToFrequency(targetMidi) * (0.95 + energy * 0.1);

      voice.osc.frequency.setTargetAtTime(targetFreq, now, timeConstant);

      // Volume of each voice directly tracks that specific row's visual brightness
      const voiceGain = Math.max(0.01, Math.min(0.45, energy * 0.6));
      voice.gain.gain.setTargetAtTime(voiceGain, now, timeConstant);
    }

    // Modulate filter cutoff with hue and energy
    const targetCutoff = 500 + hue * 1800 + masterPadGain * 1200;
    this.filter.frequency.setTargetAtTime(Math.min(12000, targetCutoff), now, timeConstant);
  }

  /**
   * Updates regional voices with specific chord MIDI notes across the 4 rows.
   */
  updateChord(
    chordMidis: [number, number, number, number],
    rowEnergies: number[],
    masterPadGain: number,
    timeConstant = 0.08
  ): void {
    const now = this.ctx.currentTime;
    const safeMasterGain = Math.max(0, Math.min(0.55, masterPadGain * 0.5));
    this.masterGain.gain.setTargetAtTime(safeMasterGain, now, timeConstant);

    for (let i = 0; i < 4; i++) {
      const voice = this.voices[i];
      const energy = rowEnergies[i] ?? 0.2;
      const targetFreq = midiToFrequency(chordMidis[i]);
      voice.osc.frequency.setTargetAtTime(targetFreq, now, timeConstant);
      const voiceGain = Math.max(0.02, Math.min(0.40, energy * 0.5 + 0.05));
      voice.gain.gain.setTargetAtTime(voiceGain, now, timeConstant);
    }

    const targetCutoff = 600 + masterPadGain * 1800;
    this.filter.frequency.setTargetAtTime(Math.min(12000, targetCutoff), now, timeConstant);
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
      // Ignore cleanup on already disconnected nodes
    }
  }
}
