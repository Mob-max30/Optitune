import { describe, it, expect } from 'vitest';
import { DynamicAutoRanger } from '../extension/src/audio/autorange';

describe('DynamicAutoRanger', () => {
  it('expands narrow ranges into full 0..1 scale', () => {
    const ranger = new DynamicAutoRanger(0.05, 0.10);

    // Initial value centers at 0.5
    expect(ranger.process(0.45, true)).toBeCloseTo(0.5, 1);

    // Values in narrow band 0.40 - 0.50
    for (let i = 0; i < 20; i++) {
      ranger.process(0.40);
      ranger.process(0.50);
    }

    const low = ranger.process(0.40);
    const high = ranger.process(0.50);

    expect(low).toBeLessThan(0.15);
    expect(high).toBeGreaterThan(0.85);
  });

  it('handles invalid numbers gracefully', () => {
    const ranger = new DynamicAutoRanger();
    expect(ranger.process(NaN)).toBe(0.5);
    expect(ranger.process(Infinity)).toBe(0.5);
  });
});
