"use strict";
// ---------------------------------------------------------------------------
// Compress — pure local image compressor.
// ENGINE: settings math between ENGINE-START / ENGINE-END is unit-testable.
// ---------------------------------------------------------------------------

// ENGINE-START
/**
 * Clamp scale percent (10–100) and JPEG quality (0.1–1).
 * @returns {{scale:number, quality:number}}
 */
function clampSettings(scale, quality) {
  const s = Math.min(100, Math.max(10, Number(scale) || 80));
  const q = Math.min(1, Math.max(0.1, Number(quality) || 0.75));
  return { scale: Math.round(s), quality: Math.round(q * 100) / 100 };
}

/** Output dimensions for natural size * scale/100 (min 1px). */
function outputDims(natW, natH, scale) {
  const f = scale / 100;
  return {
    w: Math.max(1, Math.round(natW * f)),
    h: Math.max(1, Math.round(natH * f))
  };
}

/** Human-readable byte size, e.g. "1.4 MB". */
function fmtBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return bytes + " B";
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(1) + " " + units[i];
}

/** Saved percent from original to compressed (can be negative). */
function savedPct(original, compressed) {
  if (!original || original <= 0) return 0;
  return Math.round((1 - compressed / original) * 100);
}
// ENGINE-END

// ---------------------------------------------------------------------------
// UI: file loading, canvas encode, download. Everything stays local.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let srcFile = null;   // original File
let srcUrl = null;    // object URL of original
let lastBlob = null;  // compressed blob

function showErr(msg) {
  const el = $("err");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearErr() { $("err").classList.add("hidden"); }

/** Load an image file, keep its object URL, refresh stats. */
function loadFile(file) {
  clearErr();
  if (!file || !file.type.startsWith("image/")) {
    showErr("Please choose an image file.");
    return;
  }
  if (srcUrl) URL.revokeObjectURL(srcUrl);
  srcFile = file;
  srcUrl = URL.createObjectURL(file);
  $("drop-label").textContent = file.name;
  $("orig-size").textContent = fmtBytes(file.size);
  $("stats").classList.remove("hidden");
  $("controls").classList.remove("hidden");
  $("actions").classList.remove("hidden");
  recompress();
}

/** Draw scaled image to canvas and export as JPEG blob. */
function recompress() {
  if (!srcUrl) return;
  const { scale, quality } = clampSettings($("scale").value, $("quality").value);
  $("scale-out").textContent = scale + "%";
  $("quality-out").textContent = quality.toFixed(2);
  const img = new Image();
  img.onload = () => {
    const { w, h } = outputDims(img.naturalWidth, img.naturalHeight, scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    // Note: toBlob re-encodes — some quality loss is expected.
    canvas.toBlob((blob) => {
      if (!blob) { showErr("Encoding failed for this image."); return; }
      lastBlob = blob;
      $("new-size").textContent = fmtBytes(blob.size);
      $("saved").textContent = savedPct(srcFile.size, blob.size) + "%";
    }, "image/jpeg", quality);
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => showErr("Could not decode that image.");
  img.src = srcUrl;
}

/** Download the compressed JPEG. */
function download() {
  if (!lastBlob) { showErr("Nothing to download yet."); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(lastBlob);
  const base = (srcFile && srcFile.name.replace(/\.[^.]+$/, "")) || "image";
  a.download = base + "-compressed.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Events
$("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
const drop = $("drop");
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => {
  e.preventDefault(); drop.classList.add("over");
}));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => {
  e.preventDefault(); drop.classList.remove("over");
}));
drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
$("scale").addEventListener("input", recompress);
$("quality").addEventListener("input", recompress);
$("download").addEventListener("click", download);
