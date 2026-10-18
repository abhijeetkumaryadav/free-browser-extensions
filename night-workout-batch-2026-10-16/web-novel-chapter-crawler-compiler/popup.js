/* Chapter Log — engine + UI. Heuristic-free manual reading log; zero network. */

// ENGINE-START
const MAX_CHAPTERS = 2000;
const STATUSES = ['to-read', 'reading', 'read'];

function makeChapter(novel, number, url, status, note) {
  novel = String(novel || '').trim().slice(0, 200);
  if (!novel) return null;
  number = Number(number);
  if (!Number.isFinite(number) || number < 1) return null;
  url = String(url || '').trim().slice(0, 2048);
  if (url && !/^https?:\/\//i.test(url)) return null;
  if (!STATUSES.includes(status)) status = 'to-read';
  return {
    id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
    novel, number: Math.floor(number), url, status,
    note: String(note || '').trim().slice(0, 500),
    addedAt: new Date().toISOString()
  };
}

function novelProgress(chapters, novel) {
  const list = chapters.filter(c => c.novel.toLowerCase() === novel.toLowerCase());
  const read = list.filter(c => c.status === 'read').length;
  const total = list.length;
  return { novel, total, read, pct: total ? Math.round(read / total * 100) : 0 };
}

function filterChapters(chapters, query) {
  query = String(query || '').trim().toLowerCase();
  if (!query) return chapters;
  return chapters.filter(c =>
    c.novel.toLowerCase().includes(query) ||
    c.note.toLowerCase().includes(query) ||
    String(c.number).includes(query));
}

function parseImport(text) {
  const data = JSON.parse(String(text));
  if (!Array.isArray(data)) return null;
  return data.map(d => makeChapter(d.novel, d.number, d.url, d.status, d.note)).filter(Boolean);
}

function serializeExport(chapters) {
  return JSON.stringify(chapters.map(c => ({ novel: c.novel, number: c.number, url: c.url, status: c.status, note: c.note })), null, 2);
}
// ENGINE-END

const listEl = document.getElementById('list');
const progressEl = document.getElementById('progress');
let chapters = [];

function save() { chrome.storage.local.set({ chapters }); }
function load() {
  chrome.storage.local.get(['chapters'], r => { chapters = Array.isArray(r.chapters) ? r.chapters : []; render(); });
}

function render() {
  const q = document.getElementById('search').value;
  const shown = filterChapters(chapters, q);

  // Per-novel progress
  const novels = [...new Set(chapters.map(c => c.novel))];
  progressEl.innerHTML = novels.length ? novels.map(n => {
    const p = novelProgress(chapters, n);
    return `<div class="novel-block"><h3>${escapeHtml(n)}</h3>
      <div class="bar"><i style="width:${p.pct}%"></i></div>
      <div class="stat">${p.read}/${p.total} read — ${p.pct}%</div></div>`;
  }).join('') : '<div class="empty">Log chapters to see per-novel progress.</div>';

  listEl.innerHTML = shown.length ? shown.map(c => `
    <li>
      <div class="main">
        <div class="title">${escapeHtml(c.novel)} — Ch. ${c.number}</div>
        <div class="meta">${c.addedAt.slice(0, 10)}</div>
        ${c.note ? `<div class="note">${escapeHtml(c.note)}</div>` : ''}
        ${c.url ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">Open</a>` : ''}
      </div>
      <select data-id="${c.id}" data-field="status">
        ${STATUSES.map(s => `<option value="${s}"${c.status === s ? ' selected' : ''}>${s}</option>`).join('')}
      </select>
      <button class="del" data-id="${c.id}" title="Delete">✕</button>
    </li>`).join('') : '<div class="empty">No chapters yet.</div>';

  listEl.querySelectorAll('select').forEach(sel => sel.addEventListener('change', () => {
    const c = chapters.find(x => x.id === sel.dataset.id);
    if (c) { c.status = sel.value; save(); render(); }
  }));
  listEl.querySelectorAll('.del').forEach(btn => btn.addEventListener('click', () => {
    chapters = chapters.filter(x => x.id !== btn.dataset.id); save(); render();
  }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

document.getElementById('addBtn').addEventListener('click', () => {
  const novel = document.getElementById('novel').value;
  const number = document.getElementById('chapter').value;
  const status = document.getElementById('status').value;
  const url = document.getElementById('url').value;
  const note = document.getElementById('note').value;
  const c = makeChapter(novel, number, url, status, note);
  if (!c) { alert('Enter a novel title and a chapter number ≥ 1.'); return; }
  if (chapters.length >= MAX_CHAPTERS) { alert('Log is full (2000 entries).'); return; }
  chapters.unshift(c); save(); render();
  ['novel', 'chapter', 'url', 'note'].forEach(id => document.getElementById(id).value = '');
});

document.getElementById('search').addEventListener('input', render);

document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([serializeExport(chapters)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'chapter-log.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const items = parseImport(r.result);
      if (!items) throw new Error('bad format');
      chapters = items.concat(chapters).slice(0, MAX_CHAPTERS);
      save(); render();
    } catch { alert('Import failed: invalid JSON.'); }
  };
  r.readAsText(f);
});

load();
