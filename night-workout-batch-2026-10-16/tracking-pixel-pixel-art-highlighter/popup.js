/* PixelHunt — popup logic.
 * Injects content.js on demand, asks it to scan, renders the suspect list. */
'use strict';

const $ = (id) => document.getElementById(id);
const scanBtn = $('scanBtn');
const clearBtn = $('clearBtn');
const statusLine = $('statusLine');
const resultsCard = $('resultsCard');
const pixelList = $('pixelList');
const countBadge = $('countBadge');

/** Inject content.js (idempotent) then call one of its remote methods. */
async function callContent(method) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) throw new Error('No active tab.');
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  const injected = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (name) => (window.__pixelHunt ? window.__pixelHunt[name]() : []),
    args: [method]
  });
  return injected[0] ? injected[0].result : [];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderResults(items) {
  countBadge.textContent = items.length;
  pixelList.innerHTML = '';
  if (items.length === 0) {
    pixelList.innerHTML = '<li class="empty">No tracking-pixel suspects found. 🎉</li>';
  } else {
    for (const it of items) {
      const li = document.createElement('li');
      const reasons = it.reasons.map((r) => `<span class="reason">${esc(r)}</span>`).join('');
      li.innerHTML =
        `<div class="host">${esc(it.host || '(no host)')}</div>` +
        `<div class="meta">${esc(it.rendered)} · ${esc((it.src || '').slice(0, 90))}${it.src && it.src.length > 90 ? '…' : ''}</div>` +
        `<div class="reasons">${reasons}</div>`;
      pixelList.appendChild(li);
    }
  }
  resultsCard.classList.remove('hidden');
}

scanBtn.addEventListener('click', async () => {
  scanBtn.disabled = true;
  statusLine.innerHTML = 'Scanning…';
  try {
    const items = await callContent('scan');
    renderResults(items);
    statusLine.innerHTML = items.length
      ? `Found <strong>${items.length}</strong> suspect${items.length === 1 ? '' : 's'} — highlighted on the page.`
      : 'Scan complete — no suspects found.';
  } catch (err) {
    statusLine.textContent = 'Could not scan this page (' + (err.message || err) + ').';
  } finally {
    scanBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', async () => {
  try {
    await callContent('clear');
    resultsCard.classList.add('hidden');
    statusLine.textContent = 'Highlights removed, original images restored.';
  } catch (err) {
    statusLine.textContent = 'Could not restore (' + (err.message || err) + ').';
  }
});
