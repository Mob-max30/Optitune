/**
 * Earth Jukebox (EJB) — Reference-Relative Normalization Engine (Amendment A, Section A2)
 *
 * Implements reference-relative and source-baseline normalization to eliminate
 * the collapse caused by per-frame min-max and static clamping.
 *
 * Priority order:
 * 1. Physical reference range (documented legend range & standard deviations)
 * 2. Source baseline (P10, P50, P90 distribution from baseline pass or running estimator)
 * 3. Flat neutral profile (when no reference or baseline is available)
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import { clamp, round3 } from '../analysis/normalize';
import phenomenonReferencesData from '../../../reference/phenomenon-references.json';

export type BaselineMode = 'physical_reference' | 'source_pass' | 'running' | 'neutral';

export interface FeatureDistribution {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
  std: number;
  sampleCount: number;
}

export interface NormalizedFeatureValue {
  rawValue: number;
  zScore: number;          // clamp((f - mu) / sigma, -4, 4)
  unitInterval: number;    // mapped to [0, 1] for parameter scaling
  baselineMode: BaselineMode;
  explanation: string;
}

export class RunningSourceBaseline {
  private featureHistory = new Map<string, number[]>();
  private readonly maxSamples = 120; // ~10 seconds at 12 Hz

  addSample(featureName: string, value: number): void {
    if (typeof value !== 'number' || isNaN(value)) return;
    let hist = this.featureHistory.get(featureName);
    if (!hist) {
      hist = [];
      this.featureHistory.set(featureName, hist);
    }
    hist.push(value);
    if (hist.length > this.maxSamples) {
      hist.shift();
    }
  }

  getDistribution(featureName: string): FeatureDistribution | null {
    const hist = this.featureHistory.get(featureName);
    if (!hist || hist.length < 12) return null; // Needs warm-up

    const sorted = [...hist].sort((a, b) => a - b);
    const n = sorted.length;
    const p10 = sorted[Math.floor(n * 0.10)];
    const p50 = sorted[Math.floor(n * 0.50)];
    const p90 = sorted[Math.floor(n * 0.90)];

    const sum = hist.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const variance = hist.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n || 1);
    const std = Math.sqrt(variance) || 0.001;

    return { p10, p50, p90, mean, std, sampleCount: n };
  }

  clear(): void {
    this.featureHistory.clear();
  }
}

export class ReferenceRelativeNormalizer {
  private runningBaselines = new Map<string, RunningSourceBaseline>();
  private references = phenomenonReferencesData.phenomena as Record<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
    unit: string;
    status?: string;
  }>;

  /**
   * Normalizes a feature value using reference-relative prioritization (Section A2).
   */
  normalize(
    sourceKey: string,
    phenomenonClass: string,
    featureName: string,
    value: number,
    isCalibrated = false
  ): NormalizedFeatureValue {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        rawValue: 0,
        zScore: 0,
        unitInterval: 0.5,
        baselineMode: 'neutral',
        explanation: 'Missing or non-numeric feature value'
      };
    }

    // 1. Priority 1: Physical Reference Range for calibrated features
    const ref = this.references[phenomenonClass];
    if (isCalibrated && ref && ref.std > 0) {
      const z = clamp((value - ref.mean) / ref.std, -4, 4);
      // Map z [-4, 4] to unit interval [0, 1] using standard sigmoid-like linear clamp
      const unit = clamp((z + 3) / 6, 0, 1);
      return {
        rawValue: value,
        zScore: round3(z),
        unitInterval: round3(unit),
        baselineMode: 'physical_reference',
        explanation: `Relative to documented NASA physical reference range (${ref.mean} ± ${ref.std} ${ref.unit})`
      };
    }

    // 2. Priority 2: Source Baseline (P10, P50, P90)
    let baseline = this.runningBaselines.get(sourceKey);
    if (!baseline) {
      baseline = new RunningSourceBaseline();
      this.runningBaselines.set(sourceKey, baseline);
    }
    baseline.addSample(featureName, value);
    const dist = baseline.getDistribution(featureName);

    if (dist && dist.std > 0.001) {
      const z = clamp((value - dist.p50) / dist.std, -4, 4);
      const unit = clamp((z + 3) / 6, 0, 1);
      return {
        rawValue: value,
        zScore: round3(z),
        unitInterval: round3(unit),
        baselineMode: 'running',
        explanation: `Relative to this visualisation's observed distribution (P50: ${round3(dist.p50)}, spread: ${round3(dist.p90 - dist.p10)})`
      };
    }

    // 3. Priority 3: Flat Neutral fallback
    return {
      rawValue: value,
      zScore: 0.0,
      unitInterval: 0.5,
      baselineMode: 'neutral',
      explanation: 'Neutral baseline: awaiting source warm-up calibration'
    };
  }

  clear(): void {
    this.runningBaselines.clear();
  }
}

export const globalNormalizer = new ReferenceRelativeNormalizer();
