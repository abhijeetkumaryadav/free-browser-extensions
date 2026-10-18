// popup.js — drives the 5-band EQ sliders and talks to the content script.
// Bands: 60 Hz, 230 Hz, 910 Hz, 3.6 kHz, 14 kHz. Each adjustable -12..+12 dB.

(function () {
  'use strict';

  const BANDS = [
    { freq: 60,    label: '60Hz'  },
    { freq: 230,   label: '230Hz' },
    { freq: 910,   label: '910Hz' },
    { freq: 3600,  label: '3.6k'  },
    { freq: 14000, label: '14k'   }
  ];

  const PRESETS = {
    flat:   [0, 0, 0, 0, 0],
    bass:   [8, 5, 0, -2, -4],
    vocal:  [-2, -1, 5, 7, 3],
    treble: [0, 0, -2, -6, -9]
  };

  const slidersEl = document.getElementById('sliders');
  const statusEl  = document.getElementById('status');
  const enabledEl = document.getElementById('enabled');
  const presetBtns = Array.from(document.querySelectorAll('.preset'));

  const sliders = [];

  function fmtDb(v) {
    return (v > 0 ? '+' : '') + v + ' dB';
  }

  // Build one vertical slider per band.
  BANDS.forEach((band, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'band';

    const db = document.createElement('div');
    db.className = 'db';
    db.textContent = '0 dB';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = -12; input.max = 12; input.step = 1; input.value = 0;
    input.setAttribute('aria-label', 'Band ' + band.label + ' gain in dB');
    input.addEventListener('input', () => {
      db.textContent = fmtDb(Number(input.value));
      markPreset('custom');
      debounceApply();
    });

    const freq = document.createElement('div');
    freq.className = 'freq';
    freq.textContent = band.label;

    wrap.appendChild(db);
    wrap.appendChild(input);
    wrap.appendChild(freq);
    slidersEl.appendChild(wrap);
    sliders.push({ input, db });
  });

  function markPreset(name) {
    presetBtns.forEach(b => b.classList.toggle('active', b.dataset.preset === name));
  }

  function collectState() {
    return {
      bands: sliders.map(s => Number(s.input.value)),
      enabled: enabledEl.checked
    };
  }

  function paintState(state) {
    state.bands.forEach((db, i) => {
      sliders[i].input.value = db;
      sliders[i].db.textContent = fmtDb(db);
    });
    enabledEl.checked = state.enabled;
    markPreset(state.preset || 'custom');
  }

  // Inject the content script if the tab has none yet (e.g. new tab).
  async function ensureContent(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'eq', type: 'ping' });
    } catch (e) {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    }
  }

  async function getState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.url.startsWith('chrome://')) {
        statusEl.textContent = 'Equalizer is not available on browser pages.';
        return;
      }
      await ensureContent(tab.id);
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'eq', type: 'get-state' });
      if (resp && resp.state) {
        paintState(resp.state);
        statusEl.textContent = 'Ready — EQ ' + (resp.state.enabled ? 'on' : 'off') + '.';
      }
    } catch (e) {
      statusEl.textContent = 'Could not reach this tab. Refresh the page and try again.';
    }
  }

  let timer = null;
  function debounceApply() {
    clearTimeout(timer);
    timer = setTimeout(apply, 120);
  }

  async function apply(preset) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const s = collectState();
      await ensureContent(tab.id);
      const resp = await chrome.tabs.sendMessage(tab.id, {
        action: 'eq', type: 'apply',
        bands: s.bands, enabled: s.enabled, preset: preset || 'custom'
      });
      if (resp && resp.ok) {
        statusEl.textContent = 'Applied — EQ ' + (s.enabled ? 'on' : 'off') + '.';
      }
    } catch (e) {
      statusEl.textContent = 'Could not apply. Refresh the page and try again.';
    }
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const bands = PRESETS[preset];
      bands.forEach((db, i) => {
        sliders[i].input.value = db;
        sliders[i].db.textContent = fmtDb(db);
      });
      markPreset(preset);
      apply(preset);
    });
  });

  enabledEl.addEventListener('change', () => apply('custom'));

  getState();
})();
