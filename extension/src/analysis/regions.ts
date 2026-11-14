import { clamp, round3 } from './normalize';
import { calculatePixelLuminance } from './luminance';
import { mapPixelToLegendValue, type PreparedLegendLUT } from './legend';
import type { RegionGridMetrics, SpatialProfile } from '../contract/types';

export interface GridOptions {
  rows: number;
  cols: number;
  width: number;
  height: number;
  ignoreDark?: number;
}

/**
 * Computes regional grid metrics by splitting an image buffer into rows × cols bins.
 * Data is packed row-major.
 */
export function calculateRegionGrid(
  data: Uint8ClampedArray,
  options: GridOptions,
  lut: PreparedLegendLUT | null
): RegionGridMetrics {
  const { rows, cols, width, height } = options;
  const numCells = rows * cols;
  const brightness = new Array<number>(numCells).fill(0);
  const dataValue = new Array<number | null>(numCells).fill(null);

  const cellLumaSum = new Float64Array(numCells);
  const cellPixelCount = new Uint32Array(numCells);

  const cellDataSum = new Float64Array(numCells);
  const cellDataCount = new Uint32Array(numCells);

  const ignoreDark = options.ignoreDark ?? 0;

  for (let y = 0; y < height; y++) {
    const row = Math.min(rows - 1, Math.floor((y / height) * rows));
    const rowOffset = row * cols;

    for (let x = 0; x < width; x++) {
      const col = Math.min(cols - 1, Math.floor((x / width) * cols));
      const cellIndex = rowOffset + col;

      const pixelIndex = (y * width + x) * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      const luma = calculatePixelLuminance(r, g, b);
      if (luma >= ignoreDark) {
        cellLumaSum[cellIndex] += luma;
        cellPixelCount[cellIndex]++;
      }

      if (lut) {
        const mapped = mapPixelToLegendValue(r, g, b, lut);
        if (mapped !== null) {
          cellDataSum[cellIndex] += mapped.normalizedValue;
          cellDataCount[cellIndex]++;
        }
      }
    }
  }

  for (let c = 0; c < numCells; c++) {
    const pCount = cellPixelCount[c];
    brightness[c] = pCount > 0 ? round3(clamp(cellLumaSum[c] / pCount, 0.0, 1.0)) : 0;

    const dCount = cellDataCount[c];
    dataValue[c] = dCount > 0 ? round3(clamp(cellDataSum[c] / dCount, 0.0, 1.0)) : null;
  }

  return {
    rows,
    cols,
    brightness,
    dataValue
  };
}

/**
 * Computes Caldwell-73 style scanner profiles (mean brightness along each column and each row).
 */
export function calculateSpatialProfiles(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  numProfileBins = 32
): SpatialProfile {
  const cols = new Array<number>(numProfileBins).fill(0);
  const rows = new Array<number>(numProfileBins).fill(0);

  const colSums = new Float64Array(numProfileBins);
  const colCounts = new Uint32Array(numProfileBins);

  const rowSums = new Float64Array(numProfileBins);
  const rowCounts = new Uint32Array(numProfileBins);

  for (let y = 0; y < height; y++) {
    const rowBin = Math.min(numProfileBins - 1, Math.floor((y / height) * numProfileBins));

    for (let x = 0; x < width; x++) {
      const colBin = Math.min(numProfileBins - 1, Math.floor((x / width) * numProfileBins));

      const idx = (y * width + x) * 4;
      const luma = calculatePixelLuminance(data[idx], data[idx + 1], data[idx + 2]);

      colSums[colBin] += luma;
      colCounts[colBin]++;

      rowSums[rowBin] += luma;
      rowCounts[rowBin]++;
    }
  }

  for (let i = 0; i < numProfileBins; i++) {
    cols[i] = colCounts[i] > 0 ? round3(clamp(colSums[i] / colCounts[i], 0.0, 1.0)) : 0;
    rows[i] = rowCounts[i] > 0 ? round3(clamp(rowSums[i] / rowCounts[i], 0.0, 1.0)) : 0;
  }

  return { cols, rows };
}
