import { describe, it, expect, beforeEach } from 'vitest';
import {
  enrichScientificFeatures,
  validateFeatureSemantics,
  buildScientificRelationshipGraph,
  calculateRateOfChange,
  evaluateFeatureAttention,
  analyzeRedundancy,
  SascAudioEngineAdapter,
  TemporalSceneOrchestrator,
  generateSascVerbalLegend,
  generateSascStructuredLegendHtml
} from '../extension/src/sasc';
import { ScientificFeatureFrame } from '../extension/src/sfr/types';

describe('SASC — Scientific Auditory Scene Compiler Verification', () => {
  let adapter: SascAudioEngineAdapter;

  beforeEach(() => {
    adapter = new SascAudioEngineAdapter();
  });

  it('Stage 1 & 2: enriches raw SFR features and validates scientific ontology', () => {
    const rawFrame: ScientificFeatureFrame = {
      schemaVersion: 'sfr.v1',
      frameId: 'gedi_001',
      sourceId: 'gedi-forest-height',
      timestamp: 12.5,
      frameIndex: 150,
      features: [
        {
          schemaVersion: 'sfr.v1',
          featureId: 'gedi.canopy_height',
          featureName: 'canopy_height_magnitude',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 32.5,
          normalizedValue: 0.54,
          unit: 'm',
          validRange: [0, 60],
          timestamp: 12.5,
          provenance: {
            sourceType: 'tier3_calibrated_visual',
            sourceId: 'gedi-forest-height',
            extractionMethod: 'cielab_legend_match',
            timestampExtracted: Date.now()
          },
          quality: {
            confidence: 0.85,
            calibrationStatus: 'legend_calibrated'
          }
        }
      ]
    };

    const enriched = enrichScientificFeatures(rawFrame);
    expect(enriched.length).toBe(1);
    expect(enriched[0].primaryRole).toBe('MAGNITUDE');
    expect(enriched[0].eligibility.eligibleForSonification).toBe(true);

    const validation = validateFeatureSemantics(enriched[0]);
    expect(validation.isValid).toBe(true);
  });

  it('Stage 3: builds typed relationship graph and prevents circular derivations', () => {
    const rawFrame: ScientificFeatureFrame = {
      schemaVersion: 'sfr.v1',
      frameId: 'multi_001',
      sourceId: 'test-phenomenon',
      timestamp: 1.0,
      frameIndex: 1,
      features: [
        {
          schemaVersion: 'sfr.v1',
          featureId: 'f1',
          featureName: 'base_measurement',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 10,
          normalizedValue: 0.1,
          unit: 'm',
          timestamp: 1.0,
          provenance: { sourceType: 'tier1_raw_telemetry', sourceId: 'test', extractionMethod: 'direct', timestampExtracted: 1000 },
          quality: { confidence: 1.0, calibrationStatus: 'instrument_calibrated' }
        },
        {
          schemaVersion: 'sfr.v1',
          featureId: 'f2',
          featureName: 'derived_rate',
          scientificDimension: 'velocity',
          featureType: 'scalar',
          value: 2,
          normalizedValue: 0.2,
          unit: 'm/s',
          timestamp: 1.0,
          provenance: { sourceType: 'tier1_raw_telemetry', sourceId: 'test', extractionMethod: 'rate', timestampExtracted: 1000 },
          quality: { confidence: 1.0, calibrationStatus: 'instrument_calibrated' }
        }
      ]
    };

    const enriched = enrichScientificFeatures(rawFrame);
    enriched[1].derivationHistory.push('f1');

    const graph = buildScientificRelationshipGraph(enriched, 'test-phenomenon');
    expect(graph.getAllNodes().length).toBeGreaterThanOrEqual(2);

    // Derivation cycle prevention check
    const cyclePrevented = graph.addEdge({
      sourceId: 'f1',
      targetId: 'f2',
      type: 'DERIVED_FROM',
      confidence: 1.0,
      evidenceSource: 'test',
      isDocumented: false
    });
    expect(cyclePrevented).toBe(false); // Cycle rejected!
  });

  it('Stage 4: calculates derived features (rate of change, spatial gradient) with safeguards', () => {
    const f1 = enrichScientificFeatures({
      schemaVersion: 'sfr.v1',
      frameId: 't1',
      sourceId: 'test',
      timestamp: 1.0,
      frameIndex: 10,
      features: [{
        schemaVersion: 'sfr.v1',
        featureId: 'temp',
        featureName: 'temperature',
        scientificDimension: 'magnitude',
        featureType: 'scalar',
        value: 20,
        normalizedValue: 0.2,
        unit: '°C',
        timestamp: 1.0,
        provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'test', extractionMethod: 'test', timestampExtracted: 1000 },
        quality: { confidence: 0.8, calibrationStatus: 'legend_calibrated' }
      }]
    })[0];

    const f2 = enrichScientificFeatures({
      schemaVersion: 'sfr.v1',
      frameId: 't2',
      sourceId: 'test',
      timestamp: 2.0,
      frameIndex: 22,
      features: [{
        schemaVersion: 'sfr.v1',
        featureId: 'temp',
        featureName: 'temperature',
        scientificDimension: 'magnitude',
        featureType: 'scalar',
        value: 25,
        normalizedValue: 0.25,
        unit: '°C',
        timestamp: 2.0,
        provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'test', extractionMethod: 'test', timestampExtracted: 2000 },
        quality: { confidence: 0.8, calibrationStatus: 'legend_calibrated' }
      }]
    })[0];

    // Rate calculation across 1.0s interval
    const rate = calculateRateOfChange(f2, { previousFeature: f1, timestamp: 1.0, isSceneCut: false });
    expect(rate).not.toBeNull();
    expect(rate?.observedValue).toBe(5); // (25 - 20) / 1.0s = 5 °C/s
    expect(rate?.primaryRole).toBe('RATE');

    // Scene cut protection
    const rateOnSceneCut = calculateRateOfChange(f2, { previousFeature: f1, timestamp: 1.0, isSceneCut: true });
    expect(rateOnSceneCut).toBeNull();
  });

  it('Stage 5 & 6: calculates multi-factor attention and classifies redundancies', () => {
    const enriched = enrichScientificFeatures({
      schemaVersion: 'sfr.v1',
      frameId: 'test',
      sourceId: 'sst',
      timestamp: 5.0,
      frameIndex: 60,
      features: [
        {
          schemaVersion: 'sfr.v1',
          featureId: 'sst.val',
          featureName: 'sea_surface_temperature',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 24.0,
          normalizedValue: 0.70,
          validRange: [-2, 35],
          unit: '°C',
          timestamp: 5.0,
          provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'sst', extractionMethod: 'lut', timestampExtracted: 5000 },
          quality: { confidence: 0.8, calibrationStatus: 'legend_calibrated' }
        },
        {
          schemaVersion: 'sfr.v1',
          featureId: 'sst.val_dup',
          featureName: 'sea_surface_temperature',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 24.0,
          normalizedValue: 0.70,
          unit: '°C',
          timestamp: 5.0,
          provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'sst', extractionMethod: 'lut', timestampExtracted: 5000 },
          quality: { confidence: 0.8, calibrationStatus: 'legend_calibrated' }
        }
      ]
    });

    const attention = evaluateFeatureAttention(enriched[0]);
    expect(attention.totalScore).toBeGreaterThan(0.5);
    expect(attention.priority).toBe('HIGH');

    const redundancy = analyzeRedundancy(enriched);
    expect(redundancy[0].decision).toBe('MERGE'); // Identical variables merged!
  });

  it('Stage 7, 8, 9, 10, 11: End-to-end Auditory Scene Compilation', () => {
    const rawFrame: ScientificFeatureFrame = {
      schemaVersion: 'sfr.v1',
      frameId: 'gedi_full',
      sourceId: 'gedi-forest-height',
      timestamp: 10.0,
      frameIndex: 120,
      features: [
        {
          schemaVersion: 'sfr.v1',
          featureId: 'gedi.canopy_height',
          featureName: 'canopy_height',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 45.0,
          normalizedValue: 0.75,
          unit: 'm',
          validRange: [0, 60],
          timestamp: 10.0,
          provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'gedi', extractionMethod: 'lut', timestampExtracted: 10000 },
          quality: { confidence: 0.9, calibrationStatus: 'legend_calibrated' }
        },
        {
          schemaVersion: 'sfr.v1',
          featureId: 'gedi.spatial',
          featureName: 'regional_canopy_matrix',
          scientificDimension: 'structure_distribution',
          featureType: 'spatial_grid',
          rows: 4,
          cols: 8,
          values: new Array(32).fill(45.0),
          normalizedValues: new Array(32).fill(0.75),
          unit: 'm',
          timestamp: 10.0,
          provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'gedi', extractionMethod: 'grid', timestampExtracted: 10000 },
          quality: { confidence: 0.9, calibrationStatus: 'legend_calibrated' }
        }
      ]
    };

    const telemetry = adapter.processScientificFrame(rawFrame);
    expect(telemetry.leadFrequency).toBeGreaterThan(100);
    expect(telemetry.activeVoices).toBeGreaterThanOrEqual(4);

    const sceneProfile = adapter.getActiveSceneProfile();
    expect(sceneProfile).not.toBeNull();
    expect(sceneProfile?.isSilent).toBe(false);
    expect(sceneProfile?.activeStreams.length).toBeGreaterThanOrEqual(1);

    // Auditory Legend Verification
    const verbalLegend = generateSascVerbalLegend(sceneProfile!);
    expect(verbalLegend).toContain('canopy_height');

    const htmlLegend = generateSascStructuredLegendHtml(sceneProfile!);
    expect(htmlLegend).toContain('SASC Scene: gedi-forest-height');
  });

  describe('Scenario A to F Validation Scenarios', () => {
    it('Scenario A: GEDI forest canopy identifies state and structure without inventing uncalibrated values', () => {
      const gediFrame: ScientificFeatureFrame = {
        schemaVersion: 'sfr.v1',
        frameId: 'scen_a',
        sourceId: 'gedi-forest-height',
        timestamp: 5.0,
        frameIndex: 60,
        features: [
          {
            schemaVersion: 'sfr.v1',
            featureId: 'gedi.canopy_height',
            featureName: 'canopy_height',
            scientificDimension: 'magnitude',
            featureType: 'scalar',
            value: 24.0, // Calibrated height
            normalizedValue: 0.40,
            unit: 'm',
            validRange: [0, 60],
            timestamp: 5.0,
            provenance: { sourceType: 'tier3_calibrated_visual', sourceId: 'gedi', extractionMethod: 'legend', timestampExtracted: 5000 },
            quality: { confidence: 0.9, calibrationStatus: 'legend_calibrated' }
          }
        ]
      };

      const enriched = enrichScientificFeatures(gediFrame);
      expect(enriched[0].primaryRole).toBe('MAGNITUDE');
      expect(enriched[0].unit).toBe('m');
      expect(enriched[0].eligibility.eligibleForSonification).toBe(true);
    });

    it('Scenario D: Lightning events trigger discrete percussive accents with cooldown', () => {
      const orchestrator = new TemporalSceneOrchestrator();
      expect(orchestrator.canTriggerEvent('flash_1', 1.00)).toBe(true);
      expect(orchestrator.canTriggerEvent('flash_1', 1.05)).toBe(false); // Cooldown blocks rapid duplication!
      expect(orchestrator.canTriggerEvent('flash_1', 1.30)).toBe(true); // Fires after cooldown!
    });

    it('Scenario E: Generic uncalibrated video enforces Tier 4 proxy restrictions', () => {
      const proxyFeature = enrichScientificFeatures({
        schemaVersion: 'sfr.v1',
        frameId: 'proxy_test',
        sourceId: 'web-video',
        timestamp: 2.0,
        frameIndex: 24,
        features: [{
          schemaVersion: 'sfr.v1',
          featureId: 'luma',
          featureName: 'brightness_proxy',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: 0.5,
          normalizedValue: 0.5,
          unit: 'ratio',
          timestamp: 2.0,
          provenance: { sourceType: 'tier4_visual_proxy', sourceId: 'video', extractionMethod: 'luma', timestampExtracted: 2000 },
          quality: { confidence: 0.4, calibrationStatus: 'proxy_inferred' }
        }]
      })[0];

      expect(proxyFeature.provenanceTier).toBe('tier4_visual_proxy');
      expect(proxyFeature.unit).toBe('ratio'); // Does not claim physical units!
    });

    it('Scenario F: Missing or incomplete scientific data remains missing and is not coerced to zero', () => {
      const missingFrame = enrichScientificFeatures({
        schemaVersion: 'sfr.v1',
        frameId: 'missing_test',
        sourceId: 'sparse-dataset',
        timestamp: 3.0,
        frameIndex: 36,
        features: [{
          schemaVersion: 'sfr.v1',
          featureId: 'co2_sensor_error',
          featureName: 'co2_concentration',
          scientificDimension: 'magnitude',
          featureType: 'scalar',
          value: (null as unknown as number), // Null / missing observation
          normalizedValue: 0,
          unit: 'ppm',
          isMissing: true,
          timestamp: 3.0,
          provenance: { sourceType: 'tier1_raw_telemetry', sourceId: 'satellite', extractionMethod: 'direct', timestampExtracted: 3000 },
          quality: { confidence: 0, calibrationStatus: 'uncalibrated' }
        }]
      })[0];

      expect(missingFrame.isMissing).toBe(true);
      expect(missingFrame.observedValue).toBeNull();
      expect(missingFrame.eligibility.eligibleForSonification).toBe(false);
      expect(missingFrame.eligibility.rejectionReason).toContain('missing or null');
    });
  });
});
