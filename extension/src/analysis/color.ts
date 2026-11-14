import { clamp, round3 } from './normalize';
import type { NormalizedRGB } from '../contract/types';

export interface ColorMetrics {
  dominantColor: NormalizedRGB;
  hue: number;        // [0.0, 1.0]
  saturation: number; // [0.0, 1.0]
}

export interface RGBToHSVResult {
  h: number; // [0.0, 1.0]
  s: number; // [0.0, 1.0]
  v: number; // [0.0, 1.0]
}

/**
 * Converts RGB [0, 255] to HSV [0.0, 1.0].
 */
export function rgbToHsv(r: number, g: number, b: number): RGBToHSVResult {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rf) {
      h = ((gf - bf) / delta) % 6;
    } else if (max === gf) {
      h = (bf - rf) / delta + 2;
    } else {
      h = (rf - gf) / delta + 4;
    }
    h = h / 6;
    if (h < 0) h += 1.0;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;

  return { h, s, v };
}

export interface ColorAnalysisOptions {
  /** Skip pixels darker than this in color extraction (0.0 - 1.0) */
  ignoreDark?: number;
  /** Minimum saturation threshold to participate in hue voting (default: 0.12) */
  minSaturation?: number;
}

/**
 * Analyzes dominant color using an HSV 12-bin hue histogram peak.
 * This guarantees a red+blue map reports either red or blue rather than false purple.
 */
export function extractColorMetrics(
  data: Uint8ClampedArray,
  options: ColorAnalysisOptions = {}
): ColorMetrics {
  const len = data.length;
  if (len === 0) {
    return {
      dominantColor: { r: 0, g: 0, b: 0 },
      hue: 0,
      saturation: 0
    };
  }

  const ignoreDark = options.ignoreDark ?? 0.05;
  const minSaturation = options.minSaturation ?? 0.12;

  // 12 hue bins: each bin spans 30 degrees (1/12 of [0.0, 1.0])
  const NUM_BINS = 12;
  const binCounts = new Uint32Array(NUM_BINS);
  const binTotalR = new Float64Array(NUM_BINS);
  const binTotalG = new Float64Array(NUM_BINS);
  const binTotalB = new Float64Array(NUM_BINS);
  const binTotalSat = new Float64Array(NUM_BINS);

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let totalSat = 0;
  let nonDarkCount = 0;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const { h, s, v } = rgbToHsv(r, g, b);

    // Skip black/dark space or background
    if (v < ignoreDark) continue;

    totalR += r;
    totalG += g;
    totalB += b;
    totalSat += s;
    nonDarkCount++;

    if (s >= minSaturation) {
      const bin = Math.min(NUM_BINS - 1, Math.floor(h * NUM_BINS));
      binCounts[bin]++;
      binTotalR[bin] += r;
      binTotalG[bin] += g;
      binTotalB[bin] += b;
      binTotalSat[bin] += s;
    }
  }

  if (nonDarkCount === 0) {
    return {
      dominantColor: { r: 0, g: 0, b: 0 },
      hue: 0,
      saturation: 0
    };
  }

  // Find peak hue bin
  let peakBin = -1;
  let maxCount = 0;
  for (let b = 0; b < NUM_BINS; b++) {
    if (binCounts[b] > maxCount) {
      maxCount = binCounts[b];
      peakBin = b;
    }
  }

  if (peakBin !== -1 && maxCount > 0) {
    // Dominant color is average of pixels belonging to the peak hue bin
    const count = binCounts[peakBin];
    const rNorm = round3(clamp(binTotalR[peakBin] / count / 255));
    const gNorm = round3(clamp(binTotalG[peakBin] / count / 255));
    const bNorm = round3(clamp(binTotalB[peakBin] / count / 255));
    const satNorm = round3(clamp(binTotalSat[peakBin] / count));
    const hueCenter = round3((peakBin + 0.5) / NUM_BINS);

    return {
      dominantColor: { r: rNorm, g: gNorm, b: bNorm },
      hue: hueCenter,
      saturation: satNorm
    };
  }

  // Fallback to overall mean when saturated pixels are absent (monochrome/grayscale imagery)
  const meanR = round3(clamp(totalR / nonDarkCount / 255));
  const meanG = round3(clamp(totalG / nonDarkCount / 255));
  const meanB = round3(clamp(totalB / nonDarkCount / 255));
  const meanSat = round3(clamp(totalSat / nonDarkCount));

  return {
    dominantColor: { r: meanR, g: meanG, b: meanB },
    hue: 0,
    saturation: meanSat
  };
}
