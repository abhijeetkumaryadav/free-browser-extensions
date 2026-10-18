// background.js — alarm-driven countdown (keeps running even if popup closes).
// ENGINE: timer state {endsAt, durationSec, running}. Alarms fire every second
// while running; popup polls state via chrome.storage.local (fast, simple).
const TICK = "rest-timer-tick";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ endsAt: 0, durationSec: 90, running: false, finishedAt: 0 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== TICK) return;
  chrome.storage.local.get(["endsAt", "running"], ({ endsAt, running }) => {
    if (!running) return;
    const left = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
    if (left <= 0) {
      // Time's up: stop, stamp finishedAt so popup can chime.
      chrome.storage.local.set({ running: false, endsAt: 0, finishedAt: Date.now() });
      chrome.alarms.clear(TICK);
    }
  });
});

// Popup messages: START / STOP / RESET.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START") {
    const durationSec = Math.max(1, Math.min(3600, msg.durationSec | 0));
    const endsAt = Date.now() + durationSec * 1000;
    chrome.storage.local.set({ endsAt, durationSec, running: true, finishedAt: 0 });
    chrome.alarms.create(TICK, { periodInMinutes: 1 / 60 });
    sendResponse({ ok: true });
  } else if (msg.type === "STOP") {
    chrome.storage.local.set({ running: false, endsAt: 0 });
    chrome.alarms.clear(TICK);
    sendResponse({ ok: true });
  } else if (msg.type === "RESET") {
    chrome.storage.local.get("durationSec", ({ durationSec }) => {
      chrome.storage.local.set({ running: false, endsAt: 0, finishedAt: 0, durationSec: durationSec || 90 });
    });
    chrome.alarms.clear(TICK);
    sendResponse({ ok: true });
  }
  return true;
});
