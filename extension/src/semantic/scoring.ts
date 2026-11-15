/**
 * Earth Jukebox (EJB) — Value-Aware Semantic Candidate Scoring Algorithm
 *
 * Implements Amendment A, Section A7:
 * S(m) = w1*P + w2*C + w3*D + w4*I + w6*Sal + w7*Div - w5*K
 *
 * Terms:
 * - P: Provenance score [0, 1]
 * - C: Scientific / Literature confidence [0, 1]
 * - D: Crossmodal distinction & naturalness [0, 1]
 * - I: Interpretability & dynamic clarity [0, 1]
 * - Sal: Normalized feature salience [0, 1] (value-aware!)
 * - Div: Voice & dimension diversity bonus [0, 1] (prevents piling onto pitch/amplitude)
 * - K: Stream complexity & cognitive load penalty [0, 1]
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { ScientificFeature } from '../sfr/types';
import type { SemanticMappingEntry } from './mapping-knowledge-base';
import type { ScoringWeights, CandidateScore, ActiveMappingAssignment } from './types';
import { DEFAULT_SCORING_WEIGHTS } from './types';
import { clamp, round3 } from '../analysis/normalize';

/**
 * Calculates Provenance Score P(m) based on data source reliability
 * Tier 1 (physical SI) > Tier 2 (reanalysis) > Tier 3 (calibrated visual) > Tier 4 (proxy)
 */
export function calculateProvenanceScore(feature: ScientificFeature | any): number {
  const sourceType = feature.provenance?.sourceType;
  if (sourceType === 'tier1_raw_telemetry') return 1.0;
  if (sourceType === 'tier2_nasa_metadata') return 0.85;
  if (sourceType === 'tier3_calibrated_visual') return 0.70;
  if (sourceType === 'tier4_visual_proxy') return 0.45;

  const tier = feature.provenanceTier ?? feature.provenance?.provenanceTier;
  switch (tier) {
    case 1:
      return 1.0;
    case 2:
      return 0.85;
    case 3:
      return 0.70;
    case 4:
      return 0.45;
    default:
      return 0.40;
  }
}

/**
 * Calculates Literature Confidence Score C(m)
 */
export function calculateConfidenceScore(mapping: SemanticMappingEntry): number {
  const level = mapping.evidenceLevel || mapping.evidenceClass;
  switch (level) {
    case 'strong_empirical':
      return 1.0;
    case 'moderate_literature':
      return 0.75;
    case 'design_hypothesis':
      return 0.50;
    default:
      return 0.50;
  }
}

/**
 * Calculates Crossmodal Distinction / Naturalness Score D(m)
 */
export function calculateDistinctionScore(feature: ScientificFeature | any, mapping: SemanticMappingEntry): number {
  const featureType = feature.featureType || feature.type;
  const featureName = (feature.featureName || feature.name || '').toLowerCase();

  // Natural crossmodal matches
  if (featureType === 'event' && mapping.targetAuditoryDimension === 'transient_percussion') {
    return 1.0;
  }
  if ((featureType === 'spatial_grid' || featureType === 'spatial_grid_2d') && mapping.targetAuditoryDimension === 'latitudinal_voicing') {
    return 1.0;
  }
  if ((featureName.includes('motion') || featureName.includes('rate')) && mapping.targetAuditoryDimension === 'lowpass_cutoff') {
    return 1.0;
  }
  if ((featureName.includes('height') || featureName.includes('altitude') || featureName.includes('level')) && mapping.targetAuditoryDimension === 'pitch_frequency') {
    return 1.0;
  }
  if (mapping.targetVoice === 'palette_voice') {
    return 0.95; // High crossmodal naturalness for phenomenon palette textures
  }
  return 0.75;
}

/**
 * Calculates Informational Salience Score I(m)
 */
export function calculateInformationScore(feature: ScientificFeature | any): number {
  let score = 0.5;
  const isCalibrated = feature.quality
    ? feature.quality.calibrationStatus !== 'uncalibrated' && feature.quality.calibrationStatus !== 'proxy_inferred'
    : Boolean(feature.isCalibrated);

  if (isCalibrated) score += 0.25;

  const val = feature.observedValue ?? feature.value;
  if (typeof val === 'number' && !isNaN(val) && val > 0) {
    score += 0.25;
  }
  return Math.min(1.0, score);
}

/**
 * Calculates Voice & Parameter Diversity Bonus Div(m)
 * Grants bonus 1.0 if target voice or parameter is not yet occupied by existing active mappings.
 */
export function calculateDiversityBonus(
  mapping: SemanticMappingEntry,
  existingAssignments: ActiveMappingAssignment[]
): number {
  const voiceOccupied = existingAssignments.some(a => a.targetVoice === mapping.targetVoice);
  const dimensionOccupied = existingAssignments.some(a => a.targetAuditoryDimension === mapping.targetAuditoryDimension);

  if (!voiceOccupied && !dimensionOccupied) return 1.0;
  if (!voiceOccupied) return 0.6;
  if (!dimensionOccupied) return 0.4;
  return 0.0;
}

/**
 * Calculates Cognitive Complexity Penalty K(m)
 */
export function calculateComplexityPenalty(existingAssignments: ActiveMappingAssignment[]): number {
  const activeCount = existingAssignments.length;
  if (activeCount <= 1) return 0.0;
  if (activeCount === 2) return 0.2;
  if (activeCount === 3) return 0.5;
  return 0.85;
}

/**
 * Master Candidate Scoring Function:
 * S(m) = w1*P + w2*C + w3*D + w4*I + w6*Sal + w7*Div - w5*K
 */
export function scoreCandidate(
  feature: ScientificFeature | any,
  mapping: SemanticMappingEntry,
  existingAssignments: ActiveMappingAssignment[] = [],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  featureSalience = 0.50
): CandidateScore {
  const p = calculateProvenanceScore(feature);
  const c = calculateConfidenceScore(mapping);
  const d = calculateDistinctionScore(feature, mapping);
  const i = calculateInformationScore(feature);
  const sal = clamp(featureSalience, 0.0, 1.0);
  const div = calculateDiversityBonus(mapping, existingAssignments);
  const k = calculateComplexityPenalty(existingAssignments);

  // Amendment A Formula:
  // S(m) = w1*P + w2*C + w3*D + w4*I + w6*Sal + w7*Div - w5*K
  const w1 = weights.wProvenance ?? 0.20;
  const w2 = weights.wConfidence ?? 0.20;
  const w3 = weights.wDistinction ?? 0.20;
  const w4 = weights.wInformation ?? 0.15;
  const w6 = weights.wSalience ?? 0.20;
  const w7 = weights.wDiversity ?? 0.05;
  const w5 = weights.wComplexityPenalty ?? 0.25;

  const rawScore = (w1 * p) + (w2 * c) + (w3 * d) + (w4 * i) + (w6 * sal) + (w7 * div) - (w5 * k);
  const totalScore = round3(clamp(rawScore, 0.0, 1.0));

  return {
    mappingId: mapping.mappingId,
    featureName: feature.featureName || feature.name || mapping.matchingFeaturePatterns[0],
    targetAuditoryDimension: mapping.targetAuditoryDimension,
    targetVoice: mapping.targetVoice,
    totalScore,
    components: {
      provenance: round3(p),
      confidence: round3(c),
      distinction: round3(d),
      information: round3(i),
      salience: round3(sal),
      diversity: round3(div),
      complexityPenalty: round3(k)
    }
  };
}
