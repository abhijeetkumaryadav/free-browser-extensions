/* Background timing engine for the fasting tracker.
 * chrome.alarms keeps timing alive when the popup is closed; notifications
 * announce window transitions (service workers cannot play audio).
 */

const DEFAULT_PLAN = { fastH: 16, eatH: 8 };

/** Load state; shape {phase, startedAt, endsAt, plan, history[]}. */
async function getState() {
  const { fast = {} } = await chrome.storage.local.get('fast');
  return {
    phase: fast.phase || 'idle',       // idle | fasting | eating
    startedAt: fast.startedAt || 0,
    endsAt: fast.endsAt || 0,
    plan: { ...DEFAULT_PLAN, ...(fast.plan || {}) },
    history: Array.isArray(fast.history) ? fast.history : [],
  };
}

async function saveState(st) {
  await chrome.storage.local.set({ fast: st });
}

/** Begin the fasting phase now. */
async function startFast(plan) {
  const now = Date.now();
  const st = await getState();
  st.phase = 'fasting';
  st.startedAt = now;
  st.endsAt = now + plan.fastH * 3600000;
  st.plan = plan;
  await saveState(st);
  await chrome.alarms.create('fast-tick', { periodInMinutes: 1 / 60 });
}

/** Record the finished phase into history (bounded at 100 entries). */
function recordHistory(st, completed) {
  st.history.unshift({
    endedAt: Date.now(),
    durationMs: Date.now() - st.startedAt,
    phase: st.phase,
    completed,
  });
  st.history = st.history.slice(0, 100);
}

/** Transition: fasting -> eating -> idle, with a notification. */
async function advancePhase() {
  const st = await getState();
  if (st.phase === 'fasting') {
    recordHistory(st, true);
    st.phase = 'eating';
    st.startedAt = Date.now();
    st.endsAt = Date.now() + st.plan.eatH * 3600000;
    await saveState(st);
    chrome.notifications.create('fast-window', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Eating window open',
      message: 'Your fasting window is complete. Eating window: ' + st.plan.eatH + 'h.',
    });
  } else if (st.phase === 'eating') {
    st.phase = 'idle';
    st.startedAt = 0; st.endsAt = 0;
    await saveState(st);
    await chrome.alarms.clear('fast-tick');
    chrome.notifications.create('fast-window', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Eating window closed',
      message: 'Your eating window has ended.',
    });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'fast-tick') return;
  const st = await getState();
  if (st.phase === 'idle') { await chrome.alarms.clear('fast-tick'); return; }
  if (Date.now() >= st.endsAt) await advancePhase();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'GET_STATE') {
      sendResponse({ state: await getState() });
    } else if (msg.type === 'SAVE_PLAN') {
      const st = await getState();
      st.plan = { ...DEFAULT_PLAN, ...msg.plan };
      await saveState(st);
      sendResponse({ state: st });
    } else if (msg.type === 'START_FAST') {
      await startFast({ ...DEFAULT_PLAN, ...msg.plan });
      sendResponse({ state: await getState() });
    } else if (msg.type === 'STOP') {
      const st = await getState();
      if (st.phase !== 'idle') {
        recordHistory(st, false);
        st.phase = 'idle'; st.startedAt = 0; st.endsAt = 0;
        await saveState(st);
        await chrome.alarms.clear('fast-tick');
      }
      sendResponse({ state: st });
    }
  })();
  return true; // async response
});
