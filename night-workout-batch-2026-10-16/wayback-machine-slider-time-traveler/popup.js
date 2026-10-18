'use strict';
/* Snapshot Time Traveler — your own page-snapshot log with Wayback Machine links.
   The extension itself makes ZERO network calls. Links are plain anchors you open. */

// ENGINE-START
const MAX_ENTRIES = 500;

// Accept a raw user URL: require http(s), normalize, reject dangerous schemes.
function cleanUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) ? s : 'https://' + s;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href.slice(0, 500);
  } catch (e) {
    return null;
  }
}

function makeEntry(url, title, notes) {
  const u = cleanUrl(url);
  if (!u) return null;
  return {
    id: 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    url: u,
    title: String(title || '').trim().slice(0, 100),
    notes: String(notes || '').trim().slice(0, 1000),
    createdAt: Date.now(),
  };
}

// Wayback Machine link formats for a saved URL (opened by the user in a new tab)
function waybackUrl(url) {
  return 'https://web.archive.org/web/*/' + url;
}
function waybackLatestUrl(url) {
  return 'https://web.archive.org/web/2id_/' + url;
}

function sortEntries(entries) {
  // newest first; immutable
  return Array.isArray(entries) ? entries.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
}

function filterEntries(entries, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return Array.isArray(entries) ? entries.slice() : [];
  return (Array.isArray(entries) ? entries : []).filter(e =>
    (e.title || '').toLowerCase().includes(q) ||
    (e.url || '').toLowerCase().includes(q) ||
    (e.notes || '').toLowerCase().includes(q));
}

function fmtWhen(ts) {
  const d = new Date(Number(ts) || Date.now());
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ENGINE-END

// --- UI wiring ---
const STORAGE_KEY = 'snapshotLog';
let allEntries = [];

function loadEntries() {
  chrome.storage.local.get(STORAGE_KEY, data => {
    allEntries = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    renderEntries();
  });
}
function saveEntries() {
  chrome.storage.local.set({ [STORAGE_KEY]: allEntries.slice(0, MAX_ENTRIES) });
}

const linkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

function renderEntries() {
  const q = document.getElementById('entrySearch').value;
  const list = filterEntries(allEntries, q);
  const box = document.getElementById('entries');
  if (!list.length) {
    box.innerHTML = `<div class="card empty">${allEntries.length ? 'No entries match your search.' : 'Log is empty — save pages you want to time-travel later.'}</div>`;
    return;
  }
  box.innerHTML = sortEntries(list).map(e =>
    `<div class="card entry">
      <div class="entry-head">
        <div>
          ${e.title ? `<p class="entry-label">${esc(e.title)}</p>` : ''}
          <p class="entry-url">${esc(e.url)}</p>
        </div>
        <button class="entry-del" data-id="${e.id}" title="Delete">&#10005;</button>
      </div>
      ${e.notes ? `<p class="entry-notes">${esc(e.notes)}</p>` : ''}
      <div class="entry-foot">
        <span class="entry-time">${esc(fmtWhen(e.createdAt))}</span>
        <div class="entry-links">
          <a class="wb-link" href="${esc(waybackUrl(e.url))}" target="_blank" rel="noopener noreferrer">${linkIcon}Wayback list</a>
          <a class="wb-link" href="${esc(waybackLatestUrl(e.url))}" target="_blank" rel="noopener noreferrer">${linkIcon}Latest</a>
        </div>
      </div>
    </div>`
  ).join('');
  box.querySelectorAll('.entry-del').forEach(btn => btn.addEventListener('click', () => {
    allEntries = allEntries.filter(e => e.id !== btn.dataset.id);
    saveEntries(); renderEntries();
  }));
}

document.getElementById('addEntry').addEventListener('click', () => {
  const e = makeEntry(
    document.getElementById('entryUrl').value,
    document.getElementById('entryTitle').value,
    document.getElementById('entryNotes').value);
  if (!e) return;
  allEntries.unshift(e);
  saveEntries(); renderEntries();
  document.getElementById('entryUrl').value = '';
  document.getElementById('entryTitle').value = '';
  document.getElementById('entryNotes').value = '';
});
document.getElementById('entrySearch').addEventListener('input', renderEntries);
document.getElementById('clearAll').addEventListener('click', () => {
  if (allEntries.length && confirm('Delete your entire snapshot log?')) {
    allEntries = []; saveEntries(); renderEntries();
  }
});

loadEntries();
