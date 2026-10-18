/* ============================================================
 * My Page Notes — personal page annotations
 * Fully local: notes stored in chrome.storage.local.
 * Honest scope: YOUR notes only — not community notes.
 *
 * Flow:
 *  - "Note on selection": click-only injection reads the tab's
 *    current text selection, you add a note anchored to it.
 *  - "Highlight my notes on this page": click-only injection
 *    wraps matching anchors in highlight spans.
 * ============================================================
 */
'use strict';

// ENGINE-START
/** Normalize a page URL for matching (drop hash, trailing slash). */
function pageKey(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let p = u.pathname.replace(/\/+$/, '');
    return u.origin + p + u.search;
  } catch {
    return (url || '').split('#')[0].trim();
  }
}

/** Build a note entry; returns {ok, note} or {ok:false, error}. */
function makeNote(url, snippet, text) {
  const key = pageKey(url);
  const t = (text || '').trim();
  if (!key) return { ok: false, error: 'Could not read the page URL.' };
  if (!t) return { ok: false, error: 'Write a note first.' };
  return {
    ok: true,
    note: {
      id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      url: key,
      snippet: (snippet || '').trim().slice(0, 200), // '' = whole-page note
      text: t.slice(0, 1000),
      createdAt: Date.now(),
    },
  };
}

/** Notes whose url matches the given page (normalized). */
function notesForUrl(notes, url) {
  const key = pageKey(url);
  return notes.filter((n) => n.url === key);
}

/** Free-text search across snippet/text/url. */
function filterNotes(notes, q) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return notes.slice();
  return notes.filter(
    (n) =>
      (n.snippet || '').toLowerCase().includes(s) ||
      n.text.toLowerCase().includes(s) ||
      n.url.toLowerCase().includes(s)
  );
}

function sortNotes(notes) {
  return notes.slice().sort((a, b) => b.createdAt - a.createdAt);
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// ENGINE-END

// ---------- storage ----------
const KEY = 'pageNotes';
async function loadNotes() {
  const r = await chrome.storage.local.get(KEY);
  return Array.isArray(r[KEY]) ? r[KEY] : [];
}
async function saveNotes(notes) {
  await chrome.storage.local.set({ [KEY]: notes });
}

// ---------- page helpers (injected on click only) ----------
function inject(fn, args) {
  return chrome.scripting.executeScript({
    target: { tabId: currentTab.id },
    func: fn,
    args: args || [],
  });
}
// Runs in the page: returns current selection text (trimmed, capped).
function getSelectionText() {
  const s = window.getSelection ? String(window.getSelection()) : '';
  return s.trim().slice(0, 200);
}
// Runs in the page: highlight every note snippet (skip script/style).
function highlightSnippets(snippets) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT']);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pats = snippets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(esc);
  if (!pats.length) return 0;
  const re = new RegExp(pats.join('|'), 'g');
  let hits = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const targets = [];
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    if (SKIP.has(n.parentElement && n.parentElement.tagName)) continue;
    if (n.parentElement && n.parentElement.closest('[data-mpn]')) continue;
    re.lastIndex = 0;
    if (re.test(n.nodeValue)) targets.push(n);
  }
  for (const n of targets) {
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    while ((m = re.exec(n.nodeValue))) {
      if (m.index > last) frag.appendChild(document.createTextNode(n.nodeValue.slice(last, m.index)));
      const sp = document.createElement('span');
      sp.setAttribute('data-mpn', '1');
      sp.style.cssText = 'background:rgba(167,139,250,.35);border-bottom:2px solid #a78bfa;cursor:help;';
      sp.title = 'My note: ' + m[0].slice(0, 60);
      sp.textContent = m[0];
      frag.appendChild(sp);
      hits++;
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(n.nodeValue.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }
  return hits;
}

// ---------- ui ----------
const $ = (id) => document.getElementById(id);
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let currentTab = null;
let notes = [];
let pendingSnippet = '';

function itemHtml(n, showUrl) {
  return (
    (n.snippet ? `<p class="snippet">“${escHtml(n.snippet)}”</p>` : `<p class="snippet">[page note]</p>`) +
    `<p class="note">${escHtml(n.text)}</p>` +
    `<div class="meta"><span class="url">${showUrl ? escHtml(n.url) + ' · ' : ''}${escHtml(fmtDate(n.createdAt))}</span>` +
    `<button class="del" data-id="${escHtml(n.id)}" title="Delete">×</button></div>`
  );
}

function render() {
  const here = currentTab ? notesForUrl(notes, currentTab.url) : [];
  const listThis = $('listThis');
  listThis.innerHTML = '';
  for (const n of sortNotes(here)) {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = itemHtml(n, false);
    listThis.appendChild(li);
  }
  const all = sortNotes(filterNotes(notes, $('q').value));
  const listAll = $('listAll');
  listAll.innerHTML = '';
  for (const n of all) {
    const li = document.createElement('li');
    li.className = 'item';
    li.innerHTML = itemHtml(n, true);
    listAll.appendChild(li);
  }
  $('emptyAll').hidden = all.length > 0;
}

function setHint(msg) {
  $('hint').textContent = msg || '';
}

document.addEventListener('DOMContentLoaded', async () => {
  notes = await loadNotes();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab || null;
  $('pageUrl').textContent = tab && tab.url ? tab.url : 'No page available';
  render();

  // tabs
  const tThis = $('tabThis'), tAll = $('tabAll');
  tThis.addEventListener('click', () => {
    tThis.classList.add('active'); tAll.classList.remove('active');
    $('paneThis').hidden = false; $('paneAll').hidden = true;
  });
  tAll.addEventListener('click', () => {
    tAll.classList.add('active'); tThis.classList.remove('active');
    $('paneThis').hidden = true; $('paneAll').hidden = false;
  });

  $('q').addEventListener('input', render);

  // add note flow
  $('addSel').addEventListener('click', async () => {
    setHint('');
    if (!currentTab || !/^https?:/.test(currentTab.url || '')) {
      setHint('Notes work on http(s) pages.');
      return;
    }
    try {
      const [res] = await inject(getSelectionText);
      const sel = (res && res.result) || '';
      pendingSnippet = sel;
      $('selText').textContent = sel ? `Selected: “${sel}”` : 'No text selected — this will be a page note.';
      $('addBox').hidden = false;
      $('noteText').focus();
    } catch {
      setHint('Could not read the selection on this page.');
    }
  });
  $('addPage').addEventListener('click', () => {
    pendingSnippet = '';
    $('selText').textContent = 'This will be a note on the whole page.';
    $('addBox').hidden = false;
    $('noteText').focus();
  });
  $('cancelNote').addEventListener('click', () => {
    $('addBox').hidden = true;
    $('noteText').value = '';
  });
  $('saveNote').addEventListener('click', async () => {
    const r = makeNote(currentTab ? currentTab.url : '', pendingSnippet, $('noteText').value);
    if (!r.ok) {
      setHint(r.error);
      return;
    }
    notes.push(r.note);
    await saveNotes(notes);
    $('addBox').hidden = true;
    $('noteText').value = '';
    render();
    setHint('Note saved.');
  });

  // highlight
  $('highlightBtn').addEventListener('click', async () => {
    setHint('');
    if (!currentTab || !/^https?:/.test(currentTab.url || '')) {
      setHint('Highlight works on http(s) pages.');
      return;
    }
    const here = notesForUrl(notes, currentTab.url).map((n) => n.snippet);
    if (!here.filter(Boolean).length) {
      setHint('No anchored notes for this page yet.');
      return;
    }
    try {
      const [res] = await inject(highlightSnippets, [here.filter(Boolean)]);
      setHint(`Highlighted ${res.result || 0} anchor${res.result === 1 ? '' : 's'} on this page.`);
    } catch {
      setHint('Could not highlight on this page.');
    }
  });

  // delete (delegated)
  document.querySelector('.card').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del');
    if (!btn) return;
    notes = notes.filter((n) => n.id !== btn.dataset.id);
    await saveNotes(notes);
    render();
  });
});
