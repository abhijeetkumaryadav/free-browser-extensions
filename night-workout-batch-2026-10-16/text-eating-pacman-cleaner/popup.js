/* Text-Eating Pac-Man Cleaner — popup logic.
 * Injects content.js on demand, then messages it. The score is mirrored to
 * chrome.storage.local so the popup can poll it while open. */
"use strict";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const scoreEl = $("score");
const slider = $("speed");
const sval = $("sval");

function setStatus(msg) { statusEl.textContent = msg; }

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

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
  const speed = parseInt(slider.value, 10);
  chrome.storage.local.set({ pacSpeed: speed, pacScore: 0 });
  scoreEl.textContent = "0";
  sendToPage({ action: "start", speed }, "Pac-Man released! Nom nom nom…");
});

$("restore").addEventListener("click", () => {
  chrome.storage.local.set({ pacScore: 0 });
  scoreEl.textContent = "0";
  sendToPage({ action: "stop" }, "All text restored. Pac-Man is full.");
});

slider.addEventListener("input", () => {
  sval.textContent = slider.value;
  chrome.storage.local.set({ pacSpeed: parseInt(slider.value, 10) });
});

/* Poll the live score while the popup is open. */
chrome.storage.local.get({ pacSpeed: 4, pacScore: 0 }, (d) => {
  slider.value = d.pacSpeed;
  sval.textContent = d.pacSpeed;
  scoreEl.textContent = d.pacScore;
});
setInterval(() => {
  chrome.storage.local.get({ pacScore: 0 }, (d) => { scoreEl.textContent = d.pacScore; });
}, 600);
