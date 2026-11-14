/**
 * Earth Jukebox (EJB) — Mapping Profile Builder
 *
 * Deterministically constructs and versions MappingProfile objects with complete auditory legends.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { ScientificFeatureFrame, ScientificFeature } from '../sfr/types';
import type { ActiveMappingAssignment, LegendItem, MappingProfile } from './types';
import { getMappingById } from './mapping-knowledge-base';

function findFeatureInFrame(frame: ScientificFeatureFrame | any, featureName: string): ScientificFeature | any | undefined {
  if (Array.isArray(frame.features)) {
    return frame.features.find((f: any) => f.featureName === featureName || f.featureId === featureName || f.name === featureName);
  }
  if (frame.features && typeof frame.features === 'object') {
    return frame.features[featureName];
  }
  return undefined;
}

export function buildDeterministicProfileId(datasetId: string, assignments: ActiveMappingAssignment[]): string {
  const sortedMappings = [...assignments].map(a => `${a.featureName}:${a.mappingId}`).sort().join('|');
  let hash = 0;
  const str = `${datasetId}::${sortedMappings}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `profile-${Math.abs(hash).toString(16)}`;
}

export function buildAuditoryLegend(
  frame: ScientificFeatureFrame | any,
  assignments: ActiveMappingAssignment[]
): LegendItem[] {
  const legend: LegendItem[] = [];

  for (const a of assignments) {
    const feature = findFeatureInFrame(frame, a.featureName);
    const mapping = getMappingById(a.mappingId);

    legend.push({
      featureName: a.featureName,
      scientificUnit: feature ? feature.unit : 'unitless',
      targetAuditoryDimension: a.targetAuditoryDimension,
      targetVoice: a.targetVoice,
      verbalDescription: a.verbalDescription,
      evidenceCitation: mapping ? mapping.literatureCitation : 'NASA Space Apps Challenge 2026'
    });
  }

  return legend;
}

export function buildEmptySilentProfile(datasetId = 'unknown'): MappingProfile {
  return {
    profileId: `profile-silent-${datasetId}`,
    name: 'Safe Silent/Idle Profile',
    version: '1.0.0',
    isSilent: true,
    activeMappings: [],
    auditoryLegend: [],
    generatedAt: Date.now(),
    totalActiveVoices: 0
  };
}

export function buildMappingProfile(
  frame: ScientificFeatureFrame | any,
  assignments: ActiveMappingAssignment[]
): MappingProfile {
  const datasetId = frame.sourceId || frame.datasetId || 'earth-dataset';

  if (assignments.length === 0) {
    return buildEmptySilentProfile(datasetId);
  }

  const profileId = buildDeterministicProfileId(datasetId, assignments);
  const legend = buildAuditoryLegend(frame, assignments);
  const uniqueVoices = new Set(assignments.map(a => a.targetVoice));

  return {
    profileId,
    name: `Autonomous Profile: ${datasetId}`,
    version: '1.0.0',
    isSilent: false,
    activeMappings: assignments,
    auditoryLegend: legend,
    generatedAt: Date.now(),
    totalActiveVoices: uniqueVoices.size
  };
}
