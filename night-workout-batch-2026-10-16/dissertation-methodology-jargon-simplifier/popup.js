/* Jargon Highlighter — popup logic.
 * Your glossary — not AI. Heuristic term matching against definitions you
 * wrote yourself. Fully local, zero network. */

// ==================== ENGINE-START ====================
/** Escape regex metacharacters. */
function escapeReg(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Create a glossary term. Returns null when term/definition missing. */
function makeTerm(input) {
  const term = (input.term || '').trim();
  const def = (input.definition || '').trim();
  if (!term || !def) return null;
  return {
    id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    term: term.slice(0, 80),
    definition: def.slice(0, 300),
    note: (input.note || '').trim().slice(0, 200),
    addedAt: Date.now()
  };
}

/** Find glossary terms in text (case-insensitive, word-boundary).
 *  Returns matches: [{start, end, termId, term}] with overlaps resolved in
 *  favour of the longest term first. */
function findMatches(text, glossary) {
  const matches = [];
  const sorted = glossary.slice().sort((a, b) => b.term.length - a.term.length);
  for (const g of sorted) {
    const re = new RegExp('(?<!\\w)' + escapeReg(g.term) + '(?!\\w)', 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index, end = start + m[0].length;
      if (!matches.some(x => start < x.end && end > x.start)) {
        matches.push({ start, end, termId: g.id, term: g.term });
      }
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

/** Escape HTML. */
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Render text with matches wrapped in <mark> (HTML-escaped). */
function highlightHtml(text, matches) {
  let out = '', last = 0;
  for (const m of matches) {
    out += escHtml(text.slice(last, m.start));
    out += '<mark title="' + escHtml('glossary term') + '">' + escHtml(text.slice(m.start, m.end)) + '</mark>';
    last = m.end;
  }
  return out + escHtml(text.slice(last));
}

/** Case-insensitive search across term/definition/note. */
function filterTerms(glossary, q) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return glossary;
  return glossary.filter(g =>
    g.term.toLowerCase().includes(needle) ||
    g.definition.toLowerCase().includes(needle) ||
    (g.note || '').toLowerCase().includes(needle)
  );
}

/** Validate imported JSON. Returns array of terms or null. */
function validateImport(data) {
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const raw of data) {
    if (!raw || typeof raw.term !== 'string' || typeof raw.definition !== 'string') continue;
    const t = makeTerm({ term: raw.term, definition: raw.definition, note: raw.note });
    if (t) out.push(t);
  }
  return out.slice(0, 500);
}

/** A small starter glossary (user-editable, stored locally). */
function starterGlossary() {
  return [
    makeTerm({ term: 'epistemology', definition: 'The study of how we know things — what counts as knowledge and evidence.', note: 'starter' }),
    makeTerm({ term: 'ontology', definition: 'The study of what exists — the nature of being and reality.', note: 'starter' }),
    makeTerm({ term: 'heuristic', definition: 'A practical shortcut or rule of thumb that usually works but is not guaranteed.', note: 'starter' }),
    makeTerm({ term: 'operationalize', definition: 'To define an abstract idea in terms of how you will actually measure it.', note: 'starter' }),
    makeTerm({ term: 'longitudinal', definition: 'A study that follows the same subjects over a long period of time.', note: 'starter' })
  ].filter(Boolean);
}
// ==================== ENGINE-END ====================

const $ = id => document.getElementById(id);
const esc = escHtml;
const store = {
  async get() { return (await chrome.storage.local.get({ glossary: [] })).glossary; },
  async set(g) { await chrome.storage.local.set({ glossary: g }); }
};

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('tab-' + t.dataset.tab).classList.add('active');
}));

/* ---------- scan ---------- */
$('scanBtn').addEventListener('click', async () => {
  const text = $('scanText').value;
  const glossary = await store.get();
  const out = $('scanOut'), list = $('matchList');
  if (!text.trim()) { out.textContent = 'Paste some text first.'; list.innerHTML = ''; return; }
  if (!glossary.length) { out.textContent = 'Your glossary is empty — add terms first.'; list.innerHTML = ''; return; }
  const matches = findMatches(text, glossary);
  out.innerHTML = highlightHtml(text, matches);
  const byId = Object.fromEntries(glossary.map(g => [g.id, g]));
  const seen = new Set();
  const cards = [];
  for (const m of matches) {
    if (seen.has(m.termId)) continue;
    seen.add(m.termId);
    const g = byId[m.termId]; if (!g) continue;
    cards.push(`<div class="card"><div class="term">${esc(g.term)}</div>
      <div class="def">${esc(g.definition)}</div>
      ${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}</div>`);
  }
  list.innerHTML = (matches.length
    ? `<div class="match-head">${matches.length} hit${matches.length === 1 ? '' : 's'} · ${seen.size} term${seen.size === 1 ? '' : 's'}</div>`
    : '<div class="empty">No glossary terms found in this text.</div>')
    + cards.join('');
});

/* ---------- glossary list ---------- */
function renderTerms(glossary, q) {
  const list = $('termList');
  const shown = filterTerms(glossary, q);
  $('count').textContent = glossary.length + ' term' + (glossary.length === 1 ? '' : 's');
  if (!shown.length) { list.innerHTML = '<div class="empty">No terms yet — add your first one.</div>'; return; }
  list.innerHTML = shown.map(g => `<div class="card" data-id="${g.id}">
      <div class="term">${esc(g.term)}</div>
      <div class="def">${esc(g.definition)}</div>
      ${g.note ? `<div class="note">${esc(g.note)}</div>` : ''}
      <div class="actions"><button class="mini" data-del="${g.id}">Delete</button></div>
    </div>`).join('');
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    await store.set((await store.get()).filter(g => g.id !== b.dataset.del));
    renderTerms(await store.get(), $('search').value);
  }));
}
$('search').addEventListener('input', () => store.get().then(g => renderTerms(g, $('search').value)));

/* ---------- add term ---------- */
$('saveBtn').addEventListener('click', async () => {
  const msg = $('formMsg');
  const t = makeTerm({ term: $('fTerm').value, definition: $('fDef').value, note: $('fNote').value });
  if (!t) { msg.textContent = 'Term and definition are both required.'; msg.className = 'msg err'; return; }
  const g = await store.get();
  if (g.length >= 500) { msg.textContent = 'Glossary full (500 terms).'; msg.className = 'msg err'; return; }
  if (g.some(x => x.term.toLowerCase() === t.term.toLowerCase())) {
    msg.textContent = 'That term is already in your glossary.'; msg.className = 'msg err'; return;
  }
  g.push(t);
  await store.set(g);
  $('fTerm').value = ''; $('fDef').value = ''; $('fNote').value = '';
  renderTerms(g, $('search').value);
  msg.textContent = 'Term saved.'; msg.className = 'msg ok';
});

/* ---------- seed / export / import / clear ---------- */
$('seedBtn').addEventListener('click', async () => {
  const g = await store.get();
  if (!g.length) { await store.set(starterGlossary()); renderTerms(await store.get(), ''); }
});
$('exportBtn').addEventListener('click', async () => {
  const g = await store.get();
  const blob = new Blob([JSON.stringify(g, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'jargon-glossary.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = validateImport(JSON.parse(await f.text()));
    if (data === null) throw new Error('bad shape');
    await store.set((await store.get()).concat(data).slice(0, 500));
    renderTerms(await store.get(), $('search').value);
  } catch { alert('Could not import: not a valid glossary JSON file.'); }
  e.target.value = '';
});
$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete your whole glossary?')) return;
  await store.set([]); renderTerms([], '');
});

/* ---------- init ---------- */
store.get().then(g => renderTerms(g, ''));
