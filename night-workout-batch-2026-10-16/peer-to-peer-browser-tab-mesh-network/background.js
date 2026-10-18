// Local Tab Mesh — background service worker.
// Keeps the joined-tab roster and relays messages to mesh members.

const CHANNEL = 'local-tab-mesh';

// Roster: Map<tabId, {tabId, url, title, joinedAt}> — in-memory, refreshed live.
const roster = new Map();

// Prune entries for closed tabs.
chrome.tabs.onRemoved.addListener((tabId) => roster.delete(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (roster.has(tabId) && changeInfo.url) roster.get(tabId).url = changeInfo.url;
});

// Content scripts announce themselves after injection.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.__ltmJoin && sender.tab) {
    roster.set(sender.tab.id, {
      tabId: sender.tab.id, url: msg.url || sender.tab.url,
      title: msg.title || sender.tab.title, joinedAt: Date.now()
    });
    sendResponse({ ok: true });
    return true;
  }
  // Popup asks: which tabs are members? -> live tabs intersected with roster
  if (msg && msg.__ltmRoster) {
    chrome.tabs.query({}).then((tabs) => {
      const live = new Map(tabs.map(t => [t.id, t]));
      const members = [];
      for (const [id, m] of roster) {
        const t = live.get(id);
        if (t) members.push({ tabId: id, url: t.url, title: t.title });
      }
      sendResponse({ members });
    });
    return true; // async response
  }
  // Popup asks background to deliver a mesh message (belt-and-braces alongside BroadcastChannel).
  if (msg && msg.__ltmSend) {
    const payload = { __ltm: true, type: msg.type, body: msg.body, at: Date.now() };
    broadcastToRoster(payload);
    sendResponse({ ok: true, delivered: roster.size });
    return true;
  }
});

function broadcastToRoster(payload) {
  for (const [tabId] of roster) {
    chrome.tabs.sendMessage(tabId, payload).catch(() => { /* tab gone or no receiver */ });
  }
}

// Clean up stale entries periodically (tabs closed while worker slept).
setInterval(() => {
  chrome.tabs.query({}).then((tabs) => {
    const live = new Set(tabs.map(t => t.id));
    for (const id of [...roster.keys()]) if (!live.has(id)) roster.delete(id);
  }).catch(() => {});
}, 60000);
