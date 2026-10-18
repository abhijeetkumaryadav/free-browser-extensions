/* Z-Index Unstacker — popup: scan, render, highlight, clear. 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);
let items = [];

async function getTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ensure the content script is present, then run the scan. */
async function scan() {
  const tab = await getTab();
  $('list').innerHTML = '<div class="empty">Scanning…</div>';
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch (e) { /* may already be injected */ }
  const res = await chrome.tabs.sendMessage(tab.id, { type: 'zunstack-scan' });
  if (!res || !res.ok) {
    $('list').innerHTML = '<div class="empty">Could not scan this page (restricted page or error).</div>';
    return;
  }
  items = res.items;
  chrome.storage.local.set({ lastScan: items });
  render();
}

function matches(item) {
  const f = $('filter').value.trim().toLowerCase();
  if ($('onlyPos').checked && item.position === 'static') return false;
  if (!f) return true;
  return (item.selector || '').toLowerCase().includes(f);
}

function render() {
  const list = $('list');
  const filtered = items.filter(matches);
  const withZ = items.filter((i) => i.zNum !== null).length;
  const stacked = items.filter((i) => i.stacking).length;

  $('stats').innerHTML =
    `<div class="stat"><b>${items.length}</b><span>positioned</span></div>` +
    `<div class="stat"><b>${withZ}</b><span>explicit z</span></div>` +
    `<div class="stat"><b>${stacked}</b><span>stacking ctx</span></div>`;

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No elements match. Try clearing the filter.</div>';
    return;
  }
  for (const it of filtered.slice(0, 300)) {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML =
      `<span class="z">z: ${it.z}</span>` +
      `<span class="tag">${escapeHtml(it.selector)}</span>` +
      (it.stacking ? '<span class="badge">stacking context</span>' : '') +
      `<span class="meta">position: ${it.position} · ${it.rect.w}×${it.rect.h} at (${it.rect.x}, ${it.rect.y})</span>`;
    row.addEventListener('click', async () => {
      const tab = await getTab();
      await chrome.tabs.sendMessage(tab.id, { type: 'zunstack-highlight', path: it.path });
    });
    list.appendChild(row);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

document.addEventListener('DOMContentLoaded', async () => {
  $('scan').addEventListener('click', scan);
  $('filter').addEventListener('input', render);
  $('onlyPos').addEventListener('change', render);
  $('clear').addEventListener('click', async () => {
    const tab = await getTab();
    try { await chrome.tabs.sendMessage(tab.id, { type: 'zunstack-clear' }); } catch (e) { /* noop */ }
  });
  // Restore last scan.
  const { lastScan } = await chrome.storage.local.get('lastScan');
  if (lastScan && lastScan.length) { items = lastScan; render(); }
  else $('list').innerHTML = '<div class="empty">Hit "Scan this page" to inspect stacking order.</div>';
});
