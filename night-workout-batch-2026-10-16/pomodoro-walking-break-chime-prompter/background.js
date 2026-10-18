/* Background timing engine for the Pomodoro Walking Break Prompter.
 * Uses chrome.alarms so timing survives popup close. When the popup is open,
 * it plays Web Audio chimes; when closed, a notification fires instead
 * (service workers cannot play audio).
 */

const DEFAULTS = { focusMin: 25, breakMin: 5, longEvery: 4, longMin: 15 };

/** Load persisted state; shape: {phase, endsAt, pausedLeftSec, sessions, settings}. */
async function getState() {
  const { pomo = {} } = await chrome.storage.local.get('pomo');
  return {
    phase: pomo.phase || 'idle',          // idle | focus | break | longbreak
    endsAt: pomo.endsAt || 0,             // epoch ms when current phase ends
    pausedLeftSec: pomo.pausedLeftSec || 0,
    sessions: pomo.sessions || 0,
    settings: { ...DEFAULTS, ...(pomo.settings || {}) },
  };
}

async function saveState(st) {
  await chrome.storage.local.set({ pomo: st });
}

/** Seconds remaining in the current phase (0 when idle). */
function remainingSec(st) {
  if (st.phase === 'idle') return 0;
  if (st.endsAt === 0) return st.pausedLeftSec; // paused
  return Math.max(0, Math.round((st.endsAt - Date.now()) / 1000));
}

/** Phase length in ms from settings. */
function phaseMs(phase, settings) {
  if (phase === 'focus') return settings.focusMin * 60000;
  if (phase === 'break') return settings.breakMin * 60000;
  if (phase === 'longbreak') return settings.longMin * 60000;
  return 0;
}

/** Begin a phase now. */
async function startPhase(st, phase) {
  st.phase = phase;
  st.endsAt = Date.now() + phaseMs(phase, st.settings);
  st.pausedLeftSec = 0;
  await saveState(st);
  await chrome.alarms.create('pomo-tick', { periodInMinutes: 1 / 60 });
}

/** Advance to the next phase (same rules as popup's nextPhase helper). */
async function advancePhase() {
  const st = await getState();
  let next;
  if (st.phase === 'focus') {
    st.sessions += 1;
    next = (st.sessions % st.settings.longEvery === 0) ? 'longbreak' : 'break';
  } else if (st.phase === 'idle') {
    next = 'focus';
  } else {
    next = 'focus';
  }
  await startPhase(st, next);

  // Tell open popups to chime; otherwise fire a notification.
  const sent = await broadcast({ type: 'PHASE_CHANGED', kind: (next === 'focus' ? 'focus' : 'break') });
  if (!sent) {
    const msg = next === 'focus'
      ? 'Break over — ready for the next focus session.'
      : (next === 'longbreak'
        ? 'Time for a long break — take a proper walk, stretch your legs.'
        : 'Focus done — take a short walk around.');
    chrome.notifications.create('pomo-phase', {
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: next === 'focus' ? 'Focus time' : 'Break time', message: msg,
    });
  }
}

/** Send a message to open extension pages; returns true if someone received it. */
async function broadcast(msg) {
  try {
    await chrome.runtime.sendMessage(msg);
    return true;
  } catch (e) {
    return false; // no open popup
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'pomo-tick') return;
  const st = await getState();
  if (st.phase === 'idle' || st.endsAt === 0) { await chrome.alarms.clear('pomo-tick'); return; }
  if (Date.now() >= st.endsAt) await advancePhase();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const st = await getState();
    if (msg.type === 'GET_STATE') {
      sendResponse({ state: { ...st, remainingSec: remainingSec(st) } });
    } else if (msg.type === 'SAVE_SETTINGS') {
      st.settings = { ...DEFAULTS, ...msg.settings };
      await saveState(st);
      sendResponse({ state: { ...st, remainingSec: remainingSec(st) } });
    } else if (msg.type === 'TOGGLE') {
      st.settings = { ...DEFAULTS, ...(msg.settings || {}) };
      if (st.phase === 'idle') {
        await startPhase(st, 'focus');
      } else if (st.endsAt === 0) {
        // resume from pause
        st.endsAt = Date.now() + st.pausedLeftSec * 1000;
        st.pausedLeftSec = 0;
        await saveState(st);
        await chrome.alarms.create('pomo-tick', { periodInMinutes: 1 / 60 });
      } else {
        // pause
        st.pausedLeftSec = remainingSec(st);
        st.endsAt = 0;
        await saveState(st);
        await chrome.alarms.clear('pomo-tick');
      }
      const cur = await getState();
      sendResponse({ state: { ...cur, remainingSec: remainingSec(cur) } });
    } else if (msg.type === 'RESET') {
      await chrome.alarms.clear('pomo-tick');
      const fresh = { phase: 'idle', endsAt: 0, pausedLeftSec: 0, sessions: 0, settings: st.settings };
      await saveState(fresh);
      sendResponse({ state: { ...fresh, remainingSec: 0 } });
    }
  })();
  return true; // async response
});
