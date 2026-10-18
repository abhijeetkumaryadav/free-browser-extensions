/* ChromaMark popup logic. */
'use strict';

const COLORS = [
  ['yellow', '#eab308'],
  ['green', '#22c55e'],
  ['blue', '#3b82f6'],
  ['pink', '#ec4899'],
  ['orange', '#f97316']
];
let defaultColor = 'yellow';
let tabId = null;

const $ = id => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function send(type, extra = {}) {
  return chrome.tabs.sendMessage(tabId, { type, ...extra });
}

function renderColorRow() {
  const row = $('colorRow');
  row.innerHTML = '';
  for (const [name, hex] of COLORS) {
    const dot = document.createElement('button');
    dot.className = 'color-dot' + (name === defaultColor ? ' selected' : '');
    dot.style.backgroundColor = hex;
    dot.title = name;
    dot.addEventListener('click', () => {
      defaultColor = name;
      chrome.storage.local.set({ cmDefaultColor: name });
      renderColorRow();
    });
    row.appendChild(dot);
  }
}

async function refreshList() {
  let list = [];
  try {
    const res = await send('CM_LIST');
    list = res.list || [];
  } catch (e) { /* content script not on this page */ }

  $('countBadge').textContent = list.length;
  $('emptyState').style.display = list.length ? 'none' : 'block';
  const ul = $('hlList');
  ul.innerHTML = '';
  const hexFor = name => (COLORS.find(c => c[0] === name) || COLORS[0])[1];

  for (const rec of list.slice().reverse()) {
    const li = document.createElement('li');
    li.className = 'hl-item';
    li.innerHTML =
      '<span class="hl-swatch" style="background:' + hexFor(rec.color) + '"></span>' +
      '<span class="hl-text" title="' + esc(rec.text) + '">' + esc(rec.text) + '</span>' +
      '<span class="hl-actions">' +
        '<button class="icon-btn jump" title="Jump to highlight">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>' +
        '</button>' +
        '<button class="icon-btn del" title="Delete highlight">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button>' +
      '</span>';
    li.querySelector('.jump').addEventListener('click', () => send('CM_JUMP', { id: rec.id }).catch(() => {}));
    li.querySelector('.del').addEventListener('click', async () => {
      await send('CM_DELETE', { id: rec.id }).catch(() => {});
      refreshList();
    });
    ul.appendChild(li);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab && tab.id;
  const stored = await chrome.storage.local.get('cmDefaultColor');
  if (stored.cmDefaultColor) defaultColor = stored.cmDefaultColor;
  renderColorRow();
  refreshList();

  $('quickBtn').addEventListener('click', async () => {
    if (tabId == null) return;
    try {
      const res = await send('CM_HIGHLIGHT_SELECTION', { color: defaultColor });
      if (!res || !res.ok) {
        $('hint').innerHTML = 'Select some text on the page first, then click again.';
      }
    } catch (e) {
      $('hint').innerHTML = 'ChromaMark can\'t run on this page (e.g. browser or store pages).';
    }
    refreshList();
  });

  $('clearBtn').addEventListener('click', async () => {
    if (tabId == null) return;
    await send('CM_CLEAR').catch(() => {});
    refreshList();
  });
});
