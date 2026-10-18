/* ============================================================
 * Break Gate — popup logic
 * Sends start/cancel commands to the background worker; mirrors
 * the live countdown; plays a chime when the break completes while
 * the popup is open (service workers can't play audio).
 * ============================================================ */

const $ = (id) => document.getElementById(id);
const KEY = "breakGateState";
const DONE_KEY = "breakGateDone";

let state = { active: false };
let tickId = null;

// --- Chime (generated Web Audio, no files) ---
let audioCtx = null;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.22 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + i * 0.22);
      o.stop(now + i * 0.22 + 0.55);
    });
  } catch (e) { /* audio unavailable */ }
}

async function getState() {
  const r = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  return r || { active: false };
}

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

function renderIdle() {
  $("idleCard").hidden = false;
  $("activeCard").hidden = true;
  stopTicker();
}

function renderActive() {
  $("idleCard").hidden = true;
  $("activeCard").hidden = false;
  startTicker();
}

function startTicker() {
  stopTicker();
  tickId = setInterval(async () => {
    state = await getState();
    if (!state.active) {
      // Break just finished.
      renderIdle();
      refreshDone();
      chime();
      return;
    }
    $("timer").textContent = fmt(state.endsAt - Date.now());
  }, 500);
}

function stopTicker() {
  if (tickId) clearInterval(tickId);
  tickId = null;
}

async function refreshDone() {
  const { [DONE_KEY]: n = 0 } = await chrome.storage.local.get(DONE_KEY);
  $("doneCount").textContent = n;
  // Count completions: doneAt set since last refresh.
  if (state.doneAt) {
    const last = Number(sessionStorage.getItem("bgLastDone") || 0);
    if (state.doneAt > last) {
      sessionStorage.setItem("bgLastDone", String(state.doneAt));
      await chrome.storage.local.set({ [DONE_KEY]: n + 1 });
      $("doneCount").textContent = n + 1;
    }
  }
}

// Watch for completion via storage events too.
chrome.storage.onChanged.addListener((changes) => {
  if (changes[KEY] && !changes[KEY].newValue.active) {
    chime();
    refreshDone();
  }
});

$("btnStart").addEventListener("click", async () => {
  $("err").hidden = true;
  const mins = Number($("selMins").value);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    $("err").hidden = false;
    $("err").textContent = "No active tab found.";
    return;
  }
  if (/^(chrome|edge|about):/.test(tab.url || "")) {
    $("err").hidden = false;
    $("err").textContent = "Can't lock browser-internal pages. Pick a web page.";
    return;
  }
  const r = await chrome.runtime.sendMessage({ type: "START_BREAK", minutes: mins, tabId: tab.id });
  if (r && r.ok) {
    state = await getState();
    renderActive();
  } else {
    $("err").hidden = false;
    $("err").textContent = "Couldn't lock this tab. Try a different page.";
  }
});

$("btnCancel").addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "CANCEL_BREAK" });
  state = await getState();
  renderIdle();
  refreshDone();
});

// Init.
(async () => {
  state = await getState();
  if (state.active) renderActive();
  else renderIdle();
  refreshDone();
})();
