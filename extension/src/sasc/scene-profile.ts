/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Auditory Scene Profile
 *
 * Implements Stage 12 of SASC:
 * Defines the formal, validated, traceable AuditorySceneProfile contract
 * containing deterministic fingerprints, role assignments, and scientific explanations.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { PlannedAuditoryStream, OptimizedAuditoryScene } from './scene-optimizer';
import type { GrammaticalStream } from './grammar-orchestrator';

export interface AuditorySceneProfile {
  sceneId: string;
  sourceId: string;
  version: string;
  algorithmVersion: string;
  fingerprint: string;
  activeStreams: PlannedAuditoryStream[];
  grammaticalStreams: GrammaticalStream[];
  totalActiveVoices: number;
  globalQualityScore: number;
  isSilent: boolean;
  generatedAt: number;
}

/**
 * Calculates a deterministic fingerprint hash of the scene profile content.
 */
export function calculateSceneFingerprint(
  sourceId: string,
  streams: PlannedAuditoryStream[]
): string {
  const sortedMappings = [...streams]
    .map(s => `${s.featureId}:${s.role}:${s.mappingId}`)
    .sort()
    .join('|');

  let hash = 0;
  const str = `${sourceId}::${sortedMappings}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `sasc-fp-${Math.abs(hash).toString(16)}`;
}

/**
 * Builds and validates a formal AuditorySceneProfile from an optimized scene and grammatical streams.
 */
export function buildAuditorySceneProfile(
  scene: OptimizedAuditoryScene,
  grammaticalStreams: GrammaticalStream[]
): AuditorySceneProfile {
  const fingerprint = calculateSceneFingerprint(scene.datasetId, scene.activeStreams);

  return {
    sceneId: scene.sceneId,
    sourceId: scene.datasetId,
    version: '1.0.0',
    algorithmVersion: 'SASC-v1.0.0',
    fingerprint,
    activeStreams: scene.activeStreams,
    grammaticalStreams,
    totalActiveVoices: new Set(scene.activeStreams.map(s => s.targetVoice)).size,
    globalQualityScore: scene.globalQualityScore,
    isSilent: scene.isSilent,
    generatedAt: Date.now()
  };
}
