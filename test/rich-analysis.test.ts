import { describe, it, expect } from 'vitest';
import { RichAnalysisPipeline } from '../extension/src/extraction/rich-analysis';
import { adaptContractV1_1ToSfr } from '../extension/src/sfr/adapters/contract-v1-1';
import { prepareLegendLUT } from '../extension/src/analysis/legend';
import { PRESETS } from '../extension/src/presets';

describe('Gate G2: Rich Analysis Path, Validity Masking & Contract v1.1', () => {
  const pipeline = new RichAnalysisPipeline();

  it('correctly builds validity mask and excludes near-black space background', () => {
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4);

    // Left half: Pure black space (Luma = 0)
    // Right half: Active Earth data (Luma ~ 0.5)
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const idx = (r * width + c) * 4;
        if (c >= 64) {
          data[idx] = 120;     // R
          data[idx + 1] = 180; // G
          data[idx + 2] = 220; // B
          data[idx + 3] = 255;
        } else {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      }
    }

    const payload = pipeline.analyze(data, width, height, 1.0, 1, {
      sourceKey: 'test_space_mask',
      phenomenonClass: 'ocean-currents'
    });

    // Space background is masked out!
    expect(payload.maskedFraction).toBeCloseTo(0.50, 1);
    expect(payload.coverage).toBeCloseTo(0.50, 1);
    expect(payload.level).toBeGreaterThan(0.40); // Valid data level is not dragged down to zero by space!
    expect(payload.hueFamily).toBe('cool');
  });

  it('extracts complete A3 feature set (spread, extremeFrac, peak, focus, blobs, texture)', () => {
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4).fill(100);

    // Inject an extreme thermal hotspot at top-right
    for (let r = 10; r < 30; r++) {
      for (let c = 90; c < 110; c++) {
        const idx = (r * width + c) * 4;
        data[idx] = 255;
        data[idx + 1] = 240;
        data[idx + 2] = 200;
        data[idx + 3] = 255;
      }
    }

    const payload = pipeline.analyze(data, width, height, 2.0, 2, {
      sourceKey: 'test_hotspot',
      phenomenonClass: 'thermal-fire'
    });

    expect(payload.peak).toBeGreaterThan(0.90);
    expect(payload.extremeFrac).toBeGreaterThan(0.01);
    // Focus should be in top-right quadrant (x > 0.6, y < 0.4)
    expect(payload.focus[0]).toBeGreaterThan(0.60);
    expect(payload.focus[1]).toBeLessThan(0.40);
    expect(payload.blobs.count).toBeGreaterThanOrEqual(1);
    expect(payload.blobs.items[0].pixelArea).toBeGreaterThan(0);
  });

  it('marks calibrated visualisations when legend matches active data pixels', () => {
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4);

    // GEDI canopy green
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = 40;
      data[i * 4 + 1] = 160;
      data[i * 4 + 2] = 40;
      data[i * 4 + 3] = 255;
    }

    const lut = prepareLegendLUT(PRESETS['gedi-forest-height'].legend);
    const payload = pipeline.analyze(data, width, height, 3.0, 3, {
      sourceKey: 'gedi_calibrated',
      phenomenonClass: 'biosphere',
      lut
    });

    expect(payload.provenance).toBe('calibrated visualisation');
    expect(payload.physical).toBeDefined();
    expect(payload.physical?.unit).toBe('m');
    expect(payload.physical?.medianPhysical).toBeCloseTo(30, 0); // 30 meters canopy
  });

  it('adapts cleanly to SFR frame via adaptContractV1_1ToSfr', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4).fill(150);

    const payload = pipeline.analyze(data, width, height, 4.0, 4, {
      sourceKey: 'test_sfr_adapt'
    });

    const sfr = adaptContractV1_1ToSfr(payload);
    expect(sfr.sourceId).toBe('test_sfr_adapt');
    expect(sfr.features.length).toBeGreaterThanOrEqual(6);

    const levelFeat = sfr.features.find(f => f.featureName.includes('level'));
    expect(levelFeat).toBeDefined();
    expect(levelFeat?.provenance.sourceType).toBe('tier4_visual_proxy');
    expect(levelFeat?.quality.calibrationStatus).toBe('proxy_inferred');
  });

  it('guarantees Contract v1.1 payload size is under 2 KB', () => {
    const width = 64;
    const height = 64;
    const data = new Uint8ClampedArray(width * height * 4).fill(120);

    const payload = pipeline.analyze(data, width, height, 5.0, 5, {
      sourceKey: 'test_size'
    });

    const jsonStr = JSON.stringify(payload);
    const byteSize = new TextEncoder().encode(jsonStr).length;
    expect(byteSize).toBeLessThan(2048); // < 2 KB
  });
});
