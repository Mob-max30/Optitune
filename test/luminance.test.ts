import { describe, it, expect } from 'vitest';
import { calculatePixelLuminance, calculateAverageLuminance } from '../extension/src/analysis/luminance';

describe('luminance analysis', () => {
  it('implements Rec. 601 luma formula precisely', () => {
    // Pure Red (255, 0, 0) -> 0.299
    expect(calculatePixelLuminance(255, 0, 0)).toBeCloseTo(0.299, 3);
    // Pure Green (0, 255, 0) -> 0.587
    expect(calculatePixelLuminance(0, 255, 0)).toBeCloseTo(0.587, 3);
    // Pure Blue (0, 0, 255) -> 0.114
    expect(calculatePixelLuminance(0, 0, 255)).toBeCloseTo(0.114, 3);
    // Pure White (255, 255, 255) -> 1.0
    expect(calculatePixelLuminance(255, 255, 255)).toBeCloseTo(1.0, 3);
    // Pure Black (0, 0, 0) -> 0.0
    expect(calculatePixelLuminance(0, 0, 0)).toBeCloseTo(0.0, 3);
  });

  it('calculates average luminance across an RGBA buffer', () => {
    // 2 pixels: 1 white, 1 black
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // Pixel 1: White (1.0)
      0, 0, 0, 255        // Pixel 2: Black (0.0)
    ]);
    expect(calculateAverageLuminance(data)).toBe(0.5);
  });

  it('filters out dark pixels when ignoreDark threshold is configured', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, // White (1.0)
      10, 10, 10, 255     // Near black (0.039)
    ]);
    // With ignoreDark = 0.05, the near black pixel is excluded, leaving mean = 1.0
    expect(calculateAverageLuminance(data, { ignoreDark: 0.05 })).toBe(1.0);
  });
});
