/* Deepfake Awareness — Voice Anomaly Guide (popup logic) */
'use strict';

// ENGINE-START
// Pure checklist engine — headless-testable, no DOM or chrome APIs.

/** Red-flag checklist items (stable ids). */
const CHECKLIST_ITEMS = [
  { id: 'cadence', label: 'Does the pacing sound unnaturally even — no breaths or hesitations?' },
  { id: 'emotion', label: 'Does the emotion match the words being said?' },
  { id: 'sibilants', label: 'Do s/sh/p sounds sound metallic, watery, or smeared?' },
  { id: 'timbre', label: 'Does the voice timbre stay consistent through the clip?' },
  { id: 'noise', label: 'Does the background noise match the voice (no odd cut-outs)?' },
  { id: 'origin', label: 'Can you find where this clip was FIRST posted?' },
  { id: 'source2', label: 'Is there a second independent source for the claim?' },
  { id: 'plausible', label: 'Would this speaker plausibly say this, here, to this audience?' },
  { id: 'account', label: 'Is the posting account established (not new or repurposed)?' },
  { id: 'pause', label: 'Have you paused before sharing — especially if it provokes outrage?' },
];

/** Return 0–100 checklist completion percent for a set of checked ids. */
function checklistProgress(checkedIds) {
  const set = new Set((checkedIds || []).filter((id) => CHECKLIST_ITEMS.some((i) => i.id === id)));
  return Math.round((set.size / CHECKLIST_ITEMS.length) * 100);
}

/** Create a verification-note entry; returns null when invalid. */
function makeNote(title, body) {
  const t = (title || '').trim().slice(0, 80);
  if (!t) return null;
  return {
    id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    title: t,
    body: (body || '').trim().slice(0, 1000),
    ts: Date.now(),
  };
}

/** Newest-first sort (returns a new array). */
function sortNotes(notes) {
  return [...(notes || [])].sort((a, b) => b.ts - a.ts);
}

/** Case-insensitive full-text filter over title + body. Empty query returns all. */
function filterNotes(notes, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...(notes || [])];
  return (notes || []).filter(
    (n) => n.title.toLowerCase().includes(q) || (n.body || '').toLowerCase().includes(q)
  );
}

/** Friendly date formatting: "17 Oct 2026, 07:33". */
function fmtWhen(ts) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ENGINE-END

/* ---------------- popup wiring (DOM + chrome.storage.local) ---------------- */

const LS_KEY = 'dfaw_notes_v1';
const CHECK_KEY = 'dfaw_checked_v1';

document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// --- checklist ---
const checklistEl = document.getElementById('checklist');
let checkedSet = new Set();

function renderChecklist() {
  checklistEl.innerHTML = '';
  CHECKLIST_ITEMS.forEach((item) => {
    const label = document.createElement('label');
    label.className = 'check-row' + (checkedSet.has(item.id) ? ' done' : '');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checkedSet.has(item.id);
    box.addEventListener('change', () => {
      if (box.checked) checkedSet.add(item.id); else checkedSet.delete(item.id);
      chrome.storage.local.set({ [CHECK_KEY]: [...checkedSet] });
      renderChecklist();
    });
    const span = document.createElement('span');
    span.textContent = item.label;
    label.append(box, span);
    checklistEl.appendChild(label);
  });
  const pct = checklistProgress([...checkedSet]);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = pct;
}

// --- notes ---
let notes = [];

function renderNotes() {
  const q = document.getElementById('noteSearch').value;
  const list = document.getElementById('noteList');
  const shown = filterNotes(sortNotes(notes), q);
  list.innerHTML = '';
  if (!shown.length) {
    list.innerHTML = '<p class="empty">No notes yet — log your first verification above.</p>';
    return;
  }
  shown.forEach((n) => {
    const div = document.createElement('div');
    div.className = 'note';
    const h = document.createElement('h3');
    h.textContent = n.title;
    const p = document.createElement('p');
    p.textContent = n.body || '—';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const time = document.createElement('time');
    time.textContent = fmtWhen(n.ts);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      notes = notes.filter((x) => x.id !== n.id);
      chrome.storage.local.set({ [LS_KEY]: notes });
      renderNotes();
    });
    meta.append(time, del);
    div.append(h, p, meta);
    list.appendChild(div);
  });
}

document.getElementById('noteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const note = makeNote(
    document.getElementById('noteTitle').value,
    document.getElementById('noteBody').value
  );
  if (!note) return;
  notes.unshift(note);
  if (notes.length > 200) notes = notes.slice(0, 200);
  chrome.storage.local.set({ [LS_KEY]: notes }, () => {
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteBody').value = '';
    renderNotes();
  });
});
document.getElementById('noteSearch').addEventListener('input', renderNotes);
document.getElementById('clearNotes').addEventListener('click', () => {
  if (!notes.length || !confirm('Delete all notes?')) return;
  notes = [];
  chrome.storage.local.set({ [LS_KEY]: notes }, renderNotes);
});

// --- init ---
chrome.storage.local.get({ [LS_KEY]: [], [CHECK_KEY]: [] }, (res) => {
  notes = Array.isArray(res[LS_KEY]) ? res[LS_KEY] : [];
  checkedSet = new Set(Array.isArray(res[CHECK_KEY]) ? res[CHECK_KEY] : []);
  renderChecklist();
  renderNotes();
});
