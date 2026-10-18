/* StrokeBoost popup logic — all injection is user-gesture-only, fully self-contained. */
"use strict";

const STORAGE_KEY = "strokeboost";

/* Injected functions (MAIN world) — must not reference popup-scope variables. */

/** mode: "stroke" | "shadow", px: stroke width in px */
function applyBoost(mode, px) {
  const doc = document;
  let style = doc.getElementById("strokeboost-style");
  if (!style) {
    style = doc.createElement("style");
    style.id = "strokeboost-style";
    style.setAttribute("data-strokeboost", "1");
    doc.documentElement.appendChild(style);
  }
  let css;
  if (mode === "stroke") {
    // -webkit-text-stroke works in all Chromium browsers; dark outline boosts
    // legibility on light text, so use a semi-opaque dark stroke.
    css = "-webkit-text-stroke: " + px + "px rgba(10,10,14,0.85) !important;";
  } else {
    // Four-direction shadow keeps edges readable without distorting glyphs.
    const s = px.toFixed(2) + "px";
    css =
      "text-shadow: " + s + " 0 0 rgba(10,10,14,0.9)," +
      " -" + s + " 0 0 rgba(10,10,14,0.9)," +
      " 0 " + s + " 0 rgba(10,10,14,0.9)," +
      " 0 -" + s + " 0 rgba(10,10,14,0.9) !important;";
  }
  style.textContent = buildRule();
  return true;
  function buildRule() {
    return (
      "body p, body h1, body h2, body h3, body h4, body h5, body h6," +
      " body li, body a, body span, body td, body th, body button," +
      " body label, body blockquote { " + css + " }"
    );
  }
  return true;
}

function removeBoost() {
  const el = document.getElementById("strokeboost-style");
  if (el) el.remove();
  return true;
}

function isBoosted() {
  return !!document.getElementById("strokeboost-style");
}

const $ = (id) => document.getElementById(id);
const enabledEl = $("enabled");
const intensityEl = $("intensity");
const intensityVal = $("intensityVal");
const previewEl = $("preview");
const hostEl = $("host");
const modeStrokeBtn = $("modeStroke");
const modeShadowBtn = $("modeShadow");

let activeTabId = null;
let mode = "stroke";

function setPreview(px) {
  intensityVal.textContent = px.toFixed(1) + " px";
  if (mode === "stroke") {
    previewEl.style.webkitTextStroke = px + "px rgba(10,10,14,0.9)";
    previewEl.style.textShadow = "none";
  } else {
    previewEl.style.webkitTextStroke = "0px transparent";
    const s = px.toFixed(1) + "px";
    previewEl.style.textShadow =
      s + " 0 0 rgba(10,10,14,0.9), -" + s + " 0 0 rgba(10,10,14,0.9)," +
      " 0 " + s + " 0 rgba(10,10,14,0.9), 0 -" + s + " 0 rgba(10,10,14,0.9)";
  }
}

function setMode(m) {
  mode = m;
  const stroke = m === "stroke";
  modeStrokeBtn.classList.toggle("active", stroke);
  modeShadowBtn.classList.toggle("active", !stroke);
  modeStrokeBtn.setAttribute("aria-pressed", String(stroke));
  modeShadowBtn.setAttribute("aria-pressed", String(!stroke));
  setPreview(parseFloat(intensityEl.value));
}

async function probeBoosted() {
  if (activeTabId == null) return false;
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: isBoosted,
    });
    return res && res.result === true;
  } catch {
    return false;
  }
}

async function applyToTab() {
  const px = parseFloat(intensityEl.value);
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: applyBoost,
      args: [mode, px],
    });
  } catch {
    enabledEl.checked = false;
  }
}

async function removeFromTab() {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: removeBoost,
    });
  } catch { /* nothing to clean */ }
}

async function saveState() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { px: parseFloat(intensityEl.value), mode },
  });
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    activeTabId = tab.id;
    try { hostEl.textContent = new URL(tab.url).hostname; } catch { hostEl.textContent = "—"; }
  }

  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const st = stored[STORAGE_KEY];
  if (st) {
    intensityEl.value = st.px;
    setMode(st.mode === "shadow" ? "shadow" : "stroke");
  } else {
    setPreview(parseFloat(intensityEl.value));
  }

  enabledEl.checked = await probeBoosted();

  enabledEl.addEventListener("change", async () => {
    if (enabledEl.checked) await applyToTab();
    else await removeFromTab();
  });

  modeStrokeBtn.addEventListener("click", async () => {
    setMode("stroke");
    await saveState();
    if (enabledEl.checked) await applyToTab();
  });
  modeShadowBtn.addEventListener("click", async () => {
    setMode("shadow");
    await saveState();
    if (enabledEl.checked) await applyToTab();
  });

  let timer = null;
  intensityEl.addEventListener("input", () => {
    setPreview(parseFloat(intensityEl.value));
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await saveState();
      if (enabledEl.checked) await applyToTab();
    }, 120);
  });

  $("restore").addEventListener("click", async () => {
    await removeFromTab();
    intensityEl.value = 0.5;
    setMode("stroke");
    enabledEl.checked = false;
    await saveState();
  });
}

document.addEventListener("DOMContentLoaded", init);
