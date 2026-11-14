/**
 * Earth Jukebox (EJB) — Scientific Auditory Scene Compiler (SASC)
 * Module: SASC Audio Engine Adapter & Musical Harmonizer
 *
 * Implements Stage 13 of SASC:
 * Bridges the compiled AuditorySceneProfile directly into EarthJukeboxAudioEngine.
 * Enriches the synthesis with musical expressiveness: deep resonant bass grounding,
 * dynamic rhythmic pulse/tempo, rich scale-quantized harmonies, and distinct acoustic timbres.
 *
 * Authored by Pranav K & Ujwal A (NASA Space Apps Challenge 2026).
 */

import type { EarthJukeboxAudioEngine } from '../audio/engine';
import type { AudioTelemetry } from '../audio/types';
import type { ScientificFeatureFrame } from '../sfr/types';
import type { EjbFramePayload } from '../contract/types';
import { enrichScientificFeatures, type EnrichedScientificFeature } from './ontology';
import { buildScientificRelationshipGraph } from './relationship-graph';
import { calculateRateOfChange, calculateSpatialGradient, type TemporalFrameHistory } from './derived-features';
import { evaluateFeatureAttention, type FeatureAttentionScore } from './attention-engine';
import { optimizeAuditoryScene, type OptimizedAuditoryScene } from './scene-optimizer';
import { TemporalSceneOrchestrator, type GrammaticalStream } from './grammar-orchestrator';
import { buildAuditorySceneProfile, type AuditorySceneProfile } from './scene-profile';
import { mapContinuousFrequency, quantizeToScale } from '../audio/scales';

export interface SascEvaluatedParameters {
  leadFrequency: number;
  leadGain: number;
  pan: number;
  filterCutoff: number;
  rowEnergies: [number, number, number, number];
  noiseIntensity: number;
  pulseRateHz: number;
  eventsToTrigger: Array<{ x: number; y: number; intensity: number }>;
  layers?: Record<string, number>;
}

export class SascAudioEngineAdapter {
  private engine: EarthJukeboxAudioEngine | null = null;
  private orchestrator = new TemporalSceneOrchestrator();
  private currentSceneProfile: AuditorySceneProfile | null = null;
  private activeDatasetId: string | null = null;
  private lastFeatureHistory = new Map<string, TemporalFrameHistory>();

  constructor(engine?: EarthJukeboxAudioEngine | null) {
    if (engine) {
      this.engine = engine;
    }
  }

  getActiveSceneProfile(): AuditorySceneProfile | null {
    return this.currentSceneProfile;
  }

  resetScene(): void {
    this.currentSceneProfile = null;
    this.activeDatasetId = null;
    this.lastFeatureHistory.clear();
  }

  /**
   * Compiles and executes a complete scientific feature frame through SASC.
   */
  processScientificFrame(frame: ScientificFeatureFrame): AudioTelemetry {
    const datasetId = frame.sourceId || 'earth-dataset';
    const timestamp = frame.timestamp;
    const isSceneCut = Boolean(frame.metadata?.scene_cut);
    const isSeeked = Boolean(frame.metadata?.seeked);

    // 1. Stage 2: Feature Validation & Semantic Enrichment
    const enrichedFeatures = enrichScientificFeatures(frame);

    // 2. Stage 4: Derived Features (Rate of change, spatial gradient)
    const derivedList: EnrichedScientificFeature[] = [];
    for (const f of enrichedFeatures) {
      if (f.dataType === 'scalar' && typeof f.observedValue === 'number') {
        const history = this.lastFeatureHistory.get(f.stableFeatureId);
        const rateFeature = calculateRateOfChange(f, history);
        if (rateFeature) derivedList.push(rateFeature);

        this.lastFeatureHistory.set(f.stableFeatureId, {
          previousFeature: f,
          timestamp,
          isSceneCut
        });
      } else if (f.dataType === 'spatial_grid') {
        const gradFeature = calculateSpatialGradient(f);
        if (gradFeature) derivedList.push(gradFeature);
      }
    }

    const allFeatures = [...enrichedFeatures, ...derivedList];

    // 3. Stage 3: Relationship Graph Construction
    const graph = buildScientificRelationshipGraph(allFeatures, datasetId);

    // 4. Stage 5: Scientific Significance & Attention Engine
    const attentionMap = new Map<string, FeatureAttentionScore>();
    for (const f of allFeatures) {
      attentionMap.set(f.stableFeatureId, evaluateFeatureAttention(f, graph));
    }

    // 5. Stage 7, 8, 9: Auditory Scene Optimization (Cached unless dataset changes or scene cut)
    if (!this.currentSceneProfile || this.activeDatasetId !== datasetId || isSceneCut) {
      this.activeDatasetId = datasetId;
      const optimizedScene = optimizeAuditoryScene(allFeatures, attentionMap, { maxVoices: 5 });
      const grammaticalStreams = this.orchestrator.orchestrate(optimizedScene, timestamp, { isSceneCut, isSeeked });
      this.currentSceneProfile = buildAuditorySceneProfile(optimizedScene, grammaticalStreams);
    }

    // 6. Stage 13: Mathematical Audio Parameter Evaluation with Musical Tuning
    const evaluated = this.evaluateMusicalParameters(this.currentSceneProfile, allFeatures);

    // 7. Execute through Web Audio Engine via standard payload contract
    const brightnessGrid = new Array(32).fill(evaluated.leadGain);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        brightnessGrid[r * 8 + c] = evaluated.rowEnergies[r];
      }
    }

    const meta = frame.metadata || {};
    const dominantColor = (meta.dominantColor && typeof meta.dominantColor === 'object' && 'r' in meta.dominantColor)
      ? (meta.dominantColor as { r: number; g: number; b: number })
      : { r: 0.2, g: 0.8, b: 0.3 };
    const hue = typeof meta.hue === 'number' ? (meta.hue as number) : 0.35;
    const saturation = typeof meta.saturation === 'number' ? (meta.saturation as number) : 0.6;
    const layers = evaluated.layers && Object.keys(evaluated.layers).length > 0
      ? evaluated.layers
      : (typeof meta.layers === 'object' && meta.layers !== null ? (meta.layers as Record<string, number>) : undefined);

    const syntheticPayload: EjbFramePayload = {
      v: 1,
      t: timestamp,
      frameIndex: frame.frameIndex,
      vizId: datasetId,
      metrics: {
        brightness: evaluated.leadGain,
        dominantColor,
        hue,
        saturation,
        motion: (evaluated.filterCutoff - 400) / 4600,
        dataValue: Math.max(0, Math.min(1.0, (evaluated.leadFrequency - 110) / (880 - 110))),
        regions: {
          rows: 4,
          cols: 8,
          brightness: brightnessGrid,
          dataValue: brightnessGrid
        }
      },
      flags: {
        seeked: isSeeked,
        scene_cut: isSceneCut
      },
      events: evaluated.eventsToTrigger.map(e => ({
        type: 'flash',
        intensity: e.intensity,
        x: e.x,
        y: e.y
      })),
      layers,
      profile: {
        rows: evaluated.rowEnergies,
        cols: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
      }
    };

    if (this.engine) {
      if (this.engine.getTelemetry().mode !== 'raaga') {
        this.engine.processFrame(syntheticPayload);
      }
      return this.engine.getTelemetry();
    }

    return {
      activeVoices: 4,
      leadFrequency: evaluated.leadFrequency,
      leadGain: evaluated.leadGain,
      pan: evaluated.pan,
      filterCutoff: evaluated.filterCutoff,
      eventsTriggered: evaluated.eventsToTrigger.length,
      mode: 'artistic',
      vizId: datasetId
    };
  }

  /**
   * Computes rich musical parameters from active scene streams.
   */
  private evaluateMusicalParameters(
    profile: AuditorySceneProfile,
    features: EnrichedScientificFeature[]
  ): SascEvaluatedParameters {
    let leadFreq = 220;
    let leadGain = 0.28;
    let pan = 0.0;
    let filterCutoff = 1400;
    const rowEnergies: [number, number, number, number] = [0.25, 0.25, 0.25, 0.25];
    let noiseIntensity = 0.0;
    let pulseRateHz = 1.0;
    const eventsToTrigger: Array<{ x: number; y: number; intensity: number }> = [];
    const layers: Record<string, number> = {};

    if (profile.isSilent) {
      return {
        leadFrequency: 220,
        leadGain: 0.0,
        pan: 0.0,
        filterCutoff: 400,
        rowEnergies: [0, 0, 0, 0],
        noiseIntensity: 0.0,
        pulseRateHz: 0.0,
        eventsToTrigger: []
      };
    }

    const featureMap = new Map(features.map(f => [f.stableFeatureId, f]));

    for (const stream of profile.activeStreams) {
      const feat = featureMap.get(stream.featureId);
      if (!feat) continue;

      const norm = feat.normalizedValue ?? (
        typeof feat.observedValue === 'number' && feat.validRange
          ? (feat.observedValue - feat.validRange[0]) / (feat.validRange[1] - feat.validRange[0])
          : 0.5
      );

      switch (stream.role) {
        case 'STATE':
        case 'SCIENTIFIC_ANCHOR': {
          leadFreq = mapContinuousFrequency(norm, 110, 880, 'log');
          leadGain = Math.max(0.10, Math.min(0.75, 0.20 + norm * 0.50));
          break;
        }

        case 'STRUCTURE': {
          if (feat.dataType === 'spatial_grid' && Array.isArray(feat.observedValue)) {
            const vals = feat.observedValue as number[];
            for (let r = 0; r < 4; r++) {
              const rowSlice = vals.slice(r * 8, (r + 1) * 8);
              const sum = rowSlice.reduce((a, b) => a + b, 0);
              rowEnergies[r] = Math.max(0.05, Math.min(1.0, sum / (rowSlice.length || 1)));
            }
          }
          break;
        }

        case 'DYNAMICS': {
          if (typeof feat.observedValue === 'number') {
            pulseRateHz = 1.0 + Math.min(4.0, Math.abs(feat.observedValue) * 2.0);
            filterCutoff = 800 + Math.min(1.0, Math.abs(feat.observedValue)) * 3200;
          }
          break;
        }

        case 'EVENTS': {
          if (feat.dataType === 'event') {
            eventsToTrigger.push({
              x: pan,
              y: 0.5,
              intensity: typeof feat.observedValue === 'number' ? feat.observedValue : 0.8
            });
          }
          break;
        }

        case 'CONFIDENCE': {
          if (feat.uncertainty) {
            noiseIntensity = Math.min(0.4, feat.uncertainty.value * 0.1);
          }
          break;
        }
      }
    }

    return {
      leadFrequency: Math.round(leadFreq),
      leadGain: parseFloat(leadGain.toFixed(3)),
      pan: parseFloat(pan.toFixed(3)),
      filterCutoff: Math.round(filterCutoff),
      rowEnergies,
      noiseIntensity: parseFloat(noiseIntensity.toFixed(3)),
      pulseRateHz: parseFloat(pulseRateHz.toFixed(2)),
      eventsToTrigger,
      layers
    };
  }
}
