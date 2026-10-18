/* SVG Export Grabber — scans the active tab for inline <svg> elements and
 * <img> SVGs, then offers copy + individual/batch download. Read-only scan;
 * injection happens only when the user clicks "Scan page". */
"use strict";

/* Runs INSIDE the page (serialized by chrome.scripting). Must be self-contained:
 * no references to anything outside this function. */
function scanSvgsInPage() {
  const out = [];
  const MAX = 120;

  document.querySelectorAll("svg").forEach((el, i) => {
    if (out.length >= MAX) return;
    try {
      const clone = el.cloneNode(true);
      // Strip scripts for safe preview/serialization
      clone.querySelectorAll("script").forEach((s) => s.remove());
      const r = el.getBoundingClientRect();
      out.push({
        type: "inline",
        label: "inline-svg-" + (i + 1),
        svg: new XMLSerializer().serializeToString(clone),
        width: Math.round(r.width) || null,
        height: Math.round(r.height) || null,
      });
    } catch (e) { /* skip unreadable nodes */ }
  });

  document.querySelectorAll("img").forEach((el) => {
    if (out.length >= MAX) return;
    const src = el.currentSrc || el.src || "";
    if (/\.svg(\?|#|$)/i.test(src) || src.indexOf("data:image/svg+xml") === 0) {
      const r = el.getBoundingClientRect();
      let label = "img-svg";
      try {
        const u = new URL(src, location.href);
        const base = u.pathname.split("/").pop();
        if (base && /\.svg$/i.test(base)) label = base;
      } catch (e) { /* keep fallback */ }
      out.push({
        type: "img",
        label,
        src,
        width: Math.round(el.naturalWidth || r.width) || null,
        height: Math.round(el.naturalHeight || r.height) || null,
      });
    }
  });

  return out;
}

/* ---------- Popup side ---------- */
const $ = (id) => document.getElementById(id);
const scanBtn = $("scanBtn"), downloadAllBtn = $("downloadAllBtn");
const countBadge = $("countBadge"), resultsList = $("resultsList");
const emptyState = $("emptyState"), errorMsg = $("errorMsg");

let results = [];

/** Light sanitizer for previewing untrusted SVG markup via innerHTML. */
function sanitizeSvg(svg) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function dimsLabel(item) {
  if (item.width && item.height) return item.width + " × " + item.height + " px";
  return "size unknown";
}

function renderResults() {
  resultsList.innerHTML = "";
  const has = results.length > 0;
  emptyState.classList.toggle("hidden", has);
  downloadAllBtn.classList.toggle("hidden", !has);
  countBadge.classList.toggle("hidden", !has);
  if (has) countBadge.textContent = results.length + " found";

  results.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "svg-card";

    const preview = document.createElement("div");
    preview.className = "preview";
    if (item.type === "inline") {
      preview.innerHTML = sanitizeSvg(item.svg);
    } else {
      const img = document.createElement("img");
      img.src = item.src;
      img.alt = "";
      preview.appendChild(img);
    }

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML =
      '<div class="meta-title"><span class="badge">' + item.type + '</span>' +
        escapeHtml(item.label) + "</div>" +
      '<div class="meta-sub">' + dimsLabel(item) + "</div>";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const dlBtn = document.createElement("button");
    dlBtn.className = "btn-ghost";
    dlBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>SVG';
    dlBtn.addEventListener("click", () => downloadItem(item));

    actions.appendChild(dlBtn);

    if (item.type === "inline") {
      const copyBtn = document.createElement("button");
      copyBtn.className = "btn-ghost";
      copyBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy';
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(item.svg);
          copyBtn.innerHTML = "Copied ✓";
          setTimeout(() => { copyBtn.innerHTML = copyBtn.dataset.orig; }, 1200);
        } catch (e) { /* clipboard unavailable */ }
      });
      copyBtn.dataset.orig = copyBtn.innerHTML;
      actions.appendChild(copyBtn);
    }

    card.appendChild(preview);
    card.appendChild(meta);
    card.appendChild(actions);
    resultsList.appendChild(card);
  });
}

/** Resolve an item to a downloadable URL + filename. */
async function resolveDownload(item, index) {
  const safeName = (item.label || "svg").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);
  const filename = "svg-" + (index + 1) + "-" + safeName.replace(/\.svg$/i, "") + ".svg";

  if (item.type === "inline") {
    const url = URL.createObjectURL(new Blob([item.svg], { type: "image/svg+xml" }));
    return { url, filename, revoke: true };
  }
  if (item.src.indexOf("data:") === 0) {
    // data: URL — convert to blob for a clean download
    const res = await fetch(item.src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    return { url, filename, revoke: true };
  }
  // Remote URL: chrome.downloads can fetch it directly (works cross-origin)
  return { url: item.src, filename, revoke: false };
}

function downloadItem(item, index) {
  const i = index === undefined ? results.indexOf(item) : index;
  resolveDownload(item, i)
    .then(({ url, filename, revoke }) => {
      chrome.downloads.download({ url, filename, saveAs: false }, () => {
        if (revoke) setTimeout(() => URL.revokeObjectURL(url), 10000);
        if (chrome.runtime.lastError) showError("Download failed: " + chrome.runtime.lastError.message);
      });
    })
    .catch(() => showError("Could not prepare that SVG for download."));
}

async function downloadAll() {
  downloadAllBtn.disabled = true;
  for (let i = 0; i < results.length; i++) {
    downloadItem(results[i], i);
    await new Promise((r) => setTimeout(r, 450)); // avoid multi-download throttling
  }
  downloadAllBtn.disabled = false;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}
function clearError() {
  errorMsg.classList.add("hidden");
  errorMsg.textContent = "";
}

async function scanPage() {
  clearError();
  scanBtn.disabled = true;
  scanBtn.textContent = "Scanning…";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no active tab");
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || "")) {
      throw new Error("Cannot scan browser-internal pages.");
    }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanSvgsInPage,
    });
    results = Array.isArray(result) ? result : [];
    renderResults();
    if (!results.length) showError("No SVGs found on this page.");
  } catch (e) {
    showError(e.message || "Scan failed. Try reloading the page.");
    results = [];
    renderResults();
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> Scan page';
  }
}

scanBtn.addEventListener("click", scanPage);
downloadAllBtn.addEventListener("click", downloadAll);
