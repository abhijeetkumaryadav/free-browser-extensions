// Listing Image Packer — popup logic.
// collectImages() is injected into the page; keep it self-contained.

async function collectImages() {
  const MIN = 120; // skip icons / tracking pixels
  const seen = new Set();
  const out = [];
  const imgs = Array.from(document.images || []);
  for (const el of imgs) {
    const src = el.currentSrc || el.src;
    if (!src || seen.has(src)) continue;
    if (!/^https?:/i.test(src)) continue; // skip data:/blob: (not downloadable cleanly)
    const w = el.naturalWidth || el.width || 0;
    const h = el.naturalHeight || el.height || 0;
    if (w < MIN || h < MIN) continue;
    seen.add(src);
    // best-effort real file size via HEAD; falls back to a pixel estimate
    let bytes = null;
    try {
      const r = await fetch(src, { method: "HEAD", mode: "cors", credentials: "omit" });
      const len = r.headers.get("content-length");
      if (len) bytes = parseInt(len, 10);
    } catch (e) { /* CORS or network — use estimate */ }
    if (!bytes || isNaN(bytes)) bytes = Math.round(w * h * 0.35); // ~est
    out.push({ src, width: w, height: h, bytes, alt: (el.alt || "").slice(0, 60) });
    if (out.length >= 60) break;
  }
  // biggest first — hero images up top
  out.sort((a, b) => b.width * b.height - a.width * a.height);
  return {
    host: location.hostname.replace(/^www\./, ""),
    images: out,
  };
}

const $ = (id) => document.getElementById(id);
let images = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("collect").addEventListener("click", collect);
  $("downloadAll").addEventListener("click", downloadAll);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    try { $("pageHost").textContent = new URL(tab.url).hostname.replace(/^www\./, ""); } catch (e) {}
  }
}

async function collect() {
  const btn = $("collect");
  btn.disabled = true;
  btn.textContent = "Collecting…";
  setStatus("");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("no-tab");
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: collectImages,
    });
    const data = res && res.result;
    images = (data && data.images) || [];
    if (!images.length) throw new Error("no-images");
    $("empty").style.display = "none";
    $("gallery").hidden = false;
    renderGrid();
  } catch (e) {
    $("empty").style.display = "";
    $("empty").innerHTML = "No downloadable images found here — try a product or gallery page.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Collect";
  }
}

function fmtBytes(b) {
  if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(b / 1024)) + " KB";
}

function fileName(src, i) {
  try {
    const u = new URL(src);
    const last = u.pathname.split("/").filter(Boolean).pop() || "";
    const clean = last.split("?")[0];
    if (/\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(clean)) return clean;
  } catch (e) {}
  return `listing-image-${i + 1}.jpg`;
}

function renderGrid() {
  $("imgCount").textContent = images.length + (images.length === 1 ? " image" : " images");
  const grid = $("grid");
  grid.innerHTML = "";
  images.forEach((im, i) => {
    const cell = document.createElement("div");
    cell.className = "cell";
    const img = document.createElement("img");
    img.src = im.src;
    img.loading = "lazy";
    img.alt = im.alt || "product image";
    const meta = document.createElement("div");
    meta.className = "meta";
    const dims = document.createElement("div");
    dims.className = "dims";
    dims.textContent = `${im.width} × ${im.height}`;
    const size = document.createElement("div");
    size.className = "size";
    size.textContent = "≈ " + fmtBytes(im.bytes);
    const dl = document.createElement("button");
    dl.textContent = "Download";
    dl.addEventListener("click", () => downloadOne(im, i, dl));
    meta.append(dims, size, dl);
    cell.append(img, meta);
    grid.appendChild(cell);
  });
}

function setStatus(msg) {
  $("dlStatus").textContent = msg || "";
}

async function downloadOne(im, i, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    await chrome.downloads.download({
      url: im.src,
      filename: fileName(im.src, i),
      saveAs: false,
    });
    if (btn) btn.textContent = "Saved ✓";
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "Retry"; }
    setStatus("A download was blocked — check the browser download bar.");
  }
}

async function downloadAll() {
  const btn = $("downloadAll");
  btn.disabled = true;
  let done = 0;
  for (let i = 0; i < images.length; i++) {
    try {
      await chrome.downloads.download({
        url: images[i].src,
        filename: fileName(images[i].src, i),
        saveAs: false,
        conflictAction: "uniquify",
      });
      done++;
    } catch (e) { /* keep going */ }
    setStatus(`Downloading… ${done}/${images.length}`);
    await new Promise((r) => setTimeout(r, 400)); // be gentle on the host
  }
  setStatus(`Done — ${done} of ${images.length} images saved.`);
  btn.disabled = false;
}
