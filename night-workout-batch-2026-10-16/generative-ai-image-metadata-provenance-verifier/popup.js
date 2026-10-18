/* Image Provenance Edu — popup logic.
 * Reads only BASIC file properties of a locally chosen image (name, MIME type,
 * byte size, pixel dimensions, last-modified). Nothing is uploaded.
 * Plus a bundled explainer of EXIF/C2PA provenance concepts and a notes log. */

// ENGINE-START
// Bundled educational reference: provenance concepts this tool does NOT verify.
const CONCEPTS = [
  { t: 'EXIF', d: 'Camera-written metadata (device model, exposure, date). Helpful context — but trivially edited, stripped by social platforms, and never proof of origin.' },
  { t: 'C2PA / Content Credentials', d: 'A signed "manifest" attached by cameras and AI tools (Adobe, Sony, Leica) asserting creation details. Real verification means checking the cryptographic signature — this tool does not do that.' },
  { t: 'Generative-AI watermarks', d: 'Some AI generators embed invisible markers (e.g. SynthID-style). There is no universal reader in the browser; absence of a watermark proves nothing.' },
  { t: 'Metadata can lie', d: 'File name, dates, and EXIF can be edited in seconds or stripped entirely. Treat basic file info as a hint, never as provenance.' }
];

/** Human-readable byte size. */
function fmtBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return n + ' B';
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return v.toFixed(v >= 100 ? 0 : 1) + ' ' + units[i];
}

/** Format a File.lastModified epoch ms as local date/time. */
function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleString();
}

/** Build the display rows for a file + decoded image dimensions. */
function metaRows(file, width, height) {
  return [
    ['File name', file.name || '—'],
    ['MIME type', file.type || 'unknown'],
    ['Size', fmtBytes(file.size)],
    ['Dimensions', width && height ? `${width} × ${height} px` : '—'],
    ['Last modified', fmtDate(file.lastModified)]
  ];
}

/** Build a note object; returns null when the body is empty. */
function makeNote(title, body) {
  const b = (body || '').trim();
  if (!b) return null;
  return {
    id: 'n' + Date.now() + Math.floor(Math.random() * 1e6),
    title: (title || '').trim().slice(0, 120),
    body: b.slice(0, 2000),
    at: Date.now()
  };
}

/** Newest-first sort (returns a copy). */
function sortNotes(notes) {
  return [...(notes || [])].sort((a, b) => (b.at || 0) - (a.at || 0));
}

/** Case-insensitive filter across title and body. */
function filterNotes(notes, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return notes || [];
  return (notes || []).filter(n =>
    (n.title || '').toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q));
}

/** Format epoch ms as "17 Oct 2026, 03:23". */
function fmtWhen(ms) {
  const d = new Date(ms);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = x => String(x).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ENGINE-END

const fileEl = document.getElementById('file');
const previewEl = document.getElementById('preview');
const metaEl = document.getElementById('meta');
const conceptsEl = document.getElementById('concepts');
const titleEl = document.getElementById('noteTitle');
const bodyEl = document.getElementById('noteBody');
const searchEl = document.getElementById('search');
const notesEl = document.getElementById('notes');

let notes = [];

function renderConcepts() {
  conceptsEl.innerHTML = '';
  for (const c of CONCEPTS) {
    const div = document.createElement('div');
    div.className = 'concept';
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = c.t;
    const d = document.createElement('div');
    d.className = 'd';
    d.textContent = c.d;
    div.append(t, d);
    conceptsEl.appendChild(div);
  }
}

// Load the chosen local image and show basic properties only.
fileEl.addEventListener('change', () => {
  const file = fileEl.files && fileEl.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    previewEl.innerHTML = '';
    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.alt = 'preview';
    previewEl.appendChild(thumb);
    previewEl.classList.remove('hidden');
    metaEl.innerHTML = '';
    for (const [k, v] of metaRows(file, img.naturalWidth, img.naturalHeight)) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      metaEl.append(dt, dd);
    }
    metaEl.classList.remove('hidden');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    previewEl.innerHTML = '<p class="hint">Could not decode that file as an image.</p>';
    previewEl.classList.remove('hidden');
  };
  img.src = url;
});

async function load() {
  const data = await chrome.storage.local.get({ provenanceNotes: [] });
  notes = data.provenanceNotes;
  renderNotes();
}

function renderNotes() {
  const list = filterNotes(sortNotes(notes), searchEl.value);
  notesEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = notes.length ? 'No notes match your search.' : 'No notes yet.';
    notesEl.appendChild(li);
    return;
  }
  for (const n of list) {
    const li = document.createElement('li');
    li.className = 'note';
    const nt = document.createElement('div');
    nt.className = 'nt';
    nt.textContent = n.title || '(untitled)';
    const nb = document.createElement('div');
    nb.className = 'nb';
    nb.textContent = n.body;
    const meta = document.createElement('div');
    meta.className = 'meta2';
    const dt = document.createElement('span');
    dt.className = 'dt';
    dt.textContent = fmtWhen(n.at);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕ Delete';
    del.addEventListener('click', () => removeNote(n.id));
    meta.append(dt, del);
    li.append(nt, nb, meta);
    notesEl.appendChild(li);
  }
}

async function save() {
  await chrome.storage.local.set({ provenanceNotes: notes });
  renderNotes();
}

document.getElementById('addNote').addEventListener('click', async () => {
  const n = makeNote(titleEl.value, bodyEl.value);
  if (!n) { bodyEl.focus(); return; }
  notes.push(n);
  titleEl.value = '';
  bodyEl.value = '';
  await save();
});

searchEl.addEventListener('input', renderNotes);

async function removeNote(id) {
  notes = notes.filter(n => n.id !== id);
  await save();
}

document.getElementById('clearAll').addEventListener('click', async () => {
  if (!notes.length) return;
  if (confirm('Delete all your notes?')) {
    notes = [];
    await save();
  }
});

renderConcepts();
load();
