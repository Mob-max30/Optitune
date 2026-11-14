/**
 * Earth Jukebox (EJB) — Sonification Audio Engine
 *
 * Authored by Pranav K for the NASA Space Apps Challenge 2026.
 *
 * Translates NASA EIC and SVS video visual metrics (Contract v1) into
 * synchronized multichannel sound in real time using the Web Audio API.
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
import { calculateSpatialDistribution } from './spatial';
import { LeadVoice } from './synths/base-voice';
import { BassVoice } from './synths/bass-voice';
import { PadVoice } from './synths/pad-voice';
import { PercussionVoice } from './synths/percussion';
import { TextureNoiseVoice } from './synths/noise-voice';
import { ScannerVoice } from './synths/scanner-voice';
import { TanpuraVoice } from './synths/tanpura-voice';
import { TablaVoice } from './synths/tabla-voice';
import { IndianMelodicVoice } from './synths/raaga-lead';
import { getRaagaForDataset, getTaalaForDataset } from './raagas';

export class EarthJukeboxAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Synthesizer voices
  private leadVoice: LeadVoice | null = null;
  private bassVoice: BassVoice | null = null;
  private padVoice: PadVoice | null = null;
  private percussionVoice: PercussionVoice | null = null;
  private noiseVoice: TextureNoiseVoice | null = null;
  private scannerVoice: ScannerVoice | null = null;

  // Classical Indian voices
  private tanpuraVoice: TanpuraVoice | null = null;
  private tablaVoice: TablaVoice | null = null;
  private raagaMelodicVoice: IndianMelodicVoice | null = null;

  // State
  private isRunning = false;
  private isMuted = false;
  private masterVolume = 0.8;
  private currentMode: SonificationMode = 'raaga';
  private activeProfile: PresetAudioProfile = PRESET_AUDIO_PROFILES['gedi-forest-height'];
  private smoother = new FrameMetricsSmoother(220);

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

  /**
   * Initializes the Web Audio graph and attaches listeners to window CustomEvents.
   * Safe to call on user click/gesture to satisfy browser autoplay policies.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.ensureAudioContext();

    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isRunning = true;
    this.attachEventListeners();

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }

    if (this.currentMode === 'scanner') {
      this.scannerVoice?.start();
    } else if (this.currentMode === 'raaga') {
      this.tanpuraVoice?.start();
      this.tablaVoice?.start();
    }

    console.log(`[Audio Engine] Earth Jukebox Sonification started (Mode: ${this.currentMode}).`);
  }

  /**
   * Smoothly fades out and pauses the audio context.
   */
  pause(): void {
    if (!this.isRunning || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(0, now, 0.04);
    this.leadVoice?.fadeTo(0, 0.04);
    this.padVoice?.fadeTo(0, 0.04);
    this.noiseVoice?.fadeTo(0, 0.04);
    this.scannerVoice?.stop();
    this.tanpuraVoice?.stop();
    this.tablaVoice?.stop();
  }

  /**
   * Smoothly resumes playback.
   */
  resume(): void {
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, now, 0.05);
    if (this.currentMode === 'scanner') {
      this.scannerVoice?.start();
    } else if (this.currentMode === 'raaga') {
      this.tanpuraVoice?.start();
      this.tablaVoice?.start();
    }
  }

  /**
   * Completely stops and disposes of the audio engine and event listeners.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.pause();
    this.isRunning = false;
    this.detachEventListeners();
    this.tanpuraVoice?.stop();
    this.tablaVoice?.stop();
    console.log('[Audio Engine] Earth Jukebox Sonification stopped.');
  }

  /**
   * Changes the active sonification mode ('raaga' | 'artistic' | 'scientific' | 'scanner').
   */
  setMode(mode: SonificationMode): void {
    this.currentMode = mode;
    this.lastTelemetry.mode = mode;

    if (mode === 'scanner') {
      this.leadVoice?.fadeTo(0, 0.05);
      this.padVoice?.fadeTo(0, 0.05);
      this.noiseVoice?.fadeTo(0, 0.05);
      this.tanpuraVoice?.stop();
      this.tablaVoice?.stop();
      this.raagaMelodicVoice?.silence();
      if (this.isRunning) {
        this.scannerVoice?.start();
      }
    } else if (mode === 'raaga') {
      this.scannerVoice?.stop();
      this.leadVoice?.fadeTo(0, 0.05);
      this.padVoice?.fadeTo(0, 0.05);
      this.noiseVoice?.fadeTo(0, 0.05);
      if (this.isRunning) {
        this.tanpuraVoice?.start();
        this.tablaVoice?.start();
      }
    } else {
      this.scannerVoice?.stop();
      this.tanpuraVoice?.stop();
      this.tablaVoice?.stop();
      this.raagaMelodicVoice?.silence();
    }

    // Notify visual pipeline of mode change if needed
    window.dispatchEvent(
      new CustomEvent<EjbControlPayload>('ejb:control', {
        detail: { mode },
        bubbles: true,
        composed: true
      })
    );
  }

  /**
   * Sets master audio output volume [0.0, 1.0].
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1.0, volume));
    if (this.ctx && this.masterGain && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Mutes or unmutes the audio output.
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.ctx && this.masterGain) {
      const targetGain = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Sets active visualization profile by ID.
   */
  setPreset(vizId: string): void {
    this.activeProfile = getAudioProfile(vizId);
    if (this.leadVoice) {
      this.leadVoice.setOscillatorType(this.activeProfile.oscillatorType);
      this.leadVoice.setFilterType(this.activeProfile.filterType);
    }
    const raaga = getRaagaForDataset(vizId);
    const taala = getTaalaForDataset(vizId);
    if (this.raagaMelodicVoice) {
      this.raagaMelodicVoice.setRaaga(raaga);
    }
    if (this.tablaVoice) {
      this.tablaVoice.setTaala(taala);
    }
    this.lastTelemetry.vizId = vizId;
    this.lastTelemetry.raagaName = raaga.name;
    this.lastTelemetry.taalaName = taala.name;
  }

  /**
   * Returns master AnalyserNode for external visualizers (waveforms/oscilloscopes).
   */
  getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Returns live audio telemetry for dashboards and debuggers.
   */
  getTelemetry(): AudioTelemetry {
    return { ...this.lastTelemetry };
  }

  /**
   * Processes a single visual frame payload (Contract v1).
   * Can be invoked directly or automatically via window "ejb:frame" CustomEvent.
   */
  processFrame(payload: EjbFramePayload): void {
    if (!this.isRunning || !this.ctx || !this.leadVoice || !this.padVoice || !this.noiseVoice) {
      return;
    }

    const { metrics, flags, events, layers, profile, vizId } = payload;
    if (vizId && vizId !== this.activeProfile.id) {
      this.setPreset(vizId);
    }

    const bypassSmoothing = flags.seeked || flags.scene_cut;

    // 1. Calculate spatial field from 4x8 regional matrix
    const spatial = calculateSpatialDistribution(metrics.regions, Boolean(metrics.dataValue !== null));

    // 2. Compute primary normalized scientific value [0.0, 1.0]
    // Uses calibrated physical dataValue where available; falls back to dynamic brightness & saturation
    const primaryMetricValue = metrics.dataValue !== null
      ? metrics.dataValue
      : Math.min(1.0, Math.max(0.0, metrics.brightness * 0.7 + metrics.saturation * 0.3));

    // 3. Compute Target Frequency based on Active Mode
    let targetFrequency = 220;
    const activeVizId = vizId || this.activeProfile.id;
    const raaga = getRaagaForDataset(activeVizId);
    const taala = getTaalaForDataset(activeVizId);
    // Dynamic Root Sa across the 12 chromatic pitches based on dominant color hue!
    const semitone = Math.round(metrics.hue * 11) % 12;
    const rootMidi = 48 + semitone;
    let currentSwaraName: string | undefined = undefined;

    if (this.currentMode === 'raaga') {
      // 1. Classical Indian Tanpura Drone (Sa-Pa fundamental acoustic resonance)
      if (this.tanpuraVoice) {
        this.tanpuraVoice.setRootMidi(rootMidi, raaga.swaras.includes('M') && !raaga.swaras.includes('P'));
        this.tanpuraVoice.setGain(0.24 + metrics.brightness * 0.12);
      }

      // 2. Classical Indian Tabla Rhythm Section (Authentic Theka & Dynamic Laya)
      if (this.tablaVoice) {
        this.tablaVoice.setTaala(taala);
        this.tablaVoice.setRootMidi(rootMidi);
        this.tablaVoice.setDynamicTempo(metrics.motion, (metrics.motion * 2));
        this.tablaVoice.setGain(0.30 + metrics.brightness * 0.16);

        // Flash / Lightning bursts trigger instantaneous heavy Tabla "Dha" strike
        if (events && events.length > 0) {
          for (const evt of events) {
            this.tablaVoice.triggerBol('Dha', evt.intensity);
          }
        }
      }

      // 3. Classical Indian Melodic Swara Voice (Bansuri / Sitar with Meend glides)
      if (this.raagaMelodicVoice) {
        this.raagaMelodicVoice.setRaaga(raaga);
        this.raagaMelodicVoice.setRootMidi(rootMidi);
        const melGain = Math.max(0.15, Math.min(0.65, 0.22 + metrics.brightness * 0.40));
        const swaraResult = this.raagaMelodicVoice.update(
          primaryMetricValue,
          melGain,
          spatial.pan,
          metrics.motion
        );
        targetFrequency = swaraResult.frequency;
        currentSwaraName = swaraResult.swara;
      }
    } else if (this.currentMode === 'scientific') {
      // Continuous scientific frequency mapping (C3 to D5)
      targetFrequency = mapContinuousFrequency(
        primaryMetricValue,
        this.activeProfile.baseFrequency,
        this.activeProfile.maxFrequency,
        'log'
      );
      // Modulate frequency with hue so color temperature distinctly alters acoustic pitch in real-time
      targetFrequency = targetFrequency * (0.8 + metrics.hue * 0.4);
    } else if (this.currentMode === 'artistic') {
      // Harmonically quantized to scale, root note shifting with hue
      targetFrequency = quantizeToScale(
        primaryMetricValue,
        this.activeProfile.preferredScale,
        rootMidi,
        2.5
      );
    } else if (this.currentMode === 'scanner') {
      // Pass spatial profiles to Scanner Voice
      this.scannerVoice?.updateProfile(profile);
      return; // Scanner voice owns its audio loop
    }

    // Adapt oscillator timbre in real time to match video color temperature
    if (this.leadVoice) {
      if (metrics.hue < 0.15 || metrics.hue > 0.90) {
        this.leadVoice.setOscillatorType('sawtooth');
      } else if (metrics.hue >= 0.50 && metrics.hue <= 0.75) {
        this.leadVoice.setOscillatorType('sine');
      } else {
        this.leadVoice.setOscillatorType(this.activeProfile.oscillatorType);
      }
    }

    // 4. Compute Filter Cutoff Frequency (opens up with motion and high brightness)
    const targetCutoff = this.activeProfile.baseCutoff +
      (metrics.motion * 0.7 + metrics.brightness * 0.3) *
      (this.activeProfile.maxCutoff - this.activeProfile.baseCutoff);

    // 5. Smooth parameters to eliminate zipper noise and clicks
    const smoothedFreq = this.smoother.frequency.step(targetFrequency, bypassSmoothing);
    const targetGain = Math.max(0.05, Math.min(0.65, 0.15 + metrics.brightness * 0.45));
    const smoothedGain = this.smoother.gain.step(targetGain, bypassSmoothing);
    const smoothedPan = this.smoother.pan.step(spatial.pan, bypassSmoothing);
    const smoothedCutoff = this.smoother.filterCutoff.step(targetCutoff, bypassSmoothing);

    // 6. Update Primary Lead Voice (Silent in Raaga mode as IndianMelodicVoice takes lead)
    const effectiveLeadGain = this.currentMode === 'raaga' ? 0.0 : smoothedGain;
    this.leadVoice.update(
      smoothedFreq,
      effectiveLeadGain,
      smoothedPan,
      smoothedCutoff,
      2.0,
      0.05,
      bypassSmoothing,
      this.currentMode === 'artistic'
    );

    // 6b. Update Sub-Bass Anchor Voice (35 Hz - 150 Hz physical foundation)
    if (this.bassVoice) {
      const bassFreq = mapContinuousFrequency(
        primaryMetricValue,
        Math.max(35, this.activeProfile.baseFrequency * 0.5),
        Math.min(150, this.activeProfile.baseFrequency),
        'log'
      );
      const bassGain = Math.max(0.12, Math.min(0.50, 0.20 + metrics.brightness * 0.28));
      const bassCutoff = 110 + metrics.motion * 250;
      this.bassVoice.update(bassFreq, bassGain, bassCutoff, 0.08);

      if (metrics.motion > 0.15 || (events && events.length > 0)) {
        this.bassVoice.pulse(bassFreq, 0.42, 0.3);
      }
    }

    // 7. Update Regional Ambient Pad (4 latitudinal rows) - silenced in Raaga mode to maintain acoustic purity
    if (this.currentMode !== 'raaga') {
      const padPresence = 0.1 + metrics.brightness * 0.4;
      this.padVoice.update(
        spatial.rowEnergies,
        metrics.hue,
        padPresence,
        0.08
      );
    } else {
      this.padVoice.update([0, 0, 0, 0], metrics.hue, 0.0, 0.05);
    }

    // 8. Update Texture / Aerosol Noise Voice - silenced in Raaga mode to maintain acoustic purity
    if (this.currentMode !== 'raaga') {
      const noiseIntensity = metrics.motion > 0.05 || (layers && Object.keys(layers).length > 0)
        ? metrics.motion * 0.8
        : 0.0;
      this.noiseVoice.update(
        noiseIntensity,
        metrics.motion,
        spatial.pan * 0.5,
        layers,
        0.08
      );
    } else {
      this.noiseVoice.update(0.0, 0.0, 0.0, undefined, 0.05);
    }

    // 9. Trigger Discrete Percussion Hits (Flashes / Lightning)
    if (events && events.length > 0 && this.percussionVoice) {
      for (const evt of events) {
        this.percussionVoice.trigger(evt, this.masterVolume);
        this.eventsTriggeredCount++;
      }
    }

    // 10. Record Telemetry
    this.lastTelemetry = {
      leadFrequency: Math.round(smoothedFreq),
      leadGain: parseFloat(smoothedGain.toFixed(3)),
      pan: parseFloat(smoothedPan.toFixed(3)),
      filterCutoff: Math.round(smoothedCutoff),
      activeVoices: this.currentMode === 'raaga' ? 7 : 6, // Tanpura (4) + Tabla (2) + Lead (1)
      eventsTriggered: this.eventsTriggeredCount,
      mode: this.currentMode,
      vizId: activeVizId,
      raagaName: raaga.name,
      taalaName: taala.name,
      currentSwara: currentSwaraName
    };
  }

  // -----------------------------------------------------------
  // Internal Graph Initialization & Event Plumbing
  // -----------------------------------------------------------
  private async ensureAudioContext(): Promise<void> {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master bus
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    // Route: Compressor -> Master Gain -> Analyser -> Output Destination
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Instantiate all voice nodes feeding into compressor
    this.leadVoice = new LeadVoice(this.ctx, this.compressor);
    this.leadVoice.start();

    this.bassVoice = new BassVoice(this.ctx, this.compressor);
    this.bassVoice.start();

    this.padVoice = new PadVoice(this.ctx, this.compressor);
    this.padVoice.start();

    this.percussionVoice = new PercussionVoice(this.ctx, this.compressor);

    this.noiseVoice = new TextureNoiseVoice(this.ctx, this.compressor);
    this.noiseVoice.start();

    this.scannerVoice = new ScannerVoice(this.ctx, this.compressor);

    // Classical Indian voices
    this.tanpuraVoice = new TanpuraVoice(this.ctx, this.compressor);
    this.tablaVoice = new TablaVoice(this.ctx, this.compressor);
    this.raagaMelodicVoice = new IndianMelodicVoice(this.ctx, this.compressor);
    this.raagaMelodicVoice.start();
  }

  private attachEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Listen to ejb:frame
    this.frameListener = (e: CustomEvent<EjbFramePayload>) => {
      if (e.detail) {
        this.processFrame(e.detail);
      }
    };
    window.addEventListener('ejb:frame', this.frameListener as EventListener);

    // Listen to ejb:ready
    this.readyListener = (e: CustomEvent<EjbReadyPayload>) => {
      if (e.detail && e.detail.vizId) {
        this.setPreset(e.detail.vizId);
      }
    };
    window.addEventListener('ejb:ready', this.readyListener as EventListener);

    // Listen to ejb:state
    this.stateListener = (e: CustomEvent<EjbStatePayload>) => {
      if (!e.detail) return;
      const { state } = e.detail;
      if (state === 'playing') {
        this.resume();
      } else if (state === 'paused' || state === 'ended' || state === 'lost-media') {
        this.pause();
      } else if (state === 'seeked') {
        this.smoother.resetAll();
      }
    };
    window.addEventListener('ejb:state', this.stateListener as EventListener);

    // Listen to ejb:error
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
    this.leadVoice?.dispose();
    this.bassVoice?.dispose();
    this.padVoice?.dispose();
    this.noiseVoice?.dispose();
    this.scannerVoice?.dispose();
    this.tanpuraVoice?.dispose();
    this.tablaVoice?.dispose();
    this.raagaMelodicVoice?.dispose();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
  }
}
