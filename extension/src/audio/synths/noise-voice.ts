/**
 * Earth Jukebox (EJB) — Textural Noise & Layer Synthesizer Voice
 *
 * Synthesizes filtered particulate and fluid motion soundscapes:
 * - GEOS Aerosols (smoke, dust, sea salt layers)
 * - Ocean currents, boundary eddies, and atmospheric wind wash
 *
 * Authored by Pranav K.
 */

export class TextureNoiseVoice {
  private ctx: AudioContext;
  private noiseNode: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode;
  private gainNode: GainNode;
  private panner: StereoPannerNode | null = null;
  private isPlaying = false;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.setValueAtTime(800, ctx.currentTime);
    this.filter.Q.setValueAtTime(2.5, ctx.currentTime);

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.0, ctx.currentTime);

    if (typeof ctx.createStereoPanner === 'function') {
      this.panner = ctx.createStereoPanner();
      this.panner.pan.setValueAtTime(0.0, ctx.currentTime);
      this.filter.connect(this.gainNode);
      this.gainNode.connect(this.panner);
      this.panner.connect(destination);
    } else {
      this.filter.connect(this.gainNode);
      this.gainNode.connect(destination);
    }
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;

    // Generate 3-second looped white/pink noise buffer
    const bufferSize = this.ctx.sampleRate * 3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Gentle pink-noise filtering
      b0 = 0.99765 * b0 + white * 0.0990460;
      b1 = 0.96300 * b1 + white * 0.1416500;
      b2 = 0.57000 * b2 + white * 0.8665000;
      data[i] = (b0 + b1 + b2 + white * 0.5362) * 0.15;
    }

    this.noiseNode = this.ctx.createBufferSource();
    this.noiseNode.buffer = buffer;
    this.noiseNode.loop = true;
    this.noiseNode.connect(this.filter);
    this.noiseNode.start(this.ctx.currentTime);
  }

  /**
   * Update texture parameters based on motion, particulate coverage, or specific aerosol layers.
   */
  update(
    intensity: number,
    motion: number,
    pan = 0.0,
    layers?: Record<string, number>,
    timeConstant = 0.08
  ): void {
    const now = this.ctx.currentTime;

    // Center frequency shifts based on particulate type or motion
    // Smoke/dust = lower frequency (400-900 Hz)
    // Sea salt/spray = higher frequency (1400-3500 Hz)
    let centerFreq = 500 + motion * 1800;

    if (layers) {
      if ((layers.seaSalt ?? 0) > 0.2) {
        centerFreq = 2200;
      } else if ((layers.dust ?? 0) > 0.2) {
        centerFreq = 650;
      } else if ((layers.smoke ?? 0) > 0.2) {
        centerFreq = 950;
      }
    }

    const safeGain = Math.max(0, Math.min(0.50, intensity * 0.6));
    this.gainNode.gain.setTargetAtTime(safeGain, now, timeConstant);
    this.filter.frequency.setTargetAtTime(centerFreq, now, timeConstant);

    if (this.panner) {
      this.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), now, timeConstant);
    }
  }

  fadeTo(targetGain: number, duration = 0.1): void {
    const now = this.ctx.currentTime;
    this.gainNode.gain.setTargetAtTime(Math.max(0, targetGain), now, duration / 3);
  }

  dispose(): void {
    try {
      if (this.noiseNode) {
        this.noiseNode.stop();
        this.noiseNode.disconnect();
      }
      this.filter.disconnect();
      this.gainNode.disconnect();
      if (this.panner) this.panner.disconnect();
    } catch {
      // Disconnected
    }
  }
}
