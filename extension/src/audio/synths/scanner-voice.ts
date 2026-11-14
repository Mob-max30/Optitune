/**
 * Earth Jukebox (EJB) — Caldwell-73 Style Scanner Synthesizer Voice
 *
 * Implements NASA's conceptual sonification reference (Caldwell 73):
 * - Horizontal axis represents time: columns 0..31 are scanned sequentially from left to right.
 * - Vertical axis represents pitch: top (high latitude) = high frequency, bottom (low latitude) = low frequency.
 * - Profile brightness represents amplitude / volume.
 *
 * Authored by Pranav K.
 */

import { mapContinuousFrequency } from '../scales';
import type { SpatialProfile } from '../../contract/types';

export class ScannerVoice {
  private ctx: AudioContext;
  private destination: AudioNode;
  private currentColumn = 0;
  private timerId: number | null = null;
  private isRunning = false;
  private cachedProfile: SpatialProfile | null = null;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.destination = destination;
  }

  start(scanRateHz = 8): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentColumn = 0;

    const intervalMs = 1000 / scanRateHz;
    this.timerId = window.setInterval(() => {
      this.step();
    }, intervalMs);
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  updateProfile(profile?: SpatialProfile): void {
    if (profile && profile.cols && profile.cols.length > 0) {
      this.cachedProfile = profile;
    }
  }

  private step(): void {
    if (!this.cachedProfile || !this.cachedProfile.cols) return;

    const cols = this.cachedProfile.cols;
    const rows = this.cachedProfile.rows;
    const colCount = cols.length;

    if (colCount === 0) return;

    const colIdx = this.currentColumn % colCount;
    const colBrightness = cols[colIdx] ?? 0;
    this.currentColumn++;

    // Only sonify if column has audible scientific presence
    if (colBrightness < 0.05) return;

    const now = this.ctx.currentTime;
    // Map column index to stereo pan (-1.0 to +1.0)
    const pan = -1.0 + (colIdx / (colCount - 1)) * 2.0;

    // Pitch determination: if rows profile exists, choose the active row frequency
    let freq = 220; // default A3
    if (rows && rows.length > 0) {
      // Find row with peak brightness in this epoch
      let maxRowIdx = 0;
      let maxRowVal = -1;
      for (let r = 0; r < rows.length; r++) {
        if (rows[r] > maxRowVal) {
          maxRowVal = rows[r];
          maxRowIdx = r;
        }
      }
      // Top row (0) = highest frequency (880 Hz / A5)
      // Bottom row (rows.length-1) = lowest frequency (130 Hz / C3)
      const normalizedRow = 1.0 - (maxRowIdx / (rows.length - 1));
      freq = mapContinuousFrequency(normalizedRow, 130.81, 880.00, 'log');
    } else {
      freq = mapContinuousFrequency(colBrightness, 130.81, 880.00, 'log');
    }

    this.playTone(freq, colBrightness * 0.35, pan, now);
  }

  private playTone(freq: number, gain: number, pan: number, startTime: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.14);

    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, startTime);
      osc.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this.destination);
    } else {
      osc.connect(gainNode);
      gainNode.connect(this.destination);
    }

    osc.start(startTime);
    osc.stop(startTime + 0.15);

    setTimeout(() => {
      try {
        osc.disconnect();
        gainNode.disconnect();
        if (panner) panner.disconnect();
      } catch {
        // Disconnected
      }
    }, 180);
  }

  dispose(): void {
    this.stop();
  }
}
