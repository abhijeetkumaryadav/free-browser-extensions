// TypoStorm popup logic — slider + toggle, intensity remembered per install.
(() => {
  'use strict';

  const slider = document.getElementById('intensity');
  const intensityVal = document.getElementById('intensityVal');
  const toggleBtn = document.getElementById('toggleBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const statusDot = document.getElementById('statusDot');
  const statLine = document.getElementById('statLine');

  const DEFAULT_INTENSITY = 25;

  /** Ensure content.js is present in the active tab, then run `fn`. */
  async function withContent(tabId, fn) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (err) {
      if (!String(err && err.message).includes('already')) throw err;
    }
    return fn();
  }

  /** Ask the tab for its typo state (null when injection is blocked). */
  async function queryState(tabId) {
    try {
      const res = await withContent(tabId, () =>
        chrome.tabs.sendMessage(tabId, { action: 'typo-status' }));
      return res || null;
    } catch {
      return null; // e.g. chrome:// pages
    }
  }

  function render(state) {
    const active = state && state.active === true;
    statusDot.classList.toggle('on', active);
    if (state === null) {
      toggleBtn.textContent = 'Not available on this page';
      toggleBtn.disabled = true;
      restoreBtn.disabled = true;
      statLine.textContent = '';
      return;
    }
    toggleBtn.disabled = false;
    if (active) {
      toggleBtn.textContent = 'TypoStorm is ON — turn off';
      toggleBtn.classList.add('off');
      restoreBtn.disabled = false;
      statLine.textContent = `${state.count} text nodes typofied. Click again to add more chaos, or restore.`;
    } else {
      toggleBtn.textContent = 'Typofy this page';
      toggleBtn.classList.remove('off');
      restoreBtn.disabled = true;
      statLine.textContent = '';
    }
  }

  async function currentTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab && tab.id;
  }

  async function refresh() {
    const tabId = await currentTabId();
    if (tabId == null) return render(null);
    render(await queryState(tabId));
  }

  toggleBtn.addEventListener('click', async () => {
    const tabId = await currentTabId();
    if (tabId == null) return;
    const state = await queryState(tabId);
    const intensity = parseInt(slider.value, 10) || DEFAULT_INTENSITY;
    const action = state && state.active ? 'typo-off' : 'typo-on';
    try {
      await withContent(tabId, () =>
        chrome.tabs.sendMessage(tabId, { action, intensity }));
    } catch { /* restricted page */ }
    refresh();
  });

  restoreBtn.addEventListener('click', async () => {
    const tabId = await currentTabId();
    if (tabId == null) return;
    try {
      await withContent(tabId, () =>
        chrome.tabs.sendMessage(tabId, { action: 'typo-off' }));
    } catch { /* restricted page */ }
    refresh();
  });

  // Remember the slider position across popup opens.
  slider.addEventListener('input', () => {
    intensityVal.textContent = `${slider.value}%`;
    chrome.storage.local.set({ typoIntensity: slider.value }).catch(() => {});
  });

  (async () => {
    try {
      const { typoIntensity } = await chrome.storage.local.get('typoIntensity');
      if (typoIntensity) {
        slider.value = typoIntensity;
        intensityVal.textContent = `${typoIntensity}%`;
      }
    } catch { /* storage unavailable; keep default */ }
    refresh();
  })();
})();
