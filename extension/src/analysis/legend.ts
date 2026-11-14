import { clamp, round3, normalizeRange } from './normalize';
import type { PresetLegendConfig } from '../contract/types';

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

/**
 * Converts sRGB [0..255] to CIELAB (D65 illuminant).
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  // 1. Linearize sRGB
  let lr = r / 255;
  let lg = g / 255;
  let lb = b / 255;

  lr = lr > 0.04045 ? Math.pow((lr + 0.055) / 1.055, 2.4) : lr / 12.92;
  lg = lg > 0.04045 ? Math.pow((lg + 0.055) / 1.055, 2.4) : lg / 12.92;
  lb = lb > 0.04045 ? Math.pow((lb + 0.055) / 1.055, 2.4) : lb / 12.92;

  // 2. Linear sRGB to CIEXYZ (D65)
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = (lr * 0.2126 + lg * 0.7152 + lb * 0.0722) / 1.00000;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;

  // 3. CIEXYZ to CIELAB
  const fx = x > 0.008856 ? Math.cbrt(x) : 7.787 * x + 16 / 116;
  const fy = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  const fz = z > 0.008856 ? Math.cbrt(z) : 7.787 * z + 16 / 116;

  const L = 116 * fy - 16;
  const la = 500 * (fx - fy);
  const lbVal = 200 * (fy - fz);

  return { L, a: la, b: lbVal };
}

/**
 * Euclidean distance in CIELAB space (Delta E 1976).
 */
export function deltaE(lab1: LabColor, lab2: LabColor): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export interface PreparedLegendStop {
  color: [number, number, number];
  lab: LabColor;
  value: number;
}

export interface PreparedLegendLUT {
  min: number;
  max: number;
  unit: string;
  stops: PreparedLegendStop[];
  /** Maximum allowable DeltaE distance before a pixel is marked non-data (e.g. background/mask) */
  maxDeltaE: number;
}

/**
 * Prepares and caches the legend lookup table for runtime calibration.
 */
export function prepareLegendLUT(
  legendConfig?: PresetLegendConfig,
  maxDeltaE = 36.0
): PreparedLegendLUT | null {
  if (!legendConfig || !legendConfig.stops || legendConfig.stops.length === 0) {
    return null;
  }

  const min = legendConfig.min ?? 0;
  const max = legendConfig.max ?? 1;
  const unit = legendConfig.unit ?? '';

  const stops: PreparedLegendStop[] = legendConfig.stops.map(s => ({
    color: s.color,
    lab: rgbToLab(s.color[0], s.color[1], s.color[2]),
    value: s.value
  }));

  return { min, max, unit, stops, maxDeltaE };
}

/**
 * Maps a single RGB pixel to a calibrated physical value using the legend LUT.
 * Returns null if the pixel is non-data (DeltaE from nearest stop > maxDeltaE).
 */
export function mapPixelToLegendValue(
  r: number,
  g: number,
  b: number,
  lut: PreparedLegendLUT
): { rawValue: number; normalizedValue: number } | null {
  const pixelLab = rgbToLab(r, g, b);

  let nearestStopIndex = -1;
  let minDistance = Infinity;

  const stops = lut.stops;
  const stopCount = stops.length;

  for (let i = 0; i < stopCount; i++) {
    const dist = deltaE(pixelLab, stops[i].lab);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStopIndex = i;
    }
  }

  // Reject pixel if it deviates too far from any calibrated color stop
  if (minDistance > lut.maxDeltaE || nearestStopIndex === -1) {
    return null;
  }

  // Find second nearest adjacent stop to interpolate smoothly along the gradient
  const primaryStop = stops[nearestStopIndex];
  let interpolatedValue = primaryStop.value;

  const prevStop = nearestStopIndex > 0 ? stops[nearestStopIndex - 1] : null;
  const nextStop = nearestStopIndex < stopCount - 1 ? stops[nearestStopIndex + 1] : null;

  let secondaryStop: PreparedLegendStop | null = null;
  let secondaryDist = Infinity;

  if (prevStop) {
    const d = deltaE(pixelLab, prevStop.lab);
    secondaryDist = d;
    secondaryStop = prevStop;
  }
  if (nextStop) {
    const d = deltaE(pixelLab, nextStop.lab);
    if (d < secondaryDist) {
      secondaryDist = d;
      secondaryStop = nextStop;
    }
  }

  if (secondaryStop && secondaryDist < lut.maxDeltaE * 1.5) {
    const totalDist = minDistance + secondaryDist;
    if (totalDist > 0) {
      const weightPrimary = 1 - minDistance / totalDist;
      const weightSecondary = 1 - secondaryDist / totalDist;
      const sumWeight = weightPrimary + weightSecondary;
      interpolatedValue =
        (primaryStop.value * weightPrimary + secondaryStop.value * weightSecondary) / sumWeight;
    }
  }

  const normalized = normalizeRange(interpolatedValue, lut.min, lut.max);
  return { rawValue: interpolatedValue, normalizedValue: normalized };
}

/**
 * Calculates mean legend-calibrated value across an RGBA image buffer.
 * Ignores uncalibrated or background pixels.
 */
export function calculateAverageLegendValue(
  data: Uint8ClampedArray,
  lut: PreparedLegendLUT | null
): number | null {
  if (!lut) return null;

  const len = data.length;
  let sumNorm = 0;
  let count = 0;

  for (let i = 0; i < len; i += 4) {
    const res = mapPixelToLegendValue(data[i], data[i + 1], data[i + 2], lut);
    if (res !== null) {
      sumNorm += res.normalizedValue;
      count++;
    }
  }

  if (count === 0) return null;
  return round3(clamp(sumNorm / count, 0.0, 1.0));
}
