/**
 * Earth Jukebox (EJB) — Scientific Feature Representation Runtime Validator
 *
 * Authored by Pranav K & Ujwal A.
 */

import type { ScientificFeature, ScientificFeatureFrame } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateScientificFeature(feature: unknown): ValidationResult {
  const errors: string[] = [];

  if (!feature || typeof feature !== 'object') {
    return { valid: false, errors: ['Feature must be an object'] };
  }

  const f = feature as Partial<ScientificFeature>;

  if (f.schemaVersion !== 'sfr.v1') {
    errors.push(`Invalid schemaVersion: expected "sfr.v1", got "${f.schemaVersion}"`);
  }

  if (!f.featureId || typeof f.featureId !== 'string') {
    errors.push('Missing or invalid featureId');
  }

  if (!f.featureName || typeof f.featureName !== 'string') {
    errors.push('Missing or invalid featureName');
  }

  if (typeof f.timestamp !== 'number' || !Number.isFinite(f.timestamp)) {
    errors.push('Invalid timestamp');
  }

  if (!f.unit || typeof f.unit !== 'string') {
    errors.push('Missing or invalid physical unit');
  }

  if (!f.provenance || typeof f.provenance !== 'object') {
    errors.push('Missing feature provenance object');
  } else {
    if (!f.provenance.sourceType || !f.provenance.sourceId) {
      errors.push('Provenance must include sourceType and sourceId');
    }
  }

  if (!f.quality || typeof f.quality !== 'object') {
    errors.push('Missing feature quality object');
  } else {
    if (typeof f.quality.confidence !== 'number' || f.quality.confidence < 0 || f.quality.confidence > 1) {
      errors.push('Quality confidence must be a float in [0.0, 1.0]');
    }
  }

  // Type-specific validation
  switch (f.featureType) {
    case 'scalar': {
      const sf = f as any;
      if (typeof sf.value !== 'number' || !Number.isFinite(sf.value)) {
        errors.push('Scalar feature must have a finite numeric value');
      }
      if (typeof sf.normalizedValue !== 'number' || sf.normalizedValue < 0 || sf.normalizedValue > 1) {
        errors.push('Scalar normalizedValue must be clamped in [0.0, 1.0]');
      }
      break;
    }

    case 'spatial_grid': {
      const gf = f as any;
      if (!Number.isInteger(gf.rows) || !Number.isInteger(gf.cols) || gf.rows <= 0 || gf.cols <= 0) {
        errors.push('Spatial grid must have positive integer rows and cols');
      }
      const expectedLen = (gf.rows || 0) * (gf.cols || 0);
      if (!Array.isArray(gf.values) || gf.values.length !== expectedLen) {
        errors.push(`Spatial grid values length must equal rows * cols (${expectedLen})`);
      }
      break;
    }

    case 'event': {
      const ef = f as any;
      if (!ef.eventType || typeof ef.eventType !== 'string') {
        errors.push('Event feature must have an eventType');
      }
      if (typeof ef.intensity !== 'number' || ef.intensity < 0 || ef.intensity > 1) {
        errors.push('Event intensity must be in [0.0, 1.0]');
      }
      if (!ef.position || typeof ef.position.x !== 'number' || typeof ef.position.y !== 'number') {
        errors.push('Event position must have numeric x and y');
      }
      break;
    }

    case 'vector': {
      const vf = f as any;
      if (typeof vf.magnitude !== 'number' || vf.magnitude < 0) {
        errors.push('Vector magnitude must be a non-negative number');
      }
      if (typeof vf.directionDegrees !== 'number' || vf.directionDegrees < 0 || vf.directionDegrees >= 360) {
        errors.push('Vector directionDegrees must be in [0, 360)');
      }
      break;
    }

    case 'categorical': {
      const cf = f as any;
      if (!cf.category || typeof cf.category !== 'string') {
        errors.push('Categorical feature must specify a non-empty category');
      }
      break;
    }

    default:
      errors.push(`Unknown or unsupported featureType: "${f.featureType}"`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateScientificFeatureFrame(frame: unknown): ValidationResult {
  const errors: string[] = [];

  if (!frame || typeof frame !== 'object') {
    return { valid: false, errors: ['Feature frame must be an object'] };
  }

  const sff = frame as Partial<ScientificFeatureFrame>;

  if (sff.schemaVersion !== 'sfr.v1') {
    errors.push(`Invalid frame schemaVersion: expected "sfr.v1", got "${sff.schemaVersion}"`);
  }

  if (!Array.isArray(sff.features)) {
    errors.push('Frame features must be an array');
  } else {
    sff.features.forEach((feat, idx) => {
      const res = validateScientificFeature(feat);
      if (!res.valid) {
        errors.push(`Feature[${idx}] "${(feat as any)?.featureId ?? 'unknown'}": ${res.errors.join('; ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
