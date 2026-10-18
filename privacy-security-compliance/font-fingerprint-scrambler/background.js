/* Font Fingerprint Scrambler — service worker.
 * Re-applies the font-standardizing stylesheet when the user navigates
 * within (or back to) a site they enabled it for. */

const SAFE_STACK = '"Segoe UI", Arial, "Helvetica Neue", Helvetica, sans-serif';
const SAFE_MONO = '"Courier New", Courier, monospace';
const CSS = `* { font-family: ${SAFE_STACK} !important; }
code, kbd, pre, samp, tt, .mono, [class*="mono"] { font-family: ${SAFE_MONO} !important; }`;

function originOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.origin;
  } catch {
    return null;
  }
}

// Keep one record of which tabs already have the CSS so we don't stack it.
const styledTabs = new Set();

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  const origin = originOf(tab.url);
  if (!origin) return;
  const { sites = {} } = await chrome.storage.local.get("sites");
  if (sites[origin] && !styledTabs.has(tabId)) {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, css: CSS });
      styledTabs.add(tabId);
    } catch {
      // Restricted page (chrome://, web store, …) — nothing to do.
    }
  } else if (!sites[origin] && styledTabs.has(tabId)) {
    try {
      await chrome.scripting.removeCSS({ target: { tabId }, css: CSS });
    } catch { /* already gone */ }
    styledTabs.delete(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => styledTabs.delete(tabId));
