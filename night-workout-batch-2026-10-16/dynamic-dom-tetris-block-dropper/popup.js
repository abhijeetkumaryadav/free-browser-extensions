/* DOM Tetris popup logic — injects or removes the overlay game on the active tab. */
'use strict';

const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

/* Run a function in the active tab's page context. */
async function runInTab(func, args) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) throw new Error('No active tab found.');
  if (/^chrome:\/\//.test(tab.url || '')) {
    throw new Error('Games cannot run on browser-internal pages.');
  }
  return chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func,
    args: args || []
  });
}

document.getElementById('play').addEventListener('click', async () => {
  setStatus('Starting game…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) throw new Error('No active tab found.');
    if (/^chrome:\/\//.test(tab.url || '')) {
      throw new Error('Games cannot run on browser-internal pages.');
    }
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    setStatus('Game started on this tab.');
  } catch (err) {
    setStatus('Could not start: ' + (err && err.message ? err.message : err));
  }
});

document.getElementById('remove').addEventListener('click', async () => {
  setStatus('Removing game…');
  try {
    await runInTab(() => {
      if (window.__domTetrisExit) window.__domTetrisExit();
      return !!window.__domTetrisActive;
    });
    setStatus('Game removed.');
  } catch (err) {
    setStatus('Could not remove: ' + (err && err.message ? err.message : err));
  }
});
