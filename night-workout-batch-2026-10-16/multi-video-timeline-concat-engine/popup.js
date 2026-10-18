/* Video Joiner — sequential re-encode of uploaded clips via canvas + MediaRecorder.
   All local: files never leave the machine. Output is video+audio WebM. */

const $ = (id) => document.getElementById(id);
const clips = [];            // { file, url, name, duration }
let joining = false;

$('drop').addEventListener('click', () => $('files').click());
$('drop').addEventListener('dragover', (e) => e.preventDefault());
$('drop').addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
$('files').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

/* ---------- clip management ---------- */
function addFiles(list) {
  for (const f of list) {
    if (!f.type.startsWith('video/')) { showErr(`Skipped non-video file: ${f.name}`); continue; }
    const url = URL.createObjectURL(f);
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = url;
    probe.onloadedmetadata = () => {
      clips.push({ file: f, url, name: f.name, duration: probe.duration || 0 });
      render();
    };
    probe.onerror = () => showErr(`Could not read: ${f.name}`);
  }
}

function render() {
  const tl = $('timeline');
  tl.innerHTML = '';
  clips.forEach((c, i) => {
    const li = document.createElement('li');
    li.className = 'clip';
    li.innerHTML = `
      <span class="idx">${i + 1}</span>
      <div class="meta"><div class="name"></div><div class="dur">${fmtTime(c.duration)}</div></div>
      <button title="Move up" data-a="up">▲</button>
      <button title="Move down" data-a="down">▼</button>
      <button title="Remove" class="rm" data-a="rm">✕</button>`;
    li.querySelector('.name').textContent = c.name;
    li.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.a;
      if (a === 'rm') { URL.revokeObjectURL(c.url); clips.splice(i, 1); }
      else if (a === 'up' && i > 0) [clips[i - 1], clips[i]] = [clips[i], clips[i - 1]];
      else if (a === 'down' && i < clips.length - 1) [clips[i + 1], clips[i]] = [clips[i], clips[i + 1]];
      render();
    }));
    tl.appendChild(li);
  });
  $('join').disabled = clips.length === 0 || joining;
}

$('clear').addEventListener('click', () => {
  clips.forEach((c) => URL.revokeObjectURL(c.url));
  clips.length = 0;
  render();
});

function fmtTime(s) {
  if (!isFinite(s)) return '—';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function showErr(m) { $('err').textContent = m; }

/* ---------- join: sequential re-encode ---------- */
$('join').addEventListener('click', async () => {
  if (joining || clips.length === 0) return;
  joining = true; showErr('');
  $('join').disabled = true;
  $('download').classList.add('hidden');
  $('progressWrap').classList.remove('hidden');

  try {
    const blob = await joinClips();
    const url = URL.createObjectURL(blob);
    const a = $('download');
    a.href = url;
    a.download = 'joined.webm';
    a.classList.remove('hidden');
    setStatus('Done — click to download.');
  } catch (e) {
    showErr('Join failed: ' + (e && e.message ? e.message : e));
    setStatus('Failed.');
  } finally {
    joining = false;
    $('join').disabled = clips.length === 0;
  }
});

function setStatus(t) { $('status').textContent = t; }
function setBar(p) { $('bar').style.width = Math.min(100, Math.max(0, p * 100)) + '%'; }

async function joinClips() {
  const mime = pickMime();
  // Canvas sized to the largest clip (16px-aligned).
  const sizes = await Promise.all(clips.map(probeSize));
  const W = Math.max(...sizes.map((s) => s.w));
  const H = Math.max(...sizes.map((s) => s.h));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const vStream = canvas.captureStream(30);
  // Route each clip's audio through one AudioContext so the output keeps sound.
  const actx = new AudioContext();
  const dest = actx.createMediaStreamDestination();
  const combined = new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const rec = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise((res, rej) => { rec.onstop = res; rec.onerror = rej; });
  rec.start(250);

  const total = clips.reduce((a, c) => a + c.duration, 0);
  let elapsed = 0;
  const video = $('loader');
  let srcNode = null;

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    setStatus(`Encoding clip ${i + 1} of ${clips.length}…`);
    await loadVideo(video, c.url);
    if (!srcNode) { srcNode = actx.createMediaElementSource(video); srcNode.connect(dest); }
    // Letterbox the clip into the canvas.
    const scale = Math.min(W / video.videoWidth, H / video.videoHeight);
    const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    await playToEnd(video, () => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(video, dx, dy, dw, dh);
    });
    elapsed += c.duration;
    setBar(elapsed / total);
  }

  rec.stop();
  await done;
  actx.close();
  return new Blob(chunks, { type: 'video/webm' });
}

function pickMime() {
  const want = $('format').value;
  return (window.MediaRecorder && MediaRecorder.isTypeSupported(want)) ? want : 'video/webm';
}

function probeSize(c) {
  return new Promise((res) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => res({ w: v.videoWidth || 1280, h: v.videoHeight || 720 });
    v.onerror = () => res({ w: 1280, h: 720 });
    v.src = c.url;
  });
}

function loadVideo(v, url) {
  return new Promise((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error('Could not load a clip.'));
    v.src = url;
    v.load();
  });
}

/* Plays the clip to the end while painting frames onto the canvas. */
function playToEnd(video, paint) {
  return new Promise((resolve) => {
    let raf = 0;
    const tick = () => {
      paint();
      if (!video.ended && !video.paused) raf = requestAnimationFrame(tick);
    };
    video.onended = () => { cancelAnimationFrame(raf); resolve(); };
    video.currentTime = 0;
    video.play().then(() => { tick(); }).catch(() => resolve());
  });
}
