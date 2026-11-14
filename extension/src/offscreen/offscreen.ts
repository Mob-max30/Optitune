/**
 * Offscreen document script for fallback tabCapture stream decoding.
 */

const video = document.getElementById('offscreenVideo') as HTMLVideoElement;
const canvas = document.getElementById('offscreenCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let activeStream: MediaStream | null = null;

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'INIT_OFFSCREEN_CAPTURE' && message.streamId) {
    await startStreamCapture(message.streamId, message.targetTabId);
  }
});

async function startStreamCapture(streamId: string, _targetTabId: number): Promise<void> {
  try {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      } as any
    });

    activeStream = stream;
    video.srcObject = stream;
    await video.play();

    console.log('[EJB Offscreen] Fallback tabCapture stream started');
  } catch (err) {
    console.error('[EJB Offscreen] Failed to acquire tabCapture stream:', err);
  }
}
