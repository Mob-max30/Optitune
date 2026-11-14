import { describe, it, expect } from 'vitest';
import { calculateMotionAndEvents } from '../extension/src/analysis/motion';

describe('motion delta & transient event detection', () => {
  it('returns zero motion when frames are identical', () => {
    const width = 16;
    const height = 16;
    const frame1 = new Uint8ClampedArray(width * height * 4).fill(128);
    const frame2 = new Uint8ClampedArray(width * height * 4).fill(128);

    const res = calculateMotionAndEvents(frame2, frame1, width, height, null);
    expect(res.motion).toBe(0.0);
    expect(res.sceneCut).toBe(false);
  });

  it('detects high motion delta and triggers scene cut on jump transitions', () => {
    const width = 16;
    const height = 16;
    const blackFrame = new Uint8ClampedArray(width * height * 4).fill(0);
    const whiteFrame = new Uint8ClampedArray(width * height * 4).fill(255);

    const res = calculateMotionAndEvents(whiteFrame, blackFrame, width, height, null, {
      sceneCutThreshold: 0.38
    });

    expect(res.motion).toBe(1.0);
    expect(res.sceneCut).toBe(true);
  });

  it('detects localized transient flashes exceeding running cell baseline', () => {
    const width = 16;
    const height = 16;
    const prevFrame = new Uint8ClampedArray(width * height * 4).fill(20);
    const currFrame = new Uint8ClampedArray(width * height * 4).fill(20);

    // Inject flash burst in top-left quadrant (cell 0 in 8x8 grid: x in [0, 1], y in [0, 1])
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const idx = (y * width + x) * 4;
        currFrame[idx] = 255;
        currFrame[idx + 1] = 255;
        currFrame[idx + 2] = 255;
      }
    }

    const baselines = new Float32Array(64).fill(0.05);
    const res = calculateMotionAndEvents(currFrame, prevFrame, width, height, baselines, {
      detectEvents: 'flash',
      eventThreshold: 0.20
    });

    expect(res.events.length).toBeGreaterThan(0);
    expect(res.events[0].type).toBe('flash');
    expect(res.events[0].x).toBeCloseTo(0.0625, 2); // Center of cell 0
    expect(res.events[0].y).toBeCloseTo(0.0625, 2);
    expect(res.events[0].intensity).toBeGreaterThan(0.5);
  });
});
