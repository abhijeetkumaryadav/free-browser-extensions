// PixelRun — service worker.
// Opens the game page in a new tab when the extension icon action is used
// (kept minimal; the popup is the primary entry point).
chrome.runtime.onInstalled.addListener(() => {
  console.log("[PixelRun] installed");
});
