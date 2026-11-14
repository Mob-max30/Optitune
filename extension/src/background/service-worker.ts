/**
 * Earth Jukebox — Background Service Worker (Manifest V3)
 *
 * Coordinates extension badge, keyboard shortcuts, popup messaging,
 * and offscreen document lifecycle for cross-origin tabCapture.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#0B3D91' }); // NASA blue
  chrome.action.setBadgeText({ text: '' });
  console.log('[EJB Background] Earth Jukebox installed successfully.');
});

// Handle keyboard shortcut (e.g. Alt+Shift+S)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-sonification') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SONIFICATION' }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[EJB Background] Content script not active on this tab:', chrome.runtime.lastError.message);
        } else if (response) {
          updateBadge(tab.id, response.isActive);
        }
      });
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE' && sender.tab?.id) {
    updateBadge(sender.tab.id, message.isActive);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'START_TAB_CAPTURE') {
    handleTabCapture(message.tabId || sender.tab?.id)
      .then((streamId) => sendResponse({ success: true, streamId }))
      .catch((err) => sendResponse({ success: false, error: String(err) }));
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CANVAS_TAINTED_DETECTED') {
    console.warn('[EJB Background] Canvas tainted on tab:', sender.tab?.id, message.url);
    sendResponse({ ack: true });
    return true;
  }
  return false;
});

function updateBadge(tabId: number, isActive: boolean) {
  if (isActive) {
    chrome.action.setBadgeText({ tabId, text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#10B981' }); // Active green
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

async function handleTabCapture(targetTabId?: number): Promise<string> {
  if (!targetTabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error('No active tab available for tabCapture');
    }
    targetTabId = activeTab.id;
  }

  // 1. Obtain capture stream ID
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId });

  // 2. Ensure offscreen document exists
  await ensureOffscreenDocument();

  // 3. Dispatch stream ID to offscreen document
  chrome.runtime.sendMessage({
    type: 'INIT_OFFSCREEN_CAPTURE',
    streamId,
    targetTabId
  });

  return streamId;
}

async function ensureOffscreenDocument(): Promise<void> {
  if ('offscreen' in chrome && chrome.offscreen) {
    const existing = await chrome.offscreen.hasDocument();
    if (!existing) {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.USER_MEDIA],
        justification: 'Capture video stream when direct canvas access is cross-origin tainted'
      });
    }
  }
}
