/* Audiobook Shelf — engine + UI. Manual audiobook list; zero network, Gutenberg links are plain anchors. */

// ENGINE-START
const MAX_ITEMS = 2000;
const STATUSES = ['want', 'listening', 'finished'];

function makeTitle(title, author, source, status, note) {
  title = String(title || '').trim().slice(0, 200);
  if (!title) return null;
  source = String(source || '').trim().slice(0, 2048);
  if (source && !/^https?:\/\//i.test(source)) return null;
  if (!STATUSES.includes(status)) status = 'want';
  return {
    id: 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    title,
    author: String(author || '').trim().slice(0, 200),
    source, status,
    note: String(note || '').trim().slice(0, 500),
    addedAt: new Date().toISOString()
  };
}

function gutenbergSearchUrl(title, author) {
  const q = [title, author].filter(Boolean).join(' ').trim();
  return 'https://www.gutenberg.org/ebooks/search/?query=' + encodeURIComponent(q);
}

function filterTitles(items, query) {
  query = String(query || '').trim().toLowerCase();
  if (!query) return items;
  return items.filter(t =>
    t.title.toLowerCase().includes(query) ||
    t.author.toLowerCase().includes(query) ||
    t.note.toLowerCase().includes(query));
}

function statusCounts(items) {
  const counts = { want: 0, listening: 0, finished: 0 };
  for (const t of items) if (counts.hasOwnProperty(t.status)) counts[t.status]++;
  return counts;
}

function parseImport(text) {
  const data = JSON.parse(String(text));
  if (!Array.isArray(data)) return null;
  return data.map(d => makeTitle(d.title, d.author, d.source, d.status, d.note)).filter(Boolean);
}

function serializeExport(items) {
  return JSON.stringify(items.map(t => ({ title: t.title, author: t.author, source: t.source, status: t.status, note: t.note })), null, 2);
}
// ENGINE-END

const listEl = document.getElementById('list');
let items = [];

function save() { chrome.storage.local.set({ items }); }
function load() {
  chrome.storage.local.get(['items'], r => { items = Array.isArray(r.items) ? r.items : []; render(); });
}

function render() {
  const q = document.getElementById('search').value;
  const shown = filterTitles(items, q);
  const counts = statusCounts(items);
  listEl.innerHTML = (items.length ? `<li class="meta-row"><div class="main"><div class="meta">Want: ${counts.want} · Listening: ${counts.listening} · Finished: ${counts.finished}</div></div></li>` : '') +
    (shown.length ? shown.map(t => `
    <li>
      <div class="main">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="meta">${escapeHtml(t.author || 'Unknown author')} · added ${t.addedAt.slice(0, 10)}</div>
        ${t.note ? `<div class="note">${escapeHtml(t.note)}</div>` : ''}
        <div class="links">
          <a href="${gutenbergSearchUrl(t.title, t.author)}" target="_blank" rel="noopener">Gutenberg search</a>
          ${t.source ? `<a href="${escapeHtml(t.source)}" target="_blank" rel="noopener">Source</a>` : ''}
        </div>
      </div>
      <select data-id="${t.id}" data-field="status">
        ${STATUSES.map(s => `<option value="${s}"${t.status === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <button class="del" data-id="${t.id}" title="Delete">✕</button>
    </li>`).join('') : '<div class="empty">No titles yet.</div>');

  listEl.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
    const t = items.find(x => x.id === sel.dataset.id);
    if (t) { t.status = sel.value; save(); render(); }
  }));
  listEl.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', () => {
    items = items.filter(x => x.id !== btn.dataset.id); save(); render();
  }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

document.getElementById('addBtn').addEventListener('click', () => {
  const t = makeTitle(
    document.getElementById('title').value,
    document.getElementById('author').value,
    document.getElementById('source').value,
    document.getElementById('status').value,
    document.getElementById('note').value);
  if (!t) { alert('Enter a book title.'); return; }
  if (items.length >= MAX_ITEMS) { alert('List is full (2000 entries).'); return; }
  items.unshift(t); save(); render();
  ['title', 'author', 'source', 'note'].forEach(id => document.getElementById(id).value = '');
});

document.getElementById('search').addEventListener('input', render);

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([serializeExport(items)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'audiobook-shelf.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const arr = parseImport(r.result);
      if (!arr) throw new Error('bad format');
      items = arr.concat(items).slice(0, MAX_ITEMS);
      save(); render();
    } catch { alert('Import failed: invalid JSON.'); }
  };
  r.readAsText(f);
});

load();
