"use strict";
/* =====================================================================
 * Artifact Lens — video compression/blocking artifact visualizer.
 *
 * Method (honest, heuristic): sample each video frame down to a small
 * canvas, compute per-pixel luminance, then measure gradient energy
 * along 8x8 macroblock boundaries (where MPEG-style codecs concentrate
 * blocking artifacts). Pixels near boundaries with high gradient get
 * painted as "hot" on the lens canvas.
 *
 * This shows compression artifacts only — it is NOT deepfake detection.
 * All processing is local; the video never leaves the popup.
 * =================================================================== */

/* ---------- DOM ---------- */
const fileInput = document.getElementById("file");
const fileLabel = document.getElementById("fileLabel");
const stage     = document.getElementById("stage");
const lens     = document.getElementById("lens");
const lctx     = lens.getContext("2d", { willReadFrequently: true });
const sens     = document.getElementById("sens");
const sensVal  = document.getElementById("sensVal");
const liveChk  = document.getElementById("live");
const stat     = document.getElementById("stat");
const resetBtn = document.getElementById("reset");

/* ---------- Offscreen sample canvas ---------- */
const SW = 160, SH = 90;                       // sample resolution
const sample = document.createElement("canvas");
sample.width = SW; sample.height = SH;
const sctx = sample.getContext("2d", { willReadFrequently: true });

/* ---------- Persisted prefs ---------- */
chrome.storage.local.get({ sens: 40, live: true }, (prefs) => {
  sens.value = prefs.sens;
  sensVal.textContent = prefs.sens;
  liveChk.checked = prefs.live;
});
sens.addEventListener("input", () => {
  sensVal.textContent = sens.value;
  chrome.storage.local.set({ sens: Number(sens.value) });
});
liveChk.addEventListener("change", () => {
  chrome.storage.local.set({ live: liveChk.checked });
});

/* ---------- Video loading ---------- */
let objectUrl = null;
fileInput.addEventListener("change", () => {
  const f = fileInput.files && fileInput.files[0];
  if (!f) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);
  stage.src = objectUrl;
  fileLabel.textContent = f.name.length > 34 ? f.name.slice(0, 33) + "…" : f.name;
  stat.textContent = "Loaded — press play to scan";
});

/* ---------- Artifact analysis ---------- */
/* Accent color (pink #f472b6) written into hot pixels. */
function analyzeFrame() {
  const v = stage;
  if (v.readyState < 2 || v.videoWidth === 0) return;
  try {
    sctx.drawImage(v, 0, 0, SW, SH);
  } catch (e) { return; }
  const data = sctx.getImageData(0, 0, SW, SH).data;

  const out = lctx.createImageData(lens.width, lens.height);
  const od = out.data;
  const scaleX = lens.width / SW, scaleY = lens.height / SH;

  /* Luminance array for gradient work. */
  const lum = new Float32Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) {
    lum[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  const threshold = Number(sens.value); // 1..100
  let hot = 0;

  for (let y = 1; y < SH - 1; y++) {
    for (let x = 1; x < SW - 1; x++) {
      /* Gradient magnitude (Sobel-lite). */
      const gx = lum[y * SW + x + 1] - lum[y * SW + x - 1];
      const gy = lum[(y + 1) * SW + x] - lum[(y - 1) * SW + x];
      const g = Math.abs(gx) + Math.abs(gy);

      /* Block-boundary weight: 8x8 macroblock grid in sample space. */
      const onBX = (x % 8 === 0), onBY = (y % 8 === 0);
      const weight = (onBX || onBY) ? 1 : 0.25;

      const energy = g * weight;
      if (energy > threshold) {
        /* Paint hot pixel block onto output at lens resolution. */
        const ox = Math.floor(x * scaleX), oy = Math.floor(y * scaleY);
        const idx = (oy * lens.width + ox) * 4;
        od[idx] = 244; od[idx + 1] = 114; od[idx + 2] = 182; od[idx + 3] = 255;
        hot++;
      }
    }
  }
  lctx.putImageData(out, 0, 0);
  stat.textContent = "Hot blocks: " + hot + " · frame " + Math.floor(v.currentTime * 30);
}

/* ---------- Live loop ---------- */
let rafId = null;
function loop() {
  if (liveChk.checked && !stage.paused && !stage.ended) {
    analyzeFrame();
  }
  rafId = requestAnimationFrame(loop);
}
loop();

/* Analyze on seek even while paused. */
stage.addEventListener("seeked", analyzeFrame);
stage.addEventListener("loadeddata", analyzeFrame);

/* ---------- Reset ---------- */
resetBtn.addEventListener("click", () => {
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  stage.removeAttribute("src"); stage.load();
  fileInput.value = "";
  fileLabel.textContent = "Load local video";
  lctx.clearRect(0, 0, lens.width, lens.height);
  stat.textContent = "No video loaded";
});
