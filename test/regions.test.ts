import { describe, it, expect } from 'vitest';
import { calculateRegionGrid, calculateSpatialProfiles } from '../extension/src/analysis/regions';

describe('regional grid & scanner profile', () => {
  it('computes row-major 4x8 grid metrics', () => {
    // 8 wide x 4 high image buffer (32 pixels, each cell 1 pixel)
    const width = 8;
    const height = 4;
    const buffer = new Uint8ClampedArray(width * height * 4);

    // Light up cell at row 0, col 0 (top-left) with white
    buffer[0] = 255;
    buffer[1] = 255;
    buffer[2] = 255;
    buffer[3] = 255;

    // Light up cell at row 3, col 7 (bottom-right) with white
    const lastIdx = (3 * 8 + 7) * 4;
    buffer[lastIdx] = 255;
    buffer[lastIdx + 1] = 255;
    buffer[lastIdx + 2] = 255;
    buffer[lastIdx + 3] = 255;

    const grid = calculateRegionGrid(buffer, { rows: 4, cols: 8, width, height }, null);

    expect(grid.rows).toBe(4);
    expect(grid.cols).toBe(8);
    expect(grid.brightness.length).toBe(32);
    expect(grid.brightness[0]).toBe(1.0); // Top-left
    expect(grid.brightness[31]).toBe(1.0); // Bottom-right
    expect(grid.brightness[1]).toBe(0.0); // Unlit
  });

  it('computes 32-bin column and row spatial scanner profiles', () => {
    const width = 32;
    const height = 32;
    const buffer = new Uint8ClampedArray(width * height * 4);

    // Light up entire column 0 with white
    for (let y = 0; y < height; y++) {
      const idx = (y * width + 0) * 4;
      buffer[idx] = 255;
      buffer[idx + 1] = 255;
      buffer[idx + 2] = 255;
      buffer[idx + 3] = 255;
    }

    const profile = calculateSpatialProfiles(buffer, width, height, 32);

    expect(profile.cols.length).toBe(32);
    expect(profile.rows.length).toBe(32);
    expect(profile.cols[0]).toBe(1.0); // Column 0 is fully bright
    expect(profile.cols[1]).toBe(0.0); // Column 1 is dark
  });
});
