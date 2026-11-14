/**
 * Earth Jukebox (EJB) — Lead Synthesizer Voice
 *
 * Primary physical measurement voice driven by dataValue / brightness.
 * Uses dual-detuned oscillators through a resonant BiquadFilter and StereoPanner.
 *
 * Authored by Pranav K.
 */

export class LeadVoice {
  private ctx: AudioContext;
  private osc1: OscillatorNode;
  private osc2: OscillatorNode;
  private filter: BiquadFilterNode;
  private gainNode: GainNode;
  private pannerNode: StereoPannerNode | null = null;
  private outputNode: AudioNode;
  private isStarted = false;
  private lastNoteFreq = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.osc1 = ctx.createOscillator();
    this.osc2 = ctx.createOscillator();
    this.filter = ctx.createBiquadFilter();
    this.gainNode = ctx.createGain();

    // Default configuration
    this.osc1.type = 'triangle';
    this.osc2.type = 'sine';
    this.osc2.detune.value = 7; // subtle chorus spread (+7 cents)

    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(1200, ctx.currentTime);
    this.filter.Q.setValueAtTime(2.0, ctx.currentTime);

    this.gainNode.gain.setValueAtTime(0.0, ctx.currentTime);

    // Stereo panning support
    if (typeof ctx.createStereoPanner === 'function') {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0.0, ctx.currentTime);
      this.outputNode = this.pannerNode;
      this.pannerNode.connect(destination);
    } else {
      this.outputNode = this.gainNode;
      this.gainNode.connect(destination);
    }

    // Audio routing
    this.osc1.connect(this.filter);
    this.osc2.connect(this.filter);
    this.filter.connect(this.gainNode);
    if (this.pannerNode) {
      this.gainNode.connect(this.pannerNode);
    }
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    const now = this.ctx.currentTime;
    this.osc1.start(now);
    this.osc2.start(now);
  }

  setOscillatorType(type: OscillatorType): void {
    this.osc1.type = type;
    this.osc2.type = type === 'sawtooth' ? 'triangle' : 'sine';
  }

  setFilterType(type: BiquadFilterType): void {
    this.filter.type = type;
  }

  /**
   * Updates frequency, gain, stereo pan, and filter cutoff smoothly.
   */
  update(
    frequency: number,
    gain: number,
    pan: number,
    cutoff: number,
    resonance = 2.0,
    timeConstant = 0.05,
    bypassSmoothing = false,
    quantizeMode = false
  ): void {
    const now = this.ctx.currentTime;
    const safeFreq = Math.max(20, Math.min(10000, frequency));
    const safeGain = Math.max(0, Math.min(1.0, gain));
    const safePan = Math.max(-1.0, Math.min(1.0, pan));
    const safeCutoff = Math.max(100, Math.min(18000, cutoff));

    if (quantizeMode && Math.abs(safeFreq - this.lastNoteFreq) > 3) {
      this.lastNoteFreq = safeFreq;
      // Articulate new musical note with snappy attack & warm decay
      try {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(0.04, now);
        this.gainNode.gain.linearRampToValueAtTime(safeGain, now + 0.025);
        this.gainNode.gain.setTargetAtTime(safeGain * 0.85, now + 0.04, 0.15);
      } catch {
        // Fallback for mocks
        this.gainNode.gain.setValueAtTime(safeGain, now);
      }
    }

    if (bypassSmoothing) {
      this.osc1.frequency.setValueAtTime(safeFreq, now);
      this.osc2.frequency.setValueAtTime(safeFreq, now);
      this.gainNode.gain.setValueAtTime(safeGain, now);
      this.filter.frequency.setValueAtTime(safeCutoff, now);
      this.filter.Q.setValueAtTime(resonance, now);
      if (this.pannerNode) {
        this.pannerNode.pan.setValueAtTime(safePan, now);
      }
    } else {
      this.osc1.frequency.setTargetAtTime(safeFreq, now, timeConstant);
      this.osc2.frequency.setTargetAtTime(safeFreq, now, timeConstant);
      this.gainNode.gain.setTargetAtTime(safeGain, now, timeConstant);
      this.filter.frequency.setTargetAtTime(safeCutoff, now, timeConstant);
      this.filter.Q.setTargetAtTime(resonance, now, timeConstant);
      if (this.pannerNode) {
        this.pannerNode.pan.setTargetAtTime(safePan, now, timeConstant);
      }
    }
  }

  fadeTo(targetGain: number, duration = 0.1): void {
    const now = this.ctx.currentTime;
    this.gainNode.gain.setTargetAtTime(Math.max(0, targetGain), now, duration / 3);
  }

  dispose(): void {
    try {
      this.osc1.stop();
      this.osc2.stop();
      this.osc1.disconnect();
      this.osc2.disconnect();
      this.filter.disconnect();
      this.gainNode.disconnect();
      if (this.pannerNode) {
        this.pannerNode.disconnect();
      }
    } catch {
      // Audio nodes already stopped or disposed
    }
  }
}
