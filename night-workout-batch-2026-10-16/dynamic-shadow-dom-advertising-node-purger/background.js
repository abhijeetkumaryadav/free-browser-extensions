// Ad-Node Purger — service worker. Currently a no-op placeholder kept for
// future scheduled re-scans. All work happens via click-only scripting.
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['customSelectors'], (res) => {
    if (!res.customSelectors) chrome.storage.local.set({ customSelectors: [] });
  });
});
