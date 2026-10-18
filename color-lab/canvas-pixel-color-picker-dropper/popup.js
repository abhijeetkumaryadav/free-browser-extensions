"use strict";
/* DropPix — popup logic.
 * Primary: window.EyeDropper (Chrome/Edge). Fallback: upload an image,
 * draw to canvas, click to sample the pixel; hover shows a zoom magnifier. */

const $ = (id) => document.getElementById(id);
const swatch = $("swatch"), valHex = $("valHex"), valRgb = $("valRgb"), valHsl = $("valHsl");
const btnPick = $("btnPick"), fileInput = $("fileInput"), statusEl = $("status");
const canvasCard = $("canvasCard"), canvas = $("imgCanvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
const magnifier = $("magnifier"), zoomInput = $("zoom"), historyEl = $("history");
const HISTORY_KEY = "droppix_history";
const MAX_HISTORY = 24;

let history = [];
let imgBitmap = null; // loaded Image for re-rendering the canvas

/* ---------- color helpers ---------- */
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function setColor(r, g, b, { record = true } = {}) {
  const hex = rgbToHex(r, g, b);
  const { h, s, l } = rgbToHsl(r, g, b);
  swatch.style.background = hex;
  valHex.textContent = hex;
  valRgb.textContent = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  valHsl.textContent = `hsl(${h}, ${s}%, ${l}%)`;
  if (record) pushHistory(hex);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    flashStatus("Copied " + text, true);
  } catch (e) {
    // Fallback for contexts where the Clipboard API is unavailable.
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); flashStatus("Copied " + text, true); }
    catch { flashStatus("Copy failed", false); }
    ta.remove();
  }
}

function flashStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.className = ok ? "ok" : "";
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => { statusEl.textContent = "Ready"; statusEl.className = ""; }, 1800);
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
  history = [hex, ...history.filter((c) => c !== hex)].slice(0, MAX_HISTORY);
  try { await chrome.storage.local.set({ [HISTORY_KEY]: history }); } catch {}
  renderHistory();
}

function renderHistory() {
  historyEl.innerHTML = "";
  if (!history.length) {
    historyEl.innerHTML = '<span class="empty">No colors yet — pick one to start.</span>';
    return;
  }
  for (const hex of history) {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.style.background = hex;
    chip.title = hex + " — click to copy";
    chip.addEventListener("click", () => {
      const [r, g, b] = hexToRgb(hex);
      setColor(r, g, b, { record: false });
      copyText(hex);
    });
    historyEl.appendChild(chip);
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ---------- EyeDropper path ---------- */
const eyeSupported = typeof window.EyeDropper === "function";
if (!eyeSupported) {
  $("eyeHint").textContent = "EyeDropper API is not available in this browser — sample colors from an uploaded image below.";
  btnPick.disabled = true;
}

btnPick.addEventListener("click", async () => {
  if (!eyeSupported) return;
  try {
    const eye = new window.EyeDropper();
    const result = await eye.open(); // resolves with { sRGBHex } or rejects on Esc
    const [r, g, b] = hexToRgb(result.sRGBHex.toUpperCase());
    setColor(r, g, b);
    flashStatus("Picked " + result.sRGBHex.toUpperCase(), true);
  } catch (e) {
    // User cancelled (Esc) — not an error.
    flashStatus("Picker cancelled", false);
  }
});

/* ---------- image canvas sampler path ---------- */
fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    imgBitmap = img;
    renderCanvas();
    canvasCard.hidden = false;
    flashStatus("Image loaded — click to sample", true);
  };
  img.onerror = () => { URL.revokeObjectURL(url); flashStatus("Could not load image", false); };
  img.src = url;
});

function renderCanvas() {
  if (!imgBitmap) return;
  // Fit within popup width while keeping aspect ratio.
  const maxW = 340, maxH = 220;
  const scale = Math.min(1, maxW / imgBitmap.naturalWidth, maxH / imgBitmap.naturalHeight);
  canvas.width = Math.round(imgBitmap.naturalWidth * scale);
  canvas.height = Math.round(imgBitmap.naturalHeight * scale);
  ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
  magnifier.style.backgroundImage = `url(${canvas.toDataURL()})`;
}

function sampleAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clamp(Math.floor((clientX - rect.left) * (canvas.width / rect.width)), 0, canvas.width - 1);
  const y = clamp(Math.floor((clientY - rect.top) * (canvas.height / rect.height)), 0, canvas.height - 1);
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  setColor(r, g, b);
  return { x, y, r, g, b };
}

canvas.addEventListener("click", (e) => {
  const { r, g, b } = sampleAt(e.clientX, e.clientY);
  flashStatus("Sampled rgb(" + r + ", " + g + ", " + b + ")", true);
});

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const zoom = Number(zoomInput.value);
  const size = 72;
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  magnifier.hidden = false;
  magnifier.style.width = size + "px";
  magnifier.style.height = size + "px";
  magnifier.style.left = (e.clientX - rect.left + 14) + "px";
  magnifier.style.top = (e.clientY - rect.top - size - 10) + "px";
  magnifier.style.backgroundSize = (canvas.width * zoom) + "px " + (canvas.height * zoom) + "px";
  magnifier.style.backgroundPosition = `-${sx * zoom - size / 2}px -${sy * zoom - size / 2}px`;
});
canvas.addEventListener("mouseleave", () => { magnifier.hidden = true; });

/* ---------- misc bindings ---------- */
valHex.addEventListener("click", () => copyText(valHex.textContent));
valRgb.addEventListener("click", () => copyText(valRgb.textContent));
valHsl.addEventListener("click", () => copyText(valHsl.textContent));

$("btnClear").addEventListener("click", async () => {
  history = [];
  try { await chrome.storage.local.remove(HISTORY_KEY); } catch {}
  renderHistory();
  flashStatus("History cleared", true);
});

/* ---------- init ---------- */
loadHistory();
