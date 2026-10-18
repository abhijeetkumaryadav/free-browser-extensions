/* Geocities Rewind — popup logic.
 * Injects apply-geo.js / restore-geo.js into the active tab on explicit
 * user click. Requires "activeTab" + "scripting" only. */
'use strict';

const applyBtn = document.getElementById('applyBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusEl = document.getElementById('status');

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function inject(file) {
  const tab = await getActiveTab();
  if (!tab || tab.id == null) {
    throw new Error('No active tab found.');
  }
  const url = tab.url || '';
  if (!/^https?:|^file:/.test(url)) {
    throw new Error('Cannot style this page (browser or store pages are off-limits).');
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [file] });
}

applyBtn.addEventListener('click', async () => {
  applyBtn.disabled = true;
  try {
    await inject('apply-geo.js');
    setStatus('Page has been Geo-fied. Party like it\'s 1999.', 'ok');
  } catch (err) {
    setStatus('Could not style page: ' + err.message, 'err');
  } finally {
    applyBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  restoreBtn.disabled = true;
  try {
    await inject('restore-geo.js');
    setStatus('Page restored to its boring modern self.', 'ok');
  } catch (err) {
    setStatus('Could not restore page: ' + err.message, 'err');
  } finally {
    restoreBtn.disabled = false;
  }
});
