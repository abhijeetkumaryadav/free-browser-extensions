// Service worker: fires a notification when a renewal reminder alarm rings.
// The user must have granted the notification permission (requested on first
// reminder creation via chrome.permissions — here declared in the manifest).

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('rem-')) return;
  const id = alarm.name.slice(4);
  try {
    const { reminders = [] } = await chrome.storage.local.get('reminders');
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    await chrome.notifications.create('cancel-' + id, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Renewal reminder: ' + r.name,
      message: 'This subscription may renew soon. Cancel now if you no longer want it — Cancel Helper can point you at the cancel link.',
      priority: 2,
    });
    // Remove the fired reminder.
    await chrome.storage.local.set({ reminders: reminders.filter((x) => x.id !== id) });
  } catch (e) {
    // If notifications are blocked, just drop the reminder silently.
  }
});
