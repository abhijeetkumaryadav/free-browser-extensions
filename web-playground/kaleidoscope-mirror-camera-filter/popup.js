/* Popup: opens the full-page camera surface. */
'use strict';
document.getElementById('openBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('camera.html') });
  window.close();
});
