// Blink & Sip — background scheduler.
// One repeating alarm drives both blink and water reminders; the popup
// never schedules timers itself so reminders keep working when closed.
// Reminders only — not medical guidance.

'use strict';

/* ---------- constants ---------- */
const ALARM_BLINK = 'reminder-blink';
const ALARM_WATER = 'reminder-water';

const DEFAULTS = {
  enabled: true,
  blinkMinutes: 20,   // blink reminder every N minutes
  waterMinutes: 60,   // water reminder every N minutes
  points: 0,          // lifetime points
  streak: 0,          // consecutive completions today
  bestStreak: 0,      // all-time best daily streak
  completionsToday: 0,
  lastStreakDay: null // 'YYYY-MM-DD' of the last completion
};

/* ---------- storage helpers ---------- */
async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

/* ---------- scheduling ---------- */
async function reschedule() {
  await chrome.alarms.clearAll();
  const s = await getState();
  if (!s.enabled) return;
  if (s.blinkMinutes > 0)
    await chrome.alarms.create(ALARM_BLINK, { periodInMinutes: s.blinkMinutes });
  if (s.waterMinutes > 0)
    await chrome.alarms.create(ALARM_WATER, { periodInMinutes: s.waterMinutes });
}

// Re-arm the schedule on install / browser start.
chrome.runtime.onInstalled.addListener(() => { void reschedule(); });
chrome.runtime.onStartup.addListener(() => { void reschedule(); });

// Settings changed from the popup -> rebuild alarms.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.blinkMinutes || changes.waterMinutes) {
    void reschedule();
  }
});

/* ---------- notifications ---------- */
async function fire(kind) {
  const s = await getState();
  if (!s.enabled) return;
  const isBlink = kind === ALARM_BLINK;
  const id = `blink-sip-${kind}-${Date.now()}`;
  await chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: isBlink ? '👁️ Blink break' : '💧 Drink water',
    message: isBlink
      ? 'Look away and blink slowly 10 times. (+5 pts if you complete it)'
      : 'Have a sip of water. (+10 pts if you complete it)',
    priority: 1
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  void fire(alarm.name);
});

/* ---------- scoring (messages from the popup) ---------- */
// Popup sends {type:'COMPLETE', kind:'blink'|'water'} when the user
// taps "I did it". Points and streak live here so a closed popup
// cannot corrupt the totals.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'COMPLETE') {
    (async () => {
      const s = await getState();
      const today = new Date().toISOString().slice(0, 10);
      // New day -> streak resets before counting today's completion.
      if (s.lastStreakDay !== today) {
        s.streak = 0;
        s.completionsToday = 0;
      }
      const earned = msg.kind === 'blink' ? 5 : 10;
      s.points += earned;
      s.streak += 1;
      s.completionsToday += 1;
      s.lastStreakDay = today;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      await chrome.storage.local.set(s);
      sendResponse({ ok: true, earned, state: s });
    })();
    return true; // async response
  }
  if (msg && msg.type === 'RESCHEDULE') {
    void reschedule();
    sendResponse({ ok: true });
  }
});
