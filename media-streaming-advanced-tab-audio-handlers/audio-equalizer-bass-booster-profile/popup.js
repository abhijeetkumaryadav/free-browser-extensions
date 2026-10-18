/* BassLab — popup logic.
 * Flow: user clicks Enable -> background ensures the offscreen document ->
 * offscreen calls chrome.tabCapture.capture (user-gesture chain) and builds
 * the WebAudio EQ graph. Sliders/presets send gain updates to the offscreen doc.
 */

'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  status: $('status'), btnToggle: $('btnToggle'), enableHint: $('enableHint'),
  eqCard: $('eqCard'), bands: $('bands'), presets: $('presets'),
  bypass: $('bypass'), btnReset: $('btnReset')
};

// Band labels must match offscreen.js BANDS order.
const BAND_LABELS = ['60 Hz', '230 Hz', '910 Hz', '3.6 kHz', '14 kHz'];

const PRESETS = {
  flat:   [0, 0, 0, 0, 0],
  bass:   [8, 5, 0, -1, 1],
  vocal:  [-2, 1, 4, 5, 2],
  treble: [-3, -1, 1, 5, 7]
};

let gains = [...PRESETS.bass];
let enabled = false;
let currentTabId = null;

function bg(msg) {
  return chrome.runtime.sendMessage({ target: 'basslab-bg', ...msg });
}
function os(msg) {
  return chrome.runtime.sendMessage({ target: 'basslab-offscreen', ...msg });
}

function setStatus(live, text) {
  els.status.textContent = text;
  els.status.classList.toggle('live', live);
}

/** Build the vertical slider UI for the 5 bands. */
function buildBands() {
  els.bands.innerHTML = '';
  BAND_LABELS.forEach((label, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'band';
    const db = document.createElement('span');
    db.className = 'db';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '-12'; slider.max = '12'; slider.step = '1';
    slider.value = String(gains[i]);
    slider.setAttribute('aria-label', label + ' gain');
    const freq = document.createElement('span');
    freq.className = 'freq';
    freq.textContent = label;
    const paint = () => { db.textContent = (gains[i] > 0 ? '+' : '') + gains[i] + 'dB'; };
    paint();
    slider.addEventListener('input', async () => {
      gains[i] = Number(slider.value);
      paint();
      markCustomPreset();
      try { await os({ cmd: 'setGains', gains }); } catch (e) { /* offscreen busy */ }
      chrome.storage.local.set({ gains });
    });
    wrap.append(db, slider, freq);
    els.bands.appendChild(wrap);
  });
}

function markCustomPreset() {
  els.presets.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
}

function applyPreset(name) {
  gains = [...PRESETS[name]];
  buildBands();
  els.presets.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.preset === name));
  os({ cmd: 'setGains', gains }).catch(() => {});
  chrome.storage.local.set({ gains, preset: name });
}

async function refreshState() {
  try {
    await bg({ cmd: 'ensure-offscreen' });
    const st = await os({ cmd: 'state' });
    enabled = !!(st && st.active);
  } catch (e) {
    enabled = false;
  }
  els.eqCard.setAttribute('aria-disabled', String(!enabled));
  els.btnToggle.textContent = enabled ? 'Disable EQ (restore tab audio)' : 'Enable EQ on this tab';
  els.btnToggle.classList.toggle('stop', enabled);
  els.enableHint.textContent = enabled
    ? 'EQ is live on this tab. Disable to restore the original audio path.'
    : 'Click to route this tab\u2019s audio through the equalizer. One click per tab — Chrome asks for permission each time.';
  setStatus(enabled, enabled ? 'live' : 'off');
}

async function toggle() {
  try {
    await bg({ cmd: 'ensure-offscreen' });
    if (!enabled) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) throw new Error('no tab');
      currentTabId = tab.id;
      const res = await os({ cmd: 'start', tabId: currentTabId });
      if (!res || !res.ok) throw new Error((res && res.error) || 'start failed');
      await os({ cmd: 'setGains', gains });
      const { bypass } = await chrome.storage.local.get({ bypass: false });
      els.bypass.checked = bypass;
      await os({ cmd: 'setBypass', bypass });
    } else {
      await os({ cmd: 'stop' });
    }
  } catch (err) {
    setStatus(false, 'error');
    els.enableHint.textContent = 'Could not capture tab audio: ' +
      String((err && err.message) || err) +
      ' (DRM-protected players and silent tabs may refuse capture).';
  }
  refreshState();
}

// Wire up UI.
els.btnToggle.addEventListener('click', toggle);
els.presets.querySelectorAll('.chip').forEach((c) =>
  c.addEventListener('click', () => applyPreset(c.dataset.preset)));
els.bypass.addEventListener('change', async () => {
  const bypass = els.bypass.checked;
  chrome.storage.local.set({ bypass });
  try { await os({ cmd: 'setBypass', bypass }); } catch (e) { /* ignore */ }
});
els.btnReset.addEventListener('click', () => applyPreset('flat'));

// Init: restore saved gains, build UI, sync state.
(async () => {
  const saved = await chrome.storage.local.get({ gains: PRESETS.bass, preset: 'bass' });
  gains = saved.gains.slice(0, 5).map((g) => Math.max(-12, Math.min(12, Number(g) || 0)));
  buildBands();
  els.presets.querySelectorAll('.chip').forEach((c) =>
    c.classList.toggle('active', c.dataset.preset === saved.preset));
  await refreshState();
})();
