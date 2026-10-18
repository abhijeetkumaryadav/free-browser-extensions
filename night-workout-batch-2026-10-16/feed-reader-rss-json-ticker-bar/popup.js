/* Feed List — personal RSS/JSON feed manager. Feeds are saved, never auto-fetched.
 * Fully local; chrome.storage.local only; no network. */
'use strict';

/* ================= Pure logic engine (headless-testable) ================= */
// ENGINE-START

/** Create a validated feed object, or null if invalid. */
function makeFeed(name, url, type) {
  name = (name || '').trim();
  url = (url || '').trim();
  if (!name || !url) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  type = (type === 'json') ? 'json' : 'rss';
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    name: name.slice(0, 120),
    url: url.slice(0, 500),
    type,
    notes: [],
    createdAt: Date.now()
  };
}

/** Create a validated manual article note, or null. */
function makeNote(text) {
  text = (text || '').trim().slice(0, 1000);
  if (!text) return null;
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), text, createdAt: Date.now() };
}

/** Sort feeds newest-first; returns NEW array. */
function sortFeeds(list) {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Case-insensitive filter across feed name/url and note text. */
function filterFeeds(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(f =>
    (f.name || '').toLowerCase().includes(q) ||
    (f.url || '').toLowerCase().includes(q) ||
    (f.notes || []).some(n => (n.text || '').toLowerCase().includes(q))
  );
}

/** Validate import payload; returns feeds array or null. */
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const f = makeFeed(item.name, item.url, item.type);
    if (!f) continue;
    if (Array.isArray(item.notes)) {
      for (const n of item.notes) {
        const note = makeNote(n && n.text);
        if (note) f.notes.push(note);
      }
    }
    out.push(f);
  }
  return out;
}

/** Serialize feeds for export. */
function serializeExport(list) {
  return JSON.stringify(list.map(f => ({
    name: f.name, url: f.url, type: f.type,
    notes: (f.notes || []).map(n => ({ text: n.text, createdAt: n.createdAt }))
  })), null, 2);
}

/** Human-friendly timestamp. */
function fmtWhen(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
// ENGINE-END

/* ================= Storage ================= */
const KEY = 'feedListFeeds';
const MAX_FEEDS = 200;
const MAX_NOTES = 200;

async function loadFeeds() {
  const { [KEY]: list } = await chrome.storage.local.get(KEY);
  return Array.isArray(list) ? list : [];
}
async function saveFeeds(list) {
  await chrome.storage.local.set({ [KEY]: list.slice(0, MAX_FEEDS) });
}

/* ================= UI ================= */
const $ = id => document.getElementById(id);

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let openFeedId = null;

async function render() {
  const feeds = sortFeeds(await loadFeeds());
  const shown = filterFeeds(feeds, $('q').value);
  $('count').textContent = feeds.length;
  const box = $('feeds');
  box.innerHTML = '';
  if (!shown.length) {
    box.innerHTML = '<div class="empty">No feeds yet — add your first feed above.</div>';
    return;
  }
  for (const f of shown) {
    const div = document.createElement('div');
    div.className = 'feed';
    const notes = (f.notes || []).slice().sort((a, b) => b.createdAt - a.createdAt);
    div.innerHTML =
      '<div class="name">' + esc(f.name) + '</div>' +
      '<div class="meta"><span class="tag">' + esc(f.type.toUpperCase()) + '</span> <a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.url) + '</a></div>' +
      '<div class="actions">' +
        '<button class="btn-notes" data-id="' + f.id + '">Notes (' + notes.length + ')</button>' +
        '<button class="btn-del" data-id="' + f.id + '">Delete</button>' +
      '</div>' +
      '<div class="notes ' + (openFeedId === f.id ? '' : 'hidden') + '">' +
        notes.map(n =>
          '<div class="note">' + esc(n.text) +
            '<span class="when">' + esc(fmtWhen(n.createdAt)) + '</span>' +
            '<button class="note-del" data-fid="' + f.id + '" data-nid="' + n.id + '">Delete note</button>' +
          '</div>'
        ).join('') +
        '<div class="add-note">' +
          '<input type="text" placeholder="Add manual article note…" maxlength="1000" data-fid="' + f.id + '">' +
          '<button data-fid="' + f.id + '">Add</button>' +
        '</div>' +
      '</div>';
    box.appendChild(div);
  }

  box.querySelectorAll('.btn-notes').forEach(b => b.addEventListener('click', () => {
    openFeedId = (openFeedId === b.dataset.id) ? null : b.dataset.id;
    render();
  }));
  box.querySelectorAll('.btn-del').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this feed and its notes?')) return;
    await saveFeeds((await loadFeeds()).filter(f => f.id !== b.dataset.id));
    render();
  }));
  box.querySelectorAll('.note-del').forEach(b => b.addEventListener('click', async () => {
    const feeds2 = await loadFeeds();
    const f = feeds2.find(x => x.id === b.dataset.fid);
    if (f) { f.notes = (f.notes || []).filter(n => n.id !== b.dataset.nid); await saveFeeds(feeds2); }
    render();
  }));
  box.querySelectorAll('.add-note button').forEach(b => b.addEventListener('click', async () => {
    const input = box.querySelector('.add-note input[data-fid="' + b.dataset.fid + '"]');
    const note = makeNote(input.value);
    if (!note) return;
    const feeds2 = await loadFeeds();
    const f = feeds2.find(x => x.id === b.dataset.fid);
    if (f) {
      f.notes = (f.notes || []);
      f.notes.push(note);
      f.notes = f.notes.slice(-MAX_NOTES);
      await saveFeeds(feeds2);
    }
    render();
  }));
}

function msg(t) { $('formMsg').textContent = t; }

document.addEventListener('DOMContentLoaded', () => {
  render();

  $('btnAdd').addEventListener('click', async () => {
    const f = makeFeed($('fName').value, $('fUrl').value, $('fType').value);
    if (!f) { msg('Add a name and an http(s) feed URL.'); return; }
    const list = await loadFeeds();
    if (list.length >= MAX_FEEDS) { msg('Feed list is full (200 feeds).'); return; }
    list.push(f);
    await saveFeeds(list);
    $('fName').value = ''; $('fUrl').value = '';
    msg('Added "' + f.name + '".');
    render();
  });

  $('q').addEventListener('input', render);

  $('btnClear').addEventListener('click', async () => {
    if (!confirm('Delete all feeds and notes? This cannot be undone.')) return;
    await saveFeeds([]);
    render();
  });

  $('btnExport').addEventListener('click', async () => {
    const blob = new Blob([serializeExport(await loadFeeds())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'feed-list.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  $('btnImport').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    const imported = parseImport(await file.text());
    if (imported === null) { msg('Import failed: not a valid JSON array.'); return; }
    await saveFeeds((await loadFeeds()).concat(imported).slice(0, MAX_FEEDS));
    msg('Imported ' + imported.length + ' feed' + (imported.length === 1 ? '' : 's') + '.');
    render();
    ev.target.value = '';
  });
});
