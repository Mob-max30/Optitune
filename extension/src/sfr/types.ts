/**
 * Earth Jukebox (EJB) — Scientific Feature Representation (SFR v1)
 *
 * A common, provenance-aware intermediate representation for extracted scientific properties,
 * decoupling source ingestion (video frames, NASA metadata, NetCDF/HDF5 arrays)
 * from semantic sonification mapping and audio synthesis.
 *
 * Authored by Pranav K & Ujwal A.
 */

export type FeatureType =
  | 'scalar'
  | 'time_series'
  | 'spatial_grid'
  | 'vector'
  | 'event'
  | 'categorical';

export type SourceProvenanceTier =
  | 'tier1_raw_telemetry'     // Direct NetCDF, HDF5, GeoTIFF floating-point arrays
  | 'tier2_nasa_metadata'      // Documented SVS parameters, metadata headers
  | 'tier3_calibrated_visual'  // CIELAB ΔE nearest-stop legend calibration from video
  | 'tier4_visual_proxy';      // Generic video features (luma, hue, optical flow delta)

export type CalibrationStatus =
  | 'uncalibrated'
  | 'legend_calibrated'
  | 'instrument_calibrated'
  | 'proxy_inferred';

export interface SpatialCoordinates {
  regionId?: string;
  row?: number;
  col?: number;
  latitude?: number;
  longitude?: number;
  xNorm?: number; // [0.0, 1.0]
  yNorm?: number; // [0.0, 1.0]
  spatialReference?: string;
}

export interface FeatureProvenance {
  sourceType: SourceProvenanceTier;
  sourceId: string; // e.g. "SVS-4950", "GEDI_L2A", "MODIS_AOD"
  extractionMethod: string; // e.g. "cielab_legend_match", "rec601_luma", "direct_raster"
  timestampExtracted: number;
  frameIndex?: number;
}

export interface FeatureQuality {
  confidence: number; // [0.0, 1.0]
  uncertainty?: {
    value: number;
    unit: string;
    type?: 'standard_deviation' | 'range' | 'delta_e_distance';
  };
  calibrationStatus: CalibrationStatus;
  qualityFlags?: string[];
}

export interface BaseScientificFeature {
  schemaVersion: 'sfr.v1';
  featureId: string;
  featureName: string; // e.g. "canopy_height", "sea_surface_temperature", "co2_concentration"
  scientificDimension:
    | 'magnitude'
    | 'position'
    | 'direction'
    | 'velocity'
    | 'acceleration'
    | 'orientation'
    | 'temporal_behaviour'
    | 'structure_distribution'
    | 'events_anomalies'
    | 'uncertainty';
  featureType: FeatureType;
  unit: string; // Physical unit (e.g. "m", "°C", "ppm", "ratio", "none")
  validRange?: [number, number]; // Physical min/max
  timestamp: number; // seconds in media or physical time
  spatial?: SpatialCoordinates;
  provenance: FeatureProvenance;
  quality: FeatureQuality;
  isMissing?: boolean;
}

export interface ScalarFeature extends BaseScientificFeature {
  featureType: 'scalar';
  value: number; // physical value
  normalizedValue: number; // [0.0, 1.0] normalized against validRange
}

export interface SpatialGridFeature extends BaseScientificFeature {
  featureType: 'spatial_grid';
  rows: number;
  cols: number;
  values: (number | null)[]; // row-major array
  normalizedValues: number[]; // [0.0, 1.0]
}

export interface EventFeature extends BaseScientificFeature {
  featureType: 'event';
  eventType: 'flash' | 'bright-spot' | 'scene_cut' | 'threshold_crossing';
  intensity: number; // [0.0, 1.0]
  position: { x: number; y: number }; // normalized [0.0, 1.0]
}

export interface VectorFeature extends BaseScientificFeature {
  featureType: 'vector';
  magnitude: number;
  directionDegrees: number; // [0, 360)
  uComponent?: number;
  vComponent?: number;
}

export interface TimeSeriesFeature extends BaseScientificFeature {
  featureType: 'time_series';
  timestamps: number[];
  values: number[];
}

export interface CategoricalFeature extends BaseScientificFeature {
  featureType: 'categorical';
  category: string;
  classProbabilities?: Record<string, number>;
}

export type ScientificFeature =
  | ScalarFeature
  | SpatialGridFeature
  | EventFeature
  | VectorFeature
  | TimeSeriesFeature
  | CategoricalFeature;

export interface ScientificFeatureFrame {
  schemaVersion: 'sfr.v1';
  frameId: string;
  sourceId: string;
  timestamp: number;
  frameIndex: number;
  features: ScientificFeature[];
  metadata?: Record<string, unknown>;
}
