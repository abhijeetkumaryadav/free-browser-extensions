/* ============================================================
 * Break Gate — background service worker
 * Owns the movement-break timer so it survives popup close.
 * State: { active, endsAt, tabId, url } in chrome.storage.local.
 * On completion: clear overlay in the tab, notify, chime is
 * triggered in the popup when open (workers can't play audio).
 * ============================================================ */

const KEY = "breakGateState";
const ALARM = "break-gate-tick";

// Compute tick interval: every second while <60s remain, else every 30s
// (alarms don't fire more often than ~30s in MV3, so the content overlay
// keeps its own local countdown and we only reconcile state).
function scheduleTick() {
  chrome.alarms.clear(ALARM, () => {
    chrome.alarms.create(ALARM, { periodInMinutes: 0.5 });
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  const { [KEY]: st } = await chrome.storage.local.get(KEY);
  if (!st || !st.active) return;
  if (Date.now() >= st.endsAt) {
    await finishBreak(st);
  }
});

async function finishBreak(st) {
  await chrome.storage.local.set({ [KEY]: { active: false, doneAt: Date.now() } });
  chrome.alarms.clear(ALARM);
  // Remove overlay from the locked tab (best effort).
  if (st.tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: st.tabId },
        func: () => {
          const el = document.getElementById("__break-gate-overlay");
          if (el) el.remove();
        },
      });
    } catch (e) { /* tab may be closed */ }
  }
  chrome.notifications.create({
    type: "basic",
    title: "Break Gate — done",
    message: "Movement break complete. Tab unlocked. Nice work.",
  });
}

// Start a break: lock the tab with an overlay, set timer.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_BREAK") {
    startBreak(msg.minutes, msg.tabId).then((ok) => sendResponse({ ok }));
    return true; // async
  }
  if (msg.type === "GET_STATE") {
    chrome.storage.local.get(KEY).then((r) => sendResponse(r[KEY] || { active: false }));
    return true;
  }
  if (msg.type === "CANCEL_BREAK") {
    cancelBreak().then(() => sendResponse({ ok: true }));
    return true;
  }
});

async function startBreak(minutes, tabId) {
  const mins = Math.min(5, Math.max(1, Number(minutes) || 1));
  const endsAt = Date.now() + mins * 60 * 1000;
  await chrome.storage.local.set({ [KEY]: { active: true, endsAt, tabId, mins } });
  scheduleTick();
  // Inject the lock overlay (click-only, user-triggered).
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (durMs) => {
        if (document.getElementById("__break-gate-overlay")) return;
        const o = document.createElement("div");
        o.id = "__break-gate-overlay";
        o.style.cssText =
          "position:fixed;inset:0;z-index:2147483647;display:flex;" +
          "flex-direction:column;align-items:center;justify-content:center;gap:16px;" +
          "background:rgba(10,10,16,.96);color:#fff;font-family:system-ui,sans-serif;" +
          "backdrop-filter:blur(10px);text-align:center;padding:24px;";
        const until = Date.now() + durMs;
        o.innerHTML =
          '<div style="font-size:52px">🧘</div>' +
          '<div style="font-size:20px;font-weight:700;color:#fb7185">Break Gate</div>' +
          '<div style="max-width:340px;color:#c9c9dc">Movement break in progress — honor system. ' +
          'Do your jumping jacks / stretch. This tab unlocks when the timer ends.</div>' +
          '<div id="__bg-time" style="font-size:44px;font-weight:800;color:#fb7185">--:--</div>' +
          '<div style="font-size:12px;color:#9a9ab0">Exercise can\'t be verified — honor system.</div>';
        document.documentElement.appendChild(o);
        const el = document.getElementById("__bg-time");
        const t = setInterval(() => {
          const left = Math.max(0, until - Date.now());
          const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
          el.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
          if (left <= 0 || !document.getElementById("__break-gate-overlay")) clearInterval(t);
        }, 500);
      },
      args: [mins * 60 * 1000],
    });
    return true;
  } catch (e) {
    await chrome.storage.local.set({ [KEY]: { active: false } });
    return false;
  }
}

async function cancelBreak() {
  const { [KEY]: st } = await chrome.storage.local.get(KEY);
  if (st && st.tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: st.tabId },
        func: () => {
          const el = document.getElementById("__break-gate-overlay");
          if (el) el.remove();
        },
      });
    } catch (e) { /* ignore */ }
  }
  chrome.alarms.clear(ALARM);
  await chrome.storage.local.set({ [KEY]: { active: false } });
}
