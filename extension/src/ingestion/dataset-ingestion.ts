/**
 * Earth Jukebox (EJB) — Original Scientific Dataset Ingestion Engine
 *
 * Ingests direct scientific floating-point telemetry (NetCDF/GeoTIFF exports,
 * structured scientific JSON/CSV time series, and gridded arrays) into the
 * Scientific Feature Representation (SFR v1) with Tier 1 provenance.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type {
  ScientificFeatureFrame,
  ScientificFeature,
  ScalarFeature,
  TimeSeriesFeature,
  SpatialGridFeature
} from '../sfr/types';

export interface ScientificVariableSpec {
  name: string;
  standardName?: string;
  unit: string;
  validRange: [number, number];
  fillValue?: number;
  uncertainty?: number;
}

export interface GriddedDatasetSpec {
  datasetId: string;
  title: string;
  sourceUri?: string;
  coordinateReferenceSystem?: string; // e.g. "EPSG:4326"
  timestamp: number;
  rows: number;
  cols: number;
  latitudes?: number[];
  longitudes?: number[];
  variable: ScientificVariableSpec;
  data: Float32Array | number[];
}

export interface TimeSeriesDatasetSpec {
  datasetId: string;
  title: string;
  sourceUri?: string;
  timestamps: number[];
  variable: ScientificVariableSpec;
  values: number[];
}

export interface DatasetIngestionResult {
  frame: ScientificFeatureFrame;
  validValuesCount: number;
  missingValuesCount: number;
  meanValue: number;
}

/**
 * Ingests a direct 2D gridded scientific raster (e.g., NetCDF variable slice, GeoTIFF array).
 */
export function ingestGriddedDataset(spec: GriddedDatasetSpec): DatasetIngestionResult {
  const { datasetId, timestamp, rows, cols, variable, data, coordinateReferenceSystem } = spec;

  let validCount = 0;
  let missingCount = 0;
  let sum = 0;
  const normalizedValues: number[] = [];
  const cleanValues: (number | null)[] = [];

  const [minVal, maxVal] = variable.validRange;
  const rangeSpan = maxVal - minVal;

  for (let i = 0; i < data.length; i++) {
    const rawVal = data[i];

    // Explicit check for NaN, Infinity, or specified Fill/NoData values
    if (
      isNaN(rawVal) ||
      !isFinite(rawVal) ||
      (variable.fillValue !== undefined && Math.abs(rawVal - variable.fillValue) < 1e-4)
    ) {
      missingCount++;
      cleanValues.push(null);
      normalizedValues.push(0.0);
    } else {
      validCount++;
      sum += rawVal;
      cleanValues.push(Number(rawVal.toFixed(4)));

      const norm = rangeSpan > 0 ? Math.max(0, Math.min(1.0, (rawVal - minVal) / rangeSpan)) : 0.5;
      normalizedValues.push(Number(norm.toFixed(4)));
    }
  }

  const meanValue = validCount > 0 ? sum / validCount : 0;
  const now = Date.now();

  const spatialFeature: SpatialGridFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${datasetId}.${variable.name}_grid`,
    featureName: variable.name,
    scientificDimension: 'structure_distribution',
    featureType: 'spatial_grid',
    unit: variable.unit,
    validRange: variable.validRange,
    timestamp,
    rows,
    cols,
    values: cleanValues,
    normalizedValues,
    spatial: {
      spatialReference: coordinateReferenceSystem || 'EPSG:4326'
    },
    provenance: {
      sourceType: 'tier1_raw_telemetry',
      sourceId: datasetId,
      extractionMethod: 'direct_raster_ingestion',
      timestampExtracted: now
    },
    quality: {
      confidence: 1.0,
      calibrationStatus: 'instrument_calibrated',
      uncertainty: variable.uncertainty
        ? {
            value: variable.uncertainty,
            unit: variable.unit,
            type: 'standard_deviation'
          }
        : undefined
    }
  };

  const primaryFeature: ScalarFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${datasetId}.${variable.name}_mean`,
    featureName: variable.name,
    scientificDimension: 'magnitude',
    featureType: 'scalar',
    value: Number(meanValue.toFixed(4)),
    normalizedValue: rangeSpan > 0 ? Math.max(0, Math.min(1.0, (meanValue - minVal) / rangeSpan)) : 0.5,
    unit: variable.unit,
    validRange: variable.validRange,
    timestamp,
    provenance: {
      sourceType: 'tier1_raw_telemetry',
      sourceId: datasetId,
      extractionMethod: 'direct_raster_mean',
      timestampExtracted: now
    },
    quality: {
      confidence: 1.0,
      calibrationStatus: 'instrument_calibrated'
    }
  };

  const frame: ScientificFeatureFrame = {
    schemaVersion: 'sfr.v1',
    frameId: `frame-ingest-${datasetId}`,
    sourceId: datasetId,
    timestamp,
    frameIndex: 0,
    features: [primaryFeature, spatialFeature],
    metadata: {
      title: spec.title,
      validCount,
      missingCount,
      coordinateReferenceSystem: coordinateReferenceSystem || 'EPSG:4326'
    }
  };

  return {
    frame,
    validValuesCount: validCount,
    missingValuesCount: missingCount,
    meanValue
  };
}

/**
 * Ingests a scientific multi-timestamp time series (e.g., CSV/JSON atmospheric observatory data).
 */
export function ingestTimeSeriesDataset(spec: TimeSeriesDatasetSpec): DatasetIngestionResult {
  const { datasetId, timestamps, values, variable } = spec;

  let validCount = 0;
  let missingCount = 0;
  let sum = 0;
  const cleanValues: number[] = [];

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (isNaN(val) || !isFinite(val) || (variable.fillValue !== undefined && Math.abs(val - variable.fillValue) < 1e-4)) {
      missingCount++;
    } else {
      validCount++;
      sum += val;
      cleanValues.push(val);
    }
  }

  const meanValue = validCount > 0 ? sum / validCount : 0;
  const now = Date.now();

  const timeSeriesFeature: TimeSeriesFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${datasetId}.${variable.name}_series`,
    featureName: variable.name,
    scientificDimension: 'temporal_behaviour',
    featureType: 'time_series',
    unit: variable.unit,
    validRange: variable.validRange,
    timestamp: timestamps[0] || 0,
    timestamps,
    values: cleanValues,
    provenance: {
      sourceType: 'tier1_raw_telemetry',
      sourceId: datasetId,
      extractionMethod: 'time_series_sensor_log',
      timestampExtracted: now
    },
    quality: {
      confidence: 1.0,
      calibrationStatus: 'instrument_calibrated',
      uncertainty: variable.uncertainty
        ? {
            value: variable.uncertainty,
            unit: variable.unit,
            type: 'standard_deviation'
          }
        : undefined
    }
  };

  const frame: ScientificFeatureFrame = {
    schemaVersion: 'sfr.v1',
    frameId: `frame-series-${datasetId}`,
    sourceId: datasetId,
    timestamp: timestamps[0] || 0,
    frameIndex: 0,
    features: [timeSeriesFeature],
    metadata: {
      title: spec.title,
      totalTimestamps: timestamps.length,
      validCount,
      missingCount
    }
  };

  return {
    frame,
    validValuesCount: validCount,
    missingValuesCount: missingCount,
    meanValue
  };
}
