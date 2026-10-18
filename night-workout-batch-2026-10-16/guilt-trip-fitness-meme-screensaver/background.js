/* Idle Motivation New Tab — background service worker.
 * Keeps defaults seeded and the idle detection interval in sync.
 * The new-tab page itself decides what to show via chrome.idle.queryState. */
const DEFAULTS = { enabled: true, idleMinutes: 15 };

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(DEFAULTS);
  const merged = { enabled: cur.enabled !== false, idleMinutes: cur.idleMinutes || 15 };
  await chrome.storage.local.set(merged);
  chrome.idle.setDetectionInterval(merged.idleMinutes * 60);
});

chrome.runtime.onStartup.addListener(async () => {
  const s = await chrome.storage.local.get(DEFAULTS);
  chrome.idle.setDetectionInterval((s.idleMinutes || 15) * 60);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.idleMinutes) {
    chrome.idle.setDetectionInterval(changes.idleMinutes.newValue * 60);
  }
});
