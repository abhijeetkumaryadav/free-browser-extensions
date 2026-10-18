// Tab Audio Channel Splitter & Mixer — popup logic.
//
// Talks only to the background service worker; the service worker owns the
// offscreen Web Audio graph. Settings persist per session via chrome.storage.

const DEFAULTS = {
  balance: 0,    // -1 (full L) .. +1 (full R)
  swap: false,
  mono: false,
  muteL: false,
  muteR: false
};

const els = {
  statusPill: document.getElementById("statusPill"),
  statusText: document.getElementById("statusText"),
  powerBtn: document.getElementById("powerBtn"),
  powerLabel: document.getElementById("powerLabel"),
  controlsCard: document.getElementById("controlsCard"),
  balance: document.getElementById("balance"),
  balanceValue: document.getElementById("balanceValue"),
  swapBtn: document.getElementById("swapBtn"),
  monoBtn: document.getElementById("monoBtn"),
  muteLBtn: document.getElementById("muteLBtn"),
  muteRBtn: document.getElementById("muteRBtn"),
  resetBtn: document.getElementById("resetBtn")
};

let settings = { ...DEFAULTS };
let currentTabId = null;
let enabled = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function sendToBackground(msg) {
  return chrome.runtime.sendMessage(msg);
}

function balanceLabel(v) {
  if (v === 0) return "Center";
  const pct = Math.abs(Math.round(v * 100));
  return v < 0 ? `L ${pct}%` : `R ${pct}%`;
}

// ---------------------------------------------------------------------------
// UI rendering
// ---------------------------------------------------------------------------
function render() {
  els.statusPill.classList.toggle("on", enabled);
  els.statusText.textContent = enabled ? "On" : "Off";
  els.powerBtn.classList.toggle("active", enabled);
  els.powerLabel.textContent = enabled ? "Disable mixer" : "Enable mixer for this tab";
  els.controlsCard.classList.toggle("enabled", enabled);

  els.balance.value = Math.round(settings.balance * 100);
  els.balanceValue.textContent = balanceLabel(settings.balance);
  els.swapBtn.setAttribute("aria-pressed", String(settings.swap));
  els.monoBtn.setAttribute("aria-pressed", String(settings.mono));
  els.muteLBtn.setAttribute("aria-pressed", String(settings.muteL));
  els.muteRBtn.setAttribute("aria-pressed", String(settings.muteR));
}

async function pushSettings() {
  render();
  await chrome.storage.session.set({ mixerSettings: settings });
  if (enabled) {
    await sendToBackground({ type: "mixer-update", settings });
  }
}

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------
async function togglePower() {
  if (!currentTabId) return;
  if (!enabled) {
    const res = await sendToBackground({
      type: "mixer-start",
      tabId: currentTabId,
      settings
    });
    if (res && res.ok) {
      enabled = true;
    } else {
      // Surface capture failures (e.g. chrome:// pages) in the status pill.
      els.statusText.textContent = "Failed";
      setTimeout(render, 1600);
      return;
    }
  } else {
    await sendToBackground({ type: "mixer-stop" });
    enabled = false;
  }
  render();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
els.powerBtn.addEventListener("click", togglePower);

els.balance.addEventListener("input", () => {
  settings.balance = parseInt(els.balance.value, 10) / 100;
  pushSettings();
});

els.swapBtn.addEventListener("click", () => {
  settings.swap = !settings.swap;
  pushSettings();
});

els.monoBtn.addEventListener("click", () => {
  settings.mono = !settings.mono;
  pushSettings();
});

els.muteLBtn.addEventListener("click", () => {
  settings.muteL = !settings.muteL;
  pushSettings();
});

els.muteRBtn.addEventListener("click", () => {
  settings.muteR = !settings.muteR;
  pushSettings();
});

els.resetBtn.addEventListener("click", () => {
  settings = { ...DEFAULTS };
  pushSettings();
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
(async function init() {
  const tab = await getActiveTab();
  if (tab) currentTabId = tab.id;

  const stored = await chrome.storage.session.get("mixerSettings");
  if (stored.mixerSettings) settings = { ...DEFAULTS, ...stored.mixerSettings };

  const status = await sendToBackground({ type: "mixer-status" });
  enabled = !!(status && status.ok && status.activeTabId === currentTabId);

  // If the mixer is running on a *different* tab, reflect that without controls.
  if (status && status.ok && status.activeTabId && status.activeTabId !== currentTabId) {
    els.statusText.textContent = "On (other tab)";
  }

  render();
})();
