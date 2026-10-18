/* DualSubs popup — parses user SRT files on-device and drives the overlay content script. */
"use strict";

/* ---------- On-device SRT parser ---------- */

/** Parse "HH:MM:SS,mmm" (or with '.') into milliseconds. Returns null on failure. */
function parseTimestamp(ts) {
  const m = ts.trim().match(/(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/);
  if (!m) return null;
  const [, h, min, s, ms] = m;
  return (+h) * 3600000 + (+min) * 60000 + (+s) * 1000 + (+ms.padEnd(3, "0").slice(0, 3));
}

/** Parse full SRT text into [{start, end, text}]. Malformed blocks are skipped. */
function parseSRT(text) {
  const cues = [];
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    if (lines.length < 2) continue;
    // First line is usually a numeric index; timing line is the first containing "-->"
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx < 0) continue;
    const [startRaw, endRaw] = lines[timeIdx].split("-->");
    const start = parseTimestamp(startRaw);
    const end = parseTimestamp(endRaw);
    if (start == null || end == null || end <= start) continue;
    const caption = lines.slice(timeIdx + 1).join("\n").trim();
    if (!caption) continue;
    // Strip basic SRT styling tags so plain text renders
    const clean = caption.replace(/<[^>]*>/g, "");
    cues.push({ start, end, text: clean });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}

/* ---------- State ---------- */

const DEFAULT_SETTINGS = {
  enabled: true,
  primaryOffset: 0,   // ms
  secondaryOffset: 0, // ms
  fontSize: 20,       // px for primary line
  bgOpacity: 55,      // percent
};

const state = {
  primary: null,    // { name, cues }
  secondary: null,  // { name, cues }
  settings: { ...DEFAULT_SETTINGS },
};

const $ = (id) => document.getElementById(id);

/* ---------- Helpers ---------- */

/** Get the currently active tab. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Send a message to the overlay in the active tab. Returns response or null. */
async function sendToOverlay(msg) {
  try {
    const tab = await activeTab();
    if (!tab?.id) return null;
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    return null; // overlay not injected yet
  }
}

/** Ensure overlay.js is injected in the active tab. */
async function ensureInjected() {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab.");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["overlay.js"] });
}

/** Push current cues + settings to the overlay. */
async function pushToOverlay() {
  const payload = {
    type: "init",
    primary: state.primary,
    secondary: state.secondary,
    settings: state.settings,
  };
  const res = await sendToOverlay(payload);
  const status = $("statusLine");
  if (res?.ok) {
    status.textContent = res.videoFound
      ? "Attached — overlay is live on the video."
      : "Attached — waiting for a video element on the page.";
    status.className = "status-line " + (res.videoFound ? "ok" : "warn");
  } else {
    status.textContent = "Could not reach the tab. Try attaching again.";
    status.className = "status-line warn";
  }
}

/** Persist settings (not subtitle contents) across popup sessions. */
function saveSettings() {
  chrome.storage.local.set({ dualsubs_settings: state.settings });
}

/* ---------- UI wiring ---------- */

function bindFileInput(inputId, countId, key) {
  $(inputId).addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const cues = parseSRT(String(reader.result || ""));
      state[key] = { name: file.name, cues };
      const countEl = $(countId);
      countEl.textContent = cues.length ? `${cues.length} cues` : "no valid cues";
      countEl.classList.toggle("loaded", cues.length > 0);
      pushToOverlay();
    };
    reader.readAsText(file);
  });
}

function bindSlider(sliderId, outputId, format, key) {
  const slider = $(sliderId);
  const out = $(outputId);
  slider.value = state.settings[key];
  out.textContent = format(state.settings[key]);
  slider.addEventListener("input", () => {
    state.settings[key] = +slider.value;
    out.textContent = format(state.settings[key]);
    saveSettings();
    sendToOverlay({ type: "updateSettings", settings: state.settings });
  });
}

function refreshToggle() {
  $("enableToggle").classList.toggle("on", state.settings.enabled);
}

/* ---------- Init ---------- */

document.addEventListener("DOMContentLoaded", async () => {
  const stored = await chrome.storage.local.get("dualsubs_settings");
  if (stored.dualsubs_settings) {
    state.settings = { ...DEFAULT_SETTINGS, ...stored.dualsubs_settings };
  }

  bindFileInput("primaryFile", "primaryCount", "primary");
  bindFileInput("secondaryFile", "secondaryCount", "secondary");
  bindSlider("primaryOffset", "primaryOffsetVal", (v) => `${v} ms`, "primaryOffset");
  bindSlider("secondaryOffset", "secondaryOffsetVal", (v) => `${v} ms`, "secondaryOffset");
  bindSlider("fontSize", "fontSizeVal", (v) => `${v} px`, "fontSize");
  bindSlider("bgOpacity", "bgOpacityVal", (v) => `${v}%`, "bgOpacity");

  refreshToggle();
  $("enableToggle").addEventListener("click", () => {
    state.settings.enabled = !state.settings.enabled;
    refreshToggle();
    saveSettings();
    sendToOverlay({ type: "updateSettings", settings: state.settings });
  });

  $("attachBtn").addEventListener("click", async () => {
    try {
      await ensureInjected();
      await pushToOverlay();
    } catch (err) {
      const status = $("statusLine");
      status.textContent = "Cannot attach here (e.g. chrome:// pages or the Web Store).";
      status.className = "status-line warn";
    }
  });

  $("clearBtn").addEventListener("click", async () => {
    state.primary = null;
    state.secondary = null;
    for (const [id, label] of [["primaryCount", "no file"], ["secondaryCount", "no file"]]) {
      const el = $(id);
      el.textContent = label;
      el.classList.remove("loaded");
    }
    $("primaryFile").value = "";
    $("secondaryFile").value = "";
    await sendToOverlay({ type: "clear" });
    $("statusLine").textContent = "Cleared.";
    $("statusLine").className = "status-line";
  });
});
