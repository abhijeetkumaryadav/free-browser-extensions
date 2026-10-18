"use strict";
/* FractalForge — procedural fractal art toy.
 * Renders Mandelbrot, Julia sets, and a Barnsley-style fern on a canvas.
 * Row-by-row chunked rendering keeps the popup responsive. No network,
 * no data collection — everything is computed on-device. Just a fun toy.
 */

const canvas = document.getElementById("art");
const g = canvas.getContext("2d");
const SIZE = canvas.width; // 640x640 render (also the download resolution)

const progressEl = document.getElementById("progress");
const barEl = document.getElementById("bar");
const paletteEl = document.getElementById("palette");
const detailEl = document.getElementById("detail");
const detailVal = document.getElementById("detailVal");
const shuffleBtn = document.getElementById("shuffleBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const modeHint = document.getElementById("modeHint");
const tabs = Array.from(document.querySelectorAll(".tab"));

/* ---- Color palettes: arrays of [r,g,b] stops, interpolated smoothly ---- */
const PALETTES = {
  sunset: [[8,8,20],[60,20,80],[180,60,90],[255,160,80],[255,240,200]],
  ocean:  [[2,8,24],[10,50,110],[20,140,170],[120,230,220],[240,255,250]],
  neon:   [[5,5,15],[90,20,160],[220,40,180],[80,240,220],[255,255,220]],
  ember:  [[10,5,5],[90,20,10],[200,70,20],[255,180,60],[255,245,220]],
  mono:   [[0,0,0],[45,45,55],[110,110,125],[180,180,195],[245,245,250]],
};

function paletteColor(pal, t) {
  // t in [0,1]; interpolate across stops
  const stops = PALETTES[pal];
  const x = Math.min(0.99999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/* ---- App state ---- */
const state = {
  mode: "mandelbrot",
  palette: "sunset",
  maxIter: 160,
  // Mandelbrot view: center (cx, cy) in complex plane, half-width `scale`
  view: { cx: -0.6, cy: 0, scale: 1.6 },
  // Julia constant
  juliaC: { re: -0.7, im: 0.27015 },
  // Fern: jittered affine coefficients
  fern: null,
  renderToken: 0, // increments to cancel in-flight renders
};

/* ---- Escape-time core shared by Mandelbrot & Julia ---- */
function escapeIter(zre, zim, cre, cim, maxIter) {
  let n = 0;
  while (n < maxIter) {
    const zr2 = zre * zre, zi2 = zim * zim;
    if (zr2 + zi2 > 4) break;
    zim = 2 * zre * zim + cim;
    zre = zr2 - zi2 + cre;
    n++;
  }
  return { n, mag2: zre * zre + zim * zim };
}

function smoothColor(n, mag2, maxIter, pal) {
  if (n >= maxIter) return [6, 6, 12]; // inside the set: near-black
  // Log-smoothed iteration count for band-free gradients
  const mu = n + 1 - Math.log2(Math.log(Math.sqrt(mag2)) / Math.log(2));
  return paletteColor(pal, Math.min(1, Math.max(0, mu / maxIter)));
}

/* ---- Renderers (all chunked row-by-row) ---- */
function renderMandelbrot(img, token) {
  const { cx, cy, scale } = state.view;
  const maxIter = state.maxIter;
  let y = 0;
  return new Promise((resolve) => {
    function chunk() {
      if (token !== state.renderToken) return resolve(false);
      const end = Math.min(SIZE, y + 24);
      for (; y < end; y++) {
        for (let x = 0; x < SIZE; x++) {
          const zre = cx + ((x / SIZE) * 2 - 1) * scale;
          const zim = cy + ((y / SIZE) * 2 - 1) * scale;
          const { n, mag2 } = escapeIter(zre, zim, zre, zim, maxIter);
          const [r, gg, b] = smoothColor(n, mag2, maxIter, state.palette);
          const i = (y * SIZE + x) * 4;
          img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      barEl.style.width = `${(y / SIZE) * 100}%`;
      if (y < SIZE) requestAnimationFrame(chunk);
      else resolve(true);
    }
    chunk();
  });
}

function renderJulia(img, token) {
  const { re, im } = state.juliaC;
  const maxIter = state.maxIter;
  // Julia view is fixed at a pleasant framing; "Surprise me" changes c.
  const scale = 1.5;
  let y = 0;
  return new Promise((resolve) => {
    function chunk() {
      if (token !== state.renderToken) return resolve(false);
      const end = Math.min(SIZE, y + 24);
      for (; y < end; y++) {
        for (let x = 0; x < SIZE; x++) {
          const zre = ((x / SIZE) * 2 - 1) * scale;
          const zim = ((y / SIZE) * 2 - 1) * scale;
          const { n, mag2 } = escapeIter(zre, zim, re, im, maxIter);
          const [r, gg, b] = smoothColor(n, mag2, maxIter, state.palette);
          const i = (y * SIZE + x) * 4;
          img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
      barEl.style.width = `${(y / SIZE) * 100}%`;
      if (y < SIZE) requestAnimationFrame(chunk);
      else resolve(true);
    }
    chunk();
  });
}

/** Barnsley-fern-style iterated function system with jittered coefficients. */
function makeFernParams() {
  const j = () => (Math.random() - 0.5) * 0.12; // small jitter for variety
  return [
    { a: 0.0 + j() * 0.2, b: 0.0,        c: 0.0,        d: 0.16 + j(),      e: 0, f: 0, p: 0.01 },
    { a: 0.85 + j(),      b: 0.04 + j(), c: -0.04 + j(), d: 0.85 + j(),     e: 0, f: 1.6, p: 0.85 },
    { a: 0.2 + j(),       b: -0.26 + j(), c: 0.23 + j(), d: 0.22 + j(),     e: 0, f: 1.6, p: 0.07 },
    { a: -0.15 + j(),     b: 0.28 + j(),  c: 0.26 + j(), d: 0.24 + j(),     e: 0, f: 0.44, p: 0.07 },
  ];
}

function renderFern(img, token) {
  if (!state.fern) state.fern = makeFernParams();
  const params = state.fern;
  // Clear to deep background
  const bg = paletteColor(state.palette, 0);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = bg[0]; img.data[i + 1] = bg[1]; img.data[i + 2] = bg[2]; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  // Cumulative probabilities
  const cum = [];
  let acc = 0;
  for (const q of params) { acc += q.p; cum.push(acc); }

  let px = 0, py = 0;
  const POINTS = 260000;
  const CHUNK = 20000;
  let done = 0;
  return new Promise((resolve) => {
    function chunk() {
      if (token !== state.renderToken) return resolve(false);
      const end = Math.min(POINTS, done + CHUNK);
      for (; done < end; done++) {
        const r = Math.random();
        let q = params[params.length - 1];
        for (let k = 0; k < cum.length; k++) {
          if (r <= cum[k]) { q = params[k]; break; }
        }
        const nx = q.a * px + q.b * py + q.e;
        const ny = q.c * px + q.d * py + q.f;
        px = nx; py = ny;
        // Map fern space (x: -2.5..2.5, y: 0..10) to canvas
        const sx = Math.floor(((px + 2.6) / 5.2) * SIZE);
        const sy = Math.floor(SIZE - (py / 10.2) * SIZE);
        if (sx >= 0 && sx < SIZE && sy >= 0 && sy < SIZE) {
          const t = Math.min(1, py / 9);
          const [cr, cg, cb] = paletteColor(state.palette, 0.25 + t * 0.75);
          const i = (sy * SIZE + sx) * 4;
          // Additive-ish brightening so dense areas glow
          img.data[i]     = Math.min(255, img.data[i] + cr * 0.35);
          img.data[i + 1] = Math.min(255, img.data[i + 1] + cg * 0.35);
          img.data[i + 2] = Math.min(255, img.data[i + 2] + cb * 0.35);
        }
      }
      g.putImageData(img, 0, 0);
      barEl.style.width = `${(done / POINTS) * 100}%`;
      if (done < POINTS) requestAnimationFrame(chunk);
      else resolve(true);
    }
    chunk();
  });
}

/* ---- Render orchestration ---- */
async function render() {
  const token = ++state.renderToken;
  progressEl.classList.add("on");
  barEl.style.width = "0%";
  const img = g.createImageData(SIZE, SIZE);
  const renderers = { mandelbrot: renderMandelbrot, julia: renderJulia, fern: renderFern };
  await renderers[state.mode](img, token);
  if (token === state.renderToken) progressEl.classList.remove("on");
}

/* ---- "Surprise me": new random artwork per mode ---- */
function surprise() {
  if (state.mode === "mandelbrot") {
    // Random interesting zooms inside the classic view
    const spots = [
      { cx: -0.745, cy: 0.113, scale: 0.02 },
      { cx: -0.16, cy: 1.04, scale: 0.08 },
      { cx: 0.285, cy: 0.01, scale: 0.05 },
      { cx: -1.25066, cy: 0.02012, scale: 0.004 },
      { cx: -0.6, cy: 0, scale: 1.6 },
    ];
    const s = spots[Math.floor(Math.random() * spots.length)];
    state.view = { ...s, scale: s.scale * (0.7 + Math.random() * 0.8) };
  } else if (state.mode === "julia") {
    // Random c on/near the boundary of the Mandelbrot set gives pretty Julias
    const ang = Math.random() * Math.PI * 2;
    const rad = 0.6 + Math.random() * 0.35;
    state.juliaC = { re: Math.cos(ang) * rad * 0.9, im: Math.sin(ang) * rad * 0.9 };
  } else {
    state.fern = makeFernParams();
  }
  // Random palette too, for a fresh look each time
  const keys = Object.keys(PALETTES);
  state.palette = keys[Math.floor(Math.random() * keys.length)];
  paletteEl.value = state.palette;
  render();
  persist();
}

/* ---- Mandelbrot zoom: click = 2x in, Shift+click = 2x out ---- */
canvas.addEventListener("click", (e) => {
  if (state.mode !== "mandelbrot") return;
  const rect = canvas.getBoundingClientRect();
  const fx = (e.clientX - rect.left) / rect.width;
  const fy = (e.clientY - rect.top) / rect.height;
  const { cx, cy, scale } = state.view;
  const px = cx + (fx * 2 - 1) * scale;
  const py = cy + (fy * 2 - 1) * scale;
  const factor = e.shiftKey ? 2 : 0.5;
  state.view = { cx: px, cy: py, scale: Math.min(1.6, Math.max(0.0005, scale * factor)) };
  render();
  persist();
});

function resetView() {
  state.view = { cx: -0.6, cy: 0, scale: 1.6 };
  state.fern = null;
  render();
  persist();
}

/* ---- Download current artwork as PNG ---- */
downloadBtn.addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fractalforge-${state.mode}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, "image/png");
});

/* ---- Controls ---- */
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    state.mode = tab.dataset.mode;
    modeHint.textContent =
      state.mode === "mandelbrot"
        ? "Click the artwork to zoom in · Shift+click to zoom out. Every render is unique — hit “Surprise me” for a fresh piece. Just a fun toy, nothing leaves your device."
        : state.mode === "julia"
        ? "Each “Surprise me” picks a brand-new Julia constant. Download any piece as a PNG. Just a fun toy, nothing leaves your device."
        : "Each “Surprise me” grows a brand-new jittered fern. Download any piece as a PNG. Just a fun toy, nothing leaves your device.";
    render();
    persist();
  });
});

paletteEl.addEventListener("change", () => {
  state.palette = paletteEl.value;
  render();
  persist();
});

detailEl.addEventListener("input", () => {
  state.maxIter = parseInt(detailEl.value, 10);
  detailVal.textContent = detailEl.value;
});

detailEl.addEventListener("change", () => {
  render();
  persist();
});

shuffleBtn.addEventListener("click", surprise);
resetBtn.addEventListener("click", resetView);

/* ---- Persistence (view + prefs only, on-device) ---- */
function persist() {
  chrome.storage.local.set({
    fractalForge: {
      mode: state.mode,
      palette: state.palette,
      maxIter: state.maxIter,
      view: state.view,
      juliaC: state.juliaC,
    },
  });
}

function restore() {
  chrome.storage.local.get({ fractalForge: null }, (res) => {
    const s = res.fractalForge;
    if (s) {
      state.mode = s.mode || "mandelbrot";
      state.palette = s.palette || "sunset";
      state.maxIter = s.maxIter || 160;
      state.view = s.view || state.view;
      state.juliaC = s.juliaC || state.juliaC;
      paletteEl.value = state.palette;
      detailEl.value = state.maxIter;
      detailVal.textContent = state.maxIter;
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === state.mode));
    }
    render();
  });
}

restore();
