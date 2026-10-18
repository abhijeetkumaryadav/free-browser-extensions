// Circadian Dimmer — background service worker
// Re-evaluates the wind-down window every 15 minutes:
// tabs dimmed manually stay dimmed; tabs whose schedule expired get undimmed.

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function inWindow(now, start, end) {
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end;
}

async function reevaluate() {
  const { circadian, dimmedTabs = [] } = await chrome.storage.local.get(["circadian", "dimmedTabs"]);
  if (!circadian?.scheduleOn) return;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const inside = inWindow(mins, toMinutes(circadian.start), toMinutes(circadian.end));
  // Badge hint: moon when inside the window.
  chrome.action.setBadgeText({ text: inside ? "🌙" : "" });
  if (inside) return; // keep manual dimming; user manages per tab
  // Outside the window: clear any leftover overlays.
  const alive = [];
  for (const tabId of dimmedTabs) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "CIRCADIAN_REMOVE" });
    } catch (e) {
      // Tab closed or never injected — drop it from tracking.
      continue;
    }
    alive.push(tabId);
  }
  await chrome.storage.local.set({ dimmedTabs: alive });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("circadian-check", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "circadian-check") reevaluate();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "CIRCADIAN_SCHEDULE_UPDATED") reevaluate();
});
