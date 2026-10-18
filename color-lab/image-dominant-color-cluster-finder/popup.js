/* ColorMine — find an image's dominant colors locally.
 * Pipeline: file -> <img> -> downsampled canvas (max 64px) -> 12-bit RGB
 * bucketing (4 bits/channel = 4096 buckets) -> top buckets averaged ->
 * ranked palette. Pure local math; no network, no upload.
 */
"use strict";

const MAX_DIM = 64;         // downsample target — keeps sampling fast
const BUCKET_BITS = 4;      // 4 bits per channel -> 4096 buckets
const DEFAULT_COUNT = 8;

let palette = [];           // [{ r, g, b, hex, pct }] sorted desc by pct
let imgName = "";
let imgW = 0, imgH = 0;

const $ = (id) => document.getElementById(id);
const els = {
  dropzone: $("dropzone"), fileInput: $("fileInput"), canvas: $("canvas"),
  resultCard: $("resultCard"), palette: $("palette"),
  countRange: $("countRange"), countVal: $("countVal"),
  copyAllBtn: $("copyAllBtn"), copyNote: $("copyNote"), imgInfo: $("imgInfo")
};

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/* Analyze an <img> element that has already loaded. */
function analyze(img) {
  imgW = img.naturalWidth;
  imgH = img.naturalHeight;
  const scale = Math.min(1, MAX_DIM / Math.max(imgW, imgH));
  const w = Math.max(1, Math.round(imgW * scale));
  const h = Math.max(1, Math.round(imgH * scale));

  const canvas = els.canvas;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const shift = 8 - BUCKET_BITS;      // 4
  const buckets = new Map();          // key -> { count, r, g, b }

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;        // skip transparent pixels
    const br = data[i] >> shift, bg = data[i + 1] >> shift, bb = data[i + 2] >> shift;
    const key = (br << 8) | (bg << 4) | bb;
    let b = buckets.get(key);
    if (!b) { b = { count: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
    b.count++;
    b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2];
  }

  const total = [...buckets.values()].reduce((s, b) => s + b.count, 0);
  if (!total) { palette = []; render(); return; }

  palette = [...buckets.values()]
    .map((b) => {
      const r = Math.round(b.r / b.count), g = Math.round(b.g / b.count), bl = Math.round(b.b / b.count);
      return { r, g, b: bl, hex: rgbToHex(r, g, bl), pct: (b.count / total) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  render();
}

function render() {
  const count = Number(els.countRange.value);
  els.countVal.textContent = count;

  els.resultCard.classList.remove("hidden");
  els.imgInfo.textContent = `${imgW}×${imgH}px`;

  els.palette.innerHTML = "";
  palette.slice(0, count).forEach((c, idx) => {
    const li = document.createElement("li");
    li.className = "swatch";
    li.title = "Click to copy " + c.hex;
    li.innerHTML =
      `<span class="chip" style="background:${c.hex}"></span>` +
      `<span class="meta"><span class="hex">${c.hex}</span>` +
      `<span class="pct"><i style="width:${Math.min(100, c.pct * 2)}%"></i></span></span>` +
      `<span class="share">${c.pct.toFixed(1)}%</span>`;
    li.addEventListener("click", () => copyText(c.hex));
    li.tabIndex = 0;
    li.setAttribute("role", "button");
    li.setAttribute("aria-label", `Copy color ${c.hex}`);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyText(c.hex); }
    });
    els.palette.appendChild(li);
    void idx; // index unused but kept for clarity
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  els.copyNote.classList.remove("hidden");
  setTimeout(() => els.copyNote.classList.add("hidden"), 1600);
}

els.copyAllBtn.addEventListener("click", () => {
  const count = Number(els.countRange.value);
  const lines = palette.slice(0, count).map((c) => c.hex);
  copyText(lines.join("\n"));
});

els.countRange.addEventListener("input", () => {
  render();
  chrome.storage.local.set({ colormine: { count: Number(els.countRange.value) } });
});

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  imgName = file.name;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    analyze(img);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

els.fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

// Drag & drop onto the dropzone.
["dragenter", "dragover"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.add("dragover"); })
);
["dragleave", "drop"].forEach((ev) =>
  els.dropzone.addEventListener(ev, (e) => { e.preventDefault(); els.dropzone.classList.remove("dragover"); })
);
els.dropzone.addEventListener("drop", (e) => {
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  handleFile(file);
});

// Restore the "colors to show" preference.
chrome.storage.local.get("colormine", (res) => {
  if (res.colormine && typeof res.colormine.count === "number") {
    els.countRange.value = Math.min(12, Math.max(3, res.colormine.count));
  }
});
