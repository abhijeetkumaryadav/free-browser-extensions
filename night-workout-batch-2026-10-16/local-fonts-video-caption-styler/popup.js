/* Caption Styler — popup logic.
 * Uploads a video + optional SRT, styles captions with installed system fonts,
 * previews on canvas, and burns captions in via canvas capture + MediaRecorder.
 * All local. Uses only fonts installed on the device — never downloads fonts. */
'use strict';

// ---------- system font list ----------
// Locally curated list of commonly installed fonts; we test each with a
// canvas width probe and only list fonts actually installed on this device.
const CANDIDATE_FONTS = [
  'Arial','Helvetica','Verdana','Tahoma','Trebuchet MS','Georgia','Times New Roman',
  'Courier New','Impact','Comic Sans MS','Palatino','Garamond','Book Antiqua',
  'Segoe UI','Calibri','Cambria','Consolas','Candara','Corbel','Constantia',
  'Roboto','Open Sans','Lato','Montserrat','Inter','Helvetica Neue','SF Pro Text',
  'Noto Sans','DejaVu Sans','Liberation Sans','Ubuntu','Droid Sans','Noto Serif',
  'DejaVu Serif','Liberation Serif','Arial Black','Franklin Gothic Medium',
  'Gill Sans','Futura','Optima','Baskerville','Didot','Menlo','Monaco','Source Code Pro',
  'Noto Sans CJK SC','Noto Sans CJK JP','SimHei','Microsoft YaHei','PingFang SC'
];

// ---------- state ----------
const state = {
  videoURL: null,
  cues: [],            // {start,end,text} in seconds
  burnPreview: false,
  style: { font:'Arial', size:34, textColor:'#ffffff', bgColor:'#000000', bgOn:true, pos:'bottom', outWidth:720 }
};

// ---------- dom ----------
const $ = id => document.getElementById(id);
const videoEl = $('previewVideo'), canvas = $('burnCanvas'), ctx = canvas.getContext('2d');

// ---------- settings ----------
async function loadSettings() {
  try {
    const s = await chrome.storage.local.get(['captionStyle']);
    if (s.captionStyle) Object.assign(state.style, s.captionStyle);
  } catch (e) { /* storage unavailable — use defaults */ }
  $('fontSize').value = state.style.size;
  $('fontSizeVal').textContent = state.style.size + 'px';
  $('textColor').value = state.style.textColor;
  $('bgColor').value = state.style.bgColor;
  $('bgOn').checked = state.style.bgOn;
  $('position').value = state.style.pos;
  $('outWidth').value = state.style.outWidth;
  $('outWidthVal').textContent = state.style.outWidth + 'px';
}
function saveSettings() {
  chrome.storage.local.set({ captionStyle: state.style }).catch(() => {});
}

// ---------- font probing ----------
function fontAvailable(name) {
  // Compare rendered width of a test string against generic fallbacks.
  const probe = document.createElement('canvas').getContext('2d');
  const test = 'mmmmmmmmmmlli';
  probe.font = '72px monospace';
  const base = probe.measureText(test).width;
  probe.font = `72px "${name}", monospace`;
  return probe.measureText(test).width !== base;
}
function buildFontList() {
  const sel = $('fontFamily');
  const found = CANDIDATE_FONTS.filter(fontAvailable);
  const list = found.length ? found : ['Arial', 'sans-serif'];
  list.forEach(f => {
    const o = document.createElement('option');
    o.value = f; o.textContent = f; o.style.fontFamily = `"${f}", sans-serif`;
    sel.appendChild(o);
  });
  if (list.includes(state.style.font)) sel.value = state.style.font;
  else { sel.value = list[0]; state.style.font = list[0]; }
}

// ---------- SRT parsing ----------
function tsToSec(ts) {
  // 00:00:01,000 -> seconds (float)
  const m = ts.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10), mi = parseInt(m[2], 10),
        s = parseInt(m[3], 10), ms = parseInt(m[4].padEnd(3, '0'), 10);
  return h * 3600 + mi * 60 + s + ms / 1000;
}
function parseSRT(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\s*\n/);
  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find(l => l.includes('-->'));
    if (!timeLine) continue;
    const parts = timeLine.split('-->');
    const start = tsToSec(parts[0]), end = tsToSec(parts[1]);
    if (start == null || end == null) continue;
    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    const clean = textLines.join('\n').replace(/<[^>]*>/g, '');
    cues.push({ start, end, text: clean });
  }
  cues.sort((a, b) => a.start - b.start);
  return cues;
}
function cueAt(t) {
  return state.cues.find(c => t >= c.start && t <= c.end) || null;
}

// ---------- inputs ----------
function bindInputs() {
  $('videoFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    if (state.videoURL) URL.revokeObjectURL(state.videoURL);
    state.videoURL = URL.createObjectURL(f);
    videoEl.src = state.videoURL;
  });
  const loadSRTText = txt => {
    state.cues = parseSRT(txt);
    $('cueHint').textContent = state.cues.length
      ? `${state.cues.length} captions loaded.` : 'No valid cues found in that SRT.';
  };
  $('srtFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => loadSRTText(r.result);
    r.readAsText(f);
  });
  $('srtText').addEventListener('change', e => loadSRTText(e.target.value));

  $('fontFamily').addEventListener('change', e => { state.style.font = e.target.value; saveSettings(); });
  $('fontSize').addEventListener('input', e => {
    state.style.size = +e.target.value;
    $('fontSizeVal').textContent = e.target.value + 'px'; saveSettings();
  });
  $('textColor').addEventListener('input', e => { state.style.textColor = e.target.value; saveSettings(); });
  $('bgColor').addEventListener('input', e => { state.style.bgColor = e.target.value; saveSettings(); });
  $('bgOn').addEventListener('change', e => { state.style.bgOn = e.target.checked; saveSettings(); });
  $('position').addEventListener('change', e => { state.style.pos = e.target.value; saveSettings(); });
  $('outWidth').addEventListener('input', e => {
    state.style.outWidth = +e.target.value;
    $('outWidthVal').textContent = e.target.value + 'px'; saveSettings();
  });
  $('manualCaption').addEventListener('input', () => {});
}

// ---------- caption drawing ----------
function drawCaption(c, text, vw, vh) {
  const st = state.style;
  c.clearRect(0, 0, vw, vh);
  if (!text) return;
  const size = st.size * (vw / 720); // scale with export width
  c.font = `${size}px "${st.font}", sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const lines = text.split('\n');
  const lineH = size * 1.25;
  const blockH = lines.length * lineH;
  let cy = st.pos === 'top' ? vh * 0.12 + blockH / 2
         : st.pos === 'center' ? vh / 2
         : vh * 0.88 - blockH / 2;
  if (st.bgOn) {
    const maxW = Math.max(...lines.map(l => c.measureText(l).width));
    c.fillStyle = st.bgColor;
    c.globalAlpha = 0.75;
    c.fillRect(vw / 2 - maxW / 2 - 12, cy - blockH / 2 - 8, maxW + 24, blockH + 16);
    c.globalAlpha = 1;
  }
  c.fillStyle = st.textColor;
  lines.forEach((l, i) => c.fillText(l, vw / 2, cy - blockH / 2 + lineH * (i + 0.5)));
}

// Live preview loop: draws current cue (or manual caption) over the video.
function fitCanvasToVideo() {
  const w = videoEl.videoWidth || 720, h = videoEl.videoHeight || 405;
  canvas.width = w; canvas.height = h;
}
function previewLoop() {
  if (state.burnPreview && videoEl.videoWidth) {
    fitCanvasToVideo();
    const cue = cueAt(videoEl.currentTime);
    const text = cue ? cue.text : ($('manualCaption').value || '');
    drawCaption(ctx, text, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(previewLoop);
}

// ---------- export ----------
function pickMime() {
  const cands = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return cands.find(m => MediaRecorder.isTypeSupported(m)) || '';
}
$('exportBtn').addEventListener('click', async () => {
  if (!videoEl.src) { $('progressText').textContent = 'Upload a video first.'; return; }
  const btn = $('exportBtn');
  btn.disabled = true;
  $('progressWrap').hidden = false;
  $('downloadLink').hidden = true;
  try {
    // Offscreen render at chosen width, keeping aspect ratio.
    const srcW = videoEl.videoWidth || 720, srcH = videoEl.videoHeight || 405;
    const W = state.style.outWidth, H = Math.round(W * srcH / srcW);
    const oc = document.createElement('canvas');
    oc.width = W; oc.height = H;
    const octx = oc.getContext('2d');
    const v = document.createElement('video');
    v.src = videoEl.src; v.muted = true; v.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = rej; });

    const mime = pickMime();
    const stream = oc.captureStream(30);
    // Note: audio is not carried through canvas capture; export is video-only.
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise(res => { rec.onstop = res; });
    rec.start(250);

    const dur = v.duration || 1;
    const t0 = performance.now();
    await v.play().catch(() => {});
    await new Promise(resolve => {
      const tick = () => {
        if (v.ended || v.paused) return resolve();
        octx.drawImage(v, 0, 0, W, H);
        const cue = cueAt(v.currentTime);
        drawCaption(octx, cue ? cue.text : '', W, H);
        const p = Math.min(100, (v.currentTime / dur) * 100);
        $('progressBar').style.width = p + '%';
        $('progressText').textContent = `Burning captions… ${Math.round(p)}%`;
        requestAnimationFrame(tick);
      };
      tick();
    });
    // Safety: ensure at least realtime elapsed before stopping.
    const elapsed = performance.now() - t0;
    if (elapsed < dur * 1000) await new Promise(r => setTimeout(r, dur * 1000 - elapsed));
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: mime || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const dl = $('downloadLink');
    dl.href = url;
    dl.download = 'captioned.webm';
    dl.hidden = false;
    $('progressText').textContent = 'Done — video-only export (audio not carried through canvas capture).';
    $('progressBar').style.width = '100%';
  } catch (err) {
    $('progressText').textContent = 'Export failed: ' + err.message;
  } finally {
    btn.disabled = false;
  }
});
$('toggleBurn').addEventListener('click', () => {
  state.burnPreview = !state.burnPreview;
  $('toggleBurn').textContent = state.burnPreview ? 'Stop caption preview' : 'Live caption preview';
});
videoEl.addEventListener('loadedmetadata', fitCanvasToVideo);

// ---------- init ----------
(async function init() {
  await loadSettings();
  buildFontList();
  bindInputs();
  previewLoop();
})();
