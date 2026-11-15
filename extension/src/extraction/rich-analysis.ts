/**
 * Earth Jukebox (EJB) — Rich Analysis Path (Amendment A, Section A1 & A3)
 *
 * Implements a secondary 2-4 Hz analysis path operating on higher resolution (~128px)
 * with temporal validity masking, feature extraction, and Contract v1.1 payload generation.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { RichFeaturePayload, RichSpatialBlob, RichFeatureProvenance } from '../contract/v1_1';
import type { PreparedLegendLUT } from '../analysis/legend';
import { mapPixelToLegendValue } from '../analysis/legend';
import { clamp, round3 } from '../analysis/normalize';

export interface RichAnalysisOptions {
  sourceKey: string;
  phenomenonClass?: string;
  lut?: PreparedLegendLUT | null;
  minDataCoverage?: number; // default: 0.20
}

export interface RichTemporalHistory {
  lastSampleTime: number;
  lastLevel: number;
  lastExtremeFrac: number;
  lastBlobCount: number;
  recentLevels: number[];
}

export class RichAnalysisPipeline {
  private historyMap = new Map<string, RichTemporalHistory>();

  /**
   * Analyzes a 128px crop buffer and extracts the complete A3 feature set with validity masking.
   */
  analyze(
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    t: number,
    frameIndex: number,
    options: RichAnalysisOptions
  ): RichFeaturePayload {
    const totalPixels = width * height;
    const lut = options.lut || null;
    const sourceKey = options.sourceKey;
    const phenomenonClass = options.phenomenonClass || 'generic-earth';

    // 1. A1 Validity Masking: exclude space background, border margins, chrome
    // Mask rule: luminance < 0.04 (space) or alpha < 128
    const validIndices: number[] = [];
    const validLumas: number[] = [];
    const validNormValues: number[] = [];
    let calibratedHits = 0;

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    for (let i = 0; i < totalPixels; i++) {
      const offset = i * 4;
      const r = rgbaData[offset];
      const g = rgbaData[offset + 1];
      const b = rgbaData[offset + 2];
      const a = rgbaData[offset + 3];

      if (a < 128) continue; // transparent chrome

      // Rec. 709 luminance
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (luma < 0.04) continue; // space / dark margin

      validIndices.push(i);
      validLumas.push(luma);

      rSum += r;
      gSum += g;
      bSum += b;

      // Legend calibration check
      if (lut) {
        const res = mapPixelToLegendValue(r, g, b, lut);
        if (res !== null) {
          validNormValues.push(res.normalizedValue);
          calibratedHits++;
        } else {
          validNormValues.push(luma); // fallback for pixels outside palette
        }
      } else {
        validNormValues.push(luma);
      }
    }

    const validCount = validIndices.length;
    const coverage = totalPixels > 0 ? validCount / totalPixels : 0;
    const maskedFraction = 1 - coverage;

    // Determine provenance
    const isCalibrated = Boolean(lut && validCount > 0 && (calibratedHits / validCount) >= (options.minDataCoverage ?? 0.20));
    const provenance: RichFeatureProvenance = isCalibrated ? 'calibrated visualisation' : 'visual proxy';

    // Use normalized values for distribution features
    const dataValues = isCalibrated ? validNormValues : validLumas;

    // Handle degenerate case (completely masked / black)
    if (validCount === 0) {
      return this.buildNeutralPayload(sourceKey, phenomenonClass, t, frameIndex);
    }

    // 2. Percentile Calculation via Sorting (efficient on valid subset)
    const sorted = [...dataValues].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.10)];
    const p50 = sorted[Math.floor(sorted.length * 0.50)]; // Level / median
    const p90 = sorted[Math.floor(sorted.length * 0.90)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    const level = round3(p50);
    const spread = round3(Math.max(0, p90 - p10));
    const peak = round3(p99);

    // Extreme fraction (share of valid pixels above 0.85 or P90 threshold)
    const extremeThreshold = Math.max(0.75, p90);
    let extremeCount = 0;
    let focusXSum = 0;
    let focusYSum = 0;

    for (let k = 0; k < validCount; k++) {
      const val = dataValues[k];
      if (val >= extremeThreshold) {
        extremeCount++;
        const pixIdx = validIndices[k];
        const px = pixIdx % width;
        const py = Math.floor(pixIdx / width);
        focusXSum += px / width;
        focusYSum += py / height;
      }
    }

    const extremeFrac = round3(extremeCount / validCount);
    const focus: [number, number] = extremeCount > 0
      ? [round3(focusXSum / extremeCount), round3(focusYSum / extremeCount)]
      : [0.5, 0.5];

    // 3. Texture / Local Variance
    let diffSum = 0;
    let diffCount = 0;
    for (let r = 0; r < height - 1; r += 2) {
      for (let c = 0; c < width - 1; c += 2) {
        const idx1 = (r * width + c) * 4;
        const idx2 = (r * width + c + 1) * 4;
        const idx3 = ((r + 1) * width + c) * 4;
        const l1 = (rgbaData[idx1] + rgbaData[idx1 + 1] + rgbaData[idx1 + 2]) / 765;
        const l2 = (rgbaData[idx2] + rgbaData[idx2 + 1] + rgbaData[idx2 + 2]) / 765;
        const l3 = (rgbaData[idx3] + rgbaData[idx3 + 1] + rgbaData[idx3 + 2]) / 765;
        diffSum += Math.abs(l1 - l2) + Math.abs(l1 - l3);
        diffCount += 2;
      }
    }
    const texture = round3(diffCount > 0 ? clamp(diffSum / diffCount, 0, 1) : 0);

    // 4. Diverging Sign (fraction above vs below midpoint 0.5)
    let aboveCount = 0;
    let belowCount = 0;
    for (let k = 0; k < validCount; k++) {
      if (dataValues[k] > 0.52) aboveCount++;
      else if (dataValues[k] < 0.48) belowCount++;
    }
    const sign = round3(validCount > 0 ? (aboveCount - belowCount) / validCount : 0);

    // 5. Value Histogram Entropy (16 bins)
    const bins = new Uint32Array(16);
    for (let k = 0; k < validCount; k++) {
      const bIdx = Math.min(15, Math.floor(dataValues[k] * 16));
      bins[bIdx]++;
    }
    let entropySum = 0;
    for (let b = 0; b < 16; b++) {
      if (bins[b] > 0) {
        const p = bins[b] / validCount;
        entropySum -= p * Math.log2(p);
      }
    }
    const entropy = round3(clamp(entropySum / 4.0, 0, 1)); // normalized by log2(16) = 4

    // 6. Left-Right Spatial Symmetry
    let symDiff = 0;
    let symSamples = 0;
    const halfWidth = Math.floor(width / 2);
    for (let r = 0; r < height; r += 2) {
      for (let c = 0; c < halfWidth; c += 2) {
        const leftIdx = (r * width + c) * 4;
        const rightIdx = (r * width + (width - 1 - c)) * 4;
        const leftLuma = (rgbaData[leftIdx] + rgbaData[leftIdx + 1] + rgbaData[leftIdx + 2]) / 765;
        const rightLuma = (rgbaData[rightIdx] + rgbaData[rightIdx + 1] + rgbaData[rightIdx + 2]) / 765;
        symDiff += Math.abs(leftLuma - rightLuma);
        symSamples++;
      }
    }
    const symmetry = round3(symSamples > 0 ? clamp(1.0 - (symDiff / symSamples), 0, 1) : 0.5);

    // 7. Coarse Hue Family
    const meanR = rSum / validCount;
    const meanG = gSum / validCount;
    const meanB = bSum / validCount;
    const maxC = Math.max(meanR, meanG, meanB);
    const minC = Math.min(meanR, meanG, meanB);
    const chroma = maxC - minC;
    const sat = maxC > 0 ? chroma / maxC : 0;

    let hueFamily: RichFeaturePayload['hueFamily'] = 'neutral';
    if (sat < 0.18) {
      hueFamily = 'monochrome';
    } else {
      let hue = 0;
      if (maxC === meanR) {
        hue = ((meanG - meanB) / (chroma || 1)) % 6;
      } else if (maxC === meanG) {
        hue = (meanB - meanR) / (chroma || 1) + 2;
      } else {
        hue = (meanR - meanG) / (chroma || 1) + 4;
      }
      hue = (hue * 60 + 360) % 360; // 0 to 360

      if (hue >= 75 && hue <= 165) hueFamily = 'foliage';
      else if (hue > 165 && hue <= 265) hueFamily = 'cool';
      else if (hue < 50 || hue > 310) hueFamily = 'warm';
      else hueFamily = 'neutral';
    }

    // 8. Connected Component Blobs (on downsampled 16x16 grid for extreme points)
    const blobs = this.extractBlobs(dataValues, validIndices, width, height, extremeThreshold);

    // 9. Temporal Features (rate, trend, onsets)
    const temporal = this.computeTemporalFeatures(sourceKey, t, level, extremeFrac, blobs.count);

    const payload: RichFeaturePayload = {
      v: '1.1',
      t: round3(t),
      frameIndex,
      sourceKey,
      phenomenonClass,
      provenance,
      maskedFraction: round3(maskedFraction),
      coverage: round3(coverage),
      level,
      spread,
      extremeFrac,
      peak,
      focus,
      texture,
      sign,
      entropy,
      symmetry,
      hueFamily,
      blobs,
      temporal
    };

    if (isCalibrated && lut) {
      payload.physical = {
        unit: lut.unit || '',
        min: lut.min,
        max: lut.max,
        medianPhysical: round3(lut.min + level * (lut.max - lut.min))
      };
    }

    return payload;
  }

  /**
   * Extracts up to 5 major spatial blobs from extreme value points.
   */
  private extractBlobs(
    dataValues: number[],
    validIndices: number[],
    width: number,
    height: number,
    threshold: number
  ): { count: number; items: RichSpatialBlob[] } {
    // Coarse 16x16 grid accumulation
    const gridDim = 16;
    const gridCounts = new Uint16Array(gridDim * gridDim);
    const gridValSum = new Float32Array(gridDim * gridDim);

    const cellW = width / gridDim;
    const cellH = height / gridDim;

    for (let k = 0; k < dataValues.length; k++) {
      if (dataValues[k] >= threshold) {
        const pixIdx = validIndices[k];
        const px = pixIdx % width;
        const py = Math.floor(pixIdx / width);
        const gx = Math.min(gridDim - 1, Math.floor(px / cellW));
        const gy = Math.min(gridDim - 1, Math.floor(py / cellH));
        const gIdx = gy * gridDim + gx;
        gridCounts[gIdx]++;
        gridValSum[gIdx] += dataValues[k];
      }
    }

    // Collect active grid cells as blobs
    const items: RichSpatialBlob[] = [];
    let blobId = 1;

    for (let gy = 0; gy < gridDim; gy++) {
      for (let gx = 0; gx < gridDim; gx++) {
        const gIdx = gy * gridDim + gx;
        const cnt = gridCounts[gIdx];
        if (cnt >= 4) { // meaningful cluster
          items.push({
            id: blobId++,
            centroid: [round3((gx + 0.5) / gridDim), round3((gy + 0.5) / gridDim)],
            pixelArea: cnt,
            meanValue: round3(gridValSum[gIdx] / cnt)
          });
        }
      }
    }

    items.sort((a, b) => b.pixelArea - a.pixelArea);
    const topBlobs = items.slice(0, 5);

    return {
      count: topBlobs.length,
      items: topBlobs
    };
  }

  /**
   * Computes temporal trend, rate of change, and onset detection across frames.
   */
  private computeTemporalFeatures(
    sourceKey: string,
    t: number,
    level: number,
    extremeFrac: number,
    blobCount: number
  ): RichFeaturePayload['temporal'] {
    const hist = this.historyMap.get(sourceKey);

    if (!hist) {
      this.historyMap.set(sourceKey, {
        lastSampleTime: t,
        lastLevel: level,
        lastExtremeFrac: extremeFrac,
        lastBlobCount: blobCount,
        recentLevels: [level]
      });
      return { rate: 0.0, trend: 0.0, onset: false, sceneCut: false };
    }

    const dt = Math.max(0.001, t - hist.lastSampleTime);
    const rate = round3(clamp(Math.abs(level - hist.lastLevel) / dt, 0, 5));
    const sceneCut = Math.abs(level - hist.lastLevel) > 0.40;
    const onset = !sceneCut && ((extremeFrac - hist.lastExtremeFrac > 0.15) || (blobCount > hist.lastBlobCount + 1));

    hist.recentLevels.push(level);
    if (hist.recentLevels.length > 8) hist.recentLevels.shift();

    // Trend: slope over recent window
    let trend = 0.0;
    if (hist.recentLevels.length >= 3) {
      const n = hist.recentLevels.length;
      trend = round3(clamp((hist.recentLevels[n - 1] - hist.recentLevels[0]) / n, -1, 1));
    }

    hist.lastSampleTime = t;
    hist.lastLevel = level;
    hist.lastExtremeFrac = extremeFrac;
    hist.lastBlobCount = blobCount;

    return { rate, trend, onset, sceneCut };
  }

  private buildNeutralPayload(
    sourceKey: string,
    phenomenonClass: string,
    t: number,
    frameIndex: number
  ): RichFeaturePayload {
    return {
      v: '1.1',
      t: round3(t),
      frameIndex,
      sourceKey,
      phenomenonClass,
      provenance: 'visual proxy',
      maskedFraction: 1.0,
      coverage: 0.0,
      level: 0.0,
      spread: 0.0,
      extremeFrac: 0.0,
      peak: 0.0,
      focus: [0.5, 0.5],
      texture: 0.0,
      sign: 0.0,
      entropy: 0.0,
      symmetry: 1.0,
      hueFamily: 'monochrome',
      blobs: { count: 0, items: [] },
      temporal: { rate: 0.0, trend: 0.0, onset: false, sceneCut: false }
    };
  }

  clearHistory(): void {
    this.historyMap.clear();
  }
}
