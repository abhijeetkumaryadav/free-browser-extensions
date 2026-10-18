/**
 * WatchLog popup logic — manual watch history + Trakt-style CSV export.
 *
 * Honest scope: NO Trakt API, no auto-detection. The user clicks
 * "Log this tab" and the current tab's title/URL is saved with a timestamp.
 * Export produces a CSV with columns: title, year, type, watched_at, url —
 * a common layout accepted by Trakt-style list importers. The user can
 * adjust the file before importing anywhere.
 */
'use strict';

const KEY = 'watchlog.entries'; // [{ id, title, url, year, type, watchedAt }]

const $ = (id) => document.getElementById(id);

let entries = [];
let filter = '';

async function load() {
  try {
    const stored = await chrome.storage.local.get([KEY]);
    entries = stored[KEY] || [];
  } catch (_) { entries = []; }
  render();
}

async function save() {
  try { await chrome.storage.local.set({ [KEY]: entries }); } catch (_) {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Try to pull a 4-digit year out of the page title, e.g. "Dune (2021)". */
function guessYear(title) {
  const m = title.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : '';
}

async function logCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  entries.unshift({
    id: uid(),
    title: (tab.title || 'Untitled').trim(),
    url: tab.url || '',
    year: guessYear(tab.title || ''),
    type: 'movie',
    watchedAt: Date.now(),
  });
  await save();
  render();
}

function render() {
  $('entryCount').textContent = String(entries.length);
  const list = $('entries');
  list.innerHTML = '';

  const shown = entries.filter((e) =>
    !filter || (e.title + ' ' + e.url).toLowerCase().includes(filter)
  );
  $('empty').style.display = shown.length ? 'none' : 'block';

  for (const e of shown) {
    const li = document.createElement('li');

    const title = document.createElement('div');
    title.className = 'entry-title';
    title.textContent = e.title;
    li.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'entry-meta';
    const date = document.createElement('span');
    date.textContent = fmtDate(e.watchedAt);
    const type = document.createElement('span');
    type.textContent = e.type === 'show' ? '📺 show' : '🎬 movie';
    const year = document.createElement('span');
    year.textContent = e.year || 'no year';
    meta.append(date, type, year);
    li.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const edit = document.createElement('button');
    edit.className = 'mini';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editEntry(e.id));
    const toggleType = document.createElement('button');
    toggleType.className = 'mini';
    toggleType.textContent = e.type === 'show' ? '→ movie' : '→ show';
    toggleType.title = 'Toggle movie/show';
    toggleType.addEventListener('click', async () => {
      e.type = e.type === 'show' ? 'movie' : 'show';
      await save(); render();
    });
    const del = document.createElement('button');
    del.className = 'mini del';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      entries = entries.filter((x) => x.id !== e.id);
      await save(); render();
    });
    actions.append(edit, toggleType, del);
    li.appendChild(actions);

    list.appendChild(li);
  }
}

async function editEntry(id) {
  const e = entries.find((x) => x.id === id);
  if (!e) return;
  const title = prompt('Title:', e.title);
  if (title === null) return;
  const year = prompt('Year (optional, YYYY):', e.year || '');
  if (year === null) return;
  e.title = title.trim() || e.title;
  e.year = /^\d{4}$/.test(year.trim()) ? year.trim() : '';
  await save();
  render();
}

/** CSV escape: quote fields containing , " or newlines. */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function toCSV(rows) {
  const header = ['title', 'year', 'type', 'watched_at', 'url'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csvCell(r.title),
      csvCell(r.year),
      csvCell(r.type),
      csvCell(new Date(r.watchedAt).toISOString()),
      csvCell(r.url),
    ].join(','));
  }
  return lines.join('\r\n');
}

function exportCSV() {
  if (!entries.length) return;
  const csv = toCSV([...entries].reverse()); // oldest first
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'watchlog-export.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function clearAll() {
  if (!entries.length) return;
  if (!confirm('Delete all logged entries?')) return;
  entries = [];
  await save();
  render();
}

$('logBtn').addEventListener('click', logCurrentTab);
$('exportBtn').addEventListener('click', exportCSV);
$('clearBtn').addEventListener('click', clearAll);
$('search').addEventListener('input', (e) => {
  filter = e.target.value.trim().toLowerCase();
  render();
});

load();
