// BrakeTime background service worker.
// Injects the brake content script on navigation to parent-configured domains.
// Friction only: nothing is blocked, filtered, or reported anywhere.

const DEFAULT_DOMAINS = ["youtube.com", "tiktok.com", "instagram.com", "roblox.com"];

function hostMatches(url, domains) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((d) => host === d || host.endsWith("." + d));
  } catch {
    return false;
  }
}

async function maybeInject(tabId, url) {
  if (!url || !/^https?:/.test(url)) return;
  const { domains = DEFAULT_DOMAINS } = await chrome.storage.local.get("domains");
  if (hostMatches(url, domains)) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } catch {
      // tab may have closed or page may be restricted — harmless
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") maybeInject(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    maybeInject(tabId, tab.url);
  } catch { /* ignore */ }
});
