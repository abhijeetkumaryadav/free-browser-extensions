/* EXIF Metadata Scrubber — popup logic.
 * Parses JPEG EXIF (camera, exposure, GPS, timestamps) and PNG text chunks,
 * displays them, then produces a scrubbed copy via canvas re-encoding.
 * Everything is 100% client-side: the file never leaves this popup. */

"use strict";

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone"), fileInput = $("file");
const result = $("result"), metaEl = $("meta"), thumb = $("thumb");
const sizeBefore = $("sizeBefore"), sizeAfter = $("sizeAfter");
const scrubBtn = $("scrub"), dlBtn = $("download"), statusEl = $("status");
const metanote = $("metanote");

let currentFile = null;   // original File
let scrubbedURL = null;   // object URL of scrubbed blob

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  return (n / 1048576).toFixed(2) + " MB";
}

function rational(view, off, little) {
  const num = view.getUint32(off, little);
  const den = view.getUint32(off + 4, little);
  if (!den) return "—";
  const v = num / den;
  return den === 1 ? String(num) : v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function ascii(view, off, len) {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = view.getUint8(off + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
}

/* ------------------------------------------------------------------ */
/* JPEG / EXIF parsing                                                 */
/* ------------------------------------------------------------------ */

// Parse one TIFF IFD; returns { tags: Map(tag -> {type,count,valueOff}), next }
function parseIFD(view, tiffStart, ifdOff, little) {
  const tags = new Map();
  const count = view.getUint16(tiffStart + ifdOff, little);
  for (let i = 0; i < count; i++) {
    const e = tiffStart + ifdOff + 2 + i * 12;
    if (e + 12 > view.byteLength) break;
    const tag = view.getUint16(e, little);
    const type = view.getUint16(e + 2, little);
    const cnt = view.getUint32(e + 4, little);
    const valOff = e + 8;
    tags.set(tag, { type, cnt, valOff });
  }
  return tags;
}

function tagValue(view, tiffStart, t, little) {
  const { type, cnt, valOff } = t;
  const typeSize = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 9: 4, 10: 8 }[type] || 1;
  const total = typeSize * cnt;
  // Small values are stored inline in the 4-byte value field.
  const base = total <= 4 ? valOff : tiffStart + view.getUint32(valOff, little);
  if (type === 2) return ascii(view, base, Math.min(cnt, 256)); // ASCII
  if (type === 5 || type === 10) { // rational / srational
    const parts = [];
    for (let i = 0; i < cnt; i++) {
      const num = type === 5 ? view.getUint32(base + i * 8, little)
                             : view.getInt32(base + i * 8, little);
      const den = type === 5 ? view.getUint32(base + i * 8 + 4, little)
                             : view.getInt32(base + i * 8 + 4, little);
      parts.push(den ? num / den : 0);
    }
    return parts;
  }
  if (type === 3) { // SHORT
    const parts = [];
    for (let i = 0; i < cnt; i++) parts.push(view.getUint16(base + i * 2, little));
    return parts.length === 1 ? parts[0] : parts;
  }
  return null;
}

function fmtExposure(v) {
  // EXIF stores exposure as a rational like 1/250.
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== "number" || !v) return "—";
  if (v < 1) return "1/" + Math.round(1 / v) + " s";
  return v.toFixed(1) + " s";
}

function fmtGps(dms, ref) {
  if (!Array.isArray(dms) || dms.length < 3) return "—";
  const dec = dms[0] + dms[1] / 60 + dms[2] / 3600;
  const signed = (ref === "S" || ref === "W") ? -dec : dec;
  return signed.toFixed(6) + "°";
}

function parseExifSegment(bytes) {
  // bytes: the APP1 payload AFTER the "Exif\0\0" header (TIFF data)
  const out = {};
  if (bytes.length < 8) return out;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = String.fromCharCode(bytes[0], bytes[1]);
  const little = order === "II";
  if (!little && order !== "MM") return out;
  if (view.getUint16(2, little) !== 42) return out;

  const ifd0Off = view.getUint32(4, little);
  const ifd0 = parseIFD(view, 0, ifd0Off, little);
  const pick = (m, tag) => (m.has(tag) ? tagValue(view, 0, m.get(tag), little) : null);

  const make = pick(ifd0, 0x010f), model = pick(ifd0, 0x0110);
  if (make || model) out["Camera"] = [make, model].filter(Boolean).join(" ");
  const software = pick(ifd0, 0x0131);
  if (software) out["Software"] = software;

  // EXIF sub-IFD
  if (ifd0.has(0x8769)) {
    const subOff = view.getUint32(ifd0.get(0x8769).valOff, little);
    const sub = parseIFD(view, 0, subOff, little);
    const dt = pick(sub, 0x9003) || pick(sub, 0x9004);
    if (dt) out["Taken"] = String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    const exp = pick(sub, 0x829a);
    if (exp) out["Exposure"] = fmtExposure(exp);
    const iso = pick(sub, 0x8827);
    if (iso) out["ISO"] = String(iso);
    const fl = pick(sub, 0x920a);
    if (fl) out["Focal length"] = (Array.isArray(fl) ? fl[0] : fl).toFixed(1) + " mm";
    const fnum = pick(sub, 0x829d);
    if (fnum) out["Aperture"] = "f/" + (Array.isArray(fnum) ? fnum[0] : fnum).toFixed(1);
  }

  // GPS IFD
  if (ifd0.has(0x8825)) {
    const gpsOff = view.getUint32(ifd0.get(0x8825).valOff, little);
    const gps = parseIFD(view, 0, gpsOff, little);
    const lat = pick(gps, 0x0002), latRef = pick(gps, 0x0001);
    const lon = pick(gps, 0x0004), lonRef = pick(gps, 0x0003);
    if (lat && lon) out["GPS"] = fmtGps(lat, latRef || "N") + ", " + fmtGps(lon, lonRef || "E");
  }
  return out;
}

function parseJPEG(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const found = {};
  if (view.getUint16(0) !== 0xffd8) return { found, dims: null };
  let off = 2, dims = null;
  while (off + 4 < bytes.length) {
    if (bytes[off] !== 0xff) break;
    const marker = bytes[off + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = view.getUint16(off + 2);
    if (len < 2) break;
    // APP1 = EXIF
    if (marker === 0xe1 && off + 10 < bytes.length) {
      const head = ascii(view, off + 4, 6);
      if (head === "Exif") {
        const seg = bytes.slice(off + 4 + 6, off + 2 + len);
        Object.assign(found, parseExifSegment(seg));
      }
    }
    // SOF0/2 = dimensions
    if ((marker === 0xc0 || marker === 0xc2) && off + 9 < bytes.length) {
      dims = view.getUint16(off + 7) + " × " + view.getUint16(off + 5) + " px";
    }
    off += 2 + len;
  }
  return { found, dims };
}

/* ------------------------------------------------------------------ */
/* PNG parsing (tEXt / iTXt / zTXt + IHDR dims)                         */
/* ------------------------------------------------------------------ */

function parsePNG(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const found = {};
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return { found, dims: null };
  let off = 8, dims = null, textCount = 0;
  while (off + 12 <= bytes.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(bytes[off+4], bytes[off+5], bytes[off+6], bytes[off+7]);
    const data = bytes.slice(off + 8, off + 8 + len);
    if (type === "IHDR" && len >= 8) {
      dims = view.getUint32(off + 8) + " × " + view.getUint32(off + 12) + " px";
    } else if ((type === "tEXt" || type === "zTXt") && textCount < 6) {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const key = ascii(new DataView(data.buffer, data.byteOffset, data.byteLength), 0, nul);
        found["PNG: " + key] = type === "tEXt" ? "embedded text" : "compressed text";
        textCount++;
      }
    } else if (type === "iTXt" && textCount < 6) {
      const nul = data.indexOf(0);
      if (nul > 0) {
        const key = ascii(new DataView(data.buffer, data.byteOffset, data.byteLength), 0, nul);
        found["PNG: " + key] = "embedded intl text";
        textCount++;
      }
    } else if (type === "IEND") break;
    off += 12 + len;
  }
  if (textCount) found["Text chunks"] = textCount + " chunk(s) stripped on scrub";
  return { found, dims };
}

/* ------------------------------------------------------------------ */
/* UI flow                                                             */
/* ------------------------------------------------------------------ */

function setStatus(msg) { statusEl.textContent = msg || ""; }

function showMeta(found, dims) {
  metaEl.innerHTML = "";
  const entries = Object.entries(found);
  if (dims) entries.unshift(["Dimensions", dims]);
  if (!entries.length) {
    const row = document.createElement("div");
    row.className = "mrow";
    row.innerHTML = '<dt>Result</dt><dd class="ok">No metadata found — already clean</dd>';
    metaEl.appendChild(row);
    metanote.textContent = "This file carries no EXIF or text chunks.";
  } else {
    for (const [k, v] of entries) {
      const row = document.createElement("div");
      row.className = "mrow";
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = String(v);
      if (k === "GPS") dd.classList.add("warn"); // GPS is the sensitive one
      row.appendChild(dt); row.appendChild(dd);
      metaEl.appendChild(row);
    }
    metanote.textContent = "GPS coordinates (if present) can reveal exactly where a photo was taken.";
  }
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) { setStatus("Please choose an image file."); return; }
  currentFile = file;
  if (scrubbedURL) { URL.revokeObjectURL(scrubbedURL); scrubbedURL = null; }
  dlBtn.classList.add("hidden");
  sizeAfter.textContent = "—";
  setStatus("Reading metadata…");

  // Thumbnail
  thumb.src = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });

  // Parse
  const buf = await file.arrayBuffer();
  let parsed;
  if (file.type === "image/jpeg") parsed = parseJPEG(buf);
  else if (file.type === "image/png") parsed = parsePNG(buf);
  else parsed = { found: { "Note": "EXIF scan covers JPEG/PNG; scrubbing works for all image types." }, dims: null };

  showMeta(parsed.found, parsed.dims);
  sizeBefore.textContent = fmtBytes(file.size);
  result.classList.remove("hidden");
  setStatus("");
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function scrubImage() {
  if (!currentFile) return;
  scrubBtn.disabled = true;
  setStatus("Re-encoding image without metadata…");
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    // Re-encoding drops ALL APP segments (JPEG) and ancillary chunks (PNG).
    const mime = currentFile.type === "image/png" ? "image/png" : "image/jpeg";
    c.toBlob((blob) => {
      if (!blob) { setStatus("Scrub failed for this file."); scrubBtn.disabled = false; return; }
      if (scrubbedURL) URL.revokeObjectURL(scrubbedURL);
      scrubbedURL = URL.createObjectURL(blob);
      sizeAfter.textContent = fmtBytes(blob.size);
      dlBtn.classList.remove("hidden");
      setStatus("Scrubbed — metadata removed.");
      scrubBtn.disabled = false;
    }, mime, 0.92);
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => { setStatus("Could not decode this image."); scrubBtn.disabled = false; };
  img.src = URL.createObjectURL(currentFile);
}

function downloadScrubbed() {
  if (!scrubbedURL) return;
  const a = document.createElement("a");
  a.href = scrubbedURL;
  const base = currentFile.name.replace(/\.[^.]+$/, "") || "image";
  const ext = currentFile.type === "image/png" ? ".png" : ".jpg";
  a.download = base + "-scrubbed" + ext;
  a.click();
  setStatus("Clean copy downloaded.");
}

/* Drop zone wiring */
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.add("drag");
}));
["dragleave", "drop"].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault(); dropzone.classList.remove("drag");
}));
dropzone.addEventListener("drop", (e) => handleFile(e.dataTransfer.files[0]));

scrubBtn.addEventListener("click", scrubImage);
dlBtn.addEventListener("click", downloadScrubbed);
