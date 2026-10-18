/* Gesture Navigation Engine — service worker.
   Handles the one privileged action the content script cannot do itself:
   closing the tab that the gesture was drawn in. The tab id comes from the
   message sender, so no "tabs" permission is needed. */

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["gneEnabled", "gneTrail", "gneMap"]);
  await chrome.storage.local.set({
    gneEnabled: cur.gneEnabled !== undefined ? cur.gneEnabled : true,
    gneTrail: cur.gneTrail !== undefined ? cur.gneTrail : true,
    gneMap: cur.gneMap || null,
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "gne-close-tab" && sender.tab && Number.isInteger(sender.tab.id)) {
    chrome.tabs.remove(sender.tab.id).catch(() => {});
  }
});
