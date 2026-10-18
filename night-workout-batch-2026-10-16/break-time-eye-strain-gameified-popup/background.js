/* Eye Break — background worker: owns the reminder schedule via chrome.alarms. */
const ALARM = "eye-break-reminder";

async function refreshSchedule() {
  const { remindersOn = false, interval = 20 } = await chrome.storage.local.get({
    remindersOn: false, interval: 20,
  });
  await chrome.alarms.clear(ALARM);
  if (remindersOn) {
    chrome.alarms.create(ALARM, { periodInMinutes: Number(interval) });
  }
}

chrome.runtime.onInstalled.addListener(refreshSchedule);
chrome.runtime.onStartup.addListener(refreshSchedule);
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "refresh-schedule") refreshSchedule();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) return;
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Eye Break",
    message: "Time for an eye break — look away for 20 seconds, then play the follow-the-dot game!",
  });
});
