/* EMOM Interval Beeper — background timing engine.
 * Runs the workout clock on 1-second alarms so timing survives popup close.
 * State lives in chrome.storage.local; the popup renders + plays beeps.
 * When the popup is closed, phase changes raise notifications instead.
 */
'use strict';

// ENGINE-START
// Pure state machine (testable, no chrome APIs inside `step`)
/**
 * Advance the workout state by one tick.
 * @param {object} s current state {phase, round, totalRounds, workSec, restSec, prepSec, remaining}
 * @returns {{state: object, events: string[]}} new state + events fired this tick
 *   events: 'tick' | 'countdown3'|'countdown2'|'countdown1' | 'work' | 'rest' | 'done'
 */
function step(s) {
  const events = [];
  const next = { ...s, remaining: s.remaining - 1 };
  events.push('tick');
  if (next.remaining <= 3 && next.remaining >= 1) {
    events.push('countdown' + next.remaining); // countdown3/2/1
  }
  if (next.remaining > 0) return { state: next, events };

  // Phase finished — transition
  if (next.phase === 'prep') {
    events.push('work');
    return { state: { ...next, phase: 'work', round: 1, remaining: next.workSec }, events };
  }
  if (next.phase === 'work') {
    if (next.round >= next.totalRounds) {
      events.push('done');
      return { state: { ...next, phase: 'idle', remaining: 0 }, events };
    }
    events.push('rest');
    return { state: { ...next, phase: 'rest', remaining: next.restSec }, events };
  }
  // rest -> next round's work
  events.push('work');
  return { state: { ...next, phase: 'work', round: next.round + 1, remaining: next.workSec }, events };
}
// ENGINE-END

const DEFAULTS = { workSec: 40, restSec: 20, totalRounds: 10, prepSec: 10 };

async function getState() {
  const r = await chrome.storage.local.get('emom');
  return r.emom || null;
}
async function setState(s) {
  await chrome.storage.local.set({ emom: s });
}

async function start(cfg) {
  const s = {
    phase: 'prep',
    round: 0,
    totalRounds: Math.max(1, Math.min(99, cfg.totalRounds | 0 || DEFAULTS.totalRounds)),
    workSec: Math.max(5, Math.min(600, cfg.workSec | 0 || DEFAULTS.workSec)),
    restSec: Math.max(0, Math.min(600, cfg.restSec == null ? DEFAULTS.restSec : cfg.restSec | 0)),
    prepSec: DEFAULTS.prepSec,
    remaining: DEFAULTS.prepSec,
    running: true,
    finishedAt: 0,
  };
  await setState(s);
  await chrome.alarms.create('emom-tick', { periodInMinutes: 1 / 60 });
}

async function stop(finished) {
  await chrome.alarms.clear('emom-tick');
  const s = await getState();
  if (s) {
    s.running = false;
    s.phase = finished ? 'done' : 'idle';
    s.remaining = 0;
    if (finished) s.finishedAt = Date.now();
    await setState(s);
  }
}

// --- Alarm tick ------------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'emom-tick') return;
  const s = await getState();
  if (!s || !s.running) { await chrome.alarms.clear('emom-tick'); return; }
  const { state, events } = step(s);
  state.running = true;
  await setState(state);
  // Notify on phase changes so a closed popup still signals the workout
  if (events.includes('work')) {
    notify(`Round ${state.round} of ${state.totalRounds} — WORK`, `${state.workSec}s work. Go!`);
  } else if (events.includes('rest')) {
    notify('Rest', `${state.restSec}s rest.`);
  } else if (events.includes('done')) {
    notify('Workout complete!', `${state.totalRounds} rounds done. Nice work.`);
    await stop(true);
  }
});

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title, message,
  });
}

// --- Messages from popup ----------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'EMOM_START') start(msg.config).then(() => sendResponse({ ok: true }));
  else if (msg.type === 'EMOM_STOP') stop(false).then(() => sendResponse({ ok: true }));
  else if (msg.type === 'EMOM_GET') getState().then((s) => sendResponse({ state: s }));
  return true; // async response
});
