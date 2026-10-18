/* Deepfake Red-Flag Guide — popup logic.
 * Educational only: bundled red-flag reference + a personal verification-notes log.
 * No video is ever loaded, analyzed, or transmitted. */

// ENGINE-START
// Bundled educational reference: red flags researchers describe in forged video.
const RED_FLAGS = [
  { t: 'Blending edges', d: 'Soft or blurry seams around the face/jaw where a swapped face meets the head or neck — look for a faint halo or color mismatch.' },
  { t: 'Lighting mismatch', d: 'The face\'s lighting, shadows, or color temperature don\'t match the scene (e.g. warm face in cool daylight).' },
  { t: 'Frame flicker', d: 'Subtle pulsing or shimmering of facial texture between frames — a sign of frame-by-frame generation.' },
  { t: 'Unnatural blinking', d: 'Too-frequent, too-rare, or perfectly periodic blinking; eyes that never quite sync with speech.' },
  { t: 'Mouth/speech mismatch', d: 'Lip shapes that lag or lead the audio, or teeth/tongue that look smeared while talking.' },
  { t: 'Hair & accessories glitches', d: 'Hair strands, glasses, or jewelry that wobble, vanish, or melt at the edges of the face.' },
  { t: 'Head-body inconsistency', d: 'Head pose or scale that doesn\'t sit naturally on the neck/shoulders, or skin tone shifts at the jawline.' },
  { t: 'Audio artifacts', d: 'Flat, robotic, or oddly paced speech; breaths and room tone that don\'t match the environment.' }
];

/** Build a note object; returns null when the body is empty. */
function makeNote(title, body) {
  const b = (body || '').trim();
  if (!b) return null;
  const t = (title || '').trim().slice(0, 120);
  return { id: 'n' + Date.now() + Math.floor(Math.random() * 1e6), title: t, body: b.slice(0, 2000), at: Date.now() };
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
  const pad = n => String(n).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ENGINE-END

const flagsEl = document.getElementById('flags');
const titleEl = document.getElementById('noteTitle');
const bodyEl = document.getElementById('noteBody');
const searchEl = document.getElementById('search');
const notesEl = document.getElementById('notes');

let notes = [];

// Render the bundled red-flag guide.
function renderFlags() {
  flagsEl.innerHTML = '';
  for (const f of RED_FLAGS) {
    const div = document.createElement('div');
    div.className = 'flag';
    const t = document.createElement('div');
    t.className = 't';
    t.textContent = f.t;
    const d = document.createElement('div');
    d.className = 'd';
    d.textContent = f.d;
    div.append(t, d);
    flagsEl.appendChild(div);
  }
}

async function load() {
  const data = await chrome.storage.local.get({ deepfakeNotes: [] });
  notes = data.deepfakeNotes;
  renderNotes();
}

function renderNotes() {
  const list = filterNotes(sortNotes(notes), searchEl.value);
  notesEl.innerHTML = '';
  if (!list.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = notes.length ? 'No notes match your search.' : 'No notes yet — log what you checked.';
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
    meta.className = 'meta';
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
  await chrome.storage.local.set({ deepfakeNotes: notes });
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
  if (confirm('Delete all your verification notes?')) {
    notes = [];
    await save();
  }
});

renderFlags();
load();
