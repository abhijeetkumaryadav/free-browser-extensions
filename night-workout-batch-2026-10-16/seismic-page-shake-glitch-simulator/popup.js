/* Seismic Page Shake — popup logic. Injects the shake content script on explicit
 * user click only; intensity persists via chrome.storage.local. 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);

function setStatus(text) { $('status').textContent = text; }

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectAndSend(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    setStatus('Open a normal web page (http/https) to shake it.');
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tab.id, message).catch(() => {
    setStatus('Could not reach the page. Reload the tab and try again.');
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get({ intensity: 5 });
  $('intensity').value = saved.intensity;
  $('intensityVal').textContent = saved.intensity;

  $('intensity').addEventListener('input', () => {
    $('intensityVal').textContent = $('intensity').value;
    chrome.storage.local.set({ intensity: Number($('intensity').value) });
  });

  $('start').addEventListener('click', async () => {
    setStatus('Shaking…');
    await injectAndSend({ type: 'sps-start', intensity: Number($('intensity').value) });
    setStatus('Shaking — click Stop to restore the page.');
  });

  $('stop').addEventListener('click', async () => {
    setStatus('Restoring…');
    await injectAndSend({ type: 'sps-stop' });
    setStatus('Idle — page is steady.');
  });
});
