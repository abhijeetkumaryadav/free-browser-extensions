// background.js — heartbeat logger for THIS extension's own service worker.
// Service workers sleep when idle; chrome.alarms wake them back up.
const HEARTBEAT_ALARM = "hb-tick";

chrome.runtime.onInstalled.addListener(async () => {
  const now = Date.now();
  await chrome.storage.local.set({ installedAt: now, heartbeats: [now] });
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  const { heartbeats = [] } = await chrome.storage.local.get("heartbeats");
  const now = Date.now();
  // Keep only the last 24 hours of heartbeats.
  const kept = [...heartbeats, now].filter((t) => now - t < 24 * 60 * 60 * 1000);
  await chrome.storage.local.set({ heartbeats: kept, lastHeartbeat: now });
});
