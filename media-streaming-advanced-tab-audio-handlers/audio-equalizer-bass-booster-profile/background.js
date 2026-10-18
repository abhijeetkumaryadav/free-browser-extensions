/* BassLab — service worker.
 * Only job: make sure the offscreen document exists before the popup
 * talks to it. The audio graph itself lives in offscreen.js.
 */

'use strict';

const OFFSCREEN_PATH = 'offscreen.html';

async function hasOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['AUDIO_PLAYBACK'],
    justification: 'Process captured tab audio through the WebAudio equalizer graph.'
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.target !== 'basslab-bg') return;
  if (msg.cmd === 'ensure-offscreen') {
    ensureOffscreen().then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
    );
    return true;
  }
  return false;
});
