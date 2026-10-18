/* BoostLab background service worker.
 * Routes popup commands to the offscreen audio engine and owns tab mute state.
 * Audio is processed live and never recorded, stored, or transmitted anywhere.
 */

const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen = null;

/** Create the offscreen document if one is not already open. */
async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (existing.length > 0) return;
  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }
  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['AUDIO_PLAYBACK'],
    justification:
      'Capture the active tab audio and route it through a volume boost + compressor chain.',
  });
  await creatingOffscreen;
  creatingOffscreen = null;
}

/** Close the offscreen document if one is open. */
async function closeOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (existing.length === 0) return;
  try {
    await chrome.offscreen.closeDocument();
  } catch (e) {
    /* already closed */
  }
}

/** Forward a command to the offscreen audio engine. */
async function sendToOffscreen(message) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({ ...message, target: 'offscreen' });
}

async function setBadge(on) {
  if (on) {
    await chrome.action.setBadgeText({ text: 'ON' });
    await chrome.action.setBadgeBackgroundColor({ color: '#f97316' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

async function saveState(patch) {
  const { boostlab } = await chrome.storage.local.get('boostlab');
  const next = {
    enabled: false,
    tabId: null,
    boost: 150,
    bypass: false,
    ...(boostlab || {}),
    ...patch,
  };
  await chrome.storage.local.set({ boostlab: next });
  return next;
}

function isSupportedTab(tab) {
  return (
    tab &&
    tab.id != null &&
    tab.url &&
    !/^(chrome|chrome-extension|edge|about|chrome-search):/.test(tab.url)
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.target === 'offscreen') return; // handled by the offscreen document
  (async () => {
    try {
      switch (msg.type) {
        case 'enable': {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!isSupportedTab(tab)) {
            sendResponse({
              ok: false,
              error: 'BoostLab cannot run here — open a regular website tab first.',
            });
            return;
          }
          const res = await sendToOffscreen({
            type: 'offscreen-start',
            tabId: tab.id,
            boost: msg.boost ?? 150,
          });
          if (res && res.ok) {
            // Mute the tab's native output so the processed stream does not
            // double up with the original. The capture stream keeps flowing.
            await chrome.tabs.update(tab.id, { muted: true });
            await saveState({
              enabled: true,
              tabId: tab.id,
              boost: msg.boost ?? 150,
              bypass: false,
            });
            await setBadge(true);
          }
          sendResponse(res || { ok: false, error: 'No response from audio engine.' });
          break;
        }
        case 'disable': {
          const { boostlab } = await chrome.storage.local.get('boostlab');
          await sendToOffscreen({ type: 'offscreen-stop' });
          await closeOffscreenDocument();
          if (boostlab && boostlab.tabId != null) {
            try {
              await chrome.tabs.update(boostlab.tabId, { muted: false });
            } catch (e) {
              /* tab may be gone */
            }
          }
          await saveState({ enabled: false, tabId: null, bypass: false });
          await setBadge(false);
          sendResponse({ ok: true });
          break;
        }
        case 'setBoost': {
          await sendToOffscreen({ type: 'offscreen-boost', boost: msg.boost });
          await saveState({ boost: msg.boost });
          sendResponse({ ok: true });
          break;
        }
        case 'setBypass': {
          await sendToOffscreen({ type: 'offscreen-bypass', bypass: msg.bypass });
          await saveState({ bypass: msg.bypass });
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown command.' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String((err && err.message) || err) });
    }
  })();
  return true; // async response
});

// If the boosted tab closes, tear everything down so state cannot go stale.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { boostlab } = await chrome.storage.local.get('boostlab');
  if (boostlab && boostlab.enabled && boostlab.tabId === tabId) {
    try {
      await sendToOffscreen({ type: 'offscreen-stop' });
    } catch (e) {}
    try {
      await closeOffscreenDocument();
    } catch (e) {}
    await saveState({ enabled: false, tabId: null, bypass: false });
    await setBadge(false);
  }
});
