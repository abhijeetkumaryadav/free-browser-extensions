/* Manual Redaction Tool — pixelate regions of a local image.
   Fully local: no network, no uploads. The download is generated in-page. */
'use strict';

/* ==================== ENGINE (headless-testable) ==================== */
// ENGINE-START

/** Max display width of the working canvas in CSS pixels. */
const STAGE_MAX_W = 348;

/** Compute display scale so the image fits the stage, never upscaling. */
function displayScale(natW, natH) {
  if (!natW || !natH) return 1;
  return Math.min(1, STAGE_MAX_W / natW);
}

/** Clamp a drag rectangle into [0, w]×[0, h]; returns null if it collapses. */
function clampBox(x, y, w, h, maxW, maxH) {
  const x0 = Math.max(0, Math.min(x, x + w));
  const y0 = Math.max(0, Math.min(y, y + h));
  const x1 = Math.min(maxW, Math.max(x, x + w));
  const y1 = Math.min(maxH, Math.max(y, y + h));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 3 || bh < 3) return null; // ignore accidental taps
  return { x: x0, y: y0, w: bw, h: bh };
}

/** Convert a display-space box to natural image-space using the scale. */
function boxToNatural(box, scale) {
  return {
    x: Math.round(box.x / scale),
    y: Math.round(box.y / scale),
    w: Math.max(1, Math.round(box.w / scale)),
    h: Math.max(1, Math.round(box.h / scale))
  };
}

/**
 * Pixelation grid for a box: how many mosaic cells the region is
 * downsampled to. Pure math — the caller downsamples then upscales.
 */
function pixelSteps(box, block) {
  const b = Math.max(1, Math.floor(block));
  return {
    stepsX: Math.max(1, Math.ceil(box.w / b)),
    stepsY: Math.max(1, Math.ceil(box.h / b))
  };
}

/** File name for the redacted download. */
function downloadName(original) {
  const base = (original || 'image').replace(/\.[a-z0-9]+$/i, '');
  return base + '-redacted.png';
}
// ENGINE-END

/* ==================== UI ==================== */

const fileInput = document.getElementById('fileInput');
const stage = document.getElementById('stage');
const sctx = stage.getContext('2d');
const emptyHint = document.getElementById('emptyHint');
const pixelSize = document.getElementById('pixelSize');
const pixelVal = document.getElementById('pixelVal');
const undoBtn = document.getElementById('undoBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const boxCount = document.getElementById('boxCount');

let img = null;          // HTMLImageElement (natural size)
let scale = 1;           // display scale
let boxes = [];          // display-space boxes
let dragStart = null;    // {x, y} display-space

pixelSize.addEventListener('input', () => {
  pixelVal.textContent = pixelSize.value + 'px';
});

/* --- load image --- */
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const im = new Image();
  im.onload = () => {
    img = im;
    img._fileName = file.name;
    boxes = [];
    scale = displayScale(im.naturalWidth, im.naturalHeight);
    stage.width = Math.max(1, Math.round(im.naturalWidth * scale));
    stage.height = Math.max(1, Math.round(im.naturalHeight * scale));
    render();
    URL.revokeObjectURL(url);
  };
  im.src = url;
});

/* --- drag boxes --- */
function canvasPos(ev) {
  const r = stage.getBoundingClientRect();
  const cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
  const cy = (ev.touches ? ev.touches[0].clientY : ev.clientY);
  return {
    x: (cx - r.left) * (stage.width / r.width),
    y: (cy - r.top) * (stage.height / r.height)
  };
}
stage.addEventListener('pointerdown', (ev) => {
  if (!img) return;
  dragStart = canvasPos(ev);
  stage.setPointerCapture(ev.pointerId);
});
stage.addEventListener('pointermove', (ev) => {
  if (!img || !dragStart) return;
  render();
  const p = canvasPos(ev);
  const b = clampBox(dragStart.x, dragStart.y, p.x - dragStart.x, p.y - dragStart.y,
                     stage.width, stage.height);
  if (b) drawBox(b, true);
});
stage.addEventListener('pointerup', (ev) => {
  if (!img || !dragStart) return;
  const p = canvasPos(ev);
  const b = clampBox(dragStart.x, dragStart.y, p.x - dragStart.x, p.y - dragStart.y,
                     stage.width, stage.height);
  dragStart = null;
  if (b) boxes.push(b);
  render();
});

function drawBox(b, live) {
  sctx.save();
  sctx.strokeStyle = live ? '#fb7185' : '#fbbf24';
  sctx.lineWidth = 2;
  sctx.setLineDash(live ? [6, 4] : []);
  sctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  sctx.restore();
}

function render() {
  sctx.clearRect(0, 0, stage.width, stage.height);
  if (img) {
    sctx.drawImage(img, 0, 0, stage.width, stage.height);
    emptyHint.style.display = 'none';
  } else {
    emptyHint.style.display = 'flex';
  }
  boxes.forEach((b) => drawBox(b, false));
  boxCount.textContent = String(boxes.length);
  downloadBtn.disabled = !(img && boxes.length);
}

/* --- buttons --- */
undoBtn.addEventListener('click', () => { boxes.pop(); render(); });
clearBtn.addEventListener('click', () => { boxes = []; render(); });

downloadBtn.addEventListener('click', () => {
  if (!img || !boxes.length) return;
  // Work at natural resolution for a quality download.
  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  const octx = out.getContext('2d');
  octx.drawImage(img, 0, 0);
  const block = Math.round(pixelSize.value / scale);
  for (const b of boxes) {
    const n = boxToNatural(b, scale);
    // Downsample region to a tiny offscreen canvas, then upscale.
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(1, Math.ceil(n.w / block));
    tiny.height = Math.max(1, Math.ceil(n.h / block));
    const tctx = tiny.getContext('2d');
    tctx.drawImage(out, n.x, n.y, n.w, n.h, 0, 0, tiny.width, tiny.height);
    octx.imageSmoothingEnabled = false;
    octx.drawImage(tiny, 0, 0, tiny.width, tiny.height, n.x, n.y, n.w, n.h);
    octx.imageSmoothingEnabled = true;
  }
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = downloadName(img._fileName);
  a.click();
});

render();
