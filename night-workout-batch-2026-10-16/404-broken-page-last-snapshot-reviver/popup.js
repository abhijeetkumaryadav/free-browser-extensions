'use strict';
/* 404 Snapshot Log — your broken-link log.
   No live fetching: archive.org links open in a new tab when YOU click.
   The extension itself makes zero network calls. */

// ENGINE-START
const STORE_KEY = 'snapshotlog.links.v1';
const MAX_LINKS = 500;

// Normalize a URL: trim, reject non-http(s) schemes.
function cleanUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  let u = s;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(u)) u = 'https://' + u;
  try {
    const p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return '';
    return p.href;
  } catch { return ''; }
}

// Build an archive.org "latest snapshot" URL for a page URL.
function archiveUrl(pageUrl) {
  return 'https://web.archive.org/web/' + encodeURIComponent(pageUrl);
}

// Build a link entry. Returns null when invalid.
function makeLink(url, title, note) {
  const u = cleanUrl(url);
  if (!u) return null;
  return {
    id: 'link-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
    url: u.slice(0, 400),
    title: String(title || '').trim().slice(0, 120),
    note: String(note || '').trim().slice(0, 400),
    addedAt: Date.now(),
  };
}

// Newest-first, immutable sort.
function sortLinks(links) {
  return links.slice().sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

// Case-insensitive filter across url, title, note.
function filterLinks(links, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return links.slice();
  return links.filter(l =>
    (l.url || '').toLowerCase().includes(q) ||
    (l.title || '').toLowerCase().includes(q) ||
    (l.note || '').toLowerCase().includes(q));
}

// Friendly date label.
function fmtWhen(ts) {
  const d = new Date(ts);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Escape HTML for safe rendering.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
// ENGINE-END

/* ---------------- UI wiring ---------------- */
const $ = (id) => document.getElementById(id);
let links = [];

async function load() {
  try {
    const r = await chrome.storage.local.get(STORE_KEY);
    links = Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
  } catch { links = []; }
  render();
}

async function save() {
  await chrome.storage.local.set({ [STORE_KEY]: links.slice(0, MAX_LINKS) });
}

function render() {
  const list = $('list');
  const empty = $('empty');
  const shown = sortLinks(filterLinks(links, $('search').value));
  list.innerHTML = '';
  empty.style.display = shown.length ? 'none' : 'block';
  for (const l of shown) {
    const li = document.createElement('li');
    li.className = 'link';
    const label = l.title || l.url;
    li.innerHTML =
      '<div class="title">' + esc(label) + '</div>' +
      '<div class="actions">' +
      '<button class="icon-btn accent snap" data-id="' + esc(l.id) + '">Snapshot</button>' +
      '<button class="icon-btn del danger" data-id="' + esc(l.id) + '">Delete</button>' +
      '</div>' +
      '<div class="url">' + esc(l.url) + '</div>' +
      (l.note ? '<div class="note">' + esc(l.note) + '</div>' : '') +
      '<div class="when">Logged ' + esc(fmtWhen(l.addedAt)) + '</div>';
    list.appendChild(li);
  }
  list.querySelectorAll('.del').forEach(b =>
    b.addEventListener('click', async () => {
      links = links.filter(x => x.id !== b.dataset.id);
      await save(); render();
    }));
  // Plain anchors: the user opens archive.org themselves; no fetch happens.
  list.querySelectorAll('.snap').forEach(b =>
    b.addEventListener('click', () => {
      const l = links.find(x => x.id === b.dataset.id);
      if (l) chrome.tabs.create({ url: archiveUrl(l.url) });
    }));
}

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const l = makeLink($('fUrl').value, $('fTitle').value, $('fNote').value);
  if (!l) return;
  links.unshift(l);
  if (links.length > MAX_LINKS) links.length = MAX_LINKS;
  $('fUrl').value = ''; $('fTitle').value = ''; $('fNote').value = '';
  await save(); render();
});

$('search').addEventListener('input', render);

document.addEventListener('DOMContentLoaded', load);
