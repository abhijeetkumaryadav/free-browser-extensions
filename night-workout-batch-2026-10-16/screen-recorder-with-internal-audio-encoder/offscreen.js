/**
 * offscreen.js — owns the tabCapture stream + MediaRecorder.
 *
 * Why offscreen? In Manifest V3 the popup can close at any moment, and a
 * service worker cannot hold a live MediaStream. The offscreen document
 * lives for the whole recording, then ships raw bytes back to the
 * background worker, which saves the WebM via chrome.downloads.
 */

let stream = null;      // MediaStream from chrome.tabCapture.capture
let recorder = null;    // MediaRecorder encoding the stream
let chunks = [];        // Encoded data chunks, in order
let startedAt = 0;      // Recording start timestamp (ms)

/** Pick the best WebM mime type this browser's MediaRecorder supports. */
function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  for (const mime of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

/** Stop every track of the captured stream and drop references. */
function cleanupStream() {
  if (stream) {
    stream.getTracks().forEach((track) => {
      try { track.stop(); } catch (e) { /* already stopped */ }
    });
    stream = null;
  }
  recorder = null;
}

/**
 * Start capturing the currently-active tab.
 * The browser shows its own allow/deny prompt in the tab; a denial
 * surfaces here as a friendly error, never a silent failure.
 */
async function startCapture(withAudio) {
  if (recorder && recorder.state === 'recording') {
    return { ok: true, already: true };
  }
  try {
    stream = await chrome.tabCapture.capture({ audio: !!withAudio, video: true });
  } catch (e) {
    return { ok: false, error: 'Capture request failed: ' + ((e && e.message) || e) };
  }
  if (!stream) {
    return { ok: false, error: 'Capture was denied. Click "Allow" in the tab prompt, then try again.' };
  }

  // Best-effort quality cap: 1080p30. Ignored where unsupported.
  try {
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.applyConstraints) {
      await videoTrack.applyConstraints({ width: 1920, height: 1080, frameRate: 30 }).catch(() => {});
    }
  } catch (e) { /* constraints are advisory only */ }

  chunks = [];
  const mimeType = pickMimeType();
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5000000 })
      : new MediaRecorder(stream);
  } catch (e) {
    cleanupStream();
    return { ok: false, error: 'MediaRecorder failed: ' + ((e && e.message) || e) };
  }

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  recorder.onerror = (event) => {
    chrome.runtime.sendMessage({
      type: 'recording-error',
      error: String((event && event.error) || event || 'unknown recorder error')
    });
  };

  recorder.start(1000); // emit a chunk every second
  startedAt = Date.now();
  return { ok: true };
}

/**
 * Stop the recorder, then hand the raw bytes to the background worker
 * (which owns chrome.downloads) as structured-cloned ArrayBuffers.
 */
async function stopCapture() {
  if (!recorder) return { ok: false, error: 'Nothing is recording.' };
  const durationMs = Date.now() - startedAt;
  if (recorder.state !== 'inactive') {
    await new Promise((resolve) => {
      recorder.onstop = resolve;
      try { recorder.stop(); } catch (e) { resolve(); }
    });
  }
  const buffers = [];
  for (const chunk of chunks) {
    buffers.push(await chunk.arrayBuffer());
  }
  chunks = [];
  cleanupStream();
  chrome.runtime.sendMessage({ type: 'recording-data', buffers, durationMs });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== 'offscreen') return false;
  if (message.type === 'start') {
    startCapture(message.audio).then(sendResponse);
    return true;
  }
  if (message.type === 'stop') {
    stopCapture().then(sendResponse);
    return true;
  }
  return false;
});
