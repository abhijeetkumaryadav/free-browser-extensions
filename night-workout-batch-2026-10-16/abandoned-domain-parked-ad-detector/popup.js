'use strict';
/* Parked Domain Spotter — educational parked-domain red-flag guide + personal notes log.
   ZERO network. Notes stored in chrome.storage.local. */

// ENGINE-START
// --- Static red-flag guide content (bundled, educational) ---
const RED_FLAGS = [
  { title: 'Wall of ad links, no real content',
    body: 'Parked pages are usually just a grid of sponsored links or a search box. <em>No real article, product, or service</em> exists on the page.' },
  { title: '"This domain is for sale" banner',
    body: 'Explicit for-sale notices, "buy this domain" buttons, or Sedo/Afternic-style landers are the <em>definition of a parked domain</em>.' },
  { title: 'Generic, mismatched ad topics',
    body: 'Ads about unrelated topics (insurance, payday loans, casino links) that have <em>nothing to do with the domain name</em> signal an automated parking template.' },
  { title: 'Look-alike or misspelled domain',
    body: 'Typos of famous brands (paypa1, gooogle) are parked <em>on purpose</em> to catch typing mistakes. Compare the spelling letter by letter.' },
  { title: 'No navigation, about page, or contact info',
    body: 'Real businesses have menus, addresses, privacy policies. Parked pages have <em>none of these</em> — just links out.' },
  { title: 'Search results treat it as suspicious',
    body: 'Searching the domain plus words like <em>"reviews" or "scam"</em> returning nothing — or warnings — is a signal the site has no legitimate footprint.' },
  { title: 'Brand-new registration with big promises',
    body: 'A domain registered weeks ago claiming to be an <em>established store or bank</em> deserves extra skepticism. Parked templates are cheap to spin up.' },
  { title: 'Redirect chains to a different site',
    body: 'Type the domain and watch the address bar: <em>multiple quick redirects</em> ending somewhere unexpected is a classic squatting pattern.' },
];

// --- Notes engine ---
const MAX_NOTES = 500;

function makeNote(domain, title, body) {
  const d = String(domain || '').trim();
  if (!d) return null; // domain required
  const b = String(body || '').trim();
  if (!b) return null; // body required
  return {
    id: 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    domain: d.slice(0, 120),
    title: String(title || '').trim().slice(0, 80),
    body: b.slice(0, 1000),
    createdAt: Date.now(),
  };
}

function sortNotes(notes) {
  // newest first; returns a new array, never mutates input
  return Array.isArray(notes) ? notes.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) : [];
}

function filterNotes(notes, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return Array.isArray(notes) ? notes.slice() : [];
  return (Array.isArray(notes) ? notes : []).filter(n =>
    (n.domain || '').toLowerCase().includes(q) ||
    (n.title || '').toLowerCase().includes(q) ||
    (n.body || '').toLowerCase().includes(q));
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
const tabs = document.querySelectorAll('.tab');
const panels = { guide: document.getElementById('tab-guide'), notes: document.getElementById('tab-notes') };
tabs.forEach(t => t.addEventListener('click', () => {
  tabs.forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  Object.values(panels).forEach(p => p.classList.add('hidden'));
  panels[t.dataset.tab].classList.remove('hidden');
}));

// Render red-flag guide
(function renderGuide() {
  const box = document.getElementById('flags');
  box.innerHTML = RED_FLAGS.map((f, i) =>
    `<div class="card flag"><div class="flag-num">${i + 1}</div><div><h3>${esc(f.title)}</h3><p>${f.body}</p></div></div>`
  ).join('');
})();

// Notes storage
const STORAGE_KEY = 'parkedNotes';
let allNotes = [];

function loadNotes() {
  chrome.storage.local.get(STORAGE_KEY, data => {
    allNotes = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
    renderNotes();
  });
}
function saveNotes() {
  chrome.storage.local.set({ [STORAGE_KEY]: allNotes.slice(0, MAX_NOTES) });
}

function renderNotes() {
  const q = document.getElementById('noteSearch').value;
  const list = filterNotes(allNotes, q);
  const box = document.getElementById('notes');
  document.getElementById('noteCount').textContent = String(allNotes.length);
  if (!list.length) {
    box.innerHTML = `<div class="card empty">${allNotes.length ? 'No notes match your search.' : 'No notes yet — jot down domains that look parked.'}</div>`;
    return;
  }
  box.innerHTML = sortNotes(list).map(n =>
    `<div class="card note">
      <div class="note-head"><strong>${esc(n.domain)}</strong><button class="note-del" data-id="${n.id}" title="Delete">&#10005;</button></div>
      ${n.title ? `<p class="note-title">${esc(n.title)}</p>` : ''}
      <p class="note-body">${esc(n.body)}</p>
      <span class="note-time">${esc(fmtWhen(n.createdAt))}</span>
    </div>`
  ).join('');
  box.querySelectorAll('.note-del').forEach(btn => btn.addEventListener('click', () => {
    allNotes = allNotes.filter(n => n.id !== btn.dataset.id);
    saveNotes(); renderNotes();
  }));
}

document.getElementById('addNote').addEventListener('click', () => {
  const n = makeNote(
    document.getElementById('noteDomain').value,
    document.getElementById('noteTitle').value,
    document.getElementById('noteBody').value);
  if (!n) return;
  allNotes.unshift(n);
  saveNotes(); renderNotes();
  document.getElementById('noteDomain').value = '';
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteBody').value = '';
});
document.getElementById('noteSearch').addEventListener('input', renderNotes);
document.getElementById('clearNotes').addEventListener('click', () => {
  if (allNotes.length && confirm('Delete all your suspicious-domain notes?')) {
    allNotes = []; saveNotes(); renderNotes();
  }
});

loadNotes();
