import { describe, it, expect } from 'vitest';
import { adaptContractV1ToSfr } from '../extension/src/sfr/adapters/contract-v1';
import { validateScientificFeatureFrame } from '../extension/src/sfr/schema';
import type { EjbFramePayload } from '../extension/src/contract/types';

describe('Contract v1 to SFR Adapter (Earth Jukebox)', () => {
  it('converts a calibrated GEDI canopy frame into validated SFR with physical meters', () => {
    const gediPayload: EjbFramePayload = {
      v: 1,
      t: 14.5,
      frameIndex: 174,
      vizId: 'gedi-forest-height',
      metrics: {
        brightness: 0.65,
        dominantColor: { r: 0.2, g: 0.8, b: 0.3 },
        hue: 0.35,
        saturation: 0.8,
        dataValue: 0.5, // 50% of 0-60m = 30m
        motion: 0.02,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.65),
          dataValue: new Array(32).fill(0.5)
        }
      },
      flags: {
        seeked: false,
        scene_cut: false
      }
    };

    const sfrFrame = adaptContractV1ToSfr(gediPayload);

    // Validate overall frame schema
    const validation = validateScientificFeatureFrame(sfrFrame);
    expect(validation.valid, `Schema validation failed: ${validation.errors.join(', ')}`).toBe(true);

    expect(sfrFrame.schemaVersion).toBe('sfr.v1');
    expect(sfrFrame.sourceId).toBe('gedi-forest-height');
    expect(sfrFrame.timestamp).toBe(14.5);

    // Primary measurement check
    const primaryFeat = sfrFrame.features.find(f => f.featureId.includes('primary_measurement')) as any;
    expect(primaryFeat).toBeDefined();
    expect(primaryFeat.unit).toBe('m');
    expect(primaryFeat.value).toBeCloseTo(30.0, 1);
    expect(primaryFeat.normalizedValue).toBe(0.5);
    expect(primaryFeat.provenance.sourceType).toBe('tier3_calibrated_visual');
    expect(primaryFeat.quality.calibrationStatus).toBe('legend_calibrated');
  });

  it('converts discrete lightning flash events into EventFeatures', () => {
    const lightningPayload: EjbFramePayload = {
      v: 1,
      t: 22.0,
      frameIndex: 264,
      vizId: 'iss-lightning',
      metrics: {
        brightness: 0.85,
        dominantColor: { r: 0.9, g: 0.9, b: 1.0 },
        hue: 0.6,
        saturation: 0.1,
        dataValue: null,
        motion: 0.25,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.85),
          dataValue: new Array(32).fill(null)
        }
      },
      flags: {
        seeked: false,
        scene_cut: false
      },
      events: [
        { type: 'flash', x: 0.75, y: 0.35, intensity: 0.92 }
      ]
    };

    const sfrFrame = adaptContractV1ToSfr(lightningPayload);
    const validation = validateScientificFeatureFrame(sfrFrame);
    expect(validation.valid).toBe(true);

    const eventFeat = sfrFrame.features.find(f => f.featureType === 'event') as any;
    expect(eventFeat).toBeDefined();
    expect(eventFeat.eventType).toBe('flash');
    expect(eventFeat.intensity).toBe(0.92);
    expect(eventFeat.position.x).toBe(0.75);
    expect(eventFeat.position.y).toBe(0.35);
  });

  it('preserves multi-layer aerosol categorical features', () => {
    const aerosolPayload: EjbFramePayload = {
      v: 1,
      t: 8.0,
      frameIndex: 96,
      vizId: 'geos-aerosols',
      metrics: {
        brightness: 0.45,
        dominantColor: { r: 0.7, g: 0.5, b: 0.3 },
        hue: 0.1,
        saturation: 0.6,
        dataValue: null,
        motion: 0.08,
        regions: {
          rows: 4,
          cols: 8,
          brightness: new Array(32).fill(0.45),
          dataValue: new Array(32).fill(null)
        }
      },
      flags: { seeked: false, scene_cut: false },
      layers: {
        smoke: 0.55,
        dust: 0.30,
        seaSalt: 0.15
      }
    };

    const sfrFrame = adaptContractV1ToSfr(aerosolPayload);
    const catFeatures = sfrFrame.features.filter(f => f.featureType === 'categorical') as any[];

    expect(catFeatures).toHaveLength(3);
    const smoke = catFeatures.find(f => f.category === 'smoke');
    expect(smoke).toBeDefined();
    expect(smoke.classProbabilities.smoke).toBe(0.55);
  });
});
