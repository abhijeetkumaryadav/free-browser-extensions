/* ScrollFlip popup logic — toggles flip/mirror on the active tab, optional per-site memory. */
"use strict";

const DEFAULTS = { flip: false, mirror: false, autoSites: [] };

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

function pageOk(tab) {
  return tab && tab.id && /^https?:/.test(tab.url || "");
}

async function ensureInjected(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "scrollflip-status" });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

function render(flip, mirror) {
  $("flipBtn").setAttribute("aria-pressed", String(flip));
  $("mirrorBtn").setAttribute("aria-pressed", String(mirror));
  $("flipState").textContent = flip ? "Currently: FLIPPED" : "Currently: normal";
  $("mirrorState").textContent = mirror ? "Currently: MIRRORED" : "Currently: normal";
}

async function push(tabId, flip, mirror) {
  await ensureInjected(tabId);
  await chrome.tabs.sendMessage(tabId, { type: "scrollflip-set", flip, mirror });
}

async function init() {
  const saved = await getSettings();
  let { flip, mirror } = saved;

  const tab = await activeTab();
  const host = hostOf(tab ? tab.url : "");
  const remembered = host && saved.autoSites.includes(host);

  if (tab && pageOk(tab)) {
    try {
      await ensureInjected(tab.id);
      if (remembered) {
        await chrome.tabs.sendMessage(tab.id, { type: "scrollflip-set", flip, mirror });
      } else {
        const live = await chrome.tabs.sendMessage(tab.id, { type: "scrollflip-status" });
        flip = live.flip; mirror = live.mirror;
      }
    } catch { /* content script unreachable — keep saved state */ }
  }
  render(flip, mirror);

  $("siteToggle").setAttribute("aria-checked", String(remembered));
  $("siteToggle").addEventListener("click", async () => {
    const cur = await getSettings();
    const set = new Set(cur.autoSites);
    const on = !set.has(host);
    if (on) set.add(host); else set.delete(host);
    await chrome.storage.local.set({ autoSites: [...set] });
    $("siteToggle").setAttribute("aria-checked", String(on));
    flash(on ? `Will re-apply on ${host}.` : `Per-site memory off for ${host}.`);
  });

  $("flipBtn").addEventListener("click", async () => {
    flip = !flip;
    await chrome.storage.local.set({ flip, mirror, autoSites: (await getSettings()).autoSites });
    if (tab && pageOk(tab)) await push(tab.id, flip, mirror);
    render(flip, mirror);
    flash(flip ? "Horizontal scroll flipped." : "Scroll direction normal.");
  });

  $("mirrorBtn").addEventListener("click", async () => {
    mirror = !mirror;
    await chrome.storage.local.set({ flip, mirror, autoSites: (await getSettings()).autoSites });
    if (tab && pageOk(tab)) await push(tab.id, flip, mirror);
    render(flip, mirror);
    flash(mirror ? "Page mirrored." : "Layout normal.");
  });

  $("resetBtn").addEventListener("click", async () => {
    flip = false; mirror = false;
    await chrome.storage.local.set({ flip, mirror, autoSites: (await getSettings()).autoSites });
    if (tab && pageOk(tab)) {
      await ensureInjected(tab.id);
      await chrome.tabs.sendMessage(tab.id, { type: "scrollflip-reset" });
    }
    render(flip, mirror);
    flash("Page restored.");
  });
}

init().catch((e) => { statusEl.textContent = "Error: " + e.message; });
