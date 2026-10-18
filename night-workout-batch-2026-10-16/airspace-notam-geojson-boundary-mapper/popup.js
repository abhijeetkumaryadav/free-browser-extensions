/* Airspace Notes — class guide + personal boundary notes.
   Pure engine between ENGINE-START/ENGINE-END; UI wiring below. */

// ENGINE-START
/**
 * ICAO-style airspace class reference (general summaries, educational).
 * Each entry: class letter, one-line summary, details.
 */
const AIRSPACE_CLASSES = [
  { c: 'A', title: 'Controlled — IFR only', body: 'Generally 18,000 ft MSL to FL600. IFR only, all aircraft separated. ATC clearance required.' },
  { c: 'B', title: 'Controlled — busy terminal', body: 'Surface to ~10,000 ft MSL around the busiest airports. ATC clearance required for all aircraft; Mode C transponder.' },
  { c: 'C', title: 'Controlled — towered airport', body: 'Surface to ~4,000 ft AGL around towered airports. Two-way radio contact required; VFR and IFR separated.' },
  { c: 'D', title: 'Controlled — towered', body: 'Surface to ~2,500 ft AGL around towered airports. Two-way radio contact required before entry.' },
  { c: 'E', title: 'Controlled — en-route/transition', body: 'Controlled airspace not A–D, generally from 700/1,200 ft AGL (or surface) up to 17,999 ft MSL. VFR needs no clearance but weather minima apply.' },
  { c: 'F', title: 'Advisory (ICAO, rare)', body: 'Used in some ICAO states where ATC provides advisory service; IFR separated from IFR as far as practical.' },
  { c: 'G', title: 'Uncontrolled', body: 'Everything else. No ATC clearance required; pilots are responsible for separation and weather minima.' }
];

/**
 * Look up a class entry by letter.
 * @param {string} letter
 * @returns {object|null}
 */
function classFor(letter) {
  if (typeof letter !== 'string') return null;
  const l = letter.trim().toUpperCase();
  return AIRSPACE_CLASSES.find(e => e.c === l) || null;
}

/**
 * Build a validated note object, or null if invalid.
 * @param {object} raw {name, cls, floor, ceil, text}
 */
function makeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = (raw.name || '').trim();
  const text = (raw.text || '').trim();
  if (!name || name.length > 120) return null;
  const cls = (raw.cls || '').trim().toUpperCase();
  if (cls && !classFor(cls)) return null;
  const floor = (raw.floor || '').trim().slice(0, 40);
  const ceil = (raw.ceil || '').trim().slice(0, 40);
  if (text.length > 2000) return null;
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name, cls, floor, ceil, text,
    created: new Date().toISOString()
  };
}

/** Newest-first sort, immutable. */
function sortNotes(notes) {
  return (notes || []).slice().sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

/**
 * Filter notes by free text across name/class/floor/ceiling/text (case-insensitive).
 * Empty query returns all.
 */
function filterNotes(notes, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return (notes || []).slice();
  return (notes || []).filter(n =>
    [n.name, n.cls, n.floor, n.ceil, n.text].some(f => (f || '').toLowerCase().includes(q))
  );
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}
// ENGINE-END

/* ---------- UI wiring ---------- */
const $ = id => document.getElementById(id);
const LS_KEY = 'airspaceNotesV1';

function renderGuide() {
  $('classList').innerHTML = AIRSPACE_CLASSES.map(e => `
    <div class="class-item">
      <div class="row"><span class="badge">${e.c}</span><h3>Class ${e.c} — ${e.title}</h3></div>
      <p>${e.body}</p>
    </div>`).join('');
}

function loadNotes() {
  return new Promise(res => {
    chrome.storage.local.get(LS_KEY, r => res(r[LS_KEY] || []));
  });
}

function saveNotes(notes) {
  return new Promise(res => chrome.storage.local.set({ [LS_KEY]: notes }, res));
}

function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderNotes() {
  const notes = sortNotes(await loadNotes());
  const q = $('search').value;
  const shown = filterNotes(notes, q);
  $('count').textContent = notes.length + (notes.length === 1 ? ' note' : ' notes');
  const list = $('noteList');
  if (!shown.length) {
    list.innerHTML = '<div class="empty">' + (notes.length ? 'No notes match your search.' : 'No notes yet — add your first boundary note above.') + '</div>';
    return;
  }
  list.innerHTML = shown.map(n => `
    <div class="note" data-id="${esc(n.id)}">
      <div class="row">
        ${n.cls ? `<span class="badge">${esc(n.cls)}</span>` : ''}
        <h3>${esc(n.name)}</h3>
        <button class="del" title="Delete" data-del="${esc(n.id)}">×</button>
      </div>
      <div class="meta">${n.floor || 'SFC'} → ${n.ceil || '—'}${n.created ? ' · ' + esc(fmtDate(n.created)) : ''}</div>
      ${n.text ? `<p>${esc(n.text)}</p>` : ''}
    </div>`).join('');
  list.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', async () => {
      const notes2 = (await loadNotes()).filter(n => n.id !== btn.getAttribute('data-del'));
      await saveNotes(notes2);
      renderNotes();
    }));
}

$('addNote').addEventListener('click', async () => {
  const note = makeNote({
    name: $('nName').value, cls: $('nClass').value,
    floor: $('nFloor').value, ceil: $('nCeil').value, text: $('nText').value
  });
  if (!note) { $('nName').focus(); return; }
  const notes = await loadNotes();
  notes.push(note);
  await saveNotes(notes);
  $('nName').value = ''; $('nClass').value = ''; $('nFloor').value = ''; $('nCeil').value = ''; $('nText').value = '';
  renderNotes();
});

$('search').addEventListener('input', renderNotes);

document.querySelectorAll('.tab').forEach(tab =>
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.getAttribute('data-tab');
    $('tab-guide').hidden = which !== 'guide';
    $('tab-notes').hidden = which !== 'notes';
    if (which === 'notes') renderNotes();
  }));

renderGuide();
