import { describe, it, expect } from 'vitest';
import { extractStaticImageFeatures } from '../extension/src/extraction/static-image';

describe('Static Scientific Image Extraction Engine', () => {
  it('extracts features from a calibrated image buffer using legend stops', () => {
    // Create synthetic 64x64 green image (simulating forest canopy)
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 40;     // R
      data[i * 4 + 1] = 180; // G
      data[i * 4 + 2] = 60;  // B
      data[i * 4 + 3] = 255; // A
    }

    const legend = {
      min: 0,
      max: 60,
      unit: 'm',
      stops: [
        { stop: 0.0, color: { r: 240, g: 240, b: 200 } },
        { stop: 0.5, color: { r: 40, g: 180, b: 60 } },
        { stop: 1.0, color: { r: 10, g: 80, b: 20 } }
      ]
    };

    const result = extractStaticImageFeatures(
      { data, width, height },
      {
        sourceId: 'gedi-forest-height',
        datasetName: 'Canopy Height',
        legend
      }
    );

    expect(result.calibrationFound).toBe(true);
    expect(result.meanDeltaE).toBeLessThan(10.0);

    const primary = result.frame.features.find(f => f.featureId.includes('primary_measurement'));
    expect(primary).toBeDefined();
    expect(primary?.provenance.sourceType).toBe('tier3_calibrated_visual');
    expect(primary?.unit).toBe('m');
    expect((primary as any).value).toBeCloseTo(30.0, 1);
  });

  it('marks uncalibrated image source explicitly as Tier 4 visual proxy when legend is missing', () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4).fill(128);

    const result = extractStaticImageFeatures(
      { data, width, height },
      {
        sourceId: 'unknown-image'
      }
    );

    expect(result.calibrationFound).toBe(false);
    expect(result.uncalibratedReason).toContain('No documented NASA legend');

    const proxy = result.frame.features.find(f => f.featureId.includes('luminance_proxy'));
    expect(proxy).toBeDefined();
    expect(proxy?.provenance.sourceType).toBe('tier4_visual_proxy');
    expect(proxy?.quality.calibrationStatus).toBe('proxy_inferred');
    expect(proxy?.unit).toBe('ratio');
  });

  it('computes 4x8 spatial grid features from image regions', () => {
    const width = 32;
    const height = 32;
    const data = new Uint8ClampedArray(width * height * 4).fill(200);

    const result = extractStaticImageFeatures(
      { data, width, height },
      {
        sourceId: 'spatial-test',
        gridRows: 4,
        gridCols: 8
      }
    );

    const grid = result.frame.features.find(f => f.featureType === 'spatial_grid') as any;
    expect(grid).toBeDefined();
    expect(grid.rows).toBe(4);
    expect(grid.cols).toBe(8);
    expect(grid.values.length).toBe(32);
    expect(grid.values[0]).toBeGreaterThan(0.5);
  });
});
