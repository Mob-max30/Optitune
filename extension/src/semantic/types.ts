/**
 * Earth Jukebox (EJB) — Autonomous Semantic Mapping Engine Types
 *
 * Types for the automated mapping selector, candidate scoring, conflict detection,
 * and deterministic profile building.
 *
 * Updated for Amendment A: Distinct-by-Construction Sonification Algorithm.
 * Authored by Pranav K & Ujwal A.
 */

import type { AuditoryDimension, TargetVoiceId } from './mapping-knowledge-base';
import type { SourceProvenanceTier } from '../sfr/types';
import type { BaselineMode } from './normalization';
export type { BaselineMode };
import type { SourceIdentityTuple } from './signature';
import type { RoleAssignmentResult } from './salience';

export type MeaningClass = 'data' | 'context' | 'identity';

export interface ScoringWeights {
  wProvenance: number;       // w1: 0.20
  wConfidence: number;       // w2: 0.20
  wDistinction: number;      // w3: 0.20
  wInformation: number;      // w4: 0.15
  wComplexityPenalty: number; // w5: 0.25
  wSalience: number;         // w6: 0.20
  wDiversity: number;        // w7: 0.05
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  wProvenance: 0.20,
  wConfidence: 0.20,
  wDistinction: 0.20,
  wInformation: 0.15,
  wComplexityPenalty: 0.25,
  wSalience: 0.20,
  wDiversity: 0.05
};

export interface CandidateScore {
  mappingId: string;
  featureName: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  totalScore: number;
  components: {
    provenance: number;       // P(m) in [0, 1]
    confidence: number;       // C(m) in [0, 1]
    distinction: number;      // D(m) in [0, 1]
    information: number;      // I(m) in [0, 1]
    salience: number;         // Sal(m) in [0, 1]
    diversity: number;        // Div(m) in [0, 1]
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
  meaningClass: MeaningClass;
  paletteSlot?: string;
}

export interface LegendItem {
  featureName: string;
  scientificUnit: string;
  targetAuditoryDimension: AuditoryDimension;
  targetVoice: TargetVoiceId;
  verbalDescription: string;
  evidenceCitation: string;
  meaningClass: MeaningClass;
}

export interface OmittedMapping {
  featureName: string;
  mappingId?: string;
  reason: string;
}

export interface MappingProfile {
  profileId: string;
  sourceKey: string;
  phenomenonClass: string;
  name: string;
  version: string;
  isSilent: boolean;
  baselineMode: BaselineMode;
  identity: SourceIdentityTuple;
  palette: {
    id: string;
    variant: number;
    description: string;
  };
  roles: RoleAssignmentResult;
  activeMappings: ActiveMappingAssignment[];
  auditoryLegend: LegendItem[];
  omittedFeatures: OmittedMapping[];
  generatedAt: number;
  totalActiveVoices: number;
  weightsVersion: string;
  knowledgeBaseVersion: string;
}
