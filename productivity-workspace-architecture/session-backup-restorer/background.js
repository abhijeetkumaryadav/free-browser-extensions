// Session Backup Restorer — background service worker.
// Takes a snapshot of every window + tab on a 30-minute alarm and
// whenever the browser starts, keeping the newest 20 on-device.
// Tabs that aren't web pages (chrome://, about:, etc.) are recorded
// by title only and skipped on restore — never anything destructive.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ALARM = "session-backup";       // alarm name for periodic snapshots
const MAX_SNAPSHOTS = 20;             // keep newest N snapshots
const STORE_KEY = "snapshots";        // chrome.storage.local key

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(ALARM, { periodInMinutes: 30 });
  await snapshot("installed");        // first snapshot immediately
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.alarms.create(ALARM, { periodInMinutes: 30 });
  await snapshot("startup");          // capture what was there at launch
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) snapshot("auto");
});

// ---------------------------------------------------------------------------
// Snapshot logic
// ---------------------------------------------------------------------------
// Collect the current session: every window and its tabs (URL, title, favicon,
// pinned/active state). Only http(s) tabs can be re-opened; the rest are
// stored as records and skipped on restore.
async function snapshot(source) {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    if (!windows.length) return;

    const windowsData = windows.map((w) => ({
      type: w.type || "normal",
      incognito: !!w.incognito,
      state: w.state || "normal",
      tabs: (w.tabs || []).map((t) => ({
        url: t.url || "",
        title: t.title || t.url || "Untitled",
        pinned: !!t.pinned,
        favIconUrl: t.favIconUrl || "",
      })),
    }));

    const tabCount = windowsData.reduce((n, w) => n + w.tabs.length, 0);
    if (tabCount === 0) return;       // don't record empty sessions

    const entry = {
      id: Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      at: Date.now(),
      source,                        // "auto" | "startup" | "installed" | "manual"
      tabCount,
      windowCount: windowsData.length,
      windows: windowsData,
    };

    const { [STORE_KEY]: list = [] } = await chrome.storage.local.get(STORE_KEY);
    list.unshift(entry);
    await chrome.storage.local.set({ [STORE_KEY]: list.slice(0, MAX_SNAPSHOTS) });
  } catch (err) {
    console.warn("[session-backup] snapshot failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Messages from the popup
// ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "backup-now") {
      await snapshot("manual");
      sendResponse({ ok: true });
    } else if (msg.type === "restore") {
      sendResponse({ ok: await restoreSnapshot(msg.id) });
    } else if (msg.type === "delete") {
      const { [STORE_KEY]: list = [] } = await chrome.storage.local.get(STORE_KEY);
      await chrome.storage.local.set({ [STORE_KEY]: list.filter((s) => s.id !== msg.id) });
      sendResponse({ ok: true });
    }
  })();
  return true; // async reply
});

// ---------------------------------------------------------------------------
// Restore: open every recorded window in a fresh browser window.
// Pinned tabs are pinned again; incognito windows are recreated as
// incognito. Non-web URLs (chrome://, about:) cannot be reopened and
// are skipped silently. Returns true if at least one tab opened.
// ---------------------------------------------------------------------------
async function restoreSnapshot(id) {
  const { [STORE_KEY]: list = [] } = await chrome.storage.local.get(STORE_KEY);
  const snap = list.find((s) => s.id === id);
  if (!snap) return false;

  let openedAny = false;

  for (const win of snap.windows) {
    const urls = [];
    const pinnedFlags = [];

    for (const t of win.tabs) {
      // Only web pages can be opened by an extension — skip everything else.
      if (!t.url || !/^https?:\/\//i.test(t.url)) continue;
      urls.push(t.url);
      pinnedFlags.push(t.pinned);
      openedAny = true;
    }
    if (!urls.length) continue;

    try {
      const created = await chrome.windows.create({
        url: urls,
        incognito: !!win.incognito,   // incognito restores as incognito
      });
      if (!created || !created.id) continue;

      // Re-pin tabs that were pinned (newest-first so order survives).
      for (let i = pinnedFlags.length - 1; i >= 0; i--) {
        if (!pinnedFlags[i]) continue;
        const tabs = await chrome.tabs.query({ windowId: created.id });
        const tab = tabs.find((t) => t.url === urls[i]);
        if (tab && tab.id !== undefined) chrome.tabs.update(tab.id, { pinned: true });
      }
    } catch (err) {
      console.warn("[session-backup] restore window failed:", err);
    }
  }

  return openedAny;
}
