/**
 * Earth Jukebox (EJB) — Distinct-by-Construction Semantic Mapping Selector
 *
 * Implements Amendment A, Section A4, A7 & A8:
 * - Value-aware candidate scoring incorporating salience and diversity bonus
 * - Role allocation (top 3 salient features assigned to Foreground streams)
 * - Source identity tuple and phenomenon sound palette integration
 * - 12-second hysteresis with crossfade stability
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { ScientificFeatureFrame, ScientificFeature } from '../sfr/types';
import type { MappingProfile, ScoringWeights, ActiveMappingAssignment, CandidateScore, OmittedMapping } from './types';
import { DEFAULT_SCORING_WEIGHTS } from './types';
import { findCandidateMappings, getMappingById, SemanticMappingEntry } from './mapping-knowledge-base';
import { scoreCandidate } from './scoring';
import { checkMappingConflict } from './conflicts';
import { buildDeterministicMappingProfile, buildEmptySilentProfile } from './profile-builder';
import { globalNormalizer, type BaselineMode } from './normalization';
import { globalSalienceEngine } from './salience';
import { globalSignatureEngine } from './signature';

export interface SelectMappingsOptions {
  weights?: ScoringWeights;
  maxActiveVoices?: number;
  forceRebuild?: boolean;
}

export class AutonomousSemanticSelector {
  private cachedProfile: MappingProfile | null = null;
  private cachedDatasetId = '';
  private lastEvaluationTime = 0;
  private lastRoleRankingHash = '';
  private roleChangeStreak = 0;

  /**
   * Evaluates an incoming ScientificFeatureFrame and produces a deterministic MappingProfile.
   */
  selectMappings(
    frame: ScientificFeatureFrame | any,
    options: SelectMappingsOptions = {}
  ): MappingProfile {
    const weights = options.weights || DEFAULT_SCORING_WEIGHTS;
    const maxActiveVoices = options.maxActiveVoices || 4;
    const datasetId = frame.sourceId || frame.datasetId || 'earth-dataset';
    const timestamp = frame.timestamp || 0;
    const isSceneCut = Boolean(frame.metadata?.sceneCut || frame.metadata?.scene_cut);

    // ── Distinct-by-Construction: datasetId may be "<presetId>:<hash>" ──────
    // Extract the phenomenon class from the prefix (before the colon) so that
    // palette/scale selection remains scientifically correct, while the full
    // datasetId (including the unique hash suffix) drives identity uniqueness.
    const colonIdx = datasetId.indexOf(':');
    const phenomenonClass = frame.metadata?.phenomenonClass
      || (colonIdx > 0 ? datasetId.slice(0, colonIdx) : datasetId);
    // ────────────────────────────────────────────────────────────────────────
    let featureList: Array<ScientificFeature | any> = [];
    if (Array.isArray(frame.features)) {
      featureList = frame.features;
    } else if (frame.features && typeof frame.features === 'object') {
      featureList = Object.values(frame.features);
    }

    if (featureList.length === 0) {
      return buildEmptySilentProfile(datasetId);
    }

    // 1. A2 Reference-Relative Normalization & Z-Scores
    const normalizedFeatures: Array<{
      feature: ScientificFeature;
      name: string;
      zScore: number;
      confidence: number;
    }> = [];

    let primaryBaselineMode: BaselineMode = 'running';

    for (const f of featureList) {
      const name = f.featureName || f.name || f.featureId;
      if (!name) continue;

      const rawVal = typeof f.observedValue === 'number'
        ? f.observedValue
        : (typeof f.value === 'number' ? f.value : (f.normalizedValue ?? 0.5));

      const isCalibrated = Boolean(
        f.quality?.calibrationStatus === 'calibrated_direct' ||
        f.provenance?.provenanceTier === 1 ||
        f.provenance?.provenanceTier === 3
      );

      const normResult = globalNormalizer.normalize(datasetId, phenomenonClass, name, rawVal, isCalibrated);
      if (normResult.baselineMode === 'physical_reference') {
        primaryBaselineMode = 'physical_reference';
      }

      normalizedFeatures.push({
        feature: f,
        name,
        zScore: normResult.zScore,
        confidence: f.quality?.confidenceScore ?? 0.80
      });
    }

    // 2. A4 Salience & Role Assignment
    const roleResult = globalSalienceEngine.evaluateRoles(
      datasetId,
      phenomenonClass,
      normalizedFeatures.map(nf => ({
        featureName: nf.name,
        zScore: nf.zScore,
        confidence: nf.confidence
      }))
    );

    // Hysteresis Check (Section A8):
    // Rebuild on source load, on scene cut, otherwise at most every 12s and only if role ranking changed for 2 consecutive evaluations
    const isNewSource = !this.cachedDatasetId || this.cachedDatasetId !== datasetId;
    const currentRankingHash = roleResult.foreground.join(',');
    if (this.cachedProfile && !options.forceRebuild && !isSceneCut && !isNewSource) {
      const timeSinceLast = timestamp - this.lastEvaluationTime;
      if (timeSinceLast < 12.0) {
        if (currentRankingHash !== this.lastRoleRankingHash) {
          this.roleChangeStreak++;
          if (this.roleChangeStreak < 2) {
            return this.cachedProfile; // Hold profile until hysteresis confirmed
          }
        } else {
          this.roleChangeStreak = 0;
          return this.cachedProfile;
        }
      }
    }

    this.cachedDatasetId = datasetId;
    this.lastEvaluationTime = timestamp;
    this.lastRoleRankingHash = currentRankingHash;
    this.roleChangeStreak = 0;

    // 3. A5 Source Signature & Identity Tuple
    const quantizedVector = roleResult.salienceList.slice(0, 3).map(s => Math.round(s.salience * 10));
    const identity = globalSignatureEngine.generateIdentity(
      datasetId,
      phenomenonClass,
      frame.metadata?.colormapFingerprint || 'standard',
      quantizedVector
    );

    // 4. A7 Candidate Scoring: S(m) = w1*P + w2*C + w3*D + w4*I + w6*Sal + w7*Div - w5*K
    interface ScoredCandidateEntry {
      feature: ScientificFeature | any;
      mapping: SemanticMappingEntry;
      score: CandidateScore;
      salience: number;
    }

    const allCandidates: ScoredCandidateEntry[] = [];
    const omittedFeatures: OmittedMapping[] = [];

    for (const nf of normalizedFeatures) {
      const candidates = findCandidateMappings(nf.name);
      const salScore = roleResult.salienceMap.get(nf.name)?.salience ?? 0.5;

      if (candidates.length === 0) {
        omittedFeatures.push({ featureName: nf.name, reason: 'No matching perceptual mapping in knowledge base' });
        continue;
      }

      for (const mapping of candidates) {
        const score = scoreCandidate(nf.feature, mapping, [], weights, salScore / 10.0);
        allCandidates.push({
          feature: nf.feature,
          mapping,
          score,
          salience: salScore
        });
      }
    }

    // Deterministic Sort: Higher total score, then higher Sal, then lower mappingId
    allCandidates.sort((a, b) => {
      if (Math.abs(b.score.totalScore - a.score.totalScore) > 0.001) {
        return b.score.totalScore - a.score.totalScore;
      }
      if (Math.abs(b.salience - a.salience) > 0.001) {
        return b.salience - a.salience;
      }
      return a.mapping.mappingId.localeCompare(b.mapping.mappingId);
    });

    // 5. A8 Incremental Allocation (Foreground roles first, up to max active voices)
    const activeAssignments: ActiveMappingAssignment[] = [];
    const assignedFeatures = new Set<string>();

    for (const cand of allCandidates) {
      if (activeAssignments.length >= maxActiveVoices) break;

      const mapping = cand.mapping;
      const fName = cand.feature.featureName || cand.feature.name || mapping.matchingFeaturePatterns[0];

      // Exclusivity: one mapping per feature
      if (assignedFeatures.has(fName)) continue;

      // Check conflict
      const conflict = checkMappingConflict(mapping, activeAssignments);
      if (conflict.hasConflict) {
        omittedFeatures.push({ featureName: fName, mappingId: mapping.mappingId, reason: conflict.reason || 'Conflict' });
        continue;
      }

      // Re-score with existing assignments to account for complexity penalty and diversity bonus
      const reScore = scoreCandidate(cand.feature, mapping, activeAssignments, weights, cand.salience / 10.0);
      if (reScore.totalScore < 0.15) {
        omittedFeatures.push({ featureName: fName, mappingId: mapping.mappingId, reason: 'Candidate score below abstention threshold (0.15)' });
        continue;
      }

      activeAssignments.push({
        mappingId: mapping.mappingId,
        featureName: fName,
        targetAuditoryDimension: mapping.targetAuditoryDimension,
        targetVoice: mapping.targetVoice,
        scalingFunction: mapping.scalingFunction,
        provenanceTier: cand.feature.provenanceTier ?? cand.feature.provenance?.provenanceTier ?? (cand.feature.provenance?.sourceType === 'tier1_direct_binary' ? 1 : cand.feature.provenance?.sourceType === 'tier2_curated_table' ? 2 : cand.feature.provenance?.sourceType === 'tier3_calibrated_visual' ? 3 : 4),
        score: reScore.totalScore,
        verbalDescription: mapping.verbalDescription,
        meaningClass: mapping.meaningClass || 'data',
        paletteSlot: mapping.paletteSlot
      });

      assignedFeatures.add(fName);
    }

    // 6. Build Deterministic Profile
    const profile = buildDeterministicMappingProfile({
      sourceKey: datasetId,
      phenomenonClass,
      identity,
      roles: roleResult,
      baselineMode: primaryBaselineMode,
      activeMappings: activeAssignments,
      omittedFeatures,
      timestamp
    });

    this.cachedProfile = profile;
    return profile;
  }

  clear(): void {
    this.cachedProfile = null;
    this.cachedDatasetId = '';
    this.lastEvaluationTime = 0;
    this.lastRoleRankingHash = '';
    this.roleChangeStreak = 0;
  }
}

export const globalSemanticSelector = new AutonomousSemanticSelector();

/**
 * Functional wrapper conforming to standard selector interface.
 */
export function selectAutonomousMappings(
  frame: ScientificFeatureFrame | any,
  options: SelectMappingsOptions = {}
): MappingProfile {
  return globalSemanticSelector.selectMappings(frame, options);
}
