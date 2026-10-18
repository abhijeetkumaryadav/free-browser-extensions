/* Side Panel Demo — panel logic.
   Quick notes + bookmarks, persisted in chrome.storage.local. 100% local. */
'use strict';

const $ = (id) => document.getElementById(id);

/* ---------- state ---------- */
let notes = [];
let bookmarks = [];

async function load() {
  const data = await chrome.storage.local.get({ spd_notes: [], spd_bookmarks: [] });
  notes = data.spd_notes;
  bookmarks = data.spd_bookmarks;
  renderNotes();
  renderBookmarks();
}

async function save() {
  await chrome.storage.local.set({ spd_notes: notes, spd_bookmarks: bookmarks });
}

/* ---------- helpers ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString();
}

function cardHtml({ title, text, meta, delAttr }) {
  return '<div class="card"><div class="body">' +
    '<div class="title">' + title + '</div>' +
    (text ? '<div class="text">' + text + '</div>' : '') +
    '<div class="meta">' + meta + '</div></div>' +
    '<button class="icon-btn" data-del="' + delAttr + '" title="Delete">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
    '</button></div>';
}

/* ---------- notes ---------- */
function renderNotes() {
  const list = $('notesList');
  if (!notes.length) {
    list.innerHTML = '<div class="empty">No notes yet. Jot one above.</div>';
    return;
  }
  list.innerHTML = notes.map((n, i) => cardHtml({
    title: esc(n.title || 'Untitled'),
    text: esc(n.body || ''),
    meta: fmtDate(n.ts),
    delAttr: 'note:' + i
  })).join('');
}

$('addNoteBtn').addEventListener('click', async () => {
  const title = $('noteTitle').value.trim();
  const body = $('noteBody').value.trim();
  if (!title && !body) return;
  notes.unshift({ title: title || 'Untitled', body, ts: Date.now() });
  $('noteTitle').value = '';
  $('noteBody').value = '';
  await save();
  renderNotes();
});

/* ---------- bookmarks ---------- */
function renderBookmarks() {
  const list = $('bmList');
  if (!bookmarks.length) {
    list.innerHTML = '<div class="empty">No bookmarks yet. Save the current tab or type a URL.</div>';
    return;
  }
  list.innerHTML = bookmarks.map((b, i) => cardHtml({
    title: '<a href="' + esc(b.url) + '" target="_blank" rel="noopener">' + esc(b.title || b.url) + '</a>',
    text: '',
    meta: fmtDate(b.ts),
    delAttr: 'bm:' + i
  })).join('');
}

function validUrl(u) {
  return /^https?:\/\//i.test(u);
}

async function addBookmark(title, url) {
  if (!validUrl(url)) { alert('Please enter a valid http(s) URL.'); return; }
  bookmarks.unshift({ title: title || url, url, ts: Date.now() });
  await save();
  renderBookmarks();
}

$('addBmBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && validUrl(tab.url)) {
    addBookmark(tab.title || tab.url, tab.url);
  } else {
    alert('The current tab has no saveable URL.');
  }
});

$('addBmManualBtn').addEventListener('click', () => {
  const title = $('bmTitle').value.trim();
  const url = $('bmUrl').value.trim();
  if (!url) return;
  addBookmark(title, url);
  $('bmTitle').value = '';
  $('bmUrl').value = '';
});

/* ---------- delete (event delegation) ---------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  const [kind, idx] = btn.getAttribute('data-del').split(':');
  const i = Number(idx);
  if (kind === 'note') notes.splice(i, 1);
  else bookmarks.splice(i, 1);
  await save();
  renderNotes();
  renderBookmarks();
});

/* ---------- tab switching ---------- */
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.getAttribute('data-tab');
    $('notesPane').hidden = which !== 'notes';
    $('bookmarksPane').hidden = which !== 'bookmarks';
  });
});

load();
