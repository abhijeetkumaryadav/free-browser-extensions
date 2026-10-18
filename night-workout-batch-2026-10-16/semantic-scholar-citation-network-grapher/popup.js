/* Citation Notes Graph — popup logic.
 * Your citation-network notes: save papers, link cites manually, sketch your
 * network. Your notes — not a live graph. Fully local, zero network. */

// ==================== ENGINE-START ====================
/** Create a paper entry. Returns null when title is missing. */
function makePaper(input) {
  const title = (input.title || '').trim();
  if (!title) return null;
  return {
    id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    title: title.slice(0, 200),
    authors: (input.authors || '').trim().slice(0, 200),
    year: clampYear(input.year),
    doi: (input.doi || '').trim().slice(0, 100),
    note: (input.note || '').trim().slice(0, 500),
    cites: Array.isArray(input.cites) ? input.cites.slice(0, 200) : [],
    addedAt: Date.now()
  };
}

/** Clamp year to a sane range, else null. */
function clampYear(y) {
  const n = Number(y);
  if (!Number.isFinite(n) || n < 1800 || n > 2100) return null;
  return Math.floor(n);
}

/** Semantic Scholar search URL for a paper title (opens in a new tab; the
 *  extension itself makes no network calls). */
function scholarUrl(title) {
  return 'https://www.semanticscholar.org/search?q=' + encodeURIComponent(title);
}

/** DOI resolver URL, or '' when no DOI. */
function doiUrl(doi) {
  const d = (doi || '').trim();
  return d ? 'https://doi.org/' + encodeURIComponent(d) : '';
}

/** Auto circle layout for the sketch: returns {id:{x,y}}. */
function layoutNodes(papers, w, h) {
  const pos = {};
  const n = papers.length;
  if (n === 0) return pos;
  if (n === 1) { pos[papers[0].id] = { x: w / 2, y: h / 2 }; return pos; }
  const cx = w / 2, cy = h / 2;
  const rx = Math.min(w / 2 - 40, 130), ry = Math.min(h / 2 - 34, 90);
  papers.forEach((p, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    pos[p.id] = { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
  return pos;
}

/** Count papers and valid cite-links (both ends must exist). */
function graphStats(papers) {
  const ids = new Set(papers.map(p => p.id));
  let links = 0;
  papers.forEach(p => (p.cites || []).forEach(c => { if (ids.has(c)) links++; }));
  return { papers: papers.length, links };
}

/** Case-insensitive search across title/authors/notes. */
function filterPapers(papers, q) {
  const needle = (q || '').trim().toLowerCase();
  if (!needle) return papers;
  return papers.filter(p =>
    p.title.toLowerCase().includes(needle) ||
    (p.authors || '').toLowerCase().includes(needle) ||
    (p.note || '').toLowerCase().includes(needle)
  );
}

/** Validate imported JSON. Returns array of papers or null. */
function validateImport(data) {
  if (!Array.isArray(data)) return null;
  const out = [];
  for (const raw of data) {
    if (!raw || typeof raw.title !== 'string' || !raw.title.trim()) continue;
    out.push(makePaper({
      title: raw.title, authors: raw.authors, year: raw.year,
      doi: raw.doi, note: raw.note,
      cites: Array.isArray(raw.cites) ? raw.cites.filter(c => typeof c === 'string') : []
    }));
  }
  return out.slice(0, 500);
}
// ==================== ENGINE-END ====================

const $ = id => document.getElementById(id);
const store = {
  async get() { return (await chrome.storage.local.get({ papers: [] })).papers; },
  async set(papers) { await chrome.storage.local.set({ papers }); }
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- tabs ---------- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('tab-' + t.dataset.tab).classList.add('active');
}));

/* ---------- add form ---------- */
async function refreshCiteOptions() {
  const papers = await store.get();
  const box = $('citesBox');
  box.innerHTML = papers.length
    ? papers.map(p => `<label><input type="checkbox" value="${p.id}"><span>${esc(p.title)}</span></label>`).join('')
    : '<span class="hint">Save some papers first — then pick which ones a new paper cites.</span>';
}
$('saveBtn').addEventListener('click', async () => {
  const msg = $('formMsg');
  const cites = [...$('citesBox').querySelectorAll('input:checked')].map(c => c.value);
  const paper = makePaper({
    title: $('fTitle').value, authors: $('fAuthors').value,
    year: $('fYear').value, doi: $('fDoi').value,
    note: $('fNote').value, cites
  });
  if (!paper) { msg.textContent = 'Please add a title.'; msg.className = 'msg err'; return; }
  const papers = await store.get();
  if (papers.length >= 500) { msg.textContent = 'Library full (500 papers).'; msg.className = 'msg err'; return; }
  papers.push(paper);
  await store.set(papers);
  ['fTitle','fAuthors','fYear','fDoi','fNote'].forEach(id => $(id).value = '');
  refreshCiteOptions(); renderAll();
  msg.textContent = 'Paper saved.'; msg.className = 'msg ok';
});

/* ---------- papers list ---------- */
function renderList(papers, q) {
  const list = $('paperList');
  const shown = filterPapers(papers, q);
  const byId = Object.fromEntries(papers.map(p => [p.id, p]));
  $('count').textContent = papers.length + ' paper' + (papers.length === 1 ? '' : 's');
  if (!shown.length) { list.innerHTML = '<div class="empty">No papers yet — add your first one.</div>'; return; }
  list.innerHTML = shown.map(p => {
    const citeNames = (p.cites || []).map(id => byId[id] ? byId[id].title : null).filter(Boolean);
    return `<div class="card" data-id="${p.id}">
      <div class="title">${esc(p.title)}</div>
      <div class="meta">${esc([p.authors, p.year ? String(p.year) : ''].filter(Boolean).join(' · '))}</div>
      ${p.note ? `<div class="note">“${esc(p.note)}”</div>` : ''}
      ${citeNames.length ? `<div class="links">Cites: ${esc(citeNames.join('; '))}</div>` : ''}
      <div class="actions">
        <a class="mini" href="${scholarUrl(p.title)}" target="_blank" rel="noopener">Search S2</a>
        ${p.doi ? `<a class="mini" href="${doiUrl(p.doi)}" target="_blank" rel="noopener">DOI</a>` : ''}
        <button class="mini del" data-del="${p.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const all = (await store.get()).filter(p => p.id !== b.dataset.del);
    // also drop dangling links
    all.forEach(p => { p.cites = (p.cites || []).filter(c => c !== b.dataset.del); });
    await store.set(all);
    refreshCiteOptions(); renderAll();
  }));
}
$('search').addEventListener('input', () => store.get().then(p => renderList(p, $('search').value)));

/* ---------- graph sketch ---------- */
const canvas = $('graphCanvas');
const ctx = canvas.getContext('2d');
let positions = {}, dragId = null;

function drawGraph(papers) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const ids = new Set(papers.map(p => p.id));
  papers.forEach(p => { if (!positions[p.id]) Object.assign(positions, layoutNodes(papers, W, H)); });
  // links
  ctx.strokeStyle = 'rgba(34,211,238,.45)'; ctx.lineWidth = 1.5;
  papers.forEach(p => (p.cites || []).forEach(c => {
    if (!ids.has(c) || !positions[p.id] || !positions[c]) return;
    const a = positions[p.id], b = positions[c];
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    // arrowhead toward b
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(b.x - 20 * Math.cos(ang), b.y - 20 * Math.sin(ang));
    ctx.lineTo(b.x - 20 * Math.cos(ang) - s * Math.cos(ang - .45), b.y - 20 * Math.sin(ang) - s * Math.sin(ang - .45));
    ctx.moveTo(b.x - 20 * Math.cos(ang), b.y - 20 * Math.sin(ang));
    ctx.lineTo(b.x - 20 * Math.cos(ang) - s * Math.cos(ang + .45), b.y - 20 * Math.sin(ang) - s * Math.sin(ang + .45));
    ctx.stroke();
  }));
  // nodes
  papers.forEach(p => {
    const pos = positions[p.id]; if (!pos) return;
    ctx.fillStyle = 'rgba(34,211,238,.16)';
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1f5f9'; ctx.font = '600 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const short = p.title.length > 14 ? p.title.slice(0, 13) + '…' : p.title;
    wrapLabel(short, pos.x, pos.y);
  });
}
function wrapLabel(text, x, y) {
  const words = text.split(' '); const lines = []; let line = '';
  words.forEach(w => {
    if ((line + ' ' + w).trim().length > 12 && line) { lines.push(line); line = w; }
    else line = (line + ' ' + w).trim();
  });
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, x, y - (lines.length - 1) * 6 + i * 12));
}
function nodeAt(x, y) {
  return Object.keys(positions).find(id => {
    const p = positions[id];
    return Math.hypot(p.x - x, p.y - y) <= 22;
  }) || null;
}
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
canvas.addEventListener('pointerdown', e => {
  const { x, y } = canvasPoint(e);
  dragId = nodeAt(x, y);
  if (dragId) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
});
canvas.addEventListener('pointermove', e => {
  if (!dragId) return;
  const { x, y } = canvasPoint(e);
  positions[dragId] = { x: Math.min(340, Math.max(8, x)), y: Math.min(232, Math.max(8, y)) };
  store.get().then(drawGraph);
});
canvas.addEventListener('pointerup', () => { dragId = null; canvas.style.cursor = 'grab'; });

/* ---------- export / import / clear ---------- */
$('exportBtn').addEventListener('click', async () => {
  const papers = await store.get();
  const blob = new Blob([JSON.stringify(papers, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'citation-notes.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = validateImport(JSON.parse(await f.text()));
    if (data === null) throw new Error('bad shape');
    const papers = (await store.get()).concat(data).slice(0, 500);
    await store.set(papers); refreshCiteOptions(); renderAll();
  } catch { alert('Could not import: not a valid citation-notes JSON file.'); }
  e.target.value = '';
});
$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete all saved papers and links?')) return;
  await store.set([]); positions = {}; refreshCiteOptions(); renderAll();
});

/* ---------- init ---------- */
async function renderAll() {
  const papers = await store.get();
  renderList(papers, $('search').value);
  drawGraph(papers);
  const s = graphStats(papers);
  $('statPapers').textContent = s.papers;
  $('statLinks').textContent = s.links;
}
refreshCiteOptions(); renderAll();
