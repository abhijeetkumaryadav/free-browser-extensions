/* ReadAloud — popup controller.
 * The speech engine lives in reader.js, injected into the active tab, so
 * reading continues after this popup closes. This script sends commands
 * and polls state (500ms) to update the UI. All settings stay on-device. */
'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  srcArticle: $('src-article'),
  srcSelection: $('src-selection'),
  play: $('btn-play'),
  pause: $('btn-pause'),
  stop: $('btn-stop'),
  statusText: $('status-text'),
  progressFill: $('progress-fill'),
  voiceSelect: $('voice-select'),
  rate: $('rate'),
  rateVal: $('rate-val'),
  pitch: $('pitch'),
  pitchVal: $('pitch-val'),
  highlight: $('highlight'),
};

let tabId = null;
let hostname = '';
let mode = 'article'; // 'article' | 'selection'
let pollTimer = null;
let readerReady = false;

/* ------------------------------------------------------------------ */
/* Tab + injection                                                     */
/* ---------------------------------------------------------------- */

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// Injects reader.js on demand. Idempotent (the file guards re-injection).
// Returns true if the reader API is available afterwards.
async function ensureReader() {
  if (!tabId) return false;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['reader.js'],
    });
  } catch (err) {
    // e.g. chrome:// pages, Web Store, or no permission — can't inject.
    console.warn('Injection failed:', err.message);
    return false;
  }
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => typeof window.__ttsReader !== 'undefined',
    });
    readerReady = !!(res && res.result);
    return readerReady;
  } catch {
    return false;
  }
}

// Call a method on the in-page reader. Returns the method's return value.
async function callReader(method, ...args) {
  const [res] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (m, a) => window.__ttsReader[m](...a),
    args: [method, args],
  });
  return res && res.result;
}

/* ------------------------------------------------------------------ */
/* Settings persistence                                                */
/* ---------------------------------------------------------------- */

const store = {
  async get(keys) {
    try {
      return await chrome.storage.local.get(keys);
    } catch {
      return {};
    }
  },
  async set(obj) {
    try {
      await chrome.storage.local.set(obj);
    } catch (err) {
      console.error('storage failed', err);
    }
  },
};

async function loadSettings() {
  const data = await store.get(['tts:rate', 'tts:pitch', 'tts:voice', 'tts:highlight']);
  // Per-site speed memory wins over the global default.
  let rate = typeof data['tts:rate'] === 'number' ? data['tts:rate'] : 1.0;
  if (hostname) {
    const site = await store.get(['tts:rate:' + hostname]);
    if (typeof site['tts:rate:' + hostname] === 'number') rate = site['tts:rate:' + hostname];
  }
  els.rate.value = rate;
  els.rateVal.textContent = Number(rate).toFixed(1) + '×';

  const pitch = typeof data['tts:pitch'] === 'number' ? data['tts:pitch'] : 1.0;
  els.pitch.value = pitch;
  els.pitchVal.textContent = Number(pitch).toFixed(1);

  els.highlight.checked = data['tts:highlight'] !== false;

  return { rate, pitch, voiceURI: data['tts:voice'] || '' };
}

async function applySettingsToReader(s) {
  if (!readerReady) return;
  try {
    await callReader('setRate', s.rate);
    await callReader('setPitch', s.pitch);
    await callReader('setVoice', s.voiceURI);
    await callReader('setHighlight', els.highlight.checked);
  } catch (err) {
    console.warn('apply settings failed', err);
  }
}

/* ------------------------------------------------------------------ */
/* Voices                                                              */
/* ---------------------------------------------------------------- */

async function loadVoices(preferredURI) {
  let voices = [];
  try {
    voices = (await callReader('getVoices')) || [];
  } catch {
    voices = [];
  }
  els.voiceSelect.innerHTML = '';
  if (voices.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = 'No voices found';
    els.voiceSelect.appendChild(opt);
    els.voiceSelect.disabled = true;
    return;
  }
  // Sort: default first, then by language, then name.
  voices.sort((a, b) =>
    (b.isDefault - a.isDefault) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));

  let selected = false;
  voices.forEach((v) => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})${v.isDefault ? ' — default' : ''}`;
    if (preferredURI && v.voiceURI === preferredURI) {
      opt.selected = true;
      selected = true;
    }
    els.voiceSelect.appendChild(opt);
  });
  if (!selected) {
    const def = voices.find((v) => v.isDefault) || voices[0];
    els.voiceSelect.value = def.voiceURI;
  }
}

/* ------------------------------------------------------------------ */
/* Transport controls                                                  */
/* ---------------------------------------------------------------- */

async function doPlay() {
  setStatus('Starting…');
  const ok = await ensureReader();
  if (!ok) {
    setStatus('Can’t read this page');
    els.statusText.title = 'Extensions cannot access this page (e.g. chrome:// pages or the Web Store).';
    return;
  }
  const s = await loadSettings();
  await applySettingsToReader(s);
  let res;
  try {
    res = await callReader('start', mode);
  } catch (err) {
    setStatus('Can’t read this page');
    return;
  }
  if (!res || !res.ok) {
    setStatus(res && res.reason === 'no-selection'
      ? 'Select some text first'
      : 'No readable text found');
    return;
  }
  startPolling();
}

async function doPauseToggle() {
  if (!readerReady) return;
  const st = await safeState();
  if (!st) return;
  try {
    if (st.status === 'paused') await callReader('resume');
    else if (st.status === 'speaking') await callReader('pause');
  } catch { /* tab went away */ }
}

async function doStop() {
  if (!readerReady) return;
  try {
    await callReader('stop');
  } catch { /* tab went away */ }
}

els.play.addEventListener('click', doPlay);
els.pause.addEventListener('click', doPauseToggle);
els.stop.addEventListener('click', doStop);

/* ------------------------------------------------------------------ */
/* Source toggle                                                       */
/* ---------------------------------------------------------------- */

function setMode(m) {
  mode = m;
  els.srcArticle.classList.toggle('active', m === 'article');
  els.srcSelection.classList.toggle('active', m === 'selection');
}
els.srcArticle.addEventListener('click', () => setMode('article'));
els.srcSelection.addEventListener('click', () => setMode('selection'));

/* ------------------------------------------------------------------ */
/* Sliders / selects                                                   */
/* ---------------------------------------------------------------- */

let rateDebounce = null;
els.rate.addEventListener('input', () => {
  const rate = parseFloat(els.rate.value);
  els.rateVal.textContent = rate.toFixed(1) + '×';
  clearTimeout(rateDebounce);
  rateDebounce = setTimeout(async () => {
    await store.set({ 'tts:rate': rate });
    if (hostname) await store.set({ ['tts:rate:' + hostname]: rate });
    if (readerReady) {
      try { await callReader('setRate', rate); } catch { /* noop */ }
    }
  }, 250);
});

let pitchDebounce = null;
els.pitch.addEventListener('input', () => {
  const pitch = parseFloat(els.pitch.value);
  els.pitchVal.textContent = pitch.toFixed(1);
  clearTimeout(pitchDebounce);
  pitchDebounce = setTimeout(async () => {
    await store.set({ 'tts:pitch': pitch });
    if (readerReady) {
      try { await callReader('setPitch', pitch); } catch { /* noop */ }
    }
  }, 250);
});

els.voiceSelect.addEventListener('change', async () => {
  const uri = els.voiceSelect.value;
  await store.set({ 'tts:voice': uri });
  if (readerReady) {
    try { await callReader('setVoice', uri); } catch { /* noop */ }
  }
});

els.highlight.addEventListener('change', async () => {
  const on = els.highlight.checked;
  await store.set({ 'tts:highlight': on });
  if (readerReady) {
    try { await callReader('setHighlight', on); } catch { /* noop */ }
  }
});

/* ------------------------------------------------------------------ */
/* State polling + UI                                                  */
/* ---------------------------------------------------------------- */

function setStatus(text) {
  els.statusText.textContent = text;
}

async function safeState() {
  try {
    return await callReader('getState');
  } catch {
    return null;
  }
}

function renderState(st) {
  if (!st) {
    setStatus('Reader unavailable');
    els.play.disabled = false;
    els.pause.disabled = true;
    els.stop.disabled = true;
    els.progressFill.style.width = '0%';
    return;
  }
  const pct = st.totalWords > 0 ? Math.min(100, (st.wordsDone / st.totalWords) * 100) : 0;
  els.progressFill.style.width = pct.toFixed(1) + '%';

  const speaking = st.status === 'speaking';
  const paused = st.status === 'paused';
  const active = speaking || paused;

  els.play.disabled = speaking;
  els.pause.disabled = !active;
  els.stop.disabled = !active;

  if (speaking) {
    setStatus(`Reading · ${st.wordsDone}/${st.totalWords} words`);
  } else if (paused) {
    setStatus(`Paused · ${st.wordsDone}/${st.totalWords} words`);
  } else if (st.totalWords > 0 && st.wordsDone >= st.totalWords) {
    setStatus('Finished');
  } else {
    setStatus('Ready');
  }
}

function startPolling() {
  stopPolling();
  const tick = async () => {
    const st = await safeState();
    renderState(st);
  };
  tick();
  pollTimer = setInterval(tick, 500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ---------------------------------------------------------------- */

(async function init() {
  const tab = await getActiveTab();
  if (!tab) {
    setStatus('No active tab');
    els.play.disabled = true;
    return;
  }
  tabId = tab.id;
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    hostname = '';
  }

  const s = await loadSettings();

  // If the reader is already running in this tab (popup reopened mid-read),
  // pick up its state instead of starting fresh.
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => typeof window.__ttsReader !== 'undefined',
    });
    readerReady = !!(res && res.result);
  } catch {
    readerReady = false; // can't even probe: unsupported page
  }

  if (readerReady) {
    await applySettingsToReader(s);
    await loadVoices(s.voiceURI);
    startPolling();
  } else {
    // Voices list needs the page realm; load lazily on first play.
    // Show global saved voice choice as placeholder.
    const opt = document.createElement('option');
    opt.textContent = s.voiceURI ? 'Saved voice (loads on play)' : 'Default voice';
    els.voiceSelect.appendChild(opt);
    els.voiceSelect.disabled = true;
  }
})();

window.addEventListener('unload', stopPolling);
