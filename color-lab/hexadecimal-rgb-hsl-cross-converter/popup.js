"use strict";
/* ChromaShift — live-synced HEX / RGB / HSL / HSV converter.
 * All math is local; recent colors persist in chrome.storage.local. */

const $ = (id) => document.getElementById(id);
const inHex = $("inHex"), inR = $("inR"), inG = $("inG"), inB = $("inB");
const inH = $("inH"), inS = $("inS"), inL = $("inL");
const inHv = $("inHv"), inSv = $("inSv"), inV = $("inV");
const preview = $("preview"), nativePicker = $("nativePicker");
const errEl = $("err"), statusEl = $("status"), historyEl = $("history");
const HISTORY_KEY = "chromashift_history";
const MAX_HISTORY = 24;

let history = [];
let updating = false; // guard against input-event loops
let recordTimer = null;

/* ---------- conversion helpers ---------- */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function hexToRgb(hex) {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : (d / max) * 100, max * 100];
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; v = clamp(v, 0, 100) / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const num = (el, min, max) => {
  const v = Number(el.value);
  return Number.isFinite(v) ? clamp(v, min, max) : null;
};

/* ---------- state ---------- */
function showError(on) {
  errEl.hidden = !on;
}

function renderFromRgb(r, g, b, source) {
  updating = true;
  const hex = rgbToHex(r, g, b);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [hv, sv, v] = rgbToHsv(r, g, b);
  if (source !== inHex) inHex.value = hex;
  if (source !== inR) inR.value = Math.round(r);
  if (source !== inG) inG.value = Math.round(g);
  if (source !== inB) inB.value = Math.round(b);
  if (![inH, inS, inL].includes(source)) { inH.value = Math.round(h); inS.value = Math.round(s); inL.value = Math.round(l); }
  if (![inHv, inSv, inV].includes(source)) { inHv.value = Math.round(hv); inSv.value = Math.round(sv); inV.value = Math.round(v); }
  preview.style.background = hex;
  nativePicker.value = hex;
  updating = false;
  showError(false);
  scheduleRecord(hex);
}

function scheduleRecord(hex) {
  clearTimeout(recordTimer);
  recordTimer = setTimeout(() => pushHistory(hex), 600); // debounce while typing
}

/* ---------- input handlers ---------- */
inHex.addEventListener("input", () => {
  if (updating) return;
  const rgb = hexToRgb(inHex.value);
  if (!rgb) { showError(true); inHex.classList.add("err-border"); return; }
  inHex.classList.remove("err-border");
  renderFromRgb(rgb[0], rgb[1], rgb[2], inHex);
});

[[inR, inG, inB, 0, 255], [inH, inS, inL, 0, null], [inHv, inSv, inV, 0, null]].forEach(([a, b, c]) => {
  [a, b, c].forEach((el) => el.addEventListener("input", () => {
    if (updating) return;
    if (a === inR) {
      const r = num(inR, 0, 255), g = num(inG, 0, 255), bl = num(inB, 0, 255);
      if (r === null || g === null || bl === null) return showError(true);
      renderFromRgb(r, g, bl, el);
    } else if (a === inH) {
      const h = num(inH, 0, 360), s = num(inS, 0, 100), l = num(inL, 0, 100);
      if (h === null || s === null || l === null) return showError(true);
      const [r, g, bl] = hslToRgb(h, s, l);
      renderFromRgb(r, g, bl, el);
    } else {
      const h = num(inHv, 0, 360), s = num(inSv, 0, 100), v = num(inV, 0, 100);
      if (h === null || s === null || v === null) return showError(true);
      const [r, g, bl] = hsvToRgb(h, s, v);
      renderFromRgb(r, g, bl, el);
    }
  }));
});

nativePicker.addEventListener("input", () => {
  const rgb = hexToRgb(nativePicker.value);
  if (rgb) renderFromRgb(rgb[0], rgb[1], rgb[2], nativePicker);
});

/* ---------- copy ---------- */
function currentStrings() {
  const r = Math.round(Number(inR.value)), g = Math.round(Number(inG.value)), b = Math.round(Number(inB.value));
  const h = Math.round(Number(inH.value)), s = Math.round(Number(inS.value)), l = Math.round(Number(inL.value));
  const hv = Math.round(Number(inHv.value)), sv = Math.round(Number(inSv.value)), v = Math.round(Number(inV.value));
  return {
    hex: inHex.value.toUpperCase(),
    rgb: `rgb(${r}, ${g}, ${b})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsv: `hsv(${hv}, ${sv}%, ${v}%)`,
  };
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    flashStatus("Copied " + text, true);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); flashStatus("Copied " + text, true); }
    catch { flashStatus("Copy failed", false); }
    ta.remove();
  }
}

document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", () => copyText(currentStrings()[btn.dataset.copy]));
});

function flashStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.className = ok ? "ok" : "";
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => { statusEl.textContent = "All conversions happen locally"; statusEl.className = ""; }, 1800);
}

/* ---------- history ---------- */
async function loadHistory() {
  try {
    const data = await chrome.storage.local.get(HISTORY_KEY);
    history = Array.isArray(data[HISTORY_KEY]) ? data[HISTORY_KEY] : [];
  } catch { history = []; }
  renderHistory();
}

async function pushHistory(hex) {
  hex = hex.toUpperCase();
  history = [hex, ...history.filter((c) => c !== hex)].slice(0, MAX_HISTORY);
  try { await chrome.storage.local.set({ [HISTORY_KEY]: history }); } catch {}
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = "";
  if (!history.length) {
    historyEl.innerHTML = '<span class="empty">Convert a color and it will appear here.</span>';
    return;
  }
  for (const hex of history) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.style.background = hex;
    chip.title = hex + " — click to load";
    chip.addEventListener("click", () => {
      const rgb = hexToRgb(hex);
      if (rgb) { renderFromRgb(rgb[0], rgb[1], rgb[2], null); pushHistory(hex); }
    });
    historyEl.appendChild(chip);
  }
}

$("btnClear").addEventListener("click", async () => {
  history = [];
  try { await chrome.storage.local.remove(HISTORY_KEY); } catch {}
  renderHistory();
  flashStatus("History cleared", true);
});

/* ---------- init ---------- */
renderFromRgb(139, 92, 246, null);
loadHistory();
