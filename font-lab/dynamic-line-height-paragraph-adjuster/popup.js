/* LineEase popup logic — injects adjust-line-height.js on explicit user action only. */
'use strict';

const enabled = document.getElementById('enabled');
const height = document.getElementById('height');
const heightVal = document.getElementById('heightVal');
const previewText = document.getElementById('previewText');
const statusEl = document.getElementById('status');

function setStatus(text, on) {
  statusEl.textContent = text;
  statusEl.classList.toggle('on', !!on);
}

function refreshMeta() {
  heightVal.textContent = Number(height.value).toFixed(2);
  previewText.style.lineHeight = height.value;
}
height.addEventListener('input', refreshMeta);

function inject(fnName, args) {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (!tab || !tab.id) throw new Error('No active tab.');
    return chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['adjust-line-height.js']
    }).then(() => chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (...a) => window[fnName](...a),
      args
    }));
  });
}

function apply() {
  inject('applyLineHeight', [Number(height.value)])
    .then(() => setStatus('applied', true))
    .catch(() => setStatus('blocked page', false));
}

function remove() {
  inject('removeLineHeight', [])
    .then(() => setStatus('idle', false))
    .catch(() => setStatus('blocked page', false));
}

enabled.addEventListener('change', () => {
  chrome.storage.local.set({ lineEaseEnabled: enabled.checked });
  if (enabled.checked) apply(); else remove();
});

// Live-adjust while dragging, if already enabled.
let debounce = null;
height.addEventListener('input', () => {
  chrome.storage.local.set({ lineEaseValue: Number(height.value) });
  if (!enabled.checked) return;
  clearTimeout(debounce);
  debounce = setTimeout(apply, 250);
});

document.getElementById('restore').addEventListener('click', () => {
  enabled.checked = false;
  chrome.storage.local.set({ lineEaseEnabled: false });
  remove();
});

// Restore saved prefs and probe the tab's current state.
chrome.storage.local.get({ lineEaseEnabled: false, lineEaseValue: 1.5 }, prefs => {
  enabled.checked = !!prefs.lineEaseEnabled;
  height.value = String(prefs.lineEaseValue);
  refreshMeta();
});
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (!tab || !tab.id) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => !!document.getElementById('lineease-override-style')
  }).then(([res]) => {
    if (res && res.result) { setStatus('applied', true); enabled.checked = true; }
  }).catch(() => {});
});
