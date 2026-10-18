/**
 * background.js — service worker for Tab Recorder.
 *
 * Responsibilities:
 *  - own the recording state (recording? since when? audio on/off)
 *  - create / tear down the offscreen document that holds the MediaStream
 *  - receive finished bytes from the offscreen doc and save the WebM
 *    via chrome.downloads, then persist a small "last recording" summary
 *
 * Nothing records unless the user clicks Start in the popup.
 */

const OFFSCREEN_URL = 'offscreen.html';

let recording = false;
let startedAt = 0;
let includeAudio = true;

/** True when an offscreen document is currently alive. */
async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  return contexts.length > 0;
}

/** Create the offscreen recorder document if it is not already alive. */
async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Record the current tab (video + internal audio) with MediaRecorder.'
  });
}

/** Close the offscreen document if one exists. */
async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {
    /* none open — fine */
  }
}

/** Begin a recording of the currently-active tab. */
async function startRecording(withAudio) {
  if (recording) return { ok: false, error: 'Already recording.' };
  includeAudio = withAudio !== false;
  try {
    await ensureOffscreenDocument();
    const result = await chrome.runtime.sendMessage({
      target: 'offscreen', type: 'start', audio: includeAudio
    });
    if (!result || !result.ok) {
      await closeOffscreenDocument();
      return { ok: false, error: (result && result.error) || 'Could not start capture.' };
    }
    recording = true;
    startedAt = Date.now();
    return { ok: true };
  } catch (e) {
    await closeOffscreenDocument();
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** Ask the offscreen doc to stop; it replies with 'recording-data'. */
async function stopRecording() {
  if (!recording) return { ok: false, error: 'Nothing is recording.' };
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' });
    return { ok: true, stopping: true };
  } catch (e) {
    recording = false;
    await closeOffscreenDocument();
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** Assemble the finished bytes into a WebM and trigger the download. */
async function saveRecording(buffers, durationMs) {
  recording = false;
  const blob = new Blob(buffers || [], { type: 'video/webm' });
  const objectUrl = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = 'tab-recording-' + stamp + '.webm';

  try {
    await chrome.downloads.download({ url: objectUrl, filename, saveAs: false });
  } catch (e) {
    /* download blocked; still record the metadata below */
  }

  const info = {
    filename,
    bytes: blob.size,
    durationMs: durationMs || 0,
    includeAudio,
    savedAt: Date.now()
  };
  await chrome.storage.local.set({ lastRecording: info });
  await closeOffscreenDocument();
  // The downloads API has grabbed the URL by now; revoke shortly after.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message) { sendResponse({ ok: false }); return; }
    if (message.type === 'start-recording') {
      sendResponse(await startRecording(message.audio));
    } else if (message.type === 'stop-recording') {
      sendResponse(await stopRecording());
    } else if (message.type === 'get-state') {
      const stored = await chrome.storage.local.get(['lastRecording']);
      sendResponse({
        recording, startedAt, includeAudio,
        lastRecording: stored.lastRecording || null
      });
    } else if (message.type === 'recording-data' && Array.isArray(message.buffers)) {
      await saveRecording(message.buffers, message.durationMs);
      sendResponse({ ok: true });
    } else if (message.type === 'recording-error') {
      recording = false;
      await closeOffscreenDocument();
      await chrome.storage.local.set({ lastError: String(message.error || 'recorder error') });
      sendResponse({ ok: true });
    }
  })();
  return true; // async response
});
