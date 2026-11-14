/**
 * Earth Jukebox (EJB) — Contract v1 to SFR Adapter
 *
 * Converts incoming real-time Contract v1 payloads (`EjbFramePayload`)
 * into standardized, provenance-annotated `ScientificFeatureFrame`s.
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { EjbFramePayload, PresetConfig } from '../../contract/types';
import type {
  ScientificFeatureFrame,
  ScientificFeature,
  ScalarFeature,
  SpatialGridFeature,
  EventFeature,
  CategoricalFeature,
  SourceProvenanceTier,
  CalibrationStatus
} from '../types';
import { PRESETS } from '../../presets';

export function adaptContractV1ToSfr(payload: EjbFramePayload): ScientificFeatureFrame {
  const { vizId, t, frameIndex, metrics, flags, events, layers } = payload;
  const preset = PRESETS[vizId] || null;

  const features: ScientificFeature[] = [];

  // Determine physical calibration bounds from preset
  const isCalibrated = Boolean(preset?.legend && preset.legend.min !== undefined && preset.legend.max !== undefined);
  const minVal = preset?.legend?.min ?? 0;
  const maxVal = preset?.legend?.max ?? 1;
  const unit = preset?.legend?.unit ?? (isCalibrated ? 'unit' : 'ratio');

  const provenanceTier: SourceProvenanceTier = isCalibrated
    ? 'tier3_calibrated_visual'
    : 'tier4_visual_proxy';

  const calibrationStatus: CalibrationStatus = isCalibrated
    ? 'legend_calibrated'
    : 'proxy_inferred';

  // 1. Primary Physical Measurement (if calibrated) or Primary Visual Proxy
  if (metrics.dataValue !== null && metrics.dataValue !== undefined) {
    const physicalVal = minVal + metrics.dataValue * (maxVal - minVal);
    const primaryFeature: ScalarFeature = {
      schemaVersion: 'sfr.v1',
      featureId: `${vizId}.primary_measurement`,
      featureName: preset?.name ? `${preset.name.toLowerCase().replace(/\s+/g, '_')}_value` : 'data_value',
      scientificDimension: 'magnitude',
      featureType: 'scalar',
      value: physicalVal,
      normalizedValue: metrics.dataValue,
      unit,
      validRange: [minVal, maxVal],
      timestamp: t,
      provenance: {
        sourceType: provenanceTier,
        sourceId: vizId,
        extractionMethod: 'cielab_legend_match',
        timestampExtracted: Date.now(),
        frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus,
        uncertainty: {
          value: (maxVal - minVal) * 0.05,
          unit,
          type: 'delta_e_distance'
        }
      }
    };
    features.push(primaryFeature);
  }

  // 2. Luminance (Visual Feature / Proxy)
  const lumaFeature: ScalarFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${vizId}.luminance`,
    featureName: 'perceptual_luminance',
    scientificDimension: 'magnitude',
    featureType: 'scalar',
    value: metrics.brightness,
    normalizedValue: metrics.brightness,
    unit: 'ratio',
    validRange: [0, 1],
    timestamp: t,
    provenance: {
      sourceType: 'tier4_visual_proxy',
      sourceId: vizId,
      extractionMethod: 'rec601_luma',
      timestampExtracted: Date.now(),
      frameIndex
    },
    quality: {
      confidence: 0.95,
      calibrationStatus: 'proxy_inferred'
    }
  };
  features.push(lumaFeature);

  // 3. Inter-frame Motion Delta
  const motionFeature: ScalarFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${vizId}.motion_delta`,
    featureName: 'interframe_motion_delta',
    scientificDimension: 'velocity',
    featureType: 'scalar',
    value: metrics.motion,
    normalizedValue: metrics.motion,
    unit: 'ratio',
    validRange: [0, 1],
    timestamp: t,
    provenance: {
      sourceType: 'tier4_visual_proxy',
      sourceId: vizId,
      extractionMethod: 'pixel_difference_delta',
      timestampExtracted: Date.now(),
      frameIndex
    },
    quality: {
      confidence: 0.90,
      calibrationStatus: 'proxy_inferred',
      qualityFlags: flags.scene_cut ? ['scene_cut_detected'] : undefined
    }
  };
  features.push(motionFeature);

  // 4. Spatial Grid Feature (4x8 Regional Matrix)
  if (metrics.regions) {
    const gridRows = metrics.regions.rows || 4;
    const gridCols = metrics.regions.cols || 8;
    const normalizedValues = metrics.regions.brightness;

    // Convert normalized grid values to physical values where calibrated
    const physicalGridValues = metrics.regions.dataValue.map(dv => {
      if (dv === null || dv === undefined) return null;
      return minVal + dv * (maxVal - minVal);
    });

    const gridFeature: SpatialGridFeature = {
      schemaVersion: 'sfr.v1',
      featureId: `${vizId}.spatial_grid_4x8`,
      featureName: 'spatial_regional_matrix',
      scientificDimension: 'structure_distribution',
      featureType: 'spatial_grid',
      rows: gridRows,
      cols: gridCols,
      values: physicalGridValues,
      normalizedValues,
      unit,
      validRange: [minVal, maxVal],
      timestamp: t,
      provenance: {
        sourceType: provenanceTier,
        sourceId: vizId,
        extractionMethod: '4x8_regional_partition',
        timestampExtracted: Date.now(),
        frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus
      }
    };
    features.push(gridFeature);
  }

  // 5. Discrete Events (Flashes / Lightning)
  if (events && events.length > 0) {
    events.forEach((evt, idx) => {
      const eventFeature: EventFeature = {
        schemaVersion: 'sfr.v1',
        featureId: `${vizId}.event_${idx}`,
        featureName: evt.type === 'flash' ? 'optical_lightning_flash' : 'bright_spot_event',
        scientificDimension: 'events_anomalies',
        featureType: 'event',
        eventType: evt.type,
        intensity: evt.intensity,
        position: { x: evt.x, y: evt.y },
        unit: 'ratio',
        validRange: [0, 1],
        timestamp: t,
        spatial: {
          xNorm: evt.x,
          yNorm: evt.y
        },
        provenance: {
          sourceType: 'tier3_calibrated_visual',
          sourceId: vizId,
          extractionMethod: 'exponential_moving_baseline_jump',
          timestampExtracted: Date.now(),
          frameIndex
        },
        quality: {
          confidence: 0.88,
          calibrationStatus: 'proxy_inferred'
        }
      };
      features.push(eventFeature);
    });
  }

  // 6. Multi-layer Categorical Features (e.g. Aerosols)
  if (layers && Object.keys(layers).length > 0) {
    for (const [species, coverage] of Object.entries(layers)) {
      const catFeature: CategoricalFeature = {
        schemaVersion: 'sfr.v1',
        featureId: `${vizId}.layer_${species}`,
        featureName: `aerosol_${species}_coverage`,
        scientificDimension: 'structure_distribution',
        featureType: 'categorical',
        category: species,
        classProbabilities: { [species]: coverage },
        unit: 'fraction',
        validRange: [0, 1],
        timestamp: t,
        provenance: {
          sourceType: 'tier3_calibrated_visual',
          sourceId: vizId,
          extractionMethod: 'color_class_partition',
          timestampExtracted: Date.now(),
          frameIndex
        },
        quality: {
          confidence: 0.82,
          calibrationStatus: 'legend_calibrated'
        }
      };
      features.push(catFeature);
    }
  }

  return {
    schemaVersion: 'sfr.v1',
    frameId: `${vizId}_f${frameIndex}`,
    sourceId: vizId,
    timestamp: t,
    frameIndex,
    features,
    metadata: {
      seeked: flags.seeked,
      scene_cut: flags.scene_cut,
      presetName: preset?.name
    }
  };
}
