/* FrameStep — popup logic.
 * Injects stepper.js into the active tab on demand (activeTab grant),
 * then sends it commands and renders the readout. */

'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  status: $('status'), timeVal: $('timeVal'), frameVal: $('frameVal'),
  videoVal: $('videoVal'), fps: $('fps'),
  btnBack: $('btnBack'), btnFwd: $('btnFwd'), btnPlay: $('btnPlay'),
  iconPlay: $('iconPlay'), iconPause: $('iconPause'), btnCapture: $('btnCapture')
};

let tabId = null;
let pollTimer = null;

/** Ensure the content script is present in the active tab, then run fn. */
async function withTab(fn) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) throw new Error('No active tab.');
  tabId = tab.id;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['stepper.js'] });
  } catch (err) {
    // Script may already be injected; ignore "already exists" style errors.
    if (!/already/i.test(String(err && err.message))) throw err;
  }
  return fn(tabId);
}

function send(cmd, extra = {}) {
  return withTab((id) =>
    chrome.tabs.sendMessage(id, { target: 'framestep', cmd, ...extra })
  );
}

function setStatus(live, text) {
  els.status.textContent = text;
  els.status.classList.toggle('live', live);
}

function render(snap) {
  if (!snap || !snap.found) {
    setStatus(false, 'no video');
    els.timeVal.textContent = '--:--.---';
    els.frameVal.textContent = '—';
    els.videoVal.textContent = 'none';
    return;
  }
  setStatus(true, snap.paused ? 'paused' : 'playing');
  els.timeVal.textContent = snap.timeStr;
  const fps = Number(els.fps.value) || 30;
  els.frameVal.textContent = String(Math.round(snap.time * fps));
  els.videoVal.textContent = snap.src ? 'found' : 'found';
  els.iconPlay.classList.toggle('hidden', !snap.paused);
  els.iconPause.classList.toggle('hidden', snap.paused);
}

async function refresh() {
  try {
    const snap = await send('status');
    render(snap);
  } catch (err) {
    setStatus(false, 'unavailable');
  }
}

async function step(dir) {
  try {
    const snap = await send('step', { dir, fps: Number(els.fps.value) || 30 });
    render(snap);
  } catch (err) { /* ignore transient errors */ }
}

async function capture() {
  try {
    const res = await send('capture');
    if (!res || !res.ok) throw new Error((res && res.error) || 'Capture failed');
    // Convert data URL -> download via the downloads API (user-initiated).
    const dl = await chrome.downloads.download({
      url: res.dataUrl,
      filename: `framestep-${(res.timeStr || 'frame').replace(/[:.]/g, '-')}.png`,
      saveAs: false
    });
    if (dl == null) throw new Error('Download blocked');
  } catch (err) {
    setStatus(false, 'capture failed');
  }
}

// Wire up UI.
els.btnBack.addEventListener('click', () => step(-1));
els.btnFwd.addEventListener('click', () => step(1));
els.btnPlay.addEventListener('click', async () => {
  try { render(await send('toggle')); } catch (err) { /* ignore */ }
});
els.btnCapture.addEventListener('click', capture);
els.fps.addEventListener('change', async () => {
  await chrome.storage.local.set({ fps: Number(els.fps.value) });
  refresh();
});

// Restore saved fps, initial status, and live polling while open.
(async () => {
  const { fps } = await chrome.storage.local.get({ fps: 30 });
  els.fps.value = String(fps);
  await refresh();
  pollTimer = setInterval(refresh, 500);
})();
window.addEventListener('unload', () => clearInterval(pollTimer));
