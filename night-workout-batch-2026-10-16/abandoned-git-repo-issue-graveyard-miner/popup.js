'use strict';

/* ============================================================
 * Repo Graveyard — Abandoned Repo Memorial
 * Your memorial — manual. Nothing is mined automatically;
 * you record repos yourself. GitHub links are plain anchors
 * YOU open in a new tab. This extension makes zero network
 * calls.
 * ============================================================ */

// ENGINE-START

// Storage keys
var GRAVE_KEY = 'repo_graves';
var NOTE_KEY = 'repo_graveyard_notes';

// Caps
var MAX_GRAVES = 500;
var MAX_NOTES = 500;

// ---- URL helpers ------------------------------------------------

/**
 * Normalize a repo URL: trim, upgrade bare domains to https://,
 * reject non-http(s) schemes.
 * Returns the cleaned URL string, or null if invalid.
 */
function cleanUrl(raw) {
  if (raw == null) return null;
  var s = String(raw).trim();
  if (!s) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s)) {
    // Has a scheme — only http/https allowed.
    if (!/^https?:\/\//i.test(s)) return null;
  } else {
    s = 'https://' + s;
  }
  if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) return null;
  return s;
}

/**
 * Build a GitHub search URL for a repo name.
 * The extension never fetches this — it is a plain link.
 */
function githubSearchUrl(name) {
  return 'https://github.com/search?q=' + encodeURIComponent(String(name)) + '&type=repositories';
}

// ---- Grave records ----------------------------------------------

/**
 * Create a grave record. Returns the record, or null if invalid.
 */
function makeGrave(name, url, eulogy) {
  var n = String(name == null ? '' : name).trim();
  var cleaned = cleanUrl(url);
  if (!n || !cleaned) return null;
  return {
    id: 'g' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    name: n.slice(0, 120),
    url: cleaned,
    eulogy: String(eulogy == null ? '' : eulogy).trim().slice(0, 500),
    buriedAt: Date.now()
  };
}

/**
 * Newest-first sort. Does not mutate the input array.
 */
function sortGraves(graves) {
  return (graves || []).slice().sort(function (a, b) {
    return (b.buriedAt || 0) - (a.buriedAt || 0);
  });
}

/**
 * Case-insensitive filter across name, URL and eulogy.
 * Empty query returns everything.
 */
function filterGraves(graves, query) {
  var q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return (graves || []).slice();
  return (graves || []).filter(function (g) {
    return (g.name + ' ' + g.url + ' ' + (g.eulogy || '')).toLowerCase().indexOf(q) !== -1;
  });
}

/**
 * Validate a stored/parsed import array of graves.
 * Returns a clean array; throws nothing.
 */
function validateGravesImport(data) {
  if (!Array.isArray(data)) return null;
  var out = [];
  for (var i = 0; i < data.length && out.length < MAX_GRAVES; i++) {
    var g = data[i];
    if (!g || typeof g !== 'object') continue;
    var grave = makeGrave(g.name, g.url, g.eulogy);
    if (grave) {
      if (typeof g.buriedAt === 'number') grave.buriedAt = g.buriedAt;
      out.push(grave);
    }
  }
  return out;
}

// ---- Notes ------------------------------------------------------

/**
 * Create a note record. Returns the record, or null if invalid.
 */
function makeNote(title, body) {
  var t = String(title == null ? '' : title).trim();
  if (!t) return null;
  return {
    id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    title: t.slice(0, 120),
    body: String(body == null ? '' : body).trim().slice(0, 2000),
    createdAt: Date.now()
  };
}

/**
 * Newest-first sort, non-mutating.
 */
function sortNotes(notes) {
  return (notes || []).slice().sort(function (a, b) {
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/**
 * Case-insensitive filter across title and body.
 */
function filterNotes(notes, query) {
  var q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return (notes || []).slice();
  return (notes || []).filter(function (n) {
    return (n.title + ' ' + (n.body || '')).toLowerCase().indexOf(q) !== -1;
  });
}

// ---- Formatting -------------------------------------------------

/**
 * Format a timestamp as a short local date string.
 */
function fmtDate(ts) {
  var d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Escape HTML for safe injection.
 */
function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ENGINE-END

// ---- UI wiring --------------------------------------------------

var graves = [];
var notes = [];

function loadState() {
  chrome.storage.local.get([GRAVE_KEY, NOTE_KEY], function (res) {
    graves = Array.isArray(res[GRAVE_KEY]) ? res[GRAVE_KEY] : [];
    notes = Array.isArray(res[NOTE_KEY]) ? res[NOTE_KEY] : [];
    renderGraves();
    renderNotes();
  });
}

function saveGraves(cb) {
  chrome.storage.local.set({ repo_graves: graves }, function () { if (cb) cb(); });
}

function saveNotes(cb) {
  chrome.storage.local.set({ repo_graveyard_notes: notes }, function () { if (cb) cb(); });
}

function renderGraves() {
  var q = document.getElementById('search').value;
  var list = document.getElementById('graveList');
  var filtered = sortGraves(filterGraves(graves, q));
  document.getElementById('graveCount').textContent =
    graves.length + (graves.length === 1 ? ' grave' : ' graves');
  document.getElementById('emptyGraves').style.display = filtered.length ? 'none' : 'block';
  list.innerHTML = '';
  filtered.forEach(function (g) {
    var li = document.createElement('li');
    li.className = 'grave';
    var eulogy = g.eulogy ? '<p class="eulogy">"' + escHtml(g.eulogy) + '"</p>' : '';
    li.innerHTML =
      '<div class="grave-head">' +
        '<span class="grave-name" title="' + escHtml(g.name) + '">' + escHtml(g.name) + '</span>' +
        '<span class="grave-date">' + escHtml(fmtDate(g.buriedAt)) + '</span>' +
        '<button class="del-btn" data-id="' + g.id + '" title="Dig up (delete)" aria-label="Delete grave">&times;</button>' +
      '</div>' + eulogy +
      '<div class="grave-links">' +
        '<a class="gh-link" href="' + escHtml(githubSearchUrl(g.name)) + '" target="_blank" rel="noopener">' +
          '<svg class="icon sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>' +
          'GitHub search</a>' +
        '<a class="repo-link" href="' + escHtml(g.url) + '" target="_blank" rel="noopener">Visit repo</a>' +
      '</div>';
    list.appendChild(li);
  });
}

function renderNotes() {
  var q = document.getElementById('noteSearch').value;
  var list = document.getElementById('noteList');
  var filtered = sortNotes(filterNotes(notes, q));
  list.innerHTML = '';
  filtered.forEach(function (n) {
    var li = document.createElement('li');
    li.className = 'note';
    li.innerHTML =
      '<div class="grave-head">' +
        '<span class="note-title">' + escHtml(n.title) + '</span>' +
        '<span class="grave-date">' + escHtml(fmtDate(n.createdAt)) + '</span>' +
        '<button class="del-btn" data-id="' + n.id + '" title="Delete note" aria-label="Delete note">&times;</button>' +
      '</div>' +
      (n.body ? '<p class="note-body">' + escHtml(n.body) + '</p>' : '');
    list.appendChild(li);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Tabs
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      t.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      document.getElementById('tab-' + t.dataset.tab).classList.add('active');
    });
  });

  // Bury form
  document.getElementById('buryForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = document.getElementById('buryError');
    err.hidden = true;
    if (graves.length >= MAX_GRAVES) {
      err.textContent = 'Graveyard is full (' + MAX_GRAVES + ' graves).';
      err.hidden = false;
      return;
    }
    var grave = makeGrave(
      document.getElementById('fName').value,
      document.getElementById('fUrl').value,
      document.getElementById('fEulogy').value
    );
    if (!grave) {
      err.textContent = 'Name and a valid http(s) URL are required.';
      err.hidden = false;
      return;
    }
    graves.push(grave);
    saveGraves(renderGraves);
    document.getElementById('buryForm').reset();
    tabs[0].click();
  });

  // Note form
  document.getElementById('noteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (notes.length >= MAX_NOTES) return;
    var note = makeNote(
      document.getElementById('nTitle').value,
      document.getElementById('nBody').value
    );
    if (!note) return;
    notes.push(note);
    saveNotes(renderNotes);
    document.getElementById('noteForm').reset();
  });

  // Searches
  document.getElementById('search').addEventListener('input', renderGraves);
  document.getElementById('noteSearch').addEventListener('input', renderNotes);

  // Delete buttons (event delegation)
  document.getElementById('graveList').addEventListener('click', function (e) {
    var btn = e.target.closest('.del-btn');
    if (!btn) return;
    graves = graves.filter(function (g) { return g.id !== btn.dataset.id; });
    saveGraves(renderGraves);
  });
  document.getElementById('noteList').addEventListener('click', function (e) {
    var btn = e.target.closest('.del-btn');
    if (!btn) return;
    notes = notes.filter(function (n) { return n.id !== btn.dataset.id; });
    saveNotes(renderNotes);
  });

  // Clear all graves
  document.getElementById('clearGraves').addEventListener('click', function () {
    if (!graves.length) return;
    if (confirm('Dig up every grave? This cannot be undone.')) {
      graves = [];
      saveGraves(renderGraves);
    }
  });

  loadState();
});
