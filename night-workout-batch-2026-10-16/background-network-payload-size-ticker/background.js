/* Background worker: per-tab byte tally from webRequest events.
 * Request sizes are estimated from method + URL + body bytes.
 * Response sizes come from the Content-Length header when present;
 * when the header is hidden, the response is counted as "unknown size".
 * State is in-memory (a session tally): it resets when the worker sleeps. */

const tabs = {}; // tabId -> { in, out, unknown, requests, hosts: { host -> {in,out,count,unknown} } }

function ensure(tabId) {
  if (!tabs[tabId]) {
    tabs[tabId] = { in: 0, out: 0, unknown: 0, requests: 0, hosts: {}, startedAt: Date.now() };
  }
  return tabs[tabId];
}

function hostOf(url) {
  try { return new URL(url).hostname || '(unknown)'; }
  catch { return '(unknown)'; }
}

// Estimate outbound request size: method + URL + any body bytes.
function estimateRequest(details) {
  let bytes = (details.method || 'GET').length + (details.url || '').length;
  const body = details.requestBody;
  if (body && Array.isArray(body.raw)) {
    for (const part of body.raw) {
      if (part.bytes) bytes += part.bytes.byteLength;
    }
  }
  return bytes;
}

// Inbound size from the Content-Length header; flagged estimated when hidden.
function responseBytes(details) {
  const headers = details.responseHeaders || [];
  for (const h of headers) {
    if (h.name && h.name.toLowerCase() === 'content-length') {
      const n = parseInt(h.value, 10);
      if (!Number.isNaN(n) && n >= 0) return { bytes: n, estimated: false };
    }
  }
  return { bytes: 0, estimated: true };
}

function hostEntry(t, host) {
  if (!t.hosts[host]) t.hosts[host] = { in: 0, out: 0, count: 0, unknown: 0 };
  return t.hosts[host];
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return; // ignore non-tab traffic
    const t = ensure(details.tabId);
    const bytes = estimateRequest(details);
    t.out += bytes;
    t.requests += 1;
    const h = hostEntry(t, hostOf(details.url));
    h.out += bytes;
    h.count += 1;
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0) return;
    const t = ensure(details.tabId);
    const { bytes, estimated } = responseBytes(details);
    t.in += bytes;
    if (estimated) t.unknown += 1;
    const h = hostEntry(t, hostOf(details.url));
    h.in += bytes;
    if (estimated) h.unknown += 1;
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// Popup queries.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'getStats') {
    sendResponse({ stats: tabs[msg.tabId] || null });
    return true;
  }
  if (msg.type === 'resetTab') {
    delete tabs[msg.tabId];
    sendResponse({ ok: true });
    return true;
  }
  return false;
});

// Drop state for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabs[tabId];
});
