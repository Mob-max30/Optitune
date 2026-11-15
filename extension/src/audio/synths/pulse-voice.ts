/**
 * Earth Jukebox (EJB) — Feature Pulse Voice
 *
 * Implements articulate note events (attacks and decays) for active visual features.
 *
 * Rather than a continuous flat drone, this voice provides rhythmic acoustic notes
 * whose pitch, stereo panning, and repetition rate track what is actively moving and
 * changing in the video.
 *
 * A listener with eyes closed can decipher:
 * - Feature position: stereo panning moves from Left to Right as features traverse
 * - Feature value: pitch reflects the local feature's physical measurement
 * - Video dynamics: note cadence accelerates with visual motion and changes
 */

export class FeaturePulseVoice {
  private ctx: AudioContext;
  private destination: AudioNode;
  private lastPulseTime = 0;
  private isDisposed = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  /**
   * Triggers an articulate acoustic note at the specified pitch and stereo location.
   *
   * @param freq Pitch in Hertz [40 - 5000]
   * @param gain Amplitude [0.0 - 1.0]
   * @param pan Stereo pan [-1.0 (West) to +1.0 (East)]
   * @param waveform Waveform character ('sine' for water/space, 'triangle' for land/canopy)
   * @param decayDuration Ring-down time in seconds (typically 0.12s to 0.35s)
   */
  trigger(
    freq: number,
    gain: number,
    pan = 0.0,
    waveform: OscillatorType = 'triangle',
    decayDuration = 0.22
  ): void {
    if (this.isDisposed || !this.ctx || this.ctx.state === 'closed') return;

    const now = this.ctx.currentTime;
    const safeFreq = Math.max(40, Math.min(6000, freq));
    const safeGain = Math.max(0.01, Math.min(1.0, gain));
    const safePan = Math.max(-1.0, Math.min(1.0, pan));
    const safeDecay = Math.max(0.08, Math.min(0.60, decayDuration));

    try {
      const osc = this.ctx.createOscillator();
      osc.type = waveform;
      osc.frequency.setValueAtTime(safeFreq, now);

      // Filter to keep tone warm, organic, and non-piercing
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(8000, safeFreq * 3.5 + 400), now);
      filter.Q.setValueAtTime(1.5, now);

      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(0.0001, now);
      // Crisp 5ms transient attack
      gainNode.gain.linearRampToValueAtTime(safeGain, now + 0.006);
      // Natural exponential acoustic decay
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + safeDecay);

      osc.connect(filter);
      filter.connect(gainNode);

      let panner: StereoPannerNode | null = null;
      if (typeof this.ctx.createStereoPanner === 'function') {
        panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(safePan, now);
        gainNode.connect(panner);
        panner.connect(this.destination);
      } else {
        gainNode.connect(this.destination);
      }

      osc.start(now);
      osc.stop(now + safeDecay + 0.02);

      const cleanupMs = Math.ceil((safeDecay + 0.05) * 1000);
      setTimeout(() => {
        try {
          osc.disconnect();
          filter.disconnect();
          gainNode.disconnect();
          if (panner) panner.disconnect();
        } catch {
          // Disconnected
        }
      }, cleanupMs);

      this.lastPulseTime = now;
    } catch {
      // AudioContext state error prevention
    }
  }

  getLastPulseTime(): number {
    return this.lastPulseTime;
  }

  dispose(): void {
    this.isDisposed = true;
  }
}
