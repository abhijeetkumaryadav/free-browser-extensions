/* ZoomStep popup logic. Native chrome.tabs zoom in 10% steps + per-site memory. */

'use strict';

const STEP = 0.1;
const MIN = 0.5;
const MAX = 3.0;

const els = {
  hostLabel: document.getElementById('hostLabel'),
  zoomBadge: document.getElementById('zoomBadge'),
  zoomPct: document.getElementById('zoomPct'),
  zoomIn: document.getElementById('zoomIn'),
  zoomOut: document.getElementById('zoomOut'),
  resetBtn: document.getElementById('resetBtn'),
  rememberChk: document.getElementById('rememberChk'),
  siteList: document.getElementById('siteList'),
  emptySites: document.getElementById('emptySites'),
};

let tabId = null;
let host = '';
let currentZoom = 1;
let sites = {};

const pct = (z) => Math.round(z * 100) + '%';

function hostOf(url) {
  try { return new URL(url).hostname || ''; } catch (e) { return ''; }
}

async function loadSites() {
  const data = await chrome.storage.local.get('zoomstep');
  sites = (data.zoomstep && data.zoomstep.sites) || {};
}

async function saveSites() {
  await chrome.storage.local.set({ zoomstep: { sites } });
}

function render() {
  els.zoomPct.textContent = pct(currentZoom);
  els.zoomBadge.textContent = pct(currentZoom);
  els.rememberChk.checked = host in sites;
  els.emptySites.style.display = Object.keys(sites).length ? 'none' : 'block';
  els.siteList.innerHTML = '';
  const names = Object.keys(sites).sort();
  for (const name of names) {
    const li = document.createElement('li');
    const h = document.createElement('span');
    h.className = 'host';
    h.textContent = name;
    const zv = document.createElement('span');
    zv.className = 'zv';
    zv.textContent = pct(sites[name]);
    const del = document.createElement('button');
    del.title = 'Forget ' + name;
    del.setAttribute('aria-label', 'Forget ' + name);
    del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';
    del.addEventListener('click', async () => {
      delete sites[name];
      await saveSites();
      if (name === host) els.rememberChk.checked = false;
      render();
    });
    li.append(h, zv, del);
    els.siteList.appendChild(li);
  }
}

async function applyZoom(z) {
  const clamped = Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));
  if (tabId == null) return;
  await chrome.tabs.setZoom(tabId, clamped);
  currentZoom = clamped;
  if (els.rememberChk.checked && host) {
    sites[host] = clamped;
    await saveSites();
  }
  render();
}

els.zoomIn.addEventListener('click', () => applyZoom(currentZoom + STEP));
els.zoomOut.addEventListener('click', () => applyZoom(currentZoom - STEP));
els.resetBtn.addEventListener('click', () => applyZoom(1));

els.rememberChk.addEventListener('change', async () => {
  if (!host) return;
  if (els.rememberChk.checked) {
    sites[host] = currentZoom;
  } else {
    delete sites[host];
  }
  await saveSites();
  render();
});

// Keyboard: + / - / 0 while popup is open.
document.addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') applyZoom(currentZoom + STEP);
  else if (e.key === '-' || e.key === '_') applyZoom(currentZoom - STEP);
  else if (e.key === '0') applyZoom(1);
});

(async function init() {
  await loadSites();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id != null) {
    tabId = tab.id;
    host = hostOf(tab.url || '');
    els.hostLabel.textContent = host || 'this tab';
    try {
      currentZoom = await chrome.tabs.getZoom(tabId);
    } catch (e) { currentZoom = 1; }
  } else {
    els.hostLabel.textContent = 'no active tab';
  }
  render();
})();
