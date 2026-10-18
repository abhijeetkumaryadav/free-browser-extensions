// Paid Ad Tier Result Stripper — popup logic.
// Injects content.js on explicit click only (activeTab + scripting), talks to
// it via runtime messages, and keeps a lifetime stripped counter.

'use strict';

const scanBtn = document.getElementById('scanBtn');
const restoreBtn = document.getElementById('restoreBtn');
const statusEl = document.getElementById('status');
const flagList = document.getElementById('flagList');
const lifetimeEl = document.getElementById('lifetime');

// Pages the extension cannot touch.
function isRestricted(url) {
  return !url || /^(chrome|chrome-extension|edge|about|view-source|devtools):\/\//i.test(url);
}

// Load the lifetime counter from local storage.
async function loadLifetime() {
  const { lifetime = 0 } = await chrome.storage.local.get('lifetime');
  lifetimeEl.textContent = lifetime;
}

// Inject the content script (idempotent, boot-once) then send it a message.
async function withContentScript(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || isRestricted(tab.url)) {
    statusEl.textContent = 'Cannot run on this page (browser or internal page).';
    return null;
  }
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  return chrome.tabs.sendMessage(tab.id, { type });
}

function renderFlags(flagged) {
  flagList.innerHTML = '';
  if (!flagged.length) {
    flagList.hidden = true;
    return;
  }
  flagList.hidden = false;
  for (const item of flagged) {
    const li = document.createElement('li');
    const title = document.createElement('div');
    title.className = 'flag-title';
    title.textContent = item.title;
    const reason = document.createElement('div');
    reason.className = 'flag-reason';
    reason.textContent = 'why: ' + item.reason;
    li.append(title, reason);
    flagList.appendChild(li);
  }
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusEl.textContent = 'Scanning…';
  try {
    const res = await withContentScript('ADTIER_SCAN');
    if (!res) return;
    renderFlags(res.flagged);
    statusEl.textContent = res.flagged.length
      ? `Collapsed ${res.flagged.length} paid-ad result${res.flagged.length === 1 ? '' : 's'}. Review the list.`
      : 'No paid-ad results found. Page left untouched.';
    const { lifetime = 0 } = await chrome.storage.local.get('lifetime');
    await chrome.storage.local.set({ lifetime: lifetime + res.flagged.length });
    loadLifetime();
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    scanBtn.disabled = false;
  }
});

restoreBtn.addEventListener('click', async () => {
  restoreBtn.disabled = true;
  statusEl.textContent = 'Restoring…';
  try {
    const res = await withContentScript('ADTIER_RESTORE');
    if (!res) return;
    renderFlags([]);
    statusEl.textContent = res.restored
      ? `Restored ${res.restored} result${res.restored === 1 ? '' : 's'} exactly.`
      : 'Nothing to restore.';
  } catch (err) {
    statusEl.textContent = 'Error: ' + err.message;
  } finally {
    restoreBtn.disabled = false;
  }
});

loadLifetime();
