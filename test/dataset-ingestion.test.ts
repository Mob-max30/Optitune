import { describe, it, expect } from 'vitest';
import { ingestGriddedDataset, ingestTimeSeriesDataset } from '../extension/src/ingestion/dataset-ingestion';
import { validateScientificFeatureFrame } from '../extension/src/sfr/schema';

describe('Original Scientific Dataset Ingestion Engine', () => {
  it('ingests 2D floating-point raster grids with Tier 1 provenance and handles Fill/NoData values', () => {
    // 4x4 grid representing Sea Surface Temperature (°C)
    // with a missing data point (FillValue -999.0)
    const rawData = [
      22.5, 23.0, 23.5, 24.0,
      21.0, 22.0, -999.0, 23.5,
      19.5, 20.0, 21.0, 22.0,
      18.0, 18.5, 19.0, 20.0
    ];

    const result = ingestGriddedDataset({
      datasetId: 'modis-sst-l3',
      title: 'MODIS Level 3 Sea Surface Temperature',
      coordinateReferenceSystem: 'EPSG:4326',
      timestamp: 1600000000,
      rows: 4,
      cols: 4,
      variable: {
        name: 'sea_surface_temperature',
        unit: '°C',
        validRange: [-2.0, 35.0],
        fillValue: -999.0,
        uncertainty: 0.4
      },
      data: rawData
    });

    expect(result.validValuesCount).toBe(15);
    expect(result.missingValuesCount).toBe(1);
    expect(result.meanValue).toBeGreaterThan(20.0);

    const validation = validateScientificFeatureFrame(result.frame);
    expect(validation.valid).toBe(true);

    const gridFeature = result.frame.features.find(f => f.featureType === 'spatial_grid') as any;
    expect(gridFeature).toBeDefined();
    expect(gridFeature.provenance.sourceType).toBe('tier1_raw_telemetry');
    expect(gridFeature.quality.calibrationStatus).toBe('instrument_calibrated');
    expect(gridFeature.values[6]).toBeNull(); // Missing data point is null, not zero
  });

  it('ingests structured atmospheric time series datasets with uncertainty bounds', () => {
    const timestamps = [0, 1, 2, 3, 4];
    const co2PpmValues = [412.5, 413.0, 413.2, 414.0, 414.5];

    const result = ingestTimeSeriesDataset({
      datasetId: 'dyamond-co2-station',
      title: 'Mauna Loa Atmospheric CO2 Baseline',
      timestamps,
      values: co2PpmValues,
      variable: {
        name: 'co2_concentration',
        unit: 'ppm',
        validRange: [350.0, 450.0],
        uncertainty: 0.12
      }
    });

    expect(result.validValuesCount).toBe(5);
    expect(result.missingValuesCount).toBe(0);
    expect(result.meanValue).toBeCloseTo(413.44, 2);

    const seriesFeature = result.frame.features.find(f => f.featureType === 'time_series') as any;
    expect(seriesFeature).toBeDefined();
    expect(seriesFeature.provenance.sourceType).toBe('tier1_raw_telemetry');
    expect(seriesFeature.unit).toBe('ppm');
    expect(seriesFeature.quality.uncertainty.value).toBe(0.12);
  });
});
