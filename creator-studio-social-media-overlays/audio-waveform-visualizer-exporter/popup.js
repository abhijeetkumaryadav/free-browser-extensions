/* Waveform Visualizer & Exporter — 100% client-side: decode, render, play, export. */
(function () {
  'use strict';

  // ---- DOM refs ----
  const $ = id => document.getElementById(id);
  const dropzone = $('dropzone'), fileInput = $('fileInput'), viewer = $('viewer');
  const canvas = $('wave'), ctx = canvas.getContext('2d');
  const playBtn = $('playBtn'), playIcon = $('playIcon'), timeLabel = $('timeLabel');
  const zoomInput = $('zoom'), statusEl = $('status');

  // ---- State ----
  const PEAKS = 4000;                 // waveform resolution
  let peaks = null;                   // Float32Array of peak amplitudes 0..1
  let duration = 0, fileName = '';
  let zoom = 1, offsetPx = 0;         // view: px offset into virtual waveform
  let audioCtx = null, buffer = null, source = null, startedAt = 0, playheadSec = 0, playing = false;
  let rafId = 0;

  const ACCENT = '#22d3ee';

  // ---- Helpers ----
  function status(msg, isErr) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('err', !!isErr);
    statusEl.classList.remove('hidden');
  }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- File loading ----
  dropzone.addEventListener('click', () => fileInput.click());
  ['dragover', 'dragenter'].forEach(e => dropzone.addEventListener(e, ev => {
    ev.preventDefault(); dropzone.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(e => dropzone.addEventListener(e, ev => {
    ev.preventDefault(); dropzone.classList.remove('over');
  }));
  dropzone.addEventListener('drop', ev => {
    const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (f) loadFile(f);
  });
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]); });
  $('newFile').addEventListener('click', () => fileInput.click());

  async function loadFile(file) {
    stopPlayback();
    status('Decoding audio…');
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const arr = await file.arrayBuffer();
      buffer = await audioCtx.decodeAudioData(arr);
    } catch (e) {
      status('Could not decode that file. Try MP3, WAV, OGG or M4A.', true);
      return;
    }
    duration = buffer.duration; fileName = file.name;
    computePeaks();
    zoom = 1; offsetPx = 0; playheadSec = 0;
    zoomInput.value = 1;
    $('fileName').textContent = fileName;
    $('fileInfo').textContent = fmt(duration) + ' · ' + (file.size / 1048576).toFixed(1) + ' MB';
    dropzone.classList.add('hidden'); viewer.classList.remove('hidden');
    statusEl.classList.add('hidden');
    sizeCanvas(); draw();
    updateTime();
  }

  // Mix channels down, take max-abs peak per bucket.
  function computePeaks() {
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const per = Math.max(1, Math.floor(ch0.length / PEAKS));
    peaks = new Float32Array(PEAKS);
    for (let i = 0; i < PEAKS; i++) {
      let m = 0;
      const start = i * per, end = Math.min(start + per, ch0.length);
      for (let j = start; j < end; j += 4) {          // stride for speed
        const v = ch1 ? (Math.abs(ch0[j]) + Math.abs(ch1[j])) / 2 : Math.abs(ch0[j]);
        if (v > m) m = v;
      }
      peaks[i] = Math.min(1, m);
    }
  }

  // ---- View geometry ----
  function viewWidth() { return (canvas.clientWidth / PEAKS) * zoom * PEAKS; } // = cw * zoom
  function clampOffset() {
    const max = Math.max(0, canvas.clientWidth * zoom - canvas.clientWidth);
    offsetPx = Math.min(Math.max(0, offsetPx), max);
  }
  function secToX(sec) { return (sec / duration) * canvas.clientWidth * zoom - offsetPx; }
  function xToSec(x) { return ((x + offsetPx) / (canvas.clientWidth * zoom)) * duration; }

  // ---- Rendering ----
  function draw() {
    if (!peaks) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, mid = h / 2;
    ctx.clearRect(0, 0, w, h);
    const pxPerPeak = (w * zoom) / PEAKS;
    const firstPeak = Math.floor(offsetPx / pxPerPeak);
    const lastPeak = Math.min(PEAKS - 1, Math.ceil((offsetPx + w) / pxPerPeak));
    const playedX = playing || playheadSec > 0 ? secToX(playheadSec) : -1;

    for (let i = firstPeak; i <= lastPeak; i++) {
      const x = i * pxPerPeak - offsetPx;
      const bw = Math.max(1, pxPerPeak * 0.72);
      const bh = Math.max(1.5, peaks[i] * (h * 0.86));
      const played = x < playedX;
      ctx.fillStyle = played ? 'rgba(34,211,238,.28)' : ACCENT;
      ctx.fillRect(x, mid - bh / 2, bw, bh);
    }
    // Playhead
    if (playedX >= 0 && playedX <= w) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(playedX - 1, 0, 2, h);
    }
  }

  // ---- Playback ----
  function setPlayGlyph(isPlaying) {
    playIcon.innerHTML = isPlaying
      ? '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
  }
  function updateTime() {
    timeLabel.textContent = fmt(playheadSec) + ' / ' + fmt(duration);
  }
  function tick() {
    if (!playing) return;
    playheadSec = audioCtx.currentTime - startedAt;
    if (playheadSec >= duration) { stopPlayback(); playheadSec = 0; updateTime(); draw(); return; }
    updateTime(); draw();
    rafId = requestAnimationFrame(tick);
  }
  function startPlayback() {
    if (!buffer) return;
    audioCtx.resume();
    source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.onended = () => { if (playing) { stopPlayback(); } };
    startedAt = audioCtx.currentTime - playheadSec;
    source.start(0, playheadSec % duration);
    playing = true; setPlayGlyph(true);
    rafId = requestAnimationFrame(tick);
  }
  function stopPlayback() {
    playing = false;
    cancelAnimationFrame(rafId);
    if (source) { try { source.onended = null; source.stop(); } catch (e) {} source = null; }
    setPlayGlyph(false);
  }
  playBtn.addEventListener('click', () => {
    if (!buffer) return;
    if (playing) { playheadSec = audioCtx.currentTime - startedAt; stopPlayback(); updateTime(); draw(); }
    else startPlayback();
  });

  // ---- Pan / zoom / seek ----
  let dragStartX = 0, dragStartOff = 0, dragging = false, moved = false;
  canvas.addEventListener('mousedown', e => {
    dragging = true; moved = false;
    dragStartX = e.clientX; dragStartOff = offsetPx;
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - dragStartX) > 4) moved = true;
    if (moved) { offsetPx = dragStartOff - (e.clientX - dragStartX); clampOffset(); draw(); }
  });
  window.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    if (!moved && buffer) {                       // simple click = seek
      const r = canvas.getBoundingClientRect();
      const wasPlaying = playing;
      if (wasPlaying) { playheadSec = audioCtx.currentTime - startedAt; stopPlayback(); }
      playheadSec = Math.min(Math.max(0, xToSec(e.clientX - r.left)), duration - 0.01);
      updateTime(); draw();
      if (wasPlaying) startPlayback();
    }
  });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const nz = Math.min(40, Math.max(1, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    zoomAround(nz, e);
  }, { passive: false });
  zoomInput.addEventListener('input', () => zoomAround(parseFloat(zoomInput.value), null));

  function zoomAround(nz, ev) {
    if (!peaks) return;
    const r = canvas.getBoundingClientRect();
    const anchorX = ev ? ev.clientX - r.left : r.width / 2;   // keep point under cursor stable
    const anchorSec = xToSec(anchorX);
    zoom = nz;
    offsetPx = (anchorSec / duration) * (r.width * zoom) - anchorX;
    clampOffset(); draw();
  }

  // ---- PNG export ----
  $('exportBtn').addEventListener('click', () => {
    if (!peaks) return;
    const W = Math.min(4000, Math.max(320, parseInt($('expW').value, 10) || 1600));
    const H = Math.min(1200, Math.max(100, parseInt($('expH').value, 10) || 400));
    const waveColor = $('waveColor').value;
    const transparent = $('transparent').checked;
    const bg = $('bgColor').value;

    const out = document.createElement('canvas');
    out.width = W; out.height = H;
    const c = out.getContext('2d');
    if (!transparent) { c.fillStyle = bg; c.fillRect(0, 0, W, H); }
    const mid = H / 2, pxPerPeak = W / PEAKS;
    c.fillStyle = waveColor;
    for (let i = 0; i < PEAKS; i++) {
      const bh = Math.max(1, peaks[i] * H * 0.86);
      c.fillRect(i * pxPerPeak, mid - bh / 2, Math.max(1, pxPerPeak * 0.72), bh);
    }
    const a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = fileName.replace(/\.[^.]+$/, '') + '-waveform.png';
    document.body.appendChild(a); a.click(); a.remove();
    status('PNG exported — ' + W + '×' + H + (transparent ? ' (transparent)' : ''));
  });

  window.addEventListener('resize', () => { if (peaks) { sizeCanvas(); clampOffset(); draw(); } });
})();
