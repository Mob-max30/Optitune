import { describe, it, expect } from 'vitest';
import {
  rgbToLab,
  deltaE,
  prepareLegendLUT,
  mapPixelToLegendValue,
  calculateAverageLegendValue
} from '../extension/src/analysis/legend';
import type { PresetLegendConfig } from '../extension/src/contract/types';

describe('scientific legend calibration', () => {
  it('converts sRGB to CIELAB and computes Delta E', () => {
    const white = rgbToLab(255, 255, 255);
    const black = rgbToLab(0, 0, 0);

    expect(white.L).toBeCloseTo(100, 0);
    expect(black.L).toBeCloseTo(0, 0);

    // Delta E between pure white and pure black is ~100
    const distance = deltaE(white, black);
    expect(distance).toBeGreaterThan(95);
  });

  it('accurately calibrates pixel RGB to physical value with smooth interpolation', () => {
    const mockLegend: PresetLegendConfig = {
      min: 0,
      max: 60,
      unit: 'm',
      stops: [
        { color: [0, 0, 0], value: 0 },
        { color: [0, 255, 0], value: 30 },
        { color: [255, 255, 255], value: 60 }
      ]
    };

    const lut = prepareLegendLUT(mockLegend, 40)!;
    expect(lut).not.toBeNull();

    // Test exact green stop
    const greenRes = mapPixelToLegendValue(0, 255, 0, lut);
    expect(greenRes).not.toBeNull();
    expect(greenRes!.rawValue).toBeCloseTo(30, 0);
    expect(greenRes!.normalizedValue).toBe(0.5); // 30m / 60m = 0.5
  });

  it('masks out pixels that are too far from any calibrated stop (e.g. background/ocean)', () => {
    const mockLegend: PresetLegendConfig = {
      min: 0,
      max: 60,
      unit: 'm',
      stops: [
        { color: [0, 255, 0], value: 30 } // only green
      ]
    };

    const lut = prepareLegendLUT(mockLegend, 30)!;

    // Deep Magenta pixel (far from green)
    const magentaRes = mapPixelToLegendValue(255, 0, 255, lut);
    expect(magentaRes).toBeNull(); // Rejected as non-data!
  });

  it('calculates average calibrated value across buffer and ignores uncalibrated background', () => {
    const mockLegend: PresetLegendConfig = {
      min: 0,
      max: 100,
      unit: 'ppm',
      stops: [
        { color: [0, 255, 0], value: 50 }
      ]
    };
    const lut = prepareLegendLUT(mockLegend, 35)!;

    const data = new Uint8ClampedArray([
      0, 255, 0, 255,       // Data pixel (50 ppm -> 0.5 norm)
      255, 0, 255, 255      // Non-data magenta pixel (ignored)
    ]);

    const avg = calculateAverageLegendValue(data, lut);
    expect(avg).toBe(0.5);
  });
});
