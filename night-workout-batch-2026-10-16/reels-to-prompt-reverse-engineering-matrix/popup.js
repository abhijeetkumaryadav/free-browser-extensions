/* ============================================================
 * Reel Matrix — manual reel-structure logbook
 * ------------------------------------------------------------
 * 100% local: chrome.storage.local only. Zero network calls.
 * Patterns come from YOUR logged observations — this tool has
 * no access to, and makes no claims about, any platform's
 * ranking algorithm.
 * ============================================================ */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- storage module ---------- */
const Store = {
  KEY: 'reelMatrix.logs.v1',
  /** @returns {Promise<Array>} all logged reels, newest first */
  async all() {
    const r = await chrome.storage.local.get(this.KEY);
    return Array.isArray(r[this.KEY]) ? r[this.KEY] : [];
  },
  async save(logs) { await chrome.storage.local.set({ [this.KEY]: logs }); },
};

/* ---------- dimensions analysed in the matrix ---------- */
const DIMS = [
  { key: 'hook',        label: 'Hook type'    },
  { key: 'caption',     label: 'Caption style' },
  { key: 'audio',       label: 'Audio'        },
  { key: 'cta',         label: 'CTA'          },
  { key: 'viewsBucket', label: 'Views bucket' },
];

/* ---------- tab switching ---------- */
$$('.tab').forEach((btn) => btn.addEventListener('click', () => {
  $$('.tab').forEach((b) => b.classList.remove('active'));
  $$('.pane').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
  $('#tab-' + btn.dataset.tab).classList.add('active');
}));

/* ---------- log form ---------- */
$('#logForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const logs = await Store.all();
  logs.unshift({
    id: uid(),
    label: (f.get('label') || 'Untitled reel').toString().trim().slice(0, 60) || 'Untitled reel',
    url: (f.get('url') || '').toString().trim().slice(0, 300),
    hook: f.get('hook'),
    hookSecs: Math.max(0, Number(f.get('hookSecs')) || 0),
    totalSecs: Math.max(1, Number(f.get('totalSecs')) || 0),
    caption: f.get('caption'),
    audio: f.get('audio'),
    cta: f.get('cta'),
    viewsBucket: f.get('viewsBucket'),
    note: (f.get('note') || '').toString().trim().slice(0, 400),
    createdAt: Date.now(),
  });
  await Store.save(logs);
  e.target.reset();
  await refresh();
});

/* ---------- matrix math ---------- */
/** Frequency table of a categorical dimension, sorted desc. */
function freq(logs, key) {
  const m = new Map();
  for (const l of logs) {
    const v = l[key] || '—';
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
/** Top combined value pairs across two dimensions. */
function pairFreq(logs, k1, k2, n = 3) {
  const m = new Map();
  for (const l of logs) {
    const v = `${l[k1] || '—'} × ${l[k2] || '—'}`;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Render the comparison matrix. */
function renderMatrix(logs) {
  const body = $('#matrixBody');
  const empty = $('#matrixEmpty');
  if (logs.length < 2) { body.hidden = true; empty.hidden = false; return; }
  empty.hidden = true; body.hidden = false;
  const total = logs.length;
  let html = `<div class="matrix-head">${total} reels logged · recurring patterns in your notes</div>`;

  for (const d of DIMS) {
    html += `<div class="dim"><div class="dim-title">${esc(d.label)}</div>` +
      freq(logs, d.key).slice(0, 5).map(([v, c]) =>
        `<div class="bar-row"><span class="bar-label" title="${esc(v)}">${esc(v)}</span>` +
        `<span class="bar-track"><span class="bar-fill" style="width:${Math.round((c / total) * 100)}%"></span></span>` +
        `<span class="bar-count">${c}</span></div>`).join('') + `</div>`;
  }

  const comboRows = [];
  for (const [a, b] of [['hook', 'caption'], ['hook', 'audio'], ['audio', 'cta']]) {
    for (const [v, c] of pairFreq(logs, a, b)) comboRows.push({ v, c });
  }
  comboRows.sort((x, y) => y.c - x.c);
  html += `<div class="dim"><div class="dim-title">Recurring combos</div>` +
    comboRows.slice(0, 4).map((r) =>
      `<div class="combo"><span>${esc(r.v)}</span><strong>×${r.c}</strong></div>`).join('') + `</div>`;

  const avg = (a) => a.length
    ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '—';
  html += `<div class="dim"><div class="dim-title">Timing</div>` +
    `<div class="stat-row">` +
    `<div class="stat"><b>${avg(logs.map((l) => l.hookSecs))}s</b><span>avg hook</span></div>` +
    `<div class="stat"><b>${avg(logs.map((l) => l.totalSecs))}s</b><span>avg length</span></div>` +
    `</div></div>`;

  html += `<div class="footnote">Based on your logged observations only.</div>`;
  body.innerHTML = html;
}

/* ---------- reel list ---------- */
const TRASH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

async function renderList() {
  const logs = await Store.all();
  $('#count').textContent = logs.length;
  const list = $('#reelList');
  if (!logs.length) { list.innerHTML = `<div class="empty">No reels logged yet.</div>`; return; }
  list.innerHTML = logs.map((l) => `
    <div class="card">
      <div class="card-main">
        <div class="card-title">${esc(l.label)}</div>
        <div class="card-meta">${esc(l.hook)} · ${esc(l.audio)} · ${esc(l.cta)}</div>
      </div>
      <button class="icon-btn" data-del="${l.id}" title="Delete" aria-label="Delete">${TRASH_SVG}</button>
    </div>`).join('');
  $$('#reelList [data-del]').forEach((btn) => btn.addEventListener('click', async () => {
    const logs2 = await Store.all();
    await Store.save(logs2.filter((l) => l.id !== btn.dataset.del));
    await refresh();
  }));
}

/* ---------- export + clear ---------- */
$('#exportBtn').addEventListener('click', async () => {
  const logs = await Store.all();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'reel-matrix-log.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete all logged reels?')) return;
  await Store.save([]);
  await refresh();
});

/* ---------- boot ---------- */
async function refresh() {
  const logs = await Store.all();
  renderMatrix(logs);
  await renderList();
}
refresh();
