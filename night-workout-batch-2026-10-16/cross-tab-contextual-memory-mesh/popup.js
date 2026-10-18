// Memory Mesh — shared cross-tab scratchpad.
// Notes live in chrome.storage.local; every popup instance re-renders on
// storage.onChanged so notes appear in every open tab/window instantly.
// Honest scope: your tabs only — not a distributed mesh, 100% local.

const STORAGE_KEY = 'memory_mesh_notes';
const MAX_NOTES = 500;

const els = {
  title: document.getElementById('noteTitle'),
  body: document.getElementById('noteBody'),
  addBtn: document.getElementById('addBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),
  search: document.getElementById('search'),
  list: document.getElementById('notesList'),
  empty: document.getElementById('emptyState'),
  count: document.getElementById('noteCount'),
};

// --- Storage helpers ------------------------------------------------------
async function loadNotes() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const notes = data[STORAGE_KEY];
  return Array.isArray(notes) ? notes : [];
}

async function saveNotes(notes) {
  await chrome.storage.local.set({ [STORAGE_KEY]: notes.slice(0, MAX_NOTES) });
}

// --- Rendering ------------------------------------------------------------
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const opts = sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString(undefined, opts);
}

function filterNotes(notes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return notes;
  return notes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.body || '').toLowerCase().includes(q)
  );
}

async function render() {
  const notes = await loadNotes();
  const visible = filterNotes(notes, els.search.value);
  els.count.textContent = notes.length;
  els.empty.classList.toggle('show', notes.length === 0);

  els.list.innerHTML = '';
  for (const note of visible) {
    const card = document.createElement('div');
    card.className = 'note';

    if (note.title) {
      const t = document.createElement('div');
      t.className = 'note-title';
      t.textContent = note.title;
      card.appendChild(t);
    }

    const b = document.createElement('div');
    b.className = 'note-body';
    b.textContent = note.body;
    card.appendChild(b);

    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const time = document.createElement('span');
    time.className = 'note-time';
    time.textContent = fmtTime(note.createdAt);
    meta.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'icon-btn';
    copyBtn.title = 'Copy note';
    copyBtn.setAttribute('aria-label', 'Copy note');
    copyBtn.innerHTML = copySvg();
    copyBtn.addEventListener('click', async () => {
      const text = note.title ? `${note.title}\n${note.body}` : note.body;
      await navigator.clipboard.writeText(text).catch(() => {});
      copyBtn.style.color = 'var(--accent)';
      setTimeout(() => { copyBtn.style.color = ''; }, 800);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.title = 'Delete note';
    delBtn.setAttribute('aria-label', 'Delete note');
    delBtn.innerHTML = trashSvg();
    delBtn.addEventListener('click', async () => {
      const all = await loadNotes();
      await saveNotes(all.filter(n => n.id !== note.id));
    });

    actions.appendChild(copyBtn);
    actions.appendChild(delBtn);
    meta.appendChild(actions);
    card.appendChild(meta);
    els.list.appendChild(card);
  }
}

function copySvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
}

function trashSvg() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
}

// --- Actions --------------------------------------------------------------
async function addNote() {
  const body = els.body.value.trim();
  if (!body) {
    els.body.focus();
    return;
  }
  const notes = await loadNotes();
  notes.unshift({
    id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: els.title.value.trim(),
    body: els.body.value.replace(/\s+$/, ''),
    createdAt: Date.now(),
  });
  await saveNotes(notes);
  els.title.value = '';
  els.body.value = '';
  els.body.focus();
}

async function clearAll() {
  const notes = await loadNotes();
  if (notes.length === 0) return;
  if (confirm(`Delete all ${notes.length} note(s)? This cannot be undone.`)) {
    await saveNotes([]);
  }
}

// --- Events ---------------------------------------------------------------
els.addBtn.addEventListener('click', addNote);
els.body.addEventListener('keydown', e => {
  // Ctrl/Cmd+Enter to save — plain Enter still makes new lines.
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') addNote();
});
els.clearAllBtn.addEventListener('click', clearAll);
els.search.addEventListener('input', render);

// Live-sync: storage.onChanged fires in every other popup instance the
// moment any tab saves a note — this is what makes the mesh instant.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) render();
});

render();
