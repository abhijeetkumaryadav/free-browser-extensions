// Stretch Break — background service worker
// Fires repeating alarms; each alarm pushes a notification with one of the
// user's custom messages (picked at random). "Done" button logs completion.

const ALARM_NAME = "stretch-break";

async function getSettings() {
  const { stretch = {} } = await chrome.storage.local.get("stretch");
  return {
    enabled: stretch.enabled ?? false,
    intervalMin: stretch.intervalMin ?? 60,
    messages: (stretch.messages ?? []).filter((m) => m.trim().length > 0),
  };
}

async function schedule() {
  await chrome.alarms.clear(ALARM_NAME);
  const { enabled, intervalMin, messages } = await getSettings();
  if (enabled && messages.length > 0) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: Math.max(10, intervalMin) });
  }
}

async function fireReminder() {
  const { messages } = await getSettings();
  if (messages.length === 0) return;
  const msg = messages[Math.floor(Math.random() * messages.length)];
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title: "Stretch break",
    message: msg,
    buttons: [{ title: "Done" }],
    requireInteraction: false,
  });
}

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) fireReminder();
});

// Re-schedule whenever settings change.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "STRETCH_SETTINGS_UPDATED") schedule();
  if (msg.type === "STRETCH_TEST_NOW") fireReminder();
});

// "Done" button on the notification -> append to the done log.
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (buttonIndex !== 0) return;
  const { log = [] } = await chrome.storage.local.get("log");
  log.unshift({ at: Date.now() });
  await chrome.storage.local.set({ log: log.slice(0, 100) });
  chrome.notifications.clear(notificationId);
});
