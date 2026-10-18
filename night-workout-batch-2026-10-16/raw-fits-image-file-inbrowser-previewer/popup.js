"use strict";
/* FITS Frame Previewer — educational synthetic-frame demo.
 * No FITS parsing here: we generate a fake "CCD frame" and demonstrate
 * the min/max + log/sqrt stretches astronomers apply to real data. */

// ================= ENGINE-START =================
// Seeded PRNG so the frame is reproducible per seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate a synthetic 16-bit-ish frame: dark gradient + nebula blobs + stars + noise.
function genFrame(w, h, seed) {
  const rnd = mulberry32(seed);
  const px = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1200 + 900 * (y / h);            // gradient background
      // nebula blobs (few gaussian blobs)
      for (const b of NEBS) {
        const dx = x - b.x * w, dy = y - b.y * h;
        const s = b.s * w;
        v += b.amp * Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
      }
      v += (rnd() - 0.5) * 700;                // read noise
      px[y * w + x] = v;
    }
  }
  // sprinkle stars
  for (let i = 0; i < 260; i++) {
    const x = (rnd() * w) | 0, y = (rnd() * h) | 0;
    const amp = 1500 + rnd() * rnd() * 28000;
    const idx = y * w + x;
    px[idx] = Math.min(px[idx] + amp, 65535);
    if (x > 0) px[idx - 1] += amp * 0.18;      // simple PSF bloom
    if (x < w - 1) px[idx + 1] += amp * 0.18;
  }
  return px;
}
const NEBS = [
  { x: 0.32, y: 0.55, s: 0.16, amp: 5200 },
  { x: 0.68, y: 0.38, s: 0.11, amp: 3800 },
  { x: 0.55, y: 0.72, s: 0.08, amp: 2900 }
];

// Stretch a raw value through min/max cut levels and a mode, -> 0..255.
function stretchValue(v, vmin, vmax, mode) {
  if (vmax <= vmin) return 0;
  let t = (v - vmin) / (vmax - vmin);
  t = Math.max(0, Math.min(1, t));
  if (mode === "log") {
    t = Math.log10(1 + 999 * t) / 3;          // log10(1+999t)/3 maps 0..1 -> 0..1
  } else if (mode === "sqrt") {
    t = Math.sqrt(t);
  }
  return Math.round(t * 255);
}

// Scale 16-bit-ish raw range to the slider's 0..255 display domain.
const RAW_MAX = 65535;
function rawToSlider(v) { return Math.max(0, Math.min(255, Math.round(v / RAW_MAX * 255))); }
function sliderToRaw(s) { return s / 255 * RAW_MAX; }
// ================= ENGINE-END =================

// ---- UI ----
const canvas = document.getElementById("frame");
const ctx = canvas.getContext("2d");
const FW = canvas.width, FH = canvas.height;

let frame = null;
let seed = 20261017;
let mode = "linear";

function render() {
  if (!frame) return;
  const vmin = sliderToRaw(parseInt(document.getElementById("vmin").value, 10));
  const vmax = sliderToRaw(parseInt(document.getElementById("vmax").value, 10));
  const img = ctx.createImageData(FW, FH);
  const d = img.data;
  for (let i = 0; i < FW * FH; i++) {
    const g = stretchValue(frame[i], vmin, vmax, mode);
    d[i * 4] = g; d[i * 4 + 1] = g; d[i * 4 + 2] = g; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function regenerate() {
  frame = genFrame(FW, FH, seed);
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  render();
}

function bind(id, outId) {
  const el = document.getElementById(id);
  const out = document.getElementById(outId);
  el.addEventListener("input", () => { out.textContent = el.value; render(); });
  out.textContent = el.value;
}

document.getElementById("modeSeg").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  mode = b.dataset.mode;
  for (const x of document.querySelectorAll("#modeSeg button")) x.classList.toggle("active", x === b);
  render();
});
document.getElementById("regen").addEventListener("click", regenerate);

bind("vmin", "vminVal");
bind("vmax", "vmaxVal");
regenerate();
