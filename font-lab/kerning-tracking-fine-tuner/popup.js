/* KernTune popup logic — all injection is user-gesture-only, fully self-contained. */
"use strict";

const STORAGE_KEY = "kerntune";
const STYLE_ID = "kerntune-style";

/* Injected into the MAIN world; must not reference popup-scope variables. */
function applyKern(px) {
  const doc = document;
  let style = doc.getElementById("kerntune-style");
  if (!style) {
    style = doc.createElement("style");
    style.id = "kerntune-style";
    style.setAttribute("data-kerntune", "1");
    doc.documentElement.appendChild(style);
  }
  // Apply to body text only (headings, paragraphs, links, list items, etc.)
  style.textContent =
    "body p, body h1, body h2, body h3, body h4, body h5, body h6," +
    " body li, body a, body span, body td, body th, body button," +
    " body label, body blockquote { letter-spacing: " + px + "px !important; }";
  return true;
}

function removeKern() {
  const el = document.getElementById("kerntune-style");
  if (el) el.remove();
  return true;
}

function isKerned() {
  return !!document.getElementById("kerntune-style");
}

const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const trackingEl = $("tracking");
const trackingVal = $("trackingVal");
const previewEl = $("preview");
const hostEl = $("host");

let activeTabId = null;

function setPreview(px) {
  trackingVal.textContent = px.toFixed(1) + " px";
  previewEl.style.letterSpacing = px + "px";
}

async function probeKerned() {
  if (activeTabId == null) return false;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: isKerned,
    });
    return res && res.result === true;
  } catch {
    return false; // restricted page (chrome://, web store, etc.)
  }
}

async function applyToTab() {
  const px = parseFloat(trackingEl.value);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: applyKern,
      args: [px],
    });
  } catch {
    /* restricted page — leave the toggle off */
    enabledEl.checked = false;
  }
}

async function removeFromTab() {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: removeKern,
    });
  } catch { /* nothing to clean */ }
}

async function saveState() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { px: parseFloat(trackingEl.value) },
  });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    activeTabId = tab.id;
    try { hostEl.textContent = new URL(tab.url).hostname; } catch { hostEl.textContent = "—"; }
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const px = stored[STORAGE_KEY] ? stored[STORAGE_KEY].px : 0;
  trackingEl.value = px;
  setPreview(px);

  enabledEl.checked = await probeKerned();

  enabledEl.addEventListener("change", async () => {
    if (enabledEl.checked) await applyToTab();
    else await removeFromTab();
  });

  // Live preview: update the tab as the slider moves (debounced).
  let timer = null;
  trackingEl.addEventListener("input", () => {
    const v = parseFloat(trackingEl.value);
    setPreview(v);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await saveState();
      if (enabledEl.checked) await applyToTab();
    }, 120);
  });

  $("restore").addEventListener("click", async () => {
    await removeFromTab();
    trackingEl.value = 0;
    setPreview(0);
    enabledEl.checked = false;
    await saveState();
  });
}

document.addEventListener("DOMContentLoaded", init);
