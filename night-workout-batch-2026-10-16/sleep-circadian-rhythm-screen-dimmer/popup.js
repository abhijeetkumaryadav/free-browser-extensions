// Circadian Dimmer — popup logic
// Settings + per-tab overlay control. No network, storage-only.

const $ = (id) => document.getElementById(id);
const DEFAULTS = { scheduleOn: false, start: "21:00", end: "07:00", opacity: 30 };

// Convert "HH:MM" to minutes since midnight.
function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// Is `now` (minutes) inside the [start,end] window? Handles overnight ranges.
function inWindow(now, start, end) {
  if (start <= end) return now >= start && now < end;
  return now >= start || now < end; // overnight, e.g. 21:00 -> 07:00
}

// Persist settings and refresh status line.
async function saveSettings() {
  const s = {
    scheduleOn: $("scheduleOn").checked,
    start: $("startTime").value,
    end: $("endTime").value,
    opacity: Number($("opacity").value),
  };
  await chrome.storage.local.set({ circadian: s });
  chrome.runtime.sendMessage({ type: "CIRCADIAN_SCHEDULE_UPDATED" }).catch(() => {});
  updateStatus();
}

function updateStatus() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const on = $("scheduleOn").checked;
  const inside = inWindow(mins, toMinutes($("startTime").value), toMinutes($("endTime").value));
  const el = $("windowStatus");
  if (!on) {
    el.textContent = "Schedule off — use Dim this tab manually.";
    el.classList.remove("on");
  } else if (inside) {
    el.textContent = "Inside wind-down window — dimming applies.";
    el.classList.add("on");
  } else {
    el.textContent = "Outside wind-down window.";
    el.classList.remove("on");
  }
}

// Inject the overlay engine into the active tab, then apply settings.
async function dimTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, {
      type: "CIRCADIAN_APPLY",
      opacity: Number($("opacity").value),
    });
    const { dimmedTabs = [] } = await chrome.storage.local.get("dimmedTabs");
    if (!dimmedTabs.includes(tab.id)) {
      dimmedTabs.push(tab.id);
      await chrome.storage.local.set({ dimmedTabs });
    }
  } catch (e) {
    // Internal pages (chrome://, web store) reject injection.
  }
}

async function undimTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: "CIRCADIAN_REMOVE" }).catch(() => {});
  const { dimmedTabs = [] } = await chrome.storage.local.get("dimmedTabs");
  await chrome.storage.local.set({ dimmedTabs: dimmedTabs.filter((id) => id !== tab.id) });
}

document.addEventListener("DOMContentLoaded", async () => {
  const { circadian = DEFAULTS } = await chrome.storage.local.get("circadian");
  $("scheduleOn").checked = circadian.scheduleOn;
  $("startTime").value = circadian.start;
  $("endTime").value = circadian.end;
  $("opacity").value = circadian.opacity;
  $("opacityVal").textContent = circadian.opacity + "%";

  $("scheduleOn").addEventListener("change", saveSettings);
  $("startTime").addEventListener("change", saveSettings);
  $("endTime").addEventListener("change", saveSettings);
  $("opacity").addEventListener("input", () => {
    $("opacityVal").textContent = $("opacity").value + "%";
  });
  $("opacity").addEventListener("change", saveSettings);
  $("dimBtn").addEventListener("click", dimTab);
  $("undimBtn").addEventListener("click", undimTab);
  updateStatus();
  setInterval(updateStatus, 30000);
});
