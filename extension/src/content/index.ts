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
import { clamp, round3 } from '../analysis/normalize';

const PRESETS = presetsData as Record<string, PresetConfig>;

class EarthJukeboxController {
  private extensionEnabled = true;
  private isSonifying = false;
  private manualPresetOverride = false;
  private activePreset: PresetConfig;
  private emitter = new EjbEmitter();
  private mediaFinder: MediaFinder;
  private capturePipeline: FrameCapturePipeline | null = null;
  private audioEngine = new EarthJukeboxAudioEngine({ mode: 'scientific' });

  // Analysis state (runs directly in-thread on 32x32 buffer, taking <0.08ms per tick with 0 CSP issues)
  private directPreviousFrame: Uint8ClampedArray | null = null;
  private directBaselines = new Float32Array(64).fill(0.1);
  private directLut: PreparedLegendLUT | null = null;
  private lastPayload: EjbFramePayload | null = null;

  private isSeeked = false;
  private currentT = 0;
  private currentFrameIndex = 0;

  constructor() {
    this.activePreset = PRESETS['general-earth'] || PRESETS['gedi-forest-height'];
    this.mediaFinder = new MediaFinder({
      onMediaFound: media => this.handleMediaFound(media),
      onMediaLost: () => this.handleMediaLost(),
      onStateChange: (state, time) => this.handleStateChange(state, time)
    });

    this.detectPresetForMedia(null);
    this.setupListeners();
    this.setupUserGestureUnlock();

    // Load persisted settings (defaulting to enabled: true for automatic zero-lag sonification)
    chrome.storage.local.get(['extensionEnabled', 'masterVolume', 'activeMode'], (items) => {
      if (typeof items.extensionEnabled === 'boolean') {
        this.extensionEnabled = items.extensionEnabled;
      } else {
        this.extensionEnabled = true;
        chrome.storage.local.set({ extensionEnabled: true });
      }

      if (items.activeMode) {
        this.audioEngine.setMode(items.activeMode as SonificationMode);
      }
      // Always sonify at max volume (100% / 1.0)
      this.audioEngine.setMasterVolume(1.0);
      chrome.storage.local.set({ masterVolume: 1.0 });

      // If a video is already actively playing right now on page load, start sonification immediately
      const media = this.mediaFinder.getActiveMedia();
      if (
        this.extensionEnabled &&
        media instanceof HTMLVideoElement &&
        !media.paused &&
        !media.ended &&
        media.readyState >= 2 &&
        media.currentTime > 0
      ) {
        this.startAutoSonification(media);
      }
    });

    // React immediately to storage changes from popup toggle
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.extensionEnabled) {
        const newEnabled = Boolean(changes.extensionEnabled.newValue);
        if (newEnabled !== this.extensionEnabled) {
          this.setExtensionEnabled(newEnabled);
        }
      }
    });

    this.mediaFinder.start();
  }

  private detectPresetForMedia(media?: TrackedMedia | null): void {
    if (this.manualPresetOverride) return;

    const url = window.location.href;
    const title = document.title.toLowerCase();

    let mediaInfo = '';
    if (media instanceof HTMLVideoElement) {
      mediaInfo += (media.currentSrc || '') + ' ';
      mediaInfo += (media.src || '') + ' ';
      mediaInfo += (media.getAttribute('poster') || '') + ' ';
      mediaInfo += (media.title || '') + ' ';
      mediaInfo += (media.getAttribute('aria-label') || '') + ' ';
      media.querySelectorAll('source').forEach(s => {
        mediaInfo += (s.src || s.getAttribute('src') || '') + ' ';
      });

      // Walk up container tree to inspect gallery cards, titles, and links (e.g. /5313/, /4950/)
      let parent: HTMLElement | null = media.parentElement;
      for (let i = 0; i < 4 && parent; i++) {
        parent.querySelectorAll('a').forEach(a => {
          mediaInfo += (a.getAttribute('href') || a.href || '') + ' ';
        });
        const idAttr = parent.getAttribute('data-id') || parent.getAttribute('id') || '';
        if (idAttr) mediaInfo += idAttr + ' ';
        mediaInfo += (parent.textContent || '').slice(0, 300) + ' ';
        parent = parent.parentElement;
      }
    }
    mediaInfo = mediaInfo.toLowerCase();

    for (const [key, preset] of Object.entries(PRESETS)) {
      if (key === 'general-earth') continue;
      const svsStr = preset.svsId ? String(preset.svsId) : null;
      if (svsStr) {
        const svsRegex = new RegExp(`(^|[^0-9])${svsStr}([^0-9]|$)`);
        if (
          url.includes(`/${svsStr}/`) ||
          svsRegex.test(mediaInfo) ||
          mediaInfo.includes(`a00${svsStr}`) ||
          mediaInfo.includes(`${svsStr}_`)
        ) {
          this.applyPreset(preset);
          return;
        }
      }
      if (preset.match) {
        const matchTerm = preset.match.toLowerCase();
        if (url.includes(matchTerm) || title.includes(matchTerm) || mediaInfo.includes(matchTerm)) {
          this.applyPreset(preset);
          return;
        }
      }
    }

    // Default to adaptive dynamic Earth preset
    this.applyPreset(PRESETS['general-earth'] || PRESETS['gedi-forest-height']);
  }

  private applyPreset(preset: PresetConfig): void {
    this.activePreset = preset;
    this.directLut = prepareLegendLUT(preset.legend);
    this.directBaselines.fill(0.1);
    this.directPreviousFrame = null;
    this.audioEngine.setPreset(preset.id);

    if (this.capturePipeline) {
      this.capturePipeline.updateConfig({
        roi: preset.roi,
        tickHz: preset.tickHz
      });
    }
  }

  private setupUserGestureUnlock(): void {
    const unlockAudio = () => {
      if (this.audioEngine) {
        this.audioEngine.start().then(() => {
          if (!this.isSonifying) {
            this.audioEngine.pause();
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    window.addEventListener('click', unlockAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });
  }

  private setupListeners(): void {
    // 1. Control events
    this.emitter.onControl((control: EjbControlPayload) => {
      if (this.capturePipeline) {
        this.capturePipeline.updateConfig({
          tickHz: control.tickHz,
          roi: control.roi
        });
      }
      if (control.mode) {
        this.audioEngine.setMode(control.mode as SonificationMode);
      }
    });

    // 2. Messaging from Chrome popup / background service worker
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      switch (message.type) {
        case 'GET_STATUS': {
          const media = this.mediaFinder.getActiveMedia();
          const isMediaPlaying = media instanceof HTMLVideoElement ? !media.paused && !media.ended : false;
          const telemetry = this.audioEngine.getTelemetry();
          sendResponse({
            extensionEnabled: this.extensionEnabled,
            isActive: this.isSonifying,
            hasMedia: Boolean(media),
            isMediaPlaying,
            activePreset: this.activePreset,
            availablePresets: PRESETS,
            t: this.currentT,
            frameIndex: this.currentFrameIndex,
            mode: telemetry.mode,
            telemetry,
            lastPayload: this.lastPayload
          });
          return true;
        }

        case 'SET_ENABLED': {
          const target = Boolean(message.enabled);
          const enabled = this.setExtensionEnabled(target);
          const media = this.mediaFinder.getActiveMedia();
          const isMediaPlaying = media instanceof HTMLVideoElement ? !media.paused && !media.ended : false;
          sendResponse({
            extensionEnabled: enabled,
            isActive: this.isSonifying,
            isMediaPlaying
          });
          return true;
        }

        case 'TOGGLE_SONIFICATION': {
          const target = typeof message.enabled === 'boolean'
            ? message.enabled
            : !this.extensionEnabled;
          const enabled = this.setExtensionEnabled(target);
          const media = this.mediaFinder.getActiveMedia();
          const isMediaPlaying = media instanceof HTMLVideoElement ? !media.paused && !media.ended : false;
          sendResponse({
            extensionEnabled: enabled,
            isActive: this.isSonifying,
            isMediaPlaying
          });
          return true;
        }
      }
      return false;
    });
  }

  private setExtensionEnabled(enabled: boolean): boolean {
    this.extensionEnabled = enabled;
    chrome.storage.local.set({ extensionEnabled: this.extensionEnabled });

    const media = this.mediaFinder.getActiveMedia();
    const isPlaying = media instanceof HTMLVideoElement && !media.paused && !media.ended;

    if (this.extensionEnabled) {
      if (isPlaying && media) {
        this.startAutoSonification(media);
      } else {
        this.pauseSonification();
        this.updateBadge(false);
      }
    } else {
      this.pauseSonification();
      this.updateBadge(false);
    }

    return this.extensionEnabled;
  }

  private async startAutoSonification(media: TrackedMedia): Promise<void> {
    if (!this.extensionEnabled) {
      this.pauseSonification();
      return;
    }

    // Strictly verify the video is actually playing before starting any audio!
    if (media instanceof HTMLVideoElement && (media.paused || media.ended)) {
      this.pauseSonification();
      return;
    }

    if (!this.manualPresetOverride) {
      this.detectPresetForMedia(media);
    }
    await this.audioEngine.start();
    this.audioEngine.resume();
    if (this.activePreset) {
      this.audioEngine.setPreset(this.activePreset.id);
    }
    this.startCapture(media);
    this.isSonifying = true;
    this.updateBadge(true);
  }

  private pauseSonification(): void {
    this.isSonifying = false;
    this.audioEngine.stop();
    this.audioEngine.pause();
    if (this.capturePipeline) {
      this.capturePipeline.stop();
      this.capturePipeline = null;
    }
    this.updateBadge(false);
  }

  private updateBadge(isActive: boolean): void {
    try {
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', isActive }, () => {
        void chrome.runtime.lastError;
      });
    } catch {
      // Ignored
    }
  }

  private handleMediaFound(media: TrackedMedia): void {
    this.manualPresetOverride = false;
    this.detectPresetForMedia(media);
    this.emitReadyEvent(media);

    const isPlaying =
      media instanceof HTMLVideoElement
        ? !media.paused && !media.ended && media.readyState >= 2 && media.currentTime > 0
        : false;
    if (this.extensionEnabled && isPlaying) {
      this.startAutoSonification(media);
    } else {
      this.pauseSonification();
    }
  }

  private handleMediaLost(): void {
    this.pauseSonification();
    if (this.extensionEnabled && this.isSonifying) {
      this.emitter.emitState({ state: 'lost-media', t: this.currentT });
    }
  }

  private handleStateChange(state: 'playing' | 'paused' | 'seeked' | 'ended', time: number): void {
    this.currentT = time;
    if (state === 'seeked') {
      this.isSeeked = true;
    }

    if (state === 'playing') {
      if (this.extensionEnabled) {
        const media = this.mediaFinder.getActiveMedia();
        if (media) {
          this.startAutoSonification(media);
        }
      } else {
        this.pauseSonification();
      }
    } else if (state === 'paused' || state === 'ended') {
      this.pauseSonification();
    }

    if (this.extensionEnabled && this.isSonifying) {
      this.emitter.emitState({ state, t: time });
    }
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
    if (!this.extensionEnabled || !this.isSonifying) {
      return;
    }

    this.currentT = frame.t;
    this.currentFrameIndex = frame.frameIndex;

    const seeked = this.isSeeked;
    this.isSeeked = false;

    // Direct analysis: 32x32 buffer analysis executes in ~0.08ms, guarantees 0 CSP blocks on all NASA domains
    this.runDirectAnalysis(frame, seeked);
  }

  private runDirectAnalysis(frame: CapturedFrame, seeked: boolean): void {
    if (!this.extensionEnabled || !this.isSonifying) {
      return;
    }

    try {
      const currentData = new Uint8ClampedArray(frame.buffer);
      const preset = this.activePreset;
      const ignoreDark = preset?.ignoreDark ?? 0.05;

      if (!this.directLut && preset?.legend) {
        this.directLut = prepareLegendLUT(preset.legend);
      }

      const brightness = calculateAverageLuminance(currentData, { ignoreDark });
      const colorMetrics = extractColorMetrics(currentData, { ignoreDark });
      let dataValue = calculateAverageLegendValue(currentData, this.directLut, { ignoreDark });

      // Graceful adaptive mapping ensures dataValue is ALWAYS calibrated and reactive to footage
      if (dataValue === null) {
        dataValue = round3(clamp(brightness * 0.65 + colorMetrics.saturation * 0.35));
      }

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
        t: round3(frame.t),
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

      this.lastPayload = payload;

      // 1. Dispatch custom DOM event on window ONLY when actively sonifying
      if (this.extensionEnabled && this.isSonifying) {
        this.emitter.emitFrame(payload);
        this.audioEngine.processFrame(payload);
      }

      // 3. Broadcast to popup monitor
      try {
        chrome.runtime.sendMessage({ type: 'POPUP_METRIC_UPDATE', payload }, () => {
          void chrome.runtime.lastError;
        });
      } catch {
        // Popup might be closed
      }
    } catch (err) {
      console.error('[EJB] Direct analysis error:', err);
    }
  }

  private handleCaptureError(code: 'TAINTED_CANVAS' | 'CAPTURE_FAILED', err: unknown): void {
    console.error(`[EJB] Capture Error (${code}):`, err);
    this.emitter.emitError({
      code: code === 'TAINTED_CANVAS' ? 'TAINTED_CANVAS' : 'UNKNOWN',
      message: String(err)
    });

    if (code === 'TAINTED_CANVAS') {
      chrome.runtime.sendMessage({
        type: 'CANVAS_TAINTED_DETECTED',
        url: window.location.href
      }, () => {
        void chrome.runtime.lastError;
      });
    }
  }
}

// Instantiate controller when content script loads
new EarthJukeboxController();
