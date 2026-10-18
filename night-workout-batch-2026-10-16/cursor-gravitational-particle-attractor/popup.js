/* Popup controller — talks to the on-demand content script. */
'use strict';

const $ = (id) => document.getElementById(id);
let running = false;

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

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

function settings() {
  return { gravity: +$('gravity').value, count: +$('count').value, trail: +$('trail').value };
}

function setState(on) {
  running = on;
  $('start').disabled = on;
  $('stop').disabled = !on;
}

async function pushSettings() {
  if (!running) return;
  try { await sendToPage({ action: 'settings', ...settings() }); } catch (e) { /* navigated away */ }
}

for (const [id, out] of [['gravity', 'gravityVal'], ['count', 'countVal'], ['trail', 'trailVal']]) {
  $(id).addEventListener('input', () => { $(out).textContent = $(id).value; pushSettings(); });
}

$('start').addEventListener('click', async () => {
  try {
    await sendToPage({ action: 'start', ...settings() });
    setState(true);
  } catch (e) {
    alert('Could not start on this page: ' + e.message);
  }
});

$('stop').addEventListener('click', async () => {
  try { await sendToPage({ action: 'stop' }); } catch (e) { /* already gone */ }
  setState(false);
});

// Persist prefs.
chrome.storage.local.get(['gpG', 'gpC', 'gpT'], (s) => {
  const apply = (id, out, v) => { if (v != null) { $(id).value = v; $(out).textContent = v; } };
  apply('gravity', 'gravityVal', s.gpG); apply('count', 'countVal', s.gpC); apply('trail', 'trailVal', s.gpT);
});
window.addEventListener('change', () => {
  chrome.storage.local.set({ gpG: +$('gravity').value, gpC: +$('count').value, gpT: +$('trail').value });
});
