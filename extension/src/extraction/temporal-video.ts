/**
 * Earth Jukebox (EJB) — Temporal Video & Animation Extraction Engine
 *
 * Samples animation frames at controlled cadences, computes inter-frame motion deltas,
 * detects scene cuts and discrete transient optical bursts (lightning/fires),
 * and converts temporal features into the Scientific Feature Representation (SFR v1).
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type {
  ScientificFeatureFrame,
  ScientificFeature,
  ScalarFeature,
  EventFeature
} from '../sfr/types';

export interface VideoFrameSample {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  mediaTimestamp: number; // Video playback time in seconds
  frameIndex: number;
}

export interface TemporalExtractionOptions {
  sourceId: string;
  samplingIntervalSeconds?: number; // e.g. 0.083s for 12 Hz
  sceneCutThreshold?: number; // Normalized pixel difference threshold (default 0.40)
  eventLumaThreshold?: number; // Flash detection surge threshold (default 0.35)
}

export interface TemporalExtractionResult {
  frame: ScientificFeatureFrame;
  motionDelta: number;
  isSceneCut: boolean;
  detectedEvents: Array<{ x: number; y: number; intensity: number }>;
}

export class TemporalVideoExtractor {
  private lastDownsampledBuffer: Float32Array | null = null;
  private lastSampleTimestamp = -1;
  private readonly downsampleSize = 32; // 32x32 downsampling for real-time <0.1ms computation

  /**
   * Resets temporal history (useful after seek or video reload).
   */
  reset(): void {
    this.lastDownsampledBuffer = null;
    this.lastSampleTimestamp = -1;
  }

  /**
   * Processes a video frame sample and yields a temporal ScientificFeatureFrame.
   */
  processFrame(
    sample: VideoFrameSample,
    options: TemporalExtractionOptions
  ): TemporalExtractionResult {
    const { data, width, height, mediaTimestamp, frameIndex } = sample;
    const sceneCutThreshold = options.sceneCutThreshold ?? 0.40;
    const eventLumaThreshold = options.eventLumaThreshold ?? 0.35;

    // 1. Downsample incoming frame to 32x32 Rec. 601 grayscale
    const currentDownsampled = new Float32Array(this.downsampleSize * this.downsampleSize);
    const stepX = width / this.downsampleSize;
    const stepY = height / this.downsampleSize;

    let totalLuma = 0;
    let maxCellSurge = 0;
    let surgeX = 0.5, surgeY = 0.5;

    for (let dy = 0; dy < this.downsampleSize; dy++) {
      const srcY = Math.min(height - 1, Math.floor(dy * stepY));
      for (let dx = 0; dx < this.downsampleSize; dx++) {
        const srcX = Math.min(width - 1, Math.floor(dx * stepX));
        const idx = (srcY * width + srcX) * 4;

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;

        const cellIdx = dy * this.downsampleSize + dx;
        currentDownsampled[cellIdx] = luma;
        totalLuma += luma;

        if (this.lastDownsampledBuffer) {
          const delta = luma - this.lastDownsampledBuffer[cellIdx];
          if (delta > maxCellSurge) {
            maxCellSurge = delta;
            surgeX = (dx + 0.5) / this.downsampleSize;
            surgeY = (dy + 0.5) / this.downsampleSize;
          }
        }
      }
    }

    const meanLuma = totalLuma / (this.downsampleSize * this.downsampleSize);

    // 2. Inter-frame difference calculation (Apparent Motion Delta)
    let totalPixelDiff = 0;
    let isSceneCut = false;

    if (this.lastDownsampledBuffer) {
      for (let i = 0; i < currentDownsampled.length; i++) {
        totalPixelDiff += Math.abs(currentDownsampled[i] - this.lastDownsampledBuffer[i]);
      }
      totalPixelDiff /= currentDownsampled.length;

      if (totalPixelDiff > sceneCutThreshold) {
        isSceneCut = true;
      }
    }

    const motionDelta = isSceneCut ? 0.0 : Math.min(1.0, totalPixelDiff * 2.5);

    // 3. Transient flash / event detection
    const detectedEvents: Array<{ x: number; y: number; intensity: number }> = [];
    if (!isSceneCut && maxCellSurge > eventLumaThreshold) {
      detectedEvents.push({
        x: surgeX,
        y: surgeY,
        intensity: Math.min(1.0, maxCellSurge)
      });
    }

    // Cache state
    this.lastDownsampledBuffer = currentDownsampled;
    this.lastSampleTimestamp = mediaTimestamp;

    // 4. Construct SFR features
    const features: ScientificFeature[] = [];
    const now = Date.now();

    // Motion scalar feature
    const motionFeature: ScalarFeature = {
      schemaVersion: 'sfr.v1',
      featureId: `${options.sourceId}.apparent_motion`,
      featureName: 'interframe_motion_delta',
      scientificDimension: 'velocity',
      featureType: 'scalar',
      value: Number(motionDelta.toFixed(3)),
      normalizedValue: Number(motionDelta.toFixed(3)),
      unit: 'ratio',
      validRange: [0, 1],
      timestamp: mediaTimestamp,
      provenance: {
        sourceType: 'tier4_visual_proxy',
        sourceId: options.sourceId,
        extractionMethod: 'frame_differencing_32x32',
        timestampExtracted: now,
        frameIndex
      },
      quality: {
        confidence: 0.85,
        calibrationStatus: 'proxy_inferred'
      }
    };
    features.push(motionFeature);

    // Event features
    for (let idx = 0; idx < detectedEvents.length; idx++) {
      const evt = detectedEvents[idx];
      const eventFeature: EventFeature = {
        schemaVersion: 'sfr.v1',
        featureId: `${options.sourceId}.transient_event_${idx}`,
        featureName: 'optical_lightning_flash',
        scientificDimension: 'events_anomalies',
        featureType: 'event',
        eventType: 'flash',
        intensity: evt.intensity,
        position: { x: evt.x, y: evt.y },
        unit: 'ratio',
        timestamp: mediaTimestamp,
        provenance: {
          sourceType: 'tier4_visual_proxy',
          sourceId: options.sourceId,
          extractionMethod: 'local_luma_surge_detector',
          timestampExtracted: now,
          frameIndex
        },
        quality: {
          confidence: 0.90,
          calibrationStatus: 'proxy_inferred'
        }
      };
      features.push(eventFeature);
    }

    const frame: ScientificFeatureFrame = {
      schemaVersion: 'sfr.v1',
      frameId: `frame-${options.sourceId}-${frameIndex}`,
      sourceId: options.sourceId,
      timestamp: mediaTimestamp,
      frameIndex,
      features,
      metadata: {
        isSceneCut,
        meanLuma: Number(meanLuma.toFixed(3)),
        eventsCount: detectedEvents.length
      }
    };

    return {
      frame,
      motionDelta,
      isSceneCut,
      detectedEvents
    };
  }
}
