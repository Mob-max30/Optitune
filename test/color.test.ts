import { describe, it, expect } from 'vitest';
import { rgbToHsv, extractColorMetrics } from '../extension/src/analysis/color';

describe('color and hue analysis', () => {
  it('converts RGB to HSV accurately', () => {
    // Pure Red
    const red = rgbToHsv(255, 0, 0);
    expect(red.h).toBeCloseTo(0.0, 2);
    expect(red.s).toBeCloseTo(1.0, 2);
    expect(red.v).toBeCloseTo(1.0, 2);

    // Pure Green
    const green = rgbToHsv(0, 255, 0);
    expect(green.h).toBeCloseTo(1 / 3, 2); // 120 deg = 0.333
    expect(green.s).toBeCloseTo(1.0, 2);

    // Pure Blue
    const blue = rgbToHsv(0, 0, 255);
    expect(blue.h).toBeCloseTo(2 / 3, 2); // 240 deg = 0.667
    expect(blue.s).toBeCloseTo(1.0, 2);
  });

  it('detects peak hue histogram rather than blending red and blue into false purple', () => {
    // Buffer with 70% Pure Red pixels and 30% Pure Blue pixels
    const pixels = [];
    for (let i = 0; i < 70; i++) {
      pixels.push(255, 0, 0, 255); // Red
    }
    for (let i = 0; i < 30; i++) {
      pixels.push(0, 0, 255, 255); // Blue
    }
    const data = new Uint8ClampedArray(pixels);

    const metrics = extractColorMetrics(data);

    // Dominant hue MUST be Red (bin 0), NOT purple (bin ~10)!
    expect(metrics.hue).toBeLessThan(0.1);
    expect(metrics.dominantColor.r).toBeGreaterThan(0.9);
    expect(metrics.dominantColor.b).toBe(0); // Peak bin contains Red pixels, not blended purple!
  });
});
