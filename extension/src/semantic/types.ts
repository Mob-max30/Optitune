/**
 * Earth Jukebox (EJB) — Autonomous Semantic Mapping Engine Types
 *
 * Types for the automated mapping selector, candidate scoring, conflict detection,
 * and deterministic profile building.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { AuditoryDimension, TargetVoiceId, EvidenceLevel } from './mapping-knowledge-base';
import type { ScientificFeature, SourceProvenanceTier } from '../sfr/types';

export interface ScoringWeights {
  wProvenance: number; // w1: weight for provenance tier (Tier 1 > Tier 4)
  wConfidence: number; // w2: weight for psychoacoustic literature evidence
  wDistinction: number; // w3: weight for dimensional naturalness / crossmodal fit
  wInformation: number; // w4: weight for feature informational salience & dynamic range
  wComplexityPenalty: number; // w5: penalty for cognitive overload and voice crowding
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  wProvenance: 0.35,
  wConfidence: 0.25,
  wDistinction: 0.20,
  wInformation: 0.15,
  wComplexityPenalty: 0.05
};

export interface CandidateScore {
  mappingId: string;
  featureName: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  totalScore: number;
  components: {
    provenance: number; // P(m) in [0, 1]
    confidence: number; // C(m) in [0, 1]
    distinction: number; // D(m) in [0, 1]
    information: number; // I(m) in [0, 1]
    complexityPenalty: number; // K(m) in [0, 1]
  };
}

export interface ActiveMappingAssignment {
  mappingId: string;
  featureName: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  scalingFunction: string;
  provenanceTier: SourceProvenanceTier | number | string;
  score: number;
  verbalDescription: string;
}

export interface LegendItem {
  featureName: string;
  scientificUnit: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  verbalDescription: string;
  evidenceCitation: string;
}

export interface MappingProfile {
  profileId: string;
  name: string;
  version: string;
  isSilent: boolean;
  activeMappings: ActiveMappingAssignment[];
  auditoryLegend: LegendItem[];
  generatedAt: number;
  totalActiveVoices: number;
}
