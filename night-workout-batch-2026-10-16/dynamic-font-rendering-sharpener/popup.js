/* FontSharp popup logic — reads/writes chrome.storage.local, injects content script on demand. */
"use strict";

const DEFAULTS = { smoothing: 1, spacing: 0, contrast: 0, autoSites: [] };
const PRESETS = {
  crisp:  { smoothing: 2, spacing: 0.01, contrast: 10 },
  soft:   { smoothing: 0, spacing: 0,    contrast: 0  },
  reader: { smoothing: 2, spacing: 0.04, contrast: 15 },
  off:    { smoothing: 1, spacing: 0,    contrast: 0  }
};
const SMOOTH_LABELS = ["None", "Auto", "Antialiased"];

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function flash(msg) {
  statusEl.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { statusEl.textContent = ""; }, 2200);
}

async function getSettings() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "fontsharp-status" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

async function applyNow(cfg) {
  const tab = await activeTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
    flash("Open a regular web page to apply.");
    return;
  }
  await ensureInjected(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: "fontsharp-apply", cfg });
  flash("Applied to this page.");
}

async function resetNow() {
  const tab = await activeTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) {
    flash("Open a regular web page first.");
    return;
  }
  await ensureInjected(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: "fontsharp-reset" });
  flash("Page restored.");
}

function render(cfg) {
  $("smoothing").value = cfg.smoothing;
  $("spacing").value = cfg.spacing;
  $("contrast").value = cfg.contrast;
  $("smoothingVal").textContent = SMOOTH_LABELS[cfg.smoothing];
  $("spacingVal").textContent = Number(cfg.spacing).toFixed(2) + "em";
  $("contrastVal").textContent = cfg.contrast + "%";
}

async function init() {
  const cfg = await getSettings();
  render(cfg);

  $("smoothing").addEventListener("input", (e) => { $("smoothingVal").textContent = SMOOTH_LABELS[e.target.value]; });
  $("spacing").addEventListener("input", (e) => { $("spacingVal").textContent = Number(e.target.value).toFixed(2) + "em"; });
  $("contrast").addEventListener("input", (e) => { $("contrastVal").textContent = e.target.value + "%"; });

  document.querySelectorAll(".preset").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = PRESETS[btn.dataset.preset];
      const next = { ...(await getSettings()), ...p };
      await chrome.storage.local.set(next);
      render(next);
      document.querySelectorAll(".preset").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      flash(`Preset "${btn.textContent}" loaded — click Apply.`);
    });
  });

  const tab = await activeTab();
  const host = hostOf(tab ? tab.url : "");
  const remembered = cfg.autoSites.includes(host);
  $("siteToggle").setAttribute("aria-checked", String(remembered));
  $("siteToggle").addEventListener("click", async () => {
    const cur = await getSettings();
    const set = new Set(cur.autoSites);
    const on = !set.has(host);
    if (on) set.add(host); else set.delete(host);
    await chrome.storage.local.set({ autoSites: [...set] });
    $("siteToggle").setAttribute("aria-checked", String(on));
    flash(on ? `Will auto-apply on ${host}.` : `Auto-apply off for ${host}.`);
  });

  $("applyBtn").addEventListener("click", async () => {
    const next = {
      smoothing: Number($("smoothing").value),
      spacing: Number($("spacing").value),
      contrast: Number($("contrast").value),
      autoSites: (await getSettings()).autoSites
    };
    await chrome.storage.local.set(next);
    applyNow(next);
  });

  $("resetBtn").addEventListener("click", resetNow);

  // Auto-apply on remembered sites when the popup opens.
  if (host && remembered) {
    const live = await getSettings();
    applyNow(live);
  }
}

init().catch((e) => { statusEl.textContent = "Error: " + e.message; });
