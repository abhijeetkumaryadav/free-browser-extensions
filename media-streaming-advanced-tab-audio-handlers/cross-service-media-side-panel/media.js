/* Stagehand — shared media-tab helpers. Included by popup.html and sidepanel.html.
   Media control only ever runs on tabs the user explicitly acts on. */
"use strict";

/* Runs in the PAGE (injected). Finds the most relevant media element. */
function mediaProbe() {
  const els = [...document.querySelectorAll("video, audio")];
  if (!els.length) return null;
  const el = els.find((e) => !e.paused) || els[0];
  return {
    paused: el.paused,
    muted: el.muted,
    currentTime: Math.round(el.currentTime),
    duration: Math.round(el.duration || 0),
  };
}

/* Runs in the PAGE (injected). Applies one user-initiated command. */
function mediaCommand(action) {
  const els = [...document.querySelectorAll("video, audio")];
  const el = els.find((e) => !e.paused) || els[0];
  if (!el) return false;
  if (action === "toggle") { if (el.paused) el.play().catch(() => {}); else el.pause(); }
  else if (action === "back") { el.currentTime = Math.max(0, el.currentTime - 10); }
  else if (action === "forward") { el.currentTime = el.currentTime + 10; }
  else if (action === "restart") { el.currentTime = 0; }
  return true;
}

/* Extension-side helpers (never injected). */
async function getMediaTabs() {
  // Tabs currently producing sound. Read-only tab metadata.
  const tabs = await chrome.tabs.query({ audible: true });
  return tabs.filter((t) => t.url && /^https?:/.test(t.url));
}

async function probeTab(tabId) {
  try {
    const res = await chrome.scripting.executeScript({ target: { tabId }, func: mediaProbe });
    return (res && res[0] && res[0].result) || null;
  } catch {
    return null; // page blocked injection (e.g. restricted pages)
  }
}

async function commandTab(tabId, action) {
  if (action === "gototab") {
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
    return;
  }
  if (action === "mute" || action === "unmute") {
    await chrome.tabs.update(tabId, { muted: action === "mute" });
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId }, func: mediaCommand, args: [action] });
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
function fmtTime(s) {
  if (!s || !isFinite(s)) return "–:––";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
