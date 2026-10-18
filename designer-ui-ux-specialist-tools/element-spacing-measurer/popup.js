// Element Spacing Measurer — popup logic
// Talks to the injected content script (measure mode) and renders results + history.

'use strict';

const $ = (id) => document.getElementById(id);

const measureBtn = $('measureBtn');
const statusRow = $('statusRow');
const statusText = $('statusText');
const resultPanel = $('resultPanel');
const clearBtn = $('clearBtn');
const historyList = $('historyList');
const historyClear = $('historyClear');

const HISTORY_KEY = 'esm_history';
const MAX_HISTORY = 12;

/* ---------- helpers ---------- */

// Get the active tab (guarded for non-tab contexts).
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// Is this a page we can inject into? (No chrome://, edge://, Web Store, etc.)
function isInjectable(url) {
  return !!url && /^(https?|file):/.test(url);
}

// Ensure the content script is present in the tab, then run fn.
async function withMeasureScript(tabId, fn) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'esm-ping' });
  } catch {
    // Not injected yet — inject now.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
  return fn();
}

/* ---------- history ---------- */

async function loadHistory() {
  const { [HISTORY_KEY]: items = [] } = await chrome.storage.local.get(HISTORY_KEY);
  renderHistory(items);
  return items;
}

function renderHistory(items) {
  historyList.innerHTML = '';
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No measurements yet.';
    historyList.appendChild(li);
    return;
  }
  for (const item of items) {
    const li = document.createElement('li');
    const dist = document.createElement('span');
    dist.className = 'h-dist';
    dist.textContent = `${item.diag} px`;
    const desc = document.createElement('span');
    desc.className = 'h-desc';
    desc.textContent = item.label;
    desc.title = item.label;
    li.append(dist, desc);
    historyList.appendChild(li);
  }
}

async function pushHistory(entry) {
  const items = await loadHistory();
  items.unshift(entry);
  const trimmed = items.slice(0, MAX_HISTORY);
  await chrome.storage.local.set({ [HISTORY_KEY]: trimmed });
  renderHistory(trimmed);
}

historyClear.addEventListener('click', async () => {
  await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  renderHistory([]);
});

/* ---------- result rendering ---------- */

function describeEl(info) {
  if (!info) return '—';
  const parts = [info.tag];
  if (info.id) parts.push('#' + info.id);
  if (info.cls) parts.push('.' + info.cls.split(' ').slice(0, 2).join('.'));
  return parts.join('');
}

function showResult({ a, b, h, v, diag }) {
  $('diagVal').textContent = diag;
  $('hVal').textContent = h;
  $('vVal').textContent = v;
  $('elA').innerHTML = '';
  $('elB').innerHTML = '';
  const chipA = document.createElement('b'); chipA.textContent = 'A';
  const chipB = document.createElement('b'); chipB.textContent = 'B';
  $('elA').append(chipA, document.createTextNode(describeEl(a)));
  $('elB').append(chipB, document.createTextNode(describeEl(b)));
  resultPanel.classList.remove('hidden');
}

/* ---------- measure flow ---------- */

function setMeasuring(active, text) {
  measureBtn.disabled = active;
  statusRow.classList.toggle('hidden', !active);
  if (text) statusText.textContent = text;
}

measureBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab || !isInjectable(tab.url)) {
    statusText.textContent = 'Cannot measure on this page (browser pages are restricted).';
    statusRow.classList.remove('hidden');
    return;
  }
  try {
    await withMeasureScript(tab.id, () =>
      chrome.tabs.sendMessage(tab.id, { type: 'esm-start' })
    );
    setMeasuring(true, 'Pick the first element…');
    window.close(); // Let the user interact with the page.
  } catch (err) {
    statusText.textContent = 'Could not start measuring: ' + err.message;
    statusRow.classList.remove('hidden');
  }
});

clearBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (tab && isInjectable(tab.url)) {
    try {
      await withMeasureScript(tab.id, () =>
        chrome.tabs.sendMessage(tab.id, { type: 'esm-clear' })
      );
    } catch { /* overlay may already be gone */ }
  }
  resultPanel.classList.add('hidden');
});

/* ---------- messages from the content script ---------- */

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'esm-progress') {
    setMeasuring(true, msg.text);
  } else if (msg.type === 'esm-done') {
    setMeasuring(false);
    showResult(msg);
    pushHistory({
      diag: msg.diag,
      label: `${describeEl(msg.a)} ↔ ${describeEl(msg.b)}`,
      at: Date.now(),
    });
  } else if (msg.type === 'esm-cancelled') {
    setMeasuring(false);
  }
});

// Sync UI with any live measuring state when the popup opens.
document.addEventListener('DOMContentLoaded', async () => {
  await loadHistory();
  // Restore the last completed measurement (popup closes while measuring).
  const { esm_last } = await chrome.storage.local.get('esm_last');
  if (esm_last && esm_last.type === 'esm-done') showResult(esm_last);
  const tab = await getActiveTab();
  if (tab && isInjectable(tab.url)) {
    try {
      const state = await withMeasureScript(tab.id, () =>
        chrome.tabs.sendMessage(tab.id, { type: 'esm-state' })
      );
      if (state && state.measuring) {
        setMeasuring(true, state.picks === 1 ? 'Pick the second element…' : 'Pick the first element…');
      }
    } catch { /* content script not running — nothing to sync */ }
  }
});
