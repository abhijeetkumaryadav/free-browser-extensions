/* Thumbnail Contrast Booster — popup logic.
 * Manual per-pixel filters on an offscreen canvas: contrast, brightness
 * (exposure), saturation, vibrance. Hold-to-compare with original.
 * All local, no AI, no network. */
'use strict';

// ---------- adjustment definitions ----------
const ADJUSTMENTS = [
  { key: 'contrast',   label: 'Contrast',   min: 0,   max: 200, def: 100, unit: '%' },
  { key: 'exposure',   label: 'Exposure',   min: -100, max: 100, def: 0,   unit: 'EV-ish' },
  { key: 'saturation', label: 'Saturation', min: 0,   max: 200, def: 100, unit: '%' },
  { key: 'vibrance',   label: 'Vibrance',   min: -100, max: 100, def: 0,   unit: '' }
];

// ---------- state ----------
const state = {
  img: null,          // source HTMLImageElement
  origData: null,     // original ImageData (for compare + re-filter)
  values: { contrast: 100, exposure: 0, saturation: 100, vibrance: 0 }
};

// ---------- dom ----------
const $ = id => document.getElementById(id);
const canvas = $('preview'), ctx = canvas.getContext('2d');

// ---------- settings ----------
async function loadSettings() {
  try {
    const s = await chrome.storage.local.get(['thumbValues']);
    if (s.thumbValues) Object.assign(state.values, s.thumbValues);
  } catch (e) { /* storage unavailable */ }
}
function saveSettings() {
  chrome.storage.local.set({ thumbValues: state.values }).catch(() => {});
}

// ---------- sliders ----------
function buildSliders() {
  const host = $('sliders');
  ADJUSTMENTS.forEach(adj => {
    const row = document.createElement('div');
    row.className = 'slider-row';
    row.innerHTML =
      `<div class="top"><span>${adj.label}</span><span class="val"></span></div>` +
      `<input type="range" min="${adj.min}" max="${adj.max}" value="${state.values[adj.key]}">`;
    const input = row.querySelector('input');
    const val = row.querySelector('.val');
    const paint = () => { val.textContent = input.value + adj.unit; };
    input.addEventListener('input', () => {
      state.values[adj.key] = +input.value;
      paint(); saveSettings(); render();
    });
    paint();
    host.appendChild(row);
  });
}

// ---------- filter math ----------
function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
function applyFilters(src, dst, v) {
  // Precompute LUTs for contrast + exposure (brightness).
  const c = v.contrast / 100;
  const exposureGain = Math.pow(2, v.exposure / 50); // ±2 stops at extremes
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = clamp(Math.round(((i - 128) * c + 128) * exposureGain));
  }
  const sat = v.saturation / 100;
  const vib = v.vibrance / 100;
  const d = src.data, o = dst.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = lut[d[i]], g = lut[d[i + 1]], b = lut[d[i + 2]];
    const a = d[i + 3];
    // Saturation around luma.
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    r = luma + (r - luma) * sat;
    g = luma + (g - luma) * sat;
    b = luma + (b - luma) * sat;
    // Vibrance: boost saturation more where saturation is low.
    if (vib !== 0) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const amt = ((mx - mn) / 255) * vib * -1; // less-saturated pixels get more
      const avg = (r + g + b) / 3;
      r = r + (r - avg) * amt * 0.5;
      g = g + (g - avg) * amt * 0.5;
      b = b + (b - avg) * amt * 0.5;
    }
    o[i] = clamp(Math.round(r));
    o[i + 1] = clamp(Math.round(g));
    o[i + 2] = clamp(Math.round(b));
    o[i + 3] = a;
  }
}

// ---------- render ----------
function render() {
  if (!state.img) return;
  const w = state.img.naturalWidth, h = state.img.naturalHeight;
  canvas.width = w; canvas.height = h;
  // Draw original once into an offscreen buffer (cached as ImageData).
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d', { willReadFrequently: true });
  tctx.drawImage(state.img, 0, 0);
  const src = tctx.getImageData(0, 0, w, h);
  state.origData = src;
  const out = ctx.createImageData(w, h);
  applyFilters(src, out, state.values);
  ctx.putImageData(out, 0, 0);
}
function showOriginal(show) {
  if (!state.origData) return;
  if (show) ctx.putImageData(state.origData, 0, 0);
  else render();
}

// ---------- inputs ----------
function bindInputs() {
  $('imgFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      state.img = img;
      URL.revokeObjectURL(url);
      $('imgHint').textContent = `${f.name} — ${img.naturalWidth}×${img.naturalHeight}px`;
      $('downloadBtn').disabled = false;
      render();
    };
    img.onerror = () => { $('imgHint').textContent = 'Could not read that image.'; };
    img.src = url;
  });
  const hold = $('showOrig');
  hold.addEventListener('pointerdown', () => showOriginal(true));
  ['pointerup', 'pointerleave'].forEach(ev => hold.addEventListener(ev, () => showOriginal(false)));

  $('resetBtn').addEventListener('click', () => {
    ADJUSTMENTS.forEach(a => { state.values[a.key] = a.def; });
    document.querySelectorAll('#sliders input[type=range]').forEach((inp, i) => {
      inp.value = ADJUSTMENTS[i].def;
      inp.dispatchEvent(new Event('input'));
    });
  });
  $('format').addEventListener('change', e => {
    $('qWrap').style.display = e.target.value === 'image/png' ? 'none' : '';
  });
  $('quality').addEventListener('input', e => { $('qualityVal').textContent = e.target.value; });
  $('downloadBtn').addEventListener('click', () => {
    if (!state.img) return;
    const type = $('format').value;
    const q = type === 'image/png' ? undefined : $('quality').value / 100;
    canvas.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'thumbnail-boosted.' + type.split('/')[1].replace('jpeg', 'jpg');
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, type, q);
  });
}

// ---------- init ----------
(async function init() {
  await loadSettings();
  buildSliders();
  bindInputs();
  $('qWrap').style.display = 'none'; // PNG default has no quality
})();
