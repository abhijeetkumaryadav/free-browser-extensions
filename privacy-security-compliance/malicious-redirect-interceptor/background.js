/* Background service worker: watches navigation commits per tab and pauses
   suspicious rapid cross-domain redirect chains with a warning interstitial.
   Detection is heuristic; the user always decides. Everything stays on-device. */
'use strict';

// --- Config ---------------------------------------------------------------
const WINDOW_MS = 8000;        // chain window after first navigation commit
const MIN_HOPS_FOR_FLAG = 1;   // cross-domain redirect hops needed to flag

// --- State (in-memory; rebuilt on service-worker restart) -----------------
const chains = new Map();      // tabId -> { entries: [{url, time, qualifier}], startTime, fromDomain }
const intercepting = new Set(); // tabIds currently showing our warn page

// --- Helpers ---------------------------------------------------------------
function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

// Cheap eTLD+1 approximation (last two labels). Good enough for hop detection.
function registrable(host) {
  const parts = host.split('.').filter(Boolean);
  return parts.length >= 2 ? parts.slice(-2).join('.') : host;
}

function isWebUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

function isRedirectQualifier(qualifiers) {
  return (qualifiers || []).some(q => q === 'server_redirect' || q === 'client_redirect');
}

async function getSettings() {
  const d = await chrome.storage.local.get({ enabled: true, whitelist: [] });
  d.whitelist = (d.whitelist || []).map(s => String(s).toLowerCase().trim()).filter(Boolean);
  return d;
}

function whitelisted(host, list) {
  const reg = registrable(host);
  return list.some(w => host === w || host.endsWith('.' + w) || reg === w);
}

async function logInterception(from, to, action) {
  const d = await chrome.storage.local.get({ log: [] });
  const log = d.log || [];
  log.unshift({ from, to, action, at: Date.now() });
  await chrome.storage.local.set({ log: log.slice(0, 50) });
}

async function intercept(tabId, fromUrl, toUrl) {
  if (intercepting.has(tabId)) return;
  intercepting.add(tabId);
  const warnUrl = chrome.runtime.getURL('warn.html') +
    '?from=' + encodeURIComponent(fromUrl) +
    '&to=' + encodeURIComponent(toUrl);
  try {
    await chrome.tabs.update(tabId, { url: warnUrl });
    await logInterception(fromUrl, toUrl, 'paused');
  } catch (e) {
    console.warn('Redirect interceptor: could not show warning', e);
    intercepting.delete(tabId);
  }
}

// --- Navigation watcher ----------------------------------------------------
chrome.webNavigation.onCommitted.addListener(async (details) => {
  // Only top-level frame commits.
  if (details.frameId !== 0) return;
  const url = details.url || '';
  if (!isWebUrl(url)) { chains.delete(details.tabId); return; }

  // Ignore our own warning page.
  if (url.startsWith(chrome.runtime.getURL('warn.html'))) return;

  const host = hostOf(url);
  const now = Date.now();
  const redirect = isRedirectQualifier(details.transitionQualifiers);

  let chain = chains.get(details.tabId);
  const freshNavigation = !chain || (now - chain.startTime > WINDOW_MS) || !redirect;
  if (freshNavigation) {
    // Start a new chain on this navigation. Only redirect hops extend it.
    chain = { entries: [{ url, time: now, redirect }], startTime: now, fromDomain: host };
    chains.set(details.tabId, chain);
    return;
  }

  // Continuing chain: record this commit.
  chain.entries.push({ url, time: now, redirect });

  // Count cross-domain redirect hops within the window.
  let hops = 0, lastReg = registrable(chain.entries[0].url ? hostOf(chain.entries[0].url) : '');
  for (const e of chain.entries) {
    if (!e.redirect) continue;
    const r = registrable(hostOf(e.url));
    if (r && r !== lastReg) { hops++; lastReg = r; }
  }

  if (hops >= MIN_HOPS_FOR_FLAG) {
    const { enabled, whitelist } = await getSettings();
    const destReg = registrable(host);
    if (enabled && !whitelisted(host, whitelist) && !whitelisted(destReg, whitelist)) {
      const fromUrl = chain.entries[0].url;
      chains.delete(details.tabId); // don't re-flag after the user continues
      await intercept(details.tabId, fromUrl, url);
    } else {
      chains.delete(details.tabId); // trusted or disabled: stop watching this chain
    }
  }
});

// --- Housekeeping ------------------------------------------------------------
chrome.tabs.onRemoved.addListener((tabId) => {
  chains.delete(tabId);
  intercepting.delete(tabId);
});

// Warn page reports the user's choice so the popup log shows the outcome.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'redirect-choice') {
    logInterception(msg.from, msg.to, msg.action).catch(() => {});
    if (sender.tab && sender.tab.id != null) intercepting.delete(sender.tab.id);
  }
});
