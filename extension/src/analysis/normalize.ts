/**
 * Clamps a numeric value between min (default 0.0) and max (default 1.0).
 */
export function clamp(val: number, min = 0.0, max = 1.0): number {
  if (Number.isNaN(val)) return min;
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

/**
 * Rounds a float to 3 decimal places for compact JSON transmission.
 * Avoids precision issues and excessive string serialization.
 */
export function round3(val: number): number {
  return Math.round(val * 1000) / 1000;
}

/**
 * Normalizes a raw value within [min, max] to a clamped [0.0, 1.0] float rounded to 3 decimals.
 */
export function normalizeRange(val: number, min: number, max: number): number {
  if (max === min) return 0;
  const normalized = (val - min) / (max - min);
  return round3(clamp(normalized, 0.0, 1.0));
}
