/**
 * Earth Jukebox (EJB) — Mapping Profile Builder (Amendment A, Section A8)
 *
 * Constructs a fully deterministic, versioned MappingProfile combining:
 * - Data Class: Active feature-to-voice mappings
 * - Context Class: Phenomenon sound palette and variant
 * - Identity Class: Stable source signature (tonic, scale, groove, motif)
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { MappingProfile, ActiveMappingAssignment, LegendItem, OmittedMapping, BaselineMode } from './types';
import type { SourceIdentityTuple } from './signature';
import type { RoleAssignmentResult } from './salience';
import { PALETTE_DECLARATIONS, type PaletteClassId } from '../audio/synths/palette-voice';

export interface BuildProfileOptions {
  sourceKey: string;
  phenomenonClass: string;
  identity: SourceIdentityTuple;
  roles: RoleAssignmentResult;
  baselineMode?: BaselineMode;
  activeMappings: ActiveMappingAssignment[];
  omittedFeatures?: OmittedMapping[];
  timestamp?: number;
}

export function buildDeterministicMappingProfile(options: BuildProfileOptions): MappingProfile {
  const {
    sourceKey,
    phenomenonClass,
    identity,
    roles,
    baselineMode = 'running',
    activeMappings,
    omittedFeatures = [],
    timestamp = 0
  } = options;

  // Resolve phenomenon palette
  let palClass: PaletteClassId = 'generic_earth';
  if (phenomenonClass.includes('fire') || phenomenonClass.includes('thermal')) palClass = 'fire';
  else if (phenomenonClass.includes('sst') || phenomenonClass.includes('ocean')) palClass = 'ocean';
  else if (phenomenonClass.includes('aerosol') || phenomenonClass.includes('river')) palClass = 'atmosphere';
  else if (phenomenonClass.includes('air-quality')) palClass = 'air_quality';
  else if (phenomenonClass.includes('night')) palClass = 'night_lights';
  else if (phenomenonClass.includes('canopy') || phenomenonClass.includes('gedi')) palClass = 'biosphere';
  else if (phenomenonClass.includes('lightning')) palClass = 'lightning';
  else if (phenomenonClass.includes('co2') || phenomenonClass.includes('carbon')) palClass = 'carbon';
  else if (phenomenonClass.includes('ice') || phenomenonClass.includes('antarctica')) palClass = 'cryosphere';

  const palDecl = PALETTE_DECLARATIONS[palClass] || PALETTE_DECLARATIONS.generic_earth;
  const palette = {
    id: palDecl.id,
    variant: identity.paletteVariant,
    description: palDecl.description
  };

  // Build auditory legend (1:1 with activeMappings)
  const auditoryLegend: LegendItem[] = activeMappings.map(m => ({
    featureName: m.featureName,
    scientificUnit: 'calibrated',
    targetAuditoryDimension: m.targetAuditoryDimension,
    targetVoice: m.targetVoice,
    verbalDescription: m.verbalDescription,
    evidenceCitation: 'NASA EJB Evidence Base (2026)',
    meaningClass: m.meaningClass || 'data'
  }));

  // Unique target voices active
  const uniqueVoices = new Set(activeMappings.map(m => m.targetVoice));
  uniqueVoices.add('palette_voice');

  const profileId = `profile:${sourceKey}:${identity.signature.slice(0, 8)}`;

  return {
    profileId,
    sourceKey,
    phenomenonClass,
    name: `Earth Jukebox Profile: ${sourceKey}`,
    version: '1.1.0',
    isSilent: activeMappings.length === 0,
    baselineMode,
    identity,
    palette,
    roles,
    activeMappings,
    auditoryLegend,
    omittedFeatures,
    generatedAt: timestamp,
    totalActiveVoices: uniqueVoices.size,
    weightsVersion: '1.1.0',
    knowledgeBaseVersion: '1.1.0'
  };
}

export function buildEmptySilentProfile(datasetId: string): MappingProfile {
  return {
    profileId: `profile:${datasetId}:silent`,
    sourceKey: datasetId,
    phenomenonClass: 'generic-earth',
    name: `Silent Profile: ${datasetId}`,
    version: '1.1.0',
    isSilent: true,
    baselineMode: 'neutral',
    identity: {
      signature: '0000000000000000',
      sourceKey: datasetId,
      phenomenonClass: 'generic-earth',
      tonic: 'C3',
      scaleId: 'dorian',
      grooveTemplate: 'groove.steady_4_4',
      paletteVariant: 0,
      motifId: 'motif.rising_triad',
      tempoBase: 80,
      registerBase: 'madhya'
    },
    palette: {
      id: 'generic_earth',
      variant: 0,
      description: 'Neutral silence'
    },
    roles: {
      foreground: ['none', 'none', 'none'],
      background: [],
      salienceMap: new Map(),
      salienceList: []
    },
    activeMappings: [],
    auditoryLegend: [],
    omittedFeatures: [{ featureName: 'all', reason: 'Empty feature frame' }],
    generatedAt: 0,
    totalActiveVoices: 0,
    weightsVersion: '1.1.0',
    knowledgeBaseVersion: '1.1.0'
  };
}
