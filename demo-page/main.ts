/**
 * Earth Jukebox — The Listening Room (Demo Studio) Controller
 * Specification: Amendment B, Section 6c & Gate B5
 *
 * Full-page cinematic sonification studio featuring:
 * - 340px The Listening Disc with audio-reactive rim and outer progress seek
 * - Accessible GridOverlay with 32-cell Data View table toggle
 * - Interactive offline NASA procedural simulations & video file upload
 * - Exact / Musical / Sweep 3-choice mode selector
 * - Phenomenon sound identity toggle
 * - What you're hearing legend with per-layer soloing
 * - Under the hood drawer (spatial heatmap, metrics, raw Contract v1 JSON)
 * - Presentation mode ('P') for demo recordings
 * - Full offline operation with 0 network egress
 */

import type {
  EjbFramePayload,
  EjbReadyPayload,
  PresetConfig
} from '../extension/src/contract/types';
import { PRESETS } from '../extension/src/presets';
import { calculateAverageLuminance } from '../extension/src/analysis/luminance';
import { extractColorMetrics } from '../extension/src/analysis/color';
import { prepareLegendLUT, calculateAverageLegendValue, type PreparedLegendLUT } from '../extension/src/analysis/legend';
import { calculateRegionGrid, calculateSpatialProfiles } from '../extension/src/analysis/regions';
import { calculateMotionAndEvents } from '../extension/src/analysis/motion';
import { clamp, round3 } from '../extension/src/analysis/normalize';
import { EarthJukeboxAudioEngine, type SonificationMode } from '../extension/src/audio';
import { adaptContractV1ToSfr } from '../extension/src/sfr/adapters/contract-v1';
import { AutonomousAudioEngineAdapter } from '../extension/src/semantic/audio-profile-adapter';
import { SascAudioEngineAdapter } from '../extension/src/sasc/sasc-audio-adapter';
import { ListeningDisc } from '../extension/src/ui/disc';
import { GridOverlay } from '../extension/src/ui/grid-overlay';
import { createUiViewModel, type UiMode, type UiViewModel } from '../extension/src/ui/view-model';

// DOM Elements
const simulationCanvas = document.getElementById('simulationCanvas') as HTMLCanvasElement;
const simCtx = simulationCanvas.getContext('2d')!;
const playerVideo = document.getElementById('playerVideo') as HTMLVideoElement;
const roiOverlayCanvas = document.getElementById('roiOverlayCanvas') as HTMLCanvasElement;
const roiCtx = roiOverlayCanvas.getContext('2d')!;

const mediaSourceSelect = document.getElementById('mediaSourceSelect') as HTMLSelectElement;
const urlInputContainer = document.getElementById('urlInputContainer') as HTMLDivElement;
const videoUrlInput = document.getElementById('videoUrlInput') as HTMLInputElement;
const loadUrlBtn = document.getElementById('loadUrlBtn') as HTMLButtonElement;
const fileInputContainer = document.getElementById('fileInputContainer') as HTMLDivElement;
const videoFileInput = document.getElementById('videoFileInput') as HTMLInputElement;

const playPauseBtn = document.getElementById('playPauseBtn') as HTMLButtonElement;
const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const timeSlider = document.getElementById('timeSlider') as HTMLInputElement;
const timeDisplay = document.getElementById('timeDisplay') as HTMLSpanElement;
const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement;
const muteBtn = document.getElementById('muteBtn') as HTMLButtonElement;

const demoPresetSelect = document.getElementById('demoPresetSelect') as HTMLSelectElement;
const audioStatusBadge = document.getElementById('audioStatusBadge') as HTMLSpanElement;
const roomSourceTitle = document.getElementById('roomSourceTitle') as HTMLElement;
const roomProvenanceChip = document.getElementById('roomProvenanceChip') as HTMLElement;
const roomChipIcon = document.getElementById('roomChipIcon') as HTMLElement;
const roomChipText = document.getElementById('roomChipText') as HTMLElement;
const roomCaption = document.getElementById('roomCaption') as HTMLElement;
const roomModeDesc = document.getElementById('roomModeDesc') as HTMLElement;
const identityCheckbox = document.getElementById('identityCheckbox') as HTMLInputElement;
const roomLegendList = document.getElementById('roomLegendList') as HTMLElement;
const btnToggleTable = document.getElementById('btnToggleTable') as HTMLButtonElement;
const btnPresentation = document.getElementById('btnPresentation') as HTMLButtonElement;
const btnShortcuts = document.getElementById('btnShortcuts') as HTMLButtonElement;
const btnCloseModal = document.getElementById('btnCloseModal') as HTMLButtonElement;
const shortcutsModal = document.getElementById('shortcutsModal') as HTMLElement;

// Drawer Elements
const spatialHeatmap = document.getElementById('spatialHeatmap') as HTMLDivElement;
const jsonPayloadView = document.getElementById('jsonPayloadView') as HTMLPreElement;
const valLuma = document.getElementById('valLuma') as HTMLElement;
const valHue = document.getElementById('valHue') as HTMLElement;
const valMotion = document.getElementById('valMotion') as HTMLElement;
const valPhysical = document.getElementById('valPhysical') as HTMLElement;

// Disc and Grid
const roomDiscCanvas = document.getElementById('roomDiscCanvas') as HTMLCanvasElement;
const discStageContainer = document.getElementById('discStageContainer') as HTMLElement;

// App State
let isPlaying = false;
let isMuted = false;
let lastVolume = 0.7;
let activePreset: PresetConfig = PRESETS['gedi-forest-height'];
let preparedLut: PreparedLegendLUT | null = prepareLegendLUT(activePreset.legend);
let currentTime = 0;
let frameCount = 0;
let lastTickTime = 0;
const tickIntervalMs = 1000 / 12; // 12 Hz
let isDataViewActive = false;
let soloedVoice: string | null = null;

// Buffers
const offscreenAnalysisCanvas = document.createElement('canvas');
offscreenAnalysisCanvas.width = 32;
offscreenAnalysisCanvas.height = 32;
const offscreenCtx = offscreenAnalysisCanvas.getContext('2d', { willReadFrequently: true })!;
let previousBuffer: Uint8ClampedArray | null = null;
const cellBaselines = new Float32Array(64).fill(0.1);

// Audio Engine & Adapters
const audioEngine = new EarthJukeboxAudioEngine({ mode: 'raaga', masterVolume: 0.7 });
const autonomousAdapter = new AutonomousAudioEngineAdapter(audioEngine);
const sascAdapter = new SascAudioEngineAdapter(audioEngine);

// Disc & Grid Overlay
let listeningDisc: ListeningDisc | null = null;
let gridOverlay: GridOverlay | null = null;
let currentViewModel: UiViewModel | null = null;

function init(): void {
  setupPresetSelect();
  setupHeatmapCells();
  setupDiscAndGrid();
  setupEventListeners();
  drawSimulation(0);
  drawRoiOverlay();
  setupAudioVisualizerLoop();

  console.log('[Listening Room] Initialized with 10 NASA Presets and The Listening Disc.');
}

function setupDiscAndGrid(): void {
  listeningDisc = new ListeningDisc({
    canvas: roomDiscCanvas,
    onSeek: (norm) => {
      seekTo(norm * 60);
    },
    onCellClick: (cell) => {
      console.log('[Cell Selected]', cell.readout);
    }
  });
  listeningDisc.setAnalyserNode(audioEngine.getAnalyserNode());

  gridOverlay = new GridOverlay(discStageContainer, (cell) => {
    console.log('[Cell Keyboard Selected]', cell.readout);
  });
}

function setupPresetSelect(): void {
  demoPresetSelect.innerHTML = '';
  for (const [key, preset] of Object.entries(PRESETS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = `${preset.name} (${preset.legend?.unit ? preset.legend.unit : 'visual'})`;
    demoPresetSelect.appendChild(opt);
  }

  demoPresetSelect.value = activePreset.id;
  updatePresetInfo();
}

function updatePresetInfo(): void {
  preparedLut = prepareLegendLUT(activePreset.legend);
  audioEngine.setPreset(activePreset.id);
  autonomousAdapter.resetProfile();
  sascAdapter.resetScene();
  cellBaselines.fill(0.1);
  previousBuffer = null;
  drawRoiOverlay();
}

function setupHeatmapCells(): void {
  spatialHeatmap.innerHTML = '';
  for (let i = 0; i < 32; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.id = `cell-${i}`;
    spatialHeatmap.appendChild(cell);
  }
}

// -------------------------------------------------------------
// Procedural Simulations (Offline)
// -------------------------------------------------------------
function drawSimulation(t: number): void {
  const w = simulationCanvas.width;
  const h = simulationCanvas.height;

  simCtx.fillStyle = '#050a14';
  simCtx.fillRect(0, 0, w, h);

  if (activePreset.id === 'gedi-forest-height') {
    const grad = simCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2d1e08');
    grad.addColorStop(0.3, '#356314');
    grad.addColorStop(0.7, '#148c3b');
    grad.addColorStop(1.0, '#38e8a8');

    simCtx.fillStyle = grad;
    simCtx.beginPath();
    simCtx.ellipse(w / 2, h / 2, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
    simCtx.fill();

    simCtx.strokeStyle = '#a7f3d0';
    simCtx.lineWidth = 3;
    for (let r = 30; r < 140; r += 28) {
      simCtx.beginPath();
      simCtx.arc(w / 2 + Math.sin(t + r) * 15, h / 2 + Math.cos(t * 0.5) * 10, r + Math.sin(t * 0.8) * 8, 0, Math.PI * 2);
      simCtx.stroke();
    }
  } else if (activePreset.id === 'night-lights') {
    simCtx.fillStyle = '#060912';
    simCtx.fillRect(0, 0, w, h);

    const clusterCount = 18;
    for (let i = 0; i < clusterCount; i++) {
      const cx = (w * 0.15) + ((i * 37) % (w * 0.7));
      const cy = (h * 0.2) + ((i * 47) % (h * 0.6));
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 + i);

      const radGrad = simCtx.createRadialGradient(cx, cy, 2, cx, cy, 35 * pulse);
      radGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      radGrad.addColorStop(0.4, 'rgba(234, 179, 8, 0.4)');
      radGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');

      simCtx.fillStyle = radGrad;
      simCtx.beginPath();
      simCtx.arc(cx, cy, 35 * pulse, 0, Math.PI * 2);
      simCtx.fill();
    }
  } else if (activePreset.id === 'iss-lightning') {
    simCtx.fillStyle = '#040711';
    simCtx.fillRect(0, 0, w, h);

    simCtx.fillStyle = '#172554';
    simCtx.beginPath();
    simCtx.ellipse(w / 2, h / 2, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    simCtx.fill();

    if (Math.sin(t * 5) > 0.82) {
      const lx = w * (0.2 + 0.6 * ((Math.sin(t * 13) + 1) / 2));
      const ly = h * (0.25 + 0.5 * ((Math.cos(t * 17) + 1) / 2));

      const flashGrad = simCtx.createRadialGradient(lx, ly, 2, lx, ly, 65);
      flashGrad.addColorStop(0, '#ffffff');
      flashGrad.addColorStop(0.3, '#93c5fd');
      flashGrad.addColorStop(1, 'rgba(147, 197, 253, 0)');

      simCtx.fillStyle = flashGrad;
      simCtx.beginPath();
      simCtx.arc(lx, ly, 65, 0, Math.PI * 2);
      simCtx.fill();
    }
  } else if (activePreset.id === 'sst-currents') {
    const grad = simCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.3, '#0284c7');
    grad.addColorStop(0.65, '#eab308');
    grad.addColorStop(1.0, '#dc2626');

    simCtx.fillStyle = grad;
    simCtx.fillRect(0, 0, w, h);

    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    simCtx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      simCtx.beginPath();
      const waveY = h * 0.3 + (i * 24);
      simCtx.moveTo(0, waveY);
      for (let x = 0; x < w; x += 30) {
        simCtx.lineTo(x, waveY + Math.sin((x * 0.02) + t * 2 + i) * 14);
      }
      simCtx.stroke();
    }
  } else {
    const grad = simCtx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.5, '#0b3d91');
    grad.addColorStop(1.0, '#020617');
    simCtx.fillStyle = grad;
    simCtx.fillRect(0, 0, w, h);
  }
}

function drawRoiOverlay(): void {
  const w = roiOverlayCanvas.width;
  const h = roiOverlayCanvas.height;
  roiCtx.clearRect(0, 0, w, h);

  const roi = activePreset.roi;
  const rx = roi[0] * w;
  const ry = roi[1] * h;
  const rw = (roi[2] - roi[0]) * w;
  const rh = (roi[3] - roi[1]) * h;

  roiCtx.strokeStyle = 'rgba(143, 211, 232, 0.4)';
  roiCtx.lineWidth = 1;
  roiCtx.setLineDash([4, 4]);
  roiCtx.strokeRect(rx, ry, rw, rh);
}

// -------------------------------------------------------------
// Real-time Pipeline Tick (12 Hz)
// -------------------------------------------------------------
function tickPipeline(timestamp: number): void {
  if (!isPlaying) return;

  if (timestamp - lastTickTime >= tickIntervalMs) {
    lastTickTime = timestamp;
    frameCount++;

    const isVideo = mediaSourceSelect.value !== 'synthetic';
    if (!isVideo) {
      currentTime += tickIntervalMs / 1000;
      if (currentTime > 60) currentTime = 0;
      drawSimulation(currentTime);
    } else {
      currentTime = playerVideo.currentTime;
    }

    processCurrentFrame(currentTime, frameCount);
  }

  requestAnimationFrame(tickPipeline);
}

function processCurrentFrame(t: number, frameIndex: number): void {
  const isVideo = mediaSourceSelect.value !== 'synthetic';
  const sourceElement = isVideo ? playerVideo : simulationCanvas;
  const w = isVideo ? playerVideo.videoWidth || 640 : simulationCanvas.width;
  const h = isVideo ? playerVideo.videoHeight || 360 : simulationCanvas.height;

  const [rx1, ry1, rx2, ry2] = activePreset.roi;
  const sx = rx1 * w;
  const sy = ry1 * h;
  const sw = (rx2 - rx1) * w;
  const sh = (ry2 - ry1) * h;

  offscreenCtx.drawImage(sourceElement, sx, sy, sw, sh, 0, 0, 32, 32);
  const imgData = offscreenCtx.getImageData(0, 0, 32, 32);
  const buffer = imgData.data;

  const ignoreDark = activePreset.ignoreDark ?? 0.05;
  const brightness = calculateAverageLuminance(buffer, { ignoreDark });
  const colorMetrics = extractColorMetrics(buffer, { ignoreDark });
  const motionResult = calculateMotionAndEvents(
    buffer,
    previousBuffer,
    32,
    32,
    cellBaselines,
    { detectEvents: activePreset.events?.detect ?? null, eventThreshold: activePreset.events?.threshold ?? 0.20 }
  );

  let dataValue = calculateAverageLegendValue(buffer, preparedLut, 0.20);
  if (dataValue === null) {
    dataValue = round3(clamp(
      brightness * 0.45 +
      colorMetrics.saturation * 0.30 +
      (Math.abs(colorMetrics.hue - 0.5) * 0.25) +
      (motionResult.motion * 0.30)
    ));
  }

  const regions = calculateRegionGrid(
    buffer,
    { rows: activePreset.grid?.[0] ?? 4, cols: activePreset.grid?.[1] ?? 8, width: 32, height: 32, ignoreDark },
    preparedLut
  );
  const profile = calculateSpatialProfiles(buffer, 32, 32, 32);

  if (!previousBuffer || previousBuffer.length !== buffer.length) {
    previousBuffer = new Uint8ClampedArray(buffer);
  } else {
    previousBuffer.set(buffer);
  }

  const payload: EjbFramePayload = {
    v: 1,
    t: round3(t),
    frameIndex,
    vizId: activePreset.id,
    metrics: {
      brightness,
      dominantColor: colorMetrics.dominantColor,
      hue: colorMetrics.hue,
      saturation: colorMetrics.saturation,
      dataValue,
      motion: motionResult.motion,
      regions
    },
    flags: { seeked: false, scene_cut: motionResult.sceneCut },
    events: motionResult.events.length > 0 ? motionResult.events : undefined,
    profile
  };

  const sfr = adaptContractV1ToSfr(payload);
  autonomousAdapter.processScientificFrame(sfr);
  const mappingProfile = autonomousAdapter.getActiveProfile();

  // Update UI View Model & Components
  const vm = createUiViewModel({
    payload,
    preset: activePreset,
    mappingProfile,
    telemetry: audioEngine.getTelemetry(),
    engineState: {
      isSonifying: isPlaying,
      mode: audioEngine.getTelemetry().mode,
      masterVolume: lastVolume,
      isMuted
    },
    mediaState: {
      title: activePreset.name,
      currentTime: t,
      duration: isVideo ? playerVideo.duration || 60 : 60,
      hasMedia: true,
      isPlaying
    }
  });
  currentViewModel = vm;

  updateUiWithViewModel(vm, payload);
}

function updateUiWithViewModel(vm: UiViewModel, payload: EjbFramePayload): void {
  // Title & Provenance
  roomSourceTitle.textContent = vm.source.title;
  roomChipIcon.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12">${vm.provenance.iconSvg}</svg>`;
  roomChipText.textContent = vm.provenance.label;
  roomProvenanceChip.title = vm.provenance.description;

  // Caption
  roomCaption.textContent = vm.caption;

  // Time Readout
  timeSlider.value = String((vm.transport.currentTime / (vm.transport.duration || 60)) * 100);
  timeDisplay.textContent = `${formatTime(vm.transport.currentTime)} / ${formatTime(vm.transport.duration)}`;

  // Update Disc & Grid
  listeningDisc?.updateViewModel(vm);
  gridOverlay?.updateViewModel(vm);

  // Update Legend List
  renderLegend(vm);

  // Update Drawer
  valLuma.textContent = vm.underTheHood.brightness.toFixed(2);
  valHue.textContent = `${vm.underTheHood.hueDegrees}°`;
  valMotion.textContent = vm.underTheHood.motionDelta.toFixed(2);
  valPhysical.textContent = vm.underTheHood.dataValue !== null
    ? `${(activePreset.legend?.min ?? 0) + vm.underTheHood.dataValue * ((activePreset.legend?.max ?? 1) - (activePreset.legend?.min ?? 0)).toFixed(1)} ${activePreset.legend?.unit || ''}`
    : 'proxy only';

  // Heatmap Cells
  const gridCells = payload.metrics.regions.dataValue || payload.metrics.regions.brightness;
  for (let i = 0; i < 32; i++) {
    const cEl = document.getElementById(`cell-${i}`);
    if (cEl) {
      const v = gridCells[i] ?? 0;
      cEl.style.backgroundColor = `rgba(143, 211, 232, ${Math.max(0.08, v * 0.75)})`;
    }
  }

  // JSON Pre
  jsonPayloadView.textContent = JSON.stringify(payload, null, 2);
}

function renderLegend(vm: UiViewModel): void {
  roomLegendList.innerHTML = '';
  for (const item of vm.legend.items) {
    const row = document.createElement('div');
    row.className = 'room-legend-row';
    row.innerHTML = `
      <div>
        <strong style="color:var(--ejb-color-text);">${item.featureName}</strong>
        <div style="font-size:11px;color:var(--ejb-color-muted);">${item.directionText}</div>
      </div>
      <button class="room-btn-solo ${soloedVoice === item.targetVoice ? 'active' : ''}">Solo</button>
    `;

    const soloBtn = row.querySelector('.room-btn-solo') as HTMLButtonElement;
    soloBtn.addEventListener('click', () => {
      if (soloedVoice === item.targetVoice) {
        soloedVoice = null;
        soloBtn.classList.remove('active');
        audioEngine.setSoloVoice(null);
      } else {
        soloedVoice = item.targetVoice;
        roomLegendList.querySelectorAll('.room-btn-solo').forEach(b => b.classList.remove('active'));
        soloBtn.classList.add('active');
        audioEngine.setSoloVoice(item.targetVoice);
      }
    });

    roomLegendList.appendChild(row);
  }
}

function setupAudioVisualizerLoop(): void {
  const loop = () => {
    if (listeningDisc && isPlaying && !isDataViewActive) {
      listeningDisc.render();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function seekTo(targetSeconds: number): void {
  currentTime = targetSeconds;
  if (mediaSourceSelect.value !== 'synthetic') {
    playerVideo.currentTime = targetSeconds;
  }
}

// -------------------------------------------------------------
// Event Listeners & Keyboard Layer
// -------------------------------------------------------------
function setupEventListeners(): void {
  playPauseBtn.addEventListener('click', async () => {
    if (!isPlaying) {
      await audioEngine.start();
      audioEngine.resume();
      isPlaying = true;
      playPauseBtn.textContent = '⏸';
      audioStatusBadge.textContent = 'Active';
      audioStatusBadge.classList.add('active');
      if (mediaSourceSelect.value !== 'synthetic') {
        playerVideo.play();
      }
      requestAnimationFrame(tickPipeline);
    } else {
      audioEngine.pause();
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      audioStatusBadge.textContent = 'Paused';
      audioStatusBadge.classList.remove('active');
      if (mediaSourceSelect.value !== 'synthetic') {
        playerVideo.pause();
      }
    }
  });

  resetBtn.addEventListener('click', () => {
    seekTo(0);
  });

  timeSlider.addEventListener('input', () => {
    const norm = parseFloat(timeSlider.value) / 100;
    seekTo(norm * 60);
  });

  volumeSlider.addEventListener('input', () => {
    lastVolume = parseFloat(volumeSlider.value);
    audioEngine.setMasterVolume(lastVolume);
  });

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    audioEngine.setMasterVolume(isMuted ? 0 : lastVolume);
  });

  demoPresetSelect.addEventListener('change', () => {
    const sel = PRESETS[demoPresetSelect.value];
    if (sel) {
      activePreset = sel;
      updatePresetInfo();
    }
  });

  // Mode Selection
  document.querySelectorAll('.room-mode-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = (e.currentTarget as HTMLElement).dataset.mode as UiMode;
      const internalMode = mode === 'exact' ? 'scientific' : mode === 'sweep' ? 'scanner' : 'raaga';
      audioEngine.setMode(internalMode);

      document.querySelectorAll('.room-mode-btn').forEach(b => b.classList.remove('active'));
      (e.currentTarget as HTMLElement).classList.add('active');
      roomModeDesc.textContent = mode === 'exact'
        ? 'Pitch continuously follows the measured value.'
        : mode === 'sweep'
        ? 'A playhead reads the image columns left to right.'
        : 'Values snap to an authentic musical scale.';
    });
  });

  // Identity checkbox
  identityCheckbox.addEventListener('change', () => {
    autonomousAdapter.setSemanticEnhance(identityCheckbox.checked);
  });

  // Data view toggle
  btnToggleTable.addEventListener('click', () => {
    isDataViewActive = !isDataViewActive;
    gridOverlay?.setTableView(isDataViewActive);
    roomDiscCanvas.style.display = isDataViewActive ? 'none' : 'block';
    btnToggleTable.textContent = isDataViewActive ? '◎ Disc View' : '⊞ Data View';
  });

  // Presentation mode toggle ('P')
  btnPresentation.addEventListener('click', () => {
    document.body.classList.toggle('presentation-mode');
  });

  // Shortcuts modal ('?')
  btnShortcuts.addEventListener('click', () => {
    shortcutsModal.classList.remove('hidden');
  });
  btnCloseModal.addEventListener('click', () => {
    shortcutsModal.classList.add('hidden');
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'text') return;

    if (e.key === ' ' || e.key === 'k') {
      playPauseBtn.click();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      seekTo(Math.max(0, currentTime - 5));
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      seekTo(Math.min(60, currentTime + 5));
      e.preventDefault();
    } else if (e.key === 'm') {
      muteBtn.click();
    } else if (e.key === 'p' || e.key === 'P') {
      btnPresentation.click();
    } else if (e.key === '?') {
      shortcutsModal.classList.toggle('hidden');
    } else if (e.key === 'd' || e.key === 'D') {
      btnToggleTable.click();
    } else if (e.key === '1') {
      (document.querySelector('[data-mode="exact"]') as HTMLElement)?.click();
    } else if (e.key === '2') {
      (document.querySelector('[data-mode="musical"]') as HTMLElement)?.click();
    } else if (e.key === '3') {
      (document.querySelector('[data-mode="sweep"]') as HTMLElement)?.click();
    }
  });

  // Source Selector
  mediaSourceSelect.addEventListener('change', () => {
    const val = mediaSourceSelect.value;
    urlInputContainer.classList.toggle('hidden', val !== 'url');
    fileInputContainer.classList.toggle('hidden', val !== 'upload');

    if (val === 'synthetic') {
      simulationCanvas.classList.remove('hidden');
      playerVideo.classList.add('hidden');
    } else {
      simulationCanvas.classList.add('hidden');
      playerVideo.classList.remove('hidden');
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      playerVideo.src = URL.createObjectURL(file);
      playerVideo.load();
    }
  });

  loadUrlBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
      playerVideo.src = url;
      playerVideo.load();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
