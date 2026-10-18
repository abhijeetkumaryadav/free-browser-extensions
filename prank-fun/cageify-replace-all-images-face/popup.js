// Cageify popup logic — injects content.js on demand, then toggles it.
(() => {
  'use strict';

  const toggleBtn = document.getElementById('toggleBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const statusDot = document.getElementById('statusDot');

  /** Ensure content.js is present in the active tab, then run `fn`. */
  async function withContent(tabId, fn) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
    } catch (err) {
      // Already injected in a previous click — safe to ignore.
      if (!String(err && err.message).includes('already')) throw err;
    }
    return fn();
  }

  /** Ask the tab whether cageify mode is currently on (null if unreachable). */
  async function queryState(tabId) {
    try {
      const res = await withContent(tabId, () =>
        chrome.tabs.sendMessage(tabId, { action: 'cageify-status' }));
      return !!(res && res.active);
    } catch {
      return null; // e.g. chrome:// pages where injection is blocked
    }
  }

  function render(active) {
    statusDot.classList.toggle('on', active === true);
    if (active === true) {
      toggleBtn.textContent = 'Cageify is ON — turn off';
      toggleBtn.classList.add('off');
      restoreBtn.disabled = false;
    } else {
      toggleBtn.textContent = 'Cageify this page';
      toggleBtn.classList.remove('off');
      restoreBtn.disabled = true;
    }
    if (active === null) {
      toggleBtn.textContent = 'Not available on this page';
      toggleBtn.disabled = true;
      restoreBtn.disabled = true;
    } else {
      toggleBtn.disabled = false;
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
    const active = await queryState(tabId);
    const action = active ? 'cageify-off' : 'cageify-on';
    try {
      await withContent(tabId, () => chrome.tabs.sendMessage(tabId, { action }));
    } catch { /* restricted page */ }
    refresh();
  });

  restoreBtn.addEventListener('click', async () => {
    const tabId = await currentTabId();
    if (tabId == null) return;
    try {
      await withContent(tabId, () =>
        chrome.tabs.sendMessage(tabId, { action: 'cageify-off' }));
    } catch { /* restricted page */ }
    refresh();
  });

  refresh();
})();
