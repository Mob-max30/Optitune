import { MediaFinder, type TrackedMedia } from './media-finder';
import { FrameCapturePipeline, type CapturedFrame } from './capture';
import { EjbEmitter } from './emitter';
import type { PresetConfig, EjbReadyPayload, EjbFramePayload, EjbControlPayload } from '../contract/types';
import presetsData from '../presets/visualizations.json';
import { calculateAverageLuminance } from '../analysis/luminance';
import { extractColorMetrics } from '../analysis/color';
import { prepareLegendLUT, calculateAverageLegendValue, type PreparedLegendLUT } from '../analysis/legend';
import { calculateRegionGrid, calculateSpatialProfiles } from '../analysis/regions';
import { calculateMotionAndEvents } from '../analysis/motion';
import { EarthJukeboxAudioEngine, type SonificationMode } from '../audio';

const PRESETS = presetsData as Record<string, PresetConfig>;

class EarthJukeboxController {
  private isSonifying = false;
  private activePreset: PresetConfig | null = null;
  private emitter = new EjbEmitter();
  private mediaFinder: MediaFinder;
  private capturePipeline: FrameCapturePipeline | null = null;
  private worker: Worker | null = null;
  private audioEngine = new EarthJukeboxAudioEngine();

  // Fallback direct analysis state if worker is unavailable under strict page CSP
  private useDirectAnalysis = false;
  private directPreviousFrame: Uint8ClampedArray | null = null;
  private directBaselines = new Float32Array(64).fill(0.1);
  private directLut: PreparedLegendLUT | null = null;

  private isSeeked = false;
  private currentT = 0;
  private currentFrameIndex = 0;

  constructor() {
    this.mediaFinder = new MediaFinder({
      onMediaFound: media => this.handleMediaFound(media),
      onMediaLost: () => this.handleMediaLost(),
      onStateChange: (state, time) => this.handleStateChange(state, time)
    });

    this.detectPreset();
    this.initWorker();
    this.setupListeners();
    this.mediaFinder.start();
  }

  private detectPreset(): void {
    const url = window.location.href;
    const title = document.title.toLowerCase();

    for (const [key, preset] of Object.entries(PRESETS)) {
      if (preset.svsId && url.includes(`/${preset.svsId}/`)) {
        this.activePreset = preset;
        return;
      }
      if (preset.match && (url.includes(preset.match) || title.includes(preset.match.toLowerCase()))) {
        this.activePreset = preset;
        return;
      }
    }

    // Default to GEDI forest height if on NASA SVS or general EIC
    this.activePreset = PRESETS['gedi-forest-height'];
  }

  private initWorker(): void {
    try {
      // In Vite, analyzer.worker?worker&inline can be used, or Blob worker
      // We will check if Worker is supported
      if (typeof Worker !== 'undefined') {
        const workerUrl = chrome.runtime.getURL('analyzer.worker.js');
        this.worker = new Worker(workerUrl, { type: 'module' });

        this.worker.onmessage = (e: MessageEvent<{ type: string; payload: EjbFramePayload }>) => {
          if (e.data.type === 'FRAME_ANALYZED') {
            this.emitter.emitFrame(e.data.payload);
          }
        };

        this.worker.onerror = () => {
          console.warn('[EJB] Worker encountered CSP error, falling back to direct analysis');
          this.useDirectAnalysis = true;
          this.worker = null;
        };

        if (this.activePreset) {
          this.worker.postMessage({ type: 'INIT', preset: this.activePreset });
        }
      } else {
        this.useDirectAnalysis = true;
      }
    } catch {
      this.useDirectAnalysis = true;
    }
  }

  private setupListeners(): void {
    // 1. Control events from Pranav's synth
    this.emitter.onControl((control: EjbControlPayload) => {
      if (this.capturePipeline) {
        this.capturePipeline.updateConfig({
          tickHz: control.tickHz,
          roi: control.roi
        });
      }
    });

    // 2. Messaging from Chrome popup / background service worker
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'GET_STATUS': {
          const media = this.mediaFinder.getActiveMedia();
          const telemetry = this.audioEngine.getTelemetry();
          sendResponse({
            isActive: this.isSonifying,
            hasMedia: Boolean(media),
            activePreset: this.activePreset,
            availablePresets: PRESETS,
            t: this.currentT,
            frameIndex: this.currentFrameIndex,
            mode: telemetry.mode,
            telemetry
          });
          return true;
        }

        case 'TOGGLE_SONIFICATION': {
          this.setSonifying(!this.isSonifying);
          sendResponse({ isActive: this.isSonifying });
          return true;
        }

        case 'SET_MODE': {
          if (message.mode) {
            this.audioEngine.setMode(message.mode as SonificationMode);
            sendResponse({ success: true, mode: message.mode });
          }
          return true;
        }

        case 'SET_VOLUME': {
          if (typeof message.volume === 'number') {
            this.audioEngine.setMasterVolume(message.volume);
            sendResponse({ success: true, volume: message.volume });
          }
          return true;
        }

        case 'SELECT_PRESET': {
          const preset = PRESETS[message.presetId];
          if (preset) {
            this.activePreset = preset;
            this.audioEngine.setPreset(preset.id);
            if (this.capturePipeline) {
              this.capturePipeline.updateConfig({
                roi: preset.roi,
                tickHz: preset.tickHz
              });
            }
            if (this.worker) {
              this.worker.postMessage({ type: 'INIT', preset });
            } else {
              this.directLut = prepareLegendLUT(preset.legend);
              this.directBaselines.fill(0.1);
              this.directPreviousFrame = null;
            }

            const media = this.mediaFinder.getActiveMedia();
            if (media) {
              this.emitReadyEvent(media);
            }
          }
          sendResponse({ success: true, activePreset: this.activePreset });
          return true;
        }
      }
      return false;
    });
  }

  private setSonifying(active: boolean): void {
    this.isSonifying = active;
    const media = this.mediaFinder.getActiveMedia();

    if (this.isSonifying) {
      this.audioEngine.start();
      if (this.activePreset) {
        this.audioEngine.setPreset(this.activePreset.id);
      }
      if (media) {
        this.startCapture(media);
      } else {
        this.emitter.emitError({
          code: 'NO_MEDIA_FOUND',
          message: 'No active video or canvas element detected on the page'
        });
      }
    } else {
      this.audioEngine.pause();
      if (this.capturePipeline) {
        this.capturePipeline.stop();
      }
      this.emitter.emitState({ state: 'paused', t: this.currentT });
    }
  }

  private handleMediaFound(media: TrackedMedia): void {
    this.emitReadyEvent(media);
    if (this.isSonifying) {
      this.startCapture(media);
    }
  }

  private handleMediaLost(): void {
    this.audioEngine.pause();
    if (this.capturePipeline) {
      this.capturePipeline.stop();
    }
    this.emitter.emitState({ state: 'lost-media', t: this.currentT });
  }

  private handleStateChange(state: 'playing' | 'paused' | 'seeked' | 'ended', time: number): void {
    this.currentT = time;
    if (state === 'seeked') {
      this.isSeeked = true;
    }
    if (this.isSonifying) {
      if (state === 'playing') {
        this.audioEngine.resume();
      } else if (state === 'paused' || state === 'ended') {
        this.audioEngine.pause();
      }
    }
    this.emitter.emitState({ state, t: time });
  }

  private emitReadyEvent(media: TrackedMedia): void {
    const isVideo = media instanceof HTMLVideoElement;
    const width = isVideo ? media.videoWidth || media.clientWidth : media.width;
    const height = isVideo ? media.videoHeight || media.clientHeight : media.height;
    const duration = isVideo ? media.duration || 0 : 0;

    const readyPayload: EjbReadyPayload = {
      v: 1,
      vizId: this.activePreset?.id ?? 'custom',
      title: document.title || this.activePreset?.name || 'NASA Visualization',
      duration,
      width,
      height,
      preset: this.activePreset
    };

    this.emitter.emitReady(readyPayload);
  }

  private startCapture(media: TrackedMedia): void {
    if (this.capturePipeline) {
      this.capturePipeline.stop();
    }

    const roi = this.activePreset?.roi ?? [0, 0, 1, 1];
    const tickHz = this.activePreset?.tickHz ?? 12;

    this.capturePipeline = new FrameCapturePipeline(
      { roi, tickHz, width: 32, height: 32 },
      frame => this.handleFrameCaptured(frame),
      (code, err) => this.handleCaptureError(code, err)
    );

    this.capturePipeline.start(media);
  }

  private handleFrameCaptured(frame: CapturedFrame): void {
    this.currentT = frame.t;
    this.currentFrameIndex = frame.frameIndex;

    const seeked = this.isSeeked;
    this.isSeeked = false;

    if (this.worker && !this.useDirectAnalysis) {
      this.worker.postMessage(
        {
          type: 'ANALYZE_FRAME',
          buffer: frame.buffer,
          width: frame.width,
          height: frame.height,
          t: frame.t,
          frameIndex: frame.frameIndex,
          vizId: this.activePreset?.id ?? 'custom',
          preset: this.activePreset,
          seeked
        },
        [frame.buffer]
      );
    } else {
      // Fallback Direct Analysis (guaranteed to work even under strict CSP)
      this.runDirectAnalysis(frame, seeked);
    }
  }

  private runDirectAnalysis(frame: CapturedFrame, seeked: boolean): void {
    const currentData = new Uint8ClampedArray(frame.buffer);
    const preset = this.activePreset;
    const ignoreDark = preset?.ignoreDark ?? 0.05;

    if (!this.directLut && preset?.legend) {
      this.directLut = prepareLegendLUT(preset.legend);
    }

    const brightness = calculateAverageLuminance(currentData, { ignoreDark });
    const colorMetrics = extractColorMetrics(currentData, { ignoreDark });
    const dataValue = calculateAverageLegendValue(currentData, this.directLut);
    const regions = calculateRegionGrid(
      currentData,
      { rows: preset?.grid?.[0] ?? 4, cols: preset?.grid?.[1] ?? 8, width: frame.width, height: frame.height, ignoreDark },
      this.directLut
    );

    const motionResult = calculateMotionAndEvents(
      currentData,
      seeked ? null : this.directPreviousFrame,
      frame.width,
      frame.height,
      this.directBaselines,
      {
        detectEvents: preset?.events?.detect ?? null,
        eventThreshold: preset?.events?.threshold ?? 0.20,
        baselineAlpha: preset?.events?.baselineAlpha ?? 0.05
      }
    );

    const profile = calculateSpatialProfiles(currentData, frame.width, frame.height, 32);

    if (!this.directPreviousFrame || this.directPreviousFrame.length !== currentData.length) {
      this.directPreviousFrame = new Uint8ClampedArray(currentData);
    } else {
      this.directPreviousFrame.set(currentData);
    }

    const payload: EjbFramePayload = {
      v: 1,
      t: frame.t,
      frameIndex: frame.frameIndex,
      vizId: preset?.id ?? 'custom',
      metrics: {
        brightness,
        dominantColor: colorMetrics.dominantColor,
        hue: colorMetrics.hue,
        saturation: colorMetrics.saturation,
        dataValue,
        motion: seeked ? 0 : motionResult.motion,
        regions
      },
      flags: {
        seeked,
        scene_cut: motionResult.sceneCut
      },
      events: motionResult.events.length > 0 ? motionResult.events : undefined,
      profile
    };

    this.emitter.emitFrame(payload);
  }

  private handleCaptureError(code: 'TAINTED_CANVAS' | 'CAPTURE_FAILED', err: unknown): void {
    console.error(`[EJB] Capture Error (${code}):`, err);
    this.emitter.emitError({
      code: code === 'TAINTED_CANVAS' ? 'TAINTED_CANVAS' : 'UNKNOWN',
      message: String(err)
    });

    if (code === 'TAINTED_CANVAS') {
      // Notify background script that direct canvas access is tainted
      chrome.runtime.sendMessage({
        type: 'CANVAS_TAINTED_DETECTED',
        url: window.location.href
      });
    }
  }
}

// Instantiate controller when content script loads
new EarthJukeboxController();
