/* Screen Crack Prank popup logic — draws or removes the fake crack overlay. */
'use strict';

const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

/* Guard: pranks cannot run on browser-internal pages. */
async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) throw new Error('No active tab found.');
  if (/^chrome:\/\//.test(tab.url || '')) {
    throw new Error('Pranks cannot run on browser-internal pages.');
  }
  return tab.id;
}

document.getElementById('crack').addEventListener('click', async () => {
  setStatus('Cracking…');
  try {
    const tabId = await activeTabId();
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    setStatus('Cracked! Press Esc on the page or Remove cracks to undo.');
  } catch (err) {
    setStatus('Could not crack: ' + (err && err.message ? err.message : err));
  }
});

document.getElementById('remove').addEventListener('click', async () => {
  setStatus('Removing cracks…');
  try {
    const tabId = await activeTabId();
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (window.__crackPrankExit) window.__crackPrankExit();
        return !!window.__crackPrankActive;
      }
    });
    setStatus('Cracks removed.');
  } catch (err) {
    setStatus('Could not remove: ' + (err && err.message ? err.message : err));
  }
});
