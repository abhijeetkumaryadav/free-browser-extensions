// Clip Duration — Social Format Cutter
// Honest scope: trims an uploaded video to a chosen start/end range with
// optional social-length presets (15/30/60/90s). Does NOT reframe, crop, or
// change aspect ratio. Export uses MediaRecorder (re-encode; quality depends
// on browser codecs). 100% local — the file never leaves the machine.

const $ = (id) => document.getElementById(id);
let objectUrl = null;
let duration = 0;
let start = 0, end = 0;
let exporting = false;

function fmt(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

function clampRange() {
  start = Math.min(Math.max(0, start), duration);
  end = Math.min(Math.max(start, end), duration);
  if (end - start < 0.1) end = Math.min(duration, start + 0.1);
}

function syncUI() {
  clampRange();
  $('start').value = start;
  $('end').value = end;
  $('tStart').textContent = fmt(start);
  $('tEnd').textContent = fmt(end);
  $('tDur').textContent = fmt(end - start) + ' clip';
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('video/')) { $('dropLabel').textContent = 'Please choose a video file.'; return; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  const v = $('preview');
  v.src = objectUrl;
  $('dropLabel').textContent = file.name;
  $('download').classList.add('hidden');
  v.onloadedmetadata = () => {
    duration = v.duration || 0;
    $('start').max = duration; $('end').max = duration;
    start = 0; end = duration;
    $('editor').classList.remove('hidden');
    syncUI();
  };
}

$('file').addEventListener('change', (e) => loadFile(e.target.files[0]));
const drop = $('drop');
drop.addEventListener('dragover', (e) => e.preventDefault());
drop.addEventListener('drop', (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });

$('start').addEventListener('input', (e) => { start = Number(e.target.value); syncUI(); });
$('end').addEventListener('input', (e) => { end = Number(e.target.value); syncUI(); });

// Presets: keep the current start, snap the end to the preset length.
document.querySelectorAll('.pbtn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pbtn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const secs = Number(btn.dataset.sec);
    end = Math.min(duration, start + secs);
    syncUI();
  });
});

// Preview the chosen range in place.
$('playClip').addEventListener('click', () => {
  if (exporting) return;
  const v = $('preview');
  v.currentTime = start;
  v.muted = false;
  v.play();
  const stop = () => { if (v.currentTime >= end || v.ended) { v.pause(); v.removeEventListener('timeupdate', stop); } };
  v.addEventListener('timeupdate', stop);
});

// Export via MediaRecorder captureStream (real-time capture of the segment).
$('export').addEventListener('click', async () => {
  if (exporting) return;
  const v = $('preview');
  if (!v.captureStream) { alert('This browser does not support video stream capture.'); return; }
  exporting = true;
  $('progress').classList.remove('hidden');
  $('download').classList.add('hidden');

  v.muted = false;
  v.currentTime = start;
  await new Promise((r) => { v.onseeked = r; setTimeout(r, 500); });

  const stream = v.captureStream();
  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '');
  const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.start(200);

  const segLen = end - start;
  v.play();
  const t0 = performance.now();
  const tick = setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / (segLen * 1000));
    $('bar').style.width = Math.round(p * 100) + '%';
    if (p >= 1 || v.ended) {
      clearInterval(tick);
      rec.stop();
    }
  }, 100);

  rec.onstop = () => {
    const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const dl = $('download');
    dl.href = url;
    dl.download = 'clip_' + Math.round(end - start) + 's.webm';
    dl.textContent = 'Download clip (' + (blob.size / 1048576).toFixed(1) + ' MB)';
    dl.classList.remove('hidden');
    $('progress').classList.add('hidden');
    exporting = false;
  };
});
