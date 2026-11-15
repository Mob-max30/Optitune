/**
 * Earth Jukebox (EJB) — Distinctness & Pipeline Debug Trace Logger
 *
 * Implements Phase A0 diagnostics behind a flag (off by default).
 * Captures the complete execution path: input source, Contract v1 metrics,
 * SFR features, candidate mappings and scores, chosen profile, active voices,
 * and final audio parameters sent to Web Audio.
 *
 * Authored for Amendment A (NASA Space Apps Challenge 2026).
 */

import type { EjbFramePayload, PresetConfig } from '../contract/types';
import type { ScientificFeatureFrame } from '../sfr/types';
import type { MappingProfile, CandidateScore } from '../semantic/types';
import type { AudioTelemetry, SonificationMode } from '../audio/types';

export interface DebugTraceRecord {
  timestamp: number;
  sourceKey: string;
  bufferHash: string;
  preset: string;
  mode: SonificationMode;
  options: Record<string, unknown>;
  contractMetrics: {
    brightness: number;
    hue: number;
    saturation: number;
    dataValue: number | null;
    motion: number;
  };
  sfrFeatureNames: string[];
  candidateScores: Array<{
    mappingId: string;
    featureName: string;
    totalScore: number;
  }>;
  chosenProfile: {
    profileId: string;
    activeMappingsCount: number;
    mappings: Array<{
      mappingId: string;
      featureName: string;
      targetVoice: string;
      targetDimension: string;
    }>;
  };
  voicesActivated: string[];
  finalAudioParams: {
    leadFrequency: number;
    leadGain: number;
    pan: number;
    filterCutoff: number;
  };
}

class DistinctnessDebugTracer {
  private enabled = false;
  private traceLog: DebugTraceRecord[] = [];

  constructor() {
    // Enabled via global flag or explicit method call
    if (typeof globalThis !== 'undefined' && (globalThis as any).__EJB_DEBUG_TRACE__) {
      this.enabled = true;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  clear(): void {
    this.traceLog = [];
  }

  getTraceLog(): DebugTraceRecord[] {
    return [...this.traceLog];
  }

  /**
   * Fast 32-bit FNV-1a buffer hash to detect blank, tainted, or identical frame buffers (H1)
   */
  hashBuffer(buffer: ArrayBuffer | Uint8ClampedArray | Uint8Array): string {
    const bytes = buffer instanceof Uint8ClampedArray || buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer);
    let hash = 0x811c9dc5;
    const len = bytes.length;
    for (let i = 0; i < len; i += 4) { // Sample every 4 bytes for speed
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  record(data: {
    sourceKey: string;
    buffer: ArrayBuffer | Uint8ClampedArray;
    preset: PresetConfig | string;
    mode: SonificationMode;
    options?: Record<string, unknown>;
    payload: EjbFramePayload;
    sfrFrame?: ScientificFeatureFrame;
    candidateScores?: Array<{ mappingId: string; featureName: string; score: CandidateScore }>;
    profile?: MappingProfile;
    telemetry?: AudioTelemetry;
  }): DebugTraceRecord | null {
    if (!this.enabled) return null;

    const presetId = typeof data.preset === 'string' ? data.preset : data.preset?.id || 'unknown';
    const bufferHash = this.hashBuffer(data.buffer);
    const m = data.payload.metrics;

    const sfrFeatureNames = data.sfrFrame?.features
      ? (Array.isArray(data.sfrFrame.features)
        ? data.sfrFrame.features.map(f => f.featureName || f.featureId)
        : Object.keys(data.sfrFrame.features))
      : [];

    const candidates = (data.candidateScores || []).map(c => ({
      mappingId: c.mappingId,
      featureName: c.featureName,
      totalScore: c.score.totalScore
    }));

    const activeMappings = data.profile?.activeMappings || [];
    const voicesActivated = Array.from(new Set(activeMappings.map(a => a.targetVoice)));

    const record: DebugTraceRecord = {
      timestamp: data.payload.t,
      sourceKey: data.sourceKey,
      bufferHash,
      preset: presetId,
      mode: data.mode,
      options: data.options || {},
      contractMetrics: {
        brightness: m.brightness,
        hue: m.hue,
        saturation: m.saturation,
        dataValue: m.dataValue ?? null,
        motion: m.motion
      },
      sfrFeatureNames,
      candidateScores: candidates,
      chosenProfile: {
        profileId: data.profile?.profileId || 'none',
        activeMappingsCount: activeMappings.length,
        mappings: activeMappings.map(a => ({
          mappingId: a.mappingId,
          featureName: a.featureName,
          targetVoice: a.targetVoice,
          targetDimension: a.targetAuditoryDimension
        }))
      },
      voicesActivated,
      finalAudioParams: {
        leadFrequency: data.telemetry?.leadFrequency ?? 0,
        leadGain: data.telemetry?.leadGain ?? 0,
        pan: data.telemetry?.pan ?? 0,
        filterCutoff: data.telemetry?.filterCutoff ?? 0
      }
    };

    this.traceLog.push(record);
    return record;
  }
}

export const debugTracer = new DistinctnessDebugTracer();
