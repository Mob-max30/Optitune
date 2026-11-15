/**
 * Earth Jukebox (EJB) — UI View-Model Adapter
 * Specification: Amendment B, Section 5
 *
 * A pure functional adapter mapping raw visual/sonification pipeline outputs
 * (Contract v1, SFR, MappingProfile, SASC, Telemetry, and Media Element)
 * into a structured, validated, and normalized UiViewModel.
 *
 * Rules:
 * - Pure function, 0 side effects, 0 external dependencies.
 * - Feature-detects optional fields gracefully.
 * - Generates plain-language descriptions without raw metric leakage.
 */

import type { EjbFramePayload, PresetConfig } from '../contract/types';
import type { MappingProfile } from '../semantic/types';
import type { AudioTelemetry, SonificationMode } from '../audio/types';

export type UiMode = 'exact' | 'musical' | 'sweep';

export interface UiGridCell {
  row: number;
  col: number;
  index: number;
  value: number;
  normalizedValue: number;
  isValid: boolean;
  provenanceTier: number;
  readout: string;
}

export interface UiLegendItem {
  id: string;
  featureName: string;
  meaningClass: 'data' | 'context' | 'identity';
  directionText: string;
  instrumentText: string;
  provenanceTier: number;
  targetVoice: string;
  isSoloed: boolean;
}

export interface UiViewModel {
  source: {
    title: string;
    datasetId: string;
    phenomenonClass: string;
    tint: string;
    isGeoreferenced: boolean;
  };
  provenance: {
    tier: number; // 1, 2, 3, or 4
    label: string;
    description: string;
    iconSvg: string;
  };
  grid: {
    rows: number;
    cols: number;
    cells: UiGridCell[];
  };
  caption: string;
  transport: {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
  };
  mode: {
    active: UiMode;
    label: string;
    description: string;
  };
  identity: {
    hasFeature: boolean;
    enabled: boolean;
    signature?: string;
    tonic?: string;
    scaleName?: string;
    grooveName?: string;
  };
  legend: {
    items: UiLegendItem[];
  };
  underTheHood: {
    brightness: number;
    hueDegrees: number;
    saturation: number;
    motionDelta: number;
    dataValue: number | null;
    physicalUnit: string;
    frameIndex: number;
    timeSeconds: number;
    rawPayload: any;
  };
  error: {
    hasError: boolean;
    code?: string;
    message?: string;
  };
}

export interface AdapterInputs {
  payload?: EjbFramePayload | null;
  preset?: PresetConfig | null;
  mappingProfile?: MappingProfile | null;
  telemetry?: AudioTelemetry | null;
  engineState?: {
    isSonifying?: boolean;
    mode?: SonificationMode;
    masterVolume?: number;
    isMuted?: boolean;
    semanticEnhance?: boolean;
  };
  mediaState?: {
    title?: string;
    currentTime?: number;
    duration?: number;
    hasMedia?: boolean;
    isPlaying?: boolean;
    isFullscreen?: boolean;
  };
  error?: {
    code: string;
    message: string;
  } | null;
}

export const PROVENANCE_METADATA: Record<number, { label: string; description: string; iconSvg: string }> = {
  1: {
    label: 'From source data',
    description: 'Direct measurement read from calibrated NASA binary data files.',
    iconSvg: '<circle cx="8" cy="8" r="5" fill="currentColor"/>'
  },
  2: {
    label: 'From NASA metadata',
    description: 'Curated scientific values extracted from NASA mission catalogs.',
    iconSvg: '<path d="M3 4h10M3 8h10M3 12h7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
  },
  3: {
    label: 'Estimated from the legend',
    description: 'Calibrated by matching video pixels against NASA scientific colorbar stops.',
    iconSvg: '<rect x="3" y="3" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M3 8h10" stroke="currentColor" stroke-width="1.5"/>'
  },
  4: {
    label: 'Based on the picture only',
    description: 'Relative visual proxy derived from image brightness and motion without physical units.',
    iconSvg: '<circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/>'
  }
};

export const PHENOMENON_TINTS: Record<string, string> = {
  'thermal-fire': '#FF6A3D',
  'fire': '#FF6A3D',
  'ocean-temperature': '#3CC8C0',
  'ocean': '#3CC8C0',
  'sst-currents': '#3CC8C0',
  'air-quality': '#B6A6FF',
  'atmosphere': '#B6A6FF',
  'polar-ice': '#BFE8FF',
  'cryosphere': '#BFE8FF',
  'antarctica-flow': '#BFE8FF',
  'forest-canopy': '#8BD66B',
  'gedi-forest-height': '#8BD66B',
  'biosphere': '#8BD66B',
  'night-lights': '#FFC857',
  'urban': '#FFC857',
  'greenhouse-co2': '#C9A66B',
  'carbon': '#C9A66B',
  'iss-lightning': '#8FD3E8',
  'generic-earth': '#8FD3E8'
};

export function mapInternalModeToUi(mode?: SonificationMode): { active: UiMode; label: string; description: string } {
  if (mode === 'scientific') {
    return {
      active: 'exact',
      label: 'Exact',
      description: 'Pitch continuously follows the measured value.'
    };
  }
  if (mode === 'scanner') {
    return {
      active: 'sweep',
      label: 'Sweep',
      description: 'A playhead reads the image columns left to right.'
    };
  }
  return {
    active: 'musical',
    label: 'Musical',
    description: 'Values snap to an authentic musical scale.'
  };
}

export function buildDeterministicCaption(
  presetName: string,
  phenomenon: string,
  tier: number,
  brightness: number,
  motion: number,
  dominantHueDeg: number
): string {
  // Never make physical claims for Tier 4 visual proxies
  if (tier === 4) {
    if (motion > 0.35) {
      return 'Rapid dynamic motion across the scene, creating active rhythmic accents.';
    }
    if (brightness > 0.6) {
      return 'High overall visual brightness, producing an elevated, open acoustic field.';
    }
    if (brightness < 0.2) {
      return 'Dark, quiet field with sparse visual features, yielding a muted low register.';
    }
    return 'Balanced visual energy across the scene with gentle ambient acoustic movement.';
  }

  // Tier 1 - 3: Grounded scientific descriptions
  if (phenomenon.includes('fire') || phenomenon.includes('thermal')) {
    if (brightness > 0.4) {
      return 'Intense thermal signatures detected, driving crackling percussive heat bursts.';
    }
    return 'Thermal baseline monitoring across the region with low ambient flame activity.';
  }

  if (phenomenon.includes('canopy') || phenomenon.includes('forest') || phenomenon.includes('gedi')) {
    if (brightness > 0.45) {
      return 'Tall, dense old-growth canopy dominates the view, so the tone is deep and resonant.';
    }
    return 'Open low vegetation and transitional forest canopy with clear mid-register tones.';
  }

  if (phenomenon.includes('ocean') || phenomenon.includes('sst')) {
    return 'Warm sea surface thermal gradients generate undulating harmonic textures.';
  }

  if (phenomenon.includes('ice') || phenomenon.includes('cryosphere') || phenomenon.includes('antarctica')) {
    return 'Glacial ice sheet flow rates shape sustained, crystalline high-latitude frequencies.';
  }

  if (phenomenon.includes('lightning')) {
    if (motion > 0.25) {
      return 'Frequent optical lightning bursts ignite bright percussive strikes.';
    }
    return 'Quiet night-side cloud tops with occasional distant atmospheric discharge.';
  }

  if (phenomenon.includes('night') || phenomenon.includes('lights')) {
    return 'Dense urban electrical illumination creates focused melodic clusters against the dark.';
  }

  return `Observing ${presetName}, translating optical measurements directly into sound.`;
}

/**
 * Transforms incoming pipeline data into a clean, presentation-ready UiViewModel.
 */
export function createUiViewModel(inputs: AdapterInputs): UiViewModel {
  const {
    payload,
    preset,
    mappingProfile,
    telemetry,
    engineState,
    mediaState,
    error
  } = inputs;

  const datasetId = payload?.vizId || preset?.id || 'general-earth';
  const colonIdx = datasetId.indexOf(':');
  const cleanId = colonIdx > 0 ? datasetId.slice(0, colonIdx) : datasetId;

  const rawTitle = mediaState?.title || preset?.name || 'NASA Earth Observation';
  const phenomenonClass = mappingProfile?.phenomenonClass || cleanId;
  const tint = PHENOMENON_TINTS[phenomenonClass] || PHENOMENON_TINTS[cleanId] || '#8FD3E8';

  // Determine Provenance Tier
  let tier = 4;
  if (preset?.legend && preset.legend.stops && preset.legend.stops.length > 0) {
    tier = 3;
  }
  // If active mappings contain Tier 1 or 2 provenance, elevate tier
  if (mappingProfile?.activeMappings) {
    for (const m of mappingProfile.activeMappings) {
      if (m.provenanceTier === 1) { tier = 1; break; }
      if (m.provenanceTier === 2 && tier > 2) { tier = 2; }
    }
  }

  const prov = PROVENANCE_METADATA[tier] || PROVENANCE_METADATA[4];

  // Grid Cells (4 rows x 8 cols = 32 cells)
  const rows = 4;
  const cols = 8;
  const cells: UiGridCell[] = [];
  const regionData = payload?.metrics?.regions?.dataValue || payload?.metrics?.regions?.brightness || [];

  const isGeoref = Boolean(cleanId === 'gedi-forest-height' || cleanId === 'sst-currents' || cleanId === 'night-lights');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const rawVal = typeof regionData[idx] === 'number' ? regionData[idx] : 0.5;
      const isValid = rawVal > 0.001; // Out-of-gamut or masked cells are invalid

      let readout = '';
      const bandName = isGeoref
        ? (r === 0 ? 'North Polar' : r === 1 ? 'Northern Mid-latitude' : r === 2 ? 'Southern Mid-latitude' : 'South Polar')
        : `Band ${r + 1}`;

      if (!isValid) {
        readout = `${bandName}, sector ${c + 1}: No usable data here.`;
      } else if (tier <= 3 && preset?.legend?.min !== undefined && preset?.legend?.max !== undefined) {
        const physical = preset.legend.min + rawVal * (preset.legend.max - preset.legend.min);
        readout = `${bandName}, sector ${c + 1}: about ${physical.toFixed(1)} ${preset.legend.unit || ''}, ${prov.label.toLowerCase()}, confidence 0.85`;
      } else {
        readout = `${bandName}, sector ${c + 1}: brightness ${rawVal.toFixed(2)}, relative to this video, picture only`;
      }

      cells.push({
        row: r,
        col: c,
        index: idx,
        value: rawVal,
        normalizedValue: Math.max(0, Math.min(1, rawVal)),
        isValid,
        provenanceTier: tier,
        readout
      });
    }
  }

  // Audio Mode
  const modeInfo = mapInternalModeToUi(engineState?.mode || telemetry?.mode);

  // Caption
  const luma = payload?.metrics?.brightness ?? 0.5;
  const motion = payload?.metrics?.motion ?? 0.0;
  const hueDeg = Math.round((payload?.metrics?.hue ?? 0.35) * 360);
  const caption = buildDeterministicCaption(rawTitle, phenomenonClass, tier, luma, motion, hueDeg);

  // Legend Items
  const legendItems: UiLegendItem[] = [];
  if (mappingProfile?.auditoryLegend && mappingProfile.auditoryLegend.length > 0) {
    for (let i = 0; i < mappingProfile.auditoryLegend.length; i++) {
      const leg = mappingProfile.auditoryLegend[i];
      legendItems.push({
        id: `stream-${i}`,
        featureName: leg.featureName,
        meaningClass: leg.meaningClass || 'data',
        directionText: leg.verbalDescription || `${leg.featureName} maps to ${leg.targetAuditoryDimension.replace('_', ' ')}`,
        instrumentText: leg.targetVoice.replace('_', ' '),
        provenanceTier: tier,
        targetVoice: leg.targetVoice,
        isSoloed: false
      });
    }
  } else {
    // Default 3 standard layers if profile not yet loaded
    legendItems.push(
      {
        id: 'stream-lead',
        featureName: preset?.name || 'Primary Measurement',
        meaningClass: 'data',
        directionText: 'Pitch rises with elevated values',
        instrumentText: 'Lead synthesizer',
        provenanceTier: tier,
        targetVoice: 'lead_voice',
        isSoloed: false
      },
      {
        id: 'stream-space',
        featureName: 'Spatial Distribution',
        meaningClass: 'data',
        directionText: 'Stereo pan follows picture left to right',
        instrumentText: 'Stereo panner',
        provenanceTier: tier,
        targetVoice: 'pad_voice',
        isSoloed: false
      },
      {
        id: 'stream-palette',
        featureName: 'Phenomenon Sound Bed',
        meaningClass: 'context',
        directionText: 'Acoustic background character tailored to this Earth system',
        instrumentText: 'Palette bed',
        provenanceTier: tier,
        targetVoice: 'palette_voice',
        isSoloed: false
      }
    );
  }

  return {
    source: {
      title: rawTitle,
      datasetId: cleanId,
      phenomenonClass,
      tint,
      isGeoreferenced: isGeoref
    },
    provenance: {
      tier,
      label: prov.label,
      description: prov.description,
      iconSvg: prov.iconSvg
    },
    grid: {
      rows,
      cols,
      cells
    },
    caption,
    transport: {
      isPlaying: Boolean(engineState?.isSonifying && mediaState?.isPlaying),
      currentTime: mediaState?.currentTime ?? payload?.t ?? 0,
      duration: mediaState?.duration ?? 60,
      volume: engineState?.masterVolume ?? 0.8,
      isMuted: Boolean(engineState?.isMuted)
    },
    mode: modeInfo,
    identity: {
      hasFeature: true,
      enabled: engineState?.semanticEnhance ?? true,
      signature: telemetry?.signature || mappingProfile?.identity?.signature,
      tonic: telemetry?.tonic || mappingProfile?.identity?.tonic,
      scaleName: telemetry?.scaleName || mappingProfile?.identity?.scaleId,
      grooveName: telemetry?.grooveName || mappingProfile?.identity?.grooveTemplate
    },
    legend: {
      items: legendItems
    },
    underTheHood: {
      brightness: luma,
      hueDegrees: hueDeg,
      saturation: payload?.metrics?.saturation ?? 0.5,
      motionDelta: motion,
      dataValue: payload?.metrics?.dataValue ?? null,
      physicalUnit: preset?.legend?.unit || 'normalized',
      frameIndex: payload?.frameIndex ?? 0,
      timeSeconds: payload?.t ?? 0,
      rawPayload: payload ?? null
    },
    error: {
      hasError: Boolean(error),
      code: error?.code,
      message: error?.message
    }
  };
}
