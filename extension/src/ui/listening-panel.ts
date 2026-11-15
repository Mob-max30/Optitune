/**
 * Earth Jukebox (EJB) — In-Page Listening Panel Overlay (Shadow DOM)
 * Specification: Amendment B, Section 5, 6b & Gate B4
 *
 * Implements:
 * - Isolated Shadow DOM container ensuring 0 style leakage to/from the host NASA page.
 * - Dock State (compact ~52px floating bar) and Expanded State (~380px x ~620px).
 * - The Listening Disc with audio-reactive rim and outer progress seeking.
 * - Accessible GridOverlay and Data View toggle.
 * - Transport controls, 3-mode selector, identity toggle, legend with soloing.
 * - Collapsible "Under the hood" drawer.
 * - Draggable positioning and keyboard movement with chrome.storage persistence.
 * - Polite ARIA live announcer rate-limited to 8 seconds.
 */

import { ListeningDisc } from './disc';
import { GridOverlay } from './grid-overlay';
import { createUiViewModel, type UiViewModel, type AdapterInputs, type UiMode } from './view-model';
import panelCss from './listening-panel.css?raw';

export interface ListeningPanelOptions {
  onTogglePlay?: () => void;
  onSetMode?: (mode: UiMode) => void;
  onSetVolume?: (volume: number) => void;
  onSeek?: (normalizedTime: number) => void;
  onToggleIdentity?: (enabled: boolean) => void;
  onSoloVoice?: (voice: string | null) => void;
  onOpenListeningRoom?: () => void;
}

export class ListeningPanelController {
  private hostElement: HTMLElement;
  private shadowRoot: ShadowRoot;
  private options: ListeningPanelOptions;

  // Components
  private disc: ListeningDisc | null = null;
  private gridOverlay: GridOverlay | null = null;

  // State
  private state: 'dock' | 'expanded' | 'closed' = 'dock';
  private viewModel: UiViewModel | null = null;
  private isMuted = false;
  private lastVolume = 0.8;
  private soloedVoice: string | null = null;
  private isDataView = false;
  private rAFId: number | null = null;

  // Rate-limited ARIA live announcement
  private lastAnnounceTime = 0;
  private lastAnnounceText = '';

  // Elements inside shadow DOM
  private dockEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;
  private captionEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private dockPlayBtn!: HTMLButtonElement;
  private titleEl!: HTMLElement;
  private dockTitleEl!: HTMLElement;
  private chipEl!: HTMLElement;
  private modeGroup!: HTMLElement;
  private modeDescEl!: HTMLElement;
  private identityCheckbox!: HTMLInputElement;
  private legendListEl!: HTMLElement;
  private drawerContentEl!: HTMLElement;
  private srLiveEl!: HTMLElement;

  constructor(options: ListeningPanelOptions = {}) {
    this.options = options;

    // Create host element with unique id
    let existingHost = document.getElementById('earth-jukebox-overlay-host');
    if (existingHost) existingHost.remove();

    this.hostElement = document.createElement('div');
    this.hostElement.id = 'earth-jukebox-overlay-host';
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    this.injectStyles();
    this.buildDom();
    this.setupDiscAndGrid();
    this.setupEvents();
    this.loadPersistedState();

    document.body.appendChild(this.hostElement);
    this.startRenderLoop();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = panelCss;
    this.shadowRoot.appendChild(style);
  }

  private buildDom(): void {
    // 1. Polite Screen Reader Live Region
    this.srLiveEl = document.createElement('div');
    this.srLiveEl.setAttribute('aria-live', 'polite');
    this.srLiveEl.setAttribute('aria-atomic', 'true');
    this.srLiveEl.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    this.shadowRoot.appendChild(this.srLiveEl);

    // 2. Dock Container
    this.dockEl = document.createElement('div');
    this.dockEl.className = 'ejb-dock';
    this.dockEl.setAttribute('tabindex', '0');
    this.dockEl.setAttribute('role', 'region');
    this.dockEl.setAttribute('aria-label', 'Earth Jukebox Audio Dock');
    this.dockEl.innerHTML = `
      <div class="ejb-dock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
          <path d="M2 12h20"/>
        </svg>
      </div>
      <button class="ejb-dock-btn ejb-dock-play-btn" aria-label="Play or pause sonification">▶</button>
      <div class="ejb-dock-title">NASA Earth Audio</div>
      <button class="ejb-dock-btn ejb-dock-expand-btn" aria-label="Expand listening panel" title="Expand listening panel">⛶</button>
    `;
    this.shadowRoot.appendChild(this.dockEl);

    this.dockPlayBtn = this.dockEl.querySelector('.ejb-dock-play-btn') as HTMLButtonElement;
    this.dockTitleEl = this.dockEl.querySelector('.ejb-dock-title') as HTMLElement;

    // 3. Expanded Panel Container
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'ejb-panel';
    this.panelEl.style.display = 'none';
    this.panelEl.setAttribute('role', 'dialog');
    this.panelEl.setAttribute('aria-label', 'Earth Jukebox Listening Panel');
    this.panelEl.innerHTML = `
      <!-- Header -->
      <header class="ejb-panel-header">
        <div class="ejb-panel-title-area">
          <h2 class="ejb-panel-title">NASA Earth Observation</h2>
          <div class="ejb-chip" role="note" aria-label="Data provenance: Estimated from legend" title="Click to learn about data calibration">
            <span class="ejb-chip-icon" aria-hidden="true"></span>
            <span class="ejb-chip-text">Estimated from the legend</span>
          </div>
        </div>
        <div class="ejb-header-actions">
          <button class="ejb-btn-icon ejb-btn-dataview" aria-label="Toggle data table view" title="Toggle data table view">⊞</button>
          <button class="ejb-btn-icon ejb-btn-collapse" aria-label="Collapse to dock" title="Collapse to dock">—</button>
          <button class="ejb-btn-icon ejb-btn-close" aria-label="Close panel" title="Close panel">✕</button>
        </div>
      </header>

      <!-- The Disc Visual & Grid Overlay -->
      <div class="ejb-disc-container">
        <canvas class="ejb-disc-canvas" width="300" height="300" aria-hidden="true"></canvas>
      </div>

      <!-- Caption -->
      <div class="ejb-caption-box">
        <div class="ejb-caption-text">Observing Earth data, translating optical measurements directly into sound.</div>
      </div>

      <!-- Transport Controls -->
      <div class="ejb-transport">
        <button class="ejb-btn-icon ejb-btn-rw" aria-label="Seek back 5 seconds">⏮</button>
        <button class="ejb-btn-play" aria-label="Play or pause sonification">▶</button>
        <button class="ejb-btn-icon ejb-btn-ff" aria-label="Seek forward 5 seconds">⏭</button>
        <button class="ejb-btn-icon ejb-btn-mute" aria-label="Mute audio">🔊</button>
      </div>

      <!-- Mode Selector -->
      <div class="ejb-mode-section">
        <div class="ejb-mode-label">
          <span>How it sounds</span>
        </div>
        <div class="ejb-mode-group" role="radiogroup" aria-label="Sonification Mode">
          <button class="ejb-mode-btn" data-mode="exact" role="radio" aria-checked="false">Exact</button>
          <button class="ejb-mode-btn active" data-mode="musical" role="radio" aria-checked="true">Musical</button>
          <button class="ejb-mode-btn" data-mode="sweep" role="radio" aria-checked="false">Sweep</button>
        </div>
        <div class="ejb-mode-desc">Values snap to an authentic musical scale.</div>
        <label class="ejb-identity-toggle">
          <input type="checkbox" checked>
          <span>Add sound identity</span>
        </label>
      </div>

      <!-- Sound Legend ("What you're hearing") -->
      <section class="ejb-legend-section">
        <h3 class="ejb-section-title">What you're hearing</h3>
        <div class="ejb-legend-list" role="list"></div>
      </section>

      <!-- Under the Hood Drawer -->
      <details class="ejb-drawer">
        <summary class="ejb-drawer-summary">
          <span>Under the hood</span>
          <span>▼</span>
        </summary>
        <div class="ejb-drawer-content">
          <div class="ejb-drawer-metrics">
            <div class="ejb-drawer-stat"><span>Luminance:</span><strong id="dh-luma">0.50</strong></div>
            <div class="ejb-drawer-stat"><span>Hue:</span><strong id="dh-hue">180°</strong></div>
            <div class="ejb-drawer-stat"><span>Motion:</span><strong id="dh-motion">0.00</strong></div>
            <div class="ejb-drawer-stat"><span>Value:</span><strong id="dh-val">--</strong></div>
          </div>
          <div style="font-size:10px;color:var(--ejb-color-muted);line-height:1.4;">
            4x8 optical spatial array sampling live at 12 Hz. Calibrated via client-side CIELAB ΔE matching. Zero cloud telemetry.
          </div>
        </div>
      </details>
    `;
    this.shadowRoot.appendChild(this.panelEl);

    // Cache element references
    this.canvasEl = this.panelEl.querySelector('.ejb-disc-canvas') as HTMLCanvasElement;
    this.titleEl = this.panelEl.querySelector('.ejb-panel-title') as HTMLElement;
    this.chipEl = this.panelEl.querySelector('.ejb-chip') as HTMLElement;
    this.captionEl = this.panelEl.querySelector('.ejb-caption-text') as HTMLElement;
    this.playBtn = this.panelEl.querySelector('.ejb-btn-play') as HTMLButtonElement;
    this.modeGroup = this.panelEl.querySelector('.ejb-mode-group') as HTMLElement;
    this.modeDescEl = this.panelEl.querySelector('.ejb-mode-desc') as HTMLElement;
    this.identityCheckbox = this.panelEl.querySelector('.ejb-identity-toggle input') as HTMLInputElement;
    this.legendListEl = this.panelEl.querySelector('.ejb-legend-list') as HTMLElement;
    this.drawerContentEl = this.panelEl.querySelector('.ejb-drawer-content') as HTMLElement;
  }

  private setupDiscAndGrid(): void {
    const discContainer = this.panelEl.querySelector('.ejb-disc-container') as HTMLElement;

    this.disc = new ListeningDisc({
      canvas: this.canvasEl,
      onSeek: (norm) => this.options.onSeek?.(norm),
      onCellClick: (cell) => {
        this.announce(cell.readout);
      }
    });

    this.gridOverlay = new GridOverlay(discContainer, (cell) => {
      this.announce(cell.readout);
    });
  }

  private setupEvents(): void {
    // Dock events
    this.dockEl.querySelector('.ejb-dock-expand-btn')?.addEventListener('click', () => {
      this.setState('expanded');
    });
    this.dockPlayBtn.addEventListener('click', () => {
      this.options.onTogglePlay?.();
    });

    // Panel Header events
    this.panelEl.querySelector('.ejb-btn-collapse')?.addEventListener('click', () => {
      this.setState('dock');
    });
    this.panelEl.querySelector('.ejb-btn-close')?.addEventListener('click', () => {
      this.setState('closed');
    });
    this.panelEl.querySelector('.ejb-btn-dataview')?.addEventListener('click', () => {
      this.isDataView = !this.isDataView;
      this.gridOverlay?.setTableView(this.isDataView);
      this.canvasEl.style.display = this.isDataView ? 'none' : 'block';
    });

    // Transport events
    this.playBtn.addEventListener('click', () => {
      this.options.onTogglePlay?.();
    });
    this.panelEl.querySelector('.ejb-btn-rw')?.addEventListener('click', () => {
      if (this.viewModel) {
        const target = Math.max(0, (this.viewModel.transport.currentTime - 5) / (this.viewModel.transport.duration || 60));
        this.options.onSeek?.(target);
      }
    });
    this.panelEl.querySelector('.ejb-btn-ff')?.addEventListener('click', () => {
      if (this.viewModel) {
        const target = Math.min(1, (this.viewModel.transport.currentTime + 5) / (this.viewModel.transport.duration || 60));
        this.options.onSeek?.(target);
      }
    });
    const muteBtn = this.panelEl.querySelector('.ejb-btn-mute') as HTMLButtonElement;
    muteBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      muteBtn.textContent = this.isMuted ? '🔇' : '🔊';
      this.options.onSetVolume?.(this.isMuted ? 0 : this.lastVolume);
      this.announce(this.isMuted ? 'Audio muted' : 'Audio unmuted');
    });

    // Mode Selector buttons
    this.modeGroup.querySelectorAll('.ejb-mode-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as UiMode;
        if (!mode) return;

        this.modeGroup.querySelectorAll('.ejb-mode-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        target.classList.add('active');
        target.setAttribute('aria-checked', 'true');

        this.options.onSetMode?.(mode);
        this.announce(`Sonification mode set to ${mode}`);
      });
    });

    // Identity toggle
    this.identityCheckbox.addEventListener('change', () => {
      this.options.onToggleIdentity?.(this.identityCheckbox.checked);
      this.announce(this.identityCheckbox.checked ? 'Sound identity enabled' : 'Sound identity disabled');
    });

    // Keyboard navigation when panel is focused
    this.panelEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.setState('dock');
      } else if (e.key === ' ' || e.key === 'k') {
        this.options.onTogglePlay?.();
        e.preventDefault();
      } else if (e.key === 'm') {
        muteBtn.click();
      } else if (e.key === '1') {
        (this.modeGroup.querySelector('[data-mode="exact"]') as HTMLElement)?.click();
      } else if (e.key === '2') {
        (this.modeGroup.querySelector('[data-mode="musical"]') as HTMLElement)?.click();
      } else if (e.key === '3') {
        (this.modeGroup.querySelector('[data-mode="sweep"]') as HTMLElement)?.click();
      } else if (e.key === 'd') {
        (this.panelEl.querySelector('.ejb-btn-dataview') as HTMLElement)?.click();
      }
    });

    // Dock drag & keyboard repositioning
    this.setupDockDrag();
  }

  private setupDockDrag(): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialRight = 24;
    let initialBottom = 24;

    this.dockEl.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.dockEl.getBoundingClientRect();
      initialRight = window.innerWidth - rect.right;
      initialBottom = window.innerHeight - rect.bottom;
      this.dockEl.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      const newRight = Math.max(12, Math.min(window.innerWidth - 120, initialRight + dx));
      const newBottom = Math.max(12, Math.min(window.innerHeight - 60, initialBottom + dy));
      this.dockEl.style.right = `${newRight}px`;
      this.dockEl.style.bottom = `${newBottom}px`;
    });

    window.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        try {
          chrome.storage?.local?.set({
            dockRight: parseInt(this.dockEl.style.right || '24', 10),
            dockBottom: parseInt(this.dockEl.style.bottom || '24', 10)
          });
        } catch {}
      }
    });

    // Keyboard repositioning on dock focus (Arrow keys move by 20px)
    this.dockEl.addEventListener('keydown', (e) => {
      const step = 20;
      let r = parseInt(this.dockEl.style.right || '24', 10);
      let b = parseInt(this.dockEl.style.bottom || '24', 10);
      if (e.key === 'ArrowLeft') { r += step; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { r = Math.max(12, r - step); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { b += step; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { b = Math.max(12, b - step); e.preventDefault(); }
      this.dockEl.style.right = `${r}px`;
      this.dockEl.style.bottom = `${b}px`;
    });
  }

  setState(state: 'dock' | 'expanded' | 'closed'): void {
    this.state = state;
    this.dockEl.style.display = state === 'dock' ? 'flex' : 'none';
    this.panelEl.style.display = state === 'expanded' ? 'flex' : 'none';

    if (state === 'expanded') {
      this.disc?.resize();
      this.panelEl.focus();
    }

    try {
      chrome.storage?.local?.set({ panelState: state });
    } catch {}
  }

  setAnalyserNode(node: AnalyserNode | null): void {
    this.disc?.setAnalyserNode(node);
  }

  updateFromInputs(inputs: AdapterInputs): void {
    const vm = createUiViewModel(inputs);
    this.viewModel = vm;

    // Apply phenomenon tint to shadow host
    this.hostElement.setAttribute('data-phenomenon', vm.source.phenomenonClass);

    // Update titles and chip
    this.titleEl.textContent = vm.source.title;
    this.dockTitleEl.textContent = vm.source.title;

    const chipIconEl = this.chipEl.querySelector('.ejb-chip-icon');
    const chipTextEl = this.chipEl.querySelector('.ejb-chip-text');
    if (chipIconEl) chipIconEl.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12">${vm.provenance.iconSvg}</svg>`;
    if (chipTextEl) chipTextEl.textContent = vm.provenance.label;
    this.chipEl.title = vm.provenance.description;

    // Update Caption
    if (this.captionEl.textContent !== vm.caption) {
      this.captionEl.textContent = vm.caption;
      this.announce(vm.caption);
    }

    // Update Transport UI
    const playText = vm.transport.isPlaying ? '⏸' : '▶';
    this.playBtn.textContent = playText;
    this.dockPlayBtn.textContent = playText;

    // Update Mode UI
    this.modeDescEl.textContent = vm.mode.description;
    this.modeGroup.querySelectorAll('.ejb-mode-btn').forEach(btn => {
      const mode = (btn as HTMLElement).dataset.mode;
      const active = mode === vm.mode.active;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });

    // Update Legend
    this.renderLegend(vm);

    // Update Drawer Metrics
    const dhLuma = this.shadowRoot.getElementById('dh-luma');
    const dhHue = this.shadowRoot.getElementById('dh-hue');
    const dhMotion = this.shadowRoot.getElementById('dh-motion');
    const dhVal = this.shadowRoot.getElementById('dh-val');
    if (dhLuma) dhLuma.textContent = vm.underTheHood.brightness.toFixed(2);
    if (dhHue) dhHue.textContent = `${vm.underTheHood.hueDegrees}°`;
    if (dhMotion) dhMotion.textContent = vm.underTheHood.motionDelta.toFixed(2);
    if (dhVal) {
      dhVal.textContent = vm.underTheHood.dataValue !== null
        ? `${vm.underTheHood.dataValue.toFixed(2)} ${vm.underTheHood.physicalUnit}`
        : 'proxy only';
    }

    // Update Disc & Grid
    this.disc?.updateViewModel(vm);
    this.gridOverlay?.updateViewModel(vm);
  }

  private renderLegend(vm: UiViewModel): void {
    this.legendListEl.innerHTML = '';
    for (const item of vm.legend.items) {
      const row = document.createElement('div');
      row.className = 'ejb-legend-row';
      row.tabIndex = 0;
      row.setAttribute('role', 'listitem');
      row.innerHTML = `
        <div class="ejb-legend-info">
          <span class="ejb-legend-name">${item.featureName}</span>
          <span class="ejb-legend-desc">${item.directionText}</span>
        </div>
        <button class="ejb-btn-solo ${this.soloedVoice === item.targetVoice ? 'active' : ''}" aria-label="Solo ${item.featureName}">Solo</button>
      `;

      // Highlight Disc rings when hovering or focusing legend row
      row.addEventListener('pointerenter', () => this.disc?.setHighlightedVoice(item.targetVoice));
      row.addEventListener('pointerleave', () => this.disc?.setHighlightedVoice(null));
      row.addEventListener('focus', () => this.disc?.setHighlightedVoice(item.targetVoice));
      row.addEventListener('blur', () => this.disc?.setHighlightedVoice(null));

      // Solo button
      const soloBtn = row.querySelector('.ejb-btn-solo') as HTMLButtonElement;
      soloBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.soloedVoice === item.targetVoice) {
          this.soloedVoice = null;
          soloBtn.classList.remove('active');
          this.options.onSoloVoice?.(null);
          this.announce(`Solo deactivated`);
        } else {
          this.soloedVoice = item.targetVoice;
          this.shadowRoot.querySelectorAll('.ejb-btn-solo').forEach(b => b.classList.remove('active'));
          soloBtn.classList.add('active');
          this.options.onSoloVoice?.(item.targetVoice);
          this.announce(`Soloed ${item.featureName}`);
        }
      });

      this.legendListEl.appendChild(row);
    }
  }

  private announce(text: string): void {
    const now = performance.now();
    // Rate-limit announcements to at most once per 8 seconds to prevent auditory clutter
    if (now - this.lastAnnounceTime < 8000 && this.lastAnnounceText === text) return;
    this.lastAnnounceTime = now;
    this.lastAnnounceText = text;
    this.srLiveEl.textContent = text;
  }

  private startRenderLoop(): void {
    const loop = () => {
      if (this.state === 'expanded' && this.disc && !this.isDataView) {
        this.disc.render();
      }
      this.rAFId = requestAnimationFrame(loop);
    };
    this.rAFId = requestAnimationFrame(loop);
  }

  private loadPersistedState(): void {
    try {
      chrome.storage?.local?.get(['panelState', 'dockRight', 'dockBottom'], (res) => {
        if (res?.panelState) {
          this.setState(res.panelState);
        }
        if (typeof res?.dockRight === 'number') {
          this.dockEl.style.right = `${res.dockRight}px`;
        }
        if (typeof res?.dockBottom === 'number') {
          this.dockEl.style.bottom = `${res.dockBottom}px`;
        }
      });
    } catch {}
  }

  teardown(): void {
    if (this.rAFId) {
      cancelAnimationFrame(this.rAFId);
      this.rAFId = null;
    }
    this.hostElement.remove();
  }
}
