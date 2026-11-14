/**
 * Earth Jukebox (EJB) — Static Scientific Image Extraction Engine
 *
 * Extracts defensible scientific features from static NASA Earth science visualisations,
 * maps colours against legend stops via CIELAB Delta-E, segments spatial regions,
 * and converts valid outputs into the Scientific Feature Representation (SFR v1).
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type {
  ScientificFeatureFrame,
  ScientificFeature,
  ScalarFeature,
  SpatialGridFeature
} from '../sfr/types';
import { rgbToLab, deltaE } from '../analysis/legend';

export interface LegendStop {
  stop: number; // [0.0, 1.0]
  color: { r: number; g: number; b: number }; // [0, 255]
  value?: number; // Physical value (e.g. 0 to 60 meters)
}

export interface LegendCalibrationConfig {
  min: number;
  max: number;
  unit: string;
  stops: LegendStop[];
}

export interface RegionOfInterest {
  x: number; // [0.0, 1.0]
  y: number;
  width: number;
  height: number;
}

export interface StaticImageExtractionOptions {
  sourceId: string;
  datasetName?: string;
  roi?: RegionOfInterest;
  legend?: LegendCalibrationConfig;
  gridRows?: number;
  gridCols?: number;
}

export interface StaticImageExtractionResult {
  frame: ScientificFeatureFrame;
  calibrationFound: boolean;
  meanDeltaE: number;
  uncalibratedReason?: string;
}

export interface PixelBuffer {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

/**
 * Extracts scientific features and spatial distributions from a static image raster.
 */
export function extractStaticImageFeatures(
  buffer: PixelBuffer,
  options: StaticImageExtractionOptions
): StaticImageExtractionResult {
  const { width, height, data } = buffer;
  const roi = options.roi || { x: 0, y: 0, width: 1, height: 1 };
  const gridRows = options.gridRows || 4;
  const gridCols = options.gridCols || 8;

  const startX = Math.floor(roi.x * width);
  const startY = Math.floor(roi.y * height);
  const roiW = Math.max(1, Math.floor(roi.width * width));
  const roiH = Math.max(1, Math.floor(roi.height * height));

  let totalLuma = 0;
  let totalR = 0, totalG = 0, totalB = 0;
  let pixelCount = 0;

  // Spatial grid accumulator
  const gridLumaSums = new Array(gridRows * gridCols).fill(0);
  const gridCounts = new Array(gridRows * gridCols).fill(0);

  // Rec. 601 Luminance coefficients: Y = 0.299 R + 0.587 G + 0.114 B
  for (let y = startY; y < startY + roiH && y < height; y++) {
    const rowIdx = Math.min(gridRows - 1, Math.floor(((y - startY) / roiH) * gridRows));

    for (let x = startX; x < startX + roiW && x < width; x++) {
      const colIdx = Math.min(gridCols - 1, Math.floor(((x - startX) / roiW) * gridCols));
      const cellIdx = rowIdx * gridCols + colIdx;

      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

      totalLuma += luma;
      totalR += r;
      totalG += g;
      totalB += b;
      pixelCount++;

      gridLumaSums[cellIdx] += luma;
      gridCounts[cellIdx]++;
    }
  }

  const meanLuma = pixelCount > 0 ? totalLuma / pixelCount : 0;
  const meanR = pixelCount > 0 ? totalR / pixelCount : 0;
  const meanG = pixelCount > 0 ? totalG / pixelCount : 0;
  const meanB = pixelCount > 0 ? totalB / pixelCount : 0;

  // Compute spatial grid values
  const gridValues: number[] = [];
  for (let i = 0; i < gridRows * gridCols; i++) {
    gridValues.push(gridCounts[i] > 0 ? gridLumaSums[i] / gridCounts[i] : 0);
  }

  // Delta-E Legend Matching
  let calibrationFound = false;
  let calibratedPhysicalValue: number | null = null;
  let meanDeltaE = 999.0;
  let uncalibratedReason: string | undefined = undefined;

  if (options.legend && options.legend.stops && options.legend.stops.length >= 2) {
    const meanLab = rgbToLab(meanR, meanG, meanB);
    let bestDist = Infinity;
    let bestStopIndex = -1;

    for (let i = 0; i < options.legend.stops.length; i++) {
      const stop = options.legend.stops[i];
      const stopLab = rgbToLab(stop.color.r, stop.color.g, stop.color.b);
      const dist = deltaE(meanLab, stopLab);
      if (dist < bestDist) {
        bestDist = dist;
        bestStopIndex = i;
      }
    }

    meanDeltaE = bestDist;
    // CIELAB Delta-E threshold < 35 for valid perceptual matching
    if (bestStopIndex !== -1 && bestDist < 35.0) {
      calibrationFound = true;
      const matchedStop = options.legend.stops[bestStopIndex];
      const normalizedStop = matchedStop.stop;
      calibratedPhysicalValue = options.legend.min + normalizedStop * (options.legend.max - options.legend.min);
    } else {
      uncalibratedReason = `Color Delta-E distance (${bestDist.toFixed(1)}) exceeded calibration threshold.`;
    }
  } else {
    uncalibratedReason = 'No documented NASA legend or colour scale provided for source.';
  }

  // Construct Scientific Features
  const features: ScientificFeature[] = [];
  const now = Date.now();

  // 1. Primary Feature (Calibrated Physical Measurement or Visual Proxy)
  if (calibrationFound && calibratedPhysicalValue !== null && options.legend) {
    const primaryFeature: ScalarFeature = {
      schemaVersion: 'sfr.v1',
      featureId: `${options.sourceId}.primary_measurement`,
      featureName: options.datasetName ? `${options.datasetName.toLowerCase().replace(/\s+/g, '_')}_value` : 'physical_measurement',
      scientificDimension: 'magnitude',
      featureType: 'scalar',
      value: Number(calibratedPhysicalValue.toFixed(3)),
      normalizedValue: Math.max(0, Math.min(1.0, (calibratedPhysicalValue - options.legend.min) / (options.legend.max - options.legend.min))),
      unit: options.legend.unit,
      validRange: [options.legend.min, options.legend.max],
      timestamp: 0,
      provenance: {
        sourceType: 'tier3_calibrated_visual',
        sourceId: options.sourceId,
        extractionMethod: 'cielab_legend_match',
        timestampExtracted: now
      },
      quality: {
        confidence: Math.max(0.1, 1.0 - meanDeltaE / 100.0),
        calibrationStatus: 'legend_calibrated',
        uncertainty: {
          value: Number(((options.legend.max - options.legend.min) * 0.05).toFixed(3)),
          unit: options.legend.unit,
          type: 'delta_e_distance'
        }
      }
    };
    features.push(primaryFeature);
  } else {
    // Uncalibrated fallback: explicitly labelled Tier 4 proxy
    const proxyFeature: ScalarFeature = {
      schemaVersion: 'sfr.v1',
      featureId: `${options.sourceId}.luminance_proxy`,
      featureName: 'perceptual_luminance',
      scientificDimension: 'magnitude',
      featureType: 'scalar',
      value: Number(meanLuma.toFixed(3)),
      normalizedValue: Number(meanLuma.toFixed(3)),
      unit: 'ratio',
      validRange: [0, 1],
      timestamp: 0,
      provenance: {
        sourceType: 'tier4_visual_proxy',
        sourceId: options.sourceId,
        extractionMethod: 'rec601_luma',
        timestampExtracted: now
      },
      quality: {
        confidence: 0.90,
        calibrationStatus: 'proxy_inferred'
      }
    };
    features.push(proxyFeature);
  }

  // 2. Spatial Grid Feature
  const spatialFeature: SpatialGridFeature = {
    schemaVersion: 'sfr.v1',
    featureId: `${options.sourceId}.spatial_grid`,
    featureName: 'spatial_regional_matrix',
    scientificDimension: 'structure_distribution',
    featureType: 'spatial_grid',
    unit: 'ratio',
    timestamp: 0,
    rows: gridRows,
    cols: gridCols,
    values: gridValues,
    normalizedValues: gridValues,
    provenance: {
      sourceType: calibrationFound ? 'tier3_calibrated_visual' : 'tier4_visual_proxy',
      sourceId: options.sourceId,
      extractionMethod: 'spatial_downsampling',
      timestampExtracted: now
    },
    quality: {
      confidence: 0.85,
      calibrationStatus: calibrationFound ? 'legend_calibrated' : 'proxy_inferred'
    }
  };
  features.push(spatialFeature);

  const frame: ScientificFeatureFrame = {
    schemaVersion: 'sfr.v1',
    frameId: `frame-static-${options.sourceId}`,
    sourceId: options.sourceId,
    timestamp: 0,
    frameIndex: 0,
    features,
    metadata: {
      roi,
      meanDeltaE: Number(meanDeltaE.toFixed(2)),
      calibrationFound,
      uncalibratedReason
    }
  };

  return {
    frame,
    calibrationFound,
    meanDeltaE,
    uncalibratedReason
  };
}
