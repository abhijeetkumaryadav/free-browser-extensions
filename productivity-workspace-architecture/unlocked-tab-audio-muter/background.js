/* Tab Audio Muter — service worker.
 * Enforces the optional "auto-mute background tabs" rule:
 * whenever a non-active tab starts making sound and the user has
 * enabled the preference, mute it immediately. Nothing else runs here. */

// Load the preference into memory and keep it fresh.
let autoMute = false;
chrome.storage.sync.get({ autoMuteBackground: false }, (res) => {
  autoMute = res.autoMuteBackground;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.autoMuteBackground) {
    autoMute = changes.autoMuteBackground.newValue;
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only act when the tab *starts* making sound and the rule is on.
  if (changeInfo.audible !== true || !autoMute) return;
  // Never mute the tab the user is actively viewing.
  if (tab.active) return;
  try {
    await chrome.tabs.update(tabId, { muted: true });
  } catch {
    // Tab may have closed between the event and the update; safe to ignore.
  }
});
