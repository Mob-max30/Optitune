import { clamp, round3 } from './normalize';

/**
 * Calculates Rec. 601 luma for a single RGB triplet:
 * Y = 0.299*R + 0.587*G + 0.114*B
 * Returns normalized float in [0.0, 1.0].
 */
export function calculatePixelLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export interface LuminanceOptions {
  /** If set, pixels with luminance below this value are skipped (e.g. dark space or ocean mask) */
  ignoreDark?: number;
}

/**
 * Calculates mean Rec. 601 luminance over an RGBA buffer.
 *
 * @param data Uint8ClampedArray of RGBA pixel bytes
 * @param options Optional configuration (ignoreDark threshold)
 * @returns Normalized mean luminance [0.0, 1.0]
 */
export function calculateAverageLuminance(
  data: Uint8ClampedArray,
  options: LuminanceOptions = {}
): number {
  const len = data.length;
  if (len === 0) return 0;

  const threshold = options.ignoreDark ?? 0;
  let totalLuma = 0;
  let validCount = 0;

  for (let i = 0; i < len; i += 4) {
    const luma = calculatePixelLuminance(data[i], data[i + 1], data[i + 2]);
    if (luma >= threshold) {
      totalLuma += luma;
      validCount++;
    }
  }

  if (validCount === 0) return 0;
  return round3(clamp(totalLuma / validCount, 0.0, 1.0));
}
