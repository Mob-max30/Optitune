/**
 * Earth Jukebox (EJB) — Percussion & Transient Synthesizer Voice
 *
 * Synthesizes snappy, localized acoustic percussion transients for discrete phenomena:
 * - ISS Lightning strikes (instant localized electrical discharges)
 * - Decadal night lights electrification bursts
 *
 * Authored by Pranav K.
 */

import type { DetectedEvent } from '../../contract/types';

export class PercussionVoice {
  private ctx: AudioContext;
  private destination: AudioNode;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  /**
   * Triggers a localized percussive hit for a detected visual flash/bright-spot event.
   */
  trigger(event: DetectedEvent, masterVolume = 1.0): void {
    const now = this.ctx.currentTime;
    const intensity = Math.max(0.1, Math.min(1.0, event.intensity));

    // Base pitch depends on event type and intensity
    const baseFreq = event.type === 'flash'
      ? 900 + intensity * 1200 // Crisp lightning snap (900-2100 Hz)
      : 500 + intensity * 600; // Softer urban bright-spot thud (500-1100 Hz)

    const osc = this.ctx.createOscillator();
    osc.type = event.type === 'flash' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(baseFreq, now);
    // Rapid pitch drop creates percussive membrane / strike feel
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);

    // Bandpass filter for acoustic crispness
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.2, now);
    filter.Q.setValueAtTime(3.0, now);

    // Snappy exponential gain envelope (0ms attack, 70ms release)
    const gainNode = this.ctx.createGain();
    const peakGain = Math.max(0.01, Math.min(0.8, 0.45 * intensity * masterVolume));
    gainNode.gain.setValueAtTime(peakGain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    // Stereo Panning aligned with strike X coordinate [0.0 (West) to 1.0 (East)]
    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      panner = this.ctx.createStereoPanner();
      const pan = Math.max(-1.0, Math.min(1.0, (event.x - 0.5) * 2.0));
      panner.pan.setValueAtTime(pan, now);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.destination);
    } else {
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.destination);
    }

    osc.start(now);
    osc.stop(now + 0.09);

    // Auto cleanup nodes after note finishes
    setTimeout(() => {
      try {
        osc.disconnect();
        filter.disconnect();
        gainNode.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Disconnected
      }
    }, 120);
  }

  /**
   * Triggers a musical drum beat element (kick, snare, hihat) for song accompaniment.
   */
  triggerBeat(type: 'kick' | 'snare' | 'hihat', intensity = 0.5, masterVolume = 1.0): void {
    const now = this.ctx.currentTime;
    const gain = Math.max(0.01, Math.min(0.65, intensity * masterVolume * 0.45));

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.08);

      gainNode.gain.setValueAtTime(gain * 1.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gainNode);
      gainNode.connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.13);
      setTimeout(() => {
        try { osc.disconnect(); gainNode.disconnect(); } catch {}
      }, 150);
    } else if (type === 'snare') {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(350, now);

      gainNode.gain.setValueAtTime(gain * 0.85, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.10);
      setTimeout(() => {
        try { osc.disconnect(); filter.disconnect(); gainNode.disconnect(); } catch {}
      }, 120);
    } else {
      // Hi-hat / tick
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gainNode = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(7500, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(6500, now);
      filter.Q.setValueAtTime(4, now);

      gainNode.gain.setValueAtTime(gain * 0.35, now);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.destination);
      osc.start(now);
      osc.stop(now + 0.045);
      setTimeout(() => {
        try { osc.disconnect(); filter.disconnect(); gainNode.disconnect(); } catch {}
      }, 80);
    }
  }
}
