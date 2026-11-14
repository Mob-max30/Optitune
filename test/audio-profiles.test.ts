import { describe, it, expect } from 'vitest';
import { PRESET_AUDIO_PROFILES, getAudioProfile } from '../extension/src/audio/profiles';

describe('NASA Visualization Audio Profiles (Pranav)', () => {
  const expectedPresets = [
    'gedi-forest-height',
    'night-lights',
    'iss-lightning',
    'sst-currents',
    'geos-aerosols',
    'dyamond-co2',
    'perpetual-ocean',
    'air-quality',
    'atmospheric-river',
    'caldwell-73'
  ];

  it('defines valid audio profiles for all 10 challenge visualizations', () => {
    for (const id of expectedPresets) {
      const profile = PRESET_AUDIO_PROFILES[id];
      expect(profile, `Profile for ${id} must exist`).toBeDefined();
      expect(profile.baseFrequency).toBeGreaterThan(50);
      expect(profile.maxFrequency).toBeGreaterThan(profile.baseFrequency);
      expect(profile.baseCutoff).toBeGreaterThan(200);
      expect(profile.maxCutoff).toBeGreaterThan(profile.baseCutoff);
      expect(profile.soundLegend).toBeTruthy();
      expect(profile.soundLegend.length).toBeGreaterThan(20);
    }
  });

  it('falls back to GEDI profile if an unknown vizId is passed', () => {
    const fallback = getAudioProfile('unknown-dataset-xyz');
    expect(fallback.id).toBe('gedi-forest-height');
  });

  it('verifies GEDI canopy maps physical height to continuous frequency', () => {
    const gedi = getAudioProfile('gedi-forest-height');
    expect(gedi.primaryMetric).toBe('dataValue');
    expect(gedi.defaultMode).toBe('scientific');
    expect(gedi.baseFrequency).toBeCloseTo(130.81, 1);
  });

  it('verifies ISS lightning has percussion flash sound hint', () => {
    const lightning = getAudioProfile('iss-lightning');
    expect(lightning.soundLegend.toLowerCase()).toContain('lightning');
    expect(lightning.soundLegend.toLowerCase()).toContain('percussive');
  });
});
