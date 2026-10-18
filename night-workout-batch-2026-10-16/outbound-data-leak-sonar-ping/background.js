/* Outbound Data Leak Sonar — background service worker.
 * Observes (never blocks, never modifies) outbound requests and keeps a
 * rolling per-tab feed: URL host, request type, first-party vs third-party
 * classification, and tracker-domain matches against a local list.
 * Everything stays on-device. No request bodies are ever read.
 */
importScripts("trackers.js");

const MAX_PER_TAB = 120;          // ring-buffer size per tab
const BADGE_WINDOW = 50;          // recent requests scanned for the badge count

// tabId -> [{ t, url, host, type, firstParty, tracker }]
const buffers = new Map();
// tabId -> main-frame host (captured from main_frame requests, no "tabs" perm needed)
const tabHosts = new Map();

// In-memory mirror of settings; refreshed from storage on start/change.
let enabled = true;
let trackers = [...DEFAULT_TRACKERS];

/* ---------- helpers ---------- */

function hostOf(u) {
  try { return new URL(u).hostname.toLowerCase(); }
  catch { return null; }
}

function matchTracker(host) {
  for (const d of trackers) {
    const dom = d.toLowerCase();
    if (host === dom || host.endsWith("." + dom)) return dom;
  }
  return null;
}

async function loadSettings() {
  try {
    const s = await chrome.storage.local.get(["enabled", "trackers"]);
    enabled = s.enabled !== false;
    trackers = Array.isArray(s.trackers) && s.trackers.length ? s.trackers : [...DEFAULT_TRACKERS];
  } catch { /* storage unavailable: keep defaults */ }
}

async function refreshBadge(tabId) {
  try {
    const buf = buffers.get(tabId) || [];
    const hits = buf.slice(0, BADGE_WINDOW).filter(r => r.tracker).length;
    await chrome.action.setBadgeText({ tabId, text: hits > 0 ? String(hits) : "" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#f43f5e" });
  } catch { /* tab gone */ }
}

/* ---------- request observation ---------- */

function onRequest(details) {
  if (!enabled || details.tabId < 0) return;
  const reqHost = hostOf(details.url);
  if (!reqHost) return;

  // Track the tab's own host from top-level navigations.
  if (details.type === "main_frame") {
    tabHosts.set(details.tabId, reqHost);
    buffers.delete(details.tabId);      // fresh navigation -> fresh feed
    refreshBadge(details.tabId);
    return;
  }

  const tabHost = tabHosts.get(details.tabId);
  const firstParty = !!tabHost && (reqHost === tabHost || reqHost.endsWith("." + tabHost));
  const tracker = matchTracker(reqHost);

  const buf = buffers.get(details.tabId) || [];
  buf.unshift({
    t: Date.now(),
    url: details.url.length > 200 ? details.url.slice(0, 200) + "…" : details.url,
    host: reqHost,
    type: details.type,
    firstParty,
    tracker
  });
  if (buf.length > MAX_PER_TAB) buf.length = MAX_PER_TAB;
  buffers.set(details.tabId, buf);

  if (tracker) refreshBadge(details.tabId);
}

chrome.webRequest.onBeforeRequest.addListener(onRequest, { urls: ["<all_urls>"] });

// Keep per-tab memory tidy.
chrome.tabs.onRemoved.addListener((tabId) => {
  buffers.delete(tabId);
  tabHosts.delete(tabId);
});

// Refresh badge when the user switches tabs.
chrome.tabs.onActivated.addListener(({ tabId }) => refreshBadge(tabId));

/* ---------- lifecycle & messaging ---------- */

chrome.runtime.onInstalled.addListener(async () => {
  const s = await chrome.storage.local.get(["enabled", "trackers"]);
  if (s.enabled === undefined) await chrome.storage.local.set({ enabled: true });
  if (!Array.isArray(s.trackers)) await chrome.storage.local.set({ trackers: [...DEFAULT_TRACKERS] });
  await loadSettings();
});

chrome.runtime.onStartup.addListener(loadSettings);
loadSettings();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled) enabled = changes.enabled.newValue !== false;
  if (changes.trackers && Array.isArray(changes.trackers.newValue)) {
    trackers = changes.trackers.newValue;
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "getFeed") {
      const buf = buffers.get(msg.tabId) || [];
      const thirdParty = buf.filter(r => !r.firstParty).length;
      const trackerHits = buf.filter(r => r.tracker).length;
      sendResponse({
        enabled,
        records: buf.slice(0, 80),
        stats: { total: buf.length, thirdParty, trackerHits },
        trackers
      });
    } else if (msg.type === "setEnabled") {
      enabled = !!msg.enabled;
      await chrome.storage.local.set({ enabled });
      sendResponse({ ok: true });
    } else if (msg.type === "setTrackers") {
      const clean = [...new Set(
        (msg.trackers || []).map(d => String(d).trim().toLowerCase()).filter(Boolean)
      )];
      trackers = clean.length ? clean : [...DEFAULT_TRACKERS];
      await chrome.storage.local.set({ trackers });
      sendResponse({ ok: true, trackers });
    } else if (msg.type === "clearFeed") {
      buffers.delete(msg.tabId);
      refreshBadge(msg.tabId);
      sendResponse({ ok: true });
    }
  })();
  return true; // async response
});
