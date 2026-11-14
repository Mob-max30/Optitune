/**
 * Earth Jukebox (EJB) — Mapping Profile Validator
 *
 * Validates generated MappingProfile instances against voice limits,
 * parameter exclusivity, and auditory legend consistency.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { MappingProfile } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateMappingProfile(profile: MappingProfile): ValidationResult {
  const errors: string[] = [];

  if (!profile.profileId || typeof profile.profileId !== 'string') {
    errors.push('Profile profileId must be a non-empty string.');
  }

  if (!profile.version || typeof profile.version !== 'string') {
    errors.push('Profile version must be a valid version string.');
  }

  // Silent profile is always valid
  if (profile.isSilent) {
    if (profile.activeMappings.length > 0) {
      errors.push('Silent profile must have 0 active mappings.');
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check active mappings
  const seenVoiceDimensions = new Set<string>();
  const activeVoices = new Set<string>();

  for (const m of profile.activeMappings) {
    if (!m.mappingId || !m.featureName) {
      errors.push(`Invalid mapping assignment: missing mappingId or featureName.`);
    }

    const key = `${m.targetVoice}::${m.targetAuditoryDimension}`;
    if (seenVoiceDimensions.has(key)) {
      errors.push(`Duplicate auditory parameter assignment: '${m.targetAuditoryDimension}' on voice '${m.targetVoice}'.`);
    }
    seenVoiceDimensions.add(key);
    activeVoices.add(m.targetVoice);
  }

  if (activeVoices.size > 4) {
    errors.push(`Auditory stream limit exceeded: profile has ${activeVoices.size} active voices (maximum 4).`);
  }

  // Check legend consistency
  if (profile.auditoryLegend.length !== profile.activeMappings.length) {
    errors.push(
      `Auditory legend length (${profile.auditoryLegend.length}) does not match active mappings length (${profile.activeMappings.length}).`
    );
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
