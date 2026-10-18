/* StreamGauge popup logic.
 * - Per-site preferred-quality preferences in chrome.storage.local.
 * - "Check playback now" injects a read-only MAIN-world probe on click
 *   and compares detected resolution against the site's preference.
 * - Verification log persisted on-device.
 * Read-only + reminders: this extension cannot force a stream's bitrate.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const siteLabel = $('siteLabel'), prefSelect = $('prefSelect');
const resultBox = $('resultBox');
const prefList = $('prefList'), emptyPrefs = $('emptyPrefs'), prefCount = $('prefCount');
const logList = $('logList'), emptyLog = $('emptyLog');

const PREF_KEY = 'streamgauge_prefs';   // { host: '1080' }
const LOG_KEY = 'streamgauge_log';      // [ {id, host, detected, preferred, verdict, date} ]

let currentHost = '';

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

async function getStore() {
  const d = await chrome.storage.local.get([PREF_KEY, LOG_KEY]);
  return {
    prefs: (d[PREF_KEY] && typeof d[PREF_KEY] === 'object') ? d[PREF_KEY] : {},
    log: Array.isArray(d[LOG_KEY]) ? d[LOG_KEY] : []
  };
}

/* ---------- current site ---------- */

async function initSite() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab && tab.url ? tab.url : '';
    const m = /^https?:\/\/([^/:]+)/i.exec(url);
    currentHost = m ? m[1].toLowerCase() : '';
  } catch { currentHost = ''; }

  if (currentHost) {
    siteLabel.textContent = currentHost;
    const { prefs } = await getStore();
    prefSelect.value = prefs[currentHost] || '';
  } else {
    siteLabel.textContent = 'No web page in the active tab';
    $('checkBtn').disabled = true;
  }
}

/* ---------- preferences ---------- */

$('savePrefBtn').addEventListener('click', async () => {
  if (!currentHost) return;
  const { prefs } = await getStore();
  if (prefSelect.value) prefs[currentHost] = prefSelect.value;
  else delete prefs[currentHost];
  await chrome.storage.local.set({ [PREF_KEY]: prefs });
  renderPrefs();
});

function qualityChip(q) {
  return `<span class="q-chip">${esc(q)}p</span>`;
}

async function renderPrefs() {
  const { prefs } = await getStore();
  const hosts = Object.keys(prefs).sort();
  prefList.innerHTML = '';
  emptyPrefs.style.display = hosts.length ? 'none' : '';
  prefCount.textContent = hosts.length ? hosts.length + ' site' + (hosts.length > 1 ? 's' : '') : '';
  for (const host of hosts) {
    const li = document.createElement('li');
    li.className = 'pref-item';
    li.innerHTML = `
      <div class="host">${esc(host)}</div>
      ${qualityChip(prefs[host])}
      <button class="del-btn" data-host="${esc(host)}" title="Remove preference">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>`;
    prefList.appendChild(li);
  }
  prefList.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { prefs } = await getStore();
      delete prefs[btn.dataset.host];
      await chrome.storage.local.set({ [PREF_KEY]: prefs });
      if (btn.dataset.host === currentHost) prefSelect.value = '';
      renderPrefs();
    });
  });
}

/* ---------- playback check ---------- */

function heightToLabel(h) {
  return h >= 2160 ? '2160' : h >= 1440 ? '1440' : h >= 1080 ? '1080' :
         h >= 720 ? '720' : h >= 480 ? '480' : h >= 360 ? '360' : String(h);
}

function showResult(verdictClass, verdictText, detailHtml) {
  resultBox.className = 'result';
  resultBox.innerHTML = `<div class="verdict ${verdictClass}">${esc(verdictText)}</div><div class="detail">${detailHtml}</div>`;
}

$('checkBtn').addEventListener('click', async () => {
  showResult('info', 'Scanning…', 'Reading the player on this page.');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !/^https?:/.test(tab.url || '')) {
      showResult('info', 'No scannable page', 'Open a regular web page with a video player.');
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['quality-probe.js'],
      world: 'MAIN'
    });
    const videos = (result && result.result) || [];
    const playing = videos.find((v) => v.height > 0) || videos[0];

    const { prefs, log } = await getStore();
    const preferred = prefs[currentHost] || null;

    if (!playing) {
      showResult('info', 'No video found', 'Start playback on this page, then check again.');
      return;
    }

    const detected = playing.height > 0 ? heightToLabel(playing.height) : null;
    let verdict, vClass, chipClass;
    if (!detected) {
      verdict = 'Resolution unknown'; vClass = 'info'; chipClass = 'q-chip';
      var detail = 'The player did not report dimensions yet — try again once the video is playing.';
    } else if (!preferred) {
      verdict = 'Detected: ' + detected + 'p'; vClass = 'info'; chipClass = 'q-chip';
      var detail = 'No preference set for this site. Set one above to get match/mismatch verdicts.';
    } else if (detected === preferred) {
      verdict = 'Match — ' + detected + 'p'; vClass = 'match'; chipClass = 'q-chip good';
      var detail = 'The player is delivering your preferred quality.';
    } else {
      verdict = 'Mismatch — ' + detected + 'p vs ' + preferred + 'p'; vClass = 'miss'; chipClass = 'q-chip bad';
      var detail = 'The player is not delivering your preference. This extension cannot force it — change quality in the player\'s own settings.';
    }

    let extra = '';
    if (playing.droppedFrames != null && playing.totalFrames) {
      const pct = (100 * playing.droppedFrames / Math.max(1, playing.totalFrames)).toFixed(1);
      extra = `<br>Dropped frames: ${esc(String(playing.droppedFrames))} / ${esc(String(playing.totalFrames))} (${esc(pct)}%)`;
    }

    showResult(vClass, verdict, esc(detail) + extra);

    log.unshift({
      id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      host: currentHost,
      detected: detected || 'unknown',
      preferred: preferred || '—',
      verdict,
      date: new Date().toISOString()
    });
    await chrome.storage.local.set({ [LOG_KEY]: log.slice(0, 100) });
    renderLog();
  } catch (err) {
    showResult('info', 'Check blocked', 'This page does not allow probing (e.g. chrome:// or store pages).');
  }
});

/* ---------- verification log ---------- */

async function renderLog() {
  const { log } = await getStore();
  logList.innerHTML = '';
  emptyLog.style.display = log.length ? 'none' : '';
  for (const e of log) {
    const chipClass = /Match/.test(e.verdict) ? 'q-chip good'
      : /Mismatch/.test(e.verdict) ? 'q-chip bad' : 'q-chip';
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
      <div class="meta">
        <div class="t">${esc(e.host)}</div>
        <div class="d">${esc(fmtDate(e.date))} · pref ${esc(e.preferred)}p · got ${esc(e.detected)}p</div>
      </div>
      <span class="${chipClass}">${esc(/Match/.test(e.verdict) ? 'Match' : /Mismatch/.test(e.verdict) ? 'Mismatch' : 'Info')}</span>`;
    logList.appendChild(li);
  }
}

$('clearLogBtn').addEventListener('click', async () => {
  await chrome.storage.local.set({ [LOG_KEY]: [] });
  renderLog();
});

/* ---------- init ---------- */

initSite();
renderPrefs();
renderLog();
