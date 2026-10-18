// Image Dimension Inspector — popup logic.
// Injects the scanner on demand, renders stats + the image list,
// and forwards click-to-highlight requests.

'use strict';

const $ = (id) => document.getElementById(id);

const scanBtn = $('scanBtn');
const brokenOnly = $('brokenOnly');
const scanError = $('scanError');
const statsPanel = $('statsPanel');
const imageList = $('imageList');
const pageHost = $('pageHost');

let currentTabId = null;
let lastData = null;

/* ---------- helpers ---------- */

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

function isInjectable(url) {
  return !!url && /^(https?|file):/.test(url);
}

async function withScanner(tabId, fn) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'idi-ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
  return fn();
}

function showError(text) {
  scanError.textContent = text;
  scanError.classList.remove('hidden');
}
function hideError() {
  scanError.classList.add('hidden');
  scanError.textContent = '';
}

function formatBytes(n) {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/* ---------- rendering ---------- */

function render(data) {
  lastData = data;
  pageHost.textContent = data.host || '';
  pageHost.title = data.host || '';

  // Stats: total transfer = sum of known per-image transfer sizes.
  const knownBytes = data.items.reduce((acc, it) => acc + (it.bytes || 0), 0);
  const knownCount = data.items.filter((it) => it.bytes).length;

  $('statTotal').textContent = data.count;
  $('statBroken').textContent = data.broken;
  $('statLazy').textContent = data.lazy;
  $('statSize').textContent = knownCount ? formatBytes(knownBytes) : '—';
  $('statSize').title = knownCount
    ? `Measured for ${knownCount} of ${data.count} images (Resource Timing API)`
    : 'Transfer size unavailable for these images';
  statsPanel.classList.remove('hidden');

  renderList();
}

function renderList() {
  imageList.innerHTML = '';
  if (!lastData) return;

  const items = brokenOnly.checked
    ? lastData.items.filter((it) => it.broken)
    : lastData.items;

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = brokenOnly.checked
      ? 'No broken images found — nice.'
      : 'No <img> elements found on this page.';
    imageList.appendChild(li);
    return;
  }

  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'img-card' + (it.broken ? ' is-broken' : '');
    li.title = 'Click to highlight on the page';

    // Thumbnail (broken images get a placeholder box).
    let thumb;
    if (it.broken || !it.fullSrc) {
      thumb = document.createElement('div');
      thumb.className = 'thumb broken';
      thumb.textContent = '⚠';
    } else {
      thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = it.fullSrc;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.onerror = () => {
        const d = document.createElement('div');
        d.className = 'thumb broken';
        d.textContent = '⚠';
        thumb.replaceWith(d);
      };
    }

    const meta = document.createElement('div');
    meta.className = 'img-meta';

    const src = document.createElement('div');
    src.className = 'img-src';
    src.textContent = it.src;
    src.title = it.fullSrc;

    const dims = document.createElement('div');
    dims.className = 'img-dims';
    dims.innerHTML = '';
    dims.append(
      document.createTextNode(it.natural),
      Object.assign(document.createElement('span'), { className: 'sep', textContent: '→' }),
      document.createTextNode(it.displayed + ' px'),
    );

    const badges = document.createElement('div');
    badges.className = 'badges';
    const mk = (cls, text, title) => {
      const b = document.createElement('span');
      b.className = 'badge ' + cls;
      b.textContent = text;
      if (title) b.title = title;
      return b;
    };
    badges.append(mk('ratio', it.ratio, 'Natural aspect ratio'));
    if (it.size) badges.append(mk('size', it.size, 'Transfer size (Resource Timing API)'));
    if (it.lazy) badges.append(mk('lazy', 'LAZY', 'Lazy-loaded image'));
    if (it.broken) badges.append(mk('broken', 'BROKEN', 'Failed to load'));

    meta.append(src, dims, badges);
    li.append(thumb, meta);

    li.addEventListener('click', () => highlightImage(it.idx));
    imageList.appendChild(li);
  }
}

async function highlightImage(idx) {
  if (currentTabId == null) return;
  try {
    await withScanner(currentTabId, () =>
      chrome.tabs.sendMessage(currentTabId, { type: 'idi-highlight', idx })
    );
    window.close();
  } catch (err) {
    showError('Could not highlight: ' + err.message);
  }
}

/* ---------- scan flow ---------- */

scanBtn.addEventListener('click', async () => {
  hideError();
  const tab = await getActiveTab();
  if (!tab || !isInjectable(tab.url)) {
    showError('Cannot scan this page — browser pages (chrome://, Web Store, …) are restricted.');
    return;
  }
  currentTabId = tab.id;
  scanBtn.disabled = true;
  try {
    const res = await withScanner(tab.id, () =>
      chrome.tabs.sendMessage(tab.id, { type: 'idi-scan' })
    );
    if (!res || !res.ok) throw new Error('Scanner did not respond.');
    render(res.data);
    // Cache per-tab so reopening the popup restores the list.
    await chrome.storage.local.set({ idi_last: { tabId: tab.id, data: res.data } });
  } catch (err) {
    showError('Scan failed: ' + err.message);
  } finally {
    scanBtn.disabled = false;
  }
});

brokenOnly.addEventListener('change', renderList);

/* ---------- init ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  const tab = await getActiveTab();
  if (tab) {
    currentTabId = tab.id;
    const { idi_last } = await chrome.storage.local.get('idi_last');
    if (idi_last && idi_last.tabId === tab.id && idi_last.data) {
      render(idi_last.data);
    }
  }
});
