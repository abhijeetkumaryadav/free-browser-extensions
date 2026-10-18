// popup.js — controls the GhostScroll haunting on the current tab.
"use strict";

const toggleBtn = document.getElementById("toggle");
const stopAllBtn = document.getElementById("stopAll");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const intensity = document.getElementById("intensity");
const intensityVal = document.getElementById("intensityVal");

const LABELS = ["Gentle", "Mischievous", "Haunted"];

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Ask the content script whether this tab is currently haunted.
async function refreshStatus() {
  const tab = await currentTab();
  let haunted = false;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "gs-status" });
    haunted = !!(res && res.haunted);
  } catch {
    haunted = false; // content script not injected (e.g. chrome:// pages)
  }
  statusEl.classList.toggle("on", haunted);
  statusText.textContent = haunted ? "Haunting this tab" : "Idle";
  toggleBtn.textContent = haunted ? "Stop haunting" : "Start haunting";
  toggleBtn.classList.toggle("danger", haunted);
  return haunted;
}

async function injectAnd(cmd, payload = {}) {
  const tab = await currentTab();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
  return chrome.tabs.sendMessage(tab.id, Object.assign({ type: cmd }, payload));
}

toggleBtn.addEventListener("click", async () => {
  const haunted = await refreshStatus();
  try {
    if (haunted) {
      await injectAnd("gs-stop");
    } else {
      await injectAnd("gs-start", { intensity: Number(intensity.value) });
    }
  } catch (err) {
    // Restricted pages (chrome://, web store, etc.) reject injection.
    statusText.textContent = "Can't haunt this page";
  }
  refreshStatus();
});

stopAllBtn.addEventListener("click", async () => {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.map(async (tab) => {
    try { await chrome.tabs.sendMessage(tab.id, { type: "gs-stop" }); } catch { /* not injected */ }
  }));
  refreshStatus();
});

intensity.addEventListener("input", async () => {
  intensityVal.textContent = LABELS[intensity.value];
  await chrome.storage.local.set({ gsIntensity: Number(intensity.value) });
});

(async () => {
  const { gsIntensity = 0 } = await chrome.storage.local.get("gsIntensity");
  intensity.value = gsIntensity;
  intensityVal.textContent = LABELS[gsIntensity];
  refreshStatus();
})();
