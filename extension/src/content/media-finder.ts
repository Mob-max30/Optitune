export type TrackedMedia = HTMLVideoElement | HTMLCanvasElement;

export interface MediaFinderCallbacks {
  onMediaFound: (media: TrackedMedia) => void;
  onMediaLost: () => void;
  onStateChange: (state: 'playing' | 'paused' | 'seeked' | 'ended', time: number) => void;
}

export class MediaFinder {
  private activeMedia: TrackedMedia | null = null;
  private observer: MutationObserver | null = null;
  private callbacks: MediaFinderCallbacks;
  private boundListeners: Array<{ target: EventTarget; type: string; fn: EventListener }> = [];

  constructor(callbacks: MediaFinderCallbacks) {
    this.callbacks = callbacks;
  }

  private handleGlobalPlay = (e: Event): void => {
    const target = e.target;
    if (target instanceof HTMLVideoElement) {
      if (this.activeMedia !== target) {
        this.detachMedia();
        this.attachMedia(target);
      } else {
        this.callbacks.onStateChange('playing', target.currentTime);
      }
    }
  };

  private handleGlobalPause = (e: Event): void => {
    const target = e.target;
    if (target instanceof HTMLVideoElement && this.activeMedia === target) {
      this.callbacks.onStateChange('paused', target.currentTime);
    }
  };

  private handleGlobalSeeked = (e: Event): void => {
    const target = e.target;
    if (target instanceof HTMLVideoElement && this.activeMedia === target) {
      this.callbacks.onStateChange('seeked', target.currentTime);
    }
  };

  start(): void {
    // Intercept media play/pause in capture phase across all videos on the page for instant auto-sonification
    window.addEventListener('play', this.handleGlobalPlay, true);
    window.addEventListener('playing', this.handleGlobalPlay, true);
    window.addEventListener('pause', this.handleGlobalPause, true);
    window.addEventListener('ended', this.handleGlobalPause, true);
    window.addEventListener('seeked', this.handleGlobalSeeked, true);

    this.scan();

    this.observer = new MutationObserver(() => {
      this.scan();
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'class']
    });
  }

  scan(): void {
    const candidate = this.findBestMedia();
    if (candidate !== this.activeMedia) {
      this.detachMedia();
      if (candidate) {
        this.attachMedia(candidate);
      } else {
        this.callbacks.onMediaLost();
      }
    }
  }

  getActiveMedia(): TrackedMedia | null {
    return this.activeMedia;
  }

  private findBestMedia(): TrackedMedia | null {
    const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    const visibleVideos = videos.filter(v => this.isVisible(v));

    if (visibleVideos.length > 0) {
      // 1. Prefer playing video
      const playing = visibleVideos.find(v => !v.paused && !v.ended && v.readyState >= 2);
      if (playing) return playing;

      // 2. Prefer largest video by display area
      visibleVideos.sort((a, b) => {
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaB - areaA;
      });
      return visibleVideos[0];
    }

    // 3. Fallback to canvas
    const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
    const visibleCanvases = canvases.filter(c => this.isVisible(c) && c.width > 64 && c.height > 64);
    if (visibleCanvases.length > 0) {
      visibleCanvases.sort((a, b) => {
        const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
        const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
        return areaB - areaA;
      });
      return visibleCanvases[0];
    }

    return null;
  }

  private isVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 20 &&
      rect.height > 20 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity || '1') > 0.05
    );
  }

  private attachMedia(media: TrackedMedia): void {
    this.activeMedia = media;
    this.callbacks.onMediaFound(media);

    if (media instanceof HTMLVideoElement) {
      const onPlay = () => this.callbacks.onStateChange('playing', media.currentTime);
      const onPlaying = () => this.callbacks.onStateChange('playing', media.currentTime);
      const onPause = () => this.callbacks.onStateChange('paused', media.currentTime);
      const onSeeked = () => this.callbacks.onStateChange('seeked', media.currentTime);
      const onEnded = () => this.callbacks.onStateChange('ended', media.currentTime);

      this.addListener(media, 'play', onPlay);
      this.addListener(media, 'playing', onPlaying);
      this.addListener(media, 'pause', onPause);
      this.addListener(media, 'seeked', onSeeked);
      this.addListener(media, 'ended', onEnded);

      // If video is already actively playing when attached, trigger playing callback immediately
      if (!media.paused && !media.ended) {
        this.callbacks.onStateChange('playing', media.currentTime);
      }
    }
  }

  private addListener(target: EventTarget, type: string, fn: EventListener): void {
    target.addEventListener(type, fn);
    this.boundListeners.push({ target, type, fn });
  }

  private detachMedia(): void {
    for (const { target, type, fn } of this.boundListeners) {
      target.removeEventListener(type, fn);
    }
    this.boundListeners = [];
    this.activeMedia = null;
  }

  stop(): void {
    window.removeEventListener('play', this.handleGlobalPlay, true);
    window.removeEventListener('playing', this.handleGlobalPlay, true);
    window.removeEventListener('pause', this.handleGlobalPause, true);
    window.removeEventListener('ended', this.handleGlobalPause, true);
    window.removeEventListener('seeked', this.handleGlobalSeeked, true);

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.detachMedia();
  }
}
