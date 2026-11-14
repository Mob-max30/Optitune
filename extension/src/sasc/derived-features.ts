/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Derived Feature Engine
 *
 * Implements Stage 4 of SASC: Mathematically rigorous derived feature calculations
 * (rates of change, spatial gradients, baseline anomalies) with derivation history
 * and scene-cut safeguards.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EnrichedScientificFeature } from './ontology';

export interface TemporalFrameHistory {
  previousFeature: EnrichedScientificFeature;
  timestamp: number;
  isSceneCut: boolean;
}

/**
 * Calculates temporal rate of change: (v2 - v1) / (t2 - t1).
 * Safeguards: Disallowed across scene cuts or non-positive time intervals.
 */
export function calculateRateOfChange(
  current: EnrichedScientificFeature,
  previousHistory?: TemporalFrameHistory
): EnrichedScientificFeature | null {
  if (!previousHistory || previousHistory.isSceneCut) {
    return null; // Suppressed on scene cuts or missing history
  }

  const prev = previousHistory.previousFeature;
  const dt = current.temporalScope.timestamp - previousHistory.timestamp;
  if (dt <= 0 || dt > 5.0) {
    return null; // Invalid time interval
  }

  const vCurrent = typeof current.observedValue === 'number' ? current.observedValue : null;
  const vPrev = typeof prev.observedValue === 'number' ? prev.observedValue : null;

  if (vCurrent === null || vPrev === null) {
    return null;
  }

  const rateValue = (vCurrent - vPrev) / dt;
  const unit = current.unit !== 'dimensionless' ? `${current.unit}/s` : '1/s';

  return {
    stableFeatureId: `${current.stableFeatureId}.rate_of_change`,
    featureName: `${current.featureName} rate of change`,
    scientificPhenomenon: current.scientificPhenomenon,
    primaryRole: 'RATE',
    dataType: 'scalar',
    unit,
    observedValue: parseFloat(rateValue.toFixed(4)),
    temporalScope: {
      timestamp: current.temporalScope.timestamp,
      intervalSeconds: dt,
      frameIndex: current.temporalScope.frameIndex
    },
    provenanceTier: current.provenanceTier,
    uncertainty: current.uncertainty ? {
      value: current.uncertainty.value / dt,
      unit,
      type: 'propagated_rate_uncertainty'
    } : undefined,
    isMissing: false,
    calibrationStatus: current.calibrationStatus,
    derivationHistory: [...current.derivationHistory, `rate_of_change_dt_${dt.toFixed(3)}s`],
    eligibility: {
      eligibleForSonification: true
    }
  };
}

/**
 * Calculates spatial gradient across latitudinal rows in a spatial grid.
 */
export function calculateSpatialGradient(
  gridFeature: EnrichedScientificFeature
): EnrichedScientificFeature | null {
  if (gridFeature.dataType !== 'spatial_grid' || !Array.isArray(gridFeature.observedValue)) {
    return null;
  }

  const vals = gridFeature.observedValue as number[];
  if (vals.length < 8) return null;

  // Compute north-south gradient (Row 0 vs Row 3)
  const row0 = vals.slice(0, 8);
  const row3 = vals.slice(24, 32);

  const mean0 = row0.reduce((a, b) => a + b, 0) / (row0.length || 1);
  const mean3 = row3.reduce((a, b) => a + b, 0) / (row3.length || 1);
  const gradientValue = Math.abs(mean0 - mean3);

  return {
    stableFeatureId: `${gridFeature.stableFeatureId}.latitudinal_gradient`,
    featureName: 'Latitudinal north-south spatial gradient',
    scientificPhenomenon: gridFeature.scientificPhenomenon,
    primaryRole: 'GRADIENT',
    dataType: 'scalar',
    unit: gridFeature.unit,
    observedValue: parseFloat(gradientValue.toFixed(4)),
    normalizedValue: Math.min(1.0, gradientValue),
    temporalScope: gridFeature.temporalScope,
    provenanceTier: gridFeature.provenanceTier,
    isMissing: false,
    calibrationStatus: gridFeature.calibrationStatus,
    derivationHistory: [...gridFeature.derivationHistory, 'latitudinal_row0_row3_contrast'],
    eligibility: {
      eligibleForSonification: true
    }
  };
}

/**
 * Calculates anomaly deviation from a documented scientific baseline: value - baseline.
 */
export function calculateBaselineAnomaly(
  feature: EnrichedScientificFeature,
  baseline: number
): EnrichedScientificFeature | null {
  if (typeof feature.observedValue !== 'number') return null;

  const anomalyValue = feature.observedValue - baseline;

  return {
    stableFeatureId: `${feature.stableFeatureId}.anomaly`,
    featureName: `${feature.featureName} baseline anomaly`,
    scientificPhenomenon: feature.scientificPhenomenon,
    primaryRole: 'DEVIATION',
    dataType: 'scalar',
    unit: feature.unit,
    observedValue: parseFloat(anomalyValue.toFixed(4)),
    baselineValue: baseline,
    temporalScope: feature.temporalScope,
    provenanceTier: feature.provenanceTier,
    isMissing: false,
    calibrationStatus: feature.calibrationStatus,
    derivationHistory: [...feature.derivationHistory, `anomaly_relative_to_baseline_${baseline}`],
    eligibility: {
      eligibleForSonification: true
    }
  };
}
