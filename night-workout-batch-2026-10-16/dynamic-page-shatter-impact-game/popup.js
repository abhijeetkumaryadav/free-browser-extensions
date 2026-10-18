/* ShatterPlay popup logic — captures the visible tab, arms the shatter engine. */
'use strict';

const $ = (id) => document.getElementById(id);
const els = {
  shatter: $('shatter'),
  restore: $('restore'),
  score: $('score'),
  best: $('best'),
  status: $('status'),
  err: $('err'),
};

/** Get the active tab in the current window. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Make sure content.js is injected, then return true. */
async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (_) {
    // No listener yet — inject the engine.
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    return true;
  }
}

function setErr(msg) { els.err.textContent = msg || ''; }

async function refreshState() {
  try {
    const tab = await activeTab();
    if (!tab) return;
    const st = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATE' });
    if (st) {
      els.score.textContent = st.score;
      els.status.textContent = st.active ? 'Shattered' : 'Ready';
      els.shatter.disabled = !!st.active;
    }
  } catch (_) { /* content script not present — page untouched */ }
}

async function refreshBest() {
  const { best = 0 } = await chrome.storage.local.get('best');
  els.best.textContent = best;
}

els.shatter.addEventListener('click', async () => {
  setErr('');
  els.shatter.disabled = true;
  els.status.textContent = 'Capturing…';
  try {
    const tab = await activeTab();
    if (!tab || tab.id == null) throw new Error('no-tab');
    await ensureContent(tab.id);
    // Snapshot the visible page; the engine slices this image into shards.
    const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await chrome.tabs.sendMessage(tab.id, { type: 'SHATTER', image });
    els.status.textContent = 'Shattered';
  } catch (e) {
    els.status.textContent = 'Ready';
    setErr('Could not shatter this page. Browser-internal pages (new tab, settings, web store) are protected by Chrome.');
    els.shatter.disabled = false;
  }
});

els.restore.addEventListener('click', async () => {
  setErr('');
  try {
    const tab = await activeTab();
    if (tab) await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE' });
  } catch (_) { /* nothing to restore */ }
  els.status.textContent = 'Ready';
  els.shatter.disabled = false;
  refreshBest();
});

// Live score polling while the popup is open.
setInterval(refreshState, 400);
refreshState();
refreshBest();
