// Lo-Fi Study Room — background service worker.
// Owns the Pomodoro timer state so it survives the popup closing.
// State shape in chrome.storage.local under "lofi":
// { mode, modeMins, running, endTime, remainingMs, stats: { date, focus, breaks, minutes } }

const STORE_KEY = 'lofi';
const ALARM_NAME = 'lofi-session';

/** Load state, creating defaults if missing. */
async function load() {
  const res = await chrome.storage.local.get(STORE_KEY);
  const today = new Date().toISOString().slice(0, 10);
  const d = res[STORE_KEY] || {};
  // Reset daily stats on a new day.
  if (d.stats && d.stats.date !== today) {
    d.stats = { date: today, focus: 0, breaks: 0, minutes: 0 };
  }
  return Object.assign({
    mode: 'focus', modeMins: 25, running: false,
    endTime: 0, remainingMs: 25 * 60 * 1000,
    stats: { date: today, focus: 0, breaks: 0, minutes: 0 }
  }, d);
}

async function save(state) {
  await chrome.storage.local.set({ [STORE_KEY]: state });
}

/** Start a session of `mins` minutes. */
async function startSession(mode, mins) {
  const s = await load();
  const ms = Math.max(1, mins) * 60 * 1000;
  s.mode = mode; s.modeMins = mins;
  s.running = true;
  s.endTime = Date.now() + ms;
  s.remainingMs = ms;
  await save(s);
  await chrome.alarms.create(ALARM_NAME, { when: s.endTime });
}

/** Pause: freeze remaining time, clear the alarm. */
async function pauseSession() {
  const s = await load();
  if (!s.running) return;
  s.remainingMs = Math.max(0, s.endTime - Date.now());
  s.running = false; s.endTime = 0;
  await save(s);
  await chrome.alarms.clear(ALARM_NAME);
}

/** Resume from frozen remaining time. */
async function resumeSession() {
  const s = await load();
  if (s.running || s.remainingMs <= 0) return;
  s.running = true;
  s.endTime = Date.now() + s.remainingMs;
  await save(s);
  await chrome.alarms.create(ALARM_NAME, { when: s.endTime });
}

/** Reset to the current mode's full duration. */
async function resetSession() {
  const s = await load();
  s.running = false; s.endTime = 0;
  s.remainingMs = s.modeMins * 60 * 1000;
  await save(s);
  await chrome.alarms.clear(ALARM_NAME);
}

/** Alarm fired: session complete. Update stats, notify. */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const s = await load();
  s.running = false; s.endTime = 0;
  s.remainingMs = s.modeMins * 60 * 1000;
  if (s.mode === 'focus') {
    s.stats.focus += 1;
    s.stats.minutes += s.modeMins;
  } else {
    s.stats.breaks += 1;
  }
  await save(s);
  const label = s.mode === 'focus' ? 'Focus session complete — take a breather.'
    : 'Break over — ready for another round?';
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Lo-Fi Study Room',
    message: label
  });
});

/** If the service worker restarts, re-arm any running alarm. */
chrome.runtime.onStartup.addListener(async () => {
  const s = await load();
  if (s.running && s.endTime > Date.now()) {
    chrome.alarms.create(ALARM_NAME, { when: s.endTime });
  } else if (s.running) {
    s.running = false; s.endTime = 0; // expired while asleep
    await save(s);
  }
});

/** Popup <-> background messages. */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === 'getState') sendResponse(await load());
    else if (msg.type === 'start') { await startSession(msg.mode, msg.mins); sendResponse(await load()); }
    else if (msg.type === 'pause') { await pauseSession(); sendResponse(await load()); }
    else if (msg.type === 'resume') { await resumeSession(); sendResponse(await load()); }
    else if (msg.type === 'reset') { await resetSession(); sendResponse(await load()); }
    else if (msg.type === 'setMode') {
      const s = await load();
      s.mode = msg.mode; s.modeMins = msg.mins;
      s.running = false; s.endTime = 0;
      s.remainingMs = msg.mins * 60 * 1000;
      await save(s);
      await chrome.alarms.clear(ALARM_NAME);
      sendResponse(s);
    }
  })();
  return true; // keep channel open for async response
});
