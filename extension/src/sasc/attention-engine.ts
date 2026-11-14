/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Scientific Significance, Attention & Redundancy Engine
 *
 * Implements Stages 5 and 6 of SASC:
 * Multi-factor attention scoring, priority classification, hard eligibility checks,
 * redundancy detection, and representation decision-making (MERGE / GROUP / SEPARATE).
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EnrichedScientificFeature } from './ontology';
import type { ScientificRelationshipGraph } from './relationship-graph';

export type PriorityBand = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface AttentionWeights {
  relevance: number;      // w_r (0.25)
  confidence: number;     // w_c (0.20)
  magnitude: number;      // w_m (0.15)
  deviation: number;      // w_d (0.15)
  temporalNovelty: number;// w_t (0.10)
  spatialImportance: number; // w_s (0.10)
  relationshipImportance: number; // w_g (0.05)
}

export const DEFAULT_ATTENTION_WEIGHTS: AttentionWeights = {
  relevance: 0.25,
  confidence: 0.20,
  magnitude: 0.15,
  deviation: 0.15,
  temporalNovelty: 0.10,
  spatialImportance: 0.10,
  relationshipImportance: 0.05
};

export interface FeatureAttentionScore {
  featureId: string;
  totalScore: number;
  priority: PriorityBand;
  isEligible: boolean;
  rejectionReason?: string;
  components: {
    relevance: number;
    confidence: number;
    magnitude: number;
    deviation: number;
    temporalNovelty: number;
    spatialImportance: number;
    relationshipImportance: number;
  };
}

export type RedundancyClass = 'IDENTICAL' | 'DERIVED' | 'CORRELATED' | 'COMPLEMENTARY' | 'INDEPENDENT' | 'UNKNOWN';
export type RepresentationDecision = 'MERGE' | 'GROUP' | 'SEPARATE';

export interface RedundancyDecision {
  featureId: string;
  relatedFeatureId: string;
  redundancyClass: RedundancyClass;
  decision: RepresentationDecision;
  rationale: string;
}

/**
 * Calculates confidence score based on provenance tier and calibration status.
 */
export function calculateConfidence(feature: EnrichedScientificFeature): number {
  let score = 0.5;
  if (feature.provenanceTier === 'tier1_raw_telemetry') score = 1.0;
  else if (feature.provenanceTier === 'tier2_nasa_metadata') score = 0.85;
  else if (feature.provenanceTier === 'tier3_calibrated_visual') score = 0.70;
  else if (feature.provenanceTier === 'tier4_visual_proxy') score = 0.40;

  if (feature.calibrationStatus === 'legend_calibrated' || feature.calibrationStatus === 'instrument_calibrated') {
    score = Math.min(1.0, score + 0.15);
  }
  return score;
}

/**
 * Computes the multi-factor attention score for a single feature within the relationship graph.
 */
export function evaluateFeatureAttention(
  feature: EnrichedScientificFeature,
  graph?: ScientificRelationshipGraph,
  weights: AttentionWeights = DEFAULT_ATTENTION_WEIGHTS
): FeatureAttentionScore {
  // Hard eligibility gates
  if (!feature.eligibility.eligibleForSonification) {
    return {
      featureId: feature.stableFeatureId,
      totalScore: 0.0,
      priority: 'LOW',
      isEligible: false,
      rejectionReason: feature.eligibility.rejectionReason,
      components: { relevance: 0, confidence: 0, magnitude: 0, deviation: 0, temporalNovelty: 0, spatialImportance: 0, relationshipImportance: 0 }
    };
  }

  // 1. Scientific Relevance (R)
  let relevance = 0.6;
  if (feature.primaryRole === 'MAGNITUDE' || feature.primaryRole === 'STATE') relevance = 0.95;
  else if (feature.primaryRole === 'EVENT') relevance = 0.90;
  else if (feature.primaryRole === 'RATE' || feature.primaryRole === 'GRADIENT') relevance = 0.80;
  else if (feature.primaryRole === 'DISTRIBUTION') relevance = 0.85;

  // 2. Confidence (C)
  const confidence = calculateConfidence(feature);

  // 3. Magnitude Significance (M)
  let magnitude = 0.5;
  if (typeof feature.normalizedValue === 'number') {
    magnitude = Math.max(0, Math.min(1.0, feature.normalizedValue));
  } else if (typeof feature.observedValue === 'number' && feature.validRange) {
    const [min, max] = feature.validRange;
    magnitude = max > min ? Math.max(0, Math.min(1.0, (feature.observedValue - min) / (max - min))) : 0.5;
  }

  // 4. Deviation Significance (D)
  let deviation = 0.2;
  if (feature.primaryRole === 'DEVIATION' && typeof feature.observedValue === 'number') {
    deviation = Math.min(1.0, Math.abs(feature.observedValue));
  }

  // 5. Temporal Novelty (T)
  let temporalNovelty = 0.2;
  if (feature.primaryRole === 'RATE' || feature.primaryRole === 'EVENT') {
    temporalNovelty = 0.85;
  }

  // 6. Spatial Importance (S)
  let spatialImportance = 0.3;
  if (feature.dataType === 'spatial_grid') {
    spatialImportance = 0.85;
  }

  // 7. Relationship Importance (G)
  let relationshipImportance = 0.3;
  if (graph) {
    const connectedEdges = graph.getOutgoingEdges(feature.stableFeatureId).length + graph.getIncomingEdges(feature.stableFeatureId).length;
    relationshipImportance = Math.min(1.0, 0.2 + connectedEdges * 0.2);
  }

  // Multi-factor weighted sum: A_i
  const totalScore = parseFloat((
    weights.relevance * relevance +
    weights.confidence * confidence +
    weights.magnitude * magnitude +
    weights.deviation * deviation +
    weights.temporalNovelty * temporalNovelty +
    weights.spatialImportance * spatialImportance +
    weights.relationshipImportance * relationshipImportance
  ).toFixed(3));

  let priority: PriorityBand = 'LOW';
  if (totalScore >= 0.80) priority = 'CRITICAL';
  else if (totalScore >= 0.60) priority = 'HIGH';
  else if (totalScore >= 0.35) priority = 'MEDIUM';

  return {
    featureId: feature.stableFeatureId,
    totalScore,
    priority,
    isEligible: true,
    components: {
      relevance,
      confidence,
      magnitude,
      deviation,
      temporalNovelty,
      spatialImportance,
      relationshipImportance
    }
  };
}

/**
 * Analyzes redundancy and relationships between pairs of features to decide representation strategies.
 */
export function analyzeRedundancy(
  features: EnrichedScientificFeature[],
  graph?: ScientificRelationshipGraph
): RedundancyDecision[] {
  const decisions: RedundancyDecision[] = [];

  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const f1 = features[i];
      const f2 = features[j];

      // Exact mathematical identity
      if (f1.stableFeatureId === f2.stableFeatureId || f1.featureName === f2.featureName) {
        decisions.push({
          featureId: f1.stableFeatureId,
          relatedFeatureId: f2.stableFeatureId,
          redundancyClass: 'IDENTICAL',
          decision: 'MERGE',
          rationale: 'Features represent identical physical variables.'
        });
        continue;
      }

      // Derivation dependency (e.g. rate or anomaly derived from parent)
      if (f1.derivationHistory.includes(f2.stableFeatureId) || f2.derivationHistory.includes(f1.stableFeatureId)) {
        decisions.push({
          featureId: f1.stableFeatureId,
          relatedFeatureId: f2.stableFeatureId,
          redundancyClass: 'DERIVED',
          decision: 'GROUP',
          rationale: 'Derived feature complements parent measurement without duplicate voice allocation.'
        });
        continue;
      }

      // Complementary features (e.g. scalar magnitude + spatial grid)
      if (f1.dataType === 'scalar' && f2.dataType === 'spatial_grid') {
        decisions.push({
          featureId: f1.stableFeatureId,
          relatedFeatureId: f2.stableFeatureId,
          redundancyClass: 'COMPLEMENTARY',
          decision: 'GROUP',
          rationale: 'Scalar primary measurement and spatial regional grid form a coordinated multi-voice scene.'
        });
        continue;
      }

      // Independent features
      decisions.push({
        featureId: f1.stableFeatureId,
        relatedFeatureId: f2.stableFeatureId,
        redundancyClass: 'INDEPENDENT',
        decision: 'SEPARATE',
        rationale: 'Features carry independent physical dimensions.'
      });
    }
  }

  return decisions;
}
