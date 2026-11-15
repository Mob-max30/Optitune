/**
 * Earth Jukebox (EJB) — Sonification Audio Engine
 *
 * Authored by Pranav K & Ujwal A for the NASA Space Apps Challenge 2026.
 *
 * Frame-Synchronized Real-Time Musical Sonification:
 * Directly transforms visual video frames into synchronized acoustic sound in real time.
 *
 * Uses ONLY the essential, intuitive musical dimensions needed for clear audiovisual correspondence:
 * 1. Melody & Pitch  — Tracks the active on-screen visual feature. Pitch reflects physical data
 *                      (canopy height, sea temperature, CO2) auto-ranged to a full musical scale.
 * 2. Stereo Spatial  — Panned in stereo (-0.85 West to +0.85 East) directly matching the feature's
 *                      horizontal position on screen.
 * 3. Rhythm & Attack — Discrete acoustic note pulses (not an unbroken drone) whose cadence accelerates
 *                      with video motion (calm = spacious; fast = rhythmic).
 * 4. Timbre          — Organic acoustic models (Water Bell for oceans, Woody Marimba for forests/land,
 *                      Struck Kalimba for deserts, Glass Chime for lights/ice).
 * 5. Dynamics        — Note velocity and loudness follow on-screen visual brightness and contrast.
 */

import type {
  EjbFramePayload,
  EjbReadyPayload,
  EjbStatePayload,
  EjbErrorPayload,
  EjbControlPayload
} from '../contract/types';
import type {
  AudioEngineOptions,
  AudioTelemetry,
  PresetAudioProfile,
  SonificationMode
} from './types';
import { PRESET_AUDIO_PROFILES, getAudioProfile } from './profiles';
import { mapContinuousFrequency, quantizeToScale } from './scales';
import { FrameMetricsSmoother } from './smoother';
import { calculateSpatialDistribution, findActiveHotspot } from './spatial';
import { DynamicAutoRanger } from './autorange';
import { LeadVoice } from './synths/base-voice';
import { FeaturePulseVoice } from './synths/pulse-voice';
import { PercussionVoice } from './synths/percussion';
import { TextureNoiseVoice } from './synths/noise-voice';

// ─── Terrain classification from hue ────────────────────────────────────────
type TerrainType = 'ocean' | 'forest' | 'thermal' | 'arid' | 'cloud';

function classifyTerrain(hue: number, saturation: number): TerrainType {
  if (saturation < 0.12) return 'cloud'; // neutral white/grey
  if (hue >= 0.48 && hue <= 0.74) return 'ocean';  // blue ocean/water
  if (hue >= 0.20 && hue <= 0.46) return 'forest'; // green vegetation
  if (hue <= 0.10 || hue >= 0.85) return 'thermal';// thermal red/orange
  if (hue > 0.10 && hue <= 0.20) return 'arid';   // dry desert/soil
  return 'cloud';
}

interface TerrainAudio {
  oscType: OscillatorType;
  filterType: BiquadFilterType;
  filterBias: number;
}

const TERRAIN_AUDIO: Record<TerrainType, TerrainAudio> = {
  ocean:   { oscType: 'sine',     filterType: 'lowpass',  filterBias: 0.65 },
  forest:  { oscType: 'triangle', filterType: 'lowpass',  filterBias: 1.15 },
  thermal: { oscType: 'triangle', filterType: 'bandpass', filterBias: 1.35 },
  arid:    { oscType: 'triangle', filterType: 'bandpass', filterBias: 1.00 },
  cloud:   { oscType: 'sine',     filterType: 'lowpass',  filterBias: 0.85 },
};

export class EarthJukeboxAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Synthesizer voices
  private pulseVoice: FeaturePulseVoice | null = null;
  private leadVoice: LeadVoice | null = null;
  private percussionVoice: PercussionVoice | null = null;
  private noiseVoice: TextureNoiseVoice | null = null;

  // Adaptive auto-ranger
  private autoRanger = new DynamicAutoRanger(0.04, 0.12);

  // State
  private isRunning = false;
  private isMuted = false;
  private masterVolume = 1.0;
  private currentMode: SonificationMode = 'scientific';
  private activeProfile: PresetAudioProfile = PRESET_AUDIO_PROFILES['gedi-forest-height'];
  private smoother = new FrameMetricsSmoother(220);

  private lastPulseTime = 0;
  private eventsTriggeredCount = 0;
  private lastTelemetry: AudioTelemetry = {
    leadFrequency: 220,
    leadGain: 0,
    pan: 0,
    filterCutoff: 1200,
    activeVoices: 0,
    eventsTriggered: 0,
    mode: 'scientific',
    vizId: 'gedi-forest-height'
  };

  // Event listener references for cleanup
  private frameListener: ((e: CustomEvent<EjbFramePayload>) => void) | null = null;
  private readyListener: ((e: CustomEvent<EjbReadyPayload>) => void) | null = null;
  private stateListener: ((e: CustomEvent<EjbStatePayload>) => void) | null = null;
  private errorListener: ((e: CustomEvent<EjbErrorPayload>) => void) | null = null;

  constructor(options: AudioEngineOptions = {}) {
    if (options.mode) this.currentMode = options.mode;
    if (options.masterVolume !== undefined) this.masterVolume = options.masterVolume;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.ensureAudioContext();

    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isRunning = true;
    this.attachEventListeners();

    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
      } catch {}
    }

    console.log(`[Audio Engine] Earth Jukebox Sonification started (Mode: ${this.currentMode}).`);
  }

  pause(): void {
    this.isRunning = false;
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(0, now);
    } catch {}
    this.leadVoice?.fadeTo(0, 0.005);
    this.noiseVoice?.fadeTo(0, 0.005);
    if (this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume(): void {
    if (!this.isRunning) return;
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    const now = this.ctx.currentTime;
    try {
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, now, 0.05);
    } catch {}
  }

  stop(): void {
    this.isRunning = false;
    this.pause();
    this.detachEventListeners();
    console.log('[Audio Engine] Earth Jukebox Sonification stopped.');
  }

  setMode(mode: SonificationMode): void {
    this.currentMode = mode;
    this.lastTelemetry.mode = mode;

    window.dispatchEvent(
      new CustomEvent<EjbControlPayload>('ejb:control', {
        detail: { mode },
        bubbles: true,
        composed: true
      })
    );
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, volume));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.ctx && this.masterGain) {
      const targetGain = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
    }
  }

  setPreset(vizId: string): void {
    this.activeProfile = getAudioProfile(vizId);
    this.autoRanger.reset();
    if (this.leadVoice) {
      this.leadVoice.setOscillatorType(this.activeProfile.oscillatorType);
      this.leadVoice.setFilterType(this.activeProfile.filterType);
    }
    this.lastTelemetry.vizId = vizId;
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  getTelemetry(): AudioTelemetry {
    return { ...this.lastTelemetry };
  }

  /**
   * Processes each video frame in real time.
   * Directly synchronizes acoustic notes, stereo movement, and pitch to what is visible on screen.
   */
  processFrame(payload: EjbFramePayload): void {
    if (!this.isRunning || this.isMuted || !this.ctx || this.ctx.state !== 'running' || !this.leadVoice || !this.pulseVoice || !this.noiseVoice) {
      return;
    }

    const { metrics, flags, events, layers, profile, vizId } = payload;
    if (vizId && vizId !== this.activeProfile.id) {
      this.setPreset(vizId);
    }

    const bypassSmoothing = flags.seeked || flags.scene_cut;
    if (bypassSmoothing) {
      this.autoRanger.reset();
    }

    // ── 1. Spatial Distribution & Active Feature Hotspot ──────────────────
    const hasData = Boolean(metrics.dataValue !== null);
    const spatial = calculateSpatialDistribution(metrics.regions, hasData);
    const hotspot = findActiveHotspot(metrics.regions, hasData);

    const frameAvgValue = metrics.dataValue !== null
      ? metrics.dataValue
      : Math.min(1.0, Math.max(0.0, metrics.brightness * 0.7 + metrics.saturation * 0.3));

    // Prominent feature value: focus on the active peak, fallback to average
    const rawFeatureValue = hotspot.contrast > 0.04
      ? hotspot.value * 0.70 + frameAvgValue * 0.30
      : frameAvgValue;

    // Expand narrow video variations into the full acoustic scale
    const autoRangedValue = this.autoRanger.process(rawFeatureValue, bypassSmoothing);
    const terrain = classifyTerrain(metrics.hue, metrics.saturation);
    const terrainAudio = TERRAIN_AUDIO[terrain];

    // ── 2. Pitch Selection (Calibrated to Physical Measurement) ───────────
    let targetFrequency: number;
    if (this.currentMode === 'artistic') {
      const rootMidi = 48 + Math.floor(metrics.hue * 12);
      targetFrequency = quantizeToScale(
        autoRangedValue,
        this.activeProfile.preferredScale,
        rootMidi,
        2.5
      );
    } else {
      // Scientific mode: continuous 1:1 physical frequency mapping
      targetFrequency = mapContinuousFrequency(
        autoRangedValue,
        this.activeProfile.baseFrequency,
        this.activeProfile.maxFrequency,
        'log'
      );
    }

    // ── 3. Stereo Panning (Feature Horizontal Position) ───────────────────
    // Directly follows the active feature across screen: West (-0.85) to East (+0.85)
    const targetPan = hotspot.pan * 0.85 + spatial.pan * 0.15;

    // ── 4. RHYTHMIC NOTE ONSET (The Primary Expressive Musical Voice) ──────
    // Generates articulate, clean acoustic notes synchronized with frame presentation
    const now = this.ctx.currentTime;
    // Rhythm adapts to video motion: calm scenes = spacious (~3 notes/s); motion = active (~5 notes/s)
    const pulseInterval = Math.max(0.16, 0.34 - metrics.motion * 0.22);

    if (now - this.lastPulseTime >= pulseInterval || bypassSmoothing) {
      // Note velocity reflects visual luminance and feature prominence at maximum audio presence
      const pulseVelocity = Math.max(0.60, Math.min(1.0, 0.70 + metrics.brightness * 0.30));
      // Organic decay time (generous resonance for full, rich acoustic sound)
      const decayDuration = terrain === 'ocean' ? 0.42 : (terrain === 'forest' ? 0.32 : 0.36);

      this.pulseVoice.trigger(
        targetFrequency,
        pulseVelocity,
        targetPan,
        terrainAudio.oscType,
        decayDuration
      );
      this.lastPulseTime = now;
    }

    // ── 5. Gentle Harmonic Bed (LeadVoice) ─────────────────────────────────
    // Soft, warm background presence that smoothly glides with the feature
    // Keeps sound organic between note pulses without droning or buzzing
    const dataDrivenCutoff =
      this.activeProfile.baseCutoff +
      autoRangedValue * (this.activeProfile.maxCutoff - this.activeProfile.baseCutoff);
    const targetCutoff = Math.min(
      this.activeProfile.maxCutoff,
      dataDrivenCutoff * terrainAudio.filterBias + metrics.motion * 800
    );

    const targetLeadGain = Math.max(0.35, Math.min(0.80, 0.45 + metrics.brightness * 0.35));

    const smoothedFreq   = this.smoother.frequency.step(targetFrequency, bypassSmoothing);
    const smoothedGain   = this.smoother.gain.step(targetLeadGain, bypassSmoothing);
    const smoothedPan    = this.smoother.pan.step(targetPan, bypassSmoothing);
    const smoothedCutoff = this.smoother.filterCutoff.step(targetCutoff, bypassSmoothing);

    this.leadVoice.setOscillatorType(terrainAudio.oscType);
    this.leadVoice.setFilterType(terrainAudio.filterType);
    this.leadVoice.update(
      smoothedFreq,
      smoothedGain,
      smoothedPan,
      smoothedCutoff,
      1.5,
      0.05,
      bypassSmoothing
    );

    // ── 6. Fluid Motion Texture (NoiseVoice on Elevated Motion) ────────────
    if (metrics.motion > 0.12) {
      this.noiseVoice.update(
        metrics.motion * 0.40,
        metrics.motion,
        targetPan * 0.5,
        layers,
        0.08
      );
    } else {
      this.noiseVoice.fadeTo(0, 0.08);
    }

    // ── 7. Discrete Events (Percussion on Lightning / Flashes) ─────────────
    if (events && events.length > 0 && this.percussionVoice) {
      for (const evt of events) {
        this.percussionVoice.trigger(evt, this.masterVolume);
        this.eventsTriggeredCount++;
      }
    }

    // ── 8. Telemetry ─────────────────────────────────────────────────────
    this.lastTelemetry = {
      leadFrequency: Math.round(smoothedFreq),
      leadGain: parseFloat(smoothedGain.toFixed(3)),
      pan: parseFloat(smoothedPan.toFixed(3)),
      filterCutoff: Math.round(smoothedCutoff),
      activeVoices: 6,
      eventsTriggered: this.eventsTriggeredCount,
      mode: this.currentMode,
      vizId: this.activeProfile.id
    };
  }

  private async ensureAudioContext(): Promise<void> {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-4, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(2.5, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.pulseVoice = new FeaturePulseVoice(this.ctx, this.compressor);

    this.leadVoice = new LeadVoice(this.ctx, this.compressor);
    this.leadVoice.start();

    this.percussionVoice = new PercussionVoice(this.ctx, this.compressor);

    this.noiseVoice = new TextureNoiseVoice(this.ctx, this.compressor);
    this.noiseVoice.start();
  }

  private attachEventListeners(): void {
    if (typeof window === 'undefined') return;

    this.detachEventListeners();

    this.frameListener = (e: CustomEvent<EjbFramePayload>) => {
      if (this.isRunning && e.detail) {
        this.processFrame(e.detail);
      }
    };
    window.addEventListener('ejb:frame', this.frameListener as EventListener);

    this.readyListener = (e: CustomEvent<EjbReadyPayload>) => {
      if (e.detail && e.detail.vizId) {
        this.setPreset(e.detail.vizId);
      }
    };
    window.addEventListener('ejb:ready', this.readyListener as EventListener);

    this.stateListener = (e: CustomEvent<EjbStatePayload>) => {
      if (!e.detail) return;
      const { state } = e.detail;
      if (state === 'playing') {
        if (this.isRunning) {
          this.resume();
        }
      } else if (state === 'paused' || state === 'ended' || state === 'lost-media') {
        this.pause();
      } else if (state === 'seeked') {
        this.smoother.resetAll();
        this.autoRanger.reset();
      }
    };
    window.addEventListener('ejb:state', this.stateListener as EventListener);

    this.errorListener = (e: CustomEvent<EjbErrorPayload>) => {
      console.warn('[Audio Engine] Visual pipeline reported error:', e.detail);
      this.pause();
    };
    window.addEventListener('ejb:error', this.errorListener as EventListener);
  }

  private detachEventListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.frameListener) {
      window.removeEventListener('ejb:frame', this.frameListener as EventListener);
      this.frameListener = null;
    }
    if (this.readyListener) {
      window.removeEventListener('ejb:ready', this.readyListener as EventListener);
      this.readyListener = null;
    }
    if (this.stateListener) {
      window.removeEventListener('ejb:state', this.stateListener as EventListener);
      this.stateListener = null;
    }
    if (this.errorListener) {
      window.removeEventListener('ejb:error', this.errorListener as EventListener);
      this.errorListener = null;
    }
  }

  destroy(): void {
    this.stop();
    this.pulseVoice?.dispose();
    this.leadVoice?.dispose();
    this.noiseVoice?.dispose();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}
