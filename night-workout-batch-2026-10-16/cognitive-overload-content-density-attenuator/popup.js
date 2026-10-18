"use strict";
/* =====================================================================
 * Calm Mode popup — toggles declutter for the active tab.
 *
 * Click-only scripting: the content script is injected only when the
 * user flips the switch. Toggle-off sends CALM_REMOVE so the page is
 * fully restored. No background tracking; per-tab state kept in memory
 * + a global on/off + dim preference in storage.
 * =================================================================== */

/* ---------- DOM ---------- */
const power   = document.getElementById("power");
const dim     = document.getElementById("dim");
const dimVal  = document.getElementById("dimVal");
const hiddenCount = document.getElementById("hiddenCount");
const tabState    = document.getElementById("tabState");
const msg     = document.getElementById("msg");
const refreshBtn = document.getElementById("refresh");

/* ---------- State ---------- */
let tabId = null;
const activeTabs = new Set(); // tabs currently decluttered

/* ---------- Prefs ---------- */
chrome.storage.local.get({ dim: 0 }, (p) => {
  dim.value = p.dim;
  dimVal.textContent = p.dim + "%";
});

/* ---------- Helpers ---------- */
function guardable(url) {
  return url && /^(https?|file):/.test(url);
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(id) {
  try {
    await chrome.tabs.sendMessage(id, { type: "CALM_PING" });
  } catch (e) {
    /* No content script yet — inject on user action only. */
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ["content.js"] });
  }
}

async function applyAll() {
  if (tabId == null) return;
  await ensureInjected(tabId);
  const res = await chrome.tabs.sendMessage(tabId, { type: "CALM_APPLY", dim: Number(dim.value) });
  hiddenCount.textContent = res && typeof res.hidden === "number" ? res.hidden : "0";
  tabState.textContent = "on";
  tabState.style.color = "var(--accent)";
  msg.textContent = "Decluttered — flip off to restore the page.";
}

async function removeAll() {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "CALM_REMOVE" });
  } catch (e) { /* tab may have navigated; styles were page-scoped anyway */ }
  activeTabs.delete(tabId);
  hiddenCount.textContent = "–";
  tabState.textContent = "off";
  tabState.style.color = "";
  msg.textContent = "Toggle to declutter this page.";
}

/* ---------- Events ---------- */
power.addEventListener("change", async () => {
  if (power.checked) { activeTabs.add(tabId); await applyAll(); }
  else { await removeAll(); }
});

dim.addEventListener("input", async () => {
  dimVal.textContent = dim.value + "%";
  chrome.storage.local.set({ dim: Number(dim.value) });
  if (power.checked && tabId != null) {
    try { await chrome.tabs.sendMessage(tabId, { type: "CALM_DIM", dim: Number(dim.value) }); }
    catch (e) { /* ignore */ }
  }
});

refreshBtn.addEventListener("click", async () => {
  if (!power.checked) { msg.textContent = "Turn the switch on first."; return; }
  await applyAll();
});

/* ---------- Init ---------- */
(async function init() {
  const tab = await currentTab();
  if (!tab || !guardable(tab.url)) {
    msg.textContent = "Not available on this page (internal/browser pages are off-limits).";
    power.disabled = true;
    return;
  }
  tabId = tab.id;
  power.checked = activeTabs.has(tabId);
  if (power.checked) { await applyAll(); }
})();
