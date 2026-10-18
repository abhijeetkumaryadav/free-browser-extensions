/* =====================================================================
 * XHR Request Firewall — background service worker
 *
 * Holds per-tab request logs in memory (never persisted), clears them
 * on navigation/tab close, and mirrors the blocked-request count onto
 * the toolbar badge.
 * ===================================================================== */
'use strict';

const MAX_LOG = 300; // entries kept per tab

/** tabId -> [{ t, type, host, url, blocked }] */
const logs = new Map();

/** Update the toolbar badge with this tab's blocked-request count. */
function updateBadge(tabId) {
  const arr = logs.get(tabId) || [];
  const n = arr.filter((e) => e.blocked).length;
  chrome.action.setBadgeText({ tabId, text: n > 0 ? String(n) : '' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ color: '#f97316' }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  // Log entry relayed from a content script.
  if (msg.kind === 'xrhfw-log' && sender.tab && typeof sender.tab.id === 'number') {
    const id = sender.tab.id;
    if (!logs.has(id)) logs.set(id, []);
    const arr = logs.get(id);
    arr.push({
      t: Date.now(),
      type: msg.type === 'xhr' ? 'xhr' : 'fetch',
      host: String(msg.host || ''),
      url: String(msg.url || ''),
      blocked: !!msg.blocked,
    });
    if (arr.length > MAX_LOG) arr.splice(0, arr.length - MAX_LOG);
    updateBadge(id);
    return false;
  }

  // Popup asks for the current tab's log.
  if (msg.kind === 'xrhfw-get-log' && typeof msg.tabId === 'number') {
    sendResponse({ log: logs.get(msg.tabId) || [] });
    return true;
  }

  // Popup asks to clear the current tab's log.
  if (msg.kind === 'xrhfw-clear-log' && typeof msg.tabId === 'number') {
    logs.set(msg.tabId, []);
    updateBadge(msg.tabId);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

// Fresh top-level navigation → start a new log for that tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    logs.set(tabId, []);
    updateBadge(tabId);
  }
});

// Closed tab → drop its log.
chrome.tabs.onRemoved.addListener((tabId) => {
  logs.delete(tabId);
});
