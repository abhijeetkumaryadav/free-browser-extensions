'use strict';
/* Pacing Timer — heuristic shot-boundary counter.
   Scene "detection" = average-luminance delta between sampled frames (canvas).
   Labeled in the UI as a heuristic, NOT AI shot detection. */

const $ = (id) => document.getElementById(id);
const vid = $('vid'), stageEmpty = $('stageEmpty'), fileInput = $('file');
const markersEl = $('markers'), shotList = $('shotList');
const tapBtn = $('tapMark'), autoBtn = $('autoDetect'), clearBtn = $('clearAll');
const sensInput = $('sensitivity'), sensVal = $('sensVal'), stepSel = $('sampleStep');
const sampler = $('sampler'), sctx = sampler.getContext('2d', { willReadFrequently: true });

let boundaries = [];   // sorted array of boundary times (seconds)
let detecting = false;

/* ---------- settings (persisted) ---------- */
chrome.storage.local.get({ sensitivity: 25, sampleStep: '0.25' }, (s) => {
  sensInput.value = s.sensitivity;
  sensVal.textContent = s.sensitivity;
  stepSel.value = s.sampleStep;
});
sensInput.addEventListener('input', () => {
  sensVal.textContent = sensInput.value;
  chrome.storage.local.set({ sensitivity: +sensInput.value });
});
stepSel.addEventListener('change', () => chrome.storage.local.set({ sampleStep: stepSel.value }));

/* ---------- video loading ---------- */
function loadFile(f) {
  if (!f) return;
  if (vid.src) URL.revokeObjectURL(vid.src);
  vid.src = URL.createObjectURL(f);
  vid.style.display = 'block';
  stageEmpty.style.display = 'none';
  boundaries = [0];
  vid.onloadedmetadata = () => { render(); };
  tapBtn.disabled = autoBtn.disabled = clearBtn.disabled = false;
}
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
document.querySelector('.stage').addEventListener('dragover', (e) => e.preventDefault());
document.querySelector('.stage').addEventListener('drop', (e) => {
  e.preventDefault();
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('video/'));
  if (f) loadFile(f);
});

/* ---------- markers ---------- */
function addBoundary(t, src) {
  t = Math.max(0, Math.min(t, vid.duration || t));
  if (boundaries.some((b) => Math.abs(b - t) < 0.3)) return; // dedupe 0.3s
  boundaries.push(t);
  boundaries.sort((a, b) => a - b);
  render();
}

function removeBoundary(t) {
  if (t === 0) return; // keep start anchor
  boundaries = boundaries.filter((b) => b !== t);
  render();
}

tapBtn.addEventListener('click', () => addBoundary(vid.currentTime));
document.addEventListener('keydown', (e) => {
  if ((e.key === 'm' || e.key === 'M') && !tapBtn.disabled) addBoundary(vid.currentTime);
});
clearBtn.addEventListener('click', () => { boundaries = [0]; render(); });

/* ---------- heuristic auto-detection ---------- */
function seekTo(t) {
  return new Promise((res) => {
    const h = () => { vid.removeEventListener('seeked', h); res(); };
    vid.addEventListener('seeked', h);
    vid.currentTime = Math.min(t, (vid.duration || 1) - 0.05);
  });
}

function sampleLuminance() {
  const w = sampler.width, h = sampler.height;
  sctx.drawImage(vid, 0, 0, w, h);
  const d = sctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4)
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4) / 255; // 0..1
}

autoBtn.addEventListener('click', async () => {
  if (detecting || !vid.duration) return;
  detecting = true;
  autoBtn.disabled = true;
  autoBtn.textContent = 'Scanning…';
  vid.pause();
  const step = parseFloat(stepSel.value);
  const thresh = (+sensInput.value) / 100;
  const found = [0];
  let prev = null;
  try {
    for (let t = 0; t < vid.duration && detecting; t += step) {
      await seekTo(t);
      const lum = sampleLuminance();
      if (prev !== null && Math.abs(lum - prev) > thresh) found.push(t);
      prev = lum;
    }
  } catch (err) { /* video seek hiccup — keep what we have */ }
  boundaries = found;
  detecting = false;
  autoBtn.disabled = false;
  autoBtn.innerHTML = 'Auto-detect';
  render();
});

/* ---------- rendering ---------- */
function fmt(t) {
  const m = Math.floor(t / 60), s = (t % 60);
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function shots() {
  const dur = vid.duration || 0;
  const pts = [...boundaries];
  if (dur && (pts.length === 1 || pts[pts.length - 1] < dur - 0.05)) pts.push(dur);
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pts[i + 1] - pts[i];
    if (d >= 0.05) out.push({ start: pts[i], end: pts[i + 1], dur: d });
  }
  return out;
}

function render() {
  const dur = vid.duration || 0;
  // markers overlay
  markersEl.innerHTML = '';
  if (dur) for (const b of boundaries) {
    if (b <= 0) continue;
    const i = document.createElement('i');
    i.style.left = (b / dur * 100) + '%';
    i.title = fmt(b);
    markersEl.appendChild(i);
  }
  // stats + list
  const s = shots();
  $('stats').hidden = s.length === 0;
  if (s.length) {
    const ds = s.map((x) => x.dur);
    $('shotCount').textContent = s.length;
    $('avgShot').textContent = fmt(ds.reduce((a, b) => a + b, 0) / ds.length);
    $('minShot').textContent = fmt(Math.min(...ds));
    $('maxShot').textContent = fmt(Math.max(...ds));
  }
  shotList.innerHTML = '';
  if (!s.length) {
    shotList.innerHTML = '<p class="empty-note">No shots yet — tap <b>Mark boundary</b> while watching, or run <b>Auto-detect</b>.</p>';
    return;
  }
  s.forEach((sh, i) => {
    const row = document.createElement('div');
    row.className = 'shot';
    row.innerHTML = `<span class="idx">${i + 1}</span>
      <span class="range">${fmt(sh.start)} → ${fmt(sh.end)}</span>
      <span class="dur">${sh.dur.toFixed(1)}s</span>`;
    const del = document.createElement('button');
    del.className = 'del';
    del.title = 'Remove boundary';
    del.textContent = '×';
    del.addEventListener('click', () => removeBoundary(sh.start));
    row.appendChild(del);
    shotList.appendChild(row);
  });
}
