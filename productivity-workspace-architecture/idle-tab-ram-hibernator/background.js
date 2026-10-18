// Idle Tab RAM Hibernator — background service worker.
// Sweeps every minute and discards tabs idle past the user's threshold.
// Discarded tabs restore on click: nothing is ever lost.

const ALARM = "hibernate-check";
const DEFAULTS = { enabled: true, idleMinutes: 30, whitelist: [], hibernated: {}, lastSeen: {} };

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(Object.keys(DEFAULTS));
  await chrome.storage.local.set({ ...DEFAULTS, ...cur });
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
});

// Track tab activity so "idle" is measured even where Tab.lastAccessed is unavailable.
chrome.tabs.onActivated.addListener(async (info) => touch(info.tabId));
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status === "complete" || change.audible !== undefined) touch(tabId);
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const s = await chrome.storage.local.get(["hibernated", "lastSeen"]);
  const h = s.hibernated || {}, seen = s.lastSeen || {};
  delete h[tabId]; delete seen[tabId];
  await chrome.storage.local.set({ hibernated: h, lastSeen: seen });
});

async function touch(tabId) {
  const { lastSeen = {} } = await chrome.storage.local.get("lastSeen");
  lastSeen[tabId] = Date.now();
  await chrome.storage.local.set({ lastSeen });
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function whitelisted(host, list) {
  return list.some((d) => host === d || host.endsWith("." + d));
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) sweep(); });

async function sweep() {
  const { enabled, idleMinutes, whitelist, hibernated, lastSeen } =
    await chrome.storage.local.get(Object.keys(DEFAULTS));
  if (!enabled) return;

  const cutoff = Date.now() - Math.max(5, idleMinutes) * 60_000;
  const tabs = await chrome.tabs.query({});
  const updated = { ...hibernated };
  let changed = false;

  for (const tab of tabs) {
    if (tab.active || tab.pinned || tab.discarded) continue;                 // never the active tab
    if (!tab.url || !/^https?:/.test(tab.url)) continue;                     // web pages only
    const host = hostOf(tab.url);
    if (whitelisted(host, whitelist || [])) continue;                        // respect whitelist
    const lastActive = Math.max(tab.lastAccessed || 0, (lastSeen || {})[tab.id] || 0);
    if (lastActive && lastActive > cutoff) continue;                         // used recently

    try {
      const discarded = await chrome.tabs.discard(tab.id);                   // frees RAM; click restores
      if (discarded && discarded.discarded) {
        updated[tab.id] = {
          title: tab.title || tab.url, url: tab.url, host,
          favIconUrl: tab.favIconUrl || "", at: Date.now(),
        };
        changed = true;
      }
    } catch { /* tab became un-discardable — skip */ }
  }
  if (changed) await chrome.storage.local.set({ hibernated: updated });
}

// Popup messages: sweep now, wake one, wake all.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "sweep-now") { await sweep(); sendResponse({ ok: true }); }
    else if (msg.type === "wake") { await wakeTab(msg.tabId); sendResponse({ ok: true }); }
    else if (msg.type === "wake-all") {
      const { hibernated = {} } = await chrome.storage.local.get("hibernated");
      for (const id of Object.keys(hibernated)) await wakeTab(Number(id));
      sendResponse({ ok: true });
    }
  })();
  return true; // async reply
});

async function wakeTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.discarded) await chrome.tabs.reload(tabId);
  } catch { /* tab closed meanwhile */ }
  const { hibernated = {} } = await chrome.storage.local.get("hibernated");
  delete hibernated[tabId];
  await chrome.storage.local.set({ hibernated });
}
