/**
 * Earth Jukebox (EJB) — Semantic Mapping Candidate Scoring Algorithm
 *
 * Implements S(m) = w1*P(m) + w2*C(m) + w3*D(m) + w4*I(m) - w5*K(m)
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { ScientificFeature } from '../sfr/types';
import type { SemanticMappingEntry } from './mapping-knowledge-base';
import type { ScoringWeights, CandidateScore, ActiveMappingAssignment } from './types';
import { DEFAULT_SCORING_WEIGHTS } from './types';

/**
 * Calculates Provenance Score P(m) based on data source reliability
 * Tier 1 (physical SI) > Tier 2 (reanalysis) > Tier 3 (calibrated colorbar) > Tier 4 (proxy)
 */
export function calculateProvenanceScore(feature: ScientificFeature | any): number {
  const sourceType = feature.provenance?.sourceType;
  if (sourceType === 'tier1_raw_telemetry') return 1.0;
  if (sourceType === 'tier2_nasa_metadata') return 0.85;
  if (sourceType === 'tier3_calibrated_visual') return 0.70;
  if (sourceType === 'tier4_visual_proxy') return 0.45;

  const tier = feature.provenanceTier;
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
  switch (mapping.evidenceLevel) {
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

  // If feature type perfectly aligns with mapping target
  if (featureType === 'event' && mapping.targetAuditoryDimension === 'transient_percussion') {
    return 1.0;
  }
  if ((featureType === 'spatial_grid' || featureType === 'spatial_grid_2d') && mapping.targetAuditoryDimension === 'latitudinal_voicing') {
    return 1.0;
  }
  if (featureName.includes('motion') && mapping.targetAuditoryDimension === 'lowpass_cutoff') {
    return 1.0;
  }
  if ((featureName.includes('height') || featureName.includes('elevation')) && mapping.targetAuditoryDimension === 'pitch_frequency') {
    return 1.0;
  }
  if (featureName.includes('smoke') || featureName.includes('dust') || featureName.includes('current')) {
    if (mapping.targetVoice === 'noise_voice') return 0.95;
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

  if (isCalibrated) score += 0.2;

  const featureType = feature.featureType || feature.type;
  if (featureType === 'scalar') {
    if (feature.value !== 0 && !isNaN(feature.value)) score += 0.3;
  } else if (featureType === 'spatial_grid' || featureType === 'spatial_grid_2d') {
    score += 0.3;
  } else if (featureType === 'event') {
    if (feature.occurred || feature.intensity > 0) score += 0.3;
  } else if (featureType === 'categorical' || featureType === 'categorical_distribution') {
    score += 0.3;
  }
  return Math.min(1.0, score);
}

/**
 * Calculates Cognitive Complexity Penalty K(m)
 * Penalizes overloading a single voice or auditory parameter.
 */
export function calculateComplexityPenalty(
  mapping: SemanticMappingEntry,
  existingAssignments: ActiveMappingAssignment[]
): number {
  let voiceCount = 0;
  let paramCount = 0;

  for (const a of existingAssignments) {
    if (a.targetVoice === mapping.targetVoice) voiceCount++;
    if (a.targetAuditoryDimension === mapping.targetAuditoryDimension) paramCount++;
  }

  // Penalty grows quickly if parameter is already assigned or voice is crowded
  const paramPenalty = paramCount * 0.5;
  const voicePenalty = voiceCount * 0.15;
  return Math.min(1.0, paramPenalty + voicePenalty);
}

/**
 * Evaluates candidate mapping suitability score:
 * S(m) = w1*P(m) + w2*C(m) + w3*D(m) + w4*I(m) - w5*K(m)
 */
export function scoreCandidate(
  feature: ScientificFeature | any,
  mapping: SemanticMappingEntry,
  existingAssignments: ActiveMappingAssignment[],
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): CandidateScore {
  const p = calculateProvenanceScore(feature);
  const c = calculateConfidenceScore(mapping);
  const d = calculateDistinctionScore(feature, mapping);
  const i = calculateInformationScore(feature);
  const k = calculateComplexityPenalty(mapping, existingAssignments);

  const rawScore =
    weights.wProvenance * p +
    weights.wConfidence * c +
    weights.wDistinction * d +
    weights.wInformation * i -
    weights.wComplexityPenalty * k;

  const totalScore = Math.max(0.0, Math.min(1.0, Number(rawScore.toFixed(4))));
  const featureName = feature.featureName || feature.name;

  return {
    mappingId: mapping.mappingId,
    featureName,
    targetAuditoryDimension: mapping.targetAuditoryDimension,
    targetVoice: mapping.targetVoice,
    totalScore,
    components: {
      provenance: p,
      confidence: c,
      distinction: d,
      information: i,
      complexityPenalty: k
    }
  };
}
