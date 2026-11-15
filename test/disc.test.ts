/**
 * Earth Jukebox (EJB) — Listening Disc Performance & Render Tests
 * Specification: Amendment B, Section 7 & 11
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ListeningDisc } from '../extension/src/ui/disc';
import { createUiViewModel } from '../extension/src/ui/view-model';
import { PRESETS } from '../extension/src/presets';

class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle = '#000';
  strokeStyle = '#000';
  lineWidth = 1;
  shadowColor = 'transparent';
  shadowBlur = 0;
  lineCap = 'butt';
  font = '10px sans-serif';
  textAlign = 'start';
  textBaseline = 'alphabetic';

  clearRect() {}
  beginPath() {}
  closePath() {}
  arc() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  setTransform() {}
  setLineDash() {}
  fillText() {}
  moveTo() {}
  lineTo() {}
}

beforeAll(() => {
  // Attach 2D context mock to HTMLCanvasElement in headless environment
  (HTMLCanvasElement.prototype as any).getContext = function (type: string) {
    if (type === '2d') {
      const ctx = new MockCanvasRenderingContext2D();
      ctx.canvas = this;
      return ctx;
    }
    return null;
  };
});

describe('Listening Disc Canvas Component', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
  });

  it('initializes cleanly without error', () => {
    const disc = new ListeningDisc({ canvas });
    expect(disc).toBeDefined();
  });

  it('renders a full frame well within the 2.0 ms budget', () => {
    const disc = new ListeningDisc({ canvas });
    const vm = createUiViewModel({
      preset: PRESETS['gedi-forest-height'],
      payload: {
        v: 1,
        t: 12.0,
        frameIndex: 144,
        vizId: 'gedi-forest-height',
        metrics: {
          brightness: 0.6,
          dominantColor: { r: 0.2, g: 0.7, b: 0.3 },
          hue: 0.35,
          saturation: 0.6,
          dataValue: 0.45,
          regions: {
            rows: 4,
            cols: 8,
            brightness: new Array(32).fill(0.5),
            dataValue: new Array(32).fill(0.5)
          }
        },
        flags: { seeked: false, scene_cut: false },
        profile: { rows: [0.5, 0.5, 0.5, 0.5], cols: new Array(8).fill(0.5) }
      },
      engineState: { isSonifying: true, mode: 'scientific' },
      mediaState: { isPlaying: true, currentTime: 12, duration: 60 }
    });

    disc.updateViewModel(vm);

    // Warm up one render
    disc.render();

    // Measure 10 frame renders
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      disc.render();
      times.push(disc.getLastFrameCostMs());
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avgTime).toBeLessThan(2.0); // Strict requirement: < 2.0 ms
  });

  it('respects reduced motion settings and bypasses tune-in scaling', () => {
    const disc = new ListeningDisc({ canvas });
    disc.setReducedMotion(true);

    const vm = createUiViewModel({
      engineState: { isSonifying: true },
      mediaState: { isPlaying: true }
    });
    disc.updateViewModel(vm);

    // Should render without error under reduced motion
    expect(() => disc.render()).not.toThrow();
  });
});
