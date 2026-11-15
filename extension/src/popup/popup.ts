/**
 * Earth Jukebox (EJB) — Popup Launcher Controller
 * Specification: Amendment B, Section 6a & Gate B5
 *
 * Lightweight launcher (~360px) without raw metric leakage.
 * Coordinates play/pause, mode selection, on-page panel activation,
 * and link to the Listening Room.
 */

import { createUiViewModel, type UiMode } from '../ui/view-model';

let activeTabId: number | null = null;
let pollTimer: number | null = null;

const statusBadge = document.getElementById('statusBadge') as HTMLElement;
const sourceTitle = document.getElementById('sourceTitle') as HTMLElement;
const provenanceChip = document.getElementById('provenanceChip') as HTMLElement;
const chipIcon = document.getElementById('chipIcon') as HTMLElement;
const chipText = document.getElementById('chipText') as HTMLElement;
const emptyState = document.getElementById('emptyState') as HTMLElement;
const mainControls = document.getElementById('mainControls') as HTMLElement;
const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;
const toggleIcon = document.getElementById('toggleIcon') as HTMLElement;
const toggleBtnText = document.getElementById('toggleBtnText') as HTMLElement;
const modeGroup = document.querySelector('.ejb-mode-group') as HTMLElement;
const modeDesc = document.getElementById('modeDesc') as HTMLElement;
const openPanelBtn = document.getElementById('openPanelBtn') as HTMLButtonElement;
const openDemoBtn = document.getElementById('openDemoBtn') as HTMLButtonElement;
const openDemoBtnEmpty = document.getElementById('openDemoBtnEmpty') as HTMLButtonElement;
const srAnnouncer = document.getElementById('srAnnouncer') as HTMLElement;

async function initPopup(): Promise<void> {
  setupButtons();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showEmptyState('No active tab');
    return;
  }
  activeTabId = tab.id;

  fetchStatus();
  pollTimer = window.setInterval(fetchStatus, 500);
}

function showEmptyState(reason: string): void {
  statusBadge.textContent = reason;
  statusBadge.classList.remove('active');
  emptyState.style.display = 'block';
  mainControls.style.display = 'none';
  sourceTitle.textContent = 'No NASA visualization detected';
  provenanceChip.style.display = 'none';
}

function fetchStatus(): void {
  if (!activeTabId) return;

  chrome.tabs.sendMessage(activeTabId, { type: 'GET_STATUS' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      showEmptyState('Inactive');
      return;
    }

    if (!res.hasMedia && !res.isActive) {
      showEmptyState('No video');
      return;
    }

    emptyState.style.display = 'none';
    mainControls.style.display = 'flex';
    provenanceChip.style.display = 'inline-flex';

    // Map into UiViewModel
    const vm = createUiViewModel({
      payload: res.lastPayload,
      preset: res.activePreset,
      mappingProfile: res.mappingProfile,
      telemetry: res.telemetry,
      engineState: {
        isSonifying: res.isActive,
        mode: res.mode
      },
      mediaState: {
        hasMedia: res.hasMedia,
        isPlaying: res.isMediaPlaying ?? res.isActive,
        currentTime: res.t ?? 0
      }
    });

    // Update Status Badge
    if (res.isActive && res.isMediaPlaying) {
      statusBadge.textContent = 'Live';
      statusBadge.classList.add('active');
    } else {
      statusBadge.textContent = 'Ready';
      statusBadge.classList.remove('active');
    }

    // Update Title & Chip
    sourceTitle.textContent = vm.source.title;
    chipIcon.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12">${vm.provenance.iconSvg}</svg>`;
    chipText.textContent = vm.provenance.label;
    provenanceChip.title = vm.provenance.description;

    // Update Main Button
    const isPlaying = vm.transport.isPlaying;
    toggleBtn.classList.toggle('active', isPlaying);
    toggleBtn.setAttribute('aria-pressed', String(isPlaying));
    toggleIcon.textContent = isPlaying ? '⏸' : '▶';
    toggleBtnText.textContent = isPlaying ? 'Pause sonification' : 'Start listening';

    // Update Mode Group
    modeDesc.textContent = vm.mode.description;
    modeGroup.querySelectorAll('.ejb-mode-btn').forEach((btn) => {
      const mode = (btn as HTMLElement).dataset.mode;
      const active = mode === vm.mode.active;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  });
}

function setupButtons(): void {
  // Main Play / Pause
  toggleBtn.addEventListener('click', () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_SONIFICATION' }, () => {
      fetchStatus();
    });
  });

  // Mode Selection
  modeGroup.querySelectorAll('.ejb-mode-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (!activeTabId) return;
      const target = e.currentTarget as HTMLElement;
      const mode = target.dataset.mode as UiMode;
      const internalMode = mode === 'exact' ? 'scientific' : mode === 'sweep' ? 'scanner' : 'raaga';

      chrome.tabs.sendMessage(activeTabId, { type: 'SET_MODE', mode: internalMode }, () => {
        fetchStatus();
        announce(`Sonification mode set to ${mode}`);
      });
    });
  });

  // Open In-Page Listening Panel
  openPanelBtn.addEventListener('click', () => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, { type: 'TOGGLE_PANEL' }, () => {
      window.close(); // Close popup so user interacts with in-page panel
    });
  });

  // Open Listening Room
  const openDemoStudio = () => {
    const demoUrl = chrome.runtime.getURL('demo-page/dist/index.html');
    chrome.tabs.create({ url: demoUrl });
  };
  openDemoBtn.addEventListener('click', openDemoStudio);
  openDemoBtnEmpty.addEventListener('click', openDemoStudio);
}

function announce(msg: string): void {
  if (srAnnouncer) srAnnouncer.textContent = msg;
}

window.addEventListener('unload', () => {
  if (pollTimer) clearInterval(pollTimer);
});

document.addEventListener('DOMContentLoaded', initPopup);
