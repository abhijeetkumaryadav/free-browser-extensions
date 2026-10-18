// SteadyCursor popup — reads/writes settings, injects or removes the stabiliser.
'use strict';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

const DEFAULTS = { enabled: false, smoothing: 40, color: '#22d3ee', size: 32, magnify: false };

function setStatus(msg, ok) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('ok', !!ok);
}

// Send a message to the active tab's content script (injects it first if needed).
async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id == null) throw new Error('No active tab.');
  try {
    await chrome.tabs.sendMessage(tab.id, { kind: 'steadycursor-ping' });
  } catch {
    // Content script not present — inject it on demand (user gesture).
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await new Promise((r) => setTimeout(r, 150));
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

async function applySettings() {
  const settings = {
    enabled: $('enabled').checked,
    smoothing: Number($('smoothing').value),
    color: document.querySelector('.sw.active').dataset.c,
    size: Number($('size').value),
    magnify: $('magnify').checked,
  };
  await chrome.storage.local.set({ steadycursor: settings });
  try {
    await sendToTab({ kind: 'steadycursor-apply', settings });
    setStatus(settings.enabled ? 'Stabiliser active on this tab' : 'Stabiliser off — page restored', settings.enabled);
  } catch (e) {
    setStatus('Cannot run here (protected page).', false);
  }
}

async function init() {
  const { steadycursor } = await chrome.storage.local.get('steadycursor');
  const s = { ...DEFAULTS, ...(steadycursor || {}) };
  $('enabled').checked = s.enabled;
  $('smoothing').value = s.smoothing;
  $('smoothVal').textContent = s.smoothing + '%';
  $('size').value = s.size;
  $('sizeVal').textContent = s.size + 'px';
  $('magnify').checked = s.magnify;
  document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.dataset.c === s.color));

  $('smoothing').addEventListener('input', (e) => { $('smoothVal').textContent = e.target.value + '%'; });
  $('size').addEventListener('input', (e) => { $('sizeVal').textContent = e.target.value + 'px'; });
  $('smoothing').addEventListener('change', applySettings);
  $('size').addEventListener('change', applySettings);
  $('enabled').addEventListener('change', applySettings);
  $('magnify').addEventListener('change', applySettings);
  document.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.sw').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    applySettings();
  }));
  setStatus('Ready');
}

init().catch((e) => setStatus('Error: ' + e.message, false));
