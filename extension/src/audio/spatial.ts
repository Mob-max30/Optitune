/**
 * Earth Jukebox (EJB) — Spatial Audio & Regional Grid Matrix Analyzer
 *
 * Translates the 4x8 spatial grid matrix (32 cells) from the visual pipeline
 * into continuous stereo panning (-1.0 to +1.0) and geographic quadrant polyphony.
 *
 * Authored by Pranav K.
 */

import type { RegionGridMetrics } from '../contract/types';

export interface QuadrantEnergies {
  northwest: number; // [0.0, 1.0]
  northeast: number; // [0.0, 1.0]
  southwest: number; // [0.0, 1.0]
  southeast: number; // [0.0, 1.0]
}

export interface SpatialDistribution {
  /** Horizontal stereo pan: -1.0 (Full Left / West) to +1.0 (Full Right / East) */
  pan: number;
  /** Vertical center of mass: -1.0 (South Pole) to +1.0 (North Pole) */
  latitudeBias: number;
  /** Regional energy by geographic quadrant */
  quadrants: QuadrantEnergies;
  /** Latitudinal energy by row: [Row 0 (North), Row 1, Row 2, Row 3 (South)] */
  rowEnergies: number[];
}

/**
 * Calculates continuous stereo panning and latitudinal distribution
 * from the 4-row by 8-column regional brightness/data matrix.
 */
export function calculateSpatialDistribution(
  regions: RegionGridMetrics,
  useDataValue = false
): SpatialDistribution {
  const rows = regions.rows || 4;
  const cols = regions.cols || 8;
  const values = useDataValue ? regions.dataValue : regions.brightness;

  let totalWeight = 0;
  let weightedColSum = 0;
  let weightedRowSum = 0;

  let nwSum = 0, nwCount = 0;
  let neSum = 0, neCount = 0;
  let swSum = 0, swCount = 0;
  let seSum = 0, seCount = 0;

  const rowSums = new Float32Array(rows);
  const rowCounts = new Uint8Array(rows);

  const halfCols = cols / 2;
  const halfRows = rows / 2;
  const maxColOffset = (cols - 1) / 2;
  const maxRowOffset = (rows - 1) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const rawVal = values[idx];
      const val = (rawVal !== null && rawVal !== undefined) ? rawVal : 0;

      totalWeight += val;
      weightedColSum += (c - maxColOffset) * val;
      weightedRowSum += (maxRowOffset - r) * val; // Row 0 is North (+), Row 3 is South (-)

      rowSums[r] += val;
      rowCounts[r]++;

      // Quadrant partition
      if (r < halfRows) {
        if (c < halfCols) {
          nwSum += val;
          nwCount++;
        } else {
          neSum += val;
          neCount++;
        }
      } else {
        if (c < halfCols) {
          swSum += val;
          swCount++;
        } else {
          seSum += val;
          seCount++;
        }
      }
    }
  }

  // Horizontal pan: [-1.0, +1.0]
  const rawPan = totalWeight > 0.001
    ? weightedColSum / (totalWeight * maxColOffset)
    : 0.0;
  const pan = Math.max(-1.0, Math.min(1.0, rawPan));

  // Vertical latitude bias: [-1.0 (South), +1.0 (North)]
  const rawLat = totalWeight > 0.001
    ? weightedRowSum / (totalWeight * maxRowOffset)
    : 0.0;
  const latitudeBias = Math.max(-1.0, Math.min(1.0, rawLat));

  const rowEnergies: number[] = [];
  for (let r = 0; r < rows; r++) {
    rowEnergies.push(rowCounts[r] > 0 ? rowSums[r] / rowCounts[r] : 0);
  }

  return {
    pan,
    latitudeBias,
    quadrants: {
      northwest: nwCount > 0 ? nwSum / nwCount : 0,
      northeast: neCount > 0 ? neSum / neCount : 0,
      southwest: swCount > 0 ? swSum / swCount : 0,
      southeast: seCount > 0 ? seSum / seCount : 0
    },
    rowEnergies
  };
}
