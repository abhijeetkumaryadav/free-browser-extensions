/* Header Tamper Notifier — background service worker.
 * DEFENSIVE ONLY: observes response headers via non-blocking webRequest
 * (never modifies traffic), analyzes security headers per main-frame
 * navigation, and stores a per-tab report for the popup. Badge shows
 * warning count for the tab.
 */
'use strict';

// In-memory per-tab reports (tabId -> report). Regenerated on each navigation.
const reports = new Map();

/* ---------- header analysis ---------- */
function analyzeHeaders(rawHeaders, url) {
  const findings = [];
  const get = (name) => {
    const vals = [];
    for (const h of rawHeaders || []) {
      if (h.name.toLowerCase() === name) vals.push(h.value);
    }
    return vals;
  };
  const has = (name) => get(name).length > 0;
  const isHttps = url.toLowerCase().startsWith('https://');

  const add = (level, title, detail) => findings.push({ level, title, detail });

  // 1. HSTS
  const hsts = get('strict-transport-security');
  if (isHttps) {
    if (!hsts.length) add('warn', 'HSTS missing', 'No Strict-Transport-Security header — the site is more exposed to SSL-stripping/downgrade attacks.');
    else {
      const m = /max-age=(\d+)/i.exec(hsts[0] || '');
      if (!m || parseInt(m[1], 10) < 31536000) add('notice', 'HSTS max-age short', 'max-age is under one year; consider a longer policy.');
      if (!/includeSubDomains/i.test(hsts[0] || '')) add('notice', 'HSTS without includeSubDomains', 'Subdomains are not covered by the HSTS policy.');
    }
  }

  // 2. CSP
  const csp = get('content-security-policy');
  if (!csp.length) {
    add('warn', 'CSP missing', 'No Content-Security-Policy — XSS and injection mitigations rely on it.');
  } else {
    const joined = csp.join('; ');
    if (/unsafe-inline/i.test(joined)) add('warn', 'Weak CSP: unsafe-inline', "Policy allows 'unsafe-inline' — a common sign of a weakened or tampered policy.");
    if (/unsafe-eval/i.test(joined)) add('warn', 'Weak CSP: unsafe-eval', "Policy allows 'unsafe-eval' — weakens script injection defenses.");
    if (/(^|[\s;])\*\s*(;|$)/.test(joined) || /\*['"]/.test(joined)) add('notice', 'CSP wildcard source', 'Policy contains a wildcard source, broadening what can load.');
  }

  // 3. Clickjacking
  const xfo = get('x-frame-options');
  const hasFrameAncestors = csp.some((c) => /frame-ancestors/i.test(c));
  if (!xfo.length && !hasFrameAncestors) add('notice', 'Framing unprotected', 'No X-Frame-Options and no CSP frame-ancestors — page may be embeddable (clickjacking risk).');

  // 4. MIME sniffing
  const xcto = get('x-content-type-options');
  if (!xcto.some((v) => /nosniff/i.test(v))) add('notice', 'X-Content-Type-Options missing', 'Should be "nosniff" to block MIME-type confusion attacks.');

  // 5. Referrer policy
  if (!has('referrer-policy')) add('notice', 'Referrer-Policy missing', 'Referrer leakage behavior is left to browser defaults.');

  // 6. Permissions policy
  if (!has('permissions-policy') && !has('feature-policy')) add('info', 'Permissions-Policy missing', 'Browser features (camera, mic, geolocation) are not explicitly restricted.');

  // 7. Server banner disclosure
  const server = get('server');
  if (server.some((v) => /[\d.]/.test(v) && /apache|nginx|iis|express/i.test(v)))
    add('info', 'Server version disclosed', 'Server header reveals software/version: ' + server[0].slice(0, 60));

  // 8. Cookie flags
  if (isHttps) {
    for (const sc of get('set-cookie')) {
      const low = sc.toLowerCase();
      const name = sc.split('=')[0].slice(0, 40);
      if (!/;\s*secure/.test(low)) add('warn', 'Cookie without Secure flag', 'Cookie "' + name + '" can be sent over plain HTTP.');
      if (!/;\s*httponly/.test(low)) add('notice', 'Cookie without HttpOnly', 'Cookie "' + name + '" is readable by JavaScript (XSS can steal it).');
    }
  }

  // 9. Duplicate security headers with differing values (possible tamper/injection)
  for (const n of ['content-security-policy', 'strict-transport-security', 'x-frame-options']) {
    const vals = get(n);
    if (vals.length > 1 && new Set(vals).size > 1)
      add('warn', 'Conflicting ' + n + ' headers', 'Multiple differing values seen — possible header injection or misconfiguration.');
  }

  const counts = { warn: 0, notice: 0, info: 0 };
  for (const f of findings) counts[f.level]++;
  return {
    url,
    checkedAt: new Date().toISOString(),
    findings,
    counts,
    headers: (rawHeaders || []).map((h) => ({ name: h.name, value: h.value })),
  };
}

/* ---------- webRequest listeners (observe only — never blocking) ---------- */
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type === 'main_frame') {
      reports.delete(details.tabId);
      chrome.action.setBadgeText({ tabId: details.tabId, text: '' });
    }
  },
  { urls: ['<all_urls>'], types: ['main_frame'] }
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== 'main_frame' || details.tabId < 0) return;
    const report = analyzeHeaders(details.responseHeaders, details.url);
    reports.set(details.tabId, report);
    const w = report.counts.warn;
    chrome.action.setBadgeText({ tabId: details.tabId, text: w > 0 ? String(w) : '' });
    chrome.action.setBadgeBackgroundColor({ tabId: details.tabId, color: w > 0 ? '#ff5d6c' : '#22d3ee' });
  },
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['responseHeaders']
);

chrome.tabs.onRemoved.addListener((tabId) => reports.delete(tabId));

/* ---------- popup messaging ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'getReport' && typeof msg.tabId === 'number') {
    sendResponse({ report: reports.get(msg.tabId) || null });
    return true;
  }
});
