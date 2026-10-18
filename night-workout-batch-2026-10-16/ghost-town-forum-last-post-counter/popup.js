/* Ghost Town Forums — your forum log, manual. Zero network. */
// ENGINE-START
// Pure engine — safe to unit-test headless.

const MAX_FORUMS = 500;

// Build a forum entry. Returns {ok, entry} or {ok:false, error}.
function makeForum({ name, url, visit, notes, quiet }) {
  name = (name || '').trim();
  if (!name) return { ok: false, error: 'name-required' };
  if (name.length > 120) return { ok: false, error: 'name-too-long' };
  url = (url || '').trim();
  if (url) {
    if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) return { ok: false, error: 'bad-url' };
    if (url.length > 500) return { ok: false, error: 'url-too-long' };
  }
  notes = (notes || '').trim();
  if (notes.length > 1000) return { ok: false, error: 'notes-too-long' };
  let visitDate = null;
  if (visit) {
    const d = new Date(visit + 'T00:00:00');
    if (isNaN(d.getTime())) return { ok: false, error: 'bad-date' };
    visitDate = visit;
  }
  return {
    ok: true,
    entry: {
      id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name, url, visit: visitDate, notes,
      quiet: !!quiet,
      created: new Date().toISOString(),
    },
  };
}

// Days between a YYYY-MM-DD date and today. Null if none given.
function daysSince(visit) {
  if (!visit) return null;
  const then = new Date(visit + 'T00:00:00').getTime();
  if (isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86400000));
}

// Newest-first sort; does not mutate.
function sortForums(list) {
  return [...list].sort((a, b) => (b.created || '').localeCompare(a.created || ''));
}

// Case-insensitive search across name, url, notes.
function filterForums(list, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [...list];
  return list.filter(f =>
    (f.name || '').toLowerCase().includes(q) ||
    (f.url || '').toLowerCase().includes(q) ||
    (f.notes || '').toLowerCase().includes(q));
}

// archive.org "last snapshot" link for a forum URL (opened by the user; no fetch here).
function archiveUrl(url) {
  if (!url) return null;
  return 'https://web.archive.org/web/*/' + url;
}

// Human label for days since last visit.
function visitLabel(visit) {
  const d = daysSince(visit);
  if (d === null) return 'Last visit: not recorded';
  if (d === 0) return 'Last visit: today';
  if (d === 1) return 'Last visit: yesterday';
  return 'Last visit: ' + d + ' days ago';
}

// Validate an import payload. Returns {ok, list} or {ok:false, error}.
function parseImport(text) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'bad-json' }; }
  if (!Array.isArray(data)) return { ok: false, error: 'not-array' };
  const list = [];
  for (const item of data.slice(0, MAX_FORUMS)) {
    const r = makeForum({
      name: item.name, url: item.url, visit: item.visit,
      notes: item.notes, quiet: item.quiet,
    });
    if (r.ok) list.push(r.entry);
  }
  return { ok: true, list };
}

// Escape for HTML insertion.
function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// ENGINE-END

/* ---------------- Popup UI (browser only) ---------------- */

const $ = (id) => document.getElementById(id);
let forums = [];

async function load() {
  const { forums: saved } = await chrome.storage.local.get({ forums: [] });
  forums = Array.isArray(saved) ? saved : [];
  render();
}

function save() {
  return chrome.storage.local.set({ forums });
}

function render() {
  const q = $('search').value;
  const list = sortForums(filterForums(forums, q));
  $('count').textContent = forums.length;
  $('empty').style.display = forums.length ? 'none' : '';
  const ul = $('forum-list');
  ul.innerHTML = '';
  for (const f of list) {
    const li = document.createElement('li');
    li.className = 'forum';
    const arch = f.url ? `<a href="${escHtml(archiveUrl(f.url))}" target="_blank" rel="noopener">Archive.org ↗</a>` : '';
    li.innerHTML = `
      <div class="top">
        <span class="name">${escHtml(f.name)}</span>
        ${f.quiet ? '<span class="quiet-tag">Quiet</span>' : ''}
      </div>
      ${f.url ? `<div class="url">${escHtml(f.url)}</div>` : ''}
      <div class="visit">${escHtml(visitLabel(f.visit))}</div>
      ${f.notes ? `<div class="notes">${escHtml(f.notes)}</div>` : ''}
      <div class="actions">
        ${arch}
        <button type="button" data-del="${f.id}" class="del">Delete</button>
      </div>`;
    ul.appendChild(li);
  }
  ul.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => {
      forums = forums.filter(f => f.id !== btn.dataset.del);
      save().then(render);
    }));
}

function wire() {
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = makeForum({
      name: $('f-name').value,
      url: $('f-url').value,
      visit: $('f-visit').value,
      notes: $('f-notes').value,
      quiet: $('f-quiet').checked,
    });
    if (!r.ok) { alert('Could not save: ' + r.error); return; }
    if (forums.length >= MAX_FORUMS) { alert('Forum list is full (500).'); return; }
    forums.push(r.entry);
    e.target.reset();
    save().then(render);
  });
  $('search').addEventListener('input', render);
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(forums, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ghost-town-forums.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
  $('import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const r = parseImport(String(rd.result || ''));
      if (!r.ok) { alert('Import failed: ' + r.error); return; }
      forums = sortForums([...forums, ...r.list]).slice(0, MAX_FORUMS);
      save().then(render);
    };
    rd.readAsText(file);
    e.target.value = '';
  });
  $('clear').addEventListener('click', () => {
    if (!forums.length || !confirm('Delete all saved forums?')) return;
    forums = [];
    save().then(render);
  });
}

if (typeof chrome !== 'undefined' && chrome.storage) {
  document.addEventListener('DOMContentLoaded', () => { wire(); load(); });
}
