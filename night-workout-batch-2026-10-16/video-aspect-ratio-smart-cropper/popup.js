/**
 * popup.js — Aspect Crop Studio.
 *
 * Flow:
 *  1. User picks a local video file (drop or file picker).
 *  2. We show a preview canvas with a draggable crop box. The default box
 *     is the largest centered rectangle of the target aspect ("smart"
 *     default) — the user can drag it and shrink it with the slider.
 *  3. Export plays the video through an offscreen canvas sized to the crop
 *     region and records it with MediaRecorder → WebM download.
 *
 * Honest limits: export is VIDEO ONLY (canvas.captureStream carries no
 * audio track) and re-encodes via the browser's MediaRecorder codecs.
 */

const $ = (id) => document.getElementById(id);

// ---------- DOM ----------
const uploadCard = $('uploadCard');
const editorCard = $('editorCard');
const dropzone = $('dropzone');
const fileInput = $('fileInput');
const stage = $('stage');
const ctx = stage.getContext('2d');
const video = $('video');
const previewBtn = $('previewBtn');
const zoomSlider = $('zoomSlider');
const cropInfo = $('cropInfo');
const exportBtn = $('exportBtn');
const newBtn = $('newBtn');
const progressWrap = $('progressWrap');
const progressFill = $('progressFill');
const progressLabel = $('progressLabel');
const downloadLink = $('downloadLink');
const errorEl = $('error');

// ---------- state (all in source-video pixels) ----------
const state = {
  objectUrl: null,
  vw: 0,            // video width
  vh: 0,            // video height
  aspect: 9 / 16,   // target aspect w/h
  cx: 0, cy: 0,     // crop center
  cw: 0, ch: 0,     // crop size
  zoom: 1,          // 0.2..1 shrink factor from the slider
  dragging: false,
  exporting: false,
};

const ACCENT = '#f59e0b';
const MAX_STAGE_W = 340;
const MAX_STAGE_H = 230;

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = '';
}

/**
 * Compute the largest centered crop box of the target aspect, then apply
 * the user's zoom shrink factor. Keeps the box inside the video.
 */
function recomputeCrop(keepCenter) {
  const { vw, vh, aspect, zoom } = state;
  let cw = vw;
  let ch = vw / aspect;
  if (ch > vh) { ch = vh; cw = vh * aspect; }
  cw *= zoom; ch *= zoom;
  state.cw = cw; state.ch = ch;
  if (!keepCenter) { state.cx = vw / 2; state.cy = vh / 2; }
  clampCenter();
}

/** Keep the crop center so the whole box stays inside the video. */
function clampCenter() {
  const { vw, vh, cw, ch } = state;
  state.cx = Math.min(Math.max(state.cx, cw / 2), vw - cw / 2);
  state.cy = Math.min(Math.max(state.cy, ch / 2), vh - ch / 2);
}

/** Fit the stage canvas to the video while capping its display size. */
function sizeStage() {
  const scale = Math.min(MAX_STAGE_W / state.vw, MAX_STAGE_H / state.vh, 1);
  stage.width = Math.round(state.vw * scale);
  stage.height = Math.round(state.vh * scale);
  stage._scale = scale; // display px per source px
}

/** Paint the current video frame plus dimmed surround + crop rectangle. */
function draw() {
  if (!state.vw) return;
  const s = stage._scale || 1;
  const dw = stage.width, dh = stage.height;
  ctx.clearRect(0, 0, dw, dh);
  try {
    ctx.drawImage(video, 0, 0, dw, dh);
  } catch (e) { /* video not ready yet */ }

  const x = (state.cx - state.cw / 2) * s;
  const y = (state.cy - state.ch / 2) * s;
  const w = state.cw * s;
  const h = state.ch * s;

  // Dim everything outside the crop box.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, dw, y);
  ctx.fillRect(0, y + h, dw, dh - y - h);
  ctx.fillRect(0, y, x, h);
  ctx.fillRect(x + w, y, dw - x - w, h);

  // Amber crop border + corner ticks.
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  const tick = Math.min(18, w / 4, h / 4);
  ctx.lineWidth = 3;
  ctx.beginPath();
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]
    .forEach(([px, py, dx, dy]) => {
      ctx.moveTo(px + dx * tick, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + dy * tick);
    });
  ctx.stroke();

  cropInfo.textContent =
    Math.round(state.cw) + ' × ' + Math.round(state.ch) + ' px crop → ' +
    (state.aspect >= 1 ? state.aspect.toFixed(2) : '1:' + (1 / state.aspect).toFixed(2));
}

// ---------- pointer dragging (move the crop box) ----------
function stagePoint(event) {
  const rect = stage.getBoundingClientRect();
  const s = stage._scale || 1;
  return {
    x: (event.clientX - rect.left) / s,
    y: (event.clientY - rect.top) / s
  };
}
function insideCrop(p) {
  return Math.abs(p.x - state.cx) <= state.cw / 2 &&
         Math.abs(p.y - state.cy) <= state.ch / 2;
}
stage.addEventListener('pointerdown', (event) => {
  if (state.exporting) return;
  const p = stagePoint(event);
  if (insideCrop(p)) {
    state.dragging = true;
    stage.setPointerCapture(event.pointerId);
  }
});
stage.addEventListener('pointermove', (event) => {
  if (!state.dragging || state.exporting) return;
  const p = stagePoint(event);
  state.cx = p.x; state.cy = p.y;
  clampCenter();
  draw();
});
stage.addEventListener('pointerup', () => { state.dragging = false; });
stage.addEventListener('pointercancel', () => { state.dragging = false; });

// ---------- controls ----------
document.querySelectorAll('.btn.aspect').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn.aspect').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.aspect = Number(btn.dataset.w) / Number(btn.dataset.h);
    state.zoom = 1;
    zoomSlider.value = 100;
    recomputeCrop(false);
    draw();
  });
});

zoomSlider.addEventListener('input', () => {
  state.zoom = Number(zoomSlider.value) / 100;
  recomputeCrop(true);
  draw();
});

previewBtn.addEventListener('click', () => {
  if (video.paused) { video.play(); previewBtn.textContent = 'Pause preview'; }
  else { video.pause(); previewBtn.textContent = 'Play preview'; }
});
video.addEventListener('play', () => {
  const loop = () => { if (!video.paused && !state.exporting) { draw(); requestAnimationFrame(loop); } };
  requestAnimationFrame(loop);
});
video.addEventListener('seeked', draw);

// ---------- file loading ----------
function loadFile(file) {
  clearError();
  if (!file || !file.type.startsWith('video/')) {
    showError('Please choose a video file.');
    return;
  }
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  video.src = state.objectUrl;
  video.load();
}

video.addEventListener('loadedmetadata', () => {
  state.vw = video.videoWidth;
  state.vh = video.videoHeight;
  if (!state.vw || !state.vh) { showError('Could not read this video.'); return; }
  state.aspect = 9 / 16; // default to the active button
  state.zoom = 1;
  zoomSlider.value = 100;
  recomputeCrop(false);
  sizeStage();
  uploadCard.hidden = true;
  editorCard.hidden = false;
  downloadLink.hidden = true;
  // Seek slightly in so the first frame paints on the stage.
  video.currentTime = Math.min(0.1, (video.duration || 1) / 2);
});

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
['dragover', 'dragenter'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('over'); }));
['dragleave', 'drop'].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('over'); }));
dropzone.addEventListener('drop', (e) => loadFile(e.dataTransfer.files[0]));

newBtn.addEventListener('click', () => {
  video.pause();
  video.removeAttribute('src');
  video.load();
  editorCard.hidden = true;
  uploadCard.hidden = false;
  fileInput.value = '';
});

// ---------- export ----------
function pickMimeType() {
  for (const mime of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

exportBtn.addEventListener('click', async () => {
  clearError();
  if (state.exporting) return;
  if (!isFinite(video.duration) || video.duration <= 0) {
    showError('This video has no readable duration, so it cannot be exported.');
    return;
  }
  state.exporting = true;
  exportBtn.disabled = true;
  downloadLink.hidden = true;
  progressWrap.hidden = false;
  progressFill.style.width = '0%';
  progressLabel.textContent = 'Exporting… 0%';

  // Output canvas = crop region (long side capped at 1920 for sanity).
  const cap = 1920 / Math.max(state.cw, state.ch);
  const outScale = Math.min(1, cap);
  const outW = Math.max(2, Math.round(state.cw * outScale));
  const outH = Math.max(2, Math.round(state.ch * outScale));
  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const octx = out.getContext('2d');

  const sx = state.cx - state.cw / 2;
  const sy = state.cy - state.ch / 2;

  const mimeType = pickMimeType();
  const recStream = out.captureStream(30);
  let recorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(recStream, { mimeType, videoBitsPerSecond: 8000000 })
      : new MediaRecorder(recStream);
  } catch (e) {
    showError('MediaRecorder failed: ' + ((e && e.message) || e));
    state.exporting = false;
    exportBtn.disabled = false;
    progressWrap.hidden = true;
    return;
  }

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start(500);

  // Play through once, painting the cropped region every frame.
  video.pause();
  video.currentTime = 0;
  await new Promise((resolve) => {
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    setTimeout(resolve, 1500); // never hang on an unseekable file
  });
  video.play();

  await new Promise((resolve) => {
    const paint = () => {
      if (!state.exporting) { resolve(); return; }
      try {
        octx.drawImage(video, sx, sy, state.cw, state.ch, 0, 0, outW, outH);
      } catch (e) { /* frame not ready */ }
      const pct = Math.min(99, Math.round((video.currentTime / video.duration) * 100));
      progressFill.style.width = pct + '%';
      progressLabel.textContent = 'Exporting… ' + pct + '%';
      if (video.ended || video.currentTime >= video.duration - 0.05) { resolve(); return; }
      requestAnimationFrame(paint);
    };
    const onEnded = () => { video.removeEventListener('ended', onEnded); resolve(); };
    video.addEventListener('ended', onEnded);
    requestAnimationFrame(paint);
    // Safety timeout: duration + 30s headroom.
    setTimeout(resolve, (video.duration + 30) * 1000);
  });

  video.pause();
  try { recorder.stop(); } catch (e) { /* already stopped */ }
  await done;
  recStream.getTracks().forEach((t) => { try { t.stop(); } catch (e) {} });

  const blob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  downloadLink.href = url;
  downloadLink.download = 'cropped-' + outW + 'x' + outH + '.webm';
  downloadLink.hidden = false;
  progressFill.style.width = '100%';
  progressLabel.textContent = 'Done — ' + (blob.size / 1048576).toFixed(1) + ' MB WebM (video only).';
  state.exporting = false;
  exportBtn.disabled = false;
});
