'use strict';
/* Popup controller: injects content.js into the active tab to toggle the
   wireframe overlay. Overlay state is detected on open so the button label
   always matches reality. */

const $ = (id) => document.getElementById(id);
const toggleBtn = $('toggle'), toggleLabel = $('toggleLabel'), statusEl = $('status');
const optLabels = $('optLabels'), optText = $('optText'), optMax = $('optMax'), maxVal = $('maxVal');

let active = false;

// Persist + restore preferences.
chrome.storage.local.get({ wfLabels: true, wfText: true, wfMax: 300 }, (s) => {
  optLabels.checked = s.wfLabels;
  optText.checked = s.wfText;
  optMax.value = s.wfMax;
  maxVal.textContent = s.wfMax;
});
for (const [el, key] of [[optLabels, 'wfLabels'], [optText, 'wfText']])
  el.addEventListener('change', () => chrome.storage.local.set({ [key]: el.checked }));
optMax.addEventListener('input', () => {
  maxVal.textContent = optMax.value;
  chrome.storage.local.set({ wfMax: +optMax.value });
});

function setStatus(msg, ok = false) {
  statusEl.textContent = msg;
  statusEl.classList.toggle('ok', ok);
}

function setActive(v, count = 0) {
  active = v;
  toggleLabel.textContent = v ? 'Remove wireframe' : 'Build wireframe';
  toggleBtn.classList.toggle('active', v);
  if (v) setStatus(`Wireframe on — ${count} boxes drawn. Page untouched; toggle to remove.`, true);
  else setStatus('Ready — click on any normal web page.');
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(tab) {
  return tab && tab.id != null && /^(https?|file):/.test(tab.url || '');
}

// On open: detect whether the overlay is already showing.
(async () => {
  const tab = await activeTab();
  if (!injectable(tab)) {
    setStatus('This page does not allow overlays (e.g. chrome:// or the new-tab page).');
    toggleBtn.disabled = true;
    return;
  }
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!document.getElementById('__wf_overlay_root'),
    });
    if (res.result) setActive(true);
  } catch { /* overlay check failed — leave default state */ }
})();

toggleBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!injectable(tab)) {
    setStatus('This page does not allow overlays (e.g. chrome:// or the new-tab page).');
    return;
  }
  const opts = { labels: optLabels.checked, text: optText.checked, max: +optMax.value };
  try {
    // Pass options into the page context first…
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (o) => { window.__wfOpts = o; },
      args: [opts],
    });
    // …then run the toggle engine (its completion value is returned).
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    const r = (res && res.result) || { active: false, count: 0 };
    setActive(!!r.active, r.count || 0);
  } catch (e) {
    setStatus('Could not draw the wireframe here: ' + (e.message || e));
  }
});
