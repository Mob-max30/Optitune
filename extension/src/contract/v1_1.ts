/**
 * Earth Jukebox (EJB) — Contract v1.1 Additive Specification
 *
 * Implements Amendment A, Section A1 & A3:
 * Rich analysis feature payload dispatched as additive DOM event "ejb:features".
 * Consumers of Contract v1 ("ejb:frame") ignore this event; it does not alter v1 semantics.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

export type RichFeatureProvenance = 'calibrated visualisation' | 'visual proxy';

export interface RichSpatialBlob {
  id: number;
  centroid: [number, number]; // [x, y] in normalized [0, 1] image space
  pixelArea: number;          // uncalibrated pixel area (never claimed as physical area)
  meanValue: number;
}

export interface RichFeaturePayload {
  v: '1.1';
  t: number;                  // Media playback time in seconds
  frameIndex: number;
  sourceKey: string;
  phenomenonClass: string;
  provenance: RichFeatureProvenance;
  maskedFraction: number;     // Share of frame masked out (space, borders, chrome)
  coverage: number;           // Share of active data pixels (1 - maskedFraction)

  // A3 Value & Distribution Features
  level: number;              // Median (P50) of valid data pixels [0, 1]
  spread: number;             // P90 - P10 [0, 1]
  extremeFrac: number;        // Share of pixels in extreme range (>P90 or reference threshold)
  peak: number;               // P99 value [0, 1]
  focus: [number, number];    // Centroid of extremes [x, y] in [0, 1]
  texture: number;            // Local variance / edge density [0, 1]
  sign: number;               // Balance above (>0.5) vs below (<0.5) midpoint [-1, 1]
  entropy: number;            // Normalized Shannon entropy of value histogram [0, 1]
  symmetry: number;           // Left-right spatial symmetry [0, 1]
  hueFamily: 'warm' | 'cool' | 'neutral' | 'foliage' | 'monochrome';

  // Connected Component Blobs
  blobs: {
    count: number;
    items: RichSpatialBlob[];
  };

  // Temporal Features
  temporal: {
    rate: number;             // Mean absolute difference from previous sampled frame
    trend: number;            // Robust slope of level over sampled window
    onset: boolean;           // True on abrupt extremeFrac or blob count jump
    sceneCut: boolean;
  };

  // Optional calibrated physical values (only present if provenance === 'calibrated visualisation')
  physical?: {
    unit: string;
    min: number;
    max: number;
    medianPhysical: number;
  };
}

export interface EjbFeaturesEventDetail {
  features: RichFeaturePayload;
}

declare global {
  interface WindowEventMap {
    'ejb:features': CustomEvent<RichFeaturePayload>;
  }
}
