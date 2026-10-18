"use strict";
// ---------------------------------------------------------------------------
// MetaStrip — EXIF metadata remover.
// Strips metadata by re-encoding the image through a canvas, which drops
// APP segments (EXIF/XMP/ICC) entirely. Images only — not documents.
// ENGINE: byte-level helpers between ENGINE-START / ENGINE-END are testable.
// ---------------------------------------------------------------------------

// ENGINE-START
/**
 * Scan raw JPEG bytes for APPn segments that carry metadata.
 * Returns { exif:boolean, xmp:boolean, icc:boolean }.
 * Walks markers from the SOI marker; stops at SOS (start of scan).
 */
function detectJpegMetadata(bytes) {
  const found = { exif: false, xmp: false, icc: false };
  if (!bytes || bytes.length < 4) return found;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return found; // not a JPEG
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    // 0xDA = SOS: compressed data follows, stop scanning.
    if (marker === 0xda) break;
    // Standalone markers have no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2) break;
    const body = bytes.subarray(i + 4, Math.min(i + 4 + 64, bytes.length));
    const head = String.fromCharCode.apply(null, Array.from(body));
    if (marker === 0xe1) {
      if (head.indexOf("Exif") !== -1) found.exif = true;
      if (head.indexOf("http://ns.adobe.com/xap/1.0/") !== -1) found.xmp = true;
    }
    if (marker === 0xe2 && head.indexOf("ICC_PROFILE") !== -1) found.icc = true;
    i += 2 + len;
  }
  return found;
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

/** Clamp output quality to 0.5–1. */
function clampQuality(q) {
  const v = Number(q);
  if (!Number.isFinite(v)) return 0.92;
  return Math.min(1, Math.max(0.5, Math.round(v * 100) / 100));
}

/** Summarize metadata findings for the UI. */
function metadataSummary(found) {
  const parts = [];
  if (found.exif) parts.push("EXIF");
  if (found.xmp) parts.push("XMP");
  if (found.icc) parts.push("ICC");
  return { any: parts.length > 0, label: parts.length ? parts.join(" + ") : "none" };
}
// ENGINE-END

// ---------------------------------------------------------------------------
// UI: load image, scan metadata, re-encode via canvas, download clean copy.
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
let srcFile = null;
let srcUrl = null;
let cleanBlob = null;

function showErr(msg) {
  const el = $("err");
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearErr() { $("err").classList.add("hidden"); }

/** Load image: show size + metadata scan, then re-encode. */
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
  // Scan raw bytes for metadata markers (JPEG only).
  file.arrayBuffer().then((buf) => {
    const found = detectJpegMetadata(new Uint8Array(buf));
    const sum = metadataSummary(found);
    const el = $("exif-flag");
    el.textContent = sum.label;
    el.className = sum.any ? "found" : "clean";
  });
  $("stats").classList.remove("hidden");
  $("controls").classList.remove("hidden");
  $("actions").classList.remove("hidden");
  reencode();
}

/**
 * Re-encode through canvas. Canvas drops ALL APP segments (EXIF/XMP/ICC),
 * so the output is a clean pixel image. Minor quality loss is expected.
 */
function reencode() {
  if (!srcUrl) return;
  const quality = clampQuality($("quality").value);
  $("quality-out").textContent = quality.toFixed(2);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    // JPEG for photos; keeps sizes small. Metadata cannot survive this.
    canvas.toBlob((blob) => {
      if (!blob) { showErr("Re-encoding failed for this image."); return; }
      cleanBlob = blob;
      $("new-size").textContent = fmtBytes(blob.size);
    }, "image/jpeg", quality);
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => showErr("Could not decode that image.");
  img.src = srcUrl;
}

/** Download the metadata-free copy. */
function download() {
  if (!cleanBlob) { showErr("Nothing to download yet."); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(cleanBlob);
  const base = (srcFile && srcFile.name.replace(/\.[^.]+$/, "")) || "image";
  a.download = base + "-stripped.jpg";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

$("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
const drop = $("drop");
["dragover", "dragenter"].forEach((ev) => drop.addEventListener(ev, (e) => {
  e.preventDefault(); drop.classList.add("over");
}));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => {
  e.preventDefault(); drop.classList.remove("over");
}));
drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
$("quality").addEventListener("input", reencode);
$("download").addEventListener("click", download);
