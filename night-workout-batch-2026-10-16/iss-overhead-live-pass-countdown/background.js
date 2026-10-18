/* ISS Pass Countdown — service worker.
   Schedules a single pre-pass notification alarm for the next upcoming pass
   when the user arms notifications. Your times only — no live data. */
'use strict';

const ALARM_NAME = 'iss-pass-notify';
const NOTIFY_BEFORE_MS = 5 * 60 * 1000;

/** First pass with when > now, or null. (Mirror of popup engine.) */
function nextPass(list, now) {
  const sorted = [...list].sort((a, b) => a.when - b.when);
  return sorted.find(p => p.when > now) || null;
}

async function syncAlarm(notifyArmed) {
  await chrome.alarms.clear(ALARM_NAME);
  if (!notifyArmed) return;
  const { passes = [] } = await chrome.storage.local.get('passes');
  const np = nextPass(Array.isArray(passes) ? passes : [], Date.now());
  if (!np) return;
  const fireAt = np.when - NOTIFY_BEFORE_MS;
  if (fireAt <= Date.now()) return; // already inside the 5-min window
  await chrome.alarms.create(ALARM_NAME, { when: fireAt });
  await chrome.storage.local.set({ alarmPassId: np.id });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'syncAlarm') {
    syncAlarm(!!msg.notifyArmed).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== ALARM_NAME) return;
  const { alarmPassId, passes = [] } = await chrome.storage.local.get(['alarmPassId', 'passes']);
  const np = (Array.isArray(passes) ? passes : []).find(p => p.id === alarmPassId);
  if (!np) return;
  const when = new Date(np.when).toLocaleString(undefined,
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'ISS pass in 5 minutes',
    message: `Look up at ${when}${np.elevation != null ? ` · max ${np.elevation}°` : ''}${np.note ? ` · ${np.note}` : ''}`
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ notifyArmed: false });
});
