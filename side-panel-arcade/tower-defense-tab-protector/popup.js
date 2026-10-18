/* TabGuard popup logic: shows best wave, launches the full game tab. */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Show the stored best wave (0 = none yet).
  chrome.storage.local.get({ bestWave: 0 }, (res) => {
    document.getElementById('bestWave').textContent =
      res.bestWave > 0 ? `Wave ${res.bestWave}` : '–';
  });

  // Open the full-page game in a new tab.
  document.getElementById('playBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('game.html') });
  });
});
