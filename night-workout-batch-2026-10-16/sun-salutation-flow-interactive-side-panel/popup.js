/* Sun Salutation Flow — popup launcher logic (stable chrome.sidePanel API). */
(function () {
  'use strict';

  const openBtn = document.getElementById('openPanel');
  const statusEl = document.getElementById('status');

  openBtn.addEventListener('click', async () => {
    statusEl.textContent = '';
    try {
      if (!chrome.sidePanel || typeof chrome.sidePanel.open !== 'function') {
        statusEl.textContent = 'Side panel API is not available in this browser.';
        return;
      }
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const options = {};
      if (tab && typeof tab.windowId === 'number') options.windowId = tab.windowId;
      await chrome.sidePanel.open(options);
      window.close();
    } catch (err) {
      statusEl.textContent = 'Could not open the side panel: ' + (err && err.message ? err.message : err);
    }
  });
})();
