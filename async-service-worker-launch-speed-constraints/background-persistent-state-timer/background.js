/* EverTimer background service worker.
 * Single source of truth for timer state (chrome.storage.local).
 * Uses chrome.alarms so timers survive restarts and fire while backgrounded.
 *
 * Timer shape:
 *   { id, name, kind: 'countdown' | 'stopwatch',
 *     state: 'running' | 'paused' | 'done',
 *     durationMs,            // countdown: original length
 *     endAt,                 // countdown running: epoch ms when it ends
 *     remainingMs,           // countdown paused/done: ms left
 *     baseMs,                // stopwatch: accumulated ms while paused
 *     startedAt }            // stopwatch running: epoch ms of (re)start
 *
 * Honest granularity note: while the browser is backgrounded, alarm ticks
 * are coalesced to ~1 minute. A countdown's *completion* alarm fires close
 * to on time; the live display only refreshes to the minute in the badge.
 */

var KEY = 'evertimer:timers';

async function getTimers() {
  var o = await chrome.storage.local.get(KEY);
  return o[KEY] || [];
}
async function setTimers(t) {
  await chrome.storage.local.set({ [KEY]: t });
}
function uid() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function endAlarmName(id) { return 'evertimer:end:' + id; }

/* Schedule (or clear) the one-shot completion alarm for a countdown. */
async function syncEndAlarm(timer) {
  var name = endAlarmName(timer.id);
  await chrome.alarms.clear(name);
  if (timer.kind === 'countdown' && timer.state === 'running' && timer.endAt > Date.now()) {
    await chrome.alarms.create(name, { when: timer.endAt });
  }
}

async function completeTimer(timer) {
  var timers = await getTimers();
  var t = timers.find(function (x) { return x.id === timer.id; });
  if (!t || t.state !== 'running') return;
  t.state = 'done';
  t.remainingMs = 0;
  t.endAt = null;
  await setTimers(timers);
  await chrome.alarms.clear(endAlarmName(t.id));
  try {
    await chrome.notifications.create('evertimer:done:' + t.id, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⏰ ' + t.name,
      message: 'Time is up!'
    });
  } catch (e) {}
  await updateBadge();
}

/* Badge shows the shortest-running countdown, e.g. "4m" or "2h". */
async function updateBadge() {
  var timers = await getTimers();
  var now = Date.now();
  var best = null;
  timers.forEach(function (t) {
    if (t.kind !== 'countdown' || t.state !== 'running') return;
    var ms = Math.max(0, t.endAt - now);
    if (best === null || ms < best) best = ms;
  });
  if (best === null) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  var text = best < 3600000
    ? Math.ceil(best / 60000) + 'm'
    : Math.floor(best / 3600000) + 'h';
  await chrome.action.setBadgeText({ text: text });
  await chrome.action.setBadgeBackgroundColor({ color: '#b45309' });
}

/* Reconcile on startup: finish countdowns that elapsed while closed. */
chrome.runtime.onStartup.addListener(reconcile);
chrome.runtime.onInstalled.addListener(reconcile);

async function reconcile() {
  var timers = await getTimers();
  var now = Date.now();
  var changed = false;
  for (var t of timers) {
    if (t.kind === 'countdown' && t.state === 'running') {
      if (t.endAt <= now) {
        t.state = 'done';
        t.remainingMs = 0;
        t.endAt = null;
        changed = true;
        try {
          await chrome.notifications.create('evertimer:done:' + t.id, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '⏰ ' + t.name,
            message: 'Time is up! (finished while the browser was closed)'
          });
        } catch (e) {}
      } else {
        await syncEndAlarm(t);
      }
    }
  }
  if (changed) await setTimers(timers);
  await updateBadge();
}

/* Completion alarms. */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.indexOf('evertimer:end:') === 0) {
    var id = alarm.name.slice('evertimer:end:'.length);
    var timers = await getTimers();
    var t = timers.find(function (x) { return x.id === id; });
    if (t) await completeTimer(t);
  }
});

/* Keep the badge fresh while backgrounded (alarm granularity ~1 min). */
chrome.alarms.create('evertimer:tick', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'evertimer:tick') await updateBadge();
});

/* ---------- popup API ---------- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    var timers = await getTimers();
    if (msg.type === 'list') {
      sendResponse({ timers: timers, now: Date.now() });
    } else if (msg.type === 'addCountdown') {
      var t = {
        id: uid(), name: (msg.name || 'Timer').slice(0, 40) || 'Timer',
        kind: 'countdown', state: 'running',
        durationMs: msg.durationMs, endAt: Date.now() + msg.durationMs,
        remainingMs: msg.durationMs, baseMs: 0, startedAt: null
      };
      timers.unshift(t);
      await setTimers(timers);
      await syncEndAlarm(t);
      await updateBadge();
      sendResponse({ ok: true, timer: t });
    } else if (msg.type === 'addStopwatch') {
      var s = {
        id: uid(), name: (msg.name || 'Stopwatch').slice(0, 40) || 'Stopwatch',
        kind: 'stopwatch', state: 'running',
        durationMs: 0, endAt: null, remainingMs: 0, baseMs: 0, startedAt: Date.now()
      };
      timers.unshift(s);
      await setTimers(timers);
      await updateBadge();
      sendResponse({ ok: true, timer: s });
    } else if (msg.type === 'pause') {
      var p = timers.find(function (x) { return x.id === msg.id; });
      if (p && p.state === 'running') {
        if (p.kind === 'countdown') {
          p.remainingMs = Math.max(0, p.endAt - Date.now());
          p.endAt = null;
          await chrome.alarms.clear(endAlarmName(p.id));
        } else {
          p.baseMs += Date.now() - p.startedAt;
          p.startedAt = null;
        }
        p.state = 'paused';
        await setTimers(timers);
        await updateBadge();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'resume') {
      var r = timers.find(function (x) { return x.id === msg.id; });
      if (r && r.state === 'paused') {
        if (r.kind === 'countdown') {
          r.endAt = Date.now() + r.remainingMs;
          await syncEndAlarm(r);
        } else {
          r.startedAt = Date.now();
        }
        r.state = 'running';
        await setTimers(timers);
        await updateBadge();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'reset') {
      var z = timers.find(function (x) { return x.id === msg.id; });
      if (z) {
        if (z.kind === 'countdown') {
          z.state = 'running';
          z.remainingMs = z.durationMs;
          z.endAt = Date.now() + z.durationMs;
          await syncEndAlarm(z);
        } else {
          z.state = 'running';
          z.baseMs = 0;
          z.startedAt = Date.now();
        }
        await setTimers(timers);
        await updateBadge();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'remove') {
      timers = timers.filter(function (x) { return x.id !== msg.id; });
      await setTimers(timers);
      await chrome.alarms.clear(endAlarmName(msg.id));
      await updateBadge();
      sendResponse({ ok: true });
    }
  })();
  return true;
});
