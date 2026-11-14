/**
 * Earth Jukebox (EJB) — Sonification Engine Types
 *
 * Authored by Pranav K for the NASA Space Apps Challenge 2026.
 */

import type { EjbFramePayload, PresetConfig } from '../contract/types';

export type SonificationMode = 'scientific' | 'artistic' | 'scanner' | 'raaga';

export type MusicalScaleName =
  | 'pentatonic-major'
  | 'pentatonic-minor'
  | 'akebono'
  | 'dorian'
  | 'lydian'
  | 'natural-minor'
  | 'chromatic';

export interface AudioEngineOptions {
  mode?: SonificationMode;
  masterVolume?: number; // [0.0, 1.0]
  scale?: MusicalScaleName;
  baseFrequency?: number; // Hz (e.g. 130.81 for C3)
  octaves?: number;
  enableSpatial?: boolean;
  enablePercussion?: boolean;
  enableReverb?: boolean;
}

export interface AudioTelemetry {
  leadFrequency: number;
  leadGain: number;
  pan: number;
  filterCutoff: number;
  activeVoices: number;
  eventsTriggered: number;
  mode: SonificationMode;
  vizId: string;
  raagaName?: string;
  taalaName?: string;
  currentSwara?: string;
}

export interface PresetAudioProfile {
  id: string;
  defaultMode: SonificationMode;
  preferredScale: MusicalScaleName;
  baseFrequency: number;
  maxFrequency: number;
  primaryMetric: 'dataValue' | 'brightness' | 'motion' | 'layers';
  oscillatorType: OscillatorType;
  filterType: BiquadFilterType;
  baseCutoff: number;
  maxCutoff: number;
  reverbDecay: number;
  harmonicSpread: number;
  soundLegend: string;
}
