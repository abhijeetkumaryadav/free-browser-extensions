// Meeting Link Aggregator — background service worker.
// Fires a system notification when a meeting reminder alarm goes off.

const REMIND_MIN = 10;

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("m-")) return;
  const { meetings = [] } = await chrome.storage.local.get("meetings");
  const m = meetings.find((x) => x.id === alarm.name);
  if (!m) return;
  chrome.notifications.create(alarm.name, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Meeting starting soon",
    message: `${m.title} starts in about ${REMIND_MIN} minutes. Tap Join in the extension.`,
    priority: 2,
  });
});

// Rebuild alarms on browser start / install so reminders survive restarts.
chrome.runtime.onStartup.addListener(rebuildAlarms);
chrome.runtime.onInstalled.addListener(rebuildAlarms);

async function rebuildAlarms() {
  const { meetings = [] } = await chrome.storage.local.get("meetings");
  await chrome.alarms.clearAll();
  const now = Date.now();
  for (const m of meetings) {
    const when = m.at - REMIND_MIN * 60000;
    if (when > now) chrome.alarms.create(m.id, { when });
  }
}
