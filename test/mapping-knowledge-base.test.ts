import { describe, it, expect } from 'vitest';
import {
  MAPPING_KNOWLEDGE_BASE,
  getMappingById,
  findCandidateMappings,
  SemanticMappingEntry
} from '../extension/src/semantic/mapping-knowledge-base';

describe('Perceptual Semantic Mapping Knowledge Base', () => {
  it('contains exactly 15 curated mapping rules', () => {
    expect(MAPPING_KNOWLEDGE_BASE.length).toBe(15);
  });

  it('every mapping has unique IDs, valid scientific dimensions, and complete metadata', () => {
    const ids = new Set<string>();
    const validVoices = new Set(['lead_voice', 'pad_voice', 'percussion_voice', 'noise_voice', 'scanner_voice']);
    const validEvidence = new Set(['strong_empirical', 'moderate_literature', 'design_hypothesis']);

    for (const entry of MAPPING_KNOWLEDGE_BASE) {
      // Unique ID
      expect(ids.has(entry.mappingId)).toBe(false);
      ids.add(entry.mappingId);

      // Non-empty fields
      expect(entry.matchingFeaturePatterns.length).toBeGreaterThan(0);
      expect(entry.scientificRationale.length).toBeGreaterThan(15);
      expect(entry.literatureCitation.length).toBeGreaterThan(10);
      expect(entry.verbalDescription.length).toBeGreaterThan(10);

      // Enum bounds
      expect(validVoices.has(entry.targetVoice)).toBe(true);
      expect(validEvidence.has(entry.evidenceLevel)).toBe(true);
    }
  });

  it('retrieves mapping entries correctly by ID via getMappingById', () => {
    const altitudeMap = getMappingById('map.magnitude.altitude_to_pitch');
    expect(altitudeMap).toBeDefined();
    expect(altitudeMap?.targetAuditoryDimension).toBe('pitch_frequency');
    expect(altitudeMap?.evidenceLevel).toBe('strong_empirical');

    const unknownMap = getMappingById('map.nonexistent.id');
    expect(unknownMap).toBeUndefined();
  });

  it('matches features using findCandidateMappings', () => {
    const canopyMatches = findCandidateMappings('canopy_height');
    expect(canopyMatches.length).toBeGreaterThanOrEqual(1);
    expect(canopyMatches.some(m => m.mappingId === 'map.magnitude.altitude_to_pitch')).toBe(true);

    const flashMatches = findCandidateMappings('optical_lightning_flash', 'events_anomalies');
    expect(flashMatches.length).toBe(1);
    expect(flashMatches[0].mappingId).toBe('map.event.lightning_to_percussion');

    const noMatches = findCandidateMappings('completely_unrelated_xyz_feature');
    expect(noMatches.length).toBe(0);
  });

  it('contains strong empirical evidence for fundamental crossmodal dimensions', () => {
    const altitude = getMappingById('map.magnitude.altitude_to_pitch');
    expect(altitude?.evidenceLevel).toBe('strong_empirical');
    expect(altitude?.literatureCitation).toContain('Spence');

    const luma = getMappingById('map.magnitude.luma_to_amplitude');
    expect(luma?.evidenceLevel).toBe('strong_empirical');
    expect(luma?.literatureCitation).toContain('Stevens');

    const motion = getMappingById('map.velocity.motion_to_filter_cutoff');
    expect(motion?.evidenceLevel).toBe('strong_empirical');
    expect(motion?.literatureCitation).toContain('Bregman');

    const lightning = getMappingById('map.event.lightning_to_percussion');
    expect(lightning?.evidenceLevel).toBe('strong_empirical');
    expect(lightning?.literatureCitation).toContain('Gaver');
  });
});
