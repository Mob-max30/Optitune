import { describe, it, expect } from 'vitest';
import {
  midiToFrequency,
  frequencyToMidi,
  mapContinuousFrequency,
  quantizeToScale,
  MUSICAL_SCALES
} from '../extension/src/audio/scales';

describe('Musical Scales & Frequency Mappings (Pranav)', () => {
  it('converts MIDI note 69 to 440 Hz (Concert A4)', () => {
    const f = midiToFrequency(69);
    expect(f).toBeCloseTo(440.0, 2);
  });

  it('converts 440 Hz back to MIDI note 69', () => {
    const note = frequencyToMidi(440.0);
    expect(note).toBe(69);
  });

  it('converts MIDI note 60 to middle C (261.63 Hz)', () => {
    const f = midiToFrequency(60);
    expect(f).toBeCloseTo(261.63, 1);
  });

  it('maps normalized scientific metric continuously in log mode', () => {
    const minF = 100;
    const maxF = 400;

    // At 0.0 -> min frequency
    expect(mapContinuousFrequency(0.0, minF, maxF, 'log')).toBeCloseTo(100, 2);

    // At 1.0 -> max frequency
    expect(mapContinuousFrequency(1.0, minF, maxF, 'log')).toBeCloseTo(400, 2);

    // At 0.5 -> geometric mean (sqrt(100 * 400) = 200)
    expect(mapContinuousFrequency(0.5, minF, maxF, 'log')).toBeCloseTo(200, 2);
  });

  it('maps normalized metric linearly when requested', () => {
    const minF = 100;
    const maxF = 500;
    expect(mapContinuousFrequency(0.0, minF, maxF, 'linear')).toBeCloseTo(100, 2);
    expect(mapContinuousFrequency(0.5, minF, maxF, 'linear')).toBeCloseTo(300, 2);
    expect(mapContinuousFrequency(1.0, minF, maxF, 'linear')).toBeCloseTo(500, 2);
  });

  it('clamps out-of-bound inputs to [0.0, 1.0]', () => {
    expect(mapContinuousFrequency(-0.5, 100, 200)).toBeCloseTo(100, 2);
    expect(mapContinuousFrequency(1.8, 100, 200)).toBeCloseTo(200, 2);
  });

  it('quantizes to Pentatonic Major scale intervals correctly', () => {
    // C3 root = MIDI 48 = ~130.81 Hz
    const f0 = quantizeToScale(0.0, 'pentatonic-major', 48, 2);
    expect(f0).toBeCloseTo(midiToFrequency(48), 1);

    // Monotonic rise: higher data values produce equal or higher frequencies
    const fMid = quantizeToScale(0.5, 'pentatonic-major', 48, 2);
    const fHigh = quantizeToScale(0.99, 'pentatonic-major', 48, 2);

    expect(fMid).toBeGreaterThan(f0);
    expect(fHigh).toBeGreaterThan(fMid);
  });

  it('verifies all supported scales have valid non-empty intervals', () => {
    for (const [name, intervals] of Object.entries(MUSICAL_SCALES)) {
      expect(intervals.length).toBeGreaterThanOrEqual(5);
      expect(intervals[0]).toBe(0); // Starts on root tonic
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1]); // Strictly ascending
        expect(intervals[i]).toBeLessThan(12); // Within 1 octave
      }
    }
  });
});
