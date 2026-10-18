/* Posture Prompt — background worker.
 * Fires configurable posture reminders via chrome.alarms + notifications.
 * No network. No data leaves the machine. */
'use strict';

const ALARM_NAME = 'posture-reminder';

/* Bundled exercise routines: plain text descriptions only.
 * These are general wellness descriptions, NOT medical advice. */
const ROUTINES = [
  {
    id: 'pelvic-tilt',
    title: 'Pelvic Tilt Reset',
    steps: [
      'Stand tall, feet hip-width apart, soft knees.',
      'Gently rock your pelvis so your lower back flattens (tailbone tucks slightly).',
      'Hold 5 seconds while breathing normally.',
      'Release and repeat 8–10 times.'
    ]
  },
  {
    id: 'stand-sit-cycle',
    title: 'Sit–Stand Cycle',
    steps: [
      'If at a standing desk: stand, weight even on both feet, screen at eye level.',
      'If seated: stand up, roll shoulders back 5 times.',
      'Walk to get water or to a window — 60 seconds.',
      'Return and reset: sit tall, both feet flat on the floor.'
    ]
  },
  {
    id: 'neck-shoulder',
    title: 'Neck & Shoulder Ease',
    steps: [
      'Slowly tilt your right ear toward your right shoulder — hold 15 seconds.',
      'Repeat on the left side.',
      'Squeeze shoulder blades together for 5 seconds, release — repeat 5 times.',
      'Finish with 3 slow shoulder rolls each direction.'
    ]
  },
  {
    id: 'desk-reset',
    title: 'Desk Ergonomics Reset',
    steps: [
      'Check monitor: top of screen at or just below eye level.',
      'Elbows at ~90°, wrists neutral, shoulders relaxed (not shrugged).',
      'Feet flat on the floor; stand and stretch for 30 seconds.',
      'Set a comfortable, upright sitting posture again.'
    ]
  }
];

/* --- settings helpers --- */
async function getSettings() {
  const d = await chrome.storage.local.get({
    intervalMinutes: 45,
    enabled: false,
    enabledRoutines: ROUTINES.map(r => r.id)
  });
  return d;
}

async function schedule() {
  await chrome.alarms.clear(ALARM_NAME);
  const s = await getSettings();
  if (s.enabled && s.intervalMinutes > 0) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: s.intervalMinutes,
      periodInMinutes: s.intervalMinutes
    });
  }
}

function pickRoutine(enabledIds) {
  const pool = ROUTINES.filter(r => enabledIds.includes(r.id));
  const list = pool.length ? pool : ROUTINES;
  return list[Math.floor(Math.random() * list.length)];
}

async function fireReminder() {
  const s = await getSettings();
  const routine = pickRoutine(s.enabledRoutines || []);
  const body = routine.steps.slice(0, 2).join(' ');
  await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `Posture check: ${routine.title}`,
    message: body,
    contextMessage: 'Open the popup for the full routine'
  });
  // log the prompt
  const log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
  log.unshift({ ts: Date.now(), routine: routine.id, title: routine.title, done: false });
  await chrome.storage.local.set({ doneLog: log.slice(0, 100) });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) fireReminder();
});

chrome.runtime.onInstalled.addListener(schedule);
chrome.runtime.onStartup.addListener(schedule);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'GET_DATA') {
      sendResponse({ routines: ROUTINES, settings: await getSettings() });
    } else if (msg.type === 'SET_SETTINGS') {
      await chrome.storage.local.set(msg.settings);
      await schedule();
      sendResponse({ ok: true });
    } else if (msg.type === 'TEST_NOW') {
      await fireReminder();
      sendResponse({ ok: true });
    } else if (msg.type === 'MARK_DONE') {
      const log = (await chrome.storage.local.get({ doneLog: [] })).doneLog;
      if (log[0]) log[0].done = true;
      await chrome.storage.local.set({ doneLog: log });
      sendResponse({ ok: true });
    }
  })();
  return true;
});
