/* Dual-Language Parallel Text Reader — popup logic.
   Everything is local (chrome.storage.local). No network, no translation. */

'use strict';

const $ = (id) => document.getElementById(id);
const ACCENT = '#8b5cf6';

// ---- Storage --------------------------------------------------------------
const store = {
  async get() {
    const { docs = [], activeId = null } = await chrome.storage.local.get(['docs', 'activeId']);
    return { docs, activeId };
  },
  async set(docs, activeId) {
    await chrome.storage.local.set({ docs, activeId });
  },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Split text on blank lines -> paragraphs (paragraphs align by order).
function splitParagraphs(text) {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
}

// ---- State -----------------------------------------------------------------
let docs = [];
let activeId = null;
let syncOn = true;
let syncing = false; // guard against scroll feedback loops

const activeDoc = () => docs.find((d) => d.id === activeId) || null;

// ---- Tabs ------------------------------------------------------------------
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    $('panel-' + btn.dataset.tab).classList.add('active');
  });
});

// ---- Reader ----------------------------------------------------------------
function renderReader() {
  const doc = activeDoc();
  const colA = $('col-a');
  const colB = $('col-b');
  colA.innerHTML = '';
  colB.innerHTML = '';
  const has = doc && (doc.parasA.length > 0 || doc.parasB.length > 0);
  $('read-empty').classList.toggle('hidden', !!has);
  $('sync-toggle').style.display = has ? '' : 'none';
  if (!doc || !has) { $('pair-count').textContent = ''; return; }

  const labelA = document.createElement('h4');
  labelA.textContent = doc.labelA || 'A';
  colA.appendChild(labelA);
  const labelB = document.createElement('h4');
  labelB.textContent = doc.labelB || 'B';
  colB.appendChild(labelB);

  const count = Math.max(doc.parasA.length, doc.parasB.length);
  $('pair-count').textContent = count + (count === 1 ? ' pair' : ' pairs');

  for (let i = 0; i < count; i++) {
    const note = (doc.notes && doc.notes[i]) || '';
    const pa = document.createElement('div');
    pa.className = 'para';
    pa.dataset.index = i;
    pa.textContent = doc.parasA[i] || '';
    if (note) { const dot = document.createElement('span'); dot.className = 'note-dot'; pa.appendChild(dot); }
    pa.title = 'Click to add/edit a note for pair ' + (i + 1);
    pa.addEventListener('click', () => openNote(i));
    const pb = document.createElement('div');
    pb.className = 'para';
    pb.dataset.index = i;
    pb.textContent = doc.parasB[i] || '';
    if (note) { const dot = document.createElement('span'); dot.className = 'note-dot'; pb.appendChild(dot); }
    pb.title = 'Click to add/edit a note for pair ' + (i + 1);
    pb.addEventListener('click', () => openNote(i));
    // Hovering one highlights its pair in the other column.
    const pair = [pa, pb];
    pair.forEach((el) => {
      el.addEventListener('mouseenter', () => pair.forEach((x) => x.classList.add('pair-selected')));
      el.addEventListener('mouseleave', () => pair.forEach((x) => x.classList.remove('pair-selected')));
    });
    colA.appendChild(pa);
    colB.appendChild(pb);
  }
}

// Synced scrolling: map scroll position by ratio between the two columns.
colSync('col-a', 'col-b');
function colSync(idA, idB) {
  const a = $(idA), b = $(idB);
  a.addEventListener('scroll', () => {
    if (!syncOn || syncing) return;
    syncing = true;
    const ratio = a.scrollTop / Math.max(1, a.scrollHeight - a.clientHeight);
    b.scrollTop = ratio * (b.scrollHeight - b.clientHeight);
    syncing = false;
  });
  b.addEventListener('scroll', () => {
    if (!syncOn || syncing) return;
    syncing = true;
    const ratio = b.scrollTop / Math.max(1, b.scrollHeight - b.clientHeight);
    a.scrollTop = ratio * (a.scrollHeight - a.clientHeight);
    syncing = false;
  });
}

$('sync-toggle').addEventListener('click', () => {
  syncOn = !syncOn;
  $('sync-toggle').setAttribute('aria-pressed', String(syncOn));
  $('sync-toggle').textContent = 'Sync scroll: ' + (syncOn ? 'on' : 'off');
});

// ---- Note dialog ------------------------------------------------------------
let noteIndex = null;
function openNote(i) {
  const doc = activeDoc();
  if (!doc) return;
  noteIndex = i;
  $('note-index').textContent = '#' + (i + 1);
  $('note-text').value = (doc.notes && doc.notes[i]) || '';
  $('note-overlay').classList.remove('hidden');
  $('note-text').focus();
}
async function saveNote() {
  const doc = activeDoc();
  if (!doc || noteIndex === null) return closeNote();
  doc.notes = doc.notes || {};
  doc.notes[noteIndex] = $('note-text').value.trim();
  await store.set(docs, activeId);
  renderReader();
  closeNote();
}
async function clearNote() {
  const doc = activeDoc();
  if (!doc || noteIndex === null) return closeNote();
  if (doc.notes) delete doc.notes[noteIndex];
  await store.set(docs, activeId);
  renderReader();
  closeNote();
}
function closeNote() {
  noteIndex = null;
  $('note-overlay').classList.add('hidden');
}
$('note-save').addEventListener('click', saveNote);
$('note-clear').addEventListener('click', clearNote);
$('note-cancel').addEventListener('click', closeNote);

// ---- Editor: save a document -------------------------------------------------
$('save-doc').addEventListener('click', async () => {
  const name = $('doc-name').value.trim() || 'Untitled document';
  const parasA = splitParagraphs($('text-a').value);
  const parasB = splitParagraphs($('text-b').value);
  if (parasA.length === 0 && parasB.length === 0) {
    $('text-a').focus();
    return;
  }
  const doc = {
    id: uid(),
    name,
    labelA: $('label-a').value.trim() || 'A',
    labelB: $('label-b').value.trim() || 'B',
    parasA,
    parasB,
    notes: {},
    created: Date.now(),
  };
  docs.unshift(doc);
  activeId = doc.id;
  await store.set(docs, activeId);
  renderReader();
  renderDocs();
  // Switch to the reader so the user sees the result immediately.
  document.querySelector('[data-tab="read"]').click();
});

// ---- Docs list ---------------------------------------------------------------
function renderDocs() {
  const list = $('doc-list');
  list.innerHTML = '';
  $('docs-empty').classList.toggle('hidden', docs.length > 0);
  docs.forEach((d) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = d.name;
    const meta = document.createElement('span');
    meta.className = 'meta';
    const count = Math.max(d.parasA.length, d.parasB.length);
    meta.textContent = (d.labelA || 'A') + ' / ' + (d.labelB || 'B') + ' · ' + count + ' pairs' + (d.id === activeId ? ' · active' : '');
    const open = document.createElement('button');
    open.textContent = 'Open';
    open.addEventListener('click', async () => {
      activeId = d.id;
      await store.set(docs, activeId);
      renderReader();
      renderDocs();
      document.querySelector('[data-tab="read"]').click();
    });
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.className = 'danger';
    del.addEventListener('click', async () => {
      docs = docs.filter((x) => x.id !== d.id);
      if (activeId === d.id) activeId = docs.length ? docs[0].id : null;
      await store.set(docs, activeId);
      renderReader();
      renderDocs();
    });
    li.append(name, meta, open, del);
    list.appendChild(li);
  });
}

// ---- Init --------------------------------------------------------------------
(async function init() {
  const s = await store.get();
  docs = s.docs;
  activeId = s.activeId;
  renderReader();
  renderDocs();
})();
