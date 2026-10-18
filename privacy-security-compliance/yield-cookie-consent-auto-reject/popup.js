/* =====================================================================
 * Yield — Cookie Consent Auto-Reject — popup logic
 *
 * Master switch, auto/manual mode, scan delay, per-site disable,
 * manual "scan now", and the on-device activity log.
 * ===================================================================== */
'use strict';

const STORE_KEY = 'yieldcc';

const DEFAULTS = {
  master: true,
  mode: 'auto',
  delayMs: 1200,
  disabledSites: [],
  log: [],
};

let settings = { ...DEFAULTS };
let tabId = null;
let origin = '';

async function loadSettings() {
  const data = await chrome.storage.local.get(STORE_KEY);
  settings = { ...DEFAULTS, ...(data[STORE_KEY] || {}) };
}

async function saveSettings() {
  await chrome.storage.local.set({ [STORE_KEY]: settings });
}

function fmtTime(t) {
  const d = new Date(t);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

const RESULT_META = {
  'rejected':          ['ok',   'Rejected'],
  'clicked-unverified':['warn', 'Clicked?'],
  'no-banner':         ['info', 'No banner'],
  'no-safe-button':    ['warn', 'No reject btn'],
  'disabled-site':     ['info', 'Skipped'],
  'already-handled':   ['info', 'Done'],
};

/** Render the activity log (newest first). */
function renderLog() {
  const list = document.getElementById('logList');
  list.innerHTML = '';
  const log = [...(settings.log || [])].reverse();
  if (log.length === 0) {
    list.innerHTML = '<p class="empty">Nothing handled yet.</p>';
    return;
  }
  for (const e of log.slice(0, 30)) {
    const [cls, label] = RESULT_META[e.result] || ['info', e.result];
    const row = document.createElement('div');
    row.className = 'log-row';

    const top = document.createElement('div');
    top.className = 'log-top';
    const pill = document.createElement('span');
    pill.className = 'pill ' + cls;
    pill.textContent = label;
    const org = document.createElement('span');
    org.className = 'log-origin';
    org.textContent = e.origin;
    org.title = e.origin;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = fmtTime(e.time);
    top.append(pill, org, time);

    const detail = document.createElement('div');
    detail.className = 'log-detail';
    detail.textContent = e.detail || '';

    row.append(top, detail);
    list.appendChild(row);
  }
}

/** Refresh per-site disable button state. */
function renderSite() {
  document.getElementById('siteLabel').textContent = origin || 'Not a web page';
  const btn = document.getElementById('siteToggle');
  const disabled = settings.disabledSites.includes(origin);
  btn.textContent = disabled ? 'Enable here' : 'Disable here';
  btn.classList.toggle('off', disabled);
  btn.disabled = !origin;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && /^https?:/.test(tab.url)) {
    tabId = tab.id;
    origin = new URL(tab.url).origin;
  }

  await loadSettings();

  // Master switch
  const master = document.getElementById('masterToggle');
  master.checked = !!settings.master;
  master.addEventListener('change', async () => {
    settings.master = master.checked;
    await saveSettings();
  });

  // Mode segmented control
  const seg = document.getElementById('modeSeg');
  const segBtns = [...seg.querySelectorAll('button')];
  const syncSeg = () => segBtns.forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === settings.mode));
  syncSeg();
  segBtns.forEach((b) => b.addEventListener('click', async () => {
    settings.mode = b.dataset.mode;
    await saveSettings();
    syncSeg();
  }));

  // Delay slider
  const range = document.getElementById('delayRange');
  const val = document.getElementById('delayVal');
  range.value = settings.delayMs;
  val.textContent = (settings.delayMs / 1000).toFixed(1) + 's';
  range.addEventListener('input', () => {
    val.textContent = (range.value / 1000).toFixed(1) + 's';
  });
  range.addEventListener('change', async () => {
    settings.delayMs = Number(range.value);
    await saveSettings();
  });

  // Per-site disable
  renderSite();
  document.getElementById('siteToggle').addEventListener('click', async () => {
    if (!origin) return;
    const i = settings.disabledSites.indexOf(origin);
    if (i >= 0) settings.disabledSites.splice(i, 1);
    else settings.disabledSites.push(origin);
    await saveSettings();
    renderSite();
  });

  // Manual scan
  document.getElementById('scanNow').addEventListener('click', async () => {
    if (tabId === null) return;
    try {
      await chrome.tabs.sendMessage(tabId, { kind: 'yield-scan-now' });
    } catch (_) { /* content script not on this page */ }
    // Re-render the log after the scan has had time to act.
    setTimeout(async () => { await loadSettings(); renderLog(); }, 2500);
  });

  // Clear log
  document.getElementById('clearLog').addEventListener('click', async () => {
    settings.log = [];
    await saveSettings();
    renderLog();
  });

  renderLog();

  // Live-refresh the log while the popup is open.
  const timer = setInterval(async () => {
    await loadSettings();
    renderLog();
    renderSite();
  }, 2000);
  window.addEventListener('unload', () => clearInterval(timer));
}

document.addEventListener('DOMContentLoaded', init);
