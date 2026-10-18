/* Side Panel Demo — action popup logic. Opens the stable side panel. */
'use strict';

const openBtn = document.getElementById('openBtn');
const statusEl = document.getElementById('status');

openBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      // Opens on the current tab; requires the sidePanel permission.
      await chrome.sidePanel.open({ tabId: tab.id });
    } else {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    }
    window.close();
  } catch (err) {
    statusEl.textContent = 'Could not open the side panel: ' + err.message;
    statusEl.classList.add('err');
  }
});
