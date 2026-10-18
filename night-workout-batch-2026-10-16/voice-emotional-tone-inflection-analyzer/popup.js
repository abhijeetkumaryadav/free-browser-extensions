/* Voice Inflection Visualizer — popup logic.
 * Mic capture via Web Audio (user gesture), live waveform, autocorrelation pitch
 * estimate, RMS energy meter, and persistent session pitch-range stats.
 * HONEST SCOPE: measures pitch/energy only — NOT emotion analysis.
 */
'use strict';

// ---------------------------------------------------------------- constants
const FFT_SIZE = 2048;          // analyser fft size (time-domain buffer)
const MIN_HZ = 50;              // lowest pitch we try to detect (Hz)
const MAX_HZ = 1000;            // highest pitch we try to detect (Hz)
const ENERGY_FLOOR_DB = -60;    // dB floor for the energy meter
const ENERGY_CEIL_DB = -12;     // dB ceiling for the energy meter
const PITCH_CONFIDENCE = 0.85;  // min autocorrelation confidence to accept pitch
const STATS_KEY = 'pitchStats'; // chrome.storage.local key

// ------------------------------------------------------------------ state
let audioCtx = null;        // AudioContext
let analyser = null;        // AnalyserNode
let source = null;          // MediaStreamAudioSourceNode
let stream = null;          // raw MediaStream (so we can stop tracks)
let rafId = null;           // requestAnimationFrame id
let buf = null;             // Float32Array time-domain buffer
let stats = { min: Infinity, max: -Infinity, sum: 0, count: 0 }; // pitch stats

// -------------------------------------------------------------------- dom
const $ = (id) => document.getElementById(id);
const btnStart = $('btnStart');
const btnStop = $('btnStop');
const btnClear = $('btnClear');
const statusEl = $('status');
const pitchVal = $('pitchVal');
const energyVal = $('energyVal');
const energyFill = $('energyFill');
const wave = $('wave');
const wctx = wave.getContext('2d');

// ------------------------------------------------------- status messaging
function setStatus(msg, cls) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

// ------------------------------------------------------------- statistics
function loadStats() {
  chrome.storage.local.get({ [STATS_KEY]: null }, (res) => {
    if (res[STATS_KEY] && typeof res[STATS_KEY].count === 'number') {
      stats = res[STATS_KEY];
      renderStats();
    }
  });
}

function saveStats() {
  chrome.storage.local.set({ [STATS_KEY]: stats });
}

function recordPitch(hz) {
  stats.min = Math.min(stats.min, hz);
  stats.max = Math.max(stats.max, hz);
  stats.sum += hz;
  stats.count += 1;
  renderStats();
}

function renderStats() {
  $('statMin').textContent = stats.count ? Math.round(stats.min) + ' Hz' : '–';
  $('statMax').textContent = stats.count ? Math.round(stats.max) + ' Hz' : '–';
  $('statAvg').textContent = stats.count ? Math.round(stats.sum / stats.count) + ' Hz' : '–';
  $('statCount').textContent = String(stats.count);
}

// ------------------------------------------------- pitch estimation (YIN-lite)
// Normalized autocorrelation over the voiced pitch range; returns {hz, confidence}.
function estimatePitch(data, sampleRate) {
  const n = data.length;
  const minPeriod = Math.floor(sampleRate / MAX_HZ);
  const maxPeriod = Math.floor(sampleRate / MIN_HZ);
  let bestPeriod = -1;
  let bestCorr = 0;

  // Only search while a full period fits in the buffer.
  for (let period = minPeriod; period <= maxPeriod; period++) {
    let num = 0;   // cross-correlation numerator
    let den = 0;   // energy denominator
    const limit = n - period;
    for (let i = 0; i < limit; i++) {
      const a = data[i];
      const b = data[i + period];
      num += a * b;
      den += a * a + b * b;
    }
    const corr = den > 0 ? (2 * num) / den : 0;
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = period;
    }
  }

  if (bestPeriod < 0 || bestCorr < PITCH_CONFIDENCE) return null;
  return { hz: sampleRate / bestPeriod, confidence: bestCorr };
}

// ------------------------------------------------------------- frame loop
function frame() {
  analyser.getFloatTimeDomainData(buf);

  // --- energy (RMS -> dB)
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
  const rms = Math.sqrt(sumSq / buf.length);
  const db = 20 * Math.log10(rms + 1e-9);
  const clamped = Math.min(Math.max(db, ENERGY_FLOOR_DB), ENERGY_CEIL_DB);
  const pct = ((clamped - ENERGY_FLOOR_DB) / (ENERGY_CEIL_DB - ENERGY_FLOOR_DB)) * 100;

  energyVal.textContent = db <= ENERGY_FLOOR_DB ? '–' : db.toFixed(1);
  energyFill.style.width = pct.toFixed(1) + '%';

  // --- pitch (skip when too quiet to be voiced)
  let pitch = null;
  if (db > -50) pitch = estimatePitch(buf, audioCtx.sampleRate);
  if (pitch) {
    pitchVal.textContent = Math.round(pitch.hz);
    recordPitch(pitch.hz);
  } else {
    pitchVal.textContent = '–';
  }

  drawWaveform();
  rafId = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ drawing
function drawWaveform() {
  const w = wave.width;
  const h = wave.height;
  const mid = h / 2;
  wctx.clearRect(0, 0, w, h);
  wctx.beginPath();
  wctx.strokeStyle = '#f472b6';
  wctx.lineWidth = 2;
  const step = w / buf.length;
  for (let i = 0; i < buf.length; i++) {
    const x = i * step;
    const y = mid + buf[i] * mid * 0.95;
    if (i === 0) wctx.moveTo(x, y);
    else wctx.lineTo(x, y);
  }
  wctx.stroke();
  // center line
  wctx.beginPath();
  wctx.strokeStyle = 'rgba(255,255,255,0.12)';
  wctx.lineWidth = 1;
  wctx.moveTo(0, mid);
  wctx.lineTo(w, mid);
  wctx.stroke();
}

// --------------------------------------------------------------- start/stop
async function startMic() {
  setStatus('Requesting microphone…');
  try {
    // Must be triggered by a user gesture (the Start button click).
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    // Graceful denial: permission denied, no device, etc.
    setStatus('Microphone unavailable: ' + (err.name || 'unknown error') +
      '. Check browser permission and try again.', 'error');
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  buf = new Float32Array(analyser.fftSize);

  source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser); // analyser only — nothing routes to speakers

  btnStart.disabled = true;
  btnStop.disabled = false;
  setStatus('Live — speak to see pitch and energy.', 'live');
  rafId = requestAnimationFrame(frame);
}

function stopMic() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (source) { source.disconnect(); source = null; }
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  saveStats();
  btnStart.disabled = false;
  btnStop.disabled = true;
  setStatus('Microphone idle. Click “Start mic” and allow access.');
  pitchVal.textContent = '–';
  energyVal.textContent = '–';
  energyFill.style.width = '0%';
}

// ------------------------------------------------------------------- init
btnStart.addEventListener('click', startMic);
btnStop.addEventListener('click', stopMic);
btnClear.addEventListener('click', () => {
  stats = { min: Infinity, max: -Infinity, sum: 0, count: 0 };
  saveStats();
  renderStats();
});
window.addEventListener('unload', stopMic);

loadStats();
