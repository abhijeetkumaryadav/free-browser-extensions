/* ScoreScout popup logic.
 * - Detect likely title from the active tab (on-demand MAIN-world probe).
 * - Open IMDb / Rotten Tomatoes search URLs in new tabs.
 * - Manual score log persisted in chrome.storage.local, CSV export.
 * Everything is user-initiated; no network calls except the searches
 * the user explicitly opens.
 */
'use strict';

const $ = (id) => document.getElementById(id);
const titleInput = $('titleInput'), yearInput = $('yearInput');
const imdbScore = $('imdbScore'), rtScore = $('rtScore');
const logList = $('logList'), emptyLog = $('emptyLog'), detectNote = $('detectNote');

const LOG_KEY = 'scorescout_log';

/* ---------- title detection ---------- */

function showNote(text) {
  detectNote.textContent = text;
  detectNote.classList.remove('hidden');
}

$('detectBtn').addEventListener('click', async () => {
  showNote('Reading tab…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) { showNote('No active tab found.'); return; }
    if (!/^https?:/.test(tab.url || '')) {
      showNote('Title detection needs a regular web page (not chrome:// pages).');
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['title-probe.js'],
      world: 'MAIN'
    });
    const title = (result && result.result || '').trim();
    if (title) {
      titleInput.value = title;
      showNote('Title detected — check it, then search or log a score.');
    } else {
      showNote('Could not detect a title on this page. Type it manually.');
    }
  } catch (err) {
    showNote('Detection blocked on this page. Type the title manually.');
  }
});

/* ---------- search helpers ---------- */

function getQuery() {
  const t = titleInput.value.trim();
  const y = yearInput.value.trim();
  if (!t) { titleInput.focus(); showNote('Enter a title first.'); return null; }
  detectNote.classList.add('hidden');
  return y ? `${t} ${y}` : t;
}

$('imdbBtn').addEventListener('click', () => {
  const q = getQuery();
  if (q) chrome.tabs.create({ url: 'https://www.imdb.com/find?q=' + encodeURIComponent(q) });
});

$('rtBtn').addEventListener('click', () => {
  const q = getQuery();
  if (q) chrome.tabs.create({ url: 'https://www.rottentomatoes.com/search?search=' + encodeURIComponent(q) });
});

/* ---------- score log ---------- */

async function loadLog() {
  const data = await chrome.storage.local.get(LOG_KEY);
  return Array.isArray(data[LOG_KEY]) ? data[LOG_KEY] : [];
}

async function saveLog(entries) {
  await chrome.storage.local.set({ [LOG_KEY]: entries });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return ''; }
}

async function renderLog() {
  const entries = await loadLog();
  logList.innerHTML = '';
  emptyLog.style.display = entries.length ? 'none' : '';
  for (const e of entries) {
    const li = document.createElement('li');
    li.className = 'log-item';
    const imdbChip = e.imdb != null
      ? `<span class="score-chip">IMDb ${esc(e.imdb)}/10</span>`
      : `<span class="score-chip dim">IMDb —</span>`;
    const rtChip = e.rt != null
      ? `<span class="score-chip">RT ${esc(e.rt)}%</span>`
      : `<span class="score-chip dim">RT —</span>`;
    li.innerHTML = `
      <div class="meta">
        <div class="t">${esc(e.title)}</div>
        <div class="d">${esc(fmtDate(e.date))}</div>
      </div>
      ${imdbChip}${rtChip}
      <button class="del-btn" data-id="${esc(e.id)}" title="Delete entry">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>`;
    logList.appendChild(li);
  }
  logList.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const entries = await loadLog();
      await saveLog(entries.filter((e) => e.id !== btn.dataset.id));
      renderLog();
    });
  });
}

$('saveBtn').addEventListener('click', async () => {
  const title = titleInput.value.trim();
  if (!title) { titleInput.focus(); showNote('Enter a title first.'); return; }
  const imdb = imdbScore.value === '' ? null : Math.min(10, Math.max(0, parseFloat(imdbScore.value)));
  const rt = rtScore.value === '' ? null : Math.min(100, Math.max(0, parseInt(rtScore.value, 10)));
  if (imdb == null && rt == null) { showNote('Enter at least one score (IMDb or RT).'); return; }
  if (imdb != null && Number.isNaN(imdb)) { showNote('IMDb score must be a number 0–10.'); return; }
  if (rt != null && Number.isNaN(rt)) { showNote('RT score must be a number 0–100.'); return; }
  const entries = await loadLog();
  entries.unshift({
    id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title,
    year: yearInput.value.trim() || null,
    imdb,
    rt,
    date: new Date().toISOString()
  });
  await saveLog(entries);
  imdbScore.value = ''; rtScore.value = '';
  detectNote.classList.add('hidden');
  renderLog();
});

/* ---------- CSV export ---------- */

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

$('exportBtn').addEventListener('click', async () => {
  const entries = await loadLog();
  if (!entries.length) { showNote('Nothing to export yet.'); return; }
  const rows = [['Title', 'Year', 'IMDb (/10)', 'Rotten Tomatoes (%)', 'Logged']];
  for (const e of entries) {
    rows.push([e.title, e.year || '', e.imdb != null ? e.imdb : '', e.rt != null ? e.rt : '', fmtDate(e.date)]);
  }
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'scorescout-log.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

renderLog();
