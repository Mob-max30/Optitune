/**
 * Earth Jukebox (EJB) — Contract v1.1 to SFR Adapter
 *
 * Converts additive Contract v1.1 RichFeaturePayload ("ejb:features") into
 * standardized ScientificFeatureFrame entries with strict provenance tagging.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { RichFeaturePayload } from '../../contract/v1_1';
import type { ScientificFeatureFrame, ScientificFeature, SourceProvenanceTier, CalibrationStatus } from '../types';

export function adaptContractV1_1ToSfr(payload: RichFeaturePayload): ScientificFeatureFrame {
  const isCalibrated = payload.provenance === 'calibrated visualisation';
  const sourceType: SourceProvenanceTier = isCalibrated ? 'tier3_calibrated_visual' : 'tier4_visual_proxy';
  const calibrationStatus: CalibrationStatus = isCalibrated ? 'legend_calibrated' : 'proxy_inferred';

  const features: ScientificFeature[] = [
    // 1. Level (Median)
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:level`,
      featureName: isCalibrated ? 'calibrated_level' : 'proxy_level',
      scientificDimension: 'magnitude',
      featureType: 'scalar',
      value: payload.level,
      validRange: [0.0, 1.0],
      normalizedValue: payload.level,
      unit: payload.physical?.unit || 'ratio',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: isCalibrated ? 0.90 : 0.60,
        calibrationStatus
      }
    },

    // 2. Spread (P90 - P10)
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:spread`,
      featureName: 'spatial_spread',
      scientificDimension: 'structure_distribution',
      featureType: 'scalar',
      value: payload.spread,
      validRange: [0.0, 1.0],
      normalizedValue: payload.spread,
      unit: 'ratio',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus
      }
    },

    // 3. Extreme Fraction
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:extreme_frac`,
      featureName: 'extreme_fraction',
      scientificDimension: 'events_anomalies',
      featureType: 'scalar',
      value: payload.extremeFrac,
      validRange: [0.0, 1.0],
      normalizedValue: payload.extremeFrac,
      unit: 'fraction',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus
      }
    },

    // 4. Peak (P99)
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:peak`,
      featureName: 'peak_intensity',
      scientificDimension: 'magnitude',
      featureType: 'scalar',
      value: payload.peak,
      validRange: [0.0, 1.0],
      normalizedValue: payload.peak,
      unit: payload.physical?.unit || 'ratio',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.80,
        calibrationStatus
      }
    },

    // 5. Spatial Focus
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:focus`,
      featureName: 'spatial_focus',
      scientificDimension: 'position',
      featureType: 'scalar',
      value: payload.focus[0],
      validRange: [0.0, 1.0],
      normalizedValue: payload.focus[0],
      unit: 'x_coord',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.80,
        calibrationStatus
      }
    },

    // 6. Texture / Variance
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:texture`,
      featureName: 'surface_texture',
      scientificDimension: 'structure_distribution',
      featureType: 'scalar',
      value: payload.texture,
      validRange: [0.0, 1.0],
      normalizedValue: payload.texture,
      unit: 'gradient_density',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.75,
        calibrationStatus
      }
    },

    // 7. Temporal Rate of Change
    {
      schemaVersion: 'sfr.v1',
      featureId: `${payload.sourceKey}:rich:temporal_rate`,
      featureName: 'temporal_rate',
      scientificDimension: 'velocity',
      featureType: 'scalar',
      value: payload.temporal.rate,
      validRange: [0.0, 5.0],
      normalizedValue: Math.min(1.0, payload.temporal.rate),
      unit: 'delta_per_second',
      timestamp: payload.t,
      provenance: {
        sourceType,
        sourceId: payload.sourceKey,
        extractionMethod: 'crop_128_stats',
        timestampExtracted: Date.now(),
        frameIndex: payload.frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus
      }
    }
  ];

  return {
    schemaVersion: 'sfr.v1',
    frameId: `rich-sfr-${payload.frameIndex}`,
    sourceId: payload.sourceKey,
    timestamp: payload.t,
    frameIndex: payload.frameIndex,
    features,
    metadata: {
      phenomenonClass: payload.phenomenonClass,
      provenance: payload.provenance,
      maskedFraction: payload.maskedFraction,
      coverage: payload.coverage,
      blobsCount: payload.blobs.count,
      hueFamily: payload.hueFamily,
      onset: payload.temporal.onset,
      sceneCut: payload.temporal.sceneCut,
      spatialResolution: '128px crop',
      temporalResolutionHz: 3.0
    }
  };
}
