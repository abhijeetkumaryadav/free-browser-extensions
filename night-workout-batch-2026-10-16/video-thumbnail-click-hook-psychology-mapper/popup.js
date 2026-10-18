/* ============================================================
 * ThumbnailLab — thumbnail self-audit
 * ------------------------------------------------------------
 * Score YOUR OWN thumbnails against a click-psychology
 * checklist and compare traits against YOUR OWN logged CTR.
 * 100% local: chrome.storage.local only. Zero network calls.
 * This is a self-reflection aid — not a predictor of virality.
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
  KEY: 'thumbLab.scores.v1',
  /** @returns {Promise<Array>} all scored thumbnails, newest first */
  async all() {
    const r = await chrome.storage.local.get(this.KEY);
    return Array.isArray(r[this.KEY]) ? r[this.KEY] : [];
  },
  async save(items) { await chrome.storage.local.set({ [this.KEY]: items }); },
};

/* ---------- traits mapped by the Trends view ---------- */
const TRAITS = [
  { key: 'emotion',   label: 'Emotion clarity (1–5)', get: (t) => t.emotion,               fmt: (v) => v.toFixed(1) },
  { key: 'words',     label: 'Text words',            get: (t) => t.words,                 fmt: (v) => v.toFixed(1) },
  { key: 'contrast',  label: 'Contrast (1–5)',       get: (t) => t.contrast,              fmt: (v) => v.toFixed(1) },
  { key: 'curiosity', label: 'Curiosity gap (1–5)',   get: (t) => t.curiosity,             fmt: (v) => v.toFixed(1) },
  { key: 'face',      label: 'Face present',          get: (t) => (t.face ? 1 : 0),        fmt: (v) => Math.round(v * 100) + '%' },
];

/** Checklist total (max 21): face=1, words<=4=1 bonus, 1–5 traits summed. */
function totalScore(t) {
  return (t.face ? 1 : 0) + (t.words <= 4 ? 1 : 0) + t.emotion + t.contrast + t.curiosity;
}

/* ---------- tab switching ---------- */
$$('.tab').forEach((btn) => btn.addEventListener('click', () => {
  $$('.tab').forEach((b) => b.classList.remove('active'));
  $$('.pane').forEach((p) => p.classList.remove('active'));
  btn.classList.add('active');
  $('#tab-' + btn.dataset.tab).classList.add('active');
}));

/* ---------- range slider value badges ---------- */
for (const n of ['emotion', 'contrast', 'curiosity']) {
  const input = $(`input[name="${n}"]`);
  input.addEventListener('input', () => { $('#' + n + 'Val').textContent = input.value; });
}

/* ---------- score form ---------- */
$('#scoreForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const items = await Store.all();
  const rawCtr = (f.get('ctr') || '').toString().trim();
  items.unshift({
    id: uid(),
    label: (f.get('label') || 'Untitled thumbnail').toString().trim().slice(0, 60) || 'Untitled thumbnail',
    thumbRef: (f.get('thumbRef') || '').toString().trim().slice(0, 300),
    face: f.get('face') === 'on',
    emotion: Number(f.get('emotion')) || 3,
    words: Math.max(0, Number(f.get('words')) || 0),
    contrast: Number(f.get('contrast')) || 3,
    curiosity: Number(f.get('curiosity')) || 3,
    ctr: rawCtr === '' ? null : Math.min(100, Math.max(0, Number(rawCtr))),
    createdAt: Date.now(),
  });
  await Store.save(items);
  e.target.reset();
  for (const n of ['emotion', 'contrast', 'curiosity']) $('#' + n + 'Val').textContent = '3';
  await refresh();
});

/* ---------- trends math ---------- */
const avg = (items, get) => items.length
  ? items.reduce((s, x) => s + get(x), 0) / items.length : null;

/** Render trait averages: all entries, plus high/low CTR split when possible. */
function renderTrends(items) {
  const body = $('#trendsBody');
  const empty = $('#trendsEmpty');
  if (items.length < 2) { body.hidden = true; empty.hidden = false; return; }
  empty.hidden = true; body.hidden = false;

  const withCtr = items.filter((t) => typeof t.ctr === 'number');
  let html = '';
  if (withCtr.length >= 2) {
    const sorted = [...withCtr].map((t) => t.ctr).sort((a, b) => a - b);
    const median = (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
    const high = withCtr.filter((t) => t.ctr >= median);
    const low = withCtr.filter((t) => t.ctr < median);
    html += `<div class="t-head">Split at median CTR <b>${median.toFixed(1)}%</b> · ${high.length} higher vs ${low.length} lower (your data only)</div>`;
    for (const tr of TRAITS) {
      const a = avg(items, tr.get), h = avg(high, tr.get), l = avg(low, tr.get);
      const gap = h - l;
      const sign = gap >= 0 ? '+' : '−';
      html += `<div class="t-row"><div class="t-name">${esc(tr.label)}</div>` +
        `<div class="t-grid">` +
        `<div class="t-cell"><b>${tr.fmt(a)}</b><span>all</span></div>` +
        `<div class="t-cell"><b>${tr.fmt(h)}</b><span>high CTR</span></div>` +
        `<div class="t-cell gap"><b>${sign}${tr.fmt(Math.abs(gap)).replace(/^/, '')}</b><span>gap</span></div>` +
        `</div></div>`;
    }
    html += `<div class="footnote">Gaps show what differs in <em>your</em> logged thumbnails — not what will go viral.</div>`;
  } else {
    html += `<div class="t-head">Aggregate averages — add CTR % to entries to unlock the high/low split.</div>`;
    for (const tr of TRAITS) {
      const a = avg(items, tr.get);
      html += `<div class="t-row"><div class="t-name">${esc(tr.label)}</div>` +
        `<div class="t-grid"><div class="t-cell"><b>${tr.fmt(a)}</b><span>avg</span></div></div></div>`;
    }
  }
  body.innerHTML = html;
}

/* ---------- thumbnail list ---------- */
const TRASH_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

async function renderList() {
  const items = await Store.all();
  $('#count').textContent = items.length;
  const list = $('#thumbList');
  if (!items.length) { list.innerHTML = `<div class="empty">No thumbnails scored yet.</div>`; return; }
  // sort: entries with CTR first (desc), then newest
  const sorted = [...items].sort((a, b) => {
    const ac = a.ctr == null ? -1 : a.ctr, bc = b.ctr == null ? -1 : b.ctr;
    return bc - ac || b.createdAt - a.createdAt;
  });
  list.innerHTML = sorted.map((t) => {
    const pct = Math.round((totalScore(t) / 21) * 100);
    return `<div class="card">
      <div class="score-ring" style="--p:${pct}%"><span>${totalScore(t)}</span></div>
      <div class="card-main">
        <div class="card-title">${esc(t.label)}</div>
        <div class="card-meta">${t.ctr == null ? 'no CTR logged' : 'CTR ' + t.ctr + '%'} · ${t.face ? 'face' : 'no face'} · ${t.words} words</div>
      </div>
      <button class="icon-btn" data-del="${t.id}" title="Delete" aria-label="Delete">${TRASH_SVG}</button>
    </div>`;
  }).join('');
  $$('#thumbList [data-del]').forEach((btn) => btn.addEventListener('click', async () => {
    const items2 = await Store.all();
    await Store.save(items2.filter((t) => t.id !== btn.dataset.del));
    await refresh();
  }));
}

/* ---------- export + clear ---------- */
$('#exportBtn').addEventListener('click', async () => {
  const items = await Store.all();
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'thumbnail-lab-scores.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#clearBtn').addEventListener('click', async () => {
  if (!confirm('Delete all scored thumbnails?')) return;
  await Store.save([]);
  await refresh();
});

/* ---------- boot ---------- */
async function refresh() {
  const items = await Store.all();
  renderTrends(items);
  await renderList();
}
refresh();
