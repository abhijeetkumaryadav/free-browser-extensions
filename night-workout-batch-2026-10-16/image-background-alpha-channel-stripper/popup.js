/* Alpha Channel Stripper — popup logic. Loads an image, composites it over a
 * chosen background color to flatten transparency, previews before/after,
 * and downloads the flattened result. The original file is never modified. */
"use strict";

const $ = (id) => document.getElementById(id);
const fileInput = $("file"), drop = $("drop"), fileName = $("fileName");
const stageWrap = $("stageWrap"), before = $("before"), after = $("after");
const bctx = before.getContext("2d"), actx = after.getContext("2d");
const bgColor = $("bgColor"), formatSel = $("format"), swatches = $("swatches");
const flattenBtn = $("flatten"), resetBtn = $("reset"), download = $("download");
const alphaInfo = $("alphaInfo"), err = $("err");

const QUICK = ["#ffffff", "#000000", "#f5f0e8", "#22d3ee", "#a78bfa", "#ff6b6b"];
let img = null, objectUrl = null, flattened = false;

function showErr(m) { err.textContent = m; err.classList.remove("hidden"); }
function clearErr() { err.classList.add("hidden"); err.textContent = ""; }

QUICK.forEach((c, i) => {
  const b = document.createElement("button");
  b.className = "swatch" + (i === 0 ? " active" : "");
  b.style.background = c;
  b.title = c;
  b.setAttribute("aria-label", "Use " + c);
  b.addEventListener("click", () => {
    bgColor.value = c;
    swatches.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    b.classList.add("active");
    if (img) renderAfter();
  });
  swatches.appendChild(b);
});

function fitDraw(canvas, image) {
  const c = canvas.getContext("2d");
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const w = Math.round(image.width * scale), h = Math.round(image.height * scale);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

function loadFile(f) {
  clearErr();
  if (!f || !f.type.startsWith("image/")) { showErr("Please choose an image file (PNG works best)."); return; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);
  fileName.textContent = f.name;
  const im = new Image();
  im.onload = () => {
    img = im;
    stageWrap.classList.remove("hidden");
    flattenBtn.disabled = false;
    fitDraw(before, img);
    analyzeAlpha();
    renderAfter();
  };
  im.onerror = () => showErr("Could not read that image.");
  im.src = objectUrl;
}

// Report how much of the image is actually transparent.
function analyzeAlpha() {
  const off = document.createElement("canvas");
  off.width = img.width; off.height = img.height;
  const c = off.getContext("2d");
  c.drawImage(img, 0, 0);
  const d = c.getImageData(0, 0, off.width, off.height).data;
  let clear = 0, partial = 0;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] === 0) clear++;
    else if (d[i] < 255) partial++;
  }
  const n = img.width * img.height;
  alphaInfo.textContent =
    `${img.width}×${img.height}px — fully transparent: ${(100 * clear / n).toFixed(1)}%, ` +
    `semi-transparent: ${(100 * partial / n).toFixed(1)}%` +
    (clear + partial === 0 ? " (no alpha detected — already solid)" : "");
}

function renderAfter() {
  if (!img) return;
  // Fill background color first, then draw the image over it: alpha is flattened.
  actx.fillStyle = bgColor.value;
  actx.fillRect(0, 0, after.width, after.height);
  const scale = Math.min(after.width / img.width, after.height / img.height);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  actx.drawImage(img, (after.width - w) / 2, (after.height - h) / 2, w, h);
  flattened = true;
}

drop.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
drop.addEventListener("dragover", (e) => e.preventDefault());
drop.addEventListener("drop", (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });
bgColor.addEventListener("input", () => {
  swatches.querySelectorAll(".swatch").forEach((s) =>
    s.classList.toggle("active", s.title.toLowerCase() === bgColor.value.toLowerCase()));
  if (img) renderAfter();
});

flattenBtn.addEventListener("click", () => {
  clearErr();
  if (!img) { showErr("Load an image first."); return; }
  renderAfter();
  // Build the full-resolution flattened image for download.
  const off = document.createElement("canvas");
  off.width = img.width; off.height = img.height;
  const c = off.getContext("2d");
  c.fillStyle = bgColor.value;
  c.fillRect(0, 0, off.width, off.height);
  c.drawImage(img, 0, 0);
  const mime = formatSel.value;
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
  off.toBlob((blob) => {
    if (!blob) { showErr("Export failed for this format."); return; }
    if (download.href.startsWith("blob:")) URL.revokeObjectURL(download.href);
    download.href = URL.createObjectURL(blob);
    download.download = "flattened." + ext;
    download.textContent = `Download ${ext.toUpperCase()} (${(blob.size / 1024).toFixed(0)} KB)`;
    download.classList.remove("hidden");
  }, mime, 0.92);
});

resetBtn.addEventListener("click", () => {
  clearErr();
  img = null; flattened = false;
  fileInput.value = "";
  fileName.textContent = "No image loaded";
  stageWrap.classList.add("hidden");
  download.classList.add("hidden");
  flattenBtn.disabled = true;
  bctx.clearRect(0, 0, before.width, before.height);
  actx.clearRect(0, 0, after.width, after.height);
});
