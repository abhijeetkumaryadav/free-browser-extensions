// ============================================================================
// popup.js — Macro Recorder UI.
// All actions are user-triggered: record/stop/replay each require an explicit
// button click. Nothing runs in the background unprompted.
// ============================================================================

'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  recordBtn: $('recordBtn'),
  stopBtn: $('stopBtn'),
  macroName: $('macroName'),
  macroList: $('macroList'),
  emptyMsg: $('emptyMsg'),
  liveCount: $('liveCount'),
  statusPill: $('statusPill'),
};

let recording = false;
let recordingTabId = null;

// Live updates via long-lived port to the service worker.
const port = chrome.runtime.connect({ name: 'macro-popup' });
port.onMessage.addListener((msg) => {
  if (msg.kind === 'macro-progress') {
    els.liveCount.textContent = `Recording… ${msg.count} event${msg.count === 1 ? '' : 's'} captured.`;
  } else if (msg.kind === 'macro-saved' || msg.kind === 'macro-deleted') {
    renderMacros();
  } else if (msg.kind === 'macro-replay-progress') {
    setStatus('replaying', `Replaying… ${msg.done}/${msg.total}`);
  } else if (msg.kind === 'macro-replay-done') {
    setStatus('idle', 'Idle');
    els.liveCount.textContent = msg.result && msg.result.ok
      ? 'Replay finished.'
      : 'Replay could not start (already replaying).';
  }
});

function setStatus(mode, label) {
  els.statusPill.className = 'pill ' + mode;
  els.statusPill.textContent = label;
}

// ---- tab helpers ------------------------------------------------------------
// content.js must be present in the tab; inject it on demand (user action).
async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContent(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function sendToTab(tabId, msg) {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // Content script not awake — inject and retry once.
    await ensureContent(tabId);
    return await chrome.tabs.sendMessage(tabId, msg);
  }
}

// ---- recording --------------------------------------------------------------
els.recordBtn.addEventListener('click', async () => {
  const tab = await activeTab();
  if (!tab || !tab.id) return;
  const name = els.macroName.value.trim() || 'Untitled macro';
  await ensureContent(tab.id);
  const res = await sendToTab(tab.id, { kind: 'macro-start', name });
  if (res && res.ok) {
    recording = true;
    recordingTabId = tab.id;
    setStatus('recording', '● Recording');
    els.liveCount.textContent = 'Recording… click, type and scroll on the page.';
    els.recordBtn.disabled = true;
    els.stopBtn.disabled = false;
  }
});

els.stopBtn.addEventListener('click', async () => {
  if (!recording || recordingTabId == null) return;
  const res = await sendToTab(recordingTabId, { kind: 'macro-stop' }).catch(() => null);
  recording = false;
  recordingTabId = null;
  setStatus('idle', 'Idle');
  els.recordBtn.disabled = false;
  els.stopBtn.disabled = true;
  els.liveCount.textContent = 'No recording in progress.';

  if (res && res.ok && res.events && res.events.length) {
    chrome.runtime.sendMessage({
      kind: 'macro-save',
      macro: { name: res.name || els.macroName.value.trim() || 'Untitled macro', events: res.events },
    });
    els.macroName.value = '';
  } else if (res && res.ok) {
    els.liveCount.textContent = 'Recording stopped — no events captured.';
  }
});

// ---- macro list --------------------------------------------------------------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

async function renderMacros() {
  const { macros = [] } = await chrome.storage.local.get('macros');
  els.macroList.innerHTML = '';
  els.emptyMsg.style.display = macros.length ? 'none' : '';

  for (const m of macros) {
    const li = document.createElement('li');
    li.className = 'macro-item';
    const date = new Date(m.createdAt).toLocaleDateString();
    li.innerHTML = `
      <div class="macro-info">
        <div class="macro-name">${escapeHtml(m.name)}</div>
        <div class="macro-meta">${m.events.length} steps · saved ${escapeHtml(date)}</div>
      </div>
      <div class="macro-actions">
        <button class="btn primary small" data-act="replay" data-id="${m.id}">▶ Replay</button>
        <button class="btn ghost small" data-act="delete" data-id="${m.id}">Delete</button>
      </div>`;
    els.macroList.appendChild(li);
  }
}

els.macroList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  const { macros = [] } = await chrome.storage.local.get('macros');

  if (act === 'delete') {
    await chrome.storage.local.set({ macros: macros.filter((m) => m.id !== id) });
    renderMacros();
    return;
  }

  if (act === 'replay') {
    const macro = macros.find((m) => m.id === id);
    if (!macro) return;
    // Explicit click required — replay runs once, in the visible tab.
    const tab = await activeTab();
    if (!tab || !tab.id) return;
    await ensureContent(tab.id);
    setStatus('replaying', `Replaying… 0/${macro.events.length}`);
    els.liveCount.textContent = `Replaying “${macro.name}” in this tab…`;
    await sendToTab(tab.id, { kind: 'macro-replay', events: macro.events });
  }
});

// If the popup was closed mid-recording, reflect current state on open.
async function init() {
  renderMacros();
  try {
    const tab = await activeTab();
    if (tab && tab.id) {
      const st = await chrome.tabs.sendMessage(tab.id, { kind: 'macro-state' }).catch(() => null);
      if (st && st.recording) {
        recording = true;
        recordingTabId = tab.id;
        setStatus('recording', '● Recording');
        els.liveCount.textContent = `Recording… ${st.count} events captured.`;
        els.recordBtn.disabled = true;
        els.stopBtn.disabled = false;
      }
    }
  } catch { /* tab without content script — stay idle */ }
}

init();
