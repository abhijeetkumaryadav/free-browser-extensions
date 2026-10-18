/* WakeUp service worker — fires scheduled wakes. */
"use strict";

const STORAGE_KEY = "wakes";

/** Load all wakes, drop anything already past-due, persist the rest. */
async function loadWakes() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const wakes = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  return wakes.sort((a, b) => a.at - b.at);
}

async function removeWake(id) {
  const wakes = (await loadWakes()).filter((w) => w.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY]: wakes });
}

/** Activate a stored tab, falling back to opening its URL. */
async function wakeTab(wake) {
  try {
    if (wake.tabId != null) {
      await chrome.windows.update(wake.windowId, { focused: true });
      await chrome.tabs.update(wake.tabId, { active: true });
      return;
    }
  } catch {
    // Tab or window is gone — fall through to opening the URL.
  }
  if (wake.url) {
    await chrome.tabs.create({ url: wake.url, active: true });
  }
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("wake-")) return;
  const id = alarm.name.slice("wake-".length);
  const wake = (await loadWakes()).find((w) => w.id === id);
  if (!wake) return;

  try {
    await wakeTab(wake);
    await chrome.notifications.create("wake-" + id, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "WakeUp: " + wake.name,
      message: wake.url || "Your scheduled tab is now active.",
    });
  } finally {
    await removeWake(id);
  }
});

// Keep storage and alarms consistent after a browser restart.
chrome.runtime.onStartup.addListener(async () => {
  const wakes = await loadWakes();
  const now = Date.now();
  for (const wake of wakes) {
    if (wake.at <= now) {
      await wakeTab(wake).catch(() => {});
      await removeWake(wake.id);
    } else {
      await chrome.alarms.create("wake-" + wake.id, { when: wake.at });
    }
  }
});
