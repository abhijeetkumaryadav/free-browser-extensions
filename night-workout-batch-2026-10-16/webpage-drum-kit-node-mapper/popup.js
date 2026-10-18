/* Page Drum Kit — popup logic. Injects the drum-kit content script on explicit
 * user click only; settings persist via chrome.storage.local. 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);

const defaults = { pads: 8, vol: 70 };

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function injectAndSend(message) {
  const tab = await getActiveTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    setStatus('Open a normal web page (http/https) to use the drum kit.');
    return;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  await chrome.tabs.sendMessage(tab.id, message).catch(() => {
    setStatus('Could not reach the page. Reload the tab and try again.');
  });
}

function setStatus(text) { $('status').textContent = text; }

function syncLabels() {
  $('padsVal').textContent = $('pads').value;
  $('volVal').textContent = $('vol').value + '%';
}

document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get(defaults);
  $('pads').value = saved.pads;
  $('vol').value = saved.vol;
  syncLabels();

  $('pads').addEventListener('input', () => {
    syncLabels();
    chrome.storage.local.set({ pads: Number($('pads').value) });
  });
  $('vol').addEventListener('input', () => {
    syncLabels();
    chrome.storage.local.set({ vol: Number($('vol').value) });
  });

  $('start').addEventListener('click', async () => {
    setStatus('Starting… click page elements to play.');
    await injectAndSend({
      type: 'pdk-start',
      pads: Number($('pads').value),
      vol: Number($('vol').value) / 100
    });
    setStatus('Drum kit live — click elements on the page to drum.');
  });

  $('stop').addEventListener('click', async () => {
    setStatus('Clearing…');
    await injectAndSend({ type: 'pdk-stop' });
    setStatus('Idle — nothing on the page.');
  });
});
