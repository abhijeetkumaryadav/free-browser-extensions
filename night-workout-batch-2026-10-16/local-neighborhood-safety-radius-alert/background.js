/* SafetyRadius background service worker — alarm scheduling + escalating notifications. */
const TIMER_KEY = 'safety_checkin';

/* Alarm fired: check-in is due. Escalate with a notification + repeat nudges. */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'safety_checkin') return;

  const data = await chrome.storage.local.get(TIMER_KEY);
  const timer = data[TIMER_KEY];
  if (!timer || !timer.active) return;

  // Mark overdue; keep an overdue alarm for escalation nudges every 5 min.
  timer.overdue = true;
  timer.overdueSince = Date.now();
  await chrome.storage.local.set({ [TIMER_KEY]: timer });

  const contacts = (await chrome.storage.local.get('safety_contacts')).safety_contacts || [];
  const contactLine = contacts.length
    ? ` Emergency contacts: ${contacts.map(c => c.name + (c.phone ? ' (' + c.phone + ')' : '')).join(', ')}.`
    : '';

  chrome.notifications.create('safety_checkin_overdue', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'SafetyRadius: check-in overdue',
    message: `You did not check in from "${timer.place}". If you are okay, open the extension and check in.${contactLine}`,
    priority: 2,
    requireInteraction: true
  });

  // Escalation nudge every 5 minutes until checked in.
  chrome.alarms.create('safety_overdue_nudge', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'safety_overdue_nudge') return;
  const data = await chrome.storage.local.get(TIMER_KEY);
  const timer = data[TIMER_KEY];
  if (!timer || !timer.active || !timer.overdue) {
    chrome.alarms.clear('safety_overdue_nudge');
    return;
  }
  chrome.notifications.create('safety_nudge', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'SafetyRadius: still overdue',
    message: `Reminder — check in from "${timer.place}" to let your contacts know you are safe.`,
    priority: 1
  });
});

/* Keep timer state consistent if the extension reloads. */
chrome.runtime.onStartup.addListener(async () => {
  const data = await chrome.storage.local.get(TIMER_KEY);
  const timer = data[TIMER_KEY];
  if (timer && timer.active && timer.dueAt < Date.now()) {
    timer.overdue = true;
    timer.overdueSince = timer.overdueSince || Date.now();
    await chrome.storage.local.set({ [TIMER_KEY]: timer });
  }
});
