/* TabState Log — background service worker.
 * Logs tab lifecycle STATE changes (active / audible / discarded / created /
 * removed) with timestamps into chrome.storage.local. It does NOT measure
 * CPU — per-tab CPU usage is not exposed to extensions. */

var MAX_LOG = 500;
var lastSeen = {}; // tabId -> { active, audible, discarded }

/* Append an event, capping the log. */
async function logEvent(type, tabId, detail) {
  var data = await chrome.storage.local.get({ tabLog: [] });
  var log = data.tabLog;
  log.push({
    ts: Date.now(),
    type: type,
    tabId: tabId,
    detail: detail || ''
  });
  if (log.length > MAX_LOG) log = log.slice(log.length - MAX_LOG);
  await chrome.storage.local.set({ tabLog: log });
}

/* Snapshot the states we can observe for a tab. */
function snapshot(tab) {
  return {
    active: !!tab.active,
    audible: !!tab.audible,
    discarded: !!tab.discarded
  };
}

function hostOf(url) {
  try { return new URL(url).host; } catch (e) { return ''; }
}

/* Track baseline on startup so only real changes get logged. */
chrome.runtime.onStartup.addListener(initBaseline);
chrome.runtime.onInstalled.addListener(initBaseline);

async function initBaseline() {
  try {
    var tabs = await chrome.tabs.query({});
    lastSeen = {};
    tabs.forEach(function (t) { lastSeen[t.id] = snapshot(t); });
  } catch (e) { /* tabs permission edge cases */ }
}
initBaseline();

chrome.tabs.onCreated.addListener(function (tab) {
  lastSeen[tab.id] = snapshot(tab);
  logEvent('created', tab.id, hostOf(tab.pendingUrl || tab.url));
});

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  delete lastSeen[tabId];
  logEvent('removed', tabId, removeInfo.isWindowClosing ? 'window closed' : '');
});

chrome.tabs.onActivated.addListener(function (info) {
  logEvent('activated', info.tabId, 'window ' + info.windowId);
  // Update baseline for the previously active tab in that window.
  chrome.tabs.query({ windowId: info.windowId }, function (tabs) {
    tabs.forEach(function (t) { lastSeen[t.id] = snapshot(t); });
  });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  var prev = lastSeen[tabId];
  var now = snapshot(tab);
  if (!prev) { lastSeen[tabId] = now; return; }

  if (changeInfo.audible !== undefined && changeInfo.audible !== prev.audible) {
    logEvent(now.audible ? 'audible-start' : 'audible-stop', tabId, hostOf(tab.url));
  }
  if (changeInfo.discarded !== undefined && changeInfo.discarded !== prev.discarded) {
    logEvent(now.discarded ? 'discarded' : 'restored', tabId, hostOf(tab.url));
  }
  if (changeInfo.status === 'complete' && tab.url) {
    // Only log navigations, not every sub-frame noise: main frame check via changeInfo is limited,
    // so keep it quiet — navigation noise would flood the log.
  }
  lastSeen[tabId] = now;
});

chrome.tabs.onReplaced.addListener(function (addedTabId, removedTabId) {
  delete lastSeen[removedTabId];
  logEvent('replaced', addedTabId, 'tab ' + removedTabId + ' replaced');
});
