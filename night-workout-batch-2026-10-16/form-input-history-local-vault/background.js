/* background.js — Form Vault service worker.
   Injects content.js into navigations on user-enabled hosts (MAIN world so it
   can read field values; it still only RUNS where the user opted in). */

const isHttp = (url) => url && /^https?:\/\//i.test(url);

async function maybeInject(tabId, url) {
  if (!isHttp(url)) return;
  const host = new URL(url).hostname;
  const { enabledSites = [] } = await chrome.storage.local.get("enabledSites");
  if (!enabledSites.includes(host)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  } catch { /* tab closed or not scriptable */ }
}

// Inject after a full navigation completes on an enabled host.
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === "complete") maybeInject(tabId, tab.url);
});
