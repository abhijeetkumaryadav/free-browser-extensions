/* Page Gravity Sandbox — popup logic.
 * Injects content.js on demand, then messages it. All physics lives in the
 * content script; the popup only passes the gravity strength. */
"use strict";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const slider = $("gravity");
const gval = $("gval");

function setStatus(msg) { statusEl.textContent = msg; }

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

/* Inject the content script (idempotent) then send it a message. */
async function sendToPage(msg, okMsg) {
  try {
    const t = await activeTab();
    if (!t || !t.id) { setStatus("No active tab found."); return; }
    await chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(t.id, msg);
    setStatus(okMsg);
  } catch (e) {
    setStatus("Cannot run here — try a normal web page (not chrome:// or the Web Store).");
  }
}

$("start").addEventListener("click", () => {
  const g = parseFloat(slider.value);
  chrome.storage.local.set({ gravity: g });
  sendToPage({ action: "start", gravity: g }, "Wheee — gravity is ON. Elements are falling!");
});

$("restore").addEventListener("click", () => {
  sendToPage({ action: "stop" }, "Page restored. Everything is back where it was.");
});

slider.addEventListener("input", () => { gval.textContent = slider.value; });

/* Restore the last-used gravity setting. */
chrome.storage.local.get({ gravity: 0.6 }, (d) => {
  slider.value = d.gravity;
  gval.textContent = d.gravity;
});
