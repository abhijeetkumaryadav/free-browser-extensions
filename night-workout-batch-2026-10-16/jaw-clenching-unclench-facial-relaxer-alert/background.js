/* Jaw Unclench Reminder — background worker
 * Schedules repeating reminders via chrome.alarms. On fire, shows a
 * notification with a jaw-release / facial-relaxation prompt from a
 * bundled list. Honest scope: reminders only — not medical advice.
 */

// ---- Prompt library (bundled, plain descriptions) ----
const PROMPTS = [
  { name: 'Unclench', how: 'Notice your jaw. Let your teeth part slightly and rest your tongue on the roof of your mouth. Breathe out slowly.' },
  { name: 'Lip flutter', how: 'Relax your lips and blow air through them so they flutter gently for 10 seconds. Repeat 3 times.' },
  { name: 'Jaw circles', how: 'Slowly open your mouth and trace small circles with your chin — 5 each direction.' },
  { name: 'Temple press', how: 'Place fingertips on your temples. Press gently in small circles for 20 seconds.' },
  { name: 'Neck lengthen', how: 'Drop your shoulders, tuck your chin slightly, and imagine a string pulling the crown of your head up. Hold 20 seconds.' },
  { name: 'Face scrunch & release', how: 'Scrunch your whole face tight for 5 seconds, then release completely. Notice the contrast.' },
  { name: 'Masseter ease', how: 'Place fingers on your jaw muscles and gently knead in circles while breathing slowly, 20 seconds per side.' },
  { name: 'Soft smile', how: 'Form a soft, easy smile and hold it for 30 seconds — it signals your jaw to relax.' },
];

const ALARM_NAME = 'jaw-reminder';
const DEFAULTS = { enabled: false, intervalMin: 60, lastPrompt: null, doneLog: [] };

// ---- Scheduling ----
async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

async function schedule() {
  await chrome.alarms.clear(ALARM_NAME);
  const { enabled, intervalMin } = await getSettings();
  if (enabled) chrome.alarms.create(ALARM_NAME, { periodInMinutes: intervalMin });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  await chrome.storage.local.set({ lastPrompt: p });
  chrome.notifications.create('jaw-now', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Unclench your jaw: ' + p.name,
    message: p.how.slice(0, 180),
    buttons: [{ title: 'Mark done' }],
  });
});

// Notification button → log a done entry.
chrome.notifications.onButtonClicked.addListener(async (id) => {
  if (id !== 'jaw-now') return;
  const { doneLog } = await getSettings();
  doneLog.push({ ts: Date.now(), note: 'done' });
  await chrome.storage.local.set({ doneLog: doneLog.slice(-100) });
  chrome.notifications.clear('jaw-now');
});

// Re-apply schedule on install/startup and when settings change.
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.enabled || changes.intervalMin)) schedule();
});
