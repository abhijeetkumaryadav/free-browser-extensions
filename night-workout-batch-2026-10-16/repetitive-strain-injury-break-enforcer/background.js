// Break Enforcer — background timer.
// Owns the work/break cycle with chrome.alarms so it keeps running when the
// popup is closed. On break start, injects the overlay into the active tab.
// Reminders only — not medical advice.

'use strict';

const ALARM_TICK = 'break-enforcer-tick';

const DEFAULTS = {
  workMinutes: 25,
  breakMinutes: 5,
  enforceMode: false, // dim the page until break ends
  phase: 'idle',      // 'idle' | 'work' | 'break'
  endsAt: 0,          // epoch ms when the current phase ends
  cycles: 0           // completed work phases today
};

// Bundled, generic stretch/movement suggestions — no medical claims.
const STRETCHES = [
  'Roll your shoulders slowly, five times forward and five times back.',
  'Look away from the screen at something far for 20 seconds.',
  'Stand up, stretch your arms overhead, and take three deep breaths.',
  'Gently tilt your head ear-to-shoulder on each side, holding a few seconds.',
  'Open and close your hands fully ten times, then wiggle your fingers.',
  'Stand and do ten slow bodyweight squats or march in place for 30 seconds.',
  'Roll your wrists in circles, ten each direction.',
  'Do a gentle standing side bend, left then right.'
];

function pickStretch() {
  return STRETCHES[Math.floor(Math.random() * STRETCHES.length)];
}

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

/* ---------- cycle control ---------- */
async function startWork() {
  const s = await getState();
  const endsAt = Date.now() + s.workMinutes * 60 * 1000;
  await chrome.storage.local.set({ phase: 'work', endsAt });
  await chrome.alarms.clear(ALARM_TICK);
  await chrome.alarms.create(ALARM_TICK, { when: endsAt });
}

async function startBreak() {
  const s = await getState();
  const endsAt = Date.now() + s.breakMinutes * 60 * 1000;
  await chrome.storage.local.set({
    phase: 'break',
    endsAt,
    cycles: s.cycles + 1,
    suggestion: pickStretch()
  });
  await chrome.alarms.clear(ALARM_TICK);
  await chrome.alarms.create(ALARM_TICK, { when: endsAt });
  await showOverlay();
}

async function stop() {
  await chrome.alarms.clear(ALARM_TICK);
  await chrome.storage.local.set({ phase: 'idle', endsAt: 0 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_TICK) return;
  const s = await getState();
  if (s.phase === 'work') {
    await startBreak();          // work done -> break overlay
  } else if (s.phase === 'break') {
    await startWork();           // break done -> next work block
    await hideOverlay();
  }
});

/* ---------- overlay injection ---------- */
async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab && tab.id;
}

async function showOverlay() {
  const s = await getState();
  const tabId = await activeTabId();
  if (!tabId) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_BREAK',
      breakMinutes: s.breakMinutes,
      enforceMode: s.enforceMode,
      suggestion: s.suggestion || pickStretch()
    });
  } catch (e) {
    // Internal pages (chrome://, edge://, …) refuse injection — fine.
    console.debug('Break Enforcer: overlay injection skipped', e);
  }
}

async function hideOverlay() {
  const tabId = await activeTabId();
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'HIDE_BREAK' });
  } catch (e) { /* tab may be gone */ }
}

// If the user switches tabs mid-break, paint the overlay on the new tab too.
chrome.tabs.onActivated.addListener(async () => {
  const s = await getState();
  if (s.phase === 'break' && Date.now() < s.endsAt) await showOverlay();
});

chrome.runtime.onInstalled.addListener(() => { void stop(); });
chrome.runtime.onStartup.addListener(() => { void stop(); }); // never resume mid-cycle

/* ---------- popup messages ---------- */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'START') { await startWork(); sendResponse({ ok: true }); }
    else if (msg.type === 'STOP') { await stop(); await hideOverlay(); sendResponse({ ok: true }); }
    else if (msg.type === 'SKIP_BREAK') { await stop(); await hideOverlay(); await startWork(); sendResponse({ ok: true }); }
    else if (msg.type === 'END_BREAK_EARLY') { await stop(); await hideOverlay(); sendResponse({ ok: true }); }
  })();
  return true;
});
