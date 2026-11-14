import { clamp, round3 } from './normalize';
import type { DetectedEvent } from '../contract/types';
import { calculatePixelLuminance } from './luminance';

export interface MotionResult {
  motion: number; // [0.0, 1.0]
  sceneCut: boolean;
  events: DetectedEvent[];
}

export interface MotionOptions {
  sceneCutThreshold?: number; // default: 0.38
  detectEvents?: 'flash' | 'bright-spot' | null;
  eventThreshold?: number;    // relative spike above baseline (default 0.20)
  baselineAlpha?: number;     // running average adaptation rate (default 0.05)
}

/**
 * Calculates inter-frame pixel motion difference and localized transient event bursts (e.g. lightning).
 */
export function calculateMotionAndEvents(
  currentData: Uint8ClampedArray,
  previousData: Uint8ClampedArray | null,
  width: number,
  height: number,
  cellBaselines: Float32Array | null,
  options: MotionOptions = {}
): MotionResult {
  if (!previousData || previousData.length !== currentData.length) {
    return {
      motion: 0,
      sceneCut: false,
      events: []
    };
  }

  const len = currentData.length;
  const numPixels = width * height;
  let totalDiff = 0;

  // 1. Calculate Mean Absolute Difference across RGB channels
  for (let i = 0; i < len; i += 4) {
    const dr = Math.abs(currentData[i] - previousData[i]);
    const dg = Math.abs(currentData[i + 1] - previousData[i + 1]);
    const db = Math.abs(currentData[i + 2] - previousData[i + 2]);
    totalDiff += (dr + dg + db) / 3;
  }

  const rawMotion = totalDiff / numPixels / 255;
  const motion = round3(clamp(rawMotion, 0.0, 1.0));

  const sceneCutThreshold = options.sceneCutThreshold ?? 0.38;
  const sceneCut = motion > sceneCutThreshold;

  // 2. Discrete Event (Flash / Bright-spot) Detection
  const events: DetectedEvent[] = [];
  if (options.detectEvents && cellBaselines) {
    const eventThreshold = options.eventThreshold ?? 0.20;
    const alpha = options.baselineAlpha ?? 0.05;

    // Use an 8x8 coarse detection grid across the frame
    const gridCols = 8;
    const gridRows = 8;
    const totalCells = gridCols * gridRows;

    const cellSums = new Float32Array(totalCells);
    const cellCounts = new Uint16Array(totalCells);

    for (let y = 0; y < height; y++) {
      const row = Math.min(gridRows - 1, Math.floor((y / height) * gridRows));
      const rowOffset = row * gridCols;

      for (let x = 0; x < width; x++) {
        const col = Math.min(gridCols - 1, Math.floor((x / width) * gridCols));
        const cellIdx = rowOffset + col;

        const idx = (y * width + x) * 4;
        const luma = calculatePixelLuminance(currentData[idx], currentData[idx + 1], currentData[idx + 2]);
        cellSums[cellIdx] += luma;
        cellCounts[cellIdx]++;
      }
    }

    for (let c = 0; c < totalCells; c++) {
      const count = cellCounts[c];
      const currentCellLuma = count > 0 ? cellSums[c] / count : 0;
      const baseline = cellBaselines[c];

      const diff = currentCellLuma - baseline;
      if (diff > eventThreshold) {
        const col = c % gridCols;
        const row = Math.floor(c / gridCols);
        const normX = round3((col + 0.5) / gridCols);
        const normY = round3((row + 0.5) / gridRows);
        const intensity = round3(clamp(diff, 0.0, 1.0));

        events.push({
          type: options.detectEvents === 'flash' ? 'flash' : 'bright-spot',
          x: normX,
          y: normY,
          intensity
        });
      }

      // Adapt baseline with exponential smoothing
      cellBaselines[c] = baseline + alpha * (currentCellLuma - baseline);
    }
  }

  return { motion, sceneCut, events };
}
