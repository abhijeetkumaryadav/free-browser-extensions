'use strict';
/* GeoCities Webring — your retro-site list + random opener.
   Fully local: chrome.storage.local, zero network. */

// ENGINE-START
const STORE_KEY = 'webring.sites.v1';
const MAX_SITES = 500;

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

// Build a site entry. Returns null when invalid.
function makeSite(name, url, note) {
  const n = String(name || '').trim();
  const u = cleanUrl(url);
  if (!n || !u) return null;
  return {
    id: 'site-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36),
    name: n.slice(0, 80),
    url: u.slice(0, 300),
    note: String(note || '').trim().slice(0, 160),
    addedAt: Date.now(),
  };
}

// Pick a random entry from an array (or null when empty).
function pickRandom(sites, randFn) {
  if (!Array.isArray(sites) || sites.length === 0) return null;
  const r = (randFn || Math.random)();
  return sites[Math.floor(r * sites.length)];
}

// Case-insensitive filter across name, URL, and note.
function filterSites(sites, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return sites.slice();
  return sites.filter(s =>
    (s.name || '').toLowerCase().includes(q) ||
    (s.url || '').toLowerCase().includes(q) ||
    (s.note || '').toLowerCase().includes(q));
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
let sites = [];

async function load() {
  try {
    const r = await chrome.storage.local.get(STORE_KEY);
    sites = Array.isArray(r[STORE_KEY]) ? r[STORE_KEY] : [];
  } catch { sites = []; }
  render();
}

async function save() {
  await chrome.storage.local.set({ [STORE_KEY]: sites.slice(0, MAX_SITES) });
}

function render() {
  const list = $('list');
  const empty = $('empty');
  const query = $('search').value;
  const shown = filterSites(sites, query);
  list.innerHTML = '';
  empty.style.display = shown.length ? 'none' : 'block';
  $('surprise').disabled = sites.length === 0;
  for (const s of shown) {
    const li = document.createElement('li');
    li.className = 'site';
    li.innerHTML =
      '<div class="name"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
      esc(s.name) + '</a></div>' +
      '<div class="actions">' +
      '<button class="icon-btn open" data-id="' + esc(s.id) + '">Open</button>' +
      '<button class="icon-btn danger del" data-id="' + esc(s.id) + '">Delete</button>' +
      '</div>' +
      (s.note ? '<div class="note">' + esc(s.note) + '</div>' : '');
    list.appendChild(li);
  }
  list.querySelectorAll('.del').forEach(b =>
    b.addEventListener('click', async () => {
      sites = sites.filter(x => x.id !== b.dataset.id);
      await save(); render();
    }));
  list.querySelectorAll('.open').forEach(b =>
    b.addEventListener('click', () => {
      const s = sites.find(x => x.id === b.dataset.id);
      if (s) chrome.tabs.create({ url: s.url });
    }));
}

$('surprise').addEventListener('click', () => {
  const s = pickRandom(sites);
  if (s) chrome.tabs.create({ url: s.url });
});

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const s = makeSite($('fName').value, $('fUrl').value, $('fNote').value);
  if (!s) return;
  sites.unshift(s);
  if (sites.length > MAX_SITES) sites.length = MAX_SITES;
  $('fName').value = ''; $('fUrl').value = ''; $('fNote').value = '';
  await save(); render();
});

$('search').addEventListener('input', render);

document.addEventListener('DOMContentLoaded', load);
