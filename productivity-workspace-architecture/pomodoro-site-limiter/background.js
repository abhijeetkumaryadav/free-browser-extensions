/* Pomodoro Site Limiter — service worker
   Owns the session state machine. Content scripts ask "shouldBlock(host)"
   and get back whether a focus session is running and the host is blocklisted. */

const END_ALARM = 'session-end';

/* ---------- Messaging ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === 'start') {
      await startSession(msg.focusMin, msg.breakMin);
      sendResponse({ ok: true });
    } else if (msg.type === 'reset') {
      await resetSession();
      sendResponse({ ok: true });
    } else if (msg.type === 'shouldBlock') {
      sendResponse(await shouldBlock(msg.host));
    } else if (msg.type === 'getState') {
      sendResponse(await getState());
    }
  })();
  return true; // async response
});

/* ---------- Session machine ---------- */
async function startSession(focusMin, breakMin) {
  const session = {
    phase: 'focus',
    endsAt: Date.now() + focusMin * 60 * 1000,
    focusMin,
    breakMin,
    running: true,
  };
  await chrome.storage.local.set({ session });
  scheduleEnd(session.endsAt);
}

async function resetSession() {
  await chrome.storage.local.set({ session: null });
  await chrome.alarms.clear(END_ALARM);
}

function scheduleEnd(endsAt) {
  chrome.alarms.clear(END_ALARM, () => {
    chrome.alarms.create(END_ALARM, { when: endsAt });
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== END_ALARM) return;
  const { session } = await chrome.storage.local.get('session');
  if (!session || !session.running) return;

  if (session.phase === 'focus') {
    // Focus complete → start break automatically.
    const { stats = { completed: 0 } } = await chrome.storage.local.get('stats');
    stats.completed += 1;
    const next = {
      phase: 'break',
      endsAt: Date.now() + session.breakMin * 60 * 1000,
      focusMin: session.focusMin,
      breakMin: session.breakMin,
      running: true,
    };
    await chrome.storage.local.set({ session: next, stats });
    scheduleEnd(next.endsAt);
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Focus session complete',
      message: `Nice work. Take a ${session.breakMin}-minute break — sites are unlocked.`,
      priority: 2,
    });
  } else {
    // Break over → idle.
    await chrome.storage.local.set({ session: null });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Break over',
      message: 'Ready for another focus session?',
      priority: 2,
    });
  }
});

// Restore the alarm after browser restart.
chrome.runtime.onStartup.addListener(async () => {
  const { session } = await chrome.storage.local.get('session');
  if (session && session.running && session.endsAt > Date.now()) {
    scheduleEnd(session.endsAt);
  } else if (session && session.running) {
    // Session expired while the browser was closed → go idle.
    await chrome.storage.local.set({ session: null });
  }
});

/* ---------- Block check for content scripts ---------- */
function normalizeHost(host) {
  return (host || '').toLowerCase().replace(/^www\./, '');
}

async function shouldBlock(host) {
  const { session, blocklist = [] } = await chrome.storage.local.get(['session', 'blocklist']);
  const active = session && session.running && session.phase === 'focus' && session.endsAt > Date.now();
  if (!active) return { blocked: false };
  const h = normalizeHost(host);
  const blocked = blocklist.some((b) => h === b || h.endsWith('.' + b));
  if (!blocked) return { blocked: false };
  return { blocked: true, remainingMs: session.endsAt - Date.now() };
}

async function getState() {
  const { session, stats = { completed: 0 } } = await chrome.storage.local.get(['session', 'stats']);
  if (session && session.running && session.endsAt <= Date.now()) {
    await chrome.storage.local.set({ session: null });
    return { session: null, stats };
  }
  return { session, stats };
}
