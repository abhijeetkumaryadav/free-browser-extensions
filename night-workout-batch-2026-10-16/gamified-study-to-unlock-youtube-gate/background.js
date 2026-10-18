/* StudyGate background service worker — owns the study timer, day rollover and streaks.
 * Timer state lives in chrome.storage.local so it survives popup closes and restarts. */
'use strict';

const TICK_ALARM = 'studygate-tick';
const DAY_KEY = () => new Date().toDateString();

async function loadAll() {
  const d = await chrome.storage.local.get(['settings', 'progress']);
  const settings = Object.assign(
    { pinSalt: null, pinHash: null, goalMin: 25, extraDomains: [] },
    d.settings || {}
  );
  const progress = Object.assign(
    { lastDay: null, todaySec: 0, unlockedToday: false, studying: false,
      lastTickTs: 0, streak: 0, bestStreak: 0, goalsDone: 0, history: {} },
    d.progress || {}
  );
  return { settings, progress };
}

/* Day rollover: settle yesterday's streak, reset today's counters. */
async function rolloverIfNeeded(progress) {
  const today = DAY_KEY();
  if (progress.lastDay === today) return false;
  const yKey = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const ySec = (progress.history || {})[yKey] || 0;
  const goalSec = (await loadAll()).settings.goalMin * 60;
  if (progress.lastDay && ySec >= goalSec) {
    progress.streak += 1;
    progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
  } else if (progress.lastDay) {
    progress.streak = 0;
  }
  progress.lastDay = today;
  progress.todaySec = 0;
  progress.unlockedToday = false;
  progress.studying = false;
  return true;
}

async function updateBadge(progress, settings) {
  try {
    if (progress.unlockedToday) {
      await chrome.action.setBadgeText({ text: 'OPEN' });
      await chrome.action.setBadgeBackgroundColor({ color: '#34d399' });
    } else if (progress.studying) {
      const left = Math.max(0, Math.ceil((settings.goalMin * 60 - progress.todaySec) / 60));
      await chrome.action.setBadgeText({ text: left + 'm' });
      await chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) { /* badge is best-effort */ }
}

async function tick() {
  const { settings, progress } = await loadAll();
  const rolled = await rolloverIfNeeded(progress);
  if (rolled) { await chrome.storage.local.set({ progress }); await updateBadge(progress, settings); return; }

  if (progress.studying && !progress.unlockedToday) {
    // Cap each tick's credit so sleep/hibernate can't inflate study time.
    const now = Date.now();
    const elapsed = progress.lastTickTs ? Math.min(120, Math.round((now - progress.lastTickTs) / 1000)) : 60;
    progress.lastTickTs = now;
    progress.todaySec += elapsed;

    const goalSec = settings.goalMin * 60;
    if (progress.todaySec >= goalSec) {
      progress.todaySec = goalSec;
      progress.unlockedToday = true;
      progress.studying = false;
      progress.goalsDone += 1;
      progress.streak += 1;
      progress.bestStreak = Math.max(progress.bestStreak, progress.streak);
      const key = new Date().toISOString().slice(0, 10);
      progress.history[key] = goalSec;
    }
    await chrome.storage.local.set({ progress });
  }
  await updateBadge(progress, settings);
}

chrome.runtime.onInstalled.addListener(async () => {
  const { progress } = await loadAll();
  await chrome.storage.local.set({ progress });
  await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  tick();
});

chrome.runtime.onStartup.addListener(async () => {
  // Don't credit offline time: reset the tick clock if a session was mid-flight.
  const { progress } = await loadAll();
  progress.lastTickTs = Date.now();
  await chrome.storage.local.set({ progress });
  tick();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) tick();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const { settings, progress } = await loadAll();
    await rolloverIfNeeded(progress);
    if (msg.type === 'study-start') {
      if (!progress.unlockedToday) {
        progress.studying = true;
        progress.lastTickTs = Date.now();
      }
    } else if (msg.type === 'study-pause') {
      progress.studying = false;
    } else if (msg.type === 'study-reset-day') {
      progress.todaySec = 0;
      progress.unlockedToday = false;
      progress.studying = false;
      const key = new Date().toISOString().slice(0, 10);
      if (progress.history) delete progress.history[key];
    }
    await chrome.storage.local.set({ progress });
    await updateBadge(progress, settings);
    sendResponse({ ok: true });
  })();
  return true; // async response
});
