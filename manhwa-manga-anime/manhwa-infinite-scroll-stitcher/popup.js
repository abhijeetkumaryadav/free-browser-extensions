/* StripFlow popup logic.
 * The content script (scroll.js) is injected on demand into the active tab
 * via scripting.executeScript; all commands go through tabs.sendMessage. */

const els = {
  toggleBtn: document.getElementById("toggleBtn"),
  toggleLabel: document.getElementById("toggleLabel"),
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  speedSlider: document.getElementById("speedSlider"),
  speedVal: document.getElementById("speedVal"),
  pauseOnUser: document.getElementById("pauseOnUser"),
  stopAtBottom: document.getElementById("stopAtBottom"),
  toTop: document.getElementById("toTop"),
  toBottom: document.getElementById("toBottom"),
};

const DEFAULTS = { speed: 60, pauseOnUser: true, stopAtBottom: true };
let prefs = { ...DEFAULTS };
let running = false;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(tab) {
  return tab && tab.id != null && /^https?:/.test(tab.url || "");
}

/* Ensure scroll.js is present in the tab, then send a message. */
async function send(action, extra = {}) {
  const tab = await getActiveTab();
  if (!injectable(tab)) throw new Error("not-injectable");
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["scroll.js"] });
  } catch (e) {
    // Injection can fail on restricted pages; surface as not-injectable.
    throw new Error("not-injectable");
  }
  return chrome.tabs.sendMessage(tab.id, { target: "stripflow", action, ...extra });
}

async function refreshState() {
  try {
    const res = await send("getState");
    running = !!res.running;
    if (res.speed && res.speed !== prefs.speed) {
      prefs.speed = res.speed;
      await chrome.storage.local.set({ stripflow: prefs });
      syncSpeedUI();
    }
  } catch {
    running = false; // content script not injected yet / page not supported
  }
  render();
}

function render() {
  els.statusPill.classList.toggle("on", running);
  els.statusText.textContent = running ? "Scrolling" : "Idle";
  els.toggleLabel.textContent = running ? "Stop auto-scroll" : "Start auto-scroll";
  els.toggleBtn.classList.toggle("off", running);
}

function syncSpeedUI() {
  els.speedSlider.value = prefs.speed;
  els.speedVal.textContent = prefs.speed + " px/s";
  document.querySelectorAll(".chip").forEach(c =>
    c.classList.toggle("active", Number(c.dataset.speed) === prefs.speed));
}

async function savePrefs() {
  await chrome.storage.local.set({ stripflow: prefs });
}

/* ---------- events ---------- */

els.toggleBtn.addEventListener("click", async () => {
  try {
    if (running) {
      await send("stop");
    } else {
      await send("start", {
        speed: prefs.speed,
        pauseOnUser: prefs.pauseOnUser,
        stopAtBottom: prefs.stopAtBottom,
      });
    }
    await refreshState();
  } catch {
    els.statusText.textContent = "Unsupported page";
  }
});

let speedDebounce = null;
els.speedSlider.addEventListener("input", () => {
  prefs.speed = Number(els.speedSlider.value);
  syncSpeedUI();
  clearTimeout(speedDebounce);
  speedDebounce = setTimeout(async () => {
    await savePrefs();
    if (running) { try { await send("setSpeed", { speed: prefs.speed }); } catch { /* noop */ } }
  }, 120);
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", async () => {
    prefs.speed = Number(chip.dataset.speed);
    syncSpeedUI();
    await savePrefs();
    if (running) { try { await send("setSpeed", { speed: prefs.speed }); } catch { /* noop */ } }
  });
});

els.pauseOnUser.addEventListener("change", async () => {
  prefs.pauseOnUser = els.pauseOnUser.checked;
  await savePrefs();
  if (running) { try { await send("setOptions", { pauseOnUser: prefs.pauseOnUser }); } catch { /* noop */ } }
});

els.stopAtBottom.addEventListener("change", async () => {
  prefs.stopAtBottom = els.stopAtBottom.checked;
  await savePrefs();
  if (running) { try { await send("setOptions", { stopAtBottom: prefs.stopAtBottom }); } catch { /* noop */ } }
});

els.toTop.addEventListener("click", async () => { try { await send("toTop"); } catch { /* noop */ } });
els.toBottom.addEventListener("click", async () => { try { await send("toBottom"); } catch { /* noop */ } });

/* ---------- init ---------- */

(async function init() {
  const data = await chrome.storage.local.get({ stripflow: DEFAULTS });
  prefs = { ...DEFAULTS, ...data.stripflow };
  els.pauseOnUser.checked = prefs.pauseOnUser;
  els.stopAtBottom.checked = prefs.stopAtBottom;
  syncSpeedUI();
  await refreshState();
})();
