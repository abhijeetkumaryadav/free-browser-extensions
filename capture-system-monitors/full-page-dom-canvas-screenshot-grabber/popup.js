// FullShot — full-page screenshot grabber.
// Strategy: scroll the active tab step by step, capture each visible
// viewport with chrome.tabs.captureVisibleTab, then stitch the tiles on a
// canvas inside the popup. All local — nothing is uploaded anywhere.

"use strict";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs inside the page. Keep it fully self-contained (no popup-scope refs).
function pageMetrics() {
  const de = document.documentElement;
  return {
    scrollW: Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0),
    scrollH: Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0),
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

// Runs inside the page: scroll and report back when done.
function scrollToY(y) {
  window.scrollTo(0, y);
  return window.scrollY;
}

async function init() {
  // Restore saved settings.
  const saved = await chrome.storage.local.get({ delay: 500, format: "png" });
  $("delay").value = String(saved.delay);
  $("format").value = saved.format;
  $("delay").addEventListener("change", (e) =>
    chrome.storage.local.set({ delay: Number(e.target.value) })
  );
  $("format").addEventListener("change", (e) =>
    chrome.storage.local.set({ format: e.target.value })
  );
  $("capture").addEventListener("click", captureFullPage);
  $("download").addEventListener("click", () => {
    if (lastBlobUrl) {
      const a = document.createElement("a");
      a.href = lastBlobUrl;
      a.download = lastFileName;
      a.click();
    }
  });
}

let lastBlobUrl = null;
let lastFileName = "fullshot.png";

function setProgress(pct, text) {
  $("progress").classList.remove("hidden");
  $("fill").style.width = `${Math.round(pct)}%`;
  $("status").textContent = text;
}

async function captureFullPage() {
  $("capture").disabled = true;
  $("result").classList.add("hidden");
  lastBlobUrl = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) throw new Error("No active tab found.");
    if (/^chrome:|^edge:|^about:|^chrome-extension:|^file:/.test(tab.url || "")) {
      throw new Error("Screenshots are not allowed on this page (browser-restricted URL).");
    }

    setProgress(2, "Measuring page…");
    const [m] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: pageMetrics,
    });
    const { scrollW, scrollH, viewW, viewH, dpr } = m.result;
    if (!scrollH || !viewH) throw new Error("Could not measure the page.");

    const delay = Number($("delay").value);
    const format = $("format").value;
    const steps = Math.ceil(scrollH / viewH);
    const tiles = [];

    // Walk the page top → bottom, capturing each viewport.
    for (let i = 0; i < steps; i++) {
      const y = Math.min(i * viewH, scrollH - viewH);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrollToY,
        args: [Math.max(0, y)],
      });
      await sleep(delay); // let lazy content / layout settle
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format });
      tiles.push({ y: Math.max(0, y), dataUrl });
      setProgress(5 + (90 * (i + 1)) / steps, `Capturing… ${i + 1} / ${steps}`);
    }

    // Scroll back to the top so the user isn't left at the bottom.
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrollToY,
      args: [0],
    });

    setProgress(96, "Stitching tiles…");
    const stitched = await stitchTiles(tiles, { scrollW, scrollH, viewW, viewH, dpr, format });

    const blob = await new Promise((res) =>
      stitched.canvas.toBlob(res, format === "jpeg" ? "image/jpeg" : "image/png", 0.92)
    );
    if (!blob) throw new Error("Failed to encode the stitched image.");

    lastBlobUrl = URL.createObjectURL(blob);
    lastFileName = `fullshot-${new Date().toISOString().replace(/[:.]/g, "-")}.${format === "jpeg" ? "jpg" : "png"}`;
    $("thumb").src = lastBlobUrl;
    $("meta").textContent = `${stitched.w} × ${stitched.h} px · ${steps} tile${steps > 1 ? "s" : ""} · ${(blob.size / 1024).toFixed(0)} KB`;
    $("result").classList.remove("hidden");
    setProgress(100, "Done!");
    await sleep(600);
    $("progress").classList.add("hidden");
  } catch (err) {
    setProgress(0, "");
    $("status").textContent = `Error: ${err.message}`;
    console.error(err);
  } finally {
    $("capture").disabled = false;
  }
}

// Draw every captured tile onto one tall canvas, cropping the last tile so
// the final image is exactly scrollH device-pixels tall.
function stitchTiles(tiles, { scrollW, scrollH, viewW, viewH, dpr }) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const w = Math.round(Math.min(scrollW, viewW) * dpr);
    const h = Math.round(scrollH * dpr);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    let loaded = 0;
    const imgs = tiles.map((t) => {
      const img = new Image();
      img.onload = () => {
        // Natural size is viewW×viewH CSS px (× dpr). Draw at device scale,
        // clipping the overhang of the final tile.
        const dy = Math.round(t.y * dpr);
        const avail = h - dy;
        const sh = Math.min(img.height, avail); // source px to copy
        const dh = Math.min(Math.round(viewH * dpr), avail);
        ctx.drawImage(img, 0, 0, img.width, sh, 0, dy, w, dh);
        if (++loaded === tiles.length) resolve({ canvas, w, h });
      };
      img.onerror = () => reject(new Error("A captured tile failed to decode."));
      img.src = t.dataUrl;
      return img;
    });
    if (!imgs.length) reject(new Error("No tiles were captured."));
  });
}

document.addEventListener("DOMContentLoaded", init);
