'use strict';

/* =========================================================
 * Perseverance Journal — popup logic.
 * Bundled educational timeline + per-milestone user notes
 * and a personal logbook. All local, no network.
 * ========================================================= */

// ENGINE-START

/** Bundled educational milestones of the Perseverance mission. */
const MILESTONES = [
  { id: 'm1', date: 'Jul 30, 2020', title: 'Launch from Cape Canaveral',
    fact: 'Perseverance launched aboard an Atlas V-541 rocket, beginning a 203-day cruise to Mars.' },
  { id: 'm2', date: 'Feb 18, 2021', title: 'Landing in Jezero Crater',
    fact: 'The "seven minutes of terror" ended with a successful sky-crane touchdown in Jezero Crater, an ancient river delta chosen to hunt for signs of past microbial life.' },
  { id: 'm3', date: 'Apr 19, 2021', title: 'Ingenuity\'s first flight',
    fact: 'The Ingenuity helicopter made the first powered, controlled flight on another world — a 39.1-second hop — from Perseverance\'s landing site.' },
  { id: 'm4', date: 'Apr 20, 2021', title: 'MOXIE makes oxygen',
    fact: 'The MOXIE instrument converted Martian CO2 into breathable oxygen for the first time — a demo of future astronaut life-support technology.' },
  { id: 'm5', date: 'Sep 1, 2021', title: 'First rock sample collected',
    fact: 'After an initial crumbly-rock attempt, Perseverance sealed its first intact core sample from a rock nicknamed "Rochette".' },
  { id: 'm6', date: 'Dec 21, 2022', title: 'Sample depot at Three Forks',
    fact: 'The rover began building a backup depot of sealed sample tubes on the Martian surface for a future sample-return mission.' },
  { id: 'm7', date: 'Jan 18, 2024', title: 'Ingenuity\'s final flight',
    fact: 'After 72 flights — far beyond its 5-flight test plan — Ingenuity suffered rotor damage and was retired, having scouted ahead for the rover.' },
  { id: 'm8', date: '2024–2026', title: 'Crater rim science campaign',
    fact: 'Perseverance climbed to the Jezero Crater rim to explore ancient highland rocks, continuing its search for signs of past life and caching samples.' }
];

/** Build a log entry. Returns null when text is empty. */
function makeEntry(sol, text) {
  const t = (text || '').trim();
  if (!t) return null;
  return {
    id: 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    sol: (sol || '').trim().slice(0, 12),
    text: t.slice(0, 2000),
    ts: Date.now()
  };
}

/** Sort entries newest-first (pure). */
function sortEntries(entries) {
  return [...entries].sort((a, b) => b.ts - a.ts);
}

/** Format entry header: sol + date, e.g. "Sol 1042 · Oct 17, 2026". */
function fmtEntryHeader(entry) {
  const date = new Date(entry.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (entry.sol ? `Sol ${entry.sol} · ` : '') + date;
}
// ENGINE-END

/* ---------------- storage + UI ---------------- */

const NOTES_KEY = 'perseveranceJournal.notes.v1';   // { milestoneId: text }
const LOGBOOK_KEY = 'perseveranceJournal.logbook.v1'; // [entry]

let notes = {};
let entries = [];

const $ = id => document.getElementById(id);

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadAll() {
  const data = await chrome.storage.local.get([NOTES_KEY, LOGBOOK_KEY]);
  notes = data[NOTES_KEY] || {};
  entries = Array.isArray(data[LOGBOOK_KEY]) ? data[LOGBOOK_KEY] : [];
}

async function saveNotes() { await chrome.storage.local.set({ [NOTES_KEY]: notes }); }
async function saveEntries() { await chrome.storage.local.set({ [LOGBOOK_KEY]: entries }); }

function renderTimeline() {
  const ul = $('timeline');
  ul.innerHTML = '';
  for (const m of MILESTONES) {
    const li = document.createElement('li');
    li.innerHTML =
      `<div class="tl-date">${escapeHtml(m.date)}</div>` +
      `<div class="tl-title">${escapeHtml(m.title)}</div>` +
      `<div class="tl-fact">${escapeHtml(m.fact)}</div>` +
      `<div class="tl-note"><label>Your notes</label>` +
      `<textarea rows="2" data-id="${m.id}" placeholder="What did you find interesting?">${escapeHtml(notes[m.id] || '')}</textarea></div>`;
    ul.appendChild(li);
  }
  // Debounced autosave of per-milestone notes.
  let timer = null;
  ul.querySelectorAll('textarea').forEach(ta => {
    ta.addEventListener('input', () => {
      notes[ta.dataset.id] = ta.value;
      clearTimeout(timer);
      timer = setTimeout(saveNotes, 400);
    });
  });
}

function renderEntries() {
  const ul = $('entries');
  ul.innerHTML = '';
  const sorted = sortEntries(entries);
  if (!sorted.length) {
    ul.innerHTML = '<li class="empty">No entries yet — write your first log above.</li>';
    return;
  }
  for (const e of sorted) {
    const li = document.createElement('li');
    li.innerHTML =
      `<div class="head-row"><span class="when">${escapeHtml(fmtEntryHeader(e))}</span>` +
      `<button class="del" data-id="${e.id}" title="Delete">✕</button></div>` +
      `<div class="text">${escapeHtml(e.text)}</div>`;
    ul.appendChild(li);
  }
  ul.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', async () => {
      entries = entries.filter(x => x.id !== btn.dataset.id);
      await saveEntries();
      renderEntries();
    });
  });
}

function switchTab(timeline) {
  $('tabTimeline').classList.toggle('active', timeline);
  $('tabLogbook').classList.toggle('active', !timeline);
  $('viewTimeline').hidden = !timeline;
  $('viewLogbook').hidden = timeline;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAll();
  renderTimeline();
  renderEntries();

  $('tabTimeline').addEventListener('click', () => switchTab(true));
  $('tabLogbook').addEventListener('click', () => switchTab(false));

  $('btnLog').addEventListener('click', async () => {
    const e = makeEntry($('logSol').value, $('logText').value);
    if (!e) {
      $('logText').style.borderColor = '#ff6b6b';
      setTimeout(() => { $('logText').style.borderColor = ''; }, 1200);
      return;
    }
    entries.push(e);
    await saveEntries();
    $('logSol').value = '';
    $('logText').value = '';
    renderEntries();
  });
});
