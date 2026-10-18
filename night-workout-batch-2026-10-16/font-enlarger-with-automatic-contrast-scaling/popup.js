/* Font Enlarger + Auto Contrast — popup logic.
 * Sends apply/reset/status messages to the active tab's content script and
 * manages presets + per-site memory in chrome.storage.local. */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scaleEl = $('scale'), scaleVal = $('scaleVal');
  const targetEl = $('target'), targetVal = $('targetVal');
  const contrastOnEl = $('contrastOn'), rememberEl = $('remember');
  const applyBtn = $('applyBtn'), resetBtn = $('resetBtn');
  const statusEl = $('status');
  const presetBtns = Array.from(document.querySelectorAll('#presets .chip'));

  const PRESETS = {
    off:         { scale: 100, contrastOn: false, target: 4.5 },
    comfortable: { scale: 120, contrastOn: true,  target: 4.5 },
    large:       { scale: 140, contrastOn: true,  target: 4.5 },
    xl:          { scale: 170, contrastOn: true,  target: 7.0 }
  };

  function settings() {
    return {
      scale: +scaleEl.value,
      target: +targetEl.value,
      contrastOn: contrastOnEl.checked
    };
  }

  function paint() {
    scaleVal.textContent = scaleEl.value + '%';
    targetVal.textContent = (+targetEl.value).toFixed(1) + ' : 1';
  }

  function markPreset() {
    const s = settings();
    let matched = null;
    for (const [name, p] of Object.entries(PRESETS)) {
      if (p.scale === s.scale && p.contrastOn === s.contrastOn && p.target === s.target) {
        matched = name; break;
      }
    }
    presetBtns.forEach((b) => b.classList.toggle('active', b.dataset.preset === matched));
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch { return ''; }
  }

  async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function send(action, extra) {
    const tab = await activeTab();
    if (!tab || !tab.id) throw new Error('No active tab.');
    if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || '')) {
      throw new Error('Cannot run on browser system pages.');
    }
    // Ensure the content script is present (manifest auto-injects, but be safe)
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch { /* already injected — ignore */ }
    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'feac', action, ...(extra || {}) });
    if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'No response from page.');
    return resp;
  }

  function setStatus(txt) { statusEl.textContent = txt; }

  async function refreshStatus() {
    try {
      const r = await send('status');
      setStatus(r.applied ? 'Applied on this page.' : 'Not applied on this page.');
    } catch {
      setStatus('Not applied on this page.');
    }
  }

  async function persistSite() {
    const tab = await activeTab();
    const host = tab && tab.url ? hostOf(tab.url) : '';
    const { sites } = await chrome.storage.local.get(['sites']);
    const map = sites || {};
    if (rememberEl.checked && host) {
      map[host] = { ...settings(), enabled: true };
    } else if (host && map[host]) {
      delete map[host];
    }
    await chrome.storage.local.set({ sites: map, lastSettings: settings() });
  }

  applyBtn.addEventListener('click', async () => {
    try {
      await send('apply', { settings: settings() });
      await persistSite();
      setStatus('Applied on this page.');
    } catch (e) {
      setStatus('Could not apply: ' + (e.message || e));
    }
  });

  resetBtn.addEventListener('click', async () => {
    try {
      await send('reset');
      setStatus('Page restored.');
    } catch (e) {
      setStatus('Could not reset: ' + (e.message || e));
    }
  });

  presetBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const p = PRESETS[b.dataset.preset];
      if (!p) return;
      scaleEl.value = p.scale;
      targetEl.value = p.target;
      contrastOnEl.checked = p.contrastOn;
      paint(); markPreset();
    });
  });

  [scaleEl, targetEl].forEach((el) => el.addEventListener('input', () => { paint(); markPreset(); }));
  contrastOnEl.addEventListener('change', markPreset);

  // Restore last-used settings + per-site remember state
  (async () => {
    try {
      const { lastSettings, sites } = await chrome.storage.local.get(['lastSettings', 'sites']);
      if (lastSettings) {
        scaleEl.value = lastSettings.scale;
        targetEl.value = lastSettings.target;
        contrastOnEl.checked = lastSettings.contrastOn !== false;
      }
      const tab = await activeTab();
      const host = tab && tab.url ? hostOf(tab.url) : '';
      rememberEl.checked = !!(host && sites && sites[host]);
      paint(); markPreset();
      refreshStatus();
    } catch { paint(); markPreset(); }
  })();
})();
