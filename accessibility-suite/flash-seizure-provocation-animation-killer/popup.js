'use strict';
/* FlashGuard popup logic — user-triggered scan + kill-all toggle. */

const $ = (id) => document.getElementById(id);
const DEFAULTS = { killAll: false, thresholdMs: 500 };
let lastRisky = [];

/** Get the currently active tab. */
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Ensure the content script is present, then it's safe to message it. */
async function ensureContent(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'fg-ping' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
}

/** Send a message to the active tab's content script. */
async function sendToTab(msg) {
  const tab = await activeTab();
  if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
    throw new Error('Open a regular web page first.');
  }
  await ensureContent(tab.id);
  return chrome.tabs.sendMessage(tab.id, msg);
}

/** Reflect toggle state in the UI. */
function paintToggle(on) {
  $('killToggle').setAttribute('aria-checked', String(on));
}

/** Render scan results. */
function renderResults(items, scanned) {
  const box = $('results');
  box.innerHTML = '';
  if (!items.length) {
    box.innerHTML = `<div class="result-item safe"><span>No risky animations found (${scanned} animated elements checked).</span><span class="badge ok">CLEAR</span></div>`;
    $('pauseBtn').disabled = true;
    return;
  }
  const head = document.createElement('div');
  head.className = 'status';
  head.textContent = `${items.length} risky animation${items.length === 1 ? '' : 's'} flagged:`;
  box.appendChild(head);
  for (const r of items) {
    const div = document.createElement('div');
    div.className = 'result-item';
    const label = document.createElement('span');
    const code = document.createElement('code');
    code.textContent = r.tag;
    label.appendChild(code);
    label.insertAdjacentText('beforeend', ` · ${r.durMs} ms cycle`);
    const badge = document.createElement('span');
    badge.className = 'badge risky';
    badge.textContent = r.flashing ? 'FLASHING' : 'FAST';
    div.append(label, badge);
    box.appendChild(div);
  }
  $('pauseBtn').disabled = false;
}

async function init() {
  const s = await chrome.storage.local.get(DEFAULTS);
  paintToggle(s.killAll);
  $('threshold').value = s.thresholdMs;
  $('thrOut').textContent = `${s.thresholdMs} ms`;

  $('killToggle').addEventListener('click', async () => {
    const cur = await chrome.storage.local.get(DEFAULTS);
    const next = !cur.killAll;
    await chrome.storage.local.set({ killAll: next });
    paintToggle(next);
    try {
      await sendToTab({ type: 'fg-kill', on: next });
    } catch (e) {
      $('results').innerHTML = `<div class="status">Setting saved. ${e.message}</div>`;
    }
  });

  $('threshold').addEventListener('input', async (e) => {
    const v = Number(e.target.value);
    $('thrOut').textContent = `${v} ms`;
    await chrome.storage.local.set({ thresholdMs: v });
  });

  $('scanBtn').addEventListener('click', async () => {
    $('results').innerHTML = '<div class="status">Scanning…</div>';
    $('pauseBtn').disabled = true;
    try {
      const { thresholdMs } = await chrome.storage.local.get(DEFAULTS);
      const res = await sendToTab({ type: 'fg-scan', thresholdMs });
      lastRisky = res.risky || [];
      renderResults(lastRisky, res.scanned || 0);
    } catch (e) {
      $('results').innerHTML = `<div class="status">Scan failed: ${e.message}</div>`;
    }
  });

  $('pauseBtn').addEventListener('click', async () => {
    try {
      const res = await sendToTab({ type: 'fg-pause-risky', thresholdMs: Number($('threshold').value) });
      $('results').innerHTML = `<div class="result-item safe"><span>Paused ${res.count} risky animation${res.count === 1 ? '' : 's'}.</span><span class="badge ok">PAUSED</span></div>`;
      $('pauseBtn').disabled = true;
    } catch (e) {
      $('results').innerHTML = `<div class="status">Pause failed: ${e.message}</div>`;
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
