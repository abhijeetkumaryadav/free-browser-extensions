'use strict';
/* DOI Wishlist — your DOI list with Unpaywall/OpenAlex search links. Zero network. */

// ENGINE-START
// DOI syntax: 10.<registrant>/<suffix> — registrant is 4+ digits.
const DOI_RE = /^10\.\d{4,}(?:\.\d+)*\/\S+$/i;

function cleanDoi(raw) {
  if (typeof raw !== 'string') return '';
  let d = raw.trim();
  d = d.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  return d;
}

function isValidDoi(raw) {
  return DOI_RE.test(cleanDoi(raw));
}

function makeEntry(doi, title, note) {
  const d = cleanDoi(doi);
  if (!isValidDoi(d)) return null;
  return {
    id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
    doi: d,
    title: (title || '').trim().slice(0, 200),
    note: (note || '').trim().slice(0, 300),
    addedAt: Date.now()
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => b.addedAt - a.addedAt); // newest first, immutable
}

function filterEntries(entries, q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return entries;
  return entries.filter(e =>
    e.doi.toLowerCase().includes(query) ||
    (e.title || '').toLowerCase().includes(query) ||
    (e.note || '').toLowerCase().includes(query));
}

function unpaywallUrl(doi) {
  return 'https://unpaywall.org/' + doi; // DOI already validated: no spaces/specials beyond suffix
}

function openAlexUrl(doi) {
  return 'https://openalex.org/works/https://doi.org/' + encodeURIComponent(doi);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ENGINE-END

// ---------- UI (browser only) ----------
const $ = id => document.getElementById(id);
const STORAGE_KEY = 'doi_wishlist_entries';
let entries = [];

async function load() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  entries = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  render();
}

async function save() {
  await chrome.storage.local.set({ [STORAGE_KEY]: entries });
}

function render() {
  const q = $('q').value;
  const shown = sortEntries(filterEntries(entries, q));
  $('count').textContent = entries.length;
  const list = $('list');
  if (!shown.length) {
    list.innerHTML = '<div class="empty">No DOIs yet. Add one above.</div>';
    return;
  }
  list.innerHTML = shown.map(e => `
    <div class="item" data-id="${esc(e.id)}">
      <div class="doi">${esc(e.doi)}</div>
      ${e.title ? `<div class="ttl">${esc(e.title)}</div>` : ''}
      ${e.note ? `<div class="nt">${esc(e.note)}</div>` : ''}
      <div class="row">
        <a href="${esc(unpaywallUrl(e.doi))}" target="_blank" rel="noopener">Unpaywall</a>
        <a href="${esc(openAlexUrl(e.doi))}" target="_blank" rel="noopener">OpenAlex</a>
        <button class="del" data-del="${esc(e.id)}">Delete</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async () => {
      entries = entries.filter(e => e.id !== btn.dataset.del);
      await save();
      render();
    });
  });
}

$('addForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  const err = $('err');
  const entry = makeEntry($('doi').value, $('title').value, $('note').value);
  if (!entry) {
    err.textContent = 'That does not look like a valid DOI (e.g. 10.1038/nature12373).';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  entries.push(entry);
  $('doi').value = ''; $('title').value = ''; $('note').value = '';
  await save();
  render();
});

$('q').addEventListener('input', render);

$('clearAll').addEventListener('click', async () => {
  if (!entries.length) return;
  if (confirm('Remove all saved DOIs?')) {
    entries = [];
    await save();
    render();
  }
});

load();
