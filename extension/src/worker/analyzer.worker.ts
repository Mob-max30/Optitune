import type { EjbFramePayload, PresetConfig } from '../contract/types';
import { calculateAverageLuminance } from '../analysis/luminance';
import { extractColorMetrics } from '../analysis/color';
import { prepareLegendLUT, calculateAverageLegendValue, type PreparedLegendLUT, rgbToLab, deltaE } from '../analysis/legend';
import { calculateRegionGrid, calculateSpatialProfiles } from '../analysis/regions';
import { calculateMotionAndEvents } from '../analysis/motion';
import { clamp, round3 } from '../analysis/normalize';

let previousFrameData: Uint8ClampedArray | null = null;
let cellBaselines: Float32Array = new Float32Array(64).fill(0.1);
let cachedLut: PreparedLegendLUT | null = null;
let cachedPresetId: string | null = null;

export interface WorkerInitMessage {
  type: 'INIT';
  preset?: PresetConfig;
}

export interface WorkerAnalyzeMessage {
  type: 'ANALYZE_FRAME';
  buffer: ArrayBuffer;
  width: number;
  height: number;
  t: number;
  frameIndex: number;
  vizId: string;
  preset?: PresetConfig;
  seeked?: boolean;
}

self.onmessage = (e: MessageEvent<WorkerInitMessage | WorkerAnalyzeMessage>) => {
  const msg = e.data;

  if (msg.type === 'INIT') {
    previousFrameData = null;
    cellBaselines.fill(0.1);
    if (msg.preset) {
      cachedPresetId = msg.preset.id;
      cachedLut = prepareLegendLUT(msg.preset.legend);
    } else {
      cachedPresetId = null;
      cachedLut = null;
    }
    return;
  }

  if (msg.type === 'ANALYZE_FRAME') {
    const { buffer, width, height, t, frameIndex, vizId, preset, seeked } = msg;
    const currentData = new Uint8ClampedArray(buffer);

    // Update LUT if preset changed
    if (preset && preset.id !== cachedPresetId) {
      cachedPresetId = preset.id;
      cachedLut = prepareLegendLUT(preset.legend);
      cellBaselines.fill(0.1);
      previousFrameData = null;
    }

    const ignoreDark = preset?.ignoreDark ?? 0.05;

    // 1. Luminance
    const brightness = calculateAverageLuminance(currentData, { ignoreDark });

    // 2. Color & Hue
    const colorMetrics = extractColorMetrics(currentData, { ignoreDark });

    // 3. Legend-Calibrated Physical Value
    const dataValue = calculateAverageLegendValue(currentData, cachedLut);

    // 4. Regional Grid (default 4x8)
    const gridRows = preset?.grid?.[0] ?? 4;
    const gridCols = preset?.grid?.[1] ?? 8;
    const regions = calculateRegionGrid(
      currentData,
      { rows: gridRows, cols: gridCols, width, height, ignoreDark },
      cachedLut
    );

    // 5. Motion & Flash/Event Detection
    const motionOpts = {
      detectEvents: preset?.events?.detect ?? null,
      eventThreshold: preset?.events?.threshold ?? 0.20,
      baselineAlpha: preset?.events?.baselineAlpha ?? 0.05
    };

    const motionResult = calculateMotionAndEvents(
      currentData,
      seeked ? null : previousFrameData,
      width,
      height,
      cellBaselines,
      motionOpts
    );

    // 6. Categorical Layers (if defined in preset e.g. GEOS Aerosols)
    let layers: Record<string, number> | undefined;
    if (preset?.layers && cachedLut && cachedLut.stops.length >= preset.layers.length) {
      layers = {};
      const layerCounts = new Uint32Array(preset.layers.length);
      const stops = cachedLut.stops;
      let countedPixels = 0;

      for (let i = 0; i < currentData.length; i += 4) {
        const pixLab = rgbToLab(currentData[i], currentData[i + 1], currentData[i + 2]);
        let bestIdx = -1;
        let bestDist = Infinity;

        for (let s = 0; s < stops.length; s++) {
          const d = deltaE(pixLab, stops[s].lab);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = s;
          }
        }

        if (bestDist < cachedLut.maxDeltaE && bestIdx >= 0 && bestIdx < preset.layers.length) {
          layerCounts[bestIdx]++;
          countedPixels++;
        }
      }

      if (countedPixels > 0) {
        for (let l = 0; l < preset.layers.length; l++) {
          const layerName = preset.layers[l];
          layers[layerName] = round3(clamp(layerCounts[l] / countedPixels, 0.0, 1.0));
        }
      }
    }

    // 7. Spatial Scanner Profile
    const profile = calculateSpatialProfiles(currentData, width, height, 32);

    // Cache current frame for next tick's motion comparison
    if (!previousFrameData || previousFrameData.length !== currentData.length) {
      previousFrameData = new Uint8ClampedArray(currentData);
    } else {
      previousFrameData.set(currentData);
    }

    // Build standard EJB contract payload
    const payload: EjbFramePayload = {
      v: 1,
      t: round3(t),
      frameIndex,
      vizId,
      metrics: {
        brightness,
        dominantColor: colorMetrics.dominantColor,
        hue: colorMetrics.hue,
        saturation: colorMetrics.saturation,
        dataValue,
        motion: seeked ? 0 : motionResult.motion,
        regions
      },
      flags: {
        seeked: Boolean(seeked),
        scene_cut: motionResult.sceneCut
      },
      events: motionResult.events.length > 0 ? motionResult.events : undefined,
      layers,
      profile
    };

    self.postMessage({ type: 'FRAME_ANALYZED', payload });
  }
};
