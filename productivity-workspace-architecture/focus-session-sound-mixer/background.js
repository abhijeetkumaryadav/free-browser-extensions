// Focus Session Sound Mixer — service worker.
// Owns the Pomodoro state machine, schedules phase-end alarms, fires
// notifications, and routes mixer commands to the offscreen audio document.

const ALARM = "focus-phase-alarm";

const DEFAULT_TIMER = {
  phase: "idle",          // idle | focus | break | longbreak
  running: false,
  endAt: 0,               // timestamp when the current phase ends
  remainingMs: 0,         // used while paused
  focusLen: 25, breakLen: 5, longBreakLen: 15,
  sessionsBeforeLong: 4, sessionCount: 0,
};

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["timer", "mixer", "stats"]);
  if (!cur.timer) await chrome.storage.local.set({ timer: { ...DEFAULT_TIMER } });
  if (!cur.mixer) {
    await chrome.storage.local.set({
      mixer: {
        master: 0.8,
        sounds: {
          rain:  { on: false, vol: 0.6 },
          white: { on: false, vol: 0.5 },
          pink:  { on: false, vol: 0.5 },
          brown: { on: false, vol: 0.5 },
        },
      },
    });
  }
  if (!cur.stats) {
    await chrome.storage.local.set({
      stats: { todayKey: todayKey(), todaySessions: 0, totalFocusMin: 0 },
    });
  }
});

function todayKey(d = new Date()) { return d.toISOString().slice(0, 10); }
function phaseLen(t, phase) {
  return phase === "focus" ? t.focusLen : phase === "break" ? t.breakLen : t.longBreakLen;
}

// --- message router ----------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  (async () => {
    if (msg.cmd === "timer.start") await startPhase(msg.phase || "focus");
    else if (msg.cmd === "timer.pause") await pauseTimer();
    else if (msg.cmd === "timer.resume") await resumeTimer();
    else if (msg.cmd === "timer.reset") await resetTimer();
    else if (msg.cmd === "timer.skip") await skipPhase();
    else if (msg.cmd === "timer.setLengths") await setLengths(msg);
    else if (msg.cmd && msg.cmd.startsWith("audio.")) {
      // forward mixer commands to the offscreen document (creates it if needed)
      await ensureOffscreen();
      await chrome.runtime.sendMessage({ ...msg, target: "offscreen" });
    }
    respond({ ok: true });
  })().catch((e) => respond({ ok: false, error: String(e) }));
  return true; // async respond
});

// --- timer state machine -----------------------------------------------------

async function getTimer() {
  const { timer } = await chrome.storage.local.get("timer");
  return timer || { ...DEFAULT_TIMER };
}
async function setTimer(t) { await chrome.storage.local.set({ timer: t }); }

function scheduleAlarm(secondsFromNow) {
  // chrome.alarms has minute granularity; we re-check on fire for accuracy
  chrome.alarms.create(ALARM, { delayInMinutes: Math.max(1, Math.ceil(secondsFromNow / 60)) });
}

async function startPhase(phase) {
  const t = await getTimer();
  const len = phaseLen(t, phase);
  t.phase = phase;
  t.running = true;
  t.endAt = Date.now() + len * 60000;
  t.remainingMs = 0;
  await setTimer(t);
  scheduleAlarm(len * 60);
  chrome.action.setBadgeText({ text: String(len) });
  chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
}

async function pauseTimer() {
  const t = await getTimer();
  if (!t.running || t.phase === "idle") return;
  t.remainingMs = Math.max(0, t.endAt - Date.now());
  t.running = false;
  await setTimer(t);
  await chrome.alarms.clear(ALARM);
}

async function resumeTimer() {
  const t = await getTimer();
  if (t.running || t.phase === "idle" || !t.remainingMs) return;
  t.endAt = Date.now() + t.remainingMs;
  t.running = true;
  t.remainingMs = 0;
  await setTimer(t);
  scheduleAlarm((t.endAt - Date.now()) / 1000);
}

async function resetTimer() {
  await setTimer({ ...(await getTimer()), phase: "idle", running: false, endAt: 0, remainingMs: 0 });
  await chrome.alarms.clear(ALARM);
  chrome.action.setBadgeText({ text: "" });
}

async function skipPhase() {
  const t = await getTimer();
  if (t.phase === "idle") { await startPhase("focus"); return; }
  await completePhase(t, /*skipped=*/true);
}

async function setLengths(msg) {
  const t = await getTimer();
  const n = (v, fb) => (Number.isFinite(+v) && +v > 0 && +v <= 180 ? +v : fb);
  t.focusLen = n(msg.focusLen, t.focusLen);
  t.breakLen = n(msg.breakLen, t.breakLen);
  if (msg.longBreakLen != null) t.longBreakLen = n(msg.longBreakLen, t.longBreakLen);
  await setTimer(t);
}

// Fires when the alarm wakes us; the alarm is minute-granular so we verify.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const t = await getTimer();
  if (!t.running || t.phase === "idle") return;
  const remaining = t.endAt - Date.now();
  if (remaining > 8000) { scheduleAlarm(remaining / 1000); return; } // not yet — snooze
  await completePhase(t, /*skipped=*/false);
});

async function completePhase(t, skipped) {
  let next;
  if (t.phase === "focus") {
    if (!skipped) {
      t.sessionCount += 1;
      await bumpStats(t.focusLen);
    }
    next = t.sessionCount % t.sessionsBeforeLong === 0 ? "longbreak" : "break";
    if (!skipped) notify("Focus session complete", `Nice work — take a ${phaseLen(t, next)}-minute break.`);
  } else {
    next = "focus";
    if (!skipped) notify("Break over", "Ready for the next focus session?");
  }
  await startPhase(next);
}

async function bumpStats(focusMin) {
  const { stats } = await chrome.storage.local.get("stats");
  const s = stats || { todayKey: todayKey(), todaySessions: 0, totalFocusMin: 0 };
  if (s.todayKey !== todayKey()) { s.todayKey = todayKey(); s.todaySessions = 0; }
  s.todaySessions += 1;
  s.totalFocusMin += focusMin;
  await chrome.storage.local.set({ stats: s });
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title, message,
  });
}

// --- offscreen audio document ------------------------------------------------

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play ambient focus sounds even when the popup is closed.",
  });
}
