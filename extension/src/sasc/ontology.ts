/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: Scientific Semantic Ontology & Feature Enrichment
 *
 * Implements Stage 2 of SASC: Feature Validation & Semantic Enrichment.
 * Controlled vocabulary of 16 scientific roles, semantic feature enrichment,
 * provenance-tier enforcement, and scientific bounds validation.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type {
  ScientificFeature,
  ScientificFeatureFrame,
  SourceProvenanceTier,
  CalibrationStatus
} from '../sfr/types';

export type ScientificRole =
  | 'STATE'
  | 'MAGNITUDE'
  | 'RATE'
  | 'ACCELERATION'
  | 'GRADIENT'
  | 'FLUX'
  | 'DIRECTION'
  | 'DISTRIBUTION'
  | 'CORRELATION'
  | 'DEVIATION'
  | 'PERIODICITY'
  | 'EVENT'
  | 'THRESHOLD'
  | 'UNCERTAINTY'
  | 'CATEGORICAL_STATE'
  | 'SPATIAL_RELATIONSHIP';

export interface EnrichedScientificFeature {
  stableFeatureId: string;
  featureName: string;
  scientificPhenomenon: string;
  primaryRole: ScientificRole;
  secondaryRoles?: ScientificRole[];
  dataType: 'scalar' | 'spatial_grid' | 'event' | 'categorical' | 'time_series' | 'vector';
  unit: string;
  validRange?: [number, number];
  observedValue: number | number[] | boolean | string | null;
  normalizedValue?: number;
  baselineValue?: number;
  spatialScope?: {
    x?: number;
    y?: number;
    rows?: number;
    cols?: number;
    regionName?: string;
  };
  temporalScope: {
    timestamp: number;
    intervalSeconds?: number;
    frameIndex?: number;
  };
  provenanceTier: SourceProvenanceTier;
  uncertainty?: {
    value: number;
    unit: string;
    type?: string;
  };
  isMissing: boolean;
  calibrationStatus: CalibrationStatus;
  derivationHistory: string[];
  rawSfrFeatureRef?: ScientificFeature;
  eligibility: {
    eligibleForSonification: boolean;
    rejectionReason?: string;
  };
}

export interface FeatureValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a feature against physical bounds, numerical validity, and provenance integrity.
 */
export function validateFeatureSemantics(feature: EnrichedScientificFeature): FeatureValidationResult {
  const errors: string[] = [];

  if (!feature.stableFeatureId || feature.stableFeatureId.trim().length === 0) {
    errors.push('Feature is missing stableFeatureId');
  }

  if (feature.isMissing || feature.observedValue === null) {
    // Missing data is preserved but flagged
    return { isValid: true, errors: [] };
  }

  if (typeof feature.observedValue === 'number') {
    if (isNaN(feature.observedValue)) {
      errors.push(`Feature ${feature.stableFeatureId} has NaN value`);
    }
    if (!isFinite(feature.observedValue)) {
      errors.push(`Feature ${feature.stableFeatureId} has infinite value`);
    }
    if (feature.validRange) {
      const [min, max] = feature.validRange;
      if (min > max) {
        errors.push(`Feature ${feature.stableFeatureId} has invalid validRange bounds [${min}, ${max}]`);
      }
    }
  }

  // Provenance Tier Enforcement: Tier 4 visual proxies cannot claim physical SI units
  if (feature.provenanceTier === 'tier4_visual_proxy') {
    const physicalUnits = ['m', 'km', 'kg', 'K', '°C', 'ppm', 'nW/(cm^2*sr)', 'm/s', 'Pa', 'hPa'];
    if (physicalUnits.includes(feature.unit)) {
      errors.push(`Tier 4 visual proxy ${feature.stableFeatureId} cannot claim physical unit "${feature.unit}" without calibration`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Automatically infers the primary scientific role based on feature type, dimension, and name semantics.
 */
export function inferScientificRole(feature: ScientificFeature): ScientificRole {
  const name = (feature.featureName || feature.featureId || '').toLowerCase();
  const dimension = feature.scientificDimension;
  const fType = feature.featureType;

  if (fType === 'event') return 'EVENT';
  if (fType === 'spatial_grid') return 'DISTRIBUTION';
  if (fType === 'categorical') return 'CATEGORICAL_STATE';
  if (fType === 'vector') return 'DIRECTION';

  if (name.includes('gradient') || name.includes('slope')) return 'GRADIENT';
  if (name.includes('rate') || name.includes('velocity') || name.includes('speed') || name.includes('flow')) return 'RATE';
  if (name.includes('accel')) return 'ACCELERATION';
  if (name.includes('anomaly') || name.includes('deviation') || name.includes('diff')) return 'DEVIATION';
  if (name.includes('flux') || name.includes('transfer')) return 'FLUX';
  if (name.includes('period') || name.includes('cycle') || name.includes('freq')) return 'PERIODICITY';
  if (name.includes('threshold') || name.includes('limit')) return 'THRESHOLD';
  if (name.includes('uncertainty') || name.includes('error')) return 'UNCERTAINTY';

  if (dimension === 'magnitude' || name.includes('height') || name.includes('concentration') || name.includes('radiance')) {
    return 'MAGNITUDE';
  }

  return 'STATE';
}

/**
 * Enriches a collection of raw SFR features into validated EnrichedScientificFeature objects.
 */
export function enrichScientificFeatures(frame: ScientificFeatureFrame): EnrichedScientificFeature[] {
  const enriched: EnrichedScientificFeature[] = [];
  const datasetId = frame.sourceId || 'nasa-dataset';

  for (const raw of frame.features) {
    const primaryRole = inferScientificRole(raw);
    let observedValue: number | null = null;
    let normalizedValue: number | undefined = undefined;

    if (raw.isMissing) {
      observedValue = null;
    } else if (raw.featureType === 'scalar') {
      observedValue = raw.value;
      normalizedValue = raw.normalizedValue;
    } else if (raw.featureType === 'event') {
      observedValue = raw.intensity;
      normalizedValue = raw.intensity;
    } else if (raw.featureType === 'vector') {
      observedValue = raw.magnitude;
      normalizedValue = undefined;
    } else if (raw.featureType === 'spatial_grid') {
      observedValue = raw.values.find((v) => v !== null) ?? null;
      normalizedValue = raw.normalizedValues?.[0];
    } else if ('value' in (raw as any)) {
      observedValue = (raw as any).value;
      normalizedValue = (raw as any).normalizedValue;
    }

    const isMissing = raw.isMissing || observedValue === null;

    const feature: EnrichedScientificFeature = {
      stableFeatureId: raw.featureId,
      featureName: raw.featureName || raw.featureId,
      scientificPhenomenon: datasetId,
      primaryRole,
      dataType: raw.featureType as any,
      unit: raw.unit || 'dimensionless',
      validRange: raw.validRange,
      observedValue,
      normalizedValue,
      temporalScope: {
        timestamp: frame.timestamp,
        frameIndex: frame.frameIndex
      },
      provenanceTier: raw.provenance.sourceType,
      uncertainty: raw.quality?.uncertainty ? {
        value: raw.quality.uncertainty.value,
        unit: raw.quality.uncertainty.unit,
        type: raw.quality.uncertainty.type
      } : undefined,
      isMissing,
      calibrationStatus: raw.quality?.calibrationStatus || 'uncalibrated',
      derivationHistory: [raw.provenance.extractionMethod],
      rawSfrFeatureRef: raw,
      eligibility: {
        eligibleForSonification: true
      }
    };

    // Validation check
    const validation = validateFeatureSemantics(feature);
    if (!validation.isValid) {
      feature.eligibility = {
        eligibleForSonification: false,
        rejectionReason: validation.errors.join('; ')
      };
    } else if (isMissing) {
      feature.eligibility = {
        eligibleForSonification: false,
        rejectionReason: 'Feature data is missing or null'
      };
    }

    enriched.push(feature);
  }

  return enriched;
}
