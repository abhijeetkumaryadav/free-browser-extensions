// Dead Link Checker — popup logic
// Asks the content engine to check visible links; shows progress and results.
"use strict";

const STORAGE_KEY = "dlc.settings";

async function loadSettings() {
  const out = await chrome.storage.local.get(STORAGE_KEY);
  return out[STORAGE_KEY] || { maxLinks: 30 };
}

async function inject() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error("No active tab.");
  if (!/^https?:/.test(tab.url || "")) throw new Error("Works only on http(s) pages.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return tab.id;
}

function showStatus(msg, isError) {
  const el = document.getElementById("stats");
  el.innerHTML = msg;
  el.style.color = isError ? "#f87171" : "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const sel = document.getElementById("maxLinks");
  const bar = document.getElementById("bar");
  const progress = document.getElementById("progress");
  sel.value = String((await loadSettings()).maxLinks);
  sel.addEventListener("change", async () => {
    await chrome.storage.local.set({ [STORAGE_KEY]: { maxLinks: parseInt(sel.value, 10) } });
  });

  // Progress events stream in from the content engine.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "dlc-progress") {
      progress.hidden = false;
      bar.style.width = `${Math.round((msg.done / Math.max(1, msg.total)) * 100)}%`;
      showStatus(`Checking… <b>${msg.done}</b> / ${msg.total} links`);
    }
  });

  document.getElementById("checkBtn").addEventListener("click", async () => {
    try {
      showStatus("Starting…");
      progress.hidden = false; bar.style.width = "0";
      const tabId = await inject();
      const res = await chrome.tabs.sendMessage(tabId, {
        type: "check", maxLinks: parseInt(sel.value, 10),
      });
      progress.hidden = true;
      if (res && res.ok) {
        showStatus(`Checked <b>${res.checked}</b> links — <b>${res.dead}</b> unreachable.`);
      } else {
        showStatus("No links found on this page.");
      }
    } catch (e) { progress.hidden = true; showStatus(String(e.message || e), true); }
  });

  document.getElementById("clearBtn").addEventListener("click", async () => {
    try {
      const tabId = await inject();
      const res = await chrome.tabs.sendMessage(tabId, { type: "clear" });
      showStatus(res && res.ok ? "Badges cleared." : "Nothing to clear.");
    } catch (e) { showStatus(String(e.message || e), true); }
  });
});
