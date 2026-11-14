/**
 * Earth Jukebox (EJB) — Semantic Mapping Conflict & Collision Detector
 *
 * Prevents auditory masking, parameter collisions, and voice over-allocation.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { SemanticMappingEntry } from './mapping-knowledge-base';
import type { ActiveMappingAssignment } from './types';

export interface ConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
  conflictingAssignment?: ActiveMappingAssignment;
}

/**
 * Checks whether a candidate mapping conflicts with any currently active assignments.
 */
export function checkMappingConflict(
  candidate: SemanticMappingEntry,
  activeAssignments: ActiveMappingAssignment[]
): ConflictCheckResult {
  for (const active of activeAssignments) {
    // 1. Exact parameter collision on the same voice
    if (
      active.targetVoice === candidate.targetVoice &&
      active.targetAuditoryDimension === candidate.targetAuditoryDimension
    ) {
      return {
        hasConflict: true,
        reason: `Parameter collision: Voice '${candidate.targetVoice}' already has dimension '${candidate.targetAuditoryDimension}' assigned to feature '${active.featureName}'.`,
        conflictingAssignment: active
      };
    }

    // 2. Explicit conflict list declared in mapping entry
    if (candidate.conflictsWith.includes(active.targetAuditoryDimension) && active.targetVoice === candidate.targetVoice) {
      return {
        hasConflict: true,
        reason: `Explicit conflict constraint: Mapping '${candidate.mappingId}' conflicts with active dimension '${active.targetAuditoryDimension}' on voice '${active.targetVoice}'.`,
        conflictingAssignment: active
      };
    }
  }

  // 3. Polyphony limits per voice
  const voiceAssignments = activeAssignments.filter(a => a.targetVoice === candidate.targetVoice);
  if (candidate.targetVoice === 'lead_voice' && voiceAssignments.length >= 3) {
    return {
      hasConflict: true,
      reason: `Voice limit exceeded: 'lead_voice' already has ${voiceAssignments.length} simultaneous active parameter modulations.`
    };
  }

  // 4. Global active voice limit (Bregman ASA limit: max 4 auditory streams simultaneously)
  const activeVoices = new Set(activeAssignments.map(a => a.targetVoice));
  if (!activeVoices.has(candidate.targetVoice) && activeVoices.size >= 4) {
    return {
      hasConflict: true,
      reason: `Auditory stream limit exceeded: Maximum 4 concurrent auditory streams allowed to prevent acoustic clutter.`
    };
  }

  return { hasConflict: false };
}
