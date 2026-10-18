/* Canvas Effects Sandbox — popup logic.
 * Load a local image, apply classic canvas filters (pixelate, duotone, glitch,
 * halftone, edge-detect), export as PNG. No AI involved — HONEST SCOPE.
 */
'use strict';

// ---------------------------------------------------------------- constants
const STAGE_W = 348;           // display canvas width (px)
const STAGE_H = 232;          // display canvas height (px)
const LS_KEY = 'effectsSandbox'; // chrome.storage.local prefs key

// ------------------------------------------------------------------ state
let srcImage = null;          // loaded HTMLImageElement (original)
let workCanvas = null;        // offscreen canvas at image resolution
let activeFx = 'none';        // currently selected effect id
let strength = 50;            // 0..100 intensity

// -------------------------------------------------------------------- dom
const $ = (id) => document.getElementById(id);
const stage = $('stage');
const sctx = stage.getContext('2d', { willReadFrequently: true });
const fileInput = $('fileInput');
const btnExport = $('btnExport');
const statusEl = $('status');
const fxGrid = $('fxGrid');
const strengthRange = $('strengthRange');
const strengthVal = $('strengthVal');

function setStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}

// ------------------------------------------------------------ image loading
fileInput.addEventListener('change', () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('That file is not an image.', true);
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    srcImage = img;
    // Offscreen working canvas at the image's own resolution.
    workCanvas = document.createElement('canvas');
    workCanvas.width = img.naturalWidth;
    workCanvas.height = img.naturalHeight;
    workCanvas.getContext('2d').drawImage(img, 0, 0);
    btnExport.disabled = false;
    setStatus(`Loaded ${file.name} (${img.naturalWidth}×${img.naturalHeight}). Pick an effect.`);
    render();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Could not read that image file.', true);
  };
  img.src = url;
});

// -------------------------------------------------------------- filter bank
// Each filter reads from the ORIGINAL workCanvas and writes into a fresh
// output canvas at the same resolution. `t` is strength 0..1.
const filters = {
  none(img, t) {
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    out.getContext('2d').drawImage(img, 0, 0);
    return out;
  },

  // Mosaic: draw the image tiny, then scale back up with smoothing off.
  pixelate(img, t) {
    const cells = Math.max(2, Math.round(2 + t * 60)); // cell count across width
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const ctx = out.getContext('2d');
    const tiny = document.createElement('canvas');
    tiny.width = cells;
    tiny.height = Math.max(1, Math.round((cells * img.height) / img.width));
    const tctx = tiny.getContext('2d');
    tctx.drawImage(img, 0, 0, tiny.width, tiny.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiny, 0, 0, out.width, out.height);
    return out;
  },

  // Two-tone: map luminance between a dark cyan and a bright cyan.
  duotone(img, t) {
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const ctx = out.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, out.width, out.height);
    const d = data.data;
    // dark -> bright cyan ramp; `t` pushes contrast
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      const k = Math.min(1, Math.max(0, lum * (0.5 + t) + (1 - t) * 0.25));
      d[i]     = Math.round(6 + k * 26);    // R: 6 -> 32
      d[i + 1] = Math.round(40 + k * 171);  // G: 40 -> 211
      d[i + 2] = Math.round(52 + k * 186);  // B: 52 -> 238
    }
    ctx.putImageData(data, 0, 0);
    return out;
  },

  // RGB-split + row displacement, amount scaled by strength.
  glitch(img, t) {
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const ctx = out.getContext('2d');
    const shift = Math.round(2 + t * 24);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(img, -shift, 0);            // red-shifted copy
    ctx.globalCompositeOperation = 'lighter';
    const tmp = document.createElement('canvas');
    tmp.width = img.width; tmp.height = img.height;
    tmp.getContext('2d').drawImage(img, shift, 0);
    ctx.drawImage(tmp, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // horizontal row slices displaced
    const rows = Math.round(4 + t * 26);
    for (let r = 0; r < rows; r++) {
      const y = Math.floor(Math.random() * img.height);
      const h = Math.max(2, Math.floor(img.height / rows / 2));
      const dx = Math.round((Math.random() - 0.5) * shift * 2);
      ctx.drawImage(out, 0, y, img.width, h, dx, y, img.width, h);
    }
    return out;
  },

  // Newspaper dot pattern from luminance.
  halftone(img, t) {
    const cell = Math.max(3, Math.round(9 - t * 5)); // smaller cell = denser
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const ctx = out.getContext('2d');
    // sample luminance on a coarse grid
    const probe = document.createElement('canvas');
    const pw = Math.ceil(img.width / cell);
    const ph = Math.ceil(img.height / cell);
    probe.width = pw; probe.height = ph;
    const pctx = probe.getContext('2d', { willReadFrequently: true });
    pctx.drawImage(img, 0, 0, pw, ph);
    const data = pctx.getImageData(0, 0, pw, ph).data;
    ctx.fillStyle = '#0b0b10';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#22d3ee';
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4;
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
        const r = (cell / 2) * (1 - lum) * (0.4 + t * 0.8);
        if (r <= 0.3) continue;
        ctx.beginPath();
        ctx.arc(x * cell + cell / 2, y * cell + cell / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return out;
  },

  // Sobel edge detection via convolution; `t` scales edge gain.
  edge(img, t) {
    const out = document.createElement('canvas');
    out.width = img.width; out.height = img.height;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const src = ctx.getImageData(0, 0, out.width, out.height);
    const w = out.width;
    const h = out.height;
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      gray[i] = 0.299 * src.data[i * 4] + 0.587 * src.data[i * 4 + 1] + 0.114 * src.data[i * 4 + 2];
    }
    const dst = ctx.createImageData(w, h);
    const gain = 1 + t * 3;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        // Sobel kernels
        const gx = -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1]
                   + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
        const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1]
                   + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
        let mag = Math.sqrt(gx * gx + gy * gy) * gain;
        mag = Math.min(255, mag);
        const o = i * 4;
        dst.data[o] = dst.data[o + 1] = dst.data[o + 2] = mag;
        dst.data[o + 3] = 255;
      }
    }
    ctx.putImageData(dst, 0, 0);
    return out;
  }
};

// ----------------------------------------------------------------- render
function render() {
  if (!srcImage) return;
  const t = strength / 100;
  const out = filters[activeFx](workCanvas, t);
  // Fit into the stage canvas (letterboxed, aspect preserved).
  sctx.fillStyle = '#000';
  sctx.fillRect(0, 0, STAGE_W, STAGE_H);
  const scale = Math.min(STAGE_W / out.width, STAGE_H / out.height);
  const dw = out.width * scale;
  const dh = out.height * scale;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(out, (STAGE_W - dw) / 2, (STAGE_H - dh) / 2, dw, dh);
  savePrefs();
}

// ------------------------------------------------------------------ export
btnExport.addEventListener('click', () => {
  if (!srcImage) return;
  const t = strength / 100;
  const out = filters[activeFx](workCanvas, t);
  const a = document.createElement('a');
  a.download = 'effects-sandbox.png';
  a.href = out.toDataURL('image/png');
  a.click();
  setStatus('Exported as effects-sandbox.png.');
});

// ------------------------------------------------------------------- prefs
function savePrefs() {
  chrome.storage.local.set({ [LS_KEY]: { activeFx, strength } });
}

function loadPrefs() {
  chrome.storage.local.get({ [LS_KEY]: null }, (res) => {
    const p = res[LS_KEY];
    if (p && filters[p.activeFx]) {
      activeFx = p.activeFx;
      strength = Math.min(100, Math.max(0, Number(p.strength) || 50));
    }
    strengthRange.value = strength;
    strengthVal.textContent = String(strength);
    markActiveFx();
  });
}

// --------------------------------------------------------------------- ui
fxGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.fx');
  if (!btn) return;
  activeFx = btn.dataset.fx;
  markActiveFx();
  if (!srcImage) setStatus('Load an image first — effect will apply when it loads.');
  else render();
});

function markActiveFx() {
  fxGrid.querySelectorAll('.fx').forEach((b) => {
    b.classList.toggle('active', b.dataset.fx === activeFx);
  });
}

strengthRange.addEventListener('input', () => {
  strength = Number(strengthRange.value);
  strengthVal.textContent = String(strength);
  render();
});

// init: mark "None" active and restore saved prefs
markActiveFx();
loadPrefs();
