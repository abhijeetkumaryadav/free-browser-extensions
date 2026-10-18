// SnapMark editor — annotation engine.
//
// Loads the captured PNG from chrome.storage.session (set by the popup),
// then offers: freehand pen, arrow, rectangle, text labels, region blur
// (pixelation) and crop. Undo stack, clear-all, and PNG download.
// All processing is on-device; nothing is uploaded.

const board = document.getElementById('board');
const ctx = board.getContext('2d');
const wrap = document.getElementById('canvasWrap');
const textInput = document.getElementById('textInput');
const toastEl = document.getElementById('toast');

const state = {
  tool: 'pen',
  color: '#f43f5e',
  width: 5,
  drawing: false,
  start: null,          // {x, y} in canvas pixels at drag start
  draft: null,          // ImageData snapshot for live shape previews
  history: [],          // committed ImageData snapshots for undo
  base: null,           // pristine screenshot ImageData (for "clear")
  imgSize: { w: 0, h: 0 }
};

const MAX_HISTORY = 40;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

/* ------------------------------------------------------------------ */
/* Coordinate helpers                                                  */
/* ------------------------------------------------------------------ */

// Convert a pointer event to canvas-pixel coordinates (canvas is displayed
// scaled via CSS, so we scale the offset back up to natural pixels).
function toCanvas(e) {
  const r = board.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (board.width / r.width),
    y: (e.clientY - r.top) * (board.height / r.height)
  };
}

function pushHistory() {
  state.history.push(ctx.getImageData(0, 0, board.width, board.height));
  if (state.history.length > MAX_HISTORY) state.history.shift();
}

/* ------------------------------------------------------------------ */
/* Shape rendering                                                     */
/* ------------------------------------------------------------------ */

function drawArrow(c, x1, y1, x2, y2, color, width) {
  const headLen = Math.max(14, width * 3.2);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  c.strokeStyle = color; c.fillStyle = color;
  c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
  // Arrowhead.
  c.beginPath();
  c.moveTo(x2, y2);
  c.lineTo(x2 - headLen * Math.cos(ang - Math.PI / 7), y2 - headLen * Math.sin(ang - Math.PI / 7));
  c.lineTo(x2 - headLen * Math.cos(ang + Math.PI / 7), y2 - headLen * Math.sin(ang + Math.PI / 7));
  c.closePath();
  c.fill();
}

function drawRectShape(c, x1, y1, x2, y2, color, width) {
  c.strokeStyle = color; c.lineWidth = width;
  c.lineJoin = 'round';
  c.strokeRect(x1, y1, x2 - x1, y2 - y1);
}

function selectionRect(x1, y1, x2, y2) {
  // Dashed guide for blur / crop region selection.
  ctx.save();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Blur (pixelation)                                                   */
/* ------------------------------------------------------------------ */

function pixelateRegion(x, y, w, h) {
  if (w < 4 || h < 4) return;
  const blocks = 14; // fixed mosaic granularity
  const tmp = document.createElement('canvas');
  tmp.width = blocks; tmp.height = Math.max(1, Math.round(blocks * (h / w)));
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(board, x, y, w, h, 0, 0, tmp.width, tmp.height);
  ctx.save();
  ctx.imageSmoothingEnabled = false; // chunky pixels
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Crop                                                                */
/* ------------------------------------------------------------------ */

function cropTo(x, y, w, h) {
  if (w < 10 || h < 10) { toast('Drag a larger region to crop'); return; }
  const out = document.createElement('canvas');
  out.width = Math.round(w); out.height = Math.round(h);
  out.getContext('2d').drawImage(board, x, y, w, h, 0, 0, out.width, out.height);
  board.width = out.width; board.height = out.height;
  ctx.drawImage(out, 0, 0);
  // History snapshots no longer match the new dimensions — reset.
  state.history = [];
  state.base = ctx.getImageData(0, 0, board.width, board.height);
  toast('Cropped');
}

/* ------------------------------------------------------------------ */
/* Pointer interaction                                                 */
/* ------------------------------------------------------------------ */

board.addEventListener('pointerdown', (e) => {
  if (!state.imgSize.w) return;
  const p = toCanvas(e);

  if (state.tool === 'text') { openTextInput(e, p); return; }

  state.drawing = true;
  state.start = p;
  board.setPointerCapture(e.pointerId);

  if (state.tool === 'pen') {
    pushHistory();
    ctx.strokeStyle = state.color; ctx.fillStyle = state.color;
    ctx.lineWidth = state.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1); // dot on simple click
    ctx.stroke();
  } else {
    // Shape / region tools: snapshot for live preview, commit on pointerup.
    state.draft = ctx.getImageData(0, 0, board.width, board.height);
  }
});

board.addEventListener('pointermove', (e) => {
  if (!state.drawing || !state.start) return;
  const p = toCanvas(e);

  if (state.tool === 'pen') {
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    return;
  }
  // Restore the draft, then draw the live preview on top.
  ctx.putImageData(state.draft, 0, 0);
  const { x, y } = state.start;
  if (state.tool === 'arrow') drawArrow(ctx, x, y, p.x, p.y, state.color, state.width);
  else if (state.tool === 'rect') drawRectShape(ctx, x, y, p.x, p.y, state.color, state.width);
  else if (state.tool === 'blur' || state.tool === 'crop') selectionRect(x, y, p.x, p.y);
});

function endStroke(e) {
  if (!state.drawing) return;
  state.drawing = false;
  const p = toCanvas(e);
  const { x, y } = state.start;

  if (state.tool === 'pen') { state.start = null; return; }

  // Normalize region coordinates (drag may go any direction).
  const rx = Math.min(x, p.x), ry = Math.min(y, p.y);
  const rw = Math.abs(p.x - x), rh = Math.abs(p.y - y);
  ctx.putImageData(state.draft, 0, 0); // clear the preview overlay

  if (state.tool === 'arrow') {
    pushHistory();
    ctx.putImageData(state.draft, 0, 0);
    drawArrow(ctx, x, y, p.x, p.y, state.color, state.width);
  } else if (state.tool === 'rect') {
    pushHistory();
    ctx.putImageData(state.draft, 0, 0);
    drawRectShape(ctx, x, y, p.x, p.y, state.color, state.width);
  } else if (state.tool === 'blur') {
    if (rw >= 4 && rh >= 4) {
      pushHistory();
      pixelateRegion(rx, ry, rw, rh);
    }
  } else if (state.tool === 'crop') {
    cropTo(rx, ry, rw, rh);
  }
  state.start = null;
  state.draft = null;
}

board.addEventListener('pointerup', endStroke);
board.addEventListener('pointercancel', () => {
  if (state.draft) ctx.putImageData(state.draft, 0, 0);
  state.drawing = false; state.start = null; state.draft = null;
});

/* ------------------------------------------------------------------ */
/* Text labels                                                         */
/* ------------------------------------------------------------------ */

function openTextInput(e, p) {
  const r = board.getBoundingClientRect();
  const scaleX = r.width / board.width, scaleY = r.height / board.height;
  // Position the floating input where the user clicked (screen coords
  // relative to the canvas wrapper).
  textInput.style.left = (p.x * scaleX) + 'px';
  textInput.style.top = ((p.y * scaleY)) + 'px';
  textInput.style.color = state.color;
  textInput.value = '';
  textInput.dataset.x = p.x;
  textInput.dataset.y = p.y;
  textInput.classList.add('open');
  textInput.focus();
}

function commitText() {
  const raw = textInput.value.trim();
  textInput.classList.remove('open');
  if (!raw) return;
  pushHistory();
  const x = parseFloat(textInput.dataset.x), y = parseFloat(textInput.dataset.y);
  const fontSize = Math.max(18, state.width * 6);
  ctx.save();
  ctx.font = `700 ${fontSize}px -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = state.color;
  ctx.textBaseline = 'top';
  // Subtle dark outline so labels stay readable on any background.
  ctx.lineWidth = Math.max(2, fontSize / 10);
  ctx.strokeStyle = 'rgba(0,0,0,.65)';
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    const ly = y + i * fontSize * 1.25;
    ctx.strokeText(line, x, ly);
    ctx.fillText(line, x, ly);
  });
  ctx.restore();
}

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); textInput.blur(); }
  if (e.key === 'Escape') { textInput.classList.remove('open'); textInput.blur(); }
});
textInput.addEventListener('blur', () => {
  if (textInput.classList.contains('open')) commitText();
});

/* ------------------------------------------------------------------ */
/* Toolbar                                                             */
/* ------------------------------------------------------------------ */

document.querySelectorAll('.tool[data-tool]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tool[data-tool]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    board.style.cursor = state.tool === 'text' ? 'text' : 'crosshair';
  });
});

document.querySelectorAll('.swatch').forEach((sw) => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((s) => s.classList.remove('active'));
    sw.classList.add('active');
    state.color = sw.dataset.color;
  });
});

document.getElementById('widthRange').addEventListener('input', (e) => {
  state.width = parseInt(e.target.value, 10);
});

document.getElementById('undoBtn').addEventListener('click', () => {
  const prev = state.history.pop();
  if (prev) { ctx.putImageData(prev, 0, 0); toast('Undone'); }
  else toast('Nothing to undo');
});

document.getElementById('clearBtn').addEventListener('click', () => {
  if (!state.base) return;
  if (confirm('Remove all annotations and restore the original screenshot?')) {
    // Restore pristine dimensions too (a crop may have changed them).
    board.width = state.imgSize.w; board.height = state.imgSize.h;
    ctx.putImageData(state.base, 0, 0);
    state.history = [];
    toast('Annotations cleared');
  }
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  board.toBlob((blob) => {
    if (!blob) { toast('Export failed'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    a.download = `snapmark-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast('PNG downloaded');
  }, 'image/png');
});

// Keyboard shortcuts: V/P/A/R/T/B/C select tools, Ctrl/Cmd+Z undo.
document.addEventListener('keydown', (e) => {
  if (e.target === textInput) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    document.getElementById('undoBtn').click();
    return;
  }
  const map = { v: 'pen', p: 'pen', a: 'arrow', r: 'rect', t: 'text', b: 'blur', c: 'crop' };
  const tool = map[e.key.toLowerCase()];
  if (tool) document.querySelector(`.tool[data-tool="${tool}"]`).click();
});

/* ------------------------------------------------------------------ */
/* Init — load the captured screenshot                                 */
/* ------------------------------------------------------------------ */

(async function init() {
  try {
    const { snapmarkShot } = await chrome.storage.session.get('snapmarkShot');
    if (!snapmarkShot || !snapmarkShot.dataUrl) {
      document.getElementById('noShot').hidden = false;
      wrap.style.display = 'none';
      return;
    }
    // Remove it immediately so screenshots never linger in storage.
    await chrome.storage.session.remove('snapmarkShot');

    const img = new Image();
    img.onload = () => {
      board.width = img.naturalWidth;
      board.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);
      state.imgSize = { w: board.width, h: board.height };
      state.base = ctx.getImageData(0, 0, board.width, board.height);
      toast('Screenshot loaded — annotate away');
    };
    img.onerror = () => {
      document.getElementById('noShot').hidden = false;
      wrap.style.display = 'none';
    };
    img.src = snapmarkShot.dataUrl;
  } catch (err) {
    console.error('[SnapMark] editor init failed:', err);
    document.getElementById('noShot').hidden = false;
    wrap.style.display = 'none';
  }
})();
