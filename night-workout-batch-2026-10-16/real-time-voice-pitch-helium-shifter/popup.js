'use strict';
/* Helium Shifter — offline pitch & speed shifter.
 * Honest scope: processes an uploaded file through OfflineAudioContext.
 * No real-time mic capture, no network, nothing leaves the machine. */

const fileInput = document.getElementById('fileInput');
const fileLabel = document.getElementById('fileLabel');
const pitchSlider = document.getElementById('pitch');
const rateSlider = document.getElementById('rate');
const pitchVal = document.getElementById('pitchVal');
const rateVal = document.getElementById('rateVal');
const previewBtn = document.getElementById('previewBtn');
const stopBtn = document.getElementById('stopBtn');
const exportBtn = document.getElementById('exportBtn');
const statusEl = document.getElementById('status');
const dl = document.getElementById('dl');

let audioBuffer = null;   // decoded source
let sourceName = '';
let previewCtx = null;    // live AudioContext for preview
let previewSrc = null;    // current preview source node

function setStatus(msg, working = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('working', working);
}

function semitonesToRate(st) { return Math.pow(2, st / 12); }

function renderLabels() {
  const st = parseFloat(pitchSlider.value);
  pitchVal.textContent = (st >= 0 ? '+' : '') + st.toFixed(1) + ' st';
  rateVal.textContent = parseFloat(rateSlider.value).toFixed(2) + '×';
}
pitchSlider.addEventListener('input', renderLabels);
rateSlider.addEventListener('input', renderLabels);
renderLabels();

fileInput.addEventListener('change', async () => {
  const f = fileInput.files[0];
  if (!f) return;
  setStatus('Decoding…', true);
  try {
    const ab = await f.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100);
    audioBuffer = await ctx.decodeAudioData(ab);
    sourceName = f.name.replace(/\.[^.]+$/, '');
    fileLabel.textContent = f.name;
    previewBtn.disabled = exportBtn.disabled = false;
    const mins = (audioBuffer.duration / 60).toFixed(1);
    setStatus(`${audioBuffer.numberOfChannels}ch · ${audioBuffer.sampleRate} Hz · ~${mins} min — 100% local.`);
  } catch (e) {
    audioBuffer = null;
    setStatus('Could not decode that file.');
  }
});

function stopPreview() {
  if (previewSrc) { try { previewSrc.stop(); } catch (_) {} previewSrc = null; }
  if (previewCtx) { previewCtx.close().catch(() => {}); previewCtx = null; }
  stopBtn.disabled = true;
  previewBtn.disabled = !audioBuffer;
}

/* Preview: real-time playback with playbackRate = speed × pitch.
 * Note: playbackRate alone changes pitch AND duration (resampling),
 * which is exactly the classic "helium" chipmunk effect. */
previewBtn.addEventListener('click', () => {
  if (!audioBuffer) return;
  stopPreview();
  previewCtx = new (window.AudioContext || window.webkitAudioContext)();
  previewSrc = previewCtx.createBufferSource();
  previewSrc.buffer = audioBuffer;
  previewSrc.playbackRate.value = parseFloat(rateSlider.value) * semitonesToRate(parseFloat(pitchSlider.value));
  previewSrc.connect(previewCtx.destination);
  previewSrc.onended = () => stopPreview();
  previewSrc.start();
  stopBtn.disabled = false;
  previewBtn.disabled = true;
  setStatus('Previewing…');
});
stopBtn.addEventListener('click', () => { stopPreview(); setStatus('Preview stopped.'); });

/* Export: render offline so the pitch/speed effect is baked in. */
exportBtn.addEventListener('click', async () => {
  if (!audioBuffer) return;
  stopPreview();
  setStatus('Rendering…', true);
  exportBtn.disabled = true;
  try {
    const speed = parseFloat(rateSlider.value);
    const pitch = semitonesToRate(parseFloat(pitchSlider.value));
    const totalRate = speed * pitch;
    const sr = audioBuffer.sampleRate;
    const outLen = Math.max(1, Math.floor(audioBuffer.length / totalRate));
    const off = new OfflineAudioContext(audioBuffer.numberOfChannels, outLen, sr);
    const src = off.createBufferSource();
    src.buffer = audioBuffer;
    src.playbackRate.value = totalRate;
    src.connect(off.destination);
    src.start(0);
    const rendered = await off.startRendering();
    const wav = encodeWav(rendered);
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    dl.href = url;
    dl.download = (sourceName || 'shifted') + '_shifted.wav';
    dl.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus('Done — WAV downloaded.');
  } catch (e) {
    setStatus('Render failed.');
  }
  exportBtn.disabled = false;
});

/* Minimal 16-bit PCM WAV encoder (local, no libraries). */
function encodeWav(buffer) {
  const nCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytes = 44 + len * nCh * 2;
  const ab = new ArrayBuffer(bytes);
  const v = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); v.setUint32(4, bytes - 8, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, nCh, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * nCh * 2, true); v.setUint16(32, nCh * 2, true);
  v.setUint16(34, 16, true); wstr(36, 'data'); v.setUint32(40, len * nCh * 2, true);
  const chans = [];
  for (let c = 0; c < nCh; c++) chans.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
  }
  return ab;
}
