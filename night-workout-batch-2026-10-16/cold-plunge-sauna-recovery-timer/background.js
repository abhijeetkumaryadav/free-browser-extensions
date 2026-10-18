/* Contrast Timer — background service worker.
 * Alarm-driven state machine so timing survives popup close.
 * Audio chimes can only play while the popup is open (service workers
 * cannot play audio); when closed, notifications announce phase changes. */

// ENGINE-START
// Pure timing engine — no chrome.* calls, testable in node.
const PHASE_COLD = 'cold';
const PHASE_HOT = 'hot';

/** Clamp config into sane bounds. */
function clampConfig(coldSec, hotSec, rounds) {
  const c = Math.min(600, Math.max(10, Math.round(Number(coldSec) || 60)));
  const h = Math.min(900, Math.max(10, Math.round(Number(hotSec) || 180)));
  const r = Math.min(10, Math.max(1, Math.round(Number(rounds) || 3)));
  return { coldSec: c, hotSec: h, rounds: r };
}

/** Total seconds for the whole session. */
function totalSeconds(cfg) {
  return (cfg.coldSec + cfg.hotSec) * cfg.rounds;
}

/**
 * Build the phase plan: array of {phase, durationSec, round}.
 * Every round = cold then hot.
 */
function buildPlan(cfg) {
  const plan = [];
  for (let i = 0; i < cfg.rounds; i++) {
    plan.push({ phase: PHASE_COLD, durationSec: cfg.coldSec, round: i + 1 });
    plan.push({ phase: PHASE_HOT, durationSec: cfg.hotSec, round: i + 1 });
  }
  return plan;
}

/** Format seconds as m:ss. */
function fmtTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
// ENGINE-END

const ALARM = 'contrast-tick';
const DONE_KEY = 'contrast_state';
const LOG_KEY = 'contrast_log';

// ---- state helpers -------------------------------------------------------
async function getState() {
  const o = await chrome.storage.local.get(DONE_KEY);
  return o[DONE_KEY] || null;
}
async function setState(s) {
  await chrome.storage.local.set({ [DONE_KEY]: s });
}
async function clearState() {
  await chrome.storage.local.remove(DONE_KEY);
  await chrome.alarms.clear(ALARM);
}

// ---- session control -----------------------------------------------------
async function startSession(coldSec, hotSec, rounds) {
  const cfg = clampConfig(coldSec, hotSec, rounds);
  const plan = buildPlan(cfg);
  const state = {
    cfg,
    plan,
    idx: 0,
    phaseEnd: Date.now() + plan[0].durationSec * 1000,
    startedAt: Date.now(),
  };
  await setState(state);
  await chrome.alarms.create(ALARM, { periodInMinutes: 1 / 60 });
  await notifyPhase(state);
  return state;
}

async function stopSession(completed) {
  const state = await getState();
  if (state && completed) {
    const log = (await chrome.storage.local.get(LOG_KEY))[LOG_KEY] || [];
    log.unshift({
      when: new Date().toISOString(),
      coldSec: state.cfg.coldSec,
      hotSec: state.cfg.hotSec,
      rounds: state.cfg.rounds,
      status: 'completed',
    });
    await chrome.storage.local.set({ [LOG_KEY]: log.slice(0, 100) });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Contrast Timer',
      message: 'Session complete. Nice work.',
    });
  }
  await clearState();
}

async function skipPhase() {
  const state = await getState();
  if (!state) return null;
  return advance(state);
}

async function advance(state) {
  state.idx += 1;
  if (state.idx >= state.plan.length) {
    await stopSession(true);
    return null;
  }
  state.phaseEnd = Date.now() + state.plan[state.idx].durationSec * 1000;
  await setState(state);
  await notifyPhase(state);
  return state;
}

async function notifyPhase(state) {
  const p = state.plan[state.idx];
  const label = p.phase === PHASE_COLD ? 'COLD' : 'HOT';
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `Contrast Timer — ${label} (round ${p.round})`,
    message: `${fmtTime(p.durationSec)} — ${label === 'COLD' ? 'cold exposure' : 'heat exposure'} phase.`,
  });
}

// ---- alarm loop ----------------------------------------------------------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const state = await getState();
  if (!state) return;
  if (Date.now() >= state.phaseEnd) {
    await advance(state);
  }
});

// ---- messages from popup --------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'START') {
      sendResponse({ ok: true, state: await startSession(msg.coldSec, msg.hotSec, msg.rounds) });
    } else if (msg.type === 'STOP') {
      await stopSession(false);
      sendResponse({ ok: true });
    } else if (msg.type === 'SKIP') {
      sendResponse({ ok: true, state: await skipPhase() });
    } else if (msg.type === 'GET') {
      sendResponse({ ok: true, state: await getState() });
    } else {
      sendResponse({ ok: false });
    }
  })();
  return true;
});
