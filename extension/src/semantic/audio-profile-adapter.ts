/**
 * Earth Jukebox (EJB) — Autonomous Audio Engine Profile Adapter
 *
 * Bridges the Autonomous Semantic Selector (MappingProfile + ScientificFeatureFrame)
 * directly into the low-level EarthJukeboxAudioEngine Web Audio synthesizer graph.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EarthJukeboxAudioEngine } from '../audio/engine';
import type { AudioTelemetry } from '../audio/types';
import type { ScientificFeatureFrame, ScientificFeature } from '../sfr/types';
import type { MappingProfile, ActiveMappingAssignment } from './types';
import type { EjbFramePayload, RegionGridMetrics } from '../contract/types';
import { selectAutonomousMappings } from './selector';
import { mapContinuousFrequency } from '../audio/scales';

export interface EvaluatedVoiceParameters {
  leadFrequency: number;
  leadGain: number;
  pan: number;
  filterCutoff: number;
  rowEnergies: [number, number, number, number];
  noiseIntensity: number;
  layers?: Record<string, number>;
  eventsToTrigger: Array<{ x: number; y: number; intensity: number }>;
}

function findFeatureInFrame(frame: ScientificFeatureFrame | any, featureName: string): ScientificFeature | any | undefined {
  if (Array.isArray(frame.features)) {
    return frame.features.find((f: any) => f.featureName === featureName || f.featureId === featureName || f.name === featureName);
  }
  if (frame.features && typeof frame.features === 'object') {
    return frame.features[featureName];
  }
  return undefined;
}

/**
 * Evaluates the mathematical parameters for all audio voices given an active profile and feature frame.
 */
export function evaluateProfileParameters(
  profile: MappingProfile,
  frame: ScientificFeatureFrame | any
): EvaluatedVoiceParameters {
  let leadFreq = 220;
  let leadGain = 0.25;
  let pan = 0.0;
  let filterCutoff = 1200;
  const rowEnergies: [number, number, number, number] = [0.2, 0.2, 0.2, 0.2];
  let noiseIntensity = 0.0;
  const layers: Record<string, number> = {};
  const eventsToTrigger: Array<{ x: number; y: number; intensity: number }> = [];

  if (profile.isSilent) {
    return {
      leadFrequency: 220,
      leadGain: 0.0,
      pan: 0.0,
      filterCutoff: 500,
      rowEnergies: [0, 0, 0, 0],
      noiseIntensity: 0.0,
      eventsToTrigger: []
    };
  }

  for (const assignment of profile.activeMappings) {
    const feature = findFeatureInFrame(frame, assignment.featureName);
    if (!feature) continue;

    const featureType = feature.featureType || feature.type;
    const value = feature.value ?? feature.normalizedValue ?? 0;

    switch (assignment.targetAuditoryDimension) {
      case 'pitch_frequency': {
        if (featureType === 'scalar' && feature.validRange) {
          const norm = Math.max(0, Math.min(1.0, (value - feature.validRange[0]) / (feature.validRange[1] - feature.validRange[0])));
          leadFreq = mapContinuousFrequency(norm, 110, 880, 'log');
        } else if (featureType === 'scalar') {
          leadFreq = 110 + value * 500;
        }
        break;
      }

      case 'amplitude_gain': {
        if (featureType === 'scalar') {
          const norm = feature.validRange
            ? (value - feature.validRange[0]) / (feature.validRange[1] - feature.validRange[0])
            : value;
          leadGain = Math.max(0.05, Math.min(0.8, 0.1 + Math.pow(Math.max(0, norm), 1.6) * 0.6));
        }
        break;
      }

      case 'lowpass_cutoff': {
        if (featureType === 'scalar') {
          const norm = feature.validRange
            ? (value - feature.validRange[0]) / (feature.validRange[1] - feature.validRange[0])
            : value;
          filterCutoff = 300 + Math.max(0, Math.min(1.0, norm)) * 4700;
        }
        break;
      }

      case 'stereo_pan': {
        if (featureType === 'scalar') {
          pan = Math.max(-1.0, Math.min(1.0, value));
        }
        break;
      }

      case 'latitudinal_voicing': {
        if ((featureType === 'spatial_grid' || featureType === 'spatial_grid_2d') && feature.rows) {
          if (Array.isArray(feature.rows)) {
            for (let r = 0; r < 4; r++) {
              const rowArr = feature.rows[r] || [];
              const sum = rowArr.reduce((acc: number, v: number) => acc + v, 0);
              rowEnergies[r] = Math.max(0, Math.min(1.0, rowArr.length ? sum / rowArr.length : 0.2));
            }
          }
        }
        break;
      }

      case 'noise_density': {
        if (featureType === 'scalar') {
          const val = Math.max(0, Math.min(1.0, value));
          noiseIntensity = Math.max(noiseIntensity, val * 0.8);
          const fname = feature.featureName || feature.name || 'noise';
          layers[fname] = val;
        }
        break;
      }

      case 'transient_percussion': {
        if (featureType === 'event' && (feature.occurred || feature.intensity > 0)) {
          eventsToTrigger.push({
            x: pan,
            y: 0.5,
            intensity: feature.intensity ?? 0.8
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return {
    leadFrequency: Math.round(leadFreq),
    leadGain: parseFloat(leadGain.toFixed(3)),
    pan: parseFloat(pan.toFixed(3)),
    filterCutoff: Math.round(filterCutoff),
    rowEnergies,
    noiseIntensity: parseFloat(noiseIntensity.toFixed(3)),
    layers,
    eventsToTrigger
  };
}

/**
 * High-level Autonomous Sonification Engine Controller.
 * Manages continuous dynamic adaptation between incoming SFR frames and the Web Audio engine.
 */
export class AutonomousAudioEngineAdapter {
  private engine: EarthJukeboxAudioEngine;
  private currentProfile: MappingProfile | null = null;

  constructor(engine: EarthJukeboxAudioEngine) {
    this.engine = engine;
  }

  /**
   * Returns currently active MappingProfile.
   */
  getActiveProfile(): MappingProfile | null {
    return this.currentProfile;
  }

  /**
   * Processes a scientific feature frame, autonomously generating or updating
   * the MappingProfile and applying the evaluated synthesis parameters.
   */
  processScientificFrame(frame: ScientificFeatureFrame | any): AudioTelemetry {
    const datasetId = frame.sourceId || frame.datasetId || 'earth-dataset';

    // 1. Select or update mapping profile
    if (!this.currentProfile || this.currentProfile.profileId.indexOf(datasetId) === -1) {
      this.currentProfile = selectAutonomousMappings(frame);
    }

    // 2. Evaluate physical synthesis parameters
    const params = evaluateProfileParameters(this.currentProfile, frame);

    // Build standard 4x8 RegionGridMetrics (32 cells)
    const brightnessGrid = new Array(32).fill(params.leadGain);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        brightnessGrid[r * 8 + c] = params.rowEnergies[r];
      }
    }

    // 3. Synthesize an EjbFramePayload to safely drive the internal engine without breaking compatibility
    const syntheticPayload: EjbFramePayload = {
      v: 1,
      t: frame.timestamp ?? 0,
      frameIndex: frame.frameIndex ?? 0,
      vizId: datasetId,
      metrics: {
        brightness: params.leadGain,
        dominantColor: { r: 0.2, g: 0.8, b: 0.3 },
        hue: 0.35,
        saturation: 0.6,
        motion: (params.filterCutoff - 300) / 4700,
        dataValue: (params.leadFrequency - 110) / (880 - 110),
        regions: {
          rows: 4,
          cols: 8,
          brightness: brightnessGrid,
          dataValue: brightnessGrid
        }
      },
      flags: {
        seeked: false,
        scene_cut: false
      },
      events: params.eventsToTrigger.map(e => ({
        type: 'flash',
        intensity: e.intensity,
        x: e.x,
        y: e.y
      })),
      layers: params.layers,
      profile: {
        rows: params.rowEnergies,
        cols: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      }
    };

    this.engine.processFrame(syntheticPayload);
    return this.engine.getTelemetry();
  }
}
