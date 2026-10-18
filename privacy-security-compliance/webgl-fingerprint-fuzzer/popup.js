/* ==========================================================================
   WebGL Fingerprint Fuzzer — popup logic
   Master toggle, per-site protection toggle, and allowlist management.
   All settings live in chrome.storage.local; nothing leaves the device.
   ========================================================================== */

'use strict';

/** Default settings shape. */
const DEFAULTS = { enabled: true, allowlist: [] };

/** In-memory settings, refreshed from storage. */
let settings = { ...DEFAULTS };

/** Hostname of the currently active tab (empty on restricted pages). */
let currentHost = '';

/* ------------------------------------------------------------------ */
/* Storage                                                            */
/* ------------------------------------------------------------------ */

async function loadSettings() {
  const data = await chrome.storage.local.get({ settings: DEFAULTS });
  settings = { ...DEFAULTS, ...(data.settings || {}) };
  if (!Array.isArray(settings.allowlist)) settings.allowlist = [];
}

async function saveSettings() {
  await chrome.storage.local.set({ settings });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */

/** Refresh the whole popup UI from current state. */
function render() {
  document.getElementById('masterToggle').checked = settings.enabled === true;

  const siteOn = currentHost !== '' && !settings.allowlist.includes(currentHost);
  const siteToggle = document.getElementById('siteToggle');
  siteToggle.checked = siteOn;
  siteToggle.disabled = !settings.enabled || currentHost === '';
  document.getElementById('siteHost').textContent =
    currentHost === '' ? 'unavailable on this page' : currentHost;

  // Status pill
  const pill = document.getElementById('statusPill');
  if (!settings.enabled) {
    pill.textContent = 'Disabled';
    pill.className = 'pill off';
  } else if (currentHost !== '' && settings.allowlist.includes(currentHost)) {
    pill.textContent = 'Site excluded';
    pill.className = 'pill warn';
  } else {
    pill.textContent = 'Protected';
    pill.className = 'pill on';
  }

  // Allowlist
  document.getElementById('allowCount').textContent = settings.allowlist.length;
  const list = document.getElementById('allowList');
  list.innerHTML = '';
  document.getElementById('allowEmpty').style.display =
    settings.allowlist.length ? 'none' : 'block';
  settings.allowlist.forEach(host => list.appendChild(allowItem(host)));
}

/** One allowlist row with a remove button. */
function allowItem(host) {
  const row = document.createElement('div');
  row.className = 'allow-item';

  const label = document.createElement('span');
  label.textContent = host;
  row.appendChild(label);

  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.title = 'Remove from allowlist';
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  btn.addEventListener('click', async () => {
    settings.allowlist = settings.allowlist.filter(h => h !== host);
    await saveSettings();
    render();
  });
  row.appendChild(btn);
  return row;
}

/* ------------------------------------------------------------------ */
/* Init                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();

  // Determine the active tab's hostname (may fail on chrome:// pages).
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) currentHost = new URL(tab.url).hostname || '';
  } catch (err) {
    currentHost = '';
  }

  document.getElementById('masterToggle').addEventListener('change', async (e) => {
    settings.enabled = e.target.checked;
    await saveSettings();
    render();
  });

  document.getElementById('siteToggle').addEventListener('change', async (e) => {
    if (!currentHost) return;
    if (e.target.checked) {
      settings.allowlist = settings.allowlist.filter(h => h !== currentHost);
    } else if (!settings.allowlist.includes(currentHost)) {
      settings.allowlist.push(currentHost);
    }
    await saveSettings();
    render();
  });

  render();
});
