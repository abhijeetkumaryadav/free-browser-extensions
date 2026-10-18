/* In-Browser Video Splitter — popup logic.
   Upload -> set start/end -> preview loop -> export by playing the segment
   through a canvas captureStream into MediaRecorder. All client-side. */
'use strict';

const $ = id => document.getElementById(id);
const fileInput = $('file'), video = $('video');
const startR = $('start'), endR = $('end');
const startT = $('start-t'), endT = $('end-t');
const formatSel = $('format'), previewBtn = $('preview'), exportBtn = $('export');
const statusEl = $('status'), progressEl = $('progress'), progressBar = progressEl.querySelector('div');
const downloadA = $('download');

let duration = 0;
let objectUrl = null;
let exporting = false;

/** Format seconds -> m:ss.t */
function fmt(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
}

function clampRange() {
  let s = parseFloat(startR.value);
  let e = parseFloat(endR.value);
  if (s > e - 0.2) {
    if (document.activeElement === startR) startR.value = (e - 0.2).toFixed(1);
    else endR.value = (s + 0.2).toFixed(1);
  }
  startT.textContent = fmt(parseFloat(startR.value));
  endT.textContent = fmt(parseFloat(endR.value));
}

function pctToSec(p) { return (p / 100) * duration; }

fileInput.addEventListener('change', () => {
  const f = fileInput.files[0];
  if (!f) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(f);
  video.src = objectUrl;
  video.muted = true;
  status('Loading video…');
  previewBtn.disabled = true;
  exportBtn.disabled = true;
  downloadA.style.display = 'none';
});

video.addEventListener('loadedmetadata', () => {
  duration = video.duration || 0;
  if (!isFinite(duration) || duration <= 0) {
    status('Could not read this video file.');
    return;
  }
  startR.value = 0;
  endR.value = 100;
  clampRange();
  previewBtn.disabled = false;
  exportBtn.disabled = false;
  status(`Ready — ${fmt(duration)} loaded. Set start/end, then export.`);
});

startR.addEventListener('input', () => { clampRange(); seekPreview(); });
endR.addEventListener('input', clampRange);

/** Scrub video to start point while dragging (pause preview first). */
function seekPreview() {
  if (exporting || !duration) return;
  try { video.currentTime = pctToSec(parseFloat(startR.value)); } catch (_) { /* ignore */ }
}

// Preview loop: play from start to end repeatedly.
let previewTimer = null;
previewBtn.addEventListener('click', () => {
  if (!duration || exporting) return;
  if (previewTimer) {
    clearInterval(previewTimer);
    previewTimer = null;
    video.pause();
    previewBtn.textContent = 'Preview clip';
    return;
  }
  const s = pctToSec(parseFloat(startR.value));
  const e = pctToSec(parseFloat(endR.value));
  video.currentTime = s;
  video.play().catch(() => status('Preview playback blocked by the browser.'));
  previewTimer = setInterval(() => {
    if (video.currentTime >= e || video.ended) video.currentTime = s;
  }, 100);
  previewBtn.textContent = 'Stop preview';
});

/** Export: draw video frames to canvas, captureStream -> MediaRecorder. */
exportBtn.addEventListener('click', async () => {
  if (!duration || exporting) return;
  const mime = formatSel.value;
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(mime)) {
    status(`This browser cannot record ${mime}. Try the other format.`);
    return;
  }
  exporting = true;
  exportBtn.disabled = true;
  previewBtn.disabled = true;
  downloadA.style.display = 'none';

  const s = pctToSec(parseFloat(startR.value));
  const e = pctToSec(parseFloat(endR.value));
  const len = Math.max(0.2, e - s);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
    const chunks = [];
    rec.ondataavailable = ev => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    const done = new Promise(resolve => { rec.onstop = resolve; });

    video.currentTime = s;
    await new Promise(r => { video.onseeked = r; setTimeout(r, 1500); });
    rec.start(250);
    video.play().catch(() => {});
    progressEl.style.display = 'block';

    // Draw frames until the end point is reached.
    await new Promise(resolve => {
      const tick = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const donePct = Math.min(1, (video.currentTime - s) / len);
        progressBar.style.width = (donePct * 100).toFixed(1) + '%';
        if (video.currentTime >= e || video.ended) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // Safety cap: never run longer than the clip + 5s.
      setTimeout(resolve, (len + 5) * 1000);
    });

    video.pause();
    rec.stop();
    await done;

    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    const url = URL.createObjectURL(blob);
    downloadA.href = url;
    downloadA.download = `clip-${Date.now()}.${ext}`;
    downloadA.style.display = '';
    downloadA.textContent = `Download clip (${(blob.size / 1048576).toFixed(1)} MB)`;
    progressBar.style.width = '100%';
    statusEl.classList.add('done');
    status(`Export complete — re-encoded via MediaRecorder (${ext.toUpperCase()}).`);
  } catch (err) {
    status('Export failed: ' + (err && err.message ? err.message : err));
  } finally {
    exporting = false;
    exportBtn.disabled = false;
    previewBtn.disabled = false;
  }
});

function status(t) {
  statusEl.classList.remove('done');
  statusEl.textContent = t;
}
