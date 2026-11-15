/**
 * Earth Jukebox (EJB) — Adaptive Dynamic Auto-Ranger
 *
 * Expands narrow data ranges (e.g. videos where physical values or brightness
 * fluctuate only between 0.42 and 0.50) into the full [0.0, 1.0] acoustic scale.
 *
 * Without auto-ranging, subtle visual movements map to tiny, imperceptible
 * frequency changes (<3 Hz), sounding like a monotone single frequency.
 *
 * Uses leaky running min/max tracking with hysteresis to provide responsive,
 * musical contrast while remaining stable against single-frame spikes.
 */

export class DynamicAutoRanger {
  private minVal = 1.0;
  private maxVal = 0.0;
  private hasSeenData = false;
  private readonly alpha: number;
  private readonly minSpan: number;

  /**
   * @param alpha Adaptation speed (0.01 - 0.10). Lower = slower, more stable.
   * @param minSpan Minimum window width [0.05 - 0.25] to prevent zooming in on camera noise.
   */
  constructor(alpha = 0.03, minSpan = 0.12) {
    this.alpha = alpha;
    this.minSpan = minSpan;
  }

  /**
   * Processes a raw normalized data value and returns an auto-ranged [0.0, 1.0] value.
   *
   * @param val Raw incoming value [0.0, 1.0]
   * @param bypass If true (e.g. on seek/scene cut), re-centers bounds instantly
   */
  process(val: number, bypass = false): number {
    if (!Number.isFinite(val)) return 0.5;

    const clampedVal = Math.max(0.0, Math.min(1.0, val));

    if (!this.hasSeenData || bypass) {
      this.minVal = Math.max(0.0, clampedVal - this.minSpan);
      this.maxVal = Math.min(1.0, clampedVal + this.minSpan);
      this.hasSeenData = true;
      return 0.5;
    }

    // Adapt bounds
    if (clampedVal < this.minVal) {
      this.minVal = clampedVal;
    } else {
      this.minVal += this.alpha * (clampedVal - this.minVal);
    }

    if (clampedVal > this.maxVal) {
      this.maxVal = clampedVal;
    } else {
      this.maxVal -= this.alpha * (this.maxVal - clampedVal);
    }

    const currentSpan = Math.max(this.minSpan, this.maxVal - this.minVal);
    const normalized = Math.max(0.0, Math.min(1.0, (clampedVal - this.minVal) / currentSpan));
    return normalized;
  }

  reset(): void {
    this.hasSeenData = false;
    this.minVal = 1.0;
    this.maxVal = 0.0;
  }

  getBounds(): { min: number; max: number; span: number } {
    return {
      min: this.minVal,
      max: this.maxVal,
      span: Math.max(this.minSpan, this.maxVal - this.minVal)
    };
  }
}
