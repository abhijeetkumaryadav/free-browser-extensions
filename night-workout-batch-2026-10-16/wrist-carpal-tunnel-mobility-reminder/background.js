/* Wrist Mobility Reminder — background worker
 * Schedules repeating reminders via chrome.alarms. On fire, shows a
 * notification with a random wrist-mobility exercise from a bundled list.
 * Honest scope: reminders only — NOT medical advice.
 */

// ---- Exercise library (bundled, plain descriptions) ----
const EXERCISES = [
  { name: 'Wrist circles', how: 'Extend arms. Slowly circle each wrist 10 times clockwise, then 10 times counter-clockwise.' },
  { name: 'Prayer stretch', how: 'Press palms together in front of your chest, fingers up. Lower your hands toward your waist until you feel a gentle stretch. Hold 15–30 seconds.' },
  { name: 'Reverse prayer', how: 'Press the backs of your hands together in front of you, fingers pointing down. Hold 15–30 seconds.' },
  { name: 'Finger spreads', how: 'Spread all fingers wide apart, hold 5 seconds, then make a fist. Repeat 10 times.' },
  { name: 'Thumb stretches', how: 'Gently pull each thumb back toward your wrist with the opposite hand. Hold 15 seconds per thumb.' },
  { name: 'Desk press', how: 'Place palms flat on your desk, fingers pointing toward you. Lean gently forward. Hold 15–30 seconds.' },
  { name: 'Fist pumps', how: 'Make a tight fist, hold 5 seconds, then open your hand wide. Repeat 10 times per hand.' },
  { name: 'Shake it out', how: 'Relax your arms at your sides and gently shake your hands for 10 seconds.' },
];

const ALARM_NAME = 'wrist-reminder';
const DEFAULTS = { enabled: false, intervalMin: 45, lastExercise: null, doneLog: [] };

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
  const ex = EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  await chrome.storage.local.set({ lastExercise: ex });
  chrome.notifications.create('wrist-now', {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'Wrist mobility break: ' + ex.name,
    message: ex.how.slice(0, 180),
    buttons: [{ title: 'Mark done' }],
  });
});

// Notification button → log a done entry.
chrome.notifications.onButtonClicked.addListener(async (id) => {
  if (id !== 'wrist-now') return;
  const { doneLog } = await getSettings();
  doneLog.push({ ts: Date.now(), note: 'done' });
  await chrome.storage.local.set({ doneLog: doneLog.slice(-100) });
  chrome.notifications.clear('wrist-now');
});

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'wrist-now') chrome.runtime.openOptionsPage?.().catch(() => {});
});

// Re-apply schedule on install/startup and when settings change.
chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.enabled || changes.intervalMin)) schedule();
});
