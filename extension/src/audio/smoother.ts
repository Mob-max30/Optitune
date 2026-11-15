/**
 * OptiTone — Parameter Smoother
 *
 * Implements exponential moving average (EMA) smoothing for audio parameters
 * driven by 10–15 Hz visual analysis frames.
 *
 * Prevents audible zipper noise and audio glitches while respecting
 * `flags.seeked` and `flags.scene_cut` to bypass smoothing instantly on jumps.
 *
 * Authored by Pranav K.
 */

export class ParameterSmoother {
  private currentValue: number;
  private targetValue: number;
  private readonly smoothingFactor: number;

  /**
   * @param initialValue Initial parameter value
   * @param smoothingFactor Weight of new target per update (0.0 < alpha <= 1.0).
   *                        Lower = smoother / slower response. Default 0.25 (~80ms half-life at 12 Hz).
   */
  constructor(initialValue = 0.0, smoothingFactor = 0.25) {
    this.currentValue = initialValue;
    this.targetValue = initialValue;
    this.smoothingFactor = Math.max(0.01, Math.min(1.0, smoothingFactor));
  }

  /**
   * Update the target value and step the current smoothed value forward.
   *
   * @param target The incoming raw target value from visual metrics
   * @param bypassSmoothing If true (e.g. on seeked or scene cut), snaps instantly
   * @returns The updated smoothed value
   */
  step(target: number, bypassSmoothing = false): number {
    this.targetValue = target;

    if (bypassSmoothing || !Number.isFinite(this.currentValue)) {
      this.currentValue = target;
      return this.currentValue;
    }

    this.currentValue += (this.targetValue - this.currentValue) * this.smoothingFactor;
    return this.currentValue;
  }

  /**
   * Instant reset to a specific value without smoothing.
   */
  reset(value: number): void {
    this.currentValue = value;
    this.targetValue = value;
  }

  /**
   * Get the current smoothed value.
   */
  get(): number {
    return this.currentValue;
  }

  /**
   * Get the current target value.
   */
  getTarget(): number {
    return this.targetValue;
  }
}

/**
 * Multi-parameter smoother group for managing all core audio channels.
 */
export class FrameMetricsSmoother {
  readonly frequency: ParameterSmoother;
  readonly gain: ParameterSmoother;
  readonly pan: ParameterSmoother;
  readonly filterCutoff: ParameterSmoother;
  readonly resonance: ParameterSmoother;

  constructor(defaultFreq = 220.0) {
    this.frequency = new ParameterSmoother(defaultFreq, 0.3);
    this.gain = new ParameterSmoother(0.0, 0.25);
    this.pan = new ParameterSmoother(0.0, 0.2);
    this.filterCutoff = new ParameterSmoother(1000.0, 0.25);
    this.resonance = new ParameterSmoother(1.0, 0.15);
  }

  resetAll(freq = 220.0, gain = 0.0, pan = 0.0, cutoff = 1000.0): void {
    this.frequency.reset(freq);
    this.gain.reset(gain);
    this.pan.reset(pan);
    this.filterCutoff.reset(cutoff);
    this.resonance.reset(1.0);
  }
}
