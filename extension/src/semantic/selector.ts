/**
 * Earth Jukebox (EJB) — Autonomous Semantic Mapping Selector
 *
 * Automatically inspects a ScientificFeatureFrame, queries the mapping knowledge base,
 * scores candidate mappings against psychoacoustic and provenance criteria, resolves conflicts,
 * and outputs a deterministic MappingProfile in <5ms.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { ScientificFeatureFrame, ScientificFeature } from '../sfr/types';
import type { MappingProfile, ScoringWeights, ActiveMappingAssignment, CandidateScore } from './types';
import { DEFAULT_SCORING_WEIGHTS } from './types';
import { findCandidateMappings, getMappingById } from './mapping-knowledge-base';
import { scoreCandidate } from './scoring';
import { checkMappingConflict } from './conflicts';
import { buildMappingProfile, buildEmptySilentProfile } from './profile-builder';
import { validateMappingProfile } from './validator';

export interface SelectMappingsOptions {
  weights?: ScoringWeights;
  maxActiveVoices?: number;
}

/**
 * Autonomous Semantic Mapping Selector
 * Evaluates an incoming ScientificFeatureFrame and produces a conflict-free MappingProfile.
 */
export function selectAutonomousMappings(
  frame: ScientificFeatureFrame | any,
  options: SelectMappingsOptions = {}
): MappingProfile {
  const weights = options.weights || DEFAULT_SCORING_WEIGHTS;
  const datasetId = frame.sourceId || frame.datasetId || 'earth-dataset';

  // Extract feature list regardless of whether frame.features is an Array or Dictionary
  let featureList: Array<ScientificFeature | any> = [];
  if (Array.isArray(frame.features)) {
    featureList = frame.features;
  } else if (frame.features && typeof frame.features === 'object') {
    featureList = Object.values(frame.features);
  }

  // Handle empty frame
  if (featureList.length === 0) {
    return buildEmptySilentProfile(datasetId);
  }

  // 1. Collect and score all candidate mappings for every present feature
  interface ScoredCandidateEntry {
    feature: ScientificFeature | any;
    mappingId: string;
    score: CandidateScore;
  }

  const allScoredCandidates: ScoredCandidateEntry[] = [];

  for (const feature of featureList) {
    const featureName = feature.featureName || feature.name;
    if (!featureName) continue;

    const candidates = findCandidateMappings(featureName, feature.scientificDimension);
    for (const mapping of candidates) {
      const score = scoreCandidate(feature, mapping, [], weights);
      allScoredCandidates.push({
        feature,
        mappingId: mapping.mappingId,
        score
      });
    }
  }

  // 2. Sort candidates descending by total score, with deterministic tie-breaking by mappingId
  allScoredCandidates.sort((a, b) => {
    if (Math.abs(b.score.totalScore - a.score.totalScore) > 0.0001) {
      return b.score.totalScore - a.score.totalScore;
    }
    return a.mappingId.localeCompare(b.mappingId);
  });

  // 3. Incrementally select candidates without conflict
  const activeAssignments: ActiveMappingAssignment[] = [];

  for (const candidate of allScoredCandidates) {
    const mapping = getMappingById(candidate.mappingId);
    if (!mapping) continue;

    // Check if adding this mapping creates a conflict
    const conflictResult = checkMappingConflict(mapping, activeAssignments);
    if (conflictResult.hasConflict) {
      continue; // Skip conflicting mapping
    }

    // Re-score with existing assignments to account for complexity penalty K(m)
    const reScore = scoreCandidate(candidate.feature, mapping, activeAssignments, weights);
    if (reScore.totalScore < 0.15) {
      continue; // Score too low after penalty
    }

    const featureName = candidate.feature.featureName || candidate.feature.name;
    const provenanceTier = candidate.feature.provenance?.sourceType ?? candidate.feature.provenanceTier ?? 4;

    activeAssignments.push({
      mappingId: mapping.mappingId,
      featureName,
      targetAuditoryDimension: mapping.targetAuditoryDimension,
      targetVoice: mapping.targetVoice,
      scalingFunction: mapping.scalingFunction,
      provenanceTier,
      score: reScore.totalScore,
      verbalDescription: mapping.verbalDescription
    });
  }

  // 4. Build deterministic profile
  const profile = buildMappingProfile(frame, activeAssignments);

  // 5. Validate profile
  const validation = validateMappingProfile(profile);
  if (!validation.isValid) {
    console.warn('[Semantic Selector] Validation warnings on generated profile:', validation.errors);
  }

  return profile;
}
