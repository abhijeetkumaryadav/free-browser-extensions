// Background: schedules a daily alarm at the user's chosen time and fires a reminder notification.

const ALARM = "practice-reminder";

// Compute ms until the next occurrence of "HH:MM" local time.
function nextFireMs(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

async function reschedule() {
  await chrome.alarms.clear(ALARM);
  const { time = "20:00", enabled = true } = await chrome.storage.local.get(["time", "enabled"]);
  if (!enabled) return;
  chrome.alarms.create(ALARM, { when: Date.now() + nextFireMs(time), periodInMinutes: 24 * 60 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) return;
  chrome.notifications.create("practice-due", {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Time to practice!",
    message: "Your daily practice reminder. Open the popup to mark it done.",
    buttons: [{ title: "Open popup" }],
    requireInteraction: false,
  });
});

chrome.notifications.onButtonClicked.addListener(() => {
  chrome.action.openPopup().catch(() => {});
});

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg && msg.type === "RESCHEDULE") { reschedule().then(() => respond(true)); return true; }
  return false;
});

chrome.runtime.onInstalled.addListener(reschedule);
chrome.runtime.onStartup.addListener(reschedule);
