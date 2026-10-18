/* StreamSaver popup — scans the active tab via the MAIN-world probe,
   renders found media files, and downloads only what the user clicks. */
'use strict';

const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const rescanBtn = document.getElementById('rescan');

const DOWNLOAD_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

let lastItems = [];

document.addEventListener('DOMContentLoaded', scan);
rescanBtn.addEventListener('click', scan);

async function scan() {
  statusEl.hidden = false;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Scanning page…';
  resultsEl.hidden = true;
  resultsEl.innerHTML = '';
  lastItems = [];

  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    return fail('Could not access the active tab.');
  }
  if (!tab || !tab.id) return fail('No active tab found.');
  if (/^(chrome|chrome-extension|edge|about):/.test(tab.url || '')) {
    return fail('Scanning is not allowed on browser internal pages.');
  }

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN', // MAIN world: reads real currentSrc + can fetch blob: URLs
      files: ['probe.js'],
    });
    const items = (injection && injection.result) || [];
    lastItems = items;
    render(items);
  } catch (e) {
    fail('Could not scan this page (' + shortErr(e) + ').');
  }
}

function fail(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add('error');
}

function render(items) {
  if (!items.length) {
    statusEl.textContent = 'No downloadable media found on this page.';
    return;
  }
  statusEl.hidden = true;
  resultsEl.hidden = false;

  items.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'card';

    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.textContent = item.kind;

    const meta = document.createElement('div');
    meta.className = 'meta';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = fileName(item.url);
    name.title = item.url;
    const detail = document.createElement('div');
    detail.className = 'detail';
    detail.textContent = [formatSize(item.size), item.note].filter(Boolean).join(' · ');
    meta.append(name, detail);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const dl = document.createElement('button');
    dl.className = 'btn primary';
    dl.innerHTML = DOWNLOAD_SVG + '<span>Save</span>';
    dl.title = 'Download this file';
    dl.addEventListener('click', () => download(item));

    const cp = document.createElement('button');
    cp.className = 'btn';
    cp.innerHTML = COPY_SVG;
    cp.title = 'Copy URL';
    cp.setAttribute('aria-label', 'Copy URL');
    cp.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(item.url);
        cp.style.borderColor = 'var(--accent)';
        setTimeout(() => (cp.style.borderColor = ''), 900);
      } catch (e) { /* clipboard unavailable */ }
    });

    actions.append(cp, dl);
    li.append(kind, meta, actions);
    resultsEl.append(li);
  });
}

async function download(item) {
  // User-initiated only: nothing downloads unless the user clicks Save.
  const url = item.dataUrl || item.url;
  try {
    await chrome.downloads.download({ url, filename: fileName(item.url), saveAs: false });
  } catch (e) {
    statusEl.hidden = false;
    statusEl.classList.add('error');
    statusEl.textContent = 'Download failed: ' + shortErr(e);
  }
}

function fileName(url) {
  try {
    if (url.startsWith('blob:')) return 'media-' + url.slice(5, 13) + '.bin';
    const path = new URL(url).pathname;
    const base = path.substring(path.lastIndexOf('/') + 1).split(/[?#]/)[0];
    return decodeURIComponent(base) || 'media-file';
  } catch (e) {
    return 'media-file';
  }
}

function formatSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes, u = 0;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return v.toFixed(v >= 10 || u === 0 ? 0 : 1) + ' ' + units[u];
}

function shortErr(e) {
  const msg = (e && e.message) || String(e);
  return msg.length > 90 ? msg.slice(0, 90) + '…' : msg;
}
