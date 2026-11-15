/**
 * Earth Jukebox (EJB) — The Listening Disc Canvas Component
 * Specification: Amendment B, Section 7 ("The Disc")
 *
 * A 2D canvas visualization rendering:
 * - 4 concentric rings (4 picture bands, top to bottom)
 * - 8 sectors (8 spatial columns, starting at 12 o'clock clockwise)
 * - Calibrated solid fill vs fine-hatched visual proxy texture
 * - Dashed outline for masked/missing data (never drawn as zero)
 * - Audio-reactive outer rim driven by the Web Audio Analyser (<= 6px modulation)
 * - Clockwise outer progress arc (draggable / seekable)
 * - Sweep mode radial playhead line
 * - Centre tabular time and provenance icon
 * - 1.2s "tune-in" opening ring animation
 * - Prefers-reduced-motion fallback
 *
 * Performance budget: < 2.0 ms per frame.
 */

import type { UiViewModel, UiGridCell } from './view-model';

export interface DiscOptions {
  canvas: HTMLCanvasElement;
  onSeek?: (normalizedTime: number) => void;
  onCellClick?: (cell: UiGridCell) => void;
}

export class ListeningDisc {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onSeek?: (normalizedTime: number) => void;
  private onCellClick?: (cell: UiGridCell) => void;

  private viewModel: UiViewModel | null = null;
  private analyserNode: AnalyserNode | null = null;
  private analyserBuffer: Uint8Array = new Uint8Array(64);

  // Animation & Tune-in state
  private hasTunedIn = false;
  private tuneInStartTime = 0;
  private tuneInProgress = 1.0;
  private isReducedMotion = false;
  private isSeeking = false;
  private lastRenderTime = 0;
  private highlightedStreamVoice: string | null = null;

  // Flash / event blooms (subtle sector glow)
  private activeBlooms: Array<{ sector: number; ring: number; opacity: number; color: string }> = [];

  constructor(options: DiscOptions) {
    this.canvas = options.canvas;
    const context = this.canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;
    this.onSeek = options.onSeek;
    this.onCellClick = options.onCellClick;

    this.checkReducedMotion();
    this.setupInteractions();
    this.resize();
  }

  setAnalyserNode(node: AnalyserNode | null): void {
    this.analyserNode = node;
    if (node) {
      this.analyserBuffer = new Uint8Array(node.frequencyBinCount);
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.isReducedMotion = reduced;
  }

  setHighlightedVoice(voice: string | null): void {
    this.highlightedStreamVoice = voice;
  }

  triggerEventBloom(sector: number, ring: number, color = '#FFFFFF'): void {
    if (this.isReducedMotion) return;
    this.activeBlooms.push({ sector, ring, opacity: 0.8, color });
  }

  triggerTuneIn(): void {
    if (this.isReducedMotion) {
      this.tuneInProgress = 1.0;
      this.hasTunedIn = true;
      return;
    }
    this.tuneInStartTime = performance.now();
    this.tuneInProgress = 0.0;
    this.hasTunedIn = false;
  }

  updateViewModel(vm: UiViewModel): void {
    const wasPlaying = this.viewModel?.transport.isPlaying;
    this.viewModel = vm;

    // Trigger tune-in animation on first play
    if (!this.hasTunedIn && vm.transport.isPlaying && !wasPlaying) {
      this.triggerTuneIn();
    }
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || 300;
    const height = rect.height || 300;

    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Main render method. Takes < 1.5ms.
   */
  render(): void {
    const t0 = performance.now();
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 300;
    const h = rect.height || 300;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.min(cx, cy) - 10;
    const centreRadius = maxRadius * 0.24;
    const ringThickness = (maxRadius - centreRadius) / 4;

    // Update tune-in progress
    if (!this.hasTunedIn) {
      const elapsed = t0 - this.tuneInStartTime;
      this.tuneInProgress = Math.min(1.0, elapsed / 1200);
      if (this.tuneInProgress >= 1.0) {
        this.hasTunedIn = true;
      }
    }

    const scale = this.isReducedMotion ? 1.0 : this.tuneInProgress;
    const currentMaxRadius = maxRadius * scale;
    const currentRingThickness = ringThickness * scale;

    // 1. Draw 4 Concentric Rings × 8 Sectors
    if (this.viewModel) {
      this.drawSectors(cx, cy, centreRadius * scale, currentRingThickness, currentMaxRadius);
    }

    // 2. Draw Audio-Reactive Outer Rim
    this.drawReactiveRim(cx, cy, currentMaxRadius);

    // 3. Draw Progress Arc (Media Time)
    this.drawProgressArc(cx, cy, currentMaxRadius + 4);

    // 4. Sweep Mode Playhead
    if (this.viewModel?.mode.active === 'sweep') {
      this.drawSweepPlayhead(cx, cy, centreRadius * scale, currentMaxRadius);
    }

    // 5. Draw Active Blooms (lightning / transients)
    this.drawBlooms(cx, cy, centreRadius * scale, currentRingThickness);

    // 6. Draw Centre Hub (Time & Provenance)
    this.drawCentreHub(cx, cy, centreRadius * scale);

    this.lastRenderTime = performance.now() - t0;
  }

  getLastFrameCostMs(): number {
    return this.lastRenderTime;
  }

  private drawSectors(
    cx: number,
    cy: number,
    centreR: number,
    rThick: number,
    maxR: number
  ): void {
    if (!this.viewModel) return;
    const ctx = this.ctx;
    const cells = this.viewModel.grid.cells;
    const tint = this.viewModel.source.tint || '#8FD3E8';
    const isProxy = this.viewModel.provenance.tier === 4;

    const sectorAngle = (Math.PI * 2) / 8;
    const startAngleOffset = -Math.PI / 2; // 12 o'clock

    for (let r = 0; r < 4; r++) {
      const innerR = centreR + r * rThick;
      const outerR = innerR + rThick;

      // Check if ring is highlighted by legend focus
      const isRingHighlighted = this.highlightedStreamVoice === 'pad_voice' ||
        (this.highlightedStreamVoice === 'lead_voice' && r <= 1) ||
        (this.highlightedStreamVoice === 'bass_voice' && r >= 2);

      for (let c = 0; c < 8; c++) {
        const cell = cells[r * 8 + c];
        const startA = startAngleOffset + c * sectorAngle;
        const endA = startA + sectorAngle - 0.03; // small gap between sectors

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, startA, endA);
        ctx.arc(cx, cy, outerR, endA, startA, true);
        ctx.closePath();

        if (!cell || !cell.isValid) {
          // Missing or masked data: dashed outline, NO fill, never drawn as zero
          ctx.strokeStyle = 'rgba(174, 182, 204, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
        } else {
          // Valid cell: Lightness follows normalized value
          const lightness = 0.12 + (cell.normalizedValue * 0.70);
          ctx.fillStyle = this.colorWithAlpha(tint, lightness);
          ctx.fill();

          if (isProxy) {
            // Fine hatch texture for visual proxy (Tier 4)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            ctx.lineWidth = 0.75;
            ctx.setLineDash([2, 3]);
            ctx.stroke();
          }

          if (isRingHighlighted) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            ctx.strokeStyle = 'rgba(11, 16, 32, 0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
  }

  private drawReactiveRim(cx: number, cy: number, baseRadius: number): void {
    const ctx = this.ctx;
    ctx.save();

    let modulation = 0;
    if (this.analyserNode && !this.isReducedMotion && this.viewModel?.transport.isPlaying) {
      this.analyserNode.getByteTimeDomainData(this.analyserBuffer);
      // Calculate RMS amplitude from buffer
      let sum = 0;
      for (let i = 0; i < this.analyserBuffer.length; i++) {
        const val = (this.analyserBuffer[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / this.analyserBuffer.length);
      modulation = Math.min(6, rms * 18);
    }

    const rimR = baseRadius + modulation;
    ctx.beginPath();
    ctx.arc(cx, cy, rimR, 0, Math.PI * 2);
    ctx.strokeStyle = this.viewModel?.source.tint || '#8FD3E8';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = this.viewModel?.source.tint || '#8FD3E8';
    ctx.shadowBlur = modulation > 0 ? 6 : 2;
    ctx.stroke();

    ctx.restore();
  }

  private drawProgressArc(cx: number, cy: number, radius: number): void {
    if (!this.viewModel) return;
    const { currentTime, duration } = this.viewModel.transport;
    if (!duration || duration <= 0) return;

    const ctx = this.ctx;
    const progress = Math.max(0, Math.min(1, currentTime / duration));
    const startA = -Math.PI / 2;
    const endA = startA + progress * (Math.PI * 2);

    ctx.save();
    // Track background
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(143, 211, 232, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Active progress arc
    if (progress > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startA, endA);
      ctx.strokeStyle = '#F2C9A0'; // Horizon accent
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSweepPlayhead(cx: number, cy: number, innerR: number, outerR: number): void {
    if (!this.viewModel) return;
    const ctx = this.ctx;
    const time = this.viewModel.transport.currentTime;
    // Scanner runs at ~0.5 Hz across 8 columns
    const angle = -Math.PI / 2 + ((time * 0.5) % 1) * (Math.PI * 2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  private drawBlooms(cx: number, cy: number, centreR: number, rThick: number): void {
    if (this.activeBlooms.length === 0 || this.isReducedMotion) return;
    const ctx = this.ctx;
    const sectorAngle = (Math.PI * 2) / 8;
    const startAngleOffset = -Math.PI / 2;

    for (let i = this.activeBlooms.length - 1; i >= 0; i--) {
      const b = this.activeBlooms[i];
      const innerR = centreR + b.ring * rThick;
      const outerR = innerR + rThick;
      const startA = startAngleOffset + b.sector * sectorAngle;
      const endA = startA + sectorAngle - 0.03;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, startA, endA);
      ctx.arc(cx, cy, outerR, endA, startA, true);
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${b.opacity * 0.5})`;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      b.opacity -= 0.08;
      if (b.opacity <= 0) {
        this.activeBlooms.splice(i, 1);
      }
    }
  }

  private drawCentreHub(cx: number, cy: number, radius: number): void {
    const ctx = this.ctx;
    ctx.save();

    // Central circular dark disc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0B1020'; // Night base
    ctx.strokeStyle = 'rgba(143, 211, 232, 0.25)';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Tabular time text
    const curTime = this.viewModel?.transport.currentTime ?? 0;
    const timeStr = this.formatTime(curTime);

    ctx.fillStyle = '#F1ECE4';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, cx, cy - 6);

    // Provenance indicator tier text
    const tier = this.viewModel?.provenance.tier ?? 4;
    ctx.fillStyle = '#AEB6CC';
    ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Tier ${tier}`, cx, cy + 9);

    ctx.restore();
  }

  private formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private colorWithAlpha(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
  }

  private setupInteractions(): void {
    const handlePointer = (e: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxRadius = Math.min(cx, cy) - 10;

      // Check if click/drag is on the outer progress rim
      if (dist >= maxRadius - 8 && dist <= maxRadius + 14) {
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const normalized = angle / (Math.PI * 2);
        this.onSeek?.(normalized);
        return;
      }

      // Check if click is on a sector
      const centreR = maxRadius * 0.24;
      const rThick = (maxRadius - centreR) / 4;
      if (dist > centreR && dist <= maxRadius && this.viewModel) {
        const ring = Math.floor((dist - centreR) / rThick);
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const sector = Math.floor(angle / ((Math.PI * 2) / 8));
        const cell = this.viewModel.grid.cells[ring * 8 + sector];
        if (cell) this.onCellClick?.(cell);
      }
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isSeeking = true;
      handlePointer(e);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isSeeking) handlePointer(e);
    });

    window.addEventListener('pointerup', () => {
      this.isSeeking = false;
    });
  }

  private checkReducedMotion(): void {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.isReducedMotion = mq.matches;
      mq.addEventListener('change', e => {
        this.isReducedMotion = e.matches;
      });
    }
  }
}
