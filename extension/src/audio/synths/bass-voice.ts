/**
 * Earth Jukebox (EJB) — Sub-Bass & Harmonic Anchor Synthesizer Voice
 *
 * Provides a deep, warm sub-bass foundation (35 Hz - 140 Hz) that anchors
 * the physical scientific phenomenon in space and time.
 *
 * Implements dual-oscillator sub-synthesis:
 * - Sub-fundamental: Pure sub-octave sine wave
 * - Harmonic overtone: Warm saturation triangle wave
 * - Lowpass ladder filter (80 Hz - 380 Hz)
 * - Rhythmic groove pulsing tied to rate-of-change and temporal dynamics
 *
 * Authored by Pranav K & Ujwal A.
 */

export class BassVoice {
  private ctx: AudioContext;
  private oscSub: OscillatorNode;
  private oscOver: OscillatorNode;
  private filter: BiquadFilterNode;
  private gainNode: GainNode;
  private pannerNode: StereoPannerNode | null = null;
  private isStarted = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.oscSub = ctx.createOscillator();
    this.oscOver = ctx.createOscillator();
    this.filter = ctx.createBiquadFilter();
    this.gainNode = ctx.createGain();

    this.oscSub.type = 'sine';
    this.oscOver.type = 'triangle';

    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(220, ctx.currentTime);
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

    this.oscSub.connect(this.filter);
    this.oscOver.connect(this.filter);
  }

  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    const now = this.ctx.currentTime;
    this.oscSub.start(now);
    this.oscOver.start(now);
  }

  /**
   * Updates sub-bass frequency and presence smoothly in real time.
   */
  update(
    fundamentalFrequency: number,
    gain: number,
    cutoff = 220,
    timeConstant = 0.08
  ): void {
    const now = this.ctx.currentTime;
    const baseFreq = Math.max(35, Math.min(180, fundamentalFrequency));
    const safeGain = Math.max(0, Math.min(0.55, gain));
    const safeCutoff = Math.max(70, Math.min(480, cutoff));

    this.oscSub.frequency.setTargetAtTime(baseFreq, now, timeConstant);
    this.oscOver.frequency.setTargetAtTime(baseFreq * 2, now, timeConstant);
    this.filter.frequency.setTargetAtTime(safeCutoff, now, timeConstant);
    this.gainNode.gain.setTargetAtTime(safeGain, now, timeConstant);
  }

  /**
   * Triggers a rhythmic bass pulse with dynamic envelope on musical beats.
   */
  pulse(fundamentalFrequency: number, peakGain = 0.40, duration = 0.25): void {
    const now = this.ctx.currentTime;
    const baseFreq = Math.max(35, Math.min(180, fundamentalFrequency));
    this.oscSub.frequency.setValueAtTime(baseFreq, now);
    this.oscOver.frequency.setValueAtTime(baseFreq * 2, now);

    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.setValueAtTime(peakGain, now);
    this.gainNode.gain.exponentialRampToValueAtTime(0.005, now + duration);
  }

  fadeTo(targetGain: number, duration = 0.1): void {
    const now = this.ctx.currentTime;
    this.gainNode.gain.setTargetAtTime(Math.max(0, targetGain), now, duration / 3);
  }

  dispose(): void {
    try {
      this.oscSub.stop();
      this.oscOver.stop();
      this.oscSub.disconnect();
      this.oscOver.disconnect();
      this.filter.disconnect();
      this.gainNode.disconnect();
      if (this.pannerNode) this.pannerNode.disconnect();
    } catch {
      // Audio nodes already stopped or disposed
    }
  }
}
