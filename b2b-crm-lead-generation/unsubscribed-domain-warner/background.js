// Unsubscribed Domain Warner — service worker.
// Badges the toolbar icon when a content script reports a blocklist hit.

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "udw-warn" && sender.tab && sender.tab.id != null) {
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: "!" });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#ef4444" });
  }
});

// Clear the badge when the tab starts loading something new.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "loading") chrome.action.setBadgeText({ tabId, text: "" });
});
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
});
