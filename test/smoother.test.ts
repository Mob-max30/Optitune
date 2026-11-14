import { describe, it, expect } from 'vitest';
import { ParameterSmoother, FrameMetricsSmoother } from '../extension/src/audio/smoother';

describe('Parameter Smoother (Pranav)', () => {
  it('smooths raw target transitions with exponential moving average', () => {
    const smoother = new ParameterSmoother(0.0, 0.5);

    // Initial value is 0.0
    expect(smoother.get()).toBe(0.0);

    // First step toward 1.0: 0 + 0.5 * (1 - 0) = 0.5
    const val1 = smoother.step(1.0);
    expect(val1).toBeCloseTo(0.5, 4);

    // Second step toward 1.0: 0.5 + 0.5 * (1 - 0.5) = 0.75
    const val2 = smoother.step(1.0);
    expect(val2).toBeCloseTo(0.75, 4);

    // Third step toward 1.0: 0.75 + 0.5 * (1 - 0.75) = 0.875
    const val3 = smoother.step(1.0);
    expect(val3).toBeCloseTo(0.875, 4);
  });

  it('bypasses smoothing instantly when seeked or scene cut flag is active', () => {
    const smoother = new ParameterSmoother(100.0, 0.1);

    // Normal step with low alpha moves slowly
    smoother.step(500.0);
    expect(smoother.get()).toBeCloseTo(140.0, 1);

    // Instant bypass (e.g. user scrubs video or camera scene cuts)
    const instantVal = smoother.step(900.0, true);
    expect(instantVal).toBe(900.0);
    expect(smoother.get()).toBe(900.0);
  });

  it('resets immediately via reset()', () => {
    const smoother = new ParameterSmoother(50.0);
    smoother.step(100.0);
    expect(smoother.get()).not.toBe(200.0);

    smoother.reset(200.0);
    expect(smoother.get()).toBe(200.0);
    expect(smoother.getTarget()).toBe(200.0);
  });

  it('manages FrameMetricsSmoother multi-channel parameters', () => {
    const group = new FrameMetricsSmoother(440);
    expect(group.frequency.get()).toBe(440);
    expect(group.gain.get()).toBe(0.0);
    expect(group.pan.get()).toBe(0.0);

    group.resetAll(330, 0.5, -0.5, 2000);
    expect(group.frequency.get()).toBe(330);
    expect(group.gain.get()).toBe(0.5);
    expect(group.pan.get()).toBe(-0.5);
    expect(group.filterCutoff.get()).toBe(2000);
  });
});
