/* Outbound Link Tracker Stripper — background service worker.
 * Aggregates per-session strip counts reported by content scripts.
 * No network access, no data leaves the device. */

const counts = { total: 0, perSite: {} };

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'stripped') {
    counts.total += msg.count || 0;
    counts.perSite[msg.host] = (counts.perSite[msg.host] || 0) + (msg.count || 0);
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'getCounts') {
    sendResponse({ total: counts.total, perSite: counts.perSite });
    return true;
  }
  if (msg.type === 'resetCounts') {
    counts.total = 0;
    counts.perSite = {};
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
