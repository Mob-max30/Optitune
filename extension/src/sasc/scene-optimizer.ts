/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Auditory Role Allocator & Constrained Scene Optimizer
 *
 * Implements Stages 7, 8, and 9 of SASC:
 * Allocates 6 Principal Auditory Roles (ANCHOR, STATE, STRUCTURE, DYNAMICS, EVENTS, CONFIDENCE),
 * generates candidate mappings from the Perceptual Knowledge Base, and evaluates global
 * scene optimization Q(M) with deterministic tie-breaking.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EnrichedScientificFeature } from './ontology';
import type { FeatureAttentionScore } from './attention-engine';
import { MAPPING_KNOWLEDGE_BASE, type SemanticMappingEntry, type TargetVoiceId, type AuditoryDimension } from '../semantic/mapping-knowledge-base';
import { checkMappingConflict } from '../semantic/conflicts';

export type AuditoryRole =
  | 'SCIENTIFIC_ANCHOR'
  | 'STATE'
  | 'STRUCTURE'
  | 'DYNAMICS'
  | 'EVENTS'
  | 'CONFIDENCE';

export interface PlannedAuditoryStream {
  featureId: string;
  featureName: string;
  role: AuditoryRole;
  mappingId: string;
  targetVoice: TargetVoiceId;
  targetAuditoryDimension: AuditoryDimension;
  scalingFunction: string;
  score: number;
  verbalDescription: string;
}

export interface OptimizedAuditoryScene {
  sceneId: string;
  datasetId: string;
  activeStreams: PlannedAuditoryStream[];
  suppressedFeatures: string[];
  totalVoiceBudget: number;
  globalQualityScore: number;
  isSilent: boolean;
}

export interface SceneOptimizationOptions {
  maxVoices?: number;
  minAttentionThreshold?: number;
}

/**
 * Maps a scientific feature's primary role to its most intuitive Auditory Role.
 */
export function mapScientificRoleToAuditoryRole(feature: EnrichedScientificFeature): AuditoryRole {
  switch (feature.primaryRole) {
    case 'STATE':
    case 'MAGNITUDE':
      return 'STATE';
    case 'DISTRIBUTION':
    case 'GRADIENT':
    case 'SPATIAL_RELATIONSHIP':
      return 'STRUCTURE';
    case 'RATE':
    case 'ACCELERATION':
    case 'FLUX':
    case 'PERIODICITY':
      return 'DYNAMICS';
    case 'EVENT':
    case 'THRESHOLD':
      return 'EVENTS';
    case 'UNCERTAINTY':
      return 'CONFIDENCE';
    default:
      return 'SCIENTIFIC_ANCHOR';
  }
}

/**
 * Optimizes the overall scientific auditory scene using constrained deterministic allocation.
 */
export function optimizeAuditoryScene(
  features: EnrichedScientificFeature[],
  attentionScores: Map<string, FeatureAttentionScore>,
  options: SceneOptimizationOptions = {}
): OptimizedAuditoryScene {
  const maxVoices = options.maxVoices ?? 5;
  const minThreshold = options.minAttentionThreshold ?? 0.25;
  const datasetId = features[0]?.scientificPhenomenon ?? 'earth-phenomenon';

  // 1. Filter and sort features by descending attention score, with deterministic tie-breaking by ID
  const eligibleFeatures = features.filter(f => {
    const score = attentionScores.get(f.stableFeatureId);
    return score && score.isEligible && score.totalScore >= minThreshold;
  });

  eligibleFeatures.sort((a, b) => {
    const scoreA = attentionScores.get(a.stableFeatureId)?.totalScore ?? 0;
    const scoreB = attentionScores.get(b.stableFeatureId)?.totalScore ?? 0;
    if (Math.abs(scoreB - scoreA) > 0.0001) {
      return scoreB - scoreA;
    }
    return a.stableFeatureId.localeCompare(b.stableFeatureId);
  });

  if (eligibleFeatures.length === 0) {
    return {
      sceneId: `scene-silent-${datasetId}`,
      datasetId,
      activeStreams: [],
      suppressedFeatures: features.map(f => f.stableFeatureId),
      totalVoiceBudget: maxVoices,
      globalQualityScore: 0.0,
      isSilent: true
    };
  }

  // 2. Candidate mapping matching & conflict resolution
  const activeStreams: PlannedAuditoryStream[] = [];
  const assignedVoices = new Set<TargetVoiceId>();
  const assignedDimensions = new Set<AuditoryDimension>();
  const suppressedFeatures: string[] = [];

  for (const feature of eligibleFeatures) {
    const attention = attentionScores.get(feature.stableFeatureId)!;
    const auditoryRole = mapScientificRoleToAuditoryRole(feature);

    // Find candidate mappings from knowledge base
    const candidates = MAPPING_KNOWLEDGE_BASE.filter(entry => {
      // Check feature pattern
      const name = feature.featureName.toLowerCase();
      const matchesPattern = entry.matchingFeaturePatterns.some(p => name.includes(p.toLowerCase()));
      return matchesPattern || (feature.dataType === 'event' && entry.targetAuditoryDimension === 'transient_percussion')
        || (feature.dataType === 'spatial_grid' && entry.targetAuditoryDimension === 'latitudinal_voicing');
    });

    // Score candidates against auditory role suitability
    let bestCandidate: SemanticMappingEntry | null = null;
    let bestCandidateScore = -1;

    for (const c of candidates) {
      // Voice & dimension collision check
      if (assignedDimensions.has(c.targetAuditoryDimension)) continue;
      if (assignedVoices.size >= maxVoices && !assignedVoices.has(c.targetVoice)) continue;

      const score = attention.totalScore * (c.evidenceLevel === 'strong_empirical' ? 1.0 : 0.85);
      if (score > bestCandidateScore) {
        bestCandidateScore = score;
        bestCandidate = c;
      }
    }

    if (bestCandidate) {
      activeStreams.push({
        featureId: feature.stableFeatureId,
        featureName: feature.featureName,
        role: auditoryRole,
        mappingId: bestCandidate.mappingId,
        targetVoice: bestCandidate.targetVoice,
        targetAuditoryDimension: bestCandidate.targetAuditoryDimension,
        scalingFunction: bestCandidate.scalingFunction,
        score: parseFloat(bestCandidateScore.toFixed(3)),
        verbalDescription: bestCandidate.verbalDescription
      });

      assignedVoices.add(bestCandidate.targetVoice);
      assignedDimensions.add(bestCandidate.targetAuditoryDimension);
    } else {
      suppressedFeatures.push(feature.stableFeatureId);
    }
  }

  // Calculate global quality score: Q(M) = sum(score) - overlaps
  const sumScores = activeStreams.reduce((acc, s) => acc + s.score, 0);
  const globalQualityScore = parseFloat(sumScores.toFixed(3));

  return {
    sceneId: `scene-${datasetId}-${Date.now().toString(16)}`,
    datasetId,
    activeStreams,
    suppressedFeatures,
    totalVoiceBudget: maxVoices,
    globalQualityScore,
    isSilent: activeStreams.length === 0
  };
}
