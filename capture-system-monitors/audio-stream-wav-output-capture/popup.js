/* TabWav — popup.js
 * Records the ACTIVE TAB's audible output via chrome.tabCapture, shows a live
 * level meter, then locally re-encodes the recording to 16-bit WAV.
 * Everything runs on-device; no network calls are made.
 */

'use strict';

// ---------- State ----------
let captureStream = null;   // MediaStream from chrome.tabCapture
let audioCtx = null;        // AudioContext for the level meter
let analyser = null;
let recorder = null;        // MediaRecorder
let chunks = [];            // recorded webm/opus chunks
let rafId = null;
let timerId = null;
let startTime = 0;
let wavBlob = null;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const btnStart = $('btnStart'), btnStop = $('btnStop');
const btnDownload = $('btnDownload'), btnDiscard = $('btnDiscard');
const statusText = $('statusText'), timerEl = $('timer');
const recDot = $('recDot'), errorMsg = $('errorMsg');
const resultCard = $('resultCard'), resultMeta = $('resultMeta');
const meter = $('meter');
const meterCtx = meter.getContext('2d');

// ---------- Helpers ----------
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove('hidden');
}
function clearError() {
  errorMsg.textContent = '';
  errorMsg.classList.add('hidden');
}
function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}
function setUI(recording) {
  btnStart.disabled = recording;
  btnStop.disabled = !recording;
  recDot.classList.toggle('recording', recording);
  recDot.classList.toggle('idle', !recording);
  statusText.textContent = recording ? 'Recording tab audio…' : 'Idle — ready to record';
  statusText.classList.toggle('live', recording);
}

// Draw a flat baseline on the meter when idle.
function drawIdleMeter() {
  meterCtx.clearRect(0, 0, meter.width, meter.height);
  meterCtx.fillStyle = 'rgba(168,85,247,0.25)';
  meterCtx.fillRect(0, meter.height / 2 - 1, meter.width, 2);
}
drawIdleMeter();

// Live level meter loop driven by the AnalyserNode.
function meterLoop() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  meterCtx.clearRect(0, 0, meter.width, meter.height);
  meterCtx.strokeStyle = '#a855f7';
  meterCtx.lineWidth = 2;
  meterCtx.beginPath();
  const step = meter.width / data.length;
  for (let i = 0; i < data.length; i++) {
    const y = ((data[i] - 128) / 128) * (meter.height / 2 - 4) + meter.height / 2;
    i === 0 ? meterCtx.moveTo(0, y) : meterCtx.lineTo(i * step, y);
  }
  meterCtx.stroke();
  rafId = requestAnimationFrame(meterLoop);
}

// ---------- Recording ----------
async function startRecording() {
  clearError();
  resultCard.classList.add('hidden');
  wavBlob = null;

  try {
    // Get the active tab (needed for tabCapture).
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
      showError('Cannot capture this page. Switch to a regular website tab and try again.');
      return;
    }

    // Capture the tab's audio. Requires an explicit user gesture (this click).
    captureStream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
        if (chrome.runtime.lastError || !stream) {
          reject(new Error(chrome.runtime.lastError ?
            chrome.runtime.lastError.message :
            'Capture failed — the tab may not be playing audible audio.'));
        } else {
          resolve(stream);
        }
      });
    });

    // Level meter via Web Audio (tap only — we do not modify the stream).
    audioCtx = new AudioContext();
    const src = audioCtx.createMediaStreamSource(captureStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    src.connect(analyser);
    meterLoop();

    // Record with MediaRecorder; we re-encode to WAV locally on stop.
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus' : 'audio/webm';
    chunks = [];
    recorder = new MediaRecorder(captureStream, { mimeType: mime });
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = onRecordingStopped;
    recorder.start(250);

    startTime = Date.now();
    timerEl.textContent = '00:00';
    timerId = setInterval(() => { timerEl.textContent = fmtTime(Date.now() - startTime); }, 500);
    setUI(true);
  } catch (err) {
    showError(err.message || String(err));
    cleanupStream();
  }
}

function stopRecording() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop(); // onRecordingStopped handles the rest
  } else {
    cleanupStream();
    setUI(false);
  }
}

// After MediaRecorder stops: decode locally and build a 16-bit PCM WAV blob.
async function onRecordingStopped() {
  clearInterval(timerId);
  cancelAnimationFrame(rafId);
  analyser = null;
  drawIdleMeter();
  setUI(false);
  statusText.textContent = 'Encoding WAV…';

  try {
    const webmBlob = new Blob(chunks, { type: recorder.mimeType });
    const buf = await webmBlob.arrayBuffer();
    const decodeCtx = new AudioContext();
    const audioBuf = await decodeCtx.decodeAudioData(buf);
    wavBlob = encodeWAV(audioBuf);
    await decodeCtx.close();

    const secs = Math.round(audioBuf.duration);
    const kb = Math.round(wavBlob.size / 1024);
    resultMeta.textContent = `${fmtTime(secs * 1000)} · ${audioBuf.sampleRate} Hz · ${kb} KB`;
    resultCard.classList.remove('hidden');
    statusText.textContent = 'Idle — ready to record';
  } catch (err) {
    showError('Could not encode WAV: ' + (err.message || err));
    statusText.textContent = 'Idle — ready to record';
  } finally {
    cleanupStream();
  }
}

function cleanupStream() {
  if (captureStream) { captureStream.getTracks().forEach((t) => t.stop()); captureStream = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  recorder = null;
}

// Minimal 16-bit PCM WAV encoder (mono or stereo preserved).
function encodeWAV(audioBuffer) {
  const numCh = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const len = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// If the popup is closed mid-recording, release the capture.
window.addEventListener('unload', cleanupStream);

// ---------- Wire up ----------
btnStart.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);
btnDownload.addEventListener('click', () => {
  if (!wavBlob) return;
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tab-audio-' + new Date().toISOString().replace(/[:.]/g, '-') + '.wav';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});
btnDiscard.addEventListener('click', () => {
  wavBlob = null; chunks = [];
  resultCard.classList.add('hidden');
});
