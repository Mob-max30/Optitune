import type { TrackedMedia } from './media-finder';

export interface CaptureOptions {
  width?: number;  // default: 32
  height?: number; // default: 32
  tickHz?: number; // default: 12
  roi?: [number, number, number, number]; // [x, y, w, h] in [0, 1]
}

export interface CapturedFrame {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  t: number;
  frameIndex: number;
}

export class FrameCapturePipeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private targetWidth: number;
  private targetHeight: number;
  private tickIntervalMs: number;
  private roi: [number, number, number, number];

  private isRunning = false;
  private frameCallbackId: number | null = null;
  private videoCallbackId: number | null = null;
  private currentMedia: TrackedMedia | null = null;
  private lastTickTime = 0;
  private frameCount = 0;

  private onFrameCaptured: (frame: CapturedFrame) => void;
  private onError: (code: 'TAINTED_CANVAS' | 'CAPTURE_FAILED', err: unknown) => void;

  constructor(
    options: CaptureOptions,
    onFrameCaptured: (frame: CapturedFrame) => void,
    onError: (code: 'TAINTED_CANVAS' | 'CAPTURE_FAILED', err: unknown) => void
  ) {
    this.targetWidth = options.width ?? 32;
    this.targetHeight = options.height ?? 32;
    this.tickIntervalMs = 1000 / (options.tickHz ?? 12);
    this.roi = options.roi ?? [0, 0, 1, 1];

    this.onFrameCaptured = onFrameCaptured;
    this.onError = onError;

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.targetWidth;
    this.canvas.height = this.targetHeight;

    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to initialize 2D canvas context with willReadFrequently');
    }
    this.ctx = context;
  }

  updateConfig(config: Partial<CaptureOptions>): void {
    if (config.tickHz) {
      this.tickIntervalMs = 1000 / config.tickHz;
    }
    if (config.roi) {
      this.roi = config.roi;
    }
    if (config.width || config.height) {
      this.targetWidth = config.width ?? this.targetWidth;
      this.targetHeight = config.height ?? this.targetHeight;
      this.canvas.width = this.targetWidth;
      this.canvas.height = this.targetHeight;
    }
  }

  start(media: TrackedMedia): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentMedia = media;
    this.scheduleNext(media);
  }

  stop(): void {
    this.isRunning = false;
    if (this.frameCallbackId !== null) {
      cancelAnimationFrame(this.frameCallbackId);
      this.frameCallbackId = null;
    }
    if (
      this.videoCallbackId !== null &&
      this.currentMedia instanceof HTMLVideoElement &&
      'cancelVideoFrameCallback' in this.currentMedia
    ) {
      try {
        (this.currentMedia as any).cancelVideoFrameCallback(this.videoCallbackId);
      } catch {}
      this.videoCallbackId = null;
    }
    this.currentMedia = null;
  }

  private scheduleNext(media: TrackedMedia): void {
    if (!this.isRunning) return;

    if (media instanceof HTMLVideoElement && 'requestVideoFrameCallback' in media) {
      this.videoCallbackId = (media as any).requestVideoFrameCallback((now: number, metadata: { mediaTime?: number }) => {
        if (!this.isRunning) return;
        this.processFrame(media, now, metadata.mediaTime ?? media.currentTime);
        this.scheduleNext(media);
      });
    } else {
      this.frameCallbackId = requestAnimationFrame((now: number) => {
        if (!this.isRunning) return;
        const mediaTime = media instanceof HTMLVideoElement ? media.currentTime : performance.now() / 1000;
        this.processFrame(media, now, mediaTime);
        this.scheduleNext(media);
      });
    }
  }

  private processFrame(media: TrackedMedia, now: number, mediaTime: number): void {
    if (now - this.lastTickTime < this.tickIntervalMs) {
      return;
    }
    this.lastTickTime = now;

    let sourceWidth = 0;
    let sourceHeight = 0;

    if (media instanceof HTMLVideoElement) {
      sourceWidth = media.videoWidth > 0 ? media.videoWidth : (media.clientWidth || 640);
      sourceHeight = media.videoHeight > 0 ? media.videoHeight : (media.clientHeight || 360);
    } else {
      sourceWidth = media.width > 0 ? media.width : (media.clientWidth || 640);
      sourceHeight = media.height > 0 ? media.height : (media.clientHeight || 360);
    }

    if (sourceWidth === 0 || sourceHeight === 0) return;

    const sx = Math.max(0, Math.floor(this.roi[0] * sourceWidth));
    const sy = Math.max(0, Math.floor(this.roi[1] * sourceHeight));
    const sw = Math.min(sourceWidth - sx, Math.floor(this.roi[2] * sourceWidth));
    const sh = Math.min(sourceHeight - sy, Math.floor(this.roi[3] * sourceHeight));

    if (sw <= 0 || sh <= 0) return;

    try {
      this.ctx.drawImage(
        media,
        sx,
        sy,
        sw,
        sh,
        0,
        0,
        this.targetWidth,
        this.targetHeight
      );

      const imageData = this.ctx.getImageData(0, 0, this.targetWidth, this.targetHeight);
      this.frameCount++;

      this.onFrameCaptured({
        buffer: imageData.data.buffer,
        width: this.targetWidth,
        height: this.targetHeight,
        t: mediaTime,
        frameIndex: this.frameCount
      });
    } catch (err: any) {
      if (err?.name === 'SecurityError' || String(err).includes('tainted')) {
        this.onError('TAINTED_CANVAS', err);
      } else {
        this.onError('CAPTURE_FAILED', err);
      }
    }
  }
}
