// ─────────────────────────────────────────────────────────────
// SpoilerBlur popup logic
// Manages keyword list, master toggle, per-site toggle, blur count.
// Communicates with the tab's content script via runtime messaging.
// ─────────────────────────────────────────────────────────────
"use strict";

const $ = (id) => document.getElementById(id);

let state = { master: false, keywords: [], sites: {} };
let currentHost = null;

init();

async function init() {
  const stored = await chrome.storage.local.get({ master: false, keywords: [], sites: {} });
  state = stored;
  renderChips();
  $("master").checked = state.master;
  await detectHost();
  bindEvents();
}

/** Ask the active tab's content script for its hostname + blur count. */
async function detectHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return hostFallback();
    const res = await chrome.tabs.sendMessage(tab.id, { type: "sb:getState" }).catch(() => null);
    if (res?.host) {
      currentHost = res.host;
      $("host").textContent = currentHost;
      $("site-toggle").checked = state.sites[currentHost] !== false;
      $("count").textContent = res.count ?? 0;
    } else {
      hostFallback();
    }
  } catch { hostFallback(); }
}

function hostFallback() {
  $("host").textContent = "this page (unavailable)";
  document.querySelector(".site-row").style.opacity = ".5";
}

function bindEvents() {
  $("master").addEventListener("change", async (e) => {
    state.master = e.target.checked;
    await chrome.storage.local.set({ master: state.master });
  });

  $("site-toggle").addEventListener("change", async (e) => {
    if (!currentHost) return;
    state.sites[currentHost] = e.target.checked;
    await chrome.storage.local.set({ sites: state.sites });
  });

  $("kw-add").addEventListener("click", addKeyword);
  $("kw-input").addEventListener("keydown", (e) => { if (e.key === "Enter") addKeyword(); });

  $("reveal-all").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "sb:revealAll" }).catch(() => null);
        $("count").textContent = "0";
      }
    } catch { /* tab messaging unavailable — nothing to do */ }
  });
}

async function addKeyword() {
  const input = $("kw-input");
  const kw = input.value.trim().toLowerCase();
  if (!kw || state.keywords.includes(kw)) { input.value = ""; return; }
  state.keywords.push(kw);
  await chrome.storage.local.set({ keywords: state.keywords });
  input.value = "";
  renderChips();
}

function renderChips() {
  const box = $("chips");
  if (!state.keywords.length) {
    box.innerHTML = `<p class="empty-note">No keywords yet — add the words you never want to see (character names, "dies", "ending"…).</p>`;
    return;
  }
  box.innerHTML = state.keywords.map((k, i) => `
    <span class="chip">${escapeHtml(k)}<button data-i="${i}" aria-label="Remove">✕</button></span>`).join("");
  box.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", async () => {
      state.keywords.splice(+b.dataset.i, 1);
      await chrome.storage.local.set({ keywords: state.keywords });
      renderChips();
    }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
