/**
 * QuietStart popup logic.
 * - Master on/off toggle (persisted).
 * - Blocked-attempt counter.
 * - Per-site allowlist with add/remove (persisted).
 * - "Resume paused video" — plays the video our content script paused
 *   on the active tab (one click, explicit user gesture).
 */
'use strict';

const BLOCK_COUNT_KEY = 'quietstart.blockCount';
const SETTINGS_KEY = 'quietstart.settings';

const $ = (id) => document.getElementById(id);

let settings = { enabled: true, allowlist: [] };

async function load() {
  try {
    const stored = await chrome.storage.local.get([SETTINGS_KEY, BLOCK_COUNT_KEY]);
    if (stored[SETTINGS_KEY]) settings = { enabled: true, allowlist: [], ...stored[SETTINGS_KEY] };
    renderCount(stored[BLOCK_COUNT_KEY] || 0);
  } catch (e) {
    renderCount(0);
  }
  renderToggle();
  renderAllowlist();
  renderCurrentHost();
}

function renderCount(n) { $('blockCount').textContent = String(n); }

function renderToggle() {
  $('masterToggle').setAttribute('aria-checked', String(!!settings.enabled));
}

function renderAllowlist() {
  const list = $('allowList');
  list.innerHTML = '';
  $('allowCount').textContent = String(settings.allowlist.length);
  $('allowEmpty').style.display = settings.allowlist.length ? 'none' : 'block';
  for (const host of settings.allowlist) {
    const li = document.createElement('li');
    li.textContent = host;
    const rm = document.createElement('button');
    rm.textContent = '✕';
    rm.title = 'Remove from allowlist';
    rm.setAttribute('aria-label', `Remove ${host} from allowlist`);
    rm.addEventListener('click', () => removeHost(host));
    li.appendChild(rm);
    list.appendChild(li);
  }
  // Update the "Allow" button label for the current host.
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) return;
    let host = '';
    try { host = new URL(tab.url).hostname; } catch (_) { return; }
    $('allowBtn').textContent = settings.allowlist.includes(host) ? 'Allowed ✓' : 'Allow';
  });
}

async function save() {
  try {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  } catch (_) { /* ignore */ }
}

function renderCurrentHost() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs && tabs[0];
    if (!tab || !tab.url) { $('currentHost').textContent = '(no page)'; return; }
    try {
      $('currentHost').textContent = new URL(tab.url).hostname;
    } catch (_) {
      $('currentHost').textContent = '(unsupported page)';
    }
    renderAllowlist(); // refresh Allow button label
  });
}

async function toggleMaster() {
  settings.enabled = !settings.enabled;
  await save();
  renderToggle();
}

async function toggleCurrentHost() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || !tab.url) return;
  let host = '';
  try { host = new URL(tab.url).hostname; } catch (_) { return; }
  const i = settings.allowlist.indexOf(host);
  if (i >= 0) settings.allowlist.splice(i, 1);
  else settings.allowlist.push(host);
  await save();
  renderAllowlist();
}

async function removeHost(host) {
  settings.allowlist = settings.allowlist.filter((h) => h !== host);
  await save();
  renderAllowlist();
}

async function resumePaused() {
  const btn = $('resumeBtn');
  btn.disabled = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id == null) return;
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const v = document.querySelector('video[data-quietstart-paused="1"]') || document.querySelector('video');
        if (v) {
          delete v.dataset.quietstartPaused;
          v.play().catch(() => {});
          return true;
        }
        return false;
      }
    });
  } catch (_) {
    // Scripting unavailable on chrome://, Web Store, etc. — fail silently.
  } finally {
    btn.disabled = false;
  }
}

async function resetCounter() {
  try { await chrome.storage.local.set({ [BLOCK_COUNT_KEY]: 0 }); } catch (_) {}
  renderCount(0);
}

$('masterToggle').addEventListener('click', toggleMaster);
$('allowBtn').addEventListener('click', toggleCurrentHost);
$('resumeBtn').addEventListener('click', resumePaused);
$('resetBtn').addEventListener('click', resetCounter);

load();
