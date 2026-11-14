import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupWebAudioMock } from './mock-audio';
import { EarthJukeboxAudioEngine } from '../extension/src/audio/engine';
import type { EjbFramePayload } from '../extension/src/contract/types';

describe('Earth Jukebox Audio Engine (Pranav)', () => {
  let engine: EarthJukeboxAudioEngine;

  beforeEach(() => {
    setupWebAudioMock();
    engine = new EarthJukeboxAudioEngine({ mode: 'scientific', masterVolume: 0.8 });
  });

  afterEach(() => {
    engine.destroy();
  });

  it('initializes in scientific mode and starts cleanly', async () => {
    await engine.start();
    const tel = engine.getTelemetry();
    expect(tel.mode).toBe('scientific');
    expect(tel.vizId).toBe('gedi-forest-height');
  });

  it('switches between scientific, artistic, scanner, and raaga modes', async () => {
    await engine.start();

    engine.setMode('artistic');
    expect(engine.getTelemetry().mode).toBe('artistic');

    engine.setMode('scanner');
    expect(engine.getTelemetry().mode).toBe('scanner');

    engine.setMode('raaga');
    expect(engine.getTelemetry().mode).toBe('raaga');

    engine.setMode('scientific');
    expect(engine.getTelemetry().mode).toBe('scientific');
  });

  it('updates telemetry and frequency on processFrame()', async () => {
    await engine.start();

    const sampleFrame: EjbFramePayload = {
      v: 1,
      t: 10.5,
      frameIndex: 126,
      vizId: 'gedi-forest-height',
      metrics: {
        brightness: 0.6,
        dominantColor: { r: 0.2, g: 0.8, b: 0.3 },
        hue: 0.35,
        saturation: 0.8,
        dataValue: 0.75, // 75% canopy height
        motion: 0.04,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.6),
          dataValue: new Array(32).fill(0.75)
        }
      },
      flags: {
        seeked: false,
        scene_cut: false
      }
    };

    engine.processFrame(sampleFrame);
    const tel = engine.getTelemetry();

    expect(tel.leadFrequency).toBeGreaterThan(130);
    expect(tel.leadGain).toBeGreaterThan(0);
    expect(tel.filterCutoff).toBeGreaterThan(600);
    expect(tel.activeVoices).toBe(6);
  });

  it('handles discrete lightning/flash events without crashing', async () => {
    await engine.start();

    const flashFrame: EjbFramePayload = {
      v: 1,
      t: 12.0,
      frameIndex: 144,
      vizId: 'iss-lightning',
      metrics: {
        brightness: 0.8,
        dominantColor: { r: 0.9, g: 0.9, b: 1.0 },
        hue: 0.6,
        saturation: 0.2,
        dataValue: null,
        motion: 0.2,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.8),
          dataValue: new Array(32).fill(null)
        }
      },
      flags: { seeked: false, scene_cut: false },
      events: [
        { type: 'flash', x: 0.85, y: 0.4, intensity: 0.95 }
      ]
    };

    engine.processFrame(flashFrame);
    const tel = engine.getTelemetry();
    expect(tel.eventsTriggered).toBeGreaterThanOrEqual(1);
  });

  it('adjusts volume and mute states', async () => {
    await engine.start();
    engine.setMasterVolume(0.5);
    engine.setMuted(true);
    engine.setMuted(false);
  });
});
