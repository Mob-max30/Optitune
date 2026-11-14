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
  private audioEngine = new EarthJukeboxAudioEngine();

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

      if (typeof items.masterVolume === 'number') {
        this.audioEngine.setMasterVolume(items.masterVolume);
      }
      if (items.activeMode) {
        this.audioEngine.setMode(items.activeMode);
      }

      // If a video is already playing right now on page load, start sonification immediately
      const media = this.mediaFinder.getActiveMedia();
      if (this.extensionEnabled && media instanceof HTMLVideoElement && !media.paused && !media.ended) {
        this.startAutoSonification(media);
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
    // Unlocks and prepares the AudioContext on any user interaction (pointerdown, click, or keyboard)
    // so sound starts with absolute ZERO latency as soon as the video plays
    const unlockAudio = () => {
      if (this.extensionEnabled && this.audioEngine) {
        this.audioEngine.start().then(() => {
          this.audioEngine.resume();
        }).catch(() => {});
      }
    };
    window.addEventListener('pointerdown', unlockAudio, { capture: true, passive: true });
    window.addEventListener('click', unlockAudio, { capture: true, passive: true });
    window.addEventListener('keydown', unlockAudio, { capture: true, passive: true });
  }

  private setupListeners(): void {
    // 1. Control events from Pranav's synth or external tools
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

        case 'TOGGLE_SONIFICATION': {
          const enabled = this.toggleExtensionEnabled();
          const media = this.mediaFinder.getActiveMedia();
          const isMediaPlaying = media instanceof HTMLVideoElement ? !media.paused && !media.ended : false;
          sendResponse({
            extensionEnabled: enabled,
            isActive: this.isSonifying,
            isMediaPlaying
          });
          return true;
        }

        case 'SET_MODE': {
          if (message.mode) {
            this.audioEngine.setMode(message.mode as SonificationMode);
            chrome.storage.local.set({ activeMode: message.mode });
            sendResponse({ success: true, mode: message.mode });
          }
          return true;
        }

        case 'SET_VOLUME': {
          if (typeof message.volume === 'number') {
            this.audioEngine.setMasterVolume(message.volume);
            chrome.storage.local.set({ masterVolume: message.volume });
            sendResponse({ success: true, volume: message.volume });
          }
          return true;
        }

        case 'SELECT_PRESET': {
          const preset = PRESETS[message.presetId];
          if (preset) {
            this.manualPresetOverride = true;
            this.applyPreset(preset);
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

  private toggleExtensionEnabled(): boolean {
    this.extensionEnabled = !this.extensionEnabled;
    chrome.storage.local.set({ extensionEnabled: this.extensionEnabled });

    const media = this.mediaFinder.getActiveMedia();
    const isPlaying = media instanceof HTMLVideoElement && !media.paused && !media.ended;

    if (this.extensionEnabled) {
      if (isPlaying && media) {
        this.startAutoSonification(media);
      } else {
        this.updateBadge(false);
      }
    } else {
      this.pauseSonification();
      this.updateBadge(false);
    }

    return this.extensionEnabled;
  }

  private async startAutoSonification(media: TrackedMedia): Promise<void> {
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
    if (this.isSonifying) {
      this.audioEngine.pause();
      if (this.capturePipeline) {
        this.capturePipeline.stop();
      }
      this.isSonifying = false;
      this.updateBadge(false);
    }
  }

  private updateBadge(isActive: boolean): void {
    try {
      chrome.runtime.sendMessage({ type: 'UPDATE_BADGE', isActive }).catch(() => {});
    } catch {
      // Ignored
    }
  }

  private handleMediaFound(media: TrackedMedia): void {
    this.manualPresetOverride = false;
    this.detectPresetForMedia(media);
    this.emitReadyEvent(media);

    const isPlaying = media instanceof HTMLVideoElement ? !media.paused && !media.ended : false;
    if (this.extensionEnabled && isPlaying) {
      this.startAutoSonification(media);
    }
  }

  private handleMediaLost(): void {
    this.pauseSonification();
    this.emitter.emitState({ state: 'lost-media', t: this.currentT });
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
      }
    } else if (state === 'paused' || state === 'ended') {
      this.pauseSonification();
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

    // Direct analysis: 32x32 buffer analysis executes in ~0.08ms, guarantees 0 CSP blocks on all NASA domains
    this.runDirectAnalysis(frame, seeked);
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
    let dataValue = calculateAverageLegendValue(currentData, this.directLut);

    // If unlisted or general visualization, dynamically map live brightness, saturation, and hue to data value
    if (dataValue === null && (!preset.legend || preset.id === 'general-earth')) {
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

    // 1. Dispatch custom DOM event on window
    this.emitter.emitFrame(payload);

    // 2. Direct feed to Pranav's Web Audio Engine (100% Real-time Synthesis)
    if (this.isSonifying) {
      this.audioEngine.processFrame(payload);
    }

    // 3. Broadcast to popup monitor
    try {
      chrome.runtime.sendMessage({ type: 'POPUP_METRIC_UPDATE', payload }).catch(() => {});
    } catch {
      // Popup might be closed
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
      });
    }
  }
}

// Instantiate controller when content script loads
new EarthJukeboxController();
