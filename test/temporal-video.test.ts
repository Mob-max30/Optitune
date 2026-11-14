import { describe, it, expect } from 'vitest';
import { TemporalVideoExtractor } from '../extension/src/extraction/temporal-video';

describe('Temporal Video & Animation Extraction Engine', () => {
  it('detects apparent motion between sequential video frames', () => {
    const extractor = new TemporalVideoExtractor();
    const width = 64;
    const height = 64;

    // Frame 1: Mid-gray
    const frame1 = new Uint8ClampedArray(width * height * 4).fill(100);
    const res1 = extractor.processFrame(
      { data: frame1, width, height, mediaTimestamp: 0.0, frameIndex: 0 },
      { sourceId: 'test-video' }
    );
    expect(res1.motionDelta).toBe(0.0);
    expect(res1.isSceneCut).toBe(false);

    // Frame 2: Shifted values (moderate motion)
    const frame2 = new Uint8ClampedArray(width * height * 4).fill(140);
    const res2 = extractor.processFrame(
      { data: frame2, width, height, mediaTimestamp: 0.1, frameIndex: 1 },
      { sourceId: 'test-video' }
    );
    expect(res2.motionDelta).toBeGreaterThan(0.1);
    expect(res2.isSceneCut).toBe(false);
  });

  it('detects scene cuts on massive full-frame changes and resets motion', () => {
    const extractor = new TemporalVideoExtractor();
    const width = 64;
    const height = 64;

    const frameDark = new Uint8ClampedArray(width * height * 4).fill(10);
    extractor.processFrame(
      { data: frameDark, width, height, mediaTimestamp: 1.0, frameIndex: 10 },
      { sourceId: 'test-video' }
    );

    // Sudden flash to bright white (scene cut)
    const frameBright = new Uint8ClampedArray(width * height * 4).fill(250);
    const res = extractor.processFrame(
      { data: frameBright, width, height, mediaTimestamp: 1.1, frameIndex: 11 },
      { sourceId: 'test-video', sceneCutThreshold: 0.40 }
    );

    expect(res.isSceneCut).toBe(true);
    expect(res.motionDelta).toBe(0.0); // Motion clamped on scene cut
  });

  it('detects localized transient flashes (e.g. lightning strike)', () => {
    const extractor = new TemporalVideoExtractor();
    const width = 64;
    const height = 64;

    const baseline = new Uint8ClampedArray(width * height * 4).fill(30);
    extractor.processFrame(
      { data: baseline, width, height, mediaTimestamp: 5.0, frameIndex: 50 },
      { sourceId: 'lightning-video' }
    );

    // Lightning strike localized in top-right quadrant
    const flashFrame = new Uint8ClampedArray(baseline);
    for (let y = 10; y < 20; y++) {
      for (let x = 40; x < 55; x++) {
        const idx = (y * width + x) * 4;
        flashFrame[idx] = 255;
        flashFrame[idx + 1] = 255;
        flashFrame[idx + 2] = 255;
      }
    }

    const res = extractor.processFrame(
      { data: flashFrame, width, height, mediaTimestamp: 5.08, frameIndex: 51 },
      { sourceId: 'lightning-video', eventLumaThreshold: 0.3 }
    );

    expect(res.detectedEvents.length).toBeGreaterThanOrEqual(1);
    expect(res.detectedEvents[0].intensity).toBeGreaterThan(0.5);
    expect(res.frame.features.some(f => f.featureType === 'event')).toBe(true);
  });
});
