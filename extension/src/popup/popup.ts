import type { PresetConfig, EjbFramePayload } from '../contract/types';
import { PRESETS } from '../presets';

let activeTabId: number | null = null;
let pollTimer: number | null = null;

const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
const toggleBtnText = document.getElementById('toggleBtnText') as HTMLSpanElement;
const statusBadge = document.getElementById('statusBadge') as HTMLSpanElement;
const srAnnouncer = document.getElementById('srAnnouncer') as HTMLDivElement;
const presetSelect = document.getElementById('presetSelect') as HTMLSelectElement;
const presetDescription = document.getElementById('presetDescription') as HTMLParagraphElement;
const soundLegendText = document.getElementById('soundLegendText') as HTMLDivElement;
const modeSelect = document.getElementById('modeSelect') as HTMLSelectElement;
const volumeRange = document.getElementById('volumeRange') as HTMLInputElement;

const metricLuma = document.getElementById('metricLuma') as HTMLSpanElement;
const meterLumaBar = document.getElementById('meterLumaBar') as HTMLDivElement;
const metricDataValue = document.getElementById('metricDataValue') as HTMLSpanElement;
const metricUnit = document.getElementById('metricUnit') as HTMLSpanElement;
const metricHue = document.getElementById('metricHue') as HTMLSpanElement;
const colorSwatch = document.getElementById('colorSwatch') as HTMLDivElement;
const metricMotion = document.getElementById('metricMotion') as HTMLSpanElement;
const meterMotionBar = document.getElementById('meterMotionBar') as HTMLDivElement;
const videoTime = document.getElementById('videoTime') as HTMLElement;
const frameIdx = document.getElementById('frameIdx') as HTMLElement;

async function initPopup(): Promise<void> {
  populatePresets();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    setStatus('inactive', 'No Tab');
    announce('No active NASA tab found.');
    return;
  }
  activeTabId = tab.id;

  setupEvents();
  fetchStatus();

  // Poll status while popup is open to reflect live metrics
  pollTimer = window.setInterval(fetchStatus, 300);
}

function populatePresets(): void {
  presetSelect.innerHTML = '';
  for (const [key, preset] of Object.entries(PRESETS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = preset.name;
    presetSelect.appendChild(opt);
  }
}

function announce(msg: string): void {
  srAnnouncer.textContent = msg;
}

function setStatus(state: 'active' | 'inactive' | 'searching', text: string): void {
  statusBadge.className = 'badge';
  if (state === 'active') {
    statusBadge.classList.add('badge-active');
  } else if (state === 'searching') {
    statusBadge.classList.add('badge-searching');
  } else {
    statusBadge.classList.add('badge-inactive');
  }
  statusBadge.textContent = text;
}

function updateUiState(
  extensionEnabled: boolean,
  isActive: boolean,
  hasMedia: boolean,
  isMediaPlaying: boolean,
  preset: PresetConfig | null
): void {
  if (!extensionEnabled) {
    toggleBtn.classList.remove('btn-active');
    toggleBtn.classList.add('btn-primary');
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtnText.textContent = 'Enable Auto-Sonify';
    setStatus('inactive', 'Disabled');
  } else if (isActive && isMediaPlaying) {
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-active');
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtnText.textContent = 'Sonifying (Click to Pause)';
    setStatus('active', 'Live');
  } else {
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-active');
    toggleBtn.setAttribute('aria-pressed', 'true');
    toggleBtnText.textContent = hasMedia ? 'Auto-Ready (Plays with Video)' : 'Waiting for Video...';
    setStatus(hasMedia ? 'active' : 'searching', hasMedia ? 'Auto-Ready' : 'Searching');
  }

  if (preset) {
    presetSelect.value = preset.id;
    presetDescription.textContent = preset.description;
    if (preset.soundHint) {
      soundLegendText.innerHTML = preset.soundHint;
    }
    if (preset.legend?.unit) {
      metricUnit.textContent = preset.legend.unit;
    } else {
      metricUnit.textContent = 'approximate';
    }
  }
}

function renderMetrics(p: EjbFramePayload): void {
  if (!p || !p.metrics) return;

  metricLuma.textContent = p.metrics.brightness.toFixed(2);
  meterLumaBar.style.width = `${Math.round(p.metrics.brightness * 100)}%`;

  if (p.metrics.dataValue !== null && p.metrics.dataValue !== undefined) {
    metricDataValue.textContent = p.metrics.dataValue.toFixed(2);
  } else {
    metricDataValue.textContent = `${(p.metrics.brightness * 100).toFixed(0)}% (approx)`;
  }

  metricHue.textContent = `Hue: ${Math.round(p.metrics.hue * 360)}°`;
  const dc = p.metrics.dominantColor;
  if (dc) {
    colorSwatch.style.backgroundColor = `rgb(${Math.round(dc.r * 255)}, ${Math.round(dc.g * 255)}, ${Math.round(dc.b * 255)})`;
  }

  metricMotion.textContent = p.metrics.motion.toFixed(2);
  meterMotionBar.style.width = `${Math.round(p.metrics.motion * 100)}%`;

  videoTime.textContent = `${p.t.toFixed(2)}s`;
  frameIdx.textContent = String(p.frameIndex);
}

function fetchStatus(): void {
  if (!activeTabId) return;

  chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      // Content script not loaded or not on NASA page
      setStatus('inactive', 'EIC / SVS only');
      presetDescription.textContent = 'Open an Earth Information Center (earth.gov) or SVS (svs.gsfc.nasa.gov) visualization page.';
      return;
    }

    updateUiState(
      res.extensionEnabled ?? res.isActive,
      res.isActive,
      res.hasMedia,
      res.isMediaPlaying ?? res.isActive,
      res.activePreset
    );

    if (res.mode && modeSelect.value !== res.mode) {
      modeSelect.value = res.mode;
    }

    if (res.lastPayload) {
      renderMetrics(res.lastPayload);
    } else if (res.t !== undefined) {
      videoTime.textContent = `${res.t.toFixed(2)}s`;
      frameIdx.textContent = String(res.frameIndex ?? 0);
    }
  });
}

function setupEvents(): void {
  toggleBtn.addEventListener('click', () => {
    if (!activeTabId) return;

    chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_SONIFICATION' }, (res) => {
      if (chrome.runtime.lastError) {
        announce('Unable to connect to media pipeline on this page.');
        return;
      }
      if (res) {
        updateUiState(
          res.extensionEnabled,
          res.isActive,
          true,
          res.isMediaPlaying ?? res.isActive,
          null
        );
        announce(res.extensionEnabled ? 'Auto-sonification enabled.' : 'Auto-sonification disabled.');
      }
    });
  });

  modeSelect.addEventListener('change', () => {
    if (!activeTabId) return;
    const mode = modeSelect.value;
    chrome.tabs.sendMessage(activeTabId, { type: 'SET_MODE', mode }, () => {
      announce(`Sonification mode set to ${mode}.`);
    });
  });

  volumeRange.addEventListener('input', () => {
    if (!activeTabId) return;
    const volume = parseFloat(volumeRange.value);
    chrome.tabs.sendMessage(activeTabId, { type: 'SET_VOLUME', volume });
  });

  presetSelect.addEventListener('change', () => {
    const selectedId = presetSelect.value;
    const preset = PRESETS[selectedId];
    if (!preset || !activeTabId) return;

    chrome.tabs.sendMessage(
      activeTabId,
      { type: 'SELECT_PRESET', presetId: selectedId },
      (res) => {
        if (res?.success) {
          updateUiState(true, true, true, true, preset);
          announce(`Preset changed to ${preset.name}.`);
        }
      }
    );
  });

  // Listen for broadcast frame updates forwarded to extension
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'POPUP_METRIC_UPDATE' && msg.payload) {
      renderMetrics(msg.payload);
    }
  });
}

window.addEventListener('unload', () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});

document.addEventListener('DOMContentLoaded', initPopup);
