/* C2PA Concepts — explainer + private notes. Educational only.
   Fully local: chrome.storage.local, zero network. */
'use strict';

/* ==================== ENGINE (headless-testable) ==================== */
// ENGINE-START

/** Bundled concept cards: title + plain-language text. */
const CONCEPTS = [
  {
    title: 'Content Credentials (C2PA)',
    text: 'An open standard that attaches tamper-evident provenance metadata to a file — who created it, when, and what edits were made. It is a claim about origin, not proof the content is true.'
  },
  {
    title: 'The manifest',
    text: 'The signed package of assertions stored inside (or alongside) the file. Assertions can include the creator, capture device, and an edit history. If the file is altered, the manifest no longer matches.'
  },
  {
    title: 'Digital signatures',
    text: 'A manifest is signed with the creator\u2019s private key. A signature proves the manifest came from the key holder and has not been changed since signing — it says nothing about whether the pixels are real.'
  },
  {
    title: 'Signers & certificates',
    text: 'The signer is identified by an X.509 certificate (like HTTPS certificates). A real verification tool checks the certificate chain back to a trusted root — this extension does not.'
  },
  {
    title: 'Trust lists',
    text: 'Verification tools consult a trust list of known-good certificate authorities. An unknown signer can still have a valid signature; it just means the tool has no reason to trust that signer.'
  },
  {
    title: 'What this tool cannot do',
    text: 'It cannot read a C2PA manifest, check a signature, or tell you whether an image is authentic. Metadata can be stripped or faked. Treat provenance as one clue, not a verdict.'
  }
];

/** Validate a note; returns the trimmed {title, body} or null. */
function makeNote(title, body) {
  const t = String(title || '').trim();
  const b = String(body || '').trim();
  if (!t) return null;
  return { id: 'n' + Date.now() + Math.floor(Math.random() * 1e6),
           title: t.slice(0, 80), body: b.slice(0, 1000), ts: Date.now() };
}

/** Newest-first sort (returns a new array). */
function sortNotes(notes) {
  return notes.slice().sort((a, b) => b.ts - a.ts);
}

/** Case-insensitive filter over title + body. */
function filterNotes(notes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return notes.slice();
  return notes.filter((n) =>
    n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q));
}

/** Short date label for a note timestamp. */
function fmtDate(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}
// ENGINE-END

/* ==================== UI ==================== */

const conceptList = document.getElementById('conceptList');
const noteBadge = document.getElementById('noteBadge');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const addNoteBtn = document.getElementById('addNote');
const searchBox = document.getElementById('searchBox');
const noteList = document.getElementById('noteList');

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    document.querySelectorAll('.tabpage').forEach((x) => x.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

/* --- learn tab --- */
conceptList.innerHTML = CONCEPTS.map((c) =>
  '<div class="concept"><h3>' + escapeHtml(c.title) + '</h3><p>' +
  escapeHtml(c.text) + '</p></div>').join('');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* --- notes --- */
let notes = [];

function renderNotes() {
  const list = filterNotes(sortNotes(notes), searchBox.value);
  noteBadge.textContent = String(notes.length);
  if (!list.length) {
    noteList.innerHTML = '<div class="empty">' +
      (notes.length ? 'No notes match your search.' : 'No notes yet — add your first one above.') +
      '</div>';
    return;
  }
  noteList.innerHTML = '';
  list.forEach((n) => {
    const el = document.createElement('div');
    el.className = 'note';
    const h = document.createElement('h4');
    h.textContent = n.title;
    const p = document.createElement('p');
    p.textContent = n.body || '(no details)';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('time');
    time.textContent = fmtDate(n.ts);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      notes = notes.filter((x) => x.id !== n.id);
      save(); renderNotes();
    });
    meta.append(time, del);
    el.append(h, p, meta);
    noteList.appendChild(el);
  });
}

function save() {
  chrome.storage.local.set({ notes });
}

addNoteBtn.addEventListener('click', () => {
  const n = makeNote(noteTitle.value, noteBody.value);
  if (!n) { noteTitle.focus(); return; }
  notes.push(n);
  noteTitle.value = '';
  noteBody.value = '';
  save(); renderNotes();
});

searchBox.addEventListener('input', renderNotes);

chrome.storage.local.get({ notes: [] }, (res) => {
  notes = Array.isArray(res.notes) ? res.notes : [];
  renderNotes();
});
