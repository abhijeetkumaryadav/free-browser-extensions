// EmoteForge — Twitch Badge & Emote Resizer
// Everything runs locally: file reading, resizing, and PNG export.
// Nothing is uploaded anywhere. Twitch emotes must be uploaded manually
// through the Creator Dashboard (see the submission checklist in the popup).

"use strict";

const SIZES = [28, 56, 112];          // Twitch emote sizes (px)
const MAX_KB = 25;                     // Twitch per-file limit
const STORE_KEY = "emoteforge.jobs";   // persisted name edits only (images are session-only)

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const jobsPanel = document.getElementById("jobsPanel");
const jobsEl = document.getElementById("jobs");
const clearBtn = document.getElementById("clearBtn");
const checklist = document.getElementById("checklist");

/** In-memory jobs: { id, fileName, code, objectUrl, img, outputs: {28: {url, kb}, ...} } */
let jobs = [];
let jobSeq = 0;

/* ---------------- file intake ---------------- */

dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("over"); });
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("over");
  if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = ""; // allow re-selecting the same file
});

function addFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith("image/")) continue; // skip non-images silently
    const id = "job-" + (++jobSeq) + "-" + Date.now();
    const job = {
      id,
      fileName: file.name,
      code: sanitizeCode(file.name.replace(/\.[a-z0-9]+$/i, "")),
      objectUrl: URL.createObjectURL(file),
      img: null,
      outputs: {},
    };
    jobs.push(job);
    renderJob(job);
    loadImage(job, file);
  }
  jobsPanel.hidden = jobs.length === 0;
}

/** Emote codes: letters/numbers only, 4–100 chars (Twitch rules). */
function sanitizeCode(name) {
  const clean = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 32) || "Emote";
  return clean.length < 4 ? (clean + "Emote").slice(0, 32) : clean;
}

/** Decode the image file into an <img> element, then resize all outputs. */
function loadImage(job, file) {
  const img = new Image();
  img.onload = () => {
    job.img = img;
    resizeJob(job);
    URL.revokeObjectURL(job.objectUrl); // keep dataURL preview instead
    job.objectUrl = canvasPreview(img, 88);
    const thumb = jobsEl.querySelector(`[data-job="${job.id}"] .thumb`);
    if (thumb) thumb.src = job.objectUrl;
  };
  img.onerror = () => {
    const card = jobsEl.querySelector(`[data-job="${job.id}"]`);
    if (card) card.querySelector(".sizes").innerHTML =
      '<p class="note">Could not read this image. Try a PNG or JPG.</p>';
  };
  img.src = URL.createObjectURL(file);
}

/* ---------------- resizing ---------------- */

/** Resize an image to a square `size` using high-quality canvas scaling. */
function resizeTo(img, size) {
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Center-crop to square so the emote fills the frame.
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return c;
}

function canvasPreview(img, size) {
  return resizeTo(img, size).toDataURL("image/png");
}

function resizeJob(job) {
  job.outputs = {};
  for (const size of SIZES) {
    const canvas = resizeTo(job.img, size);
    const url = canvas.toDataURL("image/png");
    // Approximate KB from the base64 data URL length.
    const kb = Math.round((url.length * 3 / 4) / 1024);
    job.outputs[size] = { url, kb };
  }
  updateSizeButtons(job);
}

/* ---------------- rendering ---------------- */

function renderJob(job) {
  const card = document.createElement("div");
  card.className = "job";
  card.dataset.job = job.id;
  card.innerHTML = `
    <div class="job-head">
      <img class="thumb" alt="preview">
      <div class="code-wrap">
        <label>Emote code</label>
        <input type="text" class="code-input" value="${escapeHtml(job.code)}" maxlength="32" spellcheck="false">
      </div>
      <button class="job-remove" title="Remove">×</button>
    </div>
    <div class="sizes">
      ${SIZES.map((s) => `
        <button class="size-btn" data-size="${s}">
          <img alt="${s}px preview"><span class="kb">…</span>
          <span>${s}×${s}</span><span class="dl">Download</span>
        </button>`).join("")}
    </div>`;
  jobsEl.appendChild(card);

  const thumb = card.querySelector(".thumb");
  thumb.src = job.objectUrl;

  card.querySelector(".code-input").addEventListener("input", (e) => {
    job.code = sanitizeCode(e.target.value);
    e.target.value = job.code;
    persistCodes();
  });

  card.querySelector(".job-remove").addEventListener("click", () => {
    jobs = jobs.filter((j) => j.id !== job.id);
    card.remove();
    jobsPanel.hidden = jobs.length === 0;
    persistCodes();
  });

  card.querySelectorAll(".size-btn").forEach((btn) => {
    btn.addEventListener("click", () => downloadSize(job, Number(btn.dataset.size)));
  });
}

function updateSizeButtons(job) {
  const card = jobsEl.querySelector(`[data-job="${job.id}"]`);
  if (!card) return;
  card.querySelectorAll(".size-btn").forEach((btn) => {
    const size = Number(btn.dataset.size);
    const out = job.outputs[size];
    if (!out) return;
    btn.querySelector("img").src = out.url;
    const kbEl = btn.querySelector(".kb");
    kbEl.textContent = out.kb + " KB";
    kbEl.classList.toggle("bad", out.kb > MAX_KB);
    btn.title = out.kb > MAX_KB
      ? `Over Twitch's ${MAX_KB} KB limit — use a simpler image or add transparency.`
      : `${size}×${size} PNG, ${out.kb} KB`;
  });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/** Download one resized emote size. File name: <code>-<size>.png */
function downloadSize(job, size) {
  const out = job.outputs[size];
  if (!out) return;
  const a = document.createElement("a");
  a.href = out.url;
  a.download = `${job.code}-${size}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

clearBtn.addEventListener("click", () => {
  jobs = [];
  jobsEl.innerHTML = "";
  jobsPanel.hidden = true;
  persistCodes();
});

/* ---------------- checklist persistence ---------------- */

const CHECK_KEY = "emoteforge.checklist";

function loadChecklist() {
  chrome.storage.local.get([CHECK_KEY, STORE_KEY], (res) => {
    const saved = res[CHECK_KEY] || {};
    checklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.checked = !!saved[cb.dataset.key];
    });
    // (Image data is session-only; name edits are not restored across restarts
    // because there is nothing to restore them onto. Codes live in memory.)
  });
}

checklist.addEventListener("change", () => {
  const state = {};
  checklist.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    state[cb.dataset.key] = cb.checked;
  });
  chrome.storage.local.set({ [CHECK_KEY]: state });
});

function persistCodes() {
  // Persist the ordered code list so a later session can at least recall names.
  chrome.storage.local.set({ [STORE_KEY]: jobs.map((j) => j.code) });
}

loadChecklist();
