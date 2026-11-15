const toggleBtn = document.getElementById('toggleBtn') as HTMLButtonElement;

let isEnabled = true;

function updateUi(enabled: boolean): void {
  isEnabled = enabled;
  if (enabled) {
    toggleBtn.classList.add('active');
    toggleBtn.setAttribute('aria-checked', 'true');
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.setAttribute('aria-checked', 'false');
  }
}

// 1. Immediately read persisted state from storage
chrome.storage.local.get(['extensionEnabled'], (items) => {
  if (typeof items.extensionEnabled === 'boolean') {
    updateUi(items.extensionEnabled);
  } else {
    updateUi(true);
  }
});

// 2. Immediate synchronous click handler — zero lag
toggleBtn.addEventListener('click', () => {
  const nextState = !isEnabled;
  updateUi(nextState);

  // Persist state in storage
  chrome.storage.local.set({ extensionEnabled: nextState });

  // Notify active tab to start or stop audio immediately
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'SET_ENABLED', enabled: nextState }, (res) => {
        if (!chrome.runtime.lastError && res && typeof res.extensionEnabled === 'boolean') {
          updateUi(res.extensionEnabled);
        }
      });
    }
  });
});

// 3. Query active tab for live status
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' }, (res) => {
      if (!chrome.runtime.lastError && res && typeof res.extensionEnabled === 'boolean') {
        updateUi(res.extensionEnabled);
      }
    });
  }
});
