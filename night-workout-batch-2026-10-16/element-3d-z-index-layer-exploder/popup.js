/* Popup controller — talks to the on-demand content script. */
'use strict';

const $ = (id) => document.getElementById(id);
let active = false;

/** Run an async fn against the active tab; returns [tab]. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ensure the content script is injected, then send a message. */
async function sendToPage(msg) {
  const tab = await activeTab();
  if (!tab || !tab.id || /^chrome/.test(tab.url || '')) {
    throw new Error('Not a scriptable page.');
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { __ping: true });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  }
  return chrome.tabs.sendMessage(tab.id, msg);
}

function readSettings() {
  return {
    tilt: +$('tilt').value,
    spread: +$('spread').value,
    spin: $('spin').getAttribute('aria-checked') === 'true'
  };
}

function setState(on) {
  active = on;
  $('explode').disabled = on;
  $('restore').disabled = !on;
}

async function applySettings() {
  if (!active) return;
  try { await sendToPage({ action: 'settings', ...readSettings() }); } catch (e) { /* page may have navigated */ }
}

$('tilt').addEventListener('input', () => { $('tiltVal').textContent = $('tilt').value + '°'; applySettings(); });
$('spread').addEventListener('input', () => { $('spreadVal').textContent = $('spread').value + 'px'; applySettings(); });
$('spin').addEventListener('click', () => {
  const el = $('spin');
  el.setAttribute('aria-checked', el.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
  applySettings();
});

$('explode').addEventListener('click', async () => {
  try {
    await sendToPage({ action: 'explode', ...readSettings() });
    setState(true);
  } catch (e) {
    alert('Could not start on this page: ' + e.message);
  }
});

$('restore').addEventListener('click', async () => {
  try { await sendToPage({ action: 'restore' }); } catch (e) { /* already gone */ }
  setState(false);
});

// Persist UI prefs.
chrome.storage.local.get(['lxTilt', 'lxSpread', 'lxSpin'], (s) => {
  if (s.lxTilt) { $('tilt').value = s.lxTilt; $('tiltVal').textContent = s.lxTilt + '°'; }
  if (s.lxSpread) { $('spread').value = s.lxSpread; $('spreadVal').textContent = s.lxSpread + 'px'; }
  if (typeof s.lxSpin === 'boolean') $('spin').setAttribute('aria-checked', String(s.lxSpin));
});
window.addEventListener('change', () => {
  chrome.storage.local.set({
    lxTilt: +$('tilt').value, lxSpread: +$('spread').value,
    lxSpin: $('spin').getAttribute('aria-checked') === 'true'
  });
});
