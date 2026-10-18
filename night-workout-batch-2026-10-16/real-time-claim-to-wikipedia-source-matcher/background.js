// Background service worker for Claim Check.
// Keeps the extension MV3-compliant; no alarms or network calls are needed.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['claims'], (res) => {
    if (!Array.isArray(res.claims)) {
      chrome.storage.local.set({ claims: [] });
    }
  });
});
