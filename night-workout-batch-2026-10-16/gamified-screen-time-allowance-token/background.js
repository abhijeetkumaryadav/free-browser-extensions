/* TokenTime background — per-minute token spending on the active tab. 100% local. */
const ALARM = "tokentime-tick";

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);

function init() {
  chrome.alarms.create(ALARM, { periodInMinutes: 1 });
  chrome.storage.local.get({ allowance: 60, balance: 60, date: "", sites: [], usage: {}, rewards: [], pinHash: "" })
    .then((s) => { if (!s.date) chrome.storage.local.set({ date: new Date().toDateString() }); });
}

chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) tick().catch(() => {}); });

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}
function matches(host, site) { return host === site || host.endsWith("." + site); }

async function tick() {
  const s = await chrome.storage.local.get({ allowance: 60, sites: [], balance: 60, date: "", usage: {} });
  const today = new Date().toDateString();

  // Day rollover: fresh allowance each day
  if (s.date !== today) {
    await chrome.storage.local.set({ date: today, balance: s.allowance, usage: {}, rewards: [] });
    s.balance = s.allowance; s.usage = {};
  }

  // Find the active tab's host
  let tabs = [];
  try { tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); } catch { /* no tabs permission edge */ }
  const host = tabs[0] ? hostOf(tabs[0].url || "") : "";
  const site = (s.sites || []).find((w) => host && matches(host, w.domain));

  // Spend tokens for one minute on a configured site (never below zero)
  if (site && s.balance > 0) {
    const spend = Math.min(site.cost, s.balance);
    const usage = { ...(s.usage || {}) };
    usage[site.domain] = (usage[site.domain] || 0) + 1;
    await chrome.storage.local.set({ balance: s.balance - spend, usage });
    s.balance -= spend;
  }

  // Badge shows remaining tokens
  try {
    await chrome.action.setBadgeText({ text: String(Math.min(999, s.balance)) });
    await chrome.action.setBadgeBackgroundColor({ color: s.balance > 0 ? "#f59e0b" : "#ef4444" });
  } catch { /* action badge unavailable */ }
}
