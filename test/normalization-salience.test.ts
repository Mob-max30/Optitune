import { describe, it, expect, beforeEach } from 'vitest';
import { ReferenceRelativeNormalizer } from '../extension/src/semantic/normalization';
import { SalienceEngine } from '../extension/src/semantic/salience';

describe('Gate G3: Reference-Relative Normalization & Salience Role Assignment', () => {
  let normalizer: ReferenceRelativeNormalizer;
  let salienceEngine: SalienceEngine;

  beforeEach(() => {
    normalizer = new ReferenceRelativeNormalizer();
    salienceEngine = new SalienceEngine();
  });

  it('normalizes calibrated features against documented physical reference ranges', () => {
    // GEDI canopy height reference: mean = 25.0m, std = 14.0m
    const resLow = normalizer.normalize('gedi_source', 'gedi-forest-height', 'canopy_height', 11.0, true);
    expect(resLow.baselineMode).toBe('physical_reference');
    // z = (11 - 25) / 14 = -1.0
    expect(resLow.zScore).toBeCloseTo(-1.0, 1);
    expect(resLow.explanation).toContain('documented NASA physical reference range');

    const resTall = normalizer.normalize('gedi_source', 'gedi-forest-height', 'canopy_height', 53.0, true);
    // z = (53 - 25) / 14 = +2.0
    expect(resTall.zScore).toBeCloseTo(2.0, 1);
  });

  it('tracks running source baseline for uncalibrated proxy sources without saturation', () => {
    const source = 'proxy_source_1';
    // Feed running samples representing a fluctuating proxy feature
    for (let i = 0; i < 20; i++) {
      normalizer.normalize(source, 'generic-earth', 'proxy_level', 0.30 + Math.sin(i) * 0.10, false);
    }

    const testSample = normalizer.normalize(source, 'generic-earth', 'proxy_level', 0.50, false);
    expect(testSample.baselineMode).toBe('running');
    expect(testSample.explanation.toLowerCase()).toContain("relative to this visualisation's observed distribution");
    expect(testSample.zScore).toBeGreaterThan(0.5); // Accurately detects deviation above P50
  });

  it('evaluates salience and dynamically assigns different roles across different phenomena', () => {
    // Phenomenon 1: Thermal Wildfires (extreme_fraction should dominate foreground lead)
    const fireFeatures = [
      { featureName: 'extreme_fraction', zScore: 2.8, confidence: 0.95 },
      { featureName: 'peak_intensity', zScore: 2.5, confidence: 0.90 },
      { featureName: 'temporal_rate', zScore: 1.8, confidence: 0.85 },
      { featureName: 'proxy_level', zScore: 0.4, confidence: 0.60 },
      { featureName: 'spatial_spread', zScore: 0.2, confidence: 0.70 }
    ];

    const fireRoles = salienceEngine.evaluateRoles('fire_source', 'thermal-fire', fireFeatures);
    expect(fireRoles.foreground[0]).toBe('extreme_fraction'); // Lead voice
    expect(fireRoles.foreground[1]).toBe('peak_intensity');    // Rhythm voice
    expect(fireRoles.foreground[2]).toBe('temporal_rate');    // Tension voice
    expect(fireRoles.background).toContain('proxy_level');    // Bed modulation

    // Phenomenon 2: Sea Surface Temperature (spatial_spread and calibrated_level should dominate)
    const sstFeatures = [
      { featureName: 'spatial_spread', zScore: 2.4, confidence: 0.95 },
      { featureName: 'calibrated_level', zScore: 2.1, confidence: 0.90 },
      { featureName: 'surface_texture', zScore: 1.7, confidence: 0.85 },
      { featureName: 'extreme_fraction', zScore: 0.2, confidence: 0.50 }
    ];

    const sstRoles = salienceEngine.evaluateRoles('sst_source', 'sst-currents', sstFeatures);
    expect(sstRoles.foreground[0]).toBe('spatial_spread');
    expect(sstRoles.foreground[1]).toBe('calibrated_level');
    expect(sstRoles.foreground[2]).toBe('surface_texture');

    // Confirm primary source of distinctness: Different phenomena assign different features to Foreground roles!
    expect(fireRoles.foreground[0]).not.toBe(sstRoles.foreground[0]);
  });
});
