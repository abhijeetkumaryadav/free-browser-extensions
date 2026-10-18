// Background worker: daily check-in reminder alarm + notification.
//
// SCOPE: this is a local reminder timer. No buddy sync, no network,
// no account. The user checks in and shares with their buddy manually.
'use strict';

const ALARM_NAME = 'buddy-checkin-alarm';

/** Schedule the daily alarm for the stored HH:MM time. */
async function scheduleAlarm() {
  const { checkinTime, reminderOn } = await chrome.storage.local.get({
    checkinTime: '09:00',
    reminderOn: true,
  });
  await chrome.alarms.clear(ALARM_NAME);
  if (!reminderOn) return;

  const [h, m] = String(checkinTime).split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(h || 0, m || 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1); // fire tomorrow if passed

  chrome.alarms.create(ALARM_NAME, {
    when: next.getTime(),
    periodInMinutes: 24 * 60,
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '⏰ Accountability check-in',
    message: 'Time to check in! Tap the extension and mark today done, then share it with your buddy.',
    priority: 2,
  });
});

chrome.runtime.onInstalled.addListener(() => scheduleAlarm());
chrome.runtime.onStartup.addListener(() => scheduleAlarm());

// Reschedule whenever settings change.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.checkinTime || changes.reminderOn)) {
    scheduleAlarm();
  }
});
