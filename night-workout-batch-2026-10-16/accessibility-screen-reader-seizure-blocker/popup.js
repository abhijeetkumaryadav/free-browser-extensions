/**
 * Motion Calm — popup controller.
 * Remembers the chosen mode (chrome.storage.local) and drives the page-side
 * engine via chrome.scripting (user-triggered only).
 */
'use strict';

const STORAGE_KEY = 'motionCalmModeV1';

const $ = (id) => document.getElementById(id);
const statusEl = $('status');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

function selectedMode() {
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : 'freeze';
}

async function loadMode() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const mode = data[STORAGE_KEY] === 'strict' ? 'strict' : 'freeze';
    const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
  } catch (e) { /* storage unavailable — default stays */ }
}

async function saveMode() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: selectedMode() });
  } catch (e) { /* ignore */ }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function injectable(url) {
  return !!url && /^(https?|file|ftp):/i.test(url);
}

async function ensureEngine(tabId) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
}

async function applyToPage() {
  const tab = await getActiveTab();
  if (!tab || !injectable(tab.url)) {
    setStatus('Can’t run here (e.g. chrome:// pages).', 'err');
    return;
  }
  const mode = selectedMode();
  await saveMode();
  const btn = $('applyBtn');
  btn.disabled = true;
  setStatus('Applying…');
  try {
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'MOTION_APPLY', mode });
    if (res && res.ok) {
      setStatus(
        mode === 'strict'
          ? 'Applied: motion frozen, media dimmed.'
          : 'Applied: motion frozen on this page.',
        'ok'
      );
    } else {
      setStatus('Apply failed: ' + ((res && res.error) || 'unknown error'), 'err');
    }
  } catch (e) {
    setStatus('Couldn’t reach the page. Try reloading it.', 'err');
  } finally {
    btn.disabled = false;
  }
}

async function removeFromPage() {
  const tab = await getActiveTab();
  if (!tab || !injectable(tab.url)) {
    setStatus('Nothing to remove on this page.', 'err');
    return;
  }
  try {
    await ensureEngine(tab.id);
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'MOTION_REMOVE' });
    setStatus(res && res.ok ? 'Removed — page back to normal.' : 'Remove failed.', res && res.ok ? 'ok' : 'err');
  } catch (e) {
    setStatus('Couldn’t reach the page.', 'err');
  }
}

$('applyBtn').addEventListener('click', applyToPage);
$('removeBtn').addEventListener('click', removeFromPage);
document.querySelectorAll('input[name="mode"]').forEach((r) =>
  r.addEventListener('change', saveMode)
);

loadMode();
