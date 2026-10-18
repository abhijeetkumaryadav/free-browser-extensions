// Tab Audio Channel Splitter & Mixer — background service worker.
//
// Owns the lifecycle of the offscreen document (the only place MV3 lets us
// run a Web Audio graph) and relays popup commands to it. Only one tab is
// processed at a time; enabling a new tab cleanly stops the previous one.

const OFFSCREEN_PATH = "offscreen.html";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let activeTabId = null; // tab currently being processed (null = mixer off)

// ---------------------------------------------------------------------------
// Offscreen document helpers
// ---------------------------------------------------------------------------
async function hasOffscreenDocument() {
  // Chrome 116+: query existing offscreen contexts.
  if (!chrome.offscreen.hasDocument) return false;
  return await chrome.offscreen.hasDocument();
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    // AUDIO_PLAYBACK keeps the document alive while audio is routed.
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Route the captured tab audio through a Web Audio graph for channel mixing."
  });
}

// ---------------------------------------------------------------------------
// Mixer control
// ---------------------------------------------------------------------------
async function startMixer(tabId, settings) {
  await ensureOffscreenDocument();
  activeTabId = tabId;
  // Mute the tab's native output so we don't hear both raw + processed audio.
  await chrome.tabs.update(tabId, { muted: true }).catch(() => {});
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "start",
    tabId,
    settings
  });
  await chrome.storage.session.set({ activeTabId });
}

async function stopMixer() {
  if (activeTabId !== null) {
    // Restore the tab's native audio before tearing down the graph.
    await chrome.tabs.update(activeTabId, { muted: false }).catch(() => {});
  }
  activeTabId = null;
  await chrome.storage.session.set({ activeTabId: null });
  if (await hasOffscreenDocument()) {
    await chrome.runtime
      .sendMessage({ target: "offscreen", type: "stop" })
      .catch(() => {});
    // Give the offscreen doc a moment to release tracks, then close it.
    setTimeout(async () => {
      if (await hasOffscreenDocument()) {
        await chrome.offscreen.closeDocument().catch(() => {});
      }
    }, 500);
  }
}

async function updateMixer(settings) {
  if (activeTabId === null) return;
  await chrome.runtime
    .sendMessage({ target: "offscreen", type: "update", settings })
    .catch(() => {});
}

// If the processed tab is closed or navigates away, stop cleanly.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) stopMixer();
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.status === "loading") stopMixer();
});

// ---------------------------------------------------------------------------
// Popup <-> background messages
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "mixer-start":
          await startMixer(msg.tabId, msg.settings);
          sendResponse({ ok: true });
          break;
        case "mixer-stop":
          await stopMixer();
          sendResponse({ ok: true });
          break;
        case "mixer-update":
          await updateMixer(msg.settings);
          sendResponse({ ok: true });
          break;
        case "mixer-stream-ended":
          // Capture stream died (tab closed / navigated): release everything.
          await stopMixer();
          sendResponse({ ok: true });
          break;
        case "mixer-status": {
          const { activeTabId: id } = await chrome.storage.session.get("activeTabId");
          sendResponse({ ok: true, activeTabId: id ?? null });
          break;
        }
        default:
          sendResponse({ ok: false, error: "unknown message" });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message || err) });
    }
  })();
  return true; // async response
});
