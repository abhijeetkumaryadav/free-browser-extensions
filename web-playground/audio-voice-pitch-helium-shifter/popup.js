// popup.js — HeliumVoice: record via the USER_MEDIA offscreen document,
// store webm blobs in IndexedDB, play back pitch-shifted through Web Audio
// playbackRate (honest chipmunk effect: pitch + tempo shift together).

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
const recBtn = $('rec-btn');
const recLabel = $('rec-label');
const recTimer = $('rec-timer');
const pitchSlider = $('pitch');
const pitchLabel = $('pitch-label');
const listEl = $('list');
const countEl = $('count');

let recording = false;
let timerId = null;
let timerStart = 0;
let pitch = 1.0;               // current playback pitch multiplier
let audioCtx = null;           // lazily created Web Audio context
let currentSource = null;      // to stop overlapping playback

/* ---------- tiny IndexedDB wrapper ---------- */
const DB = 'heliumvoice', STORE = 'recordings';
function db() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const dbPut = (rec) => tx('readwrite', (s) => s.put(rec));
const dbAll = () => tx('readonly', (s) => s.getAll());
const dbDel = (id) => tx('readwrite', (s) => s.delete(id));

/* ---------- offscreen recording ---------- */
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Keep microphone recording alive if the popup is closed.'
    });
  }
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function setRecording(on) {
  recording = on;
  recBtn.classList.toggle('recording', on);
  recLabel.textContent = on ? 'Stop' : 'Record';
  $('rec-hint').textContent = on ? 'recording… tap Stop to finish' : 'mic only while you hold record';
  chrome.action.setBadgeText({ text: on ? 'REC' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
  if (on) {
    timerStart = Date.now();
    recTimer.textContent = '0:00';
    timerId = setInterval(() => { recTimer.textContent = fmtTime(Date.now() - timerStart); }, 250);
  } else {
    clearInterval(timerId);
    recTimer.textContent = '0:00';
  }
}

recBtn.addEventListener('click', async () => {
  try {
    await ensureOffscreen();
    if (!recording) {
      await chrome.runtime.sendMessage({ target: 'helium-offscreen', type: 'start' });
      setRecording(true);
    } else {
      await chrome.runtime.sendMessage({ target: 'helium-offscreen', type: 'stop' });
      // setRecording(false) happens when the recording lands (or on error below).
    }
  } catch (e) {
    statusEl.textContent = '⚠️ ' + (e && e.message || e);
    statusEl.classList.add('err');
    setRecording(false);
  }
});

// Recording results + errors arrive via runtime messages from the offscreen doc.
chrome.runtime.onMessage.addListener(async (msg) => {
  if (!msg) return;
  if (msg.type === 'helium-recording-done') {
    setRecording(false);
    try {
      const rec = {
        id: 'rec-' + Date.now(),
        name: 'Voice note ' + new Date().toLocaleString(),
        mimeType: msg.mimeType || 'audio/webm',
        dataUrl: msg.dataUrl,
        durationMs: msg.durationMs || 0,
        createdAt: Date.now()
      };
      await dbPut(rec);
      statusEl.textContent = 'Saved! Pick a pitch and press play.';
      statusEl.classList.remove('err');
      renderList();
    } catch (e) {
      statusEl.textContent = '⚠️ Could not save recording: ' + e.message;
      statusEl.classList.add('err');
    }
  }
  if (msg.type === 'helium-error') {
    setRecording(false);
    statusEl.textContent = '⚠️ Mic error: ' + msg.message + ' (grant microphone access and retry)';
    statusEl.classList.add('err');
  }
});

/* ---------- pitch-shifted playback ---------- */
function pitchName(p) {
  if (p <= 0.7) return 'Deep';
  if (p <= 0.9) return 'Low';
  if (p <= 1.1) return 'Normal';
  if (p <= 1.7) return 'Helium';
  return 'Squeak';
}

function setPitch(p) {
  pitch = p;
  pitchSlider.value = Math.round(p * 100);
  pitchLabel.textContent = pitchName(p) + ' · ' + p.toFixed(2) + '×';
  document.querySelectorAll('.chip[data-pitch]').forEach((c) =>
    c.classList.toggle('active', Number(c.dataset.pitch) === Math.round(p * 100)));
  chrome.storage.local.set({ pitch: p });
}

pitchSlider.addEventListener('input', () => setPitch(Number(pitchSlider.value) / 100));
document.querySelectorAll('.chip[data-pitch]').forEach((c) =>
  c.addEventListener('click', () => setPitch(Number(c.dataset.pitch) / 100)));

function dataUrlToBuffer(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function playRecording(rec) {
  try {
    if (currentSource) { try { currentSource.stop(); } catch (e) {} currentSource = null; }
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const audioBuf = await audioCtx.decodeAudioData(dataUrlToBuffer(rec.dataUrl));
    const src = audioCtx.createBufferSource();
    src.buffer = audioBuf;
    src.playbackRate.value = pitch;   // the honest chipmunk trick: pitch + tempo
    src.connect(audioCtx.destination);
    src.onended = () => { if (currentSource === src) currentSource = null; };
    currentSource = src;
    src.start();
    statusEl.textContent = '▶ Playing at ' + pitchName(pitch) + ' pitch (' + pitch.toFixed(2) + '×)…';
    statusEl.classList.remove('err');
  } catch (e) {
    statusEl.textContent = '⚠️ Playback failed: ' + e.message;
    statusEl.classList.add('err');
  }
}

/* ---------- recordings list ---------- */
const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const DL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

async function renderList() {
  const recs = (await dbAll()).sort((a, b) => b.createdAt - a.createdAt);
  countEl.textContent = recs.length ? recs.length + '' : '';
  listEl.innerHTML = '';
  if (!recs.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'No recordings yet. Hit Record and say something silly.';
    listEl.appendChild(p);
    return;
  }
  recs.forEach((rec) => {
    const card = document.createElement('div');
    card.className = 'card';

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = rec.name;
    const sub = document.createElement('div');
    sub.className = 'sub2';
    sub.textContent = fmtTime(rec.durationMs) + ' · ' + new Date(rec.createdAt).toLocaleDateString();
    meta.appendChild(name);
    meta.appendChild(sub);

    const play = document.createElement('button');
    play.className = 'icon-btn';
    play.title = 'Play at current pitch (' + pitchName(pitch) + ')';
    play.innerHTML = PLAY_SVG;
    play.addEventListener('click', () => playRecording(rec));

    const dl = document.createElement('button');
    dl.className = 'icon-btn';
    dl.title = 'Download audio file';
    dl.innerHTML = DL_SVG;
    dl.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = rec.dataUrl;
      a.download = rec.id + '.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    const del = document.createElement('button');
    del.className = 'icon-btn danger';
    del.title = 'Delete';
    del.innerHTML = TRASH_SVG;
    del.addEventListener('click', async () => {
      if (confirm('Delete this recording?')) { await dbDel(rec.id); renderList(); }
    });

    card.appendChild(meta);
    card.appendChild(play);
    card.appendChild(dl);
    card.appendChild(del);
    listEl.appendChild(card);
  });
}

chrome.storage.local.get({ pitch: 1.0 }, (prefs) => {
  setPitch(Number(prefs.pitch) || 1.0);
  renderList();
});
