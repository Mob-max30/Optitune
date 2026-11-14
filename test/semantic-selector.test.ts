import { describe, it, expect } from 'vitest';
import { selectAutonomousMappings } from '../extension/src/semantic/selector';
import { validateMappingProfile } from '../extension/src/semantic/validator';
import type { ScientificFeatureFrame } from '../extension/src/sfr/types';
import { DEFAULT_SCORING_WEIGHTS } from '../extension/src/semantic/types';

describe('Autonomous Semantic Mapping Selector', () => {
  // Test 1: Empty frame returns safe silent/idle profile
  it('empty frame returns safe silent/idle profile', () => {
    const emptyFrame: ScientificFeatureFrame = {
      timestamp: Date.now(),
      frameIndex: 0,
      datasetId: 'empty-test',
      sourceType: 'synthetic_generator',
      fps: 30,
      features: {}
    };

    const profile = selectAutonomousMappings(emptyFrame);
    expect(profile.isSilent).toBe(true);
    expect(profile.activeMappings.length).toBe(0);
    expect(profile.auditoryLegend.length).toBe(0);

    const validation = validateMappingProfile(profile);
    expect(validation.isValid).toBe(true);
  });

  // Test 2: Deterministic profile generation for identical features
  it('generates deterministic profile IDs and assignments for identical features', () => {
    const frameA: ScientificFeatureFrame = {
      timestamp: 1000,
      frameIndex: 1,
      datasetId: 'gedi-forest-height',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        canopy_height: {
          name: 'canopy_height',
          scientificDimension: 'magnitude',
          unit: 'm',
          provenanceTier: 1,
          isCalibrated: true,
          type: 'scalar',
          value: 42.5,
          validRange: [0, 60]
        },
        interframe_motion_delta: {
          name: 'interframe_motion_delta',
          scientificDimension: 'velocity',
          unit: 'px/frame',
          provenanceTier: 4,
          isCalibrated: false,
          type: 'scalar',
          value: 0.15,
          validRange: [0, 1]
        }
      }
    };

    const profileA = selectAutonomousMappings(frameA);
    const profileB = selectAutonomousMappings(frameA);

    expect(profileA.profileId).toBe(profileB.profileId);
    expect(profileA.activeMappings.length).toBe(profileB.activeMappings.length);
    expect(profileA.activeMappings[0].mappingId).toBe(profileB.activeMappings[0].mappingId);
  });

  // Test 3: Graceful conflict resolution when two features compete for pitch
  it('resolves parameter conflicts when two features compete for pitch on lead_voice', () => {
    const conflictingFrame: ScientificFeatureFrame = {
      timestamp: 2000,
      frameIndex: 2,
      datasetId: 'conflict-test',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        canopy_height: {
          name: 'canopy_height',
          scientificDimension: 'magnitude',
          unit: 'm',
          provenanceTier: 1,
          isCalibrated: true,
          type: 'scalar',
          value: 35.0,
          validRange: [0, 60]
        },
        co2_concentration: {
          name: 'co2_concentration',
          scientificDimension: 'magnitude',
          unit: 'ppm',
          provenanceTier: 2,
          isCalibrated: true,
          type: 'scalar',
          value: 420.0,
          validRange: [380, 500]
        }
      }
    };

    const profile = selectAutonomousMappings(conflictingFrame);

    // Only one should win lead_voice pitch_frequency
    const pitchMappings = profile.activeMappings.filter(
      m => m.targetVoice === 'lead_voice' && m.targetAuditoryDimension === 'pitch_frequency'
    );
    expect(pitchMappings.length).toBe(1);

    // Canopy height should win due to Tier 1 provenance vs Tier 2
    expect(pitchMappings[0].featureName).toBe('canopy_height');
  });

  // Test 4: Tier 1 physical features prioritized over Tier 4 proxies
  it('prioritizes Tier 1 physical features over Tier 4 proxies for primary voice', () => {
    const frame: ScientificFeatureFrame = {
      timestamp: 3000,
      frameIndex: 3,
      datasetId: 'tier-priority-test',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        elevation: {
          name: 'elevation',
          scientificDimension: 'magnitude',
          unit: 'm',
          provenanceTier: 1,
          isCalibrated: true,
          type: 'scalar',
          value: 1200,
          validRange: [0, 8848]
        },
        brightness_proxy: {
          name: 'perceptual_luminance',
          scientificDimension: 'magnitude',
          unit: 'proxy_norm',
          provenanceTier: 4,
          isCalibrated: false,
          type: 'scalar',
          value: 0.8,
          validRange: [0, 1]
        }
      }
    };

    const profile = selectAutonomousMappings(frame);
    expect(profile.activeMappings.length).toBeGreaterThanOrEqual(1);

    const leadPitch = profile.activeMappings.find(
      m => m.targetVoice === 'lead_voice' && m.targetAuditoryDimension === 'pitch_frequency'
    );
    expect(leadPitch).toBeDefined();
    expect(leadPitch?.featureName).toBe('elevation');
    expect(leadPitch?.provenanceTier).toBe(1);
  });

  // Test 5: Multi-aerosol frame correctly maps three concurrent layers without collision
  it('maps multi-aerosol layers concurrently without parameter collisions', () => {
    const aerosolFrame: ScientificFeatureFrame = {
      timestamp: 4000,
      frameIndex: 4,
      datasetId: 'geos-fp-aerosols',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        aerosol_smoke_coverage: {
          name: 'aerosol_smoke_coverage',
          scientificDimension: 'structure_distribution',
          unit: 'ratio',
          provenanceTier: 2,
          isCalibrated: true,
          type: 'scalar',
          value: 0.45,
          validRange: [0, 1]
        },
        aerosol_seasalt_coverage: {
          name: 'aerosol_seasalt_coverage',
          scientificDimension: 'structure_distribution',
          unit: 'ratio',
          provenanceTier: 2,
          isCalibrated: true,
          type: 'scalar',
          value: 0.30,
          validRange: [0, 1]
        },
        interframe_motion_delta: {
          name: 'interframe_motion_delta',
          scientificDimension: 'velocity',
          unit: 'px/frame',
          provenanceTier: 4,
          isCalibrated: false,
          type: 'scalar',
          value: 0.22,
          validRange: [0, 1]
        }
      }
    };

    const profile = selectAutonomousMappings(aerosolFrame);
    expect(profile.activeMappings.length).toBe(3);

    // Verify all active voices and dimensions are collision-free
    const voiceDimPairs = new Set<string>();
    for (const m of profile.activeMappings) {
      const key = `${m.targetVoice}::${m.targetAuditoryDimension}`;
      expect(voiceDimPairs.has(key)).toBe(false);
      voiceDimPairs.add(key);
    }

    const validation = validateMappingProfile(profile);
    expect(validation.isValid).toBe(true);
  });

  // Test 6: Scoring weights customization affects candidate selection
  it('allows customizing scoring weights to favor confidence over provenance', () => {
    const frame: ScientificFeatureFrame = {
      timestamp: 5000,
      frameIndex: 5,
      datasetId: 'weights-test',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        optical_lightning_flash: {
          name: 'optical_lightning_flash',
          scientificDimension: 'events_anomalies',
          unit: 'count',
          provenanceTier: 4,
          isCalibrated: false,
          type: 'event',
          occurred: true,
          intensity: 0.95
        }
      }
    };

    // Extreme weights putting 100% on confidence
    const customWeights = {
      ...DEFAULT_SCORING_WEIGHTS,
      wProvenance: 0.0,
      wConfidence: 0.8,
      wDistinction: 0.2
    };

    const profile = selectAutonomousMappings(frame, { weights: customWeights });
    expect(profile.activeMappings.length).toBe(1);
    expect(profile.activeMappings[0].targetAuditoryDimension).toBe('transient_percussion');
  });

  // Test 7: Execution time < 5ms per frame
  it('evaluates and builds a full mapping profile in under 5ms', () => {
    const richFrame: ScientificFeatureFrame = {
      timestamp: 6000,
      frameIndex: 6,
      datasetId: 'performance-benchmark',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        canopy_height: {
          name: 'canopy_height',
          scientificDimension: 'magnitude',
          unit: 'm',
          provenanceTier: 1,
          isCalibrated: true,
          type: 'scalar',
          value: 50,
          validRange: [0, 60]
        },
        interframe_motion_delta: {
          name: 'interframe_motion_delta',
          scientificDimension: 'velocity',
          unit: 'px/frame',
          provenanceTier: 4,
          isCalibrated: false,
          type: 'scalar',
          value: 0.35,
          validRange: [0, 1]
        },
        optical_lightning_flash: {
          name: 'optical_lightning_flash',
          scientificDimension: 'events_anomalies',
          unit: 'count',
          provenanceTier: 3,
          isCalibrated: true,
          type: 'event',
          occurred: true,
          intensity: 0.9
        },
        aerosol_smoke_coverage: {
          name: 'aerosol_smoke_coverage',
          scientificDimension: 'structure_distribution',
          unit: 'ratio',
          provenanceTier: 2,
          isCalibrated: true,
          type: 'scalar',
          value: 0.6,
          validRange: [0, 1]
        }
      }
    };

    const start = performance.now();
    const profile = selectAutonomousMappings(richFrame);
    const duration = performance.now() - start;

    expect(profile.activeMappings.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(5.0); // Strict performance SLA < 5ms
  });

  // Test 8: Generated profile passes validator
  it('generated profile passes all validator checks', () => {
    const frame: ScientificFeatureFrame = {
      timestamp: 7000,
      frameIndex: 7,
      datasetId: 'validation-test',
      sourceType: 'nasa_earthdata',
      fps: 30,
      features: {
        canopy_height: {
          name: 'canopy_height',
          scientificDimension: 'magnitude',
          unit: 'm',
          provenanceTier: 1,
          isCalibrated: true,
          type: 'scalar',
          value: 28.0,
          validRange: [0, 60]
        }
      }
    };

    const profile = selectAutonomousMappings(frame);
    const validation = validateMappingProfile(profile);

    expect(validation.isValid).toBe(true);
    expect(validation.errors.length).toBe(0);
    expect(profile.auditoryLegend.length).toBe(profile.activeMappings.length);
  });
});
