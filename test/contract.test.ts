import { describe, it, expect } from 'vitest';
import type { EjbFramePayload } from '../extension/src/contract/types';
import { MockEjbEmitter } from '../mock-emitter';

describe('contract validation (v1)', () => {
  it('validates synthetic mock-emitter frames strictly against contract rules', () => {
    let capturedPayload: EjbFramePayload | null = null;

    const listener = (e: Event) => {
      capturedPayload = (e as CustomEvent<EjbFramePayload>).detail;
    };
    window.addEventListener('ejb:frame', listener);

    const emitter = new MockEjbEmitter('gedi-forest-height', 12);
    emitter.start();
    emitter.seek(12.54);
    emitter.stop();

    window.removeEventListener('ejb:frame', listener);

    expect(capturedPayload).not.toBeNull();
    const p = capturedPayload!;

    // 1. Version must be 1
    expect(p.v).toBe(1);

    // 2. Video sync anchor timestamp
    expect(typeof p.t).toBe('number');
    expect(p.t).toBeGreaterThanOrEqual(0);

    // 3. Metrics [0.0, 1.0] rules
    expect(p.metrics.brightness).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.brightness).toBeLessThanOrEqual(1.0);

    expect(p.metrics.dominantColor.r).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.dominantColor.r).toBeLessThanOrEqual(1.0);
    expect(p.metrics.dominantColor.g).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.dominantColor.g).toBeLessThanOrEqual(1.0);
    expect(p.metrics.dominantColor.b).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.dominantColor.b).toBeLessThanOrEqual(1.0);

    expect(p.metrics.hue).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.hue).toBeLessThanOrEqual(1.0);
    expect(p.metrics.saturation).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.saturation).toBeLessThanOrEqual(1.0);

    if (p.metrics.dataValue !== null) {
      expect(p.metrics.dataValue).toBeGreaterThanOrEqual(0.0);
      expect(p.metrics.dataValue).toBeLessThanOrEqual(1.0);
    }

    expect(p.metrics.motion).toBeGreaterThanOrEqual(0.0);
    expect(p.metrics.motion).toBeLessThanOrEqual(1.0);

    // 4. Regional grid checks
    expect(p.metrics.regions.rows).toBe(4);
    expect(p.metrics.regions.cols).toBe(8);
    expect(p.metrics.regions.brightness.length).toBe(32);
    for (const b of p.metrics.regions.brightness) {
      expect(b).toBeGreaterThanOrEqual(0.0);
      expect(b).toBeLessThanOrEqual(1.0);
    }

    // 5. Flags checks
    expect(typeof p.flags.seeked).toBe('boolean');
    expect(typeof p.flags.scene_cut).toBe('boolean');
  });
});
