import { describe, it, expect } from 'vitest';
import { calculateSpatialDistribution } from '../extension/src/audio/spatial';
import type { RegionGridMetrics } from '../extension/src/contract/types';

describe('Spatial Audio & 4x8 Grid Matrix (Pranav)', () => {
  it('pans hard left when all visual energy is concentrated on western hemisphere (columns 0-3)', () => {
    // 4 rows x 8 cols = 32 cells
    // Set columns 0-3 (left) to 1.0, columns 4-7 (right) to 0.0
    const b = new Array(32).fill(0);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        b[r * 8 + c] = 1.0;
      }
    }

    const grid: RegionGridMetrics = {
      rows: 4,
      cols: 8,
      brightness: b,
      dataValue: b
    };

    const result = calculateSpatialDistribution(grid);
    expect(result.pan).toBeLessThan(-0.4);
    expect(result.quadrants.northwest + result.quadrants.southwest).toBeGreaterThan(0.9);
    expect(result.quadrants.northeast + result.quadrants.southeast).toBe(0);
  });

  it('pans hard right when all visual energy is concentrated on eastern hemisphere (columns 4-7)', () => {
    const b = new Array(32).fill(0);
    for (let r = 0; r < 4; r++) {
      for (let c = 4; c < 8; c++) {
        b[r * 8 + c] = 1.0;
      }
    }

    const grid: RegionGridMetrics = {
      rows: 4,
      cols: 8,
      brightness: b,
      dataValue: b
    };

    const result = calculateSpatialDistribution(grid);
    expect(result.pan).toBeGreaterThan(0.4);
  });

  it('centers panning at 0.0 when energy is symmetrically distributed', () => {
    const b = new Array(32).fill(0.5);
    const grid: RegionGridMetrics = {
      rows: 4,
      cols: 8,
      brightness: b,
      dataValue: b
    };

    const result = calculateSpatialDistribution(grid);
    expect(result.pan).toBeCloseTo(0.0, 2);
    expect(result.latitudeBias).toBeCloseTo(0.0, 2);
  });

  it('computes latitudinal row energies for all 4 rows correctly', () => {
    // Row 0 = 0.8, Row 1 = 0.6, Row 2 = 0.4, Row 3 = 0.2
    const b = new Array(32).fill(0);
    for (let r = 0; r < 4; r++) {
      const val = 0.8 - r * 0.2;
      for (let c = 0; c < 8; c++) {
        b[r * 8 + c] = val;
      }
    }

    const grid: RegionGridMetrics = {
      rows: 4,
      cols: 8,
      brightness: b,
      dataValue: b
    };

    const result = calculateSpatialDistribution(grid);
    expect(result.rowEnergies).toHaveLength(4);
    expect(result.rowEnergies[0]).toBeCloseTo(0.8, 2);
    expect(result.rowEnergies[1]).toBeCloseTo(0.6, 2);
    expect(result.rowEnergies[2]).toBeCloseTo(0.4, 2);
    expect(result.rowEnergies[3]).toBeCloseTo(0.2, 2);

    // North latitude bias is positive
    expect(result.latitudeBias).toBeGreaterThan(0.2);
  });
});
