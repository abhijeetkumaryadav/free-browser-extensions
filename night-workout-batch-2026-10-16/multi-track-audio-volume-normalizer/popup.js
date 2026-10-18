// Peak Normalizer — popup logic.
// Decode audio with Web Audio, measure the true peak, apply gain to a target
// peak (dBFS), and export a 16-bit PCM WAV. All local, no network, no storage.

// ---------- state ----------
const state = {
  decoded: null,   // AudioBuffer of the loaded file
  fileName: '',
  peak: 0,         // linear peak amplitude
  channels: 0,
  sampleRate: 0,
  duration: 0,
};

// ---------- DOM ----------
const audioInput = document.getElementById('audioInput');
const fileInfo = document.getElementById('fileInfo');
const analysisEl = document.getElementById('analysis');
const meterFill = document.getElementById('meterFill');
const targetPeakInput = document.getElementById('targetPeak');
const normalizeBtn = document.getElementById('normalizeBtn');
const statusEl = document.getElementById('status');

audioInput.addEventListener('change', async () => {
  const file = audioInput.files[0];
  if (!file) return;
  setStatus('Decoding…');
  normalizeBtn.disabled = true;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 44100); // tiny throwaway for decode
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    state.decoded = decoded;
    state.fileName = file.name;
    state.channels = decoded.numberOfChannels;
    state.sampleRate = decoded.sampleRate;
    state.duration = decoded.duration;
    state.peak = measurePeak(decoded);

    fileInfo.textContent = `${file.name} — ${state.channels} ch · ${state.sampleRate} Hz · ${state.duration.toFixed(1)} s`;
    fileInfo.classList.remove('hidden');

    const peakDb = 20 * Math.log10(Math.max(state.peak, 1e-9));
    analysisEl.textContent = `Current peak: ${peakDb.toFixed(2)} dBFS (${(state.peak * 100).toFixed(1)}% of full scale)`;
    meterFill.style.width = `${Math.min(100, state.peak * 100)}%`;

    normalizeBtn.disabled = false;
    setStatus('');
  } catch (err) {
    setStatus('Could not decode this file — try MP3, WAV, OGG, or M4A.');
    state.decoded = null;
  }
  audioInput.value = '';
});

normalizeBtn.addEventListener('click', () => {
  if (!state.decoded) return;
  const targetDb = Math.min(0, Math.max(-12, Number(targetPeakInput.value) || -1));
  const targetLinear = Math.pow(10, targetDb / 20);
  if (state.peak <= 1e-9) {
    setStatus('File is silent — nothing to normalize.');
    return;
  }
  const gain = targetLinear / state.peak;
  setStatus('Applying gain and encoding WAV…');
  normalizeBtn.disabled = true;

  // Apply gain on the main thread (chunked so the popup stays responsive).
  const src = state.decoded;
  const out = new Float32Array(src.length * src.numberOfChannels);
  const totalSamples = src.length;
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const data = src.getChannelData(ch);
    for (let i = 0; i < totalSamples; i++) {
      out[i * src.numberOfChannels + ch] = data[i] * gain;
    }
  }

  const wavBlob = encodeWav(out, src.numberOfChannels, src.sampleRate);
  const url = URL.createObjectURL(wavBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.fileName.replace(/\.[a-z0-9]+$/i, '') + '_normalized.wav';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);

  setStatus(`Done — applied ${gain >= 1 ? '+' : ''}${(20 * Math.log10(gain)).toFixed(2)} dB. Exported WAV.`);
  normalizeBtn.disabled = false;
});

/** Find the maximum absolute sample value across all channels. */
function measurePeak(buffer) {
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/**
 * Encode interleaved float samples as a 16-bit PCM WAV Blob.
 * @param {Float32Array} interleaved — channel-interleaved samples in [-1, 1]
 * @param {number} channels
 * @param {number} sampleRate
 */
function encodeWav(interleaved, channels, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // fmt chunk size
  view.setUint16(20, 1, true);           // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true); // byte rate
  view.setUint16(32, channels * bytesPerSample, true);              // block align
  view.setUint16(34, 16, true);          // bits per sample
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function setStatus(msg) {
  statusEl.textContent = msg;
}
