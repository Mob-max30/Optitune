/**
 * OptiTone — Mock Frame Emitter
 *
 * Simulates real-time EJB visual metrics events (CustomEvent "ejb:frame")
 * on `window` for Pranav's synth engine development and testing,
 * without needing a live NASA video or Chrome extension.
 *
 * Usage:
 *   import { MockEjbEmitter } from './mock-emitter';
 *   const emitter = new MockEjbEmitter('gedi-forest-height');
 *   emitter.start();
 */

import type { EjbFramePayload, EjbReadyPayload, EjbStatePayload } from './extension/src/contract/types';
import presetsData from './extension/src/presets/visualizations.json';
import { clamp, round3 } from './extension/src/analysis/normalize';

export class MockEjbEmitter {
  private vizId: string;
  private intervalId: number | null = null;
  private tickHz: number;
  private t = 0;
  private frameIndex = 0;
  private isPlaying = false;

  constructor(vizId = 'gedi-forest-height', tickHz = 12) {
    this.vizId = vizId;
    this.tickHz = tickHz;
  }

  setVizId(vizId: string): void {
    this.vizId = vizId;
    this.emitReady();
  }

  start(): void {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.emitReady();
    this.emitState('playing');

    const intervalMs = 1000 / this.tickHz;
    this.intervalId = window.setInterval(() => {
      this.tick();
    }, intervalMs);

    console.log(`[Mock Emitter] Started synthetic stream for "${this.vizId}" at ${this.tickHz} Hz.`);
  }

  stop(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.emitState('paused');
    console.log('[Mock Emitter] Stopped.');
  }

  seek(newTimeSeconds: number): void {
    this.t = newTimeSeconds;
    this.emitState('seeked');
    this.tick(true);
  }

  private emitReady(): void {
    const preset = (presetsData as any)[this.vizId] || null;
    const readyDetail: EjbReadyPayload = {
      v: 1,
      vizId: this.vizId,
      title: preset ? preset.name : 'Simulated NASA Dataset',
      duration: 120.0,
      width: 1920,
      height: 1080,
      preset
    };

    window.dispatchEvent(
      new CustomEvent<EjbReadyPayload>('ejb:ready', {
        detail: readyDetail,
        bubbles: true,
        composed: true
      })
    );
  }

  private emitState(state: 'playing' | 'paused' | 'seeked' | 'ended'): void {
    window.dispatchEvent(
      new CustomEvent<EjbStatePayload>('ejb:state', {
        detail: { state, t: round3(this.t) },
        bubbles: true,
        composed: true
      })
    );
  }

  private tick(seeked = false): void {
    this.frameIndex++;
    this.t += 1 / this.tickHz;

    const payload = this.generateSyntheticPayload(seeked);
    window.dispatchEvent(
      new CustomEvent<EjbFramePayload>('ejb:frame', {
        detail: payload,
        bubbles: true,
        composed: true
      })
    );
  }

  private generateSyntheticPayload(seeked: boolean): EjbFramePayload {
    const time = this.t;
    const rows = 4;
    const cols = 8;
    const numCells = rows * cols;

    // Harmonically changing brightness and canopy height
    const baseBrightness = round3(clamp(0.5 + 0.35 * Math.sin(time * 0.4)));
    const dataValue = round3(clamp(0.5 + 0.45 * Math.sin(time * 0.25 + 0.5)));
    const motion = round3(clamp(0.05 + 0.1 * Math.abs(Math.sin(time * 1.2))));

    const brightnessGrid = new Array<number>(numCells);
    const dataValueGrid = new Array<number>(numCells);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const cellPhase = (c / cols) * Math.PI * 2 + (r / rows) * Math.PI;
        brightnessGrid[idx] = round3(clamp(0.5 + 0.4 * Math.sin(time * 0.5 + cellPhase)));
        dataValueGrid[idx] = round3(clamp(0.5 + 0.4 * Math.cos(time * 0.3 + cellPhase)));
      }
    }

    // Generate lightning bursts if iss-lightning preset
    const events = [];
    if (this.vizId === 'iss-lightning' && Math.random() < 0.2) {
      events.push({
        type: 'flash' as const,
        x: round3(clamp(Math.random())),
        y: round3(clamp(Math.random())),
        intensity: round3(clamp(0.6 + Math.random() * 0.4))
      });
    }

    return {
      v: 1,
      t: round3(this.t),
      frameIndex: this.frameIndex,
      vizId: this.vizId,
      metrics: {
        brightness: baseBrightness,
        dominantColor: {
          r: round3(clamp(0.5 + 0.4 * Math.sin(time * 0.3))),
          g: round3(clamp(0.5 + 0.4 * Math.cos(time * 0.2))),
          b: round3(clamp(0.5 + 0.4 * Math.sin(time * 0.4)))
        },
        hue: round3(clamp((Math.sin(time * 0.1) + 1) / 2)),
        saturation: 0.75,
        dataValue,
        motion,
        regions: {
          rows,
          cols,
          brightness: brightnessGrid,
          dataValue: dataValueGrid
        }
      },
      flags: {
        seeked,
        scene_cut: motion > 0.35
      },
      events: events.length > 0 ? events : undefined
    };
  }
}
