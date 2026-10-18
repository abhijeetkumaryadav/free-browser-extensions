/* Stream Delay Sync Tuner — service worker.
 * Owns the session lifecycle: one active tab capture at a time.
 * The tab's native output is muted while the delayed stream plays,
 * preventing the original + delayed audio from doubling up. */
'use strict';

const OFFSCREEN_URL = 'offscreen.html';
let session = null; // { tabId } when a capture is active

// Create the offscreen audio engine on demand (MV3 service workers have no AudioContext).
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture the current tab audio and route it through an adjustable WebAudio delay for lip-sync correction.'
  });
}

// Stop any running session; optionally restore the tab's native audio.
async function stopSession(unmute = true) {
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', action: 'stop' });
  } catch (_) { /* offscreen doc may not exist */ }
  if (session && unmute) {
    try { await chrome.tabs.update(session.tabId, { muted: false }); } catch (_) { /* tab gone */ }
  }
  session = null;
}

async function startSession(tabId, delayMs) {
  await stopSession(false); // replace any previous session silently
  await ensureOffscreen();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  // Mute the tab's direct output so only the delayed stream is heard (no echo).
  await chrome.tabs.update(tabId, { muted: true });
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', action: 'start', streamId, delayMs });
  if (!res || !res.ok) {
    try { await chrome.tabs.update(tabId, { muted: false }); } catch (_) {}
    throw new Error((res && res.error) || 'Audio engine failed to start.');
  }
  session = { tabId };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.target === 'offscreen') return; // routed to the offscreen document
  (async () => {
    if (msg.action === 'start') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) throw new Error('No active tab found.');
      if (!/^https?:/.test(tab.url || '')) {
        throw new Error('Open a regular web page (not a browser page) to tune its audio.');
      }
      await startSession(tab.id, msg.delayMs);
      sendResponse({ ok: true });
    } else if (msg.action === 'stop') {
      await stopSession(true);
      sendResponse({ ok: true });
    } else if (msg.action === 'setDelay') {
      await chrome.runtime.sendMessage({ target: 'offscreen', action: 'setDelay', delayMs: msg.delayMs });
      sendResponse({ ok: true });
    } else if (msg.action === 'status') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      sendResponse({ ok: true, active: !!session, activeTabId: session ? session.tabId : null, tabId: tab ? tab.id : null });
    }
  })().catch(err => sendResponse({ ok: false, error: String((err && err.message) || err) }));
  return true; // async response
});

// If the captured tab is closed, tear down the audio graph (nothing to unmute).
chrome.tabs.onRemoved.addListener(tabId => {
  if (session && session.tabId === tabId) stopSession(false);
});
