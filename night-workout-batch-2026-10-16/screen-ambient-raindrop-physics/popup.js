/* Rain Overlay — popup logic. Persists settings, injects/removes the rain canvas. */
'use strict';

const DEFAULTS = { enabled: false, intensity: 5, wind: 2, ripples: true, splash: true };

const $ = (id) => document.getElementById(id);

/** Load saved settings into the controls. */
async function load() {
  const s = { ...DEFAULTS, ...(((await chrome.storage.local.get('rain'))).rain || {}) };
  $('intensity').value = s.intensity;
  $('intensityVal').textContent = s.intensity;
  $('wind').value = s.wind;
  $('windVal').textContent = s.wind;
  $('ripplesToggle').checked = s.ripples;
  $('splashToggle').checked = s.splash;
}

/** Read current control values. */
function readSettings() {
  return {
    intensity: Number($('intensity').value),
    wind: Number($('wind').value),
    ripples: $('ripplesToggle').checked,
    splash: $('splashToggle').checked,
  };
}

/** Save settings (merged with enabled flag). */
async function save(patch) {
  const cur = { ...DEFAULTS, ...(((await chrome.storage.local.get('rain'))).rain || {}) };
  await chrome.storage.local.set({ rain: { ...cur, ...patch } });
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Start: persist settings, mark enabled, inject the rain overlay. */
$('startBtn').addEventListener('click', async () => {
  await save({ ...readSettings(), enabled: true });
  const tab = await activeTab();
  if (!tab?.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['rain.js'] });
  window.close();
});

/** Stop: flag off, message the content script, and force-remove the host as fallback. */
$('stopBtn').addEventListener('click', async () => {
  await save({ enabled: false });
  const tab = await activeTab();
  if (tab?.id) {
    try { await chrome.tabs.sendMessage(tab.id, { type: 'rain-stop' }); } catch { /* not injected */ }
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { document.getElementById('rain-overlay-host')?.remove(); },
      });
    } catch { /* page not scriptable */ }
  }
  window.close();
});

/* Live-save control changes so the rain reacts without restarting. */
$('intensity').addEventListener('input', async (e) => {
  $('intensityVal').textContent = e.target.value;
  await save({ intensity: Number(e.target.value) });
});
$('wind').addEventListener('input', async (e) => {
  $('windVal').textContent = e.target.value;
  await save({ wind: Number(e.target.value) });
});
$('ripplesToggle').addEventListener('change', (e) => save({ ripples: e.target.checked }));
$('splashToggle').addEventListener('change', (e) => save({ splash: e.target.checked }));

load();
