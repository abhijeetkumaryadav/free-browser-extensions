'use strict';

/* =========================================================
 * Launch Countdown — background service worker.
 * Schedules a single chrome.alarms alarm for the next
 * upcoming launch (10 min before liftoff, if enabled) and
 * fires a notification when it rings. No network.
 * ========================================================= */

const STORAGE_KEY = 'launchCountdown.launches.v1';
const ALARM_NAME = 'launchCountdown.liftoff';
const NOTIFY_BEFORE_MS = 10 * 60 * 1000;

async function syncAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const launches = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const now = Date.now();
  const next = launches
    .filter(l => l.notify !== false && l.ts - NOTIFY_BEFORE_MS > now)
    .sort((a, b) => a.ts - b.ts)[0];
  if (!next) return;
  chrome.alarms.create(ALARM_NAME, { when: next.ts - NOTIFY_BEFORE_MS });
  await chrome.storage.local.set({ 'launchCountdown.alarmTarget': next.id });
}

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== ALARM_NAME) return;
  const data = await chrome.storage.local.get([STORAGE_KEY, 'launchCountdown.alarmTarget']);
  const launches = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  const target = launches.find(l => l.id === data['launchCountdown.alarmTarget']);
  if (target) {
    chrome.notifications.create('launchCountdown.' + target.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🚀 Liftoff in 10 minutes',
      message: target.name + (target.rocket ? ` (${target.rocket})` : '')
    });
  }
  syncAlarm();
});

chrome.runtime.onMessage.addListener(msg => {
  if (msg && msg.type === 'syncAlarm') syncAlarm();
});

chrome.runtime.onInstalled.addListener(syncAlarm);
chrome.runtime.onStartup.addListener(syncAlarm);
