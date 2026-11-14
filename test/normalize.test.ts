import { describe, it, expect } from 'vitest';
import { clamp, round3, normalizeRange } from '../extension/src/analysis/normalize';

describe('normalize utility', () => {
  it('clamps values strictly within [min, max]', () => {
    expect(clamp(-0.5, 0, 1)).toBe(0);
    expect(clamp(1.5, 0, 1)).toBe(1);
    expect(clamp(0.42, 0, 1)).toBe(0.42);
    expect(clamp(NaN, 0, 1)).toBe(0);
    expect(clamp(Infinity, 0, 1)).toBe(1);
  });

  it('rounds floats to 3 decimal places', () => {
    expect(round3(0.123456)).toBe(0.123);
    expect(round3(0.9999)).toBe(1.0);
    expect(round3(0.0001)).toBe(0.0);
    expect(round3(0.5555)).toBe(0.556);
  });

  it('normalizes arbitrary physical ranges to [0.0, 1.0]', () => {
    // 0 to 60m canopy height
    expect(normalizeRange(30, 0, 60)).toBe(0.5);
    expect(normalizeRange(0, 0, 60)).toBe(0.0);
    expect(normalizeRange(60, 0, 60)).toBe(1.0);
    expect(normalizeRange(75, 0, 60)).toBe(1.0); // clamped
    expect(normalizeRange(-10, 0, 60)).toBe(0.0); // clamped

    // Sea surface temperature -2 to 35 C
    expect(normalizeRange(16.5, -2, 35)).toBe(0.5);
  });
});
