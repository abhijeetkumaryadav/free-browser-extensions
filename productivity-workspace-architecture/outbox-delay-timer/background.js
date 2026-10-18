/* Outbox Delay Timer — service worker
   Checks pending reminders on a periodic alarm and fires a notification
   when a follow-up becomes due. Buttons: Done / Snooze 1 day. */

const ALARM_NAME = 'check-due';

// Keep the periodic check alive.
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) checkDue();
});

async function checkDue() {
  const { entries = [] } = await chrome.storage.local.get('entries');
  const now = Date.now();
  let changed = false;

  for (const e of entries) {
    if (!e.done && !e.notified && e.dueAt <= now) {
      e.notified = true;
      changed = true;
      await chrome.notifications.create(`followup-${e.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Follow-up due',
        message: `You emailed ${e.to} — "${e.subject}". Time to follow up.`,
        buttons: [{ title: 'Snooze 1 day' }, { title: 'Mark done' }],
        priority: 2,
      });
    }
  }
  if (changed) await chrome.storage.local.set({ entries });
}

// Notification button actions.
chrome.notifications.onButtonClicked.addListener(async (notificationId, btnIndex) => {
  if (!notificationId.startsWith('followup-')) return;
  const id = notificationId.slice('followup-'.length);
  const { entries = [] } = await chrome.storage.local.get('entries');
  const e = entries.find((x) => x.id === id);
  if (e) {
    if (btnIndex === 0) {
      // Snooze 1 day
      e.dueAt = Date.now() + 24 * 3600 * 1000;
      e.notified = false;
    } else {
      e.done = true;
    }
    await chrome.storage.local.set({ entries });
  }
  chrome.notifications.clear(notificationId);
});
