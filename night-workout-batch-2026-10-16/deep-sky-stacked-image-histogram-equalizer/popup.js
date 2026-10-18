/* Deep-sky histogram equalization — educational demo on a synthetic test image. */
"use strict";
/* ---------- engine (headless-testable) ---------- */
// ENGINE-START
/** Build a 256-bin histogram from a grayscale pixel array (0..255). */
function computeHistogram(pixels) {
  const h = new Array(256).fill(0);
  for (const p of pixels) h[Math.max(0, Math.min(255, Math.round(p)))]++;
  return h;
}
/** CDF mapping: hist -> lookup table for full-range equalization. */
function equalizeLUT(hist, total) {
  const lut = new Array(256);
  let cum = 0, cdfMin = -1;
  const cdf = hist.map(c => { cum += c; if (cdfMin < 0 && cum > 0) cdfMin = cum; return cum; });
  for (let i = 0; i < 256; i++) {
    lut[i] = total === cdfMin ? i : Math.round((cdf[i] - cdfMin) / (total - cdfMin) * 255);
  }
  return lut;
}
/** Blend original and equalized value by strength 0..1. */
function applyStrength(lut, v, strength) {
  return Math.round(v * (1 - strength) + lut[v] * strength);
}
/** Seeded PRNG (mulberry32) for reproducible test images. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
/** Generate a synthetic deep-sky test image: dark gradient + nebula blobs + stars + noise. */
function genTestImage(w, h, seed, withStars) {
  const rnd = mulberry32(seed), px = new Float32Array(w * h);
  const blobs = [];
  for (let b = 0; b < 5; b++) blobs.push({ x: rnd() * w, y: rnd() * h, r: 15 + rnd() * 30, amp: 12 + rnd() * 22 });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 8 + 10 * (x / w); // faint gradient sky background
    for (const b of blobs) {
      const dx = x - b.x, dy = y - b.y, d2 = dx * dx + dy * dy;
      v += b.amp * Math.exp(-d2 / (2 * b.r * b.r));
    }
    v += (rnd() - 0.5) * 14; // read noise
    if (withStars && rnd() < 0.004) v = 120 + rnd() * 135; // sparse stars
    px[y * w + x] = Math.max(0, Math.min(255, v));
  }
  return px;
}
// ENGINE-END
/* ---------- UI ---------- */
const W = 160, H = 120;
const $ = id => document.getElementById(id);
let pixels, seed = (Math.random() * 1e9) | 0, starsOn = true, strength = 0.7;

function draw() {
  const bctx = $("before").getContext("2d"), actx = $("after").getContext("2d");
  const hist = computeHistogram(pixels), lut = equalizeLUT(hist, pixels.length);
  const ib = bctx.createImageData(W, H), ia = actx.createImageData(W, H);
  for (let i = 0; i < pixels.length; i++) {
    const v = Math.round(pixels[i]);
    const e = applyStrength(lut, v, strength);
    for (const [img, val] of [[ib, v], [ia, e]]) {
      img.data[i * 4] = val * 0.55; img.data[i * 4 + 1] = val * 0.65; img.data[i * 4 + 2] = val; img.data[i * 4 + 3] = 255;
    }
  }
  bctx.putImageData(ib, 0, 0); actx.putImageData(ia, 0, 0);
  // histograms
  const hctx = $("hist").getContext("2d"), hw = 340, hh = 90;
  hctx.clearRect(0, 0, hw, hh);
  const h2 = computeHistogram(Array.from(pixels, v => applyStrength(lut, Math.round(v), strength)));
  const peak = Math.max(...hist, ...h2);
  const bar = (data, color) => {
    hctx.fillStyle = color;
    for (let i = 0; i < 256; i++) {
      const bh = data[i] / peak * (hh - 6);
      hctx.fillRect(i * hw / 256, hh - bh, hw / 256, bh);
    }
  };
  bar(hist, "rgba(120,120,140,0.8)");
  bar(h2, "rgba(167,139,250,0.45)");
}

function regen() { pixels = genTestImage(W, H, seed, starsOn); draw(); }

chrome.storage.local.get(["heqSeed", "heqStrength", "heqStars"], r => {
  if (r.heqStrength != null) { strength = r.heqStrength; $("strength").value = strength * 100; $("sv").textContent = Math.round(strength * 100) + "%"; }
  if (r.heqStars != null) { starsOn = r.heqStars; $("stars").textContent = "Stars: " + (starsOn ? "on" : "off"); }
  regen();
});
$("strength").addEventListener("input", e => {
  strength = e.target.value / 100;
  $("sv").textContent = e.target.value + "%";
  chrome.storage.local.set({ heqStrength: strength });
  draw();
});
$("regen").addEventListener("click", () => { seed = (Math.random() * 1e9) | 0; regen(); });
$("stars").addEventListener("click", () => {
  starsOn = !starsOn;
  $("stars").textContent = "Stars: " + (starsOn ? "on" : "off");
  chrome.storage.local.set({ heqStars: starsOn });
  regen();
});
