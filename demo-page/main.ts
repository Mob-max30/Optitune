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

const demoPresetSelect = document.getElementById('demoPresetSelect') as HTMLSelectElement;
const demoPresetDescription = document.getElementById('demoPresetDescription') as HTMLParagraphElement;
const demoSoundLegend = document.getElementById('demoSoundLegend') as HTMLDivElement;
const demoModeSelect = document.getElementById('demoModeSelect') as HTMLSelectElement;
const audioStatusBadge = document.getElementById('audioStatusBadge') as HTMLSpanElement;

// Dashboard Value Elements
const valLuma = document.getElementById('valLuma') as HTMLDivElement;
const meterLuma = document.getElementById('meterLuma') as HTMLDivElement;
const valPhysical = document.getElementById('valPhysical') as HTMLDivElement;
const valPhysicalUnit = document.getElementById('valPhysicalUnit') as HTMLDivElement;
const valColorSwatch = document.getElementById('valColorSwatch') as HTMLDivElement;
const valHue = document.getElementById('valHue') as HTMLDivElement;
const valSat = document.getElementById('valSat') as HTMLDivElement;
const valMotion = document.getElementById('valMotion') as HTMLDivElement;
const meterMotion = document.getElementById('meterMotion') as HTMLDivElement;
const spatialHeatmap = document.getElementById('spatialHeatmap') as HTMLDivElement;
const jsonPayloadView = document.getElementById('jsonPayloadView') as HTMLPreElement;
const audioVisualizer = document.getElementById('audioVisualizer') as HTMLCanvasElement;
const visCtx = audioVisualizer.getContext('2d')!;

// App State
let isPlaying = false;
let activePreset: PresetConfig = PRESETS['gedi-forest-height'];
let preparedLut: PreparedLegendLUT | null = prepareLegendLUT(activePreset.legend);
let currentTime = 0;
let frameCount = 0;
let lastTickTime = 0;
const tickIntervalMs = 1000 / 12; // 12 Hz

// Analysis Buffers
const offscreenAnalysisCanvas = document.createElement('canvas');
offscreenAnalysisCanvas.width = 32;
offscreenAnalysisCanvas.height = 32;
const offscreenCtx = offscreenAnalysisCanvas.getContext('2d', { willReadFrequently: true })!;

let previousBuffer: Uint8ClampedArray | null = null;
const cellBaselines = new Float32Array(64).fill(0.1);

// Earth Jukebox Sonification Audio Engine (Pranav K)
const audioEngine = new EarthJukeboxAudioEngine({
  mode: 'scientific',
  masterVolume: 0.7
});

// Initialize
function init(): void {
  setupPresetSelect();
  setupHeatmapCells();
  setupEventListeners();
  drawSimulation(0);
  drawRoiOverlay();
  setupAudioVisualizerLoop();

  console.log('[Earth Jukebox Studio] Initialized with 10 NASA Presets.');
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
  demoPresetDescription.textContent = activePreset.description;
  if (activePreset.soundHint) {
    demoSoundLegend.innerHTML = `🎧 <strong>Sound Mapping:</strong> ${activePreset.soundHint}`;
  }
  if (activePreset.legend?.unit) {
    valPhysicalUnit.textContent = `Calibrated (${activePreset.legend.unit})`;
  } else {
    valPhysicalUnit.textContent = `Approximate intensity`;
  }
  preparedLut = prepareLegendLUT(activePreset.legend);
  audioEngine.setPreset(activePreset.id);
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
// Simulation Renderer (Realistic Synthetic NASA Visualizations)
// -------------------------------------------------------------
function drawSimulation(t: number): void {
  const w = simulationCanvas.width;
  const h = simulationCanvas.height;

  simCtx.fillStyle = '#050a14';
  simCtx.fillRect(0, 0, w, h);

  if (activePreset.id === 'gedi-forest-height') {
    // Draw Earth globe with canopy height gradients
    const grad = simCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2d1e08'); // low vegetation
    grad.addColorStop(0.3, '#356314'); // mid canopy
    grad.addColorStop(0.7, '#148c3b'); // tall forest
    grad.addColorStop(1.0, '#38e8a8'); // old-growth towering canopy

    simCtx.fillStyle = grad;
    simCtx.beginPath();
    simCtx.ellipse(w / 2, h / 2, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
    simCtx.fill();

    // Continent contour ripples
    simCtx.strokeStyle = '#a7f3d0';
    simCtx.lineWidth = 3;
    for (let r = 30; r < 140; r += 28) {
      simCtx.beginPath();
      simCtx.arc(w / 2 + Math.sin(t + r) * 15, h / 2 + Math.cos(t * 0.5) * 10, r + Math.sin(t * 0.8) * 8, 0, Math.PI * 2);
      simCtx.stroke();
    }
  } else if (activePreset.id === 'night-lights') {
    // Earth at night: urban clusters
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
    // Dark Earth surface with lightning flash bursts
    simCtx.fillStyle = '#040711';
    simCtx.fillRect(0, 0, w, h);

    // Dim storm clouds
    simCtx.fillStyle = '#172554';
    simCtx.beginPath();
    simCtx.ellipse(w / 2, h / 2, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
    simCtx.fill();

    // Lightning strike flashes (periodic spike)
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
    // Sea surface temperature thermal gradient & swirling currents
    const grad = simCtx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1e1b4b'); // polar cold
    grad.addColorStop(0.3, '#0284c7'); // temperate
    grad.addColorStop(0.65, '#eab308'); // subtropical
    grad.addColorStop(1.0, '#dc2626'); // equatorial heat

    simCtx.fillStyle = grad;
    simCtx.fillRect(0, 0, w, h);

    // Eddies and current streaks
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
    // General dynamic simulation
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
  const rw = roi[2] * w;
  const rh = roi[3] * h;

  // Draw semi-transparent darkened mask outside ROI
  roiCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  // Top
  roiCtx.fillRect(0, 0, w, ry);
  // Bottom
  roiCtx.fillRect(0, ry + rh, w, h - (ry + rh));
  // Left
  roiCtx.fillRect(0, ry, rx, rh);
  // Right
  roiCtx.fillRect(rx + rw, ry, w - (rx + rw), rh);

  // Draw active ROI border
  roiCtx.strokeStyle = '#38bdf8';
  roiCtx.lineWidth = 1.5;
  roiCtx.setLineDash([6, 4]);
  roiCtx.strokeRect(rx, ry, rw, rh);
  roiCtx.setLineDash([]);

  // Label ROI tag
  roiCtx.fillStyle = '#38bdf8';
  roiCtx.font = '10px monospace';
  roiCtx.fillText(`ROI DATA REGION [${activePreset.id}]`, rx + 6, ry + 14);
}

// -------------------------------------------------------------
// Real-time Visual Analysis Pipeline (10-15 Hz)
// -------------------------------------------------------------
function analyzeCurrentFrame(now: number): void {
  if (now - lastTickTime < tickIntervalMs) return;
  lastTickTime = now;
  frameCount++;

  const source = mediaSourceSelect.value === 'synthetic' ? simulationCanvas : playerVideo;
  const sourceW = source instanceof HTMLVideoElement ? source.videoWidth || 640 : source.width;
  const sourceH = source instanceof HTMLVideoElement ? source.videoHeight || 360 : source.height;

  const roi = activePreset.roi;
  const sx = Math.max(0, Math.floor(roi[0] * sourceW));
  const sy = Math.max(0, Math.floor(roi[1] * sourceH));
  const sw = Math.min(sourceW - sx, Math.floor(roi[2] * sourceW));
  const sh = Math.min(sourceH - sy, Math.floor(roi[3] * sourceH));

  if (sw <= 0 || sh <= 0) return;

  // Downsample to 32x32 offscreen canvas
  offscreenCtx.drawImage(source, sx, sy, sw, sh, 0, 0, 32, 32);
  const imgData = offscreenCtx.getImageData(0, 0, 32, 32);
  const currentBuffer = imgData.data;

  const ignoreDark = activePreset.ignoreDark ?? 0.05;

  // 1. Luminance
  const brightness = calculateAverageLuminance(currentBuffer, { ignoreDark });

  // 2. Color & Hue Histogram
  const colorMetrics = extractColorMetrics(currentBuffer, { ignoreDark });

  // 3. Legend-Calibrated Measurement
  const dataValue = calculateAverageLegendValue(currentBuffer, preparedLut);

  // 4. Regional Grid (4x8)
  const regions = calculateRegionGrid(
    currentBuffer,
    { rows: 4, cols: 8, width: 32, height: 32, ignoreDark },
    preparedLut
  );

  // 5. Motion Delta & Event Bursts
  const motionRes = calculateMotionAndEvents(
    currentBuffer,
    previousBuffer,
    32,
    32,
    cellBaselines,
    {
      detectEvents: activePreset.events?.detect ?? null,
      eventThreshold: activePreset.events?.threshold ?? 0.20,
      baselineAlpha: activePreset.events?.baselineAlpha ?? 0.05
    }
  );

  // Cache buffer for next motion delta
  if (!previousBuffer || previousBuffer.length !== currentBuffer.length) {
    previousBuffer = new Uint8ClampedArray(currentBuffer);
  } else {
    previousBuffer.set(currentBuffer);
  }

  // 6. Caldwell-73 Scanner Profile
  const profile = calculateSpatialProfiles(currentBuffer, 32, 32, 32);

  // 7. Emit standard EJB CustomEvent on window
  const payload: EjbFramePayload = {
    v: 1,
    t: round3(currentTime),
    frameIndex: frameCount,
    vizId: activePreset.id,
    metrics: {
      brightness,
      dominantColor: colorMetrics.dominantColor,
      hue: colorMetrics.hue,
      saturation: colorMetrics.saturation,
      dataValue,
      motion: motionRes.motion,
      regions
    },
    flags: {
      seeked: false,
      scene_cut: motionRes.sceneCut
    },
    events: motionRes.events.length > 0 ? motionRes.events : undefined,
    profile
  };

  window.dispatchEvent(
    new CustomEvent<EjbFramePayload>('ejb:frame', {
      detail: payload,
      bubbles: true,
      composed: true
    })
  );

  // Update UI Elements
  updateDashboard(payload);
}

function updateDashboard(p: EjbFramePayload): void {
  valLuma.textContent = p.metrics.brightness.toFixed(3);
  meterLuma.style.width = `${Math.round(p.metrics.brightness * 100)}%`;

  if (p.metrics.dataValue !== null) {
    // Un-normalize to physical units if legend defined
    if (activePreset.legend && activePreset.legend.min !== undefined && activePreset.legend.max !== undefined) {
      const realVal = activePreset.legend.min + p.metrics.dataValue * (activePreset.legend.max - activePreset.legend.min);
      valPhysical.textContent = `${realVal.toFixed(1)} ${activePreset.legend.unit ?? ''}`;
    } else {
      valPhysical.textContent = p.metrics.dataValue.toFixed(3);
    }
  } else {
    valPhysical.textContent = `${(p.metrics.brightness * 100).toFixed(0)}% (approx)`;
  }

  valHue.textContent = `${Math.round(p.metrics.hue * 360)}°`;
  valSat.textContent = `Sat: ${Math.round(p.metrics.saturation * 100)}%`;
  const dc = p.metrics.dominantColor;
  valColorSwatch.style.backgroundColor = `rgb(${Math.round(dc.r * 255)}, ${Math.round(dc.g * 255)}, ${Math.round(dc.b * 255)})`;

  valMotion.textContent = p.metrics.motion.toFixed(3);
  meterMotion.style.width = `${Math.round(p.metrics.motion * 100)}%`;

  // Update 4x8 heatmap cells
  const bGrid = p.metrics.regions.brightness;
  for (let i = 0; i < 32; i++) {
    const cell = document.getElementById(`cell-${i}`);
    if (cell) {
      const b = bGrid[i] ?? 0;
      cell.style.backgroundColor = `rgba(56, 189, 248, ${0.1 + b * 0.85})`;
    }
  }

  // Raw JSON Inspector
  jsonPayloadView.textContent = JSON.stringify(p, null, 2);
}

// -------------------------------------------------------------
// Web Audio Synthesizer (Powered by EarthJukeboxAudioEngine)
// -------------------------------------------------------------
function initAudioEngine(): void {
  audioEngine.start();
  audioStatusBadge.textContent = 'Audio: Live (Web Audio - Pranav)';
  audioStatusBadge.classList.add('active');
}

function setupAudioVisualizerLoop(): void {
  function renderScope() {
    requestAnimationFrame(renderScope);
    const w = audioVisualizer.width;
    const h = audioVisualizer.height;

    visCtx.fillStyle = '#060b17';
    visCtx.fillRect(0, 0, w, h);

    const analyser = audioEngine.getAnalyserNode();
    if (!analyser) {
      visCtx.strokeStyle = '#223254';
      visCtx.lineWidth = 1.5;
      visCtx.beginPath();
      visCtx.moveTo(0, h / 2);
      visCtx.lineTo(w, h / 2);
      visCtx.stroke();
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    visCtx.lineWidth = 2;
    visCtx.strokeStyle = '#38bdf8';
    visCtx.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) visCtx.moveTo(x, y);
      else visCtx.lineTo(x, y);
      x += sliceWidth;
    }

    visCtx.lineTo(w, h / 2);
    visCtx.stroke();
  }
  requestAnimationFrame(renderScope);
}

// -------------------------------------------------------------
// Playback Loop & Event Handlers
// -------------------------------------------------------------
let animFrameId: number | null = null;

function loop(timestamp: number): void {
  if (!isPlaying) return;

  if (mediaSourceSelect.value === 'synthetic') {
    currentTime += 1 / 60;
    if (currentTime > 60) currentTime = 0;
    timeSlider.value = String(currentTime);
    updateTimeDisplay();
    drawSimulation(currentTime);
  } else {
    currentTime = playerVideo.currentTime;
    timeSlider.value = String(currentTime);
    updateTimeDisplay();
  }

  analyzeCurrentFrame(timestamp);
  animFrameId = requestAnimationFrame(loop);
}

function updateTimeDisplay(): void {
  const curMin = Math.floor(currentTime / 60);
  const curSec = Math.floor(currentTime % 60);
  timeDisplay.textContent = `${String(curMin).padStart(2, '0')}:${String(curSec).padStart(2, '0')} / 01:00`;
}

function setupEventListeners(): void {
  playPauseBtn.addEventListener('click', () => {
    isPlaying = !isPlaying;
    if (isPlaying) {
      audioEngine.start();
      audioStatusBadge.textContent = 'Audio: Live (Web Audio - Pranav)';
      audioStatusBadge.classList.add('active');
      playPauseBtn.textContent = '⏸ Pause Sonification';
      playPauseBtn.classList.add('active');
      if (mediaSourceSelect.value !== 'synthetic') {
        playerVideo.play();
      }
      animFrameId = requestAnimationFrame(loop);
    } else {
      audioEngine.pause();
      audioStatusBadge.textContent = 'Audio: Paused';
      audioStatusBadge.classList.remove('active');
      playPauseBtn.textContent = '▶ Start Sonification';
      playPauseBtn.classList.remove('active');
      if (mediaSourceSelect.value !== 'synthetic') {
        playerVideo.pause();
      }
      if (animFrameId) cancelAnimationFrame(animFrameId);
    }
  });

  resetBtn.addEventListener('click', () => {
    currentTime = 0;
    timeSlider.value = '0';
    if (mediaSourceSelect.value !== 'synthetic') {
      playerVideo.currentTime = 0;
    }
    updateTimeDisplay();
    drawSimulation(0);
  });

  timeSlider.addEventListener('input', () => {
    currentTime = parseFloat(timeSlider.value);
    if (mediaSourceSelect.value !== 'synthetic') {
      playerVideo.currentTime = currentTime;
    }
    updateTimeDisplay();
    drawSimulation(currentTime);
  });

  volumeSlider.addEventListener('input', () => {
    audioEngine.setMasterVolume(parseFloat(volumeSlider.value));
  });

  demoModeSelect.addEventListener('change', () => {
    audioEngine.setMode(demoModeSelect.value as SonificationMode);
  });

  demoPresetSelect.addEventListener('change', () => {
    activePreset = PRESETS[demoPresetSelect.value];
    updatePresetInfo();
    drawSimulation(currentTime);
  });

  mediaSourceSelect.addEventListener('change', () => {
    const val = mediaSourceSelect.value;
    if (val === 'synthetic') {
      simulationCanvas.classList.remove('hidden');
      playerVideo.classList.add('hidden');
      urlInputContainer.classList.add('hidden');
      fileInputContainer.classList.add('hidden');
    } else if (val === 'url') {
      simulationCanvas.classList.add('hidden');
      playerVideo.classList.remove('hidden');
      urlInputContainer.classList.remove('hidden');
      fileInputContainer.classList.add('hidden');
    } else if (val === 'upload') {
      simulationCanvas.classList.add('hidden');
      playerVideo.classList.remove('hidden');
      urlInputContainer.classList.add('hidden');
      fileInputContainer.classList.remove('hidden');
    }
    drawRoiOverlay();
  });

  loadUrlBtn.addEventListener('click', () => {
    const url = videoUrlInput.value.trim();
    if (url) {
      playerVideo.src = url;
      playerVideo.load();
    }
  });

  videoFileInput.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      playerVideo.src = URL.createObjectURL(file);
      playerVideo.load();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
