// popup.js — Bullet Hell launcher. Starts/stops the game overlay on explicit click.
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DIFFS = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

  function refresh() { $('diffOut').textContent = DIFFS[$('diff').value]; }

  chrome.storage.local.get({ bhDiff: 'normal', bhHigh: 0 }, (s) => {
    $('diff').value = s.bhDiff; $('high').textContent = s.bhHigh; refresh();
  });
  $('diff').addEventListener('change', () => {
    chrome.storage.local.set({ bhDiff: $('diff').value }); refresh();
  });

  async function activeTab() {
    const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
    return t;
  }

  $('start').addEventListener('click', async () => {
    const tab = await activeTab();
    if (!tab || !/^https?:/.test(tab.url || '')) {
      $('status').textContent = 'open a normal web page first';
      return;
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (d) => window.__bulletHellStart && window.__bulletHellStart(d),
      args: [$('diff').value]
    });
    $('status').textContent = 'running — close this popup to play';
    $('start').disabled = true; $('stop').disabled = false;
  });

  $('stop').addEventListener('click', async () => {
    const tab = await activeTab();
    if (tab) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__bulletHellStop && window.__bulletHellStop()
      });
    }
    chrome.storage.local.get({ bhHigh: 0 }, (s) => { $('high').textContent = s.bhHigh; });
    $('status').textContent = 'idle';
    $('start').disabled = false; $('stop').disabled = true;
  });

  refresh();
})();
