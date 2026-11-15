import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSongForMedia } from '../extension/src/audio/song';
import { EarthJukeboxAudioEngine } from '../extension/src/audio/engine';
import { setupWebAudioMock } from './mock-audio';
import type { EjbFramePayload } from '../extension/src/contract/types';

describe('Earth Song Composition Engine', () => {
  let engine: EarthJukeboxAudioEngine;

  beforeEach(() => {
    setupWebAudioMock();
    engine = new EarthJukeboxAudioEngine({ mode: 'song', masterVolume: 0.8 });
  });

  afterEach(() => {
    engine.destroy();
  });

  it('guarantees distinct videos generate distinct songs (different key, scale, progression, or bpm)', () => {
    const videoA = generateSongForMedia('thermal-fire:1a2b3c4d', 0.08); // Fire
    const videoB = generateSongForMedia('ocean-sst:9e8d7c6b', 0.62);    // Ocean
    const videoC = generateSongForMedia('forest-gedi:4f5e6d7c', 0.35);  // Forest

    // All should have titles and musical properties
    expect(videoA.title).toBeTruthy();
    expect(videoB.title).toBeTruthy();
    expect(videoC.title).toBeTruthy();

    // Verify distinctness across the videos
    expect(videoA.title).not.toBe(videoB.title);
    expect(videoB.title).not.toBe(videoC.title);

    // At least 2 of key, bpm, rootMidi, or chord progression must differ
    const diffsAB = (
      (videoA.keyName !== videoB.keyName ? 1 : 0) +
      (videoA.baseBpm !== videoB.baseBpm ? 1 : 0) +
      (videoA.scaleName !== videoB.scaleName ? 1 : 0) +
      (videoA.chordProgression[0].name !== videoB.chordProgression[0].name ? 1 : 0)
    );
    expect(diffsAB).toBeGreaterThanOrEqual(2);

    const diffsBC = (
      (videoB.keyName !== videoC.keyName ? 1 : 0) +
      (videoB.baseBpm !== videoC.baseBpm ? 1 : 0) +
      (videoB.scaleName !== videoC.scaleName ? 1 : 0) +
      (videoB.chordProgression[0].name !== videoC.chordProgression[0].name ? 1 : 0)
    );
    expect(diffsBC).toBeGreaterThanOrEqual(2);
  });

  it('EarthJukeboxAudioEngine runs in song mode and populates telemetry with Song details', async () => {
    await engine.start();

    const sampleFrame: EjbFramePayload = {
      v: 1,
      t: 12.0,
      frameIndex: 144,
      vizId: 'ocean-sst:abcdef01',
      metrics: {
        brightness: 0.72,
        dominantColor: { r: 0.1, g: 0.4, b: 0.9 },
        hue: 0.6,
        saturation: 0.8,
        dataValue: 28.5,
        motion: 0.12,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.6),
          dataValue: new Array(32).fill(28.5)
        }
      },
      flags: {
        seeked: false,
        scene_cut: false
      }
    };

    engine.processFrame(sampleFrame);
    const tel = engine.getTelemetry();

    expect(tel.mode).toBe('song');
    expect(tel.songTitle).toBeTruthy();
    expect(tel.songKey).toBeTruthy();
    expect(tel.songScale).toBeTruthy();
    expect(tel.songBpm).toBeGreaterThanOrEqual(70);
    expect(tel.currentChord).toBeTruthy();
    expect(tel.activeVoices).toBe(6);
  });
});
