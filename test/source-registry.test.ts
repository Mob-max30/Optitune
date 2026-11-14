import { describe, it, expect } from 'vitest';
import {
  NASA_SOURCE_REGISTRY,
  getNasaSourceRecord,
  getGenericFallbackRecord
} from '../extension/src/discovery/source-registry';

describe('NASA Source Discovery & Metadata Registry', () => {
  it('contains complete canonical metadata for all core challenge presets', () => {
    const keys = Object.keys(NASA_SOURCE_REGISTRY);
    expect(keys.length).toBeGreaterThanOrEqual(10);

    for (const key of keys) {
      const record = NASA_SOURCE_REGISTRY[key];
      expect(record.sourceId).toBe(key);
      expect(record.svsId).toBeGreaterThan(0);
      expect(record.canonicalUrl).toContain('https://svs.gsfc.nasa.gov/');
      expect(record.physicalUnit.length).toBeGreaterThan(0);
      expect(record.validRange[0]).toBeLessThan(record.validRange[1]);
      expect(record.credits.length).toBeGreaterThan(5);
    }
  });

  it('retrieves records by SVS ID and sourceId', () => {
    const gedi = getNasaSourceRecord('gedi-forest-height');
    expect(gedi).toBeDefined();
    expect(gedi?.svsId).toBe(4950);
    expect(gedi?.physicalUnit).toBe('m');

    const bySvsId = getNasaSourceRecord(4950);
    expect(bySvsId).toBeDefined();
    expect(bySvsId?.sourceId).toBe('gedi-forest-height');
  });

  it('provides safe generic fallback for uncatalogued sources without pretending to be calibrated', () => {
    const fallback = getGenericFallbackRecord('custom-user-feed');
    expect(fallback.sourceId).toBe('custom-user-feed');
    expect(fallback.hasCalibratedLegend).toBe(false);
    expect(fallback.physicalUnit).toBe('ratio');
    expect(fallback.description).toContain('Generic visual proxy fallback');
  });
});
