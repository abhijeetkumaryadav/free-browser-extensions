/* FileScope — local file inspector. Everything runs on-device:
   files are chosen by the user via <input type=file> / drag-drop,
   hashed with crypto.subtle, and NEVER uploaded anywhere. */
"use strict";

const $ = (id) => document.getElementById(id);
const PREVIEW_BYTES = 8192; // text preview cap

/** Human-readable file size. */
function fmtSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
}

/** SHA-256 hex digest of a File/Blob. */
async function sha256(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Escape helper for injecting file names into HTML. */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const FILE_ICON = `<svg class="fic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

/** Inspect one File: metadata + hash + optional preview, rendered as a card. */
async function inspectFile(file) {
  const card = document.createElement("div");
  card.className = "file";
  card.innerHTML = `${FILE_ICON}
    <div class="top"><span class="fname">${esc(file.name)}</span></div>
    <dl class="meta">
      <dt>Size</dt><dd>${fmtSize(file.size)}</dd>
      <dt>Type</dt><dd>${esc(file.type || "unknown")}</dd>
      <dt>Modified</dt><dd>${file.lastModified ? new Date(file.lastModified).toLocaleString() : "unknown"}</dd>
      <dt>SHA-256</dt><dd class="hash"><span class="spin">hashing…</span></dd>
    </dl>
    <div class="actions">
      <button class="btn-ghost copy-hash" disabled>Copy hash</button>
      <button class="btn-ghost preview-btn">Preview</button>
    </div>`;

  const hashCell = card.querySelector(".hash");
  const copyBtn = card.querySelector(".copy-hash");
  const previewBtn = card.querySelector(".preview-btn");

  // Hash in the background; card is already visible.
  let hash = "";
  try {
    hash = await sha256(file);
    hashCell.textContent = hash.slice(0, 24) + "…";
    hashCell.title = hash;
    copyBtn.disabled = false;
  } catch (err) {
    hashCell.textContent = "hash failed";
  }

  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(hash);
    copyBtn.textContent = "Copied ✓";
    setTimeout(() => { copyBtn.textContent = "Copy hash"; }, 1200);
  });

  previewBtn.addEventListener("click", async () => {
    const body = $("previewBody");
    $("previewCard").hidden = false;
    $("previewName").textContent = "— " + file.name;
    body.innerHTML = `<span class="spin">loading preview…</span>`;
    try {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        body.innerHTML = "";
        const img = document.createElement("img");
        img.src = url;
        img.alt = file.name;
        body.appendChild(img);
      } else if (file.type.startsWith("text/") || /\.(txt|md|json|csv|log|xml|html|css|js|ts|yaml|yml)$/i.test(file.name)) {
        const text = await file.slice(0, PREVIEW_BYTES).text();
        body.innerHTML = "";
        const pre = document.createElement("pre");
        pre.textContent = text + (file.size > PREVIEW_BYTES ? "\n…(truncated)" : "");
        body.appendChild(pre);
      } else {
        body.innerHTML = `<span class="spin">No preview available for this file type.</span>`;
      }
    } catch (err) {
      body.innerHTML = `<span class="spin">Preview failed.</span>`;
    }
  });

  $("fileList").querySelector(".empty")?.remove();
  $("fileList").appendChild(card);
  updateCount();

  // Record metadata-only history (never the contents).
  if (hash) {
    const { history = [] } = await chrome.storage.local.get("history");
    history.unshift({ name: file.name, size: file.size, type: file.type || "unknown", hash, at: Date.now() });
    await chrome.storage.local.set({ history: history.slice(0, 50) });
    renderHistory();
  }
}

function updateCount() {
  const n = $("fileList").querySelectorAll(".file").length;
  $("fileCount").textContent = n ? `(${n})` : "";
}

/** Render metadata-only history from storage. */
async function renderHistory() {
  const { history = [] } = await chrome.storage.local.get("history");
  const box = $("historyList");
  box.innerHTML = history.length ? "" : `<p class="empty">Nothing inspected yet.</p>`;
  for (const h of history) {
    const row = document.createElement("div");
    row.className = "file";
    row.innerHTML = `${FILE_ICON}
      <div class="top"><span class="fname">${esc(h.name)}</span></div>
      <dl class="meta">
        <dt>Size</dt><dd>${fmtSize(h.size)}</dd>
        <dt>SHA-256</dt><dd class="hash" title="${esc(h.hash)}">${esc(h.hash.slice(0, 24))}…</dd>
        <dt>When</dt><dd>${new Date(h.at).toLocaleString()}</dd>
      </dl>`;
    box.appendChild(row);
  }
}

$("clearHistory").addEventListener("click", async () => {
  await chrome.storage.local.remove("history");
  renderHistory();
});

// --- File intake: picker + drag & drop (both user-initiated) ---
$("fileInput").addEventListener("change", async (e) => {
  for (const f of e.target.files) await inspectFile(f);
  e.target.value = "";
});
const dz = $("dropzone");
dz.addEventListener("click", () => $("fileInput").click());
["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", async (e) => {
  for (const f of e.dataTransfer.files) await inspectFile(f);
});

renderHistory();
