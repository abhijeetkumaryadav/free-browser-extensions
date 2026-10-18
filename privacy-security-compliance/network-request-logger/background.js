/* Network Request Logger — background service worker.
 *
 * READ-ONLY design: we register non-blocking webRequest listeners purely to
 * observe. We never return {cancel:true} and never modify requests.
 *
 * Honest limitation: the service worker can sleep between events. Event
 * listeners wake it, so capture is normally complete, but a request that
 * fires in the exact moment of worker shutdown/restart may be missed.
 */

const MAX_ENTRIES_PER_TAB = 400;

// tabId -> array of request records (newest last)
const logs = new Map();
// requestId -> partial record (start info until completion)
const inflight = new Map();

/** Trim a URL for display/storage safety. */
function shortUrl(url) {
  return url.length > 1200 ? url.slice(0, 1200) + '…' : url;
}

// --- Capture start of each request ----------------------------------------
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    inflight.set(details.requestId, {
      id: details.requestId,
      tabId: details.tabId,
      method: details.method,
      url: shortUrl(details.url),
      type: details.type,
      start: details.timeStamp,
      status: null,
      size: null,
      ms: null,
      error: null,
    });
  },
  { urls: ['<all_urls>'] }
);

// --- Capture size from response headers ------------------------------------
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const rec = inflight.get(details.requestId);
    if (!rec) return;
    const headers = details.responseHeaders || [];
    const len = headers.find((h) => h.name.toLowerCase() === 'content-length');
    if (len && /^\d+$/.test(len.value)) rec.size = parseInt(len.value, 10);
    rec.status = details.statusCode;
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// --- Completion / error ------------------------------------------------------
function finalize(requestId, ok, errorText) {
  const rec = inflight.get(requestId);
  inflight.delete(requestId);
  if (!rec || rec.tabId < 0) return; // ignore non-tab requests
  rec.ms = Math.max(0, Math.round(Date.now() - rec.start));
  if (!ok) rec.error = errorText || 'failed';
  const list = logs.get(rec.tabId) || [];
  list.push(rec);
  if (list.length > MAX_ENTRIES_PER_TAB) list.splice(0, list.length - MAX_ENTRIES_PER_TAB);
  logs.set(rec.tabId, list);
}

chrome.webRequest.onCompleted.addListener(
  (details) => finalize(details.requestId, true),
  { urls: ['<all_urls>'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => finalize(details.requestId, false, details.error),
  { urls: ['<all_urls>'] }
);

// --- Housekeeping: drop logs when a tab closes ------------------------------
chrome.tabs.onRemoved.addListener((tabId) => {
  logs.delete(tabId);
});

// --- Popup messaging ---------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getLog') {
    const list = logs.get(msg.tabId) || [];
    sendResponse({ entries: list.slice().reverse() }); // newest first
    return true;
  }
  if (msg.type === 'clearLog') {
    logs.delete(msg.tabId);
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
