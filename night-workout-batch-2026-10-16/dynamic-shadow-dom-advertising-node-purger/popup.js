// Ad-Node Purger — popup logic.
'use strict';

const $ = (id) => document.getElementById(id);

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isScannable(tab) {
  return tab && tab.url && /^(https?|file):/.test(tab.url);
}

// Load saved preferences into the popup.
async function loadPrefs() {
  const res = await chrome.storage.local.get(['customSelectors', 'optShadow', 'optIframes']);
  $('customSelectors').value = (res.customSelectors || []).join('\n');
  $('optShadow').checked = res.optShadow !== false;
  $('optIframes').checked = res.optIframes !== false;
}

async function savePrefs() {
  const custom = $('customSelectors').value.split('\n').map(s => s.trim()).filter(Boolean);
  await chrome.storage.local.set({
    customSelectors: custom,
    optShadow: $('optShadow').checked,
    optIframes: $('optIframes').checked
  });
}

function setActive(on) {
  $('statusDot').classList.toggle('on', on);
  $('statusDot').title = on ? 'Purge active' : 'Not active';
  $('purgeBtn').disabled = on;
  $('restoreBtn').disabled = !on;
}

async function refreshState() {
  const tab = await activeTab();
  if (!isScannable(tab)) {
    $('purgeBtn').disabled = true;
    $('purgeBtn').textContent = 'Unavailable on this page';
    return;
  }
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ANP_STATE' });
    setActive(!!(res && res.active));
    $('hiddenCount').textContent = (res && res.hidden) || 0;
  } catch (e) {
    setActive(false); // content script not injected yet
  }
}

async function ensureInjected(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

$('purgeBtn').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!isScannable(tab)) return;
  await savePrefs();
  const prefs = await chrome.storage.local.get(['customSelectors', 'optShadow', 'optIframes']);
  try { await ensureInjected(tab.id); } catch (e) { /* already there */ }
  const res = await chrome.tabs.sendMessage(tab.id, {
    type: 'ANP_PURGE',
    options: {
      custom: prefs.customSelectors || [],
      shadow: prefs.optShadow !== false,
      iframes: prefs.optIframes !== false
    }
  });
  $('hiddenCount').textContent = res.hidden;
  $('shadowCount').textContent = res.shadow;
  setActive(res.hidden > 0);
});

$('restoreBtn').addEventListener('click', async () => {
  const tab = await activeTab();
  if (!isScannable(tab)) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'ANP_RESTORE' });
    $('hiddenCount').textContent = 0;
    $('shadowCount').textContent = 0;
    setActive(false);
  } catch (e) { /* tab closed or navigated */ }
});

$('saveSelectors').addEventListener('click', async () => {
  await savePrefs();
  $('saveSelectors').textContent = 'Saved ✓';
  setTimeout(() => { $('saveSelectors').textContent = 'Save selectors'; }, 1500);
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadPrefs();
  await refreshState();
});
